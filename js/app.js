// ============================================================
// RetiApp · app.js — home, schermata dell'esercizio, aiuti, modalità
// I moduli di esercizio seguono il contratto in docs/moduli.md
// ============================================================
(function () {
  const RA = window.RetiApp;
  const U = RA.util;

  const MODES = [
    ['manuale', 'Manuale', 'solo ✓/✗, come all\'esame'],
    ['aiuti', 'Con aiuti', 'suggerimenti, aiuto sul campo e spiegazione degli errori'],
    ['guidata', 'Guidata', 'un passo alla volta, nell\'ordine del metodo']
  ];

  const app = {
    order: ['vlsm', 'protocols', 'nat', 'tcp', 'sdn', 'http'],
    extras: ['cwnd', 'theory'],
    mode: RA.storage.getMode(),
    current: null
  };
  RA.app = app;

  const view = () => document.getElementById('view');
  const mods = list => list.filter(k => RA[k]);

  // ---------------- barra in alto ----------------
  function renderModeToggle() {
    const slot = document.getElementById('mode-slot');
    U.clear(slot);
    slot.appendChild(U.h('span', { class: 'small' }, 'Modalità:'));
    MODES.forEach(([m, label, title]) => {
      slot.appendChild(U.h('button', {
        class: 'chip' + (app.mode === m ? ' on' : ''), text: label, title,
        onclick: () => {
          app.mode = m; RA.storage.setMode(m); renderModeToggle();
          if (app.current && !app.current.locked) renderEx(); // ridisegna mantenendo le risposte
        }
      }));
    });
  }
  const explainOn = () => app.mode !== 'manuale';

  function stars(lv) { return '★'.repeat(lv) + '☆'.repeat(5 - lv); }
  function spark(last) {
    if (!last || !last.length) return null;
    return U.h('span', { class: 'spark', title: 'ultimi punteggi' },
      last.map(v => U.h('i', { class: v >= 85 ? 'g' : v >= 50 ? 'm' : 'l', style: { height: Math.max(3, Math.round(v / 100 * 18)) + 'px' }, title: v + '%' })));
  }

  // ---------------- HOME ----------------
  function home() {
    app.current = null;
    const v = view();
    U.clear(v);
    window.scrollTo(0, 0);
    const stats = RA.storage.stats();

    v.appendChild(U.h('div', { class: 'home-head' },
      U.h('h1', {}, 'Reti di calcolatori · Esercitazioni'),
      U.h('p', { class: 'sub' }, 'Prima parte · esercizi come all\'esame, con numeri sempre nuovi · difficoltà progressiva')));

    const warn = RA.storage.takeWarning();
    if (warn) v.appendChild(U.h('div', { class: 'card warn-card' }, warn));

    // ripasso
    const queue = RA.storage.reviewQueue();
    if (queue.length) {
      v.appendChild(U.h('div', { class: 'card review-card' },
        U.h('div', {}, U.h('b', {}, `🔁 ${queue.length} esercizi da ripassare`),
          U.h('span', { class: 'small' }, ' · svolti sotto l\'85%, con la soluzione aperta o con molti aiuti')),
        U.h('div', { class: 'btn-bar tight' },
          U.h('button', { class: 'btn primary', text: 'Ripassa il prossimo →', onclick: () => RA.history.startReview() }),
          U.h('button', { class: 'btn ghost', text: '📚 Storico', onclick: () => RA.history.show() }))));
    }

    const catCard = key => {
      const mod = RA[key];
      const lv = RA.storage.getLevel(key);
      const fixed = RA.storage.isFixed(key);
      const st = stats[key];
      const starRow = U.h('div', { class: 'lv-row', title: 'scegli la difficoltà: resta fissa finché non riattivi AUTO' },
        [1, 2, 3, 4, 5].map(n => U.h('button', {
          class: 'star' + (n <= lv ? ' on' : ''), text: '★', title: `livello ${n} (fisso)`, 'aria-label': `livello ${n}`,
          onclick: () => { RA.storage.setLevel(key, n); home(); }
        })),
        U.h('button', {
          class: 'chip auto-chip' + (fixed ? '' : ' on'), text: 'AUTO',
          title: 'difficoltà adattiva: sale sopra 85%, scende sotto 50%',
          onclick: () => { RA.storage.setAuto(key); home(); }
        }));
      return U.h('div', { class: 'card cat-card' },
        U.h('div', { class: 'cat-head' },
          U.h('span', { class: 'cat-num' + (mod.extra ? ' extra' : '') }, mod.num),
          U.h('h3', {}, mod.name),
          mod.examPoints ? U.h('span', { class: 'pts' }, mod.examPoints + ' pt') : null),
        U.h('p', { class: 'small' }, mod.desc),
        starRow,
        U.h('div', { class: 'cat-meta small' },
          U.h('span', {}, `Livello ${stars(lv)} (${lv}/5) · ${fixed ? 'fisso' : 'auto'}`),
          st ? U.h('span', { class: 'meta-line' }, `fatti: ${st.plays} · migliore: ${Math.round(st.best * 100)}%`, spark(st.last)) : U.h('span', {}, 'ancora non esercitato')),
        U.h('div', { class: 'btn-bar tight' },
          U.h('button', { class: 'btn primary', text: 'Esercitati →', onclick: () => startEx(key) }),
          mod.method ? U.h('button', { class: 'btn ghost', text: '📘 Metodo', onclick: () => showMethod(key) }) : null));
    };

    v.appendChild(U.h('h2', { class: 'sec-title' }, 'Esercizi d\'esame'));
    v.appendChild(U.h('div', { class: 'cards' }, mods(app.order).map(catCard)));

    if (mods(app.extras).length) {
      v.appendChild(U.h('h2', { class: 'sec-title' }, 'Argomenti in più', U.h('span', { class: 'small' }, ' · dalle guide, non contano nell\'esame simulato')));
      v.appendChild(U.h('div', { class: 'cards' }, mods(app.extras).map(catCard)));
    }

    // esame simulato
    const exams = RA.storage.exams();
    v.appendChild(U.h('div', { class: 'card exam-card' },
      U.h('h3', {}, '🏁 Esame simulato'),
      U.h('p', { class: 'small' }, 'I 6 esercizi in sequenza: Indirizzamento (10) · Protocolli (4) · NAT (5) · TCP (5) · SDN (4) · HTTP (7). Timer di 2 ore, nessun aiuto: la correzione arriva alla consegna.'),
      U.h('div', { class: 'btn-bar tight' },
        U.h('button', { class: 'btn primary', text: 'Scegli la difficoltà e inizia →', onclick: () => RA.exam.showChoice() })),
      exams.length ? U.h('div', { class: 'small' },
        'Ultimi esami: ' + exams.slice(-3).reverse().map(e => `${new Date(e.date).toLocaleDateString('it-IT')} → ${e.tot}/${e.totMax}${e.label ? ' (' + e.label + ')' : ''}`).join(' · ')) : null));

    // tracce d'esame
    const traces = allTraces();
    if (traces.length) {
      v.appendChild(U.h('div', { class: 'card' },
        U.h('h3', {}, '📄 Tracce d\'esame dalle guide'),
        U.h('p', { class: 'small' }, 'Esercizi fissi presi dai PDF delle guide e dall\'esame simulato: stessi numeri del foglio, così puoi confrontarti con la soluzione scritta.'),
        U.h('div', { class: 'trace-list' }, traces.map(t => U.h('div', { class: 'trace-item' },
          U.h('span', { class: 'cat-num sm' }, RA[t.cat].num),
          U.h('span', { class: 'trace-title' }, t.title, U.h('span', { class: 'small' }, ' · ' + t.source)),
          U.h('button', { class: 'btn ghost sm', text: 'Svolgi', onclick: () => startTrace(t.id) }))))));
    }

    // storico e backup
    const hist = RA.storage.history();
    v.appendChild(U.h('div', { class: 'cards two' },
      U.h('div', { class: 'card' },
        U.h('h3', {}, '📚 Storico e ripasso'),
        U.h('p', { class: 'small' }, `Gli ultimi esercizi svolti con le tue risposte (${hist.length} salvati): puoi rivederli, rifarli uguali e ripassare quelli andati male.`),
        U.h('div', { class: 'btn-bar tight' }, U.h('button', { class: 'btn ghost', text: 'Apri lo storico →', onclick: () => RA.history.show() }))),
      backupCard()));

    v.appendChild(U.h('div', { class: 'home-foot small' },
      'Difficoltà: clicca le stelle per bloccare il livello, oppure AUTO per farla adattare da sola (sale sopra 85%, scende sotto 50%). ',
      'Le risposte aperte puoi farle correggere in chat con il pulsante 📝.'));
  }

  // ---------------- BACKUP ----------------
  function backupCard() {
    const status = U.h('div', { class: 'small backup-status' });
    const file = U.h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' } });
    file.addEventListener('change', () => {
      const f = file.files && file.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        let obj;
        try { obj = JSON.parse(rd.result); } catch (e) { status.textContent = '✗ Il file non è un JSON valido.'; status.className = 'small backup-status err-line'; return; }
        const chk = RA.storage.inspectBackup(obj);
        if (!chk.ok) { status.textContent = '✗ ' + chk.msg; status.className = 'small backup-status err-line'; return; }
        if (!window.confirm('Importare questo backup?\n\n' + chk.summary + '\n\nI progressi attuali di questo browser verranno SOSTITUITI.')) {
          status.textContent = 'Importazione annullata.'; status.className = 'small backup-status'; return;
        }
        const r = RA.storage.importAll(obj);
        if (!r.ok) { status.textContent = '✗ ' + r.msg; status.className = 'small backup-status err-line'; return; }
        app.mode = RA.storage.getMode(); renderModeToggle();
        home();
        const s = document.querySelector('.backup-status');
        if (s) { s.textContent = '✓ Backup importato: ' + chk.summary; s.className = 'small backup-status ok-line'; }
      };
      rd.onerror = () => { status.textContent = '✗ Impossibile leggere il file.'; status.className = 'small backup-status err-line'; };
      rd.readAsText(f);
      file.value = '';
    });
    return U.h('div', { class: 'card' },
      U.h('h3', {}, '💾 Backup dei progressi'),
      U.h('p', { class: 'small' }, 'I progressi restano solo in questo browser. Esporta un file per conservarli o portarli su un altro computer, poi importalo là.'),
      U.h('div', { class: 'btn-bar tight' },
        U.h('button', { class: 'btn ghost', text: '⬇ Esporta', onclick: () => {
          const data = JSON.stringify(RA.storage.exportAll(), null, 1);
          const blob = new Blob([data], { type: 'application/json' });
          const a = U.h('a', { href: URL.createObjectURL(blob), download: `reti-progressi-${new Date().toISOString().slice(0, 10)}.json` });
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(a.href), 2000);
          status.textContent = '✓ File creato: lo trovi tra i download.'; status.className = 'small backup-status ok-line';
        } }),
        U.h('button', { class: 'btn ghost', text: '⬆ Importa', onclick: () => file.click() }),
        file),
      status);
  }

  // ---------------- METODO ----------------
  function methodNode(mod) {
    const m = mod.method;
    if (!m) return null;
    return U.h('div', { class: 'method' },
      m.intro ? U.h('p', {}, m.intro) : null,
      m.steps && m.steps.length ? U.h('div', {}, U.h('h4', {}, 'I passi'), U.h('ol', {}, m.steps.map(s => U.h('li', {}, s)))) : null,
      m.traps && m.traps.length ? U.h('div', {}, U.h('h4', {}, '⚠️ Trappole'), U.h('ul', {}, m.traps.map(s => U.h('li', {}, s)))) : null,
      m.formulas && m.formulas.length ? U.h('div', {}, U.h('h4', {}, '🧮 Formulario'),
        U.table(null, m.formulas.map(([a, b]) => [U.label(a), b]), { cls: 'formula' })) : null);
  }
  function showMethod(key) {
    const mod = RA[key];
    const v = view();
    U.clear(v);
    window.scrollTo(0, 0);
    v.appendChild(U.h('div', { class: 'ex-head' }, U.h('h2', {}, `📘 Metodo · ${mod.num} · ${mod.name}`)));
    v.appendChild(U.h('div', { class: 'card' }, methodNode(mod)));
    v.appendChild(U.h('div', { class: 'btn-bar' },
      U.h('button', { class: 'btn primary', text: 'Esercitati →', onclick: () => startEx(key) }),
      U.h('button', { class: 'btn ghost', text: '← Home', onclick: home })));
  }

  // ---------------- AVVIO ESERCIZIO ----------------
  function allTraces() {
    const out = [];
    mods(app.order.concat(app.extras)).forEach(k => (RA[k].traces || []).forEach(t => out.push(Object.assign({ cat: k }, t))));
    return out;
  }
  function findTrace(id) { return allTraces().find(t => t.id === id) || null; }

  // opts: { source, traceId, redoOf, answers, review (sola lettura), histId }
  function open(key, ex, opts) {
    opts = opts || {};
    app.current = {
      key, mod: RA[key], ex,
      source: opts.source || 'gen', traceId: opts.traceId || null, redoOf: opts.redoOf || null,
      answers: opts.answers || {}, histId: opts.histId || null,
      locked: !!opts.review, // revisione di un esercizio dello storico/esame: niente verifica
      reviewBack: opts.back || null,
      hints: 0, solutionSeen: false, recorded: false, lastRes: null,
      stepIdx: 0, revealed: {}
    };
    renderEx();
    if (opts.review) doCheck(true);
  }
  function startEx(key, lvOverride) {
    const mod = RA[key];
    const lv = lvOverride || RA.storage.getLevel(key);
    open(key, mod.gen(lv), { source: 'gen' });
  }
  function startTrace(id) {
    const t = findTrace(id);
    if (!t) return;
    open(t.cat, RA[t.cat].build(U.clone(t.params)), { source: 'trace', traceId: id });
  }

  // ---------------- SCHERMATA ESERCIZIO ----------------
  function renderEx() {
    const v = view();
    const c = app.current;
    const { mod, ex } = c;
    // conserva quanto scritto finora se si ridisegna
    if (c.ctx) c.answers = U.collect(c.ctx.fields);
    U.clear(v);

    const ctx = { fields: {}, initial: c.answers, mode: app.mode };
    c.ctx = ctx;
    const steps = mod.steps ? mod.steps(ex) : [];
    c.steps = steps;
    const guided = app.mode === 'guidata' && !c.locked && steps.length > 1;

    // --- intestazione ---
    const lvSel = c.source === 'gen' && !c.locked ? U.h('select', {
      class: 'cell lv-sel', title: 'difficoltà del prossimo esercizio (non cambia quello attuale)',
      onchange: () => {
        if (lvSel.value === 'auto') RA.storage.setAuto(c.key);
        else RA.storage.setLevel(c.key, Number(lvSel.value));
      }
    },
      [1, 2, 3, 4, 5].map(n => U.h('option', { value: String(n) }, `Prossimo: livello ${n}/5`)),
      U.h('option', { value: 'auto' }, 'Prossimo: auto (adattivo)')) : null;
    if (lvSel) lvSel.value = RA.storage.isFixed(c.key) ? String(RA.storage.getLevel(c.key)) : 'auto';

    const trace = c.traceId ? findTrace(c.traceId) : null;
    v.appendChild(U.h('div', { class: 'ex-head' },
      U.h('h2', {}, `${mod.num} · ${mod.name}`),
      U.h('span', { class: 'chip static' }, trace ? '📄 ' + trace.title : `livello ${ex.level}/5`),
      c.locked ? U.h('span', { class: 'chip static' }, '👁 revisione') : U.h('span', { class: 'chip static' }, MODES.find(m => m[0] === app.mode)[1].toLowerCase()),
      lvSel,
      mod.method ? U.h('button', { class: 'btn ghost sm', text: '📘 Metodo', onclick: () => {
        const p = v.querySelector('.method-panel');
        if (p) p.classList.toggle('hidden');
      } }) : null));
    if (trace) v.appendChild(U.h('p', { class: 'small src-line' }, 'Fonte: ' + trace.source));
    if (mod.method) v.appendChild(U.h('div', { class: 'card method-panel hidden' }, methodNode(mod)));

    // --- aiuti ---
    const hintsCard = U.h('div', { class: 'card hints' + (explainOn() && !c.locked ? '' : ' hidden') });
    v.appendChild(hintsCard);
    c.hintsCard = hintsCard;

    // --- corpo dell'esercizio ---
    const body = U.h('div', { class: 'ex-body' });
    mod.render(ex, body, ctx);
    v.appendChild(body);
    c.body = body;

    // aiuto sul campo (barra in basso)
    const tip = U.h('div', { class: 'tipbar hidden', role: 'status' });
    v.appendChild(tip);
    attachFieldHelp(body, tip);

    const summary = U.h('div', { class: 'res-summary' });
    v.appendChild(summary);
    const scoreBanner = U.h('div', { class: 'score-banner hidden' });
    v.appendChild(scoreBanner);
    c.summaryEl = summary; c.bannerEl = scoreBanner;

    // --- modalità guidata ---
    const guideBar = U.h('div', { class: 'guide-bar' });
    if (guided) v.insertBefore(guideBar, body);
    c.guideBar = guided ? guideBar : null;

    // --- pulsanti ---
    const bar = U.h('div', { class: 'btn-bar action-bar' });
    if (!c.locked) {
      bar.appendChild(U.h('button', { class: 'btn primary', text: '✓ Verifica tutto', onclick: () => doCheck(false) }));
      if (explainOn() && steps.length > 1 && !guided) {
        const stepSel = U.h('select', { class: 'cell w-auto', 'aria-label': 'passo da controllare' }, steps.map((s, i) => U.h('option', { value: String(i) }, `Passo ${i + 1}: ${s.title}`)));
        bar.appendChild(U.h('span', { class: 'step-check' }, stepSel,
          U.h('button', { class: 'btn ghost', text: 'Controlla questo passo', title: 'controlla solo i campi di questo passo, senza registrare il punteggio', onclick: () => checkStep(Number(stepSel.value)) })));
      }
    }
    bar.appendChild(U.h('button', { class: 'btn ghost', text: '📝 Chiedi correzione in chat', onclick: () => {
      RA.chat.open(v, mod.chatText(ex, U.collect(ctx.fields)));
    } }));
    bar.appendChild(U.h('button', { class: 'btn ghost', text: '📖 Soluzione', onclick: () => toggleSolution() }));
    if (c.locked) {
      bar.appendChild(U.h('button', { class: 'btn ghost', text: '↻ Rifai uguale', onclick: () => open(c.key, U.clone(ex), { source: 'redo', redoOf: c.histId, traceId: c.traceId }) }));
      if (c.reviewBack) bar.appendChild(U.h('button', { class: 'btn ghost', text: '← Indietro', onclick: c.reviewBack }));
    } else if (c.source === 'gen' || c.source === 'redo') {
      bar.appendChild(U.h('button', { class: 'btn ghost', text: '↻ Nuovo esercizio', onclick: () => startEx(c.key) }));
    }
    if (c.source === 'redo' && !c.locked) {
      const next = RA.storage.reviewQueue().find(e => e.id !== c.redoOf);
      if (next) bar.appendChild(U.h('button', { class: 'btn ghost', text: '🔁 Prossimo da ripassare', onclick: () => RA.history.redo(next.id) }));
    }
    bar.appendChild(U.h('button', { class: 'btn ghost', text: '← Home', onclick: home }));
    v.appendChild(bar);

    if (explainOn() && !c.locked) renderHints(hintsCard);
    if (guided) applyGuided();
    if (c.lastRes && !c.locked) showFeedback(c.lastRes, null);
  }

  // ---------------- AIUTO SUL CAMPO ----------------
  function attachFieldHelp(body, tip) {
    const c = app.current;
    const show = el => {
      const key = el.getAttribute('data-key');
      if (!key) return;
      const fbMsg = el.getAttribute('data-fb');
      const parts = [];
      if (fbMsg) parts.push(U.h('div', { class: 'tip-err' }, '✗ ', fbMsg));
      if (explainOn() && !c.locked && c.mod.fieldHint) {
        const hTxt = c.mod.fieldHint(c.ex, key);
        if (hTxt) parts.push(U.h('div', {}, '💬 ', hTxt));
      }
      U.clear(tip);
      if (!parts.length) { tip.classList.add('hidden'); return; }
      parts.forEach(p => tip.appendChild(p));
      tip.classList.remove('hidden');
    };
    body.addEventListener('focusin', e => { if (e.target.matches('[data-key]')) show(e.target); });
    body.addEventListener('focusout', e => {
      setTimeout(() => { if (!body.contains(document.activeElement)) tip.classList.add('hidden'); }, 120);
    });
    // Invio: passa al campo successivo (nelle textarea va a capo come sempre)
    body.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || !e.target.matches('input[data-key]')) return;
      e.preventDefault();
      const all = Array.from(body.querySelectorAll('input[data-key],select[data-key],textarea[data-key]')).filter(x => !x.disabled);
      const i = all.indexOf(e.target);
      if (i >= 0 && all[i + 1]) all[i + 1].focus();
    });
  }

  // ---------------- SUGGERIMENTI (3 livelli) ----------------
  function renderHints(card) {
    const c = app.current;
    U.clear(card);
    const hs = c.mod.hints ? c.mod.hints(c.ex) : [];
    if (!hs.length) { card.classList.add('hidden'); return; }
    const guided = !!c.guideBar;
    card.appendChild(U.h('div', { class: 'hints-head' },
      U.h('button', { class: 'btn ghost sm', text: c.hintsOpen ? '▾ Nascondi' : '▸ Mostra', 'aria-expanded': c.hintsOpen ? 'true' : 'false', onclick: () => { c.hintsOpen = !c.hintsOpen; renderHints(card); } }),
      U.h('h4', {}, guided ? '💡 Suggerimento per il passo corrente' : `💡 Suggerimenti passo per passo (${hs.length} passi)`),
      U.h('span', { class: 'small' }, `Prima la regola, poi la regola con i tuoi numeri, infine il passo svolto. Aiuti usati: ${c.hints}`)));
    if (!c.hintsOpen) return;
    const list = U.h('ol', { class: 'hint-steps' });
    hs.forEach((h, i) => {
      // in modalità guidata: solo il suggerimento del passo corrente
      if (guided && c.steps[c.stepIdx] && h.step && h.step !== c.steps[c.stepIdx].id) return;
      const lvl = c.revealed[i] || 0;
      const li = U.h('li', { class: 'hint-step' + (lvl ? ' open' : '') });
      li.appendChild(U.h('div', { class: 'hint-title' }, h.title));
      if (lvl >= 1) li.appendChild(U.h('div', { class: 'hint-txt' }, U.h('b', {}, 'Regola. '), h.metodo));
      if (lvl >= 2) li.appendChild(U.h('div', { class: 'hint-txt' }, U.h('b', {}, 'Con i tuoi numeri. '), h.applicato));
      if (lvl >= 3) li.appendChild(U.h('div', { class: 'hint-txt solved' }, U.h('b', {}, 'Passo svolto. '), h.svolto));
      const labels = ['Spiegami la regola', 'Applicala ai miei numeri', 'Mostrami il passo svolto'];
      if (lvl < 3) {
        li.appendChild(U.h('button', { class: 'btn ghost sm', text: labels[lvl], onclick: () => {
          c.revealed[i] = lvl + 1;
          c.hints++;
          renderHints(card);
        } }));
      }
      list.appendChild(li);
    });
    card.appendChild(list);
  }

  // ---------------- MODALITÀ GUIDATA ----------------
  function applyGuided() {
    const c = app.current;
    const steps = c.steps;
    const cur = Math.min(c.stepIdx, steps.length - 1);
    // campi dei passi futuri: bloccati
    for (const key in c.ctx.fields) {
      const el = c.ctx.fields[key];
      const si = U.stepOfKey(steps, key);
      const lock = si > cur;
      el.disabled = lock;
      el.classList.toggle('locked', lock);
      el.classList.toggle('current', si === cur);
    }
    c.body.querySelectorAll('[data-step]').forEach(card => {
      const si = steps.findIndex(s => s.id === card.getAttribute('data-step'));
      card.classList.toggle('card-locked', si > cur);
      card.classList.toggle('card-current', si === cur);
    });
    const bar = c.guideBar;
    U.clear(bar);
    bar.appendChild(U.h('div', { class: 'guide-steps' }, steps.map((s, i) =>
      U.h('span', { class: 'gstep' + (i < cur ? ' done' : i === cur ? ' cur' : '') }, `${i + 1}. ${s.title}`))));
    const msg = U.h('span', { class: 'small guide-msg' });
    bar.appendChild(U.h('div', { class: 'btn-bar tight' },
      U.h('button', { class: 'btn primary', text: `Controlla il passo ${cur + 1}`, onclick: () => {
        const ok = checkStep(cur);
        if (ok && cur < steps.length - 1) {
          msg.textContent = '';
          c.stepIdx = cur + 1;
          applyGuided();
          const first = Object.keys(c.ctx.fields).find(k => U.stepOfKey(steps, k) === cur + 1);
          if (first) c.ctx.fields[first].focus();
        } else if (ok) {
          msg.textContent = '✓ Ultimo passo corretto: premi "Verifica tutto" per registrare il risultato.';
        } else {
          msg.textContent = 'Correggi i campi in rosso (selezionali per la spiegazione), poi ricontrolla.';
        }
      } }),
      cur < steps.length - 1 ? U.h('button', { class: 'btn ghost', text: 'Salta al passo successivo', onclick: () => { c.stepIdx = cur + 1; applyGuided(); } }) : null,
      msg));
    if (c.hintsCard && explainOn()) renderHints(c.hintsCard);
  }

  // ---------------- VERIFICA ----------------
  function gradeNow() {
    const c = app.current;
    const answers = U.collect(c.ctx.fields);
    return { answers, res: c.mod.grade(c.ex, answers) };
  }

  // feedback sui campi; onlyStep = indice del passo (null = tutti)
  function showFeedback(res, onlyStep, answers) {
    const c = app.current;
    const explain = explainOn() || c.locked;
    answers = answers || U.collect(c.ctx.fields);
    U.resetFb(c.body);
    const inStep = key => onlyStep === null || onlyStep === undefined || U.stepOfKey(c.steps, key) === onlyStep;
    for (const key in c.ctx.fields) {
      const m = res.marks[key];
      if (!m || !inStep(key)) continue;
      let msg = null;
      const empty = String(answers[key] == null ? '' : answers[key]).trim() === '';
      // campo vuoto: niente spiegazione (darebbe la risposta); si vede solo che manca
      if (!m.ok && explain) msg = empty ? 'Da compilare.' : (c.mod.diagnose && c.mod.diagnose(c.ex, key, answers[key], answers)) || m.msg;
      U.fb(c.ctx.fields[key], m.ok ? 'ok' : (m.part > 0 ? 'part' : 'err'), msg);
    }
    // riepilogo dei controlli non legati a un campo
    U.clear(c.summaryEl);
    const items = (res.summary || []).filter(s => onlyStep === null || onlyStep === undefined || !s.step || c.steps.findIndex(st => st.id === s.step) === onlyStep);
    if (items.length) {
      c.summaryEl.appendChild(U.h('div', { class: 'card flow-summary' },
        U.h('h4', {}, 'Controlli'),
        items.map(s => U.h('div', { class: 'flow-line ' + (s.ok === true ? 'ok-line' : s.ok === 'warn' ? 'warn-line' : 'err-line') },
          U.h('span', { class: 'flow-badge' }, s.ok === true ? '✓' : s.ok === 'warn' ? '⚠' : '✗'),
          U.h('span', {}, explain || s.ok === true ? s.text : (s.short || s.text))))));
    }
  }

  function checkStep(idx) {
    const c = app.current;
    const { res, answers } = gradeNow();
    showFeedback(res, idx, answers);
    const keys = Object.keys(c.ctx.fields).filter(k => U.stepOfKey(c.steps, k) === idx);
    const ok = keys.every(k => !res.marks[k] || res.marks[k].ok) &&
      (res.summary || []).filter(s => s.step === c.steps[idx].id).every(s => s.ok !== false);
    const bad = keys.filter(k => res.marks[k] && !res.marks[k].ok).length;
    c.bannerEl.className = 'score-banner ' + (ok ? 'good' : 'mid');
    c.bannerEl.textContent = ok ? `Passo ${idx + 1} (${c.steps[idx].title}): tutto giusto ✓` :
      `Passo ${idx + 1} (${c.steps[idx].title}): ${bad} campi da correggere. Selezionali per vedere cosa non va.`;
    return ok;
  }

  function doCheck(silent) {
    const c = app.current;
    const { res, answers } = gradeNow();
    c.lastRes = res;
    showFeedback(res, null, answers);
    const pct = U.pct(res.correct, res.total);
    const banner = c.bannerEl;
    banner.className = 'score-banner ' + (pct >= 0.85 ? 'good' : pct >= 0.5 ? 'mid' : 'low');
    let txt = `Punteggio: ${fmtNum(res.correct)} / ${res.total} (${Math.round(pct * 100)}%)`;
    if (c.locked) {
      banner.textContent = txt + ' — revisione: i campi mostrano gli errori, la soluzione è nel pulsante 📖.';
      return;
    }
    txt += pct >= 0.85 ? ' — ottimo! 🎉' : pct >= 0.5 ? ' — quasi: guarda i campi evidenziati.' : ' — riguarda il 📘 Metodo e i suggerimenti, poi riprova.';
    // registra una sola volta per esercizio; non se la soluzione era già aperta
    if (!c.recorded) {
      c.recorded = true;
      const entry = { cat: c.key, level: c.ex.level, source: c.source, traceId: c.traceId, redoOf: c.redoOf, ex: c.ex, answers, pct, hints: c.hints, solutionSeen: c.solutionSeen, mode: app.mode };
      c.histId = RA.storage.addHistory(entry);
      if (c.solutionSeen) txt += ' (non conta per il livello: avevi aperto la soluzione)';
      else if (c.source === 'gen') {
        const oldLv = RA.storage.getLevel(c.key);
        const newLv = RA.storage.record(c.key, pct);
        if (newLv > oldLv) txt += ` Livello alzato a ${newLv}/5 dal prossimo esercizio!`;
        if (newLv < oldLv) txt += ` Livello riportato a ${newLv}/5: con calma, riprova con un esercizio nuovo.`;
      }
    } else if (c.histId) {
      // verifiche successive: aggiorna le risposte salvate, ma non il punteggio registrato
      RA.storage.updateHistory(c.histId, { answers, lastPct: pct, hints: c.hints, solutionSeen: c.solutionSeen });
      txt += ' (già registrato al primo controllo)';
    }
    banner.textContent = txt;
    if (!silent) banner.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function fmtNum(x) { return (Math.round(x * 10) / 10).toString().replace('.', ','); }

  function toggleSolution() {
    const c = app.current;
    const v = view();
    let sol = v.querySelector('.sol-wrap');
    if (sol) { sol.remove(); return; }
    if (!c.locked) c.solutionSeen = true;
    sol = U.h('div', { class: 'sol-wrap' });
    c.mod.solution(c.ex, sol);
    v.insertBefore(sol, v.querySelector('.action-bar').nextSibling);
    sol.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------------- INIT ----------------
  document.addEventListener('DOMContentLoaded', () => {
    renderModeToggle();
    if (/[?&]selftest\b/.test(location.search) && RA.selftest) { RA.selftest.runInPage(view()); return; }
    home();
  });

  // API usata da exam.js e history.js
  Object.assign(app, { home, startEx, startTrace, open, findTrace, allTraces, explainOn, renderModeToggle, fmtNum });
})();
