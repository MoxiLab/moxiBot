const Moxi = require("../../index");
const mentionPanel = require('../Client/mentionPanel');
const Config = require('../../Config');

const { getGuildSettingsCached } = require('../../Util/guildSettings');
const { getSettings: getBugSettings } = require('../../Util/bugStorage');
const moxi = require('../../i18n');
const logger = require('../../Util/logger');
const debugHelper = require('../../Util/debugHelper');
const { trackBotUserUsage } = require('../../Util/botUsageTracker');
const { awardXpForMessage } = require('../../Util/levels');
const afkStorage = require('../../Util/afkStorage');
const { buildAfkContainer, formatAfkTimestamp, formatAfkDuration } = require('../../Util/afkRender');
const { resolveAfkGif } = require('../../Util/afkGif');
const { EMOJIS } = require('../../Util/emojis');
const { PermissionsBitField, MessageFlags } = require('discord.js');
const { getAiConfig } = require('../../Util/aiModeStorage');
const { maybeAutoReplyWithAi } = require('../../Util/aiAutoReply');
const { isOwnerWithClient } = require('../../Util/ownerPermissions');
const { maybeHandleAiChatConfigMessage } = require('../../Util/aiChatConfig');
const { isWeatherQuestion, getWeatherForText, formatWeatherReplyEs } = require('../../Util/weather');

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
    if (canonicalName) {
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
  }

  localizedCommandMapCache.set(keyLang, { expiresAt: now + LOCALIZED_CMD_MAP_TTL_MS, map });
  return map;
}

function resolvePrefixCommandByToken({ token, lang }) {
  const t = (token === undefined || token === null) ? '' : String(token).trim().toLowerCase();
  if (!t) return null;

  let cmd = Moxi.commands.get(t);
  if (!cmd) {
    cmd = Moxi.commands.find(c => Array.isArray(c.alias) && c.alias.includes(t));
  }

  if (!cmd) {
    const map = getLocalizedCommandMap(lang);
    const canonical = map.get(t);
    if (canonical) {
      cmd = Moxi.commands.get(canonical);
      if (!cmd) {
        cmd = Moxi.commands.find(c => String(c.name || '').trim().toLowerCase() === canonical);
      }
    }
  }

  return cmd || null;
}

function parseNoPrefixCommandCandidate(text) {
  const raw = (text === undefined || text === null) ? '' : String(text).trim();
  if (!raw) return null;

  // Evitar capturar mensajes largos tipo párrafo
  if (raw.length > 2000) return null;

  // Permitir frases tipo "ejecuta help" / "usa ping" / "haz afk ..."
  const lower = raw.toLowerCase();
  const stripped = lower
    .replace(/^\s*(?:moxi|mx)\s+/i, '')
    .replace(/^\s*(?:ejecuta|ejecutar|usa|utiliza|haz|hace|pon|ponme|activa|desactiva)\s+/i, '')
    .trim();

  const parts = stripped.split(/\s+/g).filter(Boolean);
  if (!parts.length) return null;

  // Quitar palabras de relleno frecuentes
  const fillers = new Set([
    'el', 'la', 'los', 'las',
    'un', 'una', 'unos', 'unas',
    'comando', 'comandos',
    'cmd', 'cmds',
    'command', 'commands',
    'orden', 'ordenes',
    'porfavor', 'por', 'favor',
  ]);

  while (parts.length && fillers.has(String(parts[0]).toLowerCase())) {
    parts.shift();
  }

  if (!parts.length) return null;
  const command = String(parts[0] || '')
    .replace(/^[.!]/, '')
    .replace(/[?!.。,]+$/g, '')
    .trim();
  const args = parts.slice(1).map((a) => String(a).replace(/[?!.。,]+$/g, ''));
  return { command, args };
}

function extractFirstUserRef(text) {
  const t = (text === undefined || text === null) ? '' : String(text);
  if (!t) return '';
  const m = t.match(/<@!?\d+>/);
  if (m) return m[0];
  const m2 = t.match(/\b\d{17,20}\b/);
  if (m2) return m2[0];
  return '';
}

function deriveModerationCandidateFromNaturalLanguage(text) {
  const raw = (text === undefined || text === null) ? '' : String(text).trim();
  if (!raw) return null;

  const userRef = extractFirstUserRef(raw);
  if (!userRef) return null;

  const lower = raw.toLowerCase();

  const starts = (re) => re.test(lower);
  const afterUser = () => {
    const idx = raw.indexOf(userRef);
    if (idx === -1) return '';
    return raw.slice(idx + userRef.length).trim();
  };

  // BAN
  if (starts(/^(?:moxi|mx)?\s*(?:banea|banear|ban)\b/)) {
    const rest = afterUser();
    const args = [userRef, ...rest.split(/\s+/g).filter(Boolean)];
    return { command: 'ban', args };
  }

  // UNBAN
  if (starts(/^(?:moxi|mx)?\s*(?:desbanea|unban)\b/)) {
    const rest = afterUser();
    const args = [userRef, ...rest.split(/\s+/g).filter(Boolean)];
    return { command: 'unban', args };
  }

  // KICK
  if (starts(/^(?:moxi|mx)?\s*(?:expulsa|expulsar|kick|kickea)\b/)) {
    const rest = afterUser();
    const args = [userRef, ...rest.split(/\s+/g).filter(Boolean)];
    return { command: 'kick', args };
  }

  // TIMEOUT/MUTE
  if (starts(/^(?:moxi|mx)?\s*(?:timeout|silencia|silenciar|mute|muta|mutear)\b/)) {
    const rest = afterUser();
    const tokens = rest.split(/\s+/g).filter(Boolean);
    // detectar duración simple tipo 10m, 2h, 1d, 30s
    const durIdx = tokens.findIndex((x) => /^\d+\s*[smhd]$/i.test(x) || /^\d+(?:\.\d+)?\s*(?:min|mins|minute|minutes|hora|horas|hour|hours|dia|dias|day|days)$/i.test(x) || /^\d+[smhd]$/i.test(x));
    let duration = '';
    if (durIdx >= 0) {
      duration = tokens.splice(durIdx, 1)[0];
    }
    const args = duration ? [userRef, duration, ...tokens] : [userRef, ...tokens];
    return { command: 'timeout', args, fallbackCommands: ['mute'] };
  }

  // UNMUTE/UNTIMEOUT
  if (starts(/^(?:moxi|mx)?\s*(?:unmute|desmutea|desmutear|quita\s+mute|quita\s+timeout|untimeout)\b/)) {
    const rest = afterUser();
    const args = [userRef, ...rest.split(/\s+/g).filter(Boolean)];
    return { command: 'unmute', args, fallbackCommands: ['untimeout'] };
  }

  return null;
}

function requiresModerationPerm(cmdName) {
  const n = (cmdName === undefined || cmdName === null) ? '' : String(cmdName).trim().toLowerCase();
  if (!n) return null;
  if (n === 'ban' || n === 'unban') return PermissionsBitField.Flags.BanMembers;
  if (n === 'kick') return PermissionsBitField.Flags.KickMembers;
  if (n === 'timeout' || n === 'mute' || n === 'unmute' || n === 'untimeout') return PermissionsBitField.Flags.ModerateMembers;
  if (n === 'warn') return PermissionsBitField.Flags.ManageMessages;
  return null;
}

function uniqStrings(values) {
  const out = [];
  const seen = new Set();
  for (const v of values) {
    const s = (v === undefined || v === null) ? '' : String(v).trim();
    if (s && !seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

function matchPrefix(content, prefixes) {
  for (const p of prefixes) {
    if (p) {
      const prefix = String(p);
      if (prefix.length > 0) {
        // Prefijo por mención del bot: <@id> o <@!id> (requiere espacio o fin)
        if (/^<@!?\d+>$/.test(prefix)) {
          if (content === prefix) return { matched: prefix, rest: '' };
          if (content.startsWith(prefix + ' ')) return { matched: prefix, rest: content.slice(prefix.length).trimStart() };
        }
        else {
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
            }
            else {
              if (content === prefix) return { matched: prefix, rest: '' };
              if (content.startsWith(prefix + ' ')) return { matched: prefix, rest: content.slice(prefix.length).trimStart() };
            }
          }
          else {
            // Prefijo de símbolo
            if (content.startsWith(prefix)) {
              return { matched: prefix, rest: content.slice(prefix.length) };
            }
          }
        }
      }
    }
  }
  return null;
}

Moxi.on("messageCreate", async (message) => {

  if (message.channel.type === 'dm') return;
  if (message.author.bot) return;

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
  // Nota: añadimos '.' como prefijo "universal" para comandos estilo .bag
  const prefixesToUse = uniqStrings([...(settings?.Prefix ? [prefix] : globalPrefixes), '.', ...mentionPrefixes, 'moxi', 'mx']);
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

  // Modo IA por canal: responde sin necesidad de mención ni prefijo.
  // Regla: solo si el mensaje NO es un comando.
  if (!matched) {
    try {
      const cfgRes = await getAiConfig(message.guild?.id, message.channel?.id);
      const cfg = cfgRes?.config;
      if (cfg?.enabled) {
        const guildOwnerId = message.guild?.ownerId || message.guild?.owner?.id || null;

        // Tiempo/clima en tiempo real: resolver con API pública (sin OpenAI)
        // Importante: debe funcionar aunque el canal esté en modo owners-only.
        try {
          if (isWeatherQuestion(message.content)) {
            const wx = await getWeatherForText(message.content);
            if (wx.ok) {
              const content = formatWeatherReplyEs(wx);
              await message.reply({ content, allowedMentions: { repliedUser: false, parse: [] } }).catch(async () => {
                await message.channel.send({ content, allowedMentions: { parse: [] } }).catch(() => null);
              });
              return;
            }

            // Si es claramente una pregunta de clima, pero falta ubicación, pedirla explícitamente
            if (wx && (wx.reason === 'missing_location' || wx.reason === 'location_not_found')) {
              const content = (wx.reason === 'missing_location')
                ? '¿De qué ciudad? Ej: "tiempo en Madrid" o "clima mañana en Toronto".'
                : 'No encontré esa ubicación. Prueba con ciudad + país/estado (ej: "Madrid, España").';
              await message.reply({ content, allowedMentions: { repliedUser: false, parse: [] } }).catch(async () => {
                await message.channel.send({ content, allowedMentions: { parse: [] } }).catch(() => null);
              });
              return;
            }
          }
        } catch {
          // si falla el weather, seguimos al flujo IA normal
        }

        // Configurable: owners-only (por defecto ON)
        const ownersOnly = cfg.ownersOnly !== false;
        let isOwner = null;
        if (ownersOnly) {
          try {
            isOwner = await isOwnerWithClient({ client: Moxi, userId: message.author?.id, guildOwnerId });
            if (!isOwner) return;
          } catch {
            return;
          }
        }

        // Personalización "conversando": si el owner escribe "prompt: ..." / "modelo: ..." etc.
        // lo guardamos y no pasamos el mensaje a OpenAI.
        try {
          if (isOwner === null) {
            isOwner = await isOwnerWithClient({ client: Moxi, userId: message.author?.id, guildOwnerId });
          }
          if (isOwner) {
            const handled = await maybeHandleAiChatConfigMessage(message);
            if (handled?.handled) return;
          }
        } catch {
          // si falla, seguimos con el flujo normal
        }

        // Ejecutar comandos de prefijo sin prefijo (solo en canal IA)
        // Por seguridad: por defecto solo owners, a menos que se habilite explícitamente.
        try {
          const canRunNoPrefix = cfg.commandsWithoutPrefix !== false;
          const allowNonOwners = cfg.commandsAllowNonOwners === true;
          const requireDiscordPerms = cfg.commandsRequireDiscordPerms !== false;

          if (canRunNoPrefix) {
            if (isOwner === null) {
              isOwner = await isOwnerWithClient({ client: Moxi, userId: message.author?.id, guildOwnerId });
            }

            const allowed = allowNonOwners ? true : !!isOwner;
            if (allowed) {
              const candidate = parseNoPrefixCommandCandidate(message.content) || deriveModerationCandidateFromNaturalLanguage(message.content);
              if (candidate?.command) {
                const lang = message.lang || (process.env.DEFAULT_LANG || 'es-ES');

                // Resolver comando (con posibles fallbacks si el nombre cambia en este bot)
                let cmd = resolvePrefixCommandByToken({ token: candidate.command, lang });
                if (!cmd && Array.isArray(candidate.fallbackCommands)) {
                  for (const fb of candidate.fallbackCommands) {
                    cmd = resolvePrefixCommandByToken({ token: fb, lang });
                    if (cmd) break;
                  }
                }

                if (cmd) {
                  // Si no es owner y es un comando de moderación, exigir permisos Discord.
                  if (!isOwner && allowNonOwners && requireDiscordPerms) {
                    const required = requiresModerationPerm(cmd.name || candidate.command);
                    if (required) {
                      const memberPerms = message.member?.permissions;
                      if (!memberPerms || !memberPerms.has(required, true)) {
                        return;
                      }
                    }
                  }

                  const handleCommand = require('../../Util/commandHandler');
                  try {
                    const uid = message.author?.id;
                    if (uid && !message.author?.bot) {
                      trackBotUserUsage({ userId: uid, guildId: message.guild?.id, source: 'ai-command', name: cmd.name || candidate.command });
                    }
                  } catch {
                    // best-effort
                  }
                  await handleCommand(Moxi, message, candidate.args || [], cmd);
                  return;
                }
              }
            }
          }
        } catch {
          // si falla, seguimos con el flujo IA normal
        }

        const hasKey = typeof process.env.OPENAI_API_KEY === 'string' && process.env.OPENAI_API_KEY.trim();
        if (!hasKey) return;

        const result = await maybeAutoReplyWithAi(message, {
          lang: message.lang || 'es-ES',
          systemPrompt: cfg.systemPrompt,
          model: cfg.model,
          temperature: cfg.temperature,
          cooldownMs: cfg.cooldownMs,
          historyLimit: cfg.historyLimit,
          minChars: cfg.minChars,
          maxInputChars: cfg.maxInputChars,
        });

        // Si falla, loguear. Opcionalmente avisar solo a owners para debug.
        if (result && result.ok === false) {
          const errCode = result.error || result.reason || 'unknown';
          const details = result.details ? String(result.details) : '';
          debugHelper?.warn?.('ai', `auto ai reply failed: ${errCode}${details ? ' | ' + details : ''}`);

          const showToOwners = String(process.env.AI_SHOW_ERRORS_TO_OWNERS || '1').trim() !== '0';
          if (showToOwners) {
            try {
              if (isOwner === null) {
                isOwner = await isOwnerWithClient({ client: Moxi, userId: message.author?.id, guildOwnerId });
              }
              if (isOwner) {
                const short = details ? details.slice(0, 200) : '';
                await message.reply({
                  content: `IA error: ${errCode}${short ? ` (${short})` : ''}`,
                  allowedMentions: { repliedUser: false, parse: [] },
                }).catch(() => null);
              }
            } catch {
              // ignore
            }
          }
        }
      }
    } catch (err) {
      debugHelper?.error?.('ai', 'auto ai reply failed', err);
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

  // Idioma para resolver nombres localizados (y para el mapa de comandos)
  const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
  let cmd = resolvePrefixCommandByToken({ token: command, lang });

  // Si el usuario usa el prefijo palabra "moxi/mx" pero escribe una frase tipo
  // "moxi ejecuta ...", el comando real no es "ejecuta".
  // En ese caso, intentamos el router de "comandos sin prefijo" con el resto del texto.
  if (!cmd) {
    const usedPrefixWord = matched?.matched && /^[A-Za-z0-9_]+$/.test(String(matched.matched))
      ? String(matched.matched).trim().toLowerCase()
      : '';
    if (usedPrefixWord === 'moxi' || usedPrefixWord === 'mx') {
      const cfgRes = await getAiConfig(message.guild?.id, message.channel?.id);
      const cfg = cfgRes?.config;
      if (cfg?.enabled && cfg.commandsWithoutPrefix !== false) {
        const guildOwnerId = message.guild?.ownerId || message.guild?.owner?.id || null;
        let isOwner = null;
        try {
          isOwner = await isOwnerWithClient({ client: Moxi, userId: message.author?.id, guildOwnerId });
        } catch {
          isOwner = false;
        }

        const allowNonOwners = cfg.commandsAllowNonOwners === true;
        const requireDiscordPerms = cfg.commandsRequireDiscordPerms !== false;
        const allowed = allowNonOwners ? true : !!isOwner;

        if (allowed) {
          const candidate = parseNoPrefixCommandCandidate(matched.rest) || deriveModerationCandidateFromNaturalLanguage(matched.rest);
          if (candidate?.command) {
            cmd = resolvePrefixCommandByToken({ token: candidate.command, lang });
            if (!cmd && Array.isArray(candidate.fallbackCommands)) {
              for (const fb of candidate.fallbackCommands) {
                cmd = resolvePrefixCommandByToken({ token: fb, lang });
                if (cmd) break;
              }
            }
            if (cmd) {
              if (!isOwner && allowNonOwners && requireDiscordPerms) {
                const required = requiresModerationPerm(cmd.name || candidate.command);
                if (required) {
                  const memberPerms = message.member?.permissions;
                  if (!memberPerms || !memberPerms.has(required, true)) {
                    return;
                  }
                }
              }

              try {
                const uid = message.author?.id;
                if (uid && !message.author?.bot) {
                  trackBotUserUsage({ userId: uid, guildId: message.guild?.id, source: 'ai-command', name: cmd.name || candidate.command });
                }
              } catch {
                // best-effort
              }

              const handleCommand = require('../../Util/commandHandler');
              await handleCommand(Moxi, message, candidate.args || [], cmd);
              return;
            }
          }
        }
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

    if (entry) entries.push({ user, entry });
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