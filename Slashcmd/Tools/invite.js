const {
    SlashCommandBuilder,
    ContainerBuilder,
    MessageFlags,
    PermissionFlagsBits,
} = require('discord.js');

const { Bot } = require('../../Config');
const moxi = require('../../i18n');
const debugHelper = require('../../Util/debugHelper');
const { getOrCreatePermanentInvite, isInviteCreatableChannel, pickDefaultInviteChannel, readStoredInviteConfig } = require('../../Util/permanentInvite');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('invite')
        .setDescription('Crea una invitación permanente del servidor')
        .addChannelOption((opt) =>
            opt
                .setName('canal')
                .setDescription('Canal donde se creará la invitación (opcional)')
                .setRequired(false)
        )
        .addBooleanOption((opt) =>
            opt
                .setName('publico')
                .setDescription('Enviar el enlace de forma pública (por defecto: oculto)')
                .setRequired(false)
        ),

    async run(Moxi, interaction) {
        if (!interaction.inGuild?.() || !interaction.guild) {
            return interaction.reply({
                content: 'Este comando solo funciona en servidores.',
                flags: MessageFlags.Ephemeral,
            });
        }

        const guildId = interaction.guildId;
        const requesterId = interaction.user?.id;

        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const year = new Date().getFullYear();

        const t = (key, fallback) => {
            const out = moxi.translate(key, lang);
            return out && out !== key ? out : fallback;
        };

        const containerBase = () => new ContainerBuilder().setAccentColor(Bot.AccentColor);

        const memberPerms = interaction.memberPermissions;
        const allowed =
            memberPerms?.has(PermissionFlagsBits.ManageGuild) ||
            memberPerms?.has(PermissionFlagsBits.CreateInstantInvite);

        if (!allowed) {
            const container = containerBase()
                .addTextDisplayComponents((c) => c.setContent(`# ❌ ${t('INVITE_NO_PERMS', 'No tienes permisos para crear invitaciones.')}`))
                .addTextDisplayComponents((c) => c.setContent(`© ${Moxi.user.username} • ${year}`));

            return interaction.reply({
                content: '',
                components: [container],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            });
        }

        const requestedChannel = interaction.options.getChannel('canal');
        const publicReply = interaction.options.getBoolean('publico') === true;

        // Si ya existe una invitación guardada, NO creamos nuevas aunque el usuario pida canal.
        const stored = await readStoredInviteConfig(interaction.guild.id).catch(() => null);

        let channel = stored?.channelId ? interaction.guild.channels.cache.get(stored.channelId) : null;
        if (channel && !isInviteCreatableChannel(channel)) channel = null;
        if (!channel) {
            channel = requestedChannel;
            if (channel && !isInviteCreatableChannel(channel)) channel = null;
        }
        if (!channel) channel = pickDefaultInviteChannel(interaction.guild);

        if (!channel) {
            const container = containerBase()
                .addTextDisplayComponents((c) => c.setContent(`# ❌ ${t('INVITE_NO_CHANNEL', 'No encontré un canal válido para crear la invitación.')}`))
                .addTextDisplayComponents((c) => c.setContent(`© ${Moxi.user.username} • ${year}`));

            return interaction.reply({
                content: '',
                components: [container],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            });
        }

        debugHelper.log('invite', 'slash start', {
            guildId,
            requesterId,
            channelId: channel.id,
            publicReply,
        });

        try {
            const result = await getOrCreatePermanentInvite({
                guild: interaction.guild,
                channel,
                reason: `Permanent invite requested by ${interaction.user?.id || 'unknown'}`,
                requestedByUserId: interaction.user?.id || null,
                requestedByTag: interaction.user?.tag || interaction.user?.username || null,
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
                        `${t('INVITE_OK_REQUESTED_BY', 'Solicitada por')}: <@${interaction.user.id}>`
                    )
                )
                .addSeparatorComponents((s) => s.setDivider(true))
                .addTextDisplayComponents((c) => c.setContent(`© ${Moxi.user.username} • ${year}`));

            return interaction.reply({
                content: '',
                components: [container],
                flags: (publicReply ? 0 : MessageFlags.Ephemeral) | MessageFlags.IsComponentsV2,
            });
        } catch (err) {
            debugHelper.warn('invite', 'slash failed', { guildId, requesterId, err: String(err?.message || err) });

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

            return interaction.reply({
                content: '',
                components: [container],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            });
        }
    },
};
