const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { getOrCreateEconomyRaw } = require('../../Util/balanceView');

function safeInt(n, fallback = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? Math.trunc(x) : fallback;
}

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
        .setName('deposit')
        .setDescription('Deposita coins desde tu balance al banco')
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

        const amount = interaction.options.getInteger('cantidad');

        try {
            const eco = await getOrCreateEconomyRaw(interaction.user.id);
            const bal = Math.max(0, safeInt(eco?.balance, 0));
            const bank = Math.max(0, safeInt(eco?.bank, 0));

            if (bal <= 0) {
                return interaction.reply({
                    ...asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.info,
                            title: 'Banco',
                            text: 'No tienes coins para depositar.',
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
                            title: 'Fondos insuficientes',
                            text: `Intentaste depositar **${formatInt(wanted)}** 🪙 pero solo tienes **${formatInt(bal)}** 🪙.`,
                        })
                    ),
                    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
                });
            }

            eco.balance = bal - wanted;
            eco.bank = bank + wanted;
            await eco.save();

            return interaction.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.check,
                        title: 'Depósito realizado',
                        text: `Depositaste **${formatInt(wanted)}** 🪙.\nBalance: **${formatInt(eco.balance)}** 🪙\nBanco: **${formatInt(eco.bank)}** 🏦`,
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
                        title: 'Error',
                        text: isMongoMissing
                            ? 'MongoDB no está configurado, el banco no está disponible.'
                            : 'No pude hacer el depósito ahora mismo. Inténtalo de nuevo.',
                    })
                ),
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            });
        }
    },
};
