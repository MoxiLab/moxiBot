const {
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
} = require('discord.js');

const moxi = require('../../../../i18n');
const { EMOJIS } = require('../../../../Util/emojis');
const { buildNoticeContainer } = require('../../../../Util/v2Notice');
const { getOrCreateEconomy } = require('../../../../Util/economyCore');
const { buildPetPanelMessageOptions, parsePetCustomId } = require('../../../../Util/petPanel');
const {
    getActivePet,
    ensurePetAttributes,
    checkAndMarkPetAway,
    applyPetAction,
} = require('../../../../Util/petSystem');

function isPetId(customId) {
    return typeof customId === 'string' && customId.startsWith('pet:');
}

module.exports = async function petButtons(interaction) {
    if (!isPetId(interaction?.customId)) return false;

    const parsed = parsePetCustomId(interaction.customId);
    if (!parsed) return false;

    const { action, userId, extra } = parsed;

    // Solo el autor puede usar el panel
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

    const eco = await getOrCreateEconomy(userId);
    const pet = getActivePet(eco);
    if (!pet) {
        const payload = {
            content: '',
            components: [buildNoticeContainer({ emoji: EMOJIS.info, title: 'Mascotas', text: 'Aún no tienes mascotas. Compra un huevo e incúbalo con una incubadora.' })],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        };
        if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => null);
        else await interaction.reply(payload).catch(() => null);
        return true;
    }

    const now = Date.now();
    ensurePetAttributes(pet, now);

    // Si se descuidó demasiado tiempo, huye (y bloquea acciones)
    const awayRes = checkAndMarkPetAway(pet, now);
    if (awayRes.changed) await eco.save().catch(() => null);

    const ownerName = interaction.user?.username || 'Usuario';

    if (action === 'open') {
        const payload = buildPetPanelMessageOptions({ userId, ownerName, pet });
        // Responde con un panel nuevo
        if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => null);
        else await interaction.reply(payload).catch(() => null);
        return true;
    }

    if (action === 'renameModal') {
        const modal = new ModalBuilder()
            .setCustomId(`pet:rename:${String(userId)}`)
            .setTitle('Cambiar nombre');

        const input = new TextInputBuilder()
            .setCustomId('name')
            .setLabel('Nuevo nombre')
            .setPlaceholder('Ej: hikari')
            .setStyle(TextInputStyle.Short)
            .setMinLength(1)
            .setMaxLength(20)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal).catch(() => null);
        return true;
    }

    if (action === 'zone') {
        const selected = String(interaction.values?.[0] || '').trim();
        if (selected) {
            pet.attributes.selectedZoneId = selected;
            await eco.save().catch(() => null);
        }

        const payload = buildPetPanelMessageOptions({ userId, ownerName, pet });
        await interaction.update(payload).catch(() => null);
        return true;
    }

    if (action === 'do') {
        const act = String(extra?.[0] || '').trim();
        try {
            applyPetAction(pet, act, now);
            await eco.save().catch(() => null);
        } catch (err) {
            if (err?.code === 'PET_AWAY') {
                const payload = {
                    content: '',
                    components: [buildNoticeContainer({ emoji: EMOJIS.noEntry, title: 'Mascotas', text: 'Tu mascota se ha ido por falta de cuidados. Usa **Ocarina del Vínculo** para que regrese.' })],
                    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
                };
                if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => null);
                else await interaction.reply(payload).catch(() => null);
                return true;
            }
        }

        const payload = buildPetPanelMessageOptions({ userId, ownerName, pet });
        await interaction.update(payload).catch(() => null);
        return true;
    }

    // Si no coincide, no rompemos el router
    return false;
};
