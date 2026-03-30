const { MessageFlags, EmbedBuilder } = require('discord.js');
const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');
const { marriageCategory } = require('../../Util/commandCategories');
const { Bot } = require('../../Config');
const User = require('../../Models/UserSchema');
const {
    parseAnniversaryInput,
    createProposal,
    buildProposalMessage,
    getUserDoc,
    formatDateTag,
    divorce,
    changeAnniversary,
    acceptProposal,
    declineProposal,
} = require('../../Util/marriageCore');

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
        .setTitle('Estado de matrimonio')
        .addFields(
            { name: 'Usuario', value: `<@${targetUser.id}>`, inline: true },
            { name: 'Pareja', value: `<@${marriage.spouse}>`, inline: true },
            { name: 'Casados desde', value: formatDateTag(marriedAt), inline: false },
            { name: 'Aniversario', value: formatDateTag(ann), inline: true },
            { name: 'Proximo aniversario', value: nextInDays === '-' ? '-' : `En ${nextInDays} dia(s)`, inline: true },
            { name: 'Anos juntos', value: String(years), inline: true }
        )
        .setFooter({ text: `${targetUser.username} - ${spouseUser?.username || 'Usuario'}` });
}

module.exports = {
    cooldown: 0,
    Category: marriageCategory,
    data: new SlashCommandBuilder()
        .setName('marriage')
        .setDescription('Comandos de matrimonio.')
        .addSubcommand((sub) =>
            sub.setName('proponer')
                .setDescription('Enviar una propuesta de matrimonio.')
                .addUserOption((opt) =>
                    opt.setName('user')
                        .setDescription('Usuario a quien quieres proponer')
                        .setRequired(true)
                )
                .addStringOption((opt) =>
                    opt.setName('aniversario')
                        .setDescription('Fecha de aniversario DD/MM/YYYY')
                        .setRequired(false)
                )
        )
        .addSubcommand((sub) =>
            sub.setName('aceptar')
                .setDescription('Aceptar una propuesta de matrimonio pendiente.')
                .addUserOption((opt) =>
                    opt.setName('user')
                        .setDescription('Proponente especifico (opcional)')
                        .setRequired(false)
                )
        )
        .addSubcommand((sub) =>
            sub.setName('rechazar')
                .setDescription('Rechazar una propuesta de matrimonio pendiente.')
                .addUserOption((opt) =>
                    opt.setName('user')
                        .setDescription('Proponente especifico (opcional)')
                        .setRequired(false)
                )
        )
        .addSubcommand((sub) =>
            sub.setName('divorcio')
                .setDescription('Divorciarte de tu pareja.')
        )
        .addSubcommand((sub) =>
            sub.setName('carta')
                .setDescription('Enviar una carta de amor a tu pareja.')
                .addStringOption((opt) =>
                    opt.setName('mensaje')
                        .setDescription('Contenido de la carta')
                        .setRequired(true)
                )
                .addUserOption((opt) =>
                    opt.setName('user')
                        .setDescription('Tu pareja (opcional)')
                        .setRequired(false)
                )
        )
        .addSubcommand((sub) =>
            sub.setName('aniversario')
                .setDescription('Ver fecha de aniversario y tiempo juntos.')
                .addUserOption((opt) =>
                    opt.setName('user')
                        .setDescription('Usuario objetivo')
                        .setRequired(false)
                )
        )
        .addSubcommand((sub) =>
            sub.setName('estado')
                .setDescription('Ver estado matrimonial de un usuario.')
                .addUserOption((opt) =>
                    opt.setName('user')
                        .setDescription('Usuario objetivo')
                        .setRequired(false)
                )
        )
        .addSubcommand((sub) =>
            sub.setName('propuestas')
                .setDescription('Ver tu propuesta de matrimonio pendiente.')
        )
        .addSubcommand((sub) =>
            sub.setName('pareja')
                .setDescription('Ver la pareja (teammate) de un usuario casado.')
                .addUserOption((opt) =>
                    opt.setName('user')
                        .setDescription('Usuario objetivo')
                        .setRequired(false)
                )
        )
        .addSubcommand((sub) =>
            sub.setName('arbol')
                .setDescription('Mostrar arbol de pareja del matrimonio.')
                .addUserOption((opt) =>
                    opt.setName('user')
                        .setDescription('Usuario objetivo')
                        .setRequired(false)
                )
        )
        .addSubcommand((sub) =>
            sub.setName('cambiar-aniversario')
                .setDescription('Cambiar la fecha de aniversario de tu matrimonio.')
                .addStringOption((opt) =>
                    opt.setName('fecha')
                        .setDescription('Nueva fecha de aniversario DD/MM/YYYY')
                        .setRequired(true)
                )
        )
        .setDMPermission(false),

    async run(Moxi, interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId || interaction.guild?.id;

        try {
            if (sub === 'proponer') return handleProponer(interaction, guildId);
            if (sub === 'aceptar') return handleAceptar(interaction, guildId);
            if (sub === 'rechazar') return handleRechazar(interaction, guildId);
            if (sub === 'divorcio') return handleDivorcio(interaction, guildId);
            if (sub === 'carta') return handleCarta(interaction, guildId);
            if (sub === 'aniversario') return handleAniversario(interaction, guildId);
            if (sub === 'estado') return handleEstado(Moxi, interaction, guildId);
            if (sub === 'propuestas') return handlePropuestas(interaction, guildId);
            if (sub === 'pareja') return handlePareja(interaction, guildId);
            if (sub === 'arbol') return handleArbol(interaction, guildId);
            if (sub === 'cambiar-aniversario') return handleCambiarAniversario(interaction, guildId);
        } catch (error) {
            console.error('[/marriage] error:', error);
            return interaction.reply({ content: 'Ocurrio un error.', flags: MessageFlags.Ephemeral }).catch(() => null);
        }
    }
};

async function handleProponer(interaction, guildId) {
    const targetUser = interaction.options.getUser('user', true);
    const anniversaryInput = interaction.options.getString('aniversario', false);

    const parsed = parseAnniversaryInput(anniversaryInput);
    if (!parsed.ok) {
        return interaction.reply({ content: parsed.message, flags: MessageFlags.Ephemeral });
    }

    const res = await createProposal({
        guildId,
        proposer: interaction.user,
        targetUser,
        anniversaryDate: parsed.date
    });

    if (!res.ok) {
        if (res.alertSpouseId && interaction.channel) {
            await interaction.channel.send({
                content: `🚨 <@${res.alertSpouseId}>, <@${interaction.user.id}> intentó proponer matrimonio a <@${targetUser.id}> estando casado/a.`,
                allowedMentions: { users: [res.alertSpouseId] },
            }).catch(() => null);
        }
        return interaction.reply({ content: res.message, flags: MessageFlags.Ephemeral });
    }

    return interaction.reply(buildProposalMessage({
        proposerId: interaction.user.id,
        targetUserId: targetUser.id,
        anniversaryDate: parsed.date,
    }));
}

async function handleAceptar(interaction, guildId) {
    const proposerId = interaction.options.getUser('user', false)?.id || null;
    const res = await acceptProposal({ guildId, targetUserId: interaction.user.id, proposerId });

    if (!res.ok) {
        return interaction.reply({ content: res.message, flags: MessageFlags.Ephemeral });
    }

    return interaction.reply({
        content: `Aceptaste la propuesta de <@${res.proposerId}>. Felicidades por su matrimonio.`,
        allowedMentions: { repliedUser: false }
    });
}

async function handleRechazar(interaction, guildId) {
    const proposerId = interaction.options.getUser('user', false)?.id || null;
    const res = await declineProposal({ guildId, targetUserId: interaction.user.id, proposerId });

    if (!res.ok) {
        return interaction.reply({ content: res.message, flags: MessageFlags.Ephemeral });
    }

    return interaction.reply({
        content: `Rechazaste la propuesta de <@${res.proposerId}>.`,
        allowedMentions: { repliedUser: false }
    });
}

async function handleDivorcio(interaction, guildId) {
    const res = await divorce({ guildId, userId: interaction.user.id });

    if (!res.ok) {
        return interaction.reply({ content: res.message, flags: MessageFlags.Ephemeral });
    }

    return interaction.reply({
        content: `Te divorciaste de <@${res.spouseId}>.`,
        flags: MessageFlags.Ephemeral
    });
}

async function handleCarta(interaction, guildId) {
    const authorDoc = await getUserDoc(guildId, interaction.user.id);
    if (!authorDoc?.marriage?.spouse) {
        return interaction.reply({ content: 'No estas casado/a.', flags: MessageFlags.Ephemeral });
    }

    const spouseId = String(authorDoc.marriage.spouse);
    const targetId = String(interaction.options.getUser('user', false)?.id || spouseId);
    if (targetId !== spouseId) {
        return interaction.reply({ content: 'Solo puedes enviar carta a tu pareja.', flags: MessageFlags.Ephemeral });
    }

    const text = String(interaction.options.getString('mensaje', true) || '').trim();
    if (!text) {
        return interaction.reply({ content: 'Escribe un mensaje en la opcion mensaje.', flags: MessageFlags.Ephemeral });
    }

    return interaction.reply({
        content: `Carta para <@${spouseId}>\nDe: <@${interaction.user.id}>\nAniversario: ${formatDateTag(authorDoc.marriage.anniversaryDate)}\n\n${text}`,
        allowedMentions: { repliedUser: false }
    });
}

async function handleAniversario(interaction, guildId) {
    const target = interaction.options.getUser('user', false) || interaction.user;
    const doc = await getUserDoc(guildId, target.id);

    if (!doc?.marriage?.spouse) {
        return interaction.reply({ content: `<@${target.id}> no esta casado/a.`, flags: MessageFlags.Ephemeral });
    }

    const ann = doc.marriage.anniversaryDate ? new Date(doc.marriage.anniversaryDate) : null;
    if (!ann || Number.isNaN(ann.getTime())) {
        return interaction.reply({ content: 'No hay aniversario registrado.', flags: MessageFlags.Ephemeral });
    }

    const now = new Date();
    const next = new Date(ann);
    next.setFullYear(now.getFullYear());
    if (next < now) next.setFullYear(now.getFullYear() + 1);

    const years = Math.max(0, now.getFullYear() - ann.getFullYear());
    const days = Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 86400000));

    return interaction.reply({
        content: `Aniversario de <@${target.id}>\nFecha: ${formatDateTag(ann)}\nAnios juntos: ${years}\nProximo aniversario en: ${days} dia(s)`,
        allowedMentions: { repliedUser: false }
    });
}

async function handleEstado(Moxi, interaction, guildId) {
    const target = interaction.options.getUser('user', false) || interaction.user;
    const userDoc = await User.findOne({ guildID: guildId, userID: target.id });

    if (!userDoc?.marriage?.spouse) {
        return interaction.reply({ content: `<@${target.id}> no esta casado/a.`, flags: MessageFlags.Ephemeral });
    }

    let spouseUser = null;
    try {
        spouseUser = await Moxi.users.fetch(userDoc.marriage.spouse);
    } catch {
        spouseUser = null;
    }

    const embed = buildStatusEmbed(target, spouseUser, userDoc.marriage);
    return interaction.reply({ embeds: [embed] });
}

async function handlePropuestas(interaction, guildId) {
    const doc = await getUserDoc(guildId, interaction.user.id);

    if (!doc?.marriageProposal?.from) {
        return interaction.reply({ content: 'No tienes propuestas pendientes.', flags: MessageFlags.Ephemeral });
    }

    return interaction.reply({
        content: `Tienes una propuesta pendiente de <@${doc.marriageProposal.from}>.\nCreada: ${formatDateTag(doc.marriageProposal.createdAt)}\nAniversario: ${formatDateTag(doc.marriageProposal.anniversaryDate)}`,
        allowedMentions: { repliedUser: false }
    });
}

async function handlePareja(interaction, guildId) {
    const target = interaction.options.getUser('user', false) || interaction.user;
    const doc = await getUserDoc(guildId, target.id);

    if (!doc?.marriage?.spouse) {
        return interaction.reply({ content: `<@${target.id}> no tiene pareja de matrimonio.`, flags: MessageFlags.Ephemeral });
    }

    return interaction.reply({
        content: `Pareja de <@${target.id}>: <@${doc.marriage.spouse}>\nCasados desde: ${formatDateTag(doc.marriage.marriedAt)}\nAniversario: ${formatDateTag(doc.marriage.anniversaryDate)}`,
        allowedMentions: { repliedUser: false }
    });
}

async function handleCambiarAniversario(interaction, guildId) {
    const fechaInput = interaction.options.getString('fecha', true);
    const parsed = parseAnniversaryInput(fechaInput);
    if (!parsed.ok) {
        return interaction.reply({ content: parsed.message, flags: MessageFlags.Ephemeral });
    }

    const res = await changeAnniversary({ guildId, userId: interaction.user.id, newDate: parsed.date });
    if (!res.ok) {
        return interaction.reply({ content: res.message, flags: MessageFlags.Ephemeral });
    }

    return interaction.reply({
        content: `Aniversario actualizado a ${formatDateTag(parsed.date)} para ti y <@${res.spouseId}>.`,
        allowedMentions: { repliedUser: false },
    });
}

async function handleArbol(interaction, guildId) {
    const target = interaction.options.getUser('user', false) || interaction.user;
    const doc = await getUserDoc(guildId, target.id);

    if (!doc?.marriage?.spouse) {
        return interaction.reply({ content: `<@${target.id}> no esta casado/a.`, flags: MessageFlags.Ephemeral });
    }

    const tree = [
        `        <@${target.id}>`,
        '             |',
        `        <@${doc.marriage.spouse}>`
    ].join('\n');

    return interaction.reply({
        content: `Arbol de matrimonio\n\n${tree}\n\nCasados desde: ${formatDateTag(doc.marriage.marriedAt)}`,
        allowedMentions: { repliedUser: false }
    });
}
