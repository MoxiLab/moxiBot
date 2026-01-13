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
- `help`, `ping`, `bug`, `afk`, `starboard`, `autonuke`, `user`, `cls`, `rules`, `timer`, `uptime`: utilidades generales y de soporte.

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
- `help`, `bug`, `afk`, `cls`, `rules`, `starboard`, `timer`: utilidades y soporte.

Mantén este README actualizado cada vez que se agregue o retire un comando para reflejar los cambios reales en `Comandos/` y `Slashcmd/`.
