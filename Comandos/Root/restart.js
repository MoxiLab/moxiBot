
const moxi = require('../../i18n');
const { EMOJIS } = require('../../Util/emojis');
const { isDiscordOnlyOwner } = require('../../Util/ownerPermissions');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const debugHelper = require('../../Util/debugHelper');

module.exports = {
    name: 'restart',
    alias: ['reboot', 'reiniciar', 'reload'],
    Category: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CATEGORY_ROOT', lang);
    },
    description: function (lang) {
        lang = lang || 'es-ES';
        return moxi.translate('commands:CMD_RESTART_DESC', lang);
    },

    async execute(Moxi, message, args) {
        const guildId = message.guild?.id;
        const requesterId = message.author?.id;
        const lang = await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES');

        debugHelper.log('restart', 'command start', {
            guildId: guildId || 'dm',
            requesterId,
            argsPreview: Array.isArray(args) ? args.slice(0, 4) : [],
        });

        if (!await isDiscordOnlyOwner({ client: Moxi, userId: requesterId })) {
            debugHelper.warn('restart', 'permission denied', { guildId, requesterId });
            return message.reply(
                asV2MessageOptions(
                    buildNoticeContainer({
                        emoji: EMOJIS.cross,
                        text: moxi.translate('NO_PERMISSION', lang),
                    })
                )
            );
        }

        const rawArgs = Array.isArray(args) ? args.map(a => String(a).toLowerCase()) : [];
        const restartAll = rawArgs.includes('--all') || rawArgs.includes('all') || rawArgs.includes('todo') || rawArgs.includes('todos');

        const notice = buildNoticeContainer({
            title: 'Reiniciando',
            emoji: EMOJIS.hourglass,
            text: restartAll
                ? 'Reiniciando **todas** las shards...'
                : 'Reiniciando el bot...'
        });

        await message.reply(asV2MessageOptions(notice)).catch(() => null);

        // Dar tiempo a enviar el mensaje antes de salir.
        const doExit = () => {
            debugHelper.warn('restart', 'exiting process', { guildId, requesterId, restartAll });
            process.exit(0);
        };

        // Si está shardeado, podemos reiniciar todas las shards con broadcastEval.
        if (restartAll && Moxi?.shard && typeof Moxi.shard.broadcastEval === 'function') {
            setTimeout(() => {
                Moxi.shard.broadcastEval(() => {
                    // eslint-disable-next-line no-process-exit
                    process.exit(0);
                }).catch(() => {
                    doExit();
                });

                // Fallback: si por alguna razón broadcastEval no mata esta shard, salir igual.
                setTimeout(doExit, 5000);
            }, 1000);
            return;
        }

        setTimeout(doExit, 1000);
    }
};
