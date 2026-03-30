const { ContainerBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { ButtonBuilder } = require('./compatButtonBuilder');
const { EMOJIS } = require('./emojis');
const CommandRegistry = require('../Models/CommandsSchema');
const Subcommands = require('../Models/SubcommandsSchema');
const getHelpContent = require('./getHelpContent');
const { normalizeDiscordId, normalizeDbText } = require('./idGuards');

function serializeComponent(value) {
    if (!value) return value;
    if (typeof value.toJSON === 'function') return value.toJSON();
    return value;
}

function serializeComponents(components) {
    if (!components) return [];
    if (Array.isArray(components)) return components.map(serializeComponent);
    return [serializeComponent(components)];
}

function serializeMessagePayload(payload) {
    if (!payload || typeof payload !== 'object') return payload;
    const out = { ...payload };
    if (payload.components) out.components = serializeComponents(payload.components);
    return out;
}

function stableString(value) {
    return String(value || '').trim();
}

function normalizeUsageLines(raw, prefix) {
    const text = String(raw || '').trim();
    if (!text) return [];
    return text
        .split(/\r?\n|\s*\|\|\s*/g)
        .map((line) => String(line || '').trim())
        .filter(Boolean)
        .map((line) => (line.startsWith(prefix) ? line : `${prefix}${line.replace(/^\//, '')}`));
}

function buildCommandCardPreview({ command, commandType }) {
    const name = stableString(command?.name);
    const description = stableString(command?.description) || 'Sin descripción.';
    const category = stableString(command?.category) || 'Other';
    const aliases = Array.isArray(command?.aliases) ? command.aliases : [];
    const prefix = process.env.PREFIX || '.';

    const header = commandType === 'slash' ? `/${name}` : `${prefix}${name}`;
    const usageLines = commandType === 'slash'
        ? (Array.isArray(command?.commandPaths) && command.commandPaths.length ? command.commandPaths : [`/${name}`])
        : normalizeUsageLines(command?.usage, prefix);

    const usageBlock = usageLines.length
        ? usageLines.map(u => `• ${u}`).join('\n')
        : `• ${header}`;

    const aliasBlock = aliases.length ? aliases.join(', ') : '—';

    const container = new ContainerBuilder()
        .setAccentColor(0xE1A6FF)
        .addTextDisplayComponents(t => t.setContent(`## ${header}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(t => t.setContent(description))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(t => t.setContent(`**Categoría:** ${category}`))
        .addTextDisplayComponents(t => t.setContent(`**Alias:** ${aliasBlock}`))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(t => t.setContent(`**Uso:**\n${usageBlock}`));

    const homeButton = new ButtonBuilder()
        .setCustomId('help_home')
        .setEmoji(EMOJIS.home)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(false);

    const closeButton = new ButtonBuilder()
        .setCustomId('help_close')
        .setEmoji(EMOJIS.cross)
        .setStyle(ButtonStyle.Danger)
        .setDisabled(false);

    container.addActionRowComponents(row => row.addComponents(homeButton, closeButton));

    return { content: '', components: [container], flags: MessageFlags.IsComponentsV2 };
}

function mapRegistryToClient(docs) {
    const commands = new Map();
    const slashcommands = new Map();

    for (const doc of Array.isArray(docs) ? docs : []) {
        const name = stableString(doc?.name);
        if (!name) continue;

        if (doc.type === 'prefix') {
            commands.set(name, {
                name,
                description: doc.description,
                usage: doc.usage,
                Category: doc.category,
                alias: doc.aliases,
                command: { Prefix: true },
            });
        }

        if (doc.type === 'slash') {
            const slashJson = doc.slash || { name, description: doc.description };
            slashcommands.set(name, {
                name,
                description: doc.description,
                Category: doc.category,
                command: { Slash: true },
                data: {
                    toJSON: () => slashJson,
                },
            });
        }
    }

    return { commands, slashcommands };
}

async function processPlaygroundJob(job) {
    if (job.type === 'playground:preview') {
        return {
            kind: 'preview',
            payload: serializeMessagePayload(job.payload || {}),
        };
    }

    if (job.type === 'playground:helpPreview') {
        const p = job.payload || {};
        const botId = normalizeDiscordId(p.botId || job.botId || process.env.CLIENT_ID || '');
        if (!botId) return { ok: false, error: 'Missing botId (CLIENT_ID)' };

        const page = Number.isFinite(Number(p.page)) ? Number(p.page) : 0;
        const tipo = String(p.tipo || 'main');
        const categoria = p.categoria || null;
        const lang = String(p.lang || process.env.DEFAULT_LANG || 'es-ES');
        const userId = normalizeDiscordId(p.userId) || null;
        const guildId = normalizeDiscordId(p.guildId) || null;

        const docs = await CommandRegistry.find({ botId }).lean();
        const fakeClient = mapRegistryToClient(docs);

        const helpPayload = await getHelpContent({
            page,
            tipo,
            categoria,
            client: fakeClient,
            lang,
            userId,
            guildId,
            useV2: true,
        });

        return {
            ok: true,
            kind: 'helpPreview',
            botId,
            payload: serializeMessagePayload(helpPayload || {}),
        };
    }

    if (job.type === 'playground:commandPreview') {
        const p = job.payload || {};
        const name = normalizeDbText(stableString(p.name).toLowerCase(), { maxLen: 100, fallback: '' });
        const cmdType = (stableString(p.commandType || p.type || 'slash').toLowerCase() === 'prefix') ? 'prefix' : 'slash';
        const botId = normalizeDiscordId(p.botId || job.botId || process.env.CLIENT_ID || '');

        if (!botId) return { ok: false, error: 'Missing botId (CLIENT_ID)' };
        if (!name) return { ok: false, error: 'Missing payload.name' };

        const cmd = await CommandRegistry.findOne({ botId, type: cmdType, name }).lean();
        if (!cmd) return { ok: false, error: `Command not found in DB: ${cmdType}:${name}`, botId };

        const sub = (cmdType === 'slash')
            ? await Subcommands.find({ botId, type: 'slash', rootName: name }).sort({ subcommandGroup: 1, subcommandName: 1 }).lean()
            : [];

        const result = {
            ok: true,
            kind: 'commandPreview',
            botId,
            commandType: cmdType,
            command: cmd,
            subcommands: sub,
        };

        if (p.render === 'v2' || p.includeUI) {
            result.ui = serializeMessagePayload(buildCommandCardPreview({ command: cmd, commandType: cmdType }));
        }

        return result;
    }

    if (job.type === 'playground:ping') {
        return { ok: true, at: new Date().toISOString() };
    }

    return { ok: false, error: `Unknown job type: ${job.type}` };
}

module.exports = {
    processPlaygroundJob,
    serializeMessagePayload,
};
