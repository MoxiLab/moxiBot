const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { transferBalance } = require('../../Util/economyCore');

const { economyCategory } = require('../../Util/commandCategories');

function safeInt(n, fallback = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? Math.trunc(x) : fallback;
}

function formatInt(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return '0';
    return Math.trunc(x).toLocaleString('en-US');
}

function pickFirstNumberToken(args) {
    const arr = Array.isArray(args) ? args : [];
    const token = arr.find(a => /^\d+$/.test(String(a || '').trim()));
    return token ? String(token).trim() : null;
}

async function resolveTargetUser({ client, message, args }) {
    const mention = message.mentions?.users?.first?.() || null;
    if (mention) return mention;

    const arr = Array.isArray(args) ? args : [];
    const amountTok = pickFirstNumberToken(arr);

    // Preferir IDs tipo Discord
    const idTok = arr.find(a => {
        const s = String(a || '').trim();
        if (!s) return false;
        if (amountTok && s === amountTok) return false;
        return /^\d{15,20}$/.test(s);
    });

    if (idTok) {
        return client.users.fetch(String(idTok).trim()).catch(() => null);
    }

    return null;
}

module.exports = {
    name: 'give',
    alias: ['give'],
    Category: economyCategory,
    usage: 'give <@usuario|id> <cantidad>',
    description: 'commands:CMD_GIVE_DESC',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message, args) {
        const guildId = message.guildId || message.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const t = (k, vars = {}) => moxi.translate(`economy/give:${k}`, lang, vars);

        const target = await resolveTargetUser({ client: Moxi, message, args });
        const amountTok = pickFirstNumberToken(args);
        const amount = amountTok ? safeInt(amountTok, 0) : 0;

        if (!target || !amountTok) {
            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('USAGE_TITLE'),
                        text: t('USAGE_TEXT', { prefix: process.env.PREFIX || '.' }),
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        if (amount <= 0) {
            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('INVALID_AMOUNT_TITLE'),
                        text: t('INVALID_AMOUNT_TEXT'),
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        if (String(target.id) === String(message.author.id)) {
            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('SELF_TITLE'),
                        text: t('SELF_TEXT'),
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        if (target.bot) {
            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('BOT_TITLE'),
                        text: t('BOT_TEXT'),
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        try {
            const res = await transferBalance({ fromUserId: message.author.id, toUserId: target.id, amount });

            if (!res.ok) {
                if (res.reason === 'no-db') {
                    return message.reply({
                        ...asV2MessageOptions(
                            buildNoticeContainer({
                                emoji: EMOJIS.cross,
                                title: t('NO_DB_TITLE'),
                                text: t('NO_DB_TEXT'),
                            })
                        ),
                        allowedMentions: { repliedUser: false },
                    });
                }

                if (res.reason === 'insufficient') {
                    return message.reply({
                        ...asV2MessageOptions(
                            buildNoticeContainer({
                                emoji: EMOJIS.cross,
                                title: t('INSUFFICIENT_TITLE'),
                                text: t('INSUFFICIENT_TEXT', { amount: formatInt(amount), balance: formatInt(res.balance ?? 0) }),
                            })
                        ),
                        allowedMentions: { repliedUser: false },
                    });
                }

                return message.reply({
                    ...asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: t('ERROR_TITLE'),
                            text: t('UNKNOWN_ERROR'),
                        })
                    ),
                    allowedMentions: { repliedUser: false },
                });
            }

            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: '🎁',
                        title: t('SUCCESS_TITLE'),
                        text: t('SUCCESS_TEXT', { user: `<@${target.id}>`, amount: formatInt(res.amount), balance: formatInt(res.fromBalance) }),
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        } catch {
            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('ERROR_TITLE'),
                        text: t('UNKNOWN_ERROR'),
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }
    },
};
