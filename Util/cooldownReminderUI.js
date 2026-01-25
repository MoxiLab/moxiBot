const { PrimaryButtonBuilder, DangerButtonBuilder } = require('discord.js');
const { toComponentEmoji } = require('./discordEmoji');

function buildCooldownRemindCustomId({ type, fireAt, userId }) {
    return `cdrem:${String(type)}:${String(fireAt)}:${String(userId)}`;
}

function buildCooldownCancelCustomId({ type, userId }) {
    return `cdremcancel:${String(type)}:${String(userId)}`;
}

function buildRemindButton({ type, fireAt, userId, label = 'Avisarme' } = {}) {
    return new PrimaryButtonBuilder()
        .setCustomId(buildCooldownRemindCustomId({ type, fireAt, userId }))
        .setEmoji(toComponentEmoji('🔔'))
        .setLabel(label)
        ;
}

function buildCancelReminderButton({ type, userId, label = 'Cancelar recordatorio' } = {}) {
    return new DangerButtonBuilder()
        .setCustomId(buildCooldownCancelCustomId({ type, userId }))
        .setEmoji(toComponentEmoji('🛑'))
        .setLabel(label)
        ;
}

module.exports = {
    buildCooldownRemindCustomId,
    buildCooldownCancelCustomId,
    buildRemindButton,
    buildCancelReminderButton,
};
