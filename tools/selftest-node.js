// Autotest dei moduli senza browser.
// Uso:  node tools/selftest-node.js [--only tcp,nat] [--n 100]
// Controlla, per ogni modulo e livello, che la soluzione modello prenda il 100%,
// che gli aiuti esistano per ogni campo e che le tracce coincidano con i PDF.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const only = opt('only', null);
const n = Number(opt('n', 60));

const ctx = { window: {}, console, Math, JSON, Date };
ctx.window.window = ctx.window;
vm.createContext(ctx);
const files = ['util.js', 'gen-vlsm.js', 'gen-protocols.js', 'gen-nat.js', 'gen-tcp.js', 'gen-sdn.js', 'gen-http.js', 'gen-cwnd.js', 'gen-theory.js', 'selftest.js'];
for (const f of files) {
  const p = path.join(root, 'js', f);
  if (!fs.existsSync(p)) { console.log(`(manca js/${f}: saltato)`); continue; }
  try {
    vm.runInContext(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''), ctx, { filename: f });
  } catch (e) {
    console.log(`✗ errore caricando js/${f}:\n${e.stack}`);
    process.exitCode = 1;
  }
}
const RA = ctx.window.RetiApp;
const res = RA.selftest.run({ n, only: only ? only.split(',') : null });
console.log(res.info.join('\n'));
if (res.errors.length) {
  console.log(`\n✗ ${res.errors.length} errori:`);
  console.log(res.errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log('\n✓ nessun errore');
}
