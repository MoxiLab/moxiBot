const { ContainerBuilder, MessageFlags } = require('discord.js');

const path = require('node:path');

const { Bot } = require('../../Config.js');
const moxi = require('../../i18n.js');
const debugHelper = require('../../Util/debugHelper.js');
const { ownerPermissions } = require('../../Util/ownerPermissions.js');
const { getFiles } = require('../../Handlers/getFiles.js');

function safeRequireResolve(p) {
    try {
        return require.resolve(p);
    } catch {
        return null;
    }
}

function purgeRequireCache(filePath) {
    const resolved = safeRequireResolve(filePath);
    if (!resolved) return false;
    if (require.cache[resolved]) {
        delete require.cache[resolved];
        return true;
    }
    return false;
}

function purgeTreeCache(dirName) {
    let purged = 0;
    const files = getFiles(dirName);
    for (const f of files) {
        if (purgeRequireCache(f)) purged += 1;
    }
    return { purged, files: files.length };
}

module.exports = {
    name: 'reload',
    alias: ['rl', 'recargar'],
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ROOT', lang);
    },
    usage: 'reload [commands|slash|events|all]',
    description: (lang = 'es-ES') =>
        (moxi.translate('RELOAD_CMD_DESC', lang) !== 'RELOAD_CMD_DESC'
            ? moxi.translate('RELOAD_CMD_DESC', lang)
            : 'Recarga comandos en caliente (solo owners)'),

    async execute(Moxi, message, args) {
        const requesterId = message.author?.id;
        debugHelper.log('reload', 'command start', { requesterId, args });

        const fakeInteraction = {
            user: message.author,
            memberPermissions: message.member?.permissions,
            guild: message.guild,
        };

        const isOwner = await ownerPermissions(fakeInteraction, Moxi);
        if (!isOwner) {
            return message.reply('Solo los owners pueden usar este comando.');
        }

        const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
        const t = (key, fallback) => {
            const out = moxi.translate(key, lang);
            return out && out !== key ? out : fallback;
        };

        const scope = String(args?.[0] || 'all').trim().toLowerCase();
        const doCommands = scope === 'all' || scope === 'commands' || scope === 'cmd' || scope === 'comandos';
        const doSlash = scope === 'all' || scope === 'slash' || scope === 'slashcommands' || scope === 'sc';
        const doEvents = scope === 'all' || scope === 'events' || scope === 'eventos' || scope === 'ev';

        const before = {
            commands: Moxi.commands?.size ?? 0,
            slash: Moxi.slashcommands?.size ?? 0,
        };

        const startedAt = Date.now();

        let purgedCommands = { purged: 0, files: 0 };
        let purgedSlash = { purged: 0, files: 0 };
        let purgedEvents = { purged: 0, files: 0 };

        try {
            if (doCommands) purgedCommands = purgeTreeCache('Comandos');
            if (doSlash) purgedSlash = purgeTreeCache('Slashcmd');
            if (doEvents) {
                purgedEvents = purgeTreeCache(path.join('Eventos', 'InteractionCreate', 'controllers'));
                purgeRequireCache(path.join(__dirname, '..', '..', 'Util', 'serversPanel.js'));
            }

            // Recargar el loader de comandos (también reconstruye Moxi.commands y Moxi.slashcommands)
            // Nota: el loader siempre recorre Comandos y Slashcmd, así que es seguro llamarlo 1 vez.
            purgeRequireCache(path.join(__dirname, '..', '..', 'Handlers', 'commands.js'));

            const loadCommands = require('../../Handlers/commands.js');
            await loadCommands(Moxi);

            const after = {
                commands: Moxi.commands?.size ?? 0,
                slash: Moxi.slashcommands?.size ?? 0,
            };

            const ms = Date.now() - startedAt;

            const lines = [
                `# ${t('RELOAD_TITLE', '🔁 Reload')}`,
                `✅ ${t('RELOAD_DONE', 'Recarga completada')} en **${ms}ms**`,
                '',
                `> ${t('RELOAD_SUMMARY', 'Resumen')}`,
                `» 🧩 Scope: **${scope}**`,
                `» 🧰 Prefix: **${before.commands} → ${after.commands}** (purged ${purgedCommands.purged}/${purgedCommands.files})`,
                `» ⚡ Slash (memoria): **${before.slash} → ${after.slash}** (purged ${purgedSlash.purged}/${purgedSlash.files})`,
                doEvents ? `» 🧠 Events/controllers: purged **${purgedEvents.purged}/${purgedEvents.files}**` : null,
                '',
                `ℹ️ ${t('RELOAD_NOTE', 'Esto recarga los módulos en memoria. Para reflejar nuevos slash commands en Discord, ejecuta el deploy (deploy-commands.js) o habilita AUTO_DEPLOY_SLASH.')}`,
            ];

            const container = new ContainerBuilder()
                .setAccentColor(Bot.AccentColor)
                .addTextDisplayComponents((c) => c.setContent(lines.filter(Boolean).join('\n')));

            return message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
        } catch (err) {
            const ms = Date.now() - startedAt;
            const text = err?.stack || err?.message || String(err);

            const container = new ContainerBuilder()
                .setAccentColor(0xff5555)
                .addTextDisplayComponents((c) =>
                    c.setContent(
                        `# ${t('RELOAD_TITLE', '🔁 Reload')}\n❌ ${t('RELOAD_FAILED', 'Falló la recarga')} (${ms}ms)\n\n\`\`\`\n${text.slice(0, 1800)}\n\`\`\``
                    )
                );

            return message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
        }
    },
};
