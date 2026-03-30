const { ContainerBuilder, MessageFlags } = require('discord.js');
const moxi = require('../../i18n');
const { Bot } = require('../../Config');

module.exports = {
    name: 'modengineguide',
    alias: ['automodguide', 'modenginehelp'],
    usage: 'modengineguide',
    Category: (lang = 'es-ES') => moxi.translate('commands:CATEGORY_MODERATION', lang),
    description: () => 'Guia rapida del motor de moderacion avanzado.',
    cooldown: 5,

    async execute(Moxi, message) {
        const guildId = message.guild?.id;
        const globalPrefix = (Array.isArray(Bot?.Prefix) && Bot.Prefix[0]) ? Bot.Prefix[0] : (process.env.PREFIX || '.');
        const prefix = guildId ? await Moxi.guildPrefix(guildId, globalPrefix) : globalPrefix;

        const lines = [
            'Guia ModEngine:',
            `• ${prefix}modengine status`,
            `• ${prefix}modengine on | off`,
            `• ${prefix}modengine log #canal | off`,
            `• ${prefix}modengine defense off|soft|hard [dur=10m]`,
            `• ${prefix}modengine thresholds warn=4 mute=7 kick=10 ban=13`,
            `• ${prefix}modengine allowlinks add|remove #canal`,
            `• ${prefix}modengine allowinvites add|remove #canal`,
            `• ${prefix}modengine rule list`,
            `• ${prefix}modengine rule add <type> <pattern> [severity=5] [action=SCORE_ONLY]`,
            `• ${prefix}modengine rule remove <id>`,
            '',
            'Tipos de regla:',
            'WORD, PHRASE, REGEX, DOMAIN, INVITE, USERNAME, NICKNAME, ATTACH_EXT',
        ];

        const container = new ContainerBuilder()
            .setAccentColor(Bot.AccentColor)
            .addTextDisplayComponents(c => c.setContent('# ModEngine'))
            .addSeparatorComponents(s => s.setDivider(true))
            .addTextDisplayComponents(c => c.setContent(lines.join('\n')));

        return message.reply({
            content: '',
            components: [container],
            flags: MessageFlags.IsComponentsV2,
            allowedMentions: { repliedUser: false },
        });
    },
};
