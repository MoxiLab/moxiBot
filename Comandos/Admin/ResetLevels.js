const { PermissionsBitField: { Flags }, ApplicationCommandOptionType, ContainerBuilder, MessageFlags, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { ButtonBuilder } = require('../../Util/compatButtonBuilder');
const LevelSystem = require('../../Global/Helpers/LevelSystem');
const { Bot } = require('../../Config');
const debugHelper = require('../../Util/debugHelper');
const moxi = require('../../i18n');

module.exports = {
    name: 'resetlevels',
    alias: ['reset-levels', 'resetear'],
    description: 'Resetea los niveles de un usuario o servidor',
    usage: 'resetlevels [usuario]',
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ADMIN', lang);
    },
    cooldown: 5,

    permissions: {
        user: [Flags.Administrator],
        bot: [Flags.SendMessages],
        role: []
    },

    command: {
        prefix: true,
        slash: true,
        flags: 64,
        options: [
            {
                name: 'usuario',
                description: 'Usuario a resetear (dejar vacío para resetear servidor)',
                type: ApplicationCommandOptionType.User,
                required: false
            }
        ]
    },

    execute: async (Moxi, message, args) => {
        try {
            debugHelper.log('resetlevels', 'execute start', {
                guildId: message.guildId,
                targetArg: args[0] || null,
                mention: message.mentions.users.first()?.id
            });
            const target = message.mentions.users.first() || (args[0] ? await Moxi.users.fetch(args[0]).catch(() => null) : null);
            const guildID = message.guildId;
            const lang = await moxi.guildLang(guildID, process.env.DEFAULT_LANG || 'es-ES');

            if (target) {
                const user = await LevelSystem.resetUser(guildID, target.id);
                if (!user) {
                    debugHelper.warn('resetlevels', 'user reset failed', { guildId: guildID, targetId: target.id });
                    const container = new ContainerBuilder().setAccentColor(Bot.AccentColor)
                        .addTextDisplayComponents(c => c.setContent('# ❌ Error al resetear el usuario.'));
                    return message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
                }

                const container = new ContainerBuilder()
                    .setAccentColor(Bot.AccentColor)
                    .addTextDisplayComponents(c =>
                        c.setContent(`<a:reload:1455501217542438923> **Usuario Reseteado**\nSe ha reseteado completamente a ${target}`)
                    )
                    .addSeparatorComponents(s => s.setDivider(true))
                    .addTextDisplayComponents(c =>
                        c.setContent(`Usuario: ${target} (${target.id})\nNuevo Nivel: 1\nXP: 0`)
                    )
                    .addTextDisplayComponents(c =>
                        c.setContent(`© ${client.user.username} • ${new Date().getFullYear()}`)
                    );
                await message.reply({ content: '', components: [container], allowedMentions: { repliedUser: false }, flags: MessageFlags.IsComponentsV2 });
                debugHelper.log('resetlevels', 'user reset complete', { guildId: guildID, targetId: target.id });

            } else {
                const container = new ContainerBuilder()
                    .setAccentColor(Bot.AccentColor)
                    .addTextDisplayComponents(c =>
                        c.setContent('⚠️ **Reset de Servidor**\n¿Estás seguro de que quieres resetear todos los niveles del servidor?')
                    )
                    .addSeparatorComponents(s => s.setDivider(true))
                    .addTextDisplayComponents(c =>
                        c.setContent(`© ${Moxi.user.username} • ${new Date().getFullYear()}`)
                    );
                const confirmBtn = new ButtonBuilder()
                    .setCustomId('confirm_server_reset')
                    .setLabel(moxi.translate('CONFIRM', lang) || 'Confirmar')
                    .setStyle(ButtonStyle.Danger);
                const cancelBtn = new ButtonBuilder()
                    .setCustomId('cancel_server_reset')
                    .setLabel(moxi.translate('CANCEL', lang) || 'Cancelar')
                    .setStyle(ButtonStyle.Secondary);
                const row = new ActionRowBuilder().addComponents(confirmBtn, cancelBtn);
                container.addActionRowComponents(row);
                const reply = await message.reply({
                    content: '',
                    components: [container],
                    allowedMentions: { repliedUser: false },
                    flags: MessageFlags.IsComponentsV2
                });
                debugHelper.log('resetlevels', 'server reset prompt', { guildId: guildID });

                const collector = reply.createMessageComponentCollector({ time: 30000 });

                collector.on('collect', async (i) => {
                    if (i.customId === 'confirm_server_reset') {
                        const result = await LevelSystem.seasonalReset(guildID);

                        if (!result) {
                            return i.update({
                                content: '',
                                components: [new ContainerBuilder().setAccentColor(Bot.AccentColor).addTextDisplayComponents(c => c.setContent('# ❌ Error al resetear el servidor.'))]
                            });
                        }

                        const successContainer = new ContainerBuilder()
                            .setAccentColor(Bot.AccentColor)
                            .addTextDisplayComponents(c => c.setContent('# ✅ Servidor Reseteado'))
                            .addSeparatorComponents(s => s.setDivider(true))
                            .addTextDisplayComponents(c => c.setContent(
                                `Se han reseteado todos los niveles del servidor\n` +
                                `Usuarios Afectados: **${result.modifiedCount}**`
                            ));

                        await i.update({ content: '', components: [successContainer] });
                        debugHelper.log('resetlevels', 'server reset confirmed', { guildId: guildID, affected: result.modifiedCount });

                    } else if (i.customId === 'cancel_server_reset') {
                        const cancelContainer = new ContainerBuilder().setAccentColor(Bot.AccentColor)
                            .addTextDisplayComponents(c => c.setContent('# ❌ Reset cancelado.'));
                        await i.update({ content: '', components: [cancelContainer] });
                        debugHelper.log('resetlevels', 'server reset canceled', { guildId: guildID, userId: i.user.id });
                    }
                });

                collector.on('end', (collected) => {
                    if (collected.size === 0) {
                        const timeoutContainer = new ContainerBuilder().setAccentColor(Bot.AccentColor)
                            .addTextDisplayComponents(c => c.setContent('# ⏰ Tiempo agotado.'));
                        reply.edit({ content: '', components: [timeoutContainer] });
                        debugHelper.log('resetlevels', 'server reset timeout', { guildId: guildID });
                    }
                });
            }

        } catch (error) {
            debugHelper.error('resetlevels', 'execute error', { guildId: message.guildId, error });
            console.error('[ResetLevels Command] Error:', error);
            const container = new ContainerBuilder().setAccentColor(Bot.AccentColor)
                .addTextDisplayComponents(c => c.setContent('# ❌ Error al procesar el reset.'));
            message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
        }
    },

    interactionRun: async (client, interaction) => {
        try {
            debugHelper.log('resetlevels', 'interaction start', {
                guildId: interaction.guildId,
                targetId: interaction.options.getUser('usuario')?.id || null,
            });
            await interaction.deferReply();

            const target = interaction.options.getUser('usuario');
            const guildID = interaction.guildId;

            if (target) {
                const user = await LevelSystem.resetUser(guildID, target.id);

                if (!user) {
                    debugHelper.warn('resetlevels', 'interaction user reset failed', { guildId: guildID, targetId: target.id });
                    const container = new ContainerBuilder().setAccentColor(Bot.AccentColor)
                        .addTextDisplayComponents(c => c.setContent('# ❌ Error al resetear el usuario.'));
                    return interaction.editReply({ content: '', components: [container], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
                }

                const container = new ContainerBuilder()
                    .setAccentColor(Bot.AccentColor)
                    .addTextDisplayComponents(c => c.setContent(`<a:reload:1455501217542438923> **Usuario Reseteado**\nSe ha reseteado completamente a ${target}`))
                    .addSeparatorComponents(s => s.setDivider(true))
                    .addTextDisplayComponents(c => c.setContent(
                        `Usuario: ${target} (${target.id})\n` +
                        `Nuevo Nivel: 1\n` +
                        `XP: 0`
                    ));

                await interaction.editReply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
                debugHelper.log('resetlevels', 'interaction user reset complete', { guildId: guildID, targetId: target.id });

            } else {
                const container = new ContainerBuilder()
                    .setAccentColor(Bot.AccentColor)
                    .addTextDisplayComponents(c => c.setContent('# ⚠️ Reset de Servidor'))
                    .addSeparatorComponents(s => s.setDivider(true))
                    .addTextDisplayComponents(c => c.setContent('¿Estás seguro de que quieres resetear todos los niveles del servidor?'));

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('confirm_server_reset').setLabel(moxi.translate('CONFIRM', lang) || 'Confirmar').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('cancel_server_reset').setLabel(moxi.translate('CANCEL', lang) || 'Cancelar').setStyle(ButtonStyle.Secondary)
                );
                container.addActionRowComponents(row);

                const message = await interaction.editReply({
                    content: '',
                    components: [container],
                    flags: MessageFlags.IsComponentsV2
                });
                debugHelper.log('resetlevels', 'interaction server reset prompt', { guildId: guildID });

                const collector = message.createMessageComponentCollector({ time: 30000 });

                collector.on('collect', async (i) => {
                    if (i.customId === 'confirm_server_reset') {
                        const result = await LevelSystem.seasonalReset(guildID);

                        if (!result) {
                            return i.update({
                                content: '',
                                components: [new ContainerBuilder().setAccentColor(Bot.AccentColor).addTextDisplayComponents(c => c.setContent('# ❌ Error al resetear el servidor.'))]
                            });
                        }

                        const successContainer = new ContainerBuilder()
                            .setAccentColor(Bot.AccentColor)
                            .addTextDisplayComponents(c => c.setContent('# ✅ Servidor Reseteado'))
                            .addSeparatorComponents(s => s.setDivider(true))
                            .addTextDisplayComponents(c => c.setContent(
                                `Se han reseteado todos los niveles del servidor\n` +
                                `Usuarios Afectados: **${result.modifiedCount}**`
                            ));

                        await i.update({ content: '', components: [successContainer] });
                        debugHelper.log('resetlevels', 'interaction server reset confirmed', { guildId: guildID, affected: result.modifiedCount });

                    } else if (i.customId === 'cancel_server_reset') {
                        await i.update({
                            content: '',
                            components: [new ContainerBuilder().setAccentColor(Bot.AccentColor).addTextDisplayComponents(c => c.setContent('# ❌ Reset cancelado.'))]
                        });
                        debugHelper.log('resetlevels', 'interaction server reset canceled', { guildId: guildID, userId: i.user.id });
                    }
                });

                collector.on('end', (collected) => {
                    if (collected.size === 0) {
                        interaction.editReply({
                            content: '',
                            components: [new ContainerBuilder().setAccentColor(Bot.AccentColor).addTextDisplayComponents(c => c.setContent('# ⏰ Tiempo agotado.'))]
                        });
                        debugHelper.log('resetlevels', 'interaction server reset timeout', { guildId: guildID });
                    }
                });
            }

        } catch (error) {
            debugHelper.error('resetlevels', 'interaction error', {
                guildId: interaction.guildId,
                error
            });
            console.error('[ResetLevels Command] Error:', error);
            const container = new ContainerBuilder().setAccentColor(Bot.AccentColor)
                .addTextDisplayComponents(c => c.setContent('# ❌ Error al procesar el reset.'));
            interaction.editReply({ content: '', components: [container], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        }
    }
};

