const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { buildShopData } = require('../../Util/shopView');
const { resolveItemFromInput } = require('../../Util/useItem');
const { BANK_UPGRADE_ITEM_ID, getBankUpgradeTotalCost, getBankInfo, formatInt } = require('../../Util/bankSystem');
const { getSlashCommandDescription } = require('../../Util/slashHelpI18n');

const { description, localizations } = getSlashCommandDescription('buy');

module.exports = {
    cooldown: 0,
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
    },
    data: new SlashCommandBuilder()
        .setName('buy')
        .setDescription(description)
        .setDescriptionLocalizations(localizations)
        .addStringOption((opt) =>
            opt
                .setName('item')
                .setDescription('Nombre o itemId (ej: "Hacha elemental" o "herramientas/hacha-elemental")')
                .setRequired(false)
        )
        .addIntegerOption((opt) =>
            opt
                .setName('id')
                .setDescription('ID del ítem (se ve en /shop list)')
                .setRequired(false)
                .setMinValue(1)
        )
        .addIntegerOption((opt) =>
            opt
                .setName('cantidad')
                .setDescription('Cantidad a comprar')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(100)
        ),

    async run(Moxi, interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const t = (k, vars = {}) => moxi.translate(`economy/buy:${k}`, lang, vars);

        const rawItem = interaction.options.getString('item');
        const id = interaction.options.getInteger('id');
        const amount = interaction.options.getInteger('cantidad') || 1;
        const safeAmount = Math.min(100, Math.max(1, Number(amount) || 1));

        if (!rawItem && !id) {
            return await interaction.editReply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('SHOP_TITLE'),
                        text: t('ITEM_NOT_SPECIFIED_TEXT'),
                    })
                )
            );
        }

        const { byShopId, byItemId } = buildShopData({ lang });
        let item = null;

        if (Number.isInteger(id) && id > 0) {
            item = byShopId.get(id) || null;
        } else {
            const resolved = resolveItemFromInput({ query: rawItem, lang });
            if (resolved?.shopId) {
                item = byShopId.get(resolved.shopId) || null;
            } else if (resolved?.itemId) {
                item = byItemId.get(resolved.itemId) || null;
            }
        }

        if (!item) {
            return await interaction.editReply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('SHOP_TITLE'),
                        text: Number.isInteger(id) && id > 0
                            ? t('NOT_FOUND_BY_ID', { id })
                            : t('NOT_FOUND_GENERIC'),
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
        const cost = item.itemId === BANK_UPGRADE_ITEM_ID
            ? getBankUpgradeTotalCost(eco?.bankLevel, safeAmount)
            : (price * safeAmount);

        if (cost <= 0) {
            return await interaction.editReply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('SHOP_TITLE'),
                        text: t('INVALID_PRICE'),
                    })
                )
            );
        }

        if ((eco.balance || 0) < cost) {
            return await interaction.editReply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('INSUFFICIENT_FUNDS_TITLE'),
                        text: t('INSUFFICIENT_FUNDS', { cost, balance: eco.balance || 0 }),
                    })
                )
            );
        }

        // Compra especial: mejora del banco (se aplica al momento)
        if (item.itemId === BANK_UPGRADE_ITEM_ID) {
            eco.balance = (eco.balance || 0) - cost;
            eco.bankLevel = Math.max(0, (Number(eco.bankLevel) || 0) + safeAmount);
            await eco.save();

            const info = getBankInfo(eco);
            return await interaction.editReply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.check,
                        title: t('PURCHASE_SUCCESS_TITLE'),
                        text:
                            `${t('PURCHASE_SUCCESS', { amount: safeAmount, name: item.name, cost })}` +
                            `\n\n🏦 Banco: **Lv ${formatInt(info.level)}** — Capacidad: **${formatInt(info.capacity)}**`,
                    })
                )
            );
        }

        const inv = Array.isArray(eco.inventory) ? eco.inventory : [];
        const existing = inv.find((x) => x && x.itemId === item.itemId);
        if (existing) {
            existing.amount = (existing.amount || 0) + safeAmount;
        } else {
            inv.push({ itemId: item.itemId, amount: safeAmount, obtainedAt: new Date() });
        }

        eco.inventory = inv;
        eco.balance = (eco.balance || 0) - cost;
        await eco.save();

        return await interaction.editReply(
            asV2MessageOptions(
                buildNoticeContainer({
                    emoji: EMOJIS.check,
                    title: t('PURCHASE_SUCCESS_TITLE'),
                    text: t('PURCHASE_SUCCESS', { amount: safeAmount, name: item.name, cost }),
                })
            )
        );
    },
};
