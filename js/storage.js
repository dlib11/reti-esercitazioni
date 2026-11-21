// ============================================================
// RetiApp · storage.js — progressi, livelli, storico, backup su file
// Tutto vive nel localStorage del browser (chiave KEY).
// ============================================================
(function () {
  const RA = window.RetiApp;
  const KEY = 'reti-esercitazioni-v1';
  const VERSION = 2;
  const MAX_HISTORY = 150;
  const MAX_EXAMS = 20;

  let warned = null; // ultimo avviso di spazio pieno (letto da app.js)

  function migrate(d) {
    d = d && typeof d === 'object' ? d : {};
    if (!d.v || d.v < 2) {
      d.history = d.history || [];
      d.v = 2;
    }
    d.levels = d.levels || {};
    d.fixed = d.fixed || {};
    d.stats = d.stats || {};
    d.exams = d.exams || [];
    d.history = d.history || [];
    d.options = d.options || {};
    return d;
  }
  function load() {
    try { return migrate(JSON.parse(localStorage.getItem(KEY))); }
    catch (e) { return migrate({}); }
  }
  // salva; se lo spazio è finito toglie le voci più vecchie dello storico e riprova
  function save(d) {
    for (let tries = 0; tries < 6; tries++) {
      try { localStorage.setItem(KEY, JSON.stringify(d)); return true; }
      catch (e) {
        if (!d.history || d.history.length < 10) return false;
        d.history.splice(0, Math.ceil(d.history.length / 4));
        warned = 'Spazio del browser quasi pieno: ho eliminato gli esercizi più vecchi dello storico. Esporta un backup per conservarli.';
      }
    }
    return false;
  }

  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  RA.storage = {
    VERSION,
    takeWarning() { const w = warned; warned = null; return w; },

    // ---- livelli ----
    getLevel(cat) { const d = load(); return d.levels[cat] || 1; },
    isFixed(cat) { return !!load().fixed[cat]; },
    setLevel(cat, lv) { const d = load(); d.levels[cat] = lv; d.fixed[cat] = true; save(d); },
    setAuto(cat) { const d = load(); d.fixed[cat] = false; save(d); },
    setAllLevels(lv, cats) { const d = load(); cats.forEach(k => { d.levels[k] = lv; d.fixed[k] = true; }); save(d); },

    // registra un esito (una sola volta per esercizio, lo decide app.js).
    // In modalità adattiva il livello sale sopra l'85% e scende sotto il 50%.
    record(cat, pctVal) {
      const d = load();
      let L = d.levels[cat] || 1;
      if (!d.fixed[cat]) {
        if (pctVal >= 0.85 && L < 5) L++;
        else if (pctVal < 0.5 && L > 1) L--;
        d.levels[cat] = L;
      }
      const s = d.stats[cat] = d.stats[cat] || { plays: 0, best: 0, last: [] };
      s.plays++;
      s.best = Math.max(s.best, pctVal);
      s.last.push(Math.round(pctVal * 100));
      if (s.last.length > 5) s.last.shift();
      save(d);
      return L;
    },
    stats() { return load().stats; },
    setMode(m) { const d = load(); d.mode = m; save(d); },
    getMode() { return load().mode || 'aiuti'; },

    // ---- opzioni dei moduli (mod.options), per esercizio: { routerInHosts: true } ----
    getOptions(cat) { return Object.assign({}, load().options[cat] || {}); },
    setOption(cat, key, val) { const d = load(); d.options[cat] = Object.assign({}, d.options[cat], { [key]: val }); save(d); },

    // ---- esami simulati ----
    recordExam(res) {
      const d = load();
      d.exams.push(res);
      if (d.exams.length > MAX_EXAMS) d.exams.shift();
      save(d);
    },
    exams() { return load().exams; },

    // ---- storico degli esercizi ----
    // entry: { cat, level, source: 'gen'|'trace'|'exam'|'redo', traceId?, ex, answers, pct, hints, solutionSeen, mode, redoOf? }
    addHistory(entry) {
      const d = load();
      const e = Object.assign({ id: newId(), date: Date.now() }, entry);
      d.history.push(e);
      if (d.history.length > MAX_HISTORY) d.history.splice(0, d.history.length - MAX_HISTORY);
      // un esercizio rifatto bene "chiude" quello originale
      if (e.redoOf && RA.storage.isGood(e)) {
        const o = d.history.find(x => x.id === e.redoOf);
        if (o) o.resolved = true;
      }
      save(d);
      return e.id;
    },
    updateHistory(id, patch) {
      const d = load();
      const e = d.history.find(x => x.id === id);
      if (!e) return;
      Object.assign(e, patch);
      if (e.redoOf && RA.storage.isGood(e)) {
        const o = d.history.find(x => x.id === e.redoOf);
        if (o) o.resolved = true;
      }
      save(d);
    },
    removeHistory(id) {
      const d = load();
      d.history = d.history.filter(x => x.id !== id);
      save(d);
    },
    history() { return load().history; },
    getHistory(id) { return load().history.find(x => x.id === id) || null; },
    // "fatto bene": almeno 85%, senza aver aperto la soluzione e con al massimo 2 aiuti
    isGood(e) { return e.pct >= 0.85 && !e.solutionSeen && (e.hints || 0) <= 2; },
    // da ripassare: non fatto bene e non ancora rifatto con successo
    // (i tentativi di ripasso non entrano in coda: resta in coda l'originale finché non viene rifatto bene)
    needsReview(e) { return !RA.storage.isGood(e) && !e.resolved && !e.redoOf; },
    reviewQueue() { return load().history.filter(e => RA.storage.needsReview(e)).reverse(); },

    // ---- backup su file ----
    exportAll() {
      return { app: 'reti-esercitazioni', version: VERSION, exportedAt: new Date().toISOString(), data: load() };
    },
    // controlla un file di backup già letto (oggetto JSON); restituisce { ok, msg, summary }
    inspectBackup(obj) {
      if (!obj || typeof obj !== 'object' || obj.app !== 'reti-esercitazioni' || !obj.data || typeof obj.data !== 'object') {
        return { ok: false, msg: 'Il file non è un backup di questa app.' };
      }
      if ((obj.version || 1) > VERSION) {
        return { ok: false, msg: 'Il backup è stato creato da una versione più recente dell\'app.' };
      }
      const d = migrate(RA.util.clone(obj.data));
      const plays = Object.values(d.stats).reduce((a, s) => a + (s.plays || 0), 0);
      return {
        ok: true,
        summary: `esercizi registrati: ${plays} · nello storico: ${d.history.length} · esami simulati: ${d.exams.length}` +
          (obj.exportedAt ? ` · creato il ${new Date(obj.exportedAt).toLocaleString('it-IT')}` : '')
      };
    },
    importAll(obj) {
      const chk = RA.storage.inspectBackup(obj);
      if (!chk.ok) return chk;
      const d = migrate(RA.util.clone(obj.data));
      if (!save(d)) return { ok: false, msg: 'Il browser non ha spazio sufficiente per importare il backup.' };
      return { ok: true };
    },
    clearAll() { try { localStorage.removeItem(KEY); } catch (e) { /* ignorato */ } }
  };
})();
