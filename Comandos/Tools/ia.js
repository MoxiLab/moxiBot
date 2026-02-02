const { MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { setAiEnabled, isAiEnabled, getAiConfig, updateAiConfig } = require('../../Util/aiModeStorage');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { isOwnerWithClient } = require('../../Util/ownerPermissions');

module.exports = {
    name: 'ia',
    alias: ['ia', 'ai'],
    Category: (lang = 'es-ES') => moxi.translate('commands:CATEGORY_HERRAMIENTAS', lang),
    usage: 'ia <on|off|status|prompt|model|temp|cooldown|ownersonly>',
    description: (lang = 'es-ES') => moxi.translate('commands:CMD_IA_DESC', lang) || 'Activa o desactiva el modo IA en este canal',

    async execute(Moxi, message, args) {
        if (!message.inGuild?.() || !message.guild) return;

        // Solo owners: evita que cualquiera active/desactive IA.
        try {
            const guildOwnerId = message.guild?.ownerId || message.guild?.owner?.id || null;
            const ok = await isOwnerWithClient({ client: Moxi, userId: message.author?.id, guildOwnerId });
            if (!ok) {
                return replyNotice({
                    accentColor: 0xFF6B6B,
                    title: 'Sin permisos',
                    lines: ['Este comando es solo para owners del bot.'],
                });
            }
        } catch {
            return replyNotice({
                accentColor: 0xFF6B6B,
                title: 'Sin permisos',
                lines: ['Este comando es solo para owners del bot.'],
            });
        }

        const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
        const sub = String(args?.[0] || 'status').trim().toLowerCase();
        const sub2 = String(args?.[1] || '').trim().toLowerCase();

        const replyNotice = async ({ title, lines, accentColor }) => {
            const container = buildNoticeContainer({
                accentColor,
                title,
                text: Array.isArray(lines) ? lines.filter(Boolean).join('\n') : String(lines || ''),
            });
            const payload = asV2MessageOptions(container);
            payload.allowedMentions = { repliedUser: false, parse: [] };
            return message.reply(payload).catch(() => null);
        };

        const requireKey = () => {
            const hasKey = typeof process.env.OPENAI_API_KEY === 'string' && process.env.OPENAI_API_KEY.trim();
            if (hasKey) return true;
            replyNotice({
                accentColor: 0xFF6B6B,
                title: 'IA no configurada',
                lines: [
                    'Falta `OPENAI_API_KEY` en el `.env`.',
                    'Añádela y reinicia el bot.',
                ],
            });
            return false;
        };

        if (sub === 'on' || sub === 'enable' || sub === '1') {
            if (!requireKey()) return;
            const res = await setAiEnabled(message.guild.id, message.channel.id, true, { userId: message.author?.id });
            if (!res.ok) return;
            return replyNotice({
                title: 'Modo IA activado',
                lines: [
                    'A partir de ahora responderé automáticamente en este canal.',
                    'Usa `.ia off` para desactivarlo.',
                ],
            });
        }

        if (sub === 'off' || sub === 'disable' || sub === '0') {
            const res = await setAiEnabled(message.guild.id, message.channel.id, false, { userId: message.author?.id });
            if (!res.ok) return;
            return replyNotice({
                title: 'Modo IA desactivado',
                lines: ['Ya no responderé automáticamente en este canal.'],
            });
        }

        if (sub === 'prompt' || sub === 'system' || sub === 'personality') {
            const action = sub2 || 'show';
            if (action === 'set' || action === 'add') {
                const text = String(args.slice(2).join(' ') || '').trim();
                if (!text) {
                    return replyNotice({
                        accentColor: 0xFFB703,
                        title: 'Prompt vacío',
                        lines: ['Uso: `.ia prompt set <texto>`'],
                    });
                }
                await updateAiConfig(message.guild.id, message.channel.id, { systemPrompt: text }, { userId: message.author?.id });
                return replyNotice({
                    title: 'Prompt actualizado',
                    lines: ['He guardado el prompt de sistema para este canal.', 'Usa `.ia prompt show` para verlo.'],
                });
            }
            if (action === 'clear' || action === 'reset' || action === 'off') {
                await updateAiConfig(message.guild.id, message.channel.id, { systemPrompt: '' }, { userId: message.author?.id });
                return replyNotice({
                    title: 'Prompt eliminado',
                    lines: ['He borrado el prompt personalizado de este canal.'],
                });
            }

            const cfg = await getAiConfig(message.guild.id, message.channel.id);
            const prompt = cfg?.config?.systemPrompt ? String(cfg.config.systemPrompt) : '';
            return replyNotice({
                title: 'Prompt (canal)',
                lines: [
                    prompt ? prompt.slice(0, 900) : 'No hay prompt personalizado (se usa el default).',
                    'Comandos: `.ia prompt set <texto>`, `.ia prompt clear`, `.ia prompt show`',
                ],
            });
        }

        if (sub === 'model') {
            const action = sub2 || 'show';
            if (action === 'set') {
                const model = String(args?.[2] || '').trim();
                if (!model) {
                    return replyNotice({
                        accentColor: 0xFFB703,
                        title: 'Modelo vacío',
                        lines: ['Uso: `.ia model set <modelo>`'],
                    });
                }
                await updateAiConfig(message.guild.id, message.channel.id, { model }, { userId: message.author?.id });
                return replyNotice({
                    title: 'Modelo actualizado',
                    lines: [`Modelo del canal: **${model}**`],
                });
            }
            if (action === 'clear' || action === 'reset') {
                await updateAiConfig(message.guild.id, message.channel.id, { model: '' }, { userId: message.author?.id });
                return replyNotice({
                    title: 'Modelo restablecido',
                    lines: ['Se volverá a usar `OPENAI_MODEL` o el default.'],
                });
            }

            const cfg = await getAiConfig(message.guild.id, message.channel.id);
            return replyNotice({
                title: 'Modelo (canal)',
                lines: [
                    `Modelo: **${cfg?.config?.model || 'gpt-4o-mini'}**`,
                    'Comandos: `.ia model set <modelo>`, `.ia model clear`',
                ],
            });
        }

        if (sub === 'temp' || sub === 'temperature') {
            const action = sub2 || 'show';
            if (action === 'set') {
                const raw = args?.[2];
                const t = Number(raw);
                if (!Number.isFinite(t) || t < 0 || t > 2) {
                    return replyNotice({
                        accentColor: 0xFFB703,
                        title: 'Temperatura inválida',
                        lines: ['Uso: `.ia temp set <0..2>` (ej: `.ia temp set 0.7`)'],
                    });
                }
                await updateAiConfig(message.guild.id, message.channel.id, { temperature: t }, { userId: message.author?.id });
                return replyNotice({
                    title: 'Temperatura actualizada',
                    lines: [`Temperatura del canal: **${t}**`],
                });
            }
            if (action === 'clear' || action === 'reset') {
                await updateAiConfig(message.guild.id, message.channel.id, { temperature: null }, { userId: message.author?.id });
                return replyNotice({
                    title: 'Temperatura restablecida',
                    lines: ['Se volverá a usar `OPENAI_TEMPERATURE` o el default.'],
                });
            }
            const cfg = await getAiConfig(message.guild.id, message.channel.id);
            return replyNotice({
                title: 'Temperatura (canal)',
                lines: [`Temperatura: **${String(cfg?.config?.temperature ?? 0.7)}**`, 'Comandos: `.ia temp set <0..2>`, `.ia temp clear`'],
            });
        }

        if (sub === 'cooldown') {
            const action = sub2 || 'show';
            if (action === 'set') {
                const raw = args?.[2];
                const ms = Number(raw);
                if (!Number.isFinite(ms) || ms < 250 || ms > 10 * 60 * 1000) {
                    return replyNotice({
                        accentColor: 0xFFB703,
                        title: 'Cooldown inválido',
                        lines: ['Uso: `.ia cooldown set <ms>` (250..600000)'],
                    });
                }
                await updateAiConfig(message.guild.id, message.channel.id, { cooldownMs: Math.trunc(ms) }, { userId: message.author?.id });
                return replyNotice({
                    title: 'Cooldown actualizado',
                    lines: [`Cooldown del canal: **${Math.trunc(ms)}ms**`],
                });
            }
            if (action === 'clear' || action === 'reset') {
                await updateAiConfig(message.guild.id, message.channel.id, { cooldownMs: null }, { userId: message.author?.id });
                return replyNotice({
                    title: 'Cooldown restablecido',
                    lines: ['Se volverá a usar `AI_COOLDOWN_MS` o el default.'],
                });
            }
            const cfg = await getAiConfig(message.guild.id, message.channel.id);
            return replyNotice({
                title: 'Cooldown (canal)',
                lines: [`Cooldown: **${String(cfg?.config?.cooldownMs ?? 5000)}ms**`, 'Comandos: `.ia cooldown set <ms>`, `.ia cooldown clear`'],
            });
        }

        if (sub === 'ownersonly' || sub === 'owners') {
            const action = sub2 || 'show';
            if (action === 'on' || action === 'enable' || action === '1' || action === 'true') {
                await updateAiConfig(message.guild.id, message.channel.id, { ownersOnly: true }, { userId: message.author?.id });
                return replyNotice({
                    title: 'Owners-only activado',
                    lines: ['La IA solo responderá a owners en este canal.'],
                });
            }
            if (action === 'off' || action === 'disable' || action === '0' || action === 'false') {
                await updateAiConfig(message.guild.id, message.channel.id, { ownersOnly: false }, { userId: message.author?.id });
                return replyNotice({
                    title: 'Owners-only desactivado',
                    lines: ['La IA podrá responder a cualquier usuario (si el canal está ON).'],
                });
            }
            const cfg = await getAiConfig(message.guild.id, message.channel.id);
            return replyNotice({
                title: 'Owners-only (canal)',
                lines: [`Owners-only: **${cfg?.config?.ownersOnly ? 'ON' : 'OFF'}**`, 'Comandos: `.ia ownersonly on`, `.ia ownersonly off`'],
            });
        }

        // status
        const enabled = await isAiEnabled(message.guild.id, message.channel.id);
        const cfg = await getAiConfig(message.guild.id, message.channel.id);
        return replyNotice({
            title: 'Estado de IA (canal)',
            lines: [
                `Estado: **${enabled ? 'ON' : 'OFF'}**`,
                `Owners-only: **${cfg?.config?.ownersOnly ? 'ON' : 'OFF'}**`,
                `Modelo: **${cfg?.config?.model || 'gpt-4o-mini'}**`,
                'Comandos: `.ia on`, `.ia off`, `.ia status`',
                'Personalización: `.ia prompt ...`, `.ia model ...`, `.ia temp ...`, `.ia cooldown ...`, `.ia ownersonly ...`',
            ],
        });
    },
};
