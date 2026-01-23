const { ButtonBuilder, ButtonStyle } = require('discord.js');

function buildCooldownRemindCustomId({ type, fireAt, userId }) {
    return `cdrem:${String(type)}:${String(fireAt)}:${String(userId)}`;
}

function buildCooldownCancelCustomId({ type, userId }) {
    return `cdremcancel:${String(type)}:${String(userId)}`;
}

function buildRemindButton({ type, fireAt, userId, label = 'Avisarme' } = {}) {
    return new ButtonBuilder()
        .setCustomId(buildCooldownRemindCustomId({ type, fireAt, userId }))
        .setEmoji('🔔')
        .setLabel(label)
        .setStyle(ButtonStyle.Primary);
}

function buildCancelReminderButton({ type, userId, label = 'Cancelar recordatorio' } = {}) {
    return new ButtonBuilder()
        .setCustomId(buildCooldownCancelCustomId({ type, userId }))
        .setEmoji('🛑')
        .setLabel(label)
        .setStyle(ButtonStyle.Danger);
}

module.exports = {
    buildCooldownRemindCustomId,
    buildCooldownCancelCustomId,
    buildRemindButton,
    buildCancelReminderButton,
};
