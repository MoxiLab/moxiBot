const { ContainerBuilder, MessageFlags } = require('discord.js');
const ms = require('ms');

const moxi = require('../../i18n');
const { Bot } = require('../../Config');
const { EMOJIS } = require('../../Util/emojis');
const { isDiscordOnlyOwner } = require('../../Util/ownerPermissions');
const {
    normalizeId,
    normalizeActions,
    addGlobalBlacklist,
    addGlobalGuildBlacklist,
    removeGlobalBlacklist,
    removeGlobalGuildBlacklist,
    getBlacklistEntry,
    listGlobalBlacklist,
    getBlacklistSettings,
    upsertBlacklistSettings,
} = require('../../Util/blacklistStorage');

function panel({ title, body }) {
    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(c => c.setContent(`# ${title}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(c => c.setContent(body));

    return { content: '', components: [container], flags: MessageFlags.IsComponentsV2 };
}

function parseTargetId(message, raw) {
    const mention = message.mentions?.users?.first?.();
    if (mention?.id) return mention.id;
    return normalizeId(raw);
}

function isUntranslated(key, value) {
    if (value === undefined || value === null) return true;
    const out = String(value || '').trim();
    if (!out) return true;
    if (out === key) return true;
    const withoutNs = String(key).includes(':') ? String(key).split(':').pop() : String(key);
    if (out === withoutNs) return true;
    if (/^i?[A-Z0-9_]+$/.test(out)) return true;
    return false;
}

function normalizeOptionKey(value) {
    if (value === undefined || value === null) return '';
    return String(value)
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function parseOptions(rawArgs) {
    const reasonParts = [];
    let level = null;
    let durationMs = null;
    let actions = null;

    const levelKeys = new Set(['level', 'lvl', 'nivel']);
    const durationKeys = new Set(['dur', 'duracion', 'duration', 'tiempo', 'exp', 'expira', 'expires']);
    const actionKeys = new Set(['action', 'actions', 'accion', 'acciones']);

    for (const token of rawArgs) {
        const text = String(token || '').trim();
        if (!text) continue;
        const match = text.match(/^([a-zA-Z_\-]+)=(.+)$/);
        if (!match) {
            reasonParts.push(text);
            continue;
        }

        const key = normalizeOptionKey(match[1]);
        const value = String(match[2] || '').trim();
        if (!key || !value) {
            reasonParts.push(text);
            continue;
        }

        if (levelKeys.has(key)) {
            const parsed = Number(value);
            if (Number.isFinite(parsed)) level = Math.round(parsed);
            continue;
        }

        if (durationKeys.has(key)) {
            if (/^(perm|perma|permanente|never)$/i.test(value)) {
                durationMs = null;
                continue;
            }
            const parsed = ms(value);
            if (typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0) {
                durationMs = parsed;
                continue;
            }
        }

        if (actionKeys.has(key)) {
            actions = normalizeActions(value);
            continue;
        }

        reasonParts.push(text);
    }

    return {
        reason: reasonParts.join(' ').trim(),
        level,
        durationMs,
        actions,
    };
}

function parseTargetIdByType(message, raw, targetType) {
    if (targetType === 'user') return parseTargetId(message, raw);
    return normalizeId(raw);
}

module.exports = {
    name: 'gblacklist',
    alias: ['globalblacklist', 'gbl', 'blacklistglobal'],
    usage: 'gblacklist add @user [motivo]\ngblacklist remove @user\ngblacklist check @user\ngblacklist list [users|guilds]\ngblacklist guild add <id> [motivo]\ngblacklist guild remove <id>\ngblacklist guild check <id>\ngblacklist log #canal|off\ngblacklist bypass add|remove <user|role|cmd> <valor>',
    Category: (lang = 'es-ES') => moxi.translate('commands:CATEGORY_ROOT', lang),
    description: (lang = 'es-ES') => {
        const key = 'misc:BLACKLIST_GLOBAL_DESC';
        const t = moxi.translate(key, lang);
        return (t && t !== key) ? t : 'Gestiona la blacklist global (owner).';
    },
    cooldown: 5,

    async execute(Moxi, message, args) {
        try {
            const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
            const t = (key, fallback) => {
                const out = moxi.translate(key, lang);
                return isUntranslated(key, out) ? fallback : out;
            };

            const requesterId = message.author?.id;
            const isOwner = await isDiscordOnlyOwner({ client: Moxi, userId: requesterId });
            if (!isOwner) {
                return message.reply(panel({
                    title: t('misc:BLACKLIST_GLOBAL_TITLE', 'Blacklist global'),
                    body: `${EMOJIS.cross} ${t('misc:BLACKLIST_GLOBAL_OWNER_ONLY', 'Solo los owners del bot pueden usar este comando.')}`,
                }));
            }

            const first = String(args[0] || '').trim().toLowerCase();
            if (first === 'log' || first === 'logs') {
                const raw = String(args[1] || '').trim().toLowerCase();
                if (!raw || raw === 'off' || raw === 'clear') {
                    await upsertBlacklistSettings({
                        scope: 'global',
                        patch: { logChannelId: null },
                    });
                    return message.reply(panel({
                        title: t('misc:BLACKLIST_GLOBAL_TITLE', 'Blacklist global'),
                        body: `${EMOJIS.tick} ${t('misc:BLACKLIST_LOG_CLEARED', 'Logs globales desactivados.')}`,
                    }));
                }

                const mentioned = message.mentions?.channels?.first?.();
                const id = mentioned?.id || normalizeId(args[1]);
                if (!id) {
                    return message.reply(panel({
                        title: t('misc:BLACKLIST_GLOBAL_TITLE', 'Blacklist global'),
                        body: `${EMOJIS.cross} ${t('misc:BLACKLIST_USAGE', 'Uso')}: gblacklist log #canal | gblacklist log off`,
                    }));
                }

                await upsertBlacklistSettings({
                    scope: 'global',
                    patch: { logChannelId: id },
                });

                return message.reply(panel({
                    title: t('misc:BLACKLIST_GLOBAL_TITLE', 'Blacklist global'),
                    body: `${EMOJIS.tick} ${t('misc:BLACKLIST_LOG_SET', 'Canal de logs configurado.')}
<#${id}>`,
                }));
            }

            if (first === 'bypass') {
                const action = String(args[1] || 'list').trim().toLowerCase();
                const kind = String(args[2] || 'user').trim().toLowerCase();
                const settings = await getBlacklistSettings({ guildId: message.guild?.id || null });
                const current = settings.global;

                const formatList = () => {
                    const lines = [
                        `Usuarios: ${current.bypassUserIds.length ? current.bypassUserIds.map(id => `<@${id}>`).join(', ') : '-'}`,
                        `Roles: ${current.bypassRoleIds.length ? current.bypassRoleIds.map(id => `<@&${id}>`).join(', ') : '-'}`,
                        `Comandos: ${current.bypassCommands.length ? current.bypassCommands.join(', ') : '-'}`,
                    ];
                    return lines.join('\n');
                };

                if (action === 'list' || action === 'lista') {
                    return message.reply(panel({
                        title: t('misc:BLACKLIST_GLOBAL_TITLE', 'Blacklist global'),
                        body: `${EMOJIS.info || 'ℹ️'} ${t('misc:BLACKLIST_BYPASS_LIST', 'Bypass actual:')}\n${formatList()}`,
                    }));
                }

                const isAdd = action === 'add' || action === 'agregar';
                const isRemove = action === 'remove' || action === 'del' || action === 'rm' || action === 'quitar';
                if (!isAdd && !isRemove) {
                    return message.reply(panel({
                        title: t('misc:BLACKLIST_GLOBAL_TITLE', 'Blacklist global'),
                        body: `${EMOJIS.cross} ${t('misc:BLACKLIST_USAGE', 'Uso')}: gblacklist bypass add|remove <user|role|cmd> <valor>`,
                    }));
                }

                if (kind === 'role' || kind === 'rol') {
                    const role = message.mentions?.roles?.first?.();
                    const roleId = role?.id || normalizeId(args[3]);
                    if (!roleId) {
                        return message.reply(panel({
                            title: t('misc:BLACKLIST_GLOBAL_TITLE', 'Blacklist global'),
                            body: `${EMOJIS.cross} ${t('misc:BLACKLIST_USAGE', 'Uso')}: gblacklist bypass add role @rol`,
                        }));
                    }
                    const next = new Set(current.bypassRoleIds);
                    if (isAdd) next.add(roleId); else next.delete(roleId);
                    await upsertBlacklistSettings({
                        scope: 'global',
                        patch: { bypassRoleIds: Array.from(next) },
                    });
                    return message.reply(panel({
                        title: t('misc:BLACKLIST_GLOBAL_TITLE', 'Blacklist global'),
                        body: `${EMOJIS.tick} ${t('misc:BLACKLIST_BYPASS_UPDATED', 'Bypass actualizado.')}`,
                    }));
                }

                if (kind === 'cmd' || kind === 'command' || kind === 'comando') {
                    const cmd = String(args[3] || '').trim().toLowerCase();
                    if (!cmd) {
                        return message.reply(panel({
                            title: t('misc:BLACKLIST_GLOBAL_TITLE', 'Blacklist global'),
                            body: `${EMOJIS.cross} ${t('misc:BLACKLIST_USAGE', 'Uso')}: gblacklist bypass add cmd <comando>`,
                        }));
                    }
                    const next = new Set(current.bypassCommands);
                    if (isAdd) next.add(cmd); else next.delete(cmd);
                    await upsertBlacklistSettings({
                        scope: 'global',
                        patch: { bypassCommands: Array.from(next) },
                    });
                    return message.reply(panel({
                        title: t('misc:BLACKLIST_GLOBAL_TITLE', 'Blacklist global'),
                        body: `${EMOJIS.tick} ${t('misc:BLACKLIST_BYPASS_UPDATED', 'Bypass actualizado.')}`,
                    }));
                }

                const isExplicitUser = kind === 'user' || kind === 'usuario';
                const targetId = parseTargetId(message, isExplicitUser ? args[3] : args[2]);
                if (!targetId) {
                    return message.reply(panel({
                        title: t('misc:BLACKLIST_GLOBAL_TITLE', 'Blacklist global'),
                        body: `${EMOJIS.cross} ${t('misc:BLACKLIST_USAGE', 'Uso')}: gblacklist bypass add @user`,
                    }));
                }
                const next = new Set(current.bypassUserIds);
                if (isAdd) next.add(targetId); else next.delete(targetId);
                await upsertBlacklistSettings({
                    scope: 'global',
                    patch: { bypassUserIds: Array.from(next) },
                });
                return message.reply(panel({
                    title: t('misc:BLACKLIST_GLOBAL_TITLE', 'Blacklist global'),
                    body: `${EMOJIS.tick} ${t('misc:BLACKLIST_BYPASS_UPDATED', 'Bypass actualizado.')}`,
                }));
            }

            const rawSub = String(args[0] || 'list').trim().toLowerCase();
            let targetType = 'user';
            let sub = rawSub;
            let argOffset = 1;

            if (['guild', 'server', 'servidor'].includes(rawSub)) {
                targetType = 'guild';
                sub = String(args[1] || 'list').trim().toLowerCase();
                argOffset = 2;
            }

            if (sub === 'add' || sub === 'agregar') {
            const targetId = parseTargetIdByType(message, args[argOffset], targetType);
            if (!targetId) {
                return message.reply(panel({
                    title: t('misc:BLACKLIST_GLOBAL_TITLE', 'Blacklist global'),
                    body: `${EMOJIS.cross} ${t('misc:BLACKLIST_USAGE', 'Uso')}: ${this.usage}`,
                }));
            }

            const options = parseOptions(args.slice(argOffset + 1));
            const reason = options.reason;
            const level = (typeof options.level === 'number' && Number.isFinite(options.level)) ? options.level : undefined;
            const durationMs = (typeof options.durationMs === 'number' && Number.isFinite(options.durationMs)) ? options.durationMs : null;
            const actions = Array.isArray(options.actions) ? options.actions : null;

            if (targetType === 'guild') {
                await addGlobalGuildBlacklist({
                    guildId: targetId,
                    reason,
                    createdBy: requesterId,
                    level,
                    durationMs,
                    actions,
                });
            } else {
                await addGlobalBlacklist({
                    userId: targetId,
                    reason,
                    createdBy: requesterId,
                    level,
                    durationMs,
                    actions,
                });
            }

            const extraLines = [];
            if (typeof level === 'number') {
                extraLines.push(`${t('misc:BLACKLIST_LEVEL', 'Nivel')}: ${level}`);
            }
            if (durationMs) {
                const ts = Math.floor((Date.now() + durationMs) / 1000);
                if (ts) extraLines.push(`${t('misc:BLACKLIST_EXPIRES', 'Expira')}: <t:${ts}:R>`);
            }
            if (actions && actions.length && !actions.includes('all')) {
                extraLines.push(`${t('misc:BLACKLIST_ACTIONS', 'Acciones')}: ${actions.join(', ')}`);
            }

            return message.reply(panel({
                title: t('misc:BLACKLIST_GLOBAL_TITLE', 'Blacklist global'),
                body: `${EMOJIS.tick} ${targetType === 'guild'
                    ? t('misc:BLACKLIST_GUILD_ADDED', 'Servidor agregado a la blacklist global.')
                    : t('misc:BLACKLIST_GLOBAL_ADDED', 'Usuario agregado a la blacklist global.')}\n${targetType === 'guild' ? 'Servidor' : 'Usuario'}: ${targetType === 'guild' ? targetId : `<@${targetId}>`}\nID: ${targetId}${reason ? `\n${t('misc:BLACKLIST_REASON', 'Motivo')}: ${reason}` : ''}${extraLines.length ? `\n${extraLines.join('\n')}` : ''}`,
            }));
        }

            if (sub === 'remove' || sub === 'del' || sub === 'rm' || sub === 'quitar') {
            const targetId = parseTargetIdByType(message, args[argOffset], targetType);
            if (!targetId) {
                return message.reply(panel({
                    title: t('misc:BLACKLIST_GLOBAL_TITLE', 'Blacklist global'),
                    body: `${EMOJIS.cross} ${t('misc:BLACKLIST_USAGE', 'Uso')}: ${this.usage}`,
                }));
            }

            const removed = targetType === 'guild'
                ? await removeGlobalGuildBlacklist({ guildId: targetId })
                : await removeGlobalBlacklist({ userId: targetId });

            return message.reply(panel({
                title: t('misc:BLACKLIST_GLOBAL_TITLE', 'Blacklist global'),
                body: removed
                    ? `${EMOJIS.tick} ${targetType === 'guild'
                        ? t('misc:BLACKLIST_GUILD_REMOVED', 'Servidor removido de la blacklist global.')
                        : t('misc:BLACKLIST_GLOBAL_REMOVED', 'Usuario removido de la blacklist global.')}\n${targetType === 'guild' ? 'Servidor' : 'Usuario'}: ${targetType === 'guild' ? targetId : `<@${targetId}>`}\nID: ${targetId}`
                    : `${EMOJIS.info || 'ℹ️'} ${t('misc:BLACKLIST_NOT_FOUND', 'Ese usuario no estaba en la blacklist.')}\n${targetType === 'guild' ? 'Servidor' : 'Usuario'}: ${targetType === 'guild' ? targetId : `<@${targetId}>`}\nID: ${targetId}`,
            }));
        }

            if (sub === 'check' || sub === 'estado') {
            const targetId = parseTargetIdByType(message, args[argOffset], targetType);
            if (!targetId) {
                return message.reply(panel({
                    title: t('misc:BLACKLIST_GLOBAL_TITLE', 'Blacklist global'),
                    body: `${EMOJIS.cross} ${t('misc:BLACKLIST_USAGE', 'Uso')}: ${this.usage}`,
                }));
            }

            const entry = await getBlacklistEntry({
                scope: 'global',
                targetType,
                targetId,
            });
            const isBlocked = Boolean(entry);

            const extraLines = [];
            if (entry?.reason) {
                extraLines.push(`${t('misc:BLACKLIST_REASON', 'Motivo')}: ${entry.reason}`);
            }
            if (typeof entry?.level === 'number') {
                extraLines.push(`${t('misc:BLACKLIST_LEVEL', 'Nivel')}: ${entry.level}`);
            }
            if (entry?.expiresAt) {
                const ts = Math.floor(new Date(entry.expiresAt).getTime() / 1000);
                if (ts) extraLines.push(`${t('misc:BLACKLIST_EXPIRES', 'Expira')}: <t:${ts}:R>`);
            }

            return message.reply(panel({
                title: t('misc:BLACKLIST_GLOBAL_TITLE', 'Blacklist global'),
                body: `${isBlocked ? (EMOJIS.cross || '⛔') : (EMOJIS.tick || '✅')} ${isBlocked
                    ? (targetType === 'guild'
                        ? t('misc:BLACKLIST_GUILD_CHECK_YES', 'El servidor está en blacklist global.')
                        : t('misc:BLACKLIST_GLOBAL_CHECK_YES', 'El usuario está en blacklist global.'))
                    : (targetType === 'guild'
                        ? t('misc:BLACKLIST_GUILD_CHECK_NO', 'El servidor no está en blacklist global.')
                        : t('misc:BLACKLIST_GLOBAL_CHECK_NO', 'El usuario no está en blacklist global.'))}\n${targetType === 'guild' ? 'Servidor' : 'Usuario'}: ${targetType === 'guild' ? targetId : `<@${targetId}>`}\nID: ${targetId}${extraLines.length ? `\n${extraLines.join('\n')}` : ''}`,
            }));
        }

            let listType = targetType;
            if (targetType === 'user' && args[1]) {
                const typeKey = normalizeOptionKey(args[1]);
                if (['guild', 'guilds', 'server', 'servers', 'servidor', 'servidores'].includes(typeKey)) listType = 'guild';
                if (['user', 'users', 'usuario', 'usuarios'].includes(typeKey)) listType = 'user';
            }

            const list = await listGlobalBlacklist({ limit: 30, targetType: listType });
            if (!list.length) {
                const emptyText = listType === 'guild'
                    ? t('misc:BLACKLIST_GUILD_EMPTY', 'No hay servidores en la blacklist.')
                    : t('misc:BLACKLIST_EMPTY', 'No hay usuarios en la blacklist.');
                return message.reply(panel({
                    title: t('misc:BLACKLIST_GLOBAL_TITLE', 'Blacklist global'),
                    body: `${EMOJIS.info || 'ℹ️'} ${emptyText}`,
                }));
            }

            const lines = list.map((entry, index) => {
                const id = String(entry.targetId || entry.userId || '').trim();
                const reason = String(entry.reason || '').trim();
                const reasonPart = reason ? ` — ${reason}` : '';
                const metaParts = [];
                if (typeof entry.level === 'number') metaParts.push(`${t('misc:BLACKLIST_LEVEL', 'Nivel')}: ${entry.level}`);
                if (entry.expiresAt) {
                    const ts = Math.floor(new Date(entry.expiresAt).getTime() / 1000);
                    if (ts) metaParts.push(`${t('misc:BLACKLIST_EXPIRES', 'Expira')}: <t:${ts}:R>`);
                }
                const meta = metaParts.length ? ` (${metaParts.join(' | ')})` : '';
                const label = listType === 'guild' ? `Servidor ${id}` : `<@${id}> (${id})`;
                return `${index + 1}. ${label}${reasonPart}${meta}`;
            });

            return message.reply(panel({
                title: t('misc:BLACKLIST_GLOBAL_TITLE', 'Blacklist global'),
                body: lines.join('\n'),
            }));
        } catch (error) {
            const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
            const t = (key, fallback) => {
                const out = moxi.translate(key, lang);
                return isUntranslated(key, out) ? fallback : out;
            };
            return message.reply(panel({
                title: t('misc:BLACKLIST_GLOBAL_TITLE', 'Blacklist global'),
                body: `${EMOJIS.cross} ${t('misc:BLACKLIST_ERROR', 'No pude ejecutar blacklist. Revisa consola para más detalles.')}`,
            }));
        }
    },
};
