// 曲のデータ（書き方は sequencer.js の先頭。1 小節 = 16 ステップ）。
// 夏の海辺の町：タイトル、会話、6 か所の営業（港・海水浴場・公園・商店街・灯台・夏まつり）、夜（結果）、エンディング。
// かき鳴らし・分散和音は下の小さな関数で作る（16 個の書き間違いを防ぐ）。

/** 'x' の所に tok、'-' はのばす、それ以外は休み。16 文字。 */
const pat = (p, tok) => p.split('').map((c) => (c === 'x' ? tok : c === '-' ? '-' : '.')).join(' ');
/** 'x' の所に notes を順に。 */
const arp = (p, notes) => { let i = 0; return p.split('').map((c) => (c === 'x' ? notes[i++ % notes.length] : c === '-' ? '-' : '.')).join(' '); };
const STRUM = 'x..x..x.x..x..x.';
const strum = (chord) => pat(STRUM, chord);
const each = (list, f) => list.map(f);

// よく使う和音
const C = {
  F: 'F3+A3+C4', Am: 'A3+C4+E4', Bb: 'Bb3+D4+F4', Cc: 'C4+E4+G4', Dm: 'D3+F3+A3', Gm: 'G3+Bb3+D4',
  G: 'G3+B3+D4', D: 'D3+F#3+A3', Em: 'E3+G3+B3', Bm: 'B2+D3+F#3', A: 'A3+C#4+E4',
};

export const SONGS = {
  // ---------------------------------------------------------------- タイトル（F、ゆったり）
  title: {
    id: 'title', bpm: 100, gain: 1.15,
    tracks: {
      melody: { inst: 'bell', vol: 0.55, pan: 0.1, bars: [
        'A5 - - - C6 - A5 - G5 - - - F5 - - -',
        'E5 - - - G5 - E5 - C5 - - - . . . .',
        'D5 - - - F5 - D5 - Bb4 - - - D5 - F5 -',
        'E5 - - - G5 - - - C6 - - - . . . .',
        'A5 - - - C6 - A5 - G5 - - - F5 - - -',
        'F5 - - - A5 - F5 - D5 - - - . . F5 -',
        'G5 - - - Bb5 - A5 - G5 - - - E5 - - -',
        'F5 - - - - - - - . . . . . . . .',
      ] },
      uke: { inst: 'uke', vol: 0.7, pan: -0.2, bars: each([C.F, C.Am, C.Bb, C.Cc, C.F, C.Dm, C.Gm, C.F], strum) },
      bass: { inst: 'bass', vol: 0.5, bars: each(['F2', 'A1', 'Bb1', 'C2', 'F2', 'D2', 'G1', 'F2'], (r) => pat('x---..x.x---..x.', r)) },
      perc: { inst: 'drums', bars: [{ shaker: 'x.x.x.x.x.x.x.x.' }] },
    },
  },

  // ---------------------------------------------------------------- 会話（C、やさしく）
  story: {
    id: 'story', bpm: 80, gain: 1.0,
    tracks: {
      pad: { inst: 'pad', vol: 0.55, bars: ['C4+E4+G4 - - - - - - - - - - - - - - -', 'B3+D4+G4 - - - - - - - - - - - - - - -', 'A3+C4+E4 - - - - - - - - - - - - - - -', 'F3+A3+C4 - - - - - - - - - - - - - - -'] },
      mar: { inst: 'marimba', vol: 0.5, pan: 0.15, bars: [
        arp('x.x.x.x.x.x.x.x.', ['C5', 'G4', 'E5', 'G4']), arp('x.x.x.x.x.x.x.x.', ['B4', 'G4', 'D5', 'G4']),
        arp('x.x.x.x.x.x.x.x.', ['A4', 'E4', 'C5', 'E4']), arp('x.x.x.x.x.x.x.x.', ['F4', 'C5', 'A4', 'C5']),
      ] },
      bass: { inst: 'bass', vol: 0.35, bars: ['C2 - - - - - - - G1 - - - - - - -', 'B1 - - - - - - - G1 - - - - - - -', 'A1 - - - - - - - E2 - - - - - - -', 'F1 - - - - - - - C2 - - - - - - -'] },
    },
  },

  // ---------------------------------------------------------------- 港（朝、G、さわやか）
  harbor: {
    id: 'harbor', bpm: 112, gain: 0.8,
    tracks: {
      melody: { inst: 'marimba', vol: 0.75, pan: 0.15, bars: [
        'B4 . D5 . G5 - - . F#5 . E5 . D5 - - .',
        'A4 . D5 . F#5 - - . E5 . D5 . A4 - - .',
        'G4 . B4 . E5 - - . D5 . B4 . G4 - - .',
        'E5 . D5 . C5 . B4 . A4 - - - . . . .',
        'B4 . D5 . G5 - - . A5 . G5 . F#5 - - .',
        'A5 . F#5 . D5 - - . E5 . F#5 . A5 - - .',
        'G5 . E5 . B4 - - . C5 . D5 . E5 - - .',
        'D5 - - - B4 - - - G4 - - - . . . .',
      ] },
      uke: { inst: 'uke', vol: 0.6, pan: -0.2, bars: each([C.G, C.D, C.Em, 'C4+E4+G4', C.G, C.D, C.Em, C.D], strum) },
      bass: { inst: 'bass', vol: 0.55, bars: each(['G1', 'D2', 'E2', 'C2', 'G1', 'D2', 'E2', 'D2'], (r) => pat('x--.x.x.x--.x.x.', r)) },
      drums: { inst: 'drums', bars: [{ kick: 'x.......x.......', shaker: 'x.x.x.x.x.x.x.x.', clap: '....x.......x...' }] },
    },
  },

  // ---------------------------------------------------------------- 海水浴場（昼、C、明るいトロピカル）
  beach: {
    id: 'beach', bpm: 124, gain: 0.82,
    tracks: {
      steel: { inst: 'steel', vol: 0.75, pan: 0.15, bars: [
        'E5 . G5 . C6 . G5 . E5 . G5 . A5 - G5 .',
        'F5 . A5 . C6 . A5 . F5 . A5 . G5 - - .',
        'D5 . G5 . B5 . G5 . D6 . B5 . A5 - G5 .',
        'E5 . G5 . C6 - - . . . C6 . B5 . C6 .',
        'C6 . A5 . E5 . A5 . C6 . B5 . A5 - E5 .',
        'F5 . A5 . C6 . D6 . C6 . A5 . F5 - - .',
        'D5 . F5 . G5 . B5 . D6 . B5 . G5 . F5 .',
        'E5 - - - G5 - - - C6 - - - . . . .',
      ] },
      uke: { inst: 'uke', vol: 0.55, pan: -0.25, bars: each([C.Cc, C.F, C.G, C.Cc, C.Am, C.F, C.G, C.Cc], strum) },
      bass: { inst: 'bass', vol: 0.6, bars: each(['C2', 'F1', 'G1', 'C2', 'A1', 'F1', 'G1', 'C2'], (r) => pat('x..x..x.x.x..x..', r)) },
      drums: { inst: 'drums', bars: [{ kick: 'x..x....x..x....', snare: '....x.......x...', shaker: 'xxxxxxxxxxxxxxxx' }, { kick: 'x..x....x..x..x.', snare: '....x.......x.x.', shaker: 'xxxxxxxxxxxxxxxx' }] },
    },
  },

  // ---------------------------------------------------------------- 公園（午後、D、はずむ）
  park: {
    id: 'park', bpm: 116, gain: 0.8,
    tracks: {
      melody: { inst: 'pluck', vol: 0.8, pan: 0.15, bars: [
        'F#5 . A5 . F#5 . D5 . E5 . F#5 . D5 - - .',
        'B4 . D5 . F#5 . D5 . B4 . A4 . B4 - - .',
        'G4 . B4 . D5 . G5 . F#5 . E5 . D5 - B4 .',
        'A4 . C#5 . E5 . A5 . G5 . F#5 . E5 - - .',
        'F#5 . A5 . D6 - - . C#6 . A5 . F#5 - - .',
        'B5 . A5 . F#5 . D5 . E5 . F#5 . B4 - - .',
        'G5 . F#5 . E5 . D5 . E5 . G5 . B5 - - .',
        'A5 - - - E5 - - - D5 - - - . . . .',
      ] },
      mar: { inst: 'marimba', vol: 0.5, pan: -0.25, bars: [
        arp('x.xxx.xxx.xxx.xx', ['D4', 'A4', 'F#4', 'A4']), arp('x.xxx.xxx.xxx.xx', ['B3', 'F#4', 'D4', 'F#4']),
        arp('x.xxx.xxx.xxx.xx', ['G3', 'D4', 'B3', 'D4']), arp('x.xxx.xxx.xxx.xx', ['A3', 'E4', 'C#4', 'E4']),
      ] },
      bass: { inst: 'bass', vol: 0.55, bars: each(['D2', 'B1', 'G1', 'A1'], (r) => pat('x.x.x.x.x.x.x.x.', r)) },
      drums: { inst: 'drums', bars: [{ kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.' }] },
    },
  },

  // ---------------------------------------------------------------- 商店街（夕方、Eb、シティポップふう）
  street: {
    id: 'street', bpm: 102, gain: 0.78,
    tracks: {
      keys: { inst: 'epiano', vol: 0.75, pan: -0.15, bars: [
        pat('x--.x--.x-.x--..', 'Eb4+G4+Bb4+D5'), pat('x--.x--.x-.x--..', 'C4+Eb4+G4+Bb4'),
        pat('x--.x--.x-.x--..', 'Ab3+C4+Eb4+G4'), pat('x--.x--.x-.x--..', 'Bb3+D4+F4+Ab4'),
      ] },
      lead: { inst: 'lead', vol: 0.4, pan: 0.2, bars: [
        'G5 - - . Bb5 - . G5 - - F5 . Eb5 - - .',
        'Eb5 - . D5 - . C5 - - - Bb4 . C5 - - .',
        'C5 - - . Eb5 - . G5 - - Ab5 . G5 - - .',
        'F5 - - - - - - - D5 - - - Bb4 - - .',
        'G5 - - . Bb5 - . C6 - - Bb5 . G5 - - .',
        'Bb5 - . G5 - . Eb5 - - - C5 . Eb5 - - .',
        'Ab5 - - . G5 - . F5 - - Eb5 . C5 - - .',
        'Bb4 - - - - - - - . . . . . . . .',
      ] },
      bass: { inst: 'bass', vol: 0.6, bars: [pat('x..x..x...x.x..x', 'Eb2'), pat('x..x..x...x.x..x', 'C2'), pat('x..x..x...x.x..x', 'Ab1'), pat('x..x..x...x.x..x', 'Bb1')] },
      drums: { inst: 'drums', bars: [{ kick: 'x.....x...x.....', snare: '....x.......x...', hat: 'x.x.x.x.x.x.x.x.' }, { kick: 'x.....x...x...x.', snare: '....x.......x..o', hat: 'x.x.x.x.x.x.xxx.' }] },
    },
  },

  // ---------------------------------------------------------------- 灯台（夕焼け、Am → C、せつなく）
  cape: {
    id: 'cape', bpm: 92, gain: 0.78,
    tracks: {
      pad: { inst: 'pad', vol: 0.5, bars: ['A3+C4+E4 - - - - - - - - - - - - - - -', 'F3+A3+C4 - - - - - - - - - - - - - - -', 'C4+E4+G4 - - - - - - - - - - - - - - -', 'G3+B3+D4 - - - - - - - - - - - - - - -'] },
      arp: { inst: 'pluck', vol: 0.5, pan: -0.2, bars: [
        arp('x.x.x.x.x.x.x.x.', ['A4', 'C5', 'E5', 'C5']), arp('x.x.x.x.x.x.x.x.', ['F4', 'A4', 'C5', 'A4']),
        arp('x.x.x.x.x.x.x.x.', ['G4', 'C5', 'E5', 'C5']), arp('x.x.x.x.x.x.x.x.', ['G4', 'B4', 'D5', 'B4']),
      ] },
      flute: { inst: 'flute', vol: 0.8, pan: 0.15, bars: [
        'E5 - - - - - D5 - C5 - - - B4 - - -',
        'A4 - - - - - - - C5 - - - D5 - - -',
        'E5 - - - G5 - - - E5 - - - D5 - C5 -',
        'D5 - - - - - - - - - - - . . . .',
        'E5 - - - - - G5 - A5 - - - G5 - - -',
        'F5 - - - E5 - - - C5 - - - A4 - - -',
        'C5 - - - E5 - - - G5 - - - E5 - - -',
        'D5 - - - - - - - B4 - - - . . . .',
      ] },
      bass: { inst: 'bass', vol: 0.45, bars: each(['A1', 'F1', 'C2', 'G1'], (r) => pat('x-------x---x---', r)) },
      drums: { inst: 'drums', bars: [{ kick: 'x.......x.......', shaker: '..x...x...x...x.' }] },
    },
  },

  // ---------------------------------------------------------------- 夏まつり（夜、民謡ふうの音階、太鼓と笛）
  festival: {
    id: 'festival', bpm: 120, gain: 0.82,
    tracks: {
      flute: { inst: 'flute', vol: 0.9, pan: 0.1, bars: [
        'D5 - - . F5 - G5 - A5 - - - G5 . F5 .',
        'G5 - - - F5 - D5 - C5 - - - D5 - - -',
        'A5 - - . C6 - A5 - G5 - - - F5 . G5 .',
        'A5 - - - - - - - . . . . . . . .',
        'D6 - - . C6 - A5 - G5 - A5 - C6 - - -',
        'A5 - G5 - F5 - - - G5 - F5 - D5 - - -',
        'F5 - - . G5 - A5 - C6 - - - A5 . G5 .',
        'D5 - - - - - - - . . . . . . . .',
      ] },
      shami: { inst: 'pluck', vol: 0.55, pan: -0.25, bars: [
        arp('x.x.x.x.x.x.x.x.', ['D4', 'A4', 'D5', 'A4']), arp('x.x.x.x.x.x.x.x.', ['C4', 'G4', 'C5', 'G4']),
        arp('x.x.x.x.x.x.x.x.', ['F4', 'C5', 'F5', 'C5']), arp('x.x.x.x.x.x.x.x.', ['D4', 'A4', 'D5', 'A4']),
      ] },
      bass: { inst: 'bass', vol: 0.5, bars: each(['D2', 'C2', 'F2', 'D2'], (r) => pat('x...x...x...x.x.', r)) },
      drums: { inst: 'drums', bars: [{ taiko: 'x...x...x...x.x.', kane: '..x...x...x...x.', clap: '....x.......x...' }, { taiko: 'x..xx...x..xx.xx', kane: '..x...x.x.x...x.', clap: '....x.......x...' }] },
    },
  },

  // ---------------------------------------------------------------- 夜（結果・ショップ。F、くつろぐ）
  evening: {
    id: 'evening', bpm: 88, gain: 0.72,
    tracks: {
      keys: { inst: 'epiano', vol: 0.75, bars: [pat('x---x---x---x---', 'F3+A3+C4+E4'), pat('x---x---x---x---', 'D3+F3+A3+C4'), pat('x---x---x---x---', 'Bb3+D4+F4+A4'), pat('x---x---x---x---', 'C4+E4+G4+Bb4')] },
      bell: { inst: 'bell', vol: 0.35, pan: 0.2, bars: [
        'A5 - - - - - - - C6 - - - - - - -', 'A5 - - - - - - - F5 - - - - - - -', 'D6 - - - - - - - C6 - - - A5 - - -', 'G5 - - - - - - - . . . . . . . .',
      ] },
      bass: { inst: 'bass', vol: 0.45, bars: each(['F2', 'D2', 'Bb1', 'C2'], (r) => pat('x-----x.x-------', r)) },
      drums: { inst: 'drums', bars: [{ kick: 'x.......x.......', hat: '..x...x...x...x.' }] },
    },
  },

  // ---------------------------------------------------------------- エンディング（F、あたたかく、一度だけ流す）
  ending: {
    id: 'ending', bpm: 76, gain: 1.05, loop: false,
    tracks: {
      pad: { inst: 'pad', vol: 0.55, bars: ['F3+A3+C4 - - - - - - - - - - - - - - -', 'C4+E4+G4 - - - - - - - - - - - - - - -', 'D3+F3+A3 - - - - - - - - - - - - - - -', 'Bb3+D4+F4 - - - - - - - - - - - - - - -'] },
      mar: { inst: 'marimba', vol: 0.45, pan: -0.2, bars: [
        arp('x.x.x.x.x.x.x.x.', ['F4', 'C5', 'A4', 'C5']), arp('x.x.x.x.x.x.x.x.', ['E4', 'C5', 'G4', 'C5']),
        arp('x.x.x.x.x.x.x.x.', ['D4', 'A4', 'F4', 'A4']), arp('x.x.x.x.x.x.x.x.', ['D4', 'Bb4', 'F4', 'Bb4']),
      ] },
      flute: { inst: 'flute', vol: 0.75, pan: 0.15, bars: [
        'C6 - - - A5 - - - F5 - - - A5 - - -', 'G5 - - - - - - - E5 - - - - - - -', 'F5 - - - A5 - - - D6 - - - C6 - - -', 'Bb5 - - - A5 - - - G5 - - - - - - -',
        'A5 - - - C6 - - - F6 - - - E6 - - -', 'C6 - - - - - - - G5 - - - - - - -', 'A5 - - - F5 - - - D5 - - - F5 - - -', 'F5 - - - - - - - - - - - - - - -',
      ] },
      bass: { inst: 'bass', vol: 0.4, bars: each(['F1', 'C2', 'D2', 'Bb1'], (r) => pat('x---------------', r)) },
    },
  },
};

// 営業の曲は場所で選ぶ（Game が 'day' の代わりに場所の名前で流す）
export const DAY_SONG = { harbor: 'harbor', beach: 'beach', park: 'park', street: 'street', cape: 'cape', festival: 'festival' };
// 雛形のデモの名前（念のため残す）
SONGS.play = SONGS.harbor;
SONGS.day = SONGS.harbor;
