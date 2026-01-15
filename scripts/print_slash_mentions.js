// Prints real slash command mentions like </bug:ID>.
// Usage:
//   node scripts/print_slash_mentions.js
//   set GUILD_ID=123...; node scripts/print_slash_mentions.js
//   node scripts/print_slash_mentions.js bug feedback help

require('../Util/silentDotenv')();

const { slashMention, getSlashCommandId, isUsingSlashCommandIds } = require('../Util/slashCommandMentions');

function parseArgs(argv) {
  const out = { guildId: null, names: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--guild' || a === '--guildId') {
      out.guildId = argv[i + 1] ? String(argv[i + 1]).trim() : null;
      i++;
      continue;
    }
    if (a && a.startsWith('--guild=')) {
      out.guildId = String(a.slice('--guild='.length)).trim() || null;
      continue;
    }
    if (a && a.startsWith('--guildId=')) {
      out.guildId = String(a.slice('--guildId='.length)).trim() || null;
      continue;
    }
    out.names.push(a);
  }
  return out;
}

async function main() {
  const applicationId = process.env.CLIENT_ID;
  const token = process.env.TOKEN;
  const parsed = parseArgs(process.argv.slice(2));
  const guildId = parsed.guildId || process.env.GUILD_ID || null;

  if (!isUsingSlashCommandIds()) {
    console.error('[print_slash_mentions] IDs desactivadas -> no imprimirá </cmd:ID>. Activa SLASH_MENTIONS_WITH_ID=true o Config.Bot.SlashMentionsWithId=true');
    process.exit(1);
  }

  if (!applicationId || !token) {
    console.error('[print_slash_mentions] Missing CLIENT_ID and/or TOKEN in .env');
    process.exit(1);
  }

  const names = process.argv.slice(2);
  const toPrint = parsed.names.length ? parsed.names : ['bug', 'feedback'];

  for (const name of toPrint) {
    const id = await getSlashCommandId({ name, applicationId, guildId });
    const mention = await slashMention({ name, applicationId, guildId });
    console.log(`- ${name}: id=${id || 'null'} mention=${mention}`);
  }

  if (!guildId) {
    console.log('[print_slash_mentions] Nota: si GLOBAL está vacío, necesitas pasar --guild <ID> (o setear GUILD_ID) para obtener IDs del servidor.');
  }

  console.log('[print_slash_mentions] done');
}

main().catch((e) => {
  console.error('[print_slash_mentions] failed:', e);
  process.exit(1);
});
