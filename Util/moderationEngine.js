const { PermissionsBitField } = require('discord.js');
const {
    buildDefaultConfig,
    getGuildConfig,
    upsertGuildConfig,
    listRules,
    getUserState,
    upsertUserState,
    addModAction,
    ensureDefaultRules,
} = require('./moderationEngineStorage');

const SHORTENER_DOMAINS = new Set([
    'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'is.gd', 'cutt.ly', 'rb.gy', 'shorturl.at',
]);

const SUSPICIOUS_DOMAINS = [
    'discord.com',
    'discord.gg',
    'steamcommunity.com',
    'steamcommunity.net',
];

const ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF]/g;
const DIACRITICS_RE = /\p{Diacritic}/gu;
const REPEATED_SYMBOL_RE = /([^A-Za-z0-9\s])\1{4,}/g;
const INVITE_RE = /(?:discord\.gg|discord(?:app)?\.com\/invite)\/([A-Za-z0-9-]+)/gi;
const URL_RE = /https?:\/\/[^\s/$.?#].[^\s]*|www\.[^\s]+/gi;

const inMemoryStats = new Map(); // key: guildId:userId -> stats
const joinSpikes = new Map(); // key: guildId -> timestamps

function safeLower(value) {
    return String(value || '').toLowerCase();
}

function normalizeText(raw, { leet = true } = {}) {
    if (!raw) return '';
    let text = String(raw).normalize('NFKC');
    text = text.replace(ZERO_WIDTH_RE, '');
    text = text.toLowerCase();
    text = text.normalize('NFD').replace(DIACRITICS_RE, '');
    if (leet) {
        text = text
            .replace(/[0]/g, 'o')
            .replace(/[1!]/g, 'i')
            .replace(/[3]/g, 'e')
            .replace(/[4@]/g, 'a')
            .replace(/[5$]/g, 's')
            .replace(/[7]/g, 't');
    }
    text = text.replace(/[^\w\s]/g, ' ');
    text = text.replace(/\s+/g, ' ').trim();
    return text;
}

function extractUrls(text) {
    if (!text) return [];
    const matches = text.match(URL_RE) || [];
    return matches.map((raw) => String(raw));
}

function extractDomains(urls) {
    const domains = [];
    for (const raw of urls) {
        let candidate = raw.trim();
        if (!candidate) continue;
        if (candidate.startsWith('www.')) candidate = `http://${candidate}`;
        try {
            const url = new URL(candidate);
            let host = url.hostname.toLowerCase();
            if (host.startsWith('www.')) host = host.slice(4);
            domains.push(host);
        } catch {
            // ignore parse errors
        }
    }
    return Array.from(new Set(domains));
}

function extractInvites(text) {
    if (!text) return [];
    const invites = [];
    let match;
    while ((match = INVITE_RE.exec(text)) !== null) {
        if (match[1]) invites.push(match[1]);
    }
    return Array.from(new Set(invites));
}

function extractAttachmentExts(message) {
    const exts = [];
    const attachments = Array.from(message.attachments?.values?.() || []);
    for (const att of attachments) {
        const name = String(att?.name || '').trim();
        if (!name) continue;
        const idx = name.lastIndexOf('.');
        if (idx > -1 && idx < name.length - 1) {
            exts.push(name.slice(idx + 1).toLowerCase());
        }
    }
    return Array.from(new Set(exts));
}

function fingerprintText(text) {
    const input = text.slice(0, 200);
    let hash = 5381;
    for (let i = 0; i < input.length; i += 1) {
        hash = ((hash << 5) + hash) + input.charCodeAt(i);
        hash &= 0xffffffff;
    }
    return `f${(hash >>> 0).toString(16)}`;
}

function getStatsKey(guildId, userId) {
    return `${guildId}:${userId}`;
}

function recordWindowStats({ guildId, userId, mentionsCount, fingerprint }) {
    const key = getStatsKey(guildId, userId);
    const now = Date.now();
    const existing = inMemoryStats.get(key) || {
        messages: [],
        mentions: [],
        fingerprints: new Map(),
        lastTouched: now,
    };

    existing.messages.push(now);
    for (let i = 0; i < mentionsCount; i += 1) {
        existing.mentions.push(now);
    }

    if (fingerprint) {
        const arr = existing.fingerprints.get(fingerprint) || [];
        arr.push(now);
        existing.fingerprints.set(fingerprint, arr);
    }

    existing.lastTouched = now;

    const prune = (list, windowMs) => list.filter((t) => now - t <= windowMs);
    existing.messages = prune(existing.messages, 5000);
    existing.mentions = prune(existing.mentions, 10000);

    for (const [fp, times] of existing.fingerprints.entries()) {
        const trimmed = prune(times, 20000);
        if (!trimmed.length) existing.fingerprints.delete(fp);
        else existing.fingerprints.set(fp, trimmed);
    }

    inMemoryStats.set(key, existing);

    return {
        messageCount5s: existing.messages.length,
        mentionCount10s: existing.mentions.length,
        duplicateCount20s: fingerprint ? (existing.fingerprints.get(fingerprint)?.length || 0) : 0,
    };
}

function cleanupStats() {
    const now = Date.now();
    for (const [key, value] of inMemoryStats.entries()) {
        if (now - value.lastTouched > 10 * 60 * 1000) {
            inMemoryStats.delete(key);
        }
    }
}

function countCapsRatio(text) {
    if (!text) return 0;
    let caps = 0;
    let letters = 0;
    for (const ch of text) {
        if (/[A-Za-z]/.test(ch)) {
            letters += 1;
            if (ch === ch.toUpperCase()) caps += 1;
        }
    }
    if (!letters) return 0;
    return caps / letters;
}

function looksUnicodeSuspicious(raw) {
    if (!raw) return false;
    if (ZERO_WIDTH_RE.test(raw)) return true;
    if (/\p{Mn}/u.test(raw)) return true;
    return false;
}

function levenshtein(a, b) {
    const aLen = a.length;
    const bLen = b.length;
    if (!aLen) return bLen;
    if (!bLen) return aLen;
    const dp = Array.from({ length: aLen + 1 }, () => Array(bLen + 1).fill(0));
    for (let i = 0; i <= aLen; i += 1) dp[i][0] = i;
    for (let j = 0; j <= bLen; j += 1) dp[0][j] = j;
    for (let i = 1; i <= aLen; i += 1) {
        for (let j = 1; j <= bLen; j += 1) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost
            );
        }
    }
    return dp[aLen][bLen];
}

function isTyposquat(domain) {
    if (!domain) return false;
    const clean = domain.toLowerCase();
    for (const target of SUSPICIOUS_DOMAINS) {
        if (clean === target) return false;
        const dist = levenshtein(clean, target);
        if (dist > 0 && dist <= 2) return true;
    }
    return false;
}

function isExempt({ member, config }) {
    if (!member || !config) return false;
    const roleIds = new Set(Array.from(member.roles?.cache?.keys?.() || []));
    if (Array.isArray(config.exemptRoles) && config.exemptRoles.some((id) => roleIds.has(id))) {
        return true;
    }

    if (Array.isArray(config.exemptPermissions) && config.exemptPermissions.length) {
        const perms = member.permissions;
        if (perms) {
            for (const perm of config.exemptPermissions) {
                if (PermissionsBitField.Flags[perm] && perms.has(PermissionsBitField.Flags[perm], true)) {
                    return true;
                }
            }
        }
    }

    return false;
}

function addSignal(signals, key, points, meta) {
    if (!points) return 0;
    signals.push({ key, points, meta });
    return points;
}

function parseRulePattern(pattern) {
    return String(pattern || '').trim();
}

function ruleIsConfirmed(rule) {
    const notes = String(rule?.notes || '').toLowerCase();
    return notes.includes('confirmed=true');
}

async function processMessage({ client, message, isUpdate = false }) {
    if (!message || !message.guild || !message.author) return { handled: false };
    if (message.author.bot) return { handled: false };

    const guildId = message.guild.id;
    const userId = message.author.id;
    const member = message.member;

    const config = await getGuildConfig({ guildId });
    if (!config || config.enabled !== true) return { handled: false };

    await refreshDefenseMode({ guildId });

    if (isExempt({ member, config })) return { handled: false };

    await ensureDefaultRules({ guildId });

    cleanupStats();

    const rawContent = String(message.content || '');
    const normalized = normalizeText(rawContent, { leet: true });
    const urls = extractUrls(rawContent);
    const domains = extractDomains(urls);
    const invites = extractInvites(rawContent);
    const attachmentExts = extractAttachmentExts(message);
    const fingerprint = fingerprintText(normalized || rawContent || '');

    const mentionsCount = (message.mentions?.users?.size || 0) + (message.mentions?.roles?.size || 0);
    const stats = recordWindowStats({ guildId, userId, mentionsCount, fingerprint });

    const rules = await listRules({ guildId, enabledOnly: true });
    const matchedRules = [];
    let ruleScore = 0;
    let hasDeleteHint = false;
    let hasMuteHint = false;
    let hasBanHint = false;
    let banHintConfirmed = false;

    for (const rule of rules) {
        const type = String(rule.type || '').toUpperCase();
        const pattern = parseRulePattern(rule.pattern);
        if (!pattern) continue;

        let matched = false;
        if (type === 'WORD') {
            const re = new RegExp(`\\b${pattern.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`, 'i');
            matched = re.test(normalized);
        } else if (type === 'PHRASE') {
            matched = normalized.includes(pattern.toLowerCase());
        } else if (type === 'REGEX') {
            try {
                const re = new RegExp(pattern, 'i');
                matched = re.test(rawContent) || re.test(normalized);
            } catch {
                matched = false;
            }
        } else if (type === 'DOMAIN') {
            if (pattern === '*') matched = domains.length > 0;
            else matched = domains.includes(pattern.toLowerCase());
        } else if (type === 'INVITE') {
            if (pattern === '*') matched = invites.length > 0;
            else matched = invites.includes(pattern);
        } else if (type === 'USERNAME') {
            matched = normalizeText(message.author.username).includes(pattern.toLowerCase());
        } else if (type === 'NICKNAME') {
            matched = normalizeText(member?.nickname || '').includes(pattern.toLowerCase());
        } else if (type === 'ATTACH_EXT') {
            const allowed = pattern.split('|').map((p) => p.trim().toLowerCase()).filter(Boolean);
            matched = attachmentExts.some((ext) => allowed.includes(ext));
        }

        if (matched) {
            matchedRules.push(String(rule.id || ''));
            ruleScore += Number(rule.severity) || 0;
            const hint = String(rule.actionHint || '').toUpperCase();
            if (hint === 'DELETE') hasDeleteHint = true;
            if (hint === 'MUTE') hasMuteHint = true;
            if (hint === 'BAN') {
                hasBanHint = true;
                if (ruleIsConfirmed(rule)) banHintConfirmed = true;
            }
        }
    }

    const signals = [];
    let score = 0;
    if (ruleScore > 0) score += addSignal(signals, 'rule_match', ruleScore, { matchedRules });

    if (urls.length) score += addSignal(signals, 'has_link', 1, { urls });
    if (invites.length) score += addSignal(signals, 'has_invite', 2, { invites });

    if (urls.length && Array.isArray(config.allowLinksChannels) && config.allowLinksChannels.length) {
        if (!config.allowLinksChannels.includes(message.channel.id)) {
            score += addSignal(signals, 'link_not_allowed_channel', 3, { channelId: message.channel.id });
        }
    }

    if (invites.length && Array.isArray(config.allowInvitesChannels) && config.allowInvitesChannels.length) {
        if (!config.allowInvitesChannels.includes(message.channel.id)) {
            score += addSignal(signals, 'invite_not_allowed_channel', 4, { channelId: message.channel.id });
        }
    }

    const accountAgeMs = Date.now() - (message.author.createdAt?.getTime?.() || 0);
    const newAccountDays = Number(config.accountRisk?.newAccountDays) || 7;
    if (accountAgeMs > 0 && accountAgeMs < newAccountDays * 86400000) {
        score += addSignal(signals, 'new_account', 4, { days: newAccountDays });
    }

    const joinedAt = member?.joinedAt ? member.joinedAt.getTime() : null;
    const newMemberMinutes = Number(config.accountRisk?.newMemberMinutes) || 10;
    const isNewMember = joinedAt ? (Date.now() - joinedAt) < newMemberMinutes * 60000 : false;
    if (isNewMember) {
        score += addSignal(signals, 'new_member', 3, { minutes: newMemberMinutes });
    }
    if (isNewMember && urls.length) {
        score += addSignal(signals, 'new_member_posted_link', 5, { urls });
    }

    if (stats.messageCount5s > (Number(config.limits?.maxMessages5s) || 7)) {
        score += addSignal(signals, 'message_flood', 3, { count: stats.messageCount5s });
    }
    if (stats.mentionCount10s > (Number(config.limits?.maxMentions10s) || 5)) {
        score += addSignal(signals, 'mention_flood', 3, { count: stats.mentionCount10s });
    }
    if (stats.duplicateCount20s >= (Number(config.limits?.maxDuplicateFingerprints20s) || 3)) {
        score += addSignal(signals, 'duplicate_spam', 4, { count: stats.duplicateCount20s });
    }

    const capsRatio = countCapsRatio(rawContent);
    if (capsRatio > 0.75 && rawContent.length > 20) {
        score += addSignal(signals, 'caps_ratio_high', 2, { ratio: capsRatio });
    }

    if (REPEATED_SYMBOL_RE.test(rawContent)) {
        score += addSignal(signals, 'symbols_excessive', 2, null);
    }

    if (looksUnicodeSuspicious(rawContent)) {
        score += addSignal(signals, 'unicode_suspicious', 2, null);
    }

    if (domains.some((d) => d.startsWith('xn--'))) {
        score += addSignal(signals, 'domain_punycode', 4, { domains });
    }

    if (domains.some((d) => isTyposquat(d))) {
        score += addSignal(signals, 'domain_suspected_typosquat', 4, { domains });
    }

    if (domains.some((d) => SHORTENER_DOMAINS.has(d))) {
        score += addSignal(signals, 'url_shortener', 2, { domains });
    }

    let userState = await getUserState({ guildId, userId });
    const decay = config.riskDecay || {};
    if (userState && decay.enabled !== false) {
        const lastDecayAt = userState.lastDecayAt ? new Date(userState.lastDecayAt).getTime() : 0;
        const decayEveryMs = Number(decay.decayEveryMs) || 600000;
        const decayAmount = Number(decay.decayAmount) || 1;
        const minScore = Number(decay.minScore) || 0;
        if (lastDecayAt && Date.now() - lastDecayAt >= decayEveryMs) {
            const steps = Math.floor((Date.now() - lastDecayAt) / decayEveryMs);
            const nextScore = Math.max(minScore, (userState.riskScore || 0) - (decayAmount * steps));
            await upsertUserState({
                guildId,
                userId,
                patch: { riskScore: nextScore, lastDecayAt: new Date() },
            });
            userState = { ...userState, riskScore: nextScore, lastDecayAt: new Date() };
        } else if (!lastDecayAt) {
            await upsertUserState({
                guildId,
                userId,
                patch: { lastDecayAt: new Date() },
            });
            userState = { ...userState, lastDecayAt: new Date() };
        }
    }
    if (userState?.shadowbanned) {
        score += addSignal(signals, 'shadowbanned', 999, null);
    }

    if (userState?.strikes) {
        score += addSignal(signals, 'prior_strikes', Math.min(6, userState.strikes * 2), { strikes: userState.strikes });
    }

    if (config.defenseMode === 'soft') {
        for (const signal of signals) {
            if (signal.key === 'new_member_posted_link') signal.points += 2;
            if (signal.key === 'invite_not_allowed_channel') signal.points += 1;
        }
        score = signals.reduce((sum, s) => sum + s.points, 0);
    }

    let decided = 'SCORE_ONLY';
    const thresholds = config.thresholds || buildDefaultConfig().thresholds;
    if (score >= thresholds.ban) decided = 'BAN';
    else if (score >= thresholds.kick) decided = 'KICK';
    else if (score >= thresholds.mute) decided = 'MUTE';
    else if (score >= thresholds.warn) decided = 'WARN_DELETE';

    if (hasDeleteHint && decided === 'SCORE_ONLY') decided = 'DELETE';
    if (hasMuteHint && (decided === 'WARN_DELETE' || decided === 'DELETE') && score >= thresholds.warn) {
        decided = 'MUTE';
    }

    if (hasBanHint && !banHintConfirmed) {
        if (decided === 'BAN') decided = 'KICK';
    }

    let timeoutMs = Number(config.timeouts?.muteMs) || 600000;
    if (config.defenseMode === 'hard') {
        if (urls.length || invites.length) {
            if (!config.allowLinksChannels?.includes(message.channel.id) || !config.allowInvitesChannels?.includes(message.channel.id)) {
                decided = 'MUTE';
                timeoutMs = Number(config.timeouts?.muteHardMs) || timeoutMs;
            }
        }
    }

    let actionApplied = false;
    let deleteApplied = false;

    const reason = `Auto-mod: score=${score}`;

    if (userState?.shadowbanned) {
        decided = 'SHADOWBAN';
    }

    if (decided === 'DELETE' || decided === 'WARN_DELETE' || decided === 'MUTE' || decided === 'KICK' || decided === 'BAN' || decided === 'SHADOWBAN') {
        if (message.deletable) {
            await message.delete().catch(() => null);
            deleteApplied = true;
        }
    }

    if (decided === 'MUTE') {
        if (member?.moderatable) {
            await member.timeout(timeoutMs, reason).catch(() => null);
            actionApplied = true;
        } else if (config.muteRoleId && member?.roles) {
            await member.roles.add(config.muteRoleId, reason).catch(() => null);
            actionApplied = true;
        }
    } else if (decided === 'KICK') {
        if (member?.kickable) {
            await member.kick(reason).catch(() => null);
            actionApplied = true;
        }
    } else if (decided === 'BAN') {
        if (member?.bannable) {
            await member.ban({ reason, deleteMessageSeconds: 0 }).catch(() => null);
            actionApplied = true;
        }
    } else if (decided === 'SHADOWBAN') {
        actionApplied = deleteApplied;
    } else if (decided === 'WARN_DELETE') {
        actionApplied = deleteApplied;
    } else if (decided === 'DELETE') {
        actionApplied = deleteApplied;
    }

    const evidence = {
        messageId: message.id || null,
        channelId: message.channel?.id || null,
        raw: rawContent || null,
        normalized: normalized || null,
        urls,
        domains,
        invites,
        matchedRules,
        signals,
        score,
        isUpdate: !!isUpdate,
    };

    if (decided !== 'SCORE_ONLY') {
        await addModAction({
            guildId,
            userId,
            action: decided,
            reason,
            evidence,
        });

        const newStrikes = (userState?.strikes || 0) + 1;
        await upsertUserState({
            guildId,
            userId,
            patch: {
                riskScore: score,
                strikes: newStrikes,
                lastActionAt: new Date(),
            },
        });
    } else {
        await upsertUserState({
            guildId,
            userId,
            patch: {
                riskScore: score,
            },
        });
    }

    if (config.logChannelId) {
        const channel = await client.channels.fetch(config.logChannelId).catch(() => null);
        if (channel?.send) {
            const lines = [
                `AutoMod accion: ${decided}`,
                `Usuario: <@${userId}> (${userId})`,
                `Canal: <#${message.channel?.id}>`,
                `Score: ${score}`,
                matchedRules.length ? `Reglas: ${matchedRules.join(', ')}` : 'Reglas: -',
            ];
            await channel.send({ content: lines.join('\n') }).catch(() => null);
        }
    }

    return { handled: decided !== 'SCORE_ONLY', action: decided };
}

async function processMemberJoin({ client, member }) {
    if (!member?.guild || !member?.id) return;

    const guildId = member.guild.id;
    const userId = member.id;

    const config = await getGuildConfig({ guildId });
    if (!config || config.enabled !== true) return;

    await upsertUserState({
        guildId,
        userId,
        patch: { lastJoinAt: new Date() },
    });

    if (!config.antiRaid?.enabled) return;

    const now = Date.now();
    const list = joinSpikes.get(guildId) || [];
    list.push(now);

    const softWindow = Number(config.antiRaid?.joinSpikeSoft?.perSeconds) || 10;
    const hardWindow = Number(config.antiRaid?.joinSpikeHard?.perSeconds) || 10;
    const maxWindow = Math.max(softWindow, hardWindow) * 1000;
    const filtered = list.filter((t) => now - t <= maxWindow);
    joinSpikes.set(guildId, filtered);

    const softJoins = Number(config.antiRaid?.joinSpikeSoft?.joins) || 8;
    const hardJoins = Number(config.antiRaid?.joinSpikeHard?.joins) || 15;

    const softCount = filtered.filter((t) => now - t <= softWindow * 1000).length;
    const hardCount = filtered.filter((t) => now - t <= hardWindow * 1000).length;

    let nextMode = config.defenseMode || 'off';
    let durationMs = 0;

    if (hardCount >= hardJoins) {
        nextMode = 'hard';
        durationMs = Number(config.antiRaid?.hardDurationMs) || 1800000;
    } else if (softCount >= softJoins) {
        nextMode = 'soft';
        durationMs = Number(config.antiRaid?.softDurationMs) || 600000;
    }

    if (nextMode !== 'off') {
        const until = new Date(Date.now() + durationMs);
        await upsertGuildConfig({
            guildId,
            patch: { defenseMode: nextMode, defenseUntil: until },
        });

        await addModAction({
            guildId,
            userId,
            action: nextMode === 'hard' ? 'LOCKDOWN_HARD' : 'LOCKDOWN_SOFT',
            reason: `AutoMod defense mode ${nextMode}`,
            evidence: { joins: nextMode === 'hard' ? hardCount : softCount },
        });

        if (config.logChannelId) {
            const channel = await client.channels.fetch(config.logChannelId).catch(() => null);
            if (channel?.send) {
                await channel.send({
                    content: `AutoMod: defense mode ${nextMode} activado hasta ${until.toISOString()}`,
                }).catch(() => null);
            }
        }
    }
}

async function refreshDefenseMode({ guildId }) {
    const config = await getGuildConfig({ guildId });
    if (!config) return;
    if (config.defenseMode === 'off') return;

    if (config.defenseUntil && new Date(config.defenseUntil).getTime() <= Date.now()) {
        await upsertGuildConfig({ guildId, patch: { defenseMode: 'off', defenseUntil: null } });
    }
}

module.exports = {
    processMessage,
    processMemberJoin,
    refreshDefenseMode,
};
