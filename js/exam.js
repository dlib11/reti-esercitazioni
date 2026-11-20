// ============================================================
// RetiApp · exam.js — esame simulato (6 esercizi, 2 ore)
// Durante l'esame niente aiuti né correzioni: si corregge alla consegna.
// ============================================================
(function () {
  const RA = window.RetiApp;
  const U = RA.util;

  const EXAM_TIME = 2 * 60 * 60 * 1000; // 2 ore
  let state = null;
  let timerId = null;

  function stopTimer() { if (timerId) clearInterval(timerId); timerId = null; }

  // items: [{ key, ex, traceId? }]
  function start(items, label) {
    stopTimer();
    state = {
      label,
      exs: items.map(it => ({ key: it.key, mod: RA[it.key], ex: it.ex, traceId: it.traceId || null, answers: {}, ctx: null })),
      idx: 0, start: Date.now(), finished: false, results: null
    };
    render();
    timerId = setInterval(tick, 1000);
  }

  function startLevel(lv) {
    RA.storage.setAllLevels(lv, RA.app.order);
    start(RA.app.order.map(k => ({ key: k, ex: RA[k].gen(lv) })), `livello ${lv}`);
  }

  // esame con le tracce fisse del PDF (set "simulato")
  function simTraces() {
    return RA.app.allTraces().filter(t => t.set === 'simulato');
  }
  function startPdf() {
    const ts = simTraces();
    const items = RA.app.order.map(k => {
      const t = ts.find(x => x.cat === k);
      return t ? { key: k, ex: RA[k].build(U.clone(t.params)), traceId: t.id } : { key: k, ex: RA[k].gen(3) };
    });
    start(items, 'esame simulato del PDF');
  }

  function showChoice() {
    stopTimer();
    const view = document.getElementById('view');
    U.clear(view);
    window.scrollTo(0, 0);
    view.appendChild(U.h('h2', {}, '🏁 Esame simulato · scegli la difficoltà'));
    view.appendChild(U.h('p', { class: 'small' }, 'Come all\'esame: niente suggerimenti e niente correzione durante la prova. Puoi passare da un esercizio all\'altro e le risposte restano. Alla consegna (o allo scadere delle 2 ore) vedi il punteggio e la correzione di ogni esercizio.'));
    const grid = U.h('div', { class: 'cards diff-cards' });
    [
      [2, 'Facile', 'spazio ampio, tracce brevi, niente varianti'],
      [3, 'Medio', 'come l\'esame simulato della prima parte'],
      [4, 'Difficile', 'spazio ridotto, perdite e porte da gestire, priorità SDN'],
      [5, 'Oltre l\'esame', 'casi limite: blocchi al limite, fast retransmit, doppie trappole']
    ].forEach(([lv, name, desc]) => {
      grid.appendChild(U.h('div', { class: 'card diff-card' },
        U.h('h3', {}, `${name} · livello ${lv}/5`),
        U.h('p', { class: 'small' }, desc),
        U.h('button', { class: 'btn primary', text: `Inizia al livello ${lv}`, onclick: () => startLevel(lv) })));
    });
    if (simTraces().length) {
      grid.appendChild(U.h('div', { class: 'card diff-card pdf-card' },
        U.h('h3', {}, '📄 Il foglio del PDF'),
        U.h('p', { class: 'small' }, 'Gli esercizi di Esame_Simulato_TESTO.pdf con gli stessi numeri: alla fine confronta anche con il file delle soluzioni.'),
        U.h('button', { class: 'btn primary', text: 'Inizia l\'esame del PDF', onclick: startPdf })));
    }
    view.appendChild(grid);
    view.appendChild(U.h('p', { class: 'small' }, 'La scelta del livello aggiorna anche il livello (fisso) delle categorie nella home.'));
    view.appendChild(U.h('div', { class: 'btn-bar' },
      U.h('button', { class: 'btn ghost', text: '← Annulla', onclick: () => RA.app.home() })));
  }

  function timeLeft() { return EXAM_TIME - (Date.now() - state.start); }
  function tick() {
    if (!state || state.finished) return;
    const left = timeLeft();
    const el = document.getElementById('exam-timer');
    if (left <= 0) {
      if (el) { el.textContent = 'tempo scaduto'; el.classList.add('expired'); }
      finish(true);
      return;
    }
    if (!el) return;
    const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
    el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    el.classList.toggle('low', left < 10 * 60000);
  }

  function saveCurrent() {
    const cur = state && state.exs[state.idx];
    if (cur && cur.ctx) cur.answers = U.collect(cur.ctx.fields);
  }

  function goTo(i) { saveCurrent(); state.idx = i; render(); window.scrollTo(0, 0); }

  function render() {
    const view = document.getElementById('view');
    U.clear(view);
    const cur = state.exs[state.idx];
    const filled = e => U.filled(e === cur && e.ctx ? U.collect(e.ctx.fields) : e.answers);

    const tabs = U.h('div', { class: 'exam-tabs' },
      state.exs.map((e, i) => U.h('button', {
        class: 'tab' + (i === state.idx ? ' active' : '') + (filled(e) ? ' done' : ''),
        title: e.mod.name, onclick: () => goTo(i)
      }, `${e.mod.num}${filled(e) ? ' ✎' : ''}`)),
      U.h('span', { class: 'exam-timer-wrap' }, 'Tempo: ', U.h('b', { id: 'exam-timer' }, '--:--')));

    const body = U.h('div', { class: 'ex-body' });
    cur.ctx = { fields: {}, initial: cur.answers, mode: 'esame' };
    cur.mod.render(cur.ex, body, cur.ctx);

    const bar = U.h('div', { class: 'btn-bar' });
    if (state.idx > 0) bar.appendChild(U.h('button', { class: 'btn ghost', text: '← Esercizio precedente', onclick: () => goTo(state.idx - 1) }));
    if (state.idx < state.exs.length - 1) bar.appendChild(U.h('button', { class: 'btn primary', text: 'Esercizio successivo →', onclick: () => goTo(state.idx + 1) }));
    bar.appendChild(U.h('button', { class: 'btn ghost', text: '📝 Testo per la chat', onclick: () => {
      RA.chat.open(document.getElementById('exam-body'), cur.mod.chatText(cur.ex, U.collect(cur.ctx.fields)));
    } }));
    bar.appendChild(U.h('button', { class: 'btn warn', text: '🏁 Consegna esame', onclick: () => {
      saveCurrent();
      const empty = state.exs.filter(e => !U.filled(e.answers)).length;
      if (!window.confirm(empty ? `Ci sono ${empty} esercizi senza risposte. Consegnare comunque?` : 'Consegnare l\'esame?')) return;
      finish(false);
    } }));

    view.appendChild(U.h('div', { class: 'exam-head' },
      U.h('h2', {}, `Esame simulato · ${cur.mod.num} · ${cur.mod.name}`),
      U.h('p', { class: 'small' }, `Punteggio all'esame: ${cur.mod.examPoints} punti · ${state.label}`),
      tabs));
    view.appendChild(U.h('div', { id: 'exam-body' },
      body, bar,
      U.h('div', { class: 'exam-foot small' }, 'Motiva i passaggi: la sola risposta finale non basta per il punteggio pieno. Le risposte restano anche cambiando esercizio.')));
    // aggiorna il segno ✎ della scheda mentre si scrive
    body.addEventListener('change', () => {
      const t = view.querySelectorAll('.exam-tabs .tab')[state.idx];
      if (t) { const f = U.filled(U.collect(cur.ctx.fields)); t.classList.toggle('done', f); t.textContent = cur.mod.num + (f ? ' ✎' : ''); }
    });
    tick();
  }

  function finish(timeout) {
    if (!state || state.finished) return;
    saveCurrent();
    stopTimer();
    state.finished = true;
    const results = state.exs.map(e => {
      const res = e.mod.grade(e.ex, e.answers);
      const pct = U.pct(res.correct, res.total);
      const done = U.filled(e.answers);
      const pts = done ? Math.round(pct * e.mod.examPoints * 2) / 2 : 0; // al mezzo punto
      return { e, res, pct, done, pts, max: e.mod.examPoints };
    });
    const tot = U.sum(results.map(r => r.pts));
    const totMax = U.sum(results.map(r => r.max));
    RA.storage.recordExam({ date: Date.now(), tot, totMax, label: state.label, cats: results.map(r => ({ n: r.e.mod.name, pts: r.pts, max: r.max })) });
    // ogni esercizio finisce anche nello storico, per il ripasso
    results.forEach(r => {
      if (!r.done) return;
      r.histId = RA.storage.addHistory({ cat: r.e.key, level: r.e.ex.level, source: 'exam', traceId: r.e.traceId, ex: r.e.ex, answers: r.e.answers, pct: r.pct, hints: 0, solutionSeen: false, mode: 'esame' });
    });
    state.results = { results, tot, totMax, timeout };
    showResults();
  }

  function showResults() {
    const { results, tot, totMax, timeout } = state.results;
    const view = document.getElementById('view');
    U.clear(view);
    window.scrollTo(0, 0);
    view.appendChild(U.h('div', { class: 'card' },
      U.h('h2', {}, timeout ? '⏰ Tempo scaduto: esame consegnato' : 'Esame consegnato 🏁'),
      U.h('p', { class: 'small' }, `${state.label} · durata ${Math.round((Date.now() - state.start) / 60000)} minuti`),
      U.table(['Esercizio', 'Esito', 'Punti', ''], results.map(r => [
        `${r.e.mod.num}. ${r.e.mod.name}`,
        r.done ? `${Math.round(r.pct * 100)}%` : 'non svolto',
        `${RA.app.fmtNum(r.pts)} / ${r.max}`,
        U.h('button', { class: 'btn ghost sm', text: 'Vedi correzione', onclick: () => review(r) })
      ]).concat([{ tr: [U.h('b', {}, 'Totale'), '', U.h('b', {}, `${RA.app.fmtNum(tot)} / ${totMax}`), ''], cls: 'tot-row' }])),
      U.h('p', { class: 'small', style: { marginTop: '12px' } },
        tot >= totMax * 0.8 ? 'Ottimo: sei pronto per questa parte. Ripassa solo le categorie sotto il 70%.' :
          tot >= totMax * 0.5 ? 'Buona base: rifai gli esercizi delle categorie sotto il 70% in modalità guidata o con aiuti.' :
            'Serve ancora esercizio: parti dagli esercizi singoli in modalità guidata, poi riprova l\'esame.'),
      U.h('p', { class: 'small' }, 'Gli esercizi sotto l\'85% sono finiti nella lista "da ripassare" della home.'),
      U.h('div', { class: 'btn-bar' },
        U.h('button', { class: 'btn primary', text: '← Torna alla home', onclick: () => { state = null; RA.app.home(); } }))));
  }

  function review(r) {
    RA.app.open(r.e.key, r.e.ex, { review: true, answers: r.e.answers, histId: r.histId || null, traceId: r.e.traceId, back: showResults });
  }

  RA.exam = { start, showChoice, startLevel, startPdf };
})();
