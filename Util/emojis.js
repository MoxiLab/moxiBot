// Emoji registry centralizado.
// - Usar estas claves en código.
// - En traducciones, si aparece un emoji custom (formato <a:name:id> o <:name:id>),
//   `moxi.translate` lo normaliza a la versión definida aquí por `name`.
// Nota: para evitar hardcodear tokens `<:name:id>` como texto, guardamos `name/id/animated`
// y generamos el string en runtime.

function fmtCustom({ name, id, animated = false }) {
    // Construcción por piezas para evitar dejar tokens completos en el source.
    return ['<', animated ? 'a' : '', ':', name, ':', String(id), '>'].join('');
}

const CUSTOM = Object.freeze({
    nowPlayingAnim: { animated: true, name: '170', id: '1010374674963771484' },
    studioAnim: { animated: true, name: '220', id: '1009191919533965424' },

    Icon: { animated: false, name: 'Icon', id: '1148030941181247518' },
    pause1: { animated: false, name: 'pause1', id: '1153491520146636950' },
    icon: { animated: false, name: 'icon', id: '1148030938274607126' },
    queue: { animated: false, name: 'queue', id: '1153522688380379176' },
    infinito: { animated: false, name: 'infinito', id: '1157897232109031484' },

    greendot: { animated: false, name: 'greendot', id: '1153354364451295434' },
    Okaa642: { animated: false, name: 'Okaa642', id: '1159924232256491560' },
    trackAddAnim: { animated: true, name: '99', id: '1015805142840389632' },
    reload: { animated: true, name: 'reload', id: '1455501217542438923' },
    emoji_1767091260450: { animated: true, name: 'emoji_1767091260450', id: '1455510983715061815' },
});

const UNICODE_CODEPOINT_TO_KEY = Object.freeze({
    // Mapa de emojis Unicode (por codepoint hex) -> clave dentro de EMOJIS
    // Ejemplo: U+2705 (\u2705) -> check
    '2705': 'check',
    '274C': 'cross',
    '1F50A': 'volUp',
    '1F509': 'volDown',
    '1F3B6': 'musicNotes',
    '1F501': 'repeat',
    '1F3D3': 'pingPong',
    'A9': 'copyright',
    '2139': 'info',
    '23ED': 'skipNext',
    '23F3': 'hourglass',
    '26AA': 'whiteCircle',
    '26D4': 'noEntry',
    '2753': 'question',
    '27A1': 'arrowRight',
    '2B05': 'arrowLeft',
    '1F30D': 'earth',
    '1F310': 'globe',
    '1F31F': 'star',
    '1F32C': 'wind',
    '1F343': 'leaf',
    '1F354': 'burger',
    '1F35F': 'fries',
    '1F361': 'dango',
    '1F3A8': 'art',
    '1F3B5': 'musicSingle',
    '1F3E0': 'home',
    '1F4A7': 'droplet',
    '1F4C2': 'folder',
    '1F4D6': 'book',
    '1F4DC': 'scroll',
    '1F4E8': 'mail',
    '1F4E6': 'package',
    '1F522': 'numbers',
    '1F534': 'redCircle',
    '1F4A3': 'bomb',
    '1F355': 'pizza',
    '1F6D1': 'stopSign',
    '1F6E1': 'shield',
    '1F32D': 'hotdog',
    '1F389': 'party',
    '1F7E0': 'orangeCircle',
    '1F7E1': 'yellowCircle',
    '1F7E2': 'greenCircle',
    '1F916': 'robot',
    '1F9C7': 'waffle',
    '1F9C8': 'butter',
    '1F9CA': 'iceCube',
    '1F9E7': 'redEnvelope',
    '1F464': 'person',
    '1F50A': 'volUp',
    '1F509': 'volDown',
    '1F517': 'link',
    '1F601': 'smileGrin',
    '1F604': 'smileGrinBig',
    '1F60A': 'smileSmile',

    // Símbolos usados en UI
    '2713': 'tick',
});

const EMOJIS = Object.freeze({
    // Música (panel / botones)
    nowPlayingAnim: fmtCustom(CUSTOM.nowPlayingAnim),
    studioAnim: fmtCustom(CUSTOM.studioAnim),

    // Nombres "crudos" que aparecen en texto (para normalizar por nombre)
    '170': fmtCustom(CUSTOM.nowPlayingAnim),
    '220': fmtCustom(CUSTOM.studioAnim),

    Icon: fmtCustom(CUSTOM.Icon),
    pause1: fmtCustom(CUSTOM.pause1),
    icon: fmtCustom(CUSTOM.icon),
    queue: fmtCustom(CUSTOM.queue),
    infinito: fmtCustom(CUSTOM.infinito),

    // Unicode (no personalizados) — en escapes para evitar emojis visibles fuera de Discord
    volDown: '\u{1F509}',
    volUp: '\u{1F50A}',
    copyright: '\u00A9',
    info: '\u2139',
    skipNext: '\u23ED',
    hourglass: '\u23F3',
    whiteCircle: '\u26AA',
    noEntry: '\u26D4',
    question: '\u2753',
    arrowRight: '\u27A1',
    arrowLeft: '\u2B05',
    earth: '\u{1F30D}',
    globe: '\u{1F310}',
    star: '\u{1F31F}',
    wind: '\u{1F32C}',
    leaf: '\u{1F343}',
    burger: '\u{1F354}',
    fries: '\u{1F35F}',
    dango: '\u{1F361}',
    art: '\u{1F3A8}',
    musicSingle: '\u{1F3B5}',
    home: '\u{1F3E0}',
    droplet: '\u{1F4A7}',
    folder: '\u{1F4C2}',
    book: '\u{1F4D6}',
    scroll: '\u{1F4DC}',
    mail: '\u{1F4E8}',
    package: '\u{1F4E6}',
    numbers: '\u{1F522}',
    redCircle: '\u{1F534}',
    bomb: '\u{1F4A3}',
    pizza: '\u{1F355}',
    stopSign: '\u{1F6D1}',
    shield: '\u{1F6E1}',
    hotdog: '\u{1F32D}',
    party: '\u{1F389}',
    orangeCircle: '\u{1F7E0}',
    yellowCircle: '\u{1F7E1}',
    greenCircle: '\u{1F7E2}',
    robot: '\u{1F916}',
    waffle: '\u{1F9C7}',
    butter: '\u{1F9C8}',
    iceCube: '\u{1F9CA}',
    redEnvelope: '\u{1F9E7}',
    person: '\u{1F464}',
    link: '\u{1F517}',
    smileGrin: '\u{1F601}',
    smileGrinBig: '\u{1F604}',
    smileSmile: '\u{1F60A}',

    // Unicode comunes en traducciones
    check: '\u2705',
    cross: '\u274C',
    tick: '\u2713',
    musicNotes: '\u{1F3B6}',
    repeat: '\u{1F501}',
    pingPong: '\u{1F3D3}',

    // Traducciones (misc.json): normalización por nombre
    greendot: fmtCustom(CUSTOM.greendot),
    Okaa642: fmtCustom(CUSTOM.Okaa642),
    '99': fmtCustom(CUSTOM.trackAddAnim),
    reload: fmtCustom(CUSTOM.reload),
    emoji_1767091260450: fmtCustom(CUSTOM.emoji_1767091260450),
});

function toEmojiObject(emoji) {
    if (!emoji) return undefined;
    if (typeof emoji === 'object') return emoji;
    if (typeof emoji !== 'string') return undefined;

    const trimmed = emoji.trim();
    if (!trimmed) return undefined;

    // Custom emoji token: <:name:id> o <a:name:id>
    const m = trimmed.match(/^<(a)?:([^:]+):(\d+)>$/);
    if (m) {
        return {
            animated: Boolean(m[1]),
            name: m[2],
            id: m[3],
        };
    }

    // Unicode emoji (o cualquier nombre) -> Discord espera { name }
    return { name: trimmed };
}

module.exports = { EMOJIS, UNICODE_CODEPOINT_TO_KEY, toEmojiObject };
