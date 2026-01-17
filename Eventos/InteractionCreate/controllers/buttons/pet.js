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
const { buildPetPanelMessageOptions, buildPetTrainingMessageOptions, buildPetActionResultMessageOptions, parsePetCustomId, renderCareCircles } = require('../../../../Util/petPanel');
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

async function replyEphemeralNotice(interaction, { emoji, title, text }) {
    const payload = {
        content: '',
        components: [buildNoticeContainer({ emoji, title, text })],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    };
    if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => null);
    else await interaction.reply(payload).catch(() => null);
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
    if (awayRes.changed) {
        eco.markModified('pets');
        await eco.save().catch(() => null);
    }

    const ownerName = interaction.user?.username || 'Usuario';

    if (action === 'open') {
        const payload = buildPetPanelMessageOptions({ userId, ownerName, pet });
        await safeUpdateOrReply(interaction, payload);
        return true;
    }

    if (action === 'train') {
        const payload = buildPetTrainingMessageOptions({ userId, ownerName, pet });
        await safeUpdateOrReply(interaction, payload);
        return true;
    }

    if (action === 'trainHelp') {
        await replyEphemeralNotice(interaction, {
            emoji: EMOJIS.info,
            title: 'Entrenamiento',
            text: 'Ganas **1 punto** por cada nivel a partir del nivel 2.\nUsa los botones para asignar puntos (máx. **10** por stat).',
        });
        return true;
    }

    if (action === 'stat') {
        const key = String(extra?.[0] || '').trim();
        const allowed = new Set(['attack', 'defense', 'resistance', 'hunt']);
        if (!allowed.has(key)) {
            await replyEphemeralNotice(interaction, {
                emoji: EMOJIS.cross,
                title: 'Entrenamiento',
                text: 'Stat inválido.',
            });
            return true;
        }

        // Estado de stats
        pet.attributes = pet.attributes && typeof pet.attributes === 'object' ? pet.attributes : {};
        pet.attributes.stats = pet.attributes.stats && typeof pet.attributes.stats === 'object' ? pet.attributes.stats : {};

        const level = Math.max(1, Math.trunc(Number(pet?.level) || 1));
        const totalPoints = Math.max(0, level - 1);
        const stats = {
            attack: Math.max(0, Math.min(10, Math.trunc(Number(pet.attributes.stats.attack) || 0))),
            defense: Math.max(0, Math.min(10, Math.trunc(Number(pet.attributes.stats.defense) || 0))),
            resistance: Math.max(0, Math.min(10, Math.trunc(Number(pet.attributes.stats.resistance) || 0))),
            hunt: Math.max(0, Math.min(10, Math.trunc(Number(pet.attributes.stats.hunt) || 0))),
        };
        const used = stats.attack + stats.defense + stats.resistance + stats.hunt;
        const remaining = Math.max(0, totalPoints - used);

        if (remaining <= 0) {
            await replyEphemeralNotice(interaction, {
                emoji: EMOJIS.info,
                title: 'Entrenamiento',
                text: 'Te quedan **0** puntos para usar.',
            });
            return true;
        }

        if (stats[key] >= 10) {
            await replyEphemeralNotice(interaction, {
                emoji: EMOJIS.info,
                title: 'Entrenamiento',
                text: 'Ese stat ya está al máximo (**10/10**).',
            });
            return true;
        }

        pet.attributes.stats[key] = stats[key] + 1;
        eco.markModified('pets');
        await eco.save().catch(() => null);

        const payload = buildPetTrainingMessageOptions({ userId, ownerName, pet });
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
            eco.markModified('pets');
            await eco.save().catch(() => null);
        }

        const payload = buildPetPanelMessageOptions({ userId, ownerName, pet });
        await safeUpdateOrReply(interaction, payload);
        return true;
    }

    if (action === 'do') {
        const act = String(extra?.[0] || '').trim();

        // Entrenar abre el panel de stats (tipo Nekotina)
        if (act === 'train') {
            const payload = buildPetTrainingMessageOptions({ userId, ownerName, pet });
            await safeUpdateOrReply(interaction, payload);
            return true;
        }

        // Si el stat principal ya está a tope, no sumamos puntos; solo avisamos.
        const care = pet?.attributes?.care || {};
        const maxStat = 100;
        const primaryStatKey = act === 'feed' ? 'hunger'
            : (act === 'clean' ? 'hygiene'
                : (act === 'play' ? 'affection' : null));
        const primaryBefore = primaryStatKey ? (Number(care?.[primaryStatKey]) || 0) : null;

        if (primaryStatKey && primaryBefore >= maxStat) {
            const msg = act === 'feed'
                ? 'Hey, si sigues sobre alimentando a tu mascota, terminará engordando. 🐷'
                : (act === 'clean'
                    ? 'Tu mascota ya está muy limpia. 🧼'
                    : 'Tu mascota ya está al máximo de cariño. 🤍');

            await replyEphemeralNotice(interaction, {
                emoji: EMOJIS.info,
                title: 'Mascotas',
                text: msg,
            });
            return true;
        }

        const beforeHunger = Number(care?.hunger) || 0;
        try {
            const result = applyPetAction(pet, act, now);
            eco.markModified('pets');
            await eco.save().catch(() => null);

            const afterHunger = Number(pet?.attributes?.care?.hunger) || 0;

            let title = 'Mascota';
            let text = 'Acción realizada.';
            let gifUrl = process.env.PET_ACTION_GIF_URL || process.env.AFK_FALLBACK_GIF_URL || null;

            const xpCompact = `\n[+${result?.xpGained || 0} exp]`;
            const xpBlock = `\n\n[+${result?.xpGained || 0} exp]`;

            // Mostrar progreso con círculos (antes/después) en acciones de cuidado
            const afterCare = pet?.attributes?.care || {};
            const primaryAfter = primaryStatKey ? (Number(afterCare?.[primaryStatKey]) || 0) : null;
            const circlesLine = (primaryStatKey && primaryBefore != null && primaryAfter != null)
                ? `\n\n${renderCareCircles(primaryBefore)} → ${renderCareCircles(primaryAfter)}`
                : '';

            if (act === 'play') {
                title = 'Cariño';
                // Como Nekotina: sin barra/círculos, texto compacto
                text = `Has jugado con tu mascota 🤍${xpCompact}`;
            } else if (act === 'feed') {
                title = 'Hambre';
                text = `Has alimentado a tu mascota 🍎${xpBlock}${circlesLine}`;
            } else if (act === 'clean') {
                title = 'Higiene';
                text = `Has limpiado a tu mascota 🧼${xpBlock}${circlesLine}`;
            } else if (act === 'train') {
                title = 'Entrenamiento';
                text = `Has entrenado a tu mascota 🏋️${xpBlock}`;
            }

            const payload = buildPetActionResultMessageOptions({
                userId,
                title,
                text,
                gifUrl,
            });

            await safeUpdateOrReply(interaction, payload);

            // Aviso de sobrealimentación (solo cuando la barra queda llena)
            if (act === 'feed' && (beforeHunger < 100) && afterHunger >= 100) {
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
