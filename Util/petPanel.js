const {
    ContainerBuilder,
    ActionRowBuilder,
    DangerButtonBuilder,
    PrimaryButtonBuilder,
    SecondaryButtonBuilder,
    SuccessButtonBuilder,
    MessageFlags,
    StringSelectMenuBuilder,
    ThumbnailBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
} = require('discord.js');

const { Bot } = require('../Config');
const { EXPLORE_ZONES } = require('./zonesView');
const moxi = require('../i18n');
const { toEmojiObject } = require('./emojis');

function createButtonForStyle(style) {
    const s = Number(style);
    if (s === 1) return new PrimaryButtonBuilder();
    if (s === 3) return new SuccessButtonBuilder();
    if (s === 4) return new DangerButtonBuilder();
    return new SecondaryButtonBuilder();
}

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

function formatRelativeTime(date, locale) {
    const now = Date.now();
    const deltaMs = date.getTime() - now;
    const absMs = Math.abs(deltaMs);

    const units = [
        { unit: 'year', ms: 1000 * 60 * 60 * 24 * 365 },
        { unit: 'month', ms: 1000 * 60 * 60 * 24 * 30 },
        { unit: 'week', ms: 1000 * 60 * 60 * 24 * 7 },
        { unit: 'day', ms: 1000 * 60 * 60 * 24 },
        { unit: 'hour', ms: 1000 * 60 * 60 },
        { unit: 'minute', ms: 1000 * 60 },
        { unit: 'second', ms: 1000 }
    ];

    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    for (const { unit, ms } of units) {
        if (absMs >= ms || unit === 'second') {
            const value = Math.max(1, Math.floor(absMs / ms));
            return rtf.format(deltaMs < 0 ? -value : value, unit);
        }
    }

    return '';
}

function normalizeZoneOptions(zones, selectedZoneId, lang) {
    const tPet = (key, vars = {}) => moxi.translate(`economy/pet:${key}`, lang, vars);
    const list = Array.isArray(zones) ? zones : [];
    const safeSelected = selectedZoneId ? String(selectedZoneId) : null;

    if (!list.length) {
        const label = tPet('SOON') || 'Coming soon…';
        return [{ label, value: 'soon', emoji: toEmojiObject('🧭'), default: true }];
    }

    // Discord limita opciones a 25
    return list.slice(0, 25).map((z) => ({
        label: `${String(z?.name || z?.id || (tPet('ZONE_FALLBACK') || 'Zone'))}`,
        value: String(z?.id || ''),
        emoji: toEmojiObject(z?.emoji || '🧭'),
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
    const tPet = (key, vars = {}) => moxi.translate(`economy/pet:${key}`, lang, vars);
    const safeUserId = String(userId || '').trim();
    const safeOwnerName = String(ownerName || (tPet('OWNER_FALLBACK') || 'User')).trim();
    const name = String(pet?.name || (tPet('NO_NAME') || 'No name'));
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
        return `${emoji} ${label}: **${alloc}/10** +${bonus}    ${tPet('TRAINING_BASE') || 'Base'} **${base[key]}**    ${tPet('TRAINING_TOTAL') || 'Total'} **${total}** (${pct}%)`;
    };

    const statsText =
        `${tPet('TRAINING_POINTS_LEFT', { n: remainingPoints }) || `You have **${remainingPoints}** points left.`}\n\n` +
        `**${tPet('TRAINING_STATS_TITLE') || 'Stats'}**\n` +
        `${row('⚔️', tPet('TRAINING_ATTACK') || 'Attack', 'attack')}\n` +
        `${row('🛡️', tPet('TRAINING_DEFENSE') || 'Defense', 'defense')}\n` +
        `${row('🧬', tPet('TRAINING_RESISTANCE') || 'Resistance', 'resistance')}\n` +
        `${row('🏹', tPet('TRAINING_HUNT') || 'Hunt', 'hunt')}`;

    const container = new ContainerBuilder()
        .setAccentColor(Bot?.AccentColor || 0xB57EDC)
        .addTextDisplayComponents(tComp => tComp.setContent(`## ${tPet('PANEL_OWNER', { owner: safeOwnerName }) || `Pet of ${safeOwnerName}`}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(tComp => tComp.setContent(`**${name}**`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(tComp => tComp.setContent(statsText));

    // Botones fuera del container (a nivel de mensaje)
    const row1 = new ActionRowBuilder().addComponents(
        new SecondaryButtonBuilder()
            .setCustomId(`pet:stat:${safeUserId}:attack`)
            .setEmoji(toEmojiObject('⚔️'))
            .setDisabled(Boolean(disabled)),
        new SecondaryButtonBuilder()
            .setCustomId(`pet:stat:${safeUserId}:defense`)
            .setEmoji(toEmojiObject('🛡️'))
            .setDisabled(Boolean(disabled)),
        new SecondaryButtonBuilder()
            .setCustomId(`pet:stat:${safeUserId}:resistance`)
            .setEmoji(toEmojiObject('🧬'))
            .setDisabled(Boolean(disabled))
    );

    const row2 = new ActionRowBuilder().addComponents(
        new SecondaryButtonBuilder()
            .setCustomId(`pet:stat:${safeUserId}:hunt`)
            .setEmoji(toEmojiObject('🏹'))
            .setDisabled(Boolean(disabled)),
        new SecondaryButtonBuilder()
            .setCustomId(`pet:open:${safeUserId}`)
            .setLabel(moxi.translate('MAIN_MENU', lang) || 'Menú principal')
            .setEmoji(toEmojiObject('📋'))
            .setDisabled(Boolean(disabled)),
        new SecondaryButtonBuilder()
            .setCustomId(`pet:trainHelp:${safeUserId}`)
            .setEmoji(toEmojiObject('📖'))
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
    const tPet = (key, vars = {}) => moxi.translate(`economy/pet:${key}`, lang, vars);
    const tMisc = (key, vars = {}) => moxi.translate(`misc:${key}`, lang, vars);
    const safeUserId = String(userId || '').trim();
    const safeOwnerName = String(ownerName || (tPet('OWNER_FALLBACK') || 'User')).trim();

    const name = String(pet?.name || (tPet('NO_NAME') || 'No name'));
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

    const createdAt = attrs?.createdAt ? new Date(attrs.createdAt) : null;
    const since = createdAt instanceof Date && Number.isFinite(createdAt.getTime())
        ? formatRelativeTime(createdAt, lang)
        : null;

    const container = new ContainerBuilder()
        .setAccentColor(Bot?.AccentColor || 0xB57EDC)
        .addTextDisplayComponents(tComp => tComp.setContent(`## ${tPet('PANEL_OWNER', { owner: safeOwnerName }) || `Pet of ${safeOwnerName}`}`))
        .addSeparatorComponents(s => s.setDivider(true));

    if (away) {
        container
            .addTextDisplayComponents(tComp => tComp.setContent(tPet('AWAY_TEXT', { name }) || `**${name}** is away due to neglect.`))
            .addSeparatorComponents(s => s.setDivider(true));
    } else {
        container.addTextDisplayComponents(tComp => tComp.setContent(`**${name}**`));
    }

    container.addTextDisplayComponents(tComp => tComp.setContent(`${tMisc('LEVEL_LABEL') || 'Level'}: **${level}**`));

    const statsText =
        `• ${tPet('STARS') || 'Stars'}: ${starLine(stars)}\n` +
        `• ${tPet('AFFECTION') || 'Affection'}: ${isNewborn ? '●●●●●' : barLine(affection)}\n` +
        `• ${tPet('HUNGER') || 'Hunger'}: ${isNewborn ? '●●●●●' : barLine(hunger)}\n` +
        `• ${tPet('HYGIENE') || 'Hygiene'}: ${isNewborn ? '●●●●●' : barLine(hygiene)}`;

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
            .addTextDisplayComponents(tComp => tComp.setContent(`${tPet('COMPANIONS_SINCE') || 'Companions'}: ${since}`));
    }

    const zoneOptions = normalizeZoneOptions(EXPLORE_ZONES, selectedZoneId, lang);
    const disableZoneSelect = (disabled || Boolean(away) || exploring || zoneOptions.length === 1 && zoneOptions[0]?.value === 'soon');

    const zoneSelect = new StringSelectMenuBuilder()
        .setCustomId(`pet:zone:${safeUserId}`)
        .setPlaceholder(tMisc('SELECT_BETTER_ZONE') || 'Select a better zone')
        .setMinValues(1)
        .setMaxValues(1)
        .setDisabled(disableZoneSelect)
        .addOptions(...zoneOptions);

    // El select va dentro del container (dentro del “embed”)
    container.addActionRowComponents(r => r.addComponents(zoneSelect));

    const actionRowMain = new ActionRowBuilder().addComponents(
        new SecondaryButtonBuilder()
            .setCustomId(`pet:do:${safeUserId}:play`)
            .setLabel(tMisc('PLAY') || 'Play')
            .setEmoji(toEmojiObject('🎮'))
            .setDisabled(disabled || Boolean(away)),
        new SecondaryButtonBuilder()
            .setCustomId(`pet:do:${safeUserId}:feed`)
            .setLabel(tMisc('FEED') || 'Feed')
            .setEmoji(toEmojiObject('🍎'))
            .setDisabled(disabled || Boolean(away)),
        new SecondaryButtonBuilder()
            .setCustomId(`pet:do:${safeUserId}:clean`)
            .setLabel(tMisc('CLEAN') || 'Clean')
            .setEmoji(toEmojiObject('🧼'))
            .setDisabled(disabled || Boolean(away))
    );

    const actionRowSecondary = new ActionRowBuilder().addComponents(
        new SecondaryButtonBuilder()
            .setCustomId(`pet:do:${safeUserId}:train`)
            .setLabel(tMisc('TRAIN') || 'Train')
            .setEmoji(toEmojiObject('🏋️'))
            .setDisabled(disabled || Boolean(away)),
        new SecondaryButtonBuilder()
            .setCustomId(`pet:renameModal:${safeUserId}`)
            .setLabel(tMisc('CHANGE_NAME') || 'Change name')
            .setEmoji(toEmojiObject('📝'))
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
    const safeTitle = String(title || (moxi.translate('economy/pet:GENERIC_TITLE', lang) || 'Pet'));
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
        if(customId) {
            const label = b?.label != null ? String(b.label) : null;
            const emoji = b?.emoji != null ? String(b.emoji) : null;
            const style = Number.isFinite(Number(b?.style)) ? Number(b.style) : 2;

            const btn = createButtonForStyle(style)
                .setCustomId(customId)
                .setDisabled(Boolean(disabled));

            if (label) btn.setLabel(label);
            if (emoji) btn.setEmoji(toEmojiObject(emoji));

            built.push(btn);
        }
    }

    // Botón de vuelta al menú
    built.push(
        new SecondaryButtonBuilder()
            .setCustomId(`pet:open:${safeUserId}`)
            .setLabel(moxi.translate('MENU', lang) || 'Menú')
            .setEmoji(toEmojiObject('⬅️'))
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
