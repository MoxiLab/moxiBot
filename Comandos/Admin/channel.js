
const { PermissionsBitField, ContainerBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, MessageFlags, TextInputBuilder, ActionRowBuilder, ModalBuilder } = require('discord.js');
const { Bot } = require('../../Config');
const { EMOJIS } = require('../../Util/emojis');

module.exports = {
    name: 'channel',
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ADMIN', lang);
    },
    alias: ['canal', 'channel', 'ch'],
    description: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('audit:CMD_AUDIT_DESC', lang);
    },
    usage: 'channel <crear|borrar|mover|renombrar> <tipo> <nombre> [opciones]',
    async execute(Moxi, message, args) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.ManageChannels)) {
            return message.reply('No tienes permisos para gestionar canales.');
        }

        // Si hay argumentos, ejecuta el flujo clásico (retrocompatibilidad)
        if (args.length >= 3) {
            // ...existing code...
            return message.reply('Modo clásico deshabilitado, usa el menú interactivo.');
        }

        // COMPONENTS V2: Menú interactivo
        const lang = message.guild?.preferredLocale || 'es-ES';
        const container = new ContainerBuilder().setAccentColor(Bot.AccentColor);
        container.addTextDisplayComponents(c => c.setContent(`# ${EMOJIS.folder || '📁'} Gestión de canales`));
        container.addSeparatorComponents(s => s.setDivider(true));
        container.addTextDisplayComponents(c => c.setContent('Selecciona la acción y el tipo de canal.'));

        // Select de acción
        const actionSelect = new StringSelectMenuBuilder()
            .setCustomId('channel_action')
            .setPlaceholder('Selecciona una acción')
            .addOptions([
                { label: 'Crear', value: 'crear', emoji: EMOJIS.greenCircle || '🟢' },
                { label: 'Borrar', value: 'borrar', emoji: EMOJIS.redCircle || '🔴' },
                { label: 'Renombrar', value: 'renombrar', emoji: EMOJIS.orangeCircle || '🟠' },
                { label: 'Mover', value: 'mover', emoji: EMOJIS.folder || '📁' },
            ]);

        // Select de tipo
        const typeSelect = new StringSelectMenuBuilder()
            .setCustomId('channel_type')
            .setPlaceholder('Selecciona el tipo de canal')
            .addOptions([
                { label: 'Texto', value: 'texto', emoji: EMOJIS.book || '📖' },
                { label: 'Voz', value: 'voz', emoji: EMOJIS.musicNotes || '🎶' },
                { label: 'Categoría', value: 'categoria', emoji: EMOJIS.folder || '📁' },
            ]);

        container.addActionRowComponents(row => row.addComponents(actionSelect));
        container.addActionRowComponents(row => row.addComponents(typeSelect));

        // Botón de continuar
        const continueButton = new ButtonBuilder()
            .setCustomId('channel_continue')
            .setLabel('Continuar')
            .setStyle(ButtonStyle.Primary)
            .setEmoji(EMOJIS.arrowRight || '➡️');
        const cancelButton = new ButtonBuilder()
            .setCustomId('channel_cancel')
            .setLabel('Cancelar')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(EMOJIS.cross || '❌');

        container.addActionRowComponents(row => row.addComponents(continueButton, cancelButton));

        return message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
    }
};