
const { PermissionsBitField: { Flags }, ContainerBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { setGuildLanguage } = require('../../Util/guildSettings');
const log = require('../../Util/logger');
const { invalidateGuildSettingsCache } = require('../../Util/guildSettings');
const { EMOJIS } = require('../../Util/emojis');
const { Bot } = require('../../Config');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const debugHelper = require('../../Util/debugHelper');

module.exports = {
    name: 'language',
    alias: ['language', 'lang', 'idioma', 'lenguaje'],
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ADMIN', lang);
    },
    usage: 'language [código de idioma]',
    get description() { return moxi.translate('commands:CMD_LANGUAGE_DESC', 'es-ES'); },
    cooldown: 30,
    permissions: {
        User: [Flags.Administrator],
    },
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
        options: [
            {
                name: 'language',
                description: 'Select the language for the bot',
                type: 3, // STRING
                required: false,
                choices: require('fs').readFileSync(require('path').join(__dirname, '../../Languages/language-meta.json'), 'utf8')
                    ? JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '../../Languages/language-meta.json'), 'utf8')).map(lang => ({ name: lang.nativeName, value: lang.name }))
                    : []
            }
        ],
    },
    async execute(Moxi, message, args) {
        const baseLang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
        // Use the messageRun logic from your design
        const languages = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '../../Languages/language-meta.json'), 'utf8')).map(lang => ({
            code: lang.name,
            short: lang.name.split('-')[0],
            name: lang.nativeName,
            emoji: lang.emoji || '',
            flag: lang.flag || ''
        }));

        debugHelper.log('language', 'execute start', {
            guildId: message.guild?.id || 'dm',
            userId: message.author?.id,
            argsCount: (args || []).length,
            preview: (args || []).slice(0, 3),
        });

        if (args[0]) {
            // Acepta exacto (slash), minúsculas (prefijo), short y nativeName
            const input = args[0];
            const targetLang = languages.find(
                l => l.code === input ||
                    l.code.toLowerCase() === input.toLowerCase() ||
                    l.short === input.toLowerCase() ||
                    l.name.toLowerCase() === input.toLowerCase()
            );
            if (!targetLang) {
                debugHelper.warn('language', 'invalid language input', {
                    guildId: message.guild?.id || 'dm',
                    userId: message.author?.id,
                    input,
                });
                const text =
                    moxi.translate('MISSING_LANGUAGE', baseLang) +
                    '\n\n' +
                    languages.map(l => `\`${l.code}\` - ${l.emoji} ${l.name}`).join('\n');
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({ emoji: EMOJIS.cross, text })
                    )
                );
            }
            try {
                let ownerId = message.guild?.ownerId || null;
                if (!ownerId) {
                    try {
                        const owner = await message.guild.fetchOwner?.();
                        ownerId = owner?.id || owner?.user?.id || null;
                    } catch (_) {
                        ownerId = null;
                    }
                }
                const ok = await setGuildLanguage(message.guild.id, targetLang.code, ownerId);
                if (ok) {
                    message.guild.settings = message.guild.settings || {};
                    message.guild.settings.Language = targetLang.code;
                    invalidateGuildSettingsCache(message.guild.id);
                    return message.reply(
                        asV2MessageOptions(
                            buildNoticeContainer({
                                emoji: EMOJIS.tick,
                                text: moxi.translate('LANGUAGE_SET', targetLang.code, { language: targetLang.name }),
                            })
                        )
                    );
                } else {
                    debugHelper.warn('language', 'setGuildLanguage returned false', {
                        guildId: message.guild?.id || 'dm',
                        target: targetLang.code,
                        userId: message.author?.id,
                    });
                    return message.reply(
                        asV2MessageOptions(
                            buildNoticeContainer({
                                emoji: EMOJIS.cross,
                                text: moxi.translate('ERROR_MESSAGE', baseLang, { err: 'No se pudo actualizar el idioma en la base de datos.' }),
                            })
                        )
                    );
                }
            } catch (err) {
                debugHelper.error('language', 'setGuildLanguage exception', {
                    guildId: message.guild?.id || 'dm',
                    userId: message.author?.id,
                    error: err?.message || err,
                });
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            text: moxi.translate('ERROR_MESSAGE', baseLang, { err: err.message }),
                        })
                    )
                );
            }
        }

        const langCode = baseLang;
        const currentLang = languages.find(l => l.code === langCode || l.short === langCode)?.name || 'Español';
        let lastLangCode = langCode;

        const container = new ContainerBuilder()
            .setAccentColor(Bot.AccentColor)
            .addTextDisplayComponents(c =>
                c.setContent(
                    `**${EMOJIS.earth} ${moxi.translate('LANGUAGE_SELECTION', langCode)}**\n\n` +
                    `${moxi.translate('LANGUAGE_DESCRIPTION', langCode)}\n\n` +
                    `**${EMOJIS.book} ${moxi.translate('AVAILABLE_LANGUAGES', langCode) || 'Available Languages:'}**\n${'─'.repeat(30)}`
                )
            );

        languages.forEach(lang => {
            const isSelected = langCode === lang.code;
            container.addSectionComponents(section =>
                section
                    .addTextDisplayComponents(text =>
                        text.setContent(`${lang.emoji} **${lang.name}** (${lang.code})${isSelected ? ` ${EMOJIS.tick}` : ''}`)
                    )
                    .setButtonAccessory(
                        new ButtonBuilder()
                            .setCustomId(`lang_button_${lang.code}`)
                            .setLabel(moxi.translate('SELECT', langCode) || 'Select')
                            .setStyle(isSelected ? ButtonStyle.Success : ButtonStyle.Primary)
                    )
            );
        });

        container
            .addTextDisplayComponents(c =>
                c.setContent(`${'─'.repeat(30)}\n\n**Current Language:** ${currentLang}`)
            )
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(c =>
                c.setContent(`${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`)
            );

        const msg = await message.channel.send({
            components: [container],
            flags: MessageFlags.IsComponentsV2
        });

        const filter = i => i.customId.startsWith('lang_button_') && i.user.id === message.author.id;
        const collector = msg.createMessageComponentCollector({
            filter,
            time: 60000,
            max: Infinity
        });

        collector.on('collect', async (i) => {
            debugHelper.log('language', 'collector collect', {
                guildId: message.guild?.id || 'dm',
                collectorUserId: i.user?.id,
                componentId: i.customId,
            });
            const selectedCode = i.customId.replace('lang_button_', '');
            const selectedLang = languages.find(l => l.code === selectedCode);
            // Usar moxi.translate directamente para traducción segura
            if (!selectedLang) {
                debugHelper.warn('language', 'collector unknown selection', {
                    guildId: message.guild?.id || 'dm',
                    selectedCode,
                });
                return i.deferUpdate();
            }
            try {
                let ownerId = message.guild?.ownerId || null;
                if (!ownerId) {
                    try {
                        const owner = await message.guild.fetchOwner?.();
                        ownerId = owner?.id || owner?.user?.id || null;
                    } catch (_) {
                        ownerId = null;
                    }
                }
                const ok = await setGuildLanguage(message.guild.id, selectedCode, ownerId);
                if (ok) {
                    message.guild.settings = message.guild.settings || {};
                    message.guild.settings.Language = selectedCode;
                    invalidateGuildSettingsCache(message.guild.id);
                    lastLangCode = selectedCode;
                    const updatedContainer = new ContainerBuilder()
                        .setAccentColor(Bot.AccentColor)
                        .addTextDisplayComponents(c =>
                            c.setContent(
                                `**${EMOJIS.earth} ${moxi.translate('LANGUAGE_SELECTION', selectedCode)}**\n\n` +
                                `${moxi.translate('LANGUAGE_DESCRIPTION', selectedCode)}\n\n` +
                                `**${EMOJIS.book} ${moxi.translate('AVAILABLE_LANGUAGES', selectedCode) || 'Available Languages:'}**\n${'─'.repeat(30)}`
                            )
                        );
                    languages.forEach(lang => {
                        const isSelected = selectedCode === lang.code;
                        updatedContainer.addSectionComponents(section =>
                            section
                                .addTextDisplayComponents(text =>
                                    text.setContent(`${lang.emoji} **${lang.name}** (${lang.code})${isSelected ? ` ${EMOJIS.tick}` : ''}`)
                                )
                                .setButtonAccessory(
                                    new ButtonBuilder()
                                        .setCustomId(`lang_button_${lang.code}`)
                                        .setLabel(moxi.translate('SELECT', selectedCode) || 'Select')
                                        .setStyle(isSelected ? ButtonStyle.Success : ButtonStyle.Primary)
                                )
                        );
                    });
                    updatedContainer
                        .addTextDisplayComponents(c =>
                            c.setContent(
                                `${'─'.repeat(30)}\n\n**${moxi.translate('CURRENT_LANGUAGE', selectedCode) || 'Current Language:'}** **${selectedLang.name}** ${EMOJIS.tick}\n\n**${moxi.translate('LANGUAGE_SET', selectedCode, { language: selectedLang.name }) || selectedLang.name}**`
                            )
                        )
                        .addSeparatorComponents(s => s.setDivider(true))
                        .addTextDisplayComponents(c =>
                            c.setContent(`${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`)
                        );
                    await i.deferUpdate();
                    await msg.edit({
                        components: [updatedContainer],
                        flags: MessageFlags.IsComponentsV2
                    }).catch(err => log.error('Error updating message:', err));
                } else {
                    debugHelper.warn('language', 'collector setGuildLanguage returned false', {
                        guildId: message.guild?.id || 'dm',
                        selectedCode,
                        userId: i.user?.id,
                    });
                    return i.reply({
                        content: '',
                        components: [
                            buildNoticeContainer({
                                emoji: EMOJIS.cross,
                                text: moxi.translate('ERROR_MESSAGE', selectedCode, { err: 'No se pudo actualizar el idioma en la base de datos.' }),
                            }),
                        ],
                        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
                    });
                }
            } catch (err) {
                log.error('Language change error:', err);
                debugHelper.error('language', 'collector update failure', {
                    guildId: message.guild?.id || 'dm',
                    error: err?.message || err,
                    selectedCode,
                });
                await i.deferUpdate();
            }
        });

        collector.on('end', async () => {
            try {
                // En mensajes Components V2, no podemos dejar el mensaje vacío.
                // Reconstruimos el panel y deshabilitamos los botones al finalizar.
                const disabledContainer = new ContainerBuilder()
                    .setAccentColor(Bot.AccentColor)
                    .addTextDisplayComponents(c =>
                        c.setContent(
                            `**${EMOJIS.earth} ${moxi.translate('LANGUAGE_SELECTION', lastLangCode)}**\n\n` +
                            `${moxi.translate('LANGUAGE_DESCRIPTION', lastLangCode)}\n\n` +
                            `**${EMOJIS.book} ${moxi.translate('AVAILABLE_LANGUAGES', lastLangCode) || 'Available Languages:'}**\n${'─'.repeat(30)}`
                        )
                    );

                const finalLangName = languages.find(l => l.code === lastLangCode || l.short === lastLangCode)?.name || lastLangCode;
                languages.forEach(lang => {
                    const isSelected = lastLangCode === lang.code;
                    disabledContainer.addSectionComponents(section =>
                        section
                            .addTextDisplayComponents(text =>
                                text.setContent(`${lang.emoji} **${lang.name}** (${lang.code})${isSelected ? ` ${EMOJIS.tick}` : ''}`)
                            )
                            .setButtonAccessory(
                                new ButtonBuilder()
                                    .setCustomId(`lang_button_${lang.code}`)
                                    .setLabel(moxi.translate('SELECT', lastLangCode) || 'Select')
                                    .setStyle(isSelected ? ButtonStyle.Success : ButtonStyle.Primary)
                                    .setDisabled(true)
                            )
                    );
                });

                disabledContainer
                    .addTextDisplayComponents(c =>
                        c.setContent(`${'─'.repeat(30)}\n\n**${moxi.translate('CURRENT_LANGUAGE', lastLangCode) || 'Current Language:'}** **${finalLangName}**`)
                    )
                    .addSeparatorComponents(s => s.setDivider(true))
                    .addTextDisplayComponents(c =>
                        c.setContent(`${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`)
                    );

                await msg.edit({
                    components: [disabledContainer],
                    flags: MessageFlags.IsComponentsV2
                });
            } catch (err) {
                log.error('Error removing components after collector end:', err);
                debugHelper.error('language', 'collector end failure', {
                    guildId: message.guild?.id || 'dm',
                    error: err?.message || err,
                });
            }
        });
    }
};
