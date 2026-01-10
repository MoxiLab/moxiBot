module.exports = async (Moxi, player) => {
    if (!player) return;

    if (player.message) await player.message.delete().catch(() => { });

    if (!player.currentTrack) return;

    if (player.autoplay === true) {
        try {
            const trackSearch = player.currentTrack.info;
            const isYouTube = /^(https?:\/\/)?(www\.)?(m\.)?(music\.)?(youtube\.com|youtu\.?be)\/.+$/gi.test(trackSearch.uri);
            const isSpotify = /^(https?:\/\/)?(open\.spotify\.com)\/.+$/gi.test(trackSearch.uri);

            if (isYouTube) {
                const identifier = trackSearch.identifier;
                const search = `https://music.youtube.com/watch?v=${identifier}&list=RD${identifier}`;
                const res = await Moxi.poru.resolve({
                    query: search,
                    source: "ytsearch",
                    requester: trackSearch.requester,
                });

                if (res && res.tracks.length > 0) {
                    for (let i = 0; i < 2; i++) {
                        const songIndex = Math.floor(Math.random() * Math.min(res.tracks.length, 10));
                        player.queue.add(res.tracks[songIndex]);
                    }
                }
            } else if (isSpotify) {
                const search = `artist:${trackSearch.author}`;
                const res = await Moxi.poru.resolve({
                    query: search,
                    source: "spotify",
                    requester: trackSearch.requester,
                });

                if (res && res.tracks.length > 0) {
                    const filteredTracks = res.tracks.filter(t => t.info.identifier !== trackSearch.identifier);
                    for (let i = 0; i < 2; i++) {
                        const songIndex = Math.floor(Math.random() * filteredTracks.length);
                        if (filteredTracks[songIndex]) player.queue.add(filteredTracks[songIndex]);
                    }
                }
            }
        } catch (error) {
            console.error("Error en Autoplay:", error);
        }
    }
};