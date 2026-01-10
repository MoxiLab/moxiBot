const { PermissionsBitField: { Flags }, ApplicationCommandOptionType, ContainerBuilder, MessageFlags } = require('discord.js');
const LevelSystem = require('../../Global/Helpers/LevelSystem');
const { Bot } = require('../../Config');
const debugHelper = require('../../Util/debugHelper');

module.exports = {
    name: 'setlevel',
    alias: ['set-level', 'nivel'],
    description: 'Establece el nivel de un usuario',
    usage: 'setlevel <usuario> <nivel>',
    category: 'Admin',
    cooldown: 5,

    permissions: {
        user: [Flags.ManageRoles],
        bot: [Flags.SendMessages],
        role: []
    },

    command: {
        prefix: true,
        slash: true,
        flags: 64,
        options: [
            {
                name: 'usuario',
                description: 'Usuario al que establecer nivel',
                type: ApplicationCommandOptionType.User,
                required: true
            },
            {
                name: 'nivel',
                description: 'Nivel a establecer',
                type: ApplicationCommandOptionType.Integer,
                minValue: 1,
                maxValue: 1000,
                required: true
            }
        ]
    },

    execute: async (Moxi, message, args) => {
        try {
            debugHelper.log('setlevel', 'execute start', {
                guildId: message.guildId,
                targetArg: args[0] || null,
                levelArg: args[1] || null
            });
            const target = message.mentions.users.first() || await Moxi.users.fetch(args[0]).catch(() => null);
            const newLevel = parseInt(args[1]);

            if (!target) {
                debugHelper.warn('setlevel', 'target missing', { guildId: message.guildId, args: args.slice(0, 2) });
                const container = new ContainerBuilder().setAccentColor(Bot.AccentColor)
                    .addTextDisplayComponents(c => c.setContent('# ❌ Usuario no encontrado.'));
                return message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
            }

            if (isNaN(newLevel) || newLevel < 1 || newLevel > 1000) {
                debugHelper.warn('setlevel', 'invalid level', { guildId: message.guildId, value: args[1] });
                const container = new ContainerBuilder().setAccentColor(Bot.AccentColor)
                    .addTextDisplayComponents(c => c.setContent('# ❌ El nivel debe estar entre 1 y 1000.'));
                return message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
            }

            const guildID = message.guildId;
            const user = await LevelSystem.setLevel(guildID, target.id, newLevel, target.username);

            if (!user) {
                const container = new ContainerBuilder().setAccentColor(Bot.AccentColor)
                    .addTextDisplayComponents(c => c.setContent('# ❌ Error al establecer el nivel.'));
                return message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
            }

            const container = new ContainerBuilder()
                .setAccentColor(Bot.AccentColor)
                .addTextDisplayComponents(c => c.setContent('# ✅ Nivel Establecido'))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(`Se ha establecido el nivel de ${target} a **${newLevel}**`))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(
                    `Usuario: ${target} (${target.id})\n` +
                    `Nuevo Nivel: ${newLevel}\n` +
                    `XP Actual: 0`
                ));

            await message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
            debugHelper.log('setlevel', 'level set', { guildId: message.guildId, userId: target.id, level: newLevel });

        } catch (error) {
            debugHelper.error('setlevel', 'execute error', { guildId: message.guildId, error });
            console.error('[SetLevel Command] Error:', error);
            const container = new ContainerBuilder().setAccentColor(Bot.AccentColor)
                .addTextDisplayComponents(c => c.setContent('# ❌ Error al establecer el nivel.'));
            message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
        }
    },

    interactionRun: async (client, interaction) => {
        try {
            debugHelper.log('setlevel', 'interaction start', {
                guildId: interaction.guildId,
                targetId: interaction.options.getUser('usuario')?.id,
                levelArg: interaction.options.getInteger('nivel')
            });
            await interaction.deferReply();

            const target = interaction.options.getUser('usuario');
            const newLevel = interaction.options.getInteger('nivel');
            const guildID = interaction.guildId;

            const user = await LevelSystem.setLevel(guildID, target.id, newLevel, target.username);

            if (!user) {
                debugHelper.warn('setlevel', 'interaction target failed', { guildId: guildID, targetId: target.id, level: newLevel });
                const container = new ContainerBuilder().setAccentColor(Bot.AccentColor)
                    .addTextDisplayComponents(c => c.setContent('# ❌ Error al establecer el nivel.'));
                return interaction.editReply({ content: '', components: [container], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
            }

            const container = new ContainerBuilder()
                .setAccentColor(Bot.AccentColor)
                .addTextDisplayComponents(c => c.setContent('# ✅ Nivel Establecido'))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(`Se ha establecido el nivel de ${target} a **${newLevel}**`))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(
                    `Usuario: ${target} (${target.id})\n` +
                    `Nuevo Nivel: ${newLevel}\n` +
                    `XP Actual: 0`
                ));

            await interaction.editReply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
            debugHelper.log('setlevel', 'interaction level set', { guildId: guildID, userId: target.id, level: newLevel });

        } catch (error) {
            debugHelper.error('setlevel', 'interaction error', { guildId: interaction.guildId, error });
            console.error('[SetLevel Command] Error:', error);
            const container = new ContainerBuilder().setAccentColor(Bot.AccentColor)
                .addTextDisplayComponents(c => c.setContent('# ❌ Error al establecer el nivel.'));
            interaction.editReply({ content: '', components: [container], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
        }
    }
};

