
const mongoose = require('mongoose');
const { ContainerBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { isDiscordOnlyOwner } = require('../../Util/ownerPermissions');
const { Bot } = require('../../Config');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const debugHelper = require('../../Util/debugHelper');

module.exports = {
    name: 'mongo',
    alias: ['mongonode', 'mongostatus', 'mongoinfo', 'mongodb', 'infomongo', 'mstatus', 'mongo'],
    Category: 'Root',

    async execute(Moxi, message, args) {
        const guildId = message.guild?.id;
        const requesterId = message.author?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        debugHelper.log('mongo', 'command start', { guildId, requesterId });

        if (!await isDiscordOnlyOwner({ client: Moxi, userId: message.author?.id })) {
            debugHelper.warn('mongo', 'permission denied', { guildId, requesterId });
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        text: moxi.translate('NO_PERMISSION', lang),
                    })
                )
            );
        }
        // Estado de conexión
        const state = mongoose.connection.readyState;
        let stateEmoji = '';
        switch (state) {
            case 0: stateEmoji = EMOJIS.redCircle; break;
            case 1: stateEmoji = EMOJIS.greenCircle; break;
            case 2: stateEmoji = EMOJIS.yellowCircle; break;
            case 3: stateEmoji = EMOJIS.orangeCircle; break;
            default: stateEmoji = EMOJIS.whiteCircle;
        }

        // Stats y server
        let stats = {}, server = {};
        try {
            stats = await mongoose.connection.db.command({ dbStats: 1 });
            server = await mongoose.connection.db.admin().serverStatus();
            debugHelper.log('mongo', 'stats fetched', { guildId, requesterId });
        } catch (e) {
            stats = {};
            server = {};
            debugHelper.warn('mongo', 'stats fetch failed', { guildId, requesterId, message: e?.message });
        }

        // Uptime
        let uptime = 'N/A';
        if (server.uptime) {
            const d = Math.floor(server.uptime / 60 / 60 / 24);
            const h = Math.floor((server.uptime / 60 / 60) % 24);
            const m = Math.floor((server.uptime / 60) % 60);
            const s = Math.floor(server.uptime % 60);
            uptime = `${d ? d + 'd, ' : ''}${h}h, ${m}m, ${s}s`;
        }

        // Memoria
        const memMB = server.mem && server.mem.resident ? `${server.mem.resident} MB` : 'N/A';
        let memBar = '';
        if (server.mem && server.mem.resident && server.mem.virtual) {
            const used = server.mem.resident;
            const total = server.mem.virtual;
            const percent = total ? Math.round((used / total) * 10) : 0;
            memBar = '▰'.repeat(percent) + '▱'.repeat(10 - percent);
        }

        // Tamaño y colecciones
        const dbSize = stats.dataSize ? `${(stats.dataSize / 1024 / 1024).toFixed(2)} MB` : 'N/A';
        const free = stats.storageSize && stats.dataSize ? `${((stats.storageSize - stats.dataSize) / 1024 / 1024).toFixed(2)} MB` : 'N/A';
        const version = server.version || stats.version || 'N/A';
        const dbName = mongoose.connection && mongoose.connection.name ? mongoose.connection.name : 'N/A';
        let collectionsCount = 0;
        try {
            collectionsCount = (await mongoose.connection.db.listCollections().toArray()).length;
        } catch (e) {
            collectionsCount = 0;
        }

        const now = new Date();
        const container = new ContainerBuilder()
            .setAccentColor(Bot.AccentColor)
            .addTextDisplayComponents(c =>
                c.setContent(`# ${moxi.translate('MONGO_STATUS_TITLE', lang) || 'MongoDB Status'}`)
            )
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(c =>
                c.setContent(`${moxi.translate('MONGO_STATUS', lang) || 'Estado'}: ${stateEmoji}`)
            )
            .addTextDisplayComponents(c =>
                c.setContent(`${moxi.translate('MONGO_DATABASE', lang) || 'Base de datos'}: **${dbName}**`)
            )
            .addTextDisplayComponents(c =>
                c.setContent(`${moxi.translate('MONGO_COLLECTIONS', lang) || 'Colecciones'}: **${collectionsCount}**`)
            )
            .addTextDisplayComponents(c =>
                c.setContent(`${moxi.translate('MONGO_MEMORY', lang) || 'Memoria'}: **${memMB}**`)
            )
            .addTextDisplayComponents(c =>
                c.setContent(memBar ? `${moxi.translate('MONGO_MEMORY_USAGE', lang)}:\n${memBar}` : `${moxi.translate('MONGO_MEMORY_USAGE', lang)}: N/A`)
            )
            .addTextDisplayComponents(c =>
                c.setContent(`${moxi.translate('MONGO_DB_SIZE', lang) || 'Tamaño DB'}: **${dbSize}**`)
            )
            .addTextDisplayComponents(c =>
                c.setContent(`${moxi.translate('MONGO_FREE_SPACE', lang) || 'Espacio libre'}: **${free}**`)
            )
            .addTextDisplayComponents(c =>
                c.setContent(`${moxi.translate('MONGO_VERSION', lang) || 'Versión'}: **${version}**`)
            )
            .addTextDisplayComponents(c =>
                c.setContent(`${moxi.translate('MONGO_UPTIME', lang) || 'Uptime'}: **${uptime}**`)
            )
            .addSeparatorComponents(s => s.setDivider(true))
            .addActionRowComponents(row =>
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('refresh_mongonode')
                        .setLabel(moxi.translate('REFRESH', lang) || 'Refrescar')
                        .setStyle(ButtonStyle.Primary)
                )
            )
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(c =>
                c.setContent(`${EMOJIS.copyright} ${Moxi.user.username} • ${now.getFullYear()}`)
            );

        await message.channel.send({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
        debugHelper.log('mongo', 'reply sent', { guildId });
    }
};
