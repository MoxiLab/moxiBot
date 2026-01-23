
const { ContainerBuilder, ButtonBuilder, ButtonStyle, MessageFlags, MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { Bot } = require('../../Config');
const { isFlagEnabled } = require('../../Util/debug');
const timerStorage = require('../../Util/timerStorage');

function buildListContainer(Moxi, message, allTimers, lang = 'es-ES') {
    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(c =>
            c.setContent(`⏰ **Lista de temporizadores activos**`)
        )
        .addSeparatorComponents(s => s.setDivider(true));
    for (const t of allTimers) {
        const minLeft = Math.max(0, Math.floor((t.endTime - Date.now()) / 60000));
        const secLeft = Math.max(0, Math.floor(((t.endTime - Date.now()) % 60000) / 1000));
        let guildName = t.guildId;
        let channelName = t.channelId;
        let userMention = `<@${t.userId}>`;
        try {
            const guild = message.client?.guilds?.cache?.get?.(t.guildId);
            if (guild) guildName = guild.name;
            const channel = guild?.channels?.cache?.get?.(t.channelId);
            if (channel) channelName = channel.name;
        } catch { }
        container.addTextDisplayComponents(c =>
            c.setContent(
                `**Servidor:** ${guildName}  \n` +
                `**Canal:** <#${t.channelId}>  \n` +
                `**Usuario:** ${userMention}  \n` +
                `**⏳ Quedan:** ${minLeft} min ${secLeft} s\n`
            )
        );
        container.addActionRowComponents(row =>
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`cancel_timer_${t.guildId}_${t.channelId}`)
                    .setLabel(moxi.translate('CANCEL', lang) || 'Cancelar')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId(`refresh_timer_list_${t.guildId}_${t.channelId}`)
                    .setLabel(moxi.translate('REFRESH', lang) || 'Refrescar')
                    .setStyle(ButtonStyle.Secondary),
                new ButtonBuilder()
                    .setLabel(moxi.translate('GO_TO_SERVER', lang) || 'Ir al servidor')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://discord.com/channels/${t.guildId}`)
            )
        );
        container.addSeparatorComponents(s => s.setDivider(false));
    }
    container.addSeparatorComponents(s => s.setDivider(true));
    container.addTextDisplayComponents(c =>
        c.setContent(`${EMOJIS.numbers || '#️⃣'} Total: **${allTimers.length}** temporizadores activos.`)
    );
    container.addSeparatorComponents(s => s.setDivider(true));
    container.addTextDisplayComponents(c =>
        c.setContent(`${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`)
    );
    return container;
}

module.exports = {
    name: 'timer',
    alias: ['temporizador', 'temporizador', 'temporizador'],
    description: lang => 'Crea y consulta temporizadores visuales',
    usage: 'timer [minutos]',
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_HERRAMIENTAS', lang);
    },
    cooldown: 5,
    buildListContainer,
    async execute(Moxi, message, args) {
        const TIMER_DEBUG = isFlagEnabled('timer');
        const lang = await moxi.guildLang(message.guildId || message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
        // Mostrar lista de temporizadores activos
        if (TIMER_DEBUG) console.log('[TIMER_DEBUG] Comando timer ejecutado con args:', args);
        if (args[0] && args[0].toLowerCase() === 'list') {
            const allTimers = timerStorage.getAllTimers();
            if (TIMER_DEBUG) console.log('[TIMER_DEBUG] Lista de temporizadores:', allTimers);
            if (allTimers.length === 0) {
                if (message && message.reply) {
                    return message.reply('No hay temporizadores activos en el bot.');
                } else if (message && message.send) {
                    return message.send('No hay temporizadores activos en el bot.');
                }
            }
            const container = buildListContainer(Moxi, message, allTimers, lang);
            if (message && message.reply) {
                return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
            } else if (message && message.send) {
                return message.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
            }
        }
        const guildId = message.guild?.id;
        const channelId = message.channel?.id;
        const userId = message.author?.id;

        // Mostrar cuántos temporizadores hay activos en el bot
        const allTimers = timerStorage.getAllTimers();
        const totalTimers = allTimers.length;
        if (TIMER_DEBUG) console.log('[TIMER_DEBUG] Total temporizadores activos:', totalTimers);

        // Si hay un temporizador activo en este canal, mostrar cuánto falta
        const current = timerStorage.getTimer(guildId, channelId);
        if (TIMER_DEBUG) console.log('[TIMER_DEBUG] Temporizador actual en canal:', current);
        if (!args[0] || args[0].toLowerCase() === 'help' || args[0] === '?') {
            if (args[0] && (args[0].toLowerCase() === 'help' || args[0] === '?')) {
                const helpContainer = new ContainerBuilder()
                    .setAccentColor(Bot.AccentColor)
                    .addTextDisplayComponents(c =>
                        c.setContent(`# ⏰ Ayuda del temporizador`)
                    )
                    .addSeparatorComponents(s => s.setDivider(true))
                    .addTextDisplayComponents(c =>
                        c.setContent(
                            `• **.timer [minutos]** — Inicia un temporizador de la cantidad indicada de minutos en el canal.\n` +
                            `• **.timer** — Muestra el estado del temporizador actual en el canal.\n` +
                            `• **.timer list** — Muestra la lista de todos los temporizadores activos en el bot.\n` +
                            `• **.timer help** o **.timer ?** — Muestra esta ayuda.\n\n` +
                            `Puedes usar el botón visual para crear un temporizador fácilmente.`
                        )
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
                return message.reply({ components: [helpContainer], flags: MessageFlags.IsComponentsV2 });
            }
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
            return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }

        // Si el argumento es un número, crear el temporizador
        const minutos = parseInt(args[0], 10);
        if (isNaN(minutos) || minutos < 1 || minutos > 1440) {
            return message.reply('Elige una cantidad de minutos entre 1 y 1440. Ejemplo: .timer 10');
        }
        if (current) {
            return message.reply('Ya hay un temporizador activo en este canal. Espera a que termine o cancélalo antes de crear uno nuevo.');
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
            if (TIMER_DEBUG) console.log('[TIMER_DEBUG] Temporizador finalizado para canal:', channelId);
            try {
                const done = new ContainerBuilder()
                    .setAccentColor(Bot.AccentColor)
                    .addTextDisplayComponents(c =>
                        c.setContent(`⏰ <@${userId}> ¡Tu temporizador de ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'} ha terminado!`)
                    );

                await message.channel.send({
                    components: [done],
                    flags: MessageFlags.IsComponentsV2,
                });
            } catch (err) {
                if (TIMER_DEBUG) console.error('[TIMER_DEBUG] Error enviando aviso de fin:', err);
            }
        });

        await message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
    }
};
