const os = require('os');

module.exports = {
    name: 'instancia',
    alias: ['instance', 'inst', 'pid', 'host'],
    description: 'Muestra información de la instancia actual del bot (host/pid).',
    usage: 'instancia',
    Category: 'Root',
    cooldown: 5,
    async execute(Moxi, message) {
        const instanceId = (process.env.INSTANCE_ID && String(process.env.INSTANCE_ID).trim())
            ? String(process.env.INSTANCE_ID).trim()
            : '';

        const host = (process.env.HOSTNAME && String(process.env.HOSTNAME).trim())
            ? String(process.env.HOSTNAME).trim()
            : os.hostname();

        const pid = process.pid;
        const node = process.version;
        const uptimeSec = Math.floor(process.uptime());

        const lines = [
            '**Instancia del bot**',
            instanceId ? `• INSTANCE_ID: ${instanceId}` : '• INSTANCE_ID: (no configurado)',
            `• Host: ${host}`,
            `• PID: ${pid}`,
            `• Node: ${node}`,
            `• Uptime: ${uptimeSec}s`,
        ];

        return message.reply({ content: lines.join('\n') });
    }
};
