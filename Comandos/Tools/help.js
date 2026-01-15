// Comando de prefijo: help
// Reutiliza la lógica de help.js (slash)

const helpSlash = require('../../Slashcmd/Tools/help.js');

const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const logger = require('../../Util/logger.js');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const getHelpContent = require('../../Util/getHelpContent');
const { formatDuration } = require('../../Util/economyCore');

function splitUsageVariants(usage) {
    const raw = String(usage || '').trim();
    if (!raw) return [];
    return raw
        .split('|')
        .map(s => String(s).trim())
        .filter(Boolean);
}

function normalizeUsageLine(line, cmdName) {
    const raw = String(line || '').trim();
    const name = String(cmdName || '').trim();
    if (!raw) return '';
    if (!name) return raw;
    const lowerRaw = raw.toLowerCase();
    const lowerName = name.toLowerCase();
    if (lowerRaw === lowerName) return raw;
    if (lowerRaw.startsWith(lowerName + ' ')) return raw;
    return `${name} ${raw}`;
}

function extractSubcommandsFromUsageLines(lines, cmdName) {
    const name = String(cmdName || '').trim().toLowerCase();
    if (!name) return [];
    const subs = new Set();
    for (const ln of Array.isArray(lines) ? lines : []) {
        const raw = String(ln || '').trim();
        if (!raw) continue;
        const parts = raw.split(/\s+/g).filter(Boolean);
        if (!parts.length) continue;
        if (String(parts[0]).toLowerCase() !== name) continue;
        const maybe = parts[1];
        if (!maybe) continue;
        if (/^[\[<]/.test(maybe)) continue;
        subs.add(String(maybe).trim().toLowerCase());
    }
    return Array.from(subs.values()).sort();
}

function safeArrayLower(arr) {
    return (Array.isArray(arr) ? arr : [])
        .map(v => String(v || '').trim())
        .filter(Boolean);
}

function resolvePermissions(cmd) {
    const perms = (cmd && cmd.permissions && typeof cmd.permissions === 'object') ? cmd.permissions : null;
    if (!perms) return { user: [], bot: [] };

    // Soporta variantes: User/Bot (mayúsculas), user/bot (minúsculas)
    const user = safeArrayLower(perms.User || perms.user);
    const bot = safeArrayLower(perms.Bot || perms.bot);
    return { user, bot };
}

function getSlashHelpLines(cmd) {
    if (!cmd) return [];
    const data = cmd.data;
    if (!data || typeof data.toJSON !== 'function') {
        const name = cmd.name;
        return name ? [`/${name}`] : [];
    }

    const json = data.toJSON();
    const name = json?.name || cmd.name;
    if (!name) return [];

    // Mostrar subcomandos si existen
    const opts = Array.isArray(json?.options) ? json.options : [];
    const sub = opts.filter(o => o && o.type === 1 && o.name).map(o => o.name);
    if (sub.length) return sub.map(s => `/${name} ${s}`);
    return [`/${name}`];
}

function extractSubcommandsFromSlash(cmd) {
    const data = cmd?.data;
    if (!data || typeof data.toJSON !== 'function') return [];
    const json = data.toJSON();
    const opts = Array.isArray(json?.options) ? json.options : [];
    const sub = opts.filter(o => o && o.type === 1 && o.name).map(o => String(o.name).trim().toLowerCase()).filter(Boolean);
    return Array.from(new Set(sub)).sort();
}

function normalizeCategoryQuery(input) {
    const raw = String(input || '').trim().toLowerCase();
    if (!raw) return null;

    // Economía
    if (raw.includes('econom')) return 'Economy';
    if (raw.includes('eco')) return 'Economy';

    // Herramientas
    if (raw.includes('herra')) return 'Tools';
    if (raw.includes('tool')) return 'Tools';

    // Música
    if (raw.includes('music') || raw.includes('musi')) return 'Music';

    // Moderación
    if (raw.includes('moder')) return 'Moderation';

    // Administración
    if (raw.includes('admin')) return 'Admin';

    // Root/Owner
    if (raw === 'root' || raw.includes('owner') || raw.includes('due')) return 'Root';

    // Welcome
    if (raw.includes('welc') || raw.includes('bienv') || raw.includes('welcome')) return 'Welcome';

    return null;
}

function isUntranslated(key, value) {
    if (value === undefined || value === null) return true;
    const v = String(value);
    if (!v) return true;
    if (v === key) return true;
    // i18next a veces devuelve la key sin namespace (p.ej. "CMD_help_NAME")
    const withoutNs = String(key).includes(':') ? String(key).split(':').pop() : String(key);
    if (v === withoutNs) return true;
    return false;
}

function resolveCommandDescription(cmd, lang, fallbackName) {
    // 1) Si el comando ya soporta description(lang)
    if (cmd && cmd.description && typeof cmd.description === 'function') {
        try {
            const res = cmd.description(lang);
            if (res && typeof res === 'string') return res;
        } catch { }
    }

    // 2) Si viene como string literal
    if (cmd && typeof cmd.description === 'string' && cmd.description.trim()) {
        // Permite que algunos comandos guarden directamente una key tipo "commands:..."
        if (cmd.description.includes(':')) {
            const t = moxi.translate(cmd.description, lang);
            if (t && t !== cmd.description) return t;
        }
        return cmd.description;
    }

    // 3) Fallback a comandos.json por nombre
    const name = (cmd && typeof cmd.name === 'string' && cmd.name.trim()) ? cmd.name.trim() : (fallbackName || '');
    if (name) {
        const candidates = [
            `commands:CMD_${name}_DESC`,
            `commands:CMD_${name.toUpperCase()}_DESC`,
            `commands:CMD_${name.toLowerCase()}_DESC`,
            `commands:CMD_${name.charAt(0).toLowerCase()}${name.slice(1)}_DESC`,
        ];
        for (const key of candidates) {
            const t = moxi.translate(key, lang);
            if (t && !isUntranslated(key, t)) return t;
        }
    }

    return moxi.translate('HELP_NO_DESCRIPTION', lang);
}

function resolveCommandDisplayName(cmd, lang, fallbackName) {
    // 1) Si el comando soporta name(lang)
    if (cmd && cmd.name && typeof cmd.name === 'function') {
        try {
            const res = cmd.name(lang);
            if (res && typeof res === 'string') return res;
        } catch { }
    }

    // 2) Si el nombre es string, intenta localizarlo desde commands.json
    const name = (cmd && typeof cmd.name === 'string' && cmd.name.trim()) ? cmd.name.trim() : (fallbackName || '');
    if (name) {
        const candidates = [
            `commands:CMD_${name}_NAME`,
            `commands:CMD_${name.toUpperCase()}_NAME`,
            `commands:CMD_${name.toLowerCase()}_NAME`,
        ];
        for (const key of candidates) {
            const t = moxi.translate(key, lang);
            if (t && !isUntranslated(key, t)) return t;
        }
        return name;
    }

    return fallbackName || '';
}

function tOr(key, lang, fallback) {
    const t = moxi.translate(key, lang);
    if (t && !isUntranslated(key, t)) return t;
    return fallback;
}

function formatCooldownPretty(cooldownSec, lang) {
    const sec = (typeof cooldownSec === 'number' && Number.isFinite(cooldownSec)) ? cooldownSec : 0;
    if (!sec || sec <= 0) return tOr('HELP_NONE', lang, 'Ninguno');
    return formatDuration(sec * 1000);
}

function resolveHelpText(cmd, lang) {
    const raw = cmd?.helpText;
    if (!raw) return '';
    if (typeof raw === 'function') {
        try {
            const v = raw(lang);
            return (typeof v === 'string') ? v.trim() : '';
        } catch {
            return '';
        }
    }
    return (typeof raw === 'string') ? raw.trim() : '';
}

function resolveExamples({ cmd, canonicalName, prefix, usageVariants, subs }) {
    const fromCmd = Array.isArray(cmd?.examples) ? cmd.examples : [];
    const cleaned = fromCmd.map(s => String(s || '').trim()).filter(Boolean);
    if (cleaned.length) {
        return cleaned.slice(0, 8).map(ex => `${prefix}${ex}`);
    }

    const out = [];
    out.push(`${prefix}${canonicalName}`);

    // Si hay variantes de uso, pon 1-2 ejemplos
    const variants = (Array.isArray(usageVariants) ? usageVariants : [])
        .map(u => String(u || '').trim())
        .filter(Boolean);
    for (const v of variants.slice(0, 3)) {
        out.push(`${prefix}${normalizeUsageLine(v, canonicalName)}`);
    }

    // Si hay subcomandos, añade 1-2
    const subList = Array.isArray(subs) ? subs : [];
    for (const s of subList.slice(0, 2)) {
        out.push(`${prefix}${canonicalName} ${s}`);
    }

    return Array.from(new Set(out)).slice(0, 8);
}

function resolveCooldownLines(baseCmd, lang) {
    const tiers = baseCmd?.cooldownTiers;
    const sec = (typeof baseCmd?.cooldown === 'number' && Number.isFinite(baseCmd.cooldown)) ? baseCmd.cooldown : 0;

    const hasTiers = tiers && typeof tiers === 'object' && (
        Number.isFinite(Number(tiers.normal)) ||
        Number.isFinite(Number(tiers.normalHaste)) ||
        Number.isFinite(Number(tiers.premium)) ||
        Number.isFinite(Number(tiers.premiumHaste))
    );

    if (!hasTiers && (!sec || sec <= 0)) return null;

    const lines = [];
    if (hasTiers) {
        const normal = Number.isFinite(Number(tiers.normal)) ? formatDuration(Number(tiers.normal) * 1000) : formatCooldownPretty(sec, lang);
        lines.push(`Normal: ${normal}`);

        if (Number.isFinite(Number(tiers.normalHaste))) {
            lines.push(`Normal: ${formatDuration(Number(tiers.normalHaste) * 1000)} con Haste`);
        }
        if (Number.isFinite(Number(tiers.premium))) {
            lines.push(`Premium: ${formatDuration(Number(tiers.premium) * 1000)}`);
        }
        if (Number.isFinite(Number(tiers.premiumHaste))) {
            lines.push(`Premium: ${formatDuration(Number(tiers.premiumHaste) * 1000)} con Haste`);
        }
        return lines;
    }

    lines.push(`${tOr('HELP_COOLDOWN_NORMAL', lang, 'Normal')}: ${formatCooldownPretty(sec, lang)}`);
    return lines;
}

function getSlashSubcommandsWithDescriptions(cmd) {
    const data = cmd?.data;
    if (!data || typeof data.toJSON !== 'function') return [];
    const json = data.toJSON();
    const opts = Array.isArray(json?.options) ? json.options : [];
    return opts
        .filter(o => o && o.type === 1 && o.name)
        .map(o => ({
            name: String(o.name).trim(),
            description: String(o.description || '').trim(),
        }))
        .filter(o => o.name);
}

module.exports = {
    name: "help",
    alias: ['h', 'commands'],
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_HERRAMIENTAS', lang);
    },
    usage: 'help [comando|categoria]',
    description: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CMD_HELP_DESC', lang);
    },
    async execute(Moxi, message, args) {
        const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');

        // Prefijo real del servidor
        const Config = require('../../Config');
        const { Bot } = Config;
        const globalPrefix = (Array.isArray(Bot?.Prefix) && Bot.Prefix[0])
            ? Bot.Prefix[0]
            : (process.env.PREFIX || '.');
        const prefix = await moxi.guildPrefix(message.guild?.id, globalPrefix);

        // Si hay argumento, buscar info del comando
        if (args.length > 0) {
            const query = args[0].toLowerCase();
            // Buscar en prefix y slash
            const matchAlias = (c) => {
                const a = Array.isArray(c?.alias) ? c.alias : (Array.isArray(c?.aliases) ? c.aliases : []);
                return a.some(v => String(v || '').trim().toLowerCase() === query);
            };

            let cmd = Moxi.commands?.get(query) ||
                Array.from(Moxi.commands?.values() || []).find(matchAlias) ||
                Moxi.slashcommands?.get(query) ||
                Array.from(Moxi.slashcommands?.values() || []).find(matchAlias);
            if (!cmd) {
                const categoria = normalizeCategoryQuery(query);
                if (categoria) {
                    const help = await getHelpContent({
                        client: Moxi,
                        lang,
                        userId: message.author?.id,
                        guildId: message.guild?.id,
                        categoria,
                        useV2: true,
                    });

                    if (help && (help.content || (Array.isArray(help.components) && help.components.length))) {
                        return message.reply(help);
                    }
                }

                return message.reply(
                    asV2MessageOptions(
                        buildNoticeContainer({
                            emoji: EMOJIS.cross,
                            title: moxi.translate('HELP_TITLE', lang) || 'Help',
                            text: moxi.translate('HELP_COMMAND_NOT_FOUND', lang, { command: query }),
                        })
                    )
                );
            }
            // Construir panel tipo ContainerBuilder (estilo captura “work”)
            const { ContainerBuilder, MessageFlags, ButtonBuilder, ButtonStyle } = require('discord.js');

            // Intentar enriquecer: si existe versión prefix y slash, usar ambas
            const canonicalName = (typeof cmd?.name === 'string' && cmd.name.trim())
                ? cmd.name.trim()
                : (cmd?.data && cmd.data.name ? String(cmd.data.name).trim() : query);

            const prefixCmd = Moxi.commands?.get(canonicalName) || Array.from(Moxi.commands?.values() || []).find(c => String(c?.name || '').toLowerCase() === canonicalName.toLowerCase());
            const slashCmd = Moxi.slashcommands?.get(canonicalName) || Array.from(Moxi.slashcommands?.values() || []).find(c => String(c?.name || (c?.data && c.data.name) || '').toLowerCase() === canonicalName.toLowerCase());

            // Preferir el objeto de prefijo como base (suele tener usage/alias); pero mantener el actual si no existe
            const baseCmd = prefixCmd || cmd;

            const desc = resolveCommandDescription(baseCmd, lang, canonicalName);
            const displayName = resolveCommandDisplayName(baseCmd, lang, canonicalName);

            const category = (baseCmd.Category && typeof baseCmd.Category === 'function')
                ? baseCmd.Category(lang)
                : (baseCmd.Category || baseCmd.category || moxi.translate('HELP_NO_CATEGORY', lang));

            const aliasArr = Array.isArray(baseCmd?.alias) ? baseCmd.alias : (Array.isArray(baseCmd?.aliases) ? baseCmd.aliases : []);
            const alias = aliasArr.length ? aliasArr.join(', ') : moxi.translate('HELP_NONE', lang);

            const usageRaw = baseCmd.usage || moxi.translate('HELP_NO_USAGE', lang);
            const usageVariants = splitUsageVariants(usageRaw).map(u => normalizeUsageLine(u, canonicalName)).filter(Boolean);

            const hasPrefix = Boolean(
                prefixCmd ||
                typeof baseCmd?.execute === 'function' ||
                baseCmd?.command?.Prefix || baseCmd?.command?.prefix
            );
            const hasSlash = Boolean(
                slashCmd ||
                (baseCmd?.data && typeof baseCmd.data.toJSON === 'function') ||
                baseCmd?.command?.Slash || baseCmd?.command?.slash
            );

            const prefixUsageLines = (hasPrefix)
                ? (usageVariants.length
                    ? usageVariants.map(u => `${prefix}${u}`)
                    : [`${prefix}${canonicalName}`])
                : [];

            const slashLines = (hasSlash)
                ? (slashCmd ? getSlashHelpLines(slashCmd) : getSlashHelpLines(baseCmd))
                : [];

            const subs = Array.from(new Set([
                ...extractSubcommandsFromUsageLines(usageVariants, canonicalName),
                ...extractSubcommandsFromSlash(slashCmd || baseCmd),
            ])).sort();

            const cooldownSec = (typeof baseCmd.cooldown === 'number' && Number.isFinite(baseCmd.cooldown)) ? baseCmd.cooldown : 0;
            const cooldownLabel = formatCooldownPretty(cooldownSec, lang);

            const { user: userPerms, bot: botPerms } = resolvePermissions(baseCmd);
            const noneText = tOr('HELP_NONE', lang, 'Ninguno');

            const botPermsText = botPerms.length ? botPerms.join('\n') : noneText;
            const userPermsText = userPerms.length ? userPerms.join('\n') : noneText;

            const subLabel = tOr('HELP_SUBCOMMANDS', lang, 'Subcomandos');
            const howToLabel = tOr('HELP_HOW_TO_USE', lang, 'Cómo usar');
            const botPermLabel = tOr('HELP_BOT_PERMISSIONS', lang, 'Permisos de la bot');
            const userPermLabel = tOr('HELP_USER_PERMISSIONS', lang, 'Permisos del usuario');
            const syntaxNote = tOr(
                'HELP_SYNTAX_NOTE',
                lang,
                'Sintaxis: <requerido> [opcional] (no incluir estos símbolos)'
            );

            const aliasesUnique = Array.from(new Set([
                String(canonicalName || '').trim(),
                ...(Array.isArray(aliasArr) ? aliasArr : []).map(a => String(a || '').trim()),
            ].filter(Boolean)));
            const aliasLine = aliasesUnique.length ? aliasesUnique.join(', ') : noneText;

            const slashSubWithDesc = getSlashSubcommandsWithDescriptions(slashCmd || baseCmd);
            const subLines = (slashSubWithDesc.length ? slashSubWithDesc : subs.map(s => ({ name: s, description: '' })))
                .map(sc => {
                    const n = String(sc.name || '').trim();
                    if (!n) return null;
                    const d = String(sc.description || '').trim();
                    if (!d) return `\`\.${n}\``;
                    return `\`\.${n}\`: ${d.endsWith('.') ? d : (d + '.')}`;
                })
                .filter(Boolean);

            // “Cómo usar” (como en captura): usar usage completo si existe
            const howToBase = (usageVariants.length ? usageVariants[0] : canonicalName);
            const howToLine = `\`${prefix}${normalizeUsageLine(howToBase, canonicalName)}\``;

            const helpText = resolveHelpText(baseCmd, lang);
            const tryItLabel = tOr('HELP_TRY_IT', lang, 'Pruébalo así');
            const tryExamples = resolveExamples({ cmd: baseCmd, canonicalName, prefix, usageVariants, subs });
            const cooldownLines = resolveCooldownLines(baseCmd, lang);

            const container = new ContainerBuilder().setAccentColor(Bot.AccentColor);

            const addBlock = (text) => {
                const t = String(text || '').trim();
                if (!t) return;
                container.addTextDisplayComponents(c => c.setContent(t));
            };

            const addSection = (title, body) => {
                const b = String(body || '').trim();
                if (!b) return;
                container.addSeparatorComponents(s => s.setDivider(true));
                container.addTextDisplayComponents(c => c.setContent(`## ${title}\n${b}`));
            };

            addBlock(`# ${tOr('HELP_COMMAND_TITLE', lang, 'Comando')} ${displayName}`);
            addBlock(`> ${desc}`);
            if (helpText) addBlock(helpText);

            addSection(howToLabel, howToLine);
            addSection(tryItLabel, (tryExamples.length ? tryExamples.join('\n') : noneText));
            if (subLines.length && !helpText) addSection(subLabel, subLines.join('\n'));
            addSection(tOr('HELP_ALIASES', lang, 'Aliases'), aliasLine);
            if (cooldownLines) addSection(moxi.translate('HELP_COOLDOWN', lang), cooldownLines.join('\n'));
            addSection(moxi.translate('HELP_CATEGORY', lang), category);
            addSection(botPermLabel, botPermsText);
            addSection(userPermLabel, userPermsText);
            // Nota de sintaxis (como en captura)
            addSection(tOr('HELP_SYNTAX_NOTE', lang, 'Sintaxis'), syntaxNote);

            const webLabel = moxi.translate('HELP_WEB_LABEL', lang) || 'Web';
            let webUrl = moxi.translate('HELP_WEB_URL', lang);
            if (!webUrl || typeof webUrl !== 'string' || !/^https?:\/\//.test(webUrl)) {
                webUrl = 'https://moxilab.net';
            }

            const webButton = new ButtonBuilder()
                .setLabel(webLabel)
                .setStyle(ButtonStyle.Link)
                .setURL(webUrl);

            container
                .addSeparatorComponents(s => s.setDivider(true))
                .addActionRowComponents(row => row.addComponents(webButton))
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c =>
                    c.setContent(`${EMOJIS.copyright} ${Moxi.user.username} • ${new Date().getFullYear()}`)
                );

            return message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
        }
        await helpSlash.messageRun(Moxi, message, args);
    }
};
