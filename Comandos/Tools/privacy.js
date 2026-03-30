const moxi = require('../../i18n');

function toolsCategory(lang) {
    lang = lang || 'es-ES';
    return moxi.translate('commands:CATEGORY_HERRAMIENTAS', lang);
}

function resolvePrivacyUrl() {
    const url = String(process.env.PRIVACY_POLICY_URL || '').trim();
    return url || null;
}

function resolveDataDeleteContact() {
    const value = String(process.env.DATA_DELETE_CONTACT || '').trim();
    return value || 'Contacta con el staff del servidor o con el owner del bot para solicitar borrado de datos.';
}

module.exports = {
    name: 'privacy',
    alias: ['privacidad', 'datos'],
    Category: toolsCategory,
    usage: 'privacy',
    description: (lang = 'es-ES') => moxi.translate('commands:CMD_PRIVACY_DESC', lang) !== 'commands:CMD_PRIVACY_DESC'
        ? moxi.translate('commands:CMD_PRIVACY_DESC', lang)
        : 'Muestra la política de privacidad y cómo pedir borrado de datos',

    async execute(Moxi, message) {
        const guildId = message.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const privacyUrl = resolvePrivacyUrl();
        const deleteContact = resolveDataDeleteContact();

        const lines = [
            '🔒 **Privacidad de Moxi**',
            '- Este bot guarda datos mínimos de funcionamiento (por ejemplo: configuración del servidor, prefijo, módulos activados y métricas básicas de uso).',
            '- No solicita contraseñas ni tokens de usuarios.',
            '- No envía DMs de marketing automáticas.',
            `- Solicitud de borrado de datos: ${deleteContact}`,
        ];

        if (privacyUrl) {
            lines.push(`- Política completa: ${privacyUrl}`);
        } else {
            lines.push('- Política completa: no configurada. Define `PRIVACY_POLICY_URL` en el entorno.');
        }

        return message.reply({
            content: lines.join('\n'),
            allowedMentions: { repliedUser: false, parse: [] },
        });
    },
};
