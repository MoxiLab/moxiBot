const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { getOrCreateEconomy } = require('../../Util/economyCore');

const { economyCategory } = require('../../Util/commandCategories');
module.exports = {
    name: 'claimcode',
    alias: ['claimcode'],
    Category: economyCategory,
    usage: 'claimcode <codigo>',
    description: 'commands:CMD_CLAIMCODE_DESC',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message, args) {
        const guildId = message.guildId || message.guild?.id;
        const lang = message.lang || await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const prefix = await moxi.guildPrefix(guildId, process.env.PREFIX || '.');
        const t = (k, vars = {}) => moxi.translate(`economy/claimcode:${k}`, lang, vars);

        const raw = Array.isArray(args) ? args.join(' ').trim() : '';
        const code = raw.replace(/\s+/g, '').toUpperCase();

        if (!code) {
            return message.reply({
                ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.info, title: t('TITLE'), text: t('USAGE', { prefix }) })),
                allowedMentions: { repliedUser: false },
            });
        }

        if (!process.env.MONGODB) {
            return message.reply({
                ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, title: t('TITLE'), text: t('NO_DB') })),
                allowedMentions: { repliedUser: false },
            });
        }

        const defaults = {
            WELCOME: 500,
            START: 250,
            MOXI2026: 1000,
        };

        let extra = {};
        const rawEnv = String(process.env.REDEEM_CODES || '').trim();
        if (rawEnv) {
            try {
                const parsed = JSON.parse(rawEnv);
                if (parsed && typeof parsed === 'object') extra = parsed;
            } catch { }
        }

        const allCodes = { ...defaults, ...extra };
        const valueRaw = allCodes[code];
        const amount = typeof valueRaw === 'number' ? Math.trunc(valueRaw) : (valueRaw && typeof valueRaw === 'object' ? Math.trunc(valueRaw.amount || 0) : 0);

        if (!amount || amount <= 0) {
            return message.reply({
                ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, title: t('INVALID_TITLE'), text: t('INVALID_TEXT') })),
                allowedMentions: { repliedUser: false },
            });
        }

        try {
            const eco = await getOrCreateEconomy(message.author.id);
            const redeemed = Array.isArray(eco.redeemedCodes) ? eco.redeemedCodes : [];

            if (redeemed.map(s => String(s).toUpperCase()).includes(code)) {
                return message.reply({
                    ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.info, title: t('ALREADY_TITLE'), text: t('ALREADY_TEXT') })),
                    allowedMentions: { repliedUser: false },
                });
            }

            redeemed.push(code);
            eco.redeemedCodes = redeemed;
            eco.balance = Math.max(0, Number(eco.balance || 0) + amount);
            await eco.save();

            return message.reply({
                ...asV2MessageOptions(buildNoticeContainer({ emoji: '🎟️', title: t('SUCCESS_TITLE'), text: t('SUCCESS_TEXT', { amount, balance: eco.balance }) })),
                allowedMentions: { repliedUser: false },
            });
        } catch {
            return message.reply({
                ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, title: t('TITLE'), text: t('ERROR') })),
                allowedMentions: { repliedUser: false },
            });
        }
    },
};
