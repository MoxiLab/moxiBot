const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    EmbedBuilder,
    StringSelectMenuBuilder,
} = require('discord.js');

function fmtPerms(arr) {
    return arr && arr.length ? arr.join(', ') : '—';
}

function describeOverwriteTarget(guild, po) {
    if (!guild || !po) return '—';
    if (po.id === guild.id) return '@everyone';

    const role = guild.roles?.cache?.get(po.id);
    if (role) return `@${role.name}`;

    const member = guild.members?.cache?.get(po.id);
    if (member) return `@${member.user.tag}`;

    return po.id;
}

function classifyOverwrite(guild, po) {
    if (!guild || !po) return 3;
    if (po.id === guild.id) return 0; // everyone
    if (guild.roles?.cache?.has(po.id)) return 1; // role
    if (guild.members?.cache?.has(po.id)) return 2; // member
    return 3;
}

function buildChannelPermsDescription({ guild, channel }) {
    const overwrites = channel?.permissionOverwrites?.cache;
    if (!overwrites || overwrites.size === 0) {
        return 'Este canal no tiene overwrites de permisos.';
    }

    const entries = Array.from(overwrites.values())
        .map((po) => {
            const who = describeOverwriteTarget(guild, po);
            return {
                who,
                allow: fmtPerms(po.allow.toArray()),
                deny: fmtPerms(po.deny.toArray()),
                kind: classifyOverwrite(guild, po),
            };
        })
        .sort((a, b) => {
            if (a.kind !== b.kind) return a.kind - b.kind;
            return a.who.localeCompare(b.who, 'es', { sensitivity: 'base' });
        });

    let description = entries
        .map(
            (e) =>
                `**${e.who}**\n✅ **ALLOW:** ${e.allow}\n⛔ **DENY:** ${e.deny}`
        )
        .join('\n\n');

    // Embed description max 4096. Cortamos conservadoramente.
    if (description.length > 3900) description = `${description.slice(0, 3900)}\n\n...`;
    return description;
}

function buildChannelPermsEmbed({ guild, channel }) {
    const name = channel?.name ? `#${channel.name}` : 'Canal';
    const description = buildChannelPermsDescription({ guild, channel });

    return new EmbedBuilder()
        .setTitle(`Permisos: ${name}`)
        .setDescription(description)
        .setColor(0x5865f2);
}

function listBrowsableChannels(guild) {
    const all = Array.from(guild?.channels?.cache?.values?.() || []);

    // Preferir canales con overwrites (es lo que la gente quiere revisar)
    const withOverwrites = all.filter((ch) => ch?.permissionOverwrites?.cache?.size);
    const chosen = withOverwrites.length ? withOverwrites : all;

    return chosen
        .filter((ch) => ch && ch.name)
        .sort((a, b) => {
            const pa = a.rawPosition ?? a.position ?? 0;
            const pb = b.rawPosition ?? b.position ?? 0;
            return pa - pb;
        });
}

function buildPermsBrowserMessage({ guild, userId, page = 0, selectedChannelId }) {
    const pageSize = 25;
    const channels = listBrowsableChannels(guild);
    const totalPages = Math.max(1, Math.ceil(channels.length / pageSize));
    const safePage = Math.min(Math.max(0, Number(page) || 0), totalPages - 1);

    const start = safePage * pageSize;
    const pageItems = channels.slice(start, start + pageSize);

    const selected =
        (selectedChannelId && guild.channels.cache.get(selectedChannelId)) ||
        pageItems[0] ||
        channels[0] ||
        null;

    const embed = selected
        ? buildChannelPermsEmbed({ guild, channel: selected })
        : new EmbedBuilder()
            .setTitle('Permisos: canales')
            .setDescription('No se encontraron canales para mostrar.')
            .setColor(0x5865f2);

    embed.setFooter({
        text: `Canales con overwrites: ${channels.length} • Página ${safePage + 1}/${totalPages}`,
    });

    const options = pageItems.map((ch) => ({
        label: ch.name.length > 90 ? ch.name.slice(0, 90) : ch.name,
        value: ch.id,
        description: `ID: ${ch.id}`.slice(0, 100),
        default: selected ? ch.id === selected.id : false,
    }));

    const select = new StringSelectMenuBuilder()
        .setCustomId(`perms:select:${userId}:${safePage}`)
        .setPlaceholder('Selecciona un canal')
        .addOptions(options);

    const rowSelect = new ActionRowBuilder().addComponents(select);

    const btnPrev = new ButtonBuilder()
        .setCustomId(`perms:nav:${userId}:${safePage}:prev`)
        .setStyle(ButtonStyle.Secondary)
        .setLabel('◀');

    const btnNext = new ButtonBuilder()
        .setCustomId(`perms:nav:${userId}:${safePage}:next`)
        .setStyle(ButtonStyle.Secondary)
        .setLabel('▶');

    const btnClose = new ButtonBuilder()
        .setCustomId(`perms:nav:${userId}:${safePage}:close`)
        .setStyle(ButtonStyle.Danger)
        .setLabel('Cerrar');

    const rowBtns = new ActionRowBuilder().addComponents(btnPrev, btnClose, btnNext);

    return { embeds: [embed], components: [rowSelect, rowBtns] };
}

module.exports = {
    buildPermsBrowserMessage,
    buildChannelPermsEmbed,
};
