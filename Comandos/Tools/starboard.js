const { ContainerBuilder, MessageFlags } = require('discord.js');
const { Bot } = require('../../Config');
const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const logger = require('../../Util/logger');
const starboardStorage = require('../../Util/starboardStorage');

function buildStatusContainer(settings, lang, botName) {
    const container = new ContainerBuilder().setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(c => c.setContent(`# ${moxi.translate('STARBOARD_TITLE', lang) || 'Starboard'}`))
        .addSeparatorComponents(s => s.setDivider(true));

    const enabled = settings?.enabled ? '✅' : '❌';
    const channelId = settings?.channelID || settings?.channelId || settings?.channel;
    const channel = channelId ? `<#${channelId}>` : 'No definido';
    const emoji = settings?.emoji || '⭐';
    const threshold = settings?.threshold ?? 5;
    const keepImages = (settings?.keepImages ?? true) ? 'Sí' : 'No';
    const mentionAuthor = (settings?.mentionAuthor ?? true) ? 'Sí' : 'No';

    container.addTextDisplayComponents(c => c.setContent(`Estado: ${enabled}`));
    container.addTextDisplayComponents(c => c.setContent(`Canal: ${channel}`));
    container.addTextDisplayComponents(c => c.setContent(`Emoji: ${emoji}`));
    container.addTextDisplayComponents(c => c.setContent(`Umbral: ${threshold}`));
    container.addTextDisplayComponents(c => c.setContent(`Guardar imágenes: ${keepImages}`));
    container.addTextDisplayComponents(c => c.setContent(`Mencionar autor: ${mentionAuthor}`));
    container.addSeparatorComponents(s => s.setDivider(true));
    container.addTextDisplayComponents(c => c.setContent(`${EMOJIS.copyright} ${botName || 'Moxi'}`));

    return container;
}

function respond(message, container) {
    return message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
}

async function respondWithLatestSettings(message, guildId, lang, botName) {
    const settings = await starboardStorage.getStarboardSettings(guildId) || {};
    return respond(message, buildStatusContainer(settings, lang, botName));
}

module.exports = {
    name: 'starboard',
    alias: ['sb'],
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_HERRAMIENTAS', lang);
    },
    usage: 'starboard <canal|channel|set|emoji|umbral|activar|desactivar|status> [args]',
    description: 'Configura el starboard del servidor',

    async execute(Moxi, message, args) {
        const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
        if (!message.guild) {
            return message.reply({ content: moxi.translate('GUILD_ONLY', lang) || 'Solo disponible en servidores.' });
        }

        const sub = (args?.[0] || '').toLowerCase();
        const [, ...rest] = args || [];
        const channelMention = message.mentions.channels.first();
        const guildId = message.guild.id;
        const currentSettings = await starboardStorage.getStarboardSettings(guildId) || {};

        switch (sub) {
            case 'canal':
            case 'channel':
            case 'set':
                {
                    const rawChannelArg = rest[0];
                    const channelArg = rawChannelArg ? rawChannelArg.replace(/[<#>]/g, '').trim() : '';
                    const resolvedChannel = channelMention
                        || (channelArg ? (message.guild.channels.cache.get(channelArg) || await message.guild.channels.fetch(channelArg).catch(() => null)) : null);

                    if (!resolvedChannel) {
                        return message.reply('Menciona o proporciona el ID de un canal válido donde quieres enviar los starboards.');
                    }

                    logger.debug('starboard.canal', { guildId, channel: resolvedChannel.id });
                    await starboardStorage.updateStarboardSettings(guildId, { channelID: resolvedChannel.id, enabled: true });
                    return respondWithLatestSettings(message, guildId, lang, Moxi.user?.username);
                }
            case 'emoji': {
                const emoji = rest[0];
                if (!emoji) {
                    return message.reply('Proporciona un emoji para el starboard.');
                }
                logger.debug('starboard.emoji', { guildId, emoji });
                await starboardStorage.updateStarboardSettings(guildId, { emoji });
                return respondWithLatestSettings(message, guildId, lang, Moxi.user?.username);
            }
            case 'umbral':
            case 'threshold': {
                const amount = Number(rest[0]);
                if (!amount || amount < 1) {
                    return message.reply('Indica un número válido mayor a 0.');
                }
                logger.debug('starboard.umbral', { guildId, threshold: amount });
                await starboardStorage.updateStarboardSettings(guildId, { threshold: amount });
                return respondWithLatestSettings(message, guildId, lang, Moxi.user?.username);
            }
            case 'activar':
            case 'enable':
                {
                    logger.debug('starboard.activar', { guildId });
                    await starboardStorage.updateStarboardSettings(guildId, { enabled: true });
                    return respondWithLatestSettings(message, guildId, lang, Moxi.user?.username);
                }
            case 'desactivar':
            case 'disable':
                {
                    logger.debug('starboard.desactivar', { guildId });
                    await starboardStorage.updateStarboardSettings(guildId, { enabled: false });
                    return respondWithLatestSettings(message, guildId, lang, Moxi.user?.username);
                }
            case 'status':
            case 'info':
            default:
                return respond(message, buildStatusContainer(currentSettings || {}, lang, Moxi.user?.username));
        }
    },
};
