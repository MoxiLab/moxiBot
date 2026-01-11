const { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, MessageFlags, ContainerBuilder, ButtonBuilder, ButtonStyle, MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
const moxi = require('../../../../i18n');
const { Bot } = require('../../../../Config');
const { EMOJIS } = require('../../../../Util/emojis');
const timerStorage = require('../../../../Util/timerStorage');

module.exports = async function timerButtonHandler(interaction, Moxi, logger) {
    if (!interaction.customId) return false;

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

    // Botón para cancelar temporizador
    if (interaction.customId.startsWith('cancel_timer_')) {
        const [_, guildId, channelId] = interaction.customId.split('_');
        const timer = timerStorage.getTimer(guildId, channelId);
        if (!timer) {
            // Actualizar el mensaje original con la lista nueva (sin ese temporizador)
            const comandos = require('../../../../Comandos/Tools/timer');
            const allTimers = timerStorage.getAllTimers();
            const container = comandos.buildListContainer(Moxi, interaction, allTimers);
            await interaction.update({ content: '', components: [container], flags: 32768 });
            return true;
        }
        // Solo el usuario creador puede cancelar
        if (timer.userId !== interaction.user.id) {
            await interaction.reply({ content: 'Solo el usuario que creó el temporizador puede cancelarlo.', flags: MessageFlags.Ephemeral });
            return true;
        }
        // Eliminar correctamente de memoria y de MongoDB
        if (typeof timerStorage.clearTimer === 'function') {
            await timerStorage.clearTimer(guildId, channelId);
        }
        // Actualizar el mensaje original con la lista nueva
        const comandos = require('../../../../Comandos/Tools/timer');
        const allTimers = timerStorage.getAllTimers();
        const container = comandos.buildListContainer(Moxi, interaction, allTimers);
        await interaction.update({ content: '', components: [container], flags: 32768 });
        return true;
    }

    // Botón para refrescar la lista (ahora con sufijo único)
    if (interaction.customId.startsWith('refresh_timer_list')) {
        const comandos = require('../../../../Comandos/Tools/timer');
        const allTimers = timerStorage.getAllTimers();
        const container = comandos.buildListContainer(Moxi, interaction, allTimers);
        await interaction.update({ content: '', components: [container], flags: 32768 });
        return true;
    }

    return false;
};
