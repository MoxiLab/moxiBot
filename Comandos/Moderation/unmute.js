const { PermissionsBitField, ButtonStyle } = require('discord.js');
const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { resolveMemberFromArgs, resolveUserDisplay, ensureUserAndBotPerms } = require('./_utils');
const { putPending, buildConfirmV2 } = require('../../Util/modV2');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const debugHelper = require('../../Util/debugHelper');

module.exports = {
    name: 'unmute',
    alias: ['unmute', 'vunmute'],
    Category: (lang = 'es-ES') => moxi.translate('commands:CATEGORY_MODERATION', lang),
    usage: 'unmute <@usuario|id>',
    description: (lang = 'es-ES') => moxi.translate('moderation:CMD_UNMUTE_DESC', lang),
    permissions: {
        User: ['MuteMembers'],
        Bot: ['MuteMembers'],
    },

    async execute(Moxi, message, args) {
        debugHelper.log('unmute', 'execute start', {
            guildId: message.guild?.id,
            requesterId: message.author?.id,
            args: args.slice(0, 1)
        });
        const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');

        const permCheck = await ensureUserAndBotPerms({
            message,
            lang,
            userPermBits: PermissionsBitField.Flags.MuteMembers,
            userPermKeys: ['MuteMembers'],
            botPermBits: PermissionsBitField.Flags.MuteMembers,
            botPermKeys: ['MuteMembers'],
        });
        if (!permCheck.ok) {
            debugHelper.warn('unmute', 'permission check failed', { guildId: message.guild?.id, reason: permCheck.reply });
            // Registrar aviso en canal de auditoría
            const { sendPermissionInfoLog } = require('../../Util/audit.js');
            await sendPermissionInfoLog({
                client: message.client,
                guild: message.guild,
                guildId: message.guild?.id,
                moderatorId: message.author?.id,
                reason: permCheck.reply,
                fallbackLang: lang
            });
            return message.reply(asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, text: permCheck.reply })));
        }

        const member = await resolveMemberFromArgs(message, args);
        if (!member) {
            debugHelper.warn('unmute', 'member not found', { guildId: message.guild?.id, args: args.slice(0, 1) });
            return message.reply(
                asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, text: moxi.translate('moderation:MOD_UNMUTE_NOUSER', lang) }))
            );
        }

        if (!member.voice?.channel) {
            debugHelper.warn('unmute', 'member not voice muted', { guildId: message.guild?.id, targetId: member.id });
            return message.reply(
                asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, text: moxi.translate('moderation:MOD_UNMUTE_NOTUNMUTABLE', lang) }))
            );
        }

        const token = putPending(Moxi, {
            action: 'unmute',
            guildId: message.guild.id,
            requesterId: message.author.id,
            targetId: member.id,
        });

        debugHelper.log('unmute', 'confirm prompt', { guildId: message.guild.id, targetId: member.id });
        return message.reply(
            buildConfirmV2({
                lang,
                title: moxi.translate('moderation:CMD_UNMUTE_DESC', lang) || `${EMOJIS.check} Quitar silencio`,
                lines: [
                    `${EMOJIS.warning} ${resolveUserDisplay(member)}`,
                    `\n${moxi.translate('moderation:CONFIRM_ACTION', lang)}`,
                ],
                confirmCustomId: `modv2:confirm:${token}`,
                cancelCustomId: `modv2:cancel:${token}`,
                confirmStyle: ButtonStyle.Success,
            })
        );
    },
};
