const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags, PermissionFlagsBits, ContainerBuilder, ButtonStyle, MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
const { ButtonBuilder } = require('../../../../Util/compatButtonBuilder');
const moxi = require('../../../../i18n');
const { Bot } = require('../../../../Config');
const { EMOJIS } = require('../../../../Util/emojis');
const timerStorage = require('../../../../Util/timerStorage');

module.exports = async function timerButtonHandler(interaction, Moxi, logger) {
    if (!interaction.customId) return false;

    const isAdmin = Boolean(
        interaction.memberPermissions?.has?.(PermissionFlagsBits.Administrator)
        || interaction.member?.permissions?.has?.(PermissionFlagsBits.Administrator)
    );

    // Botón para crear nuevo temporizador
    if (interaction.customId === 'nuevo_timer') {
        const lang = await moxi.guildLang(interaction.guildId || interaction.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
        const guildId = interaction.guildId || interaction.guild?.id;
        const channelId = interaction.channelId || interaction.channel?.id;
        const userId = interaction.user?.id || interaction.member?.user?.id;
        // Si ya hay un temporizador activo en este canal, avisar
        const current = timerStorage.getTimer(guildId, channelId);
        if (current) {
            await interaction.reply({
                content: moxi.translate('Ya hay un temporizador activo en este canal.', lang),
                ephemeral: true
            });
            return true;
        }
        // Mostrar modal para pedir minutos
        const modal = new ModalBuilder()
            .setCustomId('timer_modal')
            .setTitle('Nuevo temporizador')
            .addComponents(
                new ActionRowBuilder().addComponents(
                    new TextInputBuilder()
                        .setCustomId('minutos')
                        .setLabel('¿Cuántos minutos? (1-1440)')
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                )
            );
        await interaction.showModal(modal);
        return true;
    }

    async function updateTimerList() {
        const comandos = require('../../../../Comandos/Tools/timer');
        const allTimers = timerStorage.getAllTimers();
        const container = comandos.buildListContainer(Moxi, interaction, allTimers);
        await interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }

    // Botón para cancelar temporizador (desde la lista)
    if (interaction.customId.startsWith('cancel_timer_')) {
        // Formato: cancel_timer_<guildId>_<channelId>
        const parts = interaction.customId.split('_');
        const guildId = parts[2];
        const channelId = parts[3];

        if (!guildId || !channelId) {
            await interaction.reply({ content: 'ID de temporizador inválido.', flags: MessageFlags.Ephemeral });
            return true;
        }

        const timer = timerStorage.getTimer(guildId, channelId);
        if (!timer) {
            await updateTimerList();
            return true;
        }
        // Solo el usuario creador o un admin puede cancelar
        if (timer.userId !== interaction.user.id && !isAdmin) {
            await interaction.reply({ content: 'Solo el usuario que creó el temporizador o un admin puede cancelarlo.', flags: MessageFlags.Ephemeral });
            return true;
        }
        // Eliminar correctamente de memoria y de MongoDB
        if (typeof timerStorage.clearTimer === 'function') {
            await timerStorage.clearTimer(guildId, channelId);
        }
        await updateTimerList();
        return true;
    }

    // Botón para cancelar temporizador (del canal actual)
    if (interaction.customId === 'cancel_timer') {
        const guildId = interaction.guildId || interaction.guild?.id;
        const channelId = interaction.channelId || interaction.channel?.id;
        const timer = timerStorage.getTimer(guildId, channelId);
        if (!timer) {
            await interaction.reply({ content: 'No hay un temporizador activo en este canal.', flags: MessageFlags.Ephemeral });
            return true;
        }
        if (timer.userId !== interaction.user.id && !isAdmin) {
            await interaction.reply({ content: 'Solo el usuario que creó el temporizador o un admin puede cancelarlo.', flags: MessageFlags.Ephemeral });
            return true;
        }
        if (typeof timerStorage.clearTimer === 'function') {
            await timerStorage.clearTimer(guildId, channelId);
        }
        await interaction.reply({ content: '✅ Temporizador cancelado.', flags: MessageFlags.Ephemeral });
        return true;
    }

    // Botón para refrescar la lista (ahora con sufijo único)
    if (interaction.customId.startsWith('refresh_timer_list')) {
        await updateTimerList();
        return true;
    }

    return false;
};
