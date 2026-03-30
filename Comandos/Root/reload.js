const { ContainerBuilder, MessageFlags } = require('discord.js');

const fs = require('node:fs');
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

function countCachedModules(modulePaths) {
    let count = 0;
    for (const p of modulePaths) {
        const resolved = safeRequireResolve(p);
        if (resolved && require.cache[resolved]) count += 1;
    }
    return count;
}

function isRunningUnderNodemon() {
    if (Boolean(process.env.nodemon)) return true;
    if (String(process.env.NODEMON || '').toLowerCase() === 'true') return true;
    if (process.env.npm_lifecycle_event === 'dev') return true;
    if (/nodemon/i.test(String(process.env.npm_lifecycle_script || ''))) return true;
    if (/nodemon/i.test(process.argv.join(' '))) return true;
    return false;
}

function touchNodemonRestartFile() {
    // En Windows, SIGUSR2 no funciona; nodemon reinicia al detectar cambios en archivos.
    // Tocamos un archivo dentro del workspace para forzar un restart inmediato.
    try {
        const workspaceRoot = path.resolve(__dirname, '..', '..');
        const restartFile = path.join(workspaceRoot, '.nodemon-restart');
        fs.writeFileSync(restartFile, String(Date.now()), { encoding: 'utf8' });
        return true;
    } catch {
        return false;
    }
}

function requestProcessRestart() {
    // 1) En dev (nodemon): forzamos restart tocando un archivo observado.
    if (isRunningUnderNodemon()) {
        const ok = touchNodemonRestartFile();
        if (ok) return true;
    }

    // 2) En producción (Pterodactyl/PM2/docker): salir con código 0 suele provocar reinicio.
    setTimeout(() => process.exit(0), 250);
    return true;
}

module.exports = {
    name: 'reload',
    alias: ['rl', 'recargar'],
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ROOT', lang);
    },
    usage: 'reload [commands|slash|events|interacciones|restart|restartall|all]',
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

        // Nota importante:
        // - "events" recarga TODOS los event files (los 81) reiniciando shard(s) (forma segura)
        // - "interacciones" recarga SOLO handlers de botones/menús/modales (rápido y sin duplicar listeners)
        const doRestart = scope === 'restart' || scope === 'reboot' || scope === 'reiniciar' || scope === 'restartshard' || scope === 'shardrestart';
        const doRestartAll = scope === 'restartall' || scope === 'rebootall' || scope === 'reiniciartodo' || scope === 'restartshards' || scope === 'shardsrestart';
        const doControllers = scope === 'controllers' || scope === 'controller' || scope === 'ctrl'
            || scope === 'interacciones' || scope === 'interaccion'
            || scope === 'interactions' || scope === 'interaction'
            || scope === 'buttons' || scope === 'botones'
            || scope === 'menus' || scope === 'menues' || scope === 'select' || scope === 'selectmenu'
            || scope === 'modals' || scope === 'modal';
        const doEventsAll = scope === 'events' || scope === 'eventos' || scope === 'ev' || scope === 'eventsall' || scope === 'eventosall';
        const doCommands = scope === 'all' || scope === 'commands' || scope === 'cmd' || scope === 'comandos';
        const doSlash = scope === 'all' || scope === 'slash' || scope === 'slashcommands' || scope === 'sc';
        const doEvents = scope === 'all' || doControllers;
        const doLoadCommands = doCommands || doSlash;

        const before = {
            commands: Moxi.commands?.size ?? 0,
            slash: Moxi.slashcommands?.size ?? 0,
        };

        const totalEventFiles = getFiles('Eventos')?.length ?? 0;
        const totalControllerFiles = getFiles(path.join('Eventos', 'InteractionCreate', 'controllers'))?.length ?? 0;

        const startedAt = Date.now();

        let purgedCommands = { purged: 0, files: 0 };
        let purgedSlash = { purged: 0, files: 0 };
        let purgedEvents = { purged: 0, files: 0 };
        let loadedControllers = { ok: 0, total: 0 };
        let cachedHandlersBefore = 0;
        let cachedHandlersAfter = 0;

        try {
            const shouldRestartAll = scope === 'all' || doRestartAll || doEventsAll;
            const shouldRestartOne = doRestart;

            if (shouldRestartOne || shouldRestartAll) {
                const title = t('RELOAD_TITLE', '🔁 Reload');
                const mode = shouldRestartAll ? 'restartall' : 'restart';

                // Si el usuario usa "reload" (scope all), mostramos también el resumen de comandos
                // y luego reiniciamos para aplicar TODOS los eventos.
                let softReloadMs = null;
                let after = { ...before };
                if (scope === 'all') {
                    const softStart = Date.now();

                    purgedCommands = purgeTreeCache('Comandos');
                    purgedSlash = purgeTreeCache('Slashcmd');

                    const warm = [
                        path.join(__dirname, '..', '..', 'Eventos', 'InteractionCreate', 'controllers', 'button.js'),
                        path.join(__dirname, '..', '..', 'Eventos', 'InteractionCreate', 'controllers', 'selectMenu.js'),
                        path.join(__dirname, '..', '..', 'Eventos', 'InteractionCreate', 'controllers', 'modals'),
                    ];

                    cachedHandlersBefore = countCachedModules(warm);

                    purgedEvents = purgeTreeCache(path.join('Eventos', 'InteractionCreate', 'controllers'));
                    purgeRequireCache(path.join(__dirname, '..', '..', 'Util', 'serversPanel.js'));

                    loadedControllers.total = warm.length;
                    for (const p of warm) {
                        require(p);
                        loadedControllers.ok += 1;
                    }

                    cachedHandlersAfter = loadedControllers.ok;

                    purgeRequireCache(path.join(__dirname, '..', '..', 'Handlers', 'commands.js'));
                    const loadCommands = require('../../Handlers/commands.js');
                    await loadCommands(Moxi);

                    after = {
                        commands: Moxi.commands?.size ?? 0,
                        slash: Moxi.slashcommands?.size ?? 0,
                    };

                    softReloadMs = Date.now() - softStart;
                }

                const lines = [
                    `# ${title}`,
                    `🧨 Modo: **${mode}**`,
                    softReloadMs !== null ? `✅ Recarga completada en **${softReloadMs}ms**` : null,
                    '',
                    '> Resumen',
                    `> » 🧩 Scope: **${scope}**`,
                    `> » 🧰 Prefix: **${before.commands} → ${after.commands}**${softReloadMs !== null ? ` (purged ${purgedCommands.purged}/${purgedCommands.files})` : ''}`,
                    `> » ⚡ Slash (memoria): **${before.slash} → ${after.slash}**${softReloadMs !== null ? ` (purged ${purgedSlash.purged}/${purgedSlash.files})` : ''}`,
                    `> » 🍕 Events (memoria): **${totalEventFiles} → ${totalEventFiles}**${softReloadMs !== null ? ` (purged ${purgedEvents.purged}/${purgedEvents.files})` : ''}`,
                    softReloadMs !== null
                        ? `> » 🎛️ Controllers (memoria): **${totalControllerFiles} → ${totalControllerFiles}** (purged ${purgedEvents.purged}/${purgedEvents.files})`
                        : null,
                    softReloadMs !== null
                        ? `> » 🔧 Handlers (memoria): **${cachedHandlersBefore} → ${cachedHandlersAfter}** (loaded ${loadedControllers.ok}/${loadedControllers.total})`
                        : null,
                ].filter(Boolean);
                const container = new ContainerBuilder()
                    .setAccentColor(Bot.AccentColor)
                    .addTextDisplayComponents((c) => c.setContent(lines.join('\n')));

                await message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });

                setTimeout(async () => {
                    try {
                        if (shouldRestartAll && Moxi?.shard && typeof Moxi.shard.broadcastEval === 'function') {
                            await Moxi.shard.broadcastEval(() => {
                                setTimeout(() => process.exit(0), 250);
                                return true;
                            });
                            return;
                        }
                    } catch { } 
                    requestProcessRestart();
                }, 600);

                return;
            }

            if (doCommands) purgedCommands = purgeTreeCache('Comandos');
            if (doSlash) purgedSlash = purgeTreeCache('Slashcmd');
            if (doEvents) {
                const warm = [
                    path.join(__dirname, '..', '..', 'Eventos', 'InteractionCreate', 'controllers', 'button.js'),
                    path.join(__dirname, '..', '..', 'Eventos', 'InteractionCreate', 'controllers', 'selectMenu.js'),
                    path.join(__dirname, '..', '..', 'Eventos', 'InteractionCreate', 'controllers', 'modals'),
                ];

                cachedHandlersBefore = countCachedModules(warm);

                purgedEvents = purgeTreeCache(path.join('Eventos', 'InteractionCreate', 'controllers'));
                purgeRequireCache(path.join(__dirname, '..', '..', 'Util', 'serversPanel.js'));

                loadedControllers.total = warm.length;
                for (const p of warm) {
                    try {
                        require(p);
                        loadedControllers.ok += 1;
                    } catch (err) {
                        throw err;
                    }
                }

                cachedHandlersAfter = loadedControllers.ok;
            }

            if (doLoadCommands) {
                purgeRequireCache(path.join(__dirname, '..', '..', 'Handlers', 'commands.js'));

                const loadCommands = require('../../Handlers/commands.js');
                await loadCommands(Moxi);
            }

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
                `» 🍕 Events (memoria): **${totalEventFiles} → ${totalEventFiles}**${doEvents ? ` (purged ${purgedEvents.purged}/${purgedEvents.files})` : ''}`,
                doEvents
                    ? `» 🎛️ Controllers (memoria): **${totalControllerFiles} → ${totalControllerFiles}** (purged ${purgedEvents.purged}/${purgedEvents.files})`
                    : null,
                doEvents ? `» 🔧 Handlers (memoria): **${cachedHandlersBefore} → ${cachedHandlersAfter}** (loaded ${loadedControllers.ok}/${loadedControllers.total})` : null,
                doEvents && purgedEvents.purged === 0 ? 'ℹ️ Nota: purged 0 significa que esos controllers no estaban en memoria (normal tras reinicio o si aún no se han usado interacciones).' : null,
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
