// Comando: Ver una regla de auto-moderación por ID
// Docs: https://discord.com/developers/docs/resources/auto-moderation

const fetch = require('node-fetch');
const { MessageFlags } = require('discord.js');
const debugHelper = require('../../Util/debugHelper');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');

module.exports = {
    name: 'amget',
    alias: ['autoregla', 'verautoregla', 'automodget'],
    description: 'Muestra una regla de auto-moderación por ID.',
    usage: 'amget <id>',
    category: 'Moderation',
    cooldown: 5,
    permissions: {
        user: ['Administrator'],
        bot: ['Administrator'],
        role: []
    },
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
        options: []
    },
    execute: async (Moxi, message, args) => {
        const id = args[0];
        const guildId = message.guild?.id;
        debugHelper.log('autoruleget', 'execute start', { guildId: message.guildId, ruleId: id || null });

        if (!id) {
            const container = buildNoticeContainer({
                emoji: EMOJIS.cross,
                title: 'AutoMod',
                text: 'Uso: amget <id>',
                footerText: `${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`,
            });
            return message.reply(asV2MessageOptions(container));
        }

        const url = `https://discord.com/api/v10/guilds/${guildId}/auto-moderation/rules/${id}`;

        const fmtTrigger = (t) => {
            switch (t) {
                case 1: return 'keyword';
                case 3: return 'spam';
                case 4: return 'preset';
                case 5: return 'mention';
                default: return String(t);
            }
        };
        const fmtAction = (a) => {
            switch (a) {
                case 1: return 'block';
                case 2: return 'alert';
                case 3: return 'timeout';
                default: return String(a);
            }
        };

        try {
            const res = await fetch(url, {
                headers: { 'Authorization': `Bot ${Moxi.token}` }
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({}));
                debugHelper.warn('autoruleget', 'api error', { guildId, ruleId: id, status: res.status, message: error.message });
                const container = buildNoticeContainer({
                    emoji: EMOJIS.cross,
                    title: 'AutoMod',
                    text: `Error al obtener la regla: ${(error.message || res.status)}`,
                    footerText: `${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`,
                });
                return message.reply(asV2MessageOptions(container));
            }

            const rule = await res.json().catch(() => null);
            if (!rule) {
                const container = buildNoticeContainer({
                    emoji: EMOJIS.cross,
                    title: 'AutoMod',
                    text: 'No se pudo leer la respuesta de Discord.',
                    footerText: `${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`,
                });
                return message.reply(asV2MessageOptions(container));
            }

            const actions = Array.isArray(rule.actions) ? rule.actions : [];
            const actionSummary = actions.length
                ? actions.map(a => {
                    const type = fmtAction(a?.type);
                    if (a?.type === 2 && a?.metadata?.channel_id) return `${type}→<#${a.metadata.channel_id}>`;
                    if (a?.type === 3 && a?.metadata?.duration_seconds) return `${type}→${a.metadata.duration_seconds}s`;
                    return type;
                }).join(', ')
                : '—';

            const md = rule.trigger_metadata || {};
            const extra = [];
            if (Array.isArray(md.keyword_filter) && md.keyword_filter.length) extra.push(`keywords: ${md.keyword_filter.slice(0, 10).join(', ')}${md.keyword_filter.length > 10 ? '…' : ''}`);
            if (Array.isArray(md.regex_patterns) && md.regex_patterns.length) extra.push(`regex: ${md.regex_patterns.slice(0, 5).join(' | ')}${md.regex_patterns.length > 5 ? '…' : ''}`);
            if (Array.isArray(md.allow_list) && md.allow_list.length) extra.push(`allow: ${md.allow_list.slice(0, 10).join(', ')}${md.allow_list.length > 10 ? '…' : ''}`);
            if (Array.isArray(md.presets) && md.presets.length) extra.push(`presets: ${md.presets.join(', ')}`);
            if (md.mention_total_limit !== undefined) extra.push(`mention_limit: ${md.mention_total_limit}`);
            if (md.mention_raid_protection_enabled !== undefined) extra.push(`raid: ${md.mention_raid_protection_enabled ? 'on' : 'off'}`);

            const container = buildNoticeContainer({
                emoji: EMOJIS.shield,
                title: 'AutoMod Rule',
                text:
                    `• **Nombre:** ${rule.name || '—'}\n` +
                    `• **ID:** ${rule.id || id}\n` +
                    `• **Enabled:** ${rule.enabled ? 'on' : 'off'}\n` +
                    `• **Trigger:** ${fmtTrigger(rule.trigger_type)}\n` +
                    `• **Actions:** ${actionSummary}` +
                    (extra.length ? `\n\n${extra.map(x => `• ${x}`).join('\n')}` : ''),
                footerText: `${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`,
            });

            debugHelper.log('autoruleget', 'rule fetched', { guildId, ruleId: rule.id || id });
            return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        } catch (e) {
            debugHelper.error('autoruleget', 'exception', { guildId: message.guild?.id || 'unknown', ruleId: id, error: e.message });
            const container = buildNoticeContainer({
                emoji: EMOJIS.cross,
                title: 'AutoMod',
                text: `Error: ${e.message}`,
                footerText: `${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`,
            });
            return message.reply(asV2MessageOptions(container));
        }
    }
};
