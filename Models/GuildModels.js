// Importación centralizada de todos los modelos relacionados con guilds
const Byes = require('./ByesSchema');
const Welcms = require('./WelcomeSchema');
const Rank = require('./RankSchema');
const Languages = require('./LanguageSchema');
const Clvls = require('./ClvlsSchema');
const AuditSchema = require('./AuditSchema');

module.exports = {
    Byes,
    Welcms,
    Rank,
    Languages,
    Clvls,
    AuditSchema,
};
