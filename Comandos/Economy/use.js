const {
    MessageFlags,
    EmbedBuilder,
    ActionRowBuilder,
    PrimaryButtonBuilder,
    ContainerBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
} = require('discord.js');
const moxi = require('../../i18n');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS, toEmojiObject } = require('../../Util/emojis');
const { buildAfkContainer } = require('../../Util/afkRender');
const { getRandomNekosGif } = require('../../Util/nekosApi');
const { resolveItemFromInput, consumeInventoryItem } = require('../../Util/useItem');
const { getOrCreateEconomy, formatDuration } = require('../../Util/economyCore');
const { getItemById } = require('../../Util/inventoryCatalog');
const { Bot } = require('../../Config');
const { economyCategory } = require('../../Util/commandCategories');
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

function parsePositiveInt(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    const x = Math.trunc(n);
    return x > 0 ? x : null;
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
    name: 'use',
    alias: ['usar', 'consumir'],
    Category: economyCategory,
    usage: 'use <id|nombre> [cantidad]',
    description: 'commands:CMD_USE_DESC',
    cooldown: 0,
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message, args) {
        const guildId = message.guildId || message.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const prefix = await moxi.guildPrefix(guildId, process.env.PREFIX || '.');
        const t = (k, vars = {}) => moxi.translate(`economy/use:${k}`, lang, { prefix, ...vars });

        const raw = args?.length ? args.join(' ').trim() : '';
        if (!raw) {
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('USAGE_BAD_TITLE'),
                        text: t('USAGE_BAD_TEXT'),
                    })
                )
            );
        }

        const first = args?.[0];
        const second = args?.[1];

        const shopId = parsePositiveInt(first);
        const amount = parsePositiveInt(second) || 1;

        const query = shopId ? null : raw;

        const resolved = resolveItemFromInput({ shopId: shopId || null, query });
        if (!resolved) {
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        title: t('ITEM_NOT_FOUND_TITLE'),
                        text: t('ITEM_NOT_FOUND_TEXT'),
                    })
                )
            );
        }

        // --- Pet return item ---
        if (resolved.itemId === PET_RETURN_ITEM_ID) {
            const eco = await getOrCreateEconomy(message.author.id);
            const now = Date.now();

            const pet = getActivePet(eco);
            if (!pet) {
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.info,
                            title: t('PETS_TITLE'),
                            text: t('NO_PETS_TEXT_SHORT'),
                        })
                    )
                );
            }

            ensurePetAttributes(pet, now);
            const awayRes = checkAndMarkPetAway(pet, now);
            if (awayRes.changed) await eco.save().catch(() => null);

            if (!pet?.attributes?.away) {
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: '🐾',
                            title: t('OCARINA_TITLE'),
                            text: t('OCARINA_ALREADY_WITH_YOU'),
                        })
                    )
                );
            }

            try {
                consumeFromInventory(eco, PET_RETURN_ITEM_ID, 1);
            } catch (err) {
                if (err?.code === 'NOT_OWNED') {
                    return message.reply(
                        asV2MessageOptions(
                            buildNoticeContainer({
                                emoji: EMOJIS.cross,
                                title: t('OCARINA_TITLE'),
                                text: t('OCARINA_NOT_OWNED'),
                            })
                        )
                    );
                }
                throw err;
            }

            returnPetFromAway(pet, now);
            eco.markModified('pets');
            await eco.save().catch(() => null);

            const gifUrl = process.env.PET_RETURN_GIF_URL || await resolveUseGif();
            const container = new ContainerBuilder()
                .setAccentColor(Bot?.AccentColor || 0xB57EDC)
                .addTextDisplayComponents(td => td.setContent(t('OCARINA_HEADER')))
                .addSeparatorComponents(s => s.setDivider(true));

            const safeGif = gifUrl && /^https?:\/\//.test(String(gifUrl)) ? String(gifUrl) : null;
            if (safeGif) {
                container.addMediaGalleryComponents(
                    new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(safeGif))
                );
                container.addSeparatorComponents(s => s.setDivider(true));
            }

            container
                .addTextDisplayComponents(td => td.setContent(t('PET_RETURN_TEXT', { pet: pet.name || moxi.translate('economy/use:PET_FALLBACK_NAME', lang) })))
                .addActionRowComponents(row => row.addComponents(
                    new PrimaryButtonBuilder()
                        .setCustomId(`pet:open:${message.author.id}`)
                        .setLabel(t('PET_VIEW_BUTTON'))
                        .setEmoji(toEmojiObject('🐣'))
                ));

            return message.reply({
                content: '',
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { repliedUser: false },
            });
        }

        // --- Pet incubation hook ---
        if (resolved.itemId === 'herramientas/incubadora') {
            try {
                const eco = await getOrCreateEconomy(message.author.id);
                const langNow = lang;

                if (!hasInventoryItem(eco, resolved.itemId, 1)) {
                    return message.reply(
                        asV2MessageOptions(
                            buildNoticeContainer({
                                emoji: EMOJIS.cross,
                                title: t('INCUBATOR_TITLE'),
                                text: t('INCUBATOR_NOT_OWNED'),
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
                        return message.reply(
                            asV2MessageOptions(
                                buildNoticeContainer({
                                    emoji: '🥚',
                                    title: 'Incubadora',
                                    text: `Tu **${eggName}** ya está listo para eclosionar. Usa **.pet** para abrirlo.`,
                                })
                            )
                        );
                    }

                    const rem = formatRemaining(inc, now) || formatDuration(Math.max(0, new Date(inc.hatchAt).getTime() - now));
                    return message.reply(
                        asV2MessageOptions(
                            buildNoticeContainer({
                                emoji: '⏳',
                                title: 'Incubadora',
                                text: `Ya tienes un huevo incubando. Tiempo restante: **${rem}**`,
                            })
                        )
                    );
                }

                // Selección de huevo: si el usuario escribe algo extra y NO es un número, lo usamos como query.
                const extra = Array.isArray(args) ? args.slice(1) : [];
                const extraStr = extra.join(' ').trim();
                const extraLooksNumeric = extra.length === 1 && /^\d+$/.test(String(extra[0]));

                let eggItemId = null;
                if (extraStr && !extraLooksNumeric) {
                    const eggResolved = resolveItemFromInput({ shopId: null, query: extraStr });
                    if (eggResolved && isEggItemId(eggResolved.itemId) && hasInventoryItem(eco, eggResolved.itemId, 1)) {
                        eggItemId = eggResolved.itemId;
                    }
                }

                if (!eggItemId) {
                    eggItemId = pickFirstOwnedEgg(eco);
                }

                if (!eggItemId) {
                    return message.reply(
                        asV2MessageOptions(
                            buildNoticeContainer({
                                emoji: '🥚',
                                title: 'Incubadora',
                                text: 'No tienes ningún huevo para incubar. Compra uno en la tienda y vuelve a intentarlo.',
                            })
                        )
                    );
                }

                // Consumir 1 huevo (se mete en la incubadora)
                consumeFromInventory(eco, eggItemId, 1);

                const started = startIncubation({ eco, eggItemId, now, lang: langNow });
                await eco.save();

                const eggName = started.egg?.name || eggItemId;
                const when = formatDuration(started.hatchMs);
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: '🧫',
                            title: 'Incubadora',
                            text: `Has puesto **${eggName}** a incubar.\nTiempo estimado: **${when}**\nUsa **.pet** para ver el progreso.`,
                        })
                    )
                );
            } catch (err) {
                return message.reply(
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
                userId: message.author.id,
                itemId: resolved.itemId,
                amount,
            });

            const gifUrl = await resolveUseGif();
            const lines = [
                `**${message.author.username}** usó **${consumed}x ${resolved.name}**`,
                `Te quedan: **${remaining}**`,
                resolved.shopId ? `ID: **${resolved.shopId}**` : '',
            ].filter(Boolean);

            const container = buildAfkContainer({
                title: '✅ Ítem usado',
                lines,
                gifUrl,
                gifLabel: resolved.description ? resolved.description.slice(0, 80) : '',
            });

            return message.reply({
                content: '',
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { repliedUser: false },
            });
        } catch (err) {
            if (err && err.code === 'NOT_OWNED') {
                return message.reply(
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
                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: 'Cantidad inválida',
                            text: `No tienes suficiente cantidad. Tienes ${err.have} y pediste ${err.wanted}.`,
                        })
                    )
                );
            }

            return message.reply(
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
