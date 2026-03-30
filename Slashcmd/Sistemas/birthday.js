const { MessageFlags } = require('discord.js');
const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');
const { User } = require('../../Models');
const BirthdayGuildConfig = require('../../Models/BirthdayGuildConfigSchema');
const { parseBirthdayInput, updateUserProfile, formatBirthday, setBirthdayGuildAccess } = require('../../Util/profileSettings');
const { systemsCategory } = require('../../Util/commandCategories');
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
    cooldown: 0,
    Category: systemsCategory,
    data: new SlashCommandBuilder()
        .setName('birthday')
        .setDescription('Modulo de cumpleaños del perfil.')
        .addSubcommand((sub) =>
            sub.setName('date')
                .setDescription('Establece tu fecha de cumpleaños (DD/MM).')
                .addStringOption((opt) =>
                    opt.setName('fecha')
                        .setDescription('DD/MM')
                        .setRequired(true)
                )
        )
        .addSubcommand((sub) =>
            sub.setName('allow')
                .setDescription('Permite que este servidor celebre tu cumpleaños.')
        )
        .addSubcommand((sub) =>
            sub.setName('deny')
                .setDescription('Bloquea que este servidor celebre tu cumpleaños.')
        )
        .addSubcommand((sub) =>
            sub.setName('off')
                .setDescription('Quita tu cumpleaños del perfil.')
        )
        .addSubcommand((sub) =>
            sub.setName('list')
                .setDescription('Mira los proximos cumpleaños del servidor.')
        )
        .addSubcommand((sub) =>
            sub.setName('ver')
                .setDescription('Ver el cumpleaños de un usuario.')
                .addUserOption((opt) =>
                    opt.setName('user')
                        .setDescription('Usuario para consultar')
                        .setRequired(false)
                )
        )
        .addSubcommand((sub) =>
            sub.setName('channel')
                .setDescription('Configura o consulta el canal de anuncios de cumpleaños.')
                .addChannelOption((opt) =>
                    opt.setName('canal')
                        .setDescription('Canal donde se anunciarán cumpleaños')
                        .setRequired(false)
                )
                .addBooleanOption((opt) =>
                    opt.setName('off')
                        .setDescription('Desactivar canal fijo de cumpleaños')
                        .setRequired(false)
                )
        )
        .addSubcommand((sub) =>
            sub.setName('test')
                .setDescription('Herramientas de prueba del sistema de cumpleaños (staff).')
                .addStringOption((opt) =>
                    opt.setName('accion')
                        .setDescription('Accion de prueba')
                        .setRequired(false)
                        .addChoices(
                            { name: 'status', value: 'status' },
                            { name: 'run', value: 'run' },
                            { name: 'reset', value: 'reset' },
                            { name: 'debug', value: 'debug' }
                        )
                )
        )
        .setDMPermission(false),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const sub = interaction.options.getSubcommand();

        if (sub === 'date') {
            const raw = interaction.options.getString('fecha', true);

            const parsed = parseBirthdayInput(raw);
            if (!parsed.ok) {
                return interaction.reply({ content: parsed.message, flags: MessageFlags.Ephemeral });
            }

            const doc = await updateUserProfile(guildId, interaction.user, { birthday: parsed.value });
            return interaction.reply({
                content: `🎂 Tu cumpleaños quedó en **${formatBirthday(doc?.profile?.birthday)}**.`,
                flags: MessageFlags.Ephemeral,
            });
        }

        if (sub === 'off') {
            await updateUserProfile(guildId, interaction.user, { birthday: null });
            return interaction.reply({ content: '🎂 Quité tu cumpleaños del perfil.', flags: MessageFlags.Ephemeral });
        }

        if (sub === 'allow' || sub === 'deny') {
            await setBirthdayGuildAccess(guildId, interaction.user, sub === 'allow');

            return interaction.reply({
                content: sub === 'allow'
                    ? '✅ Este servidor ahora puede celebrar tu cumpleaños.'
                    : '🚫 Este servidor ya no puede celebrar tu cumpleaños.',
                flags: MessageFlags.Ephemeral,
            });
        }

        if (sub === 'list') {
            const now = new Date();
            const guildUsers = await User.find({ guildID: guildId }, { userID: 1 }).lean().catch(() => []);
            const memberIds = [...new Set((Array.isArray(guildUsers) ? guildUsers : []).map((x) => String(x?.userID || '')).filter(Boolean))];
            if (!memberIds.length) {
                return interaction.reply({ content: '📭 No hay cumpleaños configurados para mostrar en este servidor.', flags: MessageFlags.Ephemeral });
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
                return interaction.reply({ content: '📭 No hay cumpleaños configurados para mostrar en este servidor.', flags: MessageFlags.Ephemeral });
            }

            const lines = upcoming.map((x, i) => `${i + 1}. <@${x.userId}> — ${String(x.day).padStart(2, '0')}/${String(x.month).padStart(2, '0')} (en ${x.inDays} dia(s))`);
            return interaction.reply({
                content: `🎉 Próximos cumpleaños\n${lines.join('\n')}`,
                allowedMentions: { repliedUser: false }
            });
        }

        if (sub === 'channel') {
            const channel = interaction.options.getChannel('canal', false);
            const off = interaction.options.getBoolean('off', false);

            if (off) {
                await BirthdayGuildConfig.findOneAndUpdate(
                    { guildID: String(guildId) },
                    { $set: { channelID: null, updatedBy: String(interaction.user.id) } },
                    { upsert: true }
                );
                return interaction.reply({
                    content: '✅ Desactivé el canal fijo de cumpleaños. Se usará el canal automático.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (channel) {
                await BirthdayGuildConfig.findOneAndUpdate(
                    { guildID: String(guildId) },
                    { $set: { channelID: String(channel.id), updatedBy: String(interaction.user.id) } },
                    { upsert: true }
                );
                return interaction.reply({
                    content: `✅ Canal de cumpleaños configurado en <#${channel.id}>.`,
                    flags: MessageFlags.Ephemeral,
                });
            }

            const cfg = await BirthdayGuildConfig.findOne({ guildID: String(guildId) }).lean().catch(() => null);
            const configuredId = cfg?.channelID ? String(cfg.channelID) : null;
            if (!configuredId) {
                return interaction.reply({
                    content: 'ℹ️ No hay canal fijo configurado. Usa `/birthday channel canal:#canal` o activa `off:true` para limpiar.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            return interaction.reply({
                content: `📢 Canal actual de cumpleaños: <#${configuredId}>`,
                flags: MessageFlags.Ephemeral,
            });
        }

        if (sub === 'test') {
            const hasPerm = Boolean(
                interaction.memberPermissions?.has?.('ManageGuild')
                || interaction.memberPermissions?.has?.('Administrator')
            );
            if (!hasPerm) {
                return interaction.reply({
                    content: '❌ Necesitas permiso de Gestionar servidor para usar test de cumpleaños.',
                    flags: MessageFlags.Ephemeral,
                });
            }

            const action = String(interaction.options.getString('accion', false) || 'status').toLowerCase();
            const timezone = Config?.TimeGates?.timezone || 'Europe/Madrid';
            const todayKey = getDateKeyForTimezone(timezone);

            if (action === 'run') {
                const result = await runBirthdayAnnouncementsForGuild(Moxi, guildId, timezone);
                return interaction.reply({
                    content: `🧪 Test ejecutado. Fecha: ${result.dateKey || todayKey}. Enviados: ${result.announced}. Omitidos: ${result.skipped}.`,
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (action === 'reset') {
                const out = await resetBirthdayAnnouncementsForGuildDate(guildId, todayKey);
                return interaction.reply({
                    content: `🧹 Reset de test completado para ${todayKey}. Registros eliminados: ${out.deleted}.`,
                    flags: MessageFlags.Ephemeral,
                });
            }

            if (action === 'debug') {
                const d = await getBirthdayAnnouncementDebugForGuild(Moxi, guildId, timezone);
                if (!d?.ok) {
                    return interaction.reply({
                        content: `❌ Debug no disponible: ${d?.reason || 'unknown'}`,
                        flags: MessageFlags.Ephemeral,
                    });
                }

                const channelText = d.channel
                    ? `<#${d.channel.id}> (${d.channel.source})`
                    : `ninguno (${d.channelReason})`;
                const pending = (Array.isArray(d.samplePendingUsers) && d.samplePendingUsers.length)
                    ? d.samplePendingUsers.map((id) => `<@${id}>`).join(', ')
                    : 'sin usuarios pendientes';

                return interaction.reply({
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
                    flags: MessageFlags.Ephemeral,
                    allowedMentions: { users: d.samplePendingUsers || [] },
                });
            }

            return interaction.reply({
                content: `ℹ️ Test cumpleaños\n- Fecha actual (${timezone}): ${todayKey}\n- Usa: /birthday test accion:run\n- Usa: /birthday test accion:reset`,
                flags: MessageFlags.Ephemeral,
            });
        }

        const target = interaction.options.getUser('user', false) || interaction.user;
        let doc = await User.findOne({ guildID: 'GLOBAL', userID: target.id }).lean().catch(() => null);
        if (!doc) {
            doc = await User.findOne({ userID: target.id }).sort({ updatedAt: -1, createdAt: -1 }).lean().catch(() => null);
        }
        const value = formatBirthday(doc?.profile?.birthday);

        if (target.id === interaction.user.id) {
            return interaction.reply({ content: `🎂 Tu cumpleaños: **${value}**`, flags: MessageFlags.Ephemeral });
        }

        return interaction.reply({
            content: `🎂 Cumpleaños de <@${target.id}>: **${value}**`,
            allowedMentions: { repliedUser: false }
        });
    },
};
