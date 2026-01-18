const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { getItemById } = require('../../Util/inventoryCatalog');
const { claimCooldown, awardBalance, formatDuration, getOrCreateEconomy } = require('../../Util/economyCore');
const { claimRateLimit } = require('../../Util/actionRateLimit');
const { buildZonesMessageOptions } = require('../../Util/zonesView');
const { getZonesForKind } = require('../../Util/zonesView');
const { hasInventoryItem } = require('../../Util/fishView');
const { addManyToInventory } = require('../../Util/inventoryOps');
const { rollMineMaterials } = require('../../Util/mineLoot');
const { pickMineActivity } = require('../../Util/mineActivities');
const { scaleRange, randInt, chance } = require('../../Util/activityUtils');
const { buildMinePlayMessageOptions } = require('../../Util/minePlay');
const { shouldShowCooldownNotice } = require('../../Util/cooldownNotice');

const MINE_FAIL_CHANCE = 0.18;

function economyCategory(lang) {
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang || 'es-ES');
}

function parsePageArgToIndex(pageArg) {
    const raw = String(pageArg || '').trim();
    if (!raw) return 0;
    const num = Number.parseInt(raw, 10);
    if (!Number.isFinite(num) || num <= 0) return 0;
    return num - 1;
}

function safeInt(n, fallback = 0) {
    const x = Number(n);
    if (!Number.isFinite(x)) return fallback;
    return Math.trunc(x);
}

function resolveMineZone(input) {
    const raw = String(input || '').trim().toLowerCase();
    if (!raw) return null;

    const zones = getZonesForKind('mine');
    return (
        zones.find(z => String(z.id || '').toLowerCase() === raw) ||
        zones.find(z => Array.isArray(z.aliases) && z.aliases.some(a => String(a).toLowerCase() === raw)) ||
        null
    );
}

function pickBestUsableMineZone(eco) {
    const zones = getZonesForKind('mine');
    const usable = (Array.isArray(zones) ? zones : []).filter(z => hasInventoryItem(eco, z.requiredItemId));
    if (!usable.length) return null;

    return usable[Math.floor(Math.random() * usable.length)] || usable[0];
}

function buildMineHelpText(prefix) {
    const p = String(prefix || '.');
    return [
        '⛏️ Zonas de minería',
        '',
        `Panel: \`${p}mine zones\``,
        `Página: \`${p}mine zones 2\``,
    ].join('\n');
}

module.exports = {
    name: 'mine',
    alias: ['minar', 'mineria', 'minería', 'mining'],
    Category: economyCategory,
    usage: 'mine zones [página]',
    description: 'Muestra las zonas de minería.',
    cooldown: 0,
    helpText: buildMineHelpText('.'),
    examples: ['mine zones', 'mine zones 2'],
    permissions: {
        Bot: ['Ver canal', 'Enviar mensajes'],
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
        const t = (k, vars = {}) => moxi.translate(`economy/mine:${k}`, lang, vars);

        const sub = String(args?.[0] || '').trim().toLowerCase();
        if (sub === 'zones' || sub === 'zonas') {
            const page = parsePageArgToIndex(args?.[1]);
            return message.reply(buildZonesMessageOptions({ lang, userId: message.author?.id, kind: 'mine', page }));
        }

        const wantsAuto = sub === 'auto' || sub === 'instant' || sub === 'instante';

        // UX: permitir `.mine 2` como alias de `.mine zones 2`
        if (/^\d+$/.test(sub)) {
            return message.reply(buildZonesMessageOptions({ lang, userId: message.author?.id, kind: 'mine', page: parsePageArgToIndex(sub) }));
        }

        const userId = message.author?.id;
        const eco = await getOrCreateEconomy(userId);

        // Si no pasan args, por defecto abre un minijuego con botones.
        if (!sub || wantsAuto) {
            const autoZone = pickBestUsableMineZone(eco);
            if (!autoZone) {
                const required = getItemById('herramientas/pico-prisma', { lang });
                const requiredName = required?.name || 'herramientas/pico-prisma';
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
                const cooldownMs = 45 * 1000;
                const requiredId = String(autoZone?.requiredItemId || '');
                const isExplosive = requiredId.includes('dinamita');
                const activity = pickMineActivity(autoZone);
                const baseRange = isExplosive ? { min: 60, max: 140 } : { min: 30, max: 75 };
                const scaled = scaleRange(baseRange.min, baseRange.max, activity?.multiplier || 1);
                const cd = claimRateLimit({ userId, key: 'mine', windowMs: 35 * 1000, maxHits: 3 });

                if (!cd.ok && cd.reason === 'cooldown') {
                    if (!shouldShowCooldownNotice({ userId, key: 'mine' })) {
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
                const coin = (EMOJIS.coin || '🪙');

                // Fallo: consume cooldown pero no da recompensa
                if (chance(MINE_FAIL_CHANCE)) {
                    return message.reply(
                        asV2MessageOptions(
                            buildNoticeContainer({
                                emoji: autoZone.emoji || '⛏️',
                                title: `Mine • ${autoZone.name}`,
                                text: t('FAIL_TEXT', { action: actionLine }),
                            })
                        )
                    );
                }

                const amount = randInt(scaled.min, scaled.max);
                const res = await awardBalance({ userId, amount });

                if (!res.ok && res.reason === 'cooldown') {
                    if (!shouldShowCooldownNotice({ userId, key: 'mine' })) {
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

                // Materiales: recargar doc para no pisar el balance/cooldown.
                const drops = rollMineMaterials(autoZone, activity);
                if (drops.length) {
                    const ecoAfter = await getOrCreateEconomy(userId);
                    addManyToInventory(ecoAfter, drops);
                    await ecoAfter.save();
                }
                const balanceLine = Number.isFinite(res?.balance)
                    ? t('BALANCE_LINE', { balance: res.balance, coin })
                    : '';

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
                            emoji: autoZone.emoji || '⛏️',
                            title: `Mine • ${autoZone.name}`,
                            text: [
                                t('SUCCESS_TEXT', { action: actionLine, amount: res.amount, coin }),
                                balanceLine,
                                materialLines ? `\n${t('MATERIALS_HEADER')}\n${materialLines}` : '',
                            ].filter(Boolean).join('\n'),
                        })
                    )
                );
            }

            // Default: minijuego
            return message.reply(buildMinePlayMessageOptions({ userId, zoneId: autoZone.id, lang }));

            const cooldownMs = 45 * 1000;
            const requiredId = String(autoZone?.requiredItemId || '');
            const isExplosive = requiredId.includes('dinamita');
            const activity = pickMineActivity(autoZone);
            const baseRange = isExplosive ? { min: 60, max: 140 } : { min: 30, max: 75 };
            const scaled = scaleRange(baseRange.min, baseRange.max, activity?.multiplier || 1);
            const cd = claimRateLimit({ userId, key: 'mine', windowMs: 35 * 1000, maxHits: 3 });

            if (!cd.ok && cd.reason === 'cooldown') {
                if (!shouldShowCooldownNotice({ userId, key: 'mine' })) {
                    await message.react('⏳').catch(() => null);
                    return;
                }
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: '⏳',
                            title: 'Mine • Cooldown',
                            text: `Aún estás cansad@ de minar. Vuelve en **${formatDuration(cd.nextInMs)}**.`,
                        })
                    )
                );
            }

            if (!cd.ok) {
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: '⚠️',
                            title: 'Mine',
                            text: cd.message || 'No pude procesar tu minería ahora mismo.',
                        })
                    )
                );
            }

            const actionLine = activity?.phrase || 'Has minado';
            const coin = (EMOJIS.coin || '🪙');

            // Fallo: consume cooldown pero no da recompensa
            if (chance(MINE_FAIL_CHANCE)) {
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: autoZone.emoji || '⛏️',
                            title: `Mine • ${autoZone.name}`,
                            text: `${actionLine}... pero hoy no has encontrado nada útil.`,
                        })
                    )
                );
            }

            const amount = randInt(scaled.min, scaled.max);
            const res = await awardBalance({ userId, amount });

            if (!res.ok && res.reason === 'cooldown') {
                if (!shouldShowCooldownNotice({ userId, key: 'mine' })) {
                    await message.react('⏳').catch(() => null);
                    return;
                }
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: '⏳',
                            title: 'Mine • Cooldown',
                            text: `Aún estás cansad@ de minar. Vuelve en **${formatDuration(res.nextInMs)}**.`,
                        })
                    )
                );
            }

            if (!res.ok) {
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: '⚠️',
                            title: 'Mine',
                            text: res.message || 'No pude procesar tu minería ahora mismo.',
                        })
                    )
                );
            }

            // Materiales: recargar doc para no pisar el balance/cooldown.
            const drops = rollMineMaterials(autoZone, activity);
            if (drops.length) {
                const ecoAfter = await getOrCreateEconomy(userId);
                addManyToInventory(ecoAfter, drops);
                await ecoAfter.save();
            }
            const balanceLine = Number.isFinite(res?.balance) ? `Saldo: **${res.balance}** ${coin}` : '';

            const materialLines = drops
                .map(d => {
                    const it = getItemById(d.itemId);
                    const name = it?.name || d.itemId;
                    return `+${d.amount} ${name}`;
                })
                .join('\n');

            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: autoZone.emoji || '⛏️',
                        title: `Mine • ${autoZone.name}`,
                        text: [
                            `${actionLine} y ganaste **${res.amount}** ${coin}. ¡Buen golpe! ⛏️`,
                            balanceLine,
                            materialLines ? `\nMateriales:\n${materialLines}` : '',
                        ].filter(Boolean).join('\n'),
                    })
                )
            );
        }

        // Acción: `.mine <zona>`
        if (sub) {
            const zone = resolveMineZone(sub);
            if (!zone) {
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: '⛏️',
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

            // Para zonas explícitas, usamos minijuego por defecto.
            return message.reply(buildMinePlayMessageOptions({ userId, zoneId: zone.id, lang }));

            const cooldownMs = 45 * 1000;
            const requiredId = String(zone?.requiredItemId || '');
            const isExplosive = requiredId.includes('dinamita');
            const activity = pickMineActivity(zone);
            const baseRange = isExplosive ? { min: 60, max: 140 } : { min: 30, max: 75 };
            const scaled = scaleRange(baseRange.min, baseRange.max, activity?.multiplier || 1);
            const cd = claimRateLimit({ userId, key: 'mine', windowMs: 35 * 1000, maxHits: 3 });

            if (!cd.ok && cd.reason === 'cooldown') {
                if (!shouldShowCooldownNotice({ userId, key: 'mine' })) {
                    await message.react('⏳').catch(() => null);
                    return;
                }
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: '⏳',
                            title: 'Mine • Cooldown',
                            text: `Aún estás cansad@ de minar. Vuelve en **${formatDuration(cd.nextInMs)}**.`,
                        })
                    )
                );
            }

            if (!cd.ok) {
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: '⚠️',
                            title: 'Mine',
                            text: cd.message || 'No pude procesar tu minería ahora mismo.',
                        })
                    )
                );
            }

            const actionLine = activity?.phrase || 'Has minado';
            const coin = (EMOJIS.coin || '🪙');

            if (chance(MINE_FAIL_CHANCE)) {
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: zone.emoji || '⛏️',
                            title: `Mine • ${zone.name}`,
                            text: `${actionLine}... pero no has encontrado nada útil esta vez.`,
                        })
                    )
                );
            }

            const amount = randInt(scaled.min, scaled.max);
            const res = await awardBalance({ userId, amount });

            if (!res.ok && res.reason === 'cooldown') {
                if (!shouldShowCooldownNotice({ userId, key: 'mine' })) {
                    await message.react('⏳').catch(() => null);
                    return;
                }
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: '⏳',
                            title: 'Mine • Cooldown',
                            text: `Aún estás cansad@ de minar. Vuelve en **${formatDuration(res.nextInMs)}**.`,
                        })
                    )
                );
            }

            if (!res.ok) {
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: '⚠️',
                            title: 'Mine',
                            text: res.message || 'No pude procesar tu minería ahora mismo.',
                        })
                    )
                );
            }

            const drops = rollMineMaterials(zone, activity);
            if (drops.length) {
                const ecoAfter = await getOrCreateEconomy(userId);
                addManyToInventory(ecoAfter, drops);
                await ecoAfter.save();
            }
            const balanceLine = Number.isFinite(res?.balance) ? `Saldo: **${res.balance}** ${coin}` : '';

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
                        emoji: zone.emoji || '⛏️',
                        title: `Mine • ${zone.name}`,
                        text: [
                            `${actionLine} y ganaste **${res.amount}** ${coin}. ¡Buen golpe! ⛏️`,
                            balanceLine,
                            materialLines ? `\nMateriales:\n${materialLines}` : '',
                        ].filter(Boolean).join('\n'),
                    })
                )
            );
        }

        return message.reply(buildZonesMessageOptions({ lang, userId: message.author?.id, kind: 'mine', page: 0 }));
    },
};
