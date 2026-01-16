const { MessageFlags } = require('discord.js');
const { buildCraftMessage } = require('../../../../Util/craftPanel');

module.exports = async function craftButtons(interaction, Moxi, logger) {
    if (!interaction.isButton()) return false;
    const id = String(interaction.customId || '');
    if (!id.startsWith('craft:')) return false;

    // customIds:
    // - craft:nav:<userId>:<page>:prev|next
    // - craft:home:<userId>
    // - craft:info:<userId>
    // - craft:close:<userId>
    const parts = id.split(':');
    const action = parts[1] || '';
    const userId = parts[2];

    if (interaction.user?.id !== userId) {
        await interaction.reply({ content: 'Solo quien abrió el craft puede usar estos botones.', flags: MessageFlags.Ephemeral });
        return true;
    }

    if (action === 'close') {
        try {
            if (interaction.message?.deletable) {
                await interaction.message.delete();
            } else {
                await interaction.update({ content: 'Craft cerrado.', embeds: [], components: [] });
            }
        } catch {
            try {
                await interaction.update({ content: 'Craft cerrado.', embeds: [], components: [] });
            } catch { }
        }
        return true;
    }

    if (action === 'info') {
        await interaction.reply({
            content: 'Selecciona un item para craftearlo. Navega páginas con ◀ ▶. Cierra con ❌.',
            flags: MessageFlags.Ephemeral,
        });
        return true;
    }

    if (action === 'home') {
        const payload = buildCraftMessage({ userId, page: 0, pageSize: 4 });
        await interaction.update(payload);
        return true;
    }

    if (action === 'nav') {
        const page = Number(parts[3] || 0);
        const dir = parts[4] || 'next';
        const nextPage = dir === 'prev' ? Math.max(0, page - 1) : page + 1;
        const payload = buildCraftMessage({ userId, page: nextPage, pageSize: 4 });
        await interaction.update(payload);
        return true;
    }

    // Fallback
    const payload = buildCraftMessage({ userId, page: 0, pageSize: 4 });
    await interaction.update(payload);
    return true;
};
