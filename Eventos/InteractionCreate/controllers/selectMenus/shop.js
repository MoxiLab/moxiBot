const { MessageFlags } = require('discord.js');
const { buildShopMessage } = require('../../../../Util/shopView');

module.exports = async function shopSelectMenu(interaction, Moxi, logger) {
    if (!interaction.isStringSelectMenu()) return false;
    const id = String(interaction.customId || '');
    if (!id.startsWith('shop:cat:')) return false;

    // customId: shop:cat:<userId>:<page>
    const parts = id.split(':');
    const userId = parts[2];

    if (interaction.user?.id !== userId) {
        await interaction.reply({ content: 'Solo quien abrió la tienda puede usar este menú.', flags: MessageFlags.Ephemeral });
        return true;
    }

    const value = Array.isArray(interaction.values) ? interaction.values[0] : 'all';
    const categoryKey = value || 'all';

    const payload = buildShopMessage({ userId, categoryKey, page: 0 });
    await interaction.update(payload);
    return true;
};
