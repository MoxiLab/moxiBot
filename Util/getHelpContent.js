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
  if (upper.includes('CATEGORY_ECONOMIA') || upper.includes('ECONOMIA') || upper.includes('ECONOMÍA')) return 'Economy';
  if (upper.includes('CATEGORY_HERRAMIENTAS') || upper.includes('HERRAMIENTAS')) return 'Tools';
  if (upper.includes('CATEGORY_MUSICA') || upper.includes('MUSICA')) return 'Music';
  if (upper.includes('CATEGORY_ADMIN')) return 'Admin';
  if (upper.includes('CATEGORY_MODERATION') || upper.includes('MODERATION') || upper.includes('MODERACION')) return 'Moderation';
  if (upper.includes('CATEGORY_ROOT')) return 'Root';

  // Fun / Diversión
  if (upper.includes('CATEGORY_FUN') || upper === 'FUN') return 'Fun';
  if (upper.includes('DIVERSION') || upper.includes('DIVERSIÓN')) return 'Fun';
  if (upper.includes('SPASS') || upper.includes('SPAß')) return 'Fun';
  if (upper.includes('DIVERTIMENTO')) return 'Fun';
  if (upper.includes('SERU') || upper.includes('SERU-SERUAN')) return 'Fun';
  if (upper.includes('お楽しみ') || upper.includes('オタノシミ')) return 'Fun';
  if (upper.includes('재미')) return 'Fun';
  if (upper.includes('娱乐') || upper.includes('娛樂')) return 'Fun';
  if (upper.includes('مرح')) return 'Fun';
  if (upper.includes('मज़ा') || upper.includes('मजा')) return 'Fun';

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
  // Obtener todos los comandos del bot y deduplicar por nombre.
  // Importante: no queremos “perder” la versión slash si existe también versión prefix.
  // Preferimos el objeto de prefijo como base, pero fusionamos (merge) la info slash (.data/.command.Slash)
  // para poder mostrar ambos formatos en el help.
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

  const byName = new Map();

  const getName = (c) => c?.name || (c?.data && c.data.name);

  const merge = (base, incoming) => {
    const merged = base ? { ...base } : (incoming ? { ...incoming } : {});

    // Nombre
    if (!merged.name) {
      const n = getName(incoming);
      if (n) merged.name = n;
    }

    // Si viene data (slash), adjuntarla si falta
    if (!merged.data && incoming && incoming.data) {
      merged.data = incoming.data;
    }

    // Flags command (Prefix/Slash)
    const baseCmd = merged.command && typeof merged.command === 'object' ? merged.command : {};
    const incCmd = incoming && incoming.command && typeof incoming.command === 'object' ? incoming.command : {};
    const hasSlashData = Boolean(merged.data || incoming?.data);
    merged.command = {
      ...baseCmd,
      ...incCmd,
      Prefix: Boolean(baseCmd.Prefix || incCmd.Prefix),
      Slash: Boolean(baseCmd.Slash || incCmd.Slash || hasSlashData),
    };

    // Mantener Category/usage/description del prefijo si existen; si faltan, copiar del incoming
    if (!merged.Category && incoming?.Category) merged.Category = incoming.Category;
    if (!merged.category && incoming?.category) merged.category = incoming.category;
    if (!merged.usage && incoming?.usage) merged.usage = incoming.usage;
    if (!merged.description && incoming?.description) merged.description = incoming.description;
    if (!merged.execute && typeof incoming?.execute === 'function') merged.execute = incoming.execute;
    if (!merged.run && typeof incoming?.run === 'function') merged.run = incoming.run;
    if (!merged.alias && incoming?.alias) merged.alias = incoming.alias;
    if (!merged.aliases && incoming?.aliases) merged.aliases = incoming.aliases;

    return merged;
  };

  // Primero prefijos, luego slash: el prefijo queda como “base” en caso de colisión.
  for (const _cmd of commandsArr) {
    if (!_cmd) continue;
    const cmdName = getName(_cmd);
    if (!cmdName) continue;
    const normalized = {
      ..._cmd,
      name: cmdName,
      command: {
        ...((_cmd.command && typeof _cmd.command === 'object') ? _cmd.command : {}),
        Prefix: true,
      },
    };
    byName.set(cmdName, merge(byName.get(cmdName), normalized));
  }
  for (const _cmd of slashArr) {
    if (!_cmd) continue;
    const cmdName = getName(_cmd);
    if (!cmdName) continue;
    const normalized = {
      ..._cmd,
      name: cmdName,
      command: {
        ...((_cmd.command && typeof _cmd.command === 'object') ? _cmd.command : {}),
        Slash: true,
      },
    };
    byName.set(cmdName, merge(byName.get(cmdName), normalized));
  }

  allCommands = Array.from(byName.values());

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
  const isSpanish = typeof lang === 'string' && /^es(-|$)/i.test(lang);

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

  const resolveCategoryLabel = (cat) => {
    if (!cat) return '';
    const categoryMap = {
      'Administración': 'HELP_CATEGORY_ADMIN',
      'Admin': 'HELP_CATEGORY_ADMIN',
      'Economía': 'HELP_CATEGORY_ECONOMY',
      'Economy': 'HELP_CATEGORY_ECONOMY',
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
    const categoriaKey = categoryMap[cat] || `HELP_CATEGORY_${String(cat).toUpperCase()}`;
    const categoriaTraducida = moxi.translate(categoriaKey, lang);
    return (categoriaTraducida && categoriaTraducida !== categoriaKey) ? categoriaTraducida : String(cat);
  };

  const renderGrid = (items, cols = 6, opts = {}) => {
    const values = Array.from(new Set((items || []).map(v => String(v).trim()).filter(Boolean)));
    if (!values.length) return '';
    if (isRtl) return values.join('\n');

    let width = Math.max(12, ...values.map(v => v.length));

    const maxCellWidth = Number(opts?.maxCellWidth) || 0;
    if (maxCellWidth > 0) {
      width = Math.max(8, Math.min(width, maxCellWidth));
    }

    const forceCols = Number(opts?.forceCols) || 0;
    if (forceCols > 0) {
      cols = Math.max(1, forceCols);
    }

    const maxLineWidth = Number(opts?.maxLineWidth) || 0;
    // Si forzamos columnas y conocemos el ancho de línea, limita el ancho de cada celda
    // para evitar wrap en móvil (que visualmente parece 1 columna).
    if (maxLineWidth > 0 && forceCols > 0 && maxCellWidth <= 0) {
      const derived = Math.floor(maxLineWidth / cols) - 2; // -2 por padding entre columnas
      width = Math.max(8, Math.min(width, derived));
    }
    if (maxLineWidth > 0 && forceCols <= 0) {
      const cellWidth = (width + 2);
      const fitCols = Math.max(1, Math.floor(maxLineWidth / cellWidth));
      cols = Math.max(1, Math.min(cols, fitCols || 1));
    }

    const rows = [];
    for (let i = 0; i < values.length; i += cols) rows.push(values.slice(i, i + cols));
    return rows
      .map((r) => r.map((cell) => {
        let out = String(cell);
        if (out.length > width) out = out.slice(0, Math.max(1, width - 1)) + '…';
        return out.padEnd(width + 2, ' ');
      }).join('').trimEnd())
      .join('\n');
  };

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
      if (categoria === 'Economy') {
        key = 'HELP_CATEGORY_ECONOMY_DESC';
      } else if (categoria === 'Tools') {
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
  const pageSize = categoria ? 60 : 10;
  const total = filteredCommands.length;
  const totalPagesCalc = Math.ceil(total / pageSize) || 1;
  if (typeof totalPages !== 'number') totalPages = totalPagesCalc;
  if (page < 0) page = 0;
  if (page > totalPages - 1) page = totalPages - 1;
  const cmds = filteredCommands.slice(page * pageSize, (page + 1) * pageSize);
  const isPrefixCmd = (cmd) => Boolean((cmd?.command && cmd.command.Prefix) || typeof cmd?.execute === 'function');
  const isSlashCmd = (cmd) => Boolean((cmd?.command && cmd.command.Slash) || (cmd?.data && typeof cmd.data.toJSON === 'function') || typeof cmd?.run === 'function');

  const getPrefixLines = (cmd) => {
    if (!cmd?.name) return [];
    return [`${prefix}${cmd.name}`];
  };

  const getSlashLines = (cmd) => {
    if (!cmd) return [];
    if (!(cmd.data && typeof cmd.data.toJSON === 'function')) {
      // Si no hay data, pero está marcado como slash, mostramos /name como fallback
      if (cmd.name) return [`/${cmd.name}`];
      return [];
    }

    let data = SLASH_JSON_CACHE.get(cmd.data);
    if (!data) {
      data = cmd.data.toJSON();
      SLASH_JSON_CACHE.set(cmd.data, data);
    }

    const slashName = data?.name || cmd.name;
    if (!slashName) return [];

    // Algunos comandos agrupan muchos subcomandos (o están WIP) y ensucian el help.
    // Permite forzar que solo se muestre el comando raíz.
    if (cmd.hideSubcommandsInHelp) return [`/${slashName}`];

    if (Array.isArray(data.options)) {
      const subcmds = data.options.filter(opt => opt.type === 1).map(opt => opt.name);
      if (subcmds.length) return subcmds.map(sub => `/${slashName} ${sub}`);
    }
    return [`/${slashName}`];
  };

  let desc = '';
  if (categoria) {
    // Estilo tipo captura: cabecera de categoría + bloque de comandos en cuadrícula.
    const categoriaLabel = resolveCategoryLabel(categoria);
    const emoji = (categoria === 'Economy')
      ? '💰'
      : (categoria === 'Tools')
        ? '🛠️'
        : (categoria === 'Music')
          ? '🎵'
          : (categoria === 'Fun')
            ? '🎉'
            : (categoria === 'Admin')
              ? '🛡️'
              : (categoria === 'Moderation')
                ? '🧯'
                : (categoria === 'Welcome')
                  ? '👋'
                  : '';

    const header = `${emoji ? `${emoji} ` : ''}**${categoriaLabel}**`;

    const tip = isSpanish
      ? `¿Quieres más info de un comando? Usa: **${prefix}help** comando`
      : `${moxi.translate('HELP_HOME_DESCRIPTION', lang).replace('{{prefix}}', prefix)}`;

    const prefixLabels = [];
    const slashLabels = [];
    for (const cmd of cmds) {
      if (isPrefixCmd(cmd)) prefixLabels.push(...getPrefixLines(cmd));
      if (isSlashCmd(cmd)) slashLabels.push(...getSlashLines(cmd));
    }

    const uniqueSort = (arr) => Array.from(new Set((arr || []).map(v => String(v).trim()).filter(Boolean)))
      .sort((a, b) => a.localeCompare(b, lang || 'es-ES'));

    const prefixList = uniqueSort(prefixLabels);
    const slashList = uniqueSort(slashLabels);

    desc = `${header}\n${tip}`;
    if (bienvenidaCategoria) desc += `\n${bienvenidaCategoria}`;

    if (prefixList.length) {
      desc += `\n\n${EMOJIS.book} **${moxi.translate('HELP_PREFIX_COMMANDS', lang)}**\n` +
        `\`\`\`\n${renderGrid(prefixList, 4, { maxLineWidth: 34 })}\n\`\`\``;
    }

    if (slashList.length) {
      const slashCols = categoria === 'Economy' ? 2 : 3;
      const slashOpts = (categoria === 'Economy')
        ? { maxLineWidth: 34, forceCols: 2 }
        : { maxLineWidth: 34 };
      desc += `\n\n${EMOJIS.package} **${moxi.translate('HELP_SLASH_COMMANDS', lang)}**\n` +
        `\`\`\`\n${renderGrid(slashList, slashCols, slashOpts)}\n\`\`\``;
    }

    if (!prefixList.length && !slashList.length) {
      desc += `\n\n${moxi.translate('HELP_NO_COMMANDS', lang)}`;
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
    // En español, estilo tipo captura: título fijo y la categoría en el cuerpo.
    if (isSpanish) {
      titulo = 'Mis comandos';
    } else {
      const categoriaFinal = resolveCategoryLabel(categoria);
      titulo += `: ${categoriaFinal}`;
    }
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
        webUrl = 'https://moxilab.net';
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
