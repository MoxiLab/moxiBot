const getHelpContent = require('../Util/getHelpContent');

(async () => {
  const mkCmd = (name, cat) => ({
    name,
    Category: () => cat,
    description: 'x',
    command: { Prefix: true },
  });

  const client = {
    commands: new Map([
      ['a', mkCmd('a', 'Tools')],
      ['b', mkCmd('b', 'Economy')],
      ['c', mkCmd('c', 'Music')],
      ['d', mkCmd('d', 'Fun')],
      ['e', mkCmd('e', 'Games')],
      ['f', mkCmd('f', 'Admin')],
      ['g', mkCmd('g', 'Moderation')],
      ['h', mkCmd('h', 'Welcome')],
      ['i', mkCmd('i', 'Social')],
      ['j', mkCmd('j', 'Tickets')],
    ]),
    slashcommands: new Map(),
    user: { username: 'Test' },
  };

  const help = await getHelpContent({ client, lang: 'es-ES', userId: '1', guildId: null, useV2: true });
  const json = help.components[0].toJSON();

  const options = json.components?.[4]?.components?.[0]?.options || [];
  const first = options[0];

  console.log('options:', options.length);
  if (!first) {
    console.log('No options built');
    process.exit(0);
  }

  console.log('first option emoji typeof:', typeof first.emoji);
  console.log('first option emoji value:', first.emoji);
})();
