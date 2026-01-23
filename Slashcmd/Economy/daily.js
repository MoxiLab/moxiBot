const { ChatInputCommandBuilder: SlashCommandBuilder, MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { shouldShowCooldownNotice } = require('../../Util/cooldownNotice');
const { claimCooldownReward, formatDuration } = require('../../Util/economyCore');
const { getSlashCommandDescription } = require('../../Util/slashHelpI18n');

const { description, localizations } = getSlashCommandDescription('daily');

module.exports = {
    cooldown: 0,
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
    },
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription(description)
        .setDescriptionLocalizations(localizations),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const t = (k, vars = {}) => moxi.translate(`economy/daily:${k}`, lang, vars);

        const cooldownMs = 24 * 60 * 60 * 1000;
        const minAmount = Number.isFinite(Number(process.env.DAILY_MIN)) ? Math.max(0, Math.trunc(Number(process.env.DAILY_MIN))) : 200;
        const maxAmount = Number.isFinite(Number(process.env.DAILY_MAX)) ? Math.max(minAmount, Math.trunc(Number(process.env.DAILY_MAX))) : 400;

        const res = await claimCooldownReward({
            userId: interaction.user.id,
            field: 'lastDaily',
            cooldownMs,
            minAmount,
            maxAmount,
        });

        if (!res.ok) {
            if (res.reason === 'no-db') {
                const payload = asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('NO_DB_TITLE'),
                        text: t('NO_DB_TEXT'),
                    })
                );
                return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
            }

            if (res.reason === 'cooldown') {
                const show = shouldShowCooldownNotice({ userId: interaction.user.id, key: 'daily', windowMs: 15_000, threshold: 3 });
                const payload = asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.hourglass,
                        title: t('COOLDOWN_TITLE'),
                        text: show
                            ? t('COOLDOWN_TEXT', { next: formatDuration(res.nextInMs), balance: res.balance })
                            : t('COOLDOWN_SOFT_TEXT', { balance: res.balance }),
                    })
                );
                return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
            }

            const payload = asV2MessageOptions(
                buildNoticeContainer({
                    emoji: EMOJIS.cross,
                    title: t('ERROR_TITLE'),
                    text: res.message || t('UNKNOWN_ERROR'),
                })
            );
            return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
        }

        const payload = asV2MessageOptions(
            buildNoticeContainer({
                emoji: '🎁',
                title: t('CLAIMED_TITLE'),
                text: t('CLAIMED_TEXT', { amount: res.amount, balance: res.balance }),
            })
        );
        return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
    },
};
