const {
    ContainerBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    StringSelectMenuBuilder,
    ThumbnailBuilder,
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

function renderCareCircles(value) {
    return barLine(value);
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

    if (!list.length) {
        return [{ label: 'Próximamente…', value: 'soon', emoji: '🧭', default: true }];
    }

    // Discord limita opciones a 25
    return list.slice(0, 25).map((z) => ({
        label: `${String(z?.name || z?.id || 'Zona')}${Number.isFinite(Number(z?.requiredPetLevel)) ? ` (Nv. ${Math.max(1, Math.trunc(Number(z.requiredPetLevel)))}+)` : ''}`,
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

    \nUsa ** Ocarina del Vínculo ** para que regrese.`
    const container = new ContainerBuilder()
        .setAccentColor(Bot?.AccentColor || 0xB57EDC)
        .addTextDisplayComponents(t => t.setContent(`## Mascota de ${ safeOwnerName } `))
        .addSeparatorComponents(s => s.setDivider(true));

    if (away) {
        container
            .addTextDisplayComponents(t => t.setContent(`** ${ name }** se ha ido por falta de cuidados.\nUsa ** Ocarina del Vínculo ** para que regrese.`))
            .addSeparatorComponents(s => s.setDivider(true));
    } else {
        container.addTextDisplayComponents(t => t.setContent(`** ${ name }** `));
    }

    const statsText =
        `• Nivel: ** ${ level }** (${ xp } /${xpToNext} XP)\n` +
        `• Estrellas: ${starLine(stars)}\n` +
        `• Cariño: ${barLine(affection)}\n` +
        `• Hambre: ${barLine(hunger)}\n` +
        `• Higiene: ${barLine(hygiene)}`;

    container
        .addSeparatorComponents(s => s.setDivider(true))
        .addSectionComponents(section => {
            section.addTextDisplayComponents(t => t.setContent(statsText));
            const thumbUrl = String(process.env.PET_PANEL_THUMBNAIL_URL || '').trim();
            if (/^https?:\/\//.test(thumbUrl)) {
                section.setThumbnailAccessory(new ThumbnailBuilder().setURL(thumbUrl));
            }
            return section;
        });

    if (since) {
        container
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(t => t.setContent(`Compañeros desde hace ${since}`));
    }

    const zoneOptions = normalizeZoneOptions(EXPLORE_ZONES, selectedZoneId);
    const disableZoneSelect = (disabled || Boolean(away) || zoneOptions.length === 1 && zoneOptions[0]?.value === 'soon');

    const zoneSelect = new StringSelectMenuBuilder()
        .setCustomId(`pet:zone:${safeUserId}`)
        .setPlaceholder('Selecciona una zona mejor')
        .setMinValues(1)
        .setMaxValues(1)
        .setDisabled(disableZoneSelect)
        .addOptions(...zoneOptions);

    container.addActionRowComponents(row => row.addComponents(zoneSelect));

    container.addActionRowComponents(row => row.addComponents(
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
    ));

    container.addActionRowComponents(row => row.addComponents(
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
    ));

    return {
        content: '',
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { repliedUser: false },
    };
}

function buildPetActionResultMessageOptions({
    userId,
    title,
    text,
    gifUrl,
    disabled = false,
} = {}) {
    const safeUserId = String(userId || '').trim();
    const safeTitle = String(title || 'Mascota');
    const safeText = String(text || '');
    const safeGif = gifUrl && /^https?:\/\//.test(String(gifUrl)) ? String(gifUrl) : null;

    const container = new ContainerBuilder()
        .setAccentColor(Bot?.AccentColor || 0xB57EDC)
        .addTextDisplayComponents(t => t.setContent(`## ${safeTitle}`))
        .addSeparatorComponents(s => s.setDivider(true));

    if (safeGif) {
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(safeGif))
        );
        container.addSeparatorComponents(s => s.setDivider(true));
    }

    if (safeText) container.addTextDisplayComponents(t => t.setContent(safeText));

    container.addActionRowComponents(row => row.addComponents(
        new ButtonBuilder()
            .setCustomId(`pet:open:${safeUserId}`)
            .setLabel('Menú')
            .setStyle(ButtonStyle.Primary)
            .setEmoji('⬅️')
            .setDisabled(Boolean(disabled))
    ));

    return {
        content: '',
        components: [container],
        flags: MessageFlags.IsComponentsV2,
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
    buildPetActionResultMessageOptions,
    parsePetCustomId,
    renderCareCircles,
};
