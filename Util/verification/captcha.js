const crypto = require('node:crypto');

let canvasLib = null;
function getCanvas() {
  if (canvasLib) return canvasLib;
  // Lazy require: evita romper el bot si no está instalada en runtime.
  // (pero en este repo se instala con npm i @napi-rs/canvas)
  // eslint-disable-next-line global-require
  canvasLib = require('@napi-rs/canvas');
  return canvasLib;
}

function randomCode(length = 6) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

async function renderCaptchaPng(code, options = {}) {
  const { createCanvas } = getCanvas();

  const width = options.width || 520;
  const height = options.height || 180;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Fondo
  const grd = ctx.createLinearGradient(0, 0, width, height);
  grd.addColorStop(0, '#0b1020');
  grd.addColorStop(1, '#12294a');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, width, height);

  // Ruido
  for (let i = 0; i < 18; i++) {
    ctx.strokeStyle = `rgba(255,255,255,${rand(0.05, 0.18)})`;
    ctx.lineWidth = rand(1, 4);
    ctx.beginPath();
    ctx.moveTo(rand(0, width), rand(0, height));
    ctx.bezierCurveTo(rand(0, width), rand(0, height), rand(0, width), rand(0, height), rand(0, width), rand(0, height));
    ctx.stroke();
  }

  // Puntos
  for (let i = 0; i < 600; i++) {
    ctx.fillStyle = `rgba(255,255,255,${rand(0.02, 0.12)})`;
    ctx.fillRect(rand(0, width), rand(0, height), 1, 1);
  }

  // Texto
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  const baseX = width / 2;
  const baseY = height / 2;

  ctx.font = 'bold 72px sans-serif';
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.fillStyle = '#e6f1ff';

  // Dibujar carácter a carácter con pequeñas rotaciones
  const chars = String(code).split('');
  const total = chars.length;
  const spacing = 64;
  const startX = baseX - (spacing * (total - 1)) / 2;

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const x = startX + i * spacing + rand(-6, 6);
    const y = baseY + rand(-10, 10);
    const rot = rand(-0.25, 0.25);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.strokeText(ch, 0, 0);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  }

  // Marco
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  ctx.strokeRect(12, 12, width - 24, height - 24);

  return canvas.toBuffer('image/png');
}

module.exports = {
  randomCode,
  renderCaptchaPng,
};
