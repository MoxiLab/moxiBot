const { MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, LabelBuilder } = require('discord.js');
const { clearUserPrefix } = require('../../../../Util/userPrefix');

module.exports = async function userPrefixButtons(interaction) {
    if (!interaction.customId?.startsWith('user_prefix:')) return false;

    const parts = String(interaction.customId || '').split(':');
    const ownerId = parts[1] || '';
    const action = parts[2] || '';

    if (!ownerId || interaction.user?.id !== ownerId) {
        await interaction.reply({
            content: 'Solo el autor del comando puede usar estos botones.',
            flags: MessageFlags.Ephemeral,
        }).catch(() => null);
        return true;
    }

    const guildId = interaction.guildId || interaction.guild?.id;
    if (!guildId) {
        await interaction.reply({
            content: 'Este boton solo funciona dentro de un servidor.',
            flags: MessageFlags.Ephemeral,
        }).catch(() => null);
        return true;
    }

    try {
        if (action === 'custom') {
            const modal = new ModalBuilder()
                .setCustomId(`user_prefix_modal:${ownerId}`)
                .setTitle('Prefijo personal');

            const input = new TextInputBuilder()
                .setCustomId('prefix_value');
            input.setStyle(TextInputStyle.Short);
            input.setMinLength(1);
            input.setMaxLength(20);
            input.setPlaceholder('Ej: !, ?, ~, mx!');
            input.setRequired(true);

            const label = new LabelBuilder();
            label.setLabel('Nuevo prefijo (max. 20 caracteres)');
            label.setTextInputComponent(input);

            modal.addLabelComponents(label);
            await interaction.showModal(modal);
            return true;
        }

        if (action === 'reset') {
            await clearUserPrefix(guildId, ownerId).catch(() => false);
            await interaction.reply({
                content: 'Tu prefijo personal fue eliminado. Ahora usas el del servidor.',
                flags: MessageFlags.Ephemeral,
            }).catch(() => null);
            return true;
        }

        await interaction.reply({
            content: 'Accion de prefijo no valida.',
            flags: MessageFlags.Ephemeral,
        }).catch(() => null);
        return true;
    } catch (err) {
        const msg = `Error al procesar el botón de prefijo: ${err?.message || err}`;
        try {
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
            } else {
                await interaction.followUp({ content: msg, flags: MessageFlags.Ephemeral });
            }
        } catch { }
        return true;
    }
};
