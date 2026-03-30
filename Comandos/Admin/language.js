const fs = require('fs');
const path = require('path');
const { PermissionsBitField: { Flags }, ContainerBuilder, ButtonStyle, MessageFlags, ActionRowBuilder } = require('discord.js');
const { ButtonBuilder } = require('../../Util/compatButtonBuilder');
const moxi = require('../../i18n');
const { setGuildLanguage, invalidateGuildSettingsCache } = require('../../Util/guildSettings');
const { setUserLanguage, invalidateUserLanguageCache } = require('../../Util/userLanguage');
const log = require('../../Util/logger');
const { EMOJIS } = require('../../Util/emojis');
const { Bot } = require('../../Config');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');

function loadLanguages() {
  const metaPath = path.join(__dirname, '../../Languages/language-meta.json');
  const parsed = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
  return parsed.map((lang) => ({
    code: lang.name,
    short: String(lang.name || '').split('-')[0].toLowerCase(),
    name: lang.nativeName,
    emoji: lang.emoji || '',
  }));
}

function resolveLanguage(input, languages) {
  const raw = String(input || '').trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  return languages.find((l) => (
    l.code === raw
    || l.code.toLowerCase() === lower
    || l.short === lower
    || String(l.name || '').toLowerCase() === lower
  )) || null;
}

function isServerScopeToken(value) {
  const v = String(value || '').trim().toLowerCase();
  return ['server', 'servidor', 'guild', 'global'].includes(v);
}

function buildPanel({ lang, serverLangCode, userLangCode, languages, botUsername, page = 0, pageSize = 5, disableAll = false }) {
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.trunc(pageSize) : 5;
  const totalPages = Math.max(1, Math.ceil(languages.length / safePageSize));
  const safePage = Math.min(Math.max(0, Number(page) || 0), totalPages - 1);
  const start = safePage * safePageSize;
  const pageItems = languages.slice(start, start + safePageSize);
  const serverSelectedName = languages.find((l) => l.code === serverLangCode)?.name || serverLangCode;
  const userSelectedName = userLangCode ? (languages.find((l) => l.code === userLangCode)?.name || userLangCode) : null;
  
  const container = new ContainerBuilder()
    .setAccentColor(Bot.AccentColor)
    .addTextDisplayComponents((c) =>
      c.setContent(
        `${EMOJIS.earth} **${moxi.translate('LANGUAGE_SELECTION', lang)}**\n\n`
        + `${moxi.translate('LANGUAGE_DESCRIPTION', lang)}\n\n`
        + `**${EMOJIS.info} Tu configuración actual:**\n`
        + `• **Tu idioma personal:** ${userSelectedName ? `${userSelectedName} (${userLangCode})` : `No configurado - usando idioma del servidor`}\n`
        + `• **Idioma del servidor:** ${serverSelectedName} (${serverLangCode})\n\n`
        + `**${EMOJIS.info} Opciones:**\n`
        + `• \`Usuario\`: Cambia solo tu idioma personal\n`
        + `• \`Servidor\`: Cambia el idioma del servidor (solo admins)\n\n`
        + `**${EMOJIS.book} Idiomas disponibles** • Página ${safePage + 1}/${totalPages}`
      )
    );

  // Cada idioma con sus botones
  for (const langItem of pageItems) {
    const serverSelected = serverLangCode === langItem.code;
    const userSelected = userLangCode === langItem.code;
    
    let statusText = '';
    if (serverSelected && userSelected) {
      statusText = `${EMOJIS.tick} **Tu idioma personal Y del servidor**`;
    } else if (userSelected) {
      statusText = `${EMOJIS.tick} **Tu idioma personal**`;
    } else if (serverSelected) {
      statusText = `${EMOJIS.tick} **Idioma del servidor**`;
    } else {
      statusText = '• Idioma disponible';
    }
    
    container
      .addSeparatorComponents((s) => s.setDivider(true))
      .addTextDisplayComponents((c) =>
        c.setContent(
          `${langItem.emoji} **${langItem.name}** \`${langItem.code}\`\n`
          + statusText
        )
      );

    const langRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`lang_user_${langItem.code}`)
        .setLabel(userSelected ? '✓ Tu idioma' : '👤 Usuario')
        .setStyle(userSelected ? ButtonStyle.Success : ButtonStyle.Primary)
        .setDisabled(disableAll),
      new ButtonBuilder()
        .setCustomId(`lang_server_${langItem.code}`)
        .setLabel(serverSelected ? '✓ Activo' : '🌐 Servidor')
        .setStyle(serverSelected ? ButtonStyle.Success : ButtonStyle.Secondary)
        .setDisabled(disableAll)
    );
    container.addActionRowComponents(() => langRow);
  }

  container
    .addSeparatorComponents((s) => s.setDivider(true))
    .addTextDisplayComponents((c) =>
      c.setContent(
        `**Servidor:** ${serverSelectedName} (${serverLangCode})\n`
        + `${EMOJIS.copyright} ${botUsername} • ${new Date().getFullYear()}`
      )
    );

  // Navegación en la parte inferior (solo si hay múltiples páginas)
  if (totalPages > 1) {
    const navRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('lang_page_prev')
        .setLabel('◀ Anterior')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disableAll || safePage <= 0),
      new ButtonBuilder()
        .setCustomId('lang_page_next')
        .setLabel('Siguiente ▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disableAll || safePage >= totalPages - 1)
    );
    container.addActionRowComponents(() => navRow);
  }

  return { container, page: safePage, totalPages };
}

module.exports = {
  name: 'language',
  alias: ['language', 'lang', 'idioma', 'lenguaje'],
  Category: function (lang) {
    lang = lang || 'es-ES';
    return moxi.translate('commands:CATEGORY_ADMIN', lang);
  },
  usage: 'language [servidor] [codigo]',
  get description() { return moxi.translate('commands:CMD_LANGUAGE_DESC', 'es-ES'); },
  cooldown: 20,
  permissions: {
    User: [],
  },
  command: {
    prefix: true,
    slash: false,
    ephemeral: false,
    options: [],
  },
  async execute(Moxi, message, args) {
    const languages = loadLanguages();
    const guildId = message.guild?.id;
    const userId = message.author?.id;
    const fallbackLang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

    const firstArg = args[0] ? String(args[0]).trim() : '';
    const secondArg = args[1] ? String(args[1]).trim() : '';

    // Modo rápido por argumento:
    // .language es-ES                -> cambia idioma del usuario
    // .language servidor es-ES       -> cambia idioma del servidor (solo admin)
    if (firstArg) {
      const scopeIsServer = isServerScopeToken(firstArg);
      const langToken = scopeIsServer ? secondArg : firstArg;
      const targetLang = resolveLanguage(langToken, languages);

      if (!targetLang) {
        const text =
          (moxi.translate('MISSING_LANGUAGE', fallbackLang) || 'Idioma no valido.')
          + '\n\n'
          + languages.map((l) => `\`${l.code}\` - ${l.emoji} ${l.name}`).join('\n');
        return message.reply(asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, text })));
      }

      if (scopeIsServer) {
        const isAdmin = message.member?.permissions?.has?.(Flags.Administrator, true);
        if (!isAdmin) {
          return message.reply(asV2MessageOptions(buildNoticeContainer({
            emoji: EMOJIS.cross,
            text: 'Solo administradores pueden cambiar el idioma del servidor.',
          })));
        }

        let ownerId = message.guild?.ownerId || null;
        if (!ownerId) {
          try {
            const owner = await message.guild.fetchOwner?.();
            ownerId = owner?.id || owner?.user?.id || null;
          } catch {
            ownerId = null;
          }
        }

        const ok = await setGuildLanguage(guildId, targetLang.code, ownerId);
        if (!ok) {
          return message.reply(asV2MessageOptions(buildNoticeContainer({
            emoji: EMOJIS.cross,
            text: 'No se pudo actualizar el idioma del servidor.',
          })));
        }

        message.guild.settings = message.guild.settings || {};
        message.guild.settings.Language = targetLang.code;
        invalidateGuildSettingsCache(guildId);

        return message.reply(asV2MessageOptions(buildNoticeContainer({
          emoji: EMOJIS.tick,
          text: `Idioma del servidor actualizado a **${targetLang.name}** (${targetLang.code}).`,
        })));
      }

      const ok = await setUserLanguage(guildId, userId, targetLang.code);
      if (!ok) {
        return message.reply(asV2MessageOptions(buildNoticeContainer({
          emoji: EMOJIS.cross,
          text: 'No se pudo actualizar tu idioma personal.',
        })));
      }

      // Invalidar caché para aplicar el cambio inmediatamente
      invalidateUserLanguageCache(guildId, userId);

      return message.reply(asV2MessageOptions(buildNoticeContainer({
        emoji: EMOJIS.tick,
        text: `Tu idioma personal ahora es **${targetLang.name}** (${targetLang.code}).`,
      })));
    }

    const serverLangCode = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
    const PAGE_SIZE = 3;
    let currentPage = 0;
    let currentServerLangCode = serverLangCode;

    // Obtener idioma personal del usuario (si existe)
    const { getUserLanguage } = require('../../Util/userLanguage');
    const userPersonalLang = await getUserLanguage(guildId, userId, '').catch(() => '');
    let currentUserLangCode = userPersonalLang || null;

    const panelResult = buildPanel({
      lang: fallbackLang,
      serverLangCode: currentServerLangCode,
      userLangCode: currentUserLangCode,
      languages,
      botUsername: Moxi.user.username,
      page: currentPage,
      pageSize: PAGE_SIZE,
    });
    currentPage = panelResult.page;

    const msg = await message.channel.send({
      components: [panelResult.container],
      flags: MessageFlags.IsComponentsV2,
    });

    const collector = msg.createMessageComponentCollector({
      filter: (i) => i.customId.startsWith('lang_user_')
        || i.customId.startsWith('lang_server_')
        || i.customId.startsWith('lang_page_'),
      time: 5 * 60 * 1000,
    });

    collector.on('collect', async (i) => {
      try {
        // Obtener el idioma personal del usuario que está interactuando
        const { getUserLanguage } = require('../../Util/userLanguage');
        const interactorPersonalLang = await getUserLanguage(guildId, i.user?.id, '').catch(() => '');
        const interactorUserLangCode = interactorPersonalLang || null;

        if (i.customId === 'lang_page_prev' || i.customId === 'lang_page_next') {
          currentPage += (i.customId === 'lang_page_prev' ? -1 : 1);
          const viewerLang = await moxi.userLang(guildId, i.user?.id, currentServerLangCode);
          const nextPanel = buildPanel({
            lang: viewerLang,
            serverLangCode: currentServerLangCode,
            userLangCode: interactorUserLangCode,
            languages,
            botUsername: Moxi.user.username,
            page: currentPage,
            pageSize: PAGE_SIZE,
          });
          currentPage = nextPanel.page;

          return i.update({
            components: [nextPanel.container],
            flags: MessageFlags.IsComponentsV2,
          }).catch(() => null);
        }

        const isServerScope = i.customId.startsWith('lang_server_');
        const prefix = isServerScope ? 'lang_server_' : 'lang_user_';
        const selectedCode = i.customId.slice(prefix.length);
        const selectedLang = languages.find((l) => l.code === selectedCode);

        if (!selectedLang) {
          return i.reply({
            content: 'Idioma invalido.',
            flags: MessageFlags.Ephemeral,
          }).catch(() => null);
        }

        if (isServerScope) {
          const isAdmin = i.memberPermissions?.has?.(Flags.Administrator, true)
            || i.member?.permissions?.has?.(Flags.Administrator, true);
          if (!isAdmin) {
            return i.reply({
              content: 'Solo administradores pueden cambiar el idioma del servidor.',
              flags: MessageFlags.Ephemeral,
            }).catch(() => null);
          }

          let ownerId = message.guild?.ownerId || null;
          if (!ownerId) {
            try {
              const owner = await message.guild.fetchOwner?.();
              ownerId = owner?.id || owner?.user?.id || null;
            } catch {
              ownerId = null;
            }
          }

          const ok = await setGuildLanguage(guildId, selectedCode, ownerId);
          if (!ok) {
            return i.reply({
              content: 'No se pudo actualizar el idioma del servidor.',
              flags: MessageFlags.Ephemeral,
            }).catch(() => null);
          }

          message.guild.settings = message.guild.settings || {};
          message.guild.settings.Language = selectedCode;
          invalidateGuildSettingsCache(guildId);
          currentServerLangCode = selectedCode;

          const nextPanel = buildPanel({
            lang: await moxi.userLang(guildId, i.user?.id, currentServerLangCode),
            serverLangCode: currentServerLangCode,
            userLangCode: interactorUserLangCode,
            languages,
            botUsername: Moxi.user.username,
            page: currentPage,
            pageSize: PAGE_SIZE,
          });
          currentPage = nextPanel.page;

          await i.update({
            components: [nextPanel.container],
            flags: MessageFlags.IsComponentsV2,
          }).catch(() => null);

          return i.followUp({
            content: `✅ Idioma del servidor actualizado a **${selectedLang.name}** (${selectedLang.code}).`,
            flags: MessageFlags.Ephemeral,
          }).catch(() => null);
        }

        const ok = await setUserLanguage(guildId, i.user?.id, selectedCode);
        if (!ok) {
          return i.reply({
            content: 'No se pudo actualizar tu idioma personal.',
            flags: MessageFlags.Ephemeral,
          }).catch(() => null);
        }

        // Invalidar caché para que el cambio se aplique inmediatamente
        invalidateUserLanguageCache(guildId, i.user?.id);

        // Actualizar el panel para mostrar el nuevo idioma
        const updatedPanel = buildPanel({
          lang: await moxi.userLang(guildId, i.user?.id, currentServerLangCode),
          serverLangCode: currentServerLangCode,
          userLangCode: selectedCode, // Mostrar el nuevo idioma personal
          languages,
          botUsername: Moxi.user.username,
          page: currentPage,
          pageSize: PAGE_SIZE,
        });

        await i.update({
          components: [updatedPanel.container],
          flags: MessageFlags.IsComponentsV2,
        }).catch(() => null);

        return i.followUp({
          content: `✅ Tu idioma personal ahora es **${selectedLang.name}** (${selectedLang.code}).\n\n¡El panel se ha actualizado para reflejar tu configuración actual!`,
          flags: MessageFlags.Ephemeral,
        }).catch(() => null);
      } catch (err) {
        log.error('language collector error:', err);
        if (!i.replied && !i.deferred) {
          await i.reply({ content: 'Ocurrio un error procesando tu seleccion.', flags: MessageFlags.Ephemeral }).catch(() => null);
        }
      }
    });

    collector.on('end', async () => {
      try {
        const latestServerLang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        // Obtener el idioma personal actual del usuario original
        const { getUserLanguage } = require('../../Util/userLanguage');
        const finalUserLang = await getUserLanguage(guildId, userId, '').catch(() => '');
        
        const disabled = buildPanel({
          lang: latestServerLang,
          serverLangCode: latestServerLang,
          userLangCode: finalUserLang || null,
          languages,
          botUsername: Moxi.user.username,
          page: currentPage,
          pageSize: PAGE_SIZE,
          disableAll: true,
        });

        await msg.edit({
          components: [disabled.container],
          flags: MessageFlags.IsComponentsV2,
        }).catch(() => null);
      } catch (err) {
        log.error('Error disabling language panel:', err);
      }
    });
  },
};
