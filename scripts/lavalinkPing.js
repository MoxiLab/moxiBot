/*
  Diagnóstico rápido para Lavalink (v4).
  Uso:
    node scripts/lavalinkPing.js

  Lee variables:
    LAVALINK_NODE_HOST, LAVALINK_NODE_PORT, LAVALINK_NODE_PASSWORD, LAVALINK_NODE_SECURE
*/

require("../Util/silentDotenv")();

const host = process.env.LAVALINK_NODE_HOST;
const port = Number(process.env.LAVALINK_NODE_PORT);
const password = process.env.LAVALINK_NODE_PASSWORD;
const secure = String(process.env.LAVALINK_NODE_SECURE).toLowerCase() === "true";

async function main() {
  if (!host || !port || !password) {
    console.error("Missing env vars: LAVALINK_NODE_HOST/LAVALINK_NODE_PORT/LAVALINK_NODE_PASSWORD");
    process.exitCode = 1;
    return;
  }

  const base = `http${secure ? "s" : ""}://${host}:${port}`;
  const url = `${base}/v4/info`;

  const fetchFn = globalThis.fetch || (await import("undici").then((m) => m.fetch));

  try {
    const res = await fetchFn(url, {
      method: "GET",
      headers: {
        Authorization: password,
      },
    });

    const text = await res.text();
    console.log("URL:", url);
    console.log("Status:", res.status, res.statusText);
    console.log("Body:", text);

    if (!res.ok) process.exitCode = 2;
  } catch (e) {
    console.error("Request failed:", e?.message ?? e);
    process.exitCode = 3;
  }
}

main();
