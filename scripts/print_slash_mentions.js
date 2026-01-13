// Prints real slash command mentions like </bug:ID>.
// Usage:
//   node scripts/print_slash_mentions.js
//   set GUILD_ID=123...; node scripts/print_slash_mentions.js
//   node scripts/print_slash_mentions.js bug feedback help

require('../Util/silentDotenv')();

const { syncSlashCommandIds, slashMention, getSlashCommandId } = require('../Util/slashCommandMentions');

async function main() {
  const applicationId = process.env.CLIENT_ID;
  const token = process.env.TOKEN;
  const guildId = process.env.GUILD_ID || null;

  if (!applicationId || !token) {
    console.error('[print_slash_mentions] Missing CLIENT_ID and/or TOKEN in .env');
    process.exit(1);
  }

  // Always sync global for "works everywhere"
  const globalRes = await syncSlashCommandIds({ applicationId, guildId: null });
  console.log('[print_slash_mentions] synced global:', globalRes?.synced || 0);

  // Optional guild sync (only if you deploy per-guild)
  if (guildId) {
    const guildRes = await syncSlashCommandIds({ applicationId, guildId });
    console.log('[print_slash_mentions] synced guild:', guildRes?.synced || 0, 'guildId=', guildId);
  }

  const names = process.argv.slice(2);
  const toPrint = names.length ? names : ['bug', 'feedback'];

  for (const name of toPrint) {
    const id = await getSlashCommandId({ name, applicationId, guildId });
    const mention = await slashMention({ name, applicationId, guildId });
    console.log(`- ${name}: id=${id || 'null'} mention=${mention}`);
  }

  console.log('[print_slash_mentions] done');
}

main().catch((e) => {
  console.error('[print_slash_mentions] failed:', e);
  process.exit(1);
});
