const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { getItemById } = require('../../Util/inventoryCatalog');
const { claimCooldown, awardBalance, formatDuration, getOrCreateEconomy } = require('../../Util/economyCore');
const { claimRateLimit } = require('../../Util/actionRateLimit');
const { pickFishActivity } = require('../../Util/fishActivities');
const { addManyToInventory } = require('../../Util/inventoryOps');
const { rollFishMaterials } = require('../../Util/fishLoot');
const { scaleRange, randInt, chance } = require('../../Util/activityUtils');
const { buildFishPlayMessageOptions } = require('../../Util/fishPlay');
const { shouldShowCooldownNotice } = require('../../Util/cooldownNotice');
const {
    hasInventoryItem,
} = require('../../Util/fishView');
const { buildZonesMessageOptions, getZonesForKind } = require('../../Util/zonesView');

const { economyCategory } = require('../../Util/commandCategories');

const FISH_FAIL_CHANCE = 0.22;
function safeInt(n, fallback = 0) {
    const x = Number(n);
    if (!Number.isFinite(x)) return fallback;
    return Math.trunc(x);
}

function normalizeKey(input) {
    return String(input || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/\s+/g, '-');
}

function parsePageArgToIndex(pageArg) {
    const raw = String(pageArg || '').trim();
    if (!raw) return 0;
    const num = Number.parseInt(raw, 10);
    if (!Number.isFinite(num) || num <= 0) return 0;
    return num - 1;
}

function resolveFishZone(input) {
    const key = normalizeKey(input);
    if (!key) return null;

    const zones = getZonesForKind('fish');
    return (
        zones.find(z => String(z?.id || '') === key) ||
        zones.find(z => Array.isArray(z.aliases) && z.aliases.map(normalizeKey).includes(key)) ||
        null
    );
}

function pickBestUsableFishZone(eco) {
    const zones = getZonesForKind('fish');
    const usable = (Array.isArray(zones) ? zones : []).filter(z => hasInventoryItem(eco, z.requiredItemId));
    if (!usable.length) return null;

    // Igual que mine: escoger una zona usable aleatoria para variar la experiencia.
    return usable[Math.floor(Math.random() * usable.length)] || usable[0];
}

module.exports = {
    name: 'fish',
    alias: ['pescar', 'fishing'],
    Category: economyCategory,
    usage: 'fish [zona|nivel] | fish zones',
    description: 'commands:CMD_FISH_DESC',
    // cooldown base (normal)
    cooldown: 0,
    // Para que el help se vea como tu captura
    helpText: (lang) => moxi.translate('economy/fish:HELP_TEXT', lang),
    examples: ['fish zones', 'fish zones 2', 'fish muelle-moxi', 'fish bahia-sakura', 'fish ruinas-sumergidas'],
    cooldownTiers: {
        normal: 0,
        normalHaste: 0,
        premium: 0,
        premiumHaste: 0,
    },
    permissions: {
        Bot: ['Ver canal', 'Enviar mensajes', 'Insertar enlaces'],
        User: [],
    },
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message, args) {
        const guildId = message.guildId || message.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const prefix = await moxi.guildPrefix(guildId, process.env.PREFIX || '.');
        const t = (k, vars = {}) => moxi.translate(`economy/fish:${k}`, lang, vars);

        const sub = String(args?.[0] || '').trim().toLowerCase();
        if (sub === 'zones' || sub === 'zonas') {
            const page = parsePageArgToIndex(args?.[1]);
            return message.reply(buildZonesMessageOptions({ lang, userId: message.author?.id, kind: 'fish', page }));
        }

        const wantsAuto = sub === 'auto' || sub === 'instant' || sub === 'instante';

        const userId = message.author?.id;
        const eco = await getOrCreateEconomy(userId);

        // Si no pasan args, por defecto abre un minijuego con botones.
        if (!sub || wantsAuto) {
            const autoZone = pickBestUsableFishZone(eco);
            if (!autoZone) {
                const required = getItemById('herramientas/cana-de-pesca-moxi', { lang });
                const requiredName = required?.name || 'herramientas/cana-de-pesca-moxi';
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: '⛔',
                            title: t('REQUIREMENT_TITLE'),
                            text: t('REQUIREMENT_TEXT', { item: requiredName, prefix }),
                        })
                    )
                );
            }

            // Modo instantáneo anterior
            if (wantsAuto) {
                const cooldownMs = Math.max(1, safeInt(this.cooldown, 120)) * 1000;
                const minAmount = Math.max(1, safeInt(autoZone?.reward?.min, 25));
                const maxAmount = Math.max(minAmount, safeInt(autoZone?.reward?.max, 60));
                const activity = pickFishActivity();
                const scaled = scaleRange(minAmount, maxAmount, activity?.multiplier || 1);
                const cd = claimRateLimit({ userId, key: 'fish', windowMs: 30 * 1000, maxHits: 4 });

                if (!cd.ok && cd.reason === 'cooldown') {
                    if (!shouldShowCooldownNotice({ userId, key: 'fish' })) {
                        await message.react('⏳').catch(() => null);
                        return;
                    }
                    return message.reply(
                        asV2MessageOptions(
                            buildNoticeContainer({
                                emoji: '⏳',
                                title: t('COOLDOWN_TITLE'),
                                text: t('COOLDOWN_TEXT', { time: formatDuration(cd.nextInMs) }),
                            })
                        )
                    );
                }

                if (!cd.ok) {
                    return message.reply(
                        asV2MessageOptions(
                            buildNoticeContainer({
                                emoji: '⚠️',
                                title: t('ERROR_TITLE'),
                                text: cd.message || t('ERROR_GENERIC'),
                            })
                        )
                    );
                }

                const actionLine = (activity?.phraseKey ? t(activity.phraseKey) : activity?.phrase) || t('DEFAULT_ACTION');

                if (chance(FISH_FAIL_CHANCE)) {
                    return message.reply(
                        asV2MessageOptions(
                            buildNoticeContainer({
                                emoji: autoZone.emoji || '🎣',
                                title: `Fish • ${autoZone.name}`,
                                text: t('FAIL_TEXT', { action: actionLine }),
                            })
                        )
                    );
                }

                const amount = randInt(scaled.min, scaled.max);
                const res = await awardBalance({ userId, amount });
                const balanceLine = Number.isFinite(res?.balance) ? t('BALANCE_LINE', { balance: res.balance }) : '';

                if (!res.ok && res.reason === 'cooldown') {
                    if (!shouldShowCooldownNotice({ userId, key: 'fish' })) {
                        await message.react('⏳').catch(() => null);
                        return;
                    }
                    return message.reply(
                        asV2MessageOptions(
                            buildNoticeContainer({
                                emoji: '⏳',
                                title: t('COOLDOWN_TITLE'),
                                text: t('COOLDOWN_TEXT', { time: formatDuration(res.nextInMs) }),
                            })
                        )
                    );
                }

                if (!res.ok) {
                    return message.reply(
                        asV2MessageOptions(
                            buildNoticeContainer({
                                emoji: '⚠️',
                                title: t('ERROR_TITLE'),
                                text: res.message || t('ERROR_GENERIC'),
                            })
                        )
                    );
                }

                // Drops (solo si éxito)
                const drops = rollFishMaterials(autoZone, activity);
                if (drops.length) {
                    const ecoAfter = await getOrCreateEconomy(userId);
                    addManyToInventory(ecoAfter, drops);
                    await ecoAfter.save();
                }

                const materialLines = drops
                    .map(d => {
                        const it = getItemById(d.itemId, { lang });
                        const name = it?.name || d.itemId;
                        return `+${d.amount} ${name}`;
                    })
                    .join('\n');

                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: autoZone.emoji || '🎣',
                            title: `Fish • ${autoZone.name}`,
                            text: [
                                t('SUCCESS_TEXT', { action: actionLine, amount: res.amount }),
                                balanceLine,
                                materialLines ? `\n${t('MATERIALS_HEADER')}\n${materialLines}` : '',
                            ].filter(Boolean).join('\n'),
                        })
                    )
                );
            }

            // Default: minijuego
            return message.reply(buildFishPlayMessageOptions({ userId, zoneId: autoZone.id, lang }));

        }

        // Permite también `.fish 2` como alias de `.fish zones 2` (por UX)
        if (/^\d+$/.test(sub)) {
            return message.reply(buildZonesMessageOptions({ lang, userId: message.author?.id, kind: 'fish', page: parsePageArgToIndex(sub) }));
        }

        const zone = resolveFishZone(sub);
        if (!zone) {
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: '🎣',
                        title: t('ZONE_NOT_FOUND_TITLE'),
                        text: t('ZONE_NOT_FOUND_TEXT', { zone: sub, prefix }),
                    })
                )
            );
        }

        if (!hasInventoryItem(eco, zone.requiredItemId)) {
            const required = getItemById(zone.requiredItemId, { lang });
            const requiredName = required?.name || String(zone.requiredItemId).split('/').pop() || zone.requiredItemId;
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: '⛔',
                        title: t('REQUIREMENT_TITLE'),
                        text: t('ZONE_REQUIREMENT_TEXT', { zone: zone.name, item: requiredName, prefix }),
                    })
                )
            );
        }

        // Para zonas explícitas, también usamos minijuego por defecto.
        return message.reply(buildFishPlayMessageOptions({ userId, zoneId: zone.id, lang }));

        const cooldownMs = Math.max(1, safeInt(this.cooldown, 300)) * 1000;
        const minAmount = Math.max(1, safeInt(zone?.reward?.min, 25));
        const maxAmount = Math.max(minAmount, safeInt(zone?.reward?.max, 60));
        const activity = pickFishActivity();
        const scaled = scaleRange(minAmount, maxAmount, activity?.multiplier || 1);
        const cd = await claimCooldown({
            userId,
            field: 'lastFish',
            cooldownMs,
        });

        if (!cd.ok && cd.reason === 'cooldown') {
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: '⏳',
                        title: 'Fish • Cooldown',
                        text: `Aún estás cansad@ de pescar. Vuelve en **${formatDuration(cd.nextInMs)}**.`,
                    })
                )
            );
        }

        if (!cd.ok) {
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: '⚠️',
                        title: 'Fish',
                        text: cd.message || 'No pude procesar tu pesca ahora mismo.',
                    })
                )
            );
        }

        const actionLine = activity?.phrase || 'Has pescado';

        if (chance(FISH_FAIL_CHANCE)) {
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: zone.emoji || '🎣',
                        title: `Fish • ${zone.name}`,
                        text: `${actionLine}... pero no ha picado nada.`,
                    })
                )
            );
        }

        const amount = randInt(scaled.min, scaled.max);
        const res = await awardBalance({ userId, amount });
        const balanceLine = Number.isFinite(res?.balance) ? `Saldo: **${res.balance}** 🪙` : '';

        if (!res.ok && res.reason === 'cooldown') {
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: '⏳',
                        title: 'Fish • Cooldown',
                        text: `Aún estás cansad@ de pescar. Vuelve en **${formatDuration(res.nextInMs)}**.`,
                    })
                )
            );
        }

        if (!res.ok) {
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: '⚠️',
                        title: 'Fish',
                        text: res.message || 'No pude procesar tu pesca ahora mismo.',
                    })
                )
            );
        }

        return message.reply(
            asV2MessageOptions(
                buildNoticeContainer({
                    emoji: zone.emoji || '🎣',
                    title: `Fish • ${zone.name}`,
                    text: [
                        `${actionLine} y ganaste **${res.amount}** 🪙. ¡Buen lance! 🎣`,
                        balanceLine,
                    ].filter(Boolean).join('\n'),
                })
            )
        );
    },
};
