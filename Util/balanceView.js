const {
    ContainerBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
} = require('discord.js');

const { ensureMongoConnection } = require('./mongoConnect');
const moxi = require('../i18n');
const { Bot } = require('../Config');
const { EMOJIS } = require('./emojis');

function formatInt(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return '0';
    return Math.trunc(x).toLocaleString('en-US');
}

function buildBalanceButtons({ viewerId, targetId } = {}) {
    const canAct = String(viewerId) === String(targetId);

    const deposit = new ButtonBuilder()
        .setCustomId(`bal:deposit:${viewerId}:${targetId}`)
        .setLabel('Depositar')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📥')
        .setDisabled(!canAct);

    const withdraw = new ButtonBuilder()
        .setCustomId(`bal:withdraw:${viewerId}:${targetId}`)
        .setLabel('Retirar')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📤')
        .setDisabled(!canAct);

    const refresh = new ButtonBuilder()
        .setCustomId(`bal:refresh:${viewerId}:${targetId}`)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔁');

    return [deposit, withdraw, refresh];
}

function parseBalanceCustomId(customId) {
    const raw = String(customId || '');
    if (!raw.startsWith('bal:')) return null;
    const parts = raw.split(':');
    // bal:action:viewerId:targetId
    const action = parts[1] || null;
    const viewerId = parts[2] || null;
    const targetId = parts[3] || null;
    if (!action || !viewerId || !targetId) return null;
    return { action, viewerId, targetId };
}

async function getOrCreateEconomyRaw(userId) {
    if (!process.env.MONGODB) throw new Error('MongoDB no está configurado (MONGODB vacío).');
    await ensureMongoConnection();
    const { Economy } = require('../Models/EconomySchema');

    try {
        await Economy.updateOne(
            { userId },
            { $setOnInsert: { userId, balance: 0, bank: 0, sakuras: 0, inventory: [] } },
            { upsert: true }
        );
    } catch (e) {
        if (e?.code !== 11000) throw e;
    }

    return Economy.findOne({ userId });
}

async function getGlobalBalanceRank(balance) {
    await ensureMongoConnection();
    const { Economy } = require('../Models/EconomySchema');
    const b = Number(balance);
    const safe = Number.isFinite(b) ? b : 0;
    const higher = await Economy.countDocuments({ balance: { $gt: safe } });
    return Math.max(1, (higher || 0) + 1);
}

async function buildBalanceMessage({ guildId, lang, viewerId, targetUser } = {}) {
    const language = lang || (await moxi.guildLang(guildId, process.env.DEFAULT_LANG || 'es-ES'));

    const targetId = targetUser?.id;
    const eco = await getOrCreateEconomyRaw(targetId);

    const balance = eco?.balance ?? 0;
    const bank = eco?.bank ?? 0;
    const sakuras = eco?.sakuras ?? 0;
    const rank = await getGlobalBalanceRank(balance);

    const titleName = targetUser?.username || 'Usuario';
    const title = `Balance de ${titleName}`;

    const container = new ContainerBuilder()
        .setAccentColor(Bot.AccentColor)
        .addTextDisplayComponents(t =>
            t.setContent(
                `# ${title}\n\n` +
                `${EMOJIS.coin || '🪙'} **Coins:** ${formatInt(balance)}\n` +
                `🏦 **Banco:** ${formatInt(bank)}\n` +
                `🌸 **Sakuras:** ${formatInt(sakuras)}\n\n` +
                `Rango Global: **#${formatInt(rank)}**`
            )
        )
        .addActionRowComponents(row => row.addComponents(...buildBalanceButtons({ viewerId, targetId })));

    return {
        content: '',
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { repliedUser: false },
    };
}

module.exports = {
    parseBalanceCustomId,
    buildBalanceMessage,
    getOrCreateEconomyRaw,
};
