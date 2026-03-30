const { ActionRowBuilder, EmbedBuilder, StringSelectMenuBuilder } = require('discord.js');

const { Bot } = require('../Config');
const LevelSystem = require('../Global/Helpers/LevelSystem');
const { User } = require('../Models');
const { getOrCreateEconomyRaw } = require('./balanceView');
const { getBankInfo } = require('./bankSystem');
const { xpNeededForNextLevel } = require('./levels');
const { getActivePet } = require('./petSystem');
const { formatBirthday } = require('./profileSettings');
const { getJobDisplayName } = require('./workSystem');
const { formatDateTag } = require('./marriageCore');
const { RELATIONSHIP_TYPES } = require('./relationshipCore');

function formatInt(value) {
    const num = Number(value);
    if (!Number.isFinite(num)) return '0';
    return Math.trunc(num).toLocaleString('en-US');
}

function timestampTag(dateLike, style = 'F') {
    if (!dateLike) return '-';
    const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
    if (Number.isNaN(date.getTime())) return '-';
    return `<t:${Math.floor(date.getTime() / 1000)}:${style}>`;
}

function buildProgressBar(current, required, size = 10) {
    const safeRequired = Math.max(1, Number(required) || 1);
    const safeCurrent = Math.max(0, Math.min(safeRequired, Number(current) || 0));
    const ratio = Math.max(0, Math.min(1, safeCurrent / safeRequired));
    const filled = Math.round(ratio * size);
    return `[${'#'.repeat(filled)}${'-'.repeat(Math.max(0, size - filled))}] ${Math.round(ratio * 100)}%`;
}

function formatShortDate(dateLike) {
    if (!dateLike) return 'Sin fecha';
    const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
    if (Number.isNaN(date.getTime())) return 'Sin fecha';
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
}

function cleanClubName(rawClubId) {
    const text = String(rawClubId || '').trim();
    if (!text) return 'Ninguno';
    return text
        .split(/[/:_-]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function buildPhrase(userDoc) {
    const customPhrase = String(userDoc?.profile?.phrase || '').trim();
    if (customPhrase) return customPhrase;
    return 'Sin frase configurada. Usa setprofile o /setprofile para editarla.';
}

function formatPetLine(pet) {
    if (!pet) return 'Sin mascota activa';
    const name = String(pet.name || 'Mascota sin nombre').trim();
    const level = Math.max(1, Number(pet.level) || 1);
    const rarity = String(pet?.attributes?.rarity || 'comun').trim();
    return `${name} · Nv. ${level} · ${rarity}`;
}

function formatPetCompact(pet) {
    if (!pet) return 'Ninguna';
    const name = String(pet.name || 'Mascota').trim();
    const level = Math.max(1, Number(pet.level) || 1);
    return `${name} (Nv. ${level})`;
}

function formatMarriageLine(userDoc) {
    const spouseId = userDoc?.marriage?.spouse ? String(userDoc.marriage.spouse) : '';
    if (!spouseId) return 'Soltero/a';

    const marriedAt = userDoc?.marriage?.marriedAt || userDoc?.marriage?.anniversaryDate;
    const since = marriedAt ? ` desde ${timestampTag(marriedAt, 'D')}` : '';
    return `Con <@${spouseId}>${since}`;
}

function formatBadgesLine(userDoc) {
    const badges = Array.isArray(userDoc?.badges) ? userDoc.badges : [];
    if (!badges.length) return 'Sin insignias registradas';
    return badges
        .slice(0, 4)
        .map((badge) => badge?.icon ? `${badge.icon} ${badge.name || 'Insignia'}` : (badge?.name || 'Insignia'))
        .join(' · ');
}

function formatMarriageCompact(userDoc) {
    const spouseId = userDoc?.marriage?.spouse ? String(userDoc.marriage.spouse) : '';
    if (!spouseId) return 'Solter@';
    return `<@${spouseId}>`;
}

function formatRelationshipsCompact(userDoc) {
    const rels = Array.isArray(userDoc?.relationships) ? userDoc.relationships : [];
    if (!rels.length) return 'Sin relaciones';

    return rels
        .map((r) => {
            const info = RELATIONSHIP_TYPES[r?.type] || { emoji: '💛', label: r?.type || 'relación' };
            return `${info.emoji} <@${r.userId}>`;
        })
        .join(', ');
}

function buildMarriageValue(userDoc) {
    const spouseId = userDoc?.marriage?.spouse ? String(userDoc.marriage.spouse) : '';
    const marriageLine = spouseId
        ? `💍 <@${spouseId}>\n💒 ${formatDateTag(userDoc?.marriage?.anniversaryDate)}`
        : '💍 Solter@';

    const rels = Array.isArray(userDoc?.relationships) ? userDoc.relationships : [];
    const relLines = rels.length
        ? rels.map((r) => {
            const info = RELATIONSHIP_TYPES[r?.type] || { emoji: '💛', label: r?.type || 'relación' };
            return `${info.emoji} ${info.label}: <@${r.userId}>`;
        })
        : ['💛 Sin relaciones'];

    return [marriageLine, ...relLines].join('\n');
}

function buildNekosText(eco) {
    const pets = Array.isArray(eco?.pets) ? eco.pets : [];
    if (!pets.length) return 'Ninguno';

    return pets
        .slice(-3)
        .map((pet) => `🐾 ${String(pet?.name || 'Neko').trim()}`)
        .join('\n');
}

function countCelebratedAnniversaries(anniversaryDateLike, now = new Date()) {
    if (!anniversaryDateLike) return 0;
    const ann = anniversaryDateLike instanceof Date ? anniversaryDateLike : new Date(anniversaryDateLike);
    if (Number.isNaN(ann.getTime())) return 0;

    let years = now.getFullYear() - ann.getFullYear();
    if (years <= 0) return 0;

    const anniversaryThisYear = new Date(ann);
    anniversaryThisYear.setFullYear(now.getFullYear());
    if (anniversaryThisYear > now) years -= 1;

    return Math.max(0, years);
}

function buildSocialMilestones(userDoc) {
    const social = userDoc?.socialProgress || {};
    const compatChecks = Math.max(0, Number(social.compatChecks || 0));
    const relCreated = Math.max(0, Number(social.relationshipsCreated || 0));
    // Fallback: si está casado pero el contador aún es 0 (matrimonio previo al fix), mostrar al menos 1
    const rawMarriages = Math.max(0, Number(social.marriagesCount || 0));
    const marriagesCount = rawMarriages === 0 && userDoc?.marriage?.spouse ? 1 : rawMarriages;
    const rawAnnCount = Math.max(0, Number(social.anniversariesCelebrated || 0));
    const calculatedAnnCount = countCelebratedAnniversaries(userDoc?.marriage?.anniversaryDate);
    const annCount = Math.max(rawAnnCount, calculatedAnnCount);
    const firstRel = social.firstRelationshipAt ? timestampTag(social.firstRelationshipAt, 'D') : '-';
    const lastCompat = social.lastCompatibilityAt ? timestampTag(social.lastCompatibilityAt, 'R') : '-';

    return (
        `🧪 Compat checks: ${formatInt(compatChecks)}\n` +
        `🤝 Relaciones creadas: ${formatInt(relCreated)}\n` +
        `💍 Matrimonios: ${formatInt(marriagesCount)}\n` +
        `🎉 Aniversarios celebrados: ${formatInt(annCount)}\n` +
        `📌 Primera relacion social: ${firstRel}\n` +
        `🕒 Ultimo compat: ${lastCompat}`
    );
}

const PROFILE_PAGES = Object.freeze([
    { value: 'overview', label: 'Perfil principal', emoji: '🐱', description: 'Vista general del perfil' },
    { value: 'jobs', label: 'Profesiones', emoji: '💼', description: 'Trabajo, ingresos y progreso laboral' },
    { value: 'petrank', label: 'Clasificacion de mascotas', emoji: '👑', description: 'Mascotas y Nekodex' },
    { value: 'tools', label: 'Herramientas', emoji: '🛠️', description: 'Mochila, banco e inventario' },
    { value: 'stats', label: 'Estadisticas', emoji: '📈', description: 'Actividad y fechas del usuario' },
]);

function normalizeProfilePage(page) {
    const value = String(page || 'overview').trim().toLowerCase();
    return PROFILE_PAGES.some((entry) => entry.value === value) ? value : 'overview';
}

function getProfilePageMeta(page) {
    return PROFILE_PAGES.find((entry) => entry.value === page) || PROFILE_PAGES[0];
}

function buildProfileSelectRow({ viewerId, targetId, page }) {
    const currentPage = normalizeProfilePage(page);
    const select = new StringSelectMenuBuilder()
        .setCustomId(`profile:view:${viewerId}:${targetId}:${currentPage}`)
        .setPlaceholder(`${getProfilePageMeta(currentPage).emoji} ${getProfilePageMeta(currentPage).label}`)
        .addOptions(
            PROFILE_PAGES.map((entry) => ({
                label: entry.label,
                value: entry.value,
                description: entry.description,
                emoji: { name: entry.emoji },
                default: entry.value === currentPage,
            }))
        );

    return new ActionRowBuilder().addComponents(select);
}

async function resolveTargetMember(guild, targetUser, fallbackMember = null) {
    if (fallbackMember) return fallbackMember;
    if (!guild?.members?.fetch || !targetUser?.id) return null;
    return guild.members.fetch(targetUser.id).catch(() => null);
}

async function buildProfileMessage({ guild, guildId, lang = 'es-ES', targetUser, targetMember = null, viewerId = null, page = 'overview' } = {}) {
    if (!guildId) throw new Error('GUILD_ID_REQUIRED');
    if (!targetUser?.id) throw new Error('TARGET_USER_REQUIRED');

    const member = await resolveTargetMember(guild, targetUser, targetMember);
    const userDocPromise = (async () => {
        const globalDoc = await User.findOne({ guildID: 'GLOBAL', userID: targetUser.id }).lean().catch(() => null);
        if (globalDoc) return globalDoc;
        return User.findOne({ userID: targetUser.id }).sort({ updatedAt: -1, createdAt: -1 }).lean().catch(() => null);
    })();
    const [stats, levelInfo, guildUserDoc, userDoc, eco] = await Promise.all([
        LevelSystem.getUserStats(guildId, targetUser.id).catch(() => null),
        LevelSystem.getUserLevelInfo(guildId, targetUser.id).catch(() => null),
        User.findOne({ guildID: guildId, userID: targetUser.id }).lean().catch(() => null),
        userDocPromise,
        getOrCreateEconomyRaw(targetUser.id).catch(() => null),
    ]);

    const level = Math.max(1, Number(stats?.level ?? levelInfo?.level ?? guildUserDoc?.level ?? 1) || 1);
    const prestige = Math.max(0, Number(stats?.prestige ?? levelInfo?.prestige ?? guildUserDoc?.prestige ?? 0) || 0);
    const rank = Math.max(0, Number(stats?.rank ?? guildUserDoc?.rank ?? 0) || 0);
    const currentXp = Math.max(0, Number(levelInfo?.currentXp ?? guildUserDoc?.xp ?? 0) || 0);
    const requiredXp = xpNeededForNextLevel(level);
    const totalXp = Math.max(0, Number(stats?.totalXp ?? guildUserDoc?.totalXp ?? 0) || 0);
    const messages = Math.max(0, Number(stats?.messages ?? guildUserDoc?.stats?.messagesCount ?? 0) || 0);
    const reactions = Math.max(0, Number(stats?.reactions ?? guildUserDoc?.stats?.reactionsReceived ?? 0) || 0);
    const streak = Math.max(0, Number(stats?.streak ?? guildUserDoc?.streak ?? 0) || 0);
    const maxStreak = Math.max(0, Number(stats?.maxStreak ?? guildUserDoc?.maxStreak ?? 0) || 0);
    const badgeCount = Array.isArray(userDoc?.badges) ? userDoc.badges.length : Math.max(0, Number(stats?.badges ?? 0) || 0);

    const balance = Math.max(0, Number(eco?.balance ?? 0) || 0);
    const sakuras = Math.max(0, Number(eco?.sakuras ?? 0) || 0);
    const workShifts = Math.max(0, Number(eco?.workShifts ?? 0) || 0);
    const workTotalEarned = Math.max(0, Number(eco?.workTotalEarned ?? 0) || 0);
    const bankInfo = getBankInfo(eco || {});
    const inventory = Array.isArray(eco?.inventory) ? eco.inventory : [];
    const pets = Array.isArray(eco?.pets) ? eco.pets : [];
    const uniqueItems = inventory.length;
    const totalItems = inventory.reduce((sum, item) => sum + Math.max(0, Number(item?.amount) || 0), 0);
    const clubCount = Array.isArray(eco?.clubs) ? eco.clubs.length : 0;
    const primaryClub = Array.isArray(eco?.clubs) && eco.clubs[0]?.clubId ? cleanClubName(eco.clubs[0].clubId) : 'Ninguno';
    const activePet = getActivePet(eco || {});
    const jobName = eco?.workJobId ? getJobDisplayName(eco.workJobId, lang) : 'Sin trabajo';
    const displayName = member?.displayName || targetUser.globalName || targetUser.username || 'Usuario';
    const avatarUrl = member?.displayAvatarURL?.({ size: 2048, extension: 'png', forceStatic: false })
        || targetUser.displayAvatarURL({ size: 2048, extension: 'png', forceStatic: false });
    const bannerUrl = typeof targetUser.bannerURL === 'function'
        ? targetUser.bannerURL({ size: 2048, extension: 'png', forceStatic: false })
        : null;
    const createdAt = timestampTag(targetUser.createdAt, 'F');
    const joinedAt = member?.joinedAt ? timestampTag(member.joinedAt, 'F') : '-';
    const joinedRelative = member?.joinedAt ? timestampTag(member.joinedAt, 'R') : '-';
    const phrase = buildPhrase(userDoc);
    const birthdayText = formatBirthday(userDoc?.profile?.birthday);
    const pats = Math.max(0, Number(userDoc?.profile?.stats?.pats ?? 0) || 0);
    const charisma = Math.max(0, Number(userDoc?.profile?.stats?.charisma ?? 0) || 0);
    const deaths = Math.max(0, Number(userDoc?.profile?.stats?.deaths ?? 0) || 0);
    const globalLevel = Math.max(1, Number(eco?.globalLevel ?? 1) || 1);
    const globalXp = Math.max(0, Number(eco?.globalXp ?? 0) || 0);
    const globalXpRequired = xpNeededForNextLevel(globalLevel);
    const registeredDate = member?.joinedAt ? formatShortDate(member.joinedAt) : formatShortDate(targetUser.createdAt);
    const rankingText = rank > 0 ? formatInt(rank) : 'Sin clasificar';
    const leagueText = prestige > 0 ? `Prestigio ${formatInt(prestige)}` : 'Sin clasificar';
    const nekodexCount = formatInt(pets.length);
    const selectedPage = normalizeProfilePage(page);
    const pageMeta = getProfilePageMeta(selectedPage);
    const safeViewerId = String(viewerId || targetUser.id || '').trim() || targetUser.id;

    const embed = new EmbedBuilder()
        .setColor(Bot.AccentColor)
        .setTitle(`${displayName} (@${targetUser.username})`)
        .setAuthor({
            name: `${pageMeta.label} • Pagina ${PROFILE_PAGES.findIndex((entry) => entry.value === selectedPage) + 1} de ${PROFILE_PAGES.length}`,
            iconURL: avatarUrl || undefined,
        })
        .setThumbnail(avatarUrl || null)
        .setFooter({
            text: `Registrado el ${registeredDate} (${joinedRelative !== '-' ? joinedRelative : 'sin fecha de ingreso'})`,
        })
        .setTimestamp(new Date());

    if (bannerUrl) {
        embed.setImage(bannerUrl);
    }

    if (selectedPage === 'overview') {
        embed.setDescription(
            `⭐ **Nivel srv:** ${formatInt(level)} (${formatInt(currentXp)}/${formatInt(requiredXp)} XP)\n` +
            `🌐 **Nivel global:** ${formatInt(globalLevel)} (${formatInt(globalXp)}/${formatInt(globalXpRequired)} XP)\n` +
            `👑 **Rank:** ${rankingText}\n` +
            `🧾 **Nekodex:** ${nekodexCount}\n` +
            `💼 **Profesion:** ${jobName || 'Sin trabajo'}\n` +
            `🐱 **Club:** ${primaryClub}\n\n` +
            `**Frase**\n${phrase}\n\n` +
            `**Clasificatorias**\n` +
            `🍥 **Liga:** ${leagueText}\n` +
            `🏅 **Puntos:** ${formatInt(totalXp)}\n` +
            `❓ **Mascota:** ${formatPetCompact(activePet)}`
        );

        embed.addFields(
            {
                name: 'Stats',
                value:
                    `🐾 **Pats:** ${formatInt(pats)}\n` +
                    `💗 **Carisma:** ${formatInt(charisma)}\n` +
                    `💀 **Muertes:** ${formatInt(deaths)}`,
                inline: true,
            },
            {
                name: 'Mochila',
                value:
                    `🪙 **Coins:** ${formatInt(balance)}\n` +
                    `🏦 **Banco:** ${formatInt(bankInfo.bank)}\n` +
                    `🌸 **Sakuras:** ${formatInt(sakuras)}\n` +
                    `🎒 **Items:** ${formatInt(totalItems)}`,
                inline: true,
            },
            {
                name: 'Cumpleaños',
                value: `🎂 ${birthdayText}`,
                inline: true,
            },
            {
                name: 'Nekos',
                value: buildNekosText(eco),
                inline: true,
            },
            {
                name: 'Matrimonio',
                value: buildMarriageValue(userDoc),
                inline: false,
            },
            {
                name: 'Hitos sociales',
                value: buildSocialMilestones(userDoc),
                inline: false,
            }
        );
    } else if (selectedPage === 'jobs') {
        embed.setDescription(
            `💼 **Profesion actual:** ${jobName || 'Sin trabajo'}\n` +
            `🕒 **Turnos completados:** ${formatInt(workShifts)}\n` +
            `💸 **Ganado trabajando:** ${formatInt(workTotalEarned)}\n` +
            `🏦 **Nivel de banco:** ${formatInt(bankInfo.level)}\n` +
            `🏘 **Club principal:** ${primaryClub}`
        );

        embed.addFields(
            { name: 'Actividad laboral', value: `💼 ${jobName || 'Sin trabajo'}\n🕒 ${formatInt(workShifts)} turnos\n💸 ${formatInt(workTotalEarned)} generados`, inline: true },
            { name: 'Economia de soporte', value: `🪙 ${formatInt(balance)} coins\n🏦 ${formatInt(bankInfo.bank)} en banco\n🌸 ${formatInt(sakuras)} sakuras`, inline: true },
            { name: 'Notas', value: 'Esta pagina resume la parte laboral del usuario y se actualiza con su progreso real.', inline: false },
        );
    } else if (selectedPage === 'petrank') {
        embed.setDescription(
            `🧾 **Nekodex:** ${nekodexCount}\n` +
            `🐾 **Mascota activa:** ${formatPetLine(activePet)}\n` +
            `🏅 **Liga:** ${leagueText}\n` +
            `📍 **Puntos:** ${formatInt(totalXp)}`
        );

        embed.addFields(
            { name: 'Mascotas recientes', value: buildNekosText(eco), inline: false },
            { name: 'Coleccion', value: `Total de mascotas: ${nekodexCount}\nMascota destacada: ${formatPetCompact(activePet)}`, inline: false },
        );
    } else if (selectedPage === 'tools') {
        embed.setDescription(
            `🪙 **Coins:** ${formatInt(balance)}\n` +
            `🏦 **Banco:** ${formatInt(bankInfo.bank)} / ${formatInt(bankInfo.capacity)}\n` +
            `🌸 **Sakuras:** ${formatInt(sakuras)}\n` +
            `🎒 **Items:** ${formatInt(totalItems)}\n` +
            `📦 **Tipos de item:** ${formatInt(uniqueItems)}`
        );

        embed.addFields(
            { name: 'Inventario', value: `🎒 ${formatInt(totalItems)} objetos\n📦 ${formatInt(uniqueItems)} tipos`, inline: true },
            { name: 'Banco', value: `🏦 ${formatInt(bankInfo.bank)} guardados\n📈 Capacidad ${formatInt(bankInfo.capacity)}\n🧱 Nivel ${formatInt(bankInfo.level)}`, inline: true },
            { name: 'Apunte', value: 'Si quieres un desglose por herramientas reales, la siguiente mejora es separar categorías del inventario.', inline: false },
        );
    } else if (selectedPage === 'stats') {
        embed.setDescription(
            `📈 **Mensajes:** ${formatInt(messages)}\n` +
            `✨ **Reacciones:** ${formatInt(reactions)}\n` +
            `🔥 **Racha actual:** ${formatInt(streak)}\n` +
            `🏅 **Insignias:** ${formatInt(badgeCount)}\n` +
            `📅 **Discord:** ${createdAt}\n` +
            `📥 **Servidor:** ${joinedAt}`
        );

        embed.addFields(
            { name: 'Actividad', value: `💬 ${formatInt(messages)} mensajes\n✨ ${formatInt(reactions)} reacciones\n🔥 Max racha ${formatInt(maxStreak)}`, inline: true },
            { name: 'Progreso', value: `⭐ Nivel ${formatInt(level)}\n📈 ${buildProgressBar(currentXp, requiredXp)}\n👑 Rank ${rankingText}`, inline: true },
            { name: 'Perfil', value: `🐱 Clubes: ${formatInt(clubCount)}\n💞 Matrimonio: ${formatMarriageCompact(userDoc)}\n💛 Relaciones: ${formatRelationshipsCompact(userDoc)}\n🎂 Cumpleaños: ${birthdayText}`, inline: false },
        );
    }

    return {
        embeds: [embed],
        components: [buildProfileSelectRow({ viewerId: safeViewerId, targetId: targetUser.id, page: selectedPage })],
        allowedMentions: { repliedUser: false },
    };
}

module.exports = {
    normalizeProfilePage,
    buildProfileMessage,
};