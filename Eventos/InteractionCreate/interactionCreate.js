const Moxi = require("../../index");

const moxi = require('../../i18n');
const { getGuildSettingsCached } = require('../../Util/guildSettings');
const debugHelper = require('../../Util/debugHelper');
const { trackBotUserUsage } = require('../../Util/botUsageTracker');

const selectMenuController = require("./controllers/selectMenu");
const buttonController = require("./controllers/button");
const modalController = require("./controllers/modals");

Moxi.on("interactionCreate", async (interaction) => {
  if (interaction.channel.type === 'dm') return;

  try {
    const uid = interaction.user?.id;
    if (uid && !interaction.user?.bot) {
      const kind = interaction.isCommand?.() ? 'slash'
        : interaction.isButton?.() ? 'button'
          : (interaction.isStringSelectMenu?.() || (interaction.isChannelSelectMenu && interaction.isChannelSelectMenu())) ? 'select'
            : (interaction.isModalSubmit && interaction.isModalSubmit()) ? 'modal'
              : 'interaction';
      const name = interaction.isCommand?.()
        ? interaction.commandName
        : (typeof interaction.customId === 'string' ? interaction.customId : null);
      trackBotUserUsage({ userId: uid, guildId: interaction.guildId || interaction.guild?.id, source: kind, name });
    }
  } catch (_) {
    // best-effort
  }
  const logger = require("../../Util/logger");
  const { buildNoticeContainer } = require('../../Util/v2Notice');
  const { EMOJIS } = require('../../Util/emojis');
  const { MessageFlags } = require('discord.js');

  async function safeRespond(interaction, payload) {
    try {
      if (!interaction.deferred && !interaction.replied) return await interaction.reply(payload);
      if (!interaction.replied) return await interaction.followUp(payload).catch(() => null);
      if (interaction.message && typeof interaction.message.edit === 'function') return await interaction.message.edit(payload).catch(() => null);
      return null;
    } catch (err) {
      try {
        if (!interaction.replied) return await interaction.reply(payload).catch(() => null);
        return await interaction.followUp(payload).catch(() => null);
      } catch (e) {
        return null;
      }
    }
  }

  // Compat: algunos comandos usan interaction.translate('ns:KEY', vars)
  try {
    const guildId = interaction.guildId || interaction.guild?.id;
    let lang = process.env.DEFAULT_LANG || 'es-ES';
    if (guildId) {
      const settings = await getGuildSettingsCached(guildId);
      if (interaction.guild) interaction.guild.settings = settings;
      if (settings?.Language) lang = String(settings.Language);
    }
    interaction.translate = (key, vars = {}) => moxi.translate(key, lang, vars);
  } catch {
    const lang = process.env.DEFAULT_LANG || 'es-ES';
    interaction.translate = (key, vars = {}) => moxi.translate(key, lang, vars);
  }

  try {
    // Autocomplete (slash options)
    if (interaction.isAutocomplete && interaction.isAutocomplete()) {
      const slashcmd = Moxi.slashcommands.get(interaction.commandName);
      if (!slashcmd || typeof slashcmd.autocomplete !== 'function') return;
      try {
        await slashcmd.autocomplete(Moxi, interaction);
      } catch (err) {
        // best-effort; evita romper el handler
      }
      return;
    }

    if (interaction.isCommand()) {
      const slashcmd = Moxi.slashcommands.get(interaction.commandName);
      if (!slashcmd) {
        logger.error(`[Slash] Comando no encontrado: ${interaction.commandName}`);
        return;
      }
      logger.info(`[Slash] Ejecutando: ${interaction.commandName}`);
      try {
        const handleCommand = require('../../Util/commandHandler');
        await handleCommand(Moxi, interaction, [], slashcmd);
      } catch (err) {
        logger.error(`[Slash] Error ejecutando ${interaction.commandName}:\n${err}`);
      }
    } else if (interaction.isStringSelectMenu() || (interaction.isChannelSelectMenu && interaction.isChannelSelectMenu())) {
      try {
        if (interaction.customId === 'help-categorias' || interaction.customId === 'help2-categorias') {
          debugHelper.log('help', `[SelectRoute] received customId=${interaction.customId} values=${Array.isArray(interaction.values) ? interaction.values.join(',') : 'n/a'} guildId=${interaction.guildId || 'n/a'} userId=${interaction.user?.id || 'n/a'}`);
        }
      } catch (e) { }
      await selectMenuController(interaction, Moxi, logger);
    } else if (interaction.isButton()) {
      await buttonController(interaction, Moxi, logger);
    } else if (interaction.isModalSubmit && interaction.isModalSubmit()) {
      await modalController(interaction, Moxi, logger);
      if (interaction.customId && interaction.customId.startsWith('help2_jump_modal:')) {
        const moxi = require("../../i18n");
        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        // customId: help2_jump_modal:totalPages:categoria
        const parts = String(interaction.customId).split(':');
        const totalPages = Number(parts[1] || 1);
        const categoria = parts.slice(2).join(':') || null;

        const pageInput = interaction.fields.getTextInputValue('help_jump_page');
        let page = parseInt(pageInput, 10) - 1;
        const safeTotal = isNaN(totalPages) || totalPages <= 0 ? 1 : totalPages;
        if (isNaN(page) || page < 0 || page >= safeTotal) {
          await interaction.reply({
            content: '',
            components: [buildNoticeContainer({ emoji: EMOJIS.cross, text: moxi.translate('HELP_INVALID_PAGE', lang, { total: safeTotal }) })],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
          });
          return;
        }
        const getHelpContent = require('../../Util/getHelpContent');
        const help = await getHelpContent({ page, totalPages: safeTotal, tipo: 'jump', categoria, client: Moxi, lang, guildId, userId: interaction.user?.id, useV2: true });
        await interaction.update(help);
      } else if (interaction.customId === 'help_jump_modal') {
        const moxi = require("../../i18n");
        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        let categoria = null;
        let totalPages = 1;
        if (interaction.message?.embeds?.[0]?.footer?.text) {
          const pageWord = moxi.translate('PAGE', lang) || 'Página';
          // Construir la expresión regular usando la palabra traducida
          const regex = new RegExp(`${pageWord} (\\d+) de (\\d+)`);
          const match = interaction.message.embeds[0].footer.text.match(regex);
          if (match) {
            totalPages = parseInt(match[2], 10);
          }
        }
        if (interaction.message?.embeds?.[0]?.title) {
          const title = interaction.message.embeds[0].title;
          const helpTitle = moxi.translate('HELP_TITLE', lang) || 'Ayuda';
          const catRegex = new RegExp(`^${helpTitle}:?\\s*:?(.*)$`);
          const catMatch = title.match(catRegex);
          if (catMatch) {
            let rawCategoria = catMatch[1].trim();
            const normalize = (str) => str.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, '_').toUpperCase();
            let categoriaKey = `HELP_CATEGORY_${normalize(rawCategoria)}`;
            let categoriaTraducida = moxi.translate(categoriaKey, lang);
            let categoriaKeyEn = categoriaKey;
            // Log para depuración
            console.log('Categoría detectada:', rawCategoria);
            console.log('Clave generada:', categoriaKey);
            console.log('Traducción obtenida:', categoriaTraducida);
            if (categoriaTraducida === categoriaKey) {
              categoriaKeyEn = `HELP_CATEGORY_${rawCategoria.toUpperCase()}`;
              categoriaTraducida = moxi.translate(categoriaKeyEn, lang);
              console.log('Clave alternativa:', categoriaKeyEn);
              console.log('Traducción alternativa:', categoriaTraducida);
            }
            categoria = categoriaTraducida !== categoriaKey && categoriaTraducida !== categoriaKeyEn ? categoriaTraducida : rawCategoria;
          }
        }
        const pageInput = interaction.fields.getTextInputValue('help_jump_page');
        let page = parseInt(pageInput, 10) - 1;
        if (isNaN(page) || page < 0 || page >= totalPages) {
          await safeRespond(interaction, {
            content: '',
            components: [buildNoticeContainer({ emoji: EMOJIS.cross, text: moxi.translate('HELP_INVALID_PAGE', lang, { total: totalPages }) })],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
          });
          return;
        }
        const getHelpContent = require('../../Util/getHelpContent');
        const help = await getHelpContent({ page, totalPages, tipo: 'jump', categoria, client: Moxi, lang, guildId, userId: interaction.user?.id });
        await interaction.update(help);
      }
    }
  } catch (e) {
    console.error(e);
  }
});