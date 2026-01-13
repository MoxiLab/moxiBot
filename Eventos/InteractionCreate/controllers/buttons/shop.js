const { MessageFlags } = require('discord.js');
const { buildShopMessage } = require('../../../../Util/shopView');

module.exports = async function shopButtons(interaction, Moxi, logger) {
    if (!interaction.isButton()) return false;
    const id = String(interaction.customId || '');
    if (!id.startsWith('shop:')) return false;

    // customIds soportados:
    // - shop:nav:<userId>:<categoryKey>:<page>:prev|next
    // - shop:home:<userId>:<categoryKey>
    // - shop:info:<userId>:<categoryKey>:<totalPages>
    // - shop:close:<userId>
    const parts = id.split(':');
    const action = parts[1] || '';
    const userId = parts[2];
    const categoryKey = parts[3] || 'all';

    if (interaction.user?.id !== userId) {
        await interaction.reply({ content: 'Solo quien abrió la tienda puede usar estos botones.', flags: MessageFlags.Ephemeral });
        return true;
    }

    if (action === 'close') {
        await interaction.message.delete().catch(() => { });
        return true;
    }

    if (action === 'home') {
        const payload = buildShopMessage({ userId, categoryKey, page: 0 });
        await interaction.update(payload);
        return true;
    }

    if (action === 'info') {
        const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
        const totalPages = Number(parts[4] || 1);
        const safeTotal = !Number.isFinite(totalPages) || totalPages <= 0 ? 1 : totalPages;

        const modal = new ModalBuilder()
            .setCustomId(`shop_jump_modal:${userId}:${categoryKey}:${safeTotal}`)
            .setTitle('Ir a la página');
        const input = new TextInputBuilder()
            .setCustomId('shop_jump_page')
            .setLabel(`Escribe un número (1-${safeTotal})`)
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Ej: 3')
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
        return true;
    }

    if (action === 'nav') {
        const page = Number(parts[4] || 0);
        const dir = parts[5] || 'next';
        const nextPage = dir === 'prev' ? Math.max(0, page - 1) : page + 1;
        const payload = buildShopMessage({ userId, categoryKey, page: nextPage });
        await interaction.update(payload);
        return true;
    }

    // Fallback seguro: vuelve al inicio de la categoría
    const payload = buildShopMessage({ userId, categoryKey, page: 0 });
    await interaction.update(payload);
    return true;
};
