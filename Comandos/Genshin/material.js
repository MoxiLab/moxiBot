const { ContainerBuilder, MessageFlags, ThumbnailBuilder } = require('discord.js');
const { genshinCategory } = require('../../Util/commandCategories');
const { fetchCategoryByQuery } = require('../../Util/genshinDbProxy');

function buildMaterialImageUrl(filenameIcon) {
    // Nota: La API de materials no proporciona URLs de imagen funcionales
    // Solo devuelve filename_icon pero sin endpoint CDN accesible
    return null;
}

module.exports = {
    name: 'material',
    alias: ['mat', 'gim', 'gimat', 'materiales', 'materialinfo', 'materialesinfo', 'matinfo', 'matinf', 'mat', 'material'],
    Category: genshinCategory,
    usage: 'material <nombre>',
    description: 'Muestra info corta de un material.',
    cooldown: 2,

    async execute(Moxi, message, args) {
        const query = String(args?.join(' ') || '').trim();
        if (!query) {
            const container = new ContainerBuilder()
                .setAccentColor(0xE67E22)
                .addTextDisplayComponents(c => c.setContent('# 🎮 Genshin • gimat'))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent('Uso: `gimat <material>`\nEjemplo: `gimat Mora`'));
            return message.reply({
                content: '',
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { repliedUser: false },
            });
        }

        const data = await fetchCategoryByQuery('materials', query);
        if (!data?.name || String(data.name || '').trim() === '') {
            const container = new ContainerBuilder()
                .setAccentColor(0xE67E22)
                .addTextDisplayComponents(c => c.setContent('# 🎮 Genshin • gimat'))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(`No encontré material para **${query}**.\nIntenta con otro nombre o nombre en inglés.`));
            return message.reply({
                content: '',
                components: [container],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { repliedUser: false },
            });
        }

        const rarity = Number(data?.rarity || 0) > 0 ? `${Number(data.rarity)}★` : 'N/D';
        const desc = String(data?.description || '').trim() || 'N/D';
        const typeText = String(data?.typeText || '').trim() || 'N/D';
        const category = String(data?.category || '').trim() || 'N/D';
        const sources = Array.isArray(data?.sources) ? data.sources.slice(0, 5) : [];
        const imageUrl = buildMaterialImageUrl(data.images?.filename_icon);

        const container = new ContainerBuilder()
            .setAccentColor(0xC39A5B)
            .addTextDisplayComponents(c => c.setContent(`# 🧪 ${data.name}`))
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(c => c.setContent([
                `Rareza: **${rarity}**`,
                `Tipo: **${typeText}**`,
                `Categoría: **${category}**`,
                `Descripción: ${desc}`,
                sources.length ? `Fuentes: ${sources.join(' • ')}` : null,
            ].filter(Boolean).join('\n')));

        if (imageUrl) {
            container
                .addSeparatorComponents(s => s.setDivider(true))
                .addSectionComponents(section => section.addTextDisplayComponents(td => td.setContent('## 🖼️ Icono')).setThumbnailAccessory(new ThumbnailBuilder().setURL(imageUrl)));
        }

        return message.reply({
            content: '',
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { repliedUser: false },
        });
    },
};
