const { MessageFlags } = require('discord.js');
const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');
const { funCategory } = require('../../Util/commandCategories');
const User = require('../../Models/UserSchema');
const { computeSocialCompatibility } = require('../../Util/socialCompatibility');
const { getGlobalUserDoc } = require('../../Util/relationshipCore');

module.exports = {
    cooldown: 3,
    Category: funCategory,
    data: new SlashCommandBuilder()
        .setName('compat')
        .setDescription('Calcula compatibilidad social con otro usuario.')
        .addUserOption((opt) =>
            opt.setName('user')
                .setDescription('Usuario objetivo')
                .setRequired(true)
        )
        .setDMPermission(false),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const target = interaction.options.getUser('user', true);

        if (target.id === interaction.user.id) {
            return interaction.reply({ content: 'No puedes calcular compatibilidad contigo mismo/a.', flags: MessageFlags.Ephemeral });
        }

        const [docA, docB] = await Promise.all([
            getGlobalUserDoc(interaction.user.id, interaction.user.username),
            getGlobalUserDoc(target.id, target.username),
        ]);

        const result = computeSocialCompatibility({
            guildId,
            userAId: interaction.user.id,
            userBId: target.id,
            docA,
            docB,
        });

        const now = new Date();
        await User.updateOne(
            { guildID: 'GLOBAL', userID: String(interaction.user.id) },
            {
                $inc: { 'socialProgress.compatChecks': 1 },
                $set: {
                    username: interaction.user.username,
                    'socialProgress.lastCompatibilityAt': now,
                },
                $setOnInsert: {
                    guildID: 'GLOBAL',
                    userID: String(interaction.user.id),
                },
            },
            { upsert: true }
        );

        const reasonsText = result.reasons.length ? `\nBonos: ${result.reasons.join(' · ')}` : '';

        return interaction.reply({
            content: `💞 Compatibilidad entre <@${interaction.user.id}> y <@${target.id}>: **${result.score}%** (${result.tier})\nBase: ${result.base}% · Bonus: +${result.bonus}%${reasonsText}`,
            allowedMentions: { repliedUser: false }
        });
    },
};
