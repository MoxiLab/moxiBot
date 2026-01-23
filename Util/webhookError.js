const { Colors } = require('discord.js');
const { isTestMode } = require('./runtimeMode');

async function sendWebhook(url, payload) {
    // Node 18+ incluye fetch
    await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    }).catch(() => { });
}

/**
 * Envía un error crítico a un webhook de Discord como embed bonito.
 * @param {string} message - Mensaje de error
 * @param {string} [stack] - Stacktrace o detalles
 */
async function sendErrorToWebhook(message, stack) {
    if (isTestMode()) return;
    const url = process.env.ERROR_WEBHOOK_URL;
    if (!url) return;
    const year = new Date().getFullYear();
    const embed = {
        color: Colors.Red,
        title: '🚨 Error crítico (AntiCrash)',
        description: `**${message}**${stack ? `\n\n\`\`\`js\n${stack}\n\`\`\`` : ''}`,
        timestamp: new Date().toISOString(),
        footer: { text: `Moxi AntiCrash • ${year}` }
    };
    try {
        await sendWebhook(url, {
            username: 'Moxi AntiCrash',
            avatar_url: 'https://i.imgur.com/1Q9Z1Zm.png',
            embeds: [embed],
        });
    } catch {}
}

module.exports = { sendErrorToWebhook };