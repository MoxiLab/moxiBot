const { MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { buildAfkContainer } = require('../../Util/afkRender');
const { getRandomNekosGif } = require('../../Util/nekosApi');
const { resolveItemFromInput, consumeInventoryItem } = require('../../Util/useItem');

function economyCategory(lang) {
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang || 'es-ES');
}

function parsePositiveInt(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    const x = Math.trunc(n);
    return x > 0 ? x : null;
}

async function resolveUseGif() {
    const override = process.env.USE_ITEM_GIF_URL;
    if (override) return override;

    const category = (process.env.NEKOS_USE_CATEGORIES || 'feed')
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)[0] || 'feed';

    const url = await getRandomNekosGif(category);
    return url || process.env.AFK_FALLBACK_GIF_URL || null;
}

module.exports = {
    name: 'use',
    alias: ['usar', 'consumir'],
    Category: economyCategory,
    usage: 'use <id|nombre> [cantidad]',
    description: 'Usa (consume) un ítem de tu mochila.',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message, args) {
        const guildId = message.guildId || message.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const raw = args?.length ? args.join(' ').trim() : '';
        if (!raw) {
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Uso incorrecto',
                        text: 'Debes escribir el nombre o id del item que quieres usar.',
                    })
                )
            );
        }

        const first = args?.[0];
        const second = args?.[1];

        const shopId = parsePositiveInt(first);
        const amount = parsePositiveInt(second) || 1;

        const query = shopId ? null : raw;

        const resolved = resolveItemFromInput({ shopId: shopId || null, query });
        if (!resolved) {
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Ítem no encontrado',
                        text: 'No encontré ese ítem. Usa .bag para ver tu inventario o .shop list para ver IDs.',
                    })
                )
            );
        }

        try {
            const { consumed, remaining } = await consumeInventoryItem({
                userId: message.author.id,
                itemId: resolved.itemId,
                amount,
            });

            const gifUrl = await resolveUseGif();
            const lines = [
                `**${message.author.username}** usó **${consumed}x ${resolved.name}**`,
                `Te quedan: **${remaining}**`,
                resolved.shopId ? `ID: **${resolved.shopId}**` : '',
            ].filter(Boolean);

            const container = buildAfkContainer({
                title: '✅ Ítem usado',
                lines,
                gifUrl,
                gifLabel: resolved.description ? resolved.description.slice(0, 80) : '',
            });

            return message.reply({
                content: '',
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { repliedUser: false },
            });
        } catch (err) {
            if (err && err.code === 'NOT_OWNED') {
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: 'No disponible',
                            text: `No tienes **${resolved.name}** en tu mochila.`,
                        })
                    )
                );
            }
            if (err && err.code === 'NOT_ENOUGH') {
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: 'Cantidad inválida',
                            text: `No tienes suficiente cantidad. Tienes ${err.have} y pediste ${err.wanted}.`,
                        })
                    )
                );
            }

            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Error',
                        text: 'No pude usar ese ítem ahora mismo. Inténtalo de nuevo.',
                    })
                )
            );
        }
    },
};
