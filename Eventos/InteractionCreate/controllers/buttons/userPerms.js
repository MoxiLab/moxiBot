const { ContainerBuilder, MessageFlags } = require('discord.js');
const moxi = require('../../../../i18n');
const { EMOJIS } = require('../../../../Util/emojis');
const { buildNoticeContainer, asV2MessageOptions } = require('../../../../Util/v2Notice');
const Config = require('../../../../Config');
const { Bot } = Config;

function formatPermList(perms) {
    if (!perms || typeof perms.toArray !== 'function') return '—';
    const values = perms.toArray();
    if (!values.length) return '—';
    return values.map(p => `\`${p}\``).join(', ');
}

module.exports = async function userPermsButtons(interaction, Moxi, logger) {
    if (!interaction.customId?.startsWith('user_perms:')) return false;

    const parts = String(interaction.customId || '').split(':');
    const resolvedGuildId = parts[1] || interaction.guildId;
    const targetUserId = parts[2] || interaction.user?.id;
    const lang = await moxi.guildLang(resolvedGuildId, process.env.DEFAULT_LANG || 'es-ES');
    const title = moxi.translate('HELP_PERMISSIONS', lang) || 'Permisos';
    const userLabel = moxi.translate('HELP_PERMISSIONS_USER', lang) || 'User';
    const botLabel = moxi.translate('HELP_PERMISSIONS_BOT', lang) || 'Bot';

    const guild = (interaction.guild && interaction.guild.id === resolvedGuildId ? interaction.guild : null)
        || (resolvedGuildId ? await Moxi.guilds.fetch(resolvedGuildId).catch(() => null) : null);

    if (!guild) {
        await interaction.reply({
            ...asV2MessageOptions(
                buildNoticeContainer({
                    emoji: EMOJIS.cross,
                    title,
                    text: moxi.translate('USERINFO_NOT_FOUND', lang) || 'Guild no encontrada',
                })
            ),
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        }).catch(() => { });
        return true;
    }

    const member = await guild.members.fetch(targetUserId).catch(() => null);
    if (!member) {
        await interaction.reply({
            ...asV2MessageOptions(
                buildNoticeContainer({
                    emoji: EMOJIS.cross,
                    title,
                    text: moxi.translate('USERINFO_NOT_FOUND', lang) || 'Usuario no encontrado',
                })
            ),
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        }).catch(() => { });
        return true;
    }

    const botMember = await guild.members.fetch(Moxi.user.id).catch(() => null);
    const userPerms = formatPermList(member.permissions);
    const botPerms = formatPermList(botMember?.permissions);

    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(c => c.setContent(`# ${EMOJIS.shield} ${title}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c =>
            c.setContent(
                `> **${userLabel}:** ${member.user}\n` +
                `> ${title}: ${userPerms}`
            )
        )
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c =>
            c.setContent(
                `> **${botLabel}:** ${Moxi.user}\n` +
                `> ${title}: ${botPerms}`
            )
        )
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c =>
            c.setContent(`${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`)
        );

    try {
        await interaction.reply({
            content: '',
            components: [container],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        });
    } catch (error) {
        logger?.error?.(error);
    }

    return true;
};