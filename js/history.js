// ============================================================
// RetiApp · history.js — storico degli esercizi e ripasso degli errori
// ============================================================
(function () {
  const RA = window.RetiApp;
  const U = RA.util;
  const S = RA.storage;

  const SRC = { gen: 'esercizio', trace: 'traccia', exam: 'esame', redo: 'rifatto' };
  let filter = { cat: '', state: '' };

  function show() {
    const view = document.getElementById('view');
    U.clear(view);
    window.scrollTo(0, 0);
    RA.app.current = null;
    const all = S.history().slice().reverse();
    const cats = RA.app.allCats();

    view.appendChild(U.h('div', { class: 'ex-head' }, U.h('h2', {}, '📚 Storico e ripasso')));
    view.appendChild(U.h('p', { class: 'small' }, 'Ogni esercizio verificato viene salvato con le tue risposte. "Da ripassare" = sotto l\'85%, oppure con la soluzione aperta o più di 2 aiuti, e non ancora rifatto bene.'));

    const catSel = U.h('select', { class: 'cell w-auto', 'aria-label': 'categoria', onchange: () => { filter.cat = catSel.value; show(); } },
      U.h('option', { value: '' }, 'Tutte le categorie'),
      cats.map(k => U.h('option', { value: k }, `${RA[k].num} · ${RA[k].name}`)));
    catSel.value = filter.cat;
    const stSel = U.h('select', { class: 'cell w-auto', 'aria-label': 'esito', onchange: () => { filter.state = stSel.value; show(); } },
      U.h('option', { value: '' }, 'Tutti gli esiti'),
      U.h('option', { value: 'review' }, 'Da ripassare'),
      U.h('option', { value: 'good' }, 'Fatti bene'));
    stSel.value = filter.state;
    const queue = S.reviewQueue();
    view.appendChild(U.h('div', { class: 'btn-bar' }, catSel, stSel,
      queue.length ? U.h('button', { class: 'btn primary', text: `🔁 Ripassa (${queue.length})`, onclick: startReview }) : null,
      U.h('button', { class: 'btn ghost', text: '← Home', onclick: () => RA.app.home() })));

    const list = all.filter(e => RA[e.cat] && (!filter.cat || e.cat === filter.cat) &&
      (!filter.state || (filter.state === 'review' ? S.needsReview(e) : S.isGood(e))));
    if (!list.length) {
      view.appendChild(U.h('div', { class: 'card small' }, all.length ? 'Nessun esercizio con questi filtri.' : 'Ancora nessun esercizio salvato: verifica un esercizio e lo troverai qui.'));
      return;
    }
    view.appendChild(U.table(['Data', 'Esercizio', 'Origine', 'Esito', 'Aiuti', ''], list.map(e => {
      const mod = RA[e.cat];
      const t = e.traceId ? RA.app.findTrace(e.traceId) : null;
      const badge = S.isGood(e) ? U.h('span', { class: 'badge ok' }, 'fatto bene') :
        e.resolved ? U.h('span', { class: 'badge' }, 'rifatto bene') : U.h('span', { class: 'badge err' }, 'da ripassare');
      return [
        U.fmtDate(e.date),
        U.h('span', {}, `${mod.num} · ${mod.name}`, U.h('div', { class: 'small' }, t ? t.title : `livello ${e.level}/5`)),
        SRC[e.source] || e.source,
        U.h('span', {}, `${Math.round(e.pct * 100)}% `, badge),
        `${e.hints || 0}${e.solutionSeen ? ' + soluzione' : ''}`,
        U.h('span', { class: 'row-actions' },
          U.h('button', { class: 'btn ghost sm', text: 'Rivedi', title: 'le tue risposte con la correzione', onclick: () => reviewEntry(e.id) }),
          U.h('button', { class: 'btn ghost sm', text: 'Rifai', title: 'stesso esercizio, campi vuoti', onclick: () => redo(e.id) }),
          U.h('button', { class: 'mini', text: '✕', title: 'elimina dallo storico', onclick: () => {
            if (window.confirm('Eliminare questo esercizio dallo storico?')) { S.removeHistory(e.id); show(); }
          } }))
      ];
    }), { cls: 'hist' }));
  }

  function reviewEntry(id) {
    const e = S.getHistory(id);
    if (!e || !RA[e.cat]) return;
    RA.app.open(e.cat, e.ex, { review: true, answers: e.answers, histId: e.id, traceId: e.traceId, back: show });
  }

  function redo(id) {
    const e = S.getHistory(id);
    if (!e || !RA[e.cat]) return;
    RA.app.open(e.cat, U.clone(e.ex), { source: 'redo', redoOf: e.redoOf || e.id, traceId: e.traceId });
  }

  function startReview() {
    const q = S.reviewQueue();
    if (!q.length) { show(); return; }
    redo(q[0].id);
  }

  RA.history = { show, reviewEntry, redo, startReview };
})();
