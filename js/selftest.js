// ============================================================
// RetiApp · selftest.js — controlli automatici dei moduli
// In Node:     node tools/selftest-node.js
// Nel browser: index.html?selftest  (aggiunge i controlli sul disegno)
// ============================================================
(function () {
  const RA = window.RetiApp;
  const U = RA.util;
  const MOD_IDS = ['vlsm', 'protocols', 'nat', 'tcp', 'sdn', 'http', 'cwnd', 'theory', 'l2', 'subnet', 'dv', 'crypto', 'tls', 'mac', 'theory2'];

  // n esercizi per livello e per modulo
  function run(opts) {
    opts = opts || {};
    const N = opts.n || 60;
    const only = opts.only ? [].concat(opts.only) : null;
    const errors = [];
    const info = [];
    // errori raggruppati: lo stesso messaggio su più esercizi compare una volta sola, con il conteggio
    const seen = {};
    const err = (mod, msg) => {
      const sig = `[${mod}] ` + msg.replace(/^(livello \d|traccia [\w-]+): /, '');
      if (seen[sig]) { seen[sig].n++; return; }
      seen[sig] = { n: 1 };
      errors.push(() => `[${mod}] ${msg}` + (seen[sig].n > 1 ? `  (×${seen[sig].n})` : ''));
    };

    MOD_IDS.filter(id => RA[id] && (!only || only.includes(id))).forEach(id => {
      const mod = RA[id];
      ['build', 'randomParams', 'gen', 'grade', 'sol2answers', 'render', 'solution', 'hints', 'steps', 'fieldHint', 'diagnose', 'chatText']
        .forEach(f => { if (typeof mod[f] !== 'function') err(id, `manca la funzione ${f}`); });
      if (errors.length) return;
      let count = 0;
      const sigs = {};
      for (let lv = 1; lv <= 5; lv++) {
        sigs[lv] = new Set();
        for (let i = 0; i < N; i++) {
          let ex;
          try { ex = mod.gen(lv); } catch (e) { err(id, `gen(${lv}) lancia: ${e.stack || e}`); break; }
          checkEx(id, mod, ex, `livello ${lv}`, err);
          sigs[lv].add(JSON.stringify(mod.sol2answers(ex)));
          count++;
        }
      }
      const variety = [1, 2, 3, 4, 5].map(lv => sigs[lv].size).join('/');
      info.push(`${id}: ${count} esercizi controllati · soluzioni diverse per livello: ${variety}`);
      (mod.traces || []).forEach(t => {
        let ex;
        try { ex = mod.build(U.clone(t.params)); } catch (e) { err(id, `traccia ${t.id}: build lancia ${e.stack || e}`); return; }
        checkEx(id, mod, ex, `traccia ${t.id}`, err);
        const sol = mod.sol2answers(ex);
        for (const k in (t.expect || {})) {
          const got = U.norm(sol[k]), want = U.norm(t.expect[k]);
          if (got !== want) err(id, `traccia ${t.id}: ${k} = "${sol[k]}" ma il PDF dice "${t.expect[k]}"`);
        }
        info.push(`${id}: traccia ${t.id} ok (${Object.keys(t.expect || {}).length} valori confrontati col PDF)`);
      });
    });
    return { ok: errors.length === 0, errors: errors.map(f => f()), info };
  }

  function checkEx(id, mod, ex, where, err) {
    try {
      const copy = JSON.parse(JSON.stringify(ex));
      if (JSON.stringify(copy) !== JSON.stringify(ex)) err(id, `${where}: ex non è serializzabile`);
      if (ex.cat !== id) err(id, `${where}: ex.cat = ${ex.cat}`);
      if (!(ex.level >= 1 && ex.level <= 5)) err(id, `${where}: ex.level = ${ex.level}`);
      const sol = mod.sol2answers(copy);
      const keys = Object.keys(sol);
      const r = mod.grade(copy, sol);
      if (!(r.total > 0)) err(id, `${where}: total = ${r.total}`);
      if (Math.abs(r.correct - r.total) > 1e-9) {
        const bad = Object.keys(r.marks || {}).filter(k => !r.marks[k].ok).slice(0, 5);
        err(id, `${where}: la soluzione prende ${r.correct}/${r.total}; campi sbagliati: ${bad.join(', ')} → ${bad.map(k => r.marks[k].msg).join(' | ')}`);
      }
      (r.summary || []).forEach(s => { if (s.ok === false) err(id, `${where}: controllo fallito con la soluzione: ${s.text}`); });
      const empty = mod.grade(copy, {});
      if (empty.correct >= empty.total) err(id, `${where}: le risposte vuote prendono il massimo`);
      // campi sbagliati: grade non deve lanciare
      const wrong = {}; keys.forEach(k => wrong[k] = 'xyz');
      mod.grade(copy, wrong);
      // passi: coprono tutte le chiavi
      const steps = mod.steps(copy);
      if (!steps.length) err(id, `${where}: steps vuoto`);
      keys.forEach(k => { if (U.stepOfKey(steps, k) < 0) err(id, `${where}: la chiave ${k} non appartiene a nessun passo`); });
      // aiuti
      const hs = mod.hints(copy);
      if (!hs.length) err(id, `${where}: hints vuoto`);
      hs.forEach((h, i) => { ['title', 'metodo', 'applicato', 'svolto'].forEach(f => { if (!h[f]) err(id, `${where}: hints[${i}].${f} mancante`); }); });
      keys.forEach(k => {
        const t = mod.fieldHint(copy, k);
        if (!t || typeof t !== 'string') err(id, `${where}: fieldHint vuoto per ${k}`);
        mod.diagnose(copy, k, 'xyz', wrong);
        mod.diagnose(copy, k, '', {});
      });
      if (mod.diagnoseCases) {
        mod.diagnoseCases(copy).forEach(dc => {
          const a = Object.assign({}, sol, { [dc.key]: dc.value });
          const g = mod.grade(copy, a);
          if (g.marks[dc.key] && g.marks[dc.key].ok) err(id, `${where}: diagnoseCases ${dc.key}=${dc.value} risulta giusto`);
          const d = mod.diagnose(copy, dc.key, dc.value, a);
          if (!d || !U.norm(d).includes(U.norm(dc.expect))) err(id, `${where}: diagnose(${dc.key}=${dc.value}) = "${d}", atteso "${dc.expect}"`);
        });
      }
      const txt = mod.chatText(copy, sol);
      if (typeof txt !== 'string' || txt.length < 20) err(id, `${where}: chatText troppo corto`);
    } catch (e) {
      err(id, `${where}: eccezione ${e.stack || e}`);
    }
  }

  // controlli sul disegno (solo browser): campi presenti, restore + grade al 100%
  function runDom(root) {
    const errors = [];
    MOD_IDS.filter(id => RA[id]).forEach(id => {
      const mod = RA[id];
      for (let lv = 1; lv <= 5; lv++) {
        for (let i = 0; i < 8; i++) {
          const ex = mod.gen(lv);
          domCheck(id, mod, ex, `livello ${lv}`, root, errors);
        }
      }
      (mod.traces || []).forEach(t => domCheck(id, mod, mod.build(U.clone(t.params)), `traccia ${t.id}`, root, errors));
    });
    return errors;
  }
  function domCheck(id, mod, ex, where, root, errors) {
    try {
      const sol = mod.sol2answers(ex);
      const box = U.h('div', {});
      root.appendChild(box);
      const ctx = { fields: {}, initial: sol, mode: 'aiuti' };
      mod.render(ex, box, ctx);
      Object.keys(sol).forEach(k => { if (!ctx.fields[k]) errors.push(`[${id}] ${where}: nessun campo per la chiave ${k}`); });
      Object.keys(ctx.fields).forEach(k => { if (!(k in sol)) errors.push(`[${id}] ${where}: campo ${k} senza risposta modello`); });
      const got = U.collect(ctx.fields);
      const r = mod.grade(ex, got);
      if (Math.abs(r.correct - r.total) > 1e-9) errors.push(`[${id}] ${where}: dopo il restore la soluzione prende ${r.correct}/${r.total}`);
      box.querySelectorAll('.tbl').forEach(t => { if (!t.querySelector('thead')) errors.push(`[${id}] ${where}: tabella senza intestazione`); });
      const solBox = U.h('div', {});
      mod.solution(ex, solBox);
      if (!solBox.textContent.trim()) errors.push(`[${id}] ${where}: soluzione vuota`);
      box.remove();
    } catch (e) {
      errors.push(`[${id}] ${where}: eccezione ${e.stack || e}`);
    }
  }

  function runInPage(view) {
    U.clear(view);
    view.appendChild(U.h('h2', {}, '🧪 Autotest'));
    const out = U.h('div', { class: 'card st-log' }, 'In corso…');
    view.appendChild(out);
    setTimeout(() => {
      const r = run({ n: 40 });
      const scratch = U.h('div', { style: { position: 'absolute', left: '-9999px', width: '1000px' } });
      document.body.appendChild(scratch);
      const domErr = runDom(scratch);
      scratch.remove();
      const all = r.errors.concat(domErr);
      out.textContent = (all.length ? `✗ ${all.length} errori\n\n` + all.join('\n') : '✓ Tutto ok') + '\n\n' + r.info.join('\n');
      out.className = 'card st-log ' + (all.length ? 'st-err' : 'st-ok');
      window.__selftest = { errors: all, info: r.info };
    }, 50);
  }

  RA.selftest = { run, runDom, runInPage, MOD_IDS };
})();
