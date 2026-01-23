const { MessageFlags } = require('discord.js');
const { getSession, buildServersPanel } = require('../../../../Util/serversPanel');

module.exports = async function serversButtons(interaction, Moxi, logger) {
    if (!interaction.isButton()) return false;

    const id = String(interaction.customId || '');
    if (!id.startsWith('servers:')) return false;

    const parts = id.split(':');
    const action = parts[1] || '';
    const token = parts[2] || '';
    const ownerUserId = parts[3] || '';

    if (interaction.user?.id !== ownerUserId) {
        await interaction.reply({ content: 'Solo quien abrió esta lista puede usar los botones.', flags: MessageFlags.Ephemeral });
        return true;
    }

    const session = getSession(token);
    if (!session) {
        await interaction.reply({ content: 'Esta lista ha expirado. Ejecuta `/servers` otra vez.', flags: MessageFlags.Ephemeral });
        return true;
    }

    if (String(session.userId) !== String(ownerUserId)) {
        await interaction.reply({ content: 'Sesión inválida. Ejecuta `/servers` otra vez.', flags: MessageFlags.Ephemeral });
        return true;
    }

    if (action === 'close') {
        await interaction.message.delete().catch(() => { });
        return true;
    }

    if (action !== 'nav') return false;

    const dir = parts[4] || 'next';

    // Intentar inferir página actual desde el texto (fallback). Si no, usar 0.
    let page = 0;
    try {
        const text = interaction.message?.components?.[0]?.components?.map((c) => c?.content).filter(Boolean).join('\n') || '';
        const match = String(text).match(/Página\s*\*\*(\d+)\/(\d+)\*\*/i);
        if (match) page = Math.max(0, Number(match[1]) - 1);
    } catch { }

    const nextPage = dir === 'prev' ? Math.max(0, page - 1) : page + 1;

    const t = (key, fallback) => {
        try {
            if (interaction.translate) {
                const out = interaction.translate(key);
                return out && out !== key ? out : fallback;
            }
        } catch { }
        return fallback;
    };

    await interaction.deferUpdate();

    const { payload } = await buildServersPanel({
        client: Moxi,
        userId: ownerUserId,
        token,
        search: session.search,
        limit: session.limit,
        page: nextPage,
        pageSize: session.pageSize,
        t,
    });

    await interaction.message.edit(payload).catch(async () => {
        try {
            await interaction.editReply(payload);
        } catch (e) {
            logger?.error?.(e);
        }
    });

    return true;
};
