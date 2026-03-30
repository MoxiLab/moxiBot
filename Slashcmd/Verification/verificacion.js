const {
  PermissionFlagsBits,
  ContainerBuilder,
  MessageFlags,
  ButtonStyle,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
} = require('discord.js');

const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');
const { ButtonBuilder } = require('../../Util/compatButtonBuilder');

const { Bot } = require('../../Config');
const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const {
  getVerificationConfig,
  upsertVerificationConfig,
  disableVerification,
} = require('../../Models/VerifySchema');

function buildEphemeralPanel({ title, body }) {
  const container = new ContainerBuilder()
    .setAccentColor(Bot.AccentColor)
    .addTextDisplayComponents(c => c.setContent(`# ${title}`))
    .addSeparatorComponents(s => s.setDivider(true))
    .addTextDisplayComponents(c => c.setContent(body));

  return {
    content: '',
    components: [container],
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
  };
}

function normalizePanelText(value) {
  if (!value) return value;
  // Permite escribir \n en opciones slash
  return String(value).replace(/\\n/g, '\n');
}

function buildVerificationPanelMessage({
  title = 'Verificación',
  body,
  buttonLabel,
  imageUrl,
  accentColor,
  method = 'captcha',
} = {}) {
  const resolvedTitle = normalizePanelText(title) || 'Verificación';
  const m = String(method || 'captcha').toLowerCase();
  const defaultBody = m === 'button'
    ? 'Pulsa el botón para verificarte (1 click).'
    : (m === 'advanced'
      ? 'Pulsa el botón para verificarte y completa el captcha + el reto extra.'
      : 'Pulsa el botón para verificarte. Te saldrá un captcha con imagen.');
  const resolvedBody = normalizePanelText(body) || defaultBody;
  const resolvedButton = normalizePanelText(buttonLabel) || 'Verificarme';
  const resolvedColor = (typeof accentColor === 'number' && Number.isFinite(accentColor))
    ? accentColor
    : Bot.AccentColor;

  const container = new ContainerBuilder()
    .setAccentColor(resolvedColor)
    .addTextDisplayComponents(c => c.setContent(`# ${resolvedTitle}`))
    .addSeparatorComponents(s => s.setDivider(true));

  if (imageUrl && /^https?:\/\//i.test(String(imageUrl))) {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(String(imageUrl))
      )
    );
  }

  container
    .addTextDisplayComponents(c => c.setContent(resolvedBody))
    .addActionRowComponents(row =>
      row.addComponents(
        new ButtonBuilder()
          .setCustomId('verify:start')
          .setLabel(resolvedButton)
          .setStyle(ButtonStyle.Success)
      )
    );

  return {
    content: '',
    components: [container],
    flags: MessageFlags.IsComponentsV2,
  };
}

module.exports = {
  cooldown: 5,
  Category: (lang = 'es-ES') => moxi.translate('commands:CATEGORY_ADMIN', lang),

  data: new SlashCommandBuilder()
    .setName('verificacion')
    .setDescription('Configura la verificación por captcha con imagen')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub
        .setName('set')
        .setDescription('Configurar canal/roles y (opcional) enviar el panel')
        .addChannelOption(o => o.setName('canal').setDescription('Canal donde estará el panel').setRequired(true))
        .addRoleOption(o => o.setName('rol_verificado').setDescription('Rol que se asigna al verificar').setRequired(true))
        .addChannelOption(o => o.setName('canal_log').setDescription('Canal donde se enviará el log de verificaciones (por defecto: el canal del panel)').setRequired(false))
        .addRoleOption(o => o.setName('rol_no_verificado').setDescription('Rol a dar al entrar (y quitar al verificar)').setRequired(false))
        .addStringOption(o =>
          o
            .setName('tipo')
            .setDescription('Tipo de verificación: boton | captcha | avanzado')
            .addChoices(
              { name: 'Botón (1 click)', value: 'button' },
              { name: 'Captcha (imagen)', value: 'captcha' },
              { name: 'Avanzado (captcha + reto)', value: 'advanced' }
            )
            .setRequired(false)
        )
        .addIntegerOption(o => o.setName('min_cuenta_dias').setDescription('Edad mínima de la cuenta (días) para poder verificar').setRequired(false).setMinValue(0))
        .addIntegerOption(o => o.setName('min_unido_min').setDescription('Minutos mínimos desde que entró al server para poder verificar').setRequired(false).setMinValue(0))
        .addBooleanOption(o => o.setName('enviar_panel').setDescription('Enviar panel ahora mismo').setRequired(false))
        .addStringOption(o => o.setName('panel_titulo').setDescription('Título del panel (usa \\n para saltos de línea)').setRequired(false))
        .addStringOption(o => o.setName('panel_texto').setDescription('Texto del panel (usa \\n para saltos de línea)').setRequired(false))
        .addStringOption(o => o.setName('panel_boton').setDescription('Texto del botón').setRequired(false))
        .addStringOption(o => o.setName('panel_imagen').setDescription('URL https://... para imagen/banner del panel').setRequired(false))
        .addStringOption(o => o.setName('panel_color').setDescription('Color acento HEX, ej: #FF88AA').setRequired(false))
    )
    .addSubcommand(sub =>
      sub
        .setName('panel')
        .setDescription('Enviar/recrear el panel en el canal configurado')
    )
    .addSubcommand(sub =>
      sub
        .setName('status')
        .setDescription('Ver el estado de la verificación')
    )
    .addSubcommand(sub =>
      sub
        .setName('off')
        .setDescription('Desactivar la verificación')
    ),

  async run(Moxi, interaction) {
    const guildId = interaction.guildId || interaction.guild?.id;
    const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

    try {

      if (!interaction.guild) {
        return interaction.reply(buildEphemeralPanel({
          title: 'Verificación',
          body: `${EMOJIS.cross} ${moxi.translate('GUILD_ONLY', lang) || 'Solo en servidores.'}`,
        }));
      }

      const sub = interaction.options.getSubcommand();

      if (sub === 'off') {
        await disableVerification(guildId);
        return interaction.reply(buildEphemeralPanel({
          title: 'Verificación',
          body: `${EMOJIS.tick} Verificación desactivada.`,
        }));
      }

      if (sub === 'status') {
        const cfg = await getVerificationConfig(guildId);
        const enabled = !!cfg?.enabled;
        const channelText = cfg?.channelId ? `<#${cfg.channelId}>` : '-';
        const verifiedRoleText = cfg?.verifiedRoleId ? `<@&${cfg.verifiedRoleId}>` : '-';
        const unverifiedRoleText = cfg?.unverifiedRoleId ? `<@&${cfg.unverifiedRoleId}>` : '-';
        const panelText = cfg?.panelMessageId ? `https://discord.com/channels/${guildId}/${cfg?.channelId}/${cfg?.panelMessageId}` : '-';
        const method = String(cfg?.method || 'captcha').toLowerCase();
        const reqAccount = Number(cfg?.minAccountAgeDays) || 0;
        const reqJoin = Number(cfg?.minJoinAgeMinutes) || 0;
        const reqText = (reqAccount > 0 || reqJoin > 0)
          ? `${reqAccount > 0 ? `${reqAccount}d cuenta` : ''}${reqAccount > 0 && reqJoin > 0 ? ' • ' : ''}${reqJoin > 0 ? `${reqJoin}m unido` : ''}`
          : '-';

        return interaction.reply(buildEphemeralPanel({
          title: 'Verificación',
          body:
            `${EMOJIS.info || ''} Estado: **${enabled ? 'ON' : 'OFF'}**\n` +
            `${EMOJIS.settings || EMOJIS.info || ''} Tipo: **${method}**\n` +
            `${EMOJIS.time || ''} Requisitos: ${reqText}`.trim() + `\n` +
            `${EMOJIS.channel || ''} Canal: ${channelText}\n` +
            `${EMOJIS.tick} Rol verificado: ${verifiedRoleText}\n` +
            `${EMOJIS.lock || ''} Rol no verificado: ${unverifiedRoleText}\n` +
            `Panel: ${panelText}`,
        }));
      }

      if (sub === 'set') {
        const channel = interaction.options.getChannel('canal', true);
        const logChannel = interaction.options.getChannel('canal_log', false);
        const verifiedRole = interaction.options.getRole('rol_verificado', true);
        const unverifiedRole = interaction.options.getRole('rol_no_verificado', false);
        const sendPanel = interaction.options.getBoolean('enviar_panel') ?? true;

        const method = interaction.options.getString('tipo', false) || interaction.options.getString('method', false);
        const minAccountAgeDays = interaction.options.getInteger('min_cuenta_dias', false) ?? interaction.options.getInteger('min_account_days', false);
        const minJoinAgeMinutes = interaction.options.getInteger('min_unido_min', false) ?? interaction.options.getInteger('min_join_minutes', false);

        const panelTitle = interaction.options.getString('panel_titulo', false);
        const panelBody = interaction.options.getString('panel_texto', false);
        const panelButtonLabel = interaction.options.getString('panel_boton', false);
        const panelImageUrl = interaction.options.getString('panel_imagen', false);
        const panelAccentColor = interaction.options.getString('panel_color', false);

        await upsertVerificationConfig(guildId, {
          enabled: true,
          channelId: channel.id,
          verifyLogChannelId: logChannel?.id || channel.id,
          verifiedRoleId: verifiedRole.id,
          unverifiedRoleId: unverifiedRole?.id ?? null,
          captchaLength: 6,
          captchaTtlMs: 2 * 60 * 1000,
          maxAttempts: 3,
          ...(method ? { method } : {}),
          ...(minAccountAgeDays !== null && minAccountAgeDays !== undefined ? { minAccountAgeDays } : {}),
          ...(minJoinAgeMinutes !== null && minJoinAgeMinutes !== undefined ? { minJoinAgeMinutes } : {}),
          ...(panelTitle !== null ? { panelTitle } : {}),
          ...(panelBody !== null ? { panelBody } : {}),
          ...(panelButtonLabel !== null ? { panelButtonLabel } : {}),
          ...(panelImageUrl !== null ? { panelImageUrl } : {}),
          ...(panelAccentColor !== null ? { panelAccentColor } : {}),
        });

        let extra = '';
        if (sendPanel) {
          const cfg = await getVerificationConfig(guildId);
          const msg = await channel.send(buildVerificationPanelMessage({
            title: cfg?.panelTitle || panelTitle || 'Verificación',
            body: cfg?.panelBody || panelBody || null,
            buttonLabel: cfg?.panelButtonLabel || panelButtonLabel || 'Verificarme',
            imageUrl: cfg?.panelImageUrl || panelImageUrl || null,
            accentColor: typeof cfg?.panelAccentColor === 'number' ? cfg.panelAccentColor : undefined,
            method: cfg?.method || method || 'captcha',
          }));
          await upsertVerificationConfig(guildId, {
            channelId: channel.id,
            panelMessageId: msg.id,
          });
          extra = `\n${EMOJIS.tick} Panel enviado en ${channel}.`;
        }

        return interaction.reply(buildEphemeralPanel({
          title: 'Verificación',
          body:
            `${EMOJIS.tick} Configuración guardada.\n` +
            `${EMOJIS.channel || ''} Canal: ${channel}\n` +
            `${EMOJIS.tick} Rol verificado: <@&${verifiedRole.id}>\n` +
            `${EMOJIS.lock || ''} Rol no verificado: ${unverifiedRole ? `<@&${unverifiedRole.id}>` : '-'}${extra}`,
        }));
      }

      // panel
      const cfg = await getVerificationConfig(guildId);
      if (!cfg?.channelId) {
        return interaction.reply(buildEphemeralPanel({
          title: 'Verificación',
          body: `${EMOJIS.cross} No hay canal configurado. Usa \/verificacion set.`,
        }));
      }

      const channel = interaction.guild.channels.cache.get(cfg.channelId)
        || await interaction.guild.channels.fetch(cfg.channelId).catch(() => null);

      if (!channel || typeof channel.send !== 'function') {
        return interaction.reply(buildEphemeralPanel({
          title: 'Verificación',
          body: `${EMOJIS.cross} No puedo acceder al canal configurado.`,
        }));
      }

      const msg = await channel.send(buildVerificationPanelMessage({
        title: cfg?.panelTitle || 'Verificación',
        body: cfg?.panelBody || null,
        buttonLabel: cfg?.panelButtonLabel || 'Verificarme',
        imageUrl: cfg?.panelImageUrl || null,
        accentColor: typeof cfg?.panelAccentColor === 'number' ? cfg.panelAccentColor : undefined,
        method: cfg?.method || 'captcha',
      }));
      await upsertVerificationConfig(guildId, { panelMessageId: msg.id, enabled: true });

      return interaction.reply(buildEphemeralPanel({
        title: 'Verificación',
        body: `${EMOJIS.tick} Panel enviado en ${channel}.`,
      }));
    } catch (err) {
      const text = (err && err.message) ? String(err.message) : 'Error desconocido';
      const payload = buildEphemeralPanel({
        title: 'Verificación',
        body: `${EMOJIS.cross} Error: **${text}**`,
      });
      if (interaction.deferred || interaction.replied) return interaction.followUp(payload).catch(() => null);
      return interaction.reply(payload).catch(() => null);
    }
  },
};
