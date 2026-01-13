const mongoose = require('mongoose');
const { ensureMongoConnection } = require('../Util/mongoConnect');

const slashCommandIdSchema = new mongoose.Schema(
  {
    applicationId: { type: String, required: true, index: true },
    // null/undefined => global command
    guildId: { type: String, default: null, index: true },
    name: { type: String, required: true, index: true },
    commandId: { type: String, required: true },
  },
  {
    timestamps: true,
    collection: 'slash_command_ids',
  }
);

slashCommandIdSchema.index({ applicationId: 1, guildId: 1, name: 1 }, { unique: true });

// Ensure connection is attempted when the model is loaded (matches repo pattern)
if (typeof process.env.MONGODB === 'string' && process.env.MONGODB.trim()) {
  ensureMongoConnection().catch(() => null);
}

module.exports = mongoose.model('SlashCommandId', slashCommandIdSchema);
