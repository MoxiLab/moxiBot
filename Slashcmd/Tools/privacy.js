const { MessageFlags } = require('discord.js');
const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');

function resolvePrivacyUrl() {
    const url = String(process.env.PRIVACY_POLICY_URL || '').trim();
    return url || null;
}

function resolveDataDeleteContact() {
    const value = String(process.env.DATA_DELETE_CONTACT || '').trim();
    return value || 'Contacta con el staff del servidor o con el owner del bot para solicitar borrado de datos.';
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('privacy')
        .setDescription('Muestra la política de privacidad y solicitud de borrado'),

    async run(_Moxi, interaction) {
        const privacyUrl = resolvePrivacyUrl();
        const deleteContact = resolveDataDeleteContact();

        const lines = [
            '🔒 **Privacidad de Moxi**',
            '- Se almacenan datos mínimos de funcionamiento (configuración del servidor, prefijo, módulos activados y métricas básicas de uso).',
            '- No se solicitan contraseñas ni tokens de usuarios.',
            '- No se envían DMs de marketing automáticas.',
            `- Solicitud de borrado de datos: ${deleteContact}`,
        ];

        if (privacyUrl) {
            lines.push(`- Política completa: ${privacyUrl}`);
        } else {
            lines.push('- Política completa: no configurada. Define `PRIVACY_POLICY_URL` en el entorno.');
        }

        return interaction.reply({
            content: lines.join('\n'),
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
        });
    },
};
