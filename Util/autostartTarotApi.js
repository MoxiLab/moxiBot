const fs = require('fs');
const path = require('path');
const net = require('net');
const { spawn } = require('child_process');

function isLocalHost(hostname) {
  const h = String(hostname || '').toLowerCase();
  return h === '127.0.0.1' || h === 'localhost' || h === '::1';
}

function waitForPortOpen({ host, port, timeoutMs = 5000 }) {
  return new Promise((resolve) => {
    const startedAt = Date.now();

    const tryOnce = () => {
      const socket = new net.Socket();

      const done = (ok) => {
        try { socket.destroy(); } catch {}
        resolve(Boolean(ok));
      };

      socket.setTimeout(500);
      socket.once('error', () => {
        const elapsed = Date.now() - startedAt;
        if (elapsed >= timeoutMs) return done(false);
        setTimeout(tryOnce, 250);
      });
      socket.once('timeout', () => {
        const elapsed = Date.now() - startedAt;
        if (elapsed >= timeoutMs) return done(false);
        setTimeout(tryOnce, 250);
      });
      socket.connect(port, host, () => done(true));
    };

    tryOnce();
  });
}

function parseBaseUrl(baseUrl) {
  const raw = String(baseUrl || '').trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return {
      host: url.hostname,
      port: url.port ? Number(url.port) : (url.protocol === 'https:' ? 443 : 80),
      protocol: url.protocol,
    };
  } catch {
    return null;
  }
}

async function maybeAutostartTarotApi() {
  const enabled = String(process.env.TAROT_API_AUTOSTART || '').trim() === '1';
  if (!enabled) return false;

  const logEnabled = String(process.env.TAROT_API_LOG || '').trim() === '1';

  // Reutiliza la misma resolución que usa el cliente (soporta TAROT_API_BASE_URL=auto).
  let baseUrl = process.env.TAROT_API_BASE_URL;
  try {
    const { getTarotApiBaseUrl } = require('./tarotApi');
    baseUrl = getTarotApiBaseUrl();
  } catch {
    // best-effort
  }

  const parsed = parseBaseUrl(baseUrl);
  if (!parsed) {
    if (logEnabled) console.warn('[tarot][autostart] baseUrl inválida:', baseUrl);
    return false;
  }

  // Solo autostart si apunta a local.
  if (!isLocalHost(parsed.host)) return false;

  const alreadyUp = await waitForPortOpen({ host: parsed.host, port: parsed.port, timeoutMs: 400 });
  if (alreadyUp) return true;

  const tarotRepoDir = path.resolve(__dirname, '..', 'external', 'tarotcardapi');
  const entry = path.join(tarotRepoDir, 'app.js');
  if (!fs.existsSync(entry)) {
    if (logEnabled) console.warn('[tarot][autostart] no existe:', entry);
    return false;
  }

  const child = spawn(process.execPath, [entry], {
    cwd: tarotRepoDir,
    env: { ...process.env, PORT: String(parsed.port) },
    stdio: logEnabled ? 'inherit' : 'ignore',
    windowsHide: true,
  });

  // Guardar referencia para cerrar al salir.
  globalThis.__moxiTarotApiChild = child;

  const cleanup = () => {
    try { child.kill(); } catch {}
  };

  process.once('exit', cleanup);
  process.once('SIGINT', () => { cleanup(); process.exit(0); });
  process.once('SIGTERM', () => { cleanup(); process.exit(0); });

  // Esperar un poco a que abra el puerto.
  await waitForPortOpen({ host: parsed.host, port: parsed.port, timeoutMs: 5000 });
  return true;
}

module.exports = {
  maybeAutostartTarotApi,
};
