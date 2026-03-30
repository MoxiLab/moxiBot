const { ContainerBuilder, MessageFlags } = require('discord.js');

const moxi = require('../../i18n');
const { Bot } = require('../../Config');
const { EMOJIS } = require('../../Util/emojis');
const { isDiscordOnlyOwner } = require('../../Util/ownerPermissions');
const {
    getMaintenanceStateCached,
    setMaintenanceStateCached,
} = require('../../Util/maintenanceMode');

function buildPanel({ title, body }) {
    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(c => c.setContent(`# ${title}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(body));

    return {
        content: '',
        components: [container],
        flags: MessageFlags.IsComponentsV2,
    };
}

function formatDateTag(dateLike) {
    if (!dateLike) return '-';
    const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
    if (Number.isNaN(date.getTime())) return '-';
    return `<t:${Math.floor(date.getTime() / 1000)}:F>`;
}

async function collectMaintenanceGuildCount(client) {
    if (client?.shard && typeof client.shard.broadcastEval === 'function') {
        const shardCounts = await client.shard.broadcastEval((c) => c.guilds.cache.size);
        return shardCounts.reduce((acc, n) => acc + Number(n || 0), 0);
    }

    return Number(client?.guilds?.cache?.size || 0);
}

module.exports = {
    name: 'mantenimiento',
    alias: ['maintenance', 'mant', 'mtto', 'manten'],
    Category: 'Root',
    description: () => 'Gestiona el modo mantenimiento global del bot',
    usage: 'mantenimiento <activar|desactivar|status> [motivo]',
    cooldown: 5,

    async execute(Moxi, message, args = []) {
        const guildId = message.guildId || message.guild?.id;
        await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const isOwner = await isDiscordOnlyOwner({ client: Moxi, userId: message.author?.id }).catch(() => false);
        if (!isOwner) {
            return message.reply(buildPanel({
                title: 'Mantenimiento',
                body: `${EMOJIS.cross || '❌'} Solo el owner del bot puede usar este comando global.`,
            }));
        }

        const sub = String(args[0] || '').trim().toLowerCase();

        if (!sub || sub === 'help' || sub === 'ayuda') {
            return message.reply(buildPanel({
                title: 'Mantenimiento',
                body: `${EMOJIS.info || 'ℹ️'} Uso: \`mantenimiento <activar|desactivar|status> [motivo]\``,
            }));
        }

        if (sub === 'status') {
            const state = await getMaintenanceStateCached();
            const statusText = state.enabled ? 'ACTIVO' : 'INACTIVO';
            const reasonText = state.reason || '-';
            const byText = state.updatedByTag || (state.updatedBy ? `<@${state.updatedBy}>` : '-');
            const dateText = formatDateTag(state.updatedAt);

            return message.reply(buildPanel({
                title: 'Estado de mantenimiento',
                body: `${EMOJIS.info || 'ℹ️'} Estado: **${statusText}**\n`
                    + `${EMOJIS.warn || '⚠️'} Motivo: ${reasonText}\n`
                    + `${EMOJIS.user || '👤'} Ultimo cambio por: ${byText}\n`
                    + `${EMOJIS.clock || '⏰'} Fecha: ${dateText}`,
            }));
        }

        if (sub === 'activar' || sub === 'on') {
            const reason = (args.slice(1).join(' ').trim()) || 'Actualizacion interna.';
            const next = await setMaintenanceStateCached({
                enabled: true,
                reason,
                updatedBy: message.author?.id,
                updatedByTag: message.author?.tag,
            });

            return message.reply(buildPanel({
                title: 'Mantenimiento activado',
                body: `${EMOJIS.tick || '✅'} El modo mantenimiento quedo **ACTIVO**.\n`
                    + `${EMOJIS.warn || '⚠️'} Motivo: ${next.reason || '-'}`,
            }));
        }

        if (sub === 'desactivar' || sub === 'off') {
            await setMaintenanceStateCached({
                enabled: false,
                reason: '',
                updatedBy: message.author?.id,
                updatedByTag: message.author?.tag,
            });

            const guildCount = await collectMaintenanceGuildCount(Moxi).catch(() => 0);

            return message.reply(buildPanel({
                title: 'Mantenimiento desactivado',
                body: `${EMOJIS.tick || '✅'} El modo mantenimiento quedo **INACTIVO**.\n`
                    + `${EMOJIS.earth || '🌍'} Servidores aplicados: **${guildCount}**`,
            }));
        }

        return message.reply(buildPanel({
            title: 'Mantenimiento',
            body: `${EMOJIS.cross || '❌'} Subcomando invalido. Usa \`activar\`/\`on\`, \`desactivar\`/\`off\` o \`status\`.`,
        }));
    },
};
