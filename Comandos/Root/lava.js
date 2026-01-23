
const { ContainerBuilder, PrimaryButtonBuilder, MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { isDiscordOnlyOwner } = require('../../Util/ownerPermissions');
const { Bot } = require('../../Config');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const debugHelper = require('../../Util/debugHelper');

module.exports = {
    name: 'lava',
    alias: ['lavanode', 'lavastatus', 'lavainfo', 'lavalink', 'infolava', 'lstatus', 'lava'],
    Category: 'Root',
    description: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CMD_LAVA_DESC', lang);
    },
    async execute(Moxi, message, args) {
        const guildId = message.guild?.id;
        const requesterId = message.author?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        debugHelper.log('lava', 'command start', { guildId, requesterId, args });
        if (!await isDiscordOnlyOwner({ client: Moxi, userId: message.author?.id })) {
            debugHelper.warn('lava', 'permission denied', { guildId, requesterId });
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({ emoji: EMOJIS.cross, text: moxi.translate('NO_PERMISSION', lang) })
                )
            );
        }
        const poru = Moxi.poru;
        if (!poru || !poru.nodes.size) {
            debugHelper.warn('lava', 'no nodes available', { guildId });
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({ emoji: EMOJIS.cross, text: moxi.translate('LAVALINK_NOT_CONNECTED', lang) })
                )
            );
        }
        const node = Array.from(poru.nodes.values())[0];
        if (!node || !node.isConnected) {
            debugHelper.warn('lava', 'node disconnected', { guildId, nodeId: node?.id });
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({ emoji: EMOJIS.cross, text: moxi.translate('LAVALINK_NOT_CONNECTED', lang) })
                )
            );
        }
        const info = node.stats || {};
        let uptime = info.uptime ? info.uptime : 0;
        if (uptime) {
            let seconds = Math.floor(uptime / 1000) % 60;
            let minutes = Math.floor(uptime / (1000 * 60)) % 60;
            let hours = Math.floor(uptime / (1000 * 60 * 60)) % 24;
            let days = Math.floor(uptime / (1000 * 60 * 60 * 24));
            uptime = `${days ? days + 'd ' : ''}${hours}h, ${minutes}m, ${seconds}s`;
        } else {
            uptime = 'N/A';
        }
        let memBar = '';
        if (info.memory) {
            const used = info.memory.used / 1024 / 1024;
            const total = info.memory.reservable / 1024 / 1024;
            const percent = total ? Math.round((used / total) * 10) : 0;
            memBar = '▰'.repeat(percent) + '▱'.repeat(10 - percent);
        }

        debugHelper.log('lava', 'node info', { guildId, nodeId: node.id, stats: { players: info.players, playing: info.playingPlayers } });

        const container = new ContainerBuilder()
            .setAccentColor(Bot.AccentColor)
            .addTextDisplayComponents(c =>
                c.setContent(`# ${moxi.translate('LAVALINK_TITLE', lang)}`)
            )
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(c =>
                c.setContent(`**${moxi.translate('LAVALINK_NAME', lang)}** ${node.name}`)
            )
            .addTextDisplayComponents(c =>
                c.setContent(`**${moxi.translate('LAVALINK_STATUS', lang)}** ${node.isConnected ? EMOJIS.greenCircle : EMOJIS.redCircle}`)
            )
            .addTextDisplayComponents(c =>
                c.setContent(`**${moxi.translate('LAVALINK_PLAYERS', lang)}** ${info.players || 0}`)
            )
            .addTextDisplayComponents(c =>
                c.setContent(`**${moxi.translate('LAVALINK_USED_PLAYERS', lang)}** ${info.playingPlayers || 0}`)
            )
            .addTextDisplayComponents(c =>
                c.setContent(`**${moxi.translate('LAVALINK_UPTIME', lang)}** ${uptime}`)
            )
            .addTextDisplayComponents(c =>
                c.setContent(`**${moxi.translate('LAVALINK_CORES', lang)}** ${info.cpu ? info.cpu.cores : 'N/A'}`)
            )
            .addTextDisplayComponents(c =>
                c.setContent(`**${moxi.translate('LAVALINK_MEMORY', lang)}** ${memBar}`)
            )
            .addTextDisplayComponents(c =>
                c.setContent(`**${moxi.translate('LAVALINK_SYSTEM_LOAD', lang)}** ${info.cpu ? (info.cpu.systemLoad * 100).toFixed(2) + '%' : 'N/A'}`)
            )
            .addTextDisplayComponents(c =>
                c.setContent(`**${moxi.translate('LAVALINK_LOAD', lang)}** ${info.cpu ? (info.cpu.lavalinkLoad * 100).toFixed(2) + '%' : 'N/A'}`)
            )
            .addSeparatorComponents(s => s.setDivider(true))
            .addActionRowComponents(row =>
                row.addComponents(
                    new PrimaryButtonBuilder()
                        .setCustomId('lavanode_refresh')
                        .setLabel(moxi.translate('REFRESH', lang))
                )
            )
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(c =>
                c.setContent(`${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`)
            );

        await message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
        debugHelper.log('lava', 'reply sent', { guildId, nodeId: node.id });
    }
};
