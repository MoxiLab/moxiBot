const { ApplicationCommandOptionType: { String }, MessageFlags, LinkButtonBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
const { Bot } = require('../../Config');
const { EMOJIS, toEmojiObject } = require('../../Util/emojis');
const moxi = require('../../i18n');
const { createEmojiContainer, finalizeEmojiContainer } = require('../../Util/emojiCard');
const debugHelper = require('../../Util/debugHelper');

module.exports = {
    name: 'emojiinfo',
    alias: ['ei', ' emoji'],
    description: 'Get detailed information about an emoji',
    usage: 'emojiinfo <emoji/name>',
    category: 'Utility',
    cooldown: 3,

    command: {
        prefix: true,
        slash: true,
        ephemeral: false,
        options: [
            {
                name: 'emoji',
                description: 'Emoji name or the emoji itself',
                type: String,
                required: true
            }
        ]
    },

    async execute(Moxi, message, args) {
        const emojiInput = (Array.isArray(args) ? args.join(' ') : String(args || '')).trim().toLowerCase();
        const guildId = message.guildId;
        const requesterId = message.author?.id;
        const language = message.guild?.settings?.Language || 'es-ES';
        const t = (key, vars = {}) => moxi.translate(`misc:${key}`, language, vars);
        debugHelper.log('emojiinfo', 'command start', { guildId, requesterId, emojiInput });

        try {
            const idMatch = emojiInput.match(/^:?(\d+):?$/);
            const emojiRegex = /<a?:[\w]+:(\d+)>/;
            let emoji = null;

            if (idMatch) {
                const id = idMatch[1];
                emoji = message.guild?.emojis.cache.get(id) || Moxi.emojis.cache.get(id) || null;
            }

            if (!emoji && emojiInput) {
                emoji = message.guild?.emojis.cache.find(e => (e.name || '').toLowerCase() === emojiInput || e.id === emojiInput) ||
                    Moxi.emojis.cache.find(e => (e.name || '').toLowerCase() === emojiInput || e.id === emojiInput) || null;
            }

            if (!emoji && emojiInput.match(/^<a?:\w+:\d+>$/)) {
                const match = emojiInput.match(emojiRegex);
                if (match) emoji = Moxi.emojis.cache.get(match[1]) || message.guild?.emojis.cache.get(match[1]) || null;
            }

            if (!emoji && emojiInput.match(/^\d+$/)) {
                emoji = Moxi.emojis.cache.get(emojiInput) || message.guild?.emojis.cache.get(emojiInput) || null;
            }

            if (!emoji) {
                debugHelper.warn('emojiinfo', 'emoji not found', { guildId, requesterId, emojiInput });
                const container = finalizeEmojiContainer(
                    createEmojiContainer(
                        {
                            header: `# ❌ ${t('EMOJIINFO_NOT_FOUND')}`,
                            body: t('EMOJIINFO_NOT_FOUND_DESC', { input: emojiInput }),
                        },
                        Moxi,
                        t
                    ),
                    Moxi,
                    t
                );

                return message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
            }

            const createdDate = emoji.createdAt ? `<t:${Math.floor(emoji.createdAt.getTime() / 1000)}:f>` : t('UNKNOWN') || 'Unknown';
            const emojiType = emoji.animated ? t('EMOJIINFO_IMAGE_GIF') : t('EMOJIINFO_IMAGE_PNG');
            const emojiUrl = `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? 'gif' : 'png'}?size=2048`;

            const infoText = `**${t('EMOJIINFO_NAME')}:** ${emoji.name}\n**${t('EMOJIINFO_ID')}:** \`${emoji.id}\`\n**${t('EMOJIINFO_MENTION')}:** \`<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>\`\n**${t('EMOJIINFO_TYPE')}:** ${emojiType}\n**${t('EMOJIINFO_CREATED')}:** ${createdDate}`;

            const container = finalizeEmojiContainer(
                createEmojiContainer(
                    {
                        header: `# 🖼️ ${t('EMOJIINFO_TITLE') || 'Emoji info'}`,
                        body: infoText,
                    },
                    Moxi,
                    t
                )
                    .addSeparatorComponents((s) => s.setDivider(true))
                    .addMediaGalleryComponents(
                        new MediaGalleryBuilder().addItems(
                            new MediaGalleryItemBuilder().setURL(emojiUrl)
                        )
                    )
                    .addActionRowComponents((row) =>
                        row.addComponents(
                            new LinkButtonBuilder()
                                .setLabel(t('EMOJIINFO_DOWNLOAD') || 'Download')
                                .setURL(emojiUrl)
                                .setEmoji(toEmojiObject('📥'))
                        )
                    ),
                Moxi,
                t
            );

            debugHelper.log('emojiinfo', 'command success', { guildId, requesterId, emojiId: emoji.id });
            return message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
        } catch (error) {
            debugHelper.error('emojiinfo', 'command error', { guildId: message.guildId, requesterId: message.author?.id, error: error.message });
            const container = finalizeEmojiContainer(
                createEmojiContainer(
                    {
                        header: `# ❌ ${t('EMOJIINFO_ERROR')}`,
                        body: `\`\`\`js\n${error.message}\n\`\`\``,
                    },
                    Moxi,
                    t
                ),
                Moxi,
                t
            );

            return message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
        }
    }
};
