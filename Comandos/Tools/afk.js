const { MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const afkStorage = require('../../Util/afkStorage');
const { buildAfkContainer, formatAfkTimestamp } = require('../../Util/afkRender');
const { resolveAfkGif } = require('../../Util/afkGif');

const SCOPE_GLOBAL = afkStorage.SCOPE_GLOBAL;
const SCOPE_GUILD = afkStorage.SCOPE_GUILD;
const SCOPE_MAP = {
    global: SCOPE_GLOBAL,
    server: SCOPE_GUILD,
    guild: SCOPE_GUILD,
    servidor: SCOPE_GUILD,
};

module.exports = {
    name: 'afk',
    alias: ['afk', 'ausente'],
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_HERRAMIENTAS', lang);
    },
    usage: 'afk [global|server] [mensaje]',
    description: 'Setea tu estado AFK con tarjeta animada',

    async execute(Moxi, message, args) {
        const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
        const scopeArg = args?.[0]?.toLowerCase();
        let scope = SCOPE_GUILD;
        let messageArgs = args || [];
        if (scopeArg && SCOPE_MAP[scopeArg]) {
            scope = SCOPE_MAP[scopeArg];
            messageArgs = messageArgs.slice(1);
        }
        if (scope === SCOPE_GUILD && !message.guild?.id) {
            return message.reply({ content: moxi.translate('GUILD_ONLY', lang) || 'Solo disponible en servidores.' });
        }
        const rawMessage = messageArgs.join(' ');
        const defaultMessage = moxi.translate('AFK_DEFAULT_MESSAGE', lang);
        const sanitizedMessage = rawMessage.trim() ? rawMessage.trim().slice(0, 300) : defaultMessage;

        const entry = await afkStorage.setAfk({
            userId: message.author.id,
            guildId: message.guild?.id,
            message: sanitizedMessage,
            scope,
        });

        const lines = [
            moxi.translate(scope === SCOPE_GLOBAL ? 'AFK_SCOPE_GLOBAL' : 'AFK_SCOPE_GUILD', lang),
            moxi.translate('AFK_MESSAGE_LINE', lang, { message: entry.message }),
            moxi.translate('AFK_SINCE', lang, { since: formatAfkTimestamp(entry.createdAt, lang) }),
        ];

        const gifUrl = await resolveAfkGif(process.env.AFK_GIF_URL);
        const container = buildAfkContainer({
            title: moxi.translate('AFK_TITLE', lang),
            lines,
            gifUrl,
        });

        await message.reply({
            content: '',
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        });
    },
};
