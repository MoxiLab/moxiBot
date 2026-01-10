
const { ContainerBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { Bot } = require('../../Config');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');



function buildUserPermsButton(guildId, userId, lang) {
    if (!guildId || !userId) return null;
    const label = moxi.translate('HELP_PERMISSIONS', lang) || 'Permisos';
    return new ButtonBuilder()
        .setCustomId(`user_perms:${guildId}:${userId}`)
        .setLabel(label)
        .setStyle(ButtonStyle.Secondary);
}


module.exports = {
    name: "user",
    alias: ['user', 'userinfo', 'usuario', 'info'],
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_HERRAMIENTAS', lang);
    },
    usage: 'user [@usuario|ID]',
    get description() { return moxi.translate('commands:CMD_USER_DESC', 'es-ES'); },

    async execute(Moxi, message, args) {
        const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');

        let targetUser = message.mentions.users.first() || message.author;
        if (!targetUser && args[0]) {
            targetUser = await Moxi.users.fetch(args[0]).catch(() => null);
        }
        if (targetUser) {
            targetUser = await Moxi.users.fetch(targetUser.id, { force: true }).catch(() => targetUser);
        }
        if (!targetUser) {
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        text: moxi.translate('USERINFO_NOT_FOUND', lang) || 'Usuario no encontrado',
                    })
                )
            );
        }

        const member = message.guild.members.cache.get(targetUser.id) ||
            await message.guild.members.fetch(targetUser.id).catch(() => null);

        const createdAt = `<t:${Math.floor(targetUser.createdAt.getTime() / 1000)}:f>`;
        const joinedAt = member?.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:f>` : 'N/A';
        const roles = member?.roles?.cache
            ? member.roles.cache.filter(r => r.id !== message.guild.id).map(r => r.name).join(', ') || moxi.translate('USERINFO_NOROLES', lang) || 'Sin roles'
            : moxi.translate('USERINFO_NOROLES', lang) || 'Sin roles';
        const isBot = targetUser.bot ? moxi.translate('USERINFO_YES', lang) || 'Sí' : moxi.translate('USERINFO_NO', lang) || 'No';

        const avatarUrl = targetUser.displayAvatarURL({ size: 2048, dynamic: true });
        const bannerUrl = targetUser.banner ? `https://cdn.discordapp.com/banners/${targetUser.id}/${targetUser.banner}.${targetUser.banner.startsWith('a_') ? 'gif' : 'png'}?size=2048` : null;

        const { MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
        const container = new ContainerBuilder()
            .setAccentColor(Bot.AccentColor)
            .addTextDisplayComponents(c =>
                c.setContent(`# ${EMOJIS.person} ${moxi.translate('USERINFO_TITLE', lang) || 'Información de usuario'}: ${targetUser.username}`)
            )
            .addSeparatorComponents(s => s.setDivider(true));

        if (bannerUrl) {
            container.addTextDisplayComponents(c =>
                c.setContent(`${EMOJIS.art} **Banner:**`)
            );
            container.addMediaGalleryComponents(
                new MediaGalleryBuilder()
                    .addItems(
                        new MediaGalleryItemBuilder()
                            .setURL(bannerUrl)
                    )
            );
        }

        if (avatarUrl) {
            container.addTextDisplayComponents(c =>
                c.setContent(`${EMOJIS.person} **Avatar:**`)
            );
            container.addMediaGalleryComponents(
                new MediaGalleryBuilder()
                    .addItems(
                        new MediaGalleryItemBuilder()
                            .setURL(avatarUrl)
                    )
            );
        }

        container
            .addTextDisplayComponents(c => {
                let content = '';
                content += `> **${moxi.translate('USERINFO_USERNAME', lang) || 'Usuario'}:** ${targetUser.username}\n`;
                content += `> **${moxi.translate('USERINFO_TAG', lang) || 'Tag'}:** ${targetUser}\n`;
                content += `> **${moxi.translate('USERINFO_ID', lang) || 'ID'}:** \`${targetUser.id}\`\n`;
                content += `> **${moxi.translate('USERINFO_BOT', lang) || 'Bot'}:** ${isBot}\n`;
                content += `> **${moxi.translate('USERINFO_CREATED', lang) || 'Creado'}:** ${createdAt}`;
                if (member) content += `\n> **${moxi.translate('USERINFO_JOINED', lang) || 'Unido'}:** ${joinedAt}`;
                content += `\n> **${moxi.translate('USERINFO_ROLES', lang) || 'Roles'}:** ${roles}`;
                return c.setContent(content);
            })
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(c =>
                c.setContent(`${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`)
            );

        const permsButton = buildUserPermsButton(message.guild?.id, targetUser.id, lang);
        if (permsButton) {
            container.addActionRowComponents(row => row.addComponents(permsButton));
        }

        await message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
    }
};
