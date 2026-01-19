const { MessageFlags, EmbedBuilder } = require('discord.js');
const { Bot } = require('../../../../Config');
const { EMOJIS } = require('../../../../Util/emojis');
const { ensureMongoConnection } = require('../../../../Util/mongoConnect');
const { resolveRecipe, craftRecipe, getRecipeDisplayName, getMissingInputs } = require('../../../../Util/craftSystem');
const { getItemById } = require('../../../../Util/inventoryCatalog');
const moxi = require('../../../../i18n');

function safeInt(n, fallback = 0) {
    const x = Number(n);
    return Number.isFinite(x) ? Math.trunc(x) : fallback;
}

function buildEmbed({ title, text }) {
    return new EmbedBuilder()
        .setColor(Bot.AccentColor)
        .setTitle(title)
        .setDescription(text);
}

module.exports = async function craftSelectMenu(interaction, Moxi, logger) {
    if (!interaction.isStringSelectMenu()) return false;
    const id = String(interaction.customId || '');
    if (!id.startsWith('craft:sel:')) return false;

    // craft:sel:<userId>:<page>
    const parts = id.split(':');
    const userId = parts[2];

    if (interaction.user?.id !== userId) {
        await interaction.reply({ content: 'Solo quien abrió el craft puede usar este menú.', flags: MessageFlags.Ephemeral });
        return true;
    }

    const value = Array.isArray(interaction.values) ? interaction.values[0] : null;
    if (!value || value === 'none') {
        await interaction.reply({ content: `${EMOJIS.cross} Selección inválida.`, flags: MessageFlags.Ephemeral });
        return true;
    }

    if (!process.env.MONGODB) {
        await interaction.reply({ content: `${EMOJIS.cross} MongoDB no está configurado.`, flags: MessageFlags.Ephemeral });
        return true;
    }

    await ensureMongoConnection();
    const { Economy } = require('../../../../Models/EconomySchema');
    const eco = await Economy.findOne({ userId: interaction.user.id });

    const guildId = interaction.guildId || interaction.guild?.id;
    const lang = Moxi?.guildLang ? await Moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES') : await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

    const recipe = resolveRecipe(value, lang);
    if (!recipe) {
        await interaction.reply({ content: `${EMOJIS.cross} No encontré esa receta.`, flags: MessageFlags.Ephemeral });
        return true;
    }

    const result = await craftRecipe({ userId: interaction.user.id, recipe });
    if (!result.ok) {
        if (result.reason === 'missing') {
            const missing = getMissingInputs(eco, recipe);
            const lines = missing.map((m) => {
                const it = getItemById(m.itemId, { lang });
                const name = it?.name || m.itemId;
                return `• **${name}**: tienes **${safeInt(m.have, 0)}**, necesitas **${safeInt(m.need, 0)}**`;
            });

            await interaction.reply({
                embeds: [buildEmbed({
                    title: `${EMOJIS.cross} Materiales insuficientes`,
                    text: `No puedes craftear **${getRecipeDisplayName(recipe, lang)}**.\n\n${lines.join('\n')}`,
                })],
                flags: MessageFlags.Ephemeral,
            });
            return true;
        }

        if (result.reason === 'cost') {
            await interaction.reply({
                embeds: [buildEmbed({
                    title: `${EMOJIS.cross} Monedas insuficientes`,
                    text: `Necesitas **${safeInt(result.cost, 0)}** 🪙 y tienes **${safeInt(result.balance, 0)}** 🪙.`,
                })],
                flags: MessageFlags.Ephemeral,
            });
            return true;
        }

        await interaction.reply({
            content: `${EMOJIS.cross} No se pudo craftear: ${result.message || 'error'}.`,
            flags: MessageFlags.Ephemeral,
        });
        return true;
    }

    await interaction.reply({
        embeds: [buildEmbed({
            title: `${EMOJIS.check} ¡Crafteado/a!`,
            text: `Has crafteado **${getRecipeDisplayName(recipe, lang)}** (x${safeInt(result.crafted.amount, 1)}).`,
        })],
        flags: MessageFlags.Ephemeral,
    });

    return true;
};
