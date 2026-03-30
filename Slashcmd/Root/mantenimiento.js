const {
    ChannelType,
    ContainerBuilder,
    MessageFlags,
    PermissionsBitField,
} = require('discord.js');

const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');
const moxi = require('../../i18n');
const { Bot } = require('../../Config');
const { EMOJIS } = require('../../Util/emojis');
const { isDiscordOnlyOwner } = require('../../Util/ownerPermissions');
const {
    getMaintenanceStateCached,
    setMaintenanceStateCached,
} = require('../../Util/maintenanceMode');

function buildPanel({ title, body, ephemeral = true }) {
    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(c => c.setContent(`# ${title}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(body));

    const flags = ephemeral
        ? (MessageFlags.Ephemeral | MessageFlags.IsComponentsV2)
        : MessageFlags.IsComponentsV2;

    return {
        content: '',
        components: [container],
        flags,
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

function createAnnouncementContainer({ enabled, reason, updatedByTag, accentColor }) {
    const title = enabled ? 'Mantenimiento activado' : 'Mantenimiento desactivado';
    const stateLine = enabled
        ? `${EMOJIS.warn || '⚠️'} El bot ha entrado en mantenimiento.`
        : `${EMOJIS.tick || '✅'} El mantenimiento ha finalizado.`;
    const reasonLine = enabled
        ? `Motivo: ${reason || 'Actualizacion interna.'}`
        : 'Ya puedes usar todos los comandos con normalidad.';
    const byLine = updatedByTag ? `Gestionado por: ${updatedByTag}` : '';

    const body = [stateLine, reasonLine, byLine].filter(Boolean).join('\n');

    return new ContainerBuilder()
        .setAccentColor(accentColor)
        .addTextDisplayComponents(c => c.setContent(`# ${title}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(body));
}

function resolveAnnouncementChannel(guild) {
    if (!guild) return null;
    const me = guild.members?.me;
    if (!me) return null;

    const canSend = (channel) => {
        if (!channel || !channel.isTextBased?.()) return false;
        if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) return false;

        const perms = channel.permissionsFor?.(me);
        if (!perms) return false;

        return perms.has(PermissionsBitField.Flags.ViewChannel)
            && perms.has(PermissionsBitField.Flags.SendMessages);
    };

    if (canSend(guild.systemChannel)) return guild.systemChannel;

    const preferredByName = guild.channels.cache
        .filter(ch => canSend(ch))
        .sort((a, b) => {
            const score = (name) => {
                const n = String(name || '').toLowerCase();
                if (n.includes('anuncio') || n.includes('announce')) return 0;
                if (n.includes('general')) return 1;
                if (n.includes('chat')) return 2;
                if (n.includes('bot')) return 3;
                return 9;
            };
            const scoreDiff = score(a.name) - score(b.name);
            if (scoreDiff !== 0) return scoreDiff;
            return (a.rawPosition || 0) - (b.rawPosition || 0);
        })
        .first();

    if (preferredByName) return preferredByName;

    return guild.channels.cache
        .filter(ch => canSend(ch))
        .sort((a, b) => (a.rawPosition || 0) - (b.rawPosition || 0))
        .first() || null;
}

async function broadcastMaintenanceNotice(client, state) {
    const context = {
        enabled: !!state?.enabled,
        reason: String(state?.reason || ''),
        updatedByTag: String(state?.updatedByTag || ''),
        accentColor: Number(Bot.AccentColor) || 0xFFB6E6,
    };

    if (client?.shard && typeof client.shard.broadcastEval === 'function') {
        const shardResults = await client.shard.broadcastEval(
            async (c, ctx) => {
                const {
                    ChannelType,
                    ContainerBuilder,
                    MessageFlags,
                    PermissionsBitField,
                } = require('discord.js');

                const canSend = (channel, me) => {
                    if (!channel || !channel.isTextBased?.()) return false;
                    if (![ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(channel.type)) return false;
                    const perms = channel.permissionsFor?.(me);
                    if (!perms) return false;
                    return perms.has(PermissionsBitField.Flags.ViewChannel)
                        && perms.has(PermissionsBitField.Flags.SendMessages);
                };

                const pickChannel = (guild) => {
                    const me = guild?.members?.me;
                    if (!guild || !me) return null;
                    if (canSend(guild.systemChannel, me)) return guild.systemChannel;

                    const byName = guild.channels.cache
                        .filter(ch => canSend(ch, me))
                        .sort((a, b) => {
                            const score = (name) => {
                                const n = String(name || '').toLowerCase();
                                if (n.includes('anuncio') || n.includes('announce')) return 0;
                                if (n.includes('general')) return 1;
                                if (n.includes('chat')) return 2;
                                if (n.includes('bot')) return 3;
                                return 9;
                            };
                            const scoreDiff = score(a.name) - score(b.name);
                            if (scoreDiff !== 0) return scoreDiff;
                            return (a.rawPosition || 0) - (b.rawPosition || 0);
                        })
                        .first();

                    if (byName) return byName;

                    return guild.channels.cache
                        .filter(ch => canSend(ch, me))
                        .sort((a, b) => (a.rawPosition || 0) - (b.rawPosition || 0))
                        .first() || null;
                };

                const makeContainer = () => {
                    const title = ctx.enabled ? 'Mantenimiento activado' : 'Mantenimiento desactivado';
                    const stateLine = ctx.enabled
                        ? '⚠️ El bot ha entrado en mantenimiento.'
                        : '✅ El mantenimiento ha finalizado.';
                    const reasonLine = ctx.enabled
                        ? `Motivo: ${ctx.reason || 'Actualizacion interna.'}`
                        : 'Ya puedes usar todos los comandos con normalidad.';
                    const byLine = ctx.updatedByTag ? `Gestionado por: ${ctx.updatedByTag}` : '';

                    return new ContainerBuilder()
                        .setAccentColor(ctx.accentColor)
                        .addTextDisplayComponents((txt) => txt.setContent(`# ${title}`))
                        .addSeparatorComponents((sep) => sep.setDivider(true))
                        .addTextDisplayComponents((txt) => txt.setContent([stateLine, reasonLine, byLine].filter(Boolean).join('\n')));
                };

                let attempted = 0;
                let sent = 0;
                let failed = 0;

                for (const guild of c.guilds.cache.values()) {
                    attempted += 1;
                    const channel = pickChannel(guild);
                    if (!channel) {
                        failed += 1;
                        continue;
                    }

                    const container = makeContainer();
                    const ok = await channel
                        .send({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 })
                        .then(() => true)
                        .catch(() => false);

                    if (ok) sent += 1;
                    else failed += 1;
                }

                return { attempted, sent, failed };
            },
            { context }
        );

        const totals = shardResults.reduce(
            (acc, entry) => {
                acc.attempted += Number(entry?.attempted || 0);
                acc.sent += Number(entry?.sent || 0);
                acc.failed += Number(entry?.failed || 0);
                return acc;
            },
            { attempted: 0, sent: 0, failed: 0 }
        );

        return totals;
    }

    let attempted = 0;
    let sent = 0;
    let failed = 0;

    for (const guild of client.guilds.cache.values()) {
        attempted += 1;
        const channel = resolveAnnouncementChannel(guild);
        if (!channel) {
            failed += 1;
            continue;
        }

        const container = createAnnouncementContainer({
            enabled: context.enabled,
            reason: context.reason,
            updatedByTag: context.updatedByTag,
            accentColor: context.accentColor,
        });

        const ok = await channel
            .send({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 })
            .then(() => true)
            .catch(() => false);

        if (ok) sent += 1;
        else failed += 1;
    }

    return { attempted, sent, failed };
}

module.exports = {
    cooldown: 5,
    Category: (lang = 'es-ES') => {
        const out = moxi.translate('commands:CATEGORY_ROOT', lang);
        return out && out !== 'commands:CATEGORY_ROOT' ? out : 'Root';
    },

    data: new SlashCommandBuilder()
        .setName('mantenimiento')
        .setDescription('Gestiona el modo mantenimiento global del bot')
        .setDMPermission(false)
        .addSubcommand(sub =>
            sub
                .setName('activar')
                .setDescription('Activa mantenimiento global del bot')
                .addStringOption(o =>
                    o
                        .setName('motivo')
                        .setDescription('Motivo visible para los usuarios')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('on')
                .setDescription('Activa mantenimiento global del bot')
                .addStringOption(o =>
                    o
                        .setName('motivo')
                        .setDescription('Motivo visible para los usuarios')
                        .setRequired(false)
                )
        )
        .addSubcommand(sub =>
            sub
                .setName('desactivar')
                .setDescription('Desactiva mantenimiento global del bot')
        )
        .addSubcommand(sub =>
            sub
                .setName('off')
                .setDescription('Desactiva mantenimiento global del bot')
        )
        .addSubcommand(sub =>
            sub
                .setName('status')
                .setDescription('Muestra el estado actual del mantenimiento')
        ),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const isOwner = await isDiscordOnlyOwner({ client: Moxi, userId: interaction.user?.id }).catch(() => false);
        if (!isOwner) {
            return interaction.reply(buildPanel({
                title: 'Mantenimiento',
                body: `${EMOJIS.cross || '❌'} Solo el owner del bot puede usar este comando global.`,
                ephemeral: true,
            }));
        }

        const sub = interaction.options.getSubcommand();

        if (sub === 'status') {
            const state = await getMaintenanceStateCached();
            const statusText = state.enabled ? 'ACTIVO' : 'INACTIVO';
            const reasonText = state.reason || '-';
            const byText = state.updatedByTag || (state.updatedBy ? `<@${state.updatedBy}>` : '-');
            const dateText = formatDateTag(state.updatedAt);

            return interaction.reply(buildPanel({
                title: 'Estado de mantenimiento',
                body: `${EMOJIS.info || 'ℹ️'} Estado: **${statusText}**\n` +
                    `${EMOJIS.warn || '⚠️'} Motivo: ${reasonText}\n` +
                    `${EMOJIS.user || '👤'} Ultimo cambio por: ${byText}\n` +
                    `${EMOJIS.clock || '⏰'} Fecha: ${dateText}`,
                ephemeral: true,
            }));
        }

        if (sub === 'activar' || sub === 'on') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });

            const reason = interaction.options.getString('motivo') || 'Actualizacion interna.';
            const next = await setMaintenanceStateCached({
                enabled: true,
                reason,
                updatedBy: interaction.user?.id,
                updatedByTag: interaction.user?.tag,
            });

            return interaction.editReply(buildPanel({
                title: 'Mantenimiento activado',
                body: `${EMOJIS.tick || '✅'} El modo mantenimiento quedo **ACTIVO**.\n` +
                    `${EMOJIS.warn || '⚠️'} Motivo: ${next.reason || '-'}`,
                ephemeral: true,
            }));
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });

        const next = await setMaintenanceStateCached({
            enabled: false,
            reason: '',
            updatedBy: interaction.user?.id,
            updatedByTag: interaction.user?.tag,
        });

        const guildCount = await collectMaintenanceGuildCount(Moxi).catch(() => 0);

        return interaction.editReply(buildPanel({
            title: 'Mantenimiento desactivado',
            body: `${EMOJIS.tick || '✅'} El modo mantenimiento quedo **INACTIVO**.\n` +
                `${EMOJIS.earth || '🌍'} Servidores aplicados: **${guildCount}**`,
            ephemeral: true,
        }));
    },
};
