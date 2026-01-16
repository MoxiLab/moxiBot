const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { getItemById } = require('../../Util/inventoryCatalog');
const { claimCooldown, awardBalance, formatDuration, getOrCreateEconomy } = require('../../Util/economyCore');
const { pickFishActivity } = require('../../Util/fishActivities');
const { scaleRange, randInt, chance } = require('../../Util/activityUtils');
const {
    FISH_ZONES,
    resolveFishZone,
    hasInventoryItem,
} = require('../../Util/fishView');
const { buildZonesMessageOptions } = require('../../Util/zonesView');

const FISH_FAIL_CHANCE = 0.22;

function economyCategory(lang) {
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang || 'es-ES');
}

function safeInt(n, fallback = 0) {
    const x = Number(n);
    if (!Number.isFinite(x)) return fallback;
    return Math.trunc(x);
}

function parsePageArgToIndex(pageArg) {
    const raw = String(pageArg || '').trim();
    if (!raw) return 0;
    const num = Number.parseInt(raw, 10);
    if (!Number.isFinite(num) || num <= 0) return 0;
    return num - 1;
}

function pickBestUsableZone(eco, zones) {
    const usable = (Array.isArray(zones) ? zones : []).filter(z => hasInventoryItem(eco, z.requiredItemId));
    if (!usable.length) return null;

    let bestMax = -1;
    for (const z of usable) {
        const max = safeInt(z?.reward?.max, 0);
        if (max > bestMax) bestMax = max;
    }

    const best = usable.filter(z => safeInt(z?.reward?.max, 0) === bestMax);
    return best[Math.floor(Math.random() * best.length)] || usable[0];
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
    cooldown: 300,
    // Para que el help se vea como tu captura
    helpText: buildFishHelpText('.'),
    examples: ['fish zones', 'fish zones 2', 'fish muelle-moxi', 'fish bahia-sakura', 'fish ruinas-sumergidas'],
    cooldownTiers: {
        normal: 300,
        normalHaste: 150,
        premium: 240,
        premiumHaste: 120,
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

        const userId = message.author?.id;
        const eco = await getOrCreateEconomy(userId);

        // Si no pasan args, pesca directamente en la mejor zona que puedas usar.
        if (!sub) {
            const autoZone = pickBestUsableZone(eco, FISH_ZONES);
            if (!autoZone) {
                const required = getItemById('herramientas/cana-de-pesca-moxi');
                const requiredName = required?.name || 'herramientas/cana-de-pesca-moxi';
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: '⛔',
                            title: 'Fish • Requisito',
                            text: [
                                `Para empezar a pescar necesitas: **${requiredName}**`,
                                'Cuando la tengas, usa `.fish` y pescaré automáticamente.',
                                '',
                                `Zonas: \`${prefix}fish zones\``,
                            ].join('\n'),
                        })
                    )
                );
            }

            const cooldownMs = Math.max(1, safeInt(this.cooldown, 300)) * 1000;
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

            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: autoZone.emoji || '🎣',
                        title: `Fish • ${autoZone.name}`,
                        text: [
                            `${actionLine} y ganaste **${res.amount}** 🪙. ¡Buen lance! 🎣`,
                            balanceLine,
                        ].filter(Boolean).join('\n'),
                    })
                )
            );
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
            const required = getItemById(zone.requiredItemId);
            const requiredName = required?.name || zone.requiredItemId;
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: '⛔',
                        title: 'Fish • Requisito',
                        text: [
                            `Para pescar en **${zone.name}** necesitas: **${requiredName}**`,
                            `ID: \`${zone.requiredItemId}\``,
                            '',
                            `Tip: revisa tus zonas con \`${prefix}fish zones\`.`,
                        ].join('\n'),
                    })
                )
            );
        }

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
