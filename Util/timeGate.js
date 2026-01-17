const { PermissionsBitField } = require('discord.js');

function safeString(v) {
    return (v === undefined || v === null) ? '' : String(v);
}

function parseHmToMinutes(hm) {
    const raw = safeString(hm).trim();
    const m = raw.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (!m) return null;
    const h = Number.parseInt(m[1], 10);
    const min = Number.parseInt(m[2], 10);
    return h * 60 + min;
}

function parseWindowSpec(spec) {
    const raw = safeString(spec).trim();
    const parts = raw.split('-').map(s => s.trim());
    if (parts.length !== 2) return null;
    const start = parseHmToMinutes(parts[0]);
    const end = parseHmToMinutes(parts[1]);
    if (start === null || end === null) return null;
    return { start, end, raw };
}

function normalizeWindows(windows) {
    const list = Array.isArray(windows) ? windows : [];
    const parsed = [];
    for (const w of list) {
        const p = parseWindowSpec(w);
        if (p) parsed.push(p);
    }
    return parsed;
}

function formatMinutesToHm(totalMinutes) {
    const m = Math.max(0, Math.min(1439, Number(totalMinutes) || 0));
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    return `${hh}:${mm}`;
}

function getMinutesInTimeZone(date, timeZone) {
    const tz = safeString(timeZone).trim() || 'UTC';
    try {
        const dtf = new Intl.DateTimeFormat('en-GB', {
            timeZone: tz,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
        const parts = dtf.formatToParts(date);
        const hour = Number(parts.find(p => p.type === 'hour')?.value);
        const minute = Number(parts.find(p => p.type === 'minute')?.value);
        if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
        return hour * 60 + minute;
    } catch {
        return null;
    }
}

function isWithinAnyWindow(nowMinutes, windows) {
    const mins = Number(nowMinutes);
    if (!Number.isFinite(mins)) return false;

    const list = normalizeWindows(windows);
    if (!list.length) return true; // sin ventanas = no bloquea

    for (const w of list) {
        if (w.start === w.end) return true; // todo el día

        // normal (ej: 18:00-23:00)
        if (w.start < w.end) {
            if (mins >= w.start && mins <= w.end) return true;
            continue;
        }

        // overnight (ej: 22:00-02:00)
        if (mins >= w.start || mins <= w.end) return true;
    }

    return false;
}

function hasAnyBypassPermission(memberPermissions, bypassPermNames) {
    if (!memberPermissions || !Array.isArray(bypassPermNames) || !bypassPermNames.length) return false;
    for (const name of bypassPermNames) {
        const key = safeString(name).trim();
        const bit = PermissionsBitField.Flags[key];
        if (!bit) continue;
        try {
            if (memberPermissions.has(bit, true)) return true;
        } catch {
            // ignore
        }
    }
    return false;
}

function hasAnyBypassRole(rolesManagerOrCache, bypassRoleIds) {
    if (!rolesManagerOrCache || !Array.isArray(bypassRoleIds) || !bypassRoleIds.length) return false;
    const ids = bypassRoleIds.map(String);

    // RoleManager
    if (rolesManagerOrCache.cache && typeof rolesManagerOrCache.cache.has === 'function') {
        return ids.some(id => rolesManagerOrCache.cache.has(id));
    }
    // Collection cache
    if (typeof rolesManagerOrCache.has === 'function') {
        return ids.some(id => rolesManagerOrCache.has(id));
    }
    // array de role ids
    if (Array.isArray(rolesManagerOrCache)) {
        const set = new Set(rolesManagerOrCache.map(String));
        return ids.some(id => set.has(id));
    }

    return false;
}

function canBypassTimeGate(ctx, gateConfig, globalBypass) {
    const bypassPerms = (gateConfig?.bypass?.permissions) || (globalBypass?.permissions) || [];
    const bypassRoles = (gateConfig?.bypass?.roleIds) || (globalBypass?.roleIds) || [];

    const memberPermissions = ctx?.memberPermissions || ctx?.member?.permissions;
    if (hasAnyBypassPermission(memberPermissions, bypassPerms)) return true;

    const rolesManager = ctx?.member?.roles;
    if (hasAnyBypassRole(rolesManager, bypassRoles)) return true;
    if (hasAnyBypassRole(rolesManager?.cache, bypassRoles)) return true;

    return false;
}

function buildBlockedMessage({ windows, timezone, publicDuringWindows }) {
    const tz = safeString(timezone).trim() || 'UTC';
    const list = normalizeWindows(windows);
    const windowText = list.length
        ? list.map(w => w.raw || `${formatMinutesToHm(w.start)}-${formatMinutesToHm(w.end)}`).join(', ')
        : 'sin horario configurado';

    if (publicDuringWindows === false) {
        return '⛔ Este comando está restringido (no disponible para público).';
    }

    return `⏰ Este comando solo está disponible en estos horarios: **${windowText}** (${tz}).`;
}

function resolveTimeGateForCommand(commandName, commandObj, config) {
    const local = commandObj?.timeGate;
    if (local && typeof local === 'object') return local;

    const map = config?.TimeGates?.commands;
    if (!map || typeof map !== 'object') return null;

    const key = safeString(commandName).trim().toLowerCase();
    return map[key] || null;
}

function shouldBlockByTimeGate({ ctx, commandName, commandObj, config }) {
    const gate = resolveTimeGateForCommand(commandName, commandObj, config);
    if (!gate) return { shouldBlock: false };

    if (gate.publicDuringWindows === false) {
        const canBypass = canBypassTimeGate(ctx, gate, config?.TimeGates?.bypass);
        return { shouldBlock: !canBypass, gate, reason: 'restricted' };
    }

    const tz = gate.timezone || config?.TimeGates?.timezone || 'UTC';
    const nowMinutes = getMinutesInTimeZone(new Date(), tz);
    const allowed = isWithinAnyWindow(nowMinutes, gate.windows);
    if (allowed) return { shouldBlock: false, gate };

    const canBypass = canBypassTimeGate(ctx, gate, config?.TimeGates?.bypass);
    return { shouldBlock: !canBypass, gate, reason: 'time' };

}

module.exports = {
    shouldBlockByTimeGate,
    buildBlockedMessage,
};

