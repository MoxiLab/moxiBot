const { EmbedBuilder } = require('discord.js');
const { Bot } = require('../../Config');
const { marriageCategory } = require('../../Util/commandCategories');
const {
    parseAnniversaryInput,
    createProposal,
    buildProposalMessage,
    getUserDoc,
} = require('../../Util/marriageCore');

module.exports = {
    name: 'marry',
    alias: ['marry', 'proposemarriage', 'pedirmatrimonio'],
    Category: marriageCategory,
    usage: 'marry @usuario [DD/MM/YYYY]',
    description: 'Enviar una propuesta de matrimonio.',
    cooldown: 0,

    async execute(Moxi, message, args) {
        const guildId = message.guildId || message.guild?.id;
        if (!guildId) return;

        const targetUser = message.mentions.users.first();
        if (!targetUser) {
            const doc = await getUserDoc(guildId, message.author.id);
            const spouseId = doc?.marriage?.spouse ? String(doc.marriage.spouse) : null;
            const marriageLine = spouseId ? `💍 <@${spouseId}>` : '💍 —';

            const embed = new EmbedBuilder()
                .setColor(Bot.AccentColor)
                .setTitle('💍 Matrimonios')
                .setDescription('¿Encontraste a alguien especial? Propónle matrimonio y hagan oficial su historia de amor. 💕')
                .addFields(
                    { name: 'Tu matrimonio', value: marriageLine, inline: false },
                    { name: 'Comando', value: '`-marry @user [DD/MM/YYYY]`', inline: false }
                );

            return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
        }

        const dateToken = args.find((t) => /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.test(String(t || '')));
        const parsed = parseAnniversaryInput(dateToken);
        if (!parsed.ok) {
            return message.reply({ content: parsed.message, allowedMentions: { repliedUser: false } });
        }

        const res = await createProposal({
            guildId,
            proposer: message.author,
            targetUser,
            anniversaryDate: parsed.date,
        });

        if (!res.ok) {
            if (res.alertSpouseId && message.channel) {
                await message.channel.send({
                    content: `🚨 <@${res.alertSpouseId}>, <@${message.author.id}> intentó proponer matrimonio a <@${targetUser.id}> estando casado/a.`,
                    allowedMentions: { users: [res.alertSpouseId] },
                }).catch(() => null);
            }
            return message.reply({ content: res.message, allowedMentions: { repliedUser: false } });
        }

        return message.reply(buildProposalMessage({
            proposerId: message.author.id,
            targetUserId: targetUser.id,
            anniversaryDate: parsed.date,
        }));
    },
};
