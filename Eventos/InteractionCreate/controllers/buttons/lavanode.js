module.exports = async function lavanodeButtons(interaction, Moxi) {
    if (interaction.customId !== 'lavanode_refresh') return false;

    const moxi = require('../../../../i18n');
    const { MessageFlags, ContainerBuilder, PrimaryButtonBuilder } = require('discord.js');
    const { EMOJIS } = require('../../../../Util/emojis');
    const { Bot } = require('../../../../Config');
    const { buildNoticeContainer } = require('../../../../Util/v2Notice');

    const lang = await moxi.guildLang(interaction.guildId || interaction.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
    const poru = Moxi.poru;

    if (!poru || !poru.nodes.size) {
        await interaction.reply({
            content: '',
            components: [buildNoticeContainer({ emoji: EMOJIS.cross, text: moxi.translate('LAVALINK_NOT_CONNECTED', lang) })],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        }).catch(() => { });
        return true;
    }

    const node = Array.from(poru.nodes.values())[0];
    if (!node || !node.isConnected) {
        await interaction.reply({
            content: '',
            components: [buildNoticeContainer({ emoji: EMOJIS.cross, text: moxi.translate('LAVALINK_NOT_CONNECTED', lang) })],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        }).catch(() => { });
        return true;
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

    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(c => c.setContent(`# ${moxi.translate('LAVALINK_TITLE', lang)}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`**${moxi.translate('LAVALINK_NAME', lang)}** ${node.name}`))
        .addTextDisplayComponents(c => c.setContent(`**${moxi.translate('LAVALINK_STATUS', lang)}** ${node.isConnected ? EMOJIS.greenCircle : EMOJIS.redCircle}`))
        .addTextDisplayComponents(c => c.setContent(`**${moxi.translate('LAVALINK_PLAYERS', lang)}** ${info.players || 0}`))
        .addTextDisplayComponents(c => c.setContent(`**${moxi.translate('LAVALINK_USED_PLAYERS', lang)}** ${info.playingPlayers || 0}`))
        .addTextDisplayComponents(c => c.setContent(`**${moxi.translate('LAVALINK_UPTIME', lang)}** ${uptime}`))
        .addTextDisplayComponents(c => c.setContent(`**${moxi.translate('LAVALINK_CORES', lang)}** ${info.cpu ? info.cpu.cores : 'N/A'}`))
        .addTextDisplayComponents(c => c.setContent(`**${moxi.translate('LAVALINK_MEMORY', lang)}** ${memBar}`))
        .addTextDisplayComponents(c => c.setContent(`**${moxi.translate('LAVALINK_SYSTEM_LOAD', lang)}** ${info.cpu ? (info.cpu.systemLoad * 100).toFixed(2) + '%' : 'N/A'}`))
        .addTextDisplayComponents(c => c.setContent(`**${moxi.translate('LAVALINK_LOAD', lang)}** ${info.cpu ? (info.cpu.lavalinkLoad * 100).toFixed(2) + '%' : 'N/A'}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addActionRowComponents(row =>
            row.addComponents(
                new PrimaryButtonBuilder()
                    .setCustomId('lavanode_refresh')
                    .setLabel(moxi.translate('REFRESH', lang))
            )
        )
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`));

    try {
        await interaction.update({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
    } catch {
        await interaction.reply({
            content: '',
            components: [buildNoticeContainer({ emoji: EMOJIS.cross, text: 'Error al actualizar el panel.' })],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        }).catch(() => { });
    }

    return true;
};
