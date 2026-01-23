async function sendDiscordWebhook(url, payload) {
  if (!url) return;

  // Node 18+ tiene fetch global; en este workspace es Node 24.
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(() => null);

  // Evita reventar por webhooks caídos; esto es logging best-effort.
  if (!res) return;
  if (!res.ok) {
    // Consumir body para evitar warnings de streams
    try { await res.text(); } catch {}
  }
}

module.exports = { sendDiscordWebhook };
