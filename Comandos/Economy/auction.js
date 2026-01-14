const moxi = require('../../i18n');
const { Bot } = require('../../Config');
const { EMOJIS } = require('../../Util/emojis');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');

function economyCategory(lang) {
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang || 'es-ES');
}

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
    description: 'Subasta y puja por items en el mercado de subastas.',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message, args) {
        const guildId = message.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const globalPrefix = (Array.isArray(Bot?.Prefix) && Bot.Prefix[0])
            ? Bot.Prefix[0]
            : (process.env.PREFIX || '.');
        const prefix = await moxi.guildPrefix(guildId, globalPrefix);

        const sub = (args?.[0] ? String(args[0]).trim().toLowerCase() : '');
        const knownSubs = new Set(['add', 'bid', 'bids', 'cancel', 'list', 'search', 'upgrade']);

        const renderHelp = () => {
            const cmd = (subName) => `\`${formatUsage(prefix, 'auction', subName)}\``;
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
                        title: `Auction • ${sub}`,
                        text: `Este subcomando está en construcción.\nUso: ${usage}`,
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
