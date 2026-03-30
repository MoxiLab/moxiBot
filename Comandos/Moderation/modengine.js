const { ContainerBuilder, MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const ms = require('ms');
const { Bot } = require('../../Config');
const { EMOJIS } = require('../../Util/emojis');
const {
    getGuildConfig,
    upsertGuildConfig,
    ensureDefaultRules,
    listRules,
    upsertRule,
    removeRule,
} = require('../../Util/moderationEngineStorage');

function buildPanel({ title, body }) {
    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(c => c.setContent(`# ${title}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(body));

    return { content: '', components: [container], flags: MessageFlags.IsComponentsV2 };
}

function parseChannelId(message, raw) {
    const mentioned = message.mentions?.channels?.first?.();
    if (mentioned?.id) return mentioned.id;
    if (!raw) return '';
    const id = String(raw).replace(/[<#>]/g, '').trim();
    return /^\d{15,30}$/.test(id) ? id : '';
}

function parseKeyValues(tokens) {
    const values = {};
    const extra = [];
    for (const token of tokens) {
        const text = String(token || '').trim();
        if (!text) continue;
        const match = text.match(/^([a-zA-Z_\-]+)=(.+)$/);
        if (match) {
            const key = String(match[1]).trim().toLowerCase();
            values[key] = String(match[2]).trim();
        } else {
            extra.push(text);
        }
    }
    return { values, extra };
}

function formatList(list, formatter) {
    if (!Array.isArray(list) || !list.length) return '-';
    return list.map(formatter).join(', ');
}

module.exports = {
    name: 'modengine',
    alias: ['automodengine', 'automod', 'modeng'],
    description: 'Configura el motor de moderacion avanzado (anti-raid, scoring y reglas).',
    usage: 'modengine status | modengine on/off | modengine log #canal|off | modengine defense off|soft|hard [dur=10m] | modengine thresholds warn=4 mute=7 kick=10 ban=13 | modengine allowlinks add|remove #canal | modengine allowinvites add|remove #canal | modengine rule list|add|remove ...',
    Category: (lang = 'es-ES') => moxi.translate('commands:CATEGORY_MODERATION', lang) || 'Moderation',
    permissions: { User: ['Administrator'] },
    cooldown: 5,

    async execute(Moxi, message, args) {
        if (!message.guild) {
            return message.reply(buildPanel({
                title: 'ModEngine',
                body: `${EMOJIS.cross} Este comando solo funciona en servidores.`,
            }));
        }

        const guildId = message.guild.id;
        const sub = String(args[0] || 'status').toLowerCase();
        const config = await getGuildConfig({ guildId });

        if (sub === 'help') {
            return message.reply(buildPanel({
                title: 'ModEngine',
                body: `Uso:\n${this.usage}`,
            }));
        }

        if (sub === 'on' || sub === 'enable') {
            await upsertGuildConfig({ guildId, patch: { enabled: true } });
            return message.reply(buildPanel({
                title: 'ModEngine',
                body: `${EMOJIS.tick} Motor activado.`,
            }));
        }

        if (sub === 'off' || sub === 'disable') {
            await upsertGuildConfig({ guildId, patch: { enabled: false } });
            return message.reply(buildPanel({
                title: 'ModEngine',
                body: `${EMOJIS.tick} Motor desactivado.`,
            }));
        }

        if (sub === 'log' || sub === 'logs') {
            const raw = String(args[1] || '').trim().toLowerCase();
            if (!raw || raw === 'off' || raw === 'clear') {
                await upsertGuildConfig({ guildId, patch: { logChannelId: null } });
                return message.reply(buildPanel({
                    title: 'ModEngine',
                    body: `${EMOJIS.tick} Logs desactivados.`,
                }));
            }

            const channelId = parseChannelId(message, args[1]);
            if (!channelId) {
                return message.reply(buildPanel({
                    title: 'ModEngine',
                    body: `${EMOJIS.cross} Uso: modengine log #canal | modengine log off`,
                }));
            }

            await upsertGuildConfig({ guildId, patch: { logChannelId: channelId } });
            return message.reply(buildPanel({
                title: 'ModEngine',
                body: `${EMOJIS.tick} Canal de logs configurado: <#${channelId}>`,
            }));
        }

        if (sub === 'defense' || sub === 'defensa') {
            const mode = String(args[1] || '').trim().toLowerCase();
            if (!['off', 'soft', 'hard'].includes(mode)) {
                return message.reply(buildPanel({
                    title: 'ModEngine',
                    body: `${EMOJIS.cross} Uso: modengine defense off|soft|hard [dur=10m]`,
                }));
            }

            if (mode === 'off') {
                await upsertGuildConfig({ guildId, patch: { defenseMode: 'off', defenseUntil: null } });
                return message.reply(buildPanel({
                    title: 'ModEngine',
                    body: `${EMOJIS.tick} Defense mode desactivado.`,
                }));
            }

            const { values } = parseKeyValues(args.slice(2));
            const durRaw = values.dur || values.duration || '';
            const durMs = durRaw ? ms(durRaw) : null;
            const defaultMs = mode === 'hard'
                ? Number(config.antiRaid?.hardDurationMs) || 1800000
                : Number(config.antiRaid?.softDurationMs) || 600000;
            const durationMs = (durMs && Number.isFinite(durMs) && durMs > 0) ? durMs : defaultMs;
            const until = new Date(Date.now() + durationMs);

            await upsertGuildConfig({ guildId, patch: { defenseMode: mode, defenseUntil: until } });
            return message.reply(buildPanel({
                title: 'ModEngine',
                body: `${EMOJIS.tick} Defense mode ${mode} activado hasta ${until.toISOString()}.`,
            }));
        }

        if (sub === 'thresholds' || sub === 'umbrales') {
            const { values } = parseKeyValues(args.slice(1));
            const next = {};
            const warn = Number(values.warn);
            const mute = Number(values.mute);
            const kick = Number(values.kick);
            const ban = Number(values.ban);

            if (Number.isFinite(warn)) next.warn = Math.max(1, Math.round(warn));
            if (Number.isFinite(mute)) next.mute = Math.max(1, Math.round(mute));
            if (Number.isFinite(kick)) next.kick = Math.max(1, Math.round(kick));
            if (Number.isFinite(ban)) next.ban = Math.max(1, Math.round(ban));

            if (!Object.keys(next).length) {
                return message.reply(buildPanel({
                    title: 'ModEngine',
                    body: `${EMOJIS.cross} Uso: modengine thresholds warn=4 mute=7 kick=10 ban=13`,
                }));
            }

            await upsertGuildConfig({ guildId, patch: { thresholds: next } });
            return message.reply(buildPanel({
                title: 'ModEngine',
                body: `${EMOJIS.tick} Umbrales actualizados.`,
            }));
        }

        if (sub === 'allowlinks' || sub === 'links') {
            const action = String(args[1] || '').trim().toLowerCase();
            if (action === 'list' || action === 'lista' || !action) {
                const list = formatList(config.allowLinksChannels, (id) => `<#${id}>`);
                return message.reply(buildPanel({
                    title: 'ModEngine',
                    body: `Canales permitidos para links: ${list}`,
                }));
            }

            const channelId = parseChannelId(message, args[2]);
            if (!channelId) {
                return message.reply(buildPanel({
                    title: 'ModEngine',
                    body: `${EMOJIS.cross} Uso: modengine allowlinks add|remove #canal`,
                }));
            }

            const current = Array.isArray(config.allowLinksChannels) ? config.allowLinksChannels : [];
            const set = new Set(current);
            if (action === 'add' || action === 'agregar') set.add(channelId);
            if (action === 'remove' || action === 'del' || action === 'rm' || action === 'quitar') set.delete(channelId);

            await upsertGuildConfig({ guildId, patch: { allowLinksChannels: Array.from(set) } });
            return message.reply(buildPanel({
                title: 'ModEngine',
                body: `${EMOJIS.tick} Canales de links actualizados.`,
            }));
        }

        if (sub === 'allowinvites' || sub === 'invites') {
            const action = String(args[1] || '').trim().toLowerCase();
            if (action === 'list' || action === 'lista' || !action) {
                const list = formatList(config.allowInvitesChannels, (id) => `<#${id}>`);
                return message.reply(buildPanel({
                    title: 'ModEngine',
                    body: `Canales permitidos para invites: ${list}`,
                }));
            }

            const channelId = parseChannelId(message, args[2]);
            if (!channelId) {
                return message.reply(buildPanel({
                    title: 'ModEngine',
                    body: `${EMOJIS.cross} Uso: modengine allowinvites add|remove #canal`,
                }));
            }

            const current = Array.isArray(config.allowInvitesChannels) ? config.allowInvitesChannels : [];
            const set = new Set(current);
            if (action === 'add' || action === 'agregar') set.add(channelId);
            if (action === 'remove' || action === 'del' || action === 'rm' || action === 'quitar') set.delete(channelId);

            await upsertGuildConfig({ guildId, patch: { allowInvitesChannels: Array.from(set) } });
            return message.reply(buildPanel({
                title: 'ModEngine',
                body: `${EMOJIS.tick} Canales de invites actualizados.`,
            }));
        }

        if (sub === 'rule' || sub === 'rules') {
            const action = String(args[1] || 'list').trim().toLowerCase();
            if (action === 'list' || action === 'lista') {
                await ensureDefaultRules({ guildId });
                const rules = await listRules({ guildId, enabledOnly: false });
                const lines = rules.slice(0, 10).map((rule) => {
                    return `• ${rule.id} | ${rule.type} | sev=${rule.severity} | ${rule.actionHint} | ${rule.enabled ? 'on' : 'off'} | ${rule.pattern}`;
                });
                return message.reply(buildPanel({
                    title: 'ModEngine',
                    body: rules.length ? lines.join('\n') : 'No hay reglas.',
                }));
            }

            if (action === 'add' || action === 'agregar') {
                const { values, extra } = parseKeyValues(args.slice(2));
                const type = String(extra[0] || '').trim().toUpperCase();
                const pattern = String(extra.slice(1).join(' ') || '').trim();
                if (!type || !pattern) {
                    return message.reply(buildPanel({
                        title: 'ModEngine',
                        body: `${EMOJIS.cross} Uso: modengine rule add <type> <pattern> [severity=5] [action=SCORE_ONLY] [enabled=true] [notes=texto]`,
                    }));
                }

                const severity = Number(values.severity || values.sev || 1);
                const actionHint = String(values.action || values.actionhint || 'SCORE_ONLY').toUpperCase();
                const enabled = values.enabled !== undefined ? !['false', '0', 'off', 'no'].includes(String(values.enabled).toLowerCase()) : true;
                const notes = values.notes || values.note || '';

                const rule = await upsertRule({
                    guildId,
                    rule: { type, pattern, severity, actionHint, enabled, notes },
                });

                return message.reply(buildPanel({
                    title: 'ModEngine',
                    body: `${EMOJIS.tick} Regla creada: ${rule.id}`,
                }));
            }

            if (action === 'remove' || action === 'del' || action === 'rm' || action === 'quitar') {
                const ruleId = String(args[2] || '').trim();
                if (!ruleId) {
                    return message.reply(buildPanel({
                        title: 'ModEngine',
                        body: `${EMOJIS.cross} Uso: modengine rule remove <id>`,
                    }));
                }
                const ok = await removeRule({ guildId, ruleId });
                return message.reply(buildPanel({
                    title: 'ModEngine',
                    body: ok ? `${EMOJIS.tick} Regla eliminada.` : `${EMOJIS.info || ''} No se encontro la regla.`,
                }));
            }
        }

        if (sub === 'status' || sub === 'estado') {
            await ensureDefaultRules({ guildId });
            const status = config.enabled ? 'ON' : 'OFF';
            const logText = config.logChannelId ? `<#${config.logChannelId}>` : '-';
            const defense = config.defenseMode || 'off';
            const thresholds = config.thresholds || {};
            const lines = [
                `${EMOJIS.info || ''} Estado: ${status}`,
                `${EMOJIS.channel || ''} Logs: ${logText}`,
                `${EMOJIS.lock || ''} Defense: ${defense}`,
                `Umbrales: warn=${thresholds.warn} mute=${thresholds.mute} kick=${thresholds.kick} ban=${thresholds.ban}`,
            ];
            return message.reply(buildPanel({
                title: 'ModEngine',
                body: lines.join('\n'),
            }));
        }

        return message.reply(buildPanel({
            title: 'ModEngine',
            body: `${EMOJIS.cross} Subcomando no valido. Usa: ${this.usage}`,
        }));
    },
};
