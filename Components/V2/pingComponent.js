const { ContainerBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { ButtonBuilder } = require('../../Util/compatButtonBuilder');
const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { Bot } = require('../../Config');

module.exports = async function sendPingComponent(interaction, Moxi) {
    const lang = await moxi.guildLang(interaction.guildId, process.env.DEFAULT_LANG || 'es-ES');

    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(c =>
            c.setContent(`# ${EMOJIS.pingPong} ${moxi.translate('PING_TITLE', lang) || '¡Pong!'}`)
        )
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c =>
            c.setContent(moxi.translate('PING_DESCRIPTION', lang, { ping: Moxi.ws.ping }) || `*Mi ping es de* **\`${Moxi.ws.ping}ms\`**`)
        )
        .addSeparatorComponents(s => s.setDivider(true))
        .addActionRowComponents(row =>
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('refresh_ping')
                    .setLabel(moxi.translate('PING_REFRESH', lang) || 'Refrescar')
                    .setStyle(ButtonStyle.Primary)
            )
        );

    await interaction.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: true });
}
