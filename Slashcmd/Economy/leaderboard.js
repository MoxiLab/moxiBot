const { ChatInputCommandBuilder: SlashCommandBuilder, MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { getSlashCommandDescription } = require('../../Util/slashHelpI18n');

const { description, localizations } = getSlashCommandDescription('leaderboard');

module.exports = {
    cooldown: 0,
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
    },
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription(description)
        .setDescriptionLocalizations(localizations),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const t = (k, vars = {}) => moxi.translate(`economy/leaderboard:${k}`, lang, vars);

        if (!process.env.MONGODB) {
            const payload = asV2MessageOptions(
                buildNoticeContainer({
                    emoji: EMOJIS.cross,
                    title: t('TITLE'),
                    text: t('NO_DB'),
                })
            );
            return interaction.reply({
                ...payload,
                flags: (payload.flags ?? 0) & ~MessageFlags.Ephemeral,
            });
        }

        try {
            // eslint-disable-next-line global-require
            const { ensureMongoConnection } = require('../../Util/mongoConnect');
            await ensureMongoConnection();
            // eslint-disable-next-line global-require
            const { Economy } = require('../../Models/EconomySchema');

            const top = await Economy.aggregate([
                {
                    $project: {
                        userId: 1,
                        bank: { $ifNull: ['$bank', 0] },
                        balance: { $ifNull: ['$balance', 0] },
                        sakuras: { $ifNull: ['$sakuras', 0] },
                        total: {
                            $add: [
                                { $ifNull: ['$bank', 0] },
                                { $ifNull: ['$balance', 0] },
                                { $ifNull: ['$sakuras', 0] },
                            ],
                        },
                    },
                },
                { $sort: { total: -1 } },
                { $limit: 10 },
            ]);

            if (!Array.isArray(top) || top.length === 0) {
                const payload = asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.info,
                        title: t('TITLE'),
                        text: t('EMPTY'),
                    })
                );
                return interaction.reply({
                    ...payload,
                    flags: (payload.flags ?? 0) & ~MessageFlags.Ephemeral,
                });
            }

            const lines = [];
            for (let i = 0; i < top.length; i += 1) {
                const row = top[i];
                const uid = String(row?.userId || '');
                const bank = Number(row?.bank || 0);
                const coins = Number(row?.balance || 0);
                const sakuras = Number(row?.sakuras || 0);
                const total = Number(row?.total || (bank + coins + sakuras) || 0);

                const prettyTotal = Math.trunc(total).toLocaleString('en-US');

                lines.push(`${i + 1}. <@${uid}> — ${prettyTotal} 💰`);
            }

            const payload = asV2MessageOptions(
                buildNoticeContainer({
                    emoji: '🏆',
                    title: t('TITLE'),
                    text: `${lines.join('\n')}\n\n_${t('FOOTER')}_`,
                })
            );

            return interaction.reply({
                ...payload,
                flags: (payload.flags ?? 0) & ~MessageFlags.Ephemeral,
            });
        } catch {
            const payload = asV2MessageOptions(
                buildNoticeContainer({
                    emoji: EMOJIS.cross,
                    title: t('TITLE'),
                    text: t('ERROR'),
                })
            );

            return interaction.reply({
                ...payload,
                flags: (payload.flags ?? 0) & ~MessageFlags.Ephemeral,
            });
        }
    },
};
