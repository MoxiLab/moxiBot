const { PermissionsBitField, ButtonStyle } = require('discord.js');
const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { resolveMemberFromArgs, resolveUserDisplay, ensureUserAndBotPerms } = require('./_utils');
const { putPending, buildConfirmV2 } = require('../../Util/modV2');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const debugHelper = require('../../Util/debugHelper');

module.exports = {
    name: 'ban',
    alias: ['ban', 'b'],
    Category: (lang = 'es-ES') => moxi.translate('commands:CATEGORY_MODERATION', lang),
    usage: 'ban <@usuario|id> [motivo]',
    description: (lang = 'es-ES') => moxi.translate('moderation:CMD_BAN_DESC', lang),
    permissions: {
        User: ['BanMembers'],
        Bot: ['BanMembers'],
    },

    async execute(Moxi, message, args) {
        debugHelper.log('ban', 'execute start', {
            guildId: message.guild?.id,
            requesterId: message.author?.id,
            args: args.slice(0, 2)
        });
        const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');

        const permCheck = await ensureUserAndBotPerms({
            message,
            lang,
            userPermBits: PermissionsBitField.Flags.BanMembers,
            userPermKeys: ['BanMembers'],
            botPermBits: PermissionsBitField.Flags.BanMembers,
            botPermKeys: ['BanMembers'],
        });
        if (!permCheck.ok) {
            debugHelper.warn('ban', 'permission check failed', { guildId: message.guild?.id, reason: permCheck.reply });
            return message.reply(asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, text: permCheck.reply })));
        }

        const member = await resolveMemberFromArgs(message, args);
        if (!member) {
            debugHelper.warn('ban', 'member not found', { guildId: message.guild?.id, args: args.slice(0, 1) });
            return message.reply(
                asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, text: moxi.translate('moderation:MOD_BAN_NOUSER', lang) }))
            );
        }

        if (!member.bannable) {
            debugHelper.warn('ban', 'member not bannable', { guildId: message.guild?.id, targetId: member.id });
            return message.reply(
                asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, text: moxi.translate('moderation:MOD_BAN_NOTBANNABLE', lang) }))
            );
        }

        const reason = args.slice(1).join(' ').trim() || moxi.translate('moderation:MOD_BAN_NOREASON', lang);

        const token = putPending(Moxi, {
            action: 'ban',
            guildId: message.guild.id,
            requesterId: message.author.id,
            targetId: member.id,
            reason,
        });

        debugHelper.log('ban', 'confirm prompt', { guildId: message.guild.id, targetId: member.id, reason });
        return message.reply(
            buildConfirmV2({
                lang,
                title: moxi.translate('moderation:CMD_BAN_DESC', lang) || `${EMOJIS.shield} Baneo`,
                lines: [
                    `${EMOJIS.warning} ${resolveUserDisplay(member)}`,
                    `${moxi.translate('moderation:LABEL_REASON', lang)} ${reason}`,
                    `\n${moxi.translate('moderation:CONFIRM_ACTION', lang)}`,
                ],
                confirmCustomId: `modv2:confirm:${token}`,
                cancelCustomId: `modv2:cancel:${token}`,
                confirmStyle: ButtonStyle.Danger,
            })
        );
    },
};
