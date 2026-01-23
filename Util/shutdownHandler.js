const { getShutdownComponentV2 } = require("../Components/V2/shutdownEmbedComponent");
const { MessageFlags } = require("discord.js");

/**
 * Inicializa el handler de apagado visual para el bot.
 * @param {import('discord.js').Client} client
 * @param {string} channelId
 */
function setupShutdownHandler(client, channelId) {
    process.on('beforeExit', async () => {
        try {
            const channel = await client.channels.fetch(channelId);
            if (channel && channel.isTextBased()) {
                const component = getShutdownComponentV2(client);
                await channel.send({ content: '', components: [component], flags: MessageFlags.IsComponentsV2 });
            }
        } catch (e) {}
    });
}

module.exports = { setupShutdownHandler };