const { MessageFlags } = require('discord.js');

const moxi = require('../../../../i18n');
const { EMOJIS } = require('../../../../Util/emojis');
const { buildNoticeContainer } = require('../../../../Util/v2Notice');
const { parseBuffsCustomId, buildBuffsMessage } = require('../../../../Util/buffsView');

module.exports = async function buffsButtons(interaction) {
    const parsed = parseBuffsCustomId(interaction?.customId);
    if (!parsed) return false;

    const { action, userId } = parsed;

    if (interaction.user?.id !== String(userId)) {
        const lang = await moxi.guildLang(interaction.guildId || interaction.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
        const payload = {
            content: '',
            components: [buildNoticeContainer({ emoji: EMOJIS.noEntry, text: 'Solo el autor puede usar estos botones.' })],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        };
        if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => null);
        else await interaction.reply(payload).catch(() => null);
        return true;
    }

    if (action !== 'refresh') return true;

    const guildId = interaction.guildId || interaction.guild?.id;
    const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
    const payload = await buildBuffsMessage({ guildId, lang, userId: interaction.user.id });

    await interaction.update(payload).catch(() => null);
    return true;
};
