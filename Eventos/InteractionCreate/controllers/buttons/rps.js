const { MessageFlags } = require('discord.js');

const moxi = require('../../../../i18n');
const { EMOJIS } = require('../../../../Util/emojis');
const { buildNoticeContainer } = require('../../../../Util/v2Notice');
const { parseRpsCustomId, resolveRps, buildRpsMessageOptions } = require('../../../../Util/rpsGame');

module.exports = async function rpsButtons(interaction) {
    if (!interaction.isButton?.()) return false;

    const parsed = parseRpsCustomId(interaction.customId);
    if (!parsed) return false;

    const { action, userId, choice } = parsed;

    if (interaction.user?.id !== String(userId)) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const fallbackLang = interaction.guildLocale || interaction.locale || process.env.DEFAULT_LANG || 'es-ES';
        const lang = await moxi.guildLang(guildId, fallbackLang);
        const payload = {
            content: '',
            components: [buildNoticeContainer({ emoji: EMOJIS.noEntry, text: moxi.translate('misc:ONLY_AUTHOR_BUTTONS', lang) })],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        };
        if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => null);
        else await interaction.reply(payload).catch(() => null);
        return true;
    }

    const guildId = interaction.guildId || interaction.guild?.id;
    const fallbackLang = interaction.guildLocale || interaction.locale || process.env.DEFAULT_LANG || 'es-ES';
    const lang = await moxi.guildLang(guildId, fallbackLang);

    if (action === 'new') {
        const payload = buildRpsMessageOptions({ userId, lang });
        await interaction.update(payload).catch(() => null);
        return true;
    }

    if (action === 'pick') {
        const resolved = resolveRps(choice);
        const payload = buildRpsMessageOptions({ userId, lang, resolved });
        await interaction.update(payload).catch(() => null);
        return true;
    }

    return true;
};
