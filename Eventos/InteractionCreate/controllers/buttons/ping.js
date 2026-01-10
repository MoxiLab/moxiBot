module.exports = async function pingButtons(interaction, Moxi) {
    if (interaction.customId !== 'refresh_ping') return false;

    const moxi = require('../../../../i18n');
    const { ContainerBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
    const { EMOJIS } = require('../../../../Util/emojis');
    const { Bot } = require('../../../../Config');

    const lang = await moxi.guildLang(interaction.guildId || interaction.guild?.id, process.env.DEFAULT_LANG || 'es-ES');

    const start = Date.now();
    await interaction.deferUpdate();
    const msgPing = Date.now() - start;
    const apiPing = Moxi.ws?.ping ?? 0;
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

    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(c => c.setContent(`# ${moxi.translate('PING_TITLE', lang)}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => {
            let content = `${EMOJIS.mail} ${moxi.translate('PING_MESSAGE_LATENCY', lang)}: **${msgPing}ms**\n`;
            if (Array.isArray(shardPings)) {
                content += `${EMOJIS.globe} ${moxi.translate('PING_API_LATENCY', lang)} (shards):\n`;
                content += shardPings.map((p, i) => `  #${i + 1}: **${p}ms**`).join('\n');
                if (shardCount > 1) {
                    content += `\n${EMOJIS.numbers} ${moxi.translate('PING_SHARD', lang)}: **${shardId + 1}/${shardCount}** (ID/Total)`;
                }
            } else {
                content += `${EMOJIS.globe} ${moxi.translate('PING_API_LATENCY', lang)}: **${apiPing}ms**\n`;
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
        .addTextDisplayComponents(c => c.setContent(`${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`));

    await interaction.editReply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
    return true;
};
