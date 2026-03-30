const { marriageCategory } = require('../../Util/commandCategories');
const { getUserDoc, formatDateTag, parseAnniversaryInput, changeAnniversary } = require('../../Util/marriageCore');

module.exports = {
    name: 'anniversary',
    alias: ['anniversary', 'aniversario'],
    Category: marriageCategory,
    usage: 'anniversary [set DD/MM/YYYY | @usuario]',
    description: 'Ver fecha de aniversario y tiempo juntos.',
    cooldown: 0,

    async execute(Moxi, message, args) {
        const guildId = message.guildId || message.guild?.id;
        if (!guildId) return;

        // Subcomando: -aniversario set DD/MM/YYYY
        const sub = String(args?.[0] || '').toLowerCase();
        if (sub === 'set') {
            const dateToken = args[1];
            const parsed = parseAnniversaryInput(dateToken);
            if (!parsed.ok) {
                return message.reply({ content: parsed.message || 'Usa: `-aniversario set DD/MM/YYYY`', allowedMentions: { repliedUser: false } });
            }
            if (!parsed.date) {
                return message.reply({ content: 'Proporciona una fecha. Usa: `-aniversario set DD/MM/YYYY`', allowedMentions: { repliedUser: false } });
            }
            const res = await changeAnniversary({ guildId, userId: message.author.id, newDate: parsed.date });
            if (!res.ok) {
                return message.reply({ content: res.message, allowedMentions: { repliedUser: false } });
            }
            return message.reply({
                content: `Aniversario actualizado a ${formatDateTag(parsed.date)} para ti y <@${res.spouseId}>.`,
                allowedMentions: { repliedUser: false },
            });
        }

        const target = message.mentions.users.first() || message.author;
        const doc = await getUserDoc(guildId, target.id);
        if (!doc?.marriage?.spouse) {
            return message.reply({ content: `<@${target.id}> no esta casado/a.`, allowedMentions: { repliedUser: false } });
        }

        const ann = doc.marriage.anniversaryDate ? new Date(doc.marriage.anniversaryDate) : null;
        if (!ann || Number.isNaN(ann.getTime())) {
            return message.reply({ content: 'No hay aniversario registrado.', allowedMentions: { repliedUser: false } });
        }

        const now = new Date();
        const next = new Date(ann);
        next.setFullYear(now.getFullYear());
        if (next < now) next.setFullYear(now.getFullYear() + 1);

        const years = Math.max(0, now.getFullYear() - ann.getFullYear());
        const days = Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 86400000));

        // Hito social: registrar consultas de aniversario del autor
        if (target.id === message.author.id) {
            doc.socialProgress = doc.socialProgress || {};
            doc.socialProgress.anniversariesCelebrated = Math.max(0, Number(doc.socialProgress.anniversariesCelebrated || 0)) + 1;
            doc.socialProgress.lastAnniversaryAt = now;
            doc.markModified('socialProgress');
            await doc.save().catch(() => null);
        }

        return message.reply({
            content: `Aniversario de <@${target.id}>\nFecha: ${formatDateTag(ann)}\nAnios juntos: ${years}\nProximo aniversario en: ${days} dia(s)`,
            allowedMentions: { repliedUser: false },
        });
    },
};
