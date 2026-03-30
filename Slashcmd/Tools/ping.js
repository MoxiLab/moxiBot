const { ContainerBuilder, ButtonStyle, MessageFlags, Routes } = require('discord.js');
const { ButtonBuilder } = require('../../Util/compatButtonBuilder');
const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');
const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { Bot } = require('../../Config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Muestra la latencia del bot y de la API')
        .addBooleanOption((opt) =>
            opt
                .setName('publico')
                .setDescription('Mostrar el resultado públicamente (por defecto: oculto)')
                .setRequired(false)
        ),

    async run(Moxi, interaction) {
        const commandStartAt = Date.now();
        const guildId = interaction.guildId || interaction.guild?.id || 'dm';
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

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

        const publicReply = interaction.options.getBoolean('publico') === true;

        let apiPing = Number.isFinite(Moxi.ws?.ping) ? Math.round(Moxi.ws.ping) : null;
        const shardId = Moxi.shard?.ids?.[0] ?? 0;
        const shardCount = Moxi.shard?.count ?? 1;

        let shardPings = null;
        if (Moxi.shard && Moxi.shard.count > 1 && typeof Moxi.shard.fetchClientValues === 'function') {
            try {
                shardPings = await Moxi.shard.fetchClientValues('ws.ping');
            } catch {
                shardPings = null;
            }
        }
        apiPing = await resolveApiPing(apiPing, shardPings);

        const rawPingTitle = String(moxi.translate('PING_TITLE', lang) || '¡Pong!');
        const safePingTitle = rawPingTitle.replace(/<a?:\w+:\d+>/g, '').trim() || '¡Pong!';
        const now = Date.now();
        const baseCreatedAt = interaction.createdTimestamp ?? now;
        const msgPing = Math.max(0, now - baseCreatedAt);
        const dispatchDelayMs = Math.max(0, commandStartAt - baseCreatedAt);
        const commandWorkMs = Math.max(0, now - commandStartAt);

        const container = new ContainerBuilder()
            .setAccentColor(Bot.AccentColor)
            .addTextDisplayComponents((c) => c.setContent(`# ${EMOJIS.pingPong} ${safePingTitle}`))
            .addSeparatorComponents((s) => s.setDivider(true))
            .addTextDisplayComponents((c) => {
                let content = `${EMOJIS.mail} ${moxi.translate('PING_MESSAGE_LATENCY', lang)}: **${msgPing}ms**\n`;
                content += `${EMOJIS.numbers} Cola/entrega: **${dispatchDelayMs}ms** • Procesamiento: **${commandWorkMs}ms**\n`;
                if (Array.isArray(shardPings)) {
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
            .addSeparatorComponents((s) => s.setDivider(true))
            .addActionRowComponents((row) =>
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('refresh_ping')
                        .setLabel(moxi.translate('PING_REFRESH', lang) || 'Actualizar')
                        .setStyle(ButtonStyle.Primary)
                )
            )
            .addSeparatorComponents((s) => s.setDivider(true))
            .addTextDisplayComponents((c) => c.setContent(`${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`));

        return interaction.reply({
            content: '',
            components: [container],
            flags: (publicReply ? 0 : MessageFlags.Ephemeral) | MessageFlags.IsComponentsV2,
        });
    },
};
