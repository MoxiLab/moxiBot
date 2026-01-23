const {
  SlashCommandBuilder,
  ContainerBuilder,
  MessageFlags,
} = require('discord.js');

const { Bot } = require('../../Config');
const moxi = require('../../i18n');
const debugHelper = require('../../Util/debugHelper');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('feedback')
    .setDescription('Send feedback about the bot')
    .addStringOption((opt) =>
      opt
        .setName('text')
        .setDescription('Your feedback')
        .setRequired(true)
    ),

  async run(Moxi, interaction) {
    const guildId = interaction.guildId;
    const requesterId = interaction.user?.id;

    const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
    const t = (key, vars = {}) => moxi.translate(`misc:${key}`, lang, { ...vars, guildId });

    const text = interaction.options.getString('text', true).trim();
    debugHelper.log('feedback', 'slash start', { guildId, requesterId, len: text.length });

    const year = new Date().getFullYear();
    const containerBase = () => new ContainerBuilder().setAccentColor(Bot.AccentColor);

    if (text.length < 3) {
      const container = containerBase()
        .addTextDisplayComponents((c) => c.setContent(`# ❌ ${t('FEEDBACK_MORE')}`))
        .addTextDisplayComponents((c) => c.setContent(`© ${Moxi.user.username} • ${year}`));
      return interaction.reply({
        content: '',
        components: [container],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }

    const id = Math.floor(Math.random() * 10000);
    const invite = await interaction.channel?.createInvite({ maxAge: 0, maxUses: 0 }).catch(() => null);

    const logText =
      `**New Feedback**\n` +
      `User: ${interaction.user} (@${interaction.user.username})\n` +
      `User ID: ${interaction.user.id}\n` +
      `Server: ${interaction.guild?.name || 'DM'} (${invite || 'none'})\n` +
      `Feedback ID: #${id}\n` +
      `Feedback: ${text}`;

    const dmContainer = containerBase()
      .addTextDisplayComponents((c) => c.setContent(`# ${t('FEEDBACK_DM_TITLE')}`))
      .addSeparatorComponents((s) => s.setDivider(true))
      .addTextDisplayComponents((c) => c.setContent(`**ID:** #${id}\n\n${text}`))
      .addSeparatorComponents((s) => s.setDivider(true))
      .addTextDisplayComponents((c) => c.setContent(`© ${Moxi.user.username} • ${year}`));

    const logChannel = Moxi.getWebhook && Moxi.getWebhook('Feedbacks');
    if (logChannel) {
      await logChannel
        .send({
          username: Moxi.user.username,
          avatarURL: Moxi.user.displayAvatarURL(),
          content: logText,
        })
        .catch(() => null);
    } else {
      debugHelper.warn('feedback', 'feedback webhook missing', { guildId });
    }

    // Try DM confirmation (best-effort)
    await interaction.user.send({ content: '', components: [dmContainer], flags: MessageFlags.IsComponentsV2 }).catch(() => null);

    const okContainer = containerBase()
      .addTextDisplayComponents((c) => c.setContent(`# ✅ ${t('FEEDBACK_SUCCESS', { id }) || 'Feedback sent.'}`))
      .addTextDisplayComponents((c) => c.setContent(`© ${Moxi.user.username} • ${year}`));

    return interaction.reply({
      content: '',
      components: [okContainer],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
  },
};
