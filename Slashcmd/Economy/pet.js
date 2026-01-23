const { ChatInputCommandBuilder: SlashCommandBuilder, MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { getOrCreateEconomy, formatDuration } = require('../../Util/economyCore');
const { getItemById } = require('../../Util/inventoryCatalog');
const { EMOJIS } = require('../../Util/emojis');
const { buildPetPanelMessageOptions } = require('../../Util/petPanel');
const {
    isIncubationReady,
    incubationRemainingMs,
    buildPetFromEgg,
    getActivePet,
    ensurePetAttributes,
    checkAndMarkPetAway,
} = require('../../Util/petSystem');
const { getSlashCommandDescription } = require('../../Util/slashHelpI18n');

const { description, localizations } = getSlashCommandDescription('pet');

module.exports = {
    cooldown: 0,
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
    },
    data: new SlashCommandBuilder()
        .setName('pet')
        .setDescription(description)
        .setDescriptionLocalizations(localizations),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const eco = await getOrCreateEconomy(interaction.user.id);
        const now = Date.now();

        const inc = eco.petIncubation;
        if (inc?.eggItemId && inc?.hatchAt) {
            const egg = getItemById(inc.eggItemId, { lang });
            const eggName = egg?.name || inc.eggItemId;

            if (!isIncubationReady(inc, now)) {
                const remMs = incubationRemainingMs(inc, now);
                const rem = remMs === null ? null : formatDuration(remMs);
                return interaction.reply({
                    ...asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: '🥚',
                            title: 'Mascotas',
                            text: `Tu **${eggName}** está incubando.\nTiempo restante: **${rem || '...'}**`,
                        })
                    ),
                    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
                });
            }

            const pet = buildPetFromEgg({ eggItemId: inc.eggItemId, lang });
            eco.pets = Array.isArray(eco.pets) ? eco.pets : [];
            eco.pets.push(pet);
            eco.petIncubation = undefined;
            await eco.save();

            ensurePetAttributes(pet, now);
            const awayRes = checkAndMarkPetAway(pet, now);
            if (awayRes.changed) await eco.save().catch(() => null);

            const panel = buildPetPanelMessageOptions({
                lang,
                userId: interaction.user.id,
                ownerName: interaction.user.username,
                pet,
            });
            return interaction.reply({
                ...panel,
                flags: MessageFlags.Ephemeral | (panel.flags ?? 0),
            });
        }

        const pet = getActivePet(eco);
        if (pet) {
            ensurePetAttributes(pet, now);
            const awayRes = checkAndMarkPetAway(pet, now);
            if (awayRes.changed) await eco.save().catch(() => null);

            const panel = buildPetPanelMessageOptions({
                lang,
                userId: interaction.user.id,
                ownerName: interaction.user.username,
                pet,
            });
            return interaction.reply({
                ...panel,
                flags: MessageFlags.Ephemeral | (panel.flags ?? 0),
            });
        }

        return interaction.reply({
            ...asV2MessageOptions(
                buildNoticeContainer({
                    emoji: EMOJIS.info,
                    title: 'Mascotas',
                    text: 'Aún no tienes mascotas.\n\n1) Compra un huevo en la tienda\n2) Compra una incubadora\n3) Usa `.use incubadora`\n4) Vuelve aquí cuando esté listo.',
                })
            ),
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
    },
};
