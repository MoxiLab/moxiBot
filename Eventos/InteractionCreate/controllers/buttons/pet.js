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
const { buildPetPanelMessageOptions, buildPetActionResultMessageOptions, parsePetCustomId } = require('../../../../Util/petPanel');
const { EXPLORE_ZONES } = require('../../../../Util/zonesView');
const {
    getActivePet,
    ensurePetAttributes,
    checkAndMarkPetAway,
    applyPetAction,
} = require('../../../../Util/petSystem');

async function safeUpdateOrReply(interaction, payload) {
    if (!interaction) return;
    try {
        if (typeof interaction.update === 'function') {
            await interaction.update(payload);
            return;
        }
    } catch { }
    try {
        if (interaction.deferred || interaction.replied) await interaction.followUp(payload);
        else await interaction.reply(payload);
    } catch { }
}

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
        await safeUpdateOrReply(interaction, payload);
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
        if (selected && selected !== 'soon') {
            const zone = (Array.isArray(EXPLORE_ZONES) ? EXPLORE_ZONES : []).find(z => String(z?.id || '') === selected);
            const required = zone && Number.isFinite(Number(zone.requiredPetLevel)) ? Math.max(1, Math.trunc(Number(zone.requiredPetLevel))) : 1;
            const petLevel = Math.max(1, Math.trunc(Number(pet?.level) || 1));

            if (!zone) {
                const payload = {
                    content: '',
                    components: [buildNoticeContainer({ emoji: EMOJIS.cross, title: 'Exploración', text: 'Esa zona no existe.' })],
                    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
                };
                if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => null);
                else await interaction.reply(payload).catch(() => null);
                return true;
            }

            if (petLevel < required) {
                const payload = {
                    content: '',
                    components: [
                        buildNoticeContainer({
                            emoji: EMOJIS.noEntry,
                            title: 'Exploración • Bloqueado',
                            text: `Tu mascota necesita ser **nivel ${required}** para explorar **${zone.name || zone.id}**.\nNivel actual: **${petLevel}**`,
                        }),
                    ],
                    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
                };
                if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => null);
                else await interaction.reply(payload).catch(() => null);
                return true;
            }

            pet.attributes.selectedZoneId = selected;
            await eco.save().catch(() => null);
        }

        const payload = buildPetPanelMessageOptions({ userId, ownerName, pet });
        await safeUpdateOrReply(interaction, payload);
        return true;
    }

    if (action === 'do') {
        const act = String(extra?.[0] || '').trim();
        const beforeHunger = Number(pet?.attributes?.care?.hunger) || 0;
        try {
            const result = applyPetAction(pet, act, now);
            await eco.save().catch(() => null);

            const afterHunger = Number(pet?.attributes?.care?.hunger) || 0;

            let title = 'Mascota';
            let text = 'Acción realizada.';
            let gifUrl = process.env.PET_ACTION_GIF_URL || process.env.AFK_FALLBACK_GIF_URL || null;

            const xpLine = `\n\n[+${result?.xpGained || 0} exp]`;

            if (act === 'play') {
                title = 'Cariño';
                text = `Has jugado con tu mascota 🤍${xpLine}`;
            } else if (act === 'feed') {
                title = 'Hambre';
                text = `Has alimentado a tu mascota 🍎${xpLine}`;
            } else if (act === 'clean') {
                title = 'Higiene';
                text = `Has limpiado a tu mascota 🧼${xpLine}`;
            } else if (act === 'train') {
                title = 'Entrenamiento';
                text = `Has entrenado a tu mascota 🏋️${xpLine}`;
            }

            const payload = buildPetActionResultMessageOptions({
                userId,
                title,
                text,
                gifUrl,
            });

            await safeUpdateOrReply(interaction, payload);

            // Aviso de sobrealimentación (como en tu captura)
            if (act === 'feed' && (beforeHunger < 95) && afterHunger >= 95) {
                const warn = {
                    content: '',
                    components: [
                        buildNoticeContainer({
                            emoji: EMOJIS.info,
                            text: 'Hey, si sigues sobre alimentando a tu mascota, terminará engordando. 🐷',
                        }),
                    ],
                    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
                };
                if (interaction.deferred || interaction.replied) await interaction.followUp(warn).catch(() => null);
                else await interaction.reply(warn).catch(() => null);
            }

            return true;
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
        await safeUpdateOrReply(interaction, payload);
        return true;
    }

    // Si no coincide, no rompemos el router
    return false;
};
