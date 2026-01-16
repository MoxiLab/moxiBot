const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { getItemById } = require('../../Util/inventoryCatalog');
const { claimCooldown, formatDuration, getOrCreateEconomy } = require('../../Util/economyCore');
const { buildZonesMessageOptions } = require('../../Util/zonesView');
const { getZonesForKind } = require('../../Util/zonesView');
const { hasInventoryItem } = require('../../Util/fishView');

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
    cooldown: 3,
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

        const sub = String(args?.[0] || '').trim().toLowerCase();
        if (sub === 'zones' || sub === 'zonas') {
            const page = parsePageArgToIndex(args?.[1]);
            return message.reply(buildZonesMessageOptions({ lang, userId: message.author?.id, kind: 'mine', page }));
        }

        // UX: permitir `.mine 2` como alias de `.mine zones 2`
        if (/^\d+$/.test(sub)) {
            return message.reply(buildZonesMessageOptions({ lang, userId: message.author?.id, kind: 'mine', page: parsePageArgToIndex(sub) }));
        }

        const userId = message.author?.id;
        const eco = await getOrCreateEconomy(userId);

        // Si no pasan args, mina directamente en la mejor zona que puedas usar.
        if (!sub) {
            const autoZone = pickBestUsableMineZone(eco);
            if (!autoZone) {
                const required = getItemById('herramientas/pico-prisma');
                const requiredName = required?.name || 'herramientas/pico-prisma';
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: '⛔',
                            title: 'Mine • Requisito',
                            text: [
                                `Para empezar a minar necesitas: **${requiredName}**`,
                                'Cuando lo tengas, usa `.mine` y minaré automáticamente.',
                                '',
                                `Zonas: \`${prefix}mine zones\``,
                            ].join('\n'),
                        })
                    )
                );
            }

            const cooldownMs = 420 * 1000;
            const res = await claimCooldown({
                userId,
                field: 'lastMine',
                cooldownMs,
            });

            if (!res.ok && res.reason === 'cooldown') {
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

            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: autoZone.emoji || '⛏️',
                        title: `Mine • ${autoZone.name}`,
                        text: 'Has minado. ¡Buen golpe! ⛏️',
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
                            title: 'Mine',
                            text: [
                                `No encuentro la zona **${sub}**.`,
                                `Usa \`${prefix}mine zones\` para ver el panel con botones.`,
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
                            title: 'Mine • Requisito',
                            text: [
                                `Para minar en **${zone.name}** necesitas: **${requiredName}**`,
                                `ID: \`${zone.requiredItemId}\``,
                                '',
                                `Tip: revisa tus zonas con \`${prefix}mine zones\`.`,
                            ].join('\n'),
                        })
                    )
                );
            }

            const cooldownMs = 420 * 1000;
            const res = await claimCooldown({
                userId,
                field: 'lastMine',
                cooldownMs,
            });

            if (!res.ok && res.reason === 'cooldown') {
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

            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: zone.emoji || '⛏️',
                        title: `Mine • ${zone.name}`,
                        text: 'Has minado. ¡Buen golpe! ⛏️',
                    })
                )
            );
        }

        return message.reply(buildZonesMessageOptions({ lang, userId: message.author?.id, kind: 'mine', page: 0 }));
    },
};
