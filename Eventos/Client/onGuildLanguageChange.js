// Evento: onGuildLanguageChange
// Este archivo debe exportar una función que maneje el cambio de idioma en un servidor (guild).
// Implementa aquí la lógica necesaria para actualizar mensajes, notificaciones, etc.

const GuildMessage = require('../../Models/GuildMessageSchema');
const fs = require('fs');
const path = require('path');
const { ContainerBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { ButtonBuilder } = require('../../Util/compatButtonBuilder');
const { Bot } = require('../../Config');
const { EMOJIS } = require('../../Util/emojis');
const { isFlagEnabled } = require('../../Util/debug');
const { normalizeDiscordId, normalizeDbText } = require('../../Util/idGuards');

module.exports = async (guild, newLanguage) => {
    const guildId = normalizeDiscordId(guild?.id);
    if (!guildId) return;

    try {
        // --- Actualizar mensaje de reglas ---
        const rulesMsg = await GuildMessage.findOne({ guildId, type: 'rules' });
        if (rulesMsg) {
            const rulesChannelId = normalizeDiscordId(rulesMsg.channelId);
            const rulesMessageId = normalizeDiscordId(rulesMsg.messageId);
            const channel = rulesChannelId ? (guild.channels.cache.get(rulesChannelId) || await guild.channels.fetch(rulesChannelId).catch(() => null)) : null;
            if (channel) {
                const message = rulesMessageId ? await channel.messages.fetch(rulesMessageId).catch(() => null) : null;
                if (message) {
                    // Leer las reglas en el nuevo idioma
                    const rulesPath = path.join(__dirname, '../../Languages', newLanguage, 'rules', 'rules.json');
                    let rules = null;
                    if (fs.existsSync(rulesPath)) {
                        rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
                    } else {
                        // fallback a español
                        const fallbackPath = path.join(__dirname, '../../Languages/es-ES/rules/rules.json');
                        if (fs.existsSync(fallbackPath)) {
                            rules = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
                        }
                    }
                    if (rules) {
                        // Leer el título desde el archivo title.json del idioma
                        let title = 'Moxi Studio Rules';
                        const titlePath = path.join(__dirname, `../../Languages/${newLanguage}/rules/title.json`);
                        if (fs.existsSync(titlePath)) {
                            try {
                                const titleData = JSON.parse(fs.readFileSync(titlePath, 'utf8'));
                                if (titleData && titleData.title) title = titleData.title;
                            } catch { }
                        }
                        // Construir el nuevo embed/contenido
                        const getTitle = r => r.title || r.titulo || '';
                        const getDesc = r => r.description || r.descripcion || '';
                        const container = new ContainerBuilder()
                            .setAccentColor(Bot.AccentColor)
                            .addTextDisplayComponents(c => c.setContent(`# ${EMOJIS.book || '📖'} ${title}`))
                            .addSeparatorComponents(s => s.setDivider(true));
                        for (const regla of rules) {
                            container.addTextDisplayComponents(c =>
                                c.setContent(`**${regla.id}. ${getTitle(regla)}**\n${getDesc(regla)}`)
                            );
                            container.addSeparatorComponents(s => s.setDivider(false));
                        }
                        // Botón para los reglamentos de Discord
                        const discordTermsUrl = 'https://discord.com/terms';
                        const discordGuidelinesUrl = 'https://discord.com/guidelines';
                        container.addActionRowComponents(row =>
                            row.addComponents(
                                new ButtonBuilder()
                                    .setLabel('Términos de Discord')
                                    .setStyle(ButtonStyle.Link)
                                    .setURL(discordTermsUrl),
                                new ButtonBuilder()
                                    .setLabel('Normas de Discord')
                                    .setStyle(ButtonStyle.Link)
                                    .setURL(discordGuidelinesUrl)
                            )
                        );
                        container.addSeparatorComponents(s => s.setDivider(true));
                        container.addTextDisplayComponents(c =>
                            c.setContent(`${EMOJIS.copyright} ${guild.client.user?.username || 'Moxi Studio'} • ${new Date().getFullYear()}`)
                        );
                        // Editar el mensaje de reglas
                        await message.edit({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
                        // Actualizar el idioma en el registro
                        rulesMsg.lastLanguage = normalizeDbText(newLanguage, { maxLen: 12, fallback: 'es-ES' });
                        await rulesMsg.save();
                        if (isFlagEnabled('onGuildLanguageChange')) console.log(`[ONGUILDLANGUAGECHANGE_DEBUG] Mensaje de reglas actualizado automáticamente para el servidor ${guildId} (${newLanguage})`);
                    }
                }
            }
        }

        // --- Actualizar mensaje de bugGuide ---
        const bugGuideMsg = await GuildMessage.findOne({ guildId, type: 'bugGuide' });
        if (bugGuideMsg) {
            // El bugGuide se guarda como: channelId = threadId, messageId = starterMsgId
            const threadId = normalizeDiscordId(bugGuideMsg.channelId);
            const starterId = normalizeDiscordId(bugGuideMsg.messageId);
            const thread = threadId ? (guild.channels.cache.get(threadId) || await guild.channels.fetch(threadId).catch(() => null)) : null;
            if (thread) {
                const starterMsg = starterId ? await thread.messages.fetch(starterId).catch(() => null) : null;
                if (starterMsg) {
                    // Leer el contenido de bugGuidelines.json
                    const guidelinesPath = path.join(__dirname, '../../Languages', newLanguage, 'utility', 'bugGuidelines.json');
                    let guidelines = null;
                    if (fs.existsSync(guidelinesPath)) {
                        try {
                            const data = JSON.parse(fs.readFileSync(guidelinesPath, 'utf8'));
                            guidelines = data && data.README ? data.README : null;
                        } catch { }
                    }
                    if (!guidelines) {
                        // fallback a español
                        const fallbackPath = path.join(__dirname, '../../Languages/es-ES/utility/bugGuidelines.json');
                        if (fs.existsSync(fallbackPath)) {
                            try {
                                const data = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
                                guidelines = data && data.README ? data.README : null;
                            } catch { }
                        }
                    }
                    if (guidelines) {
                        // Reemplazar {{guildName}} si existe
                        guidelines = guidelines.replace(/\{\{guildName\}\}/g, guild.name);
                        // Editar el mensaje guía
                        await starterMsg.edit(guidelines);
                        // Actualizar el idioma en el registro
                        bugGuideMsg.lastLanguage = normalizeDbText(newLanguage, { maxLen: 12, fallback: 'es-ES' });
                        await bugGuideMsg.save();
                        if (isFlagEnabled('onGuildLanguageChange')) console.log(`[ONGUILDLANGUAGECHANGE_DEBUG] Mensaje de bugGuide actualizado automáticamente para el servidor ${guildId} (${newLanguage})`);
                    }
                }
            }
        }
    } catch (err) {
        if (isFlagEnabled('onGuildLanguageChange')) console.error('[ONGUILDLANGUAGECHANGE_DEBUG] Error actualizando mensajes tras cambiar idioma:', err);
    }
};
