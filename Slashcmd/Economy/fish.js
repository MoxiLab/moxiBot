const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { getItemById } = require('../../Util/inventoryCatalog');
const { getOrCreateEconomy } = require('../../Util/economyCore');
const { getZonesForKind } = require('../../Util/zonesView');
const { hasInventoryItem } = require('../../Util/fishView');
const { buildFishPlayMessageOptions } = require('../../Util/fishPlay');

function normalizeKey(input) {
    return String(input || '')
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .replace(/\s+/g, '-');
}

function resolveFishZone(input) {
    const key = normalizeKey(input);
    if (!key) return null;

    const zones = getZonesForKind('fish');
    return (
        zones.find(z => String(z?.id || '') === key) ||
        zones.find(z => Array.isArray(z.aliases) && z.aliases.map(normalizeKey).includes(key)) ||
        null
    );
}

function pickBestUsableFishZone(eco) {
    const zones = getZonesForKind('fish');
    const usable = (Array.isArray(zones) ? zones : []).filter(z => hasInventoryItem(eco, z.requiredItemId));
    if (!usable.length) return null;
    return usable[Math.floor(Math.random() * usable.length)] || usable[0];
}

module.exports = {
    cooldown: 0,
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
    },
    data: new SlashCommandBuilder()
        .setName('fish')
        .setDescription('Pesca (minijuego con botones)')
        .addStringOption((opt) =>
            opt
                .setName('zona')
                .setDescription('Zona de pesca (id o alias). Si se omite, elige una disponible.')
                .setRequired(false)
        ),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const zoneInput = interaction.options.getString('zona');
        const userId = interaction.user.id;

        const eco = await getOrCreateEconomy(userId);

        let zone = null;
        if (zoneInput) {
            zone = resolveFishZone(zoneInput);
            if (!zone) {
                return interaction.reply({
                    ...asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: '⚠️',
                            title: 'Fish',
                            text: 'Zona inválida. Usa `/zones tipo: Pesca` para ver las zonas disponibles.',
                        })
                    ),
                    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
                });
            }
        } else {
            zone = pickBestUsableFishZone(eco);
        }

        if (!zone) {
            const required = getItemById('herramientas/cana-de-pesca-moxi', { lang });
            const requiredFallback = 'herramientas/cana-de-pesca-moxi';
            const requiredName = required?.name || requiredFallback.split('/').pop() || requiredFallback;
            return interaction.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: '⛔',
                        title: 'Fish • Requisito',
                        text: `Para empezar a pescar necesitas: **${requiredName}**\nZonas: \`/zones tipo: Pesca\``,
                    })
                ),
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            });
        }

        if (!hasInventoryItem(eco, zone.requiredItemId)) {
            const required = getItemById(zone.requiredItemId, { lang });
            const requiredName = required?.name || String(zone.requiredItemId).split('/').pop() || zone.requiredItemId;
            return interaction.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: '⛔',
                        title: `Fish • ${zone.name}`,
                        text: `Para pescar aquí necesitas: **${requiredName}**`,
                    })
                ),
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            });
        }

        const payload = buildFishPlayMessageOptions({ userId, zoneId: zone.id });
        return interaction.reply({
            ...payload,
            flags: payload.flags & ~MessageFlags.Ephemeral,
        });
    },
};
