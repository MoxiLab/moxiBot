const Moxi = require("../../index");
const mentionPanel = require('../Client/mentionPanel');
const Config = require('../../Config');

const { getGuildSettingsCached } = require('../../Util/guildSettings');
const { getSettings: getBugSettings } = require('../../Util/bugStorage');
const moxi = require('../../i18n');
const logger = require('../../Util/logger');
const debugHelper = require('../../Util/debugHelper');
const { isOwnerOnlyModeEnabled, isOwnerUser, getOwnerOnlyPrefix } = require('../../Util/ownerOnlyMode');
const { trackBotUserUsage } = require('../../Util/botUsageTracker');
const { awardXpForMessage } = require('../../Util/levels');
const afkStorage = require('../../Util/afkStorage');
const { buildAfkContainer, formatAfkTimestamp, formatAfkDuration } = require('../../Util/afkRender');
const { resolveAfkGif } = require('../../Util/afkGif');
const { EMOJIS } = require('../../Util/emojis');
const { PermissionsBitField, MessageFlags } = require('discord.js');

const AFK_OVERRIDE_GIF = process.env.AFK_GIF_URL;
const AFK_MENTION_GIF_URL = process.env.AFK_MENTION_GIF_URL || AFK_OVERRIDE_GIF;
const AFK_CLEARED_GIF_URL = process.env.AFK_CLEARED_GIF_URL || AFK_OVERRIDE_GIF;

function normalizeKey(value) {
  if (value === undefined || value === null) return '';
  return String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

const LOCALIZED_CMD_MAP_TTL_MS = 10 * 60 * 1000;
const localizedCommandMapCache = new Map(); // lang -> { expiresAt, map }

function isUntranslated(key, value) {
  if (value === undefined || value === null) return true;
  const v = String(value);
  if (!v) return true;
  if (v === key) return true;
  const withoutNs = String(key).includes(':') ? String(key).split(':').pop() : String(key);
  if (v === withoutNs) return true;
  return false;
}

function getLocalizedCommandMap(lang) {
  const keyLang = (lang && typeof lang === 'string') ? lang : 'es-ES';
  const now = Date.now();
  const cached = localizedCommandMapCache.get(keyLang);
  if (cached && cached.expiresAt > now) return cached.map;

  // Si i18n aún no cargó el namespace, no cachear por mucho tiempo.
  if (!moxi.i18next?.isInitialized || !moxi.i18next?.hasResourceBundle?.(keyLang, 'commands')) {
    const map = new Map();
    localizedCommandMapCache.set(keyLang, { expiresAt: now + 2000, map });
    return map;
  }

  const map = new Map();
  const values = Array.from(Moxi.commands?.values?.() || []);

  const addIfValid = (localizedName, canonicalName) => {
    const loc = (localizedName === undefined || localizedName === null) ? '' : String(localizedName).trim();
    if (!loc) return;
    // Debe ser un solo token (sin espacios) para poder ejecutarlo como comando.
    if (/\s/.test(loc)) return;
    const k = loc.toLowerCase();
    if (!k) return;
    if (map.has(k)) return; // evita colisiones
    map.set(k, canonicalName);
  };

  for (const cmd of values) {
    const canonicalName = (cmd && cmd.name) ? String(cmd.name).trim().toLowerCase() : '';
    if (!canonicalName) continue;

    const baseName = String(cmd.name);
    const candidates = [
      // Probar uppercase primero (la mayoría de keys están así)
      `commands:CMD_${baseName.toUpperCase()}_NAME`,
      `commands:CMD_${baseName}_NAME`,
      `commands:CMD_${baseName.toLowerCase()}_NAME`,
    ];

    for (const c of candidates) {
      const t = moxi.translate(c, keyLang);
      if (t && !isUntranslated(c, t)) {
        addIfValid(t, canonicalName);
      }
    }
  }

  localizedCommandMapCache.set(keyLang, { expiresAt: now + LOCALIZED_CMD_MAP_TTL_MS, map });
  return map;
}

function uniqStrings(values) {
  const out = [];
  const seen = new Set();
  for (const v of values) {
    const s = (v === undefined || v === null) ? '' : String(v).trim();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

function matchPrefix(content, prefixes) {
  for (const p of prefixes) {
    if (!p) continue;
    const prefix = String(p);
    if (prefix.length === 0) continue;

    // Prefijo por mención del bot: <@id> o <@!id> (requiere espacio o fin)
    if (/^<@!?\d+>$/.test(prefix)) {
      if (content === prefix) return { matched: prefix, rest: '' };
      if (content.startsWith(prefix + ' ')) return { matched: prefix, rest: content.slice(prefix.length).trimStart() };
      continue;
    }

    // Prefijo tipo palabra: debe ir seguido de espacio o fin
    if (/^[A-Za-z0-9_]+$/.test(prefix)) {
      // 'moxi' y abreviatura 'mx' siempre activos y case-insensitive (MOXI/Mx/...)
      const lowerPrefix = prefix.toLowerCase();
      if (lowerPrefix === 'moxi' || lowerPrefix === 'mx') {
        const lower = content.toLowerCase();
        if (lower === lowerPrefix) return { matched: prefix, rest: '' };
        if (lower.startsWith(lowerPrefix + ' ')) {
          return { matched: prefix, rest: content.slice(lowerPrefix.length).trimStart() };
        }
        continue;
      }

      if (content === prefix) return { matched: prefix, rest: '' };
      if (content.startsWith(prefix + ' ')) return { matched: prefix, rest: content.slice(prefix.length).trimStart() };
      continue;
    }

    // Prefijo de símbolo
    if (content.startsWith(prefix)) {
      return { matched: prefix, rest: content.slice(prefix.length) };
    }
  }
  return null;
}

Moxi.on("messageCreate", async (message) => {

  if (message.channel.type === 'dm') return;
  if (message.author.bot) return;

  // Modo privado: solo owners pueden usar comandos y con prefijo dedicado.
  // Importante: aquí cortamos temprano para evitar que miembros disparen handlers de comandos.
  const ownerOnlyEnabled = isOwnerOnlyModeEnabled();
  const requesterId = message.author?.id;
  const requesterIsOwner = ownerOnlyEnabled ? await isOwnerUser({ client: Moxi, userId: requesterId }) : false;
  if (ownerOnlyEnabled && !requesterIsOwner) return;

  const globalPrefixes = (Array.isArray(Config?.Bot?.Prefix) && Config.Bot.Prefix.length)
    ? Config.Bot.Prefix
    : [process.env.PREFIX || '.'];

  const mentionPrefixes = Moxi?.user?.id
    ? [`<@${Moxi.user.id}>`, `<@!${Moxi.user.id}>`]
    : [];

  let prefix = globalPrefixes[0];
  let settings = null;
  try {
    settings = await getGuildSettingsCached(message.guild.id);
    message.guild.settings = settings;
    // Compat: algunos comandos nuevos usan message.translate('misc:KEY', vars)
    const dbLang = settings?.Language ?? settings?.language ?? settings?.LANGUAGE ?? settings?.lang;
    const langForTranslate = dbLang ? String(dbLang) : (process.env.DEFAULT_LANG || 'es-ES');
    message.lang = langForTranslate;
    message.translate = (key, vars = {}) => moxi.translate(key, langForTranslate, vars);
    // Prefijo principal centralizado (sin depender de cómo venga settings.Prefix)
    prefix = await moxi.guildPrefix(message.guild.id, globalPrefixes[0]);
  } catch {
    // fallback a globalPrefix
    prefix = globalPrefixes[0];
    const langForTranslate = process.env.DEFAULT_LANG || 'es-ES';
    message.lang = langForTranslate;
    message.translate = (key, vars = {}) => moxi.translate(key, langForTranslate, vars);
  }

  const raw = settings?.Prefix;
  debugHelper.log('prefix', `guildId=${message.guild.id} global=${JSON.stringify(globalPrefixes)} settings.Prefix=${JSON.stringify(raw)} resolved=${prefix}`);

  // Prefijos activos:
  // - Si hay prefijo en DB, usar ese; si no, los globales
  // - Siempre permitir la mención del bot
  // - Siempre permitir 'moxi' y 'mx' (case-insensitive) como prefijo palabra
  // Nota: antes se añadía '.' como prefijo "universal" por compat, lo que hacía
  // que el bot siguiera respondiendo a '.' aunque el prefijo real fuese otro.
  const prefixesToUse = ownerOnlyEnabled
    ? uniqStrings([getOwnerOnlyPrefix({ fallback: globalPrefixes[0] }), ...mentionPrefixes])
    : uniqStrings([...(settings?.Prefix ? [prefix] : globalPrefixes), ...mentionPrefixes, 'moxi', 'mx']);
  const matched = matchPrefix(message.content, prefixesToUse);

  // IMPORTANTE: no queremos que ciertos comandos (p.ej. say) quiten el estado AFK del usuario.
  let skipAfkCleanup = false;
  if (matched) {
    const parts = matched.rest.trim().split(/ +/g);
    const maybeCmd = (parts.shift() || '').toLowerCase();
    if (maybeCmd === 'say' || maybeCmd === 'decir' || maybeCmd === 'sayu' || maybeCmd === 'sayuser') {
      skipAfkCleanup = true;
    }
  }

  try {
    if (!skipAfkCleanup) {
      await handleAfkCleanup(message);
    }
  } catch (error) {
    debugHelper?.error?.('afk-cleanup', 'handleAfkCleanup failed', error);
  }

  // Responder a la mención del bot (solo si el mensaje es SOLO la mención)
  if (message.mentions.has(Moxi.user) && message.content.trim().replace(/<@!?\d+>/g, '').length === 0) {
    // prefix ya resuelto desde settings/cache arriba
    // 'moxi' sigue activo como prefijo alternativo, pero no lo mostramos en el panel.
    const panelResult = await mentionPanel({ client: Moxi, message, prefix });
    // Si el resultado es nulo, undefined o no tiene contenido ni embeds, no enviar nada
    if (!panelResult) return;
    if (
      (panelResult.content === undefined || panelResult.content === '') &&
      (!panelResult.embeds || panelResult.embeds.length === 0) &&
      (!panelResult.components || panelResult.components.length === 0)
    ) {
      return;
    }
    return message.reply(panelResult);
  }

  // Sistema de niveles (usa ClvlsSchema): solo otorgar XP si NO es un comando.
  // Importante: esto ocurre después de resolver settings/prefix para poder detectar comandos.
  if (!matched) {
    try {
      await awardXpForMessage(message);
    } catch (err) {
      // Nunca romper el handler por fallos de niveles.
      debugHelper.error('levels', '[levels] awardXpForMessage failed', err);
    }
  }
  try {
    await handleBugThreadStatus(message);
  } catch (error) {
    debugHelper?.error?.('bug-status', 'handleBugThreadStatus failed', error);
  }
  try {
    await handleAfkMentions(message);
  } catch (error) {
    debugHelper?.error?.('afk-mention', 'handleAfkMentions failed', error);
  }
  if (!matched) return;

  const args = matched.rest.trim().split(/ +/g);
  const command = args.shift().toLowerCase();


  let cmd = Moxi.commands.get(command);
  if (!cmd) {
    cmd = Moxi.commands.find(c => Array.isArray(c.alias) && c.alias.includes(command));
  }

  // Si no existe, intenta resolver por nombre localizado según el idioma de la guild.
  if (!cmd) {
    const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
    const map = getLocalizedCommandMap(lang);
    const canonical = map.get(command);
    if (canonical) {
      cmd = Moxi.commands.get(canonical);
      if (!cmd) {
        cmd = Moxi.commands.find(c => String(c.name || '').trim().toLowerCase() === canonical);
      }
    }
  }
  if (cmd) {
    try {
      const uid = message.author?.id;
      if (uid && !message.author?.bot) {
        trackBotUserUsage({ userId: uid, guildId: message.guild?.id, source: 'prefix', name: cmd.name || command });
      }
    } catch (_) {
      // best-effort
    }
    const handleCommand = require('../../Util/commandHandler');
    await handleCommand(Moxi, message, args, cmd);
  }

});

async function handleBugThreadStatus(message) {
  if (!message?.guild) return;
  const channel = message.channel;
  if (!channel || typeof channel.isThread !== 'function' || !channel.isThread()) return;
  const bugSettings = await getBugSettings(message.guild.id);
  if (!bugSettings?.forumChannelId) return;
  if (channel.parentId !== bugSettings.forumChannelId) return;

  const statusTags = (bugSettings.tagIds && bugSettings.tagIds.status) ? bugSettings.tagIds.status : {};
  const pendingTagId = statusTags.pending;
  const completeTagId = statusTags.complete;
  if (!pendingTagId) return;

  const appliedTags = Array.isArray(channel.appliedTags) ? channel.appliedTags : [];
  if (completeTagId && appliedTags.includes(completeTagId)) return;

  const member = message.member;
  if (!member) return;
  const perms = member.permissions;
  if (!perms) return;
  const isStaff = perms.has(PermissionsBitField.Flags.ManageMessages, true)
    || perms.has(PermissionsBitField.Flags.ManageGuild, true)
    || perms.has(PermissionsBitField.Flags.ManageChannels, true)
    || perms.has(PermissionsBitField.Flags.Administrator, true);
  if (!isStaff) return;

  if (appliedTags.includes(pendingTagId)) return;
  await channel.setAppliedTags([pendingTagId]).catch(() => null);
}

async function handleAfkCleanup(message) {
  if (!message || !message.author) return;
  const wasAfk = await afkStorage.clearAfk(message.author.id);
  if (!wasAfk) return;
  const container = buildAfkContainer({
    title: message.translate('AFK_CLEARED_TITLE'),
    lines: [message.translate('AFK_CLEARED_DETAIL', { user: message.author.tag })],
    gifUrl: await resolveAfkGif(AFK_CLEARED_GIF_URL),
  });
  const response = await message.reply({
    content: '',
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { repliedUser: false },
  }).catch(() => null);
  scheduleAutoDelete(response, message.channel);
}

async function handleAfkMentions(message) {
  if (!message?.guild) return;
  const lang = message.lang || (process.env.DEFAULT_LANG || 'es-ES');
  const mentions = Array.from(message.mentions.users.values()).filter(user => !user.bot && user.id !== message.author.id);
  if (!mentions.length) return;
  const entries = [];
  for (const user of mentions) {
    const entry = await afkStorage.getAfkEntry(user.id, message.guild.id);
    if (!entry) continue;
    entries.push({ user, entry });
  }
  if (!entries.length) return;
  const limit = Math.min(entries.length, 4);
  const lines = [];
  for (let index = 0; index < limit; index += 1) {
    const { user, entry } = entries[index];
    if (entry.scope === 'guild') {
      lines.push(`${EMOJIS.person} ${user.toString()} · ${user.tag}`);
      lines.push(message.translate('AFK_SCOPE_GUILD'));
      lines.push(message.translate('AFK_MESSAGE_LINE', { message: entry.message || message.translate('AFK_DEFAULT_MESSAGE') }));
      lines.push(message.translate('AFK_DURATION', { duration: formatAfkDuration(entry.createdAt, lang) }));
      lines.push(message.translate('AFK_SINCE', { since: formatAfkTimestamp(entry.createdAt, lang) }));
      if (index < limit - 1) {
        lines.push('');
      }
    }
  }
  const container = buildAfkContainer({
    title: message.translate('AFK_MENTION_TITLE'),
    lines,
    gifUrl: await resolveAfkGif(AFK_MENTION_GIF_URL),
  });
  const response = await message.reply({
    content: '',
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { repliedUser: false },
  }).catch(() => null);
  scheduleAutoDelete(response, message.channel);
}

const AFK_RESPONSE_LIFETIME_MS = Number(process.env.AFK_RESPONSE_LIFETIME_MS) || 30000;

function scheduleAutoDelete(response, channel) {
  if (!response) return;
  if (!channel || channel.type === 'dm') return;
  setTimeout(() => response.delete().catch(() => null), AFK_RESPONSE_LIFETIME_MS);
}