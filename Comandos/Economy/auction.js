const moxi = require('../../i18n');
const { Bot } = require('../../Config');
const { EMOJIS } = require('../../Util/emojis');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');

const { economyCategory } = require('../../Util/commandCategories');

function formatUsage(prefix, commandName, rest = '') {
    const p = String(prefix || '').trim();
    const cmd = String(commandName || '').trim();
    const tail = String(rest || '').trim();
    if (!p) return tail ? `${cmd} ${tail}` : cmd;

    const isMention = /^<@!?\d+>$/.test(p);
    const isWordPrefix = /^[A-Za-z0-9_]+$/.test(p);
    const base = (isMention || isWordPrefix) ? `${p} ${cmd}` : `${p}${cmd}`;
    return tail ? `${base} ${tail}` : base;
}

module.exports = {
    name: 'auction',
    alias: ['subasta', 'subastas'],
    Category: economyCategory,
    usage: 'auction [subcomando]',
    description: 'commands:CMD_AUCTION_DESC',
    helpText: (lang) => moxi.translate('economy/auction:HELP_TEXT', lang, { prefix: process.env.PREFIX || '.' }),
    examples: ['auction', 'auction list', 'auction search', 'auction add', 'auction bid'],
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message, args) {
        const guildId = message.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const t = (k, vars = {}) => moxi.translate(`economy/auction:${k}`, lang, vars);

        const globalPrefix = (Array.isArray(Bot?.Prefix) && Bot.Prefix[0])
            ? Bot.Prefix[0]
            : (process.env.PREFIX || '.');
        const prefix = await moxi.guildPrefix(guildId, globalPrefix);

        const sub = (args?.[0] ? String(args[0]).trim().toLowerCase() : '');
        const knownSubs = new Set(['add', 'bid', 'bids', 'cancel', 'list', 'search', 'upgrade']);

        const renderHelp = () => {
            const cmd = (subName) => `\`${formatUsage(prefix, 'auction', subName)}\``;
            const text =
                `${t('INTRO')} 🤖\n\n` +
                `${t('SUBCOMMANDS_HEADER')}\n\n` +
                `${cmd('add')} » ${t('SUB_ADD')}\n` +
                `${cmd('bid')} » ${t('SUB_BID')}\n` +
                `${cmd('bids')} » ${t('SUB_BIDS')}\n` +
                `${cmd('cancel')} » ${t('SUB_CANCEL')}\n` +
                `${cmd('list')} » ${t('SUB_LIST')}\n` +
                `${cmd('search')} » ${t('SUB_SEARCH')}\n` +
                `${cmd('upgrade')} » ${t('SUB_UPGRADE')}\n\n` +
                `${t('FOOTER')}`;

            return asV2MessageOptions(
                buildNoticeContainer({
                    emoji: EMOJIS.package || '🎁',
                    title: t('TITLE'),
                    text,
                })
            );
        };

        // Si no hay subcomando o piden ayuda, mostrar el panel como en la captura.
        if (!sub || sub === 'help' || sub === 'ayuda') {
            return message.reply({
                ...renderHelp(),
                allowedMentions: { repliedUser: false },
            });
        }

        // Subcomandos listados: de momento solo placeholder con guía.
        if (knownSubs.has(sub)) {
            const usage = `\`${formatUsage(prefix, 'auction', sub)}\``;
            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: '🚧',
                        title: t('WIP_TITLE', { sub }),
                        text: t('WIP_TEXT_PREFIX', { usage }),
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        // Subcomando desconocido → mostrar ayuda
        return message.reply({
            ...renderHelp(),
            allowedMentions: { repliedUser: false },
        });
    },
};
