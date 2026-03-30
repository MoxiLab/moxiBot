const { MessageFlags } = require('discord.js');
const { setUserPrefix } = require('../../../../Util/userPrefix');

function getModalTextValue(interaction, customId) {
    try {
        const viaResolver = interaction?.components?.getTextInputValue?.(customId);
        if (typeof viaResolver === 'string') return viaResolver;
    } catch {
    }

    try {
        const direct = interaction?.fields?.getTextInputValue?.(customId);
        if (typeof direct === 'string') return direct;
    } catch {
    }

    try {
        const fields = interaction?.fields?.fields;
        if (fields && typeof fields.get === 'function') {
            const item = fields.get(customId);
            if (item && typeof item.value === 'string') return item.value;

            if (typeof fields.values === 'function') {
                for (const value of fields.values()) {
                    const fieldId = value?.customId || value?.custom_id || value?.data?.custom_id;
                    const fieldValue = value?.value || value?.data?.value;
                    if (String(fieldId) === String(customId) && typeof fieldValue === 'string') {
                        return fieldValue;
                    }
                }
            }

            if (typeof fields.size === 'number' && fields.size === 1 && typeof fields.values === 'function') {
                const only = fields.values().next?.().value;
                const onlyValue = only?.value || only?.data?.value;
                if (typeof onlyValue === 'string') return onlyValue;
            }

            if (typeof fields.first === 'function') {
                const only = fields.first();
                const onlyValue = only?.value || only?.data?.value;
                if (typeof onlyValue === 'string') return onlyValue;
            }
        }
    } catch {
    }

    return '';
}

module.exports = async function userPrefixModalHandler(interaction) {
    if (!interaction.isModalSubmit?.()) return false;
    if (!interaction.customId?.startsWith('user_prefix_modal:')) return false;

    const ownerId = interaction.customId.split(':')[1] || '';

    if (!ownerId || interaction.user?.id !== ownerId) {
        await interaction.reply({
            content: 'Solo el autor del comando puede completar este modal.',
            flags: MessageFlags.Ephemeral,
        }).catch(() => null);
        return true;
    }

    const guildId = interaction.guildId || interaction.guild?.id;
    if (!guildId) {
        await interaction.reply({
            content: 'Este modal solo funciona dentro de un servidor.',
            flags: MessageFlags.Ephemeral,
        }).catch(() => null);
        return true;
    }

    let newPrefix;
    try {
        newPrefix = String(getModalTextValue(interaction, 'prefix_value') ?? '').trim();
    } catch (err) {
        await interaction.reply({
            content: `Error leyendo el valor del modal: ${err?.message || err}`,
            flags: MessageFlags.Ephemeral,
        }).catch(() => null);
        return true;
    }

    if (!newPrefix) {
        await interaction.reply({
            content: 'El prefijo no puede estar vacio.',
            flags: MessageFlags.Ephemeral,
        }).catch(() => null);
        return true;
    }

    if (newPrefix.length > 20) {
        await interaction.reply({
            content: 'El prefijo no puede tener mas de 20 caracteres.',
            flags: MessageFlags.Ephemeral,
        }).catch(() => null);
        return true;
    }

    let ok;
    try {
        ok = await setUserPrefix(guildId, ownerId, newPrefix);
    } catch (err) {
        await interaction.reply({
            content: `Error al guardar el prefijo: ${err?.message || err}`,
            flags: MessageFlags.Ephemeral,
        }).catch(() => null);
        return true;
    }
    if (!ok) {
        await interaction.reply({
            content: 'No se pudo guardar tu prefijo personal. Intenta de nuevo.',
            flags: MessageFlags.Ephemeral,
        }).catch(() => null);
        return true;
    }

    await interaction.reply({
        content: `Tu prefijo personal ahora es **\`${newPrefix}\`**.`,
        flags: MessageFlags.Ephemeral,
    }).catch(() => null);

    return true;
};
