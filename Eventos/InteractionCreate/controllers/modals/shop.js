const { MessageFlags } = require('discord.js');
const { buildShopMessage, buildShopData } = require('../../../../Util/shopView');
const moxi = require('../../../../i18n');

module.exports = async function shopJumpModal(interaction, Moxi, logger) {
    if (!(interaction.isModalSubmit && interaction.isModalSubmit())) return false;
    const id = String(interaction.customId || '');
    if (!id.startsWith('shop_jump_modal:')) return false;

    // customId: shop_jump_modal:<userId>:<categoryKey>:<totalPages>
    const parts = id.split(':');
    const userId = parts[1];
    const categoryKey = parts[2] || 'all';

    if (interaction.user?.id !== userId) {
        await interaction.reply({ content: 'Solo quien abrió la tienda puede usar este modal.', flags: MessageFlags.Ephemeral });
        return true;
    }

    const raw = interaction.fields.getTextInputValue('shop_jump_page');
    const requested = parseInt(String(raw || '').trim(), 10);

    const guildId = interaction.guildId || interaction.guild?.id;
    const fallbackLang = interaction.guildLocale || interaction.locale || process.env.DEFAULT_LANG || 'es-ES';
    const lang = await moxi.guildLang(guildId, fallbackLang);

    // Recalcular el total real (por seguridad)
    const pageSize = 5;
    const { allItems } = buildShopData({ lang });
    const filtered = categoryKey === 'all'
        ? allItems
        : allItems.filter((i) => i.categoryKey === categoryKey);
    const totalPagesReal = Math.max(1, Math.ceil(filtered.length / pageSize));

    const pageIndex = requested - 1;
    if (!Number.isFinite(pageIndex) || pageIndex < 0 || pageIndex >= totalPagesReal) {
        await interaction.reply({ content: `Página inválida. Elige un número entre 1 y ${totalPagesReal}.`, flags: MessageFlags.Ephemeral });
        return true;
    }

    const payload = buildShopMessage({ userId, categoryKey, page: pageIndex, lang });
    await interaction.update(payload);
    return true;
};
