const {
    SlashCommandBuilder,
    ContainerBuilder,
    MessageFlags,
    PermissionFlagsBits,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');

const { Bot } = require('../../Config');
const moxi = require('../../i18n');
const debugHelper = require('../../Util/debugHelper');
const { readStoredInviteConfig, getOrCreatePermanentInvite, pickDefaultInviteChannel } = require('../../Util/permanentInvite');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('portal')
        .setDescription('Muestra el portal del servidor (enlace oficial de invitación)')
        .addBooleanOption((opt) =>
            opt
                .setName('publico')
                .setDescription('Mostrar el portal públicamente (por defecto: oculto)')
                .setRequired(false)
        ),

    async run(Moxi, interaction) {
        if (!interaction.inGuild?.() || !interaction.guild) {
            return interaction.reply({
                content: 'Este comando solo funciona en servidores.',
                flags: MessageFlags.Ephemeral,
            });
        }

        const guild = interaction.guild;
        const guildId = interaction.guildId;
        const requesterId = interaction.user?.id;

        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const year = new Date().getFullYear();

        const t = (key, fallback) => {
            const out = moxi.translate(key, lang);
            return out && out !== key ? out : fallback;
        };

        const publicReply = interaction.options.getBoolean('publico') === true;

        // Puedes abrir el portal aunque no tengas permisos; pero si NO existe invite y hay que crearla,
        // entonces requerimos permisos al usuario y al bot.
        const memberPerms = interaction.memberPermissions;

        debugHelper.log('portal', 'slash start', { guildId, requesterId, publicReply });

        let stored = await readStoredInviteConfig(guild.id).catch(() => null);

        // Resolver invite oficial.
        let inviteUrl = null;
        let statusText = '';
        let requestedBy = null;

        if (stored?.code) {
            inviteUrl = `https://discord.gg/${stored.code}`;
            statusText = t('PORTAL_STATUS_REUSED', 'Reutilizando invitación oficial');
            requestedBy = stored.requestedByUserId ? `<@${stored.requestedByUserId}>` : (stored.requestedByTag || null);
        } else {
            // Si no hay guardada, podemos crear UNA (esto inicializa el sistema).
            const allowed =
                memberPerms?.has(PermissionFlagsBits.ManageGuild) ||
                memberPerms?.has(PermissionFlagsBits.CreateInstantInvite);

            if (!allowed) {
                const container = new ContainerBuilder()
                    .setAccentColor(Bot.AccentColor)
                    .addTextDisplayComponents((c) =>
                        c.setContent(`# ❌ ${t('PORTAL_NO_PERMS', 'No hay invitación oficial creada. Necesitas permisos para crearla.')}`)
                    )
                    .addTextDisplayComponents((c) => c.setContent(`© ${Moxi.user.username} • ${year}`));

                return interaction.reply({
                    content: '',
                    components: [container],
                    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
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

                return interaction.reply({
                    content: '',
                    components: [container],
                    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
                });
            }

            const result = await getOrCreatePermanentInvite({
                guild,
                channel,
                reason: `Portal invite init by ${interaction.user?.id || 'unknown'}`,
                requestedByUserId: interaction.user?.id || null,
                requestedByTag: interaction.user?.tag || interaction.user?.username || null,
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

            return interaction.reply({
                content: '',
                components: [container],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
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
                row.addComponents(new ButtonBuilder().setLabel(t('PORTAL_BUTTON', 'Abrir portal')).setStyle(ButtonStyle.Link).setURL(inviteUrl))
            )
            .addSeparatorComponents((s) => s.setDivider(true))
            .addTextDisplayComponents((c) => c.setContent(`© ${Moxi.user.username} • ${year}`));

        return interaction.reply({
            content: '',
            components: [portal],
            flags: (publicReply ? 0 : MessageFlags.Ephemeral) | MessageFlags.IsComponentsV2,
        });
    },
};
