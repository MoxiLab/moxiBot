const { ContainerBuilder, MessageFlags, ButtonStyle } = require('discord.js');
const { ButtonBuilder } = require('../../Util/compatButtonBuilder');

const os = require('node:os');

const { Bot } = require('../../Config');
const moxi = require('../../i18n');
const debugHelper = require('../../Util/debugHelper');
const { getBotUserUsageCounts } = require('../../Util/botUsageTracker');

function clamp01(n) {
    if (!Number.isFinite(n)) return 0;
    if (n < 0) return 0;
    if (n > 1) return 1;
    return n;
}

function kvBlock(title, entries) {
    const rows = Array.isArray(entries) ? entries.filter((e) => Array.isArray(e) && e.length >= 2) : [];
    const filtered = rows
        .map(([k, v]) => [String(k ?? ''), v])
        .filter(([k, v]) => k && v !== null && v !== undefined && String(v) !== '');
    if (!filtered.length) return '';

    const width = filtered.reduce((m, [k]) => Math.max(m, k.length), 0);
    const lines = filtered.map(([k, v]) => `${k.padEnd(width)} : ${v}`);
    return `**${title}**\n\`\`\`\n${lines.join('\n')}\n\`\`\`\n`;
}

function barPercent(pct, width = 10) {
    const p = Number.isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
    const w = Number.isFinite(width) && width > 0 ? Math.floor(width) : 10;
    const filled = Math.round((p / 100) * w);
    const empty = Math.max(0, w - filled);
    return `${'█'.repeat(filled)}${'░'.repeat(empty)} [${Math.round(p)}%]`;
}

async function sampleCpuUsagePercent(delayMs = 250) {
    try {
        const start = os.cpus();
        if (!Array.isArray(start) || !start.length) return null;
        await new Promise((r) => setTimeout(r, delayMs));
        const end = os.cpus();
        if (!Array.isArray(end) || end.length !== start.length) return null;

        let idle = 0;
        let total = 0;
        for (let i = 0; i < start.length; i += 1) {
            const a = start[i]?.times;
            const b = end[i]?.times;
            if(a && b) {
                const idleDelta = (b.idle ?? 0) - (a.idle ?? 0);
                const totalA = (a.user ?? 0) + (a.nice ?? 0) + (a.sys ?? 0) + (a.idle ?? 0) + (a.irq ?? 0);
                const totalB = (b.user ?? 0) + (b.nice ?? 0) + (b.sys ?? 0) + (b.idle ?? 0) + (b.irq ?? 0);
                const totalDelta = totalB - totalA;
                idle += idleDelta;
                total += totalDelta;
            }
        }
        if (!total) return null;
        const usage = 1 - clamp01(idle / total);
        return usage * 100;
    } catch {
        return null;
    }
}

function formatBytes(bytes) {
    if (!Number.isFinite(bytes)) return 'n/a';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(mb >= 100 ? 0 : 1)} MB`;
}

function formatUptime(ms) {
    if (!Number.isFinite(ms)) return 'n/a';
    const totalSeconds = Math.floor(ms / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const parts = [];
    if (days) parts.push(`${days}d`);
    if (hours || days) parts.push(`${hours}h`);
    parts.push(`${minutes}m`);
    parts.push(`${seconds}s`);
    return parts.join(' ');
}

async function getShardTotals(client) {
    try {
        if (!client?.shard || typeof client.shard.fetchClientValues !== 'function') {
            let users = 0;
            client?.guilds?.cache?.forEach((guild) => {
                users += guild?.memberCount ?? 0;
            });
            return {
                guilds: client?.guilds?.cache?.size ?? 0,
                users,
                shardCount: client?.shard?.count ?? 1,
            };
        }

        const guildCounts = await client.shard.fetchClientValues('guilds.cache.size');
        const userCounts = typeof client.shard.broadcastEval === 'function'
            ? await client.shard.broadcastEval((c) => {
                let users = 0;
                c.guilds.cache.forEach((guild) => {
                    users += guild?.memberCount ?? 0;
                });
                return users;
            })
            : await client.shard.fetchClientValues('users.cache.size');

        const guilds = Array.isArray(guildCounts) ? guildCounts.reduce((a, b) => a + b, 0) : 0;
        const users = Array.isArray(userCounts) ? userCounts.reduce((a, b) => a + b, 0) : 0;

        return { guilds, users, shardCount: client.shard.count };
    } catch {
        let users = 0;
        client?.guilds?.cache?.forEach((guild) => {
            users += guild?.memberCount ?? 0;
        });
        return {
            guilds: client?.guilds?.cache?.size ?? 0,
            users,
            shardCount: client?.shard?.count ?? 1,
        };
    }
}

async function getShardTotalsExtended(client) {
    try {
        if (!client?.shard || typeof client.shard.broadcastEval !== 'function') {
            const guilds = client?.guilds?.cache?.size ?? 0;
            let users = 0;
            client?.guilds?.cache?.forEach((guild) => {
                users += guild?.memberCount ?? 0;
            });
            const channels = client?.guilds?.cache
                ? client.guilds.cache.reduce((sum, g) => sum + (g.channels?.cache?.size ?? 0), 0)
                : 0;
            const emojis = client?.guilds?.cache
                ? client.guilds.cache.reduce((sum, g) => sum + (g.emojis?.cache?.size ?? 0), 0)
                : 0;
            const poruPlayers = client?.poru?.players?.size ?? 0;
            const poruNodes = client?.poru?.nodes?.size ?? 0;
            return { guilds, users, channels, emojis, poruPlayers, poruNodes, shardCount: client?.shard?.count ?? 1 };
        }

        const results = await client.shard.broadcastEval((c) => {
            const guilds = c?.guilds?.cache?.size ?? 0;
            let users = 0;
            c?.guilds?.cache?.forEach((guild) => {
                users += guild?.memberCount ?? 0;
            });
            const channels = c?.guilds?.cache
                ? c.guilds.cache.reduce((sum, g) => sum + (g.channels?.cache?.size ?? 0), 0)
                : 0;
            const emojis = c?.guilds?.cache
                ? c.guilds.cache.reduce((sum, g) => sum + (g.emojis?.cache?.size ?? 0), 0)
                : 0;
            const poruPlayers = c?.poru?.players?.size ?? 0;
            const poruNodes = c?.poru?.nodes?.size ?? 0;
            return { guilds, users, channels, emojis, poruPlayers, poruNodes };
        });

        const merged = Array.isArray(results)
            ? results.reduce(
                (acc, cur) => {
                    acc.guilds += cur?.guilds ?? 0;
                    acc.users += cur?.users ?? 0;
                    acc.channels += cur?.channels ?? 0;
                    acc.emojis += cur?.emojis ?? 0;
                    acc.poruPlayers += cur?.poruPlayers ?? 0;
                    acc.poruNodes = Math.max(acc.poruNodes, cur?.poruNodes ?? 0);
                    return acc;
                },
                { guilds: 0, users: 0, channels: 0, emojis: 0, poruPlayers: 0, poruNodes: 0 }
            )
            : { guilds: 0, users: 0, channels: 0, emojis: 0, poruPlayers: 0, poruNodes: 0 };

        return { ...merged, shardCount: client.shard.count };
    } catch {
        const fallback = await getShardTotals(client);
        return { ...fallback, channels: 0, emojis: 0, poruPlayers: 0, poruNodes: 0 };
    }
}

module.exports = {
    name: 'botstats',
    alias: ['statsbot', 'botinfo', 'infobot', 'estadisticasbot'],
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_HERRAMIENTAS', lang);
    },
    usage: 'botstats',
    description: (lang = 'es-ES') =>
    (moxi.translate('BOTSTATS_CMD_DESC', lang) !== 'BOTSTATS_CMD_DESC'
        ? moxi.translate('BOTSTATS_CMD_DESC', lang)
        : 'Muestra estadísticas del bot'),

    async execute(Moxi, message) {
        const guildId = message.guildId || message.guild?.id || 'dm';
        const requesterId = message.author?.id;

        const globalPrefixes = (Array.isArray(Bot?.Prefix) && Bot.Prefix.length)
            ? Bot.Prefix
            : [process.env.PREFIX || '.'];
        const resolvedPrefix = (guildId && guildId !== 'dm')
            ? await moxi.guildPrefix(guildId, globalPrefixes[0])
            : globalPrefixes[0];

        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const year = new Date().getFullYear();

        const t = (key, fallback) => {
            const out = moxi.translate(key, lang);
            return out && out !== key ? out : fallback;
        };

        debugHelper.log('botstats', 'command start', { guildId, requesterId });

        const mem = process.memoryUsage();
        const rss = formatBytes(mem.rss);
        const heapUsed = formatBytes(mem.heapUsed);
        const heapTotal = formatBytes(mem.heapTotal);

        const uptime = formatUptime(Moxi.uptime);
        const node = process.version;

        const discordJsVersion = (() => {
            try {
                const dj = require('discord.js');
                return dj.version || null;
            } catch {
                return null;
            }
        })();

        const pkgVersion = (() => {
            try {
                return require('../../package.json').version || null;
            } catch {
                return null;
            }
        })();

        const totals = await getShardTotalsExtended(Moxi);

        const wsPing = Number.isFinite(Moxi.ws?.ping) ? `${Math.round(Moxi.ws.ping)}ms` : 'n/a';

        const usageCounts = await getBotUserUsageCounts({ daysActive: 30 });
        const usedUsersText = usageCounts?.enabled
            ? Number(usageCounts.totalUsers || 0).toLocaleString()
            : 'n/a';
        const activeUsersText = usageCounts?.enabled
            ? Number(usageCounts.activeUsers || 0).toLocaleString()
            : 'n/a';

        const shardId = Moxi.shard?.ids?.[0] ?? 0;
        const shardCount = totals.shardCount ?? (Moxi.shard?.count ?? 1);

        const app = await Moxi.application?.fetch().catch(() => null);
        const approximateUserInstalls =
            app?.approximateUserInstallCount ??
            app?.approximate_user_install_count ??
            null;

        const statusUrl = (() => {
            const url = moxi.translate('HELP_WEB_URL', lang);
            return typeof url === 'string' && /^https?:\/\//i.test(url) ? url : null;
        })();

        const osText = `${os.type()} ${os.release()} (${os.arch()})`;

        const commandsCount = Moxi.commands?.size ?? 0;
        const slashCount = Moxi.slashcommands?.size ?? 0;
        const totalCommands = commandsCount + slashCount;

        const cpuPercent = await sampleCpuUsagePercent(220);
        const ramPercent = (1 - clamp01(os.freemem() / Math.max(1, os.totalmem()))) * 100;
        const cpuModel = os.cpus()?.[0]?.model ? String(os.cpus()[0].model) : 'n/a';
        const cpuCores = Array.isArray(os.cpus()) ? os.cpus().length : null;

        const guild = message.guild;
        const serverLines = (() => {
            if (!guild) return null;
            const shardLine = `Shard: ${shardId + 1}`;
            const members = Number.isFinite(guild.memberCount) ? guild.memberCount : null;
            const roles = guild.roles?.cache?.size ?? null;
            const emojis = guild.emojis?.cache?.size ?? null;
            const textChannels = guild.channels?.cache
                ? guild.channels.cache.filter((ch) => ch && (ch.type === 0 || ch.type === 5 || ch.type === 15)).size
                : null;
            const voiceChannels = guild.channels?.cache
                ? guild.channels.cache.filter((ch) => ch && (ch.type === 2 || ch.type === 13)).size
                : null;

            const lines = [
                `${t('BOTSTATS_SHARD', 'Shard')}: ${shardLine.replace('Shard: ', '')}`,
            ];
            if (members !== null) lines.push(`${t('BOTSTATS_MEMBERS', 'Miembros')}: ${members.toLocaleString()}`);
            if (roles !== null) lines.push(`${t('BOTSTATS_ROLES', 'Roles')}: ${roles.toLocaleString()}`);
            if (emojis !== null) lines.push(`${t('BOTSTATS_EMOJIS', 'Emojis')}: ${emojis.toLocaleString()}`);
            if (textChannels !== null) lines.push(`${t('BOTSTATS_TEXT_CHANNELS', 'Canales texto')}: ${textChannels.toLocaleString()}`);
            if (voiceChannels !== null) lines.push(`${t('BOTSTATS_VOICE_CHANNELS', 'Canales voz')}: ${voiceChannels.toLocaleString()}`);
            return lines;
        })();

        const streamsText = (() => {
            const players = totals.poruPlayers ?? 0;
            const nodes = totals.poruNodes ?? 0;
            if (!players && !nodes) return null;
            if (nodes) return `${players.toLocaleString()} / ${nodes.toLocaleString()}`;
            return players.toLocaleString();
        })();

        const sysLoadBlock =
            kvBlock(t('BOTSTATS_SYSTEM_LOAD', 'CARGA DEL SISTEMA'), [
                [t('BOTSTATS_RAM', 'RAM'), barPercent(ramPercent)],
                [t('BOTSTATS_CPU', 'CPU'), cpuPercent === null ? 'n/a' : barPercent(cpuPercent)],
            ]);

        const sysConfigBlock = kvBlock(t('BOTSTATS_SYSTEM_CONFIG', 'CONFIGURACIÓN DEL SISTEMA'), [
            [t('BOTSTATS_CPU', 'CPU'), `${cpuModel}${cpuCores ? ` (${cpuCores}c)` : ''}`],
            [t('BOTSTATS_RAM', 'RAM'), formatBytes(os.totalmem())],
            [t('BOTSTATS_OS', 'OS'), osText],
            [t('BOTSTATS_NODE', 'Node.js'), node],
            [t('BOTSTATS_DJS', 'discord.js'), discordJsVersion || 'n/a'],
        ]);

        const serverBlock = serverLines
            ? kvBlock(t('BOTSTATS_THIS_SERVER', 'ESTE SERVIDOR'), serverLines.map((line) => {
                const idx = String(line).indexOf(':');
                if (idx === -1) return [line, ''];
                return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
            }))
            : '';

        const generalInfoBlock = kvBlock(t('BOTSTATS_GENERAL_INFO', 'INFO GENERAL'), [
            [t('BOTSTATS_NAME', 'Nombre'), Moxi.user?.username || 'n/a'],
            [t('BOTSTATS_VERSION', 'Versión'), pkgVersion || 'n/a'],
            [t('BOTSTATS_UPTIME', 'Uptime'), uptime],
            [t('BOTSTATS_SHARDS', 'Shards'), String(shardCount)],
            [t('BOTSTATS_SHARD', 'Shard'), `${shardId + 1}/${shardCount}`],
        ]);

        const discordBlock = kvBlock(t('BOTSTATS_DISCORD', 'Discord'), [
            [t('BOTSTATS_GUILDS', 'Servidores'), totals.guilds.toLocaleString()],
            [t('BOTSTATS_USERS_USED', 'Usuarios (usaron el bot)'), usedUsersText],
            [t('BOTSTATS_USERS_ACTIVE', 'Usuarios activos (30d)'), activeUsersText],
            [t('BOTSTATS_USERS_CACHE', 'Usuarios (cache)'), totals.users.toLocaleString()],
            [t('BOTSTATS_CHANNELS', 'Canales'), (totals.channels ?? 0).toLocaleString()],
            [t('BOTSTATS_EMOJIS', 'Emojis'), (totals.emojis ?? 0).toLocaleString()],
            Number.isFinite(approximateUserInstalls)
                ? [t('BOTSTATS_USER_INSTALLS', 'Instalaciones de usuario'), Number(approximateUserInstalls).toLocaleString()]
                : null,
            [t('BOTSTATS_PING', 'Ping'), wsPing],
            streamsText ? [t('BOTSTATS_STREAMS', 'Transmisiones'), streamsText] : null,
        ]);

        const commandsBlock = kvBlock(t('BOTSTATS_COMMANDS', 'Comandos'), [
            [t('BOTSTATS_PREFIX_USED', 'Prefijo'), resolvedPrefix],
            [t('BOTSTATS_PREFIX', 'Prefijo'), commandsCount.toLocaleString()],
            [t('BOTSTATS_SLASH', 'Slash'), slashCount.toLocaleString()],
            [t('BOTSTATS_TOTAL_COMMANDS', 'Comandos'), totalCommands.toLocaleString()],
        ]);

        const memoryBlock = kvBlock(t('BOTSTATS_MEMORY', 'Memoria'), [
            ['RSS', rss],
            ['Heap', `${heapUsed} / ${heapTotal}`],
            [t('BOTSTATS_RAM', 'RAM'), `${formatBytes(os.freemem())} / ${formatBytes(os.totalmem())}`],
        ]);

        const container = new ContainerBuilder()
            .setAccentColor(Bot.AccentColor)
            .addTextDisplayComponents((c) => c.setContent(`# ${t('BOTSTATS_TITLE', '📊 Estadísticas del bot')}`))
            .addSeparatorComponents((s) => s.setDivider(true))
            .addTextDisplayComponents((c) => c.setContent(`${generalInfoBlock}${discordBlock}${commandsBlock}${serverBlock}${sysLoadBlock}${sysConfigBlock}${memoryBlock}`))
            .addActionRowComponents((row) => {
                if (!statusUrl) return row;
                return row.addComponents(
                    new ButtonBuilder().setLabel(t('BOTSTATS_STATUS_BUTTON', 'Estado')).setStyle(ButtonStyle.Link).setURL(statusUrl)
                );
            })
            .addSeparatorComponents((s) => s.setDivider(true))
            .addTextDisplayComponents((c) => c.setContent(`© ${Moxi.user?.username || 'Moxi'} • ${year}`));

        return message.reply({
            content: '',
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { repliedUser: false },
        });
    },
};
