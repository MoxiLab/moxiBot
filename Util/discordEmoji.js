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

    const m = raw.match(/^<(?:(a):)?([\w~]{2,32}):(\d{17,21})>$/);
    if (m) {
        return {
            animated: Boolean(m[1]),
            name: m[2],
            id: m[3],
        };
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
