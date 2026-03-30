require('../Util/silentDotenv')();

const { ensureMongoConnection, mongoose } = require('../Util/mongoConnect');
const { enqueuePlaygroundJob } = require('../Util/playgroundJobs');

async function main() {
    await ensureMongoConnection();

    // Ejemplo de payload que luego tu web puede renderizar como preview
    const payload = {
        message: {
            content: 'Preview de prueba',
            embeds: [
                {
                    title: 'Título',
                    description: 'Descripción del preview',
                    color: 0x5865F2,
                },
            ],
        },
    };

    const job = await enqueuePlaygroundJob('playground:preview', payload, {
        botId: process.env.CLIENT_ID || process.env.BOT_ID,
        runAt: new Date(),
        priority: 10,
    });

    console.log('Enqueued playground job:', String(job._id));

    await mongoose.disconnect().catch(() => null);
}

main().catch((e) => {
    console.error('enqueuePlaygroundPreview failed:', e);
    process.exit(1);
});
