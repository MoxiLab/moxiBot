const { MessageFlags } = require('discord.js');
const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');
const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { normalizeDiscordId } = require('../../Util/idGuards');

module.exports = {
    cooldown: 0,
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
    },
    data: new SlashCommandBuilder()
        .setName('globalrank')
        .setDescription('Muestra el ranking global de niveles entre todos los servidores.'),

    async run(Moxi, interaction) {
        if (!process.env.MONGODB) {
            const payload = asV2MessageOptions(
                buildNoticeContainer({
                    emoji: EMOJIS.cross,
                    title: '🌐 Ranking Global',
                    text: 'Base de datos no disponible.',
                })
            );
            return interaction.reply({ ...payload, flags: (payload.flags ?? 0) & ~MessageFlags.Ephemeral });
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
                const payload = asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.info,
                        title: '🌐 Ranking Global',
                        text: 'Aún no hay usuarios con nivel global registrado.',
                    })
                );
                return interaction.reply({ ...payload, flags: (payload.flags ?? 0) & ~MessageFlags.Ephemeral });
            }

            // Filtrar bots del servidor actual
            const ids = top.map((r) => normalizeDiscordId(r?.userId)).filter(Boolean);
            const botIds = new Set();
            if (interaction.guild && typeof interaction.guild.members?.fetch === 'function') {
                const members = await Promise.all(
                    ids.map((id) => interaction.guild.members.fetch(id).catch(() => null))
                );
                for (const m of members) {
                    if (m?.user?.bot) botIds.add(String(m.user.id));
                }
            }

            const filtered = top.filter((r) => !botIds.has(String(r?.userId || ''))).slice(0, 10);

            if (filtered.length === 0) {
                const payload = asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.info,
                        title: '🌐 Ranking Global',
                        text: 'Aún no hay usuarios con nivel global registrado.',
                    })
                );
                return interaction.reply({ ...payload, flags: (payload.flags ?? 0) & ~MessageFlags.Ephemeral });
            }

            const lines = filtered.map((row, i) => {
                const uid = String(row?.userId || '');
                const level = Number(row?.globalLevel || 1);
                const totalXp = Math.trunc(Number(row?.globalTotalXp || 0)).toLocaleString('en-US');
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                return `${medal} <@${uid}> — Nivel ${level} (${totalXp} XP total)`;
            });

            const payload = asV2MessageOptions(
                buildNoticeContainer({
                    emoji: '🌐',
                    title: 'Ranking Global de Niveles',
                    text: `${lines.join('\n')}\n\n_El nivel global se acumula en todos los servidores._`,
                })
            );
            return interaction.reply({ ...payload, flags: (payload.flags ?? 0) & ~MessageFlags.Ephemeral });

        } catch {
            const payload = asV2MessageOptions(
                buildNoticeContainer({
                    emoji: EMOJIS.cross,
                    title: '🌐 Ranking Global',
                    text: 'Ocurrió un error al obtener el ranking global.',
                })
            );
            return interaction.reply({ ...payload, flags: (payload.flags ?? 0) & ~MessageFlags.Ephemeral });
        }
    },
};
