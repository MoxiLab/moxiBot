// Centraliza la construcción del help (Components V2) para cualquier página/categoría
const { StringSelectMenuBuilder, ContainerBuilder, MessageFlags, ButtonBuilder, ButtonStyle } = require('discord.js');
const moxi = require('../i18n');
const { EMOJIS } = require('./emojis');
const logger = require('./logger');
const debugHelper = require('./debugHelper');
const Config = require('../Config');
const { Bot } = Config;

const HELP_INDEX_TTL_MS = 5 * 60 * 1000;
let HELP_INDEX_CACHE = null;
const SLASH_JSON_CACHE = new WeakMap();

function normalizeCategoryKey(value) {
  if (!value || typeof value !== 'string') return value;
  // Si i18n aún no está listo, algunos comandos devuelven claves tipo "commands:CATEGORY_HERRAMIENTAS".
  // Convertimos esas claves a categorías estables para que el help funcione en cualquier idioma.
  const upper = value.toUpperCase();
  if (upper.includes('CATEGORY_HERRAMIENTAS') || upper.includes('HERRAMIENTAS')) return 'Tools';
  if (upper.includes('CATEGORY_MUSICA') || upper.includes('MUSICA')) return 'Music';
  if (upper.includes('CATEGORY_ADMIN')) return 'Admin';
  if (upper.includes('CATEGORY_MODERATION') || upper.includes('MODERATION') || upper.includes('MODERACION')) return 'Moderation';
  if (upper.includes('CATEGORY_ROOT')) return 'Root';

  // Equivalentes árabes (por si el value viene ya traducido)
  if (value.includes('الأدوات')) return 'Tools';
  if (value.includes('الموسيقى')) return 'Music';
  if (value.includes('الإدارة')) return 'Admin';
  if (value.includes('الإشراف')) return 'Moderation';
  if (value.includes('المالك')) return 'Root';
  if (value.includes('نظام الترحيب')) return 'Welcome';

  // Inglés por si viene como etiqueta
  if (upper.includes('WELCOME')) return 'Welcome';
  return value;
}

function buildHelpIndex(Moxi) {
  // Obtener todos los comandos del bot y deduplicar por nombre (prefiere el de prefijo)
  let allCommands = [];
  let commandsArr = [];
  let slashArr = [];

  if (Moxi) {
    commandsArr = Array.from(Moxi.commands?.values?.() || []);
    slashArr = Array.from(Moxi.slashcommands?.values?.() || []);
  } else {
    try {
      const globalClient = require('../index');
      commandsArr = Array.from(globalClient.commands?.values?.() || []);
      slashArr = Array.from(globalClient.slashcommands?.values?.() || []);
    } catch {
      commandsArr = [];
      slashArr = [];
    }
  }

  const seen = new Set();
  for (const _cmd of [...commandsArr, ...slashArr]) {
    if (!_cmd) continue;
    let cmdName = _cmd.name || (_cmd.data && _cmd.data.name);
    if (!cmdName) continue;
    if (seen.has(cmdName)) continue;
    seen.add(cmdName);
    let cmd = _cmd;
    if (!cmd.name && cmd.data && cmd.data.name) {
      cmd = { ...cmd, name: cmd.data.name };
    }
    allCommands.push(cmd);
  }

  // Agrupar por clave interna (no traducida)
  const categoriasBase = {};
  for (const cmd of allCommands) {
    // Garantizar que la clave de categoría sea una string y resolver funciones.
    let catKey;
    if (typeof cmd.Category === 'function') {
      try {
        catKey = cmd.Category('en-US');
      } catch {
        catKey = String(cmd.Category || '');
      }
    } else if (typeof cmd.category === 'function') {
      try {
        catKey = cmd.category('en-US');
      } catch {
        catKey = String(cmd.category || '');
      }
    } else {
      catKey = cmd.Category || cmd.category;
    }
    if (typeof catKey !== 'string') catKey = String(catKey || '');
    catKey = normalizeCategoryKey(catKey);
    if (!catKey) continue;
    if (!categoriasBase[catKey]) categoriasBase[catKey] = [];
    categoriasBase[catKey].push(cmd);
  }

  return {
    builtAt: Date.now(),
    allCommands,
    categoriasBase,
  };
}

function getHelpIndex(Moxi) {
  const now = Date.now();
  if (!HELP_INDEX_CACHE || !HELP_INDEX_CACHE.builtAt || (now - HELP_INDEX_CACHE.builtAt) > HELP_INDEX_TTL_MS) {
    HELP_INDEX_CACHE = buildHelpIndex(Moxi);
  }
  return HELP_INDEX_CACHE;
}

/**
 * Devuelve el contenido del help (Components V2) para la página/categoría/tipo indicada
 * @param {Object} options - { page, totalPages, tipo, categoria }
 * @returns {{ content: string, components: [ContainerBuilder], flags: number }}
 */
async function getHelpContent({ page = 0, totalPages, tipo = 'main', categoria = null, client: Moxi, lang = 'es-ES', userId = null, guildId = null, useV2 = false } = {}) {
  const isRtl = typeof lang === 'string' && /^ar(-|$)/i.test(lang);

  // Asegurar que la categoría entrante coincide con las claves internas.
  categoria = normalizeCategoryKey(categoria);

  const helpDebugEnabled = debugHelper.isEnabled('help');
  const useComponentsV2 = true;

  // Obtener prefijo real del servidor si hay guildId
  const globalPrefix = (Array.isArray(Config?.Bot?.Prefix) && Config.Bot.Prefix[0])
    ? Config.Bot.Prefix[0]
    : (process.env.PREFIX || '.');

  const prefix = await moxi.guildPrefix(guildId, globalPrefix);
  const { allCommands, categoriasBase } = getHelpIndex(Moxi);

  // Root solo para dueño real del bot (Discord application owner / Team member)
  let canSeeRoot = false;
  if (userId) {
    try {
      const { isDiscordOnlyOwner } = require('./ownerPermissions');
      let resolvedClient = Moxi;
      if (!resolvedClient) {
        try { resolvedClient = require('../index'); } catch { }
      }
      canSeeRoot = await isDiscordOnlyOwner({ client: resolvedClient, userId });
    } catch { }
  }
  // Build category list for select menu, ocultando Root si no es owner
  const categorias = {};
  for (const [catKey, arr] of Object.entries(categoriasBase || {})) {
    if (!catKey) continue;
    if (catKey === 'Root' && !canSeeRoot) continue;
    categorias[catKey] = arr;
  }

  if (helpDebugEnabled) {
    const summary = Object.entries(categorias)
      .map(([k, arr]) => `${k}:${arr.length}`)
      .sort();
    debugHelper.log('help', `lang=${lang} guildId=${guildId || 'n/a'} userId=${userId || 'n/a'} categorias=${summary.join(' | ')}`);
  }

  const totalCategories = Object.keys(categorias).length;
  const totalCommandsVisible = Object.values(categorias).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
  const categoryKeys = Object.keys(categorias).slice(0, 25);

  // Filtrar por categoría si corresponde
  let bienvenidaCategoria = '';
  let filteredCommands = allCommands;
  if (categoria) {
    // Si la categoría es Root y no es owner, no mostrar nada
    if (categoria === 'Root' && !canSeeRoot) {
      const { buildNoticeContainer, asV2MessageOptions } = require('./v2Notice');
      return asV2MessageOptions(
        buildNoticeContainer({
          emoji: EMOJIS.cross,
          title: moxi.translate('HELP_TITLE', lang) || 'Help',
          text: moxi.translate('HELP_CATEGORY_NO_PERMISSION', lang),
        })
      );
    }
    try {
      const normalize = str => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      let key = '';
      if (categoria === 'Tools') {
        key = 'HELP_CATEGORY_TOOLS_DESC';
      } else if (categoria === 'Music') {
        key = 'HELP_CATEGORY_MUSIC_DESC';
      } else if (categoria === 'Admin') {
        key = 'HELP_CATEGORY_ADMIN_DESC';
      } else if (categoria === 'Welcome') {
        key = 'HELP_CATEGORY_WELCOME_DESC';
      } else {
        key = 'HELP_CATEGORY_' + normalize(categoria).replace(/\s+/g, '_').toUpperCase() + '_DESC';
      }
      bienvenidaCategoria = moxi.translate(key, lang);
    } catch { }
    // Filtrar por clave interna
    filteredCommands = categorias[categoria] || [];

    if (helpDebugEnabled) {
      const names = filteredCommands.map(c => c.name || (c.data && c.data.name)).filter(Boolean);
      debugHelper.log('help', `categoria=${categoria} totalCmds=${filteredCommands.length} page=${page}`);
      debugHelper.log('help', `categoria=${categoria} cmdNames=${names.slice(0, 25).join(', ')}${names.length > 25 ? ' ...' : ''}`);
    }
  }
  // Paginación
  const pageSize = 10;
  const total = filteredCommands.length;
  const totalPagesCalc = Math.ceil(total / pageSize) || 1;
  if (typeof totalPages !== 'number') totalPages = totalPagesCalc;
  if (page < 0) page = 0;
  if (page > totalPages - 1) page = totalPages - 1;
  const cmds = filteredCommands.slice(page * pageSize, (page + 1) * pageSize);
  const formatCmd = (cmd) => {
    let lines = [];
    // Mostrar ambos formatos si el comando es de prefijo y/o slash
    if (cmd.command && cmd.command.Prefix) {
      lines.push(`${prefix}${cmd.name}`);
    }
    // Mostrar slash principal y subcomandos si existen
    if ((cmd.command && cmd.command.Slash) || (cmd.data && cmd.data.toJSON)) {
      let slashName = cmd.name;
      let subcmds = [];
      if (cmd.data && cmd.data.toJSON) {
        let data = SLASH_JSON_CACHE.get(cmd.data);
        if (!data) {
          data = cmd.data.toJSON();
          SLASH_JSON_CACHE.set(cmd.data, data);
        }
        slashName = data.name;
        if (Array.isArray(data.options)) {
          subcmds = data.options.filter(opt => opt.type === 1).map(opt => opt.name);
        }
      }
      if (subcmds.length) {
        for (const sub of subcmds) {
          lines.push(`/${slashName} ${sub}`);
        }
      } else {
        lines.push(`/${slashName}`);
      }
    }
    // Si solo es slash clásico (sin .command), mostrar como /comando
    if (!lines.length && cmd.data && cmd.data.toJSON) {
      let data = SLASH_JSON_CACHE.get(cmd.data);
      if (!data) {
        data = cmd.data.toJSON();
        SLASH_JSON_CACHE.set(cmd.data, data);
      }
      if (Array.isArray(data.options)) {
        const subcmds = data.options.filter(opt => opt.type === 1).map(opt => opt.name);
        for (const sub of subcmds) {
          lines.push(`/${data.name} ${sub}`);
        }
      } else {
        lines.push(`/${data.name}`);
      }
    }
    // Si solo es prefijo clásico
    if (!lines.length) {
      lines.push(`${prefix}${cmd.name}`);
    }
    // Evitar duplicados y multilinea (cada uso es una línea)
    return Array.from(new Set(lines.map(l => String(l).trim()).filter(Boolean)));
  };
  let desc = '';
  if (categoria) {
    desc = bienvenidaCategoria ? bienvenidaCategoria + '\n\n' : '';
    if (cmds.length) {
      const cmdLabels = cmds.flatMap(formatCmd);
      if (isRtl) {
        // RTL: lista simple para evitar problemas visuales
        desc += cmdLabels.map(l => `» ${l}`).join('\n');
      } else {
        // LTR: 3 columnas sin ``` y sin tabla (usa padding con NBSP)
        const cols = 3;
        const zws = '\u200b';
        const nbsp = '\u00A0';
        const rows = [];
        for (let i = 0; i < cmdLabels.length; i += cols) {
          rows.push(cmdLabels.slice(i, i + cols));
        }

        const colWidths = [0, 0, 0];
        for (const row of rows) {
          for (let i = 0; i < cols; i++) {
            const cell = row[i] ? `» ${row[i]}` : '';
            colWidths[i] = Math.max(colWidths[i], cell.length);
          }
        }

        const padTo = (text, width) => {
          const s = String(text || '');
          const missing = Math.max(0, width - s.length);
          return s + nbsp.repeat(missing);
        };

        const body = rows
          .map((row) => {
            const c1 = row[0] ? `» ${row[0]}` : zws;
            const c2 = row[1] ? `» ${row[1]}` : zws;
            const c3 = row[2] ? `» ${row[2]}` : zws;
            // Espacio extra entre columnas
            return (
              padTo(c1, colWidths[0]) + nbsp.repeat(6) +
              padTo(c2, colWidths[1]) + nbsp.repeat(6) +
              padTo(c3, colWidths[2])
            );
          })
          .join('\n');
        desc += body;
      }
    } else {
      desc += moxi.translate('HELP_NO_COMMANDS', lang);
    }

    if (helpDebugEnabled) {
      debugHelper.log('help', `categoria=${categoria} descPreview=${String(desc).slice(0, 180).replace(/\n/g, '\\n')}`);
    }
  } else {
    desc = moxi.translate('HELP_HOME_DESCRIPTION', lang).replace('{{prefix}}', prefix);
    // Agregar lista de categorías disponibles
    if (categoryKeys.length) {
      const catLabels = categoryKeys.map(catKey => {
        const key = 'HELP_CATEGORY_' + catKey.replace(/\s+/g, '_').toUpperCase();
        let label = moxi.translate(key, lang);
        if (label === key) label = catKey;
        return label;
      });

      // Categorías como lista (una por línea). En RTL evitamos blockquotes/underline
      const catBlock = isRtl
        ? catLabels.map(l => `• ${l}`).join('\n')
        : catLabels.map(l => `> ${l}`).join('\n');

      if (isRtl) {
        desc += `\n\n${moxi.translate('HELP_CATEGORIES_LIST', lang)}:\n${catBlock}`;
      } else {
        desc += `\n\n__${moxi.translate('HELP_CATEGORIES_LIST', lang)}__\n${catBlock}`;
      }
    }
  }

  // Totales al final (abajo) SOLO en el main (home)
  if (!categoria) {
    const totalsLine = `${moxi.translate('HELP_TOTAL_CATEGORIES', lang)}: ${totalCategories}\n${moxi.translate('HELP_TOTAL_COMMANDS', lang)}: ${totalCommandsVisible}`;
    if (desc) desc += `\n${totalsLine}`;
    else desc = totalsLine;
  }

  // If desc is empty, set to null to avoid Discord.js validation error
  if (!desc || desc.trim() === '') desc = null;
  let titulo = moxi.translate('HELP_TITLE', lang);
  if (categoria) {
    // Mapeo explícito de categorías
    const categoryMap = {
      'Administración': 'HELP_CATEGORY_ADMIN',
      'Admin': 'HELP_CATEGORY_ADMIN',
      'Moderation': 'HELP_CATEGORY_MODERATION',
      'Moderación': 'HELP_CATEGORY_MODERATION',
      'Music': 'HELP_CATEGORY_MUSIC',
      'Música': 'HELP_CATEGORY_MUSIC',
      'Root': 'HELP_CATEGORY_ROOT',
      'Tools': 'HELP_CATEGORY_TOOLS',
      'Herramientas': 'HELP_CATEGORY_TOOLS',
      'Welcome': 'HELP_CATEGORY_WELCOME',
      'Sistema de bienvenida': 'HELP_CATEGORY_WELCOME'
    };
    let categoriaKey = categoryMap[categoria] || `HELP_CATEGORY_${categoria.toUpperCase()}`;
    let categoriaTraducida = moxi.translate(categoriaKey, lang);
    let categoriaFinal = categoriaTraducida !== categoriaKey ? categoriaTraducida : categoria;
    titulo += `: ${categoriaFinal}`;
  }
  // -------------------------
  // Components V2 mode
  // -------------------------
  if (useComponentsV2) {
    const container = new ContainerBuilder().setAccentColor(Bot.AccentColor);
    const safeDesc = desc || moxi.translate('HELP_NO_CONTENT', lang);

    if (helpDebugEnabled) {
      debugHelper.log(
        'help',
        `getHelpContent(render:v2) lang=${lang} categoria=${categoria || 'home'} page=${page} totalPages=${totalPages} ` +
        `title=${String(titulo).slice(0, 120)} descPreview=${String(safeDesc).slice(0, 220).replace(/\n/g, '\\n')}${String(safeDesc).length > 220 ? ' ...' : ''}`
      );
    }

    container.addTextDisplayComponents(c => c.setContent(isRtl ? `**${titulo}**` : `## ${titulo}`));
    container.addSeparatorComponents(s => s.setDivider(true));
    container.addTextDisplayComponents(c => c.setContent(safeDesc));

    // Select menu (categorías)
    container.addSeparatorComponents(s => s.setDivider(true));
    const selectMenuV2 = new StringSelectMenuBuilder()
      .setCustomId('help2-categorias')
      .setPlaceholder(moxi.translate('HELP_SELECT_PLACEHOLDER', lang))
      .addOptions(categoryKeys.map(catKey => {
        const key = 'HELP_CATEGORY_' + catKey.replace(/\s+/g, '_').toUpperCase();
        let label = moxi.translate(key, lang);
        if (label === key) label = catKey;
        return {
          label,
          value: catKey,
          emoji: EMOJIS.package,
          default: categoria === catKey
        };
      }));
    container.addActionRowComponents(row => row.addComponents(selectMenuV2));

    // Botones
    if (!categoria) {
      const closeButton = new ButtonBuilder()
        .setCustomId('help2_close')
        .setEmoji(EMOJIS.cross)
        .setStyle(ButtonStyle.Secondary);

      const webLabel = moxi.translate('HELP_WEB_LABEL', lang);
      let webUrl = moxi.translate('HELP_WEB_URL', lang);
      if (!webUrl || typeof webUrl !== 'string' || !/^https?:\/\//.test(webUrl)) {
        webUrl = 'https://moxibot.es';
      }
      const webButton = new ButtonBuilder()
        .setLabel(webLabel)
        .setStyle(ButtonStyle.Link)
        .setURL(webUrl);

      container.addActionRowComponents(row => row.addComponents(closeButton, webButton));
    } else {
      const stateCat = categoria || '';
      const state = `${page}:${totalPages || 1}:${stateCat}`;

      const prevButton = new ButtonBuilder()
        .setCustomId(`help2_prev:${state}`)
        .setEmoji(EMOJIS.arrowLeft)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled((totalPages || 1) <= 1 || page <= 0);

      const homeButton = new ButtonBuilder()
        .setCustomId(`help2_home:${state}`)
        .setEmoji(EMOJIS.home)
        .setStyle(ButtonStyle.Secondary);

      const infoButton = new ButtonBuilder()
        .setCustomId(`help2_info:${state}`)
        .setEmoji(EMOJIS.info)
        .setStyle(ButtonStyle.Secondary);

      const closeButton = new ButtonBuilder()
        .setCustomId('help2_close')
        .setEmoji(EMOJIS.cross)
        .setStyle(ButtonStyle.Secondary);

      const nextButton = new ButtonBuilder()
        .setCustomId(`help2_next:${state}`)
        .setEmoji(EMOJIS.arrowRight)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled((totalPages || 1) <= 1 || page >= (totalPages || 1) - 1);

      container.addActionRowComponents(row => row.addComponents(prevButton, homeButton, infoButton, closeButton, nextButton));
    }

    // Footer/thanks
    container.addSeparatorComponents(s => s.setDivider(true));
    container.addTextDisplayComponents(c => c.setContent(moxi.translate('HELP_THANKS_FOOTER', lang, { botName: Moxi?.user?.username || 'BOT' })));

    return { content: '', components: [container], flags: MessageFlags.IsComponentsV2 };
  }

  // Fallback (no debería ejecutarse porque el help es siempre V2)
  const { buildNoticeContainer, asV2MessageOptions } = require('./v2Notice');
  return asV2MessageOptions(
    buildNoticeContainer({
      emoji: EMOJIS.cross,
      title: moxi.translate('HELP_TITLE', lang) || 'Help',
      text: moxi.translate('HELP_NO_CONTENT', lang) || 'No hay información de ayuda disponible.',
    })
  );
}

module.exports = getHelpContent;
