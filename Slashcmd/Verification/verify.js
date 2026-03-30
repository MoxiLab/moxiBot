const { PermissionFlagsBits } = require('discord.js');
const { SlashCommandBuilder } = require('../../Util/slashCommandBuilder');

// Alias de /verificacion
const verificacion = require('./verificacion');

module.exports = {
  cooldown: verificacion.cooldown,
  Category: verificacion.Category,

  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Setup image captcha verification')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) 
    .addSubcommand(sub =>
      sub
        .setName('set')
        .setDescription('Configure channel/roles and (optionally) send panel')
        .addChannelOption(o => o.setName('canal').setDescription('Channel where the panel will be').setRequired(true))
        .addRoleOption(o => o.setName('rol_verificado').setDescription('Role to assign after verifying').setRequired(true))
        .addChannelOption(o => o.setName('canal_log').setDescription('Log channel for verification events (default: panel channel)').setRequired(false))
        .addRoleOption(o => o.setName('rol_no_verificado').setDescription('Role to give on join (removed after verifying)').setRequired(false))
        .addStringOption(o =>
          o
            .setName('method')
            .setDescription('Verification type: button | captcha | advanced')
            .addChoices(
              { name: 'Button (1 click)', value: 'button' },
              { name: 'Captcha (image)', value: 'captcha' },
              { name: 'Advanced (captcha + challenge)', value: 'advanced' }
            )
            .setRequired(false)
        )
        .addIntegerOption(o => o.setName('min_account_days').setDescription('Minimum account age (days) to verify').setRequired(false).setMinValue(0))
        .addIntegerOption(o => o.setName('min_join_minutes').setDescription('Minimum minutes since joining to verify').setRequired(false).setMinValue(0))
        .addBooleanOption(o => o.setName('enviar_panel').setDescription('Send the panel now').setRequired(false))
        .addStringOption(o => o.setName('panel_titulo').setDescription('Panel title (use \\n for new lines)').setRequired(false))
        .addStringOption(o => o.setName('panel_texto').setDescription('Panel text (use \\n for new lines)').setRequired(false))
        .addStringOption(o => o.setName('panel_boton').setDescription('Button label').setRequired(false))
        .addStringOption(o => o.setName('panel_imagen').setDescription('https://... image/banner URL').setRequired(false))
        .addStringOption(o => o.setName('panel_color').setDescription('Accent color HEX, e.g. #FF88AA').setRequired(false))
    )
    .addSubcommand(sub =>
      sub
        .setName('panel')
        .setDescription('Send/recreate the panel in the configured channel')
    )
    .addSubcommand(sub =>
      sub
        .setName('status')
        .setDescription('Show verification status')
    )
    .addSubcommand(sub =>
      sub
        .setName('off')
        .setDescription('Disable verification')
    ),

  async run(Moxi, interaction) {
    return verificacion.run(Moxi, interaction);
  },
};
