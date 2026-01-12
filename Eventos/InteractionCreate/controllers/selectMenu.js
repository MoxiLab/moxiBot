// Router for select menu interactions
module.exports = async function selectMenuController(interaction, Moxi, logger) {
  const helpSelectMenu = require('./selectMenus/help');
  const channelSelectMenu = require('./selectMenus/channel');

  // Help menus
  if (await helpSelectMenu(interaction, Moxi, logger)) return;
  // Channel menus
  if (await channelSelectMenu(interaction, Moxi, logger)) return;
};
