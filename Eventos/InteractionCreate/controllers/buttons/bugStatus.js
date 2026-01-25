const { PermissionsBitField, MessageFlags, ActionRowBuilder, ButtonStyle, ChannelType, ContainerBuilder, SeparatorBuilder } = require('discord.js');
const { ButtonBuilder } = require('../../../../Util/compatButtonBuilder');
const { Bot } = require('../../../../Config');
const { getSettings } = require('../../../../Util/bugStorage');

const COMPLETE_ID = 'bug:mark-complete';
const REOPEN_ID = 'bug:reopen';
const CANCEL_ID = 'bug:cancel';
const DELETE_ID = 'bug:delete-thread';

function buildCompleteRow(translate) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(COMPLETE_ID)
            .setLabel(translate('BUG_BUTTON_COMPLETE'))
            .setStyle(ButtonStyle.Success)
    );
}

function buildReopenRow(translate) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(REOPEN_ID)
            .setLabel(translate('BUG_BUTTON_REOPEN'))
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(CANCEL_ID)
            .setLabel(translate('BUG_BUTTON_CANCEL'))
            .setStyle(ButtonStyle.Secondary)
    );
}

function buildDeleteButton(translate) {
    return new ButtonBuilder()
        .setCustomId(DELETE_ID)
        .setLabel(translate('BUG_BUTTON_DELETE'))
        .setStyle(ButtonStyle.Danger);
}

function mergeWithDeleteButton(statusRow, translate) {
    const deleteButton = buildDeleteButton(translate);
    if (!statusRow) {
        return new ActionRowBuilder().addComponents(deleteButton);
    }
    const combined = new ActionRowBuilder();
    combined.addComponents(...statusRow.components, deleteButton);
    return combined;
}

function updateComponents(interaction, statusRow) {
    const combinedRow = mergeWithDeleteButton(statusRow, interaction.translate);
    const existingContainer = interaction.message?.components?.[0];
    const components = [];
    if (existingContainer) {
        components.push(existingContainer);
    }
    components.push(combinedRow);
    interaction.message?.edit({ components }).catch(() => null);
}

function buildSimpleCard(text) {
    return new ContainerBuilder()
        .setAccentColor(0xE53E3E)
        .addTextDisplayComponents(c => c.setContent(text));
}

function buildStatusLogContainer(lines) {
    const container = new ContainerBuilder().setAccentColor(Bot.AccentColor);
    if (!lines.length) {
        return container;
    }
    container.addTextDisplayComponents(c => c.setContent(`# ${lines[0]}`));
    container.addSeparatorComponents(s => s.setDivider(true));
    lines.slice(1).forEach(line => container.addTextDisplayComponents(c => c.setContent(line)));
    return container;
}

function isStaff(member) {
    if (!member?.permissions) return false;
    return member.permissions.has(PermissionsBitField.Flags.ManageMessages, true)
        || member.permissions.has(PermissionsBitField.Flags.ManageChannels, true)
        || member.permissions.has(PermissionsBitField.Flags.ManageGuild, true)
        || member.permissions.has(PermissionsBitField.Flags.Administrator, true);
}

function getActorInfo(interaction) {
    const actorLabel = interaction.user?.tag || interaction.user?.id || 'Unknown';
    const actorMention = interaction.user ? `<@${interaction.user.id}>` : actorLabel;
    return { actorLabel, actorMention };
}

function formatThreadLabel(interaction, thread) {
    if (thread?.id) {
        return `${thread.name || 'bug thread'} (${thread.id})`;
    }
    return interaction.translate('BUG_STATUS_DELETE_LOG_UNKNOWN');
}

function formatTimestampLine(interaction, datetimeKey) {
    const locale = interaction.locale || 'en-US';
    const formatter = new Intl.DateTimeFormat(locale, {
        dateStyle: 'medium',
        timeStyle: 'short',
    });
    return interaction.translate(datetimeKey, { date: formatter.format(new Date()) });
}

async function resolveLogChannel(settings, interaction) {
    const logChannelId = settings?.logChannelId;
    if (!logChannelId) return null;
    const guild = interaction.guild;
    if (!guild) return null;
    const cachedLogChannel = guild.channels.cache.get(logChannelId);
    if (cachedLogChannel) return cachedLogChannel;
    return guild.channels.fetch(logChannelId).catch(() => null);
}

function buildThreadLinkRow(interaction, thread) {
    const guildId = interaction.guildId;
    if (!thread?.id || !guildId) return null;
    const threadUrl = `https://discord.com/channels/${guildId}/${thread.id}`;
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel(interaction.translate('BUG_THREAD_BUTTON'))
            .setStyle(ButtonStyle.Link)
            .setURL(threadUrl)
    );
}

async function sendLogCard({ settings, interaction, thread, lines, includeThreadLink = true }) {
    const logChannel = await resolveLogChannel(settings, interaction);
    if (!logChannel || ![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(logChannel.type)) {
        return;
    }
    const container = buildStatusLogContainer(lines);
    const components = [container];
    if (includeThreadLink) {
        const linkRow = buildThreadLinkRow(interaction, thread);
        if (linkRow) {
            components.push(linkRow);
        }
    }
    await logChannel.send({ content: '', components, flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } }).catch(() => null);
}

async function logStatusEvent({ interaction, settings, thread, titleKey, threadKey, actorKey, datetimeKey, includeThreadLink = true }) {
    const { actorLabel, actorMention } = getActorInfo(interaction);
    const lines = [
        interaction.translate(titleKey),
        interaction.translate(threadKey, { thread: formatThreadLabel(interaction, thread) }),
        interaction.translate(actorKey, { user: actorLabel, mention: actorMention }),
        formatTimestampLine(interaction, datetimeKey),
    ];
    await sendLogCard({ settings, interaction, thread, lines, includeThreadLink });
}

module.exports = async function bugStatusButton(interaction) {
    const action = interaction?.customId;
    if (!action || !interaction.guildId) return false;
    if (![COMPLETE_ID, REOPEN_ID, CANCEL_ID, DELETE_ID].includes(action)) return false;

    const thread = interaction.channel;
    if (!thread || typeof thread.isThread !== 'function' || !thread.isThread()) return false;

    const settings = await getSettings(interaction.guildId);
    if (!settings?.forumChannelId) return false;
    if (thread.parentId !== settings.forumChannelId) return false;

    const member = interaction.member;
    if (!isStaff(member)) {
        await interaction.reply({ content: interaction.translate('BUG_STATUS_COMPLETE_NO_PERMISSION'), flags: MessageFlags.Ephemeral });
        return true;
    }

    const statusTags = settings.tagIds?.status || {};
    const completeTagId = statusTags.complete;

    if (action === REOPEN_ID) {
        await thread.setLocked(false).catch(() => null);
        updateComponents(interaction, buildCompleteRow(interaction.translate));
        await logStatusEvent({
            interaction,
            settings,
            thread,
            titleKey: 'BUG_STATUS_LOG_REOPEN_TITLE',
            threadKey: 'BUG_STATUS_LOG_REOPEN_THREAD',
            actorKey: 'BUG_STATUS_LOG_REOPEN_ACTOR',
            datetimeKey: 'BUG_STATUS_LOG_DATETIME',
        });
        await interaction.reply({ content: interaction.translate('BUG_STATUS_REOPEN_SUCCESS'), flags: MessageFlags.Ephemeral });
        return true;
    }

    if (action === DELETE_ID) {
        await thread.delete('Bug thread deleted by staff member').catch(() => null);
        await logStatusEvent({
            interaction,
            settings,
            thread,
            titleKey: 'BUG_STATUS_DELETE_LOG_TITLE',
            threadKey: 'BUG_STATUS_DELETE_LOG_THREAD',
            actorKey: 'BUG_STATUS_DELETE_LOG_ACTOR',
            datetimeKey: 'BUG_STATUS_DELETE_LOG_DATETIME',
            includeThreadLink: false,
        });
        return true;
    }

    if (action === CANCEL_ID) {
        await interaction.reply({ content: interaction.translate('BUG_STATUS_CANCELLED'), flags: MessageFlags.Ephemeral });
        return true;
    }

    if (!completeTagId) {
        await interaction.reply({
            content: '',
            components: [buildSimpleCard(interaction.translate('BUG_STATUS_COMPLETE_NO_TAG'))],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
        return true;
    }

    const appliedTags = Array.isArray(thread.appliedTags) ? thread.appliedTags : [];
    if (appliedTags.includes(completeTagId)) {
        await interaction.reply({ content: interaction.translate('BUG_STATUS_COMPLETE_ALREADY'), flags: MessageFlags.Ephemeral });
        return true;
    }

    await thread.setAppliedTags([completeTagId]).catch(() => null);
    await thread.setLocked(true).catch(() => null);
    updateComponents(interaction, buildReopenRow(interaction.translate));
    await logStatusEvent({
        interaction,
        settings,
        thread,
        titleKey: 'BUG_STATUS_LOG_COMPLETE_TITLE',
        threadKey: 'BUG_STATUS_LOG_COMPLETE_THREAD',
        actorKey: 'BUG_STATUS_LOG_COMPLETE_ACTOR',
        datetimeKey: 'BUG_STATUS_LOG_DATETIME',
    });
    await interaction.reply({ content: interaction.translate('BUG_STATUS_COMPLETE_SUCCESS'), flags: MessageFlags.Ephemeral });
    return true;
};
