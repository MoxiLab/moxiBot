const { MessageFlags } = require('discord.js');
const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');
const moxi = require('../../i18n');
const afkStorage = require('../../Util/afkStorage');
const { buildAfkContainer, formatAfkTimestamp } = require('../../Util/afkRender');
const { resolveAfkGif } = require('../../Util/afkGif');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('afk')
        .setDescription('Set your AFK status with a message and scope')
        .addStringOption(option =>
            option
                .setName('message')
                .setDescription('What should others see when they mention you?')
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName('scope')
                .setDescription('Choose whether the AFK is global or only for this server')
                .addChoices(
                    { name: 'Server', value: 'guild' },
                    { name: 'Global', value: 'global' }
                )
                .setRequired(false)
        ),

    async run(Moxi, interaction) {
        const lang = await moxi.guildLang(interaction.guildId, process.env.DEFAULT_LANG || 'es-ES');
        if (!interaction.guildId) {
            return interaction.reply({ content: moxi.translate('GUILD_ONLY', lang), ephemeral: true });
        }
        const scope = interaction.options.getString('scope') || 'guild';
        const rawMessage = interaction.options.getString('message');
        const defaultMessage = moxi.translate('AFK_DEFAULT_MESSAGE', lang);
        const sanitizedMessage = rawMessage && rawMessage.trim()
            ? rawMessage.trim().slice(0, 300)
            : defaultMessage;

        const entry = await afkStorage.setAfk({
            userId: interaction.user.id,
            guildId: interaction.guildId,
            message: sanitizedMessage,
            scope,
        });

        const scopeKey = scope === 'global' ? 'AFK_SCOPE_GLOBAL' : 'AFK_SCOPE_GUILD';
        const lines = [
            moxi.translate(scopeKey, lang),
            moxi.translate('AFK_MESSAGE_LINE', lang, { message: entry.message }),
            moxi.translate('AFK_SINCE', lang, { since: formatAfkTimestamp(entry.createdAt, lang) }),
        ];

        const gifUrl = await resolveAfkGif(process.env.AFK_GIF_URL);
        const container = buildAfkContainer({
            title: moxi.translate('AFK_TITLE', lang),
            lines,
            gifUrl,
        });

        await interaction.reply({
            content: '',
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            ephemeral: true,
        });
    },
};
