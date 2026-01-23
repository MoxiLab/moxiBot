const { ContainerBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { Bot } = require('../../Config');
module.exports = {
    name: "uptime",
    alias: ['uptime', 'tiempo', 'up'],
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_HERRAMIENTAS', lang);
    },
    usage: 'uptime',
    description: (lang = 'es-ES') => 'Muestra el tiempo que el bot lleva encendido.',

    async execute(Moxi, message, args) {
        const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
        const ms = Moxi.uptime;
        const sec = Math.floor((ms / 1000) % 60);
        const min = Math.floor((ms / (1000 * 60)) % 60);
        const hr = Math.floor((ms / (1000 * 60 * 60)) % 24);
        const d = Math.floor(ms / (1000 * 60 * 60 * 24));
        let uptime = `${d > 0 ? d + 'd ' : ''}${hr > 0 ? hr + 'h ' : ''}${min > 0 ? min + 'm ' : ''}${sec}s`;

        const container = new ContainerBuilder()
            .setAccentColor(Bot.AccentColor)
            .addTextDisplayComponents(c =>
                c.setContent(`# ⏱️ Uptime`)
            )
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(c =>
                c.setContent(`${EMOJIS.clock || '🕒'} El bot lleva encendido: **${uptime}**`)
            )
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(c =>
                c.setContent(`${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`)
            );

        await message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
    }
};
