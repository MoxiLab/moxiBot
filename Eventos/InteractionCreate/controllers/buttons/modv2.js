module.exports = async function modV2Buttons(interaction, Moxi, logger) {
    if (!interaction.customId || !interaction.customId.startsWith('modv2:')) return false;

    const { EMOJIS } = require('../../../../Util/emojis');
    const { Bot } = require('../../../../Config');
    const { buildNoticeContainer } = require('../../../../Util/v2Notice');
    const moxi = require('../../../../i18n');
    const { ContainerBuilder, MessageFlags, PermissionsBitField } = require('discord.js');
    const { sendAuditLog } = require('../../../../Util/audit');

    const guildId = interaction.guildId || interaction.guild?.id;
    const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

    const parts = String(interaction.customId).split(':');
    const intent = parts[1];
    const token = parts[2];

    const store = Moxi.__modV2Pending;
    const state = store && token ? store.get(token) : null;

    const mt = (key, vars) => moxi.translate(`moderation:${key}`, lang, vars);

    const buildResultV2 = (text) => {
        const container = new ContainerBuilder()
            .setAccentColor(Bot.AccentColor)
            .addTextDisplayComponents(c => c.setContent(text));
        return { content: '', components: [container], flags: MessageFlags.IsComponentsV2 };
    };

    if (!state) {
        try {
            await interaction.reply({
                content: '',
                components: [buildNoticeContainer({ emoji: EMOJIS.cross, text: `${EMOJIS.cross} ${moxi.translate('ERROR', lang)}` })],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            });
        } catch { }
        return true;
    }

    if (interaction.user?.id !== state.requesterId) {
        await interaction.reply({
            content: '',
            components: [buildNoticeContainer({ emoji: EMOJIS.cross, text: `${EMOJIS.cross} ${moxi.translate('NO_PERMISSION', lang)}` })],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        }).catch(() => { });
        return true;
    }

    // Consume token on first click to prevent double actions
    try { store.delete(token); } catch { }

    if (intent === 'cancel') {
        await interaction.update(buildResultV2(`${EMOJIS.cross} ${moxi.translate('AUTONUKE_CANCELLED', lang) || 'Operación cancelada.'}`)).catch(() => { });
        return true;
    }

    const hasPerm = (perms, bit) => {
        try { return perms?.has?.(bit); } catch { return false; }
    };

    const missingPerm = (permKey) => moxi.translate('MISSING_PERMISSION', lang, {
        PERMISSIONS: moxi.translate(`permissions:${permKey}`, lang),
        guild: interaction.guild?.name || 'este servidor',
    });

    const ensurePerms = async ({ userBit, userKey, botBit, botKey }) => {
        if (userBit && !hasPerm(interaction.memberPermissions, userBit)) {
            return { ok: false, msg: missingPerm(userKey) };
        }
        const me = interaction.guild?.members?.me;
        if (botBit && !hasPerm(me?.permissions, botBit)) {
            return { ok: false, msg: missingPerm(botKey) };
        }
        return { ok: true };
    };

    const fetchMemberById = async (userId) => {
        if (!userId) return null;
        try { return await interaction.guild.members.fetch(userId); } catch { return null; }
    };

    const action = state.action;
    const targetId = state.targetId;
    const reason = state.reason;
    const minutes = state.minutes;

    try {
        if (!interaction.guild) {
            await interaction.update(buildResultV2(`${EMOJIS.cross} ${moxi.translate('GUILD_ONLY', lang)}`)).catch(() => { });
            return true;
        }

        if (action === 'ban') {
            const perm = await ensurePerms({
                userBit: PermissionsBitField.Flags.BanMembers,
                userKey: 'BanMembers',
                botBit: PermissionsBitField.Flags.BanMembers,
                botKey: 'BanMembers',
            });
            if (!perm.ok) return await interaction.update(buildResultV2(`${EMOJIS.cross} ${perm.msg}`));
            await interaction.guild.members.ban(targetId, { reason });
            await sendAuditLog({
                client: interaction.client,
                guild: interaction.guild,
                guildId,
                action,
                moderatorId: interaction.user?.id,
                targetId,
                reason,
                fallbackLang: lang,
            });
            await interaction.update(buildResultV2(`${EMOJIS.check} ${mt('MOD_BAN_SUCCESS', { user: `<@${targetId}>`, reason: reason || mt('MOD_BAN_NOREASON') })}`));
            return true;
        }

        if (action === 'kick') {
            const perm = await ensurePerms({
                userBit: PermissionsBitField.Flags.KickMembers,
                userKey: 'KickMembers',
                botBit: PermissionsBitField.Flags.KickMembers,
                botKey: 'KickMembers',
            });
            if (!perm.ok) return await interaction.update(buildResultV2(`${EMOJIS.cross} ${perm.msg}`));
            const member = await fetchMemberById(targetId);
            if (!member) return await interaction.update(buildResultV2(`${EMOJIS.cross} ${mt('MOD_KICK_NOUSER')}`));
            if (!member.kickable) return await interaction.update(buildResultV2(`${EMOJIS.cross} ${mt('MOD_KICK_NOTKICKABLE')}`));
            await member.kick(reason || mt('MOD_KICK_NOREASON'));
            await sendAuditLog({
                client: interaction.client,
                guild: interaction.guild,
                guildId,
                action,
                moderatorId: interaction.user?.id,
                targetId,
                reason,
                fallbackLang: lang,
            });
            await interaction.update(buildResultV2(`${EMOJIS.check} ${mt('MOD_KICK_SUCCESS', { user: `<@${targetId}>`, reason: reason || mt('MOD_KICK_NOREASON') })}`));
            return true;
        }

        if (action === 'timeout') {
            const perm = await ensurePerms({
                userBit: PermissionsBitField.Flags.ModerateMembers,
                userKey: 'ModerateMembers',
                botBit: PermissionsBitField.Flags.ModerateMembers,
                botKey: 'ModerateMembers',
            });
            if (!perm.ok) return await interaction.update(buildResultV2(`${EMOJIS.cross} ${perm.msg}`));
            const member = await fetchMemberById(targetId);
            if (!member) return await interaction.update(buildResultV2(`${EMOJIS.cross} ${mt('MOD_TIMEOUT_NOUSER')}`));
            if (!member.moderatable) return await interaction.update(buildResultV2(`${EMOJIS.cross} ${mt('MOD_TIMEOUT_NOTTIMEOUTABLE')}`));
            const mins = Number(minutes) || 0;
            await member.timeout(mins * 60 * 1000, reason || mt('MOD_TIMEOUT_NOREASON'));
            await sendAuditLog({
                client: interaction.client,
                guild: interaction.guild,
                guildId,
                action,
                moderatorId: interaction.user?.id,
                targetId,
                reason,
                fallbackLang: lang,
            });
            await interaction.update(buildResultV2(`${EMOJIS.check} ${mt('MOD_TIMEOUT_SUCCESS', { user: `<@${targetId}>`, minutes: mins, reason: reason || mt('MOD_TIMEOUT_NOREASON') })}`));
            return true;
        }

        if (action === 'unban') {
            const perm = await ensurePerms({
                userBit: PermissionsBitField.Flags.BanMembers,
                userKey: 'BanMembers',
                botBit: PermissionsBitField.Flags.BanMembers,
                botKey: 'BanMembers',
            });
            if (!perm.ok) return await interaction.update(buildResultV2(`${EMOJIS.cross} ${perm.msg}`));
            const ban = await interaction.guild.bans.fetch(targetId).catch(() => null);
            if (!ban) return await interaction.update(buildResultV2(`${EMOJIS.cross} ${mt('MOD_UNBAN_NOTFOUND')}`));
            await interaction.guild.members.unban(targetId, reason || mt('MOD_BAN_NOREASON'));
            await sendAuditLog({
                client: interaction.client,
                guild: interaction.guild,
                guildId,
                action,
                moderatorId: interaction.user?.id,
                targetId,
                reason,
                fallbackLang: lang,
            });
            await interaction.update(buildResultV2(`${EMOJIS.check} ${mt('MOD_UNBAN_SUCCESS', { user: `<@${targetId}>` })}`));
            return true;
        }

        if (action === 'warn') {
            const perm = await ensurePerms({
                userBit: PermissionsBitField.Flags.ModerateMembers,
                userKey: 'ModerateMembers',
            });
            if (!perm.ok) return await interaction.update(buildResultV2(`${EMOJIS.cross} ${perm.msg}`));
            const member = await fetchMemberById(targetId);
            if (!member) return await interaction.update(buildResultV2(`${EMOJIS.cross} ${mt('MOD_WARN_NOUSER')}`));
            try {
                await member.user.send(mt('MOD_WARN_SUCCESS', { user: `<@${targetId}>`, reason: reason || mt('MOD_WARN_NOREASON') }));
            } catch { }

            await sendAuditLog({
                client: interaction.client,
                guild: interaction.guild,
                guildId,
                action,
                moderatorId: interaction.user?.id,
                targetId,
                reason,
                fallbackLang: lang,
            });
            await interaction.update(buildResultV2(`${EMOJIS.check} ${mt('MOD_WARN_SUCCESS', { user: `<@${targetId}>`, reason: reason || mt('MOD_WARN_NOREASON') })}`));
            return true;
        }

        if (action === 'mute') {
            const perm = await ensurePerms({
                userBit: PermissionsBitField.Flags.MuteMembers,
                userKey: 'MuteMembers',
                botBit: PermissionsBitField.Flags.MuteMembers,
                botKey: 'MuteMembers',
            });
            if (!perm.ok) return await interaction.update(buildResultV2(`${EMOJIS.cross} ${perm.msg}`));
            const member = await fetchMemberById(targetId);
            if (!member) return await interaction.update(buildResultV2(`${EMOJIS.cross} ${mt('MOD_MUTE_NOUSER')}`));
            if (!member.voice?.channel) return await interaction.update(buildResultV2(`${EMOJIS.cross} ${mt('MOD_MUTE_NOTMUTABLE')}`));
            await member.voice.setMute(true, reason || mt('MOD_MUTE_NOREASON'));
            await sendAuditLog({
                client: interaction.client,
                guild: interaction.guild,
                guildId,
                action,
                moderatorId: interaction.user?.id,
                targetId,
                reason,
                fallbackLang: lang,
            });
            await interaction.update(buildResultV2(`${EMOJIS.check} ${mt('MOD_MUTE_SUCCESS', { user: `<@${targetId}>`, reason: reason || mt('MOD_MUTE_NOREASON') })}`));
            return true;
        }

        if (action === 'unmute') {
            const perm = await ensurePerms({
                userBit: PermissionsBitField.Flags.MuteMembers,
                userKey: 'MuteMembers',
                botBit: PermissionsBitField.Flags.MuteMembers,
                botKey: 'MuteMembers',
            });
            if (!perm.ok) return await interaction.update(buildResultV2(`${EMOJIS.cross} ${perm.msg}`));
            const member = await fetchMemberById(targetId);
            if (!member) return await interaction.update(buildResultV2(`${EMOJIS.cross} ${mt('MOD_UNMUTE_NOUSER')}`));
            if (!member.voice?.channel) return await interaction.update(buildResultV2(`${EMOJIS.cross} ${mt('MOD_UNMUTE_NOTUNMUTABLE')}`));
            await member.voice.setMute(false);
            await sendAuditLog({
                client: interaction.client,
                guild: interaction.guild,
                guildId,
                action,
                moderatorId: interaction.user?.id,
                targetId,
                reason,
                fallbackLang: lang,
            });
            await interaction.update(buildResultV2(`${EMOJIS.check} ${mt('MOD_UNMUTE_SUCCESS', { user: `<@${targetId}>` })}`));
            return true;
        }

        await interaction.update(buildResultV2(`${EMOJIS.cross} ${moxi.translate('ERROR', lang)}`)).catch(() => { });
        return true;
    } catch (e) {
        logger?.error?.(e);
        await interaction.update(buildResultV2(`${EMOJIS.cross} ${moxi.translate('ERROR', lang)}`)).catch(() => { });
        return true;
    }
};
