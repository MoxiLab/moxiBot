const {
    ContainerBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    StringSelectMenuBuilder,
    ThumbnailBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
} = require('discord.js');

const { Bot } = require('../Config');
const { EXPLORE_ZONES } = require('./zonesView');
const moxi = require('../i18n');

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
    // 0–19:0, 20–39:1, 40–59:2, 60–79:3, 80–99:4, 100:5
    const filled = clampInt(Math.floor(v / 20), 0, 5);
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
        label: `${String(z?.name || z?.id || 'Zona')}`,
        value: String(z?.id || ''),
        emoji: z?.emoji || '🧭',
        default: safeSelected ? String(z?.id || '') === safeSelected : false,
    })).filter((o) => o.value);
}

function ensurePetTrainingState(pet) {
    if (!pet) return { stats: { attack: 0, defense: 0, resistance: 0, hunt: 0 } };
    pet.attributes = pet.attributes && typeof pet.attributes === 'object' ? pet.attributes : {};
    const a = pet.attributes;
    a.stats = a.stats && typeof a.stats === 'object' ? a.stats : {};

    const safeInt = (n) => {
        const x = Number(n);
        if (!Number.isFinite(x)) return 0;
        return Math.max(0, Math.min(10, Math.trunc(x)));
    };

    const stats = {
        attack: safeInt(a.stats.attack),
        defense: safeInt(a.stats.defense),
        resistance: safeInt(a.stats.resistance),
        hunt: safeInt(a.stats.hunt),
    };

    a.stats.attack = stats.attack;
    a.stats.defense = stats.defense;
    a.stats.resistance = stats.resistance;
    a.stats.hunt = stats.hunt;

    return { stats };
}

function buildPetTrainingMessageOptions({ lang = 'es-ES', userId, ownerName, pet, disabled = false } = {}) {
    const safeUserId = String(userId || '').trim();
    const safeOwnerName = String(ownerName || 'Usuario').trim();
    const name = String(pet?.name || 'Sin nombre');
    const level = Math.max(1, Math.trunc(Number(pet?.level) || 1));

    const { stats } = ensurePetTrainingState(pet);
    const sumAllocated = (stats.attack + stats.defense + stats.resistance + stats.hunt);

    // 1 punto por nivel (a partir de nivel 2)
    const totalPoints = Math.max(0, level - 1);
    const remainingPoints = Math.max(0, totalPoints - sumAllocated);

    // Bases como en la captura
    const base = { attack: 2, defense: 2, resistance: 6, hunt: 3 };
    const totalMaxForPercent = 300;

    const row = (emoji, label, key) => {
        const alloc = stats[key];
        const bonus = alloc;
        const total = base[key] + bonus;
        const pct = Math.max(0, Math.round((total / totalMaxForPercent) * 100));
        return `${emoji} ${label}: **${alloc}/10** +${bonus}    Base **${base[key]}**    Total **${total}** (${pct}%)`;
    };

    const statsText =
        `Te quedan **${remainingPoints}** puntos para usar.\n\n` +
        `**Stats**\n` +
        `${row('⚔️', 'Ataque', 'attack')}\n` +
        `${row('🛡️', 'Defensa', 'defense')}\n` +
        `${row('🧬', 'Resistencia', 'resistance')}\n` +
        `${row('🏹', 'Caza', 'hunt')}`;

    const container = new ContainerBuilder()
        .setAccentColor(Bot?.AccentColor || 0xB57EDC)
        .addTextDisplayComponents(t => t.setContent(`## Mascota de ${safeOwnerName}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(t => t.setContent(`**${name}**`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(t => t.setContent(statsText));

    // Botones fuera del container (a nivel de mensaje)
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`pet:stat:${safeUserId}:attack`)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⚔️')
            .setDisabled(Boolean(disabled)),
        new ButtonBuilder()
            .setCustomId(`pet:stat:${safeUserId}:defense`)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🛡️')
            .setDisabled(Boolean(disabled)),
        new ButtonBuilder()
            .setCustomId(`pet:stat:${safeUserId}:resistance`)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🧬')
            .setDisabled(Boolean(disabled))
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`pet:stat:${safeUserId}:hunt`)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🏹')
            .setDisabled(Boolean(disabled)),
        new ButtonBuilder()
            .setCustomId(`pet:open:${safeUserId}`)
            .setLabel(moxi.translate('MAIN_MENU', lang) || 'Menú principal')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📋')
            .setDisabled(Boolean(disabled)),
        new ButtonBuilder()
            .setCustomId(`pet:trainHelp:${safeUserId}`)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📖')
            .setDisabled(Boolean(disabled))
    );

    return {
        content: '',
        components: [container, row1, row2],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { repliedUser: false },
    };
}

function buildPetPanelMessageOptions({
    lang = 'es-ES',
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

    const isNewborn = attrs?.newborn === true;

    const away = attrs?.away || null;
    const selectedZoneId = attrs?.selectedZoneId ? String(attrs.selectedZoneId) : null;
    const exploring = Boolean(attrs?.exploration && typeof attrs.exploration === 'object' && attrs.exploration.zoneId);

    const createdAt = attrs?.createdAt ? new Date(attrs.createdAt).getTime() : null;
    const since = createdAt && Number.isFinite(createdAt) ? formatSince(Date.now() - createdAt) : null;

    const container = new ContainerBuilder()
        .setAccentColor(Bot?.AccentColor || 0xB57EDC)
        .addTextDisplayComponents(t => t.setContent(`## Mascota de ${safeOwnerName}`))
        .addSeparatorComponents(s => s.setDivider(true));

    if (away) {
        container
            .addTextDisplayComponents(t => t.setContent(`**${name}** se ha ido por falta de cuidados.\nUsa **Ocarina del Vínculo** para que regrese.`))
            .addSeparatorComponents(s => s.setDivider(true));
    } else {
        container.addTextDisplayComponents(t => t.setContent(`**${name}**`));
    }

    container.addTextDisplayComponents(t => t.setContent(`Nivel: **${level}**`));

    const statsText =
        `• Estrellas: ${starLine(stars)}\n` +
        `• Cariño: ${isNewborn ? '●●●●●' : barLine(affection)}\n` +
        `• Hambre: ${isNewborn ? '●●●●●' : barLine(hunger)}\n` +
        `• Higiene: ${isNewborn ? '●●●●●' : barLine(hygiene)}`;

    container.addSeparatorComponents(s => s.setDivider(true));

    // Nota: Section components requieren un accesorio (thumbnail o botón). Para evitar errores
    // de validación cuando no hay thumbnail, usamos MediaGallery opcional + texto.
    const thumbUrl = String(process.env.PET_PANEL_THUMBNAIL_URL || '').trim();
    if (/^https?:\/\//.test(thumbUrl)) {
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(thumbUrl))
        );
        container.addSeparatorComponents(s => s.setDivider(true));
    }

    container.addTextDisplayComponents(t => t.setContent(statsText));

    if (since) {
        container
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(t => t.setContent(`Compañeros desde hace ${since}`));
    }

    const zoneOptions = normalizeZoneOptions(EXPLORE_ZONES, selectedZoneId);
    const disableZoneSelect = (disabled || Boolean(away) || exploring || zoneOptions.length === 1 && zoneOptions[0]?.value === 'soon');

    const zoneSelect = new StringSelectMenuBuilder()
        .setCustomId(`pet:zone:${safeUserId}`)
        .setPlaceholder(moxi.translate('SELECT_BETTER_ZONE', lang) || 'Selecciona una zona mejor')
        .setMinValues(1)
        .setMaxValues(1)
        .setDisabled(disableZoneSelect)
        .addOptions(...zoneOptions);

    // El select va dentro del container (dentro del “embed”)
    container.addActionRowComponents(r => r.addComponents(zoneSelect));

    const actionRowMain = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`pet:do:${safeUserId}:play`)
            .setLabel(moxi.translate('PLAY', lang) || 'Jugar')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🎮')
            .setDisabled(disabled || Boolean(away)),
        new ButtonBuilder()
            .setCustomId(`pet:do:${safeUserId}:feed`)
            .setLabel(moxi.translate('FEED', lang) || 'Alimentar')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🍎')
            .setDisabled(disabled || Boolean(away)),
        new ButtonBuilder()
            .setCustomId(`pet:do:${safeUserId}:clean`)
            .setLabel(moxi.translate('CLEAN', lang) || 'Limpiar')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🧼')
            .setDisabled(disabled || Boolean(away))
    );

    const actionRowSecondary = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`pet:do:${safeUserId}:train`)
            .setLabel(moxi.translate('TRAIN', lang) || 'Entrenar')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('🏋️')
            .setDisabled(disabled || Boolean(away)),
        new ButtonBuilder()
            .setCustomId(`pet:renameModal:${safeUserId}`)
            .setLabel(moxi.translate('CHANGE_NAME', lang) || 'Cambiar nombre')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📝')
            .setDisabled(disabled || Boolean(away))
    );

    return {
        content: '',
        components: [container, actionRowMain, actionRowSecondary],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { repliedUser: false },
    };
}

function buildPetActionResultMessageOptions({
    lang = 'es-ES',
    userId,
    title,
    text,
    gifUrl,
    buttons,
    disabled = false,
} = {}) {
    const safeUserId = String(userId || '').trim();
    const safeTitle = String(title || 'Mascota');
    const safeText = String(text || '');
    const safeGif = gifUrl && /^https?:\/\//.test(String(gifUrl)) ? String(gifUrl) : null;

    const extraButtons = Array.isArray(buttons) ? buttons : [];

    const container = new ContainerBuilder()
        .setAccentColor(Bot?.AccentColor || 0xB57EDC)
        ;

    // Layout tipo Nekotina: texto + thumbnail a la derecha cuando hay GIF.
    if (safeGif) {
        container.addSectionComponents(section =>
            section
                .addTextDisplayComponents(t => t.setContent(`## ${safeTitle}\n${safeText}`))
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(safeGif))
        );
    } else {
        container.addTextDisplayComponents(t => t.setContent(`## ${safeTitle}\n${safeText}`));
    }

    const built = [];

    for (const b of extraButtons.slice(0, 4)) {
        const customId = String(b?.customId || '').trim();
        if (!customId) continue;
        const label = b?.label != null ? String(b.label) : null;
        const emoji = b?.emoji != null ? String(b.emoji) : null;
        const style = Number.isFinite(Number(b?.style)) ? Number(b.style) : ButtonStyle.Secondary;

        const btn = new ButtonBuilder()
            .setCustomId(customId)
            .setStyle(style)
            .setDisabled(Boolean(disabled));

        if (label) btn.setLabel(label);
        if (emoji) btn.setEmoji(emoji);

        built.push(btn);
    }

    // Botón de vuelta al menú
    built.push(
        new ButtonBuilder()
            .setCustomId(`pet:open:${safeUserId}`)
            .setLabel(moxi.translate('MENU', lang) || 'Menú')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⬅️')
            .setDisabled(Boolean(disabled))
    );

    const actionRow = new ActionRowBuilder().addComponents(...built);

    return {
        content: '',
        components: [container, actionRow],
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
    buildPetTrainingMessageOptions,
    buildPetActionResultMessageOptions,
    parsePetCustomId,
    renderCareCircles,
};
