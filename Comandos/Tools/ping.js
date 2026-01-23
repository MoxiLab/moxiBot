

const { ContainerBuilder, PrimaryButtonBuilder, MessageFlags } = require('discord.js');
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
        const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');

        let apiPing = Moxi.ws.ping;
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

        const buildContainer = (msgPing) =>
            new ContainerBuilder()
                .setAccentColor(Bot.AccentColor)
                .addTextDisplayComponents(c =>
                    c.setContent(`# ${moxi.translate('PING_TITLE', lang)}`)
                )
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => {
                    let content = `${EMOJIS.mail} ${moxi.translate('PING_MESSAGE_LATENCY', lang)}: **${msgPing}ms**\n`;
                    if (shardPings && Array.isArray(shardPings)) {
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
                        new PrimaryButtonBuilder()
                            .setCustomId('refresh_ping')
                            .setLabel(moxi.translate('PING_REFRESH', lang) || 'Refrescar')
                    )
                )
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c =>
                    c.setContent(`${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`)
                );

        const msgPing = Math.max(0, Date.now() - (message?.createdTimestamp ?? Date.now()));
        const container = buildContainer(msgPing);
        await message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
    }
};