const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const { ContainerBuilder, MessageFlags } = require('discord.js');

const moxi = require('../../i18n');
const { Bot } = require('../../Config');
const { EMOJIS } = require('../../Util/emojis');
const { isDiscordOnlyOwner } = require('../../Util/ownerPermissions');
const { isUsingSlashCommandIds } = require('../../Util/slashCommandMentions');

function boolFromEnv(name, fallback = false) {
    const raw = process.env[name];
    if (raw === undefined || raw === null || raw === '') return !!fallback;
    const value = String(raw).trim().toLowerCase();
    if (['1', 'true', 'yes', 'y', 'on'].includes(value)) return true;
    if (['0', 'false', 'no', 'n', 'off'].includes(value)) return false;
    return !!fallback;
}

function exists(relativePath) {
    try {
        const fullPath = path.join(__dirname, '..', '..', relativePath);
        return fs.existsSync(fullPath);
    } catch {
        return false;
    }
}

function getAiCommandsWithoutPrefixDefault() {
    if (process.env.AI_COMMANDS_WITHOUT_PREFIX !== undefined) {
        return boolFromEnv('AI_COMMANDS_WITHOUT_PREFIX', false);
    }
    try {
        const Config = require('../../Config');
        if (typeof Config?.Bot?.AiCommandsWithoutPrefix === 'boolean') {
            return Config.Bot.AiCommandsWithoutPrefix;
        }
    } catch {
    }
    return false;
}

function formatItem({ status, title, detail }) {
    const icon = status === 'PASS'
        ? (EMOJIS.tick || '✅')
        : (status === 'WARN' ? (EMOJIS.warning || '⚠️') : (EMOJIS.cross || '❌'));
    return `${icon} **${title}** — ${detail}`;
}

module.exports = {
    name: 'toscheck',
    alias: ['compliance', 'tos', 'tosaudit', 'discordtos'],
    Category: (lang = 'es-ES') => moxi.translate('commands:CATEGORY_ROOT', lang),
    usage: 'toscheck',
    description: () => 'Chequea postura de cumplimiento ToS/Developer Policy de Discord (owner only).',
    cooldown: 10,

    async execute(Moxi, message) {
        const guildId = message.guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        const isOwner = await isDiscordOnlyOwner({ client: Moxi, userId: message.author?.id });
        if (!isOwner) {
            const denied = new ContainerBuilder()
                .setAccentColor(Bot.AccentColor)
                .addTextDisplayComponents(c => c.setContent(`# ${EMOJIS.cross || '❌'} ToS Check`))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c => c.setContent(moxi.translate('NO_PERMISSION', lang)));
            return message.reply({ content: '', components: [denied], flags: MessageFlags.IsComponentsV2 });
        }

        const checks = [];

        checks.push({
            status: 'PASS',
            title: 'Token de bot (no self-bot)',
            detail: 'El proyecto usa cliente de bot estándar de discord.js.',
        });

        const sayuEnabled = boolFromEnv('ENABLE_SAYU', false);
        checks.push({
            status: sayuEnabled ? 'WARN' : 'PASS',
            title: 'Comando sayu (webhook/impersonación)',
            detail: sayuEnabled
                ? 'Está activado por entorno (`ENABLE_SAYU=1`). Revisa uso estricto en servidores confiables.'
                : 'Está desactivado por defecto (`ENABLE_SAYU` apagado).',
        });

        const aiNoPrefix = getAiCommandsWithoutPrefixDefault();
        checks.push({
            status: aiNoPrefix ? 'WARN' : 'PASS',
            title: 'IA con comandos sin prefijo',
            detail: aiNoPrefix
                ? 'Está habilitado. Recomendado: mantenerlo en `false`.'
                : 'Desactivado por defecto (postura segura).',
        });

        const privacyDocsOk = exists('PRIVACY.md');
        const privacyPrefixOk = exists('Comandos/Tools/privacy.js');
        const privacySlashOk = exists('Slashcmd/Tools/privacy.js');
        const privacyOk = privacyDocsOk && privacyPrefixOk && privacySlashOk;

        checks.push({
            status: privacyOk ? 'PASS' : 'WARN',
            title: 'Transparencia y borrado de datos',
            detail: privacyOk
                ? 'Existe política y comandos de privacidad (`privacy` y `/privacy`).'
                : 'Falta política o comando de privacidad; revisa `PRIVACY.md` y comandos privacy.',
        });

        const sanitizeFilterEnabled = mongoose.get('sanitizeFilter') === true;
        checks.push({
            status: sanitizeFilterEnabled ? 'PASS' : 'WARN',
            title: 'Hardening de filtros Mongo',
            detail: sanitizeFilterEnabled
                ? '`mongoose sanitizeFilter` está activo.'
                : '`sanitizeFilter` no parece activo en runtime.',
        });

        const slashMentionsWithId = isUsingSlashCommandIds();
        checks.push({
            status: slashMentionsWithId ? 'WARN' : 'PASS',
            title: 'Menciones slash por ID',
            detail: slashMentionsWithId
                ? 'Activadas por ID (`SLASH_MENTIONS_WITH_ID=true`), depende de sincronización/caché.'
                : 'Modo seguro: texto `/comando` sin depender de IDs persistidos.',
        });

        const warnings = checks.filter(c => c.status !== 'PASS').length;
        const failed = checks.filter(c => c.status === 'FAIL').length;
        const overall = failed > 0 ? 'FAIL' : (warnings > 0 ? 'WARN' : 'PASS');

        const overallIcon = overall === 'PASS'
            ? (EMOJIS.tick || '✅')
            : (overall === 'WARN' ? (EMOJIS.warning || '⚠️') : (EMOJIS.cross || '❌'));

        const lines = checks.map(formatItem).join('\n');
        const summary = `Resultado: **${overall}** ${overallIcon}\nChecks: **${checks.length}** • Warnings: **${warnings}** • Fail: **${failed}**`;

        const container = new ContainerBuilder()
            .setAccentColor(Bot.AccentColor)
            .addTextDisplayComponents(c => c.setContent(`# ${overallIcon} Discord ToS Compliance Check`))
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(c => c.setContent(summary))
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(c => c.setContent(lines))
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(c => c.setContent(
                'Nota: este chequeo es técnico/operativo dentro del bot y no reemplaza una revisión legal formal de ToS/Developer Policy.'
            ));

        return message.reply({
            content: '',
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { repliedUser: false },
        });
    },
};
