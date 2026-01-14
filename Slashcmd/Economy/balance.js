const { SlashCommandBuilder } = require('discord.js');
const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { ensureMongoConnection } = require('../../Util/mongoConnect');
const { EMOJIS } = require('../../Util/emojis');
const { getOrCreateEconomy } = require('../../Util/economyCore');

module.exports = {
    cooldown: 0,
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
    },
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Muestra tu saldo de coins'),

    async run(Moxi, interaction) {
        if (!process.env.MONGODB) {
            return interaction.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Economía',
                        text: 'MongoDB no está configurado (MONGODB vacío).',
                    })
                )
            );
        }

        await ensureMongoConnection();
        const userId = interaction.user.id;
        const eco = await getOrCreateEconomy(userId);

        const balance = Number.isFinite(eco.balance) ? eco.balance : 0;

        return interaction.reply(
            asV2MessageOptions(
                buildNoticeContainer({
                    emoji: '🪙',
                    title: 'Saldo',
                    text: `Tienes **${balance}** 🪙.`,
                })
            )
        );
    },
};
