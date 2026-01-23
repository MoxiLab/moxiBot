const { MessageFlags, ContainerBuilder, ButtonStyle, MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
const { ButtonBuilder } = require('../../../../Util/compatButtonBuilder');
const moxi = require('../../../../i18n');
const { Bot } = require('../../../../Config');
const { EMOJIS } = require('../../../../Util/emojis');
const timerStorage = require('../../../../Util/timerStorage');

module.exports = async function timerModalHandler(interaction, Moxi, logger) {
    if (!interaction.isModalSubmit() || interaction.customId !== 'timer_modal') return false;

    const lang = await moxi.guildLang(interaction.guildId || interaction.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
    const guildId = interaction.guildId || interaction.guild?.id;
    const channelId = interaction.channelId || interaction.channel?.id;
    const userId = interaction.user?.id || interaction.member?.user?.id;

    // Si ya hay un temporizador activo en este canal, avisar
    const current = timerStorage.getTimer(guildId, channelId);
    if (current) {
        await interaction.reply({
            content: moxi.translate('Ya hay un temporizador activo en este canal.', lang),
            ephemeral: true
        });
        return true;
    }

    const minutos = parseInt(interaction.fields.getTextInputValue('minutos'), 10);
    if (isNaN(minutos) || minutos < 1 || minutos > 1440) {
        await interaction.reply({
            content: moxi.translate('Elige una cantidad de minutos entre 1 y 1440.', lang),
            ephemeral: true
        });
        return true;
    }

    const timerImageUrl = `https://dummyimage.com/600x200/222/fff&text=⏰+${minutos}+minutos`;
    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(c =>
            c.setContent(`# ⏰ Temporizador iniciado`)
        )
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c =>
            c.setContent(`${EMOJIS.hourglass || '⏳'} Tiempo: **${minutos} minutos**`)
        )
        .addTextDisplayComponents(c =>
            c.setContent(`Te avisaré cuando termine.`)
        )
        .addSeparatorComponents(s => s.setDivider(true))
        .addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL(timerImageUrl)
            )
        )
        .addSeparatorComponents(s => s.setDivider(true))
        .addActionRowComponents(row =>
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('cancel_timer')
                    .setLabel(moxi.translate('CANCEL', lang) || 'Cancelar')
                    .setStyle(ButtonStyle.Danger)
            )
        )
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c =>
            c.setContent(`${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`)
        );

    timerStorage.setTimer(guildId, channelId, userId, minutos, async () => {
        try {
            const done = new ContainerBuilder()
                .setAccentColor(Bot.AccentColor)
                .addTextDisplayComponents(c =>
                    c.setContent(`⏰ <@${userId}> ¡Tu temporizador de ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'} ha terminado!`)
                );

            await interaction.channel.send({
                components: [done],
                flags: MessageFlags.IsComponentsV2,
            });
        } catch (err) {
            try {
                if (logger && typeof logger.error === 'function') {
                    logger.error('timer modal: error enviando aviso de fin', err);
                } else {
                    console.error('[timer modal] Error enviando aviso de fin:', err);
                }
            } catch { }
        }
    });

    await interaction.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    return true;
};
