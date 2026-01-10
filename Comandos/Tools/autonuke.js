// Comando autonuke: elimina y recrea el canal
const {
    ChannelType,
    PermissionsBitField,
    ButtonBuilder,
    ActionRowBuilder,
    ContainerBuilder,
    MessageFlags,
} = require('discord.js');
const moxi = require('../../i18n');
const { Bot } = require('../../Config');

module.exports = {
    name: "autonuke",
    alias: ["autonuke", "nukechannel", "nuke", "nag"],
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_HERRAMIENTAS', lang);
    },
    usage: 'autonuke',
    get description() { return moxi.translate('commands:CMD_AUTONUKE_DESC', 'es-ES'); },
    permissions: [PermissionsBitField.Flags.ManageChannels],
    async execute(Moxi, messageOrInteraction, args, prefix) {
        // Detectar si es interacción (slash) o mensaje (texto)
        const isInteraction = !!messageOrInteraction.isCommand || !!messageOrInteraction.isButton;
        const guild = isInteraction ? messageOrInteraction.guild : messageOrInteraction.guild;
        const channel = isInteraction ? messageOrInteraction.channel : messageOrInteraction.channel;
        const author = isInteraction ? messageOrInteraction.user : messageOrInteraction.author;
        const lang = await moxi.guildLang(guild?.id, process.env.DEFAULT_LANG || 'es-ES');

        // Todos los textos de respuesta y embeds usan el idioma del servidor
        const confirmBtn = new ButtonBuilder()
            .setCustomId('autonuke_confirm')
            .setLabel(moxi.translate('AUTONUKE_CONFIRM', lang))
            .setStyle(4); // Danger
        const cancelBtn = new ButtonBuilder()
            .setCustomId('autonuke_cancel')
            .setLabel(moxi.translate('AUTONUKE_CANCEL', lang) || moxi.translate('AUTONUKE_CANCEL', 'es-ES') || 'Cancelar')
            .setStyle(2); // Secondary
        const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);
        const buildAutonukeConfirmEmbed = require('../../Components/V2/autonukeConfirmEmbed');
        const confirmContainer = buildAutonukeConfirmEmbed({ lang, channelId: channel.id });
        const replyPayload = {
            content: '',
            components: [confirmContainer, row],
            flags: MessageFlags.IsComponentsV2,
        };
        if (isInteraction) replyPayload.ephemeral = true;

        let replyMessage;
        if (isInteraction) {
            await messageOrInteraction.reply(replyPayload);
            replyMessage = await messageOrInteraction.fetchReply();
        } else {
            replyMessage = await messageOrInteraction.reply(replyPayload);
        }

        // Manejar interacción de botones
        const filter = i => ['autonuke_confirm', 'autonuke_cancel'].includes(i.customId) && i.user.id === author.id;
        const collector = replyMessage.createMessageComponentCollector({ filter, time: 15000, max: 1 });
        collector.on('collect', async interaction => {
            if (interaction.customId === 'autonuke_confirm') {
                await interaction.deferUpdate();
                const buildAutonukeEmbed = require('../../Components/V2/autonukeEmbed');
                let cloneOptions = { name: channel.name, parent: channel.parent };
                if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildAnnouncement) {
                    cloneOptions = {
                        ...cloneOptions,
                        topic: channel.topic,
                        nsfw: channel.nsfw,
                        rateLimitPerUser: channel.rateLimitPerUser
                    };
                } else if (channel.type === ChannelType.GuildVoice) {
                    cloneOptions = {
                        ...cloneOptions,
                        bitrate: channel.bitrate,
                        userLimit: channel.userLimit
                    };
                } else if (channel.type === ChannelType.GuildForum) {
                    cloneOptions = {
                        ...cloneOptions,
                        topic: channel.topic,
                        nsfw: channel.nsfw
                    };
                }
                const newChannel = await channel.clone(cloneOptions);
                await channel.delete(moxi.translate('AUTONUKE_REASON', lang));
                await newChannel.send({
                    content: '',
                    components: [buildAutonukeEmbed({ lang, authorId: author.id })],
                    flags: MessageFlags.IsComponentsV2,
                });
            } else if (interaction.customId === 'autonuke_cancel') {
                const cancelled = new ContainerBuilder()
                    .setAccentColor(Bot.AccentColor)
                    .addTextDisplayComponents(c =>
                        c.setContent(moxi.translate('AUTONUKE_CANCELLED', lang) || 'Operación cancelada.')
                    );
                await interaction.update({ content: '', components: [cancelled], flags: MessageFlags.IsComponentsV2 });
            } else {
                const invalid = new ContainerBuilder()
                    .setAccentColor(Bot.AccentColor)
                    .addTextDisplayComponents(c =>
                        c.setContent(moxi.translate('AUTONUKE_INVALID', lang) || 'Acción no válida.')
                    );
                await interaction.update({ content: '', components: [invalid], flags: MessageFlags.IsComponentsV2 });
            }
        });
    },
};
