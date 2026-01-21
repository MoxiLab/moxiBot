const { Collection } = require("discord.js");
const { getFiles } = require("./getFiles");
const { EMOJIS } = require("../Util/emojis");

module.exports = async (Moxi) => {
  Moxi.commands = new Collection();
  Moxi.slashcommands = new Collection();

  const commandFiles = getFiles("Comandos");
  const slashcommandsFiles = getFiles("Slashcmd");

  const logger = require("../Util/logger");

  const normalizeKey = (value) => {
    if (value === undefined || value === null) return '';
    return String(value)
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  };

  const ensurePrefixAliases = (commands) => {
    // Reservados: nombres de comandos + alias existentes (para evitar colisiones al autogenerar)
    const reserved = new Set();
    for (const c of commands.values()) {
      const name = normalizeKey(c?.name);
      if (name) reserved.add(name);
      const aliasArr = Array.isArray(c?.alias)
        ? c.alias
        : (Array.isArray(c?.aliases) ? c.aliases : []);
      for (const a of aliasArr) {
        const n = normalizeKey(a);
        if (n) reserved.add(n);
      }
    }

    for (const c of commands.values()) {
      if (!c || !c.name) continue;
      const name = normalizeKey(c.name);

      const existing = Array.isArray(c.alias)
        ? c.alias
        : (Array.isArray(c.aliases) ? c.aliases : []);

      const cleaned = Array.from(new Set((existing || []).map(normalizeKey).filter(Boolean)));

      // Si el comando tiene nombre con diacríticos (raro), agregar variante sin diacríticos.
      // (normalizeKey ya quita diacríticos; si cambia respecto al lower original, se notará aquí)
      // Nota: el nombre principal ya se resuelve por name exacto; esto es solo para alias.
      const nextAliases = [...cleaned];

      const hadAliases = nextAliases.length > 0;

      if (nextAliases.length === 0) {
        // Autogeneración: intentar prefijo único (2..6 chars). Si no, caer a name.
        for (let len = 2; len <= Math.min(6, name.length); len++) {
          const cand = name.slice(0, len);
          if (!cand) continue;
          if (cand === name) continue;
          if (reserved.has(cand)) continue;
          nextAliases.push(cand);
          reserved.add(cand);
          break;
        }
      }

      if (nextAliases.length === 0) {
        // Garantía mínima: que exista al menos 1 alias.
        nextAliases.push(name);
      }

      // Persistir en el formato principal del bot (alias)
      c.alias = Array.from(new Set(nextAliases.map(normalizeKey).filter(Boolean)));

      if (!hadAliases) {
        c.__autoAliasGenerated = true;
      }
    }
  };

  const normalizeCommandModule = (mod, filePath) => {
    if (!mod || typeof mod !== 'object') return null;

    // Formato actual del bot
    if (mod.name) return mod;

    // Formato alternativo (Name/Aliases/messageRun/interactionRun)
    if (mod.Name) {
      const name = String(mod.Name).trim();
      if (!name) return null;

      const alias = Array.isArray(mod.Aliases)
        ? mod.Aliases
          .map(a => (a === undefined || a === null) ? '' : String(a).trim().toLowerCase())
          .filter(Boolean)
        : [];
      const category = mod.Category || 'Other';
      const description = typeof mod.Description === 'function'
        ? mod.Description
        : (typeof mod.Description === 'string' ? (() => mod.Description) : undefined);

      const usage = typeof mod.Usage === 'string' && mod.Usage.trim()
        ? mod.Usage.trim()
        : (typeof mod.usage === 'string' && mod.usage.trim() ? mod.usage.trim() : undefined);

      // Estructura de comandos (Prefix/Slash) usada por el help para listar formatos
      const command = (mod.Command && typeof mod.Command === 'object') ? mod.Command : undefined;

      const run = async (client, ctx, args) => {
        const isInteraction = ctx?.isChatInputCommand?.() || ctx?.isCommand?.() || ctx?.isContextMenuCommand?.();
        if (isInteraction) {
          if (typeof mod.interactionRun === 'function') {
            return mod.interactionRun(client, ctx, ctx?.options ? [] : [], ctx?.guild?.settings);
          }
          throw new Error(`El comando ${name} no implementa interactionRun`);
        }
        if (typeof mod.messageRun === 'function') {
          return mod.messageRun(client, ctx, Array.isArray(args) ? args : [], ctx?.guild?.settings);
        }
        throw new Error(`El comando ${name} no implementa messageRun`);
      };

      return {
        name: name.toLowerCase(),
        alias,
        Category: category,
        description,
        usage,
        cooldown: mod.Cooldown,
        permissions: mod.Permissions,
        command,
        run,
        __sourceFile: filePath,
      };
    }

    return null;
  };

  for (const files of commandFiles) {
    const base = String(files).split(/[/\\]/g).pop() || '';
    if (base.startsWith('_')) continue; // helpers

    try {
      const raw = require(files);
      const command = normalizeCommandModule(raw, files);
      if (!command || !command.name) {
        logger.warn(`[Commands] Ignorado (sin name/Name): ${files}`);
        continue;
      }
      if (!command.__sourceFile) command.__sourceFile = files;
      Moxi.commands.set(command.name, command);
    } catch (err) {
      logger.error(`[Commands] Error cargando comando: ${files}`);
      logger.error(err);
    }
  }

  // Asegurar que todos los comandos prefix tienen alias (aunque sea autogenerado)
  try {
    ensurePrefixAliases(Moxi.commands);

    const autoFixed = Moxi.commands
      .filter((c) => c && c.__autoAliasGenerated)
      .map((c) => ({ name: c.name, alias: c.alias, file: c.__sourceFile }))
      .slice(0, 25);
    if (autoFixed.length) {
      logger.warn(`[Commands] Se autogeneraron alias en ${autoFixed.length} comando(s). Añade alias manualmente en sus archivos.`);
      for (const it of autoFixed) {
        logger.warn(`- ${it.name} -> alias: ${(it.alias || []).join(', ')} (${it.file || 'unknown file'})`);
      }
    }
  } catch (err) {
    logger.warn('[Commands] ensurePrefixAliases falló (best-effort)');
    logger.warn(err);
  }

  for (const file of slashcommandsFiles) {
    const slash = require(file);
    let data = slash.data || (slash.Command && slash.Command.data);
    if (data && data.name) {
      if (!slash.__sourceFile) slash.__sourceFile = file;
      Moxi.slashcommands.set(data.name, slash);
    }
    // No warning: los subcomandos no necesitan .data
  }
  const comandos = Moxi.commands.map(cmd => `• ${cmd.name}`).join("\n");
  const slashs = Moxi.slashcommands.map(slash => `• ${slash.data.name}`).join("\n");
  logger.startup && logger.startup(`${EMOJIS.burger} Comandos cargados (${Moxi.commands.size})`);
  logger.startup && logger.startup(`${EMOJIS.fries} Slashcommands cargados (${Moxi.slashcommands.size})`);
};
