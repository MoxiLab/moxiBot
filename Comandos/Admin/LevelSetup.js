const {
    PermissionsBitField: { Flags },
    ContainerBuilder,
    MessageFlags,
    AttachmentBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
} = require('discord.js');

const { Bot } = require('../../Config');
const debugHelper = require('../../Util/debugHelper');

const LEVELUP_FILE = 'levelup-preview.png';

function toHexColor(color, fallback = '#ffb6e6') {
    if (typeof color === 'number' && Number.isFinite(color)) {
        return `#${(color & 0xffffff).toString(16).padStart(6, '0')}`;
    }

    const raw = String(color || '').trim();
    if (!raw) return fallback;

    if (raw.startsWith('#') && raw.length === 7) return raw.toLowerCase();
    if (raw.startsWith('0x')) return `#${raw.slice(2).padStart(6, '0').toLowerCase()}`;

    const hex = raw.startsWith('#') ? raw.slice(1) : raw;
    if (/^[0-9a-fA-F]{6}$/.test(hex)) return `#${hex.toLowerCase()}`;

    return fallback;
}

function buildPanel({ hasLevelUp }) {
    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(t => t.setContent(
            `# LevelUp\n\n` +
            `Se ha eliminado el selector de estilos.\n` +
            `Aquí tienes un preview del diseño de subida de nivel:`
        ))
        .addSeparatorComponents(s => s.setDivider(true))
        .addTextDisplayComponents(t => t.setContent(
            `**Preview LevelUp**` +
            `${hasLevelUp ? '' : `\n_❌ Preview no disponible_`}`
        ));

    if (hasLevelUp) {
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL(`attachment://${LEVELUP_FILE}`)
            )
        );
    }

    container.addSeparatorComponents(s => s.setDivider(true));
    return container;
}

async function renderLevelUpPreview({ client, user, newLevel }) {
    try {
        const { LevelUp } = require('canvafy');
        const accentHex = toHexColor(Bot?.AccentColor);

        const fetchedUser = client?.users?.fetch
            ? await client.users.fetch(user.id, { force: true }).catch(() => null)
            : null;

        const bannerUrl = fetchedUser?.bannerURL?.({ size: 2048, extension: 'png' })
            || fetchedUser?.bannerURL?.({ size: 2048, extension: 'jpg' })
            || null;

        const avatar = typeof user?.displayAvatarURL === 'function'
            ? user.displayAvatarURL({ extension: 'png', size: 512, forceStatic: true })
            : null;

        const next = Math.max(1, Number(newLevel || 1));
        const prev = Math.max(1, next - 1);

        const card = await new LevelUp()
            .setAvatar(avatar || 'https://cdn.discordapp.com/embed/avatars/0.png')
            .setBackground(bannerUrl ? 'image' : 'color', bannerUrl || '#23272a')
            .setUsername(String(user?.username || 'User'))
            .setBorder(accentHex)
            .setAvatarBorder(accentHex)
            .setOverlayOpacity(0.7)
            .setLevels(prev, next)
            .build();

        return card || null;
    } catch (_) {
        return null;
    }
}

module.exports = {
    name: 'levelsetup',
    alias: ['levelup', 'level-up', 'levelcard', 'level-card', 'levelstyle', 'level-style'],
    description: 'Muestra el diseño LevelUp',
    usage: 'levelsetup',
    helpText: () => (
        'Muestra un preview del diseño de subida de nivel (LevelUp).\n' +
        'No hay selector de estilos.'
    ),
    examples: ['levelsetup'],
    category: 'Admin',
    cooldown: 5,

    permissions: {
        user: [Flags.Administrator],
        bot: [Flags.SendMessages],
        role: []
    },

    command: {
        prefix: true,
        slash: false,
        ephemeral: false,
        options: []
    },

    execute: async (Moxi, message) => {
        try {
            debugHelper.log('levelsetup', 'execute start', {
                guildId: message.guild?.id || 'dm',
                userId: message.author?.id,
            });

            const guild = message.guild;
            if (!guild) return;

            const user = message.author;
            const levelUpPreview = await renderLevelUpPreview({ client: Moxi, user, newLevel: 10 });

            const files = [];
            if (levelUpPreview) {
                files.push(new AttachmentBuilder(levelUpPreview, { name: LEVELUP_FILE }));
            }

            const container = buildPanel({ hasLevelUp: !!levelUpPreview });

            await message.reply({
                content: '',
                components: [container],
                files,
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { repliedUser: false }
            });
        } catch (error) {
            debugHelper.error('levelsetup', 'execute error', { guildId: message.guildId, error });
            console.error('[LevelSetup Command] Error:', error);

            const container = new ContainerBuilder()
                .setAccentColor(Bot.AccentColor)
                .addTextDisplayComponents(t => t.setContent('# ❌ Error al mostrar el preview de LevelUp.'));
            return message.reply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2, allowedMentions: { repliedUser: false } });
        }
    },

    // Compat si se crea wrapper slash en el futuro.
    interactionRun: async (client, interaction) => {
        try {
            await interaction.deferReply();

            const user = interaction.user;
            const levelUpPreview = await renderLevelUpPreview({ client, user, newLevel: 10 });

            const files = [];
            if (levelUpPreview) {
                files.push(new AttachmentBuilder(levelUpPreview, { name: LEVELUP_FILE }));
            }

            const container = buildPanel({ hasLevelUp: !!levelUpPreview });

            await interaction.editReply({
                content: '',
                components: [container],
                files,
                flags: MessageFlags.IsComponentsV2
            });
        } catch (error) {
            debugHelper.error('levelsetup', 'interaction error', { guildId: interaction.guildId, error });
            console.error('[LevelSetup Command] Interaction error:', error);
            try {
                const container = new ContainerBuilder()
                    .setAccentColor(Bot.AccentColor)
                    .addTextDisplayComponents(t => t.setContent('# ❌ Error al mostrar el preview de LevelUp.'));
                await interaction.editReply({ content: '', components: [container], flags: MessageFlags.IsComponentsV2 });
            } catch (_) { }
        }
    }
};
