const { MessageFlags } = require('discord.js');
const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');
const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { getOrCreateEconomyRaw } = require('../../Util/balanceView');
const { getBankInfo, formatInt } = require('../../Util/bankSystem');
const { ButtonStyle } = require('discord.js');
const { ButtonBuilder } = require('../../Util/compatButtonBuilder');
const { getSlashCommandDescription } = require('../../Util/slashHelpI18n');

const { description, localizations } = getSlashCommandDescription('deposit');

function safeInt(n, fallback = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? Math.trunc(x) : fallback;
}

// formatInt viene de bankSystem

module.exports = {
    cooldown: 0,
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
    },
    data: new SlashCommandBuilder()
        .setName('deposit')
        .setDescription(description)
        .setDescriptionLocalizations(localizations)
        .addIntegerOption((opt) =>
            opt
                .setName('cantidad')
                .setDescription('Cantidad a depositar (si se omite, deposita todo)')
                .setRequired(false)
                .setMinValue(1)
        ),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const t = (k, vars = {}) => moxi.translate(`economy/deposit:${k}`, lang, vars);

        const amount = interaction.options.getInteger('cantidad');

        try {
            const eco = await getOrCreateEconomyRaw(interaction.user.id);
            const bal = Math.max(0, safeInt(eco?.balance, 0));
            const bank = Math.max(0, safeInt(eco?.bank, 0));
            const bankInfo = getBankInfo(eco);

            if (bal <= 0) {
                return interaction.reply({
                    ...asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.info,
                            title: t('BANK_TITLE'),
                            text: t('NO_COINS'),
                        })
                    ),
                    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
                });
            }

            const wanted = amount ? Math.max(1, safeInt(amount, 1)) : bal;

            if (wanted > bal) {
                return interaction.reply({
                    ...asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: t('INSUFFICIENT_FUNDS_TITLE'),
                            text: t('INSUFFICIENT_FUNDS_TEXT', { wanted: formatInt(wanted), balance: formatInt(bal) }),
                        })
                    ),
                    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
                });
            }

            if (bankInfo.free <= 0 || (bank + wanted) > bankInfo.capacity) {
                const container = buildNoticeContainer({
                    emoji: EMOJIS.hourglass,
                    title: 'Banco lleno',
                    text:
                        `Tu banco está al **límite**.\n` +
                        `Banco: **${formatInt(bank)} / ${formatInt(bankInfo.capacity)}** 🏦 (Lv **${formatInt(bankInfo.level)}**)\n\n` +
                        `Para aumentar la capacidad, compra **Expansión de Banco** en la tienda.\n` +
                        `Coste de la siguiente mejora: **${formatInt(bankInfo.nextCost)}** 🪙\n\n` +
                        `Compra: \`/buy item: mejoras/expansion-de-banco\``,
                });
                container.addSeparatorComponents(s => s.setDivider(true));
                container.addActionRowComponents(r => r.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`shop:home:${interaction.user.id}:upgrades`)
                        .setEmoji('🛒')
                        .setLabel('Abrir tienda (Mejoras)')
                        .setStyle(ButtonStyle.Secondary)
                ));

                const payload = asV2MessageOptions(container);
                return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
            }

            eco.balance = bal - wanted;
            eco.bank = bank + wanted;
            await eco.save();

            return interaction.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.check,
                        title: t('DEPOSIT_SUCCESS_TITLE'),
                        text: t('DEPOSIT_SUCCESS_TEXT', { wanted: formatInt(wanted), balance: formatInt(eco.balance), bank: formatInt(eco.bank) }),
                    })
                ),
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            });
        } catch (err) {
            const isMongoMissing = String(err?.message || '').toLowerCase().includes('mongodb');
            return interaction.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('ERROR_TITLE'),
                        text: isMongoMissing ? t('ERROR_MONGO') : t('ERROR_GENERIC'),
                    })
                ),
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            });
        }
    },
};
