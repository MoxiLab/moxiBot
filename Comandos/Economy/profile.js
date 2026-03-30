const moxi = require('../../i18n');
const { buildProfileMessage } = require('../../Util/profileView');
const { economyCategory } = require('../../Util/commandCategories');

module.exports = {
    name: 'profile',
    alias: ['perfil'],
    Category: economyCategory,
    usage: 'profile [@usuario]',
    description: 'Muestra un perfil completo del usuario',
    cooldown: 5,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message, args) {
        const guildId = message.guildId || message.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const target =
            message.mentions?.users?.first?.() ||
            (args?.[0] ? await Moxi.users.fetch(args[0]).catch(() => null) : null) ||
            message.author;

        const member = message.guild?.members?.cache?.get?.(target.id) || null;
        const payload = await buildProfileMessage({ guild: message.guild, guildId, lang, targetUser: target, targetMember: member, viewerId: message.author.id, page: 'overview' });
        return message.reply(payload);
    },
};