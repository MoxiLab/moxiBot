'use strict';

/**
 * Convierte un emoji (unicode o custom <a:name:id>/<:name:id>) a la forma
 * que espera Discord API en componentes: { name } o { id, name, animated }.
 *
 * Devuelve undefined si input es falsy.
 */
function toComponentEmoji(input) {
    if (!input) return undefined;

    if (typeof input === 'object') {
        const id = input.id != null ? String(input.id) : undefined;
        const name = input.name != null ? String(input.name) : undefined;
        const animated = typeof input.animated === 'boolean' ? input.animated : undefined;

        const out = {};
        if (id) out.id = id;
        if (name) out.name = name;
        if (typeof animated === 'boolean') out.animated = animated;
        return Object.keys(out).length ? out : undefined;
    }

    const raw = String(input).trim();
    if (!raw) return undefined;

    // Custom emoji: <a:name:id> o <:name:id>
    // Evitamos regex aquí porque algunos entornos/builds están resultando sorprendentes con escapes.
    if (raw.startsWith('<') && raw.endsWith('>') && raw.includes(':')) {
        const inner = raw.slice(1, -1); // ':name:id' o 'a:name:id'
        const parts = inner.split(':');
        if (parts.length === 3) {
            const isAnimated = parts[0] === 'a';
            const isStatic = parts[0] === '';
            if (isAnimated || isStatic) {
                const name = String(parts[1] || '');
                const id = String(parts[2] || '');

                // Validaciones mínimas (Discord): name 2..32 y [A-Za-z0-9_~], id 17..21 dígitos
                if (!/^[\w~]{2,32}$/.test(name)) return undefined;
                if (!/^\d{17,21}$/.test(id)) return undefined;

                return { animated: isAnimated, name, id };
            }
        }

        // Si parecía custom pero no encaja, mejor omitirlo para no mandar `name: "<:...>"`.
        if (raw.startsWith('<:') || raw.startsWith('<a:')) return undefined;
    }

    return { name: raw };
}

function normalizeSelectOptions(options) {
    const list = Array.isArray(options) ? options : [];
    return list.map((o) => {
        if (!o || typeof o !== 'object') return o;
        if (!('emoji' in o)) return o;
        const emoji = toComponentEmoji(o.emoji);
        if (!emoji) {
            const { emoji: _old, ...rest } = o;
            return rest;
        }
        return { ...o, emoji };
    });
}

module.exports = {
    toComponentEmoji,
    normalizeSelectOptions,
};
