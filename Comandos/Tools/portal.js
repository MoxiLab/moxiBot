const { ContainerBuilder, MessageFlags, PermissionFlagsBits, LinkButtonBuilder } = require('discord.js');

const { Bot } = require('../../Config');
const moxi = require('../../i18n');
const debugHelper = require('../../Util/debugHelper');
const { readStoredInviteConfig, getOrCreatePermanentInvite, pickDefaultInviteChannel } = require('../../Util/permanentInvite');

module.exports = {
    name: 'portal',
    alias: ['port', 'serverportal'],
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_HERRAMIENTAS', lang);
    },
    usage: 'portal',
    description: (lang = 'es-ES') =>
    (moxi.translate('PORTAL_CMD_DESC', lang) !== 'PORTAL_CMD_DESC'
        ? moxi.translate('PORTAL_CMD_DESC', lang)
        : 'Muestra el portal del servidor (invitación oficial)'),

    async execute(Moxi, message) {
        if (!message.guild) return;

        const guild = message.guild;

        const lang = await moxi.guildLang(guild?.id, process.env.DEFAULT_LANG || 'es-ES');
        const year = new Date().getFullYear();

        const t = (key, fallback) => {
            const out = moxi.translate(key, lang);
            return out && out !== key ? out : fallback;
        };

        debugHelper.log('portal', 'command start', { guildId: message.guildId, requesterId: message.author?.id });

        let stored = await readStoredInviteConfig(guild.id).catch(() => null);

        let inviteUrl = null;
        let statusText = '';
        let requestedBy = null;

        if (stored?.code) {
            inviteUrl = `https://discord.gg/${stored.code}`;
            statusText = t('PORTAL_STATUS_REUSED', 'Reutilizando invitación oficial');
            requestedBy = stored.requestedByUserId ? `<@${stored.requestedByUserId}>` : (stored.requestedByTag || null);
        } else {
            const allowed =
                message.member?.permissions?.has(PermissionFlagsBits.ManageGuild) ||
                message.member?.permissions?.has(PermissionFlagsBits.CreateInstantInvite);

            if (!allowed) {
                const container = new ContainerBuilder()
                    .setAccentColor(Bot.AccentColor)
                    .addTextDisplayComponents((c) =>
                        c.setContent(`# ❌ ${t('PORTAL_NO_PERMS', 'No hay invitación oficial creada. Necesitas permisos para crearla.')}`)
                    )
                    .addTextDisplayComponents((c) => c.setContent(`© ${Moxi.user.username} • ${year}`));

                return message.reply({
                    content: '',
                    components: [container],
                    flags: MessageFlags.IsComponentsV2,
                    allowedMentions: { repliedUser: false },
                });
            }

            const channel = pickDefaultInviteChannel(guild);
            if (!channel) {
                const container = new ContainerBuilder()
                    .setAccentColor(Bot.AccentColor)
                    .addTextDisplayComponents((c) =>
                        c.setContent(`# ❌ ${t('PORTAL_NO_CHANNEL', 'No encontré un canal válido para crear la invitación oficial.')}`)
                    )
                    .addTextDisplayComponents((c) => c.setContent(`© ${Moxi.user.username} • ${year}`));

                return message.reply({
                    content: '',
                    components: [container],
                    flags: MessageFlags.IsComponentsV2,
                    allowedMentions: { repliedUser: false },
                });
            }

            const result = await getOrCreatePermanentInvite({
                guild,
                channel,
                reason: `Portal invite init by ${message.author?.id || 'unknown'}`,
                requestedByUserId: message.author?.id || null,
                requestedByTag: message.author?.tag || message.author?.username || null,
            });

            const invite = result?.invite;
            inviteUrl = invite?.url || (invite?.code ? `https://discord.gg/${invite.code}` : null);
            statusText = result?.created
                ? t('PORTAL_STATUS_CREATED', 'Invitación oficial creada')
                : t('PORTAL_STATUS_REUSED', 'Reutilizando invitación oficial');
            stored = result?.stored || stored;
            requestedBy = stored?.requestedByUserId ? `<@${stored.requestedByUserId}>` : (stored?.requestedByTag || null);
        }

        if (!inviteUrl) {
            const container = new ContainerBuilder()
                .setAccentColor(Bot.AccentColor)
                .addTextDisplayComponents((c) => c.setContent(`# ❌ ${t('PORTAL_ERR', 'No pude resolver la invitación oficial.')}`))
                .addTextDisplayComponents((c) => c.setContent(`© ${Moxi.user.username} • ${year}`));

            return message.reply({
                content: '',
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { repliedUser: false },
            });
        }

        const portal = new ContainerBuilder()
            .setAccentColor(Bot.AccentColor)
            .addTextDisplayComponents((c) => c.setContent(`# ${t('PORTAL_TITLE', 'Portal del servidor')}`))
            .addSeparatorComponents((s) => s.setDivider(true))
            .addTextDisplayComponents((c) =>
                c.setContent(
                    `${t('PORTAL_GUILD', 'Servidor')}: **${guild.name}**\n` +
                    `${t('PORTAL_INVITE', 'Invitación oficial')}: ${inviteUrl}\n` +
                    `${t('PORTAL_STATUS', 'Estado')}: ${statusText}` +
                    (requestedBy ? `\n${t('PORTAL_REQUESTED_BY', 'Asignada por')}: ${requestedBy}` : '')
                )
            )
            .addActionRowComponents((row) =>
                row.addComponents(new LinkButtonBuilder().setLabel(t('PORTAL_BUTTON', 'Abrir portal')).setURL(inviteUrl))
            )
            .addSeparatorComponents((s) => s.setDivider(true))
            .addTextDisplayComponents((c) => c.setContent(`© ${Moxi.user.username} • ${year}`));

        return message.reply({
            content: '',
            components: [portal],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { repliedUser: false },
        });
    },
};
