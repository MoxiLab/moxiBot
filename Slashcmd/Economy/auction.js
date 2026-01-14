const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');

function economyCategory(lang) {
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang || 'es-ES');
}

function renderHelp() {
    const cmd = (subName) => `\`/auction ${subName}\``;
    const text =
        'Subasta y puja por items en el mercado de subastas de Moxi. 🤖\n\n' +
        '**Puedes hacer uso de los siguientes subcomandos:**\n\n' +
        `${cmd('add')} » Subasta un item.\n` +
        `${cmd('bid')} » Puja por un item.\n` +
        `${cmd('bids')} » Mira tus pujas en subastas.\n` +
        `${cmd('cancel')} » Cancela una subasta.\n` +
        `${cmd('list')} » Mira tus items en subasta.\n` +
        `${cmd('search')} » Mira y busca en la subasta.\n` +
        `${cmd('upgrade')} » Incrementa tu límite de subastas.\n\n` +
        '✨ Moxinomía';

    return asV2MessageOptions(
        buildNoticeContainer({
            emoji: EMOJIS.package || '🎁',
            title: 'Subasta de Moxi',
            text,
        })
    );
}

module.exports = {
    cooldown: 0,
    Category: economyCategory,
    data: new SlashCommandBuilder()
        .setName('auction')
        .setDescription('Subastas: crea, busca y puja')
        .addSubcommand((sc) => sc.setName('help').setDescription('Muestra ayuda de subastas'))
        .addSubcommand((sc) => sc.setName('add').setDescription('Subasta un item (próximamente)'))
        .addSubcommand((sc) => sc.setName('bid').setDescription('Puja por un item (próximamente)'))
        .addSubcommand((sc) => sc.setName('bids').setDescription('Mira tus pujas (próximamente)'))
        .addSubcommand((sc) => sc.setName('cancel').setDescription('Cancela una subasta (próximamente)'))
        .addSubcommand((sc) => sc.setName('list').setDescription('Mira tus items en subasta (próximamente)'))
        .addSubcommand((sc) => sc.setName('search').setDescription('Busca en subastas (próximamente)'))
        .addSubcommand((sc) => sc.setName('upgrade').setDescription('Mejora tu límite (próximamente)')),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const sub = interaction.options.getSubcommand();

        if (sub === 'help') {
            return interaction.reply({
                ...renderHelp(),
                flags: MessageFlags.IsComponentsV2,
            });
        }

        // Subcomandos listados: de momento placeholder
        return interaction.reply({
            ...asV2MessageOptions(
                buildNoticeContainer({
                    emoji: '🚧',
                    title: `Auction • ${sub}`,
                    text: `Este subcomando está en construcción.\nUsa /auction help para ver los subcomandos.`,
                })
            ),
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
    },
};
