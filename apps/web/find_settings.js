const fs = require('fs');
const content = fs.readFileSync('/Users/unknownseed/Developer/biubiutab/apps/web/node_modules/@coderline/alphatab/dist/alphaTab.d.ts', 'utf8');
const lines = content.split('\n');
const paddingLines = lines.filter(l => l.toLowerCase().includes('padding') || l.toLowerCase().includes('margin') || l.toLowerCase().includes('spacing'));
console.log('Padding/Margin/Spacing lines:');
console.log(paddingLines.join('\n'));
