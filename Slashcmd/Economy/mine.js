const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { getItemById } = require('../../Util/inventoryCatalog');
const { getOrCreateEconomy } = require('../../Util/economyCore');
const { getZonesForKind } = require('../../Util/zonesView');
const { hasInventoryItem } = require('../../Util/fishView');
const { buildMinePlayMessageOptions } = require('../../Util/minePlay');

function resolveMineZone(input) {
    const raw = String(input || '').trim().toLowerCase();
    if (!raw) return null;

    const zones = getZonesForKind('mine');
    return (
        zones.find(z => String(z.id || '').toLowerCase() === raw) ||
        zones.find(z => Array.isArray(z.aliases) && z.aliases.some(a => String(a).toLowerCase() === raw)) ||
        null
    );
}

function pickBestUsableMineZone(eco) {
    const zones = getZonesForKind('mine');
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
        .setName('mine')
        .setDescription('Minería (minijuego con botones)')
        .addStringOption((opt) =>
            opt
                .setName('zona')
                .setDescription('Zona de minería (id o alias). Si se omite, elige una disponible.')
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
            zone = resolveMineZone(zoneInput);
            if (!zone) {
                return interaction.reply({
                    ...asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: '⚠️',
                            title: 'Mine',
                            text: 'Zona inválida. Usa `/zones tipo: Minería` para ver las zonas disponibles.',
                        })
                    ),
                    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
                });
            }
        } else {
            zone = pickBestUsableMineZone(eco);
        }

        if (!zone) {
            const required = getItemById('herramientas/pico-prisma', { lang });
            const requiredFallback = 'herramientas/pico-prisma';
            const requiredName = required?.name || requiredFallback.split('/').pop() || requiredFallback;
            return interaction.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: '⛔',
                        title: 'Mine • Requisito',
                        text: `Para empezar a minar necesitas: **${requiredName}**\nZonas: \`/zones tipo: Minería\``,
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
                        title: `Mine • ${zone.name}`,
                        text: `Para minar aquí necesitas: **${requiredName}**`,
                    })
                ),
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            });
        }

        const payload = buildMinePlayMessageOptions({ userId, zoneId: zone.id });
        return interaction.reply({
            ...payload,
            flags: payload.flags & ~MessageFlags.Ephemeral,
        });
    },
};
