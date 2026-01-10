const { PermissionsBitField, ButtonStyle } = require('discord.js');
const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { resolveMemberFromArgs, resolveUserDisplay, ensureUserAndBotPerms } = require('./_utils');
const { putPending, buildConfirmV2 } = require('../../Util/modV2');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const debugHelper = require('../../Util/debugHelper');

module.exports = {
    name: 'timeout',
    alias: ['timeout', 'to'],
    Category: (lang = 'es-ES') => moxi.translate('commands:CATEGORY_MODERATION', lang),
    usage: 'timeout <@usuario|id> <minutos> [motivo]',
    description: (lang = 'es-ES') => moxi.translate('moderation:CMD_TIMEOUT_DESC', lang),
    permissions: {
        User: ['ModerateMembers'],
        Bot: ['ModerateMembers'],
    },

    async execute(Moxi, message, args) {
        debugHelper.log('timeout', 'execute start', {
            guildId: message.guild?.id,
            requesterId: message.author?.id,
            args: args.slice(0, 3)
        });
        const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');

        const permCheck = await ensureUserAndBotPerms({
            message,
            lang,
            userPermBits: PermissionsBitField.Flags.ModerateMembers,
            userPermKeys: ['ModerateMembers'],
            botPermBits: PermissionsBitField.Flags.ModerateMembers,
            botPermKeys: ['ModerateMembers'],
        });
        if (!permCheck.ok) {
            debugHelper.warn('timeout', 'permission check failed', { guildId: message.guild?.id, reason: permCheck.reply });
            return message.reply(asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, text: permCheck.reply })));
        }

        const member = await resolveMemberFromArgs(message, args);
        if (!member) {
            debugHelper.warn('timeout', 'member not found', { guildId: message.guild?.id, args: args.slice(0, 1) });
            return message.reply(
                asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, text: moxi.translate('moderation:MOD_TIMEOUT_NOUSER', lang) }))
            );
        }

        const minutes = parseInt(String(args?.[1] || ''), 10);
        if (!Number.isFinite(minutes) || minutes <= 0) {
            debugHelper.warn('timeout', 'invalid minutes', { guildId: message.guild?.id, value: args?.[1] });
            return message.reply(
                asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, text: moxi.translate('moderation:MOD_TIMEOUT_NOMINUTES', lang) }))
            );
        }

        if (!member.moderatable) {
            debugHelper.warn('timeout', 'member not moderatable', { guildId: message.guild?.id, targetId: member.id });
            return message.reply(
                asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, text: moxi.translate('moderation:MOD_TIMEOUT_NOTTIMEOUTABLE', lang) }))
            );
        }

        const reason = args.slice(2).join(' ').trim() || moxi.translate('moderation:MOD_TIMEOUT_NOREASON', lang);

        const token = putPending(Moxi, {
            action: 'timeout',
            guildId: message.guild.id,
            requesterId: message.author.id,
            targetId: member.id,
            minutes,
            reason,
        });

        debugHelper.log('timeout', 'confirm prompt', { guildId: message.guild.id, targetId: member.id, minutes, reason });
        return message.reply(
            buildConfirmV2({
                lang,
                title: moxi.translate('moderation:CMD_TIMEOUT_DESC', lang) || `${EMOJIS.hourglass} Timeout`,
                lines: [
                    `${EMOJIS.warning} ${resolveUserDisplay(member)}`,
                    `${moxi.translate('moderation:LABEL_MINUTES', lang)} ${minutes}`,
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
