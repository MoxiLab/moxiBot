const { SlashCommandBuilder } = require('discord.js');
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

function getInteractionDisplayName(interaction, user) {
    const member = interaction?.guild?.members?.cache?.get?.(user?.id);
    return String(member?.displayName || user?.globalName || user?.username || user?.tag || 'User');
}

module.exports = {
    cooldown: 0,
    Category: funCategory,
    data: new SlashCommandBuilder()
        .setName('ship')
        .setDescription('Haz ship entre dos personas')
        .addUserOption(opt =>
            opt
                .setName('persona1')
                .setDescription('Primera persona')
                .setRequired(true)
        )
        .addUserOption(opt =>
            opt
                .setName('persona2')
                .setDescription('Segunda persona (opcional)')
                .setRequired(false)
        )
        .setDMPermission(true),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const u1 = interaction.options.getUser('persona1', true);
        const u2 = interaction.options.getUser('persona2', false) || interaction.user;

        const a = getInteractionDisplayName(interaction, u1);
        const b = getInteractionDisplayName(interaction, u2);

        const seedParts = [String(u1.id), String(u2.id)].sort();
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

            const avatar1 = getAvatarUrl(u1);
            const avatar2 = getAvatarUrl(u2);
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

            return interaction.reply({
                content: caption,
                files: [attachment],
                allowedMentions: { repliedUser: false },
            });
        } catch {
            const bar = buildBar(pct);
            const text = moxi.translate('FUN_SHIP_RESULT', lang, { a, b, pct, bar, rating })
                || `**${a}** ❤ **${b}**\nCompatibilidad: **${pct}%**\n${bar}\n${rating}`;

            return interaction.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: '💘',
                        title: moxi.translate('FUN_SHIP_TITLE', lang) || 'Ship',
                        text,
                    })
                ),
            });
        }
    },
};
