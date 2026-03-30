const { processMemberJoin } = require('../../../Util/moderationEngine');
const debugHelper = require('../../../Util/debugHelper');

module.exports = async (member) => {
    try {
        if (!member || !member.guild) return;
        await processMemberJoin({ client: member.client, member });
    } catch (err) {
        debugHelper?.error?.('automod', 'guildMemberAdd failed', err);
    }
};
