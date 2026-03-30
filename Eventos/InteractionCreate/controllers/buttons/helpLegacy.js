module.exports = async function helpLegacyButtons(interaction, Moxi, logger) {
    if (!interaction.customId || !interaction.customId.startsWith('help_')) return false;

    logger?.info?.(`[Button] Pulsado (legacy->V2): ${interaction.customId}`);

    try {
        const getHelpContent = require('../../../../Util/getHelpContent');
        const moxi = require('../../../../i18n');
        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const userId = interaction.user?.id || interaction.member?.user?.id;
        const help = await getHelpContent({ page: 0, tipo: 'main', categoria: null, client: Moxi, lang, guildId, userId, useV2: true });
        await interaction.update(help);
    } catch {
        // swallow errors to mimic legacy behavior
    }

    return true;
};
