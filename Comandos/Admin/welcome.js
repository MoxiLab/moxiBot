const {
    ContainerBuilder,
    MessageFlags,
    AttachmentBuilder,
    PermissionsBitField,
    PrimaryButtonBuilder,
    SuccessButtonBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    PermissionsBitField: { Flags }
} = require('discord.js');
const moxi = require('../../i18n');
const { Bot } = require('../../Config');
const { EMOJIS } = require('../../Util/emojis');
const GuildData = require('../../Models/GuildSchema');
const Welcome = require('../../Models/WelcomeSchema');
const { buildSylphaGreeting } = require('../../Util/sylphacard');
const { buildDiscordArtsProfile } = require('../../Util/discordArts');
const { buildCanvacardWelcomeLeave } = require('../../Util/canvacard');
const logger = require('../../Util/logger');
const debugHelper = require('../../Util/debugHelper');
const LANGUAGE_META = require('../../Languages/language-meta.json');

function toHexColor(value, fallback = '#00d9ff') {
    if (!value && value !== 0) return fallback;
    if (typeof value === 'string') {
        const v = value.trim();
        if (!v) return fallback;
        if (v.startsWith('#') && (v.length === 7 || v.length === 4)) return v;
    }
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const hex = (n >>> 0).toString(16).padStart(6, '0').slice(-6);
    return `#${hex}`;
}

function applyTemplate(template, { user, server, count }) {
    const base = (template && typeof template === 'string') ? template : '';
    return base
        .replace(/\{user\}/gi, user)
        .replace(/\{server\}/gi, server)
        .replace(/\{count\}/gi, String(count));
}

function panel(Moxi, title, body) {
    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(c => c.setContent(`# ${title}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(body))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`));
    return { content: '', components: [container], flags: MessageFlags.IsComponentsV2 };
}

function getWelcomeTemplateForLang(cfg, lang) {
    const safeLang = (lang && typeof lang === 'string') ? lang : '';
    const messages = cfg?.messages;
    if (messages && typeof messages === 'object') {
        const fromMap = messages instanceof Map ? messages.get(safeLang) : messages[safeLang];
        if (fromMap && String(fromMap).trim()) return String(fromMap);
    }
    if (cfg?.message && String(cfg.message).trim()) return String(cfg.message);
    return '';
}

function normalizeLangInput(input) {
    const raw = String(input || '').trim();
    if (!raw) return '';
    const lowered = raw.toLowerCase();
    for (const item of (LANGUAGE_META || [])) {
        const name = String(item?.name || '').trim();
        if (!name) continue;
        if (name.toLowerCase() === lowered) return name;
        const alias = Array.isArray(item?.alias) ? item.alias : [];
        if (alias.some(a => String(a || '').toLowerCase() === lowered)) return name;
    }
    return '';
}

function describeMissingPerms(missing) {
    const map = {
        ViewChannel: 'Ver canal',
        SendMessages: 'Enviar mensajes',
        AttachFiles: 'Adjuntar archivos',
        EmbedLinks: 'Insertar enlaces',
    };
    return (missing || []).map(p => map[p] || p);
}

module.exports = {
    name: 'welcome',
    alias: ['bienvenida', 'bienvenidas'],
    Category: (lang = 'es-ES') => moxi.translate('HELP_CATEGORY_WELCOME', lang),
    usage: 'welcome set #canal | welcome off | welcome style [sylphacard|discord-arts|canvacard] | welcome message <texto> | welcome message <lang> <texto> | welcome message clear [lang] | welcome test',
    description: (lang = 'es-ES') => 'Configura el sistema de bienvenidas (sylphacard o discord-arts).',
    permissions: {
        User: [Flags.Administrator],
    },
    cooldown: 10,
    async execute(Moxi, message, args) {
        const guildId = message.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const sub = (args[0] || 'status').toLowerCase();

        if (!message.guild) return;
        debugHelper.log('welcome', 'command', { guildId, sub, authorId: message.author?.id, args });

        if (sub === 'set') {
            const mentioned = message.mentions?.channels?.first?.();
            const raw = args[1];
            const id = mentioned?.id || (raw ? String(raw).replace(/[<#>]/g, '') : '');
            const ch = id ? (message.guild.channels.cache.get(id) || await message.guild.channels.fetch(id).catch(() => null)) : null;
            if (!ch) {
                return message.reply(panel(Moxi, 'Welcome', `${EMOJIS.cross} Uso: welcome set #canal`));
            }

            try {
                const now = new Date();
                await Welcome.updateOne(
                    { guildID: guildId, type: 'config' },
                    { $setOnInsert: { guildID: guildId, createdAt: now }, $set: { enabled: true, channelID: ch.id, updatedAt: now, guildName: message.guild.name } },
                    { upsert: true }
                );
                try { logger.info && logger.info('[welcome] saved config (set)', { guildID: guildId, channelID: ch.id }); } catch (_) { }
            } catch (err) {
                debugHelper.error('welcome', 'DB update failed (set channel)', err);
                return null;
            }

            return message.reply(panel(Moxi, 'Welcome', `${EMOJIS.tick} Canal de bienvenida: <#${ch.id}>`));
        }

        if (sub === 'off' || sub === 'disable') {
            try {
                if (!guildId) return message.reply(panel(Moxi, 'Welcome', `${EMOJIS.cross} Guild ID no disponible.`));
                // Safely disable the config for this guild in the dedicated collection
                const now = new Date();
                await Welcome.updateOne(
                    { guildID: guildId, type: 'config' },
                    { $set: { enabled: false, channelID: null, message: null, updatedAt: now, guildName: message.guild?.name || null } },
                    { upsert: false }
                ).catch(() => null);
            } catch (err) {
                debugHelper.error('welcome', 'DB delete failed (off)', err);
                return null;
            }
            return message.reply(panel(Moxi, 'Welcome', `${EMOJIS.tick} Sistema de bienvenidas desactivado y configuración eliminada.`));
        }

        if (sub === 'style' || sub === 'estilo') {
            const raw = String(args[1] || '').trim().toLowerCase();
            const normalized = raw === 'discord-arts' || raw === 'discordarts' || raw === 'discord'
                ? 'discord-arts'
                : (raw === 'canvacard' || raw === 'canva')
                    ? 'canvacard'
                    : (raw === 'sylphacard' || raw === 'sylpha')
                        ? 'sylphacard'
                        : '';

            // Si no se pasa argumento, mostramos selector interactivo (como language)
            if (!raw) {
                const welcomeDocPanel = await Welcome.findOne({ guildID: guildId, type: 'config' }).lean().catch((err) => {
                    debugHelper.error('welcome', 'DB findOne failed (style panel)', err);
                    return null;
                });
                const cfg = welcomeDocPanel || {};
                let currentStyle = (cfg?.style && typeof cfg.style === 'string') ? cfg.style : 'sylphacard';

                // Generar previews (mejor esfuerzo)
                const avatarUrl = message.author.displayAvatarURL({ size: 512, extension: 'png', forceStatic: true });
                const fetchedUser = await message.client.users.fetch(message.author.id, { force: true }).catch(() => null);
                const userBanner = fetchedUser?.bannerURL?.({ size: 2048, extension: 'png' }) || undefined;
                const guildBg = message.guild.bannerURL?.({ size: 2048, extension: 'png' }) || message.guild.iconURL?.({ size: 2048, extension: 'png' }) || undefined;
                const bg = userBanner || guildBg;

                const rawTemplate = getWelcomeTemplateForLang(cfg, lang);
                const msgText = rawTemplate
                    ? applyTemplate(rawTemplate, { user: message.author.username, server: message.guild.name, count: message.guild.memberCount || 0 })
                    : undefined;

                let sylphaBuffer = null;
                let artsBuffer = null;
                let canvaBuffer = null;

                try {
                    sylphaBuffer = await buildSylphaGreeting({
                        type: 'welcome',
                        username: message.author.username,
                        message: msgText,
                        memberCount: String(message.guild.memberCount || 0),
                        avatarImage: avatarUrl,
                        backgroundImage: bg,
                        backgroundColor: '#0a192f',
                        primaryColor: '#e6f1ff',
                        textColor: '#e6f1ff',
                        secondaryTextColor: '#a8b2d1',
                        accentColor: toHexColor(Bot?.AccentColor, '#00d9ff'),
                        imageDarkness: 40,
                    });
                } catch (err) {
                    debugHelper.error('welcome', 'sylphacard preview failed', err);
                }

                try {
                    artsBuffer = await buildDiscordArtsProfile({
                        userId: message.author.id,
                        customTag: msgText,
                        customBackground: bg,
                    });
                } catch (err) {
                    debugHelper.error('welcome', 'discord-arts preview failed', err);
                }

                try {
                    canvaBuffer = await buildCanvacardWelcomeLeave({
                        type: 'welcome',
                        avatarUrl,
                        backgroundUrl: bg,
                        title: `¡Bienvenid@ ${message.author.username}!`,
                        subtitle: msgText,
                    });
                } catch (err) {
                    debugHelper.error('welcome', 'canvacard preview failed', err);
                }

                const SYLPHA_FILE = 'welcome-style-sylphacard.png';
                const ARTS_FILE = 'welcome-style-discord-arts.png';
                const CANVA_FILE = 'welcome-style-canvacard.png';

                const files = [];
                if (sylphaBuffer) files.push(new AttachmentBuilder(sylphaBuffer, { name: SYLPHA_FILE }));
                if (artsBuffer) files.push(new AttachmentBuilder(artsBuffer, { name: ARTS_FILE }));
                if (canvaBuffer) files.push(new AttachmentBuilder(canvaBuffer, { name: CANVA_FILE }));

                const buildStyleContainer = (selectedStyle, { hasSylpha, hasArts, hasCanva, disabled = false } = {}) => {
                    const c = new ContainerBuilder()
                        .setAccentColor(Bot.AccentColor)
                        .addTextDisplayComponents(t => t.setContent(
                            `**${EMOJIS.info || ''} Selector de estilo de bienvenida**\n\n` +
                            `Pulsa un botón para elegir el diseño.\n` +
                            `Estilo actual: **${selectedStyle}**`
                        ))
                        .addSeparatorComponents(s => s.setDivider(true));

                    // Opción 1 (Sylphacard)
                    c.addSectionComponents(section =>
                        section
                            .addTextDisplayComponents(t =>
                                t.setContent(
                                    `**Sylphacard** (clásico)${selectedStyle === 'sylphacard' ? ` ${EMOJIS.tick}` : ''}` +
                                    `${hasSylpha ? '' : `\n_${EMOJIS.cross} Preview no disponible_`}`
                                )
                            )
                            .setButtonAccessory(
                                (selectedStyle === 'sylphacard' ? new SuccessButtonBuilder() : new PrimaryButtonBuilder())
                                    .setCustomId('welcome_style_sylphacard')
                                    .setLabel('Usar Sylphacard')
                                    .setDisabled(disabled)
                            )
                    );

                    if (hasSylpha) {
                        c.addMediaGalleryComponents(
                            new MediaGalleryBuilder().addItems(
                                new MediaGalleryItemBuilder().setURL(`attachment://${SYLPHA_FILE}`)
                            )
                        );
                    }

                    c.addSeparatorComponents(s => s.setDivider(true));

                    // Opción 2 (Discord-Arts)
                    c.addSectionComponents(section =>
                        section
                            .addTextDisplayComponents(t =>
                                t.setContent(
                                    `**Discord-Arts** (Discord style)${selectedStyle === 'discord-arts' ? ` ${EMOJIS.tick}` : ''}` +
                                    `${hasArts ? '' : `\n_${EMOJIS.cross} Preview no disponible_`}`
                                )
                            )
                            .setButtonAccessory(
                                (selectedStyle === 'discord-arts' ? new SuccessButtonBuilder() : new PrimaryButtonBuilder())
                                    .setCustomId('welcome_style_discord-arts')
                                    .setLabel('Usar Discord-Arts')
                                    .setDisabled(disabled)
                            )
                    );

                    if (hasArts) {
                        c.addMediaGalleryComponents(
                            new MediaGalleryBuilder().addItems(
                                new MediaGalleryItemBuilder().setURL(`attachment://${ARTS_FILE}`)
                            )
                        );
                    }

                    c.addSeparatorComponents(s => s.setDivider(true));

                    // Opción 3 (Canvacard)
                    c.addSectionComponents(section =>
                        section
                            .addTextDisplayComponents(t =>
                                t.setContent(
                                    `**Canvacard** (WelcomeLeave)${selectedStyle === 'canvacard' ? ` ${EMOJIS.tick}` : ''}` +
                                    `${hasCanva ? '' : `\n_${EMOJIS.cross} Preview no disponible_`}`
                                )
                            )
                            .setButtonAccessory(
                                (selectedStyle === 'canvacard' ? new SuccessButtonBuilder() : new PrimaryButtonBuilder())
                                    .setCustomId('welcome_style_canvacard')
                                    .setLabel('Usar Canvacard')
                                    .setDisabled(disabled)
                            )
                    );

                    if (hasCanva) {
                        c.addMediaGalleryComponents(
                            new MediaGalleryBuilder().addItems(
                                new MediaGalleryItemBuilder().setURL(`attachment://${CANVA_FILE}`)
                            )
                        );
                    }

                    c.addSeparatorComponents(s => s.setDivider(true))
                        .addTextDisplayComponents(t => t.setContent(`${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`));

                    return c;
                };

                const styleMsg = await message.channel.send({
                    components: [buildStyleContainer(currentStyle, { hasSylpha: !!sylphaBuffer, hasArts: !!artsBuffer, hasCanva: !!canvaBuffer })],
                    files,
                    flags: MessageFlags.IsComponentsV2,
                });

                const filter = (i) => (
                    (i.customId === 'welcome_style_sylphacard' || i.customId === 'welcome_style_discord-arts' || i.customId === 'welcome_style_canvacard') &&
                    i.user?.id === message.author.id
                );

                const collector = styleMsg.createMessageComponentCollector({
                    filter,
                    time: 60000,
                    max: Infinity,
                });

                collector.on('collect', async (i) => {
                    const selected = i.customId === 'welcome_style_discord-arts'
                        ? 'discord-arts'
                        : (i.customId === 'welcome_style_canvacard' ? 'canvacard' : 'sylphacard');
                    try {
                        try {
                            const now = new Date();
                            await Welcome.updateOne(
                                { guildID: guildId, type: 'config' },
                                { $setOnInsert: { guildID: guildId, createdAt: now }, $set: { style: selected, updatedAt: now, guildName: message.guild.name } },
                                { upsert: true }
                            );
                            try { logger.info && logger.info('[welcome] saved config (style via button)', { guildID: guildId, style: selected }); } catch (_) { }
                        } catch (err) {
                            debugHelper.error('welcome', 'DB update failed (style via button)', err);
                            throw err;
                        }
                        currentStyle = selected;
                        await i.deferUpdate();
                        await styleMsg.edit({
                            components: [buildStyleContainer(currentStyle, { hasSylpha: !!sylphaBuffer, hasArts: !!artsBuffer, hasCanva: !!canvaBuffer })],
                            flags: MessageFlags.IsComponentsV2,
                        });
                    } catch (err) {
                        debugHelper.error('welcome', 'DB update failed (style via button)', err);
                        await i.reply({
                            content: '',
                            components: [new ContainerBuilder().setAccentColor(Bot.AccentColor).addTextDisplayComponents(t => t.setContent(`${EMOJIS.cross} No se pudo guardar el estilo.`))],
                            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
                        }).catch(() => null);
                    }
                });

                collector.on('end', async () => {
                    await styleMsg.edit({
                        components: [buildStyleContainer(currentStyle, { hasSylpha: !!sylphaBuffer, hasArts: !!artsBuffer, hasCanva: !!canvaBuffer, disabled: true })],
                        flags: MessageFlags.IsComponentsV2,
                    }).catch(() => null);
                });

                return;
            }

            if (!normalized) {
                return message.reply(panel(
                    Moxi,
                    'Welcome',
                    `${EMOJIS.cross} Uso: welcome style [sylphacard|discord-arts|canvacard]`
                ));
            }

            try {
                const now = new Date();
                await Welcome.updateOne(
                    { guildID: guildId, type: 'config' },
                    { $setOnInsert: { guildID: guildId, createdAt: now }, $set: { style: normalized, updatedAt: now, guildName: message.guild.name } },
                    { upsert: true }
                );
                try { logger.info && logger.info('[welcome] saved config (style)', { guildID: guildId, style: normalized }); } catch (_) { }
            } catch (err) {
                debugHelper.error('welcome', 'DB update failed (style)', err);
                return null;
            }

            return message.reply(panel(Moxi, 'Welcome', `${EMOJIS.tick} Estilo actualizado: **${normalized}**`));
        }

        if (sub === 'message' || sub === 'msg') {
            // Formatos soportados:
            // - welcome message <texto>
            // - welcome message <lang> <texto>
            // - welcome message clear
            // - welcome message clear <lang>
            // - welcome message <lang> clear

            const arg1 = String(args[1] || '').trim();
            const arg2 = String(args[2] || '').trim();
            const clearWords = new Set(['clear', 'remove', 'delete', 'borrar']);
            const isClear1 = clearWords.has(arg1.toLowerCase());
            const isClear2 = clearWords.has(arg2.toLowerCase());

            const langFromArg1 = normalizeLangInput(arg1);
            const langFromArg2 = normalizeLangInput(arg2);

            let targetLang = '';
            if (isClear1) {
                targetLang = langFromArg2 || (arg2 || '').trim() || lang;
            } else {
                targetLang = langFromArg1 || (arg1 || '').trim() || lang;
            }
            if (typeof targetLang === 'string') targetLang = targetLang.trim();

            if (isClear1 || isClear2) {
                const update = {
                    $unset: { [`Welcome.messages.${targetLang}`]: '' },
                    // También limpiamos el fallback antiguo para que no reaparezca el texto.
                    $set: { 'Welcome.message': '', 'Welcome.updatedAt': new Date() },
                    $setOnInsert: { guildName: message.guild.name },
                };

                try {
                    // On clear we do NOT want to create a new config document if it doesn't exist
                    const now = new Date();
                    const upd = { $set: { message: '', updatedAt: now, guildName: message.guild.name } };
                    if (targetLang) {
                        upd.$unset = { [`messages.${targetLang}`]: '' };
                    }
                    const res = await Welcome.updateOne({ guildID: guildId, type: 'config' }, upd, { upsert: false });
                    try { logger.info && logger.info('[welcome] cleared message', { guildID: guildId, targetLang, modifiedCount: res?.modifiedCount ?? res?.nModified }); } catch (_) { }
                } catch (err) {
                    debugHelper.error('welcome', 'DB update failed (message clear)', err);
                    return null;
                }

                return message.reply(panel(Moxi, 'Welcome', `${EMOJIS.tick} Mensaje borrado para **${targetLang}**.`));
            }

            const text = langFromArg1 ? args.slice(2).join(' ').trim() : args.slice(1).join(' ').trim();
            if (!text) {
                return message.reply(panel(Moxi, 'Welcome', `${EMOJIS.cross} Uso: welcome message <texto>\nO: welcome message <lang> <texto>\nO: welcome message clear [lang]\nVariables: {user} {server} {count}`));
            }

            const setObj = {
                'Welcome.message': text, // compat/backward
                'Welcome.updatedAt': new Date(),
            };
            if (targetLang) setObj[`Welcome.messages.${targetLang}`] = text;

            try {
                const now = new Date();
                const upd = { $setOnInsert: { guildID: guildId, createdAt: now }, $set: { updatedAt: now, guildName: message.guild.name } };
                if (setObj['Welcome.message'] !== undefined) upd.$set.message = setObj['Welcome.message'];
                if (setObj[`Welcome.messages.${targetLang}`]) {
                    upd.$set[`messages.${targetLang}`] = setObj[`Welcome.messages.${targetLang}`];
                }
                const res = await Welcome.updateOne({ guildID: guildId, type: 'config' }, upd, { upsert: true });
                try { logger.info && logger.info('[welcome] saved message', { guildID: guildId, targetLang, upsertedId: res?.upsertedId ?? null }); } catch (_) { }
            } catch (err) {
                debugHelper.error('welcome', 'DB update failed (message)', err);
                return null;
            }
            return message.reply(panel(Moxi, 'Welcome', `${EMOJIS.tick} Mensaje guardado para **${targetLang}**.`));
        }

        if (sub === 'test') {
            const serverDoc = await GuildData.findOne({ guildID: guildId }).lean().catch((err) => {
                debugHelper.error('welcome', 'DB findOne failed (test)', err);
                return null;
            });
            const welcomeDoc = await Welcome.findOne({ guildID: guildId, type: 'config' }).lean().catch((err) => {
                debugHelper.error('welcome', 'Welcome.findOne failed (test)', err);
                return null;
            });
            const cfg = welcomeDoc || serverDoc?.Welcome || {};
            const style = (cfg?.style && typeof cfg.style === 'string') ? cfg.style : 'sylphacard';
            const channelId = cfg?.channelID ? String(cfg.channelID) : message.channel.id;
            const channel = message.guild.channels.cache.get(channelId) || await message.guild.channels.fetch(channelId).catch(() => message.channel);

            debugHelper.log('welcome', 'test resolved channel', { channelId: channel?.id, configuredChannelId: cfg?.channelID });

            const me = message.guild.members.me || await message.guild.members.fetch(Moxi.user.id).catch(() => null);
            const perms = me ? channel?.permissionsFor?.(me) : null;
            const required = [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.AttachFiles,
            ];

            if (!perms || !required.every(p => perms.has(p))) {
                const missing = perms ? perms.missing(required) : ['ViewChannel', 'SendMessages', 'AttachFiles'];
                const nice = describeMissingPerms(missing).join(', ');
                debugHelper.warn('welcome', 'missing perms (test)', { channelId: channel?.id, missing });
                return message.reply(panel(Moxi, 'Welcome', `${EMOJIS.cross} No puedo enviar la tarjeta en <#${channel?.id || channelId}>\nFaltan permisos: **${nice}**`));
            }

            const avatarUrl = message.author.displayAvatarURL({ size: 512, extension: 'png', forceStatic: true });

            const fetchedUser = await message.client.users.fetch(message.author.id, { force: true }).catch(() => null);
            const userBanner = fetchedUser?.bannerURL?.({ size: 2048, extension: 'png' }) || undefined;
            const guildBg = message.guild.bannerURL?.({ size: 2048, extension: 'png' }) || message.guild.iconURL?.({ size: 2048, extension: 'png' }) || undefined;
            const bg = userBanner || guildBg;
            debugHelper.log('welcome', 'test background', { hasUserBanner: !!userBanner, hasGuildBg: !!guildBg });
            const username = message.author.username;
            const memberCount = String(message.guild.memberCount || 0);
            const rawTemplate = getWelcomeTemplateForLang(cfg, lang);
            debugHelper.log('welcome', 'test template', { lang, hasTemplate: !!rawTemplate });
            const msgText = rawTemplate ? applyTemplate(rawTemplate, { user: username, server: message.guild.name, count: message.guild.memberCount || 0 }) : undefined;

            let buffer;
            try {
                if (style === 'discord-arts') {
                    buffer = await buildDiscordArtsProfile({
                        userId: message.author.id,
                        customTag: msgText,
                        customBackground: bg,
                    });
                } else if (style === 'canvacard') {
                    buffer = await buildCanvacardWelcomeLeave({
                        type: 'welcome',
                        avatarUrl,
                        backgroundUrl: bg,
                        title: `¡Bienvenid@ ${username}!`,
                        subtitle: msgText,
                    });
                } else {
                    buffer = await buildSylphaGreeting({
                        type: 'welcome',
                        username,
                        message: msgText,
                        memberCount,
                        avatarImage: avatarUrl,
                        backgroundImage: bg,
                        backgroundColor: '#0a192f',
                        primaryColor: '#e6f1ff',
                        textColor: '#e6f1ff',
                        secondaryTextColor: '#a8b2d1',
                        accentColor: toHexColor(Bot?.AccentColor, '#00d9ff'),
                        imageDarkness: 40,
                    });
                }
            } catch (err) {
                debugHelper.error('welcome', 'card generation failed (test)', { style, err });

                if (style === 'discord-arts' || style === 'canvacard') {
                    try {
                        buffer = await buildSylphaGreeting({
                            type: 'welcome',
                            username,
                            message: msgText,
                            memberCount,
                            avatarImage: avatarUrl,
                            backgroundImage: bg,
                            backgroundColor: '#0a192f',
                            primaryColor: '#e6f1ff',
                            textColor: '#e6f1ff',
                            secondaryTextColor: '#a8b2d1',
                            accentColor: toHexColor(Bot?.AccentColor, '#00d9ff'),
                            imageDarkness: 40,
                        });
                        debugHelper.log('welcome', 'test fallback to sylphacard ok', { bytes: buffer?.length || 0 });
                    } catch (err2) {
                        debugHelper.error('welcome', 'fallback sylphacard failed (test)', err2);
                        return message.reply(panel(Moxi, 'Welcome', `${EMOJIS.cross} No se pudo generar la tarjeta con el estilo **${style}**. Revisa la consola para más detalles.`));
                    }
                } else {
                    return message.reply(panel(Moxi, 'Welcome', `${EMOJIS.cross} No se pudo generar la tarjeta con el estilo **${style}**. Revisa la consola para más detalles.`));
                }
            }

            debugHelper.log('welcome', 'test card generated', { bytes: buffer?.length || 0 });

            const attachment = new AttachmentBuilder(buffer, { name: 'welcome-test.png' });
            await channel.send({ content: `<@${message.author.id}>`, files: [attachment] }).catch((err) => {
                debugHelper.error('welcome', 'send failed (test)', err);
                return null;
            });
            return message.reply(panel(Moxi, 'Welcome', `${EMOJIS.tick} Test enviado en <#${channel.id}>`));
        }

        // status: prefer dedicated Welcome collection, fallback to embedded GuildData
        const serverDoc = await GuildData.findOne({ guildID: guildId }).lean().catch((err) => {
            debugHelper.error('welcome', 'DB findOne failed (status)', err);
            return null;
        });
        const welcomeDoc = await Welcome.findOne({ guildID: guildId, type: 'config' }).lean().catch((err) => {
            debugHelper.error('welcome', 'Welcome.findOne failed (status)', err);
            return null;
        });
        const cfg = welcomeDoc || serverDoc?.Welcome;
        const enabled = !!cfg?.enabled;
        const channelId = cfg?.channelID ? String(cfg.channelID) : '';
        const style = (cfg?.style && typeof cfg.style === 'string') ? cfg.style : 'sylphacard';
        const msgText = getWelcomeTemplateForLang(cfg, lang) || '-';
        return message.reply(panel(
            Moxi,
            'Welcome',
            `${EMOJIS.info || ''} Estado: **${enabled ? 'ON' : 'OFF'}**\n${EMOJIS.channel || ''} Canal: ${channelId ? `<#${channelId}>` : '-'}\n${EMOJIS.edit || ''} Idioma: **${lang}**\n${EMOJIS.edit || ''} Estilo: **${style}**\n${EMOJIS.edit || ''} Mensaje: ${msgText}`.trim()
        ));
    }
};
