const { funCategory } = require('../../Util/commandCategories');
const User = require('../../Models/UserSchema');
const { computeSocialCompatibility } = require('../../Util/socialCompatibility');
const { getGlobalUserDoc } = require('../../Util/relationshipCore');

module.exports = {
    name: 'compat',
    alias: ['compat', 'compatibilidad', 'matchsocial'],
    Category: funCategory,
    usage: 'compat @usuario',
    description: 'Calcula compatibilidad social entre dos usuarios.',
    cooldown: 3,

    async execute(Moxi, message) {
        const guildId = message.guildId || message.guild?.id;
        if (!guildId) return;

        const target = message.mentions?.users?.first?.();
        if (!target) {
            return message.reply({
                content: 'Menciona a un usuario.\nUso: `-compat @usuario`',
                allowedMentions: { repliedUser: false }
            });
        }

        if (target.id === message.author.id) {
            return message.reply({ content: 'No puedes calcular compatibilidad contigo mismo/a.', allowedMentions: { repliedUser: false } });
        }

        const [docA, docB] = await Promise.all([
            getGlobalUserDoc(message.author.id, message.author.username),
            getGlobalUserDoc(target.id, target.username),
        ]);

        const result = computeSocialCompatibility({
            guildId,
            userAId: message.author.id,
            userBId: target.id,
            docA,
            docB,
        });

        const now = new Date();
        await User.updateOne(
            { guildID: 'GLOBAL', userID: String(message.author.id) },
            {
                $inc: { 'socialProgress.compatChecks': 1 },
                $set: {
                    username: message.author.username,
                    'socialProgress.lastCompatibilityAt': now,
                },
                $setOnInsert: {
                    guildID: 'GLOBAL',
                    userID: String(message.author.id),
                },
            },
            { upsert: true }
        );

        const reasonsText = result.reasons.length ? `\nBonos: ${result.reasons.join(' · ')}` : '';

        return message.reply({
            content: `💞 Compatibilidad entre <@${message.author.id}> y <@${target.id}>: **${result.score}%** (${result.tier})\nBase: ${result.base}% · Bonus: +${result.bonus}%${reasonsText}`,
            allowedMentions: { repliedUser: false }
        });
    },
};
