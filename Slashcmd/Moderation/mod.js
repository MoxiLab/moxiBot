const { ChatInputCommandBuilder: SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { putPending, buildConfirmV2 } = require('../../Util/modV2');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const debugHelper = require('../../Util/debugHelper');

function t(lang, key, vars) {
    return moxi.translate(`moderation:${key}`, lang, vars);
}

function missingPerm(lang, permKey, guildName) {
    return moxi.translate('MISSING_PERMISSION', lang, {
        PERMISSIONS: moxi.translate(`permissions:${permKey}`, lang),
        guild: guildName || 'este servidor',
    });
}

function hasPerm(perms, bit) {
    try {
        return perms?.has?.(bit);
    } catch {
        return false;
    }
}

async function ensurePerms(interaction, lang, { userBit, userKey, botBit, botKey }) {
    if (userBit && !hasPerm(interaction.memberPermissions, userBit)) {
        return { ok: false, msg: missingPerm(lang, userKey, interaction.guild?.name) };
    }

    const me = interaction.guild?.members?.me;
    if (botBit && !hasPerm(me?.permissions, botBit)) {
        return { ok: false, msg: missingPerm(lang, botKey, interaction.guild?.name) };
    }

    return { ok: true };
}

async function fetchMember(interaction, user) {
    if (!user?.id) return null;
    try {
        return await interaction.guild.members.fetch(user.id);
    } catch {
        return null;
    }
}


module.exports = {
    cooldown: 3,
    Category: (lang = 'es-ES') => moxi.translate('commands:CATEGORY_MODERATION', lang),

    data: new SlashCommandBuilder()
        .setName('mod')
        .setDescription(`${EMOJIS.shield} ${moxi.translate('commands:CATEGORY_MODERATION', 'es-ES') || 'Moderación'}`)

        .addSubcommands((sub) =>
            sub
                .setName('ban')
                .setDescription(moxi.translate('moderation:CMD_BAN_DESC', 'es-ES') || `${EMOJIS.shield} Banea a un usuario y protege al servidor.`)
            .addUserOptions((o) => o.setName('usuario').setDescription(moxi.translate('moderation:OPT_USER_BAN', 'es-ES') || 'Usuario a banear').setRequired(true))
            .addStringOptions((o) => o.setName('motivo').setDescription(moxi.translate('moderation:OPT_REASON', 'es-ES') || 'Motivo').setRequired(false))
        )

        .addSubcommands((sub) =>
            sub
                .setName('kick')
                .setDescription(moxi.translate('moderation:CMD_KICK_DESC', 'es-ES') || `${EMOJIS.person} Expulsa a un usuario del servidor y restaura el orden.`)
            .addUserOptions((o) => o.setName('usuario').setDescription(moxi.translate('moderation:OPT_USER_KICK', 'es-ES') || 'Usuario a expulsar').setRequired(true))
            .addStringOptions((o) => o.setName('motivo').setDescription(moxi.translate('moderation:OPT_REASON', 'es-ES') || 'Motivo').setRequired(false))
        )

        .addSubcommands((sub) =>
            sub
                .setName('timeout')
                .setDescription(moxi.translate('moderation:CMD_TIMEOUT_DESC', 'es-ES') || `${EMOJIS.hourglass} Aplica un timeout temporal para reflexionar.`)
            .addUserOptions((o) => o.setName('usuario').setDescription(moxi.translate('moderation:OPT_USER', 'es-ES') || 'Usuario').setRequired(true))
            .addIntegerOptions((o) => o.setName('minutos').setDescription(moxi.translate('moderation:OPT_MINUTES', 'es-ES') || 'Minutos').setRequired(true).setMinValue(1))
            .addStringOptions((o) => o.setName('motivo').setDescription(moxi.translate('moderation:OPT_REASON', 'es-ES') || 'Motivo').setRequired(false))
        )

        .addSubcommands((sub) =>
            sub
                .setName('unban')
                .setDescription(moxi.translate('moderation:CMD_UNBAN_DESC', 'es-ES') || `${EMOJIS.check} Desbanea a un usuario por ID y restituye su acceso.`)
            .addStringOptions((o) => o.setName('id').setDescription(moxi.translate('moderation:OPT_ID_USER', 'es-ES') || 'ID del usuario').setRequired(true))
            .addStringOptions((o) => o.setName('motivo').setDescription(moxi.translate('moderation:OPT_REASON', 'es-ES') || 'Motivo').setRequired(false))
        )

        .addSubcommands((sub) =>
            sub
                .setName('warn')
                .setDescription(moxi.translate('moderation:CMD_WARN_DESC', 'es-ES') || `${EMOJIS.info} Advierte a un usuario con un aviso oficial.`)
            .addUserOptions((o) => o.setName('usuario').setDescription(moxi.translate('moderation:OPT_USER', 'es-ES') || 'Usuario').setRequired(true))
            .addStringOptions((o) => o.setName('motivo').setDescription(moxi.translate('moderation:OPT_REASON', 'es-ES') || 'Motivo').setRequired(false))
        )

        .addSubcommands((sub) =>
            sub
                .setName('mute')
                .setDescription(moxi.translate('moderation:CMD_MUTE_DESC', 'es-ES') || `${EMOJIS.noEntry} Silencia temporalmente a un usuario.`)
            .addUserOptions((o) => o.setName('usuario').setDescription(moxi.translate('moderation:OPT_USER', 'es-ES') || 'Usuario').setRequired(true))
            .addStringOptions((o) => o.setName('motivo').setDescription(moxi.translate('moderation:OPT_REASON', 'es-ES') || 'Motivo').setRequired(false))
        )

        .addSubcommands((sub) =>
            sub
                .setName('unmute')
                .setDescription(moxi.translate('moderation:CMD_UNMUTE_DESC', 'es-ES') || `${EMOJIS.check} Quita el silencio a un usuario y restaura su voz.`)
            .addUserOptions((o) => o.setName('usuario').setDescription(moxi.translate('moderation:OPT_USER', 'es-ES') || 'Usuario').setRequired(true))
        ),

    async run(Moxi, interaction) {
        const lang = await moxi.guildLang(interaction.guildId || interaction.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
        const sub = interaction.options.getSubcommand();
        const requesterId = interaction.user?.id;
        const guildId = interaction.guildId || interaction.guild?.id;

        debugHelper.log('mod', 'run start', { guildId, requesterId, sub });

        if (!interaction.guild) {
            return interaction.reply({
                ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, text: moxi.translate('GUILD_ONLY', lang) })),
                ephemeral: true,
            });
        }

        if (sub === 'ban') {
            debugHelper.log('ban', 'slash execute start', { guildId, requesterId });
            const perm = await ensurePerms(interaction, lang, {
                userBit: PermissionsBitField.Flags.BanMembers,
                userKey: 'BanMembers',
                botBit: PermissionsBitField.Flags.BanMembers,
                botKey: 'BanMembers',
            });
            if (!perm.ok) {
                debugHelper.warn('ban', 'permission check failed', { guildId, reason: perm.msg });
                return interaction.reply({
                    ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, text: perm.msg })),
                    ephemeral: true,
                });
            }

            const user = interaction.options.getUser('usuario', true);
            const reason = interaction.options.getString('motivo')?.trim() || t(lang, 'MOD_BAN_NOREASON');

            const token = putPending(Moxi, { action: 'ban', guildId: interaction.guildId, requesterId, targetId: user.id, reason });
            debugHelper.log('ban', 'confirm prompt', { guildId, targetId: user.id, reason });
            return interaction.reply(
                buildConfirmV2({
                    lang,
                    title: moxi.translate('moderation:CMD_BAN_DESC', lang) || `${EMOJIS.shield} Baneo`,
                    lines: [
                        `${EMOJIS.warning} <@${user.id}>`,
                        `${t(lang, 'LABEL_REASON')} ${reason}`,
                        `\n${t(lang, 'CONFIRM_ACTION')}`,
                    ],
                    confirmCustomId: `modv2:confirm:${token}`,
                    cancelCustomId: `modv2:cancel:${token}`,
                    confirmStyle: 4,
                    ephemeral: true,
                })
            );
        }

        if (sub === 'kick') {
            debugHelper.log('kick', 'slash execute start', { guildId, requesterId });
            const perm = await ensurePerms(interaction, lang, {
                userBit: PermissionsBitField.Flags.KickMembers,
                userKey: 'KickMembers',
                botBit: PermissionsBitField.Flags.KickMembers,
                botKey: 'KickMembers',
            });
            if (!perm.ok) {
                debugHelper.warn('kick', 'permission check failed', { guildId, reason: perm.msg });
                return interaction.reply({
                    ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, text: perm.msg })),
                    ephemeral: true,
                });
            }

            const user = interaction.options.getUser('usuario', true);
            const member = await fetchMember(interaction, user);
            if (!member) {
                debugHelper.warn('kick', 'member not found', { guildId, targetId: user.id });
                return interaction.reply({
                    ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, text: t(lang, 'MOD_KICK_NOUSER') })),
                    ephemeral: true,
                });
            }
            if (!member.kickable) {
                debugHelper.warn('kick', 'member not kickable', { guildId, targetId: member.id });
                return interaction.reply({
                    ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, text: t(lang, 'MOD_KICK_NOTKICKABLE') })),
                    ephemeral: true,
                });
            }

            const reason = interaction.options.getString('motivo')?.trim() || t(lang, 'MOD_KICK_NOREASON');

            const token = putPending(Moxi, { action: 'kick', guildId: interaction.guildId, requesterId, targetId: user.id, reason });
            debugHelper.log('kick', 'confirm prompt', { guildId, targetId: user.id, reason });
            return interaction.reply(
                buildConfirmV2({
                    lang,
                    title: moxi.translate('moderation:CMD_KICK_DESC', lang) || `${EMOJIS.person} Expulsión`,
                    lines: [
                        `${EMOJIS.warning} <@${user.id}>`,
                        `${t(lang, 'LABEL_REASON')} ${reason}`,
                        `\n${t(lang, 'CONFIRM_ACTION')}`,
                    ],
                    confirmCustomId: `modv2:confirm:${token}`,
                    cancelCustomId: `modv2:cancel:${token}`,
                    confirmStyle: 4,
                    ephemeral: true,
                })
            );
        }

        if (sub === 'timeout') {
            debugHelper.log('timeout', 'slash execute start', { guildId, requesterId });
            const perm = await ensurePerms(interaction, lang, {
                userBit: PermissionsBitField.Flags.ModerateMembers,
                userKey: 'ModerateMembers',
                botBit: PermissionsBitField.Flags.ModerateMembers,
                botKey: 'ModerateMembers',
            });
            if (!perm.ok) {
                debugHelper.warn('timeout', 'permission check failed', { guildId, reason: perm.msg });
                return interaction.reply({
                    ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, text: perm.msg })),
                    ephemeral: true,
                });
            }

            const user = interaction.options.getUser('usuario', true);
            const member = await fetchMember(interaction, user);
            if (!member) {
                debugHelper.warn('timeout', 'member not found', { guildId, targetId: user.id });
                return interaction.reply({
                    ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, text: t(lang, 'MOD_TIMEOUT_NOUSER') })),
                    ephemeral: true,
                });
            }
            if (!member.moderatable) {
                debugHelper.warn('timeout', 'member not moderatable', { guildId, targetId: member.id });
                return interaction.reply({
                    ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, text: t(lang, 'MOD_TIMEOUT_NOTTIMEOUTABLE') })),
                    ephemeral: true,
                });
            }

            const minutes = interaction.options.getInteger('minutos', true);
            const reason = interaction.options.getString('motivo')?.trim() || t(lang, 'MOD_TIMEOUT_NOREASON');

            const token = putPending(Moxi, { action: 'timeout', guildId: interaction.guildId, requesterId, targetId: user.id, minutes, reason });
            debugHelper.log('timeout', 'confirm prompt', { guildId, targetId: user.id, minutes, reason });
            return interaction.reply(
                buildConfirmV2({
                    lang,
                    title: moxi.translate('moderation:CMD_TIMEOUT_DESC', lang) || `${EMOJIS.hourglass} Timeout`,
                    lines: [
                        `${EMOJIS.warning} <@${user.id}>`,
                        `${t(lang, 'LABEL_MINUTES')} ${minutes}`,
                        `${t(lang, 'LABEL_REASON')} ${reason}`,
                        `\n${t(lang, 'CONFIRM_ACTION')}`,
                    ],
                    confirmCustomId: `modv2:confirm:${token}`,
                    cancelCustomId: `modv2:cancel:${token}`,
                    confirmStyle: 4,
                    ephemeral: true,
                })
            );
        }

        if (sub === 'unban') {
            debugHelper.log('unban', 'slash execute start', { guildId, requesterId });
            const perm = await ensurePerms(interaction, lang, {
                userBit: PermissionsBitField.Flags.BanMembers,
                userKey: 'BanMembers',
                botBit: PermissionsBitField.Flags.BanMembers,
                botKey: 'BanMembers',
            });
            if (!perm.ok) {
                debugHelper.warn('unban', 'permission check failed', { guildId, reason: perm.msg });
                return interaction.reply({
                    ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, text: perm.msg })),
                    ephemeral: true,
                });
            }

            const userId = String(interaction.options.getString('id', true)).trim();
            if (!/^\d{15,20}$/.test(userId)) {
                debugHelper.warn('unban', 'invalid target id', { guildId, input: userId });
                return interaction.reply({
                    ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, text: t(lang, 'MOD_UNBAN_NOUSER') })),
                    ephemeral: true,
                });
            }

            const reason = interaction.options.getString('motivo')?.trim() || t(lang, 'MOD_BAN_NOREASON');

            const token = putPending(Moxi, { action: 'unban', guildId: interaction.guildId, requesterId, targetId: userId, reason });
            debugHelper.log('unban', 'confirm prompt', { guildId, targetId: userId, reason });
            return interaction.reply(
                buildConfirmV2({
                    lang,
                    title: moxi.translate('moderation:CMD_UNBAN_DESC', lang) || `${EMOJIS.check} Desbaneo`,
                    lines: [
                        `${EMOJIS.warning} ID: \`${userId}\``,
                        `**Motivo:** ${reason}`,
                        `\n${t(lang, 'CONFIRM_ACTION')}`,
                    ],
                    confirmCustomId: `modv2:confirm:${token}`,
                    cancelCustomId: `modv2:cancel:${token}`,
                    confirmStyle: 3,
                    ephemeral: true,
                })
            );
        }

        if (sub === 'warn') {
            debugHelper.log('warn', 'slash execute start', { guildId, requesterId });
            const perm = await ensurePerms(interaction, lang, {
                userBit: PermissionsBitField.Flags.ModerateMembers,
                userKey: 'ModerateMembers',
            });
            if (!perm.ok) {
                debugHelper.warn('warn', 'permission check failed', { guildId, reason: perm.msg });
                return interaction.reply({
                    ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, text: perm.msg })),
                    ephemeral: true,
                });
            }

            const user = interaction.options.getUser('usuario', true);
            const member = await fetchMember(interaction, user);
            if (!member) {
                debugHelper.warn('warn', 'member not found', { guildId, targetId: user.id });
                return interaction.reply({
                    ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, text: t(lang, 'MOD_WARN_NOUSER') })),
                    ephemeral: true,
                });
            }

            const reason = interaction.options.getString('motivo')?.trim() || t(lang, 'MOD_WARN_NOREASON');

            const token = putPending(Moxi, { action: 'warn', guildId: interaction.guildId, requesterId, targetId: user.id, reason });
            debugHelper.log('warn', 'confirm prompt', { guildId, targetId: user.id, reason });
            return interaction.reply(
                buildConfirmV2({
                    lang,
                    title: moxi.translate('moderation:CMD_WARN_DESC', lang) || `${EMOJIS.info} Advertencia`,
                    lines: [
                        `${EMOJIS.warning} <@${user.id}>`,
                        `${t(lang, 'LABEL_REASON')} ${reason}`,
                        `\n${t(lang, 'CONFIRM_ACTION')}`,
                    ],
                    confirmCustomId: `modv2:confirm:${token}`,
                    cancelCustomId: `modv2:cancel:${token}`,
                    confirmStyle: 1,
                    ephemeral: true,
                })
            );
        }

        if (sub === 'mute') {
            debugHelper.log('mute', 'slash execute start', { guildId, requesterId });
            const perm = await ensurePerms(interaction, lang, {
                userBit: PermissionsBitField.Flags.MuteMembers,
                userKey: 'MuteMembers',
                botBit: PermissionsBitField.Flags.MuteMembers,
                botKey: 'MuteMembers',
            });
            if (!perm.ok) {
                debugHelper.warn('mute', 'permission check failed', { guildId, reason: perm.msg });
                return interaction.reply({
                    ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, text: perm.msg })),
                    ephemeral: true,
                });
            }

            const user = interaction.options.getUser('usuario', true);
            const member = await fetchMember(interaction, user);
            if (!member) {
                debugHelper.warn('mute', 'member not found', { guildId, targetId: user.id });
                return interaction.reply({
                    ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, text: t(lang, 'MOD_MUTE_NOUSER') })),
                    ephemeral: true,
                });
            }

            const reason = interaction.options.getString('motivo')?.trim() || t(lang, 'MOD_MUTE_NOREASON');

            if (!member.voice?.channel) {
                debugHelper.warn('mute', 'member not voice muted', { guildId, targetId: member.id });
                return interaction.reply({
                    ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, text: t(lang, 'MOD_MUTE_NOTMUTABLE') })),
                    ephemeral: true,
                });
            }

            const token = putPending(Moxi, { action: 'mute', guildId: interaction.guildId, requesterId, targetId: user.id, reason });
            debugHelper.log('mute', 'confirm prompt', { guildId, targetId: user.id, reason });
            return interaction.reply(
                buildConfirmV2({
                    lang,
                    title: moxi.translate('moderation:CMD_MUTE_DESC', lang) || `${EMOJIS.noEntry} Silenciar`,
                    lines: [
                        `${EMOJIS.warning} <@${user.id}>`,
                        `${t(lang, 'LABEL_REASON')} ${reason}`,
                        `\n${t(lang, 'CONFIRM_ACTION')}`,
                    ],
                    confirmCustomId: `modv2:confirm:${token}`,
                    cancelCustomId: `modv2:cancel:${token}`,
                    confirmStyle: 4,
                    ephemeral: true,
                })
            );
        }

        if (sub === 'unmute') {
            debugHelper.log('unmute', 'slash execute start', { guildId, requesterId });
            const perm = await ensurePerms(interaction, lang, {
                userBit: PermissionsBitField.Flags.MuteMembers,
                userKey: 'MuteMembers',
                botBit: PermissionsBitField.Flags.MuteMembers,
                botKey: 'MuteMembers',
            });
            if (!perm.ok) {
                debugHelper.warn('unmute', 'permission check failed', { guildId, reason: perm.msg });
                return interaction.reply({
                    ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, text: perm.msg })),
                    ephemeral: true,
                });
            }

            const user = interaction.options.getUser('usuario', true);
            const member = await fetchMember(interaction, user);
            if (!member) {
                debugHelper.warn('unmute', 'member not found', { guildId, targetId: user.id });
                return interaction.reply({
                    ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, text: t(lang, 'MOD_UNMUTE_NOUSER') })),
                    ephemeral: true,
                });
            }

            if (!member.voice?.channel) {
                debugHelper.warn('unmute', 'member not voice muted', { guildId, targetId: member.id });
                return interaction.reply({
                    ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, text: t(lang, 'MOD_UNMUTE_NOTUNMUTABLE') })),
                    ephemeral: true,
                });
            }

            const token = putPending(Moxi, { action: 'unmute', guildId: interaction.guildId, requesterId, targetId: user.id });
            debugHelper.log('unmute', 'confirm prompt', { guildId, targetId: user.id });
            return interaction.reply(
                buildConfirmV2({
                    lang,
                    title: moxi.translate('moderation:CMD_UNMUTE_DESC', lang) || `${EMOJIS.check} Quitar silencio`,
                    lines: [
                        `${EMOJIS.warning} <@${user.id}>`,
                        `\n${t(lang, 'CONFIRM_ACTION')}`,
                    ],
                    confirmCustomId: `modv2:confirm:${token}`,
                    cancelCustomId: `modv2:cancel:${token}`,
                    confirmStyle: 3,
                    ephemeral: true,
                })
            );
        }

        return interaction.reply({
            ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, text: moxi.translate('ERROR', lang) })),
            ephemeral: true,
        });
    },
};
