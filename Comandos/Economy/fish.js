const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { getItemById } = require('../../Util/inventoryCatalog');
const { claimCooldown, awardBalance, formatDuration, getOrCreateEconomy } = require('../../Util/economyCore');
const { pickFishActivity } = require('../../Util/fishActivities');
const { addManyToInventory } = require('../../Util/inventoryOps');
const { rollFishMaterials } = require('../../Util/fishLoot');
const { scaleRange, randInt, chance } = require('../../Util/activityUtils');
const { buildFishPlayMessageOptions } = require('../../Util/fishPlay');
const {
    hasInventoryItem,
} = require('../../Util/fishView');
const { buildZonesMessageOptions, getZonesForKind } = require('../../Util/zonesView');

const FISH_FAIL_CHANCE = 0.22;

function economyCategory(lang) {
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang || 'es-ES');
}

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

function buildFishHelpText(prefix) {
    const p = String(prefix || '.');
    return [
        '¡Vamos a pescar! 🎣',
        'Explora diferentes zonas para encontrar peces raros y tesoros nya.',
        'Cada zona necesita una herramienta específica.',
        '',
        `Empieza aquí: \`${p}fish zones\``,
    ].join('\n');
}

module.exports = {
    name: 'fish',
    alias: ['pescar', 'fishing'],
    Category: economyCategory,
    usage: 'fish [zona|nivel] | fish zones',
    description: '¡Vamos a pescar! Explora zonas para encontrar peces raros y tesoros.',
    // cooldown base (normal)
    cooldown: 120,
    // Para que el help se vea como tu captura
    helpText: buildFishHelpText('.'),
    examples: ['fish zones', 'fish zones 2', 'fish muelle-moxi', 'fish bahia-sakura', 'fish ruinas-sumergidas'],
    cooldownTiers: {
        normal: 120,
        normalHaste: 60,
        premium: 96,
        premiumHaste: 48,
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

        // Actualiza el texto del help para que use el prefijo real del server
        if (typeof this.helpText === 'string' && this.helpText.includes('fish zones')) {
            // no-op (compat)
        }

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
                            title: 'Fish • Requisito',
                            text: [
                                `Para empezar a pescar necesitas: **${requiredName}**`,
                                'Cuando la tengas, usa `.fish` y podrás jugar con botones.',
                                `Si quieres el modo instantáneo: \`${prefix}fish auto\``,
                                '',
                                `Zonas: \`${prefix}fish zones\``,
                            ].join('\n'),
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
                                emoji: autoZone.emoji || '🎣',
                                title: `Fish • ${autoZone.name}`,
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
                                `${actionLine} y ganaste **${res.amount}** 🪙. ¡Buen lance! 🎣`,
                                balanceLine,
                                materialLines ? `\nMateriales:\n${materialLines}` : '',
                            ].filter(Boolean).join('\n'),
                        })
                    )
                );
            }

            // Default: minijuego
            return message.reply(buildFishPlayMessageOptions({ userId, zoneId: autoZone.id }));

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
                        title: 'Fish',
                        text: [
                            `No encuentro la zona **${sub}**.`,
                            `Usa \`${prefix}fish zones\` para ver el panel con botones.`,
                        ].join('\n'),
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
                        title: 'Fish • Requisito',
                        text: [
                            `Para pescar en **${zone.name}** necesitas: **${requiredName}**`,
                            '',
                            `Tip: revisa tus zonas con \`${prefix}fish zones\`.`,
                        ].join('\n'),
                    })
                )
            );
        }

        // Para zonas explícitas, también usamos minijuego por defecto.
        return message.reply(buildFishPlayMessageOptions({ userId, zoneId: zone.id }));

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
