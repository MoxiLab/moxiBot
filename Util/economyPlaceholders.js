const { SlashCommandBuilder, MessageFlags } = require('discord.js');

const moxi = require('../i18n');
const { EMOJIS } = require('./emojis');
const { buildNoticeContainer, asV2MessageOptions } = require('./v2Notice');

function economyCategory(lang) {
  return moxi.translate('commands:CATEGORY_ECONOMIA', lang || 'es-ES');
}

function makePrefixEconomyPlaceholder({ name, alias = [], description } = {}) {
  const safeName = String(name || '').trim().toLowerCase();
  return {
    name: safeName,
    alias,
    Category: economyCategory,
    usage: safeName,
    get description() {
      return description || 'Comando de economía (próximamente)';
    },
    async execute(Moxi, message) {
      return message.reply(
        asV2MessageOptions(
          buildNoticeContainer({
            emoji: '🚧',
            title: `Economía • ${safeName}`,
            text: 'Este comando está en construcción y se añadirá pronto.',
          })
        )
      );
    },
  };
}

function makeSlashEconomyPlaceholder({ name, description } = {}) {
  const safeName = String(name || '').trim().toLowerCase();
  return {
    cooldown: 0,
    Category: economyCategory,
    data: new SlashCommandBuilder()
      .setName(safeName)
      .setDescription((description || 'Comando de economía (próximamente)').slice(0, 100)),
    async run(Moxi, interaction) {
      return interaction.reply({
        ...asV2MessageOptions(
          buildNoticeContainer({
            emoji: '🚧',
            title: `Economía • ${safeName}`,
            text: 'Este comando está en construcción y se añadirá pronto.',
          })
        ),
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    },
  };
}

module.exports = {
  economyCategory,
  makePrefixEconomyPlaceholder,
  makeSlashEconomyPlaceholder,
};
