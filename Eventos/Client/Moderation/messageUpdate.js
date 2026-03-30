const { processMessage } = require('../../../Util/moderationEngine');
const debugHelper = require('../../../Util/debugHelper');

module.exports = async (oldMessage, newMessage) => {
    try {
        const message = newMessage?.partial ? await newMessage.fetch().catch(() => null) : newMessage;
        if (!message || !message.guild || !message.author) return;
        if (message.author.bot) return;

        const oldContent = String(oldMessage?.content || '').trim();
        const newContent = String(message.content || '').trim();
        if (!newContent || oldContent === newContent) return;

        await processMessage({ client: message.client, message, isUpdate: true });
    } catch (err) {
        debugHelper?.error?.('automod', 'messageUpdate failed', err);
    }
};
