const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');
const moxi = require('../../i18n');
const { buildProfileMessage } = require('../../Util/profileView');

module.exports = {
    cooldown: 0,
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
    },
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Muestra un perfil completo del usuario')
        .addUserOption((opt) =>
            opt
                .setName('usuario')
                .setDescription('Usuario (opcional)')
                .setRequired(false)
        ),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const target = interaction.options.getUser('usuario') || interaction.user;
        const member = interaction.guild?.members?.cache?.get?.(target.id)
            || await interaction.guild?.members?.fetch?.(target.id).catch(() => null)
            || null;
        const payload = await buildProfileMessage({ guild: interaction.guild, guildId, lang, targetUser: target, targetMember: member, viewerId: interaction.user.id, page: 'overview' });
        return interaction.reply(payload);
    },
};
