// Comando: Listar reglas de auto-moderación
const fetch = require('node-fetch');
const { ContainerBuilder, MessageFlags, ButtonBuilder, ButtonStyle, ActionRowBuilder, ComponentType } = require('discord.js');
const debugHelper = require('../../Util/debugHelper');

module.exports = {
    name: 'listareglasauto',
    alias: ['listautoregla'],
    description: 'Lista todas las reglas de auto-moderación del servidor.',
    usage: 'listareglasauto',
    category: 'Moderation',
    cooldown: 5,
    permissions: {
        user: ['Administrator'],
        bot: ['Administrator'],
        role: []
    },
    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
        options: []
    },
    execute: async (Moxi, message) => {
        const guildId = message.guild.id;
        debugHelper.log('autorulelist', 'execute start', { guildId });
        const url = `https://discord.com/api/v10/guilds/${guildId}/auto-moderation/rules`;
        try {
            const res = await fetch(url, {
                headers: { 'Authorization': `Bot ${Moxi.token}` }
            });
            if (!res.ok) {
                const container = new ContainerBuilder()
                    .addTextDisplayComponents(c => c.setContent(`# ❌ Error al obtener las reglas.`));
                return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
            }
            const reglas = await res.json();
            if (!reglas.length) {
                debugHelper.log('autorulelist', 'no rules', { guildId });
                const container = new ContainerBuilder()
                    .addTextDisplayComponents(c => c.setContent(`# ℹ️ No hay reglas de auto-moderación.`));
                return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
            }
            debugHelper.log('autorulelist', 'rules fetched', { guildId, total: reglas.length });
            // Paginación visual
            const pageSize = 5;
            let page = 0;
            const totalPages = Math.ceil(reglas.length / pageSize);
            const getPage = (p) => {
                const start = p * pageSize;
                const end = start + pageSize;
                return reglas.slice(start, end).map(r => `• ${r.name} (ID: ${r.id})`).join('\n');
            };
            const makeContainer = (p) => new ContainerBuilder()
                .addTextDisplayComponents(c => c.setContent(`# 📋 Reglas de auto-moderación (${p + 1}/${totalPages}):\n${getPage(p)}`));
            const prevBtn = new ButtonBuilder().setCustomId('prev').setLabel('⏪ Anterior').setStyle(ButtonStyle.Secondary).setDisabled(page === 0);
            const nextBtn = new ButtonBuilder().setCustomId('next').setLabel('Siguiente ⏩').setStyle(ButtonStyle.Secondary).setDisabled(page === totalPages - 1);
            const row = new ActionRowBuilder().addComponents(prevBtn, nextBtn);
            let msg = await message.reply({ components: [makeContainer(page), row], flags: MessageFlags.IsComponentsV2, reply: true, allowedMentions: { repliedUser: false } });
            debugHelper.log('autorulelist', 'panel sent', { guildId, totalPages, page });
            if (totalPages <= 1) return;
            const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });
            collector.on('collect', async i => {
                if (i.user.id !== message.author.id) {
                    debugHelper.warn('autorulelist', 'collector ignored', { guildId, userId: i.user.id });
                    return i.reply({ content: 'Solo quien ejecutó el comando puede usar los botones.', ephemeral: true });
                }
                if (i.customId === 'prev' && page > 0) page--;
                if (i.customId === 'next' && page < totalPages - 1) page++;
                const prevBtn = new ButtonBuilder().setCustomId('prev').setLabel('⏪ Anterior').setStyle(ButtonStyle.Secondary).setDisabled(page === 0);
                const nextBtn = new ButtonBuilder().setCustomId('next').setLabel('Siguiente ⏩').setStyle(ButtonStyle.Secondary).setDisabled(page === totalPages - 1);
                const row = new ActionRowBuilder().addComponents(prevBtn, nextBtn);
                await i.update({ components: [makeContainer(page), row], flags: MessageFlags.IsComponentsV2 });
                debugHelper.log('autorulelist', 'collector nav', { guildId, action: i.customId, page });
            });
            collector.on('end', async () => {
                const prevBtn = new ButtonBuilder().setCustomId('prev').setLabel('⏪ Anterior').setStyle(ButtonStyle.Secondary).setDisabled(true);
                const nextBtn = new ButtonBuilder().setCustomId('next').setLabel('Siguiente ⏩').setStyle(ButtonStyle.Secondary).setDisabled(true);
                const row = new ActionRowBuilder().addComponents(prevBtn, nextBtn);
                await msg.edit({ components: [makeContainer(page), row], flags: MessageFlags.IsComponentsV2 });
                debugHelper.log('autorulelist', 'collector ended', { guildId, page });
            });
        } catch (e) {
            debugHelper.error('autorulelist', 'exception', { guildId, error: e.message });
            const container = new ContainerBuilder()
                .addTextDisplayComponents(c => c.setContent(`# ❌ Error: ${e.message}`));
            return message.reply({ components: [container], flags: MessageFlags.IsComponentsV2 });
        }
    }
};
