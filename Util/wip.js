const { buildNoticeContainer, asV2MessageOptions } = require('./v2Notice');
const { EMOJIS } = require('./emojis');

function buildWipPayload({
    title = 'En desarrollo',
    text = 'Este comando está en desarrollo.',
    emoji = (EMOJIS.info || 'ℹ️'),
} = {}) {
    return asV2MessageOptions(
        buildNoticeContainer({
            emoji,
            title,
            text,
        })
    );
}

module.exports = {
    buildWipPayload,
};
