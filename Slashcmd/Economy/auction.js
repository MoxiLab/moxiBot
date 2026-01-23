const { ChatInputCommandBuilder: SlashCommandBuilder, MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { getSlashCommandDescription } = require('../../Util/slashHelpI18n');
const { getSlashNamespaceString } = require('../../Util/slashNamespaceI18n');

function economyCategory(lang) {
    lang = lang || 'es-ES';
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
}

function buildHelpText() {
    return '';
}

const { description, localizations } = getSlashCommandDescription('auction');
const NS = 'economy/auction';

const helpDesc = getSlashNamespaceString(NS, 'SLASH_HELP_DESC');
const addDesc = getSlashNamespaceString(NS, 'SLASH_ADD_DESC');
const bidDesc = getSlashNamespaceString(NS, 'SLASH_BID_DESC');
const bidsDesc = getSlashNamespaceString(NS, 'SLASH_BIDS_DESC');
const cancelDesc = getSlashNamespaceString(NS, 'SLASH_CANCEL_DESC');
const listDesc = getSlashNamespaceString(NS, 'SLASH_LIST_DESC');
const searchDesc = getSlashNamespaceString(NS, 'SLASH_SEARCH_DESC');
const upgradeDesc = getSlashNamespaceString(NS, 'SLASH_UPGRADE_DESC');

module.exports = {
    cooldown: 0,
    Category: economyCategory,
    hideSubcommandsInHelp: true,
    data: new SlashCommandBuilder()
        .setName('auction')
        .setDescription(description)
        .setDescriptionLocalizations(localizations)
        .addSubcommands((sc) => sc
            .setName('help')
            .setDescription(helpDesc.description)
            .setDescriptionLocalizations(helpDesc.localizations))
        .addSubcommands((sc) => sc
            .setName('add')
            .setDescription(addDesc.description)
            .setDescriptionLocalizations(addDesc.localizations))
        .addSubcommands((sc) => sc
            .setName('bid')
            .setDescription(bidDesc.description)
            .setDescriptionLocalizations(bidDesc.localizations))
        .addSubcommands((sc) => sc
            .setName('bids')
            .setDescription(bidsDesc.description)
            .setDescriptionLocalizations(bidsDesc.localizations))
        .addSubcommands((sc) => sc
            .setName('cancel')
            .setDescription(cancelDesc.description)
            .setDescriptionLocalizations(cancelDesc.localizations))
        .addSubcommands((sc) => sc
            .setName('list')
            .setDescription(listDesc.description)
            .setDescriptionLocalizations(listDesc.localizations))
        .addSubcommands((sc) => sc
            .setName('search')
            .setDescription(searchDesc.description)
            .setDescriptionLocalizations(searchDesc.localizations))
        .addSubcommands((sc) => sc
            .setName('upgrade')
            .setDescription(upgradeDesc.description)
            .setDescriptionLocalizations(upgradeDesc.localizations)),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const t = (k, vars = {}) => moxi.translate(`economy/auction:${k}`, lang, vars);

        const buildHelpTextLocalized = () => {
            const cmd = (subName) => `/auction ${subName}`;
            return (
                `${t('INTRO')}\n\n` +
                `${t('SUBCOMMANDS_HEADER')}\n\n` +
                `${cmd('add')} » ${t('SUB_ADD')}\n` +
                `${cmd('bid')} » ${t('SUB_BID')}\n` +
                `${cmd('bids')} » ${t('SUB_BIDS')}\n` +
                `${cmd('cancel')} » ${t('SUB_CANCEL')}\n` +
                `${cmd('list')} » ${t('SUB_LIST')}\n` +
                `${cmd('search')} » ${t('SUB_SEARCH')}\n` +
                `${cmd('upgrade')} » ${t('SUB_UPGRADE')}\n\n` +
                `${t('FOOTER')}`
            );
        };

        // Si el comando aún está registrado sin subcomandos en Discord,
        // getSubcommand() lanzará error. Con required=false devolvemos null.
        const sub = interaction.options.getSubcommand(false) || 'help';

        if (sub === 'help') {
            return await interaction.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.package,
                        title: t('TITLE'),
                        text: buildHelpTextLocalized(),
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
                    title: t('WIP_TITLE', { sub }),
                    text: t('WIP_TEXT_SLASH', { helpCmd: '/auction help' }),
                })
            )
        );
    },
};
