const { PermissionsBitField } = require('discord.js');

const { getVerificationConfig } = require('../../../Models/VerifySchema');
const debugHelper = require('../../../Util/debugHelper');

module.exports = async (member) => {
  const guild = member?.guild;
  if (!guild) return;

  const guildId = guild.id;

  const cfg = await getVerificationConfig(guildId).catch((err) => {
    debugHelper.error('verification', 'getVerificationConfig failed (guildMemberAdd)', err);
    return null;
  });

  if (!cfg?.enabled) return;
  if (!cfg?.unverifiedRoleId) return;

  try {
    const me = guild.members.me || await guild.members.fetch(member.client.user.id).catch(() => null);
    if (!me) return;
    if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) return;

    // Evitar errores por jerarquía
    const role = guild.roles.cache.get(cfg.unverifiedRoleId) || await guild.roles.fetch(cfg.unverifiedRoleId).catch(() => null);
    if (!role) return;
    if (role.position >= me.roles.highest.position) return;

    await member.roles.add(role.id, 'Rol no verificado (auto)');
  } catch (err) {
    debugHelper.error('verification', 'assign unverified role failed (guildMemberAdd)', err);
  }
};
