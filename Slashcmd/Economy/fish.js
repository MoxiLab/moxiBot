const { ChatInputCommandBuilder: SlashCommandBuilder, MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { getItemById } = require('../../Util/inventoryCatalog');
const { getOrCreateEconomy } = require('../../Util/economyCore');
const { getZonesForKind } = require('../../Util/zonesView');
const { hasInventoryItem } = require('../../Util/fishView');
const { buildFishPlayMessageOptions } = require('../../Util/fishPlay');
const { slashMention } = require('../../Util/slashCommandMentions');
const { getSlashCommandDescription } = require('../../Util/slashHelpI18n');

const { description, localizations } = getSlashCommandDescription('fish');

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
        .setDescription(description)
        .setDescriptionLocalizations(localizations)
        .addStringOptions((opt) =>
            opt
                .setName('zona')
                .setDescription('Fishing zone (id or alias). If omitted, picks an available one.')
                .setRequired(false)
        ),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const fallbackLang = interaction.guildLocale || interaction.locale || process.env.DEFAULT_LANG || 'es-ES';
        const lang = await moxi.guildLang(guildId, fallbackLang);
        const t = (k, vars) => moxi.translate(`economy/fish:${k}`, lang, vars);

        const applicationId = process.env.CLIENT_ID || interaction.client?.application?.id;
        let zonesMention = '/zones';
        if (applicationId) {
            try {
                zonesMention = await slashMention({ name: 'zones', applicationId, guildId });
            } catch {
                // keep fallback
            }
        }

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
                            title: t('ERROR_TITLE'),
                            text: [t('INVALID_ZONE'), t('SLASH_VIEW_ZONES', { zones: zonesMention })].filter(Boolean).join('\n'),
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
                        title: t('REQUIREMENT_TITLE'),
                        text: [t('SLASH_NEED_ITEM', { item: requiredName }), t('SLASH_VIEW_ZONES', { zones: zonesMention })].filter(Boolean).join('\n'),
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
                        text: t('SLASH_NEED_ITEM_HERE', { item: requiredName }),
                    })
                ),
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            });
        }

        const payload = buildFishPlayMessageOptions({ userId, zoneId: zone.id, lang });
        return interaction.reply({
            ...payload,
            flags: payload.flags & ~MessageFlags.Ephemeral,
        });
    },
};
