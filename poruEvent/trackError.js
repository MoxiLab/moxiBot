const logger = require("../Util/logger");

function pickFirstString(...values) {
	for (const v of values) {
		if (typeof v === 'string' && v.trim().length > 0) return v.trim();
	}
	return null;
}

function normalizeError(err) {
	const raw = err?.raw && typeof err.raw === 'object' ? err.raw : err;
	const type = pickFirstString(err?.type, raw?.type);
	const message = pickFirstString(err?.message, raw?.message, raw?.exception?.message);
	const thresholdMs = raw?.thresholdMs ?? err?.thresholdMs;
	return { raw, type, message, thresholdMs };
}

async function bumpStuckState(player) {
	if (!player || typeof player.get !== 'function' || typeof player.set !== 'function') return { count: 0 };
	const now = Date.now();
	const prev = await player.get('stuckState');
	const windowMs = 2 * 60 * 1000;
	let state = prev && typeof prev === 'object' ? prev : { count: 0, firstAt: now };
	if (!state.firstAt || (now - state.firstAt) > windowMs) state = { count: 0, firstAt: now };
	state.count = (Number(state.count) || 0) + 1;
	await player.set('stuckState', state);
	return state;
}

function safeSkipOrDestroy(player, reasonMeta) {
	try {
		if (player && typeof player.skip === 'function') {
			player.skip();
			return;
		}
	} catch (e) {
		logger.error('[poru trackError] skip failed', { ...reasonMeta, message: e?.message || String(e) });
	}

	try {
		if (player && typeof player.destroy === 'function') {
			void Promise.resolve(player.destroy()).catch((e) => {
				logger.error('[poru trackError] destroy failed', { ...reasonMeta, message: e?.message || String(e) });
			});
		}
	} catch (e) {
		logger.error('[poru trackError] destroy threw', { ...reasonMeta, message: e?.message || String(e) });
	}
}

module.exports = (client, player, track, error) => {
	try {
		const guildId = player?.guildId;
		const title = pickFirstString(track?.info?.title);
		const uri = pickFirstString(track?.info?.uri);
		const { raw, type, message, thresholdMs } = normalizeError(error);

		const meta = {
			guildId,
			title,
			uri,
			errorType: type,
			thresholdMs,
			errorMessage: message,
		};

		// Recuperación automática: TrackStuckEvent suele dejar el reproductor colgado.
		if (type === 'TrackStuckEvent') {
			logger.warn('[poru trackError] TrackStuckEvent: intentando recuperar', { ...meta, raw });
			void bumpStuckState(player)
				.then((state) => {
					const reasonMeta = { ...meta, stuckCount: state?.count };
					// Si se repite varias veces en poco tiempo, forzamos reset.
					if ((state?.count || 0) >= 3) {
						logger.error('[poru trackError] TrackStuckEvent repetido: destruyendo player', reasonMeta);
						return safeSkipOrDestroy({ destroy: player?.destroy?.bind(player) }, reasonMeta);
					}
					safeSkipOrDestroy(player, reasonMeta);
				})
				.catch((e) => {
					logger.error('[poru trackError] TrackStuckEvent recovery failed', { ...meta, message: e?.message || String(e) });
				});
			return;
		}

		logger.error('[poru trackError]', { ...meta, raw });
	} catch (e) {
		logger.error('[poru trackError] failed to log', e?.message || e);
	}
};
