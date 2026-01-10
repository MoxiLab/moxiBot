# ¿Qué es el comando starboard?

El comando `starboard` te permite destacar los mejores mensajes de tu servidor en un canal especial. Cuando un mensaje recibe suficientes reacciones (por ejemplo, ⭐), el bot lo publica automáticamente en el canal de starboard para que toda la comunidad lo vea.

## ¿Cómo se usa?

1. **Configura el canal starboard:**
   - Usa el comando `/starboard set <canal>` para elegir el canal donde se mostrarán los mensajes destacados.

2. **Define el número de reacciones necesarias:**
   - Puedes establecer cuántas reacciones (por ejemplo, estrellas) necesita un mensaje para ser destacado. Ejemplo: `/starboard threshold 3` hará que solo los mensajes con 3 o más estrellas se publiquen en el starboard.

3. **Desactiva o ajusta el sistema:**
   - Si quieres desactivar el starboard, usa `/starboard disable`.
   - Puedes cambiar el canal o el umbral de reacciones en cualquier momento usando los mismos comandos.

## Ejemplo de uso

- `/starboard set #destacados` → Elige el canal #destacados para los mensajes destacados.
- `/starboard threshold 5` → Solo los mensajes con 5 o más estrellas serán destacados.
- `/starboard disable` → Desactiva el sistema starboard.

## Notas
- Solo los administradores pueden configurar el starboard.
- El bot necesita permisos para ver mensajes y enviar mensajes en el canal starboard.
- Los mensajes eliminados o editados pueden dejar de aparecer en el starboard.

¡Así puedes motivar a tu comunidad a compartir contenido de calidad y reconocer los mejores aportes!
