const { MessageFlags } = require('discord.js');

const moxi = require('../../../../i18n');
const { EMOJIS } = require('../../../../Util/emojis');
const { buildNoticeContainer } = require('../../../../Util/v2Notice');
const { buildCrimeMessageOptions } = require('../../../../Util/crimeView');

module.exports = async function crimeSelectMenus(interaction, Moxi, logger) {
    if (!interaction.isStringSelectMenu()) return false;

    const id = String(interaction.customId || '');
    if (!id.startsWith('crime:')) return false;

    const parts = id.split(':');
    const action = parts[1] || '';
    const userId = parts[2] || '';

    if (interaction.user?.id !== String(userId)) {
        await interaction.reply({ content: 'Solo quien abrió este panel puede usar el menú.', flags: MessageFlags.Ephemeral }).catch(() => null);
        return true;
    }

    const guildId = interaction.guildId || interaction.guild?.id;
    const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

    if (action === 'activity') {
        const selected = String(interaction.values?.[0] || '').trim();
        const payload = buildCrimeMessageOptions({ lang, userId, activityId: selected });
        await interaction.update(payload).catch(() => null);
        return true;
    }

    if (action === 'risk') {
        const activityId = parts[3];
        const selected = String(interaction.values?.[0] || '').trim() || 'normal';
        const payload = buildCrimeMessageOptions({ lang, userId, activityId, state: { risk: selected } });
        await interaction.update(payload).catch(() => null);
        return true;
    }

    // Fallback
    const payload = {
        content: '',
        components: [buildNoticeContainer({ emoji: EMOJIS.cross, title: 'Crime', text: 'Menú no reconocido.' })],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    };
    if (interaction.deferred || interaction.replied) await interaction.followUp(payload).catch(() => null);
    else await interaction.reply(payload).catch(() => null);
    return true;
};
