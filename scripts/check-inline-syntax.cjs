const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('index.html', 'utf8');
const blocks = [...html.matchAll(new RegExp('<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>', 'g'))];
if (blocks.length === 0) throw new Error('No inline JavaScript blocks found');
for (const [tag, source] of blocks) {
  if (tag.startsWith('<script ') && tag.slice(0,tag.indexOf('>')).includes('src=')) continue;
  if (!source.trim()) throw new Error('Empty inline JavaScript block');
  new vm.Script(source, { filename: 'index.html' });
}
const required = ['function restoreFile(', 'function openProject(', 'function finish(', 'function backupData(', 'function updateQaCount('];
for (const name of required) {
  if (!html.includes(name)) throw new Error('Critical feature missing: ' + name);
}
console.log('PASS: external scripts skipped, inline JavaScript syntax and critical features verified');
