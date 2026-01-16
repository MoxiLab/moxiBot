const {
    ChannelType,
    ContainerBuilder,
    MessageFlags,
} = require('discord.js');
const crypto = require('crypto');

const { Bot } = require('../../Config');
const { EMOJIS } = require('../../Util/emojis');
const Suggestions = require('../../Models/SuggestionsSchema');
const { isStaff, normalizeSuggestionId, buildSuggestionEmbed, buildSuggestionButtons } = require('../../Util/suggestions');

function panel(title, body, client) {
    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(c => c.setContent(`# ${title}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(body))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(`${EMOJIS.copyright} ${client.user.username} • ${new Date().getFullYear()}`));
    return { content: '', components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } };
}

function makeSuggestionId() {
    return crypto.randomBytes(3).toString('hex').toUpperCase();
}

async function getConfig(guildId) {
    return Suggestions.findOne({ guildID: guildId, type: 'config' }).lean().catch(() => null);
}

async function upsertConfig(guildId, guildName, patch) {
    const now = new Date();
    await Suggestions.updateOne(
        { guildID: guildId, type: 'config' },
        {
            $setOnInsert: { guildID: guildId, type: 'config', createdAt: now },
            $set: { ...patch, guildName: guildName || null, updatedAt: now },
        },
        { upsert: true }
    );
}

module.exports = {
    name: 'suggest',
    alias: ['sugerencia', 'sugerir', 'idea', 'ideas'],
    Category: 'Tools',
    usage: 'suggest <texto> | suggest status | suggest set #canal | suggest off | suggest approve <id> [motivo] | suggest deny <id> [motivo]',
    description: () => 'Sistema de sugerencias del servidor.',
    cooldown: 5,

    async execute(Moxi, message, args) {
        if (!message.guild) return;

        const guildId = message.guild.id;
        const sub = String(args[0] || '').trim().toLowerCase();

        // --- Admin actions ---
        if (['set', 'config', 'setup'].includes(sub)) {
            if (!isStaff(message.member)) {
                return message.reply(panel('Sugerencias', `${EMOJIS.cross} Necesitas permisos de moderación para configurar.`, Moxi));
            }
            const mentioned = message.mentions?.channels?.first?.();
            const raw = args[1];
            const id = mentioned?.id || (raw ? String(raw).replace(/[<#>]/g, '') : '');
            const ch = id ? (message.guild.channels.cache.get(id) || await message.guild.channels.fetch(id).catch(() => null)) : null;
            if (!ch) {
                return message.reply(panel('Sugerencias', `${EMOJIS.cross} Uso: suggest set #canal`, Moxi));
            }
            if (![ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.PublicThread, ChannelType.PrivateThread].includes(ch.type) && !ch.isTextBased?.()) {
                return message.reply(panel('Sugerencias', `${EMOJIS.cross} Ese canal no es válido para sugerencias.`, Moxi));
            }

            await upsertConfig(guildId, message.guild.name, { enabled: true, channelID: ch.id });
            return message.reply(panel('Sugerencias', `${EMOJIS.tick} Canal de sugerencias: <#${ch.id}>`, Moxi));
        }

        if (['off', 'disable'].includes(sub)) {
            if (!isStaff(message.member)) {
                return message.reply(panel('Sugerencias', `${EMOJIS.cross} Necesitas permisos de moderación para desactivar.`, Moxi));
            }
            await upsertConfig(guildId, message.guild.name, { enabled: false, channelID: null });
            return message.reply(panel('Sugerencias', `${EMOJIS.tick} Sistema de sugerencias desactivado.`, Moxi));
        }

        if (['status', 'estado'].includes(sub) || args.length === 0) {
            const cfg = await getConfig(guildId);
            const enabled = !!cfg?.enabled;
            const channelId = cfg?.channelID ? String(cfg.channelID) : '';
            return message.reply(panel(
                'Sugerencias',
                `${EMOJIS.info || ''} Estado: **${enabled ? 'ON' : 'OFF'}**\n${EMOJIS.channel || ''} Canal: ${channelId ? `<#${channelId}>` : '-'}`,
                Moxi
            ));
        }

        if (['approve', 'aprobar', 'accept', 'aceptar'].includes(sub) || ['deny', 'denegar', 'rechazar'].includes(sub)) {
            if (!isStaff(message.member)) {
                return message.reply(panel('Sugerencias', `${EMOJIS.cross} Necesitas permisos de moderación para gestionar sugerencias.`, Moxi));
            }

            const action = ['approve', 'aprobar', 'accept', 'aceptar'].includes(sub) ? 'approved' : 'denied';
            const rawId = args[1];
            if (!rawId) {
                return message.reply(panel('Sugerencias', `${EMOJIS.cross} Uso: suggest ${action === 'approved' ? 'approve' : 'deny'} <id> [motivo]`, Moxi));
            }

            const reason = args.slice(2).join(' ').trim() || null;

            const normalized = normalizeSuggestionId(rawId);
            const isSnowflake = /^\d{16,22}$/.test(String(rawId));

            const query = isSnowflake
                ? { guildID: guildId, type: 'suggestion', messageID: String(rawId) }
                : { guildID: guildId, type: 'suggestion', suggestionId: normalized };

            const doc = await Suggestions.findOne(query).catch(() => null);
            if (!doc) {
                return message.reply(panel('Sugerencias', `${EMOJIS.cross} No encuentro esa sugerencia (ID: **${normalized}**).`, Moxi));
            }

            doc.status = action;
            doc.staffID = message.author.id;
            doc.staffTag = message.author.tag;
            doc.reason = reason;
            doc.updatedAt = new Date();
            await doc.save().catch(() => null);

            // Update the original suggestion message if possible
            if (doc.messageID && doc.messageChannelID) {
                const channel = message.guild.channels.cache.get(String(doc.messageChannelID)) || await message.guild.channels.fetch(String(doc.messageChannelID)).catch(() => null);
                if (channel && channel.isTextBased()) {
                    const msg = await channel.messages.fetch(String(doc.messageID)).catch(() => null);
                    if (msg) {
                        const embed = buildSuggestionEmbed({
                            guild: message.guild,
                            author: doc.authorTag ? `@${doc.authorTag}` : (doc.authorID ? `<@${doc.authorID}>` : null),
                            suggestionId: doc.suggestionId,
                            content: doc.content,
                            status: doc.status,
                            staff: message.author.tag,
                            reason,
                        });
                        const row = buildSuggestionButtons({ suggestionId: doc.suggestionId, status: doc.status });
                        await msg.edit({ embeds: [embed], components: [row] }).catch(() => null);
                    }
                }
            }

            // DM best-effort
            if (doc.authorID) {
                const u = await Moxi.users.fetch(doc.authorID).catch(() => null);
                if (u) {
                    const dmText = `Tu sugerencia #${doc.suggestionId} ha sido **${action === 'approved' ? 'APROBADA' : 'RECHAZADA'}**${reason ? `\nMotivo: ${reason}` : ''}.`;
                    u.send({ content: dmText }).catch(() => null);
                }
            }

            return message.reply(panel('Sugerencias', `${EMOJIS.tick} Sugerencia **#${doc.suggestionId}** marcada como **${action === 'approved' ? 'APROBADA' : 'RECHAZADA'}**.`, Moxi));
        }

        // --- Create suggestion ---
        const cfg = await getConfig(guildId);
        if (!cfg?.enabled || !cfg?.channelID) {
            return message.reply(panel('Sugerencias', `${EMOJIS.cross} El sistema no está configurado.\nUsa: **suggest set #canal**`, Moxi));
        }

        const content = args.join(' ').trim();
        if (!content || content.length < 5) {
            return message.reply(panel('Sugerencias', `${EMOJIS.cross} Escribe una sugerencia un poco más completa.`, Moxi));
        }
        if (content.length > 1500) {
            return message.reply(panel('Sugerencias', `${EMOJIS.cross} La sugerencia es demasiado larga (máx. 1500 caracteres).`, Moxi));
        }

        const channelId = String(cfg.channelID);
        const channel = message.guild.channels.cache.get(channelId) || await message.guild.channels.fetch(channelId).catch(() => null);
        if (!channel || !channel.isTextBased()) {
            return message.reply(panel('Sugerencias', `${EMOJIS.cross} No puedo acceder al canal configurado (<#${channelId}>).`, Moxi));
        }

        // Create doc with retry on collision
        let suggestionId = null;
        let created = null;
        for (let attempt = 0; attempt < 5; attempt += 1) {
            suggestionId = makeSuggestionId();
            try {
                created = await Suggestions.create({
                    type: 'suggestion',
                    guildID: guildId,
                    guildName: message.guild.name,
                    suggestionId,
                    authorID: message.author.id,
                    authorTag: message.author.tag,
                    content,
                    status: 'pending',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                });
                break;
            } catch (err) {
                // duplicate key -> retry
                created = null;
            }
        }

        if (!created) {
            return message.reply(panel('Sugerencias', `${EMOJIS.cross} No pude crear la sugerencia. Intenta de nuevo.`, Moxi));
        }

        const embed = buildSuggestionEmbed({
            guild: message.guild,
            author: message.author.tag,
            suggestionId,
            content,
            status: 'pending',
        });

        const row = buildSuggestionButtons({ suggestionId, status: 'pending' });

        const sent = await channel.send({ embeds: [embed], components: [row] }).catch(() => null);
        if (!sent) {
            await Suggestions.deleteOne({ _id: created._id }).catch(() => null);
            return message.reply(panel('Sugerencias', `${EMOJIS.cross} No pude enviar la sugerencia en <#${channelId}>.`, Moxi));
        }

        try {
            await sent.react('👍');
            await sent.react('👎');
        } catch (_) {
            // ignore
        }

        await Suggestions.updateOne(
            { _id: created._id },
            { $set: { messageID: sent.id, messageChannelID: sent.channel.id, updatedAt: new Date() } }
        ).catch(() => null);

        return message.reply(panel('Sugerencias', `${EMOJIS.tick} Sugerencia enviada: **#${suggestionId}**\n${sent.url}`, Moxi));
    },
};
