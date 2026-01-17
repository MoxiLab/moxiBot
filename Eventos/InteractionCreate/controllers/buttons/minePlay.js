const { MessageFlags } = require('discord.js');

const moxi = require('../../../../i18n');
const { EMOJIS } = require('../../../../Util/emojis');
const { buildNoticeContainer } = require('../../../../Util/v2Notice');
const {
    parseMinePlayCustomId,
    buildMinePlayMessageOptions,
    resolveMinePlay,
    buildMineResultPayload,
} = require('../../../../Util/minePlay');

module.exports = async function minePlayButtons(interaction) {
    if (!interaction.isButton?.()) return false;

    const parsed = parseMinePlayCustomId(interaction.customId);
    if (!parsed) return false;

    const { action, userId, parts } = parsed;

    if (interaction.user?.id !== String(userId)) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const payload = {
            content: '',
            components: [buildNoticeContainer({ emoji: EMOJIS.noEntry, text: 'Solo el autor puede usar estos botones.' })],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        };
        if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => null);
        else await interaction.reply(payload).catch(() => null);
        return true;
    }

    if (action === 'play') {
        const zoneId = parts?.[3];
        const payload = buildMinePlayMessageOptions({ userId, zoneId });
        await interaction.update(payload).catch(() => null);
        return true;
    }

    if (action === 'closeplay') {
        const zoneId = parts?.[3];
        const payload = buildMinePlayMessageOptions({ userId, zoneId, disabled: true });
        await interaction.update(payload).catch(() => null);
        return true;
    }

    if (action === 'do') {
        const zoneId = parts?.[3];
        const mode = parts?.[4];
        const choiceId = parts?.[5];
        const seedOrMult = parts?.[6];

        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferUpdate().catch(() => null);
        }

        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const res = await resolveMinePlay({ userId, zoneId, mode, choiceId, seedOrMult, lang });
        const zone = res?.zone;

        // Cooldown / errores -> ephemeral
        if (!res?.ok || res?.reason === 'cooldown' || res?.reason === 'requirement') {
            const payload = buildMineResultPayload({ zone, res, lang });
            await interaction.followUp({ ...payload, flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 }).catch(() => null);
            return true;
        }

        const payload = buildMineResultPayload({ zone, res, lang });
        await interaction.message?.edit?.(payload).catch(() => null);
        return true;
    }

    return false;
};
