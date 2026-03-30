const fs = require('node:fs');
const path = require('node:path');
const mongoose = require('mongoose');
const { MessageFlags } = require('discord.js');
const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');

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

module.exports = {
    data: new SlashCommandBuilder()
        .setName('toscheck')
        .setDescription('Chequea cumplimiento técnico ToS/Developer Policy (solo owners)'),

    async run(Moxi, interaction) {
        const isOwner = await isDiscordOnlyOwner({ client: Moxi, userId: interaction.user?.id });
        if (!isOwner) {
            return interaction.reply({
                content: '❌ Solo los owners del bot pueden usar este comando.',
                flags: MessageFlags.Ephemeral,
                allowedMentions: { parse: [] },
            });
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

        const icon = overall === 'PASS' ? '✅' : (overall === 'WARN' ? '⚠️' : '❌');
        const lines = checks.map((c) => {
            const itemIcon = c.status === 'PASS' ? '✅' : (c.status === 'WARN' ? '⚠️' : '❌');
            return `${itemIcon} **${c.title}** — ${c.detail}`;
        }).join('\n');

        const text = [
            `# ${icon} Discord ToS Compliance Check`,
            `Resultado: **${overall}**`,
            `Checks: **${checks.length}** • Warnings: **${warnings}** • Fail: **${failed}**`,
            '',
            lines,
            '',
            '_Nota: este chequeo es técnico/operativo dentro del bot y no reemplaza una revisión legal formal de ToS/Developer Policy._',
        ].join('\n');

        return interaction.reply({
            content: text,
            flags: MessageFlags.Ephemeral,
            allowedMentions: { parse: [] },
        });
    },
};
