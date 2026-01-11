
const { ContainerBuilder, ButtonBuilder, ButtonStyle, MessageFlags, MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { Bot } = require('../../Config');
const timerStorage = require('../../Util/timerStorage');

module.exports = {
    name: 'timer',
    alias: ['temporizador', 'temporizador', 'temporizador'],
    description: lang => 'Crea y consulta temporizadores visuales',
    usage: 'timer [nuevo <minutos>]',
    Category: lang => 'Utilidad',
    cooldown: 5,
    async execute(Moxi, message, args) {
        const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
        const guildId = message.guild?.id;
        const channelId = message.channel?.id;
        const userId = message.author?.id;

        // Mostrar cuántos temporizadores hay activos en el bot
        const allTimers = timerStorage.getAllTimers();
        const totalTimers = allTimers.length;

        // Si hay un temporizador activo en este canal, mostrar cuánto falta
        const current = timerStorage.getTimer(guildId, channelId);
        if (!args[0] || args[0].toLowerCase() !== 'nuevo') {
            let desc = '';
            if (current) {
                const msLeft = current.endTime - Date.now();
                const minLeft = Math.max(0, Math.floor(msLeft / 60000));
                const secLeft = Math.max(0, Math.floor((msLeft % 60000) / 1000));
                desc = `⏳ Hay un temporizador activo en este canal.\nQuedan **${minLeft} min ${secLeft} s** para que termine.`;
            } else {
                desc = 'No hay temporizador activo en este canal.';
            }
            desc += `\n\n${EMOJIS.numbers || '#️⃣'} Temporizadores activos en el bot: **${totalTimers}**`;

            const container = new ContainerBuilder()
                .setAccentColor(Bot.AccentColor)
                .addTextDisplayComponents(c =>
                    c.setContent(`# ⏰ Temporizador`)
                )
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c =>
                    c.setContent(desc)
                )
                .addSeparatorComponents(s => s.setDivider(true))
                .addActionRowComponents(row =>
                    row.addComponents(
                        new ButtonBuilder()
                            .setCustomId('nuevo_timer')
                            .setLabel('Nuevo temporizador')
                            .setStyle(ButtonStyle.Primary)
                    )
                )
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c =>
                    c.setContent(`${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`)
                );
            return message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
        }

        // Subcomando: nuevo <minutos> o desde <minutos>
        let minutos = null;
        let modo = null;
        if (args[0].toLowerCase() === 'nuevo') {
            minutos = parseInt(args[1], 10);
            modo = 'nuevo';
        } else if (args[0].toLowerCase() === 'desde') {
            minutos = parseInt(args[1], 10);
            modo = 'desde';
        }
        if (isNaN(minutos) || minutos < 1 || minutos > 1440) {
            return message.reply('Elige una cantidad de minutos entre 1 y 1440. Ejemplo: .timer nuevo 10 o .timer desde 5');
        }
        if (current) {
            return message.reply('Ya hay un temporizador activo en este canal. Espera a que termine o cancélalo antes de crear uno nuevo.');
        }

        let startTime = Date.now();
        let refMsg = null;
        if (modo === 'desde') {
            // Buscar el último mensaje del usuario en el canal (excluyendo el comando actual)
            const fetched = await message.channel.messages.fetch({ limit: 10 });
            refMsg = fetched.filter(m => m.author.id === userId && m.id !== message.id).first();
            if (refMsg) {
                startTime = refMsg.createdTimestamp;
            }
        }
        const endTime = startTime + minutos * 60 * 1000;
        const msToWait = Math.max(0, endTime - Date.now());

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
                        .setLabel('Cancelar')
                        .setStyle(ButtonStyle.Danger)
                )
            )
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(c =>
                c.setContent(`${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`)
            );

        // Guardar el temporizador (para consistencia, aunque el timeout real es custom)
        timerStorage.setTimer(guildId, channelId, userId, minutos, async () => {
            try {
                await message.channel.send(`⏰ ¡Tu temporizador de **${minutos} minutos** ha terminado!`);
            } catch { }
        });

        setTimeout(async () => {
            try {
                await message.channel.send(`⏰ ¡Tu temporizador de **${minutos} minutos** ha terminado!`);
            } catch { }
        }, msToWait);

        await message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
    }
};
