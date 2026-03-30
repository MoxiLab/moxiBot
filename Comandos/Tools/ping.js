

const { ContainerBuilder, ButtonStyle, MessageFlags, Routes } = require('discord.js');
const { ButtonBuilder } = require('../../Util/compatButtonBuilder');
const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { Bot } = require('../../Config');
module.exports = {
    name: "ping",
    alias: ['ping', 'latency', 'p'],
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_HERRAMIENTAS', lang);
    },
    usage: 'ping',
    description: (lang = 'es-ES') => moxi.translate('commands:CMD_PING_DESC', lang),

    async execute(Moxi, message, args) {
        const commandStartAt = Date.now();
        const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');

        const resolveApiPing = async (currentPing, currentShardPings) => {
            if (Number.isFinite(currentPing)) return Math.round(currentPing);

            if (Array.isArray(currentShardPings)) {
                const valid = currentShardPings.filter((p) => Number.isFinite(p) && p >= 0);
                if (valid.length) {
                    const avg = valid.reduce((acc, p) => acc + p, 0) / valid.length;
                    return Math.round(avg);
                }
            }

            try {
                const start = Date.now();
                await Moxi.rest.get(Routes.gateway());
                return Math.max(0, Date.now() - start);
            } catch {
                return null;
            }
        };

        let apiPing = Number.isFinite(Moxi.ws?.ping) ? Math.round(Moxi.ws.ping) : null;
        let shardId = Moxi.shard?.ids?.[0] ?? 0;
        let shardCount = Moxi.shard?.count ?? 1;
        let shardPings = null;
        if (Moxi.shard && Moxi.shard.count > 1 && Moxi.shard.fetchClientValues) {
            try {
                shardPings = await Moxi.shard.fetchClientValues('ws.ping');
            } catch (e) {
                shardPings = null;
            }
        }
        apiPing = await resolveApiPing(apiPing, shardPings);

        const rawPingTitle = String(moxi.translate('PING_TITLE', lang) || '¡Pong!');
        const safePingTitle = rawPingTitle.replace(/<a?:\w+:\d+>/g, '').trim() || '¡Pong!';

        const buildContainer = (msgPing, dispatchDelayMs, commandWorkMs) =>
            new ContainerBuilder()
                .setAccentColor(Bot.AccentColor)
                .addTextDisplayComponents(c =>
                    c.setContent(`# ${EMOJIS.pingPong} ${safePingTitle}`)
                )
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => {
                    let content = `${EMOJIS.mail} ${moxi.translate('PING_MESSAGE_LATENCY', lang)}: **${msgPing}ms**\n`;
                    content += `${EMOJIS.numbers} Cola/entrega: **${dispatchDelayMs}ms** • Procesamiento: **${commandWorkMs}ms**\n`;
                    if (shardPings && Array.isArray(shardPings)) {
                        content += `${EMOJIS.globe} ${moxi.translate('PING_API_LATENCY', lang)} (shards):\n`;
                        content += shardPings
                            .map((p, i) => {
                                const shardPing = Number.isFinite(p) ? `${Math.round(p)}ms` : 'n/a';
                                return `  #${i + 1}: **${shardPing}**`;
                            })
                            .join('\n');
                        if (shardCount > 1) {
                            content += `\n${EMOJIS.numbers} ${moxi.translate('PING_SHARD', lang)}: **${shardId + 1}/${shardCount}** (ID/Total)`;
                        }
                    } else {
                        const apiPingText = apiPing === null ? 'n/a' : `${apiPing}ms`;
                        content += `${EMOJIS.globe} ${moxi.translate('PING_API_LATENCY', lang)}: **${apiPingText}**\n`;
                        if (shardCount > 1) {
                            content += `${EMOJIS.numbers} ${moxi.translate('PING_SHARD', lang)}: **${shardId + 1}/${shardCount}** (ID/Total)`;
                        }
                    }
                    return c.setContent(content);
                })
                .addSeparatorComponents(s => s.setDivider(true))
                .addActionRowComponents(row =>
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId('refresh_ping')
                            .setLabel(moxi.translate('PING_REFRESH', lang) || 'Refrescar')
                            .setStyle(ButtonStyle.Primary)
                    )
                )
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c =>
                    c.setContent(`${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`)
                );

        const now = Date.now();
        const baseCreatedAt = message?.createdTimestamp ?? now;
        const msgPing = Math.max(0, now - baseCreatedAt);
        const dispatchDelayMs = Math.max(0, commandStartAt - baseCreatedAt);
        const commandWorkMs = Math.max(0, now - commandStartAt);
        const container = buildContainer(msgPing, dispatchDelayMs, commandWorkMs);
        await message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
    }
};