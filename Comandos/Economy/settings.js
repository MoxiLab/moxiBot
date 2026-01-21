const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { economyCategory } = require('../../Util/commandCategories');

module.exports = {
    name: 'settings',
    alias: ['settings'],
    Category: economyCategory,
    usage: 'settings',
    description: 'commands:CMD_SETTINGS_DESC',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message) {
        const guildId = message.guildId || message.guild?.id;
        const lang = message.lang || await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const prefix = await moxi.guildPrefix(guildId, process.env.PREFIX || '.');
        const t = (k, vars = {}) => moxi.translate(`economy/settings:${k}`, lang, vars);

        const dailyMin = Number.isFinite(Number(process.env.DAILY_MIN)) ? Math.max(0, Math.trunc(Number(process.env.DAILY_MIN))) : 200;
        const dailyMax = Number.isFinite(Number(process.env.DAILY_MAX)) ? Math.max(dailyMin, Math.trunc(Number(process.env.DAILY_MAX))) : 400;
        const workMin = Number.isFinite(Number(process.env.WORK_MIN)) ? Math.max(0, Math.trunc(Number(process.env.WORK_MIN))) : 100;
        const workMax = Number.isFinite(Number(process.env.WORK_MAX)) ? Math.max(workMin, Math.trunc(Number(process.env.WORK_MAX))) : 300;
        const salaryMin = Number.isFinite(Number(process.env.SALARY_MIN)) ? Math.max(0, Math.trunc(Number(process.env.SALARY_MIN))) : 250;
        const salaryMax = Number.isFinite(Number(process.env.SALARY_MAX)) ? Math.max(salaryMin, Math.trunc(Number(process.env.SALARY_MAX))) : 550;

        const lines = [
            t('LINE_PREFIX', { prefix }),
            t('LINE_LANG', { lang }),
            t('LINE_DB', { status: process.env.MONGODB ? t('DB_ON') : t('DB_OFF') }),
            t('LINE_DAILY', { min: dailyMin, max: dailyMax }),
            t('LINE_WORK', { min: workMin, max: workMax }),
            t('LINE_SALARY', { min: salaryMin, max: salaryMax }),
        ].filter(Boolean);

        return message.reply({
            ...asV2MessageOptions(
                buildNoticeContainer({
                    emoji: EMOJIS.gear || '⚙️',
                    title: t('TITLE'),
                    text: lines.join('\n'),
                    footerText: t('FOOTER'),
                })
            ),
            allowedMentions: { repliedUser: false },
        });
    },
};
