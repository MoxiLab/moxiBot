const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { getOrCreateEconomy, formatDuration } = require('../../Util/economyCore');
const { getItemById } = require('../../Util/inventoryCatalog');
const { EMOJIS } = require('../../Util/emojis');
const {
    isIncubationReady,
    incubationRemainingMs,
    buildPetFromEgg,
} = require('../../Util/petSystem');

module.exports = {
    cooldown: 0,
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
    },
    data: new SlashCommandBuilder()
        .setName('pet')
        .setDescription('Gestiona tu mascota y la incubación de huevos'),

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

            return interaction.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: '🐾',
                        title: '¡Huevo eclosionado!',
                        text: `Nació tu mascota: **${pet.name}**\nRareza: **${pet.attributes?.rarity || 'common'}**`,
                    })
                ),
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            });
        }

        const pets = Array.isArray(eco.pets) ? eco.pets : [];
        if (pets.length) {
            const last = pets[pets.length - 1];
            return interaction.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: '🐾',
                        title: 'Tu mascota',
                        text: `Nombre: **${last?.name || 'Sin nombre'}**\nNivel: **${last?.level || 1}**`,
                    })
                ),
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
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
