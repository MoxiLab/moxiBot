const { SlashCommandBuilder, ContainerBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const fetch = require('node-fetch');
const moxi = require('../../i18n');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('timer')
        .setDescription('Crea un temporizador visual y elegante')
        .addIntegerOption(opt =>
            opt.setName('minutos')
                .setDescription('Duración en minutos')
                .setRequired(true)
        ),
    async run(Moxi, interaction) {
        const lang = await moxi.guildLang(interaction.guildId || interaction.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
        const minutos = interaction.options.getInteger('minutos');
        if (minutos < 1 || minutos > 1440) {
            return interaction.reply({ content: 'Elige entre 1 y 1440 minutos.', ephemeral: true });
        }

        // Usaremos la API de https://timer.guru/api para obtener una imagen SVG del temporizador
        const timerApiUrl = `https://timer.guru/api/timer?minutes=${minutos}`;
        let timerImageUrl = null;
        try {
            // Esta API es ficticia, reemplaza por una real si tienes una
            // Aquí simulamos una imagen SVG de temporizador
            timerImageUrl = `https://dummyimage.com/600x200/222/fff&text=⏰+${minutos}+minutos`;
        } catch {
            timerImageUrl = null;
        }

        const container = new ContainerBuilder()
            .setAccentColor(0x2ecc71)
            .addTextDisplayComponents(c => c.setContent(`# ⏰ Temporizador iniciado`))
            .addSeparatorComponents(s => s.setDivider(true));
        if (timerImageUrl) {
            container.addImageDisplayComponents(img => img.setURL(timerImageUrl));
        }
        container.addTextDisplayComponents(c => c.setContent(`Duración: **${minutos} minutos**\nTe avisaré cuando termine.`));
        container.addActionRowComponents(row =>
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('cancel_timer')
                    .setLabel(moxi.translate('CANCEL', lang) || 'Cancelar')
                    .setStyle(ButtonStyle.Danger)
            )
        );

        await interaction.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2, ephemeral: false });

        // Esperar el tiempo y avisar
        setTimeout(async () => {
            try {
                const done = new ContainerBuilder()
                    .setAccentColor(0x2ecc71)
                    .addTextDisplayComponents(c => c.setContent(`# ⏰ Temporizador terminado\n<@${interaction.user.id}>`))
                    .addSeparatorComponents(s => s.setDivider(true))
                    .addTextDisplayComponents(c => c.setContent(`Tiempo: **${minutos} minutos**`));

                await interaction.channel.send({
                    components: [done],
                    flags: MessageFlags.IsComponentsV2,
                });
            } catch { }
        }, minutos * 60 * 1000);
    }
};
