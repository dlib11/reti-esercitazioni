// ============================================================
// RetiApp · gen-tcp.js — Esercizio 4 · TCP: Seq# e Ack#
// Contratto dei moduli: docs/moduli.md (modello: gen-http.js)
// ============================================================
(function () {
  const RA = window.RetiApp;
  const U = RA.util;

  const other = d => (d === 'c' ? 's' : 'c');
  const hostName = d => (d === 'c' ? 'client' : 'server');
  const HOST = d => (d === 'c' ? 'Client' : 'Server');
  const ord = i => `${i + 1}°`;
  const SECTION_LABEL = {
    open: 'Apertura connessione',
    data: 'Scambio dati',
    closeC: 'Chiusura connessione lato client',
    closeS: 'Chiusura connessione lato server',
    close3: 'Chiusura connessione (in 3 segmenti)'
  };
  const FIELDS = ['syn', 'fin', 'seq', 'ack'];
  const P_FIELDS = ['len', 'syn', 'fin', 'seq', 'ack'];

  // "il 1°, il 3° e il 4°"
  function listOrd(idx) {
    const parts = idx.map(i => 'il ' + ord(i));
    return parts.length <= 1 ? parts.join('') : parts.slice(0, -1).join(', ') + ' e ' + parts[parts.length - 1];
  }

  // ---------------- parametri casuali ----------------
  const LEVELS = {
    1: { nData: [2, 3], pair: 0, lead: 0, pAck: 0.3, half: 0, close3: 0, flags: true, loss: null },
    2: { nData: [3, 4], pair: 0.3, lead: 0.2, pAck: 0.4, half: 0, close3: 0, flags: true, loss: 'simple' },
    3: { nData: [4, 5], pair: 1, lead: 0.5, pAck: 0.4, half: 0, close3: 0, flags: false, loss: 'exam' },
    4: { nData: [6, 7], pair: 1, lead: 0.4, pAck: 0.45, half: 0.4, close3: 0, flags: false, loss: 'any' },
    5: { nData: [5, 7], pair: 1, lead: 0.5, pAck: 0.4, half: 0.35, close3: 0.65, flags: false, loss: 'edge' }
  };

  function dataRows(cfg) {
    for (let attempt = 0; attempt < 50; attempt++) {
      const rows = [];
      const push = (dir, len) => rows.push({ dir, len, syn: 0, fin: 0, section: 'data' });
      // ACK puro ripetuto subito dopo l'handshake (come nell'esame)
      if (U.chance(cfg.lead)) push('c', 0);
      const n = U.rndInt(cfg.nData[0], cfg.nData[1]);
      const pairAt = U.chance(cfg.pair) ? U.rndInt(0, n - 2) : -1;
      for (let i = 0; i < n; i++) {
        const last = rows[rows.length - 1];
        let dir;
        if (pairAt >= 0 && i === pairAt + 1) dir = last.dir;      // secondo segmento consecutivo
        else {
          dir = U.chance(0.5) ? 'c' : 's';
          // niente coppie consecutive non previste
          if (last && last.len > 0 && last.dir === dir) dir = other(dir);
        }
        push(dir, U.rndInt(5, 60));
        if (i === pairAt) continue;                                 // nessun ACK in mezzo alla coppia
        if (i === pairAt + 1 && pairAt >= 0) { if (U.chance(0.6)) push(other(dir), 0); continue; }
        if (U.chance(cfg.pAck)) push(other(dir), 0);
      }
      const data = rows.filter(r => r.len > 0);
      if (data.some(r => r.dir === 'c') && data.some(r => r.dir === 's')) return rows;
    }
    return [{ dir: 'c', len: 20, syn: 0, fin: 0, section: 'data' }, { dir: 's', len: 30, syn: 0, fin: 0, section: 'data' }];
  }

  function closeRows(cfg, level) {
    const rows = [];
    const push = (dir, len, fin, section) => rows.push({ dir, len, syn: 0, fin, section });
    const first = U.chance(0.5) ? 'c' : 's', second = other(first);
    if (U.chance(cfg.close3)) {
      push(first, 0, 1, 'close3');
      push(second, 0, 1, 'close3');
      push(first, 0, 0, 'close3');
      return rows;
    }
    const secA = 'close' + (first === 'c' ? 'C' : 'S'), secB = 'close' + (second === 'c' ? 'C' : 'S');
    push(first, 0, 1, secA);
    push(second, 0, 0, secA);
    // half-close: chi non ha ancora chiuso può continuare a mandare dati
    if (U.chance(cfg.half)) { push(second, U.rndInt(5, 40), 0, secB); push(first, 0, 0, secB); }
    push(second, 0, 1, secB);
    push(first, 0, 0, secB);
    return rows;
  }

  function lossParams(kind) {
    const sender = U.chance(0.5) ? 'c' : 's';
    let n, lostIdx, extra = -1;
    if (kind === 'simple') { n = 4; lostIdx = U.pick([1, 2]); }
    else if (kind === 'exam') { n = U.rndInt(4, 5); lostIdx = U.rndInt(1, n - 2); }
    else if (kind === 'any') {
      n = U.rndInt(4, 6); lostIdx = U.rndInt(0, n - 2);
      if (U.chance(0.3) && n - 1 - lostIdx >= 2) extra = U.rndInt(lostIdx + 1, n - 1);
    } else {
      n = U.rndInt(5, 6); lostIdx = U.chance(0.55) ? 0 : 1;
      if (U.chance(0.35)) extra = U.rndInt(lostIdx + 1, n - 1);
    }
    const lens = Array.from({ length: n }, () => U.rndInt(10, 60));
    const arrived = [];
    for (let i = 0; i < n; i++) if (i !== lostIdx && i !== extra) arrived.push(i);
    return { sender, base: U.rndInt(100, 3000), rcvSeq: U.rndInt(100, 3000), lens, lostIdx, arrived };
  }

  function randomParams(level) {
    const cfg = LEVELS[level] || LEVELS[3];
    const pre = U.pick(['10.0.0', '192.168.1', '172.16.5', '10.1.2']);
    const client = `${pre}.${U.rndInt(2, 60)}`, server = `${pre}.${U.rndInt(61, 250)}`;
    const ISNc = U.rndInt(10, 950);
    let ISNs = U.rndInt(10, 950);
    while (Math.abs(ISNs - ISNc) < 60) ISNs = U.rndInt(10, 950);
    const rows = [
      { dir: 'c', len: 0, syn: 1, fin: 0, section: 'open' },
      { dir: 's', len: 0, syn: 1, fin: 0, section: 'open' },
      { dir: 'c', len: 0, syn: 0, fin: 0, section: 'open' }
    ].concat(dataRows(cfg), closeRows(cfg, level));
    return { level, client, server, ISNc, ISNs, rows, flagsGiven: cfg.flags, loss: cfg.loss ? lossParams(cfg.loss) : null };
  }

  // ---------------- costruzione (metodo dei due contatori) ----------------
  function build(p) {
    const cnt = { c: p.ISNc, s: p.ISNs };
    const rows = [];
    p.rows.forEach((r0, i) => {
      const dir = r0.dir, o = other(dir);
      const r = { n: i + 1, dir, len: r0.len, syn: r0.syn ? 1 : 0, fin: r0.fin ? 1 : 0, section: r0.section };
      r.before = cnt[dir];
      r.seq = cnt[dir];
      r.ack = i === 0 ? null : cnt[o];
      cnt[dir] += r.len + r.syn + r.fin;
      r.cAfter = cnt.c; r.sAfter = cnt.s;
      // riga precedente dello stesso host, ultima dell'altro host, segmenti dell'altro non ancora riscontrati
      r.prevOwn = -1; r.prevOther = -1;
      for (let j = i - 1; j >= 0; j--) if (rows[j].dir === dir) { r.prevOwn = j; break; }
      for (let j = i - 1; j >= 0; j--) if (rows[j].dir === o) { r.prevOther = j; break; }
      r.run = [];
      for (let j = r.prevOwn + 1; j < i; j++) if (rows[j].dir === o && rows[j].len + rows[j].syn + rows[j].fin > 0) r.run.push(j);
      r.given = { syn: !!p.flagsGiven, fin: !!p.flagsGiven, seq: i < 2, ack: i === 0 };
      rows.push(r);
    });
    return {
      cat: 'tcp', level: p.level, params: p,
      client: p.client, server: p.server, ISNc: p.ISNc, ISNs: p.ISNs,
      flagsGiven: !!p.flagsGiven, rows, loss: p.loss ? buildLoss(p.loss) : null
    };
  }

  function buildLoss(L) {
    const n = L.lens.length;
    const segs = [];
    let acc = L.base;
    L.lens.forEach((len, i) => { segs.push({ i, seq: acc, len, end: acc + len - 1, arrived: L.arrived.includes(i) }); acc += len; });
    const got = segs.map(() => false);
    let j = 0, expected = L.base, prevAck = L.base;
    const advance = () => { while (j < n && got[j]) { expected = segs[j].seq + segs[j].len; j++; } };
    const resps = [];
    L.arrived.slice().sort((a, b) => a - b).forEach((idx, k) => {
      got[idx] = true;
      advance();
      const buffered = [];
      for (let t = j; t < n; t++) if (got[t]) buffered.push(t);
      resps.push({ k: k + 1, seg: idx, len: 0, syn: 0, fin: 0, seq: L.rcvSeq, ack: expected, dup: expected === prevAck, buffered });
      prevAck = expected;
    });
    const dups = resps.filter(r => r.dup).length;
    const holeAck = expected;                 // Ack# fermo al buco
    const retxIdx = j;                        // primo segmento mancante
    got[retxIdx] = true;
    advance();
    const finalAck = expected;
    const lastByte = acc;                     // base + tutti i byte
    return {
      sender: L.sender, receiver: other(L.sender), base: L.base, rcvSeq: L.rcvSeq,
      lens: L.lens.slice(), segs, arrived: L.arrived.slice(), lostIdx: L.lostIdx, retxIdx,
      resps, dups, fast: dups >= 3, when: dups >= 3 ? 'dup3' : 'timeout',
      holeAck, retxSeq: segs[retxIdx].seq, finalAck, lastByte,
      total: U.sum(L.lens), missing: segs.filter(s => !s.arrived).map(s => s.i)
    };
  }

  const gen = level => build(randomParams(level));

  // ---------------- chiavi e passi ----------------
  function rowKeys(r) { return FIELDS.filter(f => !r.given[f]).map(f => `r${r.n}.${f}`); }
  function keysOf(ex, test) { return [].concat(...ex.rows.filter(r => test(r.section)).map(rowKeys)); }
  function lossKeys(ex) { return ex.loss ? [].concat(...ex.loss.resps.map(r => P_FIELDS.map(f => `p${r.k}.${f}`))) : []; }

  function steps(ex) {
    const s = [
      { id: 'open', title: 'Apertura', keys: keysOf(ex, sec => sec === 'open') },
      { id: 'data', title: 'Scambio dati', keys: keysOf(ex, sec => sec === 'data') },
      { id: 'close', title: 'Chiusura', keys: keysOf(ex, sec => sec.startsWith('close')) }
    ];
    if (ex.loss) {
      s.push({ id: 'pa', title: 'Perdita a) risposte', keys: lossKeys(ex) });
      s.push({ id: 'pb', title: 'Perdita b) fast retransmit', keys: ['fast', 'when', 'retxSeq'] });
      s.push({ id: 'pc', title: 'Perdita c) dopo la ritrasmissione', keys: ['finalAck'] });
    }
    return s;
  }

  // chiave → { row, f } oppure { resp, f }
  function parseKey(ex, key) {
    let m = /^r(\d+)\.(syn|fin|seq|ack)$/.exec(key);
    if (m) { const row = ex.rows[Number(m[1]) - 1]; return row ? { row, f: m[2] } : null; }
    m = /^p(\d+)\.(len|syn|fin|seq|ack)$/.exec(key);
    if (m && ex.loss) { const resp = ex.loss.resps[Number(m[1]) - 1]; return resp ? { resp, f: m[2] } : null; }
    return null;
  }

  // ---------------- testi di calcolo ----------------
  const isPure = r => r.len === 0 && !r.syn && !r.fin;
  const consumed = r => r.len + r.syn + r.fin;
  function plusText(r) {
    if (isPure(r)) return `${r.seq} + 0 (ACK puro)`;
    return `${r.seq}` + (r.len ? ` + ${r.len}` : '') + (r.syn ? ' + 1 (SYN)' : '') + (r.fin ? ' + 1 (FIN)' : '');
  }
  function calcText(r) {
    if (isPure(r)) return 'ACK puro: +0';
    const parts = [];
    if (r.syn) parts.push('SYN');
    if (r.fin) parts.push('FIN');
    return (parts.length ? parts.join('+') + ': ' : '') + `${r.before}` + (r.len ? ` + ${r.len}` : '') + (r.syn || r.fin ? ' + 1' : '') + ` = ${r.before + consumed(r)}`;
  }
  function seqWhy(ex, r) {
    if (r.prevOwn < 0) return `Seq# = ISN del ${hostName(r.dir)} = ${r.seq}.`;
    const p = ex.rows[r.prevOwn];
    return `Seq# = contatore del ${hostName(r.dir)}: segmento precedente del ${hostName(r.dir)} (riga ${p.n}) ${plusText(p)} = ${r.seq}.`;
  }
  function ackWhy(ex, r) {
    const q = ex.rows[r.prevOther];
    let s = `Ack# = prossimo byte atteso dal ${hostName(other(r.dir))}: ultimo segmento ricevuto (riga ${q.n}) ${plusText(q)} = ${r.ack}.`;
    if (r.run.length >= 2) s += ` Le righe ${r.run.map(j => ex.rows[j].n).join(' e ')} sono consecutive: l'ACK cumulativo le riscontra tutte.`;
    return s;
  }
  function isAckOfFin(ex, r) { return r.prevOther >= 0 && ex.rows[r.prevOther].fin === 1 && !r.fin; }
  function flagMsg(ex, r, f) {
    const h = hostName(r.dir);
    if (f === 'syn') return r.syn ? `SYN = 1: il ${h} propone il suo ISN (${r.seq}). Il SYN consuma un numero di sequenza.` :
      'SYN = 0: SYN vale 1 solo nei primi due segmenti, quelli che propongono gli ISN.';
    if (r.fin) return r.section === 'close3' && r.prevOther >= 0 && ex.rows[r.prevOther].fin ?
      `FIN = 1: in una chiusura in 3 segmenti il ${h} riscontra il FIN e chiude la sua direzione nello stesso segmento.` :
      `FIN = 1: con questo segmento il ${h} chiude la sua direzione. Il FIN consuma un numero di sequenza.`;
    if (isAckOfFin(ex, r)) return `FIN = 0: questo segmento riscontra il FIN della riga ${ex.rows[r.prevOther].n}, è un ACK.`;
    return `FIN = 0: il ${h} qui non sta chiudendo.`;
  }

  // ---------------- correzione ----------------
  function fieldMsg(ex, key) {
    const pk = parseKey(ex, key);
    const Lo = ex.loss;
    if (pk && pk.row) {
      const r = pk.row;
      if (pk.f === 'seq') return seqWhy(ex, r);
      if (pk.f === 'ack') return ackWhy(ex, r);
      return flagMsg(ex, r, pk.f);
    }
    if (pk && pk.resp) {
      const R = hostName(Lo.receiver), rs = pk.resp, sg = Lo.segs[rs.seg];
      if (pk.f === 'len') return `Lungh. = 0: il ${R} non ha dati da inviare, risponde con un ACK puro.`;
      if (pk.f === 'syn' || pk.f === 'fin') return `${pk.f.toUpperCase()} = 0: la connessione è già aperta e nessuno sta chiudendo.`;
      if (pk.f === 'seq') return `Seq# = contatore del ${R} = ${Lo.rcvSeq}: non manda dati, quindi resta fermo.`;
      return `Dopo il ${ord(rs.seg)} segmento (byte ${sg.seq}–${sg.end}) il ${R} ha in ordine tutti i byte fino a ${rs.ack - 1}: Ack# = ${rs.ack}` +
        (rs.dup ? ' (ACK duplicato: il buco non si è chiuso).' : '.') + (rs.buffered.length ? ` I segmenti fuori ordine (${listOrd(rs.buffered)}) restano in buffer e non si riscontrano.` : '');
    }
    if (!Lo) return '';
    const S = hostName(Lo.sender);
    switch (key) {
      case 'fast': return Lo.fast ?
        `Sì: il ${S} riceve ${Lo.dups} ACK duplicati (Ack# = ${Lo.holeAck}); dal 3° duplicato ritrasmette subito.` :
        `No: il ${S} riceve solo ${Lo.dups} ACK duplicat${Lo.dups === 1 ? 'o' : 'i'}; per il fast retransmit ne servono 3, quindi aspetta il timeout.`;
      case 'when': return Lo.fast ? 'Ritrasmette appena arriva il 3° ACK duplicato, senza aspettare il timeout.' :
        `Con ${Lo.dups} duplicat${Lo.dups === 1 ? 'o' : 'i'} il fast retransmit non scatta: ritrasmette allo scadere del timeout.`;
      case 'retxSeq': return `Si ritrasmette il segmento che inizia con il primo byte mancante: Seq# = ${Lo.retxSeq} (lo stesso numero degli ACK duplicati).`;
      case 'finalAck': return `Con la ritrasmissione il buco ${Lo.segs[Lo.retxIdx].seq}–${Lo.segs[Lo.retxIdx].end} si chiude e il ${hostName(Lo.receiver)} unisce i segmenti in buffer: ha tutto fino a ${Lo.finalAck - 1}, quindi un solo ACK cumulativo con Ack# = ${Lo.finalAck}.` +
        (Lo.finalAck !== Lo.lastByte ? ` Non si va oltre: i byte da ${Lo.finalAck} non sono mai arrivati.` : '');
      default: return '';
    }
  }

  function sol2answers(ex) {
    const a = {};
    ex.rows.forEach(r => FIELDS.forEach(f => { if (!r.given[f]) a[`r${r.n}.${f}`] = String(r[f]); }));
    if (ex.loss) {
      const Lo = ex.loss;
      Lo.resps.forEach(r => P_FIELDS.forEach(f => { a[`p${r.k}.${f}`] = String(r[f]); }));
      a.fast = Lo.fast ? 'si' : 'no';
      a.when = Lo.when;
      a.retxSeq = String(Lo.retxSeq);
      a.finalAck = String(Lo.finalAck);
    }
    return a;
  }

  function grade(ex, answers) {
    answers = answers || {};
    const sol = sol2answers(ex);
    const marks = {};
    let correct = 0, total = 0;
    Object.keys(sol).forEach(k => {
      total++;
      const ok = U.numEq(String(answers[k] == null ? '' : answers[k]).toLowerCase(), sol[k]);
      if (ok) correct++;
      marks[k] = { ok, msg: fieldMsg(ex, k) };
    });
    return { correct, total, marks };
  }

  // ---------------- errori tipici ----------------
  function diagnose(ex, key, value, answers) {
    const v = String(value == null ? '' : value).trim().toLowerCase();
    if (v === '') return null;
    const n = Number(v);
    const isNum = /^-?\d+$/.test(v);
    const pk = parseKey(ex, key);
    if (pk && pk.row) {
      const r = pk.row, h = hostName(r.dir), oh = hostName(other(r.dir));
      if (pk.f === 'syn' || pk.f === 'fin') {
        if (v !== '0' && v !== '1') return 'SYN e FIN sono flag: si scrive 0 oppure 1.';
        if (pk.f === 'syn') {
          if (r.syn) return `Questo segmento propone l'ISN del ${h}: è un SYN, quindi SYN = 1.`;
          if (r.n === 3) return 'Il terzo segmento dell\'handshake è solo un ACK: non propone un nuovo ISN, SYN = 0.';
          return 'SYN = 1 solo nei primi due segmenti dell\'apertura.';
        }
        if (r.fin) return r.section === 'close3' && ex.rows[r.prevOther].fin ?
          'Chiusura in 3 segmenti: questo segmento riscontra il FIN e chiude anche l\'altra direzione, quindi FIN = 1.' :
          `Con questo segmento il ${h} chiude la sua direzione: FIN = 1.`;
        if (isAckOfFin(ex, r)) return `Questo segmento riscontra il FIN della riga ${ex.rows[r.prevOther].n}: è un ACK, FIN = 0.`;
        return 'FIN = 1 solo nel segmento con cui un host chiude la sua direzione.';
      }
      if (!isNum) return 'Scrivi un numero intero.';
      if (pk.f === 'seq') {
        const p = r.prevOwn >= 0 ? ex.rows[r.prevOwn] : null;
        if (n === r.seq) return null;
        if (p && isPure(p) && n === r.seq + 1) return `Seq# aumentato dopo un ACK puro: la riga ${p.n} non ha dati né SYN/FIN, quindi non consuma numeri e il ${h} riparte da ${r.seq}.`;
        if (p && (p.syn || p.fin) && n === r.seq - 1) return `Seq# più basso di 1: il ${p.syn ? 'SYN' : 'FIN'} della riga ${p.n} consuma un numero di sequenza, va contato +1.`;
        if (p && p.len > 0 && n === p.seq) return `Hai ripetuto il Seq# della riga ${p.n}: quel segmento portava ${p.len} byte, quindi il contatore è avanzato di ${p.len}.`;
        if (r.ack !== null && n === r.ack && r.ack !== r.seq) return `Hai usato il contatore del ${oh}: il Seq# segue la numerazione del mittente (${h}).`;
        if (p && n === r.seq + 1 && !p.syn && !p.fin) return `Hai aggiunto 1 senza SYN né FIN: solo SYN e FIN valgono +1.`;
        return null;
      }
      if (pk.f === 'ack') {
        if (n === r.ack) return null;
        const q = ex.rows[r.prevOther];
        if ((q.syn || q.fin) && n === r.ack - 1) return `Ack# più basso di 1: il ${q.syn ? 'SYN' : 'FIN'} della riga ${q.n} consuma un numero di sequenza, quindi va contato +1 (${q.seq}${q.len ? ' + ' + q.len : ''} + 1 = ${r.ack}).`;
        if (r.run.length >= 2) {
          const f0 = ex.rows[r.run[0]];
          if (n === f0.seq + consumed(f0)) return `Hai riscontrato solo il primo dei segmenti consecutivi (righe ${r.run.map(j => ex.rows[j].n).join(' e ')}): l'ACK è cumulativo e li conta tutti, fino a ${r.ack}.`;
          const own = r.prevOwn >= 0 ? ex.rows[r.prevOwn].ack : null;
          if (own !== null && n === own + consumed(q) && n !== r.ack) return `Hai sommato solo l'ultimo dei segmenti consecutivi (righe ${r.run.map(j => ex.rows[j].n).join(' e ')}): l'ACK cumulativo li riscontra tutti.`;
        }
        if (q.len > 0 && n === q.seq) return `Hai messo il Seq# della riga ${q.n} senza sommare la Lungh.: l'Ack# è il prossimo byte atteso = ${q.seq} + ${q.len}${q.fin ? ' + 1' : ''}.`;
        if (isPure(q) && n === r.ack + 1) return `Hai aggiunto 1 per l'ACK puro della riga ${q.n}: senza dati né SYN/FIN non consuma numeri.`;
        if (n === r.seq && r.seq !== r.ack) return `Hai usato il contatore del ${h}: l'Ack# riguarda i byte ricevuti dal ${oh}.`;
        if (n === r.ack + 1 && !q.syn && !q.fin) return 'Hai aggiunto 1 senza SYN né FIN: solo SYN e FIN valgono +1.';
        return null;
      }
    }
    const Lo = ex.loss;
    if (!Lo) return null;
    const R = hostName(Lo.receiver), S = hostName(Lo.sender);
    if (pk && pk.resp) {
      const rs = pk.resp, sg = Lo.segs[rs.seg];
      if (pk.f === 'len') {
        if (!isNum) return 'Scrivi un numero intero.';
        if (n === sg.len) return `Hai copiato la lunghezza del segmento ricevuto: la risposta del ${R} è un ACK puro, Lungh. = 0.`;
        return n === 0 ? null : `Il ${R} non manda dati: la risposta è un ACK puro, Lungh. = 0.`;
      }
      if (pk.f === 'syn' || pk.f === 'fin') return v === '1' ? `Nessun ${pk.f.toUpperCase()}: la connessione è già aperta e nessuno sta chiudendo.` : null;
      if (!isNum) return 'Scrivi un numero intero.';
      if (pk.f === 'seq') {
        if (n === Lo.rcvSeq) return null;
        if (n === sg.seq) return `Hai copiato il Seq# del segmento ricevuto: il Seq# del ${R} segue la sua numerazione, che resta ${Lo.rcvSeq} perché non manda dati.`;
        return `Il Seq# del ${R} resta ${Lo.rcvSeq}: non manda dati, quindi il suo contatore non si muove.`;
      }
      if (pk.f === 'ack') {
        if (n === rs.ack) return null;
        if (n === sg.seq + sg.len || n > rs.ack) return `L'Ack# avanza oltre il buco: manca ancora il byte ${rs.ack} e l'ACK è cumulativo, quindi resta ${rs.ack} anche se i byte dopo sono arrivati.`;
        if (n === rs.ack - 1) return 'L\'Ack# è il PROSSIMO byte atteso, non l\'ultimo ricevuto.';
        if (n === sg.seq) return 'Hai messo il Seq# del segmento ricevuto: l\'Ack# è il primo byte che ancora manca.';
        return null;
      }
    }
    switch (key) {
      case 'fast':
        if (v === 'si' && !Lo.fast) return `Fast retransmit con meno di 3 duplicati: qui ${Lo.dups === 1 ? 'c\'è un solo ACK duplicato' : `gli ACK duplicati sono solo ${Lo.dups}`}` +
          (Lo.lostIdx > 0 ? ` (il primo ACK con Ack# ${Lo.holeAck} è un ACK normale, non un duplicato).` : '.');
        if (v === 'no' && Lo.fast) return `Il ${S} riceve ${Lo.dups} ACK duplicati (Ack# ${Lo.holeAck}): ne bastano 3 per il fast retransmit.`;
        return null;
      case 'when':
        if (v === 'timeout' && Lo.fast) return `Con ${Lo.dups} ACK duplicati il ${S} non aspetta il timeout: ritrasmette al 3° duplicato.`;
        if (v === 'dup3' && !Lo.fast) return `Il 3° ACK duplicato non arriva mai (sono ${Lo.dups}): resta solo il timeout.`;
        return null;
      case 'retxSeq': {
        if (!isNum) return 'Scrivi il Seq# del segmento ritrasmesso.';
        if (n === Lo.retxSeq) return null;
        const nx = Lo.segs[Lo.retxIdx + 1];
        if (nx && n === nx.seq) return `Si ritrasmette il segmento perso, quello che inizia al byte ${Lo.retxSeq} (il numero degli ACK duplicati), non il successivo.`;
        if (n === Lo.segs[Lo.retxIdx].end || n === Lo.segs[Lo.retxIdx].end + 1) return 'Il Seq# è il PRIMO byte del segmento, non l\'ultimo.';
        return null;
      }
      case 'finalAck': {
        if (!isNum) return 'Scrivi un numero intero.';
        if (n === Lo.finalAck) return null;
        const lost = Lo.segs[Lo.retxIdx];
        if (n === lost.seq + lost.len) return `Ack# che non include i segmenti in buffer: il ${R} ha già conservato i segmenti fuori ordine, quindi con la ritrasmissione riscontra tutto fino a ${Lo.finalAck - 1}.`;
        if (n === Lo.lastByte) return `Il segmento ${Lo.missing.filter(i => i !== Lo.retxIdx).map(ord).join(', ')} non è mai arrivato: l'ACK cumulativo si ferma a ${Lo.finalAck}.`;
        if (n === Lo.holeAck) return 'Dopo la ritrasmissione il buco si chiude: l\'Ack# deve avanzare.';
        if (n === Lo.finalAck - 1) return 'L\'Ack# è il PROSSIMO byte atteso, non l\'ultimo ricevuto.';
        return null;
      }
      default: return null;
    }
  }

  function diagnoseCases(ex) {
    const out = [];
    const R = ex.rows;
    const sol = sol2answers(ex);
    const has = k => k in sol;
    // Ack# dopo il SYN del client (riga 2) e dopo il primo FIN
    if (has('r2.ack')) out.push({ key: 'r2.ack', value: String(R[1].ack - 1), expect: 'più basso di 1' });
    const afterFin = R.find(r => r.prevOther >= 0 && R[r.prevOther].fin && !r.given.ack && R[r.prevOther].len === 0);
    if (afterFin) out.push({ key: `r${afterFin.n}.ack`, value: String(afterFin.ack - 1), expect: 'più basso di 1' });
    // Ack# = Seq# dell'altro senza Lungh.
    const single = R.find(r => !r.given.ack && r.run.length === 1 && R[r.prevOther].len > 0 && !R[r.prevOther].fin);
    if (single) out.push({ key: `r${single.n}.ack`, value: String(R[single.prevOther].seq), expect: 'senza sommare' });
    // Seq# aumentato dopo un ACK puro
    const afterPure = R.find(r => !r.given.seq && r.prevOwn >= 0 && isPure(R[r.prevOwn]));
    if (afterPure) out.push({ key: `r${afterPure.n}.seq`, value: String(afterPure.seq + 1), expect: 'ACK puro' });
    // segmenti consecutivi riscontrati insieme
    const pair = R.find(r => !r.given.ack && r.run.length >= 2 && !R[r.run[r.run.length - 1]].fin);
    if (pair) out.push({ key: `r${pair.n}.ack`, value: String(R[pair.run[0]].seq + consumed(R[pair.run[0]])), expect: 'consecutiv' });
    if (!ex.flagsGiven) {
      out.push({ key: 'r3.syn', value: '1', expect: 'terzo segmento' });
      const ackFin = R.find(r => isAckOfFin(ex, r));
      if (ackFin) out.push({ key: `r${ackFin.n}.fin`, value: '1', expect: 'riscontra il FIN' });
    }
    const Lo = ex.loss;
    if (Lo) {
      const beyond = Lo.resps.find(r => r.seg > Lo.retxIdx);
      if (beyond) out.push({ key: `p${beyond.k}.ack`, value: String(Lo.segs[beyond.seg].seq + Lo.segs[beyond.seg].len), expect: 'buco' });
      if (Lo.segs[Lo.resps[0].seg].seq !== Lo.rcvSeq) out.push({ key: 'p1.seq', value: String(Lo.segs[Lo.resps[0].seg].seq), expect: 'non manda dati' });
      if (Lo.resps.length > 1) out.push({ key: `p${Lo.resps.length}.seq`, value: String(Lo.rcvSeq + 1), expect: 'non manda dati' });
      if (!Lo.fast) out.push({ key: 'fast', value: 'si', expect: 'meno di 3' });
      else out.push({ key: 'fast', value: 'no', expect: 'ACK duplicati' });
      const lost = Lo.segs[Lo.retxIdx];
      if (lost.seq + lost.len !== Lo.finalAck) out.push({ key: 'finalAck', value: String(lost.seq + lost.len), expect: 'in buffer' });
      if (Lo.lastByte !== Lo.finalAck && Lo.lastByte !== lost.seq + lost.len) out.push({ key: 'finalAck', value: String(Lo.lastByte), expect: 'mai arrivato' });
    }
    return out;
  }

  // ---------------- aiuti ----------------
  function fieldHint(ex, key) {
    const pk = parseKey(ex, key);
    if (pk && pk.row) {
      const r = pk.row, h = hostName(r.dir), oh = hostName(other(r.dir));
      if (pk.f === 'seq') {
        const p = ex.rows[r.prevOwn];
        return `Seq# = contatore del ${h}. Guarda il suo segmento precedente (riga ${p.n}): Seq# + Lungh. (+1 se SYN/FIN). Un ACK puro non sposta il contatore.`;
      }
      if (pk.f === 'ack') {
        const q = ex.rows[r.prevOther];
        return `Ack# = prossimo byte atteso dal ${oh}. Guarda l'ultimo segmento ricevuto dal ${oh} (riga ${q.n}): Seq# + Lungh. (+1 se SYN/FIN).` +
          (r.run.length >= 2 ? ` Le righe ${r.run.map(j => ex.rows[j].n).join(' e ')} sono entrambe del ${oh}: l'ACK le riscontra insieme.` : '');
      }
      if (pk.f === 'syn') return 'SYN = 1 solo nei segmenti che propongono un ISN: i primi due dell\'apertura.';
      return 'FIN = 1 nel segmento con cui un host chiude la sua direzione. Chi lo riscontra manda un ACK (FIN = 0), a meno che chiuda nello stesso segmento.';
    }
    const Lo = ex.loss;
    if (!Lo) return 'Rileggi il testo della domanda.';
    const R = hostName(Lo.receiver), S = hostName(Lo.sender);
    if (pk && pk.resp) {
      if (pk.f === 'len' || pk.f === 'syn' || pk.f === 'fin') return `Il ${R} non ha dati da inviare e non apre né chiude la connessione: che tipo di segmento manda?`;
      if (pk.f === 'seq') return `Il Seq# del ${R} è il suo contatore: cambia solo se manda dati (o SYN/FIN).`;
      return `Quali byte ha ricevuto IN ORDINE il ${R} dopo il ${ord(pk.resp.seg)} segmento? L'Ack# è il primo byte che ancora gli manca.`;
    }
    return {
      fast: `Conta gli ACK duplicati: stesso Ack# dell'ACK precedente. L'ultimo ACK che il ${S} aveva già prima aveva Ack# ${Lo.base}. Ne servono 3.`,
      when: 'Con almeno 3 ACK duplicati ritrasmette subito; altrimenti aspetta il timeout.',
      retxSeq: `Si ritrasmette il segmento che contiene il primo byte mancante: quale Ack# continua a ripetere il ${R}?`,
      finalAck: `Quando arriva la ritrasmissione il ${R} unisce i byte che ha in buffer: fin dove arrivano ora senza buchi?`
    }[key] || 'Rileggi il testo della domanda.';
  }

  function rowLine(ex, r) {
    return `riga ${r.n} · ${r.dir === 'c' ? 'C → S' : 'S → C'} Lungh. ${r.len}${r.syn ? ' SYN' : ''}${r.fin ? ' FIN' : ''}: Seq# ${r.seq}, Ack# ${r.ack === null ? '—' : r.ack} → contatori C ${r.cAfter}, S ${r.sAfter}`;
  }

  function hints(ex) {
    const R = ex.rows;
    const sec = test => R.filter(r => test(r.section));
    const dataR = sec(s => s === 'data'), closeR = sec(s => s.startsWith('close'));
    const lastOpen = sec(s => s === 'open').slice(-1)[0];
    const pairs = R.filter(r => r.run.length >= 2);
    const pures = dataR.filter(isPure).map(r => r.n);
    const firstClose = closeR[0];
    const H = [
      {
        step: 'open', title: 'Apertura (three-way handshake)',
        metodo: 'Tieni due contatori, uno per host: il prossimo Seq# che quell\'host userà. Per ogni riga: Seq# = contatore del mittente; Ack# = contatore dell\'altro; poi il contatore del mittente cresce di Lungh., +1 se c\'è SYN o FIN.',
        applicato: `Contatori di partenza: client = ${ex.ISNc}, server = ${ex.ISNs} (gli ISN delle righe 1 e 2). I due SYN consumano 1 ciascuno; il terzo segmento è un ACK puro.`,
        svolto: sec(s => s === 'open').map(r => rowLine(ex, r)).join('\n')
      },
      {
        step: 'data', title: 'Scambio dati',
        metodo: 'Stesso metodo riga per riga. Un ACK puro (Lungh. 0, senza SYN/FIN) non sposta il contatore. Se un host manda due segmenti di fila, l\'altro li riscontra insieme: l\'Ack# conta tutti i byte arrivati.',
        applicato: `Dopo l'apertura i contatori valgono client = ${lastOpen.cAfter}, server = ${lastOpen.sAfter}.` +
          (pures.length ? ` ACK puri nello scambio dati: righe ${pures.join(', ')}.` : '') +
          (pairs.filter(r => r.section === 'data').length ? ` Segmenti consecutivi dello stesso host: righe ${pairs.filter(r => r.section === 'data').map(r => r.run.map(j => R[j].n).join(' e ')).join('; ')}.` : ''),
        svolto: dataR.map(r => rowLine(ex, r)).join('\n')
      },
      {
        step: 'close', title: 'Chiusura',
        metodo: 'Ogni direzione si chiude da sola: chi ha finito manda FIN (consuma 1), l\'altro lo riscontra con Ack# = Seq# del FIN + 1. Con la chiusura in 3 segmenti il secondo FIN viaggia insieme all\'ACK.',
        applicato: `All'inizio della chiusura i contatori valgono client = ${firstClose.cAfter - (firstClose.dir === 'c' ? consumed(firstClose) : 0)}, server = ${firstClose.sAfter - (firstClose.dir === 's' ? consumed(firstClose) : 0)}. Chiude per primo il ${hostName(firstClose.dir)} (riga ${firstClose.n}).`,
        svolto: closeR.map(r => rowLine(ex, r)).join('\n')
      }
    ];
    const Lo = ex.loss;
    if (Lo) {
      const Rn = hostName(Lo.receiver), Sn = hostName(Lo.sender);
      H.push({
        step: 'pa', title: 'Perdita a) risposte del ricevente',
        metodo: 'Il ricevente risponde a ogni segmento con un ACK puro. Il suo Seq# resta fermo (non manda dati). L\'Ack# è il primo byte che ancora manca: con un buco resta fermo, anche se arrivano segmenti successivi (ACK duplicati).',
        applicato: `Il ${Rn} ha Seq# ${Lo.rcvSeq} e all'inizio aspetta il byte ${Lo.base}. Byte coperti: ` +
          Lo.segs.map(s => `${ord(s.i)} ${s.seq}–${s.end}`).join(', ') + `. Arrivano ${listOrd(Lo.arrived)}.`,
        svolto: Lo.resps.map(r => `ricevuto il ${ord(r.seg)} (${Lo.segs[r.seg].seq}–${Lo.segs[r.seg].end}) → Ack# ${r.ack}${r.dup ? ' (duplicato)' : ''}` +
          (r.buffered.length ? `; in buffer: ${listOrd(r.buffered)}` : '')).join('\n') + `\nTutte con Lungh. 0, SYN 0, FIN 0, Seq# ${Lo.rcvSeq}.`
      });
      H.push({
        step: 'pb', title: 'Perdita b) fast retransmit',
        metodo: 'Fast retransmit: al 3° ACK duplicato (4 ACK con lo stesso numero) il mittente ritrasmette subito il segmento mancante. Con meno di 3 duplicati aspetta il timeout. Si ritrasmette il segmento che inizia con il numero degli ACK duplicati.',
        applicato: `L'ultimo ACK che il ${Sn} aveva prima di questi segmenti aveva Ack# ${Lo.base}. Confronta ogni Ack# delle risposte con quello precedente.`,
        svolto: `Ack# ricevuti: ${Lo.base} (prima), ${Lo.resps.map(r => r.ack + (r.dup ? '*' : '')).join(', ')} (* = duplicato). Duplicati: ${Lo.dups} → ` +
          (Lo.fast ? 'fast retransmit dopo il 3° duplicato' : 'niente fast retransmit, si aspetta il timeout') + `. Si ritrasmette il segmento con Seq# ${Lo.retxSeq} (Lungh. ${Lo.segs[Lo.retxIdx].len}).`
      });
      H.push({
        step: 'pc', title: 'Perdita c) dopo la ritrasmissione',
        metodo: 'Il ricevente conserva i segmenti fuori ordine. Quando arriva il pezzo mancante, riscontra con un solo ACK cumulativo tutto ciò che ora è contiguo.',
        applicato: `Il segmento ritrasmesso copre i byte ${Lo.segs[Lo.retxIdx].seq}–${Lo.segs[Lo.retxIdx].end}. In buffer il ${Rn} ha: ${listOrd(Lo.resps.length ? Lo.resps[Lo.resps.length - 1].buffered : []) || 'niente'}.`,
        svolto: `Ora il ${Rn} ha in ordine tutti i byte fino a ${Lo.finalAck - 1} → Ack# ${Lo.finalAck}.` + (Lo.finalAck !== Lo.lastByte ? ` Oltre c'è ancora un buco (segmento mai arrivato).` : '')
      });
    }
    return H;
  }

  // ---------------- disegno ----------------
  function ipOf(ex, d) { return d === 'c' ? ex.client : ex.server; }
  function dirText(ex, d) { return `${ipOf(ex, d)} → ${ipOf(ex, other(d))}`; }

  function render(ex, root, ctx) {
    root.appendChild(U.h('div', { class: 'card intro' },
      U.h('p', {}, U.h('b', {}, 'Testo. '), `Completa i campi mancanti della traccia di segmenti TCP tra il client ${ex.client} e il server ${ex.server}.`),
      U.h('p', { class: 'small' }, 'Legenda: SYN e FIN valgono +1, un ACK puro (Lungh. 0) non consuma numeri; il primo Ack# è —. Nei campi SYN e FIN scrivi 0 o 1. I valori in grigio sono dati dal testo.')));

    const rows = [];
    let last = null;
    ex.rows.forEach(r => {
      if (r.section !== last) { last = r.section; rows.push({ section: SECTION_LABEL[r.section] || r.section }); }
      const cell = f => {
        if (r.given[f]) return U.given(f === 'ack' && r.ack === null ? '—' : String(r[f]));
        return U.inp(ctx, `r${r.n}.${f}`, { w: f === 'syn' || f === 'fin' ? 'xs' : 's', label: `riga ${r.n} ${f === 'seq' ? 'Seq#' : f === 'ack' ? 'Ack#' : f.toUpperCase()}` });
      };
      rows.push([U.label(String(r.n)), U.label(dirText(ex, r.dir)), U.given(r.len), cell('syn'), cell('fin'), cell('seq'), cell('ack')]);
    });
    root.appendChild(U.card('Traccia della connessione', {},
      U.table(['#', 'Da → A', 'Lungh.', 'SYN', 'FIN', 'Seq#', 'Ack#'], rows)));

    const Lo = ex.loss;
    if (!Lo) return;
    const S = hostName(Lo.sender), R = hostName(Lo.receiver);
    root.appendChild(U.card('Perdita di un segmento', {},
      U.h('p', {}, `In una successiva connessione tra i due host il ${S}, mentre il ${R} non ha dati da inviare, manda ${Lo.total} byte in ${Lo.segs.length} segmenti (Ack# = ${Lo.rcvSeq} in tutti). ` +
        `L'ultimo ACK che il ${S} aveva ricevuto prima aveva Ack# ${Lo.base}.`),
      U.table(['#', 'Da → A', 'Lungh.', 'SYN', 'FIN', 'Seq#', 'Ack#', 'Arriva?'], Lo.segs.map(s => ({
        tr: [U.label(ord(s.i)), U.label(dirText(ex, Lo.sender)), U.given(s.len), U.given('0'), U.given('0'), U.given(s.seq), U.given(Lo.rcvSeq), s.arrived ? 'sì' : 'perso'],
        cls: s.arrived ? null : 'lost'
      }))),
      U.h('p', {}, `Il ${R} riceve solo ${listOrd(Lo.arrived)} segmento, in quest'ordine.`)));

    root.appendChild(U.card(`a) Scrivi i ${Lo.resps.length} segmenti con cui il ${R} risponde (Lungh., SYN, FIN, Seq#, Ack#)`, { step: 'pa' },
      U.table(['Risposta', 'Al segmento', 'Da → A', 'Lungh.', 'SYN', 'FIN', 'Seq#', 'Ack#'], Lo.resps.map(r => [
        U.label(String(r.k)), U.label(ord(r.seg)), U.label(dirText(ex, Lo.receiver)),
        ...P_FIELDS.map(f => U.inp(ctx, `p${r.k}.${f}`, { w: f === 'seq' || f === 'ack' ? 's' : 'xs', label: `risposta ${r.k} ${f === 'len' ? 'Lungh.' : f === 'seq' ? 'Seq#' : f === 'ack' ? 'Ack#' : f.toUpperCase()}` }))
      ]))));

    root.appendChild(U.card(`b) Il ${S} effettuerà un fast retransmit? Quale segmento ritrasmetterà e quando?`, { step: 'pb' },
      U.row('Fast retransmit?', U.sel(ctx, 'fast', [['si', 'Sì'], ['no', 'No']], { label: 'fast retransmit' })),
      U.row('Quando ritrasmette?', U.sel(ctx, 'when', [['dup3', 'dopo il 3° ACK duplicato'], ['timeout', 'allo scadere del timeout']], { label: 'quando ritrasmette', w: 'auto' })),
      U.row('Seq# del segmento ritrasmesso', U.inp(ctx, 'retxSeq', { w: 's', label: 'Seq# ritrasmesso' }))));

    root.appendChild(U.card(`c) Il ${R} conserva i segmenti fuori ordine. Quale Ack# invia dopo aver ricevuto la ritrasmissione (arrivata dopo tutti gli altri segmenti)?`, { step: 'pc' },
      U.row('Ack# dopo la ritrasmissione', U.inp(ctx, 'finalAck', { w: 's', label: 'Ack# finale' }))));
  }

  function solution(ex, root) {
    const R = ex.rows;
    const rows = [{ tr: [U.label(''), U.label('inizio (ISN)'), '', '', '', '', '', '', String(ex.ISNc), String(ex.ISNs)] }];
    let last = null;
    R.forEach(r => {
      if (r.section !== last) { last = r.section; rows.push({ section: SECTION_LABEL[r.section] || r.section }); }
      rows.push([U.label(String(r.n)), U.label(r.dir === 'c' ? 'C → S' : 'S → C'), String(r.len), String(r.syn), String(r.fin),
        String(r.seq), r.ack === null ? '—' : String(r.ack), calcText(r), String(r.cAfter), String(r.sAfter)]);
    });
    const notes = [];
    R.filter(r => r.run.length >= 2).forEach(r => notes.push(`Righe ${r.run.map(j => R[j].n).join(' e ')}: segmenti consecutivi del ${hostName(other(r.dir))}; la riga ${r.n} li riscontra insieme con Ack# ${r.ack}.`));
    const fins = R.filter(r => r.fin);
    fins.forEach(f => {
      const a = R.find(x => x.n > f.n && x.dir !== f.dir);
      if (a) notes.push(`FIN del ${hostName(f.dir)} alla riga ${f.n} (Seq# ${f.seq}): riscontrato alla riga ${a.n} con Ack# ${f.seq} + 1 = ${a.ack}.`);
    });
    const box = U.h('div', { class: 'card sol' },
      U.h('h4', {}, 'Soluzione · traccia'),
      U.h('p', { class: 'sol-body' }, 'Metodo dei due contatori: Seq# = contatore del mittente prima della riga; Ack# = contatore dell\'altro host; poi il contatore del mittente cresce di Lungh. (+1 se SYN o FIN). Le ultime due colonne sono i contatori dopo la riga.'),
      U.table(['#', 'Dir.', 'Lungh.', 'SYN', 'FIN', 'Seq#', 'Ack#', 'Calcolo (contatore del mittente)', 'Contatore client dopo', 'Contatore server dopo'], rows),
      notes.length ? U.h('ul', { class: 'sol-body' }, notes.map(t => U.h('li', {}, t))) : null);
    root.appendChild(box);

    const Lo = ex.loss;
    if (!Lo) return;
    const Sn = hostName(Lo.sender), Rn = hostName(Lo.receiver);
    root.appendChild(U.h('div', { class: 'card sol' },
      U.h('h4', {}, 'Soluzione · perdita'),
      U.h('p', { class: 'sol-body' }, `Segmenti del ${Sn} e byte che coprono:`),
      U.table(['Segmento', 'Seq#', 'Lungh.', 'Byte coperti', 'Arriva?'], Lo.segs.map(s => ({
        tr: [U.label(ord(s.i)), String(s.seq), String(s.len), `${s.seq}–${s.end}`, s.arrived ? 'sì' : 'perso'], cls: s.arrived ? null : 'lost'
      }))),
      U.h('p', { class: 'sol-body' }, U.h('b', {}, 'a) '), `Il ${Rn} risponde a ogni segmento con un ACK puro: Lungh. 0, SYN 0, FIN 0, Seq# ${Lo.rcvSeq} (non manda dati). L'Ack# è il primo byte che ancora manca:`),
      U.table(['Segmento ricevuto', 'Byte coperti', 'In ordine fino al byte', 'In buffer (fuori ordine)', 'Ack# inviato', 'Duplicato?'], Lo.resps.map(r => [
        U.label(ord(r.seg)), `${Lo.segs[r.seg].seq}–${Lo.segs[r.seg].end}`, String(r.ack - 1), r.buffered.length ? r.buffered.map(ord).join(', ') : '—', String(r.ack), r.dup ? 'sì' : 'no'
      ])),
      U.h('p', { class: 'sol-body' }, U.h('b', {}, 'b) '), `Prima di questi segmenti il ${Sn} aveva Ack# ${Lo.base}. ACK duplicati: ${Lo.dups}. ` +
        (Lo.fast ? `Sì: al 3° duplicato il ${Sn} ritrasmette subito, senza aspettare il timeout, il segmento con Seq# ${Lo.retxSeq} (Lungh. ${Lo.segs[Lo.retxIdx].len}).` :
          `No: servono 3 duplicati. Il ${Sn} ritrasmette il segmento con Seq# ${Lo.retxSeq} (Lungh. ${Lo.segs[Lo.retxIdx].len}) allo scadere del timeout.`)),
      U.h('p', { class: 'sol-body' }, U.h('b', {}, 'c) '), fieldMsg(ex, 'finalAck'))));
  }

  function chatText(ex, a) {
    const v = k => (a && String(a[k] == null ? '' : a[k]).trim()) || '__';
    const L = [];
    L.push(`#4 · TCP: Seq# e Ack# (livello ${ex.level})`);
    L.push('## Testo');
    L.push(`Traccia di segmenti TCP tra il client ${ex.client} e il server ${ex.server}. SYN e FIN valgono +1, un ACK puro non consuma numeri; il primo Ack# è —.`);
    L.push('Valori senza parentesi = dati dal testo; tra [parentesi] = le mie risposte ("__" = vuoto).');
    let last = null;
    ex.rows.forEach(r => {
      if (r.section !== last) { last = r.section; L.push(`-- ${SECTION_LABEL[r.section] || r.section}`); }
      const val = f => r.given[f] ? (f === 'ack' && r.ack === null ? '—' : String(r[f])) : `[${v(`r${r.n}.${f}`)}]`;
      L.push(`${r.n}. ${dirText(ex, r.dir)}  Lungh.=${r.len}  SYN=${val('syn')}  FIN=${val('fin')}  Seq#=${val('seq')}  Ack#=${val('ack')}`);
    });
    const Lo = ex.loss;
    if (Lo) {
      const S = hostName(Lo.sender), R = hostName(Lo.receiver);
      L.push('');
      L.push(`Seconda connessione: il ${S} manda ${Lo.total} byte in ${Lo.segs.length} segmenti mentre il ${R} non ha dati (Ack# = ${Lo.rcvSeq} in tutti; ultimo ACK ricevuto prima dal ${S}: ${Lo.base}).`);
      L.push('Segmenti: ' + Lo.segs.map(s => `${ord(s.i)} Seq#=${s.seq} Lungh.=${s.len}`).join('; ') + '.');
      L.push(`Il ${R} riceve solo ${listOrd(Lo.arrived)} segmento.`);
      L.push(`a) risposte del ${R}; b) fast retransmit? quale segmento e quando; c) Ack# dopo la ritrasmissione (il ${R} conserva i segmenti fuori ordine).`);
      L.push('');
      L.push('## Le mie risposte (perdita)');
      Lo.resps.forEach(r => L.push(`a) risposta al ${ord(r.seg)}: Lungh.=${v(`p${r.k}.len`)}  SYN=${v(`p${r.k}.syn`)}  FIN=${v(`p${r.k}.fin`)}  Seq#=${v(`p${r.k}.seq`)}  Ack#=${v(`p${r.k}.ack`)}`));
      const fast = a && a.fast ? (a.fast === 'si' ? 'sì' : 'no') : '__';
      const when = a && a.when ? (a.when === 'dup3' ? 'dopo il 3° ACK duplicato' : 'allo scadere del timeout') : '__';
      L.push(`b) fast retransmit: ${fast}; quando: ${when}; Seq# ritrasmesso: ${v('retxSeq')}`);
      L.push(`c) Ack# dopo la ritrasmissione: ${v('finalAck')}`);
    }
    return L.join('\n');
  }

  // ---------------- tracce d'esame ----------------
  const row = (dir, len, section, syn, fin) => ({ dir, len, syn: syn ? 1 : 0, fin: fin ? 1 : 0, section });

  RA.tcp = {
    id: 'tcp', num: '4', name: 'TCP: Seq# e Ack#', examPoints: 5, extra: false,
    desc: 'Completa la traccia con il metodo dei due contatori; perdita di un segmento, ACK duplicati e fast retransmit.',
    method: {
      intro: 'Data una traccia di segmenti tra due host (apertura, scambio dati, chiusura) si completano SYN, FIN, Seq# e Ack#. Con due contatori, uno per host, il calcolo è meccanico. Nella seconda parte un segmento si perde: lì si ragiona sui byte ricevuti in ordine.',
      steps: [
        'Regola 1: Seq# = numero del primo byte di dati del segmento. Ogni host ha la sua numerazione, che parte dal suo ISN (scelto nel SYN).',
        'Regola 2: il segmento successivo dello stesso host ha Seq# = Seq# precedente + Lungh.',
        'Regola 3: SYN e FIN consumano 1 numero anche con Lungh. 0. Un ACK puro (Lungh. 0, senza SYN/FIN) non consuma nulla.',
        'Regola 4: Ack# = prossimo byte atteso dall\'altro host = Seq# + Lungh. dell\'ultimo segmento ricevuto in ordine (+1 se SYN o FIN). L\'ACK è cumulativo.',
        'Metodo dei due contatori: per ogni riga Seq# = contatore del mittente, Ack# = contatore dell\'altro, poi contatore del mittente += Lungh. (+1 se SYN/FIN).',
        'Perdita: il ricevente risponde con ACK puri, Seq# fermo; l\'Ack# resta al primo byte mancante. Conta gli ACK duplicati: con 3 scatta il fast retransmit, altrimenti si aspetta il timeout.',
        'Dopo la ritrasmissione il ricevente unisce i segmenti in buffer e manda un solo ACK cumulativo fino al primo byte che ancora manca.'
      ],
      traps: [
        'Dimenticare il +1 di SYN e FIN: l\'Ack# che li riscontra è Seq# + 1.',
        'Ack# = Seq# dell\'altro: manca la Lungh. L\'Ack# è il PROSSIMO byte atteso.',
        'Aumentare il Seq# dopo un ACK puro: senza dati né SYN/FIN il contatore resta fermo.',
        'Due segmenti di fila dello stesso host: l\'ACK successivo li riscontra entrambi.',
        'Nella perdita l\'Ack# non supera il buco, e il Seq# del ricevente non cambia.',
        'Il primo ACK con un certo numero non è un duplicato: i duplicati sono quelli che lo ripetono. Fast retransmit solo con 3 duplicati.',
        'Ack# finale: conta anche i segmenti fuori ordine già in buffer, ma non quelli mai arrivati.'
      ],
      formulas: [
        ['Seq#', 'contatore del mittente (primo byte del segmento)'],
        ['Ack#', 'Seq# + Lungh. dell\'ultimo segmento ricevuto in ordine (+1 se SYN/FIN)'],
        ['Aggiornamento', 'contatore += Lungh. + SYN + FIN'],
        ['Handshake', 'SYN (ISNc) · SYN+ACK (ISNs, Ack ISNc+1) · ACK (Ack ISNs+1)'],
        ['Chiusura', 'FIN (Seq x) → ACK con Ack# x+1; in 3 segmenti FIN+ACK insieme'],
        ['Perdita', 'Ack# fermo al primo byte mancante; Seq# del ricevente fermo'],
        ['Fast retransmit', '3 ACK duplicati (4 ACK uguali) → ritrasmette subito; altrimenti timeout']
      ]
    },
    traces: [
      {
        id: 'sim-tcp', set: 'simulato',
        title: 'Esame simulato · TCP (10.0.0.5 ↔ 10.0.0.9)',
        source: 'Esame_Simulato_TESTO.pdf pag. 6 · soluzioni pag. 6-7',
        params: {
          level: 3, client: '10.0.0.5', server: '10.0.0.9', ISNc: 120, ISNs: 300, flagsGiven: false,
          rows: [
            row('c', 0, 'open', 1), row('s', 0, 'open', 1), row('c', 0, 'open'),
            row('c', 40, 'data'), row('s', 15, 'data'), row('c', 0, 'data'), row('s', 60, 'data'), row('s', 35, 'data'), row('c', 22, 'data'), row('s', 0, 'data'),
            row('s', 0, 'closeS', 0, 1), row('c', 0, 'closeS'),
            row('c', 0, 'closeC', 0, 1), row('s', 0, 'closeC')
          ],
          loss: { sender: 'c', base: 500, rcvSeq: 900, lens: [30, 40, 20, 30], lostIdx: 1, arrived: [0, 2, 3] }
        },
        expect: {
          'r1.syn': '1', 'r2.ack': '121', 'r3.seq': '121', 'r3.ack': '301', 'r5.ack': '161', 'r6.ack': '316', 'r8.seq': '376', 'r9.ack': '411', 'r10.ack': '183', 'r11.fin': '1', 'r12.ack': '412', 'r14.ack': '184',
          'p1.ack': '530', 'p2.ack': '530', 'p3.ack': '530', 'p3.seq': '900', fast: 'no', when: 'timeout', retxSeq: '530', finalAck: '620'
        }
      },
      {
        id: 'guida4-tcp',
        title: 'Guida 4 · traccia d\'esame (10.0.0.3 ↔ 10.0.0.4)',
        source: 'Guida_4_TCP_Seq_Ack.pdf pag. 1-3',
        params: {
          level: 3, client: '10.0.0.3', server: '10.0.0.4', ISNc: 18, ISNs: 32, flagsGiven: false,
          rows: [
            row('c', 0, 'open', 1), row('s', 0, 'open', 1), row('c', 0, 'open'),
            row('c', 23, 'data'), row('s', 29, 'data'), row('c', 19, 'data'), row('s', 25, 'data'), row('c', 0, 'data'), row('s', 23, 'data'), row('c', 18, 'data'), row('s', 0, 'data'),
            row('c', 0, 'closeC', 0, 1), row('s', 0, 'closeC'),
            row('s', 0, 'closeS', 0, 1), row('c', 0, 'closeS')
          ],
          loss: { sender: 's', base: 46, rcvSeq: 61, lens: [25, 26, 31, 13], lostIdx: 2, arrived: [0, 1, 3] }
        },
        expect: {
          'r2.ack': '19', 'r4.seq': '19', 'r5.ack': '42', 'r6.seq': '42', 'r7.ack': '61', 'r8.ack': '87', 'r10.ack': '110', 'r11.ack': '79', 'r12.seq': '79', 'r13.ack': '80', 'r14.seq': '110', 'r15.ack': '111',
          'p1.ack': '71', 'p2.ack': '97', 'p3.ack': '97', 'p3.seq': '61', fast: 'no', retxSeq: '97', finalAck: '141'
        }
      }
    ],
    randomParams, build, gen, steps, grade, sol2answers, render, solution, hints, fieldHint, diagnose, diagnoseCases, chatText
  };
})();
