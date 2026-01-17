const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
} = require('discord.js');

const { Bot } = require('../Config');
const { EXPLORE_ZONES } = require('./zonesView');

function clampInt(n, min, max) {
    const x = Number(n);
    if (!Number.isFinite(x)) return min;
    return Math.max(min, Math.min(max, Math.trunc(x)));
}

function starLine(stars) {
    const s = clampInt(stars, 0, 5);
    return `${'★'.repeat(s)}${'☆'.repeat(5 - s)}`;
}

function barLine(value) {
    const v = clampInt(value, 0, 100);
    const filled = clampInt(Math.round(v / 20), 0, 5);
    return `${'●'.repeat(filled)}${'○'.repeat(5 - filled)}`;
}

function formatSince(ms) {
    const days = Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
    if (days >= 365) {
        const years = Math.floor(days / 365);
        return `${years} año${years === 1 ? '' : 's'}`;
    }
    if (days >= 30) {
        const months = Math.floor(days / 30);
        return `${months} mes${months === 1 ? '' : 'es'}`;
    }
    if (days >= 7) {
        const weeks = Math.floor(days / 7);
        return `${weeks} semana${weeks === 1 ? '' : 's'}`;
    }
    return `${days} día${days === 1 ? '' : 's'}`;
}

function normalizeZoneOptions(zones, selectedZoneId) {
    const list = Array.isArray(zones) ? zones : [];
    const safeSelected = selectedZoneId ? String(selectedZoneId) : null;

    // Discord limita opciones a 25
    return list.slice(0, 25).map((z) => ({
        label: String(z?.name || z?.id || 'Zona'),
        value: String(z?.id || ''),
        emoji: z?.emoji || '🧭',
        default: safeSelected ? String(z?.id || '') === safeSelected : false,
    })).filter((o) => o.value);
}

function buildPetPanelMessageOptions({
    userId,
    ownerName,
    pet,
    disabled = false,
} = {}) {
    const safeUserId = String(userId || '').trim();
    const safeOwnerName = String(ownerName || 'Usuario').trim();

    const name = String(pet?.name || 'Sin nombre');
    const level = Number(pet?.level) || 1;

    const attrs = pet?.attributes || {};
    const xp = Math.max(0, Number(attrs?.xp) || 0);
    const xpToNext = Math.max(1, Number(attrs?.xpToNext) || 100);
    const stars = Math.max(0, Number(attrs?.stars) || 0);

    const care = attrs?.care || {};
    const affection = Math.max(0, Number(care?.affection) || 0);
    const hunger = Math.max(0, Number(care?.hunger) || 0);
    const hygiene = Math.max(0, Number(care?.hygiene) || 0);

    const away = attrs?.away || null;
    const selectedZoneId = attrs?.selectedZoneId ? String(attrs.selectedZoneId) : null;

    const createdAt = attrs?.createdAt ? new Date(attrs.createdAt).getTime() : null;
    const since = createdAt && Number.isFinite(createdAt) ? formatSince(Date.now() - createdAt) : null;

    const embed = new EmbedBuilder()
        .setColor(Bot?.AccentColor || 0xB57EDC)
        .setTitle(`Mascota de ${safeOwnerName}`)
        .setDescription(away
            ? `**${name}** se ha ido por falta de cuidados.
\nUsa **Ocarina del Vínculo** para que regrese.`
            : `**${name}**`)
        .addFields(
            {
                name: 'Nivel',
                value: `${level} (${xp}/${xpToNext} XP)`,
                inline: true,
            },
            {
                name: 'Estrellas',
                value: starLine(stars),
                inline: true,
            },
            {
                name: 'Cariño',
                value: barLine(affection),
                inline: true,
            },
            {
                name: 'Hambre',
                value: barLine(hunger),
                inline: true,
            },
            {
                name: 'Higiene',
                value: barLine(hygiene),
                inline: true,
            }
        );

    if (since) {
        embed.setFooter({ text: `Compañeros desde hace ${since}` });
    }

    const zoneSelect = new StringSelectMenuBuilder()
        .setCustomId(`pet:zone:${safeUserId}`)
        .setPlaceholder('Selecciona una zona a explorar')
        .setMinValues(1)
        .setMaxValues(1)
        .setDisabled(disabled || Boolean(away))
        .addOptions(...normalizeZoneOptions(EXPLORE_ZONES, selectedZoneId));

    const rowSelect = new ActionRowBuilder().addComponents(zoneSelect);

    const rowMain = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`pet:do:${safeUserId}:play`)
            .setLabel('Jugar')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🎮')
            .setDisabled(disabled || Boolean(away)),
        new ButtonBuilder()
            .setCustomId(`pet:do:${safeUserId}:feed`)
            .setLabel('Alimentar')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🍎')
            .setDisabled(disabled || Boolean(away)),
        new ButtonBuilder()
            .setCustomId(`pet:do:${safeUserId}:clean`)
            .setLabel('Limpiar')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🧼')
            .setDisabled(disabled || Boolean(away))
    );

    const rowSecondary = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`pet:do:${safeUserId}:train`)
            .setLabel('Entrenar')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🏋️')
            .setDisabled(disabled || Boolean(away)),
        new ButtonBuilder()
            .setCustomId(`pet:renameModal:${safeUserId}`)
            .setLabel('Cambiar nombre')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📝')
            .setDisabled(disabled || Boolean(away))
    );

    return {
        content: '',
        embeds: [embed],
        components: [rowSelect, rowMain, rowSecondary],
        allowedMentions: { repliedUser: false },
    };
}

function parsePetCustomId(customId) {
    const raw = String(customId || '');
    if (!raw.startsWith('pet:')) return null;
    const parts = raw.split(':');

    // pet:<action>:<userId>:(extra)
    const action = parts[1] || null;
    const userId = parts[2] || null;
    const extra = parts.slice(3);

    if (!action || !userId) return null;

    return {
        action,
        userId,
        extra,
    };
}

module.exports = {
    buildPetPanelMessageOptions,
    parsePetCustomId,
};
