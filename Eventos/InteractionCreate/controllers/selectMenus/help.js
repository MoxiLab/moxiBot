const debugHelper = require('../../../../Util/debugHelper');

module.exports = async function helpSelectMenu(interaction, Moxi, logger) {
    if (interaction.customId !== 'help-categorias' && interaction.customId !== 'help2-categorias') return false;

    const getHelpContent = require('../../../../Util/getHelpContent');
    const moxi = require('../../../../i18n');
    const { buildNoticeContainer, asV2MessageOptions } = require('../../../../Util/v2Notice');
    const { EMOJIS } = require('../../../../Util/emojis');

    const categoria = interaction.values[0];
    const page = 0;
    const guildId = interaction.guildId || interaction.guild?.id;
    const useV2 = true;
    const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
    const userId = interaction.user?.id || interaction.member?.user?.id;

    const helpDebugEnabled = debugHelper.isEnabled('help');

    async function safeUpdate(interaction, payload) {
        try {
            await interaction.update(payload);
            return true;
        } catch (err) {
            try {
                // Fallback: editar el mensaje original si el interaction token expiró
                if (interaction.message && typeof interaction.message.edit === 'function') {
                    await interaction.message.edit(payload);
                    return true;
                }
            } catch (err2) {
                // ignore
            }
            // Re-throw para manejo externo
            throw err;
        }
    }

    if (helpDebugEnabled) {
        debugHelper.log('help', `selectMenu categoria=${categoria} lang=${lang} guildId=${guildId || 'n/a'} userId=${userId || 'n/a'}`);
    }

    // Root solo para dueño real del bot
    if (categoria === 'Root') {
        try {
            const { isDiscordOnlyOwner } = require('../../../../Util/ownerPermissions');
            const isOwner = await isDiscordOnlyOwner({ client: Moxi, userId });
            if (!isOwner) {
                await safeUpdate(interaction,
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: moxi.translate('HELP_TITLE', lang) || 'Help',
                            text: moxi.translate('HELP_CATEGORY_NO_PERMISSION', lang),
                        })
                    )
                );
                return true;
            }
        } catch {
            await safeUpdate(interaction,
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: moxi.translate('HELP_TITLE', lang) || 'Help',
                        text: moxi.translate('HELP_CATEGORY_NO_PERMISSION', lang),
                    })
                )
            );
            return true;
        }
    }

    const help = await getHelpContent({ page, categoria, client: Moxi, userId, lang, guildId, useV2 });

    if (helpDebugEnabled) {
        try {
            debugHelper.log('help', `rendered useV2=${useV2} categoria=${categoria} lang=${lang} guildId=${guildId || 'n/a'} userId=${userId || 'n/a'}`);

            if (help && help.flags && help.components && help.components[0] && typeof help.components[0].toJSON === 'function') {
                const json = help.components[0].toJSON();
                const comps = Array.isArray(json.components) ? json.components : [];
                const textBlocks = comps
                    .filter(c => c && (c.type === 10 || c.type === 'text_display'))
                    .map(c => (c.content || '').toString())
                    .filter(Boolean);
                if (textBlocks.length) {
                    const joined = textBlocks.join('\n');
                    debugHelper.log('help', `v2Preview=${joined.slice(0, 350).replace(/\n/g, '\\n')}${joined.length > 350 ? ' ...' : ''}`);
                } else {
                    debugHelper.log('help', 'v2Preview=(no text_display found)');
                }
            }

            if (help && Array.isArray(help.embeds) && help.embeds[0]) {
                const e = help.embeds[0];
                const title = e.title || '(no title)';
                const description = e.description || '';
                debugHelper.log('help', `embedTitle=${String(title).slice(0, 120)}`);
                if (description) {
                    debugHelper.log('help', `embedDesc=${String(description).slice(0, 350).replace(/\n/g, '\\n')}${String(description).length > 350 ? ' ...' : ''}`);
                }
            }
        } catch {
            debugHelper.log('help', 'error creando preview de help');
        }
    }

    if (!help || (!help.components || help.components.length === 0)) {
        await safeUpdate(interaction,
            asV2MessageOptions(
                buildNoticeContainer({
                    emoji: EMOJIS.cross,
                    title: moxi.translate('HELP_TITLE', lang) || 'Help',
                    text: moxi.translate('HELP_NO_CONTENT', lang) || 'No hay información de ayuda disponible.',
                })
            )
        );
        return true;
    }

    await safeUpdate(interaction, help);
    return true;
};
