const { ActionRowBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { ButtonBuilder } = require('./compatButtonBuilder');
const { Bot } = require('../Config');
const User = require('../Models/UserSchema');

const GLOBAL_SCOPE_GUILD_ID = 'GLOBAL';

const PROPOSAL_TIMEOUT = 48 * 60 * 60 * 1000;

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

async function ensureUserDoc(guildId, user) {
    let doc = await User.findOne({ guildID: GLOBAL_SCOPE_GUILD_ID, userID: user.id });
    if (!doc) {
        doc = await User.findOne({ userID: user.id }).sort({ updatedAt: -1, createdAt: -1 });
        if (doc) doc.guildID = GLOBAL_SCOPE_GUILD_ID;
    }
    if (!doc) {
        doc = new User({ guildID: GLOBAL_SCOPE_GUILD_ID, userID: user.id, username: user.username });
    }
    doc.username = user.username;
    return doc;
}

async function getUserDoc(guildId, userId) {
    const globalDoc = await User.findOne({ guildID: GLOBAL_SCOPE_GUILD_ID, userID: userId });
    if (globalDoc) return globalDoc;
    return User.findOne({ userID: userId }).sort({ updatedAt: -1, createdAt: -1 });
}

async function createProposal({ guildId, proposer, targetUser, anniversaryDate }) {
    const proposerDoc = await ensureUserDoc(guildId, proposer);
    const targetDoc = await ensureUserDoc(guildId, targetUser);

    if (targetUser.bot) return { ok: false, message: 'No puedes casarte con bots.' };
    if (proposer.id === targetUser.id) return { ok: false, message: 'No puedes proponerte a ti mismo.' };
    if (proposerDoc.marriage?.spouse) {
        return {
            ok: false,
            message: `Ya estas casado con <@${proposerDoc.marriage.spouse}>. No se permiten infidelidades.`,
            alertSpouseId: String(proposerDoc.marriage.spouse),
        };
    }
    if (targetDoc.marriage?.spouse) return { ok: false, message: `<@${targetUser.id}> ya esta casado/a.` };
    if (targetDoc.marriageProposal?.from) return { ok: false, message: `<@${targetUser.id}> ya tiene una propuesta pendiente.` };

    targetDoc.marriageProposal = {
        from: proposer.id,
        anniversaryDate: anniversaryDate || null,
        createdAt: new Date(),
    };

    await targetDoc.save();
    return { ok: true };
}

async function acceptProposal({ guildId, targetUserId, proposerId }) {
    const targetDoc = await getUserDoc(guildId, targetUserId);
    if (!targetDoc?.marriageProposal?.from) return { ok: false, message: 'No tienes propuestas pendientes.' };

    if (proposerId && targetDoc.marriageProposal.from !== proposerId) {
        return { ok: false, message: 'No tienes propuesta pendiente de ese usuario.' };
    }

    const createdAt = targetDoc.marriageProposal.createdAt ? new Date(targetDoc.marriageProposal.createdAt) : null;
    if (!createdAt || Number.isNaN(createdAt.getTime()) || (Date.now() - createdAt.getTime()) > PROPOSAL_TIMEOUT) {
        targetDoc.marriageProposal = { from: null, anniversaryDate: null, createdAt: null };
        await targetDoc.save();
        return { ok: false, message: 'La propuesta expiro.' };
    }

    const finalProposerId = targetDoc.marriageProposal.from;
    let proposerDoc = await getUserDoc(guildId, finalProposerId);
    if (!proposerDoc) proposerDoc = new User({ guildID: GLOBAL_SCOPE_GUILD_ID, userID: finalProposerId });

    if (targetDoc.marriage?.spouse || proposerDoc.marriage?.spouse) {
        targetDoc.marriageProposal = { from: null, anniversaryDate: null, createdAt: null };
        await targetDoc.save();
        return { ok: false, message: 'No se pudo completar: alguno ya esta casado.' };
    }

    const now = new Date();
    const ann = targetDoc.marriageProposal.anniversaryDate ? new Date(targetDoc.marriageProposal.anniversaryDate) : now;
    const safeAnn = Number.isNaN(ann.getTime()) ? now : ann;

    targetDoc.marriage = { spouse: finalProposerId, anniversaryDate: safeAnn, marriedAt: now };
    targetDoc.marriageProposal = { from: null, anniversaryDate: null, createdAt: null };
    proposerDoc.marriage = { spouse: targetUserId, anniversaryDate: safeAnn, marriedAt: now };

    await Promise.all([targetDoc.save(), proposerDoc.save()]);

    // Incrementar contador con $inc (atómico, no depende de change tracking)
    await Promise.all([
        User.updateOne(
            { guildID: GLOBAL_SCOPE_GUILD_ID, userID: targetUserId },
            { $inc: { 'socialProgress.marriagesCount': 1 }, $set: { 'socialProgress.lastMarriageAt': now } }
        ),
        User.updateOne(
            { guildID: GLOBAL_SCOPE_GUILD_ID, userID: finalProposerId },
            { $inc: { 'socialProgress.marriagesCount': 1 }, $set: { 'socialProgress.lastMarriageAt': now } }
        ),
    ]);

    return { ok: true, proposerId: finalProposerId };
}

async function declineProposal({ guildId, targetUserId, proposerId }) {
    const targetDoc = await getUserDoc(guildId, targetUserId);
    if (!targetDoc?.marriageProposal?.from) return { ok: false, message: 'No tienes propuestas pendientes.' };

    if (proposerId && targetDoc.marriageProposal.from !== proposerId) {
        return { ok: false, message: 'No tienes propuesta pendiente de ese usuario.' };
    }

    const from = targetDoc.marriageProposal.from;
    targetDoc.marriageProposal = { from: null, anniversaryDate: null, createdAt: null };
    await targetDoc.save();

    return { ok: true, proposerId: from };
}

async function divorce({ guildId, userId }) {
    const userDoc = await getUserDoc(guildId, userId);
    if (!userDoc?.marriage?.spouse) return { ok: false, message: 'No estas casado/a.' };

    const spouseId = userDoc.marriage.spouse;
    const spouseDoc = await getUserDoc(guildId, spouseId);

    userDoc.marriage = { spouse: null, anniversaryDate: null, marriedAt: null };
    if (spouseDoc) spouseDoc.marriage = { spouse: null, anniversaryDate: null, marriedAt: null };

    await Promise.all([userDoc.save(), spouseDoc ? spouseDoc.save() : Promise.resolve()]);
    return { ok: true, spouseId };
}

async function changeAnniversary({ guildId, userId, newDate }) {
    const userDoc = await getUserDoc(guildId, userId);
    if (!userDoc?.marriage?.spouse) return { ok: false, message: 'No estas casado/a.' };

    const spouseDoc = await getUserDoc(guildId, userDoc.marriage.spouse);

    userDoc.marriage.anniversaryDate = newDate;
    if (spouseDoc) spouseDoc.marriage.anniversaryDate = newDate;

    await Promise.all([userDoc.save(), spouseDoc ? spouseDoc.save() : Promise.resolve()]);

    // Actualiza hitos sociales para que el cambio de aniversario se refleje en perfil.
    const now = new Date();
    await Promise.all([
        User.updateOne(
            { guildID: GLOBAL_SCOPE_GUILD_ID, userID: String(userId) },
            {
                $inc: { 'socialProgress.anniversariesCelebrated': 1 },
                $set: { 'socialProgress.lastAnniversaryAt': now },
            }
        ),
        spouseDoc
            ? User.updateOne(
                { guildID: GLOBAL_SCOPE_GUILD_ID, userID: String(userDoc.marriage.spouse) },
                {
                    $inc: { 'socialProgress.anniversariesCelebrated': 1 },
                    $set: { 'socialProgress.lastAnniversaryAt': now },
                }
            )
            : Promise.resolve(),
    ]);

    return { ok: true, spouseId: userDoc.marriage.spouse };
}

function buildProposalMessage({ proposerId, targetUserId, anniversaryDate }) {
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`marriage_accept_${proposerId}_${targetUserId}`)
            .setLabel('Aceptar')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId(`marriage_reject_${proposerId}_${targetUserId}`)
            .setLabel('Rechazar')
            .setStyle(ButtonStyle.Danger)
    );

    const embed = new EmbedBuilder()
        .setColor(Bot.AccentColor)
        .setTitle('Propuesta de matrimonio')
        .setDescription(`<@${proposerId}> te ha propuesto matrimonio.`)
        .addFields(
            { name: 'Proponente', value: `<@${proposerId}>`, inline: true },
            { name: 'Destino', value: `<@${targetUserId}>`, inline: true },
            { name: 'Aniversario', value: formatDateTag(anniversaryDate), inline: false }
        )
        .setFooter({ text: 'Tienes 48 horas para responder.' });

    return {
        content: `<@${targetUserId}>, tienes una propuesta de matrimonio.`,
        embeds: [embed],
        components: [row],
        allowedMentions: { repliedUser: false },
    };
}

module.exports = {
    PROPOSAL_TIMEOUT,
    formatDateTag,
    parseAnniversaryInput,
    ensureUserDoc,
    getUserDoc,
    createProposal,
    acceptProposal,
    declineProposal,
    divorce,
    changeAnniversary,
    buildProposalMessage,
};
