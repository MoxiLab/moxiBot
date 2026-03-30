const { EmbedBuilder } = require('discord.js');
const { Bot } = require('../../Config');
const { marriageCategory } = require('../../Util/commandCategories');
const User = require('../../Models/UserSchema');
const {
    RELATIONSHIP_TYPES,
    resolveType,
    getGlobalUserDoc,
    addRelationship,
} = require('../../Util/relationshipCore');

const WARNING_RELATION_TYPES = new Set(['mejor']);
const INFIDELITY_RELATION_TYPES = new Set(['crush']);

module.exports = {
    name: 'relate',
    alias: ['relate', 'relacion', 'vincular'],
    Category: marriageCategory,
    usage: 'relate @usuario [tipo]',
    description: 'Agregar a alguien como amigo/a, hermano/a, crush u otro tipo de relación.',
    cooldown: 3,

    async execute(Moxi, message, args) {
        const guildId = message.guildId || message.guild?.id;
        if (!guildId) return;

        const target = message.mentions.users.first();

        if (!target) {
            const typesList = Object.entries(RELATIONSHIP_TYPES)
                .map(([key, { emoji, label }]) => `${emoji} \`${key}\` — ${label}`)
                .join('\n');

            const embed = new EmbedBuilder()
                .setColor(Bot.AccentColor)
                .setTitle('💛 Relaciones')
                .setDescription('Agrega a alguien especial como amigo/a, hermano/a, crush u otro vínculo.')
                .addFields(
                    { name: 'Uso', value: '`-relate @usuario [tipo]`', inline: false },
                    { name: 'Tipos disponibles', value: typesList, inline: false }
                );
            return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
        }

        if (target.id === message.author.id) {
            return message.reply({ content: 'No puedes agregarte a ti mismo/a.', allowedMentions: { repliedUser: false } });
        }

        if (target.bot) {
            return message.reply({ content: 'No puedes agregar bots como relación.', allowedMentions: { repliedUser: false } });
        }

        const typeInput = args.find((a) => !a.startsWith('<') && !a.startsWith('@'));
        const typeKey = resolveType(typeInput);

        if (!typeKey) {
            const validKeys = Object.keys(RELATIONSHIP_TYPES).join(', ');
            return message.reply({
                content: `Tipo inválido. Tipos disponibles: \`${validKeys}\``,
                allowedMentions: { repliedUser: false }
            });
        }

        const doc = await getGlobalUserDoc(message.author.id, message.author.username);

        const spouseId = doc?.marriage?.spouse ? String(doc.marriage.spouse) : null;
        const isMarried = Boolean(spouseId);
        const targetIsSpouse = spouseId && String(target.id) === spouseId;

        if (isMarried && !targetIsSpouse && INFIDELITY_RELATION_TYPES.has(typeKey)) {
            await message.channel.send({
                content: `🚨 <@${spouseId}>, <@${message.author.id}> intentó registrar a <@${target.id}> como ${RELATIONSHIP_TYPES[typeKey]?.label || typeKey}. Esto se considera infidelidad.`,
                allowedMentions: { users: [spouseId] },
            }).catch(() => null);

            return message.reply({
                content: `Estás casado/a con <@${spouseId}> y ese tipo de relación se considera infidelidad. Acción bloqueada.`,
                allowedMentions: { repliedUser: false }
            });
        }

        if (isMarried && !targetIsSpouse && WARNING_RELATION_TYPES.has(typeKey)) {
            await message.channel.send({
                content: `⚠️ <@${spouseId}>, aviso: <@${message.author.id}> está rozando el límite al registrar a <@${target.id}> como ${RELATIONSHIP_TYPES[typeKey]?.label || typeKey}.`,
                allowedMentions: { users: [spouseId] },
            }).catch(() => null);
        }

        const res = await addRelationship(doc, target.id, typeKey);
        if (!res.ok) {
            return message.reply({ content: res.message, allowedMentions: { repliedUser: false } });
        }

        const { emoji, label } = RELATIONSHIP_TYPES[typeKey];
        return message.reply({
            content: `${emoji} Agregaste a <@${target.id}> como **${label}**.`,
            allowedMentions: { repliedUser: false }
        });
    },
};
