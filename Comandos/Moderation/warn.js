const { PermissionsBitField, ButtonStyle } = require('discord.js');
const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { resolveMemberFromArgs, resolveUserDisplay, ensureUserAndBotPerms } = require('./_utils');
const { putPending, buildConfirmV2 } = require('../../Util/modV2');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');

module.exports = {
    name: 'warn',
    alias: ['warn', 'adv', 'warning'],
    Category: (lang = 'es-ES') => moxi.translate('commands:CATEGORY_MODERATION', lang),
    usage: 'warn <@usuario|id> [motivo]',
    description: (lang = 'es-ES') => moxi.translate('moderation:CMD_WARN_DESC', lang),
    permissions: {
        User: ['ModerateMembers'],
        Bot: [],
    },

    async execute(Moxi, message, args) {
        const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');

        const permCheck = await ensureUserAndBotPerms({
            message,
            lang,
            userPermBits: PermissionsBitField.Flags.ModerateMembers,
            userPermKeys: ['ModerateMembers'],
        });
        if (!permCheck.ok) {
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
            return message.reply(
                asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, text: moxi.translate('moderation:MOD_WARN_NOUSER', lang) }))
            );
        }

        const reason = args.slice(1).join(' ').trim() || moxi.translate('moderation:MOD_WARN_NOREASON', lang);

        const token = putPending(Moxi, {
            action: 'warn',
            guildId: message.guild.id,
            requesterId: message.author.id,
            targetId: member.id,
            reason,
        });

        return message.reply(
            buildConfirmV2({
                lang,
                title: moxi.translate('moderation:CMD_WARN_DESC', lang) || `${EMOJIS.info} Advertencia`,
                lines: [
                    `${EMOJIS.warning} ${resolveUserDisplay(member)}`,
                    `${moxi.translate('moderation:LABEL_REASON', lang)} ${reason}`,
                    `\n${moxi.translate('moderation:CONFIRM_ACTION', lang)}`,
                ],
                confirmCustomId: `modv2:confirm:${token}`,
                cancelCustomId: `modv2:cancel:${token}`,
                confirmStyle: ButtonStyle.Primary,
            })
        );
    },
};
