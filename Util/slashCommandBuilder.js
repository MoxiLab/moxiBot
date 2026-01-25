const { ChatInputCommandBuilder } = require('discord.js');

function withSingularAliases(builder) {
  if (!builder || typeof builder !== 'object') return builder;

  const aliasMap = {
    addStringOption: 'addStringOptions',
    addIntegerOption: 'addIntegerOptions',
    addNumberOption: 'addNumberOptions',
    addBooleanOption: 'addBooleanOptions',
    addUserOption: 'addUserOptions',
    addChannelOption: 'addChannelOptions',
    addRoleOption: 'addRoleOptions',
    addMentionableOption: 'addMentionableOptions',
    addAttachmentOption: 'addAttachmentOptions',
    addSubcommand: 'addSubcommands',
    addSubcommandGroup: 'addSubcommandGroups',
  };

  for (const [singular, plural] of Object.entries(aliasMap)) {
    if(typeof builder[singular] !== 'function' && typeof builder[plural] === 'function') {
      // Definimos el alias como función normal para respetar "this".
      Object.defineProperty(builder, singular, {
        value: function (fn) {
          return this[plural](fn);
        },
        enumerable: false,
      });
    }
  }

  return builder;
}

class SlashCommandBuilder extends ChatInputCommandBuilder {
  setDMPermission(enabled) {
    // En discord.js v15, setDMPermission fue sustituido por contexts.
    // Para compatibilidad con el código existente:
    // - true  => permitir en Guild + DMs
    // - false => solo Guild
    const { InteractionContextType } = require('discord.js');

    if (typeof this.setContexts === 'function') {
      if (enabled) {
        return this.setContexts([
          InteractionContextType.Guild,
          InteractionContextType.BotDM,
          InteractionContextType.PrivateChannel,
        ]);
      }

      return this.setContexts([InteractionContextType.Guild]);
    }

    return this;
  }

  addStringOption(fn) {
    return this.addStringOptions(fn);
  }

  addIntegerOption(fn) {
    return this.addIntegerOptions(fn);
  }

  addNumberOption(fn) {
    return this.addNumberOptions(fn);
  }

  addBooleanOption(fn) {
    return this.addBooleanOptions(fn);
  }

  addUserOption(fn) {
    return this.addUserOptions(fn);
  }

  addChannelOption(fn) {
    return this.addChannelOptions(fn);
  }

  addRoleOption(fn) {
    return this.addRoleOptions(fn);
  }

  addMentionableOption(fn) {
    return this.addMentionableOptions(fn);
  }

  addAttachmentOption(fn) {
    return this.addAttachmentOptions(fn);
  }

  addSubcommand(fn) {
    return this.addSubcommands((sub) => fn(withSingularAliases(sub)));
  }

  addSubcommandGroup(fn) {
    return this.addSubcommandGroups((group) => fn(withSingularAliases(group)));
  }
}

module.exports = { SlashCommandBuilder };
