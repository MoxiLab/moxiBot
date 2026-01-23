const { ContainerBuilder, MessageFlags } = require('discord.js');

const { Bot } = require('../../Config');
const moxi = require('../../i18n');
const debugHelper = require('../../Util/debugHelper');
<<<<<<< Updated upstream
const { ownerPermissions } = require('../../Util/ownerPermissions');
=======
const { isDiscordOnlyOwner } = require('../../Util/ownerPermissions');
>>>>>>> Stashed changes

function safeLower(s) {
    return String(s ?? '').toLowerCase();
}

function truncate(str, max = 60) {
    const s = String(str ?? '');
    if (s.length <= max) return s;
    return `${s.slice(0, Math.max(0, max - 1))}…`;
}

function formatGuildBlock(guild, idx) {
    const number = String(idx + 1).padStart(2, '0');
    const name = truncate(guild?.name, 80);
    const members = Number(guild?.memberCount) || 0;
    const shardNumber = Number.isFinite(guild?.shardId) ? Number(guild.shardId) + 1 : null;
    const shardText = shardNumber ? String(shardNumber) : 'n/a';
    const id = String(guild?.id ?? '');

    return [
<<<<<<< Updated upstream
        `**🏰 ${number}. ${name}**`,
        `• 👥 Miembros: **${members.toLocaleString()}**`,
        `• 🧩 Shard: **${shardText}**`,
        `• 🆔 ID: \`${id}\``,
=======
        `> **🏰 ${number}. ${name}**`,
        `> » 👥 Miembros: **${members.toLocaleString()}**`,
        `> » 🧩 Shard: **${shardText}**`,
        `> » 🆔 ID: \`${id}\``,
>>>>>>> Stashed changes
    ].join('\n');
}

async function fetchAllGuilds(client) {
    const localShardId = client?.shard?.ids?.[0] ?? 0;

    if (!client?.shard || typeof client.shard.broadcastEval !== 'function') {
        return Array.from(client?.guilds?.cache?.values?.() ?? []).map((g) => ({
            id: g.id,
            name: g.name,
            memberCount: g.memberCount ?? 0,
            shardId: localShardId,
        }));
    }

    const results = await client.shard.broadcastEval((c) => {
        const shardId = c?.shard?.ids?.[0] ?? 0;
        return c.guilds.cache.map((g) => ({
            id: g.id,
            name: g.name,
            memberCount: g.memberCount ?? 0,
            shardId,
        }));
    });

    return Array.isArray(results) ? results.flat().filter(Boolean) : [];
}

module.exports = {
    name: 'servers',
    alias: ['guilds', 'servidores'],
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_HERRAMIENTAS', lang);
    },
    usage: 'servers [limite=25] [buscar...]',
    description: (lang = 'es-ES') =>
        (moxi.translate('SERVERS_CMD_DESC', lang) !== 'SERVERS_CMD_DESC'
            ? moxi.translate('SERVERS_CMD_DESC', lang)
            : 'Muestra los servidores donde está el bot (solo owners)'),

    async execute(Moxi, message, args) {
        const requesterId = message.author?.id;
        debugHelper.log('servers', 'command start', { requesterId });

<<<<<<< Updated upstream
        const fakeInteraction = {
            user: message.author,
            memberPermissions: message.member?.permissions,
            guild: message.guild,
        };

        const isOwner = await ownerPermissions(fakeInteraction, Moxi);
        if (!isOwner) {
=======
        if (!await isDiscordOnlyOwner({ client: Moxi, userId: requesterId })) {
>>>>>>> Stashed changes
            return message.reply('Solo los owners pueden usar este comando.');
        }

        const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
        const t = (key, fallback) => {
            const out = moxi.translate(key, lang);
            return out && out !== key ? out : fallback;
        };

        const rawArgs = Array.isArray(args) ? args : [];
        const maybeLimit = Number(rawArgs[0]);
        const limit = Number.isFinite(maybeLimit) ? Math.max(1, Math.min(50, Math.floor(maybeLimit))) : 25;
        const search = (Number.isFinite(maybeLimit) ? rawArgs.slice(1) : rawArgs).join(' ').trim();

        const allGuilds = await fetchAllGuilds(Moxi);
        const totalGuilds = allGuilds.length;
        const totalUsers = allGuilds.reduce((sum, g) => sum + (Number(g?.memberCount) || 0), 0);

        const filtered = search
            ? allGuilds.filter((g) => safeLower(g?.name).includes(safeLower(search)))
            : allGuilds;

        filtered.sort((a, b) => (Number(b?.memberCount) || 0) - (Number(a?.memberCount) || 0));

        const maxRequested = Math.max(1, Math.min(50, limit));
        const candidates = filtered.slice(0, maxRequested);

        const header = `# ${t('SERVERS_TITLE', '🏰 Servidores del bot')}`;
        const summary = `${t('SERVERS_TOTAL', 'Total')}: **${totalGuilds.toLocaleString()}**  •  ${t('SERVERS_USERS', 'Usuarios (suma memberCount)')}: **${totalUsers.toLocaleString()}**`;
        const filterLine = search
            ? `🔎 ${t('SERVERS_FILTER', 'Filtro')}: **${search}**  •  ${t('SERVERS_MATCHES', 'Coincidencias')}: **${filtered.length.toLocaleString()}**`
            : null;

        const baseParts = [header, summary, filterLine].filter(Boolean);
        const separator = '\n\n────────────\n\n';
        const MAX_CONTENT = 3500;

        const blocks = [];
        let preview = `${baseParts.join('\n')}\n\n`;
        for (let i = 0; i < candidates.length; i += 1) {
            const block = formatGuildBlock(candidates[i], i);
            const candidateText = preview + (blocks.length ? separator : '') + block;
            if (candidateText.length > MAX_CONTENT) break;
            blocks.push(block);
            preview = candidateText;
        }

        const remaining = Math.max(0, filtered.length - blocks.length);
        const moreLine = remaining ? `➕ **${remaining.toLocaleString()}** más (sube el límite o ajusta el filtro).` : null;

        const content = [
            baseParts.join('\n'),
            blocks.length
                ? `\n${blocks.join(separator)}`
                : `\n${t('SERVERS_NONE', 'No se encontraron servidores con ese filtro.')}`,
            moreLine,
        ].filter(Boolean).join('\n');

        const container = new ContainerBuilder()
            .setAccentColor(Bot.AccentColor)
            .addTextDisplayComponents((c) => c.setContent(content));

        return message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
    },
};
