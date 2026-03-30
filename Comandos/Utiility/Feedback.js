const {
    ApplicationCommandOptionType: { String },
    ContainerBuilder,
    MessageFlags
} = require('discord.js');

const { Bot } = require('../../Config');
const moxi = require('../../i18n');
const debugHelper = require('../../Util/debugHelper');

module.exports = {
    name: 'feedback',
    alias: ['feedback'],
    description: 'Share your thoughts about the bot',
    usage: 'feedback <text>',
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_UTILIDAD', lang);
    },
    cooldown: 60,
    execute: async (Moxi, message, args, settings) => {

        const language = message.guild?.settings?.Language || settings?.Language || 'es-ES';
        const t = (key, vars = {}) => moxi.translate(`misc:${key}`, language, vars);
        const guildId = message.guildId;
        const requesterId = message.author?.id;
        const preview = (Array.isArray(args) ? args.join(' ') : '').slice(0, 120);
        debugHelper.log('feedback', 'command start', { guildId, requesterId, argsLength: Array.isArray(args) ? args.length : 0, preview });

        var id = Math.floor(Math.random() * 10000);

        const containerBase = () => new ContainerBuilder().setAccentColor(Bot.AccentColor);
        const year = new Date().getFullYear();

        if (args.length < 1) {
            debugHelper.warn('feedback', 'missing feedback body', { guildId, requesterId, argsLength: args.length });
            const container = containerBase()
                .addTextDisplayComponents(c => c.setContent(`# ❌ ${t('FEEDBACK_REPORT')}`))
                .addTextDisplayComponents(c => c.setContent(`© ${Moxi.user.username} • ${year}`));
            return message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
        }

        let invite = await message.channel.createInvite({ maxAge: 0, maxUses: 0 }).catch(() => { });

        let report = args.join(' ').split('').join('')

        const logText =
            `**New Feedback**\n` +
            `User: ${message.author} (@${message.author.username})\n` +
            `User ID: ${message.author.id}\n` +
            `Server: ${message.guild.name} (${invite || 'none'})\n` +
            `Feedback ID: #${id}\n` +
            `Feedback: ${report}`;

        const dmContainer = containerBase()
            .addTextDisplayComponents(c => c.setContent(`# ${t('FEEDBACK_DM_TITLE')}`))
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(c => c.setContent(`**ID:** #${id}\n\n${report}`))
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(c => c.setContent(`© ${Moxi.user.username} • ${year}`));

        const logChannel = Moxi.getWebhook('Feedbacks');

        if (logChannel) {
            logChannel.send({
                username: Moxi.user.username,
                avatarURL: Moxi.user.displayAvatarURL(),
                content: logText
            });
            debugHelper.log('feedback', 'webhook dispatched', { guildId, requesterId, feedbackId: id });
        } else {
            debugHelper.warn('feedback', 'feedback webhook missing', { guildId });
        }

        message.author.send({ content: '', components: [dmContainer], flags: MessageFlags.IsComponentsV2 }).catch(() => { })
        message.delete().catch(() => { })
        debugHelper.log('feedback', 'command complete', { guildId, requesterId, feedbackId: id });
    }
};