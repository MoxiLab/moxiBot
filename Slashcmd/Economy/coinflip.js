const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { economyCategory } = require('../../Util/commandCategories');

module.exports = {
    cooldown: 0,
    Category: economyCategory,
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Lanza una moneda (cara o cruz)')
        .setDMPermission(true),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const isHeads = Math.random() < 0.5;
        const result = isHeads
            ? (moxi.translate('FUN_COINFLIP_HEADS', lang) || 'Cara')
            : (moxi.translate('FUN_COINFLIP_TAILS', lang) || 'Cruz');

        return interaction.reply({
            ...asV2MessageOptions(
                buildNoticeContainer({
                    emoji: '🪙',
                    title: moxi.translate('FUN_COINFLIP_TITLE', lang) || 'Coinflip',
                    text: moxi.translate('FUN_COINFLIP_RESULT', lang, { result }) || result,
                })
            ),
            flags: MessageFlags.IsComponentsV2,
        });
    },
};
