const { MessageFlags } = require('discord.js');
const { buildMoxidexMessage, normalizeTierKey, cycleSort } = require('../../../../Util/moxidexView');

module.exports = async function moxidexButtons(interaction, Moxi, logger) {
    if (!interaction.isButton()) return false;
    const id = String(interaction.customId || '');
    if (!id.startsWith('moxidex:')) return false;

    // customIds soportados:
    // - moxidex:nav:<userId>:<tierKey>:<sort>:<page>:prev|next
    // - moxidex:sort:<userId>:<tierKey>:<sort>:<page>
    // - moxidex:home:<userId>
    // - moxidex:info:<userId>
    // - moxidex:close:<userId>
    const parts = id.split(':');
    const action = parts[1] || '';
    const userId = parts[2];

    if (interaction.user?.id !== userId) {
        await interaction.reply({ content: 'Solo quien abrió el Moxidex puede usar estos botones.', flags: MessageFlags.Ephemeral });
        return true;
    }

    if (action === 'close') {
        await interaction.message.delete().catch(() => { });
        return true;
    }

    if (action === 'info') {
        await interaction.reply({
            content: 'Usa el menú para filtrar por tier. Pulsa 🔀 para cambiar el orden. Navega con ◀ ▶. Cierra con ❌.',
            flags: MessageFlags.Ephemeral,
        });
        return true;
    }

    const guildId = interaction.guildId || interaction.guild?.id;
    const lang = Moxi?.guildLang
        ? await Moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES')
        : (process.env.DEFAULT_LANG || 'es-ES');

    if (action === 'home') {
        const payload = await buildMoxidexMessage({ userId, viewerId: userId, tierKey: 'all', sort: 'new', page: 0, lang });
        await interaction.update(payload);
        return true;
    }

    if (action === 'sort') {
        const tierKey = normalizeTierKey(parts[3] || 'all');
        const sort = String(parts[4] || 'new');
        const page = Number(parts[5] || 0);
        const nextSort = cycleSort(sort);

        const payload = await buildMoxidexMessage({ userId, viewerId: userId, tierKey, sort: nextSort, page, lang });
        await interaction.update(payload);
        return true;
    }

    if (action === 'nav') {
        const tierKey = normalizeTierKey(parts[3] || 'all');
        const sort = String(parts[4] || 'new');
        const page = Number(parts[5] || 0);
        const dir = parts[6] || 'next';
        const nextPage = dir === 'prev' ? Math.max(0, page - 1) : page + 1;

        const payload = await buildMoxidexMessage({ userId, viewerId: userId, tierKey, sort, page: nextPage, lang });
        await interaction.update(payload);
        return true;
    }

    // Fallback: vuelve al inicio
    const payload = await buildMoxidexMessage({ userId, viewerId: userId, tierKey: 'all', sort: 'new', page: 0, lang });
    await interaction.update(payload);
    return true;
};
