const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { funCategory } = require('../../Util/commandCategories');
const { Bot } = require('../../Config');

function fnv1a32(input) {
    const str = String(input ?? '');
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0;
}

function clampInt(n, min, max) {
    const x = Math.trunc(Number(n));
    if (!Number.isFinite(x)) return min;
    return Math.max(min, Math.min(max, x));
}

function buildBar(pct) {
    const filled = clampInt(Math.round(Number(pct) / 10), 0, 10);
    return `${'▰'.repeat(filled)}${'▱'.repeat(10 - filled)}`;
}

function toHexColor(color) {
    const n = Number(color);
    if (!Number.isFinite(n)) return '#FFB6E6';
    const hex = (n >>> 0).toString(16).padStart(6, '0');
    return `#${hex}`;
}

function getAvatarUrl(user) {
    try {
        if (user && typeof user.displayAvatarURL === 'function') {
            return user.displayAvatarURL({ extension: 'png', size: 512, forceStatic: true });
        }
    } catch { }
    return 'https://cdn.discordapp.com/embed/avatars/0.png';
}

function getDisplayName(message, user) {
    const guild = message?.guild;
    const member = guild?.members?.cache?.get?.(user?.id);
    return String(member?.displayName || user?.globalName || user?.username || user?.tag || 'User');
}

function parsePairFromMessage(message, args) {
    const mentions = Array.from(message?.mentions?.users?.values?.() || []);

    if (mentions.length >= 2) {
        return {
            aKey: String(mentions[0].id),
            bKey: String(mentions[1].id),
            aName: getDisplayName(message, mentions[0]),
            bName: getDisplayName(message, mentions[1]),
        };
    }

    if (mentions.length === 1) {
        const author = message?.author;
        return {
            aKey: String(author?.id || 'author'),
            bKey: String(mentions[0].id),
            aName: getDisplayName(message, author),
            bName: getDisplayName(message, mentions[0]),
        };
    }

    const text = Array.isArray(args) ? args.join(' ').trim() : '';
    if (!text) return null;

    // Permite: name1 | name2
    if (text.includes('|')) {
        const [left, right] = text.split('|').map(s => String(s || '').trim());
        if (left && right) {
            return {
                aKey: left.toLowerCase(),
                bKey: right.toLowerCase(),
                aName: left,
                bName: right,
            };
        }
    }

    // Permite: name1 name2...
    const parts = text.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
        const aName = parts[0];
        const bName = parts.slice(1).join(' ');
        return {
            aKey: aName.toLowerCase(),
            bKey: bName.toLowerCase(),
            aName,
            bName,
        };
    }

    return null;
}

module.exports = {
    name: 'ship',
    alias: ['ship', 'love', 'pareja', 'match'],
    Category: funCategory,
    usage: 'ship @persona1 [@persona2] | ship nombre1 | nombre2',
    description: 'commands:CMD_SHIP_DESC',
    cooldown: 0,

    async execute(Moxi, message, args) {
        const guildId = message.guildId || message.guild?.id;
        const lang = message.lang || await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const pair = parsePairFromMessage(message, args);
        if (!pair) {
            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: '💘',
                        title: moxi.translate('FUN_SHIP_TITLE', lang) || 'Ship',
                        text: moxi.translate('FUN_SHIP_NO_TARGET', lang) || 'Menciona a alguien o escribe dos nombres.',
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        const a = String(pair.aName || 'A');
        const b = String(pair.bName || 'B');

        const seedParts = [String(pair.aKey || ''), String(pair.bKey || '')].sort();
        const seed = `${seedParts[0]}:${seedParts[1]}:${String(guildId || 'dm')}`;
        const pct = fnv1a32(seed) % 101;

        const ratingKey = pct <= 30 ? 'FUN_SHIP_RATING_LOW' : (pct <= 70 ? 'FUN_SHIP_RATING_MID' : 'FUN_SHIP_RATING_HIGH');
        const ratingFallback = pct <= 30
            ? 'No es el momento…'
            : (pct <= 70 ? 'Hay química 👀' : '¡Almas gemelas! 💞');

        const rating = moxi.translate(ratingKey, lang) || ratingFallback;

        // Card (canvafy Ship). Best-effort + fallback a texto.
        try {
            const { AttachmentBuilder } = require('discord.js');
            const { Ship } = require('canvafy');

            const mentioned = Array.from(message?.mentions?.users?.values?.() || []);
            const user1 = mentioned.length >= 2
                ? mentioned[0]
                : (mentioned.length === 1 ? message.author : message.author);
            const user2 = mentioned.length >= 2
                ? mentioned[1]
                : (mentioned.length === 1 ? mentioned[0] : message.author);

            const avatar1 = getAvatarUrl(user1);
            const avatar2 = getAvatarUrl(user2);

            const accentHex = toHexColor(Bot?.AccentColor);

            const buffer = await new Ship()
                .setAvatars(avatar1, avatar2)
                .setBackground('color', '#23272a')
                .setBorder(accentHex)
                .setOverlayOpacity(0.65)
                .setCustomNumber(pct)
                .build();

            const attachment = new AttachmentBuilder(buffer, { name: 'ship.png' });
            const caption = `**${a}** ❤ **${b}** — **${pct}%**\n${rating}`;

            return message.reply({
                content: caption,
                files: [attachment],
                allowedMentions: { repliedUser: false },
            });
        } catch {
            const bar = buildBar(pct);
            const text = moxi.translate('FUN_SHIP_RESULT', lang, { a, b, pct, bar, rating })
                || `**${a}** ❤ **${b}**\nCompatibilidad: **${pct}%**\n${bar}\n${rating}`;

            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: '💘',
                        title: moxi.translate('FUN_SHIP_TITLE', lang) || 'Ship',
                        text,
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }
    },
};
