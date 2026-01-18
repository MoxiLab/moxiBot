const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');

function economyCategory(lang) {
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang || 'es-ES');
}

function buildHelpText() {
    const cmd = (subName) => `/auction ${subName}`;
    return (
        'Subasta y puja por items en el mercado de subastas de Moxi.\n\n' +
        '**Puedes hacer uso de los siguientes subcomandos:**\n\n' +
        `${cmd('add')} » Subasta un item.\n` +
        `${cmd('bid')} » Puja por un item.\n` +
        `${cmd('bids')} » Mira tus pujas en subastas.\n` +
        `${cmd('cancel')} » Cancela una subasta.\n` +
        `${cmd('list')} » Mira tus items en subasta.\n` +
        `${cmd('search')} » Mira y busca en la subasta.\n` +
        `${cmd('upgrade')} » Incrementa tu limite de subastas.\n\n` +
        '✨ Moxinomía'
    );
}

module.exports = {
    cooldown: 0,
    Category: economyCategory,
    hideSubcommandsInHelp: true,
    data: new SlashCommandBuilder()
        .setName('auction')
        .setDescription('Subastas: crea, busca y puja')
        .addSubcommand((sc) => sc.setName('help').setDescription('Muestra ayuda de subastas'))
        .addSubcommand((sc) => sc.setName('add').setDescription('Subasta un item (proximamente)'))
        .addSubcommand((sc) => sc.setName('bid').setDescription('Puja por un item (proximamente)'))
        .addSubcommand((sc) => sc.setName('bids').setDescription('Mira tus pujas (proximamente)'))
        .addSubcommand((sc) => sc.setName('cancel').setDescription('Cancela una subasta (proximamente)'))
        .addSubcommand((sc) => sc.setName('list').setDescription('Mira tus items en subasta (proximamente)'))
        .addSubcommand((sc) => sc.setName('search').setDescription('Busca en subastas (proximamente)'))
        .addSubcommand((sc) => sc.setName('upgrade').setDescription('Mejora tu limite (proximamente)')),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        // Si el comando aún está registrado sin subcomandos en Discord,
        // getSubcommand() lanzará error. Con required=false devolvemos null.
        const sub = interaction.options.getSubcommand(false) || 'help';

        if (sub === 'help') {
            return await interaction.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.package,
                        title: 'Subasta de Moxi',
                        text: buildHelpText(),
                    })
                )
            );
        }

        // Subcomandos (por ahora WIP) siguiendo el estilo de /shop
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        return await interaction.editReply(
            asV2MessageOptions(
                buildNoticeContainer({
                    emoji: EMOJIS.info,
                    title: `Auction • ${sub}`,
                    text: 'Este subcomando está en construcción.\nUsa /auction help para ver los subcomandos.',
                })
            )
        );
    },
};
