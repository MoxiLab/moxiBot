const { WebhookClient, Colors } = require('discord.js');

/**
 * Envía un error crítico a un webhook de Discord como embed bonito.
 * @param {string} message - Mensaje de error
 * @param {string} [stack] - Stacktrace o detalles
 */
async function sendErrorToWebhook(message, stack) {
    const url = process.env.ERROR_WEBHOOK_URL;
    if (!url) return;
    const webhook = new WebhookClient({ url });
    const year = new Date().getFullYear();
    const embed = {
        color: Colors.Red,
        title: '🚨 Error crítico (AntiCrash)',
        description: `**${message}**${stack ? `\n\n\`\`\`js\n${stack}\n\`\`\`` : ''}`,
        timestamp: new Date().toISOString(),
        footer: { text: `Moxi AntiCrash • ${year}` }
    };
    try {
        await webhook.send({
            username: 'Moxi AntiCrash',
            avatarURL: 'https://i.imgur.com/1Q9Z1Zm.png',
            embeds: [embed],
        });
    } catch {}
}

module.exports = { sendErrorToWebhook };