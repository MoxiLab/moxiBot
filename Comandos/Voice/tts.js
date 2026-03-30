const { MessageFlags, PermissionsBitField } = require('discord.js');
const { EMOJIS } = require('../../Util/emojis');
const { buildNoticeContainer, asV2MessageOptions } = require('../../Util/v2Notice');
const { speakInVoice } = require('../../Util/discordVoiceTts');

function hasVoicePerms(channel, me) {
	try {
		const perms = channel.permissionsFor(me);
		if (!perms) return false;
		return perms.has(PermissionsBitField.Flags.Connect, true)
			&& perms.has(PermissionsBitField.Flags.Speak, true);
	} catch {
		return false;
	}
}

module.exports = {
	name: 'ttsvoice',
	alias: ['vtts'],
	Category: 'Voice',
	usage: 'ttsvoice <mensaje>',
	description: 'Reproduce un TTS en tu canal de voz (sin Lavalink). Alternativa: tts voz <mensaje>.',
	cooldown: 3,
	command: {
		prefix: true,
		slash: false,
		ephemeral: false,
	},

	async execute(Moxi, message, args) {
		const text = (Array.isArray(args) ? args : []).join(' ').trim();
		if (!text) {
			return message.reply(
				asV2MessageOptions(
					buildNoticeContainer({
						emoji: EMOJIS.cross,
						title: 'TTS (Voz)',
						text: `Uso: ${this.usage}`,
					})
				)
			);
		}

		const vc = message.member?.voice?.channel;
		if (!vc) {
			return message.reply(
				asV2MessageOptions(
					buildNoticeContainer({
						emoji: EMOJIS.cross,
						title: 'TTS (Voz)',
						text: 'Debes estar en un canal de voz.',
					})
				)
			);
		}

		if (!hasVoicePerms(vc, message.guild?.members?.me)) {
			return message.reply(
				asV2MessageOptions(
					buildNoticeContainer({
						emoji: EMOJIS.cross,
						title: 'TTS (Voz)',
						text: 'No tengo permisos para conectar y hablar en ese canal de voz.',
					})
				)
			);
		}

		try {
			const res = await speakInVoice({
				guild: message.guild,
				member: message.member,
				text,
			});

			const queued = res && typeof res.queued === 'number' ? res.queued : 1;
			const reply = await message.channel.send({
				...asV2MessageOptions(
					buildNoticeContainer({
						emoji: EMOJIS.check,
						title: 'TTS (Voz)',
						text: `En cola: ${queued} parte(s).`,
					})
				),
				flags: MessageFlags.IsComponentsV2,
				allowedMentions: { parse: [] },
			}).catch(() => null);

			if (reply) {
				setTimeout(() => reply.delete().catch(() => null), 7000);
			}
			return;
		} catch (err) {
			return message.reply(
				asV2MessageOptions(
					buildNoticeContainer({
						emoji: EMOJIS.cross,
						title: 'TTS (Voz)',
						text: (err && err.message) ? err.message : 'No pude reproducir el TTS en voz.',
					})
				)
			);
		}
	},
};

