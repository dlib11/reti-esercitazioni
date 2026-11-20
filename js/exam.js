// ============================================================
// RetiApp · exam.js — modalità esame simulato (6 esercizi, 2 ore)
// ============================================================
(function () {
  const RA = window.RetiApp;
  const U = RA.util;

  const EXAM_TIME = 2 * 60 * 60 * 1000; // 2 ore
  let state = null;
  let timerId = null;

  function start(levels) {
    const cats = RA.app.order;
    state = {
      exs: cats.map((k, i) => {
        const mod = RA[k];
        const lv = levels ? levels[k] : 3;
        return { key: k, mod, ex: mod.gen(lv), exState: {}, done: false, res: null };
      }),
      idx: 0, start: Date.now(), finished: false
    };
    render();
    if (timerId) clearInterval(timerId);
    timerId = setInterval(tick, 1000);
  }

  // schermata di scelta della difficoltà: vale per l'esame e per gli esercizi singoli
  function showChoice() {
    if (timerId) clearInterval(timerId);
    const view = document.getElementById('view');
    U.clear(view);
    const v = U.h('div', {});
    v.appendChild(U.h('h2', {}, '🏁 Esame simulato · scegli la difficoltà'));
    v.appendChild(U.h('p', { class: 'small' }, 'La scelta vale per i 6 esercizi dell\'esame e aggiorna anche il livello (fisso) delle categorie nella home.'));
    const grid = U.h('div', { class: 'cards diff-cards' });
    [
      [2, 'Facile', 'esercizi base: spazio ampio, tracce brevi'],
      [3, 'Medio', 'come l\'esame simulato della prima parte'],
      [4, 'Difficile', 'spazio ridotto, aggregazioni e perdite da gestire'],
      [5, 'Oltre l\'esame', 'casi limite: /26 al millesimo, fast retransmit vero, doppie trappole']
    ].forEach(([lv, name, desc]) => {
      grid.appendChild(U.h('div', { class: 'card diff-card' },
        U.h('h3', {}, `${name} · livello ${lv}/5`),
        U.h('p', { class: 'small' }, desc),
        U.h('button', {
          class: 'btn primary', text: `Inizia al livello ${lv}`,
          onclick: () => {
            RA.storage.setAllLevels(lv, RA.app.order);
            const map = {};
            RA.app.order.forEach(k => map[k] = lv);
            start(map);
          }
        })));
    });
    v.appendChild(grid);
    v.appendChild(U.h('div', { class: 'btn-bar' },
      U.h('button', { class: 'btn ghost', text: '← Annulla', onclick: () => RA.app.home() })));
    view.appendChild(v);
  }

  function tick() {
    if (!state) return;
    const el = document.getElementById('exam-timer');
    if (!el) return;
    const left = EXAM_TIME - (Date.now() - state.start);
    if (left <= 0) {
      el.textContent = 'tempo scaduto';
      el.classList.add('expired');
      return;
    }
    const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
    el.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function render() {
    const view = document.getElementById('view');
    U.clear(view);
    const cur = state.exs[state.idx];

    const tabs = U.h('div', { class: 'exam-tabs' },
      state.exs.map((e, i) => U.h('button', {
        class: 'tab' + (i === state.idx ? ' active' : '') + (e.done ? ' done' : ''),
        onclick: () => { state.idx = i; render(); }
      }, `${e.mod.num}${e.done ? ' ✓' : ''}`)),
      U.h('span', { class: 'exam-timer-wrap' }, 'Tempo: ', U.h('b', { id: 'exam-timer' }, '--:--')));

    const body = U.h('div', {});
    cur.mod.render(cur.ex, body, cur.exState);

    const bar = U.h('div', { class: 'btn-bar' });
    bar.appendChild(U.h('button', {
      class: 'btn primary', text: 'Verifica questo esercizio',
      onclick: () => {
        const res = cur.mod.check(cur.ex, body, cur.exState, true); // in esame: spiegazioni sempre attive
        cur.res = res; cur.done = true;
        cur.pct = U.pct(res.correct, res.total);
        render();
        document.getElementById('exam-body').scrollIntoView({ behavior: 'smooth' });
      }
    }));
    bar.appendChild(U.h('button', {
      class: 'btn ghost', text: state.idx < state.exs.length - 1 ? 'Esercizio successivo →' : '← Rivedi', 
      onclick: () => { state.idx = (state.idx + 1) % state.exs.length; render(); }
    }));
    bar.appendChild(U.h('button', {
      class: 'btn ghost', text: '📝 Chiedi correzione in chat',
      onclick: () => {
        const text = cur.mod.chatText(cur.ex, cur.exState);
        RA.chat.open(document.getElementById('exam-body'), text);
      }
    }));
    bar.appendChild(U.h('button', {
      class: 'btn warn', text: '🏁 Consegna esame', onclick: finish }));

    view.appendChild(U.h('div', { class: 'exam-head' },
      U.h('h2', {}, `Esame simulato · Esercizio ${cur.mod.num} · ${cur.mod.name}`),
      U.h('p', { class: 'small' }, `Punteggio all'esame reale: ${cur.mod.examPoints} punti · Tempo indicativo totale: 2 ore`),
      tabs));
    view.appendChild(U.h('div', { id: 'exam-body' },
      body, bar,
      U.h('div', { class: 'exam-foot small' }, 'Motiva i passaggi: la sola risposta finale non basta per il punteggio pieno.')));
    tick();
  }

  function finish() {
    if (timerId) clearInterval(timerId);
    const view = document.getElementById('view');
    U.clear(view);
    const results = state.exs.map(e => ({
      name: `${e.mod.num}. ${e.mod.name}`, pct: e.res ? U.pct(e.res.correct, e.res.total) : 0,
      done: e.done, pts: e.res ? Math.round(U.pct(e.res.correct, e.res.total) * e.mod.examPoints) : 0,
      max: e.mod.examPoints
    }));
    const tot = results.reduce((a, r) => a + r.pts, 0);
    const totMax = results.reduce((a, r) => a + r.max, 0);
    const record = { date: Date.now(), tot, totMax, cats: results.map(r => ({ n: r.name, pts: r.pts, max: r.max })) };
    RA.storage.recordExam(record);

    view.appendChild(U.h('div', { class: 'card' },
      U.h('h2', {}, 'Esame consegnato 🏁'),
      U.h('table', { class: 'data' },
        U.h('tr', {}, ['Esercizio', 'Esiti', 'Punti'].map(t => U.h('th', {}, t))),
        results.map(r => U.h('tr', {},
          U.h('td', {}, r.name),
          U.h('td', {}, r.done ? `${Math.round(r.pct * 100)}%` : 'non svolto'),
          U.h('td', {}, `${r.pts} / ${r.max}`))),
        U.h('tr', { class: 'tot-row' }, U.h('td', {}, 'Totale'), U.h('td', {}, ''), U.h('td', {}, `${tot} / ${totMax}`))),
      U.h('p', { class: 'small', style: 'margin-top:12px' },
        tot >= totMax * 0.8 ? 'Ottimo: sei pronto per questa parte. Ripassa solo le categorie sotto il 70%.' :
          tot >= totMax * 0.5 ? 'Buona base: rifai gli esercizi delle categorie sotto il 70% in modalità con aiuti.' :
            'Serve ancora esercizio: parti dagli esercizi singoli delle categorie più basse, poi riprova l\'esame.'),
      U.h('div', { class: 'btn-bar' },
        U.h('button', { class: 'btn primary', text: '← Torna alla home', onclick: () => { state = null; RA.app.home(); } }))));
  }

  RA.exam = { start, showChoice };
})();
