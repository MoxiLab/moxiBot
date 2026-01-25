const { MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { createEmojiContainer, finalizeEmojiContainer } = require('../../Util/emojiCard');
const debugHelper = require('../../Util/debugHelper');

function buildEmojiResponse(payload, client, translate) {
    return finalizeEmojiContainer(createEmojiContainer(payload), client, translate);
}

function parseEmojiId(input) {
    const raw = String(input || '').trim();
    if (!raw) return null;

    const m = raw.match(/^<a?:[\w~]{2,32}:(\d{17,21})>$/);
    if (m) return m[1];

    if (/^\d{17,21}$/.test(raw)) return raw;

    return null;
}

function normalizeKey(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

module.exports = {
    name: 'delemoji',
    alias: ['deleteemoji', 'removeemoji', 'rememoji', 'delemoji', 'de'],
    description: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('misc:DELEMOJI_DESC', lang) || 'Borra un emoji del servidor.';
    },
    usage: 'delemoji <emoji|id|nombre> [razón]',
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ADMIN', lang);
    },
    cooldown: 5,

    execute: async (Moxi, message, args) => {
        const translate = (message.translate ? message.translate.bind(message) : (k, vars) => moxi.translate(k, message.lang || 'es-ES', vars));
        const respond = (container) =>
            message.reply({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });

        debugHelper.log('delemoji', 'execute start', {
            guildId: message.guild?.id || 'dm',
            userId: message.author?.id,
            argsCount: Array.isArray(args) ? args.length : 0,
            preview: (args || []).slice(0, 3),
        });

        if (!message.guild) {
            const container = buildEmojiResponse(
                {
                    header: `# ❌ ${translate('misc:DELEMOJI_GUILD_ONLY') || 'Solo disponible en servidores'}`,
                    body: translate('misc:DELEMOJI_GUILD_ONLY_BODY') || 'Este comando solo funciona dentro de un servidor.',
                },
                Moxi,
                translate
            );
            return respond(container);
        }

        if (!message.member?.permissions?.has('ManageGuildExpressions')) {
            const container = buildEmojiResponse(
                {
                    header: `# ❌ ${translate('misc:DELEMOJI_NO_PERMISSION') || 'Sin permisos'}`,
                    body: translate('misc:NO_PERMISSION') || 'No tienes permisos para hacer eso.',
                },
                Moxi,
                translate
            );
            debugHelper.warn('delemoji', 'missing permission', {
                guildId: message.guild?.id,
                userId: message.author?.id,
            });
            return respond(container);
        }

        const target = String(args?.[0] || '').trim();
        if (!target) {
            const container = buildEmojiResponse(
                {
                    header: `# ℹ️ ${translate('misc:DELEMOJI_USAGE_TITLE') || 'Uso'}`,
                    body:
                        translate('misc:DELEMOJI_USAGE_BODY') ||
                        'Pasa un emoji personalizado, su ID, o su nombre exacto.\nEjemplos:\n• `delemoji <:miemoji:123...>`\n• `delemoji 123456789012345678`\n• `delemoji miemoji`',
                    detail: translate('misc:DELEMOJI_USAGE') || 'delemoji <emoji|id|nombre> [razón]',
                },
                Moxi,
                translate
            );
            return respond(container);
        }

        const reason = (args || []).slice(1).join(' ').trim() || `delemoji by ${message.author?.tag || message.author?.id || 'unknown'}`;
        const guild = message.guild;

        let emoji = null;
        const emojiId = parseEmojiId(target);
        if (emojiId) {
            emoji = guild.emojis.cache.get(emojiId) || null;
            if (!emoji) {
                try {
                    emoji = await guild.emojis.fetch(emojiId).catch(() => null);
                } catch {
                    emoji = null;
                }
            }
        } else {
            const wanted = normalizeKey(target);
            const matches = guild.emojis.cache.filter((e) => normalizeKey(e?.name) === wanted);
            if (matches.size === 1) {
                emoji = matches.first();
            } else if (matches.size > 1) {
                const list = matches
                    .first(10)
                    .map((e) => `${e}  \`${e.name}\`  (ID: \`${e.id}\`)`)
                    .join('\n');
                const container = buildEmojiResponse(
                    {
                        header: `# ⚠️ ${translate('misc:DELEMOJI_AMBIGUOUS') || 'Nombre ambiguo'}`,
                        body:
                            (translate('misc:DELEMOJI_AMBIGUOUS_BODY') || 'Hay varios emojis con ese nombre. Usa el ID:') +
                            `\n\n${list}`,
                        detail: 'delemoji <id> [razón]',
                    },
                    Moxi,
                    translate
                );
                return respond(container);
            }
        }

        if (!emoji) {
            const container = buildEmojiResponse(
                {
                    header: `# ❌ ${translate('misc:DELEMOJI_NOT_FOUND') || 'Emoji no encontrado'}`,
                    body:
                        translate('misc:DELEMOJI_NOT_FOUND_BODY') ||
                        'No encontré ese emoji en este servidor. Si es un emoji, asegúrate de que sea personalizado (no unicode) y de pasar el ID correcto.',
                },
                Moxi,
                translate
            );
            return respond(container);
        }

        try {
            const before = `${emoji}`;
            await emoji.delete(reason);

            const container = buildEmojiResponse(
                {
                    header: `# ✅ ${translate('misc:DELEMOJI_SUCCESS') || 'Emoji borrado'}`,
                    body:
                        (translate('misc:DELEMOJI_SUCCESS_BODY') || 'Se borró el emoji:') +
                        `\n${before}  \`${emoji.name}\`\nID: \`${emoji.id}\``,
                },
                Moxi,
                translate
            );
            debugHelper.log('delemoji', 'deleted', { guildId: guild.id, emojiId: emoji.id, emojiName: emoji.name });
            return respond(container);
        } catch (error) {
            debugHelper.error('delemoji', 'delete failed', error);
            const container = buildEmojiResponse(
                {
                    header: `# ❌ ${translate('misc:DELEMOJI_ERROR') || 'No se pudo borrar'}`,
                    body:
                        (translate('misc:DELEMOJI_ERROR_BODY') || 'Discord rechazó la operación.') +
                        `\n\n\`${String(error?.message || error)}\``,
                },
                Moxi,
                translate
            );
            return respond(container);
        }
    },
};
