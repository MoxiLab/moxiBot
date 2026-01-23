const {
    SlashCommandBuilder,
    ContainerBuilder,
    MessageFlags,
} = require('discord.js');

const { Bot } = require('../../Config');
const moxi = require('../../i18n');
const debugHelper = require('../../Util/debugHelper');
const { ownerPermissions } = require('../../Util/ownerPermissions');
const { setSession, buildServersPanel } = require('../../Util/serversPanel');

// Render y paginación se manejan desde Util/serversPanel

module.exports = {
    data: new SlashCommandBuilder()
        .setName('servers')
        .setDescription('Muestra los servidores donde está el bot')
        .addStringOption((opt) =>
            opt
                .setName('buscar')
                .setDescription('Filtra por nombre de servidor (contiene)')
                .setRequired(false)
        )
        .addIntegerOption((opt) =>
            opt
                .setName('limite')
                .setDescription('Cuántos servidores listar (1-50)')
                .setMinValue(1)
                .setMaxValue(50)
                .setRequired(false)
        )
        .addBooleanOption((opt) =>
            opt
                .setName('publico')
                .setDescription('Mostrar el resultado públicamente (por defecto: oculto)')
                .setRequired(false)
        ),

    async run(Moxi, interaction) {
        const requesterId = interaction.user?.id;
        debugHelper.log('servers', 'slash start', { requesterId });

        const isOwner = await ownerPermissions(interaction, Moxi);
        if (!isOwner) {
            return interaction.reply({
                content: 'Solo los owners pueden usar este comando.',
                flags: MessageFlags.Ephemeral,
            });
        }

        const lang = await moxi.guildLang(interaction.guildId || interaction.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
        const t = (key, fallback) => {
            const out = moxi.translate(key, lang);
            return out && out !== key ? out : fallback;
        };

        const publicReply = interaction.options.getBoolean('publico') === true;
        const search = interaction.options.getString('buscar')?.trim() || '';
        const limit = interaction.options.getInteger('limite') ?? 50;

        const token = setSession({ userId: interaction.user.id, search, limit, pageSize: 5 });
        const { payload } = await buildServersPanel({
            client: Moxi,
            userId: interaction.user.id,
            token,
            search,
            limit,
            page: 0,
            pageSize: 5,
            t,
        });

        return interaction.reply({
            ...payload,
            flags: (publicReply ? 0 : MessageFlags.Ephemeral) | MessageFlags.IsComponentsV2,
        });
    },
};
