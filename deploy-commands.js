// Script para registrar todos los slash commands en Discord
// Guarda este archivo como deploy-commands.js y ejecútalo con node deploy-commands.js

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('./Util/silentDotenv')();
const { EMOJIS } = require('./Util/emojis');
const moxi = require('./i18n');
const { upsertDeployedCommandIds } = require('./Util/slashCommandMentions');

const clientId = process.env.CLIENT_ID || 'TU_CLIENT_ID';
const guildId = process.env.GUILD_ID; // Opcional: para registro por servidor
const token = process.env.TOKEN || 'TU_TOKEN';

// Recoge todos los archivos de slash commands
function getSlashCommands(dir) {
  let results = [];
  fs.readdirSync(dir, { withFileTypes: true }).forEach(entry => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getSlashCommands(fullPath));
    } else if (entry.name.endsWith('.js')) {
      results.push(fullPath);
    }
  });
  return results;
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    // Espera a que i18next cargue los namespaces para que moxi.translate funcione
    // durante la construcción de SlashCommandBuilder.
    if (moxi?.ready) await moxi.ready;

    const commands = [];
    const slashFiles = getSlashCommands(path.join(__dirname, 'Slashcmd'));
    for (const file of slashFiles) {
      const command = require(file);
      if (command.data) {
        commands.push(command.data.toJSON ? command.data.toJSON() : command.data);
      }
    }

    console.log(`${EMOJIS.hourglass} Registrando ${commands.length} slash commands...`);
    let data;
    if (guildId) {
      data = await rest.put(
        Routes.applicationGuildCommands(clientId, guildId),
        { body: commands },
      );
      console.log(`${EMOJIS.check} Slash commands registrados a nivel de servidor.`);
    } else {
      data = await rest.put(
        Routes.applicationCommands(clientId),
        { body: commands },
      );
      console.log(`${EMOJIS.check} Slash commands registrados globalmente.`);
    }

    try {
      await upsertDeployedCommandIds({
        applicationId: clientId,
        guildId: guildId || null,
        deployed: Array.isArray(data) ? data : [],
      });
      console.log(`${EMOJIS.check} IDs de slash commands guardados en Mongo.`);
    } catch (e) {
      console.warn('No se pudieron guardar IDs de slash commands en Mongo:', e?.message || e);
    }
    console.log(`Total: ${data.length}`);
  } catch (error) {
    console.error(error);
  }
})();
