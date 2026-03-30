const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { isDiscordOnlyOwner } = require('../../Util/ownerPermissions');
const { toolsCategory } = require('../../Util/commandCategories');
const { parseDurationMs, grantPremium, revokePremium, getPremiumStatus } = require('../../Util/premium');

function safeStr(x) {
  return String(x ?? '').trim();
}

function pickUserIdFromMessage(message, args) {
  const mention = message.mentions?.users?.first?.();
  if (mention?.id) return mention.id;
  const raw = safeStr(args?.[0]);
  const m = raw.match(/^(?:<@!?)?(\d{10,})(?:>)?$/);
  return m ? m[1] : null;
}

function buildStatusLine(userId, st) {
  if (!st?.ok) return 'No se pudo consultar el estado premium.';
  if (!st.active) return `<@${userId}> no es premium.`;
  const tier = safeStr(st.tier || 'premium');
  const exp = st.expiresAtMs === null ? 'LIFETIME' : `<t:${Math.floor(st.expiresAtMs / 1000)}:R>`;
  return `<@${userId}> es premium (**${tier}**) • Expira: **${exp}**`;
}

module.exports = {
  name: 'premium',
  alias: ['vip', 'prem'],
  Category: toolsCategory,
  usage: 'premium me | premium check @user | premium add @user [duracion] [tier] | premium remove @user',
  description: 'Sistema de usuarios premium',
  cooldown: 3,
  permissions: {
    Bot: ['Ver canal', 'Enviar mensajes'],
    User: [],
  },
  command: {
    prefix: true,
    slash: false,
    ephemeral: false,
  },

  async execute(Moxi, message, args) {
    const guildId = message.guildId || message.guild?.id;
    const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

    const sub = safeStr(args?.[0]).toLowerCase();
    const rest = Array.isArray(args) ? args.slice(1) : [];

    if (!sub || sub === 'me') {
      const st = await getPremiumStatus(message.author?.id);
      return message.reply(
        asV2MessageOptions(
          buildNoticeContainer({
            emoji: '💎',
            title: 'Premium',
            text: buildStatusLine(message.author?.id, st),
          })
        )
      );
    }

    if (sub === 'check' || sub === 'status') {
      const userId = pickUserIdFromMessage(message, rest);
      if (!userId) {
        return message.reply(
          asV2MessageOptions(
            buildNoticeContainer({
              emoji: EMOJIS.warn || '⚠️',
              title: 'Falta usuario',
              text: 'Uso: `.premium check @usuario`',
            })
          )
        );
      }
      const st = await getPremiumStatus(userId);
      return message.reply(
        asV2MessageOptions(
          buildNoticeContainer({
            emoji: '💎',
            title: 'Premium',
            text: buildStatusLine(userId, st),
          })
        )
      );
    }

    const isOwner = await isDiscordOnlyOwner({ client: Moxi, userId: message.author?.id });
    if (!isOwner) {
      return message.reply(
        asV2MessageOptions(
          buildNoticeContainer({
            emoji: EMOJIS.cross,
            title: 'Sin permiso',
            text: 'Solo los owners del bot pueden gestionar premium.',
          })
        )
      );
    }

    if (sub === 'add' || sub === 'grant') {
      const userId = pickUserIdFromMessage(message, rest);
      if (!userId) {
        return message.reply(
          asV2MessageOptions(
            buildNoticeContainer({
              emoji: EMOJIS.warn || '⚠️',
              title: 'Falta usuario',
              text: 'Uso: `.premium add @usuario 30d premium` (duración opcional, tier opcional)',
            })
          )
        );
      }

      const durRaw = safeStr(rest?.[1]);
      const tierRaw = safeStr(rest?.[2]) || 'premium';

      let durationMs = null; // default perma
      if (durRaw) {
        const parsed = parseDurationMs(durRaw);
        if (Number.isNaN(parsed)) {
          return message.reply(
            asV2MessageOptions(
              buildNoticeContainer({
                emoji: EMOJIS.warn || '⚠️',
                title: 'Duración inválida',
                text: 'Ejemplos: `30d`, `12h`, `1w2d`, `perma`',
              })
            )
          );
        }
        durationMs = parsed;
      }

      const res = await grantPremium({
        userId,
        tier: tierRaw,
        durationMs,
        grantedBy: message.author?.id,
        reason: null,
      });

      if (!res.ok) {
        return message.reply(
          asV2MessageOptions(
            buildNoticeContainer({
              emoji: EMOJIS.cross,
              title: 'Error',
              text: res.message || 'No se pudo dar premium.',
            })
          )
        );
      }

      return message.reply(
        asV2MessageOptions(
          buildNoticeContainer({
            emoji: '✅',
            title: 'Premium actualizado',
            text: buildStatusLine(userId, res.status),
          })
        )
      );
    }

    if (sub === 'remove' || sub === 'revoke' || sub === 'del') {
      const userId = pickUserIdFromMessage(message, rest);
      if (!userId) {
        return message.reply(
          asV2MessageOptions(
            buildNoticeContainer({
              emoji: EMOJIS.warn || '⚠️',
              title: 'Falta usuario',
              text: 'Uso: `.premium remove @usuario`',
            })
          )
        );
      }

      const res = await revokePremium({ userId });
      if (!res.ok) {
        return message.reply(
          asV2MessageOptions(
            buildNoticeContainer({
              emoji: EMOJIS.cross,
              title: 'Error',
              text: res.message || 'No se pudo quitar premium.',
            })
          )
        );
      }

      return message.reply(
        asV2MessageOptions(
          buildNoticeContainer({
            emoji: '✅',
            title: 'Premium quitado',
            text: res.removed ? `Se quitó premium a <@${userId}>.` : `<@${userId}> no tenía premium.`,
          })
        )
      );
    }

    return message.reply(
      asV2MessageOptions(
        buildNoticeContainer({
          emoji: EMOJIS.warn || '⚠️',
          title: 'Uso',
          text: [
            '`.premium me`',
            '`.premium check @user`',
            '`.premium add @user 30d premium`',
            '`.premium remove @user`',
          ].join('\n'),
        })
      )
    );
  },
};
