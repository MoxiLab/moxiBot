const { PermissionsBitField, ButtonStyle } = require('discord.js');
const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { resolveMemberFromArgs, resolveUserDisplay, ensureUserAndBotPerms } = require('./_utils');
const { putPending, buildConfirmV2 } = require('../../Util/modV2');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const debugHelper = require('../../Util/debugHelper');

module.exports = {
    name: 'kick',
    alias: ['kick'],
    Category: (lang = 'es-ES') => moxi.translate('commands:CATEGORY_MODERATION', lang),
    usage: 'kick <@usuario|id> [motivo]',
    description: (lang = 'es-ES') => moxi.translate('moderation:CMD_KICK_DESC', lang),
    permissions: {
        User: ['KickMembers'],
        Bot: ['KickMembers'],
    },

    async execute(Moxi, message, args) {
        debugHelper.log('kick', 'execute start', {
            guildId: message.guild?.id,
            requesterId: message.author?.id,
            args: args.slice(0, 2)
        });
        const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');

        const permCheck = await ensureUserAndBotPerms({
            message,
            lang,
            userPermBits: PermissionsBitField.Flags.KickMembers,
            userPermKeys: ['KickMembers'],
            botPermBits: PermissionsBitField.Flags.KickMembers,
            botPermKeys: ['KickMembers'],
        });
        if (!permCheck.ok) {
            debugHelper.warn('kick', 'permission check failed', { guildId: message.guild?.id, reason: permCheck.reply });
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
            debugHelper.warn('kick', 'member not found', { guildId: message.guild?.id, args: args.slice(0, 1) });
            return message.reply(
                asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, text: moxi.translate('moderation:MOD_KICK_NOUSER', lang) }))
            );
        }

        if (!member.kickable) {
            debugHelper.warn('kick', 'member not kickable', { guildId: message.guild?.id, targetId: member.id });
            return message.reply(
                asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, text: moxi.translate('moderation:MOD_KICK_NOTKICKABLE', lang) }))
            );
        }

        const reason = args.slice(1).join(' ').trim() || moxi.translate('moderation:MOD_KICK_NOREASON', lang);

        const token = putPending(Moxi, {
            action: 'kick',
            guildId: message.guild.id,
            requesterId: message.author.id,
            targetId: member.id,
            reason,
        });

        debugHelper.log('kick', 'confirm prompt', { guildId: message.guild.id, targetId: member.id, reason });
        return message.reply(
            buildConfirmV2({
                lang,
                title: moxi.translate('moderation:CMD_KICK_DESC', lang) || `${EMOJIS.person} Expulsión`,
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
