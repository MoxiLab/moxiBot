const { MessageFlags } = require('discord.js');
const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');
const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { transferBalance, transferInventoryItem } = require('../../Util/economyCore');
const { resolveItemFromInput } = require('../../Util/useItem');
const { getItemById } = require('../../Util/inventoryCatalog');
const { getSlashCommandDescription } = require('../../Util/slashHelpI18n');

const { description, localizations } = getSlashCommandDescription('gift');

function formatInt(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return '0';
    return Math.trunc(x).toLocaleString('en-US');
}

module.exports = {
    cooldown: 0,
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
    },
    data: new SlashCommandBuilder()
        .setName('gift')
        .setDescription(description)
        .setDescriptionLocalizations(localizations)
        .addSubcommand((sub) =>
            sub
                .setName('coins')
                .setDescription('Regala coins a un usuario')
                .addUserOption((opt) =>
                    opt
                        .setName('usuario')
                        .setDescription('Usuario que recibirá las coins')
                        .setRequired(true)
                )
                .addIntegerOption((opt) =>
                    opt
                        .setName('cantidad')
                        .setDescription('Cantidad a regalar')
                        .setRequired(true)
                        .setMinValue(1)
                )
        )
        .addSubcommand((sub) =>
            sub
                .setName('item')
                .setDescription('Regala un ítem a un usuario')
                .addUserOption((opt) =>
                    opt
                        .setName('usuario')
                        .setDescription('Usuario que recibirá el ítem')
                        .setRequired(true)
                )
                .addStringOption((opt) =>
                    opt
                        .setName('item')
                        .setDescription('ID de tienda, itemId o nombre del ítem')
                        .setRequired(true)
                )
                .addIntegerOption((opt) =>
                    opt
                        .setName('cantidad')
                        .setDescription('Cantidad a regalar (por defecto 1)')
                        .setRequired(false)
                        .setMinValue(1)
                )
        ),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const t = (k, vars = {}) => moxi.translate(`economy/gift:${k}`, lang, vars);

        const sub = interaction.options.getSubcommand();
        const target = interaction.options.getUser('usuario', true);

        if (target.bot) {
            const payload = asV2MessageOptions(
                buildNoticeContainer({
                    emoji: EMOJIS.cross,
                    title: t('BOT_TITLE'),
                    text: t('BOT_TEXT'),
                })
            );
            return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
        }

        if (String(target.id) === String(interaction.user.id)) {
            const payload = asV2MessageOptions(
                buildNoticeContainer({
                    emoji: EMOJIS.cross,
                    title: t('SELF_TITLE'),
                    text: t('SELF_TEXT'),
                })
            );
            return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
        }

        if (sub === 'item') {
            const raw = interaction.options.getString('item', true);
            const qty = interaction.options.getInteger('cantidad', false) ?? 1;

            const shopId = /^\d+$/.test(String(raw).trim()) ? Number.parseInt(String(raw).trim(), 10) : null;
            const resolved = resolveItemFromInput({ shopId, query: shopId ? null : raw, lang });
            if (!resolved?.itemId) {
                const payload = asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('ITEM_INVALID_ITEM_TITLE'),
                        text: t('ITEM_INVALID_ITEM_TEXT', { prefix: process.env.PREFIX || '.' }),
                    })
                );
                return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
            }

            const item = getItemById(resolved.itemId, { lang });
            const displayName = item?.name || resolved.name || resolved.itemId;

            try {
                const res = await transferInventoryItem({ fromUserId: interaction.user.id, toUserId: target.id, itemId: resolved.itemId, amount: qty });

                if (!res.ok) {
                    if (res.reason === 'no-db') {
                        const payload = asV2MessageOptions(
                            buildNoticeContainer({
                                emoji: EMOJIS.cross,
                                title: t('NO_DB_TITLE'),
                                text: t('NO_DB_TEXT'),
                            })
                        );
                        return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
                    }

                    if (res.reason === 'not-owned') {
                        const payload = asV2MessageOptions(
                            buildNoticeContainer({
                                emoji: EMOJIS.cross,
                                title: t('ITEM_NOT_OWNED_TITLE'),
                                text: t('ITEM_NOT_OWNED_TEXT', { item: displayName }),
                            })
                        );
                        return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
                    }

                    if (res.reason === 'not-enough') {
                        const payload = asV2MessageOptions(
                            buildNoticeContainer({
                                emoji: EMOJIS.cross,
                                title: t('ITEM_NOT_ENOUGH_TITLE'),
                                text: t('ITEM_NOT_ENOUGH_TEXT', { amount: formatInt(qty), have: formatInt(res.have ?? 0), item: displayName }),
                            })
                        );
                        return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
                    }

                    const payload = asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: t('ERROR_TITLE'),
                            text: t('UNKNOWN_ERROR'),
                        })
                    );
                    return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
                }

                const payload = asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: '🎁',
                        title: t('ITEM_SUCCESS_TITLE'),
                        text: t('ITEM_SUCCESS_TEXT', { user: `<@${target.id}>`, amount: formatInt(res.amount), item: displayName, remaining: formatInt(res.fromRemaining) }),
                    })
                );
                return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
            } catch {
                const payload = asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('ERROR_TITLE'),
                        text: t('UNKNOWN_ERROR'),
                    })
                );
                return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
            }
        }

        // sub === 'coins'
        const amount = interaction.options.getInteger('cantidad', true);

        try {
            const res = await transferBalance({ fromUserId: interaction.user.id, toUserId: target.id, amount });

            if (!res.ok) {
                if (res.reason === 'no-db') {
                    const payload = asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: t('NO_DB_TITLE'),
                            text: t('NO_DB_TEXT'),
                        })
                    );
                    return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
                }

                if (res.reason === 'insufficient') {
                    const payload = asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: t('INSUFFICIENT_TITLE'),
                            text: t('INSUFFICIENT_TEXT', { amount: formatInt(amount), balance: formatInt(res.balance ?? 0) }),
                        })
                    );
                    return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
                }

                const payload = asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('ERROR_TITLE'),
                        text: t('UNKNOWN_ERROR'),
                    })
                );
                return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
            }

            const payload = asV2MessageOptions(
                buildNoticeContainer({
                    emoji: '🎁',
                    title: t('SUCCESS_TITLE'),
                    text: t('SUCCESS_TEXT', { user: `<@${target.id}>`, amount: formatInt(res.amount), balance: formatInt(res.fromBalance) }),
                })
            );
            return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
        } catch {
            const payload = asV2MessageOptions(
                buildNoticeContainer({
                    emoji: EMOJIS.cross,
                    title: t('ERROR_TITLE'),
                    text: t('UNKNOWN_ERROR'),
                })
            );
            return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
        }
    },
};
