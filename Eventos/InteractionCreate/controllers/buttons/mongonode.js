module.exports = async function mongonodeButtons(interaction, Moxi) {
    if (interaction.customId !== 'refresh_mongonode') return false;

    const mongoose = require('mongoose');
    const moxi = require('../../../../i18n');
    const { EMOJIS } = require('../../../../Util/emojis');
    const { Bot } = require('../../../../Config');
    const { buildNoticeContainer } = require('../../../../Util/v2Notice');
    const { ContainerBuilder, ButtonStyle, MessageFlags } = require('discord.js');
    const { ButtonBuilder } = require('../../../../Util/compatButtonBuilder');

    const lang = await moxi.guildLang(interaction.guildId || interaction.guild?.id, process.env.DEFAULT_LANG || 'es-ES');

    const state = mongoose.connection.readyState;
    let stateEmoji = EMOJIS.whiteCircle;
    if (state === 0) {
        stateEmoji = EMOJIS.redCircle;
    } else if (state === 1) {
        stateEmoji = EMOJIS.greenCircle;
    } else if (state === 2) {
        stateEmoji = EMOJIS.yellowCircle;
    } else if (state === 3) {
        stateEmoji = EMOJIS.orangeCircle;
    }

    let stats = {}, server = {};
    try {
        stats = await mongoose.connection.db.command({ dbStats: 1 });
        server = await mongoose.connection.db.admin().serverStatus();
    } catch {
        stats = {};
        server = {};
    }

    let uptime = 'N/A';
    if (server.uptime) {
        const d = Math.floor(server.uptime / 60 / 60 / 24);
        const h = Math.floor((server.uptime / 60 / 60) % 24);
        const m = Math.floor((server.uptime / 60) % 60);
        const s = Math.floor(server.uptime % 60);
        uptime = `${d ? d + 'd, ' : ''}${h}h, ${m}m, ${s}s`;
    }

    const memMB = server.mem && server.mem.resident ? `${server.mem.resident} MB` : 'N/A';
    let memBar = '';
    if (server.mem && server.mem.resident && server.mem.virtual) {
        const used = server.mem.resident;
        const total = server.mem.virtual;
        const percent = total ? Math.round((used / total) * 10) : 0;
        memBar = '▰'.repeat(percent) + '▱'.repeat(10 - percent);
    }

    const dbSize = stats.dataSize ? `${(stats.dataSize / 1024 / 1024).toFixed(2)} MB` : 'N/A';
    const free = stats.storageSize && stats.dataSize ? `${((stats.storageSize - stats.dataSize) / 1024 / 1024).toFixed(2)} MB` : 'N/A';
    const version = server.version || stats.version || 'N/A';
    const dbName = mongoose.connection && mongoose.connection.name ? mongoose.connection.name : 'N/A';

    let collectionsCount = 0;
    try {
        collectionsCount = (await mongoose.connection.db.listCollections().toArray()).length;
    } catch {
        collectionsCount = 0;
    }

    const now = new Date();
    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(c => c.setContent(`# ${moxi.translate('MONGO_STATUS_TITLE', lang) || 'MongoDB Status'}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`${moxi.translate('MONGO_STATUS', lang) || 'Estado'}: ${stateEmoji}`))
        .addTextDisplayComponents(c => c.setContent(`${moxi.translate('MONGO_DATABASE', lang) || 'Base de datos'}: **${dbName}**`))
        .addTextDisplayComponents(c => c.setContent(`${moxi.translate('MONGO_COLLECTIONS', lang) || 'Colecciones'}: **${collectionsCount}**`))
        .addTextDisplayComponents(c => c.setContent(`${moxi.translate('MONGO_MEMORY', lang) || 'Memoria'}: **${memMB}**`))
        .addTextDisplayComponents(c => c.setContent(memBar ? `${moxi.translate('MONGO_MEMORY_USAGE', lang)}:\n${memBar}` : `${moxi.translate('MONGO_MEMORY_USAGE', lang)}: N/A`))
        .addTextDisplayComponents(c => c.setContent(`${moxi.translate('MONGO_DB_SIZE', lang) || 'Tamaño DB'}: **${dbSize}**`))
        .addTextDisplayComponents(c => c.setContent(`${moxi.translate('MONGO_FREE_SPACE', lang) || 'Espacio libre'}: **${free}**`))
        .addTextDisplayComponents(c => c.setContent(`${moxi.translate('MONGO_VERSION', lang) || 'Versión'}: **${version}**`))
        .addTextDisplayComponents(c => c.setContent(`${moxi.translate('MONGO_UPTIME', lang) || 'Uptime'}: **${uptime}**`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addActionRowComponents(row =>
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('refresh_mongonode')
                    .setLabel(moxi.translate('REFRESH', lang))
                    .setStyle(ButtonStyle.Primary)
            )
        )
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`${EMOJIS.copyright} ${Moxi.user.username} • ${now.getFullYear()}`));

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
