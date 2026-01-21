const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');

const { economyCategory } = require('../../Util/commandCategories');

module.exports = {
    name: 'leaderboard',
    alias: ['leaderboard', 'lb',],
    Category: economyCategory,
    usage: 'leaderboard',
    description: 'commands:CMD_LEADERBOARD_DESC',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message) {
        const guildId = message.guildId || message.guild?.id;
        const lang = message.lang || await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const t = (k, vars = {}) => moxi.translate(`economy/leaderboard:${k}`, lang, vars);

        if (!process.env.MONGODB) {
            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('TITLE'),
                        text: t('NO_DB'),
                    })
                ),
                allowedMentions: { repliedUser: false },
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
                return message.reply({
                    ...asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.info,
                            title: t('TITLE'),
                            text: t('EMPTY'),
                        })
                    ),
                    allowedMentions: { repliedUser: false },
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

            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: '🏆',
                        title: t('TITLE'),
                        text: `${lines.join('\n')}\n\n_${t('FOOTER')}_`,
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        } catch {
            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('TITLE'),
                        text: t('ERROR'),
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }
    },
};
