const alphaTab = require('@coderline/alphatab');

const tex1 = "\\title \"Test\"\n\\track \"Guitar\"\n\\staff {tabs}\n\\tempo 120\n:8 0.1 { slashed txt \"Verse\" lyrics \"\\xa0\" lyrics 1 \"\\xa0\" lyrics 2 \"Let\" ch \"C\" } |\n";

try {
    const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(Buffer.from(tex1)));
    console.log("Parsed successfully.");
} catch(e) {
    console.error("Parse CRASH:", e.message);
}
