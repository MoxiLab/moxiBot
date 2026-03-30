const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');
const moxi = require('../../i18n');
const { parseBirthdayInput, parseProfileNumber, updateUserProfile } = require('../../Util/profileSettings');

module.exports = {
    cooldown: 0,
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
    },
    data: new SlashCommandBuilder()
        .setName('setprofile')
        .setDescription('Edita los campos personales de tu perfil')
        .addStringOption((opt) =>
            opt
                .setName('frase')
                .setDescription('Frase del perfil')
                .setRequired(false)
        )
        .addStringOption((opt) =>
            opt
                .setName('cumpleaños')
                .setDescription('Cumpleaños DD/MM o off')
                .setRequired(false)
        )
        .addIntegerOption((opt) =>
            opt
                .setName('pats')
                .setDescription('Cantidad de pats del perfil')
                .setRequired(false)
        )
        .addIntegerOption((opt) =>
            opt
                .setName('carisma')
                .setDescription('Carisma del perfil')
                .setRequired(false)
        )
        .addIntegerOption((opt) =>
            opt
                .setName('muertes')
                .setDescription('Muertes del perfil')
                .setRequired(false)
        ),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const phrase = interaction.options.getString('frase');
        const birthdayRaw = interaction.options.getString('cumpleaños');
        const pats = interaction.options.getInteger('pats');
        const charisma = interaction.options.getInteger('carisma');
        const deaths = interaction.options.getInteger('muertes');

        if (phrase == null && birthdayRaw == null && pats == null && charisma == null && deaths == null) {
            return interaction.reply({ content: 'Pon una frase, un cumpleaños o algun stat editable.', ephemeral: true });
        }

        const updates = {};
        if (typeof phrase === 'string') {
            updates.phrase = phrase;
        }

        if (typeof birthdayRaw === 'string') {
            if (birthdayRaw.toLowerCase() === 'off' || birthdayRaw.toLowerCase() === 'reset') {
                updates.birthday = null;
            } else {
                const parsed = parseBirthdayInput(birthdayRaw);
                if (!parsed.ok) {
                    return interaction.reply({ content: parsed.message, ephemeral: true });
                }
                updates.birthday = parsed.value;
            }
        }

        if (pats != null) {
            const parsed = parseProfileNumber(String(pats), 'Pats');
            if (!parsed.ok) return interaction.reply({ content: parsed.message, ephemeral: true });
            updates.pats = parsed.value;
        }

        if (charisma != null) {
            const parsed = parseProfileNumber(String(charisma), 'Carisma');
            if (!parsed.ok) return interaction.reply({ content: parsed.message, ephemeral: true });
            updates.charisma = parsed.value;
        }

        if (deaths != null) {
            const parsed = parseProfileNumber(String(deaths), 'Muertes');
            if (!parsed.ok) return interaction.reply({ content: parsed.message, ephemeral: true });
            updates.deaths = parsed.value;
        }

        const doc = await updateUserProfile(guildId, interaction.user, updates);
        const lines = [];
        if (typeof phrase === 'string') lines.push(`Frase: ${doc.profile?.phrase || 'Sin frase'}`);
        if (typeof birthdayRaw === 'string') {
            const birthday = doc.profile?.birthday;
            const value = birthday?.day && birthday?.month
                ? `${String(birthday.day).padStart(2, '0')}-${String(birthday.month).padStart(2, '0')}`
                : 'No configurado';
            lines.push(`Cumpleaños: ${value}`);
        }
        if (pats != null) lines.push(`Pats: ${doc.profile?.stats?.pats ?? 0}`);
        if (charisma != null) lines.push(`Carisma: ${doc.profile?.stats?.charisma ?? 0}`);
        if (deaths != null) lines.push(`Muertes: ${doc.profile?.stats?.deaths ?? 0}`);

        return interaction.reply({
            content: `Perfil actualizado.\n${lines.join('\n')}`,
            ephemeral: true,
        });
    },
};