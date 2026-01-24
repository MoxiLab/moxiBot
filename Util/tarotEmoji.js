const TAROT_EMOJIS = [
  '<:1_320px:1464661184723681311>',
  '<:2_320px:1464661155975921819>',
  '<:3_320px:1464661157653774408>',
  '<:4_320px:1464661159461261545>',
  '<:5_320px:1464661161281585423>',
  '<:6_320px:1464661163605361006>',
  '<:7_320px:1464661165878673499>',
  '<:8_320px:1464661175789687005>',
  '<:9_320px:1464661177752748167>',
  '<:10_320px:1464661179904299059>',
  '<:11_320px:1464661181544534109>',
  '<:12_320px:1464661183360532611>',
];

function hashString(input) {
  const s = String(input || '');
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function pick(arr) {
  const list = Array.isArray(arr) ? arr : [];
  return list[Math.floor(Math.random() * list.length)];
}

function getEmojiForCard(card) {
  const key = card?.name_short || card?.name || '';
  const idx = TAROT_EMOJIS.length ? (hashString(key) % TAROT_EMOJIS.length) : 0;
  return TAROT_EMOJIS[idx] || pick(TAROT_EMOJIS) || '🃏';
}

module.exports = {
  TAROT_EMOJIS,
  getEmojiForCard,
};
