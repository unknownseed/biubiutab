const fs = require('fs');
const content = fs.readFileSync('/Users/unknownseed/Developer/biubiutab/apps/web/node_modules/@coderline/alphatab/dist/alphaTab.d.ts', 'utf8');
console.log(content.match(/postRenderFinished[^;]*;/g));
