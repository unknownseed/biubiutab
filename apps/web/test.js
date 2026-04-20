const a = require('/Users/unknownseed/Developer/biubiutab/apps/web/node_modules/@coderline/alphatab/dist/alphaTab.js');
console.log(Object.keys(new a.EngravingSettings()).filter(k => /pad|space|margin|height|number/i.test(k)));
