const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { getItemById } = require('../../Util/inventoryCatalog');
const { claimCooldown, formatDuration, getOrCreateEconomy } = require('../../Util/economyCore');
const {
    FISH_ZONES,
    resolveFishZone,
    hasInventoryItem,
} = require('../../Util/fishView');
const { buildZonesMessageOptions } = require('../../Util/zonesView');

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

        // Si no pasan args, damos un resumen corto + cómo ver zonas.
        if (!sub) {
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: '🎣',
                        title: 'Fish',
                        text: [
                            'Elige una zona y pesca.',
                            `Zonas: \`${prefix}fish zones\``,
                            `Pescar: \`${prefix}fish <zona>\``,
                            '',
                            'Tip: también puedes usar **/zones** (panel con botones).',
                        ].join('\n'),
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

        const userId = message.author?.id;
        const eco = await getOrCreateEconomy(userId);

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
        const res = await claimCooldown({
            userId,
            field: 'lastFish',
            cooldownMs,
        });

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
                    text: 'Has pescado. ¡Buen lance! 🎣',
                })
            )
        );
    },
};
