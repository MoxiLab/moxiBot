const { Collection } = require("discord.js");
const { getFiles } = require("./getFiles");
const { EMOJIS } = require("../Util/emojis");

module.exports = async (Moxi) => {
  Moxi.commands = new Collection();
  Moxi.slashcommands = new Collection();

  const commandFiles = getFiles("Comandos");
  const slashcommandsFiles = getFiles("Slashcmd");

  const logger = require("../Util/logger");

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
      Moxi.commands.set(command.name, command);
    } catch (err) {
      logger.error(`[Commands] Error cargando comando: ${files}`);
      logger.error(err);
    }
  }

  for (const file of slashcommandsFiles) {
    const slash = require(file);
    let data = slash.data || (slash.Command && slash.Command.data);
    if (data && data.name) {
      Moxi.slashcommands.set(data.name, slash);
    }
    // No warning: los subcomandos no necesitan .data
  }
  const comandos = Moxi.commands.map(cmd => `• ${cmd.name}`).join("\n");
  const slashs = Moxi.slashcommands.map(slash => `• ${slash.data.name}`).join("\n");
  logger.startup && logger.startup(`${EMOJIS.burger} Comandos cargados (${Moxi.commands.size})`);
  logger.startup && logger.startup(`${EMOJIS.fries} Slashcommands cargados (${Moxi.slashcommands.size})`);
};
