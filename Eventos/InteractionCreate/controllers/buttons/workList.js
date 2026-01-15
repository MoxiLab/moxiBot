const { MessageFlags } = require('discord.js');

const moxi = require('../../../../i18n');
const { EMOJIS } = require('../../../../Util/emojis');
const { buildNoticeContainer } = require('../../../../Util/v2Notice');
const {
    buildWorkListContainer,
    parseWorkListCustomId,
} = require('../../../../Util/workListPanel');

module.exports = async function workListButtons(interaction, Moxi, logger) {
    const parsed = parseWorkListCustomId(interaction?.customId);
    if (!parsed) return false;

    const { action, userId, page } = parsed;

    // Solo el usuario que abrió el panel puede usar los botones
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

    const guildId = interaction.guildId || interaction.guild?.id;
    const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

    if (action === 'help') {
        const payload = {
            content: '',
            components: [
                buildNoticeContainer({
                    emoji: EMOJIS.question,
                    title: 'Work',
                    text: 'Usa **/work apply** para elegir una profesión.\nLuego usa **/work shift** para hacer turnos.',
                }),
            ],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        };
        if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => null);
        else await interaction.reply(payload).catch(() => null);
        return true;
    }

    if (action === 'close') {
        const built = buildWorkListContainer({ lang, page: Number(page) || 0, userId, disabledButtons: true });
        await interaction.update({ content: '', components: [built.container], flags: MessageFlags.IsComponentsV2 }).catch(() => null);
        return true;
    }

    let nextPage = Number(page) || 0;
    if (action === 'prev') nextPage = nextPage - 1;
    if (action === 'next') nextPage = nextPage + 1;
    if (action === 'refresh') nextPage = nextPage;

    const built = buildWorkListContainer({ lang, page: nextPage, userId });
    await interaction.update({ content: '', components: [built.container], flags: MessageFlags.IsComponentsV2 }).catch(() => null);
    return true;
};
