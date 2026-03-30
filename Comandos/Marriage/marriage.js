const { MessageFlags, EmbedBuilder } = require('discord.js');
const moxi = require('../../i18n');
const { marriageCategory } = require('../../Util/commandCategories');
const { Bot } = require('../../Config');
const User = require('../../Models/UserSchema');
const { buildProposalMessage } = require('../../Util/marriageCore');

function formatDateTag(dateLike) {
    if (!dateLike) return '-';
    const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
    if (Number.isNaN(d.getTime())) return '-';
    return `<t:${Math.floor(d.getTime() / 1000)}:F>`;
}

function parseAnniversaryInput(input) {
    if (!input) return { ok: true, date: null };
    const text = String(input).trim();
    const m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return { ok: false, message: 'Formato invalido. Usa DD/MM/YYYY.' };

    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]);
    const date = new Date(year, month - 1, day);

    const valid = date.getFullYear() === year && (date.getMonth() + 1) === month && date.getDate() === day;
    if (!valid) return { ok: false, message: 'Fecha invalida.' };
    if (date.getTime() > Date.now()) return { ok: false, message: 'La fecha del aniversario no puede estar en el futuro.' };
    return { ok: true, date };
}

function buildStatusEmbed(targetUser, spouseUser, marriage) {
    const ann = marriage?.anniversaryDate ? new Date(marriage.anniversaryDate) : null;
    const marriedAt = marriage?.marriedAt ? new Date(marriage.marriedAt) : ann;

    let years = '-';
    let nextInDays = '-';

    if (ann && !Number.isNaN(ann.getTime())) {
        const now = new Date();
        years = Math.max(0, now.getFullYear() - ann.getFullYear());
        const next = new Date(ann);
        next.setFullYear(now.getFullYear());
        if (next < now) next.setFullYear(now.getFullYear() + 1);
        nextInDays = Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 86400000));
    }

    return new EmbedBuilder()
        .setColor(Bot.AccentColor)
        .setTitle(' Estado de matrimonio')
        .addFields(
            { name: 'Usuario', value: `<@${targetUser.id}>`, inline: true },
            { name: 'Pareja', value: `<@${marriage.spouse}>`, inline: true },
            { name: 'Casados desde', value: formatDateTag(marriedAt), inline: false },
            { name: 'Aniversario', value: formatDateTag(ann), inline: true },
            { name: 'Proximo aniversario', value: nextInDays === '-' ? '-' : `En ${nextInDays} dia(s)`, inline: true },
            { name: 'Anos juntos', value: String(years), inline: true },
        )
        .setFooter({ text: `${targetUser.username}  ${spouseUser?.username || 'Usuario'}` });
}

async function ensureUserDoc(guildId, user) {
    let doc = await User.findOne({ guildID: guildId, userID: user.id });
    if (!doc) {
        doc = new User({ guildID: guildId, userID: user.id, username: user.username });
    }
    doc.username = user.username;
    return doc;
}

module.exports = {
    name: 'marriage',
    alias: ['marriage', 'matrimonio'],
    Category: marriageCategory,
    usage: 'marriage [@usuario] [DD/MM/YYYY] | marriage divorce',
    description: 'Comando directo: ver estado, proponer o divorciarse.',
    cooldown: 0,

    async execute(Moxi, message, args) {
        const guildId = message.guildId || message.guild?.id;
        if (!guildId) return;

        const lang = message.lang || await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const first = String(args[0] || '').toLowerCase();
        const wantsDivorce = ['divorce', 'divorcio', 'separar', 'sep'].includes(first);

        try {
            if (wantsDivorce) return handleDivorce(Moxi, message, guildId);

            const target = message.mentions.users.first() || null;
            const dateToken = args.find((t) => /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.test(String(t || '')));
            const parsedDate = parseAnniversaryInput(dateToken);
            if (!parsedDate.ok) {
                return message.reply({ content: ` ${parsedDate.message}`, allowedMentions: { repliedUser: false } });
            }

            if (target && target.id !== message.author.id) {
                return handlePropose(Moxi, message, guildId, message.author, target, parsedDate.date, lang);
            }

            if (dateToken && (!target || target.id === message.author.id)) {
                return message.reply({
                    content: ' Para usar fecha debes mencionar a la persona: .marriage @usuario DD/MM/YYYY',
                    allowedMentions: { repliedUser: false },
                });
            }

            return handleView(Moxi, message, guildId, target || message.author);
        } catch (error) {
            console.error('[marriage-prefix] error:', error);
            return message.reply({ content: ' Ocurrio un error con el comando marriage.', allowedMentions: { repliedUser: false } });
        }
    },
};

async function handlePropose(Moxi, message, guildId, proposer, targetUser, anniversaryDate) {
    if (targetUser.bot) {
        return message.reply({ content: ' No puedes casarte con bots.', allowedMentions: { repliedUser: false } });
    }

    const proposerDoc = await ensureUserDoc(guildId, proposer);
    const targetDoc = await ensureUserDoc(guildId, targetUser);

    if (proposerDoc.marriage?.spouse) {
        return message.reply({ content: ` Ya estas casado con <@${proposerDoc.marriage.spouse}>.`, allowedMentions: { repliedUser: false } });
    }
    if (targetDoc.marriage?.spouse) {
        return message.reply({ content: ` <@${targetUser.id}> ya esta casado/a.`, allowedMentions: { repliedUser: false } });
    }

    if (targetDoc.marriageProposal?.from) {
        return message.reply({ content: ` <@${targetUser.id}> ya tiene una propuesta pendiente.`, allowedMentions: { repliedUser: false } });
    }

    targetDoc.marriageProposal = {
        from: proposer.id,
        anniversaryDate: anniversaryDate || null,
        createdAt: new Date(),
    };

    await targetDoc.save();

    await message.reply(buildProposalMessage({
        proposerId: proposer.id,
        targetUserId: targetUser.id,
        anniversaryDate,
    }));
}

async function handleView(Moxi, message, guildId, targetUser) {
    const userDoc = await User.findOne({ guildID: guildId, userID: targetUser.id });
    if (!userDoc?.marriage?.spouse) {
        return message.reply({ content: ` <@${targetUser.id}> no esta casado/a.`, allowedMentions: { repliedUser: false } });
    }

    let spouseUser = null;
    try {
        spouseUser = await Moxi.users.fetch(userDoc.marriage.spouse);
    } catch {
        spouseUser = null;
    }

    const embed = buildStatusEmbed(targetUser, spouseUser, userDoc.marriage);
    return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
}

async function handleDivorce(Moxi, message, guildId) {
    const userId = message.author.id;
    const userDoc = await User.findOne({ guildID: guildId, userID: userId });
    if (!userDoc?.marriage?.spouse) {
        return message.reply({ content: ' No estas casado/a.', allowedMentions: { repliedUser: false } });
    }

    const spouseId = userDoc.marriage.spouse;
    const spouseDoc = await User.findOne({ guildID: guildId, userID: spouseId });

    userDoc.marriage = { spouse: null, anniversaryDate: null, marriedAt: null };
    if (spouseDoc) spouseDoc.marriage = { spouse: null, anniversaryDate: null, marriedAt: null };

    await Promise.all([userDoc.save(), spouseDoc ? spouseDoc.save() : Promise.resolve()]);

    await message.reply({ content: ` Te divorciaste de <@${spouseId}>.`, allowedMentions: { repliedUser: false } });
}
