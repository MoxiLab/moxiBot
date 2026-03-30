const { ContainerBuilder, MessageFlags } = require('discord.js');

const moxi = require('../../i18n');
const { Bot } = require('../../Config');
const { EMOJIS } = require('../../Util/emojis');

function isUntranslated(key, value) {
    if (value === undefined || value === null) return true;
    const out = String(value || '').trim();
    if (!out) return true;
    if (out === key) return true;
    const withoutNs = String(key).includes(':') ? String(key).split(':').pop() : String(key);
    if (out === withoutNs) return true;
    return false;
}

module.exports = {
    name: 'blacklistguide',
    alias: ['blguide', 'guia-blacklist', 'blacklist-help', 'blacklistguia'],
    usage: 'blacklistguide',
    Category: (lang = 'es-ES') => moxi.translate('commands:CATEGORY_HERRAMIENTAS', lang),
    helpCategories: ['Admin', 'Root'],
    description: (lang = 'es-ES') => {
        const key = 'misc:BLACKLIST_GUIDE_DESC';
        const out = moxi.translate(key, lang);
        return isUntranslated(key, out)
            ? 'Guía rápida para usar blacklist local (admin) y global (owner), con niveles, acciones, logs y expiración.'
            : out;
    },
    cooldown: 5,

    async execute(Moxi, message) {
        const guildId = message.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const globalPrefix = (Array.isArray(Bot?.Prefix) && Bot.Prefix[0]) ? Bot.Prefix[0] : (process.env.PREFIX || '.');
        const prefix = await moxi.guildPrefix(guildId, globalPrefix);

        const titleKey = 'misc:BLACKLIST_GUIDE_TITLE';
        const title = moxi.translate(titleKey, lang);
        const safeTitle = isUntranslated(titleKey, title) ? 'Guía de Blacklist' : title;

        const localTitle = '🛡️ Local (Administracion del servidor)';
        const globalTitle = '👑 Global (Propietario del bot)';
        const bt = '`';

        const localLines = [
            `• ${bt}${prefix}blacklist add @usuario [motivo] [nivel=1-5] [dur=1d] [actions=all]${bt}`,
            `• ${bt}${prefix}blacklist remove @usuario${bt}`,
            `• ${bt}${prefix}blacklist check @usuario${bt}`,
            `• ${bt}${prefix}blacklist list${bt}`,
            `• ${bt}${prefix}blacklist log #canal|off${bt}`,
            `• ${bt}${prefix}blacklist bypass add|remove <user|role|cmd> <valor>${bt}`,
        ];

        const globalLines = [
            `• ${bt}${prefix}gblacklist add @usuario [motivo] [nivel=1-5] [dur=1d] [actions=all]${bt}`,
            `• ${bt}${prefix}gblacklist remove @usuario${bt}`,
            `• ${bt}${prefix}gblacklist check @usuario${bt}`,
            `• ${bt}${prefix}gblacklist list [users|guilds]${bt}`,
            `• ${bt}${prefix}gblacklist guild add <id> [motivo] [nivel=1-5] [dur=1d] [actions=all]${bt}`,
            `• ${bt}${prefix}gblacklist guild remove <id>${bt}`,
            `• ${bt}${prefix}gblacklist guild check <id>${bt}`,
            `• ${bt}${prefix}gblacklist log #canal|off${bt}`,
            `• ${bt}${prefix}gblacklist bypass add|remove <user|role|cmd> <valor>${bt}`,
        ];

        const faqKey = 'misc:BLACKLIST_GUIDE_FAQ';
        const faqLabel = moxi.translate(faqKey, lang);
        const safeFaqLabel = isUntranslated(faqKey, faqLabel) ? 'Preguntas frecuentes:' : faqLabel;

        const faqItems = [
            { key: 'misc:BLACKLIST_GUIDE_FAQ_1', fallback: '• ¿Que bloquea la blacklist local? Unicamente este servidor.' },
            { key: 'misc:BLACKLIST_GUIDE_FAQ_2', fallback: '• ¿Que bloquea la blacklist global? Todos los servidores y servidores completos.' },
            { key: 'misc:BLACKLIST_GUIDE_FAQ_3', fallback: '• ¿Como configurar duracion y nivel? Use dur= (12h, 7d) y nivel= (1-5).' },
            { key: 'misc:BLACKLIST_GUIDE_FAQ_4', fallback: '• ¿Como limitar acciones? actions=all, command, message, interaction, music.' },
            { key: 'misc:BLACKLIST_GUIDE_FAQ_5', fallback: '• ¿Ejemplos de actions=? actions=command,interaction o actions=message.' },
            { key: 'misc:BLACKLIST_GUIDE_FAQ_6', fallback: '• ¿Como activar logs? Use log #canal o log off para desactivar.' },
            { key: 'misc:BLACKLIST_GUIDE_FAQ_7', fallback: '• ¿Como usar bypass? Use bypass add|remove user/role/cmd <valor>.' },
            { key: 'misc:BLACKLIST_GUIDE_FAQ_8', fallback: '• ¿Quien puede usar global? Solo el owner real del bot.' },
        ];

        const faqLines = [
            safeFaqLabel,
            ...faqItems.map(item => {
                const text = moxi.translate(item.key, lang);
                return isUntranslated(item.key, text) ? item.fallback : text;
            }),
        ];

        const container = new ContainerBuilder()
            .setAccentColor(Bot.AccentColor)
            .addTextDisplayComponents(c => c.setContent(`# ${safeTitle}`))
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(c => c.setContent(`${localTitle}\n${localLines.join('\n')}`))
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(c => c.setContent(`${globalTitle}\n${globalLines.join('\n')}`))
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(c => c.setContent(faqLines.join('\n')))
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(c => c.setContent(`${EMOJIS.copyright || '©️'} ${Moxi.user.username} • ${new Date().getFullYear()}`));

        return message.reply({
            content: '',
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { repliedUser: false },
        });
    },
};
