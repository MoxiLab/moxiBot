const { EmbedBuilder, PermissionsBitField } = require('discord.js');
const moxi = require('../../i18n');
const { buildPermsBrowserMessage } = require('../../Util/permsView');

module.exports = {
    name: 'permiso',
    alias: ['perms'],
    description: 'Edita permisos de canales, roles y miembros.',
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ADMIN', lang);
    },
    usage: 'permiso canales ver | permiso canal <#canal|nombre> ver | permiso canal todos ver | permiso canal <#canal|nombre> <permiso> <permitir|denegar> [@rol|@miembro] | permiso rol <@rol|nombre> ver|añadir|quitar <permiso> | permiso miembro <@miembro> [#canal] <permiso> <permitir|denegar>',
    async execute(Moxi, message, args) {
        if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return message.reply('No tienes permisos de administrador.');
        }
        const guild = message.guild;
        const guildId = message.guildId || guild?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');
        const tipo = (args[0] || '').toLowerCase();
        if (!tipo) return message.reply(`Uso: ${module.exports.usage}`);

        const normalizePermKey = (input) => {
            const raw = (input === undefined || input === null) ? '' : String(input).trim();
            if (!raw) return null;
            // Permitir escribirlo con cualquier casing
            const keys = Object.keys(PermissionsBitField.Flags || {});
            const direct = keys.find(k => k === raw);
            if (direct) return direct;
            const lower = raw.toLowerCase();
            const match = keys.find(k => k.toLowerCase() === lower);
            return match || raw;
        };

        const resolveChannel = (token) => {
            const ch = message.mentions.channels?.first?.();
            if (ch) return ch;
            const t = (token === undefined || token === null) ? '' : String(token).trim();
            if (!t) return null;
            const id = t.replace(/[^0-9]/g, '');
            if (id) return guild.channels.cache.get(id) || null;
            return guild.channels.cache.find(c => c.name === t) || null;
        };

        const resolveRole = (token) => {
            const r = message.mentions.roles?.first?.();
            if (r) return r;
            const t = (token === undefined || token === null) ? '' : String(token).trim();
            if (!t) return null;
            const id = t.replace(/[^0-9]/g, '');
            if (id) return guild.roles.cache.get(id) || null;
            return guild.roles.cache.find(r0 => r0.name === t) || null;
        };

        const resolveMember = (token) => {
            const m = message.mentions.members?.first?.();
            if (m) return m;
            const t = (token === undefined || token === null) ? '' : String(token).trim();
            if (!t) return null;
            const id = t.replace(/[^0-9]/g, '');
            if (id) return guild.members.cache.get(id) || null;

            // Soporte extra: tag/username/nick (ej: Moxi#4134)
            const needle = t.toLowerCase();
            const byTag = guild.members.cache.find(mem => String(mem.user?.tag || '').toLowerCase() === needle);
            if (byTag) return byTag;
            const byUsername = guild.members.cache.find(mem => String(mem.user?.username || '').toLowerCase() === needle);
            if (byUsername) return byUsername;
            const byNick = guild.members.cache.find(mem => String(mem.displayName || '').toLowerCase() === needle);
            if (byNick) return byNick;

            return null;
        };

        const parseAllowDeny = (input) => {
            const v = (input === undefined || input === null) ? '' : String(input).trim().toLowerCase();
            if (!v) return null;
            if (['permitir', 'allow', 'true', 'si', 'sí', 'add', 'añadir'].includes(v)) return true;
            if (['denegar', 'deny', 'false', 'no', 'remove', 'quitar'].includes(v)) return false;
            return null;
        };

        // Visor bonito para TODOS los canales
        if (tipo === 'canales') {
            const accion = (args[1] || '').toLowerCase();
            if (accion !== 'ver') return message.reply(`Uso: ${module.exports.usage}`);
            const payload = buildPermsBrowserMessage({ guild, userId: message.author.id, lang, page: 0 });
            await message.reply(payload);
            return;
        }

        if (tipo === 'canal') {
            // Alias: `.permiso canal todos ver`
            if (['todos', 'todo', 'all'].includes((args[1] || '').toLowerCase())) {
                const accion = (args[2] || '').toLowerCase();
                if (accion !== 'ver') return message.reply(`Uso: ${module.exports.usage}`);
                const payload = buildPermsBrowserMessage({ guild, userId: message.author.id, lang, page: 0 });
                await message.reply(payload);
                return;
            }

            const canalToken = args[1];
            const actionOrPerm = (args[2] || '').toLowerCase();
            const canal = resolveChannel(canalToken);
            if (!canal) return message.reply('No se encontró el canal (prueba #canal o el nombre exacto).');

            if (actionOrPerm === 'ver') {
                const describeTarget = (po) => {
                    if (po.id === guild.id) return '@everyone';
                    const role = guild.roles.cache.get(po.id);
                    if (role) return `@${role.name}`;
                    const member = guild.members.cache.get(po.id);
                    if (member) return `@${member.user.tag}`;
                    return po.id;
                };

                const fmt = (arr) => (arr && arr.length ? arr.join(', ') : '—');
                const classify = (po) => {
                    if (po.id === guild.id) return 0; // everyone
                    if (guild.roles.cache.has(po.id)) return 1; // role
                    if (guild.members.cache.has(po.id)) return 2; // member
                    return 3;
                };

                const entries = canal.permissionOverwrites.cache
                    .map(po => ({
                        po,
                        who: describeTarget(po),
                        allow: fmt(po.allow.toArray()),
                        deny: fmt(po.deny.toArray()),
                        kind: classify(po)
                    }))
                    .sort((a, b) => {
                        if (a.kind !== b.kind) return a.kind - b.kind;
                        return a.who.localeCompare(b.who, 'es', { sensitivity: 'base' });
                    });

                let description = entries
                    .map(e => `${e.who}\n  ALLOW: ${e.allow}\n  DENY:  ${e.deny}`)
                    .join('\n\n');

                // Embed description max: 4096
                if (description.length > 3900) description = `${description.slice(0, 3900)}\n\n...`;

                const embed = new EmbedBuilder()
                    .setTitle(`Permisos: #${canal.name}`)
                    .setDescription(description)
                    .setColor(0x5865F2);

                return message.reply({ embeds: [embed] });
            }

            const permKey = normalizePermKey(args[2]);
            const allow = parseAllowDeny(args[3]);
            if (!permKey || allow === null) return message.reply(`Uso: ${module.exports.usage}`);

            // Target opcional: @rol o @miembro. Por defecto: @everyone.
            const targetRole = message.mentions.roles?.first?.();
            const targetMember = message.mentions.members?.first?.();
            const target = targetRole || targetMember || guild.id;

            await canal.permissionOverwrites.edit(target, { [permKey]: allow });
            const who = targetRole ? `rol ${targetRole.name}` : (targetMember ? `miembro ${targetMember.user.tag}` : '@everyone');
            return message.reply(`Permiso ${permKey} ${allow ? 'permitido' : 'denegado'} en #${canal.name} para ${who}.`);
        }

        if (tipo === 'rol') {
            const rolToken = args[1];
            const accion = (args[2] || '').toLowerCase();
            const permKey = normalizePermKey(args[3]);
            const rol = resolveRole(rolToken);
            if (!rol) {
                const raw = (rolToken === undefined || rolToken === null) ? '' : String(rolToken).trim();
                const id = raw.replace(/[^0-9]/g, '');
                const member = id ? (guild.members.cache.get(id) || null) : null;
                if (member) {
                    return message.reply(
                        `Ese ID parece de un usuario (${member.user.tag}), no de un rol.\n` +
                        `- Para ver permisos de un rol: \`.permiso rol @NombreDelRol ver\` o \`.permiso rol <@&ID_DEL_ROL> ver\`\n` +
                        `- Para un usuario: \`.permiso miembro @usuario <permiso> <permitir|denegar>\``
                    );
                }
                return message.reply('No se encontró el rol (usa @rol, `<@&ID_DEL_ROL>` o la ID del rol).');
            }

            if (accion === 'ver') {
                return message.reply(`Permisos del rol ${rol.name}: ${rol.permissions.toArray().join(', ')}`);
            }
            if (accion !== 'añadir' && accion !== 'quitar') {
                return message.reply(`Uso: ${module.exports.usage}`);
            }
            if (!permKey) return message.reply('Debes indicar el permiso.');

            const current = new Set(rol.permissions.toArray());
            if (accion === 'añadir') current.add(permKey);
            if (accion === 'quitar') current.delete(permKey);
            await rol.setPermissions(Array.from(current));
            return message.reply(`Permiso ${permKey} ${accion === 'añadir' ? 'añadido' : 'quitado'} al rol ${rol.name}.`);
        }

        if (tipo === 'miembro') {
            // Sintaxis:
            // permiso miembro @user <perm> <permitir|denegar>
            // permiso miembro @user #canal <perm> <permitir|denegar>
            const miembro = resolveMember(args[1]);
            if (!miembro) {
                return message.reply(
                    'No encontré al miembro. Usa una mención @usuario o escribe su ID.\n' +
                    'Ejemplos: ` .permiso miembro @Moxi #github SendMessages permitir ` o ` .permiso miembro 123456789012345678 ViewChannel denegar `'
                );
            }

            let offset = 2;
            let canal = message.channel;
            // Si el siguiente token parece canal, úsalo
            if (args[2] && (String(args[2]).includes('<#') || /^\d+$/.test(String(args[2])))) {
                const maybe = resolveChannel(args[2]);
                if (maybe) {
                    canal = maybe;
                    offset = 3;
                }
            }

            const permKey = normalizePermKey(args[offset]);
            const allow = parseAllowDeny(args[offset + 1]);
            if (!permKey || allow === null) return message.reply(`Uso: ${module.exports.usage}`);

            await canal.permissionOverwrites.edit(miembro, { [permKey]: allow });
            return message.reply(`Permiso ${permKey} ${allow ? 'permitido' : 'denegado'} en #${canal.name} para ${miembro.user.tag}.`);
        }

        return message.reply(`Uso: ${module.exports.usage}`);
    }
};