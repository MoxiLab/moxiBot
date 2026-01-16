// Router for select menu interactions
module.exports = async function selectMenuController(interaction, Moxi, logger) {
  const helpSelectMenu = require('./selectMenus/help');
  const channelSelectMenu = require('./selectMenus/channel');
  const shopSelectMenu = require('./selectMenus/shop');
  const permsSelectMenu = require('./selectMenus/perms');
  const bagSelectMenu = require('./selectMenus/bag');
  const zonesSelectMenu = require('./buttons/zones');
  const craftSelectMenu = require('./selectMenus/craft');

  // Zones menus (Pesca / Minería / Exploración)
  if (await zonesSelectMenu(interaction, Moxi, logger)) return;

  // Help menus
  if (await helpSelectMenu(interaction, Moxi, logger)) return;
  // Channel menus
  if (await channelSelectMenu(interaction, Moxi, logger)) return;
  // Shop menus
  if (await shopSelectMenu(interaction, Moxi, logger)) return;
  // Perms menus
  if (await permsSelectMenu(interaction, Moxi, logger)) return;
  // Bag menus
  if (await bagSelectMenu(interaction, Moxi, logger)) return;
  // Craft menus
  if (await craftSelectMenu(interaction, Moxi, logger)) return;
};
