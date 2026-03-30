const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { normalizeDiscordId } = require('../../Util/idGuards');
const { economyCategory } = require('../../Util/commandCategories');

module.exports = {
    name: 'globalrank',
    alias: ['globalrank', 'grank', 'rankglobal'],
    Category: economyCategory,
    usage: 'globalrank',
    description: 'commands:CMD_GLOBALRANK_DESC',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message) {
        const guildId = normalizeDiscordId(message.guildId || message.guild?.id);
        const lang = message.lang || await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        if (!process.env.MONGODB) {
            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: '🌐 Ranking Global',
                        text: 'Base de datos no disponible.',
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        try {
            const { ensureMongoConnection } = require('../../Util/mongoConnect');
            await ensureMongoConnection();
            const { Economy } = require('../../Models/EconomySchema');

            const top = await Economy.find(
                { globalLevel: { $gt: 1 } },
                { userId: 1, globalLevel: 1, globalTotalXp: 1 }
            )
                .sort({ globalLevel: -1, globalTotalXp: -1 })
                .limit(30)
                .lean();

            if (!Array.isArray(top) || top.length === 0) {
                return message.reply({
                    ...asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.info,
                            title: '🌐 Ranking Global',
                            text: 'Aún no hay usuarios con nivel global registrado.',
                        })
                    ),
                    allowedMentions: { repliedUser: false },
                });
            }

            // Filtrar bots del servidor actual
            const ids = top.map((r) => normalizeDiscordId(r?.userId)).filter(Boolean);
            const botIds = new Set();
            if (message.guild && typeof message.guild.members?.fetch === 'function') {
                const members = await Promise.all(
                    ids.map((id) => message.guild.members.fetch(id).catch(() => null))
                );
                for (const m of members) {
                    if (m?.user?.bot) botIds.add(String(m.user.id));
                }
            }

            const filtered = top.filter((r) => !botIds.has(String(r?.userId || ''))).slice(0, 10);

            if (filtered.length === 0) {
                return message.reply({
                    ...asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.info,
                            title: '🌐 Ranking Global',
                            text: 'Aún no hay usuarios con nivel global registrado.',
                        })
                    ),
                    allowedMentions: { repliedUser: false },
                });
            }

            const lines = filtered.map((row, i) => {
                const uid = String(row?.userId || '');
                const level = Number(row?.globalLevel || 1);
                const totalXp = Math.trunc(Number(row?.globalTotalXp || 0)).toLocaleString('en-US');
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                return `${medal} <@${uid}> — Nivel ${level} (${totalXp} XP total)`;
            });

            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: '🌐',
                        title: 'Ranking Global de Niveles',
                        text: `${lines.join('\n')}\n\n_El nivel global se acumula en todos los servidores._`,
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        } catch {
            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: '🌐 Ranking Global',
                        text: 'Ocurrió un error al obtener el ranking global.',
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }
    },
};
