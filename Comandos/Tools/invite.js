const { ContainerBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');

const { Bot } = require('../../Config');
const moxi = require('../../i18n');
const debugHelper = require('../../Util/debugHelper');
const { getOrCreatePermanentInvite, isInviteCreatableChannel, pickDefaultInviteChannel, readStoredInviteConfig } = require('../../Util/permanentInvite');

module.exports = {
    name: 'invite',
    alias: ['inv', 'invitacion', 'invitación'],
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_HERRAMIENTAS', lang);
    },
    usage: 'invite [#canal|canalId]',
    description: (lang = 'es-ES') =>
    (moxi.translate('INVITE_CMD_DESC', lang) !== 'INVITE_CMD_DESC'
        ? moxi.translate('INVITE_CMD_DESC', lang)
        : 'Crea una invitación permanente del servidor'),

    async execute(Moxi, message, args) {
        if (!message.guild) return;

        const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
        const year = new Date().getFullYear();

        const t = (key, fallback) => {
            const out = moxi.translate(key, lang);
            return out && out !== key ? out : fallback;
        };

        const member = message.member;
        const allowed =
            member?.permissions?.has(PermissionFlagsBits.ManageGuild) ||
            member?.permissions?.has(PermissionFlagsBits.CreateInstantInvite);

        const containerBase = () => new ContainerBuilder().setAccentColor(Bot.AccentColor);

        if (!allowed) {
            const container = containerBase()
                .addTextDisplayComponents((c) => c.setContent(`# ❌ ${t('INVITE_NO_PERMS', 'No tienes permisos para crear invitaciones.')}`))
                .addTextDisplayComponents((c) => c.setContent(`© ${Moxi.user.username} • ${year}`));

            return message.reply({
                content: '',
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { repliedUser: false },
            });
        }

        const stored = await readStoredInviteConfig(message.guild.id).catch(() => null);

        const raw = Array.isArray(args) ? args[0] : null;
        let channel = stored?.channelId ? message.guild.channels.cache.get(stored.channelId) : null;

        if (channel && !isInviteCreatableChannel(channel)) channel = null;

        // Solo respetar el canal de args si NO existe una invitación ya guardada.
        if (!channel) {
            channel = message.mentions?.channels?.first() || null;
            if (!channel && raw && message.guild.channels?.cache) {
                const id = String(raw).replace(/[<#>]/g, '');
                channel = message.guild.channels.cache.get(id) || null;
            }
            if (channel && !isInviteCreatableChannel(channel)) channel = null;
        }

        if (!channel) channel = pickDefaultInviteChannel(message.guild);

        if (!channel) {
            const container = containerBase()
                .addTextDisplayComponents((c) => c.setContent(`# ❌ ${t('INVITE_NO_CHANNEL', 'No encontré un canal válido para crear la invitación.')}`))
                .addTextDisplayComponents((c) => c.setContent(`© ${Moxi.user.username} • ${year}`));

            return message.reply({
                content: '',
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { repliedUser: false },
            });
        }

        debugHelper.log('invite', 'command start', {
            guildId: message.guildId,
            requesterId: message.author?.id,
            channelId: channel.id,
        });

        try {
            const result = await getOrCreatePermanentInvite({
                guild: message.guild,
                channel,
                reason: `Permanent invite requested by ${message.author?.id || 'unknown'}`,
                requestedByUserId: message.author?.id || null,
                requestedByTag: message.author?.tag || message.author?.username || null,
            });

            const invite = result?.invite;
            const url = invite?.url || (invite?.code ? `https://discord.gg/${invite.code}` : null);
            const createdText = result?.created ? t('INVITE_CREATED', 'Creada ahora') : t('INVITE_REUSED', 'Reutilizada (ya existía)');

            const container = containerBase()
                .addTextDisplayComponents((c) => c.setContent(`# ✅ ${t('INVITE_OK_TITLE', 'Invitación permanente creada')}`))
                .addSeparatorComponents((s) => s.setDivider(true))
                .addTextDisplayComponents((c) =>
                    c.setContent(
                        `${t('INVITE_OK_CHANNEL', 'Canal')}: <#${channel.id}>\n` +
                        `${t('INVITE_OK_LINK', 'Enlace')}: ${url || t('INVITE_OK_LINK_MISSING', 'No disponible')}\n` +
                        `${t('INVITE_OK_STATUS', 'Estado')}: ${createdText}\n` +
                        `${t('INVITE_OK_REQUESTED_BY', 'Solicitada por')}: <@${message.author.id}>`
                    )
                )
                .addSeparatorComponents((s) => s.setDivider(true))
                .addTextDisplayComponents((c) => c.setContent(`© ${Moxi.user.username} • ${year}`));

            return message.reply({
                content: '',
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { repliedUser: false },
            });
        } catch (err) {
            debugHelper.warn('invite', 'command failed', { guildId: message.guildId, requesterId: message.author?.id, err: String(err?.message || err) });

            const container = containerBase()
                .addTextDisplayComponents((c) => c.setContent(`# ❌ ${t('INVITE_ERR_TITLE', 'No pude crear la invitación')}`))
                .addSeparatorComponents((s) => s.setDivider(true))
                .addTextDisplayComponents((c) =>
                    c.setContent(
                        t(
                            'INVITE_ERR_BODY',
                            'Asegúrate de que el bot tenga permiso "Crear invitación" en el canal, y si quieres reutilizar invites existentes, también "Gestionar servidor".'
                        )
                    )
                )
                .addSeparatorComponents((s) => s.setDivider(true))
                .addTextDisplayComponents((c) => c.setContent(`© ${Moxi.user.username} • ${year}`));

            return message.reply({
                content: '',
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { repliedUser: false },
            });
        }
    },
};
