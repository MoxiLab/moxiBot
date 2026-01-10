// Comando de prefijo: help
// Reutiliza la lógica de help.js (slash)

const helpSlash = require('../../Slashcmd/Tools/help.js');

const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const logger = require('../../Util/logger.js');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');

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

module.exports = {
    name: "help",
    alias: ['h', 'commands'],
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_HERRAMIENTAS', lang);
    },
    usage: 'help [comando]',
    description: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CMD_HELP_DESC', lang);
    },
    async execute(Moxi, message, args) {
        const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
        // Si hay argumento, buscar info del comando
        if (args.length > 0) {
            const query = args[0].toLowerCase();
            // Buscar en prefix y slash
            let cmd = Moxi.commands?.get(query) ||
                Array.from(Moxi.commands?.values() || []).find(c => c.alias && c.alias.includes(query)) ||
                Moxi.slashcommands?.get(query) ||
                Array.from(Moxi.slashcommands?.values() || []).find(c => c.alias && c.alias.includes(query));
            if (!cmd) {
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
            // Construir panel tipo ContainerBuilder (estilo ping)
            const { ContainerBuilder, MessageFlags, ButtonBuilder, ButtonStyle } = require('discord.js');
            const { Bot } = require('../../Config');
            const desc = resolveCommandDescription(cmd, lang, query);

            const usage = cmd.usage || moxi.translate('HELP_NO_USAGE', lang);

            const alias = (cmd.alias && cmd.alias.length)
                ? cmd.alias.join(', ')
                : moxi.translate('HELP_NONE', lang);

            const category = (cmd.Category && typeof cmd.Category === 'function')
                ? cmd.Category(lang)
                : (cmd.Category || cmd.category || moxi.translate('HELP_NO_CATEGORY', lang));

            let name = resolveCommandDisplayName(cmd, lang, query);
            let perms = '';
            if (cmd.permissions && (cmd.permissions.User || cmd.permissions.Bot)) {
                perms += cmd.permissions.User ? `${EMOJIS.person} ${moxi.translate('HELP_PERMISSIONS_USER', lang)}: ${cmd.permissions.User.join(', ')}\n` : '';
                perms += cmd.permissions.Bot ? `${EMOJIS.robot} ${moxi.translate('HELP_PERMISSIONS_BOT', lang)}: ${cmd.permissions.Bot.join(', ')}\n` : '';
            } else {
                perms = moxi.translate('HELP_NO_PERMISSIONS', lang);
            }
            const container = new ContainerBuilder()
                .setAccentColor(Bot.AccentColor)
                .addTextDisplayComponents(c =>
                    c.setContent(`# ${EMOJIS.info} ${moxi.translate('HELP_COMMAND_INFO_TITLE', lang, { name })}`)
                )
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c =>
                    c.setContent(`**${moxi.translate('HELP_DESCRIPTION', lang)}:** ${desc}`)
                )
                .addSeparatorComponents(s => s.setDivider(true))
                .addTextDisplayComponents(c =>
                    c.setContent(`${EMOJIS.book} **${moxi.translate('HELP_USAGE', lang)}:** ${usage}`)
                )
                .addTextDisplayComponents(c =>
                    c.setContent(`${EMOJIS.link} **${moxi.translate('HELP_ALIASES', lang)}:** ${alias}`)
                )
                .addTextDisplayComponents(c =>
                    c.setContent(`${EMOJIS.folder} **${moxi.translate('HELP_CATEGORY', lang)}:** ${category}`)
                )
                .addTextDisplayComponents(c =>
                    c.setContent(`${EMOJIS.shield} **${moxi.translate('HELP_PERMISSIONS', lang)}:** ${perms}`)
                )
                .addSeparatorComponents(s => s.setDivider(true));
            const webLabel = moxi.translate('HELP_WEB_LABEL', lang) || 'Web';
            let webUrl = moxi.translate('HELP_WEB_URL', lang);
            if (!webUrl || typeof webUrl !== 'string' || !/^https?:\/\//.test(webUrl)) {
                webUrl = 'https://moxibot.es';
            }
            const webButton = new ButtonBuilder()
                .setLabel(webLabel)
                .setStyle(ButtonStyle.Link)
                .setURL(webUrl);
            container
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
