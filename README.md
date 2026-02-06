# 🤖 Comandos de MoXi

Este README documenta únicamente los comandos que el bot expone hoy, separados por tipo y utilidad.

## Comandos con prefijo

### Administrador

- `prefix`: muestra o cambia el prefijo del servidor.
- `language`: fija el idioma del servidor.
- `welcome` / `byes`: administran mensajes e imágenes de bienvenida y despedida.
- `audit`: exporta registros de auditoría y consulta eventos recientes.
- `AddEmoji`: agrega emojis al servidor.
- `SetLevel`, `ResetLevels`, `LevelConfig`: ajustan y reinician experiencia de niveles.
- `RankSetup`: define canales y estilos para tarjetas de nivel.
- `channel`, `leave`, `permiso`, `perms`, `rol`: utilidades administrativas varias.

### Moderación (Prefijo)

- `AutoRuleCreate`, `AutoRuleEdit`, `AutoRuleList`, `AutoRuleDelete`: gestionan reglas automáticas.
- `ban`, `kick`, `timeout`, `warn`, `mute`, `unban`, `unmute`: sanciones y moderación básica.

### Música (Prefijo)

- `play`, `queue`, `pause`, `resume`, `skip`, `stop`, `volume`, `add`, `autoplay`: control total de la música.

### Herramientas y utilidades

- `help`, `ping`, `bug`, `afk`, `starboard`, `autonuke`, `user`, `cls`, `rules`, `timer`, `uptime`, `invite`, `portal`, `botstats`: utilidades generales y de soporte.

### Funciones de experiencia gamificada

- `Feedback`, `Prestige`, `Levels`, `Rank`, `Stats`, `emojiinfo`: experiencia, estadísticas y feedback de la comunidad.

### Comandos raíz

- `mongo`, `lava`: diagnósticos y control de nodos.

## Comandos slash

### Administración

- `audit`: consulta registros de auditoría.

### Moderación

- `mod`: acciones clave de moderación (ban, kick, mute, timeout, warn, unban).

### Música (Slash)

- `musica`: reproducción, control de cola y volumen.

### Herramientas

- `help`, `bug`, `afk`, `cls`, `rules`, `starboard`, `timer`, `invite`, `portal`, `botstats`: utilidades y soporte.

## Sistema de invitaciones (permanentes + anti-manual + tracking)

El bot incluye un sistema para **tener siempre una única invitación permanente** por servidor y evitar que se creen invitaciones adicionales.

### Qué hace

- **Invitación permanente única**: el comando `/invite` (slash) o `invite` (prefijo) devuelve siempre la misma invitación.
- **Portal del servidor**: el comando `/portal` (slash) o `portal` (prefijo) muestra un panel con botón y el enlace oficial.
- **Sin crear más invitaciones**: si ya existe una invitación guardada, no se crean nuevas aunque se pida otro canal.
- **Anti-invitaciones manuales (best-effort)**: si alguien crea una invitación manual, el bot intenta borrarla automáticamente.
- **Tracking de invitación usada (best-effort)**: cuando entra un usuario, el bot intenta detectar qué invitación subió de usos y lo añade al log de auditoría.

### Requisitos de permisos

- Para crear la invitación oficial: el bot necesita **Crear invitación** (`CreateInstantInvite`) en el canal.
- Para borrar invitaciones manuales y hacer tracking completo: el bot necesita **Gestionar servidor** (`ManageGuild`).

### Persistencia (MongoDB)

Si `MONGODB` está configurado, el bot guarda el código de la invitación oficial en la colección `permanent_invites` para reutilizarla siempre (aunque reinicie).

### Variables de entorno

- `INVITE_GUARD_ENABLED=true|false` (por defecto `true`): habilita/deshabilita el borrado de invitaciones manuales.
- `INVITE_TRACK_ENABLED=true|false` (por defecto `true`): habilita/deshabilita el tracking de invitación usada en `guildMemberAdd`.

## Modo IA (auto-reply por canal)

El bot puede responder automáticamente en canales donde el **modo IA** esté activado (sin necesidad de mención).

- Activar/desactivar/estado: usa el comando de prefijo `ia` (owners-only).
- Personalización (por canal): se puede ajustar mientras conversas (owners-only) usando mensajes tipo `prompt: ...`, `modelo: ...`, `temperatura: ...`, etc.

### Comandos sin prefijo (en canal IA)

En canales con IA activada, el bot puede ejecutar **comandos de prefijo** aunque no escribas el prefijo.

- Ejemplo: escribir `help` en vez de `.help`.
- También acepta frases tipo: `ejecuta help`, `usa ping`, `haz afk estoy comiendo`.

Por seguridad, esto está pensado para **owners** por defecto.

Variables (opcional):

- `AI_COMMANDS_WITHOUT_PREFIX=1` (por defecto `1`): habilita/deshabilita esta función.
- `AI_COMMANDS_ALLOW_NON_OWNERS=0` (por defecto `0`): si lo pones en `1`, cualquier usuario podrá disparar comandos sin prefijo en canales IA (no recomendado).

## Clima/tiempo en tiempo real

Cuando el modo IA está activo en un canal, el bot intercepta preguntas de clima y responde con datos reales (sin llamar a OpenAI).

- Ejemplos: "tiempo en Madrid", "clima mañana en Toronto", "pronóstico en Barcelona".
- Proveedor preferido: WeatherAPI.com (si hay key configurada).
- Fallback: Open-Meteo (si no hay key o falla WeatherAPI).

### Variables de entorno (clima)

- `WEATHERAPI_KEY=...` (opcional): habilita WeatherAPI.
- `WEATHER_CACHE_TTL_MS=60000` (opcional): TTL del caché de respuestas de clima.

### Variables de entorno (Discord)

- `TOKEN=...` (recomendado): token del bot (valor que usa el proyecto hoy).
- `DISCORD_TOKEN=...` (alternativa): también se acepta por compatibilidad con tutoriales.

No compartas ni subas tus keys (si se filtraron, rótalas/regénéralas).

Mantén este README actualizado cada vez que se agregue o retire un comando para reflejar los cambios reales en `Comandos/` y `Slashcmd/`.
