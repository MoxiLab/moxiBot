const {
  ContainerBuilder,
  MessageFlags,
  ButtonStyle,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  LabelBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');

const { ButtonBuilder } = require('../../../../Util/compatButtonBuilder');

const { Bot } = require('../../../../Config');
const { EMOJIS } = require('../../../../Util/emojis');
const { getVerificationConfig } = require('../../../../Models/VerifySchema');
const { renderCaptchaPng } = require('../../../../Util/verification/captcha');
const { createChallenge, createAdvancedChallenge, getChallenge } = require('../../../../Util/verification/store');

async function sendVerificationLog({ client, guild, cfg, userId, method }) {
  try {
    const logChannelId = cfg?.verifyLogChannelId ? String(cfg.verifyLogChannelId) : '';
    const verifiedRoleId = cfg?.verifiedRoleId ? String(cfg.verifiedRoleId) : '';
    if (!logChannelId) return;

    const now = new Date();
    const timeStr = now.toISOString().replace('T', ' ').replace('Z', ' UTC');
    const resolvedMethod = String(method || cfg?.method || 'captcha');

    const container = new ContainerBuilder()
      .setAccentColor(Bot.AccentColor)
      .addTextDisplayComponents(c => c.setContent(`# ${EMOJIS.tick} Verificación`))
      .addSeparatorComponents(s => s.setDivider(true))
      .addTextDisplayComponents(c => c.setContent(
        [
          `${EMOJIS.user || ''} Usuario: <@${userId}> (\`${userId}\`)`.trim(),
          verifiedRoleId ? `${EMOJIS.tick} Rol: <@&${verifiedRoleId}>` : `${EMOJIS.tick} Rol: -`,
          `${EMOJIS.settings || EMOJIS.info || ''} Tipo: ${resolvedMethod}`.trim(),
          `${EMOJIS.time || ''} Hora: ${timeStr}`.trim(),
        ].filter(Boolean).join('\n')
      ));

    const ch = guild.channels?.cache?.get(logChannelId) || await guild.channels?.fetch?.(logChannelId).catch(() => null);
    if (ch && typeof ch.send === 'function') {
      await ch.send({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 }).catch(() => null);
      return;
    }

    // Fallback: audit log (si existe)
    try {
      const { sendAuditLog } = require('../../../../Util/audit');
      const botId = client?.user?.id;
      if (sendAuditLog && botId) {
        await sendAuditLog({
          client,
          guild,
          guildId: String(guild?.id || ''),
          action: 25,
          moderatorId: botId,
          targetId: String(userId),
          reason: verifiedRoleId ? `Verificación completada (${resolvedMethod}). Rol: <@&${verifiedRoleId}>` : `Verificación completada (${resolvedMethod}).`,
        });
      }
    } catch {
      // ignore
    }
  } catch {
    // ignore
  }
}

function buildCaptchaPayload({ nonce, ttlLabel = '2 minutos', extraText = '' }) {
  const enterBtn = new ButtonBuilder();
  enterBtn.setCustomId(`verify:enter:${nonce}`);
  enterBtn.setLabel('Introducir código');
  enterBtn.setStyle(ButtonStyle.Primary);

  const refreshBtn = new ButtonBuilder();
  refreshBtn.setCustomId(`verify:refresh:${nonce}`);
  refreshBtn.setLabel('Nuevo captcha');
  refreshBtn.setStyle(ButtonStyle.Secondary);

  const container = new ContainerBuilder()
    .setAccentColor(Bot.AccentColor)
    .addTextDisplayComponents(c => c.setContent(`# ${EMOJIS.lock || ''} Verificación`))
    .addSeparatorComponents(s => s.setDivider(true))
    .addMediaGalleryComponents(
      new MediaGalleryBuilder().addItems(
        new MediaGalleryItemBuilder().setURL('attachment://captcha.png')
      )
    )
    .addTextDisplayComponents(c =>
      c.setContent(
        `Escribe el código que aparece en la **imagen**.\n` +
        `Caduca en **${ttlLabel}**.` +
        (extraText ? `\n\n${extraText}` : '')
      )
    )
    .addActionRowComponents(row =>
      row.addComponents(
        enterBtn,
        refreshBtn
      )
    );

  return {
    content: '',
    components: [container],
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
  };
}

function methodFromCfg(cfg) {
  const raw = String(cfg?.method || 'captcha').toLowerCase();
  if (raw === 'button') return 'button';
  if (raw === 'advanced') return 'advanced';
  return 'captcha';
}

function formatRequirementText({ minAccountAgeDays = 0, minJoinAgeMinutes = 0 } = {}) {
  const parts = [];
  if (minAccountAgeDays > 0) parts.push(`Cuenta mínima: **${minAccountAgeDays}** días`);
  if (minJoinAgeMinutes > 0) parts.push(`Tiempo en servidor: **${minJoinAgeMinutes}** min`);
  return parts.join(' • ');
}

function checkRequirements({ interaction, member, cfg }) {
  const minAccountAgeDays = Number(cfg?.minAccountAgeDays) || 0;
  const minJoinAgeMinutes = Number(cfg?.minJoinAgeMinutes) || 0;

  if (minAccountAgeDays > 0) {
    const createdAt = interaction.user?.createdTimestamp || interaction.user?.createdAt?.getTime?.();
    if (createdAt) {
      const ageDays = (Date.now() - Number(createdAt)) / (24 * 60 * 60 * 1000);
      if (ageDays < minAccountAgeDays) return { ok: false, reason: 'account_age' };
    }
  }

  if (minJoinAgeMinutes > 0) {
    const joinedAt = member?.joinedTimestamp;
    if (joinedAt) {
      const ageMinutes = (Date.now() - Number(joinedAt)) / (60 * 1000);
      if (ageMinutes < minJoinAgeMinutes) return { ok: false, reason: 'join_age' };
    }
  }

  return { ok: true };
}

async function respond(interaction, payload, { preferUpdate = false } = {}) {
  if (preferUpdate && typeof interaction.update === 'function') {
    try {
      return await interaction.update(payload);
    } catch {
      // Algunas combinaciones (ephemeral + adjuntos) pueden fallar al editar; manda un followUp como fallback.
    }
  }

  if (!interaction.deferred && !interaction.replied) return interaction.reply(payload);
  return interaction.followUp(payload);
}

module.exports = async function verificationButton(interaction, Moxi, logger) {
  const id = String(interaction.customId || '');
  if (!id.startsWith('verify:')) return false;

  try {

  const guildId = interaction.guildId || interaction.guild?.id;
  const userId = interaction.user?.id;
  if (!guildId || !userId) return true;

  const action = id.split(':')[1];

  if (action === 'start') {
    const cfg = await getVerificationConfig(guildId);
    if (!cfg?.enabled || !cfg?.verifiedRoleId || !cfg?.channelId) {
      await interaction.reply({ content: `${EMOJIS.cross} La verificación no está configurada.`, flags: MessageFlags.Ephemeral });
      return true;
    }

    const member = interaction.member;
    if (member?.roles?.cache?.has?.(cfg.verifiedRoleId)) {
      await interaction.reply({ content: `${EMOJIS.tick} Ya estás verificado/a.`, flags: MessageFlags.Ephemeral });
      return true;
    }

    const method = methodFromCfg(cfg);

    // Requisitos opcionales
    const req = checkRequirements({ interaction, member, cfg });
    if (!req.ok) {
      const reqText = formatRequirementText({
        minAccountAgeDays: Number(cfg?.minAccountAgeDays) || 0,
        minJoinAgeMinutes: Number(cfg?.minJoinAgeMinutes) || 0,
      });
      await interaction.reply({
        content: `${EMOJIS.cross} No cumples los requisitos para verificarte.${reqText ? `\n${reqText}` : ''}`,
        flags: MessageFlags.Ephemeral,
      });
      return true;
    }

    if (method === 'button') {
      try {
        await member.roles.add(cfg.verifiedRoleId, 'Verificación por botón');
      } catch {
        await interaction.reply({ content: `${EMOJIS.cross} No pude asignar el rol. Revisa permisos/jerarquía del bot.`, flags: MessageFlags.Ephemeral });
        return true;
      }

      if (cfg.unverifiedRoleId) {
        try {
          await member.roles.remove(cfg.unverifiedRoleId, 'Verificación completada');
        } catch {
          // best-effort
        }
      }

      await interaction.reply({ content: `${EMOJIS.tick} ¡Verificación completada!`, flags: MessageFlags.Ephemeral });

      // Log (best-effort)
      sendVerificationLog({ client: Moxi, guild: interaction.guild, cfg, userId, method: 'button' }).catch(() => null);
      return true;
    }

    const ttlMs = Number(cfg.captchaTtlMs) || (2 * 60 * 1000);
    const length = Number(cfg.captchaLength) || 6;
    const maxAttempts = Number(cfg.maxAttempts) || 3;

    const challenge = (method === 'advanced')
      ? createAdvancedChallenge({ guildId, userId, length, ttlMs, maxAttempts })
      : createChallenge({ guildId, userId, length, ttlMs, maxAttempts, type: 'captcha' });

    const png = await renderCaptchaPng(challenge.code);
    const buf = Buffer.isBuffer(png) ? png : Buffer.from(png);

    const extraText = (challenge.type === 'advanced' && challenge.question)
      ? `Reto extra: resuelve **${challenge.question}** y escríbelo en el modal.`
      : '';

    await respond(interaction, {
      ...buildCaptchaPayload({ nonce: challenge.nonce, extraText }),
      files: [{ attachment: buf, name: 'captcha.png' }],
    });

    return true;
  }

  if (action === 'refresh') {
    // verify:refresh:<nonce>
    const nonce = id.split(':')[2];
    const prev = getChallenge(nonce);
    if (!prev || prev.userId !== String(userId) || prev.guildId !== String(guildId)) {
      await interaction.reply({ content: `${EMOJIS.cross} Este captcha ya no es válido. Pulsa **Verificarme** otra vez.`, flags: MessageFlags.Ephemeral });
      return true;
    }

    const cfg = await getVerificationConfig(guildId);
    const ttlMs = Number(cfg?.captchaTtlMs) || (2 * 60 * 1000);
    const length = Number(cfg?.captchaLength) || 6;
    const maxAttempts = Number(cfg?.maxAttempts) || 3;

    const challenge = (prev.type === 'advanced')
      ? createAdvancedChallenge({ guildId, userId, length, ttlMs, maxAttempts })
      : createChallenge({ guildId, userId, length, ttlMs, maxAttempts, type: 'captcha' });
    const png = await renderCaptchaPng(challenge.code);
    const buf = Buffer.isBuffer(png) ? png : Buffer.from(png);

    const extraText = (challenge.type === 'advanced' && challenge.question)
      ? `Reto extra: resuelve **${challenge.question}** y escríbelo en el modal.`
      : '';

    await respond(interaction, {
      ...buildCaptchaPayload({ nonce: challenge.nonce, extraText }),
      files: [{ attachment: buf, name: 'captcha.png' }],
    }, { preferUpdate: true });

    return true;
  }

  if (action === 'enter') {
    // verify:enter:<nonce>
    const nonce = id.split(':')[2];
    const item = getChallenge(nonce);
    if (!item || item.userId !== String(userId) || item.guildId !== String(guildId)) {
      await interaction.reply({ content: `${EMOJIS.cross} Este captcha ya no es válido. Pulsa **Nuevo captcha**.`, flags: MessageFlags.Ephemeral });
      return true;
    }

    const modal = new ModalBuilder();
    modal.setCustomId(`verify:submit:${nonce}`);
    modal.setTitle('Verificación');

    const input = new TextInputBuilder();
    input.setCustomId('captcha_code');
    input.setStyle(TextInputStyle.Short);
    input.setPlaceholder('Ej: A2K9MZ');
    input.setRequired(true);

    const label = new LabelBuilder();
    label.setLabel('Código de la imagen');
    label.setTextInputComponent(input);

    modal.addLabelComponents(label);

    if (item.type === 'advanced') {
      const input2 = new TextInputBuilder();
      input2.setCustomId('math_answer');
      input2.setStyle(TextInputStyle.Short);
      input2.setPlaceholder('Ej: 10');
      input2.setRequired(true);

      const label2 = new LabelBuilder();
      label2.setLabel(`Reto: ${item.question || 'resuelve la operación'}`);
      label2.setTextInputComponent(input2);
      modal.addLabelComponents(label2);
    }

    await interaction.showModal(modal).catch(() => null);
    return true;
  }

  // Acción no reconocida
  return true;
  } catch (err) {
    try {
      const msg = (err && err.message) ? String(err.message) : 'Error desconocido';
      const hint = msg.includes('MONGODB env var')
        ? 'Falta configurar `MONGODB` en el .env.'
        : 'Revisa permisos del bot y que hiciste `/verify set ...`.';
      const payload = {
        content: `${EMOJIS.cross} Error en verificación: **${msg}**\n${hint}`,
        flags: MessageFlags.Ephemeral,
      };
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload).catch(() => null);
      } else {
        await interaction.reply(payload).catch(() => null);
      }
    } catch {
      // noop
    }
    try {
      logger?.error?.('[verify] button handler error');
      logger?.error?.(err);
    } catch {
      // noop
    }
    return true;
  }
};
