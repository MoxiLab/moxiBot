// birthdayGifs.js
// Agrega o quita GIFs aquí para personalizar los anuncios de cumpleaños.
// El bot elige uno al azar cada vez que hace un anuncio.
// Si tienes BIRTHDAY_BANNER_URL en tu .env, se usará ese en lugar de esta lista.

const BIRTHDAY_GIFS = [
    // Black Clover - Asta con pastel en la cara
    'https://media1.tenor.com/m/r2IPKn3VaTwAAAAd/happy-birthday-anime.gif',
    // Anime - personajes gritando happy birthday
    'https://media1.tenor.com/m/LfB0AQWXPrAAAAAd/happy-japanese-anime.gif',
    // Jujutsu Kaisen - Gojo "it's your bday!"
    'https://media1.tenor.com/m/Tw-ZWB0YzuYAAAAd/jujutsu-kaisen.gif',
    // Pikachu con gorro de cumpleaños
    'https://media1.tenor.com/m/lb8n3znXeFQAAAAd/pokemon-happy-birthday.gif',
    // Sailor Moon - tarjeta de cumpleaños (versión 1)
    'https://media1.tenor.com/m/w-K9-hGOHcMAAAAd/llorar.gif',
    // Sailor Moon - sosteniendo pastel de cumpleaños (versión 2)
    'https://media1.tenor.com/m/kyO3SHt98icAAAAd/happy-birthday-anime.gif',
    // Momo - The Gamer (VTuber)
    'https://media1.tenor.com/m/p8INKJnvpN8AAAAd/momo-momo-the-gamer.gif',
    // Anya - Spy x Family
    'https://media1.tenor.com/m/Egxl8TRxwT4AAAAd/happy-birthday-anya.gif',
    // Rengoku - Kimetsu no Yaiba (Demon Slayer)
    'https://media1.tenor.com/m/hyg-rgbfHhAAAAAd/rengoku-kyojuro.gif',
    // Dragon Ball - "Just Saiyan Happy Birthday"
    'https://media1.tenor.com/m/0qZF3nQt7kAAAAAd/happybirthday.gif',
    // Project SEKAI - Mizuki Akiyama (sticker)
    'https://media.tenor.com/qVyS769JFFcAAAAj/pjsk-pjsk-stickers.gif',
    // Fairy Tail - Gray y Juvia celebrando
    'https://media1.tenor.com/m/av0tjPpLV48AAAAd/fairy-tail-happy-birthday.gif',
    // Clannad - Nagisa Furukawa soplando velas
    'https://media1.tenor.com/m/Ka3CyVdTwXoAAAAd/clannad-nagisa-furukawa.gif',
    // A Silent Voice - chica con gorro "party time"
    'https://media1.tenor.com/m/3y87ar7ze3wAAAAd/party-time-anime.gif',
    // Frieren - frente al pastel de cumpleaños con velas
    'https://media1.tenor.com/m/gDVIQTDnZEYAAAAd/frieren-birthday.gif',
    // Lucky Star - Konata dice "happy birthday"
    'https://media1.tenor.com/m/MvPvyKfXVCwAAAAd/lucky-star-anime.gif',
    // Sora Yori mo Tooi Basho - confeti de cumpleaños
    'https://media1.tenor.com/m/swpACfhAsq0AAAAd/yorimoi-sora-yori.gif',
    // Mythikore VTuber - anime girl con pastel
    'https://media.tenor.com/kCZKieKxGmYAAAAj/mythikore-anime-girl.gif',
    // Anime girl - tarjeta "happy birthday" con abrazo (sticker)
    'https://media.tenor.com/zk5reehZpQ4AAAAj/geburtstag-happy-birthday.gif',
    // Bang Dream - Roselia Sayo Hikawa (sticker birthday)
    'https://media.tenor.com/5WyVSo68xO0AAAAj/bang-dream-roselia.gif',
    // Happiness Charge PreCure - pastel de cumpleaños
    'https://media1.tenor.com/m/3TOetb_9vQYAAAAd/happiness-charge-precure-precure.gif',
    // Anime pixel art - chica con gorro y cañón confeti (sticker)
    'https://media.tenor.com/aUcOFyL_3yUAAAAj/anime.gif',
    // Anime chica maid bailando "happy birthday"
    'https://media1.tenor.com/m/YNHT2hPxGawAAAAd/happy-birthday.gif',
    // Anime chica bailando "happy birthday i love you"
    'https://media1.tenor.com/m/_ZA3BjJmTmAAAAAd/subarashi-wakata.gif',
    // Tower of Fantasy - Liu Huo feliz cumpleaños (videojuego anime)
    'https://media1.tenor.com/m/QPALglD0I24AAAAd/liu-huo-happy-birthday.gif',
    // Super Sonico - "happy birthday" con pastel
    'https://media1.tenor.com/m/9uEE_mAQtDYAAAAd/super-sonico-sonico.gif',
    // Anime rubia soplando velas en pastel con fresas
    'https://media1.tenor.com/m/ESBGbKnIl_YAAAAd/happy-birthday.gif',
];

/**
 * Devuelve un GIF aleatorio de la lista.
 * Si BIRTHDAY_BANNER_URL está definido en el .env, lo usa en su lugar.
 */
function pickBirthdayGif() {
    const custom = String(process.env.BIRTHDAY_BANNER_URL || '').trim();
    if (custom) return custom;
    if (!BIRTHDAY_GIFS.length) return null;
    return BIRTHDAY_GIFS[Math.floor(Math.random() * BIRTHDAY_GIFS.length)];
}

module.exports = { BIRTHDAY_GIFS, pickBirthdayGif };
