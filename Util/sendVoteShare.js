const {
    ActionRowBuilder,
    LinkButtonBuilder,
    ContainerBuilder,
    SeparatorBuilder,
    TextDisplayBuilder,
    MessageFlags
} = require('discord.js');
const { Bot } = require('../Config');
const { EMOJIS, toEmojiObject } = require('../Util/emojis');
const logger = require('../Util/logger');
const moxi = require('../i18n');

async function sendVoteShare(client, player) {
    if (!client || !player) return false;

    const channel = client.channels.cache.get(player.textChannel);
    const guild = client.guilds.cache.get(player.guildId);
    const guildName = guild?.name || 'Moxi';
    const canSendShareNotice = channel?.isTextBased?.() || channel?.isThread?.();

    if (!canSendShareNotice) {
        logger.warn(`[VOTE SHARE] No se pudo entregar la tarjeta de votación: canal no disponible (${player.textChannel}).`);
        return false;
    }

    const shareRow = new ActionRowBuilder().addComponents(
        new LinkButtonBuilder()
            .setEmoji(toEmojiObject(EMOJIS.smileGrinBig))
            .setLabel('top.gg')
            .setURL('https://top.gg/bot/moxi/vote'),
        new LinkButtonBuilder()
            .setEmoji(toEmojiObject(EMOJIS.smileSmile))
            .setLabel('discordbotlist')
            .setURL('https://discordbotlist.com/bots/moxi/upvote'),
        new LinkButtonBuilder()
            .setEmoji(toEmojiObject(EMOJIS.smileGrin))
            .setLabel('dbotlist')
            .setURL('https://dbots.fun/bot/moxi')
    );

    const loreKeys = [
        'MUSIC_QUEUE_END_TITLE',
        'MUSIC_QUEUE_END_MOMENT',
        'MUSIC_QUEUE_END_VOTE',
        'MUSIC_QUEUE_END_FOOTER'
    ];

    const loreTexts = await Promise.all(
        loreKeys.map((key) => moxi.tGuild(player.guildId, key, { server: guildName }))
    );

    const [title, moment, votePrompt, footer] = loreTexts;
    const finishContainer = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(title))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(moment))
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(votePrompt))
        .addSeparatorComponents(new SeparatorBuilder())
        .addActionRowComponents(shareRow)
        .addSeparatorComponents(new SeparatorBuilder())
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(footer));

    try {
        await channel.send({ components: [finishContainer], flags: MessageFlags.IsComponentsV2 });
        return true;
    } catch (error) {
        logger.error(`[VOTE SHARE] No se pudo enviar el componente de votación: ${error.message}`);
        return false;
    }
}

module.exports = { sendVoteShare };
