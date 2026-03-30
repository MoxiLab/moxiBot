// Shared i18n helpers for SlashCommandBuilder metadata (static localizations).
// Note: Discord uses its own locale codes (e.g. 'de', 'fr', 'ar', 'hi', 'id', 'zh-CN').

const WIP_SLASH_DESC = 'Comando en desarrollo';

const WIP_SLASH_DESC_LOCALIZATIONS = {
    'en-US': 'Command in development',
    'es-ES': 'Comando en desarrollo',
    de: 'Befehl in Entwicklung',
    fr: 'Commande en cours de développement',
    it: 'Comando in sviluppo',
    ja: '開発中のコマンド',
    ko: '개발 중인 명령어',
    pl: 'Polecenie w trakcie tworzenia',
    'pt-BR': 'Comando em desenvolvimento',
    ru: 'Команда в разработке',
    tr: 'Geliştirme aşamasındaki komut',
    uk: 'Команда в розробці',
    id: 'Perintah dalam pengembangan',
    hi: 'कमांड विकास में है',
    'zh-CN': '开发中的命令',
};

module.exports = {
    WIP_SLASH_DESC,
    WIP_SLASH_DESC_LOCALIZATIONS,
};
