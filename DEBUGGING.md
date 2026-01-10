# Debug Flags

Este proyecto centraliza el control de registros de depuración en `Util/debug.js` y `Util/logger.js`. Define en el archivo `.env` las banderas que quieres habilitar para ver trazas adicionales sin tocar cada comando.

## Flags disponibles

| Feature | Variable | Qué activa |
| --- | --- | --- |
| `help` | `HELP_DEBUG` | Registra `/help`, `!help` y los select menus asociados. |
| `commands` | `COMMANDS_DEBUG` | Registra cada configuración y ejecución desde la carpeta `Comandos` (prefijos) y `Slashcmd` antes de invocarla. |
| `prefix` | `PREFIX_DEBUG` | Muestra la resolución de prefijos en `Eventos/MessageCreate/messageCreate.js`. |
| `owner` | `OWNER_DEBUG` | Registra la comprobación de permisos del propietario (`Util/ownerPermissions.js`). |
| `music` | `MUSIC_DEBUG` | Cubre las utilidades de música del bot. |
| `levels` | `LEVELS_DEBUG` | Habilita trazas del sistema de niveles. |
| `welcome` | `WELCOME_DEBUG` | Activa los logs detallados en `Comandos/Admin/welcome.js` y los eventos de welcome/byes. |
| `byes` | `BYES_DEBUG` | Genera información extra en `Comandos/Admin/byes.js` (configuración, mensajes, prueba). |
| `poru` | `PORU_DEBUG` | Mejora la visibilidad del cliente Poru. |
| `lavalink` | `LAVALINK_DEBUG` | Registra eventos relacionados con la conexión Lavalink. |
| `db` | `DB_DEBUG` | Añade trazas a las operaciones de base de datos cuando están disponibles. |
| `mongo` | `MONGO_DEBUG` | Muestra información extra de MongoDB. |
| `i18n` | `I18N_DEBUG` | Registra pasos del sistema de internacionalización. |
| `interaction` | `INTERACTION_DEBUG` | Registra select menus y componentes con interacciones. |
| `components` | `COMPONENTS_DEBUG` | Activa trazas de componentes V2 y manejo de botones/enlaces.

## Cómo usarlo

1. Define las banderas que necesites en `.env`. Por ejemplo:

```
BYES_DEBUG=1
WELCOME_DEBUG=1
```

2. También puedes usar `DEBUG=1` para activar todos los logs o `DEBUG_FLAGS=welcome,byes` para una lista de banderas específicas.
3. Reinicia el bot; `Util/logger.js` eleva automáticamente el nivel a `debug` y `Util/debugHelper.js` solo emitirá mensajes cuando la flag correspondiente esté habilitada.
4. Todos los comandos y eventos usan `debugHelper` para mantener el control en un único lugar. No necesitas volver a editar cada archivo cuando quieras activar logs.

## Flags por comando

`debugHelper` detecta automáticamente la bandera correspondiente a cada comando. Basta con escribir el nombre del comando en mayúsculas seguido de `_DEBUG` (por ejemplo `ADD_EMOJI_DEBUG=1`) para que solamente ese archivo emita trazas. Esto funciona incluso si el comando no está en la tabla anterior y no hay que modificar el código.
