// ============================================================
// RetiApp · gen-cwnd.js — Extra E1 · Finestra di congestione TCP (Reno)
// Contratto dei moduli: vedi docs/moduli.md
// ============================================================
(function () {
  const RA = window.RetiApp;
  const U = RA.util;

  const EV_NAME = { none: '—', dup3: '3 ACK duplicati', to: 'timeout' };
  const EV_SHORT = { dup3: '3 dup', to: 'TO' };
  const PHASE_NAME = { ss: 'slow start', ca: 'congestion avoidance' };
  const PHASE_OPTS = [['ss', 'slow start'], ['ca', 'congestion avoidance']];
  const half = c => Math.max(2, Math.floor(c / 2));

  // ---------------- simulazione ----------------
  // righe: { t, cwnd, ss, phase, ev, how } — "how" dice come si è arrivati ai valori del turno
  function simulate(ss0, n, events) {
    const evAt = {};
    events.forEach(e => { evAt[e.t] = e.type; });
    const rows = [];
    let cw = 1, ss = ss0, how = 'init';
    for (let t = 1; t <= n; t++) {
      const phase = cw < ss ? 'ss' : 'ca';
      const ev = evAt[t] || 'none';
      rows.push({ t, cwnd: cw, ss, phase, ev, how });
      if (ev === 'dup3') { ss = half(cw); cw = ss; how = 'dup3'; }
      else if (ev === 'to') { ss = half(cw); cw = 1; how = 'to'; }
      else if (phase === 'ss') { how = 2 * cw > ss ? 'cap' : 'double'; cw = Math.min(2 * cw, ss); }
      else { cw = cw + 1; how = 'lin'; }
    }
    return rows;
  }

  // ---------------- parametri e costruzione ----------------
  function draw(level) {
    const p = { level, ss0: 8, n: 8, events: [], askTot: false, totAt: 0, askFirstCA: false, askTahoe: false };
    if (level <= 1) {
      p.ss0 = U.pick([4, 8, 16, 32]);
      p.n = U.rndInt(7, 9);
    } else if (level === 2 || level === 3) {
      p.ss0 = U.pick([8, 16, 32]);
      p.n = U.rndInt(9, 11);
      p.events = [{ t: U.rndInt(4, p.n - 3), type: level === 2 ? 'to' : 'dup3' }];
    } else if (level === 4) {
      p.ss0 = U.pick([8, 16, 32]);
      p.n = U.rndInt(12, 14);
      const types = U.shuffle(['to', 'dup3']);
      const t1 = U.rndInt(3, p.n - 6);
      const t2 = U.rndInt(t1 + 3, p.n - 2);
      p.events = [{ t: t1, type: types[0] }, { t: t2, type: types[1] }];
      p.askTot = true; p.askFirstCA = true;
      p.totAt = U.rndInt(p.n - 3, p.n);
    } else {
      p.ss0 = U.pick([6, 10, 12, 20, 24]);
      p.n = U.rndInt(13, 15);
      const k = U.rndInt(2, 3);
      const ts = U.sample(Array.from({ length: p.n - 4 }, (_, i) => i + 3), k).sort((a, b) => a - b);
      const types = ts.map(() => U.pick(['to', 'dup3']));
      if (!types.includes('dup3')) types[U.rndInt(0, k - 1)] = 'dup3';
      p.events = ts.map((t, i) => ({ t, type: types[i] }));
      p.askTot = true; p.askFirstCA = true; p.askTahoe = true;
      p.totAt = U.rndInt(p.n - 3, p.n);
    }
    return p;
  }

  function valid(p) {
    const ev = p.events;
    for (let i = 0; i < ev.length; i++) {
      if (ev[i].t < 2 || ev[i].t > p.n - 2) return false;
      if (i > 0 && ev[i].t - ev[i - 1].t < 3) return false;
    }
    const rows = simulate(p.ss0, p.n, ev);
    // eventi solo con cwnd ≥ 4: così il dimezzamento non scende sotto il minimo
    if (ev.some(e => rows[e.t - 1].cwnd < 4)) return false;
    if (p.askFirstCA && !rows.some(r => r.phase === 'ca')) return false;
    if (p.level >= 5) {
      // la soglia non potenza di 2 si deve vedere: il primo evento arriva dopo aver raggiunto la ssthresh
      if (rows[ev[0].t - 1].phase !== 'ca') return false;
      if (!rows.some(r => r.how === 'cap')) return false;
      const d = ev.find(e => e.type === 'dup3');
      const r = rows[d.t - 1];
      if (half(r.cwnd) === r.ss) return false; // le opzioni Tahoe devono essere tutte diverse
    }
    return true;
  }

  function randomParams(level) {
    for (let i = 0; i < 1000; i++) {
      const p = draw(level);
      if (valid(p)) return p;
    }
    // ripiego deterministico (non dovrebbe servire)
    return { level, ss0: 8, n: 8, events: [], askTot: false, totAt: 0, askFirstCA: false, askTahoe: false };
  }

  function build(p) {
    const events = (p.events || []).map(e => ({ t: e.t, type: e.type })).sort((a, b) => a.t - b.t);
    const rows = simulate(p.ss0, p.n, events);
    const fca = rows.find(r => r.phase === 'ca');
    const ex = {
      cat: 'cwnd', level: p.level, params: p,
      ss0: p.ss0, n: p.n, events, rows,
      firstCA: fca ? fca.t : 0,
      askTot: !!p.askTot, totAt: p.totAt || p.n,
      askFirstCA: !!p.askFirstCA, askTahoe: !!p.askTahoe,
      tot: 0, tahoe: null
    };
    ex.tot = U.sum(rows.slice(0, ex.totAt).map(r => r.cwnd));
    if (ex.askTahoe) {
      const d = events.find(e => e.type === 'dup3');
      const r = rows[d.t - 1];
      ex.tahoe = { t: d.t, C: r.cwnd, H: half(r.cwnd), ssOld: r.ss };
    }
    return ex;
  }
  const gen = level => build(randomParams(level));

  // ---------------- chiavi e passi ----------------
  const rowKeys = t => t === 1 ? ['t1.phase'] : [`t${t}.cwnd`, `t${t}.ss`, `t${t}.phase`];
  const qKeys = ex => [].concat(ex.askTot ? ['qTot'] : [], ex.askFirstCA ? ['qFirstCA'] : [], ex.askTahoe ? ['qTahoe'] : []);

  // gruppi di turni: [{ id, title, from, to }]
  function groups(ex) {
    if (!ex.events.length) {
      const f = ex.firstCA || ex.n;
      const g = [{ id: 'a', title: 'Slow start iniziale', from: 1, to: f }];
      if (f < ex.n) g.push({ id: 'c', title: 'Congestion avoidance', from: f + 1, to: ex.n });
      return g;
    }
    const e1 = ex.events[0].t;
    return [
      { id: 'a', title: 'Slow start iniziale', from: 1, to: e1 },
      { id: 'b', title: `Primo evento (${EV_NAME[ex.events[0].type]}) e reazione`, from: e1 + 1, to: e1 + 1 },
      { id: 'c', title: 'Proseguimento', from: e1 + 2, to: ex.n }
    ];
  }
  function keysOf(g) {
    const k = [];
    for (let t = g.from; t <= g.to; t++) k.push(...rowKeys(t));
    return k;
  }
  function steps(ex) {
    const s = groups(ex).map(g => ({ id: g.id, title: g.title, keys: keysOf(g) }));
    const q = qKeys(ex);
    if (q.length) s.push({ id: 'd', title: 'Domande finali', keys: q });
    return s;
  }

  // ---------------- spiegazioni ----------------
  function whyCwnd(ex, r) {
    const p = ex.rows[r.t - 2];
    switch (r.how) {
      case 'init': return `valori iniziali: cwnd = 1 MSS, ssthresh = ${ex.ss0}`;
      case 'double': return `slow start: 2 × ${p.cwnd} = ${r.cwnd}` + (r.cwnd === r.ss ? ' (raggiunge la ssthresh)' : '');
      case 'cap': return `slow start: 2 × ${p.cwnd} = ${2 * p.cwnd} supererebbe la ssthresh ${p.ss}, quindi ci si ferma a ${r.cwnd}`;
      case 'lin': return `congestion avoidance: ${p.cwnd} + 1 = ${r.cwnd}`;
      case 'dup3': return `3 ACK duplicati alla fine del turno ${p.t} (cwnd ${p.cwnd}): Reno dimezza, cwnd = ssthresh = ${r.cwnd}`;
      case 'to': return `timeout alla fine del turno ${p.t}: la cwnd riparte da 1 MSS`;
      default: return '';
    }
  }
  function whySs(ex, r) {
    const p = ex.rows[r.t - 2];
    if (!p) return `ssthresh iniziale data dal testo: ${ex.ss0}`;
    if (p.ev === 'none') return `nessun evento alla fine del turno ${p.t}: la ssthresh resta ${r.ss}`;
    return `${EV_NAME[p.ev]} alla fine del turno ${p.t}: ssthresh = ⌊${p.cwnd}/2⌋ = ${r.ss}` + (Math.floor(p.cwnd / 2) < 2 ? ' (minimo 2)' : '');
  }
  function whyPhase(r) {
    return r.phase === 'ss' ? `cwnd ${r.cwnd} < ssthresh ${r.ss} → slow start` : `cwnd ${r.cwnd} ≥ ssthresh ${r.ss} → congestion avoidance`;
  }
  function whyRow(ex, r) {
    const p = ex.rows[r.t - 2];
    if (p && p.ev !== 'none') {
      return `${EV_NAME[p.ev]} alla fine del turno ${p.t} (cwnd ${p.cwnd}): ssthresh = ⌊${p.cwnd}/2⌋ = ${r.ss}, ` +
        (p.ev === 'dup3' ? `cwnd = ssthresh = ${r.cwnd}` : 'cwnd riparte da 1') + '; ' + whyPhase(r);
    }
    return whyCwnd(ex, r) + '; ' + whyPhase(r);
  }
  const sumExpr = ex => ex.rows.slice(0, ex.totAt).map(r => r.cwnd).join(' + ');
  function tahoeOpts(ex) {
    const T = ex.tahoe;
    return [
      ['reno', `cwnd = ${T.H}, ssthresh = ${T.H}: nessuna differenza rispetto a Reno`],
      ['tahoe', `cwnd = 1, ssthresh = ${T.H}: si riparte in slow start`],
      ['ssold', `cwnd = 1, ssthresh invariata (${T.ssOld})`],
      ['ignore', 'cwnd e ssthresh invariate: Tahoe ignora i 3 ACK duplicati']
    ];
  }

  // ---------------- correzione ----------------
  function grade(ex, a) {
    a = a || {};
    let correct = 0, total = 0;
    const marks = {};
    const put = (k, ok, msg) => { total++; if (ok) correct++; marks[k] = { ok, msg }; };
    ex.rows.forEach(r => {
      if (r.t > 1) {
        put(`t${r.t}.cwnd`, U.numEq(a[`t${r.t}.cwnd`], r.cwnd), `Turno ${r.t}: ${whyCwnd(ex, r)}.`);
        put(`t${r.t}.ss`, U.numEq(a[`t${r.t}.ss`], r.ss), `Turno ${r.t}: ${whySs(ex, r)}.`);
      }
      put(`t${r.t}.phase`, String(a[`t${r.t}.phase`] || '') === r.phase, `Turno ${r.t}: ${whyPhase(r)}.`);
    });
    if (ex.askTot) put('qTot', U.numEq(a.qTot, ex.tot), `In ogni turno parte una finestra intera: somma delle cwnd dal turno 1 al turno ${ex.totAt} = ${sumExpr(ex)} = ${ex.tot}.`);
    if (ex.askFirstCA) {
      const r = ex.rows[ex.firstCA - 1];
      put('qFirstCA', U.numEq(a.qFirstCA, ex.firstCA), `Il primo turno con cwnd ≥ ssthresh è il ${ex.firstCA} (cwnd ${r.cwnd}, ssthresh ${r.ss}).`);
    }
    if (ex.askTahoe) {
      const T = ex.tahoe;
      put('qTahoe', String(a.qTahoe || '') === 'tahoe', `Tahoe tratta i 3 ACK duplicati come un timeout: ssthresh = ⌊${T.C}/2⌋ = ${T.H} (come Reno), ma la cwnd riparte da 1 in slow start.`);
    }
    return { correct, total, marks };
  }

  function sol2answers(ex) {
    const a = {};
    ex.rows.forEach(r => {
      if (r.t > 1) { a[`t${r.t}.cwnd`] = String(r.cwnd); a[`t${r.t}.ss`] = String(r.ss); }
      a[`t${r.t}.phase`] = r.phase;
    });
    if (ex.askTot) a.qTot = String(ex.tot);
    if (ex.askFirstCA) a.qFirstCA = String(ex.firstCA);
    if (ex.askTahoe) a.qTahoe = 'tahoe';
    return a;
  }

  // ---------------- errori tipici ----------------
  const toInt = v => { const s = String(v == null ? '' : v).trim(); return /^\d+$/.test(s) ? Number(s) : null; };
  // valori del turno successivo calcolati a partire da (cwnd, ssthresh, evento)
  function next(cw, ss, ev) {
    if (ev === 'dup3') return { cwnd: half(cw), ss: half(cw) };
    if (ev === 'to') return { cwnd: 1, ss: half(cw) };
    return cw < ss ? { cwnd: Math.min(2 * cw, ss), ss } : { cwnd: cw + 1, ss };
  }

  function diagnose(ex, key, value, answers) {
    const v = String(value == null ? '' : value).trim();
    if (v === '') return null;
    answers = answers || {};
    const m = /^t(\d+)\.(cwnd|ss|phase)$/.exec(key);
    if (m) return diagnoseCell(ex, Number(m[1]), m[2], v, answers);
    const n = toInt(v);
    switch (key) {
      case 'qTot': {
        if (n === null || n === ex.tot) return null;
        const sumTo = k => U.sum(ex.rows.slice(0, k).map(r => r.cwnd));
        const K = ex.totAt;
        if (K > 1 && n === sumTo(K - 1)) return `Ti manca un turno: la somma va dal turno 1 al turno ${K} COMPRESO.`;
        if (K < ex.n && n === sumTo(K + 1)) return `Hai sommato un turno in più: la domanda si ferma al turno ${K}.`;
        if (K < ex.n && n === sumTo(ex.n)) return `Hai sommato tutti i turni: la domanda chiede solo fino al turno ${K}.`;
        if (n === ex.rows[K - 1].cwnd) return `Questa è la cwnd del solo turno ${K}: i segmenti inviati in totale sono la SOMMA delle cwnd dei turni da 1 a ${K}.`;
        if (n === ex.tot - 1) return 'Hai saltato il turno 1: anche lì parte un segmento (cwnd = 1).';
        return null;
      }
      case 'qFirstCA': {
        if (n === null || n === ex.firstCA) return null;
        const f = ex.firstCA;
        const r = ex.rows[f - 1];
        if (n === f - 1) return `Al turno ${f - 1} la cwnd è ancora sotto la ssthresh: è l'ultimo turno di slow start. La congestion avoidance inizia quando cwnd ≥ ssthresh.`;
        if (n === f + 1) return `Al turno ${f} cwnd = ${r.cwnd} e ssthresh = ${r.ss}: con cwnd ≥ ssthresh si è già in congestion avoidance.`;
        return null;
      }
      case 'qTahoe':
        if (v === 'reno') return 'Questa è la reazione di Reno (fast recovery). Tahoe non distingue i 3 ACK duplicati dal timeout: la cwnd riparte da 1 in slow start.';
        if (v === 'ssold') return 'Anche Tahoe dimezza la ssthresh (metà della cwnd): rispetto a Reno cambia solo la cwnd, che riparte da 1.';
        if (v === 'ignore') return 'I 3 ACK duplicati segnalano una perdita in entrambe le versioni: nessuna delle due li ignora.';
        return null;
      default: return null;
    }
  }

  function diagnoseCell(ex, t, f, v, answers) {
    const r = ex.rows[t - 1];
    if (!r) return null;
    const p = t > 1 ? ex.rows[t - 2] : null;
    const nx = ex.rows[t];
    if (f === 'phase') {
      if (v === r.phase) return null;
      if (v === 'ss') {
        if (p && p.ev === 'dup3') return 'Dopo 3 ACK duplicati Reno non torna in slow start: cwnd = ssthresh, quindi si prosegue in congestion avoidance.';
        if (r.cwnd === r.ss) return `Qui cwnd = ssthresh = ${r.ss}: la soglia è raggiunta, quindi sei già in congestion avoidance (la regola è cwnd ≥ ssthresh).`;
        return `cwnd ${r.cwnd} ≥ ssthresh ${r.ss}: sopra la soglia si è in congestion avoidance.`;
      }
      if (v === 'ca') {
        if (p && p.ev === 'to') return 'Dopo un timeout la cwnd riparte da 1 e si torna in slow start: la cwnd è sotto la nuova ssthresh.';
        return `cwnd ${r.cwnd} < ssthresh ${r.ss}: sotto la soglia si è in slow start.`;
      }
      return null;
    }
    const n = toInt(v);
    if (n === null || !p) return null;
    const correct = f === 'cwnd' ? r.cwnd : r.ss;
    if (n === correct) return null;
    // evento applicato nel turno stesso invece che dal successivo
    if (r.ev !== 'none' && nx && n === nx[f] && n !== correct) {
      return `L'evento (${EV_NAME[r.ev]}) avviene alla FINE del turno ${t}: durante il turno ${t} valgono ancora i valori di prima; i nuovi valori valgono dal turno ${t + 1}.`;
    }
    // coerente con i valori (sbagliati) scritti dall'utente al turno prima
    if (t > 2) {
      const uc = toInt(answers[`t${t - 1}.cwnd`]), us = toInt(answers[`t${t - 1}.ss`]);
      const pc = uc === null ? p.cwnd : uc, ps = us === null ? p.ss : us;
      if ((pc !== p.cwnd || ps !== p.ss) && ps > 0 && n === next(pc, ps, p.ev)[f]) {
        return `Il calcolo è coerente con i valori che hai scritto al turno ${t - 1}, ma lì c'è un errore: correggi prima il turno ${t - 1}.`;
      }
    }
    const h = half(p.cwnd), hUp = Math.ceil(p.cwnd / 2);
    const odd = p.cwnd % 2 === 1;
    if (f === 'cwnd') {
      if (p.ev === 'dup3') {
        if (n === 1) return 'Dopo 3 ACK duplicati TCP Reno NON riparte da 1: quello è il timeout (o TCP Tahoe). Reno dimezza: cwnd = ssthresh = metà della cwnd.';
        if (odd && n === hUp) return `Arrotondamento: la metà si prende per difetto, ⌊${p.cwnd}/2⌋ = ${h}.`;
        if (n === Math.floor(p.ss / 2)) return `Hai dimezzato la ssthresh vecchia (${p.ss}): si dimezza la cwnd del turno ${p.t}, cioè ${p.cwnd}.`;
        if (n === p.cwnd || n === p.cwnd + 1 || n === 2 * p.cwnd || n === Math.min(2 * p.cwnd, p.ss)) return `Hai ignorato i 3 ACK duplicati alla fine del turno ${p.t}: Reno dimezza la cwnd.`;
        return null;
      }
      if (p.ev === 'to') {
        if (n === h || (odd && n === hUp)) return 'Dopo un timeout la cwnd non si dimezza: riparte da 1 MSS. A dimezzarsi è la ssthresh.';
        if (n === p.cwnd || n === p.cwnd + 1 || n === 2 * p.cwnd || n === Math.min(2 * p.cwnd, p.ss)) return `Hai ignorato il timeout alla fine del turno ${p.t}: dopo un timeout la cwnd riparte da 1 MSS.`;
        return null;
      }
      if (p.phase === 'ss') {
        if (n === 2 * p.cwnd && 2 * p.cwnd > p.ss) return `Raddoppio oltre la ssthresh: 2 × ${p.cwnd} = ${2 * p.cwnd} supererebbe la soglia ${p.ss}, quindi la cwnd si ferma a ${p.ss}.`;
        if (n === p.cwnd + 1) return `Crescita lineare durante lo slow start: al turno ${p.t} la cwnd (${p.cwnd}) era sotto la ssthresh (${p.ss}), quindi raddoppia.`;
        return null;
      }
      if (n === 2 * p.cwnd) return `Raddoppio durante la congestion avoidance: al turno ${p.t} la cwnd (${p.cwnd}) aveva già raggiunto la ssthresh (${p.ss}), quindi cresce solo di 1 MSS per RTT.`;
      return null;
    }
    // ssthresh
    if (p.ev !== 'none') {
      if (n === p.ss) return `ssthresh non aggiornata: dopo ${p.ev === 'to' ? 'il timeout' : 'i 3 ACK duplicati'} alla fine del turno ${p.t} la ssthresh diventa metà della cwnd (⌊${p.cwnd}/2⌋ = ${h}).`;
      if (n === Math.floor(p.ss / 2)) return `Hai dimezzato la ssthresh vecchia (${p.ss}) invece della cwnd: la nuova ssthresh è metà della cwnd al momento della perdita, ⌊${p.cwnd}/2⌋ = ${h}.`;
      if (odd && n === hUp) return `Arrotondamento: la metà si prende per difetto, ⌊${p.cwnd}/2⌋ = ${h}.`;
      if (n === p.cwnd) return `La ssthresh diventa la METÀ della cwnd al momento dell'evento: ⌊${p.cwnd}/2⌋ = ${h}.`;
      if (p.ev === 'to' && n === 1) return 'Dopo un timeout riparte da 1 la cwnd, non la ssthresh: la ssthresh diventa metà della cwnd.';
      return null;
    }
    return `Alla fine del turno ${p.t} non c'è stato nessun evento: la ssthresh cambia solo con un timeout o con 3 ACK duplicati, quindi resta quella del turno ${p.t}.`;
  }

  function diagnoseCases(ex) {
    const out = [];
    const sol = sol2answers(ex);
    const add = (key, value, expect) => {
      if (!(key in sol) || String(sol[key]) === String(value)) return;
      if (out.some(o => o.key === key && o.value === String(value))) return;
      out.push({ key, value: String(value), expect });
    };
    const R = ex.rows;
    const cap = R.find(r => r.how === 'cap');
    if (cap) add(`t${cap.t}.cwnd`, 2 * R[cap.t - 2].cwnd, 'Raddoppio oltre');
    const dbl = R.find(r => r.how === 'double' && R[r.t - 2].cwnd >= 2);
    if (dbl) add(`t${dbl.t}.cwnd`, R[dbl.t - 2].cwnd + 1, 'Crescita lineare');
    const lin = R.find(r => r.how === 'lin');
    if (lin) {
      add(`t${lin.t}.cwnd`, 2 * R[lin.t - 2].cwnd, 'Raddoppio durante la congestion avoidance');
      add(`t${lin.t}.ss`, lin.ss + 1, 'nessun evento');
    }
    const reach = R.find(r => r.phase === 'ca' && r.cwnd === r.ss && r.how !== 'dup3');
    if (reach) add(`t${reach.t}.phase`, 'ss', 'soglia è raggiunta');
    const d = R.find(r => r.how === 'dup3');
    if (d) {
      const p = R[d.t - 2];
      add(`t${d.t}.cwnd`, 1, 'NON riparte da 1');
      add(`t${d.t}.ss`, p.ss, 'non aggiornata');
      if (Math.floor(p.ss / 2) !== p.ss) add(`t${d.t}.ss`, Math.floor(p.ss / 2), 'ssthresh vecchia');
      if (p.cwnd % 2) add(`t${d.t}.ss`, Math.ceil(p.cwnd / 2), 'per difetto');
      add(`t${d.t}.phase`, 'ss', 'non torna in slow start');
      add(`t${p.t}.cwnd`, d.cwnd, 'FINE del turno');
    }
    const o = R.find(r => r.how === 'to');
    if (o) {
      const p = R[o.t - 2];
      add(`t${o.t}.cwnd`, half(p.cwnd), 'non si dimezza');
      add(`t${o.t}.ss`, p.ss, 'non aggiornata');
      if (p.ss !== p.cwnd) add(`t${o.t}.ss`, Math.floor(p.ss / 2), 'ssthresh vecchia');
      add(`t${o.t}.phase`, 'ca', 'si torna in slow start');
    }
    if (ex.askTot) {
      const K = ex.totAt;
      const sumTo = k => U.sum(R.slice(0, k).map(r => r.cwnd));
      const cands = [];
      if (K > 1) cands.push([sumTo(K - 1), 'manca un turno']);
      if (K < ex.n) cands.push([sumTo(K + 1), 'un turno in più']);
      if (K < ex.n && ex.n !== K + 1) cands.push([sumTo(ex.n), 'tutti i turni']);
      cands.push([R[K - 1].cwnd, 'SOMMA']);
      cands.push([ex.tot - 1, 'saltato il turno 1']);
      cands.forEach(([val, exp]) => {
        if (cands.filter(c => c[0] === val).length === 1) add('qTot', val, exp);
      });
    }
    if (ex.askFirstCA) {
      add('qFirstCA', ex.firstCA - 1, 'ultimo turno di slow start');
      add('qFirstCA', ex.firstCA + 1, 'già in congestion avoidance');
    }
    if (ex.askTahoe) {
      add('qTahoe', 'reno', 'reazione di Reno');
      add('qTahoe', 'ssold', 'Anche Tahoe dimezza');
    }
    return out;
  }

  // ---------------- aiuti ----------------
  function fieldHint(ex, key) {
    const m = /^t(\d+)\.(cwnd|ss|phase)$/.exec(key);
    if (m) {
      const t = Number(m[1]), f = m[2];
      const p = ex.rows[t - 2];
      if (f === 'phase') return `Confronta cwnd e ssthresh del turno ${t}: cwnd < ssthresh → slow start; cwnd ≥ ssthresh → congestion avoidance.`;
      if (!p) return 'Valore iniziale dato dal testo.';
      if (f === 'cwnd') {
        if (p.ev === 'to') return `Al turno ${t} arrivi dopo un timeout alla fine del turno ${p.t}: da dove riparte la cwnd dopo un timeout?`;
        if (p.ev === 'dup3') return `Al turno ${t} arrivi dopo 3 ACK duplicati alla fine del turno ${p.t}: Reno dimezza la cwnd del turno ${p.t} (per difetto) e la nuova cwnd è uguale alla nuova ssthresh.`;
        return `Nessun evento alla fine del turno ${p.t}: guarda la fase del turno ${p.t}. In slow start la cwnd raddoppia ma non supera la ssthresh; in congestion avoidance aumenta di 1.`;
      }
      if (p.ev !== 'none') return `Alla fine del turno ${p.t} c'è stato un ${EV_NAME[p.ev]}: la nuova ssthresh si calcola dalla cwnd del turno ${p.t} (metà, per difetto), non dalla vecchia ssthresh.`;
      return `Alla fine del turno ${p.t} non c'è nessun evento: la ssthresh cambia solo con una perdita.`;
    }
    return {
      qTot: `In ogni turno parte una finestra intera: somma le cwnd della tua tabella dal turno 1 al turno ${ex.totAt}.`,
      qFirstCA: 'Cerca nella tua tabella la prima riga con cwnd ≥ ssthresh.',
      qTahoe: 'Tahoe non ha la fast recovery: come reagisce a una perdita, qualunque sia il segnale? E la ssthresh si aggiorna?'
    }[key] || 'Rileggi le regole nel testo.';
  }

  function rowsText(ex, from, to) {
    const out = [];
    for (let t = from; t <= to; t++) {
      const r = ex.rows[t - 1];
      out.push(`Turno ${t}: cwnd ${r.cwnd}, ssthresh ${r.ss}, ${PHASE_NAME[r.phase]} — ${whyRow(ex, r)}` + (r.ev !== 'none' ? ` · alla fine: ${EV_NAME[r.ev]}` : ''));
    }
    return out.join('\n');
  }

  function hints(ex) {
    const G = groups(ex);
    const H = [];
    G.forEach(g => {
      if (g.id === 'a') {
        H.push({
          step: 'a', title: g.title,
          metodo: 'Si parte da cwnd = 1 MSS. Finché cwnd < ssthresh si è in slow start: a ogni RTT la cwnd raddoppia, ma non supera mai la ssthresh. Quando cwnd ≥ ssthresh si passa in congestion avoidance (+1 per RTT).',
          applicato: `Qui la ssthresh iniziale è ${ex.ss0}: raddoppia 1, 2, 4… e quando il doppio supererebbe ${ex.ss0} fermati a ${ex.ss0}.` +
            (ex.events.length ? ` Il primo evento arriva alla fine del turno ${ex.events[0].t}: fino a lì nessuna sorpresa.` : ' Non ci sono eventi: dopo la soglia la crescita è lineare.'),
          svolto: rowsText(ex, g.from, g.to)
        });
      } else if (g.id === 'b') {
        const e = ex.events[0];
        const r = ex.rows[e.t - 1];
        H.push({
          step: 'b', title: g.title,
          metodo: 'Un evento alla fine del turno cambia i valori del turno dopo. 3 ACK duplicati (Reno): ssthresh = metà della cwnd, cwnd = ssthresh, si prosegue in congestion avoidance. Timeout: ssthresh = metà della cwnd, cwnd = 1, si riparte in slow start. Metà per difetto, minimo 2.',
          applicato: `Alla fine del turno ${e.t} c'è un ${EV_NAME[e.type]}. Prendi la cwnd del turno ${e.t} (non la ssthresh) e dimezzala per difetto.`,
          svolto: `Cwnd al turno ${e.t} = ${r.cwnd} → ` + rowsText(ex, g.from, g.to)
        });
      } else {
        const later = ex.events.slice(1);
        H.push({
          step: 'c', title: g.title,
          metodo: 'Riga per riga: senza eventi, slow start se cwnd < ssthresh (raddoppio fino alla soglia), altrimenti +1. Ogni evento si tratta come il primo, partendo dalla cwnd del turno in cui avviene.',
          applicato: later.length ? `Altri eventi: ${later.map(e => `${EV_NAME[e.type]} alla fine del turno ${e.t}`).join('; ')}.` :
            (ex.events.length ? 'Non ci sono altri eventi: applica solo slow start o congestion avoidance.' : `Dal turno ${g.from} la cwnd è sopra la soglia: aggiungi 1 per turno.`),
          svolto: rowsText(ex, g.from, g.to)
        });
      }
    });
    const q = qKeys(ex);
    if (q.length) {
      const sv = [];
      if (ex.askTot) sv.push(`Segmenti fino al turno ${ex.totAt}: ${sumExpr(ex)} = ${ex.tot}`);
      if (ex.askFirstCA) sv.push(`Primo turno in congestion avoidance: ${ex.firstCA}`);
      if (ex.askTahoe) sv.push(`Tahoe al turno ${ex.tahoe.t + 1}: cwnd = 1, ssthresh = ${ex.tahoe.H}, slow start`);
      H.push({
        step: 'd', title: 'Domande finali',
        metodo: 'Segmenti inviati = somma delle cwnd dei turni (in ogni RTT parte una finestra intera). Primo turno in CA = prima riga con cwnd ≥ ssthresh. Tahoe: dopo 3 ACK duplicati si comporta come dopo un timeout.',
        applicato: [ex.askTot ? `Somma le cwnd dei turni 1…${ex.totAt}.` : '', ex.askFirstCA ? 'Scorri la colonna Fase.' : '', ex.askTahoe ? `L'evento da guardare è alla fine del turno ${ex.tahoe.t}.` : ''].filter(Boolean).join(' '),
        svolto: sv.join('\n')
      });
    }
    return H;
  }

  // ---------------- figura ----------------
  function figSvg(ex) {
    const R = ex.rows, n = ex.n;
    const x0 = 44, x1 = 540, y0 = 222, yTop = 34;
    const maxV = Math.max(...R.map(r => Math.max(r.cwnd, r.ss)));
    const step = maxV <= 16 ? 4 : maxV <= 40 ? 8 : 16;
    const top = Math.ceil(maxV / step) * step;
    const dx = (x1 - x0) / n;
    const X = t => x0 + (t - 0.5) * dx;
    const Y = v => y0 - v * (y0 - yTop) / top;
    const f = x => Math.round(x * 10) / 10;
    let s = `<svg viewBox="0 0 560 276" class="fig">`;
    s += `<text x="4" y="14" class="lbl small">cwnd (MSS)</text>`;
    for (let v = step; v <= top; v += step) {
      s += `<line x1="${x0 - 4}" y1="${f(Y(v))}" x2="${x0}" y2="${f(Y(v))}" class="link"/>`;
      s += `<text x="${x0 - 7}" y="${f(Y(v) + 4)}" text-anchor="end" class="lbl small">${v}</text>`;
    }
    // eventi: linea verticale tra il turno e il successivo
    ex.events.forEach(e => {
      const xb = f(x0 + e.t * dx);
      s += `<line x1="${xb}" y1="${y0}" x2="${xb}" y2="${yTop - 8}" class="zone"/>`;
      s += `<text x="${xb}" y="${y0 + 32}" text-anchor="middle" class="lbl small">${EV_SHORT[e.type]}</text>`;
    });
    // ssthresh a gradini
    let d = '';
    R.forEach((r, i) => {
      const xl = f(x0 + i * dx), xr = f(x0 + (i + 1) * dx), y = f(Y(r.ss));
      d += (i === 0 ? `M${xl},${y}` : `V${y}`) + ` H${xr}`;
    });
    s += `<path d="${d}" class="arrow back"/>`;
    // assi
    s += `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y0}" class="link"/>`;
    s += `<line x1="${x0}" y1="${y0}" x2="${x0}" y2="${yTop - 12}" class="link"/>`;
    // cwnd
    s += `<polyline points="${R.map(r => `${f(X(r.t))},${f(Y(r.cwnd))}`).join(' ')}" class="link hl"/>`;
    R.forEach(r => {
      s += `<circle cx="${f(X(r.t))}" cy="${f(Y(r.cwnd))}" r="3.5" class="flow-dot"/>`;
      s += `<text x="${f(X(r.t))}" y="${f(Y(r.cwnd) - 8)}" text-anchor="middle" class="lbl small">${r.cwnd}</text>`;
      s += `<text x="${f(X(r.t))}" y="${y0 + 16}" text-anchor="middle" class="lbl small">${r.t}</text>`;
    });
    s += `<text x="${x1}" y="270" text-anchor="end" class="lbl small">turno (RTT)</text>`;
    s += '</svg>';
    return s;
  }

  // ---------------- disegno ----------------
  function eventsSentence(ex) {
    if (!ex.events.length) return 'Non si verifica nessun evento di perdita.';
    return 'Eventi: ' + ex.events.map(e => `${EV_NAME[e.type]} alla fine del turno ${e.t}`).join('; ') + '.';
  }

  function render(ex, root, ctx) {
    root.appendChild(U.h('div', { class: 'card intro' },
      U.h('p', {}, U.h('b', {}, 'Testo. '),
        `Una connessione TCP Reno parte con cwnd = 1 MSS e ssthresh = ${ex.ss0} MSS. Il mittente ha sempre dati da inviare e in ogni turno (1 RTT) invia una finestra intera. `,
        'Gli eventi indicati avvengono alla FINE del turno e cambiano i valori del turno successivo. ', eventsSentence(ex)),
      U.h('p', {}, 'Regole da applicare:'),
      U.h('ul', {},
        U.h('li', {}, 'slow start (cwnd < ssthresh): la cwnd raddoppia a ogni RTT; se il raddoppio la porterebbe oltre la ssthresh, si ferma alla ssthresh;'),
        U.h('li', {}, 'congestion avoidance (cwnd ≥ ssthresh): +1 MSS per RTT;'),
        U.h('li', {}, '3 ACK duplicati (Reno): ssthresh = cwnd/2, cwnd = ssthresh, si prosegue in congestion avoidance;'),
        U.h('li', {}, 'timeout: ssthresh = cwnd/2, cwnd = 1 MSS, si riparte in slow start;'),
        U.h('li', {}, 'cwnd/2 si arrotonda per difetto, con minimo 2.')),
      U.h('p', { class: 'small' }, 'Per ogni turno scrivi la cwnd usata in quel turno, la ssthresh in vigore durante il turno e la fase.')));

    const head = ['RTT', 'Evento a fine turno', 'cwnd (MSS)', 'ssthresh', 'Fase'];
    groups(ex).forEach(g => {
      const rows = [];
      for (let t = g.from; t <= g.to; t++) {
        const r = ex.rows[t - 1];
        rows.push([
          U.label(`Turno ${t}`),
          r.ev === 'none' ? '—' : U.given(EV_NAME[r.ev]),
          t === 1 ? U.given('1') : U.inp(ctx, `t${t}.cwnd`, { w: 'xs', label: `cwnd turno ${t}` }),
          t === 1 ? U.given(String(ex.ss0)) : U.inp(ctx, `t${t}.ss`, { w: 'xs', label: `ssthresh turno ${t}` }),
          U.sel(ctx, `t${t}.phase`, PHASE_OPTS, { label: `fase turno ${t}` })
        ]);
      }
      const range = g.from === g.to ? `turno ${g.from}` : `turni ${g.from}–${g.to}`;
      root.appendChild(U.card(`${g.id}) ${g.title} (${range})`, { step: g.id }, U.table(head, rows)));
    });

    const q = qKeys(ex);
    if (q.length) {
      root.appendChild(U.card('d) Domande finali', { step: 'd' },
        ex.askTot ? U.row(`Segmenti inviati in totale dal turno 1 al turno ${ex.totAt} (compreso):`, U.inp(ctx, 'qTot', { w: 's', label: 'segmenti totali' })) : null,
        ex.askFirstCA ? U.row('Primo turno in congestion avoidance:', U.inp(ctx, 'qFirstCA', { w: 'xs', label: 'primo turno in congestion avoidance' })) : null,
        ex.askTahoe ? U.row(`Con TCP Tahoe, che cosa cambierebbe al turno ${ex.tahoe.t + 1} dopo i 3 ACK duplicati alla fine del turno ${ex.tahoe.t}?`,
          U.sel(ctx, 'qTahoe', tahoeOpts(ex), { w: 'xl', label: 'TCP Tahoe' })) : null));
    }
  }

  function solution(ex, root) {
    const rows = ex.rows.map(r => [
      U.label(`Turno ${r.t}`), r.ev === 'none' ? '—' : EV_NAME[r.ev], String(r.cwnd), String(r.ss), PHASE_NAME[r.phase], whyRow(ex, r)
    ]);
    const extra = [];
    if (ex.askTot) extra.push(U.h('p', { class: 'sol-body' }, U.h('b', {}, 'Segmenti inviati: '), `in ogni turno parte una finestra intera, quindi si sommano le cwnd dei turni 1…${ex.totAt}: ${sumExpr(ex)} = ${ex.tot}.`));
    if (ex.askFirstCA) {
      const r = ex.rows[ex.firstCA - 1];
      extra.push(U.h('p', { class: 'sol-body' }, U.h('b', {}, 'Primo turno in congestion avoidance: '), `turno ${ex.firstCA}, la prima riga con cwnd ≥ ssthresh (${r.cwnd} ≥ ${r.ss}).`));
    }
    if (ex.askTahoe) {
      const T = ex.tahoe;
      extra.push(U.h('p', { class: 'sol-body' }, U.h('b', {}, 'TCP Tahoe: '),
        `alla fine del turno ${T.t} la cwnd è ${T.C}. Reno: ssthresh = cwnd = ${T.H}, congestion avoidance. Tahoe non ha la fast recovery e reagisce come a un timeout: ssthresh = ${T.H}, ma cwnd = 1 e si riparte in slow start.`));
    }
    root.appendChild(U.h('div', { class: 'card sol' },
      U.h('h4', {}, 'Soluzione'),
      U.h('p', { class: 'sol-body' }, `Si procede una riga alla volta: i valori di un turno dipendono solo dal turno prima e dall'evento alla sua fine. ssthresh iniziale ${ex.ss0}. ${eventsSentence(ex)}`),
      U.table(['RTT', 'Evento a fine turno', 'cwnd (MSS)', 'ssthresh', 'Fase', 'Perché'], rows),
      U.fig(figSvg(ex), 'Linea continua con i punti: cwnd usata in ogni turno. Tratteggio: ssthresh in vigore. Le linee verticali segnano gli eventi alla fine del turno (TO = timeout, 3 dup = 3 ACK duplicati).'),
      extra,
      U.h('p', { class: 'small' }, 'Errori tipici: raddoppiare oltre la ssthresh; dimezzare la ssthresh vecchia invece della cwnd; dopo 3 ACK duplicati rimettere cwnd = 1 (è il timeout, o Tahoe); applicare l\'evento nel turno stesso invece che dal successivo.')));
  }

  function chatText(ex, a) {
    const v = k => (a && String(a[k] || '').trim()) || '__';
    const ph = k => { const x = a && a[k]; return x ? (PHASE_NAME[x] || x) : '__'; };
    const L = [];
    L.push(`#E1 · Finestra di congestione TCP (livello ${ex.level})`);
    L.push('## Testo');
    L.push(`TCP Reno, cwnd iniziale = 1 MSS, ssthresh iniziale = ${ex.ss0} MSS, ${ex.n} turni (RTT). Gli eventi avvengono alla fine del turno. ${eventsSentence(ex)}`);
    L.push('Regole: slow start (cwnd < ssthresh) raddoppio senza superare la ssthresh; congestion avoidance (cwnd ≥ ssthresh) +1 per RTT; 3 ACK duplicati: ssthresh = cwnd/2, cwnd = ssthresh; timeout: ssthresh = cwnd/2, cwnd = 1. Metà per difetto, minimo 2.');
    L.push('Per ogni turno: cwnd, ssthresh in vigore, fase.' +
      (ex.askTot ? ` Segmenti inviati in totale fino al turno ${ex.totAt}.` : '') +
      (ex.askFirstCA ? ' Primo turno in congestion avoidance.' : '') +
      (ex.askTahoe ? ` Con TCP Tahoe, cosa cambierebbe dopo i 3 ACK duplicati alla fine del turno ${ex.tahoe.t}?` : ''));
    L.push('');
    L.push('## Le mie risposte');
    L.push('Turno | evento a fine turno | cwnd | ssthresh | fase');
    ex.rows.forEach(r => {
      const cw = r.t === 1 ? '1' : v(`t${r.t}.cwnd`);
      const ss = r.t === 1 ? String(ex.ss0) : v(`t${r.t}.ss`);
      L.push(`${r.t} | ${EV_NAME[r.ev]} | ${cw} | ${ss} | ${ph(`t${r.t}.phase`)}`);
    });
    if (ex.askTot) L.push(`Segmenti fino al turno ${ex.totAt}: ${v('qTot')}`);
    if (ex.askFirstCA) L.push(`Primo turno in congestion avoidance: ${v('qFirstCA')}`);
    if (ex.askTahoe) {
      const opt = tahoeOpts(ex).find(o => o[0] === (a && a.qTahoe));
      L.push(`Tahoe: ${opt ? opt[1] : '__'}`);
    }
    return L.join('\n');
  }

  RA.cwnd = {
    id: 'cwnd', num: 'E1', name: 'Finestra di congestione TCP', extra: true, examPoints: 0,
    desc: 'TCP Reno turno per turno: slow start, congestion avoidance, reazione a 3 ACK duplicati e timeout.',
    method: {
      intro: 'La finestra di congestione (cwnd) dice quanti segmenti il mittente può inviare in un RTT senza aspettare ACK. Cresce finché la rete regge e si riduce quando TCP vede una perdita. Si compila una riga alla volta: ogni turno dipende solo dal turno prima e dall\'evento alla sua fine.',
      steps: [
        'Turno 1: cwnd = 1 MSS, ssthresh = quella data. Fase: confronta cwnd e ssthresh.',
        'Slow start (cwnd < ssthresh): al turno dopo la cwnd raddoppia, ma si ferma alla ssthresh se il doppio la supererebbe.',
        'Congestion avoidance (cwnd ≥ ssthresh): al turno dopo cwnd + 1.',
        '3 ACK duplicati alla fine del turno (Reno): ssthresh = ⌊cwnd/2⌋, cwnd = ssthresh, si resta in congestion avoidance.',
        'Timeout alla fine del turno: ssthresh = ⌊cwnd/2⌋, cwnd = 1, si riparte in slow start.',
        'Domande finali: segmenti inviati = somma delle cwnd; primo turno in CA = prima riga con cwnd ≥ ssthresh.'
      ],
      traps: [
        'L\'evento è alla FINE del turno: i nuovi valori valgono dal turno successivo.',
        'Si dimezza la cwnd del momento della perdita, non la vecchia ssthresh.',
        'In slow start non si supera la ssthresh: con ssthresh 12 si fa 1, 2, 4, 8, 12 (non 16).',
        'Con cwnd = ssthresh si è già in congestion avoidance.',
        'Dopo 3 ACK duplicati Reno NON riparte da 1: lo fanno il timeout e TCP Tahoe.',
        'Dopo un timeout si dimezza la ssthresh, non la cwnd: la cwnd torna a 1.'
      ],
      formulas: [
        ['Slow start (cwnd < ssthresh)', 'cwnd → min(2·cwnd, ssthresh)'],
        ['Congestion avoidance (cwnd ≥ ssthresh)', 'cwnd → cwnd + 1'],
        ['3 ACK duplicati (Reno)', 'ssthresh = ⌊cwnd/2⌋ (min 2) · cwnd = ssthresh'],
        ['Timeout', 'ssthresh = ⌊cwnd/2⌋ (min 2) · cwnd = 1'],
        ['TCP Tahoe', '3 ACK duplicati trattati come il timeout: cwnd = 1'],
        ['Segmenti inviati fino al turno K', 'cwnd₁ + cwnd₂ + … + cwnd_K']
      ]
    },
    traces: [],
    randomParams, build, gen, steps, grade, sol2answers, render, solution, hints, fieldHint, diagnose, diagnoseCases, chatText
  };
})();
