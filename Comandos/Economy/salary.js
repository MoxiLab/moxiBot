const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { buildRemindButton } = require('../../Util/cooldownReminderUI');
const { claimCooldownReward, formatDuration } = require('../../Util/economyCore');
const { getWorkStats, getJobDisplayName } = require('../../Util/workSystem');

const { economyCategory } = require('../../Util/commandCategories');

module.exports = {
    name: 'salary',
    alias: ['salary', 'sueldo', 'payday'],
    Category: economyCategory,
    usage: 'salary',
    description: 'commands:CMD_SALARY_DESC',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message) {
        const guildId = message.guildId || message.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const t = (k, vars = {}) => moxi.translate(`economy/salary:${k}`, lang, vars);

        const cooldownMs = 24 * 60 * 60 * 1000;
        const defaultMinAmount = Number.isFinite(Number(process.env.SALARY_MIN)) ? Math.max(0, Math.trunc(Number(process.env.SALARY_MIN))) : 120;
        const defaultMaxAmount = Number.isFinite(Number(process.env.SALARY_MAX)) ? Math.max(defaultMinAmount, Math.trunc(Number(process.env.SALARY_MAX))) : 260;

        let minAmount = defaultMinAmount;
        let maxAmount = defaultMaxAmount;
        let job = null;

        if (process.env.MONGODB) {
            try {
                const stats = await getWorkStats({ userId: message.author.id });
                job = stats?.job || null;

                if (job) {
                    const fixedSalary = Number.isFinite(Number(job.salary)) ? Math.max(0, Math.trunc(Number(job.salary))) : null;
                    if (fixedSalary !== null) {
                        minAmount = fixedSalary;
                        maxAmount = fixedSalary;
                    } else {
                        const jobMin = Number.isFinite(Number(job.min)) ? Math.max(0, Math.trunc(Number(job.min))) : null;
                        const jobMax = Number.isFinite(Number(job.max)) ? Math.max(jobMin ?? 0, Math.trunc(Number(job.max))) : null;
                        if (jobMin !== null && jobMax !== null) {
                            minAmount = jobMin;
                            maxAmount = jobMax;
                        }
                    }
                }
            } catch {
                // Fallback silencioso a SALARY_MIN/MAX si falla la lectura del job.
            }
        }

        const jobDisplay = job ? `${job.emoji || ''} ${getJobDisplayName(job, lang)}`.trim() : '';
        const jobLine = jobDisplay
            ? (String(lang || '').toLowerCase().startsWith('es')
                ? `\nTrabajo: **${jobDisplay}**.`
                : `\nJob: **${jobDisplay}**.`)
            : '';

        const res = await claimCooldownReward({
            userId: message.author.id,
            field: 'lastSalary',
            cooldownMs,
            minAmount,
            maxAmount,
        });

        if (!res.ok) {
            if (res.reason === 'no-db') {
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: t('NO_DB_TITLE'),
                            text: t('NO_DB_TEXT'),
                        })
                    )
                );
            }

            if (res.reason === 'cooldown') {
                const fireAt = Date.now() + (Number(res.nextInMs) || 0);
                const container = buildNoticeContainer({
                    emoji: EMOJIS.hourglass,
                    title: t('COOLDOWN_TITLE'),
                    text: t('COOLDOWN_TEXT', {
                        next: formatDuration(res.nextInMs),
                        balance: res.balance,
                        jobLine,
                    }),
                });
                container.addSeparatorComponents(s => s.setDivider(true));
                container.addActionRowComponents(r => r.addComponents(
                    buildRemindButton({ type: 'salary', fireAt, userId: message.author.id })
                ));
                return message.reply({
                    ...asV2MessageOptions(container),
                    allowedMentions: { repliedUser: false },
                });
            }

            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('ERROR_TITLE'),
                        text: res.message || t('UNKNOWN_ERROR'),
                    })
                )
            );
        }

        return message.reply({
            ...asV2MessageOptions(
                buildNoticeContainer({
                    emoji: '💵',
                    title: t('CLAIMED_TITLE'),
                    text: t('CLAIMED_TEXT', { amount: res.amount, balance: res.balance, jobLine }),
                })
            ),
            allowedMentions: { repliedUser: false },
        });
    },
};
