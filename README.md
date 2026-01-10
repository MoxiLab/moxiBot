# 🤖 MoXi - Discord Bot

Un bot de Discord moderno y modular estructurado alrededor de carpetas reales que están en el repositorio (Comandos/, Slashcmd/, Util/, etc.). Esta documentación refleja la organización actual en lugar de una versión anterior.

## ✨ Qué hace MoXi hoy

- Soporta comandos prefijados (`Comandos/`) y slash (`Slashcmd/`), categorizados en Admin, Moderación, Música, Herramientas y utilidades de nivel/feedback.
- Usa `Comandos/Utiility/` y `Util/` para helpers visuales (canvacard, rankcard, welcome/farewell cards), sistemas de niveles, logs y render de imágenes.
- Centraliza la respuesta usando componentes modernos almacenados en `Components/`, `Embeds/`, y botones reutilizables bajo `Components/V2`.
- Gestiona eventos a través de `Handlers/` y `Eventos/` (client, interactionCreate, messageCreate, music) con nodos Poru coordinados desde `Handlers/poru.js` y `poruEvent/`.
- Persiste datos en MongoDB mediante los esquemas de `Models/` (Guilds, Users, Ranks, Starboard, Welcome, Audit, etc.).
- Traduce todo el bot mediante `Languages/` (`ar-SA`, `de-DE`, `en-US`, `es-ES`, `fr-FR`, `hi-IN`, `id-ID`, `it-IT`, `ja-JP`, `ko-KR`, `zh-CN`) y servicios de i18next para prefijos, panels y mensajes.
- Mantiene estabilidad con `anticrash/antiCrash.js`, scripts de validación (`scripts/`) y utilitarios de depuración e integración (`Util/debug.js`, `Util/logger.js`).

## 📁 Estructura relevante actual

```
moxiBot/
├── Comandos/            # Comandos con prefijo en categorías claras
├── Slashcmd/           # Comandos slash (Admin, Moderación, Musica, Tools)
├── Util/               # Helpers (imágenes, rankings, nivel, feedback, debugging)
├── Components/          # Controles visuales (botones, embeds, confirmaciones)
├── Embeds/             # Templates como botones o embeds reutilizados
├── Handlers/           # Registro de comandos/eventos y carga de nodos
├── Eventos/            # Eventos para client, interacciones, mensajes, música
├── Models/             # Esquemas de MongoDB (Guilds, Users, Clan, etc.)
├── Languages/          # Traducciones organizadas por locale
├── poruEvent/          # Callbacks de eventos de Poru (voice, track, queue)
├── Global/             # Helpers (niveles, bienvenida, bonus) utilizados por varios módulos
├── Functions/          # Funciones puntuales (e.g. searchSpotify)
├── scripts/            # Utilidades para chequear estructura, migrar datos, refrescar comandos
├── anticrash/          # Handler para reinicios y seguimiento de crash
├── deploy-commands.js  # Script para registrar slash commands en Discord
├── index.js            # Punto de entrada principal
├── sharder.js          # Sharding y clusterización
├── Config.js           # Configuración básica (prefix, opciones por defecto)
├── i18n.js             # Inicialización de i18next
└── package.json        # Dependencias y scripts (`dev`, `start:clean`)
```

## 🚀 Instalación y ejecución

1. Copia `.env.example` (si no existe, crea `.env`) y define `TOKEN`, `MONGODB_URI`, `CLIENT_ID`, `PREFIX`, `PORT`, `PORU_NODES`, etc.
2. Ejecuta `npm install` para instalar dependencias locales.
3. Usa `npm run dev` para desarrollo (activa nodemon y DEBUG; se limpia consola automáticamente) o `npm run start:clean` para producción sin warnings conocidos.

## 🧰 Dependencias clave
- `discord.js@14`, `mongoose`, `dotenv`, `i18next`, `poru`, `poru-spotify`, `canvacard`, `rankcard`, `sylphacard`, `canvafy`, `muzicard`.
- Utilidades de logging: `silentDotenv`, `logger`, `debugHelper` y `Util/commandHandler` para centralizar prefijos y comandos.

## 🌐 Localización activa

- Traducciones completas para `ar-SA`, `de-DE`, `en-US`, `es-ES`, `fr-FR`, `hi-IN`, `id-ID`, `it-IT`, `ja-JP`, `ko-KR`, `zh-CN`.
- El sistema carga el archivo correspondiente en `Languages/<locale>/` y usa `Languages/prefix-panels.json`, `language-meta.json`, `i18n.js` y `Global/Settings` para aplicar el idioma en interacciones.

## 🧭 Scripts y mantenimiento
- `scripts/` contiene herramientas como `check-commands-load.js`, `set_welcome_style.js`, `refresh_slash_commands.js` y `scan-help-i18n.js` para mantener coherencia entre código y traducciones.
- `deploy-commands.js` refresca los slash commands contra Discord, mientras que `scripts/list_slash_commands.js` imprime el catálogo actual.

## 🛠️ Cómo contribuir

1. Alinea nuevas características con la estructura existente (agrupa por carpetas funcionales y sigue los namespaces ya definidos).
2. Agrupa tus commits en fases claras (infraestructura/core, comandos/UI, idiomas/modelos) para conservar un historial limpio como ya se ha hecho.
3. Ejecuta los scripts relevantes (`npm run dev`, `scripts/check-commands-load.js`, `scripts/check-locales.js`) antes de abrir un PR.

## 📦 Qué verificar antes de subir

- Asegúrate de que no se suben `node_modules`, `.env`, `.vscode` ni `.npm` gracias al `.gitignore`.
- Ejecútalo `npm run dev` para verificar logging y carga de nodos Poru.
- Revisa `Languages/` para confirmar que todos los locales estén sincronizados con `i18n.js`.

## 📞 Soporte y documentación adicional

- Usa `/bug` o `/feedback` en Discord para reportar errores y sugerencias.
- `DEBUGGING.md` recoge consejos de depuración si necesitas observar logs/comportamiento del bot.

**Nota**: este README refleja la estructura actual del proyecto descrita por los archivos y carpetas que hay en el repositorio. Si añades nuevas carpetas, actualiza también este documento.
