const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');
const { ContainerBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder } = require('discord.js');
const axios = require('axios');
const moxi = require('../../i18n');
const { tarotCategory } = require('../../Util/commandCategories');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { getRandomTarotCards, getTarotApiSourceLabel } = require('../../Util/tarotApi');
const { getEmojiForCard, TAROT_EMOJIS } = require('../../Util/tarotEmoji');
const { Bot } = require('../../Config');

function truncate(text, max = 900) {
  const s = String(text || '').trim();
  if (!s) return '';
  if (s.length <= max) return s;
  return `${s.slice(0, Math.max(0, max - 1))}…`;
}

function titleCase(value) {
  const s = String(value || '').trim();
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildTarotText({ card, reversed, question }) {
  if (!card) return '';
  const arcana = (card.type === 'major') ? 'Arcano Mayor' : (card.type === 'minor' ? 'Arcano Menor' : null);
  const suit = card.suit ? titleCase(card.suit) : null;
  const value = (card.value_int ?? card.value ?? '').toString();
  const pos = reversed ? 'Invertida' : 'Derecha';
  const meaning = reversed ? card.meaning_rev : card.meaning_up;
  const desc = card.desc;

  const metaParts = [];
  if (arcana) metaParts.push(`**${arcana}**`);
  if (suit) metaParts.push(`**Palo:** ${suit}`);
  if (value) metaParts.push(`**Valor:** ${value}`);

  const lines = [];
  if (metaParts.length) {
    lines.push(metaParts.join(' • '));
  }
  lines.push(`**Posición:** ${pos}`);

  if (question) {
    lines.push('', '## Pregunta', `> ${truncate(question, 220)}`);
  }

  lines.push('', '## Significado', meaning ? `> ${truncate(meaning, 850)}` : '> (sin significado)');

  if (desc) {
    lines.push('', '## Descripción', `> ${truncate(desc, 420)}`);
  }

  return lines.join('\n');
}

function buildTarotContainer({ title, text, imageUrl, footerText, emoji }) {
  const img = String(imageUrl || '').trim();
  if (!img) {
    return buildNoticeContainer({
      emoji,
      title,
      text,
      footerText,
    });
  }

  const container = new ContainerBuilder().setAccentColor(Bot.AccentColor);
  container.addTextDisplayComponents(c => c.setContent(`# ${title}`));
  container.addSeparatorComponents(s => s.setDivider(true));
  container.addMediaGalleryComponents(
    new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(img))
  );
  if (text) {
    container.addSeparatorComponents(s => s.setDivider(true));
    container.addTextDisplayComponents(c => c.setContent(String(text)));
  }
  if (footerText) {
    container.addSeparatorComponents(s => s.setDivider(true));
    container.addTextDisplayComponents(c => c.setContent(String(footerText)));
  }
  return container;
}

function isLikelyUnembeddableUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) return true;
  try {
    const u = new URL(raw);
    const host = (u.hostname || '').toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '::1') return true;
    // Discord a veces falla con http en ciertos componentes; preferimos adjuntar.
    if (u.protocol !== 'https:') return true;
    return false;
  } catch {
    return true;
  }
}

function toSafeFileBaseName(name) {
  return String(name || 'tarot')
    .trim()
    .toLowerCase()
    .replace(/['`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'tarot';
}

function guessExtFromUrl(url) {
  const s = String(url || '').toLowerCase();
  if (s.includes('.png')) return 'png';
  if (s.includes('.webp')) return 'webp';
  if (s.includes('.gif')) return 'gif';
  return 'jpg';
}

async function prepareImageForDiscord({ imageUrl, title }) {
  const raw = String(imageUrl || '').trim();
  if (!raw) return { displayUrl: null, files: [] };

  // Si es localhost/http/etc, adjuntamos para que Discord lo muestre.
  if (!isLikelyUnembeddableUrl(raw)) {
    return { displayUrl: raw, files: [] };
  }

  try {
    const res = await axios.get(raw, { responseType: 'arraybuffer', timeout: 7000 });
    const buf = Buffer.from(res.data);
    if (!buf.length) return { displayUrl: null, files: [] };

    const ext = guessExtFromUrl(raw);
    const fileName = `${toSafeFileBaseName(title)}.${ext}`;
    return {
      displayUrl: `attachment://${fileName}`,
      files: [{ attachment: buf, name: fileName }],
    };
  } catch {
    return { displayUrl: null, files: [] };
  }
}

module.exports = {
  cooldown: 0,
  Category: tarotCategory,
  data: new SlashCommandBuilder()
    .setName('tarot')
    .setDescription('Saca una carta del tarot')
    .addStringOption((opt) =>
      opt
        .setName('pregunta')
        .setDescription('Tu pregunta (opcional)')
        .setRequired(false)
    )
    .addBooleanOption((opt) =>
      opt
        .setName('invertida')
        .setDescription('Devuelve el significado invertido (reversed)')
        .setRequired(false)
    )
    .setDMPermission(true),

  async run(Moxi, interaction) {
    const guildId = interaction.guildId || interaction.guild?.id;
    const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

    const reversed = Boolean(interaction.options.getBoolean('invertida'));
    const question = interaction.options.getString('pregunta')?.trim() || null;
    const cards = await getRandomTarotCards(1);
    const apiCard = Array.isArray(cards) && cards.length ? cards[0] : null;

    if (!apiCard) {
      const fallbackEmoji = TAROT_EMOJIS[Math.floor(Math.random() * TAROT_EMOJIS.length)] || '🃏';
      return interaction.reply({
        ...asV2MessageOptions(
          buildNoticeContainer({
            emoji: fallbackEmoji,
            title: moxi.translate('TAROT_TITLE', lang) || 'Tarot',
            text: `No pude conectar con la API de tarot.\n\n**Tu carta:** ${fallbackEmoji}`,
            footerText: `${getTarotApiSourceLabel()}`,
          })
        ),
        ephemeral: true,
      });
    }

    const emoji = getEmojiForCard(apiCard);
    const name = String(apiCard.name || 'Tarot').replace(/\s+/g, ' ').trim();
    const text = buildTarotText({ card: apiCard, reversed, question });
    const imageUrl = apiCard.image_url || apiCard.image;
    const footerText = `${getTarotApiSourceLabel()}`;

    const prepared = await prepareImageForDiscord({ imageUrl, title: name });

    return interaction.reply({
      ...asV2MessageOptions(
        buildTarotContainer({
          title: name,
          text,
          imageUrl: prepared.displayUrl,
          footerText,
          emoji,
        })
      ),
      ...(prepared.files.length ? { files: prepared.files } : {}),
    });
  },
};
