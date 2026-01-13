const djs = require('discord.js');

function normalizeInteractionResponseOptions(options) {
  if (!options || typeof options !== 'object') return options;
  if (!Object.prototype.hasOwnProperty.call(options, 'ephemeral')) return options;

  const ephemeral = options.ephemeral;
  const baseFlags = Number(options.flags) || 0;

  if (ephemeral === true) {
    options.flags = baseFlags | djs.MessageFlags.Ephemeral;
  } else if (ephemeral === false) {
    options.flags = baseFlags & ~djs.MessageFlags.Ephemeral;
  }

  delete options.ephemeral;
  return options;
}

function wrapMethod(klass, methodName) {
  if (!klass || !klass.prototype) return;
  const original = klass.prototype[methodName];
  if (typeof original !== 'function') return;
  if (original.__moxi_ephemeral_wrapped) return;

  function wrapped(firstArg, ...rest) {
    if (firstArg && typeof firstArg === 'object') {
      normalizeInteractionResponseOptions(firstArg);
    }
    return original.call(this, firstArg, ...rest);
  }

  wrapped.__moxi_ephemeral_wrapped = true;
  klass.prototype[methodName] = wrapped;
}

function installEphemeralCompat() {
  const targets = [
    djs.CommandInteraction,
    djs.ChatInputCommandInteraction,
    djs.ContextMenuCommandInteraction,
    djs.MessageContextMenuCommandInteraction,
    djs.UserContextMenuCommandInteraction,
    djs.MessageComponentInteraction,
    djs.ButtonInteraction,
    djs.StringSelectMenuInteraction,
    djs.UserSelectMenuInteraction,
    djs.RoleSelectMenuInteraction,
    djs.ChannelSelectMenuInteraction,
    djs.MentionableSelectMenuInteraction,
    djs.ModalSubmitInteraction,
  ].filter(Boolean);

  for (const klass of targets) {
    wrapMethod(klass, 'reply');
    wrapMethod(klass, 'deferReply');
    wrapMethod(klass, 'followUp');
    wrapMethod(klass, 'editReply');
  }
}

module.exports = {
  installEphemeralCompat,
};
