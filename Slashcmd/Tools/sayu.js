const { SlashCommandBuilder, MessageFlags, PermissionsBitField } = require('discord.js');
const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');

function toolsCategory(lang) {
    lang = lang || 'es-ES';
    return moxi.translate('commands:CATEGORY_HERRAMIENTAS', lang);
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
    cooldown: 0,
    Category: toolsCategory,
    data: new SlashCommandBuilder()
        .setName('sayu')
        .setDescription('Envía un mensaje como si fuera el usuario (webhook / APP)')
        .addStringOption((opt) =>
            opt
                .setName('mensaje')
                .setDescription('Texto a enviar')
                .setRequired(true)
                .setMaxLength(2000)
        ),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const text = String(interaction.options.getString('mensaje', true)).trim();
        if (!text) {
            return interaction.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Say',
                        text: 'No puedo enviar un mensaje vacío.',
                    })
                ),
                flags: MessageFlags.Ephemeral,
            });
        }

        // No dejamos confirmación: defer ephemeral y borramos el reply al final.
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const channel = interaction.channel;
        const webhook = await getOrCreateSayWebhook(channel, Moxi.user);
        if (!webhook) {
            return interaction.editReply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Say',
                        text: 'No tengo permisos para usar webhooks aquí (Manage Webhooks).',
                    })
                ),
            });
        }

        try {
            await webhook.send({
                content: text,
                username: interaction.member?.displayName || interaction.user?.username || 'Usuario',
                avatarURL: interaction.user?.displayAvatarURL?.({ size: 128 }),
                allowedMentions: { parse: [] },
            });
        } catch {
            return interaction.editReply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Say',
                        text: 'No pude enviar el mensaje por webhook en este canal.',
                    })
                ),
            });
        }

        await interaction.deleteReply().catch(() => null);
        return;
    },
};
