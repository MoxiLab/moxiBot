
const { SlashCommandBuilder } = require('discord.js');
const getHelpContent = require('../../Util/getHelpContent');
const moxi = require('../../i18n');
const logger = require('../../Util/logger');
const debugHelper = require('../../Util/debugHelper');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');

module.exports = {
    cooldown: 0,
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_HERRAMIENTAS', lang);
    },
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Muestra la lista de comandos disponibles y su uso'),

    async run(Moxi, interaction) {
        let guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const userId = interaction.user?.id || interaction.member?.user?.id;
        const help = await getHelpContent({ client: Moxi, lang, userId, guildId, useV2: true });

        const isV2 = Boolean(help && help.flags);
        const embedsCount = Array.isArray(help?.embeds) ? help.embeds.length : 0;
        const componentsCount = Array.isArray(help?.components) ? help.components.length : 0;
        debugHelper.log('help', `/help run lang=${lang} guildId=${guildId || 'n/a'} userId=${userId || 'n/a'} isV2=${isV2} embeds=${embedsCount} components=${componentsCount}`);

        if (!help || (!help.content && (!help.embeds || help.embeds.length === 0) && (!help.components || help.components.length === 0))) {
            return await interaction.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: moxi.translate('HELP_TITLE', lang) || 'Help',
                        text: moxi.translate('HELP_NO_CONTENT', lang) || 'No hay información de ayuda disponible.',
                    })
                ),
                ephemeral: true,
            });
        }
        await interaction.reply(help);
    },

    async messageRun(Moxi, message, args) {
        let guildId = message.guildId || message.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const userId = message.author?.id;
        const help = await getHelpContent({ client: Moxi, lang, userId, guildId, useV2: true });

        const isV2 = Boolean(help && help.flags);
        const embedsCount = Array.isArray(help?.embeds) ? help.embeds.length : 0;
        const componentsCount = Array.isArray(help?.components) ? help.components.length : 0;
        const handlerName = (typeof module.exports.messageRun === 'function') ? 'messageRun' : (typeof module.exports.execute === 'function' ? 'execute' : 'unknown');
        debugHelper.log('help', `!help ${handlerName} lang=${lang} guildId=${guildId || 'n/a'} userId=${userId || 'n/a'} isV2=${isV2} embeds=${embedsCount} components=${componentsCount}`);

        if (!help || (!help.content && (!help.embeds || help.embeds.length === 0) && (!help.components || help.components.length === 0))) {
            return await message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: moxi.translate('HELP_TITLE', lang) || 'Help',
                        text: moxi.translate('HELP_NO_CONTENT', lang) || 'No hay información de ayuda disponible.',
                    })
                )
            );
        }
        await message.reply(help);
    }
};

module.exports.execute = module.exports.messageRun;

