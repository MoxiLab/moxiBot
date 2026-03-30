const {
    ContainerBuilder,
    MessageFlags,
    ActionRowBuilder,
    ButtonStyle,
    ChannelType,
    PermissionsBitField,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
} = require('discord.js');
const { ButtonBuilder } = require('../../Util/compatButtonBuilder');
const { randomBytes } = require('crypto');
const moxi = require('../../i18n');
const { Bot } = require('../../Config');
const { EMOJIS } = require('../../Util/emojis');
const { getSettings, upsertSettings } = require('../../Util/bugStorage');
const shouldSkipBugDm = process.env.BUG_SKIP_DM === '1' || process.env.NODE_ENV === 'test';

const MIN_DESCRIPTION_LENGTH = 3;

function ensureMediaAttachment(attachment) {
    if (!attachment) return false;
    const mime = attachment.contentType || attachment.content_type || '';
    if (typeof mime !== 'string') return false;
    return mime.startsWith('image') || mime.startsWith('video');
}

function buildAttachmentGallery(urls) {
    if (!Array.isArray(urls) || urls.length === 0) return null;
    const items = urls.slice(0, 5).map(url => new MediaGalleryItemBuilder().setURL(url));
    return items.length ? new MediaGalleryBuilder().addItems(...items) : null;
}

function generateShortId() {
    return randomBytes(3).toString('hex').toUpperCase();
}

async function resolveChannel(guild, channelId) {
    if (!guild || !channelId) return null;
    const cached = guild.channels.cache.get(channelId);
    if (cached) return cached;
    try {
        return await guild.channels.fetch(channelId);
    } catch {
        return null;
    }
}

function buildContainer(lang, lines = []) {
    const container = new ContainerBuilder().setAccentColor(Bot.AccentColor);
    container.addTextDisplayComponents(c => c.setContent(`# ${moxi.translate('BUG_TITLE', lang)}`));
    container.addSeparatorComponents(s => s.setDivider(true));
    lines.forEach(line => container.addTextDisplayComponents(c => c.setContent(line)));
    return container;
}

module.exports = {
    name: 'bug',
    alias: ['bug'],
    usage: 'bug <descripción> [adjunto]',
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_HERRAMIENTAS', lang);
    },
    description: (lang = 'es-ES') => moxi.translate('BUG', lang),

    async execute(Moxi, message, args) {
        const guild = message.guild;
        const lang = await moxi.guildLang(guild?.id, process.env.DEFAULT_LANG || 'es-ES');

        if (!guild) {
            return message.reply({ content: moxi.translate('GUILD_ONLY', lang), allowedMentions: { repliedUser: false } });
        }

        const safeArgs = Array.isArray(args) ? args : [];
        if (safeArgs[0] && safeArgs[0].toLowerCase() === 'set') {
            return handleSetGuildLog(safeArgs.slice(1));
        }
        return handleReport(safeArgs);

        async function handleSetGuildLog(subArgs) {
            if (!message.member?.permissions?.has(PermissionsBitField.Flags.ManageGuild)) {
                return message.reply({ content: moxi.translate('MISSING_PERMISSION', lang, { PERMISSIONS: 'Manage Server', guild: guild.name || 'este servidor' }), allowedMentions: { repliedUser: false } });
            }
            const target = subArgs[0];
            if (!target) {
                return message.reply({ content: moxi.translate('BUG_SET_NEED_CHANNEL', lang), allowedMentions: { repliedUser: false } });
            }
            const mention = target.match(/^<#(\d+)>$/);
            const channelId = mention ? mention[1] : target;
            const resolved = await resolveChannel(guild, channelId);
            if (!resolved || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(resolved.type)) {
                return message.reply({ content: moxi.translate('BUG_SET_INVALID_CHANNEL', lang), allowedMentions: { repliedUser: false } });
            }
            await upsertSettings(guild.id, { logChannelId: resolved.id });
            const container = buildContainer(lang, [moxi.translate('BUG_SET_SUCCESS', lang, { channel: resolved.toString() })]);
            return message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
        }

        async function handleReport(argArray) {
            const commandCandidate = argArray[0];
            let commandName = null;
            let descriptionParts = argArray;
            if (argArray.length > 1 && typeof commandCandidate === 'string') {
                const normalized = commandCandidate.trim();
                if (/^[\/.!?]?[A-Za-z0-9_-]+$/.test(normalized)) {
                    commandName = normalized;
                    descriptionParts = argArray.slice(1);
                }
            }
            let description = descriptionParts.join(' ').trim();
            if (!description) {
                description = argArray.join(' ').trim();
                commandName = null;
            }
            if (!description) {
                return message.reply({ content: moxi.translate('BUG_ERROR', lang), allowedMentions: { repliedUser: false } });
            }
            if (description.length < MIN_DESCRIPTION_LENGTH) {
                return message.reply({ content: moxi.translate('BUG_ERROR_SHORT', lang), allowedMentions: { repliedUser: false } });
            }
            const attachmentsEntries = Array.from(message.attachments.values());
            const mediaAttachments = attachmentsEntries.filter(ensureMediaAttachment);
            if (!mediaAttachments.length) {
                return message.reply({ content: moxi.translate('BUG_ATTACHMENTS_REQUIRED', lang), allowedMentions: { repliedUser: false } });
            }

            const settings = await getSettings(guild.id);
            if (!settings?.forumChannelId) {
                return message.reply({ content: moxi.translate('BUG_FORUM_REQUIRED', lang), allowedMentions: { repliedUser: false } });
            }
            const forumChannel = await resolveChannel(guild, settings.forumChannelId);
            if (!forumChannel || forumChannel.type !== ChannelType.GuildForum) {
                return message.reply({ content: moxi.translate('BUG_FORUM_NOT_FOUND', lang), allowedMentions: { repliedUser: false } });
            }

            const attachments = mediaAttachments.map(att => att.url);

            const shortId = generateShortId();
            const newTagId = settings?.tagIds?.status?.new;
            let thread = null;
            try {
                const threadDetails = [];
                if (commandName) {
                    threadDetails.push(`**${moxi.translate('BUG_COMMAND', lang)}**: ${commandName}`);
                }
                threadDetails.push(`**${moxi.translate('BUG_BUG', lang)}**: ${description}`);
                threadDetails.push(`**${moxi.translate('BUG_USER', lang)}**: ${message.author.tag}`);
                threadDetails.push(`**${moxi.translate('BUG_SERVER', lang)}**: ${guild.name}`);
                // Gallery will show the attached evidence, so no extra text line is needed
                const threadContainer = buildContainer(lang, threadDetails);
                const threadGallery = buildAttachmentGallery(attachments);
                if (threadGallery) {
                    threadContainer.addMediaGalleryComponents(threadGallery);
                }
                const statusActionRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('bug:mark-complete')
                        .setLabel(moxi.translate('BUG_BUTTON_COMPLETE', lang))
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('bug:delete-thread')
                        .setLabel(moxi.translate('BUG_BUTTON_DELETE', lang))
                        .setStyle(ButtonStyle.Danger)
                );
                const starterMessage = {
                    components: [threadContainer, statusActionRow],
                    flags: MessageFlags.IsComponentsV2,
                };
                const threadTitle = `Bug${commandName ? ` - ${commandName}` : ''}`;
                thread = await forumChannel.threads.create({
                    name: threadTitle,
                    autoArchiveDuration: 1440,
                    appliedTags: newTagId ? [newTagId] : undefined,
                    reason: 'Reporte de bug',
                    message: starterMessage,
                });
            } catch (error) {
                console.error('[.bug] thread creation failed', error);
                return message.reply({ content: moxi.translate('ERROR', lang), allowedMentions: { repliedUser: false } });
            }

            const threadUrl = thread ? `https://discord.com/channels/${guild.id}/${thread.id}` : null;
            if (!shouldSkipBugDm && threadUrl) {
                const dmContainer = buildContainer(lang, [
                    moxi.translate('BUG_SUCCESS', lang),
                    moxi.translate('BUG_DM_SOON', lang),
                    moxi.translate('BUG_DM_NEXT_STEPS', lang, { thread: `<#${thread.id}>` }),
                ]);
                const dmActionRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel(moxi.translate('BUG_DM_BUTTON_THREAD', lang))
                        .setStyle(ButtonStyle.Link)
                        .setURL(threadUrl)
                );
                message.author?.send({ content: '', components: [dmContainer, dmActionRow], flags: MessageFlags.IsComponentsV2 }).catch(() => null);
            }
            // Removed the in-channel reply logic
            const logChannel = settings?.logChannelId ? await resolveChannel(guild, settings.logChannelId) : null;
            if (logChannel && [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(logChannel.type)) {
                const logLines = [
                    `${EMOJIS.person} ${moxi.translate('BUG_USER', lang)}: ${message.author.tag}`,
                    `${EMOJIS.link} ${moxi.translate('BUG_REPORT_ID', lang)}: ${shortId}`,
                    `${moxi.translate('BUG_SERVER', lang)}: ${guild.name}`,
                    `${moxi.translate('BUG_BUG', lang)}: ${description}`,
                ];
                if (commandName) {
                    logLines.splice(2, 0, `**${moxi.translate('BUG_COMMAND', lang)}**: ${commandName}`);
                }
                const logContainer = buildContainer(lang, logLines);
                const logGallery = buildAttachmentGallery(attachments);
                if (logGallery) {
                    logContainer.addMediaGalleryComponents(logGallery);
                }
                const logActionRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setLabel(moxi.translate('BUG_THREAD_BUTTON', lang))
                        .setStyle(ButtonStyle.Link)
                        .setURL(threadUrl)
                );
                await logChannel.send({ content: '', components: [logContainer, logActionRow], flags: MessageFlags.IsComponentsV2 });
            }

            const replyContainer = buildContainer(lang, [
                moxi.translate('BUG_SUCCESS', lang),
                moxi.translate('BUG_DM_SOON', lang),
            ]);
            const actionRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setLabel(moxi.translate('BUG_THREAD_BUTTON', lang))
                    .setStyle(ButtonStyle.Link)
                    .setURL(threadUrl)
            );
            const replyResponse = await message.reply({ content: '', components: [replyContainer, actionRow], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
            if (message.channel?.type && message.channel.type !== ChannelType.DM) {
                setTimeout(() => replyResponse?.delete?.().catch(() => null), 15000);
            }
        }
    }
};