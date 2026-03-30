const { MessageFlags } = require('discord.js');

const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');
const { buildNoticeContainer } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');
const { isDiscordOnlyOwner } = require('../../Util/ownerPermissions');
const { parseDurationMs, grantPremium, revokePremium, getPremiumStatus } = require('../../Util/premium');

function safeStr(x) {
  return String(x ?? '').trim();
}

function buildStatusText({ userId, status } = {}) {
  if (!status?.ok) return 'No se pudo consultar el estado premium.';
  if (!status.active) return `<@${userId}> no es premium.`;
  const tier = safeStr(status.tier || 'premium');
  const exp = status.expiresAtMs === null ? 'LIFETIME' : `<t:${Math.floor(status.expiresAtMs / 1000)}:R>`;
  return `<@${userId}> es premium (**${tier}**) • Expira: **${exp}**`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('premium')
    .setDescription('Sistema de usuarios premium')
    .addSubcommand((sub) =>
      sub
        .setName('me')
        .setDescription('Mira tu estado premium')
    )
    .addSubcommand((sub) =>
      sub
        .setName('check')
        .setDescription('Comprueba el premium de un usuario')
        .addUserOption((opt) =>
          opt
            .setName('usuario')
            .setDescription('Usuario a consultar')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Dar premium a un usuario (solo owners)')
        .addUserOption((opt) =>
          opt
            .setName('usuario')
            .setDescription('Usuario a premiar')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('duracion')
            .setDescription('Ej: 30d, 12h, 1w2d, o perma (vacío = perma)')
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('tier')
            .setDescription('Nombre del tier (default: premium)')
            .setRequired(false)
        )
        .addStringOption((opt) =>
          opt
            .setName('razon')
            .setDescription('Motivo (opcional)')
            .setRequired(false)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Quitar premium a un usuario (solo owners)')
        .addUserOption((opt) =>
          opt
            .setName('usuario')
            .setDescription('Usuario')
            .setRequired(true)
        )
    ),

  async run(Moxi, interaction) {
    const sub = interaction.options.getSubcommand();

    // Consultas permitidas a cualquiera
    if (sub === 'me' || sub === 'check') {
      const target = sub === 'me'
        ? interaction.user
        : interaction.options.getUser('usuario');

      const st = await getPremiumStatus(target.id);
      const container = buildNoticeContainer({
        emoji: '💎',
        title: 'Premium',
        text: buildStatusText({ userId: target.id, status: st }),
      });

      return interaction.reply({
        content: '',
        components: [container],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }

    // Gestión: solo dueños reales del bot
    const isOwner = await isDiscordOnlyOwner({ client: Moxi, userId: interaction.user?.id });
    if (!isOwner) {
      const container = buildNoticeContainer({
        emoji: EMOJIS.cross,
        title: 'Sin permiso',
        text: 'Solo los owners del bot pueden gestionar premium.',
      });
      return interaction.reply({
        content: '',
        components: [container],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }

    if (sub === 'add') {
      const user = interaction.options.getUser('usuario');
      const tier = safeStr(interaction.options.getString('tier')) || 'premium';
      const reason = safeStr(interaction.options.getString('razon')) || null;
      const durRaw = interaction.options.getString('duracion');

      let durationMs = null; // default perma
      if (durRaw !== null && durRaw !== undefined) {
        const parsed = parseDurationMs(durRaw);
        if (Number.isNaN(parsed)) {
          const container = buildNoticeContainer({
            emoji: EMOJIS.warn || '⚠️',
            title: 'Duración inválida',
            text: 'Usa algo como `30d`, `12h`, `1w2d` o `perma`.',
          });
          return interaction.reply({
            content: '',
            components: [container],
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
          });
        }
        durationMs = parsed;
      }

      const res = await grantPremium({
        userId: user.id,
        tier,
        durationMs,
        grantedBy: interaction.user?.id,
        reason,
      });

      if (!res.ok) {
        const container = buildNoticeContainer({
          emoji: EMOJIS.cross,
          title: 'Error',
          text: res.message || 'No se pudo dar premium.',
        });
        return interaction.reply({
          content: '',
          components: [container],
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
      }

      const container = buildNoticeContainer({
        emoji: '✅',
        title: 'Premium actualizado',
        text: buildStatusText({ userId: user.id, status: res.status }),
      });
      return interaction.reply({
        content: '',
        components: [container],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }

    if (sub === 'remove') {
      const user = interaction.options.getUser('usuario');
      const res = await revokePremium({ userId: user.id });

      if (!res.ok) {
        const container = buildNoticeContainer({
          emoji: EMOJIS.cross,
          title: 'Error',
          text: res.message || 'No se pudo quitar premium.',
        });
        return interaction.reply({
          content: '',
          components: [container],
          flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        });
      }

      const container = buildNoticeContainer({
        emoji: '✅',
        title: 'Premium quitado',
        text: res.removed ? `Se quitó premium a <@${user.id}>.` : `<@${user.id}> no tenía premium.`,
      });
      return interaction.reply({
        content: '',
        components: [container],
        flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
      });
    }

    // fallback
    const container = buildNoticeContainer({
      emoji: EMOJIS.warn || '⚠️',
      title: 'Acción no soportada',
      text: 'Subcomando no reconocido.',
    });

    return interaction.reply({
      content: '',
      components: [container],
      flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
    });
  },
};
