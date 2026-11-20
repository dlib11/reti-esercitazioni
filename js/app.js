// ============================================================
// RetiApp · app.js — home, navigazione, modalità, statistiche
// ============================================================
(function () {
  const RA = window.RetiApp;
  const U = RA.util;

  const app = {
    order: ['vlsm', 'protocols', 'nat', 'tcp', 'sdn', 'http'],
    mode: RA.storage.getMode(),
    current: null
  };
  RA.app = app;

  const view = () => document.getElementById('view');
  const topbar = () => document.getElementById('mode-slot');

  function renderModeToggle() {
    const slot = topbar();
    U.clear(slot);
    slot.appendChild(U.h('span', { class: 'small' }, 'Modalità:'));
    [['manuale', 'Manuale — solo ✓/✗'], ['aiuti', 'Con aiuti — spiegazioni e suggerimenti']].forEach(([m, label]) => {
      slot.appendChild(U.h('button', {
        class: 'chip' + (app.mode === m ? ' on' : ''),
        text: label,
        onclick: () => { app.mode = m; RA.storage.setMode(m); renderModeToggle(); }
      }));
    });
  }

  function stars(lv) { return '★'.repeat(lv) + '☆'.repeat(5 - lv); }

  function home() {
    app.current = null;
    const v = view();
    U.clear(v);

    const stats = RA.storage.stats();
    const grid = U.h('div', { class: 'cards' });
    app.order.forEach(key => {
      const mod = RA[key];
      const lv = RA.storage.getLevel(key);
      const fixed = RA.storage.isFixed(key);
      const st = stats[key];
      const starRow = U.h('div', { class: 'lv-row', title: 'scegli la difficoltà: fissa finché non riattivi AUTO' },
        [1, 2, 3, 4, 5].map(n => U.h('button', {
          class: 'star' + (n <= lv ? ' on' : ''),
          text: '★',
          title: `livello ${n} (fisso)`,
          onclick: () => { RA.storage.setLevel(key, n); home(); }
        })),
        U.h('button', {
          class: 'chip auto-chip' + (fixed ? '' : ' on'),
          text: 'AUTO',
          title: 'difficoltà adattiva: sale sopra 85%, scende sotto 50%',
          onclick: () => { RA.storage.setAuto(key); home(); }
        }));
      grid.appendChild(U.h('div', { class: 'card cat-card' },
        U.h('div', { class: 'cat-head' },
          U.h('span', { class: 'cat-num' }, mod.num),
          U.h('h3', {}, mod.name)),
        U.h('p', { class: 'small' }, mod.desc),
        starRow,
        U.h('div', { class: 'cat-meta small' },
          U.h('span', {}, `Livello ${stars(lv)} (${lv}/5) · ${fixed ? 'fisso' : 'auto'}`),
          st ? U.h('span', {}, `esercizi fatti: ${st.plays} · miglior punteggio: ${Math.round(st.best * 100)}%`) : U.h('span', {}, 'ancora non esercitato')),
        U.h('div', { class: 'btn-bar' },
          U.h('button', { class: 'btn primary', text: 'Esercitati →', onclick: () => startEx(key) }))));
    });

    const exams = RA.storage.exams();
    v.appendChild(U.h('div', { class: 'home-head' },
      U.h('h1', {}, 'Reti di calcolatori · Esercitazioni'),
      U.h('p', { class: 'sub' }, 'Prima parte · esercizi come all\'esame, con numeri sempre nuovi · difficoltà progressiva')));
    v.appendChild(grid);

    v.appendChild(U.h('div', { class: 'card exam-card' },
      U.h('h3', {}, '🏁 Esame simulato'),
      U.h('p', { class: 'small' }, 'I 6 esercizi in sequenza: Indirizzamento (10) · Protocolli (4) · NAT (5) · TCP (5) · SDN (4) · HTTP (7). Timer 2 ore. All\'avvio scegli la difficoltà (aggiorna anche gli esercizi singoli).'),
      U.h('button', { class: 'btn primary', text: 'Scegli difficoltà e inizia →', onclick: () => RA.exam.showChoice() }),
      exams.length ? U.h('div', { class: 'small', style: 'margin-top:10px' },
        'Ultimi esami: ' + exams.slice(-3).reverse().map(e => `${new Date(e.date).toLocaleDateString('it-IT')} → ${e.tot}/${e.totMax}`).join(' · ')) : null));

    v.appendChild(U.h('div', { class: 'home-foot small' },
      'Difficoltà: clicca le stelle per bloccare il livello che vuoi, oppure AUTO per farla adattare da sola (sale sopra 85%, scende sotto 50%). Le domande aprese puoi farle correggere in chat con il pulsante 📝.'));
  }

  function startEx(key, lvOverride) {
    const mod = RA[key];
    const lv = lvOverride || RA.storage.getLevel(key);
    app.current = { key, mod, ex: mod.gen(lv), exState: {}, hintIdx: 0, verified: false };
    renderEx();
  }

  function renderEx() {
    const v = view();
    U.clear(v);
    const c = app.current;
    const { mod, ex, exState } = c;

    const hintsCard = U.h('div', { class: 'card hints', style: 'display:none' });
    const body = U.h('div', {});
    mod.render(ex, body, exState);

    const scoreBanner = U.h('div', { class: 'score-banner', style: 'display:none' });

    const bar = U.h('div', { class: 'btn-bar' });
    if (app.mode === 'aiuti') {
      bar.appendChild(U.h('button', {
        class: 'btn ghost', text: '💡 Suggerimento',
        onclick: () => {
          const hs = mod.hints(ex);
          if (c.hintIdx >= hs.length) return;
          hintsCard.style.display = '';
          hintsCard.appendChild(U.h('div', { class: 'hint-item' }, U.h('b', {}, `Suggerimento ${c.hintIdx + 1}: `), hs[c.hintIdx]));
          c.hintIdx++;
        }
      }));
    }
    bar.appendChild(U.h('button', {
      class: 'btn primary', text: 'Verifica',
      onclick: () => {
        const res = mod.check(ex, body, exState, app.mode === 'aiuti');
        const pct = U.pct(res.correct, res.total);
        c.verified = true;
        scoreBanner.style.display = '';
        scoreBanner.className = 'score-banner ' + (pct >= 0.85 ? 'good' : pct >= 0.5 ? 'mid' : 'low');
        scoreBanner.textContent = `Punteggio: ${res.correct.toFixed(1).replace('.0', '')} / ${res.total} (${Math.round(pct * 100)}%)` +
          (pct >= 0.85 ? ' — ottimo! 🎉' : pct >= 0.5 ? ' — quasi: guarda gli errori evidenziati.' : ' — riguarda la guida di questo argomento e riprova.');
        const oldLv = RA.storage.getLevel(c.key);
        const newLv = RA.storage.record(c.key, pct);
        if (newLv > oldLv) scoreBanner.textContent += ` Livello alzato a ${newLv}/5!`;
        if (newLv < oldLv) scoreBanner.textContent += ` Livello riportato a ${newLv}/5: con calma, riprova con un esercizio nuovo.`;
        scoreBanner.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }));
    bar.appendChild(U.h('button', {
      class: 'btn ghost', text: '📝 Chiedi correzione in chat',
      onclick: () => {
        const text = mod.chatText(ex, exState);
        RA.chat.open(v, text);
      }
    }));
    bar.appendChild(U.h('button', {
      class: 'btn ghost', text: '📖 Mostra soluzione',
      onclick: () => {
        let sol = v.querySelector('.sol-wrap');
        if (sol) { sol.remove(); return; }
        sol = U.h('div', { class: 'sol-wrap' });
        mod.solution(ex, sol);
        v.appendChild(sol);
      }
    }));
    bar.appendChild(U.h('button', { class: 'btn ghost', text: '↻ Nuovo esercizio', onclick: () => startEx(c.key, ex.level) }));
    bar.appendChild(U.h('button', { class: 'btn ghost', text: '← Home', onclick: home }));

    // selettore di difficoltà: vale dal prossimo "Nuovo esercizio"
    const lvSel = U.h('select', {
      class: 'cell lv-sel',
      title: 'difficoltà del prossimo esercizio (non cambia quello attuale)',
      onchange: () => {
        if (lvSel.value === 'auto') RA.storage.setAuto(c.key);
        else RA.storage.setLevel(c.key, Number(lvSel.value));
      }
    },
      [1, 2, 3, 4, 5].map(n => U.h('option', { value: String(n) }, `Livello ${'★'.repeat(n)} (${n}/5)`)),
      U.h('option', { value: 'auto' }, 'Auto (adattiva)'));
    lvSel.value = RA.storage.isFixed(c.key) ? String(ex.level) : 'auto';

    v.appendChild(U.h('div', { class: 'ex-head' },
      U.h('h2', {}, `${mod.num} · ${mod.name}`),
      lvSel,
      U.h('span', { class: 'chip', text: app.mode === 'aiuti' ? 'con aiuti' : 'manuale' })));
    v.appendChild(hintsCard);
    v.appendChild(body);
    v.appendChild(scoreBanner);
    v.appendChild(bar);
  }

  // init
  document.addEventListener('DOMContentLoaded', () => {
    renderModeToggle();
    home();
  });

  // API pubblica usata anche da exam.js
  app.home = home;
  app.startEx = startEx;
})();
