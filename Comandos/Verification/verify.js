const {
  PermissionsBitField: { Flags },
  ContainerBuilder,
  MessageFlags,
  ButtonStyle,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
} = require('discord.js');

const { ButtonBuilder } = require('../../Util/compatButtonBuilder');

const moxi = require('../../i18n');
const { Bot } = require('../../Config');
const { EMOJIS } = require('../../Util/emojis');
const debugHelper = require('../../Util/debugHelper');
const {
  getVerificationConfig,
  upsertVerificationConfig,
  disableVerification,
} = require('../../Models/VerifySchema');

function buildPanel({ title, body }) {
  const container = new ContainerBuilder()
    .setAccentColor(Bot.AccentColor)
    .addTextDisplayComponents(c => c.setContent(`# ${title}`))
    .addSeparatorComponents(s => s.setDivider(true))
    .addTextDisplayComponents(c => c.setContent(body));

  return { content: '', components: [container], flags: MessageFlags.IsComponentsV2 };
}

function buildVerificationPanelMessage(cfg) {
  const title = (cfg?.panelTitle || `${EMOJIS.lock || ''} Verificación`).toString();
  const body = (cfg?.panelBody || 'Pulsa **Verificarme** y escribe el código que sale en la imagen.').toString();
  const buttonLabel = (cfg?.panelButtonLabel || 'Verificarme').toString();
  const accentColor = (typeof cfg?.panelAccentColor === 'number' && Number.isFinite(cfg.panelAccentColor))
    ? cfg.panelAccentColor
    : Bot.AccentColor;
  const imageUrl = cfg?.panelImageUrl ? String(cfg.panelImageUrl) : null;

  const container = new ContainerBuilder()
    .setAccentColor(accentColor)
    .addTextDisplayComponents(c => c.setContent(`# ${title}`))
    .addSeparatorComponents(s => s.setDivider(true));

  if (imageUrl && /^https?:\/\//i.test(imageUrl)) {
    container.addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL(imageUrl)
      )
    );
  }

  container
    .addTextDisplayComponents(c => c.setContent(body))
    .addActionRowComponents(row =>
      row.addComponents(
        new ButtonBuilder()
          .setCustomId('verify:start')
          .setLabel(buttonLabel)
          .setStyle(ButtonStyle.Success)
      )
    );

  return { content: '', components: [container], flags: MessageFlags.IsComponentsV2 };
}

async function deleteMessageBestEffort(msg) {
  if (!msg) return;
  try {
    // Discord.js expone .deletable en muchos casos
    if (typeof msg.deletable === 'boolean' && !msg.deletable) return;
  } catch {
    // ignore
  }
  try {
    await msg.delete().catch(() => null);
  } catch {
    // ignore
  }
}

function scheduleDelete(msg, ms = 12_000) {
  if (!msg) return;
  const delay = Number(ms) || 0;
  if (delay <= 0) return;
  setTimeout(() => {
    deleteMessageBestEffort(msg);
  }, delay);
}

function cleanId(raw) {
  return raw ? String(raw).replace(/[<#@&>]/g, '').trim() : '';
}

function looksLikeSnowflake(id) {
  return typeof id === 'string' && /^\d{15,22}$/.test(id);
}

async function resolveChannel(message, raw) {
  const id = cleanId(raw);
  if (!looksLikeSnowflake(id)) return null;
  return message.guild.channels.cache.get(id) || await message.guild.channels.fetch(id).catch(() => null);
}

async function resolveRole(message, raw, { allowMissing = false } = {}) {
  const id = cleanId(raw);
  if (!looksLikeSnowflake(id)) return allowMissing ? null : null;
  return message.guild.roles.cache.get(id) || await message.guild.roles.fetch(id).catch(() => null);
}

module.exports = {
  name: 'verify',
  alias: ['verificacion', 'verificar', 'captcha', 'verification'],
  description: function (lang) {
    lang = lang || 'es-ES';
    return 'Configura la verificación por captcha con imagen (usa /verify o .verify setup)';
  },
  usage: 'verify setup #canal @Verificado [@SinVerificar] | verify panel | verify status | verify off',
  Category: function (lang) {
    lang = lang || 'es-ES';
    return moxi.translate('commands:CATEGORY_ADMIN', lang);
  },
  permissions: {
    User: [Flags.Administrator],
  },
  cooldown: 10,

  async execute(Moxi, message, args) {
    const guildId = message.guild?.id;
    if (!guildId) return;

    const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
    const sub = String(args?.[0] || 'status').toLowerCase();

    debugHelper.log('verify-prefix', 'execute', {
      guildId,
      userId: message.author?.id,
      sub,
      args: (args || []).slice(0, 6),
    });

    try {
      if (sub === 'help') {
        return message.reply(buildPanel({
          title: 'Verificación',
          body:
            `Usos:\n` +
            `• \.verify setup #canal @Verificado [@SinVerificar] [#canal_log]\n` +
            `• \.verify panel\n` +
            `• \.verify status\n` +
            `• \.verify off\n\n` +
            `Recomendado: usa también /verify (slash).`,
        }));
      }

      if (sub === 'off' || sub === 'disable') {
        await disableVerification(guildId);
        const reply = await message.reply(buildPanel({
          title: 'Verificación',
          body: `${EMOJIS.tick} Verificación desactivada.`,
        }));
        // Mantener el canal limpio: borrar comando y confirmación
        scheduleDelete(reply, 10_000);
        deleteMessageBestEffort(message);
        return reply;
      }

      if (sub === 'status') {
        const cfg = await getVerificationConfig(guildId);
        const enabled = !!cfg?.enabled;
        const channelText = cfg?.channelId ? `<#${cfg.channelId}>` : '-';
        const logChannelText = (cfg?.verifyLogChannelId || cfg?.channelId) ? `<#${cfg?.verifyLogChannelId || cfg?.channelId}>` : '-';
        const verifiedRoleText = cfg?.verifiedRoleId ? `<@&${cfg.verifiedRoleId}>` : '-';
        const unverifiedRoleText = cfg?.unverifiedRoleId ? `<@&${cfg.unverifiedRoleId}>` : '-';

        return message.reply(buildPanel({
          title: 'Verificación',
          body:
            `${EMOJIS.info || ''} Estado: **${enabled ? 'ON' : 'OFF'}**\n` +
            `${EMOJIS.channel || ''} Canal: ${channelText}\n` +
            `${EMOJIS.channel || ''} Canal log: ${logChannelText}\n` +
            `${EMOJIS.tick} Rol verificado: ${verifiedRoleText}\n` +
            `${EMOJIS.lock || ''} Rol no verificado: ${unverifiedRoleText}`,
        }));
      }

      if (sub === 'panel') {
        const cfg = await getVerificationConfig(guildId);
        if (!cfg?.channelId) {
          return message.reply(buildPanel({
            title: 'Verificación',
            body: `${EMOJIS.cross} No hay canal configurado. Usa \.verify setup #canal @Verificado`,
          }));
        }

        const channel = message.guild.channels.cache.get(cfg.channelId)
          || await message.guild.channels.fetch(cfg.channelId).catch(() => null);

        if (!channel || typeof channel.send !== 'function') {
          return message.reply(buildPanel({
            title: 'Verificación',
            body: `${EMOJIS.cross} No puedo acceder al canal configurado.`,
          }));
        }

        const sent = await channel.send(buildVerificationPanelMessage(cfg));
        await upsertVerificationConfig(guildId, { enabled: true, panelMessageId: sent.id });

        const reply = await message.reply(buildPanel({
          title: 'Verificación',
          body: `${EMOJIS.tick} Panel enviado en ${channel}.`,
        }));
        scheduleDelete(reply, 10_000);
        deleteMessageBestEffort(message);
        return reply;
      }

      if (sub === 'setup' || sub === 'set') {
        const channel = await resolveChannel(message, args?.[1]);
        const verifiedRole = await resolveRole(message, args?.[2]);

        // args[3] puede ser @SinVerificar o #canal_log
        let unverifiedRole = null;
        let logChannel = null;

        const raw3 = args?.[3];
        const raw4 = args?.[4];

        const maybeRole3 = await resolveRole(message, raw3, { allowMissing: true });
        const maybeChannel3 = await resolveChannel(message, raw3);

        if (maybeRole3) {
          unverifiedRole = maybeRole3;
          logChannel = await resolveChannel(message, raw4);
        } else if (maybeChannel3) {
          logChannel = maybeChannel3;
        }

        if (!channel || !verifiedRole) {
          return message.reply(buildPanel({
            title: 'Verificación',
            body:
              `${EMOJIS.cross} Uso: \.verify setup #canal @Verificado [@SinVerificar] [#canal_log]\n` +
              `Ejemplo: \.verify setup #verificacion @Verificado @SinVerificar #logs`,
          }));
        }

        if (unverifiedRole && unverifiedRole.id === verifiedRole.id) {
          return message.reply(buildPanel({
            title: 'Verificación',
            body: `${EMOJIS.cross} El rol verificado y el rol no verificado no pueden ser el mismo.`,
          }));
        }

        await upsertVerificationConfig(guildId, {
          enabled: true,
          channelId: channel.id,
          verifyLogChannelId: logChannel?.id || channel.id,
          verifiedRoleId: verifiedRole.id,
          unverifiedRoleId: unverifiedRole?.id ?? null,
          captchaLength: 6,
          captchaTtlMs: 2 * 60 * 1000,
          maxAttempts: 3,
        });

        const cfg = await getVerificationConfig(guildId);
        const sent = await channel.send(buildVerificationPanelMessage(cfg));
        await upsertVerificationConfig(guildId, { panelMessageId: sent.id });

        const reply = await message.reply(buildPanel({
          title: 'Verificación',
          body:
            `${EMOJIS.tick} Configuración guardada y panel enviado.\n` +
            `${EMOJIS.channel || ''} Canal: ${channel}\n` +
            `${EMOJIS.channel || ''} Canal log: ${logChannel ? logChannel : channel}\n` +
            `${EMOJIS.tick} Rol verificado: <@&${verifiedRole.id}>\n` +
            `${EMOJIS.lock || ''} Rol no verificado: ${unverifiedRole ? `<@&${unverifiedRole.id}>` : '-'}`,
        }));
        scheduleDelete(reply, 12_000);
        deleteMessageBestEffort(message);
        return reply;
      }

      return message.reply(buildPanel({
        title: 'Verificación',
        body: `${EMOJIS.cross} Subcomando no reconocido. Usa \.verify help`,
      }));
    } catch (err) {
      const msg = (err && err.message) ? String(err.message) : 'Error desconocido';
      const hint = msg.includes('MONGODB env var')
        ? 'Falta configurar `MONGODB` en el .env.'
        : 'Revisa permisos del bot y jerarquía de roles.';
      return message.reply(buildPanel({
        title: 'Verificación',
        body: `${EMOJIS.cross} Error: **${msg}**\n${hint}`,
      }));
    }
  },
};
