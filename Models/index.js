// Centralized exports for all models
// This file provides a single entry point for importing any model from the Models directory

const AuditSchema = require('./AuditSchema');
const Bug = require('./BugSchema');
const ByesSchema = require('./ByesSchema');
const ClvlsSchema = require('./ClvlsSchema');
const GuildModels = require('./GuildModels');
const GuildSchema = require('./GuildSchema');
const GuildSettings = require('./GuildSettings');
const LanguageSchema = require('./LanguageSchema');
const RankSchema = require('./RankSchema');
const UserSchema = require('./UserSchema');
const WelcomeSchema = require('./WelcomeSchema');
const Iventory = require('./InventorySchema');
const Economy = require('./EconomySchema');
const SlashCommandId = require('./SlashCommandIdSchema');
const SuggestionsSchema = require('./SuggestionsSchema');

// Export all models individually
module.exports = {
    AuditSchema,
    Bug,
    ByesSchema,
    ClvlsSchema,
    GuildModels,
    GuildSchema,
    GuildSettings,
    LanguageSchema,
    RankSchema,
    UserSchema,
    Iventory,
    Economy,
    SlashCommandId,
    WelcomeSchema,
    SuggestionsSchema,
    // Also export them as named exports for destructuring
    Audit: AuditSchema,
    Bugs: Bug,
    Byes: ByesSchema,
    Clvls: ClvlsSchema,
    Guild: GuildModels,
    GuildData: GuildSchema,
    Settings: GuildSettings,
    Language: LanguageSchema,
    Rank: RankSchema,
    User: UserSchema,
    Inventory: Iventory,
    EconomyModels: Economy,
    SlashCommandIds: SlashCommandId,
    Welcome: WelcomeSchema,
    Suggestions: SuggestionsSchema,
};
