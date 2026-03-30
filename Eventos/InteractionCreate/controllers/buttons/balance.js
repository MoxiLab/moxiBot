const { MessageFlags } = require('discord.js');

const moxi = require('../../../../i18n');
const { EMOJIS } = require('../../../../Util/emojis');
const { buildNoticeContainer } = require('../../../../Util/v2Notice');
const {
    parseBalanceCustomId,
    buildBalanceMessage,
    getOrCreateEconomyRaw,
} = require('../../../../Util/balanceView');

module.exports = async function balanceButtons(interaction) {
    const parsed = parseBalanceCustomId(interaction?.customId);
    if (!parsed) return false;

    const { action, viewerId, targetId } = parsed;

    // Solo el viewer puede tocar el panel
    if (interaction.user?.id !== String(viewerId)) {
        const lang = await moxi.guildLang(interaction.guildId || interaction.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
        const t = (k, vars = {}) => moxi.translate(`economy/balance:${k}`, lang, vars);
        const payload = {
            content: '',
            components: [buildNoticeContainer({ emoji: EMOJIS.noEntry, text: t('ONLY_AUTHOR') })],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        };
        if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => null);
        else await interaction.reply(payload).catch(() => null);
        return true;
    }

    // Solo puedes depositar/retirar tu propio balance
    const canAct = String(viewerId) === String(targetId);

    if ((action === 'deposit' || action === 'withdraw') && !canAct) {
        const lang = await moxi.guildLang(interaction.guildId || interaction.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
        const t = (k, vars = {}) => moxi.translate(`economy/balance:${k}`, lang, vars);
        const payload = {
            content: '',
            components: [buildNoticeContainer({ emoji: EMOJIS.noEntry, text: t('ONLY_OWN_BALANCE') })],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        };
        if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => null);
        else await interaction.reply(payload).catch(() => null);
        return true;
    }

    if (action === 'deposit') {
        const eco = await getOrCreateEconomyRaw(targetId);
        const bal = Math.max(0, Math.trunc(Number(eco?.balance) || 0));
        if (bal <= 0) {
            const lang = await moxi.guildLang(interaction.guildId || interaction.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
            const t = (k, vars = {}) => moxi.translate(`economy/balance:${k}`, lang, vars);
            const payload = {
                content: '',
                components: [buildNoticeContainer({ emoji: EMOJIS.info, text: t('NO_COINS_TO_DEPOSIT') })],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            };
            if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => null);
            else await interaction.reply(payload).catch(() => null);
            return true;
        }

        // Depositar todo
        eco.balance = bal - bal;
        eco.bank = Math.max(0, Math.trunc(Number(eco?.bank) || 0)) + bal;
        await eco.save();
    }

    if (action === 'withdraw') {
        const eco = await getOrCreateEconomyRaw(targetId);
        const bank = Math.max(0, Math.trunc(Number(eco?.bank) || 0));
        if (bank <= 0) {
            const lang = await moxi.guildLang(interaction.guildId || interaction.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
            const t = (k, vars = {}) => moxi.translate(`economy/balance:${k}`, lang, vars);
            const payload = {
                content: '',
                components: [buildNoticeContainer({ emoji: EMOJIS.info, text: t('NO_COINS_TO_WITHDRAW') })],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            };
            if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => null);
            else await interaction.reply(payload).catch(() => null);
            return true;
        }

        // Retirar todo
        eco.bank = bank - bank;
        eco.balance = Math.max(0, Math.trunc(Number(eco?.balance) || 0)) + bank;
        await eco.save();
    }

    // Refresh (o después de mover)
    const guildId = interaction.guildId || interaction.guild?.id;
    const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

    const targetUser = await interaction.client.users.fetch(targetId).catch(() => null);
    const payload = await buildBalanceMessage({ guildId, lang, viewerId, targetUser: targetUser || { id: targetId, username: 'Usuario' } });

    await interaction.update(payload).catch(() => null);
    return true;
};
