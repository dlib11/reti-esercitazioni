// ============================================================
// RetiApp · storage.js — progressi, livello (fisso o adattivo), modalità
// ============================================================
(function () {
  const RA = window.RetiApp;
  const KEY = 'reti-esercitazioni-v1';

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch (e) { return {}; }
  }
  function save(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) { /* ignorato */ } }

  RA.storage = {
    getLevel(cat) { const d = load(); return (d.levels && d.levels[cat]) || 1; },
    // livello scelto manualmente: resta fisso finché non si riattiva AUTO
    isFixed(cat) { const d = load(); return !!(d.fixed && d.fixed[cat]); },
    setLevel(cat, lv) {
      const d = load();
      d.levels = d.levels || {};
      d.levels[cat] = lv;
      d.fixed = d.fixed || {};
      d.fixed[cat] = true;
      save(d);
    },
    setAuto(cat) {
      const d = load();
      d.fixed = d.fixed || {};
      d.fixed[cat] = false;
      save(d);
    },
    // scelta della difficoltà dell'esame: vale anche per gli esercizi singoli
    setAllLevels(lv, cats) {
      const d = load();
      d.levels = d.levels || {};
      d.fixed = d.fixed || {};
      cats.forEach(k => { d.levels[k] = lv; d.fixed[k] = true; });
      save(d);
    },
    record(cat, pctVal) {
      const d = load();
      d.levels = d.levels || {};
      const fixed = !!(d.fixed && d.fixed[cat]);
      let L = d.levels[cat] || 1;
      if (!fixed) { // solo in modalità adattiva la difficoltà si muove
        if (pctVal >= 0.85 && L < 5) L++;
        else if (pctVal < 0.5 && L > 1) L--;
        d.levels[cat] = L;
      }
      const s = (d.stats = d.stats || {})[cat] = d.stats[cat] || { plays: 0, best: 0, last: [] };
      s.plays++;
      s.best = Math.max(s.best, pctVal);
      s.last.push(Math.round(pctVal * 100));
      if (s.last.length > 5) s.last.shift();
      save(d);
      return L;
    },
    stats() { return load().stats || {}; },
    setMode(m) { const d = load(); d.mode = m; save(d); },
    getMode() { return load().mode || 'aiuti'; },
    recordExam(res) {
      const d = load();
      d.exams = d.exams || [];
      d.exams.push(res);
      if (d.exams.length > 10) d.exams.shift();
      save(d);
    },
    exams() { return load().exams || []; }
  };
})();
