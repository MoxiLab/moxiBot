const moxi = require('../../i18n');

function economyCategory(lang) {
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang || 'es-ES');
}

module.exports = {
    name: 'craft',
    alias: ['forge', 'craftear'],
    Category: economyCategory,
    usage: 'craft [-p página] <item> [anvil]',
    description: 'Crea items o revisa la lista.',
    cooldown: 0,
    examples: ['craft', 'craft -p 2', 'craft barra de oro', 'craft nyan -o', 'craft --steel --acero -s -a'],
    permissions: {
        Bot: ['Ver canal', 'Enviar mensajes', 'Insertar enlaces'],
        User: [],
    },
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
    },

    async execute(Moxi, message, args = []) {
        const guildId = message.guildId || message.guild?.id;
        const prefix = await moxi.guildPrefix(guildId, process.env.PREFIX || '.');

        const { Bot } = require('../../Config');
        const { EMOJIS } = require('../../Util/emojis');
        const { ensureMongoConnection } = require('../../Util/mongoConnect');
        const { resolveRecipe, craftRecipe, getRecipeDisplayName } = require('../../Util/craftSystem');
        const { buildCraftMessage } = require('../../Util/craftPanel');
        const { getItemById } = require('../../Util/inventoryCatalog');

        const sub = String(args?.[0] || '').toLowerCase();

        // Soporte de paginación: craft -p 2 / craft --page 2 / craft list 2
        let page = 0;
        const cleaned = Array.isArray(args) ? args.slice() : [];
        for (let i = 0; i < cleaned.length; i += 1) {
            const a = String(cleaned[i] || '').toLowerCase();
            if (a === '-p' || a === '--page') {
                const next = cleaned[i + 1];
                const n = Number.parseInt(String(next), 10);
                if (Number.isFinite(n) && n > 0) page = n - 1;
                cleaned.splice(i, 2);
                i -= 1;
                continue;
            }
            const m = a.match(/^-p(\d+)$/);
            if (m) {
                const n = Number.parseInt(m[1], 10);
                if (Number.isFinite(n) && n > 0) page = n - 1;
                cleaned.splice(i, 1);
                i -= 1;
            }
        }

        const query = cleaned.join(' ').trim();

        if (!process.env.MONGODB) {
            return message.reply({
                content: `${EMOJIS.cross} No puedo usar craft: MongoDB no está configurado.`,
                allowedMentions: { repliedUser: false },
            });
        }

        if (!query || sub === 'list' || sub === 'recetas' || sub === 'recipes') {
            // craft list 2
            if ((sub === 'list' || sub === 'recetas' || sub === 'recipes') && cleaned[1]) {
                const n = Number.parseInt(String(cleaned[1]), 10);
                if (Number.isFinite(n) && n > 0) page = n - 1;
            }
            return message.reply({ ...buildCraftMessage({ userId: message.author.id, page, pageSize: 4 }), allowedMentions: { repliedUser: false } });
        }

        await ensureMongoConnection();
        const { UserEconomy } = require('../../Models/EconomySchema');
        const eco = await UserEconomy.findOne({ userId: message.author.id });

        const recipe = resolveRecipe(query);
        if (!recipe) {
            return message.reply({
                content: `${EMOJIS.cross} No encontré esa receta. Usa \`${prefix}craft list\` para ver las disponibles.`,
                allowedMentions: { repliedUser: false },
            });
        }

        const result = await craftRecipe({ userId: message.author.id, recipe });
        if (!result.ok) {
            if (result.reason === 'missing') {
                const missing = Array.isArray(result.missing) ? result.missing : [];
                const lines = missing.map(m => {
                    const it = getItemById(m.itemId);
                    const name = it?.name || m.itemId;
                    return `• **${name}**: tienes **${m.have}**, necesitas **${m.need}**`;
                });

                const { EmbedBuilder } = require('discord.js');
                const embed = new EmbedBuilder()
                    .setColor(Bot.AccentColor)
                    .setTitle(`${EMOJIS.cross} Materiales insuficientes`)
                    .setDescription(`No puedes craftear **${getRecipeDisplayName(recipe)}**.\n\n${lines.join('\n')}`);

                return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
            }

            if (result.reason === 'cost') {
                const { EmbedBuilder } = require('discord.js');
                const embed = new EmbedBuilder()
                    .setColor(Bot.AccentColor)
                    .setTitle(`${EMOJIS.cross} Monedas insuficientes`)
                    .setDescription(`Necesitas **${result.cost}** 🪙 y tienes **${result.balance}** 🪙.`);

                return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
            }

            return message.reply({
                content: `${EMOJIS.cross} No se pudo craftear: ${result.message || 'error'}.`,
                allowedMentions: { repliedUser: false },
            });
        }

        const outName = getRecipeDisplayName(recipe);
        const { EmbedBuilder } = require('discord.js');
        const embed = new EmbedBuilder()
            .setColor(Bot.AccentColor)
            .setTitle(`${EMOJIS.check || '✅'} ¡Crafteado/a!`)
            .setDescription(`Has crafteado **${outName}** (x${result.crafted.amount}).`);

        return message.reply({ embeds: [embed], allowedMentions: { repliedUser: false } });
    },
};
