const { ApplicationCommandOptionType: { String }, MessageFlags, ComponentType } = require('discord.js');
const { createEmojiContainer, finalizeEmojiContainer } = require('../../Util/emojiCard');
const moxi = require('../../i18n');
const { buildEmojiPaginationRow, createPageNavigationModal } = require('../../Util/emojiPagination');
const debugHelper = require('../../Util/debugHelper');

function buildEmojiResponse(payload, client, translate, actionRows = []) {
    return finalizeEmojiContainer(createEmojiContainer({ ...payload, actionRows }), client, translate);
}

function buildEmojiListResponse({ entries, client, translate, page = 0, pageSize = 20, navRowBuilder }) {
    const header = `# ${translate('misc:ADDEMOJI_LIST_TITLE') || 'Emojis registrados'}`;
    const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
    const safePage = Math.min(Math.max(0, page), totalPages - 1);
    const startIndex = safePage * pageSize;
    const preview = entries.slice(startIndex, startIndex + pageSize);
    const body = preview.join('\n');
    const navHint = translate('misc:ADDEMOJI_NAV_HINT') || 'Usa los botones grises para saltar entre páginas o abrir el modal de salto rápido.';
    const bodyWithHint = `${body}\n\n${navHint}`;
    const pageWord = translate('PAGE') || translate('misc:PAGE') || 'Página';
    const detailParts = [];

    if (totalPages > 1) {
        detailParts.push(`${pageWord} ${safePage + 1}/${totalPages}`);
    }

    detailParts.push(`total ${entries.length}`);
    const detail = detailParts.join(' • ');

    const actionRows = navRowBuilder ? [navRowBuilder({ page: safePage, totalPages })] : [];

    return {
        container: buildEmojiResponse({ header, body: bodyWithHint, detail }, client, translate, actionRows),
        totalPages,
        page: safePage,
    };
}


module.exports = {
    name: 'addemoji',
    alias: ['addemy', 'ae'],
    description: 'Add an emoji to the server',
    usage: 'addemoji <emoji/url> <name>',
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ADMIN', lang);
    },
    cooldown: 5,

    execute: async (Moxi, message, args) => {
        const translate = message.translate.bind(message);
        const respond = (container) =>
            message.reply({ components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });

        debugHelper.log('addemoji', 'execute start', {
            guildId: message.guild?.id || 'dm',
            userId: message.author?.id,
            argsCount: args.length,
            preview: args.slice(0, 3),
        });
        if (!message.member?.permissions.has('ManageGuildExpressions')) {
            const container = buildEmojiResponse(
                {
                    header: `# ❌ ${translate('misc:ADDEMOJI_NO_PERMISSION')}`,
                    body: translate('misc:NO_PERMISSION')
                },
                Moxi,
                translate
            );

            debugHelper.warn('addemoji', 'missing permission', {
                guildId: message.guild?.id || 'dm',
                userId: message.author?.id,
            });

            return respond(container);
        }

        if (args.length < 1) {
            const emojis = message.guild?.emojis.cache;
            if (!emojis || emojis.size === 0) {
                const container = buildEmojiResponse(
                    {
                        header: '# ℹ️ Uso de addemoji',
                        body: translate('misc:ADDEMOJI_USAGE_DESC') || 'Envía un emoji personalizado/media o pega una URL junto al nombre.',
                        detail: translate('misc:ADDEMOJI_USAGE') || 'addemoji <emoji/url> <nombre>'
                    },
                    Moxi,
                    translate
                );

                return respond(container);
            }

            const entries = Array.from(emojis.values()).map((emoji) => `${emoji} \`${emoji.name}\``);
            const pageSize = 20;
            const navRowBuilder = ({ page, totalPages }) => buildEmojiPaginationRow(page, totalPages, translate);
            const { container: listContainer, totalPages } = buildEmojiListResponse({
                entries,
                client: Moxi,
                translate,
                page: 0,
                pageSize,
                navRowBuilder,
            });

            if (totalPages <= 1) {
                return respond(listContainer);
            }

            let currentPage = 0;
            let messageDeleted = false;
            const listMessage = await respond(listContainer);
            const unauthorizedButtonsMessage = translate('misc:BUTTONS_NOT_OWNER') || 'Solo la persona que ejecutó el comando puede usar los botones.';
            const infoNavMessage = translate('misc:ADDEMOJI_NAV_INFO') || 'Usa inicio, anterior y siguiente para recorrer la lista de emojis.';
            const collector = listMessage.createMessageComponentCollector({
                componentType: ComponentType.Button,
                time: 120000,
            });

            collector.on('collect', async (interactionComponent) => {
                if (interactionComponent.user.id !== message.author.id) {
                    await interactionComponent.reply({ content: unauthorizedButtonsMessage, ephemeral: true });
                    return;
                }

                const { customId } = interactionComponent;
                if (customId === 'addemoji-list-info') {
                    const modal = createPageNavigationModal(translate, infoNavMessage);
                    await interactionComponent.showModal(modal);
                    try {
                        const modalResult = await interactionComponent.awaitModalSubmit({
                            filter: (modalInteraction) =>
                                modalInteraction.customId === 'addemoji-nav-page-modal' &&
                                modalInteraction.user.id === interactionComponent.user.id,
                            time: 60000,
                        });

                        const pageInput = modalResult.fields.getTextInputValue('addemoji-nav-page-field');
                        const requested = parseInt(pageInput, 10);
                        if (Number.isNaN(requested) || requested <= 0 || requested > totalPages) {
                            await modalResult.reply({
                                content: translate('misc:ADDEMOJI_NAV_PAGE_INVALID', { min: 1, max: totalPages }) ||
                                    `Ingresa un número entre 1 y ${totalPages}`,
                                ephemeral: true,
                            });
                            return;
                        }

                        currentPage = Math.min(Math.max(0, requested - 1), totalPages - 1);
                        await modalResult.deferUpdate();
                        const { container: updatedContainer } = buildEmojiListResponse({
                            entries,
                            client: Moxi,
                            translate,
                            page: currentPage,
                            pageSize,
                            navRowBuilder,
                        });
                        if (!messageDeleted) {
                            try {
                                await listMessage.edit({
                                    components: [updatedContainer],
                                    flags: MessageFlags.IsComponentsV2,
                                });
                            } catch (error) {
                                if (error.code !== 10008) throw error;
                            }
                        }

                    } catch (err) {
                        // ignore timeouts or cancellations
                    }
                    return;
                }

                if (customId === 'addemoji-list-close') {
                    await interactionComponent.deferUpdate();
                    collector.stop('close');
                    await listMessage
                        .delete()
                        .then(() => {
                            messageDeleted = true;
                        })
                        .catch(() => null);
                    return;
                }

                let moved = false;
                if (customId === 'addemoji-list-prev' && currentPage > 0) {
                    currentPage -= 1;
                    moved = true;
                } else if (customId === 'addemoji-list-next' && currentPage < totalPages - 1) {
                    currentPage += 1;
                    moved = true;
                } else if (customId === 'addemoji-list-home' && currentPage !== 0) {
                    currentPage = 0;
                    moved = true;
                }

                if (!moved) {
                    return interactionComponent.deferUpdate();
                }

                const { container: updatedContainer } = buildEmojiListResponse({
                    entries,
                    client: Moxi,
                    translate,
                    page: currentPage,
                    pageSize,
                    navRowBuilder,
                });
                await interactionComponent.update({
                    components: [updatedContainer],
                    flags: MessageFlags.IsComponentsV2,
                });
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'close') return;
                const { container: finalContainer } = buildEmojiListResponse({
                    entries,
                    client: Moxi,
                    translate,
                    page: currentPage,
                    pageSize,
                    navRowBuilder,
                });
                if (!messageDeleted) {
                    try {
                        await listMessage.edit({
                            components: [finalContainer],
                            flags: MessageFlags.IsComponentsV2,
                        });
                    } catch (error) {
                        if (error.code !== 10008) throw error;
                    }
                }
            });

            return;
        }

        try {
            const emojiData = args[0];
            let emojiName = args.slice(1).join('') || null;
            let imageUrl = emojiData;

            const customEmojiRegex = /<a?:[\w]+:(\d+)>/;
            const match = emojiData ? emojiData.match(customEmojiRegex) : null;

            if (match) {
                const emojiId = match[1];
                const isAnimated = emojiData.startsWith('<a:');
                imageUrl = `https://cdn.discordapp.com/emojis/${emojiId}.${isAnimated ? 'gif' : 'png'}?quality=lossless`;
            } else if (emojiData && emojiData.startsWith('http')) {
                // already a link, use as-is
            } else {
                const attachment = message.attachments?.find(
                    (att) => att.contentType?.startsWith('image/') || att.url.match(/\.(png|jpg|jpeg|gif)$/i)
                );

                if (attachment) {
                    imageUrl = attachment.url;
                    if (!emojiName) {
                        const baseName = attachment.name ? attachment.name.split('.')[0] : `emoji_${Date.now()}`;
                        emojiName = baseName.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 32) || `emoji_${Date.now()}`;
                    }
                } else {
                    const container = buildEmojiResponse(
                        {
                            header: '# ℹ️ Uso de addemoji',
                            body: translate('misc:ADDEMOJI_USAGE_DESC') || 'Envía un emoji personalizado/media o pega una URL junto al nombre.',
                            detail: translate('misc:ADDEMOJI_USAGE') || 'addemoji <emoji/url> <nombre>'
                        },
                        Moxi,
                        translate
                    );

                    return respond(container);
                }
            }

            if (!emojiName) {
                emojiName = `emoji_${Date.now()}`;
            }

            const response = await fetch(imageUrl);
            if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
            const data = await response.arrayBuffer();
            const buffer = Buffer.from(data);

            const newEmoji = await message.guild.emojis.create({
                attachment: buffer,
                name: emojiName,
            });

            const container = buildEmojiResponse(
                {
                    header: `# ✅ ${translate('misc:ADDEMOJI_SUCCESS')}`,
                    body: `${translate('misc:ADDEMOJI_NAME') || 'Nombre'}: \`${emojiName}\`\n${translate('misc:ADDEMOJI_EMOJI') || 'Emoji'}: ${newEmoji}`
                },
                Moxi,
                translate
            );

            return respond(container);
        } catch (error) {
            const container = buildEmojiResponse(
                {
                    header: `# ❌ ${translate('misc:ADDEMOJI_ERROR')}`,
                    body: `\`\`\`js\n${error.message || error}\n\`\`\``
                },
                Moxi,
                translate
            );

            debugHelper.error('addemoji', 'execute error', {
                guildId: message.guild?.id || 'dm',
                userId: message.author?.id,
                error: error?.message || error,
            });

            return respond(container);
        }
    },

    interactionRun: async (client, interaction) => {
        debugHelper.log('addemoji', 'interaction start', {
            guildId: interaction.guild?.id || 'dm',
            userId: interaction.user?.id,
            args: { emoji: interaction.options.getString('emoji'), name: interaction.options.getString('name') },
        });
        const translate = interaction.translate.bind(interaction);
        const respond = (container) =>
            interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true });

        if (!interaction.member?.permissions.has('ManageGuildExpressions')) {
            const container = buildEmojiResponse(
                {
                    header: `# ❌ ${translate('misc:ADDEMOJI_NO_PERMISSION')}`,
                    body: translate('misc:NO_PERMISSION')
                },
                client,
                translate
            );

            return respond(container);
        }

        const emojiData = interaction.options.getString('emoji');
        let emojiName = interaction.options.getString('name');
        let imageUrl = emojiData;

        const customEmojiRegex = /<a?:[\w]+:(\d+)>/;
        const match = emojiData ? emojiData.match(customEmojiRegex) : null;

        if (match) {
            const emojiId = match[1];
            const isAnimated = emojiData.startsWith('<a:');
            imageUrl = `https://cdn.discordapp.com/emojis/${emojiId}.${isAnimated ? 'gif' : 'png'}?quality=lossless`;
        } else if (emojiData && emojiData.startsWith('http')) {
            // already set
        } else {
            const attachment = interaction.options.getAttachment && interaction.options.getAttachment('emoji');
            if (attachment && attachment.contentType?.startsWith('image/')) {
                imageUrl = attachment.url;
            } else {
                throw new Error('Please provide a valid image URL, custom emoji, or attach an image.');
            }
        }

        if (!emojiName) {
            emojiName = `emoji_${Date.now()}`;
        }

        try {
            const response = await fetch(imageUrl);
            if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
            const data = await response.arrayBuffer();
            const buffer = Buffer.from(data);

            const newEmoji = await interaction.guild.emojis.create({
                attachment: buffer,
                name: emojiName,
            });

            const container = buildEmojiResponse(
                {
                    header: `# ✅ ${translate('misc:ADDEMOJI_SUCCESS')}`,
                    body: `${translate('misc:ADDEMOJI_NAME') || 'Nombre'}: \`${emojiName}\`\n${translate('misc:ADDEMOJI_EMOJI') || 'Emoji'}: ${newEmoji}`
                },
                client,
                translate
            );

            return respond(container);
        } catch (error) {
            const container = buildEmojiResponse(
                {
                    header: `# ❌ ${translate('misc:ADDEMOJI_ERROR')}`,
                    body: `\`\`\`js\n${error.message || error}\n\`\`\``
                },
                client,
                translate
            );

            debugHelper.error('addemoji', 'interaction error', {
                guildId: interaction.guild?.id || 'dm',
                userId: interaction.user?.id,
                error: error?.message || error,
            });

            return respond(container);
        }
    },
};
