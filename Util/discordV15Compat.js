// Este archivo existía como shim de compatibilidad durante la migración.
// El repo ya está en discord.js v15 nativo y no debe parchear discord.js.

function installDiscordV15Compat() {
  return require('discord.js');
}

module.exports = { installDiscordV15Compat };
