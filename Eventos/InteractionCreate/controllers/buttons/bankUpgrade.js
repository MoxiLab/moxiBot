const { MessageFlags, ButtonBuilder, ButtonStyle } = require('discord.js');

const moxi = require('../../../../i18n');
const { EMOJIS } = require('../../../../Util/emojis');
const { buildNoticeContainer, asV2MessageOptions } = require('../../../../Util/v2Notice');
const { getOrCreateEconomyRaw } = require('../../../../Util/balanceView');
const { getBankInfo, formatInt } = require('../../../../Util/bankSystem');

function parse(customId) {
    const raw = String(customId || '');
    if (!raw.startsWith('bankup:')) return null;
    const parts = raw.split(':');
    // bankup:upgrade:<userId>
    const action = parts[1];
    const userId = parts[2];
    if (!action || !userId) return null;
    return { action, userId };
}

async function safeReply(interaction, payload) {
    try {
        if (!interaction.deferred && !interaction.replied) return await interaction.reply(payload);
        return await interaction.followUp(payload);
    } catch {
        return null;
    }
}

module.exports = async function bankUpgradeButtons(interaction) {
    if (!interaction.isButton?.()) return false;

    const parsed = parse(interaction.customId);
    if (!parsed) return false;

    const { action, userId } = parsed;

    const guildId = interaction.guildId || interaction.guild?.id;
    const fallbackLang = interaction.guildLocale || interaction.locale || process.env.DEFAULT_LANG || 'es-ES';
    const lang = await moxi.guildLang(guildId, fallbackLang);

    if (interaction.user?.id !== String(userId)) {
        const payload = asV2MessageOptions(
            buildNoticeContainer({ emoji: EMOJIS.noEntry, text: moxi.translate('misc:ONLY_AUTHOR_BUTTONS', lang) })
        );
        await safeReply(interaction, { ...payload, flags: payload.flags | MessageFlags.Ephemeral });
        return true;
    }

    if (action !== 'upgrade') return false;

    try {
        const eco = await getOrCreateEconomyRaw(userId);
        const info = getBankInfo(eco);

        const payload = asV2MessageOptions(
            buildNoticeContainer({
                emoji: EMOJIS.info,
                title: 'Mejora de banco',
                text:
                    `Ahora el banco se mejora comprándolo en la tienda.\n\n` +
                    `Ítem: **Expansión de Banco**\n` +
                    `ID: **mejoras/expansion-de-banco**\n` +
                    `Siguiente coste aprox.: **${formatInt(info.nextCost)}** 🪙\n\n` +
                    `Usa: \`/buy item: mejoras/expansion-de-banco\` o \`${process.env.PREFIX || '.'}buy mejoras/expansion-de-banco\``,
            })
        );

        await safeReply(interaction, { ...payload, flags: payload.flags | MessageFlags.Ephemeral });
        return true;
    } catch {
        const payload = asV2MessageOptions(
            buildNoticeContainer({ emoji: EMOJIS.cross, title: 'Banco', text: 'No pude mejorar el banco ahora mismo.' })
        );
        await safeReply(interaction, { ...payload, flags: payload.flags | MessageFlags.Ephemeral });
        return true;
    }
};
