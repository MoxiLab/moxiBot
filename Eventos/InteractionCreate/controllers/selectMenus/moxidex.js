const { MessageFlags } = require('discord.js');
const { buildMoxidexMessage, normalizeTierKey } = require('../../../../Util/moxidexView');

module.exports = async function moxidexSelectMenu(interaction, Moxi, logger) {
    if (!interaction.isStringSelectMenu()) return false;
    const id = String(interaction.customId || '');
    if (!id.startsWith('moxidex:tier:')) return false;

    // customId: moxidex:tier:<userId>:<sort>:<page>
    const parts = id.split(':');
    const userId = parts[2];
    const sort = String(parts[3] || 'new');

    if (interaction.user?.id !== userId) {
        await interaction.reply({ content: 'Solo quien abrió el Moxidex puede usar este menú.', flags: MessageFlags.Ephemeral });
        return true;
    }

    const value = Array.isArray(interaction.values) ? interaction.values[0] : 'all';
    const tierKey = normalizeTierKey(value || 'all');

    const guildId = interaction.guildId || interaction.guild?.id;
    const lang = Moxi?.guildLang
        ? await Moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES')
        : (process.env.DEFAULT_LANG || 'es-ES');

    const payload = await buildMoxidexMessage({ userId, viewerId: userId, tierKey, sort, page: 0, lang });
    await interaction.update(payload);
    return true;
};
