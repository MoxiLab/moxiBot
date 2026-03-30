const { MessageFlags } = require('discord.js');
const { buildProfileMessage, normalizeProfilePage } = require('../../../../Util/profileView');

module.exports = async function profileSelectMenu(interaction, Moxi) {
    if (!interaction.isStringSelectMenu()) return false;

    const id = String(interaction.customId || '');
    if (!id.startsWith('profile:view:')) return false;

    const parts = id.split(':');
    const viewerId = parts[2] || '';
    const targetId = parts[3] || '';

    if (!viewerId || interaction.user?.id !== viewerId) {
        await interaction.reply({
            content: 'Solo quien abrio este perfil puede usar el selector.',
            flags: MessageFlags.Ephemeral,
        }).catch(() => null);
        return true;
    }

    const selected = normalizeProfilePage(Array.isArray(interaction.values) ? interaction.values[0] : 'overview');
    const guildId = interaction.guildId || interaction.guild?.id;
    const lang = Moxi?.guildLang
        ? await Moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES')
        : (process.env.DEFAULT_LANG || 'es-ES');

    const targetUser = await Moxi.users.fetch(targetId).catch(() => null);
    if (!targetUser) {
        await interaction.reply({ content: 'No pude cargar el usuario del perfil.', flags: MessageFlags.Ephemeral }).catch(() => null);
        return true;
    }

    const targetMember = interaction.guild?.members?.cache?.get?.(targetId)
        || await interaction.guild?.members?.fetch?.(targetId).catch(() => null)
        || null;

    const payload = await buildProfileMessage({
        guild: interaction.guild,
        guildId,
        lang,
        targetUser,
        targetMember,
        viewerId,
        page: selected,
    });

    await interaction.update(payload);
    return true;
};