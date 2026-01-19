const { PermissionsBitField } = require('discord.js');
const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { toolsCategory } = require('../../Util/commandCategories');

async function safeDeleteMessage(message) {
    try {
        if (!message?.deletable) return false;
        await message.delete();
        return true;
    } catch {
        return false;
    }
}

async function getOrCreateSayWebhook(channel, botUser) {
    if (!channel?.isTextBased?.()) return null;
    if (!channel?.guild) return null;

    const me = channel.guild.members?.me;
    if (!me) return null;

    const perms = channel.permissionsFor(me);
    if (!perms?.has(PermissionsBitField.Flags.ManageWebhooks)) return null;

    try {
        const hooks = await channel.fetchWebhooks();
        const existing = hooks?.find(
            (w) => w && w.owner && botUser && String(w.owner.id) === String(botUser.id) && w.name === 'Moxi Say'
        );
        if (existing) return existing;

        return await channel.createWebhook({
            name: 'Moxi Say',
            avatar: botUser?.displayAvatarURL?.({ size: 128 }) || undefined,
        });
    } catch {
        return null;
    }
}

module.exports = {
    name: 'sayu',
    alias: ['sayuser'],
    Category: toolsCategory,
    usage: 'sayu <mensaje>',
    description: 'Repite un mensaje como si fuera el usuario (webhook / APP) y borra el comando.',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message, args) {
        const text = (args || []).join(' ').trim();
        const replyToId = message?.reference?.messageId || null;

        if (!text) {
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Say',
                        text: 'No puedo enviar un mensaje vacío.',
                    })
                )
            );
        }

        await safeDeleteMessage(message);

        const webhook = await getOrCreateSayWebhook(message.channel, Moxi.user);
        if (!webhook) {
            // No podemos usar webhook => avisar claro.
            return message.channel.send({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Say',
                        text: 'No tengo permisos para usar webhooks en este canal (Manage Webhooks).',
                    })
                ),
                allowedMentions: { parse: [], repliedUser: false },
            });
        }

        try {
            await webhook.send({
                content: text,
                username: message.member?.displayName || message.author?.username || 'Usuario',
                avatarURL: message.author?.displayAvatarURL?.({ size: 128 }),
                allowedMentions: { parse: [], repliedUser: false },
                ...(replyToId ? { reply: { messageReference: replyToId } } : {}),
            });
        } catch {
            // fallback a mensaje normal si falla el webhook
            await message.channel.send({
                content: text,
                ...(replyToId ? { reply: { messageReference: replyToId } } : {}),
                allowedMentions: { parse: [], repliedUser: false },
            });
        }
    },
};
