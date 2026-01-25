const {
    ContainerBuilder,
    ButtonStyle,
    MessageFlags,
} = require('discord.js');

const { ButtonBuilder } = require('./compatButtonBuilder');

const { Bot } = require('../Config');
const { EMOJIS } = require('./emojis');
const { randInt } = require('./activityUtils');
const { getCrimeActivity, pickRandomCrimeActivity } = require('./crimeActivities');
const { tCrime, crimeActivityTitle, crimeActivityPrompt, crimeOptionLabel, crimeDoorLabel, crimeRiskLabel, crimeWireLabel } = require('./crimeI18n');

function parseCrimeCustomId(customId) {
    const id = String(customId || '');
    if (!id.startsWith('crime:')) return null;
    const parts = id.split(':');
    // crime:<action>:<userId>:...
    const action = parts[1] || '';
    const userId = parts[2] || '';
    return { action, userId, parts };
}

function buildCrimePanel({ lang = 'es-ES', userId, activityId, state = {} } = {}) {
    const activity = getCrimeActivity(activityId) || pickRandomCrimeActivity();

    // seed determinista para la UI (para que no cambie al clickar)
    const seedMax = activity.kind === 'wires' ? 3 : 2;
    const seed = Number.isFinite(state.seed) ? state.seed : randInt(0, seedMax);

    const container = new ContainerBuilder().setAccentColor(Bot.AccentColor);

    container.addTextDisplayComponents(c => c.setContent(`## ${tCrime(lang, 'ui.panelTitle') || 'Crime'}`));
    container.addSeparatorComponents(s => s.setDivider(true));

    const header = `${activity.emoji || '🕵️'} **${crimeActivityTitle(lang, activity)}**`;
    const body = `${crimeActivityPrompt(lang, activity)}`;

    container.addTextDisplayComponents(c => c.setContent([header, body].join('\n')));

    const notice = state?.notice;
    if (notice && (notice.title || notice.text)) {
        container.addSeparatorComponents(s => s.setDivider(true));

        if (notice.title) {
            const titleLine = notice.emoji ? `# ${notice.emoji} ${notice.title}` : `# ${notice.title}`;
            container.addTextDisplayComponents(c => c.setContent(titleLine));
            container.addSeparatorComponents(s => s.setDivider(true));
        }

        if (notice.text) {
            container.addTextDisplayComponents(c => c.setContent(String(notice.text)));
        }
    }

    const disabled = Boolean(state.disabled);

    // Acciones según tipo
    if (activity.kind === 'buttons') {
        const row = activity.options.slice(0, 3).map(opt =>
            new ButtonBuilder()
                .setCustomId(`crime:do:${userId}:${activity.id}:${opt.id}`)
                .setLabel(crimeOptionLabel(lang, opt.id))
                .setEmoji(opt.emoji || '🎲')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(disabled)
        );
        container.addActionRowComponents(r => r.addComponents(...row));
    }

    if (activity.kind === 'doors') {
        const doors = (activity.doors || []).slice(0, 3);
        const row = doors.map((d, idx) =>
            new ButtonBuilder()
                .setCustomId(`crime:do:${userId}:${activity.id}:${d.id}:${seed}`)
                .setLabel(crimeDoorLabel(lang, d.id))
                .setEmoji(d.emoji || '🚪')
                .setStyle(idx === 1 ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setDisabled(disabled)
        );
        container.addActionRowComponents(r => r.addComponents(...row));
    }

    if (activity.kind === 'risk') {
        const risks = (activity.risks || []).slice(0, 3);
        const row = risks.map((r, idx) =>
            new ButtonBuilder()
                .setCustomId(`crime:do:${userId}:${activity.id}:${r.id}`)
                .setLabel(crimeRiskLabel(lang, r.id))
                .setEmoji(r.emoji || '🎲')
                .setStyle(idx === 1 ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setDisabled(disabled)
        );
        container.addActionRowComponents(r => r.addComponents(...row));
    }

    if (activity.kind === 'wires') {
        const wires = (activity.wires || []).slice(0, 4);
        const row = wires.map(w =>
            new ButtonBuilder()
                .setCustomId(`crime:do:${userId}:${activity.id}:${w.id}:${seed}`)
                .setLabel(crimeWireLabel(lang, w.id))
                .setEmoji(w.emoji || '🧵')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(disabled)
        );

        // Discord limita botones por fila (5), así que 4 cabe perfecto
        container.addActionRowComponents(r => r.addComponents(...row));
    }

    // Cerrar / reroll
    container.addActionRowComponents(r => r.addComponents(
        new ButtonBuilder()
            .setCustomId(`crime:reroll:${userId}`)
            .setEmoji(EMOJIS.refresh || '🔄')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(disabled),
        new ButtonBuilder()
            .setCustomId(`crime:close:${userId}:${activity.id}:${seed}`)
            .setEmoji(EMOJIS.stopSign || '⛔')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(disabled)
    ));

    return {
        activity,
        seed,
        container,
    };
}

function buildCrimeMessageOptions({ lang = 'es-ES', userId, activityId, state } = {}) {
    const built = buildCrimePanel({ lang, userId, activityId, state });
    return {
        content: '',
        components: [built.container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { repliedUser: false },
        __crime: { activityId: built.activity.id, seed: built.seed },
    };
}

module.exports = {
    parseCrimeCustomId,
    buildCrimeMessageOptions,
};
