const { ContainerBuilder, LinkButtonBuilder, MessageFlags } = require('discord.js');
const { EMOJIS } = require('../../Util/emojis');
const { Bot } = require('../../Config');

async function panelV2({ client: Moxi, message, prefix }) {
    const moxi = require('../../i18n');
    const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
    let panel;
    try {
        panel = require(`../../Languages/${lang}/mentionPanel.json`);
    } catch {
        panel = require(`../../Languages/en-US/mentionPanel.json`);
    }
    const langName = moxi.translate('LANGUAGE_NAME', lang) || lang;
    const mention = `<@${Moxi.user.id}>`;
    const replacements = {
        mention,
        lang,
        langName,
        prefix
    };
    function t(str) {
        return str.replace(/\{\{(\w+)\}\}/g, (_, k) => replacements[k] || '');
    }
    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(c =>
            c.setContent(t(panel.greeting))
        )
        .addTextDisplayComponents(c =>
            c.setContent(t(panel.lang_label))
        )
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c =>
            c.setContent(t(panel.prefix_label))
        )
        .addTextDisplayComponents(c =>
            c.setContent(t(panel.forgot_prefix))
        )
        .addSeparatorComponents(s => s.setDivider(true))
        .addActionRowComponents(row =>
            row.addComponents(
                new LinkButtonBuilder().setLabel(t(panel.invite)).setURL('https://discord.com/oauth2/authorize?client_id=1456441655769956436&permissions=8&integration_type=0&scope=bot'),
                new LinkButtonBuilder().setLabel(t(panel.support)).setURL('https://discord.gg/tu-servidor'),
                new LinkButtonBuilder().setLabel(t(panel.web)).setURL('https://moxilab.net')
            )
        )
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => {
            let thanksMsg = panel.thanks || 'Thanks!';
            thanksMsg = thanksMsg.replace(/\{\{mention\}\}/g, mention);
            return c.setContent(thanksMsg);
        });
    return { content: '', components: [container], flags: MessageFlags.IsComponentsV2 };
}

module.exports = async function mentionPanel(ctx) {
    // Solo Components V2
    return panelV2(ctx);
};