const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><div id="alphaTab"></div>');
global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.Element = dom.window.Element;

const alphaTab = require('@coderline/alphatab');

const tex1 = `\\title "The Beatles-Let It Be(Remastered 2009)"
\\subtitle "1=C（C大调）"
\\track "Guitar"
\\staff {tabs}
\\tuning (E4 B3 G3 D3 A2 E2)
\\tempo 70
\\ts (4 4)
\\defaultSystemsLayout 4
\\chordDiagramsInScore true

\\chord ("Am" 0 1 2 2 0 x)
\\chord ("C" 0 1 0 2 3 x)

\\section "I" "Intro" :8 0.1 { ch "C" } 0.1 0.1 { lyrics "1" } 1.2 3.6 { lyrics "2" } 3.2 4.3 { lyrics "2" } 4.3 |
:8 1.2 { ch "Am" lyrics "1" } 1.2 2.3 { lyrics "1" } 0.5 2.3 { lyrics "1" } 1.2 3.2 { lyrics "2" } 1.2 |
`;

const api = new alphaTab.AlphaTabApi(document.getElementById('alphaTab'), {
    core: { engine: 'svg', useWorkers: false },
    display: { staveProfile: alphaTab.StaveProfile.Tab, padding: [20,0,0,0], stylesheet: { globalDisplayChordDiagramsInScore: true } }
});
api.error.on((e) => console.error("CRASH:", e.message));
api.renderFinished.on(() => console.log("SUCCESS"));
api.tex(tex1);
