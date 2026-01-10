const { ContainerBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
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
                new ButtonBuilder().setLabel(t(panel.invite)).setStyle(ButtonStyle.Link).setURL(`https://discord.com/oauth2/authorize?client_id=${Moxi.user.id}&scope=bot+applications.commands&permissions=8`),
                new ButtonBuilder().setLabel(t(panel.support)).setStyle(ButtonStyle.Link).setURL('https://discord.gg/tu-servidor'),
                new ButtonBuilder().setLabel(t(panel.web)).setStyle(ButtonStyle.Link).setURL('https://moxibot.es')
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