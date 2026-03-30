const {
    ContainerBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    ThumbnailBuilder,
    ButtonStyle,
    MessageFlags,
} = require('discord.js');
const axios = require('axios');
const { ButtonBuilder } = require('../../Util/compatButtonBuilder');
const { genshinCategory } = require('../../Util/commandCategories');
const { getGlobalUserDoc } = require('../../Util/genshinAccount');
const { normalizeCharacterKey } = require('../../Util/genshinRoster');
const { fetchCharacterByQuery } = require('../../Util/genshinDbProxy');

async function safeReply(message, payload) {
    try {
        return await message.reply(payload);
    } catch (err) {
        const code = Number(err?.code || 0);
        const raw = String(err?.message || '');
        const unknownReference = code === 50035 || raw.includes('MESSAGE_REFERENCE_UNKNOWN_MESSAGE');
        if (unknownReference && message?.channel?.send) {
            return await message.channel.send(payload).catch(() => null);
        }
        return null;
    }
}

async function resolveGuildPrefix(Moxi, message) {
    const guildId = message?.guild?.id;
    const fallback = process.env.PREFIX || '.';
    if (!guildId || typeof Moxi?.guildPrefix !== 'function') return fallback;
    try {
        return await Moxi.guildPrefix(guildId, fallback);
    } catch {
        return fallback;
    }
}

let avatarMetaCache = null;
let avatarMetaCacheAt = 0;
const AVATAR_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
let locMapCache = null;
let locMapCacheAt = 0;
const SHOWCASE_PAGE_SIZE = 3;
let charactersListCache = null;
let charactersListCacheAt = 0;
const CHARACTERS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const JMP_API = 'https://genshin.jmp.blue/characters';

async function getCharactersList() {
    const now = Date.now();
    if (charactersListCache && (now - charactersListCacheAt) < CHARACTERS_CACHE_TTL_MS) {
        return charactersListCache;
    }
    
    try {
        const { data } = await axios.get(JMP_API, { timeout: 10_000 });
        if (Array.isArray(data)) {
            charactersListCache = data.sort();
            charactersListCacheAt = now;
            return charactersListCache;
        }
    } catch (err) {
        console.error('Error fetching characters from genshin.jmp.blue:', err.message);
    }
    return [];
}

function paginateList(array, page, perPage = 12) {
    const total = array.length;
    const totalPages = Math.ceil(total / perPage);
    const safePage = Math.max(1, Math.min(page, totalPages));
    const start = (safePage - 1) * perPage;
    const end = start + perPage;
    
    return {
        items: array.slice(start, end),
        page: safePage,
        totalPages,
        total,
    };
}

function prettifyAvatarName(raw) {
    const text = String(raw || '').trim();
    if (!text) return null;
    return text
        .replace(/^UI_AvatarIcon_Side_/, '')
        .replace(/^UI_AvatarIcon_/, '')
        .replace(/_/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function buildAvatarImageUrl(sideIconName) {
    const clean = String(sideIconName || '').trim();
    if (!clean) return null;
    return `https://enka.network/ui/${clean}.png`;
}

function buildAvatarFullImageUrl(sideIconName) {
    const clean = String(sideIconName || '').trim();
    if (!clean) return null;
    const base = clean.replace(/^UI_AvatarIcon_Side_/, '');
    if (!base) return null;
    return `https://enka.network/ui/UI_Gacha_AvatarImg_${base}.png`;
}

function buildAvatarCardImageUrl(sideIconName) {
    const clean = String(sideIconName || '').trim();
    if (!clean) return null;
    const base = clean.replace(/^UI_AvatarIcon_Side_/, '');
    if (!base) return null;
    return `https://enka.network/ui/UI_Gacha_AvatarIcon_${base}.png`;
}

function parseCharacterQuery(args = []) {
    const tokens = (Array.isArray(args) ? args : [])
        .map(x => String(x || '').trim())
        .filter(Boolean)
        .filter(x => !/^<@!?\d+>$/.test(x));
    const query = tokens.join(' ').trim();
    return query || null;
}

function formatElement(element) {
    const key = String(element || '').trim();
    const map = {
        Fire: 'Pyro',
        Water: 'Hydro',
        Grass: 'Dendro',
        Electric: 'Electro',
        Ice: 'Cryo',
        Wind: 'Anemo',
        Rock: 'Geo',
    };
    return map[key] || key || 'N/D';
}

function formatWeaponType(weaponType) {
    const key = String(weaponType || '').trim();
    const map = {
        WEAPON_SWORD_ONE_HAND: 'Espada',
        WEAPON_CLAYMORE: 'Mandoble',
        WEAPON_POLE: 'Lanza',
        WEAPON_CATALYST: 'Catalizador',
        WEAPON_BOW: 'Arco',
    };
    return map[key] || key || 'N/D';
}

function formatRarity(qualityType) {
    const key = String(qualityType || '').trim();
    const map = {
        QUALITY_ORANGE: '5★',
        QUALITY_ORANGE_SP: '5★',
        QUALITY_PURPLE: '4★',
    };
    return map[key] || 'N/D';
}

function buildAvatarDetailsMap(publicData) {
    const list = Array.isArray(publicData?.avatarInfoList) ? publicData.avatarInfoList : [];
    const map = new Map();
    for (const item of list) {
        const key = String(item?.avatarId || '').trim();
        if (!key) continue;
        map.set(key, item);
    }
    return map;
}

function buildTalentSummary(detail, meta) {
    const skillLevels = detail && typeof detail.skillLevelMap === 'object' ? detail.skillLevelMap : null;
    const order = Array.isArray(meta?.skillOrder) ? meta.skillOrder : [];
    if (!skillLevels || order.length < 3) return 'N/D';

    const normal = Number(skillLevels[String(order[0])] || 0) || 0;
    const skill = Number(skillLevels[String(order[1])] || 0) || 0;
    const burst = Number(skillLevels[String(order[2])] || 0) || 0;
    if (!normal && !skill && !burst) return 'N/D';
    return `${normal}/${skill}/${burst}`;
}

function formatFightPropValue(id, value) {
    const v = Number(value || 0);
    if (!Number.isFinite(v)) return 'N/D';
    const key = String(id || '');
    const pctIds = new Set(['20', '22', '23', '26', '27', '28', '29', '30', '40', '41', '42', '43', '44', '45', '46']);
    const pctNames = new Set([
        'FIGHT_PROP_HP_PERCENT',
        'FIGHT_PROP_ATTACK_PERCENT',
        'FIGHT_PROP_DEFENSE_PERCENT',
        'FIGHT_PROP_CHARGE_EFFICIENCY',
        'FIGHT_PROP_CRITICAL',
        'FIGHT_PROP_CRITICAL_HURT',
        'FIGHT_PROP_HEAL_ADD',
        'FIGHT_PROP_HEALED_ADD',
        'FIGHT_PROP_PHYSICAL_ADD_HURT',
        'FIGHT_PROP_FIRE_ADD_HURT',
        'FIGHT_PROP_ELEC_ADD_HURT',
        'FIGHT_PROP_WATER_ADD_HURT',
        'FIGHT_PROP_GRASS_ADD_HURT',
        'FIGHT_PROP_WIND_ADD_HURT',
        'FIGHT_PROP_ROCK_ADD_HURT',
        'FIGHT_PROP_ICE_ADD_HURT',
    ]);
    if (pctIds.has(key) || pctNames.has(key)) {
        const normalized = v <= 3 ? (v * 100) : v;
        return `${normalized.toFixed(1)}%`;
    }
    return Math.round(v).toLocaleString('es-ES');
}

function pickElementBonus(detail) {
    const fp = detail && typeof detail.fightPropMap === 'object' ? detail.fightPropMap : null;
    if (!fp) return 'N/D';
    const ids = ['40', '41', '42', '43', '44', '45', '46'];
    let best = 0;
    for (const id of ids) {
        const val = Number(fp[id] || 0);
        if (val > best) best = val;
    }
    return best > 0 ? formatFightPropValue('40', best) : 'N/D';
}

function formatAppendPropLabel(id) {
    const map = {
        FIGHT_PROP_BASE_ATTACK: 'ATQ',
        FIGHT_PROP_ATTACK: 'ATQ',
        FIGHT_PROP_ATTACK_PERCENT: 'ATQ%',
        FIGHT_PROP_HP: 'Vida',
        FIGHT_PROP_HP_PERCENT: 'Vida%',
        FIGHT_PROP_DEFENSE: 'DEF',
        FIGHT_PROP_DEFENSE_PERCENT: 'DEF%',
        FIGHT_PROP_CHARGE_EFFICIENCY: 'ER%',
        FIGHT_PROP_CRITICAL: 'Prob.CRIT',
        FIGHT_PROP_CRITICAL_HURT: 'Daño CRIT',
        FIGHT_PROP_ELEMENT_MASTERY: 'EM',
    };
    return map[String(id || '')] || String(id || '');
}

function getArtifactSlotLabel(equipType) {
    const map = {
        EQUIP_BRACER: 'Flor',
        EQUIP_NECKLACE: 'Pluma',
        EQUIP_SHOES: 'Reloj',
        EQUIP_RING: 'Cáliz',
        EQUIP_DRESS: 'Corona',
    };
    return map[String(equipType || '')] || 'Artefacto';
}

function resolveLocalizedName(locMap = new Map(), hashLike) {
    const key = String(hashLike || '').trim();
    if (!key) return null;
    if (locMap.has(key)) return locMap.get(key);
    const compact = key.replace(/n$/i, '');
    if (locMap.has(compact)) return locMap.get(compact);
    return null;
}

async function getLocMap() {
    const now = Date.now();
    if (locMapCache && (now - locMapCacheAt) < AVATAR_CACHE_TTL_MS) {
        return locMapCache;
    }

    try {
        const { data } = await axios.get('https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/loc.json', {
            timeout: 15_000,
            headers: {
                'User-Agent': 'MoxiBot/1.0 (+https://github.com/MoxiLab/moxiBot)',
            },
        });

        const locales = data && typeof data === 'object' ? data : {};
        const langCandidates = ['es', 'es-ES', 'en'];
        let selected = null;
        for (const lang of langCandidates) {
            if (locales[lang] && typeof locales[lang] === 'object') {
                selected = locales[lang];
                break;
            }
        }

        if (!selected) {
            const first = Object.values(locales).find(x => x && typeof x === 'object');
            selected = first || {};
        }

        const map = new Map();
        for (const [k, v] of Object.entries(selected)) {
            const value = String(v || '').trim();
            if (!value) continue;
            map.set(String(k), value);
        }

        locMapCache = map;
        locMapCacheAt = now;
        return locMapCache;
    } catch {
        return locMapCache || new Map();
    }
}

async function getAvatarMetaMap() {
    const now = Date.now();
    if (avatarMetaCache && (now - avatarMetaCacheAt) < AVATAR_CACHE_TTL_MS) {
        return avatarMetaCache;
    }

    try {
        const { data } = await axios.get('https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/characters.json', {
            timeout: 10_000,
            headers: {
                'User-Agent': 'MoxiBot/1.0 (+https://github.com/MoxiLab/moxiBot)',
            },
        });

        const map = new Map();
        const entries = data && typeof data === 'object' ? Object.entries(data) : [];
        for (const [avatarId, info] of entries) {
            const pretty = prettifyAvatarName(info?.SideIconName);
            if (!pretty) continue;
            map.set(String(avatarId), {
                name: pretty,
                imageUrl: buildAvatarImageUrl(info?.SideIconName),
                cardImageUrl: buildAvatarCardImageUrl(info?.SideIconName),
                fullImageUrl: buildAvatarFullImageUrl(info?.SideIconName),
                element: formatElement(info?.Element),
                weaponType: formatWeaponType(info?.WeaponType),
                rarity: formatRarity(info?.QualityType),
                skillOrder: Array.isArray(info?.SkillOrder) ? info.SkillOrder : [],
            });
        }

        avatarMetaCache = map;
        avatarMetaCacheAt = now;
        return avatarMetaCache;
    } catch {
        return avatarMetaCache || new Map();
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms) || 0)));
}

async function fetchPublicGenshin(uid) {
    const attempts = [10_000, 18_000, 25_000];
    let lastErr = null;

    for (let i = 0; i < attempts.length; i += 1) {
        try {
            const { data } = await axios.get(`https://enka.network/api/uid/${uid}`, {
                timeout: attempts[i],
                headers: {
                    'User-Agent': 'MoxiBot/1.0 (+https://github.com/MoxiLab/moxiBot)',
                },
            });
            const payload = data && typeof data === 'object' ? data : null;
            return {
                ok: true,
                data: payload,
                errorType: null,
            };
        } catch (err) {
            lastErr = err;
            if (i < attempts.length - 1) {
                await sleep(500 + (i * 700));
            }
        }
    }

    const code = String(lastErr?.code || '').toUpperCase();
    const status = Number(lastErr?.response?.status || 0);
    const timeout = code === 'ECONNABORTED';
    const connect = code === 'ENOTFOUND' || code === 'ECONNRESET' || code === 'ECONNREFUSED' || code === 'EHOSTUNREACH';

    return {
        ok: false,
        data: null,
        errorType: timeout ? 'timeout' : (connect ? 'connect' : (status >= 500 ? 'server' : 'unknown')),
    };
}

async function downloadImageAttachment(url, baseName = 'genshin-character') {
    const clean = String(url || '').trim();
    if (!clean) return null;

    try {
        const { data, headers } = await axios.get(clean, {
            timeout: 12_000,
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'MoxiBot/1.0 (+https://github.com/MoxiLab/moxiBot)',
            },
        });

        const contentType = String(headers?.['content-type'] || '').toLowerCase();
        const fromType = contentType.includes('webp') ? 'webp' : (contentType.includes('jpeg') || contentType.includes('jpg') ? 'jpg' : null);
        const fromUrl = String(clean).toLowerCase().endsWith('.webp') ? 'webp' : (String(clean).toLowerCase().endsWith('.jpg') || String(clean).toLowerCase().endsWith('.jpeg') ? 'jpg' : 'png');
        const ext = fromType || fromUrl || 'png';
        const safeBase = normalizeCharacterKey(baseName) || 'genshin-character';
        const name = `${safeBase}.${ext}`;
        return { attachment: Buffer.from(data), name };
    } catch {
        return null;
    }
}

async function resolveBestImageAttachment(ch) {
    const candidates = [
        ch?.cardImageUrl,
        ch?.imageUrl,
        ch?.fullImageUrl,
    ].filter(Boolean);

    for (const url of candidates) {
        const file = await downloadImageAttachment(url, `genshin-${ch?.name || 'character'}`);
        if (file) {
            return { file, sourceUrl: url };
        }
    }

    return null;
}

function buildCharacterShowcase(publicData, metaMap = new Map(), locMap = new Map()) {
    const detailMap = buildAvatarDetailsMap(publicData);
    const showcase = Array.isArray(publicData?.playerInfo?.showAvatarInfoList)
        ? publicData.playerInfo.showAvatarInfoList
        : [];
    const showcaseMap = new Map();
    for (const item of showcase) {
        const key = String(item?.avatarId || '').trim();
        if (!key) continue;
        showcaseMap.set(key, item);
    }

    const sourceIds = detailMap.size
        ? Array.from(detailMap.keys())
        : Array.from(showcaseMap.keys());

    if (!sourceIds.length) {
        return [];
    }

    return sourceIds
        .map((avatarId, i) => {
            const meta = metaMap.get(avatarId) || null;
            const detail = detailMap.get(avatarId) || null;
            const showItem = showcaseMap.get(avatarId) || null;
            const constellationCount = Math.max(0, Math.min(6, Array.isArray(detail?.talentIdList) ? detail.talentIdList.length : 0));
            const friendship = Number(detail?.fetterInfo?.expLevel || 0) || 0;
            const levelFromShowcase = Number(showItem?.level || 0) || 0;
            const levelFromDetail = Number(detail?.propMap?.['4001']?.val || detail?.propMap?.['4001']?.ival || 0) || 0;
            const fp = detail && typeof detail.fightPropMap === 'object' ? detail.fightPropMap : {};
            const weaponEquip = Array.isArray(detail?.equipList)
                ? detail.equipList.find(x => String(x?.flat?.itemType || '') === 'ITEM_WEAPON')
                : null;
            const weaponAffixes = weaponEquip?.weapon?.affixMap && typeof weaponEquip.weapon.affixMap === 'object'
                ? Object.values(weaponEquip.weapon.affixMap).map(x => Number(x || 0))
                : [];
            const weaponRefine = weaponAffixes.length ? (Math.max(...weaponAffixes) + 1) : 1;
            const weaponStats = Array.isArray(weaponEquip?.flat?.weaponStats) ? weaponEquip.flat.weaponStats : [];
            const weaponMain = weaponStats[0];
            const weaponSub = weaponStats[1];
            const weaponName = resolveLocalizedName(locMap, weaponEquip?.flat?.nameTextMapHash)
                || prettifyAvatarName(String(weaponEquip?.flat?.icon || '').replace(/^UI_EquipIcon_/, ''))
                || 'Arma';
            const artifacts = Array.isArray(detail?.equipList)
                ? detail.equipList
                    .filter(x => String(x?.flat?.itemType || '') === 'ITEM_RELIQUARY')
                    .map(x => ({
                        slot: (() => {
                            const setName = resolveLocalizedName(locMap, x?.flat?.setNameTextMapHash);
                            const slotName = getArtifactSlotLabel(x?.flat?.equipType);
                            return setName ? `${slotName} - ${setName}` : slotName;
                        })(),
                        level: Math.max(0, Number(x?.reliquary?.level || 1) - 1),
                        main: formatAppendPropLabel(x?.flat?.reliquaryMainstat?.mainPropId),
                        mainValue: formatFightPropValue(x?.flat?.reliquaryMainstat?.mainPropId, x?.flat?.reliquaryMainstat?.statValue),
                        subs: Array.isArray(x?.flat?.reliquarySubstats)
                            ? x.flat.reliquarySubstats.map(s => `${formatAppendPropLabel(s?.appendPropId)} ${formatFightPropValue(s?.appendPropId, s?.statValue)}`)
                            : [],
                        iconUrl: x?.flat?.icon ? `https://enka.network/ui/${x.flat.icon}.png` : null,
                    }))
                : [];
            const hasBuildDetails = Boolean(detail && Array.isArray(detail?.equipList));

            return {
                index: i + 1,
                avatarId,
                name: meta?.name || `Avatar ${avatarId}`,
                level: levelFromShowcase || levelFromDetail,
                imageUrl: meta?.imageUrl || null,
                cardImageUrl: meta?.cardImageUrl || null,
                fullImageUrl: meta?.fullImageUrl || null,
                element: meta?.element || 'N/D',
                rarity: meta?.rarity || 'N/D',
                weaponType: meta?.weaponType || 'N/D',
                constellation: constellationCount,
                friendship,
                talents: buildTalentSummary(detail, meta),
                stats: {
                    hp: formatFightPropValue('2000', fp['2000']),
                    atk: formatFightPropValue('2001', fp['2001']),
                    def: formatFightPropValue('2002', fp['2002']),
                    em: formatFightPropValue('28', fp['28']),
                    critRate: formatFightPropValue('20', fp['20']),
                    critDmg: formatFightPropValue('22', fp['22']),
                    energyRecharge: formatFightPropValue('23', fp['23']),
                    elementBonus: pickElementBonus(detail),
                },
                weapon: weaponEquip ? {
                    name: weaponName,
                    level: Number(weaponEquip?.weapon?.level || 0) || 0,
                    refine: weaponRefine,
                    main: weaponMain ? `${formatAppendPropLabel(weaponMain.appendPropId)} ${formatFightPropValue(weaponMain.appendPropId, weaponMain.statValue)}` : '',
                    sub: weaponSub ? `${formatAppendPropLabel(weaponSub.appendPropId)} ${formatFightPropValue(weaponSub.appendPropId, weaponSub.statValue)}` : '',
                } : null,
                artifacts,
                hasBuildDetails,
            };
        });
}

function buildGenshinContainer({
    target,
    uid,
    region,
    linkedAt,
    nickname,
    ar,
    wl,
    achievements,
    enkaProfileUrl,
    enkaApiUrl,
    enkaStatus = 'N/D',
    infoNote = null,
    enkaVisibleCount = 0,
    totalShownCount = 0,
    showcase,
    page = 0,
    pageSize = SHOWCASE_PAGE_SIZE,
    navBaseId = 'genshinme_nav',
    disableNav = false,
} = {}) {
    const totalPages = Math.max(1, Math.ceil(showcase.length / Math.max(1, pageSize)));
    const safePage = Math.min(Math.max(0, Number(page) || 0), totalPages - 1);

    const container = new ContainerBuilder()
        .setAccentColor(0xC39A5B)
        .addTextDisplayComponents(c => c.setContent(`# 🎮 Genshin de <@${target.id}>`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent([
            `• UID: **${uid}**`,
            `• Región: **${region || 'N/D'}**`,
            `• Vinculado: ${linkedAt}`,
            `• Nickname público: **${nickname}**`,
            `• AR/WL: **${ar}** / **${wl}**`,
            `• Logros: **${achievements}**`,
            '• Enka: usa el botón **Abrir Perfil Enka**',
            `• Estado Enka: **${enkaStatus}**`,
            `• Enka visibles: **${enkaVisibleCount}**`,
            `• Total mostrado: **${totalShownCount}**`,
        ].join('\n')));

    if (enkaProfileUrl || enkaApiUrl) {
        container
            .addSeparatorComponents(s => s.setDivider(true))
            .addActionRowComponents(row => {
                if (enkaProfileUrl) {
                    row.addComponents(
                        new ButtonBuilder()
                            .setLabel('Abrir Perfil Enka')
                            .setStyle(ButtonStyle.Link)
                            .setURL(enkaProfileUrl)
                    );
                }

                if (enkaApiUrl) {
                    row.addComponents(
                        new ButtonBuilder()
                            .setLabel('Ver JSON API')
                            .setStyle(ButtonStyle.Link)
                            .setURL(enkaApiUrl)
                    );
                }

                return row;
            });
    }

    if (infoNote) {
        container
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(c => c.setContent(`ℹ️ ${infoNote}`));
    }

    if (!showcase.length) {
        container
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(c => c.setContent('No hay personajes visibles. Si Enka está sin datos, revisa UID y perfil público.'));
        return { container, page: safePage, totalPages };
    }

    const start = safePage * pageSize;
    const end = start + pageSize;
    const pageItems = showcase.slice(start, end);

    container
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`## 🎭 Fichas ${safePage + 1}/${totalPages}`));

    for (const ch of pageItems) {
        const conNum = Number(ch.constellation);
        const constText = Number.isFinite(conNum) ? `C${Math.max(0, conNum)}` : 'N/D';
        container.addSectionComponents(section => {
            const built = section.addTextDisplayComponents(td =>
                td.setContent([
                    `• #${ch.index} **${ch.name}** (${ch.rarity})`,
                    `Nivel: **${ch.level}** | Constelación: **${constText}**`,
                    `Elemento: **${ch.element}** | Arma: **${ch.weaponType}**`,
                    `Amistad: **${ch.friendship || 'N/D'}** | Talentos: **${ch.talents}**`,
                ].join('\n'))
            );
            if (ch.imageUrl) {
                built.setThumbnailAccessory(new ThumbnailBuilder().setURL(ch.imageUrl));
            }
            return built;
        });
    }

    if (totalPages > 1) {
        const prevDisabled = disableNav || safePage <= 0;
        const nextDisabled = disableNav || safePage >= (totalPages - 1);

        container
            .addSeparatorComponents(s => s.setDivider(true))
            .addActionRowComponents(row => row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`${navBaseId}:prev`)
                    .setLabel('⬅️ Anterior')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(prevDisabled),
                new ButtonBuilder()
                    .setCustomId(`${navBaseId}:next`)
                    .setLabel('Siguiente ➡️')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(nextDisabled),
            ));
    }

    return { container, page: safePage, totalPages };
}

module.exports = {
    name: 'genshin',
    alias: ['gime', 'migenshin', 'genshinperfil', 'genshinprofile', 'genshinacc', 'genshinaccount', 'genshincuenta', 'genshinuid', 'genshininfo', 'genshinshowcase', 'account', 'acc'],
    Category: genshinCategory,
    usage: 'genshin [@usuario]',
    description: 'Muestra la cuenta de Genshin vinculada.',
    cooldown: 2,

    async execute(Moxi, message, args) {
        const prefix = await resolveGuildPrefix(Moxi, message);
        const target = message.mentions?.users?.first?.() || message.author;
        const doc = await getGlobalUserDoc(target.id, target.username);

        const uid = String(doc?.profile?.genshin?.uid || '').trim();
        const region = String(doc?.profile?.genshin?.region || '').trim();
        const linkedAt = doc?.profile?.genshin?.linkedAt ? `<t:${Math.floor(new Date(doc.profile.genshin.linkedAt).getTime() / 1000)}:R>` : '-';

        if (!uid) {
            const container = new ContainerBuilder()
                .setAccentColor(0xF39C12)
                .addTextDisplayComponents(c => c.setContent('# 🎮 Genshin • Sin vínculo'))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(
                    target.id === message.author.id
                        ? `No tienes cuenta de Genshin vinculada. Usa \`${prefix}genshinlink <uid> [region]\`.`
                        : `<@${target.id}> no tiene cuenta de Genshin vinculada.`
                ));
            return safeReply(message, {
                content: '',
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { repliedUser: false },
            });
        }

        const [publicFetch, avatarMetaMap, locMap] = await Promise.all([
            fetchPublicGenshin(uid),
            getAvatarMetaMap(),
            getLocMap(),
        ]);
        const publicData = publicFetch?.data || null;
        const enkaAvailable = Boolean(publicData && typeof publicData === 'object');
        const nickname = String(publicData?.playerInfo?.nickname || '').trim() || '-';
        const ar = Number(publicData?.playerInfo?.level || 0) || 0;
        const wl = Number(publicData?.playerInfo?.worldLevel || 0) || 0;
        const achievements = Number(publicData?.playerInfo?.finishAchievementNum || 0) || 0;
        const showcaseBase = buildCharacterShowcase(publicData, avatarMetaMap, locMap);
        const showcase = showcaseBase;
        const enkaProfileUrl = `https://enka.network/u/${uid}/`;
        const enkaApiUrl = `https://enka.network/api/uid/${uid}`;
        const enkaVisibleCount = showcaseBase.length;
        const hasEnkaAvatars = enkaVisibleCount > 0;
        const enkaStatus = !enkaAvailable
            ? 'Sin datos'
            : (hasEnkaAvatars ? 'Disponible' : 'Sin showcase público');
        const infoNote = null;
        const regionHint = region || (uid.startsWith('6') ? 'NA' : uid.startsWith('7') ? 'EU' : uid.startsWith('8') ? 'ASIA' : uid.startsWith('9') ? 'SAR' : 'EU');

        if (!enkaAvailable) {
            const errorType = String(publicFetch?.errorType || 'unknown');
            const reason = errorType === 'timeout'
                ? 'Enka tardó demasiado en responder (timeout).'
                : (errorType === 'connect'
                    ? 'No se pudo conectar a Enka desde el bot.'
                    : (errorType === 'server'
                        ? 'Enka devolvió un error de servidor temporal.'
                        : 'Enka no devolvió datos para este UID.'));
            const action = (errorType === 'timeout' || errorType === 'connect' || errorType === 'server')
                ? 'Reintenta en unos minutos. Si persiste, revisa conectividad del host del bot.'
                : `Prueba: \`${prefix}genshinlink ${uid} ${regionHint}\` para reconfirmar UID y región.`;

            const container = new ContainerBuilder()
                .setAccentColor(0xE67E22)
                .addTextDisplayComponents(c => c.setContent('# 🎮 Genshin • Sin datos de personajes'))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent([
                    `No pude obtener datos públicos de Enka para el UID **${uid}**.`,
                    reason,
                    action,
                    'Puedes abrir el perfil en Enka con el botón de abajo.',
                ].join('\n')));
            container
                .addSeparatorComponents(s => s.setDivider(true))
                .addActionRowComponents(row => row.addComponents(
                    new ButtonBuilder()
                        .setLabel('Abrir Perfil Enka')
                        .setStyle(ButtonStyle.Link)
                        .setURL(enkaProfileUrl),
                    new ButtonBuilder()
                        .setLabel('Ver JSON API')
                        .setStyle(ButtonStyle.Link)
                        .setURL(enkaApiUrl),
                ));
            return safeReply(message, {
                content: '',
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { repliedUser: false },
            });
        }

        const characterQuery = parseCharacterQuery(args);
        if (characterQuery) {
            const qKey = normalizeCharacterKey(characterQuery);
            const queryMeta = await fetchCharacterByQuery(characterQuery);
            const queryCanonicalKey = normalizeCharacterKey(queryMeta?.name || '');
            const queryAvatarId = String(queryMeta?.id || '').trim();
            const exact = showcase.find(ch => {
                const nameKey = normalizeCharacterKey(ch?.name || '');
                const avatarId = String(ch?.avatarId || '').trim();
                if (!nameKey) return false;
                if (qKey && nameKey === qKey) return true;
                if (queryCanonicalKey && nameKey === queryCanonicalKey) return true;
                if (queryAvatarId && avatarId && avatarId === queryAvatarId) return true;
                return false;
            }) || null;
            const partial = showcase.find(ch => {
                const nameKey = normalizeCharacterKey(ch?.name || '');
                if (!nameKey) return false;
                if (qKey && nameKey.includes(qKey)) return true;
                if (queryCanonicalKey && nameKey.includes(queryCanonicalKey)) return true;
                return false;
            }) || null;
            const picked = exact || partial;

            if (!picked) {
                const names = showcase.slice(0, 15).map(ch => ch.name).join(', ');
                const container = new ContainerBuilder()
                    .setAccentColor(0xE67E22)
                    .addTextDisplayComponents(c => c.setContent('# 🎮 Genshin • Personaje no encontrado'))
                    .addSeparatorComponents(s => s.setDivider(true))
                    .addTextDisplayComponents(c => c.setContent(
                        `No encontré \`${characterQuery}\` en tu lista visible.\n` +
                        `${queryMeta?.name ? `Nombre canónico API: **${queryMeta.name}**\n` : ''}` +
                        `Prueba con otro nombre.\n\nCoincidencias disponibles: ${names || 'N/D'}`
                    ));
                return safeReply(message, {
                    content: '',
                    components: [container],
                    flags: MessageFlags.IsComponentsV2,
                    allowedMentions: { repliedUser: false },
                });
            }
            const preferredMediaUrl = picked.cardImageUrl || picked.imageUrl || picked.fullImageUrl || null;
            const stats = picked?.stats || {};
            const weapon = picked?.weapon || null;
            const artifacts = Array.isArray(picked?.artifacts) ? picked.artifacts.slice(0, 5) : [];
            let galleryUrl = preferredMediaUrl || null;
            let files = undefined;

            if (preferredMediaUrl) {
                const resolved = await resolveBestImageAttachment(picked);
                if (resolved?.file) {
                    files = [resolved.file];
                    galleryUrl = `attachment://${resolved.file.name}`;
                } else {
                    galleryUrl = preferredMediaUrl;
                }
            }

            const statsLines = [
                `Vida: **${stats.hp || 'N/D'}** | ATQ: **${stats.atk || 'N/D'}** | DEF: **${stats.def || 'N/D'}**`,
                `EM: **${stats.em || 'N/D'}** | Prob. CRIT: **${stats.critRate || 'N/D'}** | Daño CRIT: **${stats.critDmg || 'N/D'}**`,
                `Recarga: **${stats.energyRecharge || 'N/D'}** | Bono Elemental: **${stats.elementBonus || 'N/D'}**`,
            ];

            const weaponLines = weapon
                ? [
                    `Nombre: **${weapon.name || 'N/D'}**`,
                    `Nivel: **${weapon.level || 'N/D'}** | Refinamiento: **R${weapon.refine || 'N/D'}**`,
                    `Stats: **${(weapon.main || 'N/D')}**${weapon.sub ? ` | **${weapon.sub}**` : ''}`,
                ]
                : ['No hay arma visible en Enka.'];

            const artifactLines = artifacts.length
                ? artifacts.map((art, idx) => {
                    const subs = Array.isArray(art?.subs) && art.subs.length
                        ? art.subs.slice(0, 3).join(' • ')
                        : 'Substats N/D';
                    return `${idx + 1}. **${art.slot || 'Artefacto'}** +${art.level || 0}\n` +
                        `Main: ${art.main || 'N/D'} ${art.mainValue || ''}\n` +
                        `Subs: ${subs}`;
                })
                : [
                    picked?.hasBuildDetails
                        ? 'No hay artefactos visibles en Enka para este personaje.'
                        : 'Enka no expone detalles de build para este personaje. Activa en Genshin: Mostrar detalles de personajes en el perfil.',
                ];

            const container = new ContainerBuilder()
                .setAccentColor(0xC39A5B)
                .addTextDisplayComponents(c => c.setContent(`# 🎴 ${picked.name}`))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(
                    `Consulta: **${characterQuery}**\n` +
                    `Nivel: **${picked.level}** | Constelación: **${Number.isFinite(Number(picked.constellation)) ? `C${Number(picked.constellation)}` : 'N/D'}**\n` +
                    `Elemento: **${picked.element}** | Arma: **${picked.weaponType}**\n` +
                    `Talentos: **${picked.talents}**\n` +
                    'Perfil Enka: usa el botón **Abrir Perfil Enka**'
                ))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(`## 📊 Estadísticas\n${statsLines.join('\n')}`))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(`## ⚔️ Arma\n${weaponLines.join('\n')}`))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(`## 🏺 Artefactos\n${artifactLines.join('\n\n')}`))
                .addSeparatorComponents(s => s.setDivider(true))
                .addActionRowComponents(row => row.addComponents(
                    new ButtonBuilder()
                        .setLabel('Abrir Perfil Enka')
                        .setStyle(ButtonStyle.Link)
                        .setURL(enkaProfileUrl),
                    new ButtonBuilder()
                        .setLabel('Ver JSON API')
                        .setStyle(ButtonStyle.Link)
                        .setURL(enkaApiUrl),
                ));

            if (picked.imageUrl) {
                container.addSectionComponents(section => {
                    const built = section.addTextDisplayComponents(td => td.setContent('## 🖼️ Vista previa del personaje'));
                    built.setThumbnailAccessory(new ThumbnailBuilder().setURL(picked.imageUrl));
                    return built;
                });
            }

            if (galleryUrl) {
                container
                    .addSeparatorComponents(s => s.setDivider(true))
                    .addMediaGalleryComponents(new MediaGalleryBuilder().addItems(
                        new MediaGalleryItemBuilder().setURL(galleryUrl)
                    ));
            }

            const payload = {
                content: '',
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { repliedUser: false },
            };
            if (files) payload.files = files;

            return safeReply(message, payload);
        }

        const navBaseId = `genshinme_nav:${message.author.id}:${target.id}:${Date.now().toString(36)}`;
        let currentPage = 0;

        const initialPanel = buildGenshinContainer({
            target,
            uid,
            region,
            linkedAt,
            nickname,
            ar,
            wl,
            achievements,
            enkaProfileUrl,
            enkaApiUrl,
            enkaStatus,
            infoNote,
            enkaVisibleCount,
            totalShownCount: showcase.length,
            showcase,
            page: currentPage,
            pageSize: SHOWCASE_PAGE_SIZE,
            navBaseId,
            disableNav: false,
        });
        currentPage = initialPanel.page;

        const sent = await safeReply(message, {
            content: '',
            components: [initialPanel.container],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { repliedUser: false },
        });

        if (!sent) return null;

        if (initialPanel.totalPages <= 1) {
            return sent;
        }

        if (typeof sent.createMessageComponentCollector !== 'function') {
            return sent;
        }

        const collector = sent.createMessageComponentCollector({
            filter: i => i.customId.startsWith(`${navBaseId}:`),
            time: 10 * 60 * 1000,
        });

        collector.on('collect', async (i) => {
            try {
                if (i.user?.id !== message.author.id) {
                    return i.reply({
                        content: 'Solo quien ejecutó el comando puede usar esta paginación.',
                        flags: MessageFlags.Ephemeral,
                    }).catch(() => null);
                }

                if (i.customId.endsWith(':prev')) currentPage -= 1;
                if (i.customId.endsWith(':next')) currentPage += 1;

                const panel = buildGenshinContainer({
                    target,
                    uid,
                    region,
                    linkedAt,
                    nickname,
                    ar,
                    wl,
                    achievements,
                    enkaProfileUrl,
                    enkaApiUrl,
                    enkaStatus,
                    infoNote,
                    enkaVisibleCount,
                    totalShownCount: showcase.length,
                    showcase,
                    page: currentPage,
                    pageSize: SHOWCASE_PAGE_SIZE,
                    navBaseId,
                    disableNav: false,
                });
                currentPage = panel.page;

                return i.update({
                    content: '',
                    components: [panel.container],
                    flags: MessageFlags.IsComponentsV2,
                    allowedMentions: { repliedUser: false },
                }).catch(() => null);
            } catch {
                return i.reply({
                    content: 'No se pudo cambiar de página en este momento.',
                    flags: MessageFlags.Ephemeral,
                }).catch(() => null);
            }
        });

        collector.on('end', async () => {
            try {
                const lockedPanel = buildGenshinContainer({
                    target,
                    uid,
                    region,
                    linkedAt,
                    nickname,
                    ar,
                    wl,
                    achievements,
                    enkaProfileUrl,
                    enkaApiUrl,
                    enkaStatus,
                    infoNote,
                    enkaVisibleCount,
                    totalShownCount: showcase.length,
                    showcase,
                    page: currentPage,
                    pageSize: SHOWCASE_PAGE_SIZE,
                    navBaseId,
                    disableNav: true,
                });

                await sent.edit({
                    content: '',
                    components: [lockedPanel.container],
                    flags: MessageFlags.IsComponentsV2,
                    allowedMentions: { repliedUser: false },
                }).catch(() => null);
            } catch {
                // noop
            }
        });

        return sent;
    },
};
