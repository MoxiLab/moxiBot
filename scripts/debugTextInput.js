const d = require('discord.js');
const t = new d.TextInputBuilder();
console.log('TextInputBuilder:', t.constructor?.name);
console.log('has setCustomId:', typeof t.setCustomId);
console.log('has setLabel:', typeof t.setLabel);
const r = t.setCustomId('x');
console.log('setCustomId return type:', r?.constructor?.name);
console.log('return has setLabel:', typeof r?.setLabel);
