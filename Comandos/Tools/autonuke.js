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
        // Comprobar permisos antes de continuar
        const member = messageOrInteraction.member;
        if (!member?.permissions?.has(PermissionsBitField.Flags.ManageChannels)) {
            const lang = await moxi.guildLang(guild?.id, process.env.DEFAULT_LANG || 'es-ES');
            const noPermMsg = moxi.translate('AUTONUKE_NO_PERMS', lang) || 'No tienes permisos para usar este comando.';
            if (isInteraction) {
                return messageOrInteraction.reply({ content: noPermMsg, ephemeral: true });
            } else {
                return messageOrInteraction.reply(noPermMsg);
            }
        }
        const lang = await moxi.guildLang(guild?.id, process.env.DEFAULT_LANG || 'es-ES');

        const buildStatusContainer = (text) =>
            new ContainerBuilder()
                .setAccentColor(Bot.AccentColor)
                .addTextDisplayComponents(c => c.setContent(text));

        const isRequiredCommunityChannel = (g, ch) => {
            if (!g || !ch) return false;
            const required = [g.rulesChannelId, g.publicUpdatesChannelId, g.systemChannelId].filter(Boolean);
            return required.includes(ch.id);
        };

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

                // En servidores Community hay canales que Discord NO permite borrar (error 50074)
                if (isRequiredCommunityChannel(guild, channel)) {
                    const msg = moxi.translate('AUTONUKE_REQUIRED_CHANNEL', lang) || 'No puedo eliminar este canal porque es requerido por el servidor (Community).';
                    await interaction.editReply({
                        content: '',
                        components: [buildStatusContainer(msg)],
                        flags: MessageFlags.IsComponentsV2,
                    }).catch(() => { });
                    return;
                }

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
                let newChannel;
                try {
                    newChannel = await channel.clone(cloneOptions);
                    await channel.delete(moxi.translate('AUTONUKE_REASON', lang));
                    await newChannel.send({
                        content: '',
                        components: [buildAutonukeEmbed({ lang, authorId: author.id })],
                        flags: MessageFlags.IsComponentsV2,
                    });
                } catch (err) {
                    // Si no se pudo borrar el canal original, intenta limpiar el clon para no duplicar
                    try {
                        const code = err?.code || err?.rawError?.code;
                        if (newChannel && code === 50074) {
                            await newChannel.delete().catch(() => { });
                        }
                    } catch { }

                    const code = err?.code || err?.rawError?.code;
                    if (code === 50074) {
                        const msg = moxi.translate('AUTONUKE_REQUIRED_CHANNEL', lang) || 'No puedo eliminar este canal porque es requerido por el servidor (Community).';
                        await interaction.followUp({ content: msg, ephemeral: true }).catch(() => { });
                        return;
                    }

                    const msg = moxi.translate('AUTONUKE_FAILED', lang) || 'No pude recrear el canal. Revisa permisos/configuración e inténtalo de nuevo.';
                    await interaction.followUp({ content: msg, ephemeral: true }).catch(() => { });
                }
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
