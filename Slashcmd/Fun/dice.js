const { ChatInputCommandBuilder: SlashCommandBuilder, InteractionContextType, ApplicationIntegrationType } = require('discord.js');
const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { funCategory } = require('../../Util/commandCategories');

module.exports = {
    cooldown: 0,
    Category: funCategory,
    data: new SlashCommandBuilder()
        .setName('dice')
        .setDescription('Tira un dado')
        .addIntegerOptions(opt =>
            opt
                .setName('lados')
                .setDescription('Número de lados (2-100)')
                .setMinValue(2)
                .setMaxValue(100)
                .setRequired(false)
        )
        .setContexts(InteractionContextType.Guild, InteractionContextType.BotDM, InteractionContextType.PrivateChannel)
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall, ApplicationIntegrationType.UserInstall),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const sides = interaction.options.getInteger('lados') || 6;
        const roll = 1 + Math.floor(Math.random() * sides);

        return interaction.reply({
            ...asV2MessageOptions(
                buildNoticeContainer({
                    emoji: '🎲',
                    title: moxi.translate('FUN_DICE_TITLE', lang) || 'Dado',
                    text: moxi.translate('FUN_DICE_RESULT', lang, { roll, sides }) || `Resultado: ${roll}/${sides}`,
                })
            ),
        });
    },
};
