# 🤖 Comandos de MoXi

Este README documenta únicamente los comandos que el bot expone hoy, separados por tipo y utilidad.

## Comandos con prefijo

### Administrador
- `prefix`: muestra o cambia el prefijo del servidor (valida longitud entre 1 y 6 caracteres y guarda el nuevo valor en MongoDB).
- `language`: fija el idioma del servidor y actualiza los ajustes en GuildSettings para todos los mensajes.
- `welcome` / `byes`: administran los mensajes e imágenes de bienvenida y despedida con render personalizado.
- `audit`: exporta los registros de auditoría y permite consultar eventos recientes relacionados con roles y moderación.
- `AddEmoji`: agrega emojis al servidor y valida permisos antes de crear la reacción.
- `SetLevel` / `ResetLevels` / `LevelConfig`: ajustan la experiencia de niveles (por canal o rol) y reinician progresos cuando es necesario.
- `RankSetup`: define canales y estilos para tarjetas de nivel.

### Moderación
- `AutoRuleCreate`, `AutoRuleEdit`, `AutoRuleList`, `AutoRuleDelete`: establecen reglas automáticas (mensajes, reacciones) y permiten modificarlas sin tocar el código.
- `ban`, `kick`, `timeout`: aplican sanciones básicas con motivo y duración opcional.
- `warn`: registra avisos y notifica al autorizado; `unban` y `unmute` revocan sanciones.
- `mute`: silencia usuarios en canal de voz y texto mediante roles automáticos.

### Música
- `play`: reproduce canciones o playlists desde YouTube/Spotify a través de los nodos Poru.
- `queue`: muestra y gestiona la cola actual.
- `pause` / `resume`: detienen y reanudan la reproducción.
- `skip` / `stop`: saltan la pista en curso o liberan los recursos del nodo.
- `volume`: ajusta el volumen (0-150).
- `add`: agrega URLs o búsquedas a la cola sin interrumpir la lista.
- `autoplay`: alterna el modo de reproducción automática.

### Herramientas y utilidades
- `help`: despliega la guía interactiva con botones para cada categoría.
- `ping`: comprueba latencias del bot y del nodo Poru.
- `bug`: registra un reporte en MongoDB con la información enviada por el usuario.
- `afk`: marca un usuario como ausente y notifica respuestas automáticas.
- `starboard`: configura el canal y los criterios que elevan mensajes destacados.
- `autonuke`: limpia mensajes o permisos conflictivos con un solo comando.
- `user`: muestra estadísticas y roles del miembro en cuestión.

### Funciones de experiencia gamificada
- `Feedback`: permite recopilar impresiones de la comunidad con botones en tiempo real.
- `Prestige`: controla el sistema de prestigio tras alcanzar el máximo nivel.
- `Levels`, `Rank`, `Stats`: exponen estadísticas, tablas de clasificación y progresos por servidor.
- `emojiinfo`: muestra metadatos de un emoji (creador, ID, uso) para moderadores.

### Comandos raíz
- `mongo`: ofrece diagnósticos y estadísticas de la conexión con MongoDB.
- `lava`: reinicia o consulta el estado de los nodos Poru cuando hay fallos de audio.

## Comandos slash

### Administración
- `audit`: consulta registros de auditoría y permite filtrar por acción, usuario o canal desde una interfaz slash.

### Moderación
- `mod`: agrupa acciones clave (ban, kick, mute, timeout, warn, unban) con parámetros estructurados, confirmaciones y registros automáticos en canales dedicados.

### Música
- `musica`: cubre reproducción, control de cola y volumen con menús recomendados por defecto y compatibilidad con Poru/Spotify.

### Herramientas
- `help`: abre el panel gráfico con atajos rápidos (prefijos, ayuda y soporte).
- `bug`: genera un ticket en la base de datos con la descripción del error.
- `afk`: marca o quita el estado de ausencia para el autor inmediatamente.

Mantén este README actualizado cada vez que se agregue o retire un comando para reflejar los cambios reales en `Comandos/` y `Slashcmd/`.
