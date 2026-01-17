const { MessageFlags } = require('discord.js');
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

function economyCategory(lang) {
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang || 'es-ES');
}

module.exports = {
    name: 'pet',
    alias: [],
    Category: economyCategory,
    usage: 'pet',
    description: 'Gestiona tu mascota y la incubación de huevos.',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message) {
        const guildId = message.guildId || message.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const eco = await getOrCreateEconomy(message.author.id);
        const now = Date.now();

        const inc = eco.petIncubation;
        if (inc?.eggItemId && inc?.hatchAt) {
            const egg = getItemById(inc.eggItemId, { lang });
            const eggName = egg?.name || inc.eggItemId;

            if (!isIncubationReady(inc, now)) {
                const remMs = incubationRemainingMs(inc, now);
                const rem = remMs === null ? null : formatDuration(remMs);
                return message.reply({
                    ...asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: '🥚',
                            title: 'Mascotas',
                            text: `Tu **${eggName}** está incubando.\nTiempo restante: **${rem || '...'}**\n\nTip: cuando esté listo, vuelve a usar **.pet** para eclosionarlo.`,
                        })
                    ),
                    allowedMentions: { repliedUser: false },
                });
            }

            // Eclosionar
            const pet = buildPetFromEgg({ eggItemId: inc.eggItemId, lang });
            eco.pets = Array.isArray(eco.pets) ? eco.pets : [];
            eco.pets.push(pet);
            eco.petIncubation = undefined;
            await eco.save();

            return message.reply({
                content: '',
                components: [
                    buildNoticeContainer({
                        emoji: '🐾',
                        title: '¡Huevo eclosionado!',
                        text: `Nació tu mascota: **${pet.name}**\nRareza: **${pet.attributes?.rarity || 'common'}**`,
                    }),
                ],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { repliedUser: false },
            });
        }

        const pets = Array.isArray(eco.pets) ? eco.pets : [];
        if (pets.length) {
            const last = pets[pets.length - 1];
            return message.reply({
                ...asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: '🐾',
                        title: 'Tu mascota',
                        text: `Nombre: **${last?.name || 'Sin nombre'}**\nNivel: **${last?.level || 1}**`,
                    })
                ),
                allowedMentions: { repliedUser: false },
            });
        }

        return message.reply({
            ...asV2MessageOptions(
                buildNoticeContainer({
                    emoji: EMOJIS.info,
                    title: 'Mascotas',
                    text: 'Aún no tienes mascotas.\n\n1) Compra un **huevo** en `.shop`\n2) Compra una **incubadora**\n3) Usa: `.use incubadora` para incubar (consume 1 huevo)\n4) Luego usa `.pet` para ver el progreso / eclosionar.',
                })
            ),
            allowedMentions: { repliedUser: false },
        });
    },
};
