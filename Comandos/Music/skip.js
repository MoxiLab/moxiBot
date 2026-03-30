// Comando de prefijo: skip
// Reutiliza la lógica del subcomando "skip" de musica.js (slash)

const musica = require('../../Slashcmd/Musica/musica.js');
const moxi = require('../../i18n');
const debugHelper = require('../../Util/debugHelper');

module.exports = {
	name: "skip",
	alias: ["s", "next", "salta", "saltar"],
	Category: function (lang) {
		lang = lang || 'es-ES';
		return moxi.translate('commands:CATEGORY_MUSICA', lang);
	},
	usage: 'skip',
	description: function (lang) { return moxi.translate('commands:CMD_SKIP_DESC', lang || 'es-ES'); },
	async execute(Moxi, message, args) {
		const guildId = message.guild?.id;
		const requesterId = message.author?.id;
		debugHelper.log('skip', 'prefix execute start', { guildId, requesterId });
		const lang = await moxi.guildLang(message.guild?.id, process.env.DEFAULT_LANG || 'es-ES');
		const fakeInteraction = {
			guild: message.guild,
			guildId: message.guild.id,
			member: message.member,
			channel: message.channel,
			user: message.author,
			options: {
				getSubcommand: () => 'skip',
			},
			reply: async (payload) => message.reply(payload),
			editReply: async (payload) => message.reply(payload),
			deferReply: async () => { },
			lang,
		};
		await musica.run(Moxi, fakeInteraction);
	}
};
