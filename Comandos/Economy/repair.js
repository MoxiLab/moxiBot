const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { resolveItemFromInput } = require('../../Util/useItem');

const { economyCategory } = require('../../Util/commandCategories');

module.exports = {
    name: 'repair',
    alias: ['repair'],
    Category: economyCategory,
    usage: 'repair <id|nombre|itemId>',
    description: 'commands:CMD_REPAIR_DESC',
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
        const t = (k, vars = {}) => moxi.translate(`economy/repair:${k}`, lang, vars);

        if (!process.env.MONGODB) {
            return message.reply({
                ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, title: t('TITLE'), text: t('NO_DB') })),
                allowedMentions: { repliedUser: false },
            });
        }

        const raw = Array.isArray(args) ? args.join(' ').trim() : '';
        if (!raw) {
            return message.reply({
                ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.info, title: t('TITLE'), text: t('USAGE', { prefix }) })),
                allowedMentions: { repliedUser: false },
            });
        }

        const target = resolveItemFromInput({ query: raw, lang });
        if (!target?.itemId) {
            return message.reply({
                ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, title: t('NOT_FOUND_TITLE'), text: t('NOT_FOUND_TEXT') })),
                allowedMentions: { repliedUser: false },
            });
        }

        const KIT_ID = 'herramientas/kit-de-reparacion';

        try {
            // eslint-disable-next-line global-require
            const { ensureMongoConnection } = require('../../Util/mongoConnect');
            await ensureMongoConnection();
            // eslint-disable-next-line global-require
            const { Economy } = require('../../Models/EconomySchema');

            const userId = message.author.id;
            let eco = await Economy.findOne({ userId });
            if (!eco) eco = await Economy.create({ userId, balance: 0, bank: 0, sakuras: 0 });

            const inv = Array.isArray(eco.inventory) ? eco.inventory : [];
            const kitRow = inv.find((x) => x && String(x.itemId) === KIT_ID);
            const kitHave = kitRow ? Math.max(0, Number(kitRow.amount) || 0) : 0;

            if (kitHave <= 0) {
                return message.reply({
                    ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, title: t('NEED_KIT_TITLE'), text: t('NEED_KIT_TEXT') })),
                    allowedMentions: { repliedUser: false },
                });
            }

            const targetRow = inv.find((x) => x && String(x.itemId) === String(target.itemId));
            const haveTarget = targetRow ? Math.max(0, Number(targetRow.amount) || 0) : 0;
            if (haveTarget <= 0) {
                return message.reply({
                    ...asV2MessageOptions(buildNoticeContainer({ emoji: EMOJIS.cross, title: t('NOT_OWNED_TITLE'), text: t('NOT_OWNED_TEXT') })),
                    allowedMentions: { repliedUser: false },
                });
            }

            kitRow.amount = kitHave - 1;
            eco.inventory = kitRow.amount <= 0 ? inv.filter((x) => x && String(x.itemId) !== KIT_ID) : inv;
            eco.lastRepair = new Date();
            await eco.save();

            return message.reply({
                ...asV2MessageOptions(buildNoticeContainer({ emoji: '🛠️', title: t('SUCCESS_TITLE'), text: t('SUCCESS_TEXT', { item: target.name || target.itemId }) })),
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
