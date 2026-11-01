const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const scripts = [...html.matchAll(/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/g)];
if (!scripts.length) throw new Error('No inline scripts found');
for (const [, code] of scripts) new vm.Script(code, { filename: 'index.html' });
console.log('Inline JavaScript syntax passed');
