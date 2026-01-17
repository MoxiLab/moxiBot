const {
    SlashCommandBuilder,
    MessageFlags,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js');
const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { buildAfkContainer } = require('../../Util/afkRender');
const { getRandomNekosGif } = require('../../Util/nekosApi');
const { resolveItemFromInput, consumeInventoryItem } = require('../../Util/useItem');
const { getOrCreateEconomy, formatDuration } = require('../../Util/economyCore');
const { getItemById } = require('../../Util/inventoryCatalog');
const { Bot } = require('../../Config');
const {
    isEggItemId,
    pickFirstOwnedEgg,
    hasInventoryItem,
    consumeFromInventory,
    startIncubation,
    isIncubationReady,
    formatRemaining,
    getActivePet,
    ensurePetAttributes,
    checkAndMarkPetAway,
    returnPetFromAway,
} = require('../../Util/petSystem');

const PET_RETURN_ITEM_ID = 'mascotas/ocarina-del-vinculo';

function economyCategory(lang) {
    lang = lang || 'es-ES';
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
}

async function resolveUseGif() {
    const override = process.env.USE_ITEM_GIF_URL;
    if (override) return override;

    const category = (process.env.NEKOS_USE_CATEGORIES || 'feed')
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)[0] || 'feed';

    const url = await getRandomNekosGif(category);
    return url || process.env.AFK_FALLBACK_GIF_URL || null;
}

module.exports = {
    cooldown: 0,
    Category: economyCategory,
    data: new SlashCommandBuilder()
        .setName('use')
        .setDescription('Usa (consume) un ítem de tu mochila')
        .addIntegerOption((opt) =>
            opt
                .setName('id')
                .setDescription('ID del ítem (se ve en /bag y /shop list)')
                .setRequired(false)
                .setMinValue(1)
        )
        .addStringOption((opt) =>
            opt
                .setName('item')
                .setDescription('Nombre o itemId del ítem (alternativa a id)')
                .setRequired(false)
        )
        .addIntegerOption((opt) =>
            opt
                .setName('cantidad')
                .setDescription('Cantidad a usar (por defecto: 1)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(100)
        ),

    async run(Moxi, interaction) {
        const guildId = interaction.guildId || interaction.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const shopId = interaction.options.getInteger('id');
        const rawItem = interaction.options.getString('item');
        const amount = interaction.options.getInteger('cantidad') || 1;

        if (!shopId && !rawItem) {
            return interaction.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Uso incorrecto',
                        text: 'Debes escribir el nombre o id del item que quieres usar.',
                    })
                )
            );
        }

        const resolved = resolveItemFromInput({ shopId: shopId || null, query: rawItem || null });
        if (!resolved) {
            return interaction.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Ítem no encontrado',
                        text: 'No encontré ese ítem. Usa /bag para ver tu inventario o /shop list para ver IDs.',
                    })
                )
            );
        }

        // --- Pet return item (slash) ---
        if (resolved.itemId === PET_RETURN_ITEM_ID) {
            const eco = await getOrCreateEconomy(interaction.user.id);
            const now = Date.now();

            const pet = getActivePet(eco);
            if (!pet) {
                return interaction.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.info,
                            title: 'Mascotas',
                            text: 'Aún no tienes mascotas. Incuba un huevo para conseguir una.',
                        })
                    )
                );
            }

            ensurePetAttributes(pet, now);
            const awayRes = checkAndMarkPetAway(pet, now);
            if (awayRes.changed) await eco.save().catch(() => null);

            if (!pet?.attributes?.away) {
                return interaction.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: '🐾',
                            title: 'Ocarina del Vínculo',
                            text: 'Tu mascota ya está contigo. No necesitas usarla ahora.',
                        })
                    )
                );
            }

            // Consumir 1 ocarina y devolver la mascota
            try {
                consumeFromInventory(eco, PET_RETURN_ITEM_ID, 1);
            } catch (err) {
                if (err?.code === 'NOT_OWNED') {
                    return interaction.reply(
                        asV2MessageOptions(
                            buildNoticeContainer({
                                emoji: EMOJIS.cross,
                                title: 'Ocarina del Vínculo',
                                text: 'No tienes este ítem en tu mochila.',
                            })
                        )
                    );
                }
                throw err;
            }

            returnPetFromAway(pet, now);
            await eco.save().catch(() => null);

            const gifUrl = process.env.PET_RETURN_GIF_URL || await resolveUseGif();
                const container = new ContainerBuilder()
                    .setAccentColor(Bot?.AccentColor || 0xB57EDC)
                    .addTextDisplayComponents(t => t.setContent('# 🎶 Ocarina del Vínculo'))
                    .addSeparatorComponents(s => s.setDivider(true));

                const safeGif = gifUrl && /^https?:\/\//.test(String(gifUrl)) ? String(gifUrl) : null;
                if (safeGif) {
                    container.addMediaGalleryComponents(
                        new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(safeGif))
                    );
                    container.addSeparatorComponents(s => s.setDivider(true));
                }

                container
                    .addTextDisplayComponents(t => t.setContent(`🐾 **${pet.name || 'Tu mascota'}** ha oído el sonido… ¡y ha regresado!`))
                    .addActionRowComponents(row => row.addComponents(
                        new ButtonBuilder()
                            .setCustomId(`pet:open:${interaction.user.id}`)
                            .setLabel('Ver mascota')
                            .setStyle(ButtonStyle.Primary)
                            .setEmoji('🐣')
                    ));

                return interaction.reply({
                    content: '',
                    components: [container],
                    flags: MessageFlags.IsComponentsV2,
                    allowedMentions: { repliedUser: false },
                });
        }

        // --- Pet incubation hook (slash) ---
        if (resolved.itemId === 'herramientas/incubadora') {
            try {
                const eco = await getOrCreateEconomy(interaction.user.id);
                const langNow = lang;

                if (!hasInventoryItem(eco, resolved.itemId, 1)) {
                    return interaction.reply(
                        asV2MessageOptions(
                            buildNoticeContainer({
                                emoji: EMOJIS.cross,
                                title: 'Incubadora',
                                text: 'No tienes una incubadora en tu mochila.',
                            })
                        )
                    );
                }

                const now = Date.now();
                const inc = eco.petIncubation;
                if (inc?.eggItemId && inc?.hatchAt) {
                    if (isIncubationReady(inc, now)) {
                        const egg = getItemById(inc.eggItemId, { lang: langNow });
                        const eggName = egg?.name || inc.eggItemId;
                        return interaction.reply(
                            asV2MessageOptions(
                                buildNoticeContainer({
                                    emoji: '🥚',
                                    title: 'Incubadora',
                                    text: `Tu **${eggName}** ya está listo para eclosionar. Usa **/pet** para abrirlo.`,
                                })
                            )
                        );
                    }

                    const rem = formatRemaining(inc, now) || formatDuration(Math.max(0, new Date(inc.hatchAt).getTime() - now));
                    return interaction.reply(
                        asV2MessageOptions(
                            buildNoticeContainer({
                                emoji: '⏳',
                                title: 'Incubadora',
                                text: `Ya tienes un huevo incubando. Tiempo restante: **${rem}**`,
                            })
                        )
                    );
                }

                // Si el usuario pasó un texto en "item" y parece ser un huevo, lo intentamos usar.
                let eggItemId = null;
                if (rawItem) {
                    const eggResolved = resolveItemFromInput({ shopId: null, query: rawItem });
                    if (eggResolved && isEggItemId(eggResolved.itemId) && hasInventoryItem(eco, eggResolved.itemId, 1)) {
                        eggItemId = eggResolved.itemId;
                    }
                }
                if (!eggItemId) eggItemId = pickFirstOwnedEgg(eco);

                if (!eggItemId) {
                    return interaction.reply(
                        asV2MessageOptions(
                            buildNoticeContainer({
                                emoji: '🥚',
                                title: 'Incubadora',
                                text: 'No tienes ningún huevo para incubar. Compra uno en la tienda y vuelve a intentarlo.',
                            })
                        )
                    );
                }

                consumeFromInventory(eco, eggItemId, 1);
                const started = startIncubation({ eco, eggItemId, now, lang: langNow });
                await eco.save();

                const eggName = started.egg?.name || eggItemId;
                const when = formatDuration(started.hatchMs);
                return interaction.reply({
                    ...asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: '🧫',
                            title: 'Incubadora',
                            text: `Has puesto **${eggName}** a incubar.\nTiempo estimado: **${when}**\nUsa **/pet** para ver el progreso.`,
                        })
                    ),
                    flags: MessageFlags.IsComponentsV2,
                });
            } catch {
                return interaction.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: 'Incubadora',
                            text: 'No pude iniciar la incubación ahora mismo. Inténtalo de nuevo.',
                        })
                    )
                );
            }
        }

        try {
            const { consumed, remaining } = await consumeInventoryItem({
                userId: interaction.user.id,
                itemId: resolved.itemId,
                amount,
            });

            const gifUrl = await resolveUseGif();
            const lines = [
                `**${interaction.user.username}** usó **${consumed}x ${resolved.name}**`,
                `Te quedan: **${remaining}**`,
                resolved.shopId ? `ID: **${resolved.shopId}**` : '',
            ].filter(Boolean);

            const container = buildAfkContainer({
                title: '✅ Ítem usado',
                lines,
                gifUrl,
                gifLabel: resolved.description ? resolved.description.slice(0, 80) : '',
            });

            return interaction.reply({
                content: '',
                components: [container],
                flags: 0,
            });
        } catch (err) {
            if (err && err.code === 'NOT_OWNED') {
                return interaction.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: 'No disponible',
                            text: `No tienes **${resolved.name}** en tu mochila.`,
                        })
                    )
                );
            }
            if (err && err.code === 'NOT_ENOUGH') {
                return interaction.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: 'Cantidad inválida',
                            text: `No tienes suficiente cantidad. Tienes ${err.have} y pediste ${err.wanted}.`,
                        })
                    )
                );
            }

            return interaction.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: 'Error',
                        text: 'No pude usar ese ítem ahora mismo. Inténtalo de nuevo.',
                    })
                )
            );
        }
    },
};
