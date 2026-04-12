const str = `:8 0.1 { ch "Am" lyrics "2" } 0.1 0.1 { lyrics "1" } 3.6 3.6 { lyrics "5" } 3.1 4.3 { lyrics "5" } 6.2 |`;
const str2 = `:8 r 0.1 { ch "Fmaj7" } 1.1 { lyrics "2" } 3.5 3.5 { lyrics " " lyrics 1 " " lyrics 2 "When" } 3.5 3.5 { lyrics "b5" lyrics 1 " " lyrics 2 "I" } 5.3 |`;
const regex = /\blyrics(?:\s+\d+)?\s+"([^"\\]|\\.)*"/g;
console.log(str.replace(regex, ""));
console.log(str2.replace(regex, ""));
