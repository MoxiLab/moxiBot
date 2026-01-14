const moxi = require('../../i18n');
const { buildBagMessage } = require('../../Util/bagView');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { EMOJIS } = require('../../Util/emojis');

module.exports = {
  name: 'bag',
  alias: ['mochila', 'inventario'],
  Category: function (lang) {
    lang = lang || 'es-ES';
    return moxi.translate('commands:CATEGORY_ECONOMIA', lang);
  },
  usage: 'bag [pagina]',
  get description() {
    return 'Muestra tu mochila (inventario)';
  },

  async execute(Moxi, message, args) {
    const page = args[0] ? Math.max(0, Number(args[0]) - 1) : 0;
    const userId = message.author.id;

    const payload = await buildBagMessage({
      userId,
      viewerId: userId,
      page,
      isPrivate: true,
    });

    // Mostrar siempre en el canal (sin DM)
    return message.reply(payload);
  },
};
