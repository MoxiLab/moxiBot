const { ChatInputCommandBuilder: SlashCommandBuilder, ApplicationCommandOptionType } = require('discord.js');
const moxi = require('../../i18n');

const rankCmd = require('../../Comandos/Utiility/Rank');

module.exports = {
    cooldown: 0,
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_HERRAMIENTAS', lang);
    },
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Muestra tu tarjeta de rango actual')
        .addUserOptions((opt) =>
            opt
                .setName('usuario')
                .setDescription('Usuario para ver el rango (opcional)')
                .setRequired(false)
        ),

    async run(Moxi, interaction) {
        // Reusar la implementación existente (interactionRun)
        if (typeof rankCmd?.interactionRun === 'function') {
            return rankCmd.interactionRun(Moxi, interaction);
        }
        // fallback: si cambia la estructura
        if (typeof rankCmd?.run === 'function') {
            return rankCmd.run(Moxi, interaction);
        }
        throw new Error('rank: no hay handler de interacción disponible');
    },
};
