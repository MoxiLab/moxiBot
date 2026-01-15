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

### Moderación
- `AutoRuleCreate`, `AutoRuleEdit`, `AutoRuleList`, `AutoRuleDelete`: gestionan reglas automáticas.
- `ban`, `kick`, `timeout`, `warn`, `mute`, `unban`, `unmute`: sanciones y moderación básica.

### Música
- `play`, `queue`, `pause`, `resume`, `skip`, `stop`, `volume`, `add`, `autoplay`: control total de la música.

### Herramientas y utilidades
- `help`, `ping`, `bug`, `afk`, `starboard`, `autonuke`, `user`, `cls`, `rules`, `timer`, `uptime`, `invite`: utilidades generales y de soporte.

### Funciones de experiencia gamificada
- `Feedback`, `Prestige`, `Levels`, `Rank`, `Stats`, `emojiinfo`: experiencia, estadísticas y feedback de la comunidad.

### Comandos raíz
- `mongo`, `lava`: diagnósticos y control de nodos.

## Comandos slash

### Administración
- `audit`: consulta registros de auditoría.

### Moderación
- `mod`: acciones clave de moderación (ban, kick, mute, timeout, warn, unban).

### Música
- `musica`: reproducción, control de cola y volumen.

### Herramientas
- `help`, `bug`, `afk`, `cls`, `rules`, `starboard`, `timer`, `invite`: utilidades y soporte.

## Sistema de invitaciones (permanentes + anti-manual + tracking)

El bot incluye un sistema para **tener siempre una única invitación permanente** por servidor y evitar que se creen invitaciones adicionales.

### Qué hace

- **Invitación permanente única**: el comando `/invite` (slash) o `invite` (prefijo) devuelve siempre la misma invitación.
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

Mantén este README actualizado cada vez que se agregue o retire un comando para reflejar los cambios reales en `Comandos/` y `Slashcmd/`.
