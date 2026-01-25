const { MessageFlags } = require('discord.js');

const moxi = require('../../../../i18n');
const { EMOJIS } = require('../../../../Util/emojis');
const { buildNoticeContainer, asV2MessageOptions } = require('../../../../Util/v2Notice');
const { formatDuration } = require('../../../../Util/economyCore');
const { scheduleCooldownReminder, cancelCooldownReminder, formatType } = require('../../../../Util/cooldownReminders');
const { buildCancelReminderButton } = require('../../../../Util/cooldownReminderUI');

function parseRemindId(customId) {
    const raw = String(customId || '');
    if (!raw.startsWith('cdrem:')) return null;
    const parts = raw.split(':');
    // cdrem:<type>:<fireAt>:<userId>
    const type = parts[1];
    const fireAt = Number(parts[2]);
    const userId = parts[3];
    if (!type || !userId || !Number.isFinite(fireAt)) return null;
    return { type, fireAt, userId };
}

function parseCancelId(customId) {
    const raw = String(customId || '');
    if (!raw.startsWith('cdremcancel:')) return null;
    const parts = raw.split(':');
    // cdremcancel:<type>:<userId>
    const type = parts[1];
    const userId = parts[2];
    if (!type || !userId) return null;
    return { type, userId };
}

async function safeReply(interaction, payload) {
    try {
        if (!interaction.deferred && !interaction.replied) return await interaction.reply(payload);
        return await interaction.followUp(payload);
    } catch {
        return null;
    }
}

module.exports = async function cooldownReminderButtons(interaction) {
    if (!interaction.isButton?.()) return false;

    const remind = parseRemindId(interaction.customId);
    const cancel = remind ? null : parseCancelId(interaction.customId);
    if (!remind && !cancel) return false;

    const guildId = interaction.guildId || interaction.guild?.id;
    const fallbackLang = interaction.guildLocale || interaction.locale || process.env.DEFAULT_LANG || 'es-ES';
    const lang = await moxi.guildLang(guildId, fallbackLang);

    const uid = interaction.user?.id;
    const expected = remind ? remind.userId : cancel.userId;
    if (uid !== String(expected)) {
        const payload = asV2MessageOptions(
            buildNoticeContainer({
                emoji: EMOJIS.noEntry,
                text: moxi.translate('misc:ONLY_AUTHOR_BUTTONS', lang),
            })
        );
        return safeReply(interaction, { ...payload, flags: payload.flags | MessageFlags.Ephemeral }).then(() => true);
    }

    if (cancel) {
        await cancelCooldownReminder({ guildId, userId: uid, type: cancel.type });
        const payload = asV2MessageOptions(
            buildNoticeContainer({
                emoji: EMOJIS.ok || '✅',
                title: 'Recordatorio cancelado',
                text: `Cancelé tu recordatorio de **${formatType(cancel.type)}**.`,
            })
        );
        await safeReply(interaction, { ...payload, flags: payload.flags | MessageFlags.Ephemeral });
        return true;
    }

    const res = await scheduleCooldownReminder({
        client: interaction.client,
        guildId,
        channelId: interaction.channelId,
        userId: uid,
        type: remind.type,
        fireAt: remind.fireAt,
    });

    const remainingMs = Math.max(0, remind.fireAt - Date.now());
    const whenText = formatDuration(remainingMs);

    const container = buildNoticeContainer({
        emoji: '🔔',
        title: 'Recordatorio activado',
        text: `Te avisaré cuando termine el cooldown de **${formatType(remind.type)}** (aprox. **${whenText}**).${res.persisted ? '' : '\n\n⚠️ Nota: sin MongoDB este recordatorio no se guarda si el bot se reinicia.'}`,
    });
    container.addSeparatorComponents(s => s.setDivider(true));
    container.addActionRowComponents(r => r.addComponents(buildCancelReminderButton({ type: remind.type, userId: uid })));

    const payload = asV2MessageOptions(container);
    await safeReply(interaction, { ...payload, flags: payload.flags | MessageFlags.Ephemeral });
    return true;
};
