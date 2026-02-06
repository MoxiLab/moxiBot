const {
  ContainerBuilder,
  MessageFlags,
  ButtonStyle,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
} = require('discord.js');

const { ButtonBuilder } = require('../../../../Util/compatButtonBuilder');

const { Bot } = require('../../../../Config');
const { EMOJIS } = require('../../../../Util/emojis');
const { getVerificationConfig } = require('../../../../Models/VerificationConfig');
const { renderCaptchaPng } = require('../../../../Util/verification/captcha');
const { createChallenge, tryVerify } = require('../../../../Util/verification/store');

function getModalTextValue(interaction, customId) {
  // discord.js v15 (PR) usa ModalComponentResolver en `interaction.components`
  try {
    const viaResolver = interaction?.components?.getTextInputValue?.(customId);
    if (typeof viaResolver === 'string') return viaResolver;
  } catch {
    // ignore
  }

  try {
    const direct = interaction.fields?.getTextInputValue?.(customId);
    if (typeof direct === 'string') return direct;
  } catch {
    // ignore
  }

  try {
    const fields = interaction.fields?.fields;
    if (fields && typeof fields.get === 'function') {
      const item = fields.get(customId);
      if (item && typeof item.value === 'string') return item.value;

      // Algunas builds no indexan por customId; busca en los valores.
      if (typeof fields.values === 'function') {
        for (const v of fields.values()) {
          const cid = v?.customId || v?.custom_id || v?.data?.custom_id;
          const val = v?.value || v?.data?.value;
          if (String(cid) === String(customId) && typeof val === 'string') return val;
        }
      }

      // Fallback final: si solo hay 1 campo, usa su value.
      if (typeof fields.size === 'number' && fields.size === 1 && typeof fields.values === 'function') {
        const only = fields.values().next?.().value;
        const val = only?.value || only?.data?.value;
        if (typeof val === 'string') return val;
      }

      // Alternativa: algunos Collections tienen .first()
      if (typeof fields.first === 'function') {
        const only = fields.first();
        const val = only?.value || only?.data?.value;
        if (typeof val === 'string') return val;
      }
    }
  } catch {
    // ignore
  }

  // Raw API data (varía por build)
  try {
    const raw = interaction?.data?.components || interaction?.data?.data?.components || interaction?.components;
    if (Array.isArray(raw)) {
      let firstValue = '';
      let valuesFound = 0;

      for (const row of raw) {
        const inner = row?.components || row?.data?.components || row?.value?.components;
        if (!Array.isArray(inner)) continue;
        for (const c of inner) {
          const cid = c?.custom_id || c?.customId || c?.data?.custom_id || c?.data?.customId;
          const val = c?.value || c?.data?.value;
          if (typeof val === 'string') {
            if (!firstValue) firstValue = val;
            valuesFound += 1;
          }
          if (String(cid) === String(customId) && typeof val === 'string') return val;
        }
      }

      // Si hay exactamente 1 valor en todo el payload, úsalo.
      if (valuesFound === 1 && typeof firstValue === 'string') return firstValue;
    }
  } catch {
    // ignore
  }

  try {
    const fields = interaction.fields;
    // Algunas builds exponen los componentes como array
    const comps = fields?.components || fields?.data?.components;
    if (Array.isArray(comps)) {
      for (const row of comps) {
        const inner = row?.components || row?.data?.components;
        if (!Array.isArray(inner)) continue;
        for (const c of inner) {
          const cid = c?.customId || c?.custom_id || c?.data?.custom_id;
          const val = c?.value || c?.data?.value;
          if (String(cid) === String(customId) && typeof val === 'string') return val;
        }
      }
    }
  } catch {
    // ignore
  }

  return '';
}

function normalizeCaptchaInput(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
}

function debugModalExtraction(logger, interaction, { nonce, extractedRaw, extractedNormalized }) {
  try {
    if (!process.env.VERIFY_DEBUG && !process.env.DEBUG) return;
    const fields = interaction?.fields?.fields;
    const keys = (fields && typeof fields.keys === 'function') ? Array.from(fields.keys()) : [];
    const size = (fields && typeof fields.size === 'number') ? fields.size : null;
    const rawComps = interaction?.data?.components || interaction?.data?.data?.components || interaction?.components;
    const rows = Array.isArray(rawComps) ? rawComps.length : null;
    const resolver = interaction?.components;
    const resolverHasGet = typeof resolver?.getTextInputValue === 'function';
    const resolverHoistedSize = (resolver && resolver.hoistedComponents && typeof resolver.hoistedComponents.size === 'number')
      ? resolver.hoistedComponents.size
      : null;
    const payload = {
      nonce,
      extractedLen: typeof extractedRaw === 'string' ? extractedRaw.length : null,
      extractedNormalizedLen: typeof extractedNormalized === 'string' ? extractedNormalized.length : null,
      fieldsSize: size,
      fieldsKeys: keys.slice(0, 10),
      rawComponentRows: rows,
      resolverHasGet,
      resolverHoistedSize,
    };

    // Logger (si existe)
    logger?.info?.('[verify] modal extract debug', payload);

    // Consola: siempre visible aunque el logger filtre levels
    // eslint-disable-next-line no-console
    console.log('[VERIFY_DEBUG] modal extract debug', payload);
  } catch {
    // ignore
  }
}

function buildEphemeral({ title, body }) {
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

function buildCaptchaPayload({ nonce }) {
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
    .addTextDisplayComponents(c => c.setContent('Nuevo captcha generado. Mira la imagen adjunta y pulsa **Introducir código**.'))
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

module.exports = async function verificationModal(interaction, Moxi, logger) {
  const id = String(interaction.customId || '');
  if (!id.startsWith('verify:submit:')) return false;

  try {

  const guildId = interaction.guildId || interaction.guild?.id;
  const userId = interaction.user?.id;
  if (!guildId || !userId) return true;

  const nonce = id.split(':')[2];
  const inputRaw = getModalTextValue(interaction, 'captcha_code');
  const input = normalizeCaptchaInput(inputRaw);

  if (process.env.VERIFY_DEBUG || process.env.DEBUG) {
    try {
      const fields = interaction?.fields?.fields;
      const size = (fields && typeof fields.size === 'number') ? fields.size : null;
      // eslint-disable-next-line no-console
      console.log('[VERIFY_DEBUG] modal submit', {
        nonce,
        guildId,
        userId,
        fieldsSize: size,
        extractedLen: typeof inputRaw === 'string' ? inputRaw.length : null,
        extractedNormalizedLen: typeof input === 'string' ? input.length : null,
      });
    } catch {
      // ignore
    }
  }

  const cfg = await getVerificationConfig(guildId);
  if (!cfg?.enabled || !cfg?.verifiedRoleId) {
    await interaction.reply(buildEphemeral({
      title: 'Verificación',
      body: `${EMOJIS.cross} La verificación no está configurada.`,
    }));
    return true;
  }

  if (!input) {
    debugModalExtraction(logger, interaction, { nonce, extractedRaw: inputRaw, extractedNormalized: input });
    await interaction.reply(buildEphemeral({
      title: 'Verificación',
      body: `${EMOJIS.cross} No recibí ningún código. Vuelve a abrir el modal e inténtalo otra vez.`,
    }));
    return true;
  }

  const res = tryVerify(nonce, { guildId, userId, input });
  if (!res.ok) {
    if (res.reason === 'invalid') {
      debugModalExtraction(logger, interaction, { nonce, extractedRaw: inputRaw, extractedNormalized: input });
      await interaction.reply(buildEphemeral({
        title: 'Verificación',
        body: `${EMOJIS.cross} Código incorrecto. Intentos restantes: **${res.remaining}**.`,
      }));
      return true;
    }

    // expired / max_attempts / mismatch => regenerar challenge (más friendly)
    const ttlMs = Number(cfg.captchaTtlMs) || (2 * 60 * 1000);
    const length = Number(cfg.captchaLength) || 6;
    const maxAttempts = Number(cfg.maxAttempts) || 3;

    const challenge = createChallenge({ guildId, userId, length, ttlMs, maxAttempts });
    const png = await renderCaptchaPng(challenge.code);
    const buf = Buffer.isBuffer(png) ? png : Buffer.from(png);

    await interaction.reply({
      ...buildCaptchaPayload({ nonce: challenge.nonce }),
      files: [{ attachment: buf, name: 'captcha.png' }],
    });
    return true;
  }

  // OK => roles
  const guild = interaction.guild;
  const member = guild?.members?.cache?.get(userId) || await guild?.members?.fetch?.(userId).catch(() => null);
  if (!member) {
    await interaction.reply(buildEphemeral({
      title: 'Verificación',
      body: `${EMOJIS.cross} No pude obtener tu miembro del servidor.`,
    }));
    return true;
  }

  try {
    await member.roles.add(cfg.verifiedRoleId, 'Verificación captcha');
  } catch (err) {
    await interaction.reply(buildEphemeral({
      title: 'Verificación',
      body: `${EMOJIS.cross} No pude asignar el rol. Revisa permisos/jerarquía del bot.`,
    }));
    return true;
  }

  if (cfg.unverifiedRoleId) {
    try {
      await member.roles.remove(cfg.unverifiedRoleId, 'Verificación completada');
    } catch {
      // best-effort
    }
  }

  await interaction.reply(buildEphemeral({
    title: 'Verificación',
    body: `${EMOJIS.tick} ¡Verificación completada!`,
  }));

  return true;
  } catch (err) {
    try {
      const msg = (err && err.message) ? String(err.message) : 'Error desconocido';
      const hint = msg.includes('MONGODB env var')
        ? 'Falta configurar `MONGODB` en el .env.'
        : 'Revisa permisos/jerarquía de roles del bot.';
      const payload = buildEphemeral({
        title: 'Verificación',
        body: `${EMOJIS.cross} Error: **${msg}**\n${hint}`,
      });
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload).catch(() => null);
      } else {
        await interaction.reply(payload).catch(() => null);
      }
    } catch {
      // noop
    }
    try {
      logger?.error?.('[verify] modal handler error');
      logger?.error?.(err);
    } catch {
      // noop
    }
    return true;
  }
};
