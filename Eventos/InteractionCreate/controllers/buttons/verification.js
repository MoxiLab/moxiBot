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
const { getVerificationConfig } = require('../../../../Models/VerificationConfig');
const { renderCaptchaPng } = require('../../../../Util/verification/captcha');
const { createChallenge, getChallenge } = require('../../../../Util/verification/store');

function buildCaptchaPayload({ nonce, ttlLabel = '2 minutos' }) {
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
        `Caduca en **${ttlLabel}**.`
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

    const ttlMs = Number(cfg.captchaTtlMs) || (2 * 60 * 1000);
    const length = Number(cfg.captchaLength) || 6;
    const maxAttempts = Number(cfg.maxAttempts) || 3;

    const challenge = createChallenge({ guildId, userId, length, ttlMs, maxAttempts });
    const png = await renderCaptchaPng(challenge.code);
    const buf = Buffer.isBuffer(png) ? png : Buffer.from(png);

    await respond(interaction, {
      ...buildCaptchaPayload({ nonce: challenge.nonce }),
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

    const challenge = createChallenge({ guildId, userId, length, ttlMs, maxAttempts });
    const png = await renderCaptchaPng(challenge.code);
    const buf = Buffer.isBuffer(png) ? png : Buffer.from(png);

    await respond(interaction, {
      ...buildCaptchaPayload({ nonce: challenge.nonce }),
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
