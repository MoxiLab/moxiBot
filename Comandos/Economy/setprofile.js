const moxi = require('../../i18n');
const { economyCategory } = require('../../Util/commandCategories');
const { parseBirthdayInput, parseProfileNumber, updateUserProfile } = require('../../Util/profileSettings');

module.exports = {
    name: 'setprofile',
    alias: ['perfilset', 'editprofile'],
    Category: economyCategory,
    usage: 'setprofile frase <texto> | setprofile cumpleaños <DD/MM|off> | setprofile pats|carisma|muertes <numero>',
    description: 'Edita tu frase, cumpleaños y stats sociales del perfil',
    cooldown: 3,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message, args) {
        const guildId = message.guildId || message.guild?.id;
        const field = String(args?.[0] || '').trim().toLowerCase();
        const value = args?.slice(1).join(' ').trim() || '';

        if (!field || !['frase', 'phrase', 'cumpleaños', 'birthday', 'pats', 'carisma', 'charisma', 'muertes', 'deaths'].includes(field)) {
            return message.reply({
                content: 'Usa: setprofile frase <texto> | setprofile cumpleaños <DD/MM|off> | setprofile pats|carisma|muertes <numero>',
                allowedMentions: { repliedUser: false },
            });
        }

        if (field === 'frase' || field === 'phrase') {
            if (!value) {
                return message.reply({ content: 'Escribe la frase que quieres guardar.', allowedMentions: { repliedUser: false } });
            }

            const doc = await updateUserProfile(guildId, message.author, { phrase: value });
            return message.reply({
                content: `Tu frase del perfil ahora es: ${doc.profile?.phrase || 'Sin frase'}`,
                allowedMentions: { repliedUser: false },
            });
        }

        const statLabels = {
            pats: 'Pats',
            carisma: 'Carisma',
            charisma: 'Carisma',
            muertes: 'Muertes',
            deaths: 'Muertes',
        };

        if (statLabels[field]) {
            const parsedNumber = parseProfileNumber(value, statLabels[field]);
            if (!parsedNumber.ok) {
                return message.reply({ content: parsedNumber.message, allowedMentions: { repliedUser: false } });
            }

            const updateKey = field === 'carisma' ? 'charisma' : (field === 'muertes' ? 'deaths' : field);
            const doc = await updateUserProfile(guildId, message.author, { [updateKey]: parsedNumber.value });
            const currentValue = updateKey === 'pats'
                ? doc.profile?.stats?.pats
                : updateKey === 'charisma'
                    ? doc.profile?.stats?.charisma
                    : doc.profile?.stats?.deaths;

            return message.reply({
                content: `${statLabels[field]} ahora es ${currentValue ?? 0}.`,
                allowedMentions: { repliedUser: false },
            });
        }

        if (value.toLowerCase() === 'off' || value.toLowerCase() === 'reset') {
            await updateUserProfile(guildId, message.author, { birthday: null });
            return message.reply({ content: 'Tu cumpleaños fue eliminado del perfil.', allowedMentions: { repliedUser: false } });
        }

        const parsed = parseBirthdayInput(value);
        if (!parsed.ok) {
            return message.reply({ content: parsed.message, allowedMentions: { repliedUser: false } });
        }

        await updateUserProfile(guildId, message.author, { birthday: parsed.value });
        return message.reply({ content: `Tu cumpleaños del perfil ahora es ${value.replace('/', '-')}.`, allowedMentions: { repliedUser: false } });
    },
};