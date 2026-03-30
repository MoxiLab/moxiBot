const { systemsCategory } = require('../../Util/commandCategories');
const { User } = require('../../Models');
const BirthdayGuildConfig = require('../../Models/BirthdayGuildConfigSchema');
const { parseBirthdayInput, updateUserProfile, formatBirthday, setBirthdayGuildAccess } = require('../../Util/profileSettings');
const {
    runBirthdayAnnouncementsForGuild,
    resetBirthdayAnnouncementsForGuildDate,
    getDateKeyForTimezone,
    getBirthdayAnnouncementDebugForGuild,
} = require('../../Util/birthdayAnnouncements');
const Config = require('../../Config');

function getBlockedGuilds(doc) {
    const list = doc?.profile?.birthdayConfig?.blockedGuilds;
    return Array.isArray(list) ? list.map((x) => String(x)) : [];
}

function isAllowedInGuild(doc, guildId) {
    const blocked = getBlockedGuilds(doc);
    return !blocked.includes(String(guildId));
}

function getNextBirthdayDate(day, month, now = new Date()) {
    const year = now.getFullYear();
    const next = new Date(year, month - 1, day);
    if (next < now) next.setFullYear(year + 1);
    return next;
}

function daysUntil(dateLike, now = new Date()) {
    const d = dateLike instanceof Date ? dateLike : new Date(dateLike);
    if (Number.isNaN(d.getTime())) return 0;
    return Math.max(0, Math.ceil((d.getTime() - now.getTime()) / 86400000));
}

module.exports = {
    name: 'birthday',
    alias: ['cumple', 'cumpleaños', 'bday'],
    Category: systemsCategory,
    usage: '[subcomando]',
    description:  '🎂 **Módulo de cumpleaños**'
        + '\n\n¡Es hora de celebrar! 🎉 Con este módulo, puedo recordar tu cumpleaños y mostrar próximos cumples del servidor.'
        + '\nPuedes configurarlo fácilmente con subcomandos.',
    examples: [
        `birthday date 25/12`,
        `birthday allow`,
        `birthday deny`,
        `birthday list`,
        `birthday ver @usuario`,
        `birthday channel #canal`,
        `birthday channel`,
        `birthday channel off`,
        `birthday test run`,
        `birthday test reset`,
        `birthday test debug`,
        `birthday test status`,
        `birthday off`,
    ],
    permissions: {
        Bot: ['Ver canal', 'Enviar mensajes'],
        User: [],
    },
    cooldown: 3,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message, args) {
        const guildId = message.guildId || message.guild?.id;
        if (!guildId) return;

        const action = String(args?.[0] || 'ver').trim().toLowerCase();

        if (action === 'date' || action === 'set') {
            const raw = String(args?.[1] || '').trim();
            if (!raw) {
                return message.reply({ content: 'Uso: `-birthday date DD/MM`', allowedMentions: { repliedUser: false } });
            }

            const parsed = parseBirthdayInput(raw);
            if (!parsed.ok) {
                return message.reply({ content: parsed.message, allowedMentions: { repliedUser: false } });
            }

            const doc = await updateUserProfile(guildId, message.author, { birthday: parsed.value });
            return message.reply({
                content: `🎂 Tu cumpleaños quedó en **${formatBirthday(doc?.profile?.birthday)}**.`,
                allowedMentions: { repliedUser: false }
            });
        }

        if (action === 'off' || action === 'reset' || action === 'remove') {
            await updateUserProfile(guildId, message.author, { birthday: null });
            return message.reply({ content: '🎂 Quité tu cumpleaños del perfil.', allowedMentions: { repliedUser: false } });
        }

        if (action === 'allow' || action === 'deny') {
            await setBirthdayGuildAccess(guildId, message.author, action === 'allow');

            return message.reply({
                content: action === 'allow'
                    ? '✅ Este servidor ahora puede celebrar tu cumpleaños.'
                    : '🚫 Este servidor ya no puede celebrar tu cumpleaños.',
                allowedMentions: { repliedUser: false }
            });
        }

        if (action === 'list') {
            const now = new Date();
            const guildUsers = await User.find({ guildID: guildId }, { userID: 1 }).lean().catch(() => []);
            const memberIds = [...new Set((Array.isArray(guildUsers) ? guildUsers : []).map((x) => String(x?.userID || '')).filter(Boolean))];
            if (!memberIds.length) {
                return message.reply({ content: '📭 No hay cumpleaños configurados para mostrar en este servidor.', allowedMentions: { repliedUser: false } });
            }
            const rows = await User.find({
                guildID: 'GLOBAL',
                userID: { $in: memberIds },
                'profile.birthday.day': { $gt: 0 },
                'profile.birthday.month': { $gt: 0 },
            }, {
                userID: 1,
                profile: 1,
            }).lean().catch(() => []);

            const upcoming = (Array.isArray(rows) ? rows : [])
                .filter((doc) => isAllowedInGuild(doc, guildId))
                .map((doc) => {
                    const day = Number(doc?.profile?.birthday?.day || 0);
                    const month = Number(doc?.profile?.birthday?.month || 0);
                    const next = getNextBirthdayDate(day, month, now);
                    return {
                        userId: String(doc?.userID || ''),
                        day,
                        month,
                        inDays: daysUntil(next, now),
                    };
                })
                .filter((x) => x.userId && x.day > 0 && x.month > 0)
                .sort((a, b) => a.inDays - b.inDays)
                .slice(0, 10);

            if (!upcoming.length) {
                return message.reply({ content: '📭 No hay cumpleaños configurados para mostrar en este servidor.', allowedMentions: { repliedUser: false } });
            }

            const lines = upcoming.map((x, i) => `${i + 1}. <@${x.userId}> — ${String(x.day).padStart(2, '0')}/${String(x.month).padStart(2, '0')} (en ${x.inDays} dia(s))`);
            return message.reply({
                content: `🎉 Próximos cumpleaños\n${lines.join('\n')}`,
                allowedMentions: { repliedUser: false }
            });
        }

        if (action === 'channel' || action === 'canal') {
            const sub = String(args?.[1] || '').trim().toLowerCase();
            const mentioned = message.mentions?.channels?.first?.();

            if (sub === 'off' || sub === 'disable' || sub === 'none') {
                await BirthdayGuildConfig.findOneAndUpdate(
                    { guildID: String(guildId) },
                    { $set: { channelID: null, updatedBy: String(message.author.id) } },
                    { upsert: true }
                );
                return message.reply({
                    content: '✅ Desactivé el canal fijo de cumpleaños. Se usará el canal automático.',
                    allowedMentions: { repliedUser: false },
                });
            }

            if (mentioned) {
                await BirthdayGuildConfig.findOneAndUpdate(
                    { guildID: String(guildId) },
                    { $set: { channelID: String(mentioned.id), updatedBy: String(message.author.id) } },
                    { upsert: true }
                );
                return message.reply({
                    content: `✅ Canal de cumpleaños configurado en ${mentioned}.`,
                    allowedMentions: { repliedUser: false },
                });
            }

            const cfg = await BirthdayGuildConfig.findOne({ guildID: String(guildId) }).lean().catch(() => null);
            const configuredId = cfg?.channelID ? String(cfg.channelID) : null;
            if (!configuredId) {
                return message.reply({
                    content: 'ℹ️ No hay canal fijo configurado. Uso: `-birthday channel #canal` o `-birthday channel off`.',
                    allowedMentions: { repliedUser: false },
                });
            }

            return message.reply({
                content: `📢 Canal actual de cumpleaños: <#${configuredId}>`,
                allowedMentions: { repliedUser: false },
            });
        }

        if (action === 'test') {
            const hasPerm = Boolean(
                message.member?.permissions?.has?.('ManageGuild')
                || message.member?.permissions?.has?.('Administrator')
            );
            if (!hasPerm) {
                return message.reply({
                    content: '❌ Necesitas permiso de Gestionar servidor para usar test de cumpleaños.',
                    allowedMentions: { repliedUser: false },
                });
            }

            const sub = String(args?.[1] || 'status').trim().toLowerCase();
            const timezone = Config?.TimeGates?.timezone || 'Europe/Madrid';
            const todayKey = getDateKeyForTimezone(timezone);

            if (sub === 'run') {
                const result = await runBirthdayAnnouncementsForGuild(Moxi, guildId, timezone);
                return message.reply({
                    content: `🧪 Test ejecutado. Fecha: ${result.dateKey || todayKey}. Enviados: ${result.announced}. Omitidos: ${result.skipped}.`,
                    allowedMentions: { repliedUser: false },
                });
            }

            if (sub === 'reset' || sub === 'clear') {
                const out = await resetBirthdayAnnouncementsForGuildDate(guildId, todayKey);
                return message.reply({
                    content: `🧹 Reset de test completado para ${todayKey}. Registros eliminados: ${out.deleted}.`,
                    allowedMentions: { repliedUser: false },
                });
            }

            if (sub === 'debug') {
                const d = await getBirthdayAnnouncementDebugForGuild(Moxi, guildId, timezone);
                if (!d?.ok) {
                    return message.reply({
                        content: `❌ Debug no disponible: ${d?.reason || 'unknown'}`,
                        allowedMentions: { repliedUser: false },
                    });
                }

                const channelText = d.channel
                    ? `<#${d.channel.id}> (${d.channel.source})`
                    : `ninguno (${d.channelReason})`;
                const pending = (Array.isArray(d.samplePendingUsers) && d.samplePendingUsers.length)
                    ? d.samplePendingUsers.map((id) => `<@${id}>`).join(', ')
                    : 'sin usuarios pendientes';

                return message.reply({
                    content:
                        `🩺 Debug cumpleaños\n`
                        + `- Fecha: ${d.dateKey} (${d.timezone})\n`
                        + `- Coinciden hoy: ${d.matchedToday}\n`
                        + `- Bloqueados por deny: ${d.blockedByDeny}\n`
                        + `- Elegibles unicos: ${d.eligibleUnique}\n`
                        + `- Ya anunciados hoy: ${d.alreadyAnnounced}\n`
                        + `- Pendientes por enviar: ${d.pendingToSend}\n`
                        + `- Canal: ${channelText}\n`
                        + `- Muestra pendientes: ${pending}`,
                    allowedMentions: { repliedUser: false, users: d.samplePendingUsers || [] },
                });
            }

            return message.reply({
                content: `ℹ️ Test cumpleaños\n- Fecha actual (${timezone}): ${todayKey}\n- Usa: \`-birthday test run\` para forzar\n- Usa: \`-birthday test reset\` para limpiar bloqueo de hoy`,
                allowedMentions: { repliedUser: false },
            });
        }

        const target = message.mentions?.users?.first?.() || message.author;
        let doc = await User.findOne({ guildID: 'GLOBAL', userID: target.id }).lean().catch(() => null);
        if (!doc) {
            doc = await User.findOne({ userID: target.id }).sort({ updatedAt: -1, createdAt: -1 }).lean().catch(() => null);
        }
        const value = formatBirthday(doc?.profile?.birthday);

        if (target.id === message.author.id) {
            return message.reply({ content: `🎂 Tu cumpleaños: **${value}**`, allowedMentions: { repliedUser: false } });
        }

        return message.reply({
            content: `🎂 Cumpleaños de <@${target.id}>: **${value}**`,
            allowedMentions: { repliedUser: false }
        });
    },
};
