// Router for select menu interactions
module.exports = async function selectMenuController(interaction, Moxi, logger) {
  const helpSelectMenu = require('./selectMenus/help');

  // Help menus
  if (await helpSelectMenu(interaction, Moxi, logger)) return;
};
