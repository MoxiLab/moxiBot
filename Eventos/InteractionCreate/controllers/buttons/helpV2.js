module.exports = async function helpV2Buttons(interaction, Moxi, logger) {
    if (!interaction.customId || !interaction.customId.startsWith('help2_')) return false;

    const getHelpContent = require('../../../../Util/getHelpContent');
    const moxi = require('../../../../i18n');
    const { buildNoticeContainer, asV2MessageOptions } = require('../../../../Util/v2Notice');
    const { EMOJIS } = require('../../../../Util/emojis');
    const guildId = interaction.guildId || interaction.guild?.id;
    const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
    const userId = interaction.user?.id || interaction.member?.user?.id;

    const isRootAllowed = async () => {
        try {
            const { isDiscordOnlyOwner } = require('../../../../Util/ownerPermissions');
            return await isDiscordOnlyOwner({ client: Moxi, userId });
        } catch {
            return false;
        }
    };

    const parseStateFromCustomId = (customId) => {
        const parts = String(customId || '').split(':');
        const action = parts[0];
        const page = Number(parts[1] || 0);
        const totalPages = Number(parts[2] || 1);
        const categoria = parts.slice(3).join(':') || null;
        return { action, page: isNaN(page) ? 0 : page, totalPages: isNaN(totalPages) ? 1 : totalPages, categoria };
    };

    const computeTotalPagesForCategory = (categoria) => {
        let allCommands = [
            ...(Moxi.commands?.values?.() || []),
            ...(Moxi.slashcommands?.values?.() || [])
        ];
        if (categoria) {
            allCommands = allCommands.filter(cmd => (cmd.Category || cmd.category) === categoria);
        }
        const pageSize = 10;
        return Math.ceil(allCommands.length / pageSize) || 1;
    };

    logger?.info?.(`[Button] Pulsado (V2): ${interaction.customId}`);

    if (interaction.customId === 'help2_close') {
        await interaction.message.delete().catch(() => { });
        return true;
    }

    const { action, page: currentPage, totalPages: stateTotalPages, categoria } = parseStateFromCustomId(interaction.customId);
    if (categoria === 'Root' && !(await isRootAllowed())) {
        try {
            await interaction.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: moxi.translate('HELP_TITLE', lang) || 'Help',
                        text: moxi.translate('HELP_CATEGORY_NO_PERMISSION', lang),
                    })
                ),
                ephemeral: true,
            });
        } catch { }
        return true;
    }

    if (action === 'help2_prev') {
        const totalPagesReal = computeTotalPagesForCategory(categoria);
        const nextPage = Math.max(currentPage - 1, 0);
        const help = await getHelpContent({ page: nextPage, totalPages: totalPagesReal, tipo: 'prev', categoria, client: Moxi, lang, guildId, userId, useV2: true });
        await interaction.update(help);
        return true;
    }

    if (action === 'help2_next') {
        const totalPagesReal = computeTotalPagesForCategory(categoria);
        const nextPage = Math.min(currentPage + 1, totalPagesReal - 1);
        const help = await getHelpContent({ page: nextPage, totalPages: totalPagesReal, tipo: 'next', categoria, client: Moxi, lang, guildId, userId, useV2: true });
        await interaction.update(help);
        return true;
    }

    if (action === 'help2_home') {
        const totalPagesReal = computeTotalPagesForCategory(categoria);
        const help = await getHelpContent({ page: 0, totalPages: totalPagesReal, tipo: 'main', categoria, client: Moxi, lang, guildId, userId, useV2: true });
        await interaction.update(help);
        return true;
    }

    if (action === 'help2_info') {
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
        const totalPagesReal = computeTotalPagesForCategory(categoria);
        const modal = new ModalBuilder()
            .setCustomId(`help2_jump_modal:${totalPagesReal}:${categoria || ''}`)
            .setTitle(moxi.translate('HELP_JUMP_TITLE', lang));
        const input = new TextInputBuilder()
            .setCustomId('help_jump_page')
            .setLabel(moxi.translate('HELP_JUMP_LABEL', lang))
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(moxi.translate('HELP_JUMP_PLACEHOLDER', lang))
            .setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return true;
    }

    const totalPagesReal = computeTotalPagesForCategory(categoria);
    const help = await getHelpContent({ page: 0, totalPages: totalPagesReal || stateTotalPages || 1, tipo: 'main', categoria, client: Moxi, lang, guildId, userId, useV2: true });
    await interaction.update(help);
    return true;
};
