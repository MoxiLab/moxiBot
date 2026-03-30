const { MessageFlags } = require('discord.js');

const moxi = require('../../../../i18n');
const { EMOJIS } = require('../../../../Util/emojis');
const { buildNoticeContainer } = require('../../../../Util/v2Notice');
const { getOrCreateEconomy } = require('../../../../Util/economyCore');
const { buildPetPanelMessageOptions } = require('../../../../Util/petPanel');
const { getActivePet, ensurePetAttributes } = require('../../../../Util/petSystem');

module.exports = async function petModal(interaction) {
    const id = String(interaction?.customId || '');
    if (!id.startsWith('pet:rename:')) return false;

    const lang = await moxi.guildLang(interaction.guildId || interaction.guild?.id, process.env.DEFAULT_LANG || 'es-ES');

    const parts = id.split(':');
    const userId = parts[2];

    // Solo el autor
    if (interaction.user?.id !== String(userId)) {
        const payload = {
            content: '',
            components: [buildNoticeContainer({ emoji: EMOJIS.noEntry, text: 'Solo el autor puede cambiar el nombre.' })],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        };
        await interaction.reply(payload).catch(() => null);
        return true;
    }

    const name = String(interaction.fields?.getTextInputValue('name') || '').trim();
    if (!name) {
        await interaction.reply({
            content: '',
            components: [buildNoticeContainer({ emoji: EMOJIS.cross, text: 'Nombre inválido.' })],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        }).catch(() => null);
        return true;
    }

    const eco = await getOrCreateEconomy(userId);
    const pet = getActivePet(eco);
    if (!pet) {
        await interaction.reply({
            content: '',
            components: [buildNoticeContainer({ emoji: EMOJIS.info, text: 'No tienes mascota para renombrar.' })],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        }).catch(() => null);
        return true;
    }

    ensurePetAttributes(pet, Date.now());
    pet.name = name.slice(0, 20);
    eco.markModified('pets');
    await eco.save().catch(() => null);

    // Intentar refrescar el panel si viene desde un mensaje
    const ownerName = interaction.user?.username || 'Usuario';
    const panel = buildPetPanelMessageOptions({ lang, userId, ownerName, pet });

    try {
        if (interaction.message && typeof interaction.message.edit === 'function') {
            await interaction.message.edit(panel);
        }
    } catch { }

    await interaction.reply({
        content: '',
        components: [buildNoticeContainer({ emoji: '✅', title: 'Mascotas', text: `Nombre actualizado a **${pet.name}**.` })],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    }).catch(() => null);

    return true;
};
