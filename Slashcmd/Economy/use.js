const { SlashCommandBuilder } = require('discord.js');
const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { buildAfkContainer } = require('../../Util/afkRender');
const { getRandomNekosGif } = require('../../Util/nekosApi');
const { resolveItemFromInput, consumeInventoryItem } = require('../../Util/useItem');

function economyCategory(lang) {
    lang = lang || 'es-ES';
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
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
    cooldown: 0,
    Category: economyCategory,
    data: new SlashCommandBuilder()
        .setName('use')
        .setDescription('Usa (consume) un ítem de tu mochila')
        .addIntegerOption((opt) =>
            opt
                .setName('id')
                .setDescription('ID del ítem (se ve en /bag y /shop list)')
                .setRequired(false)
                .setMinValue(1)
        )
        .addStringOption((opt) =>
            opt
                .setName('item')
                .setDescription('Nombre o itemId del ítem (alternativa a id)')
                .setRequired(false)
        )
        .addIntegerOption((opt) =>
            opt
                .setName('cantidad')
                .setDescription('Cantidad a usar (por defecto: 1)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(100)
        ),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const shopId = interaction.options.getInteger('id');
        const rawItem = interaction.options.getString('item');
        const amount = interaction.options.getInteger('cantidad') || 1;

        if (!shopId && !rawItem) {
            return interaction.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Uso incorrecto',
                        text: 'Debes escribir el nombre o id del item que quieres usar.',
                    })
                )
            );
        }

        const resolved = resolveItemFromInput({ shopId: shopId || null, query: rawItem || null });
        if (!resolved) {
            return interaction.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Ítem no encontrado',
                        text: 'No encontré ese ítem. Usa /bag para ver tu inventario o /shop list para ver IDs.',
                    })
                )
            );
        }

        try {
            const { consumed, remaining } = await consumeInventoryItem({
                userId: interaction.user.id,
                itemId: resolved.itemId,
                amount,
            });

            const gifUrl = await resolveUseGif();
            const lines = [
                `**${interaction.user.username}** usó **${consumed}x ${resolved.name}**`,
                `Te quedan: **${remaining}**`,
                resolved.shopId ? `ID: **${resolved.shopId}**` : '',
            ].filter(Boolean);

            const container = buildAfkContainer({
                title: '✅ Ítem usado',
                lines,
                gifUrl,
                gifLabel: resolved.description ? resolved.description.slice(0, 80) : '',
            });

            return interaction.reply({
                content: '',
                components: [container],
                flags: 0,
            });
        } catch (err) {
            if (err && err.code === 'NOT_OWNED') {
                return interaction.reply(
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
                return interaction.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: 'Cantidad inválida',
                            text: `No tienes suficiente cantidad. Tienes ${err.have} y pediste ${err.wanted}.`,
                        })
                    )
                );
            }

            return interaction.reply(
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
