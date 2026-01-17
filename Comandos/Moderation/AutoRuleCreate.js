// Comando: Crear regla de auto-moderación (Auto Moderation Rules)
// Usa la API oficial: https://discord.com/developers/docs/resources/auto-moderation
// Usa node-fetch (npm install node-fetch@2)

const fetch = require('node-fetch');
const debugHelper = require('../../Util/debugHelper');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');

module.exports = {
    name: 'amadd',
    alias: ['creaautoregla', 'crearreglaauto', 'automodadd', 'amcreate'],
    description: 'Crea una regla de auto-moderación (keywords/spam/mentions/presets).',
    usage: 'amadd <keyword> | amadd --trigger spam | amadd --trigger mention --mention-limit N | amadd --trigger preset --preset profanity',
    category: 'Moderation',
    cooldown: 10,
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
        const TRIGGER_TYPES = { keyword: 1, spam: 3, preset: 4, mention: 5 };
        const PRESETS = { profanity: 1, sexual_content: 2, slurs: 3 };

        const splitList = (raw) => {
            if (!raw) return [];
            return String(raw)
                .split(/[,|]/g)
                .map(s => s.trim())
                .filter(Boolean);
        };

        const extractChannelId = (raw) => {
            if (!raw) return null;
            const s = String(raw).trim();
            const m = s.match(/^(?:<#)?(\d{15,25})(?:>)?$/);
            return m ? m[1] : null;
        };

        const parseDurationSeconds = (raw) => {
            if (!raw) return null;
            const s = String(raw).trim().toLowerCase();
            if (/^\d+$/.test(s)) return Number(s);
            const m = s.match(/^(\d+)(s|m|h|d)$/);
            if (!m) return null;
            const n = Number(m[1]);
            const unit = m[2];
            const mult = unit === 's' ? 1 : unit === 'm' ? 60 : unit === 'h' ? 3600 : 86400;
            return n * mult;
        };

        const parseFlags = (argv) => {
            const flags = {};
            const positionals = [];
            for (let i = 0; i < argv.length; i++) {
                const token = String(argv[i] ?? '').trim();
                if (!token) continue;
                if (!token.startsWith('--')) {
                    positionals.push(token);
                    continue;
                }
                const [keyRaw, inlineValue] = token.slice(2).split('=');
                const key = String(keyRaw || '').trim().toLowerCase();
                if (!key) continue;
                const needsValue = !['off'].includes(key);
                let value = inlineValue;
                if (value === undefined && needsValue) {
                    // Flags cuyo valor puede contener espacios, p.ej: --msg hola mundo
                    const multiWordKeys = new Set(['name', 'msg', 'reason']);
                    if (multiWordKeys.has(key)) {
                        const parts = [];
                        while (argv[i + 1] !== undefined && !String(argv[i + 1]).startsWith('--')) {
                            parts.push(String(argv[i + 1]));
                            i++;
                        }
                        value = parts.length ? parts.join(' ') : undefined;
                    } else {
                        const next = argv[i + 1];
                        if (next !== undefined && !String(next).startsWith('--')) {
                            value = String(next);
                            i++;
                        }
                    }
                }
                flags[key] = value === undefined ? true : value;
            }
            return { flags, positionals };
        };

        const { flags, positionals } = parseFlags(args);

        const triggerKey = String(flags.trigger || 'keyword').trim().toLowerCase();
        const trigger_type = TRIGGER_TYPES[triggerKey] ?? TRIGGER_TYPES.keyword;
        const enabled = flags.off ? false : true;

        const keywords = positionals.flatMap(p => splitList(p));
        const allow_list = splitList(flags.allow);
        const regex_patterns = splitList(flags.regex);

        const presets = splitList(flags.preset)
            .map(p => String(p).trim().toLowerCase())
            .map(p => PRESETS[p])
            .filter(Boolean);

        const mention_total_limit = flags['mention-limit'] !== undefined ? Number(flags['mention-limit']) : undefined;
        const mention_raid_protection_enabled = (String(flags.raid || '').toLowerCase() === 'on')
            ? true
            : (String(flags.raid || '').toLowerCase() === 'off' ? false : undefined);

        const alertChannelId = extractChannelId(flags.alert);
        const timeoutSecondsRaw = parseDurationSeconds(flags.timeout);
        const timeoutSeconds = (timeoutSecondsRaw === null || timeoutSecondsRaw === undefined) ? null : timeoutSecondsRaw;
        const customMessage = flags.msg ? String(flags.msg).trim() : '';
        const reason = flags.reason ? String(flags.reason).trim() : '';

        debugHelper.log('autorulecreate', 'execute start', {
            guildId: message.guildId,
            trigger_type,
            enabled,
            keywords: keywords.length,
            hasAllowList: allow_list.length > 0,
            hasRegex: regex_patterns.length > 0,
            presets: presets.length,
            alert: Boolean(alertChannelId),
            timeoutSeconds: timeoutSeconds || null,
        });

        if (trigger_type === TRIGGER_TYPES.keyword && keywords.length === 0 && regex_patterns.length === 0) {
            debugHelper.warn('autorulecreate', 'missing keywords/regex', { guildId: message.guildId });
            const container = buildNoticeContainer({
                emoji: EMOJIS.cross,
                title: 'AutoMod',
                text: `Debes indicar al menos una keyword (ej: \`amadd insulto\`) o un regex (\`--regex\`).\nSi quieres una regla de spam, usa \`--trigger spam\` (sin keywords).`,
                footerText: `${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`,
            });
            return message.reply(asV2MessageOptions(container));
        }
        if (trigger_type === TRIGGER_TYPES.preset && presets.length === 0) {
            const container = buildNoticeContainer({
                emoji: EMOJIS.cross,
                title: 'AutoMod',
                text: `Para \`--trigger preset\` necesitas \`--preset profanity|sexual_content|slurs\`.`,
                footerText: `${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`,
            });
            return message.reply(asV2MessageOptions(container));
        }
        if (trigger_type === TRIGGER_TYPES.mention && (mention_total_limit === undefined || Number.isNaN(mention_total_limit))) {
            const container = buildNoticeContainer({
                emoji: EMOJIS.cross,
                title: 'AutoMod',
                text: `Para \`--trigger mention\` necesitas \`--mention-limit N\`.`,
                footerText: `${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`,
            });
            return message.reply(asV2MessageOptions(container));
        }
        if (timeoutSeconds !== null) {
            if (!Number.isFinite(timeoutSeconds) || timeoutSeconds < 1) {
                const container = buildNoticeContainer({
                    emoji: EMOJIS.cross,
                    title: 'AutoMod',
                    text: `Timeout inválido. Ejemplos: \`--timeout 60\`, \`--timeout 10m\`, \`--timeout 2h\`.`,
                    footerText: `${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`,
                });
                return message.reply(asV2MessageOptions(container));
            }
        }

        const guildId = message.guild.id;
        const url = `https://discord.com/api/v10/guilds/${guildId}/auto-moderation/rules`;

        const trigger_metadata = {};
        if (trigger_type === TRIGGER_TYPES.keyword) {
            if (keywords.length) trigger_metadata.keyword_filter = keywords;
            if (regex_patterns.length) trigger_metadata.regex_patterns = regex_patterns;
            if (allow_list.length) trigger_metadata.allow_list = allow_list;
        }
        if (trigger_type === TRIGGER_TYPES.preset) {
            trigger_metadata.presets = presets;
            if (allow_list.length) trigger_metadata.allow_list = allow_list;
        }
        if (trigger_type === TRIGGER_TYPES.mention) {
            trigger_metadata.mention_total_limit = mention_total_limit;
            if (mention_raid_protection_enabled !== undefined) {
                trigger_metadata.mention_raid_protection_enabled = mention_raid_protection_enabled;
            }
        }

        const actions = [];
        const blockMetadata = {};
        if (customMessage) blockMetadata.custom_message = customMessage.slice(0, 150);
        actions.push({ type: 1, metadata: blockMetadata });
        if (alertChannelId) actions.push({ type: 2, metadata: { channel_id: alertChannelId } });
        if (timeoutSeconds !== null) {
            const duration_seconds = Math.max(1, Math.min(2419200, Math.floor(timeoutSeconds)));
            actions.push({ type: 3, metadata: { duration_seconds } });
        }

        const ruleName = (flags.name ? String(flags.name).trim() : '') || (triggerKey === 'mention'
            ? 'AM: mention'
            : (keywords[0] ? `AM: ${keywords[0]}` : 'AM: regla'));

        const body = {
            name: ruleName.slice(0, 100),
            event_type: 1, // MESSAGE_SEND
            trigger_type,
            trigger_metadata,
            actions,
            enabled
        };
        try {
            const headers = {
                'Authorization': `Bot ${Moxi.token}`,
                'Content-Type': 'application/json'
            };
            if (reason) headers['X-Audit-Log-Reason'] = encodeURIComponent(reason);
            const res = await fetch(url, {
                method: 'POST',
                headers,
                body: JSON.stringify(body)
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({}));
                debugHelper.warn('autorulecreate', 'api error', { guildId, status: res.status, message: error.message });
                const container = buildNoticeContainer({
                    emoji: EMOJIS.cross,
                    title: 'AutoMod',
                    text: `Error al crear la regla: ${(error.message || res.status)}`,
                    footerText: `${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`,
                });
                return message.reply(asV2MessageOptions(container));
            }
            const created = await res.json().catch(() => null);
            const container = buildNoticeContainer({
                emoji: EMOJIS.check,
                title: 'AutoMod',
                text: `Regla creada${created?.id ? ` (ID: ${created.id})` : ''}.`,
                footerText: `${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`,
            });
            debugHelper.log('autorulecreate', 'rule created', { guildId, ruleId: created?.id || null, trigger_type, enabled });
            return message.reply(asV2MessageOptions(container));
        } catch (e) {
            debugHelper.error('autorulecreate', 'exception', { guildId: message.guild?.id || 'unknown', error: e.message });
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
