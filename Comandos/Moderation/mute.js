const { PermissionsBitField, ButtonStyle } = require('discord.js');
const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { resolveMemberFromArgs, resolveUserDisplay, ensureUserAndBotPerms } = require('./_utils');
const { putPending, buildConfirmV2 } = require('../../Util/modV2');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const debugHelper = require('../../Util/debugHelper');

module.exports = {
    name: 'mute',
    alias: ['mute', 'vmute'],
    Category: (lang = 'es-ES') => moxi.translate('commands:CATEGORY_MODERATION', lang),
    usage: 'mute <@usuario|id> [motivo]',
    description: (lang = 'es-ES') => moxi.translate('moderation:CMD_MUTE_DESC', lang),
    permissions: {
        User: ['MuteMembers'],
        Bot: ['MuteMembers'],
    },

    async execute(Moxi, message, args) {
        debugHelper.log('mute', 'execute start', {
            guildId: message.guild?.id,
            requesterId: message.author?.id,
            args: args.slice(0, 2)
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
            debugHelper.warn('mute', 'permission check failed', { guildId: message.guild?.id, reason: permCheck.reply });
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
            debugHelper.warn('mute', 'member not found', { guildId: message.guild?.id, args: args.slice(0, 1) });
            return message.reply(
                asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, text: moxi.translate('moderation:MOD_MUTE_NOUSER', lang) }))
            );
        }

        const reason = args.slice(1).join(' ').trim() || moxi.translate('moderation:MOD_MUTE_NOREASON', lang);

        if (!member.voice?.channel) {
            debugHelper.warn('mute', 'member not in voice', { guildId: message.guild?.id, targetId: member.id });
            return message.reply(
                asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, text: moxi.translate('moderation:MOD_MUTE_NOTMUTABLE', lang) }))
            );
        }

        const token = putPending(Moxi, {
            action: 'mute',
            guildId: message.guild.id,
            requesterId: message.author.id,
            targetId: member.id,
            reason,
        });

        debugHelper.log('mute', 'confirm prompt', { guildId: message.guild.id, targetId: member.id, reason });
        return message.reply(
            buildConfirmV2({
                lang,
                title: moxi.translate('moderation:CMD_MUTE_DESC', lang) || `${EMOJIS.noEntry} Silenciar`,
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
