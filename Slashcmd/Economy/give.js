const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { transferBalance } = require('../../Util/economyCore');
const { getSlashCommandDescription } = require('../../Util/slashHelpI18n');

const { description, localizations } = getSlashCommandDescription('give');

function formatInt(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return '0';
    return Math.trunc(x).toLocaleString('en-US');
}

module.exports = {
    cooldown: 0,
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
    },
    data: new SlashCommandBuilder()
        .setName('give')
        .setDescription(description)
        .setDescriptionLocalizations(localizations)
        .addUserOption((opt) =>
            opt
                .setName('usuario')
                .setDescription('Usuario que recibirá las coins')
                .setRequired(true)
        )
        .addIntegerOption((opt) =>
            opt
                .setName('cantidad')
                .setDescription('Cantidad a dar')
                .setRequired(true)
                .setMinValue(1)
        ),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const t = (k, vars = {}) => moxi.translate(`economy/give:${k}`, lang, vars);

        const target = interaction.options.getUser('usuario', true);
        const amount = interaction.options.getInteger('cantidad', true);

        if (target.bot) {
            const payload = asV2MessageOptions(
                buildNoticeContainer({
                    emoji: EMOJIS.cross,
                    title: t('BOT_TITLE'),
                    text: t('BOT_TEXT'),
                })
            );
            return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
        }

        if (String(target.id) === String(interaction.user.id)) {
            const payload = asV2MessageOptions(
                buildNoticeContainer({
                    emoji: EMOJIS.cross,
                    title: t('SELF_TITLE'),
                    text: t('SELF_TEXT'),
                })
            );
            return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
        }

        try {
            const res = await transferBalance({ fromUserId: interaction.user.id, toUserId: target.id, amount });

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

                if (res.reason === 'insufficient') {
                    const payload = asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: t('INSUFFICIENT_TITLE'),
                            text: t('INSUFFICIENT_TEXT', { amount: formatInt(amount), balance: formatInt(res.balance ?? 0) }),
                        })
                    );
                    return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
                }

                const payload = asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('ERROR_TITLE'),
                        text: t('UNKNOWN_ERROR'),
                    })
                );
                return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
            }

            const payload = asV2MessageOptions(
                buildNoticeContainer({
                    emoji: '🎁',
                    title: t('SUCCESS_TITLE'),
                    text: t('SUCCESS_TEXT', { user: `<@${target.id}>`, amount: formatInt(res.amount), balance: formatInt(res.fromBalance) }),
                })
            );
            return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
        } catch {
            const payload = asV2MessageOptions(
                buildNoticeContainer({
                    emoji: EMOJIS.cross,
                    title: t('ERROR_TITLE'),
                    text: t('UNKNOWN_ERROR'),
                })
            );
            return interaction.reply({ ...payload, flags: payload.flags | MessageFlags.Ephemeral });
        }
    },
};
