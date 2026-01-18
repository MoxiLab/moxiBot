const { SlashCommandBuilder, PermissionsBitField, MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { buildShopData, buildShopMessage } = require('../../Util/shopView');

module.exports = {
    cooldown: 0,
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
    },
    data: new SlashCommandBuilder()
        .setName('moxishop')
        .setDescription('Tienda: lista y compra ítems')
        .addSubcommand((sc) =>
            sc
                .setName('list')
                .setDescription('Muestra la lista de ítems disponibles')
                .addStringOption((opt) =>
                    opt
                        .setName('categoria')
                        .setDescription('Filtra por categoría (opcional)')
                        .setRequired(false)
                )
                .addIntegerOption((opt) =>
                    opt
                        .setName('pagina')
                        .setDescription('Página (opcional)')
                        .setRequired(false)
                        .setMinValue(1)
                )
        )
        .addSubcommand((sc) =>
            sc
                .setName('buy')
                .setDescription('Compra un ítem por su ID de la tienda')
                .addIntegerOption((opt) =>
                    opt
                        .setName('id')
                        .setDescription('ID del ítem (se ve en /shop list)')
                        .setRequired(true)
                        .setMinValue(1)
                )
                .addIntegerOption((opt) =>
                    opt
                        .setName('cantidad')
                        .setDescription('Cantidad a comprar')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(100)
                )
        ),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const sub = interaction.options.getSubcommand();

        if (sub === 'list') {
            const rawCategoria = interaction.options.getString('categoria');
            const rawPagina = interaction.options.getInteger('pagina');
            const page = rawPagina ? Math.max(0, rawPagina - 1) : 0;

            // Resolver categoria por key/label (tolerante)
            let categoryKey = 'all';
            if (rawCategoria) {
                const { categories } = buildShopData();
                const needle = String(rawCategoria).trim().toLowerCase();
                const match = categories.find((c) =>
                    c.key === needle || c.label.toLowerCase() === needle
                );
                if (match) categoryKey = match.key;
            }

            const payload = buildShopMessage({
                userId: interaction.user.id,
                categoryKey,
                page,
            });

            return await interaction.reply(payload);
        }

        if (sub === 'buy') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const id = interaction.options.getInteger('id', true);
            const amount = interaction.options.getInteger('cantidad') || 1;

            const { byShopId } = buildShopData();
            const item = byShopId.get(id);

            if (!item) {
                return await interaction.editReply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: 'Tienda',
                            text: `No existe un ítem con ID ${id}. Usa /moxishop list para ver los IDs.`,
                        })
                    )
                );
            }

            const { Economy } = require('../../Models/EconomySchema');

            const userId = interaction.user.id;
            let eco = await Economy.findOne({ userId });
            if (!eco) {
                eco = await Economy.create({ userId, balance: 0, bank: 0, sakuras: 0 });
            }

            const price = Number.isFinite(item.price) ? item.price : 0;
            const cost = price * amount;

            if (cost <= 0) {
                return await interaction.editReply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: 'Tienda',
                            text: 'Este ítem no se puede comprar (precio inválido).',
                        })
                    )
                );
            }

            if ((eco.balance || 0) < cost) {
                return await interaction.editReply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: 'Fondos insuficientes',
                            text: `Necesitas ${cost} 🪙 y tienes ${eco.balance || 0} 🪙.`,
                        })
                    )
                );
            }

            const inv = Array.isArray(eco.inventory) ? eco.inventory : [];
            const existing = inv.find((x) => x && x.itemId === item.itemId);
            if (existing) {
                existing.amount = (existing.amount || 0) + amount;
            } else {
                inv.push({ itemId: item.itemId, amount, obtainedAt: new Date() });
            }
            eco.inventory = inv;
            eco.balance = (eco.balance || 0) - cost;
            await eco.save();

            return await interaction.editReply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.check,
                        title: 'Compra realizada',
                        text: `Compraste **${amount}x ${item.name}** por **${cost}** 🪙.`,
                    })
                )
            );
        }
    },
};
