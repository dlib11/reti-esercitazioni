// ============================================================
// RetiApp · gen-tcp.js — Esercizio 4 · TCP: Seq# e Ack#
// ============================================================
(function () {
  const RA = window.RetiApp;
  const U = RA.util;

  function buildTrace(nData) {
    // piano eventi: chi manda dati e quando mettiamo ACK puri
    const events = [];
    let dataC = Math.ceil(nData * 0.6), dataS = nData - dataC;
    while (dataC > 0 || dataS > 0) {
      const r = Math.random();
      if (dataC > 0 && (r < 0.6 || dataS === 0)) { events.push('cd'); dataC--; }
      else if (dataS > 0) { events.push('sd'); dataS--; }
    }
    // inserisce 1-2 ACK puri dopo il 2° e 4° evento dati
    const withAcks = [];
    let dataSeen = 0;
    events.forEach(e => {
      withAcks.push(e);
      if (e === 'cd' || e === 'sd') dataSeen++;
      if (dataSeen === 2 || dataSeen === 4) withAcks.push(dataSeen % 4 === 2 ? 'sa' : 'ca');
    });
    return withAcks;
  }

  function gen(level) {
    const client = `10.0.0.${U.rndInt(2, 20)}`, server = `10.0.0.${U.rndInt(21, 40)}`;
    const ISNc = U.rndInt(50, 900), ISNs = U.rndInt(50, 900);
    const nData = [4, 5, 6, 7, 9][Math.min(level, 5) - 1];

    const rows = [];
    let nextC = ISNc, nextS = ISNs;
    function push(dir, len, syn, fin, section) {
      const seq = dir === 'c' ? nextC : nextS;
      const ack = dir === 'c' ? nextS : nextC;
      const before = dir === 'c' ? nextC : nextS;
      const delta = len + (syn ? 1 : 0) + (fin ? 1 : 0);
      if (dir === 'c') nextC += delta; else nextS += delta;
      rows.push({
        dir, len, syn, fin, seq, ack, section,
        calcSeq: `Seq# = contatore del ${dir === 'c' ? 'client' : 'server'}: ${before} + ${len} byte${syn ? ' +1 (SYN)' : ''}${fin ? ' +1 (FIN)' : ''} = ${seq}`,
        calcAck: `Ack# = contatore dell'altro host = prossimo byte atteso da ${dir === 'c' ? 'server' : 'client'} = ${ack}`
      });
    }
    push('c', 0, 1, 0, 'open');
    rows[rows.length - 1].ack = null;
    push('s', 0, 1, 0, 'open');
    push('c', 0, 0, 0, 'open');
    for (const e of buildTrace(nData)) {
      if (e === 'cd') push('c', U.rndInt(10, 60), 0, 0, 'data');
      else if (e === 'sd') push('s', U.rndInt(10, 60), 0, 0, 'data');
      else if (e === 'ca') push('c', 0, 0, 0, 'data');
      else push('s', 0, 0, 0, 'data');
    }
    push('s', 0, 0, 1, 'closeS'); // FIN del server
    push('c', 0, 0, 0, 'closeS'); // ACK del client
    push('c', 0, 0, 1, 'closeC'); // FIN del client
    push('s', 0, 0, 0, 'closeC'); // ACK del server

    // quali celle sono date (input) a seconda del livello
    const flagsGiven = level <= 2;
    rows.forEach((r, i) => {
      r.given = {
        syn: flagsGiven || (i < 2 && r.syn) || false,
        fin: flagsGiven || (i < 2 && r.fin) || false,
        seq: i === 0 || i === 1, // gli ISN dei due host sono dati (come all'esame)
        ack: i === 0 // il primo Ack# è "—"
      };
    });

    // ---- parte 2: perdite ----
    const nSeg = level >= 5 ? 5 : 4;
    const base = U.rndInt(200, 900), S = U.rndInt(200, 900);
    const lens = Array.from({ length: nSeg }, () => U.rndInt(10, 40));
    const lostIdx = 1;
    const seqs = []; let acc = base;
    for (const l of lens) { seqs.push(acc); acc += l; }
    const frozenAck = seqs[lostIdx];
    const received = [];
    for (let i = 0; i < nSeg; i++) if (i !== lostIdx) received.push(i);
    const dups = received.length - 1; // risposte dopo la prima: tutte duplicate
    const resps = received.map((segIdx, k) => ({ len: 0, syn: 0, fin: 0, seq: S, ack: frozenAck, dup: k > 0 }));
    return {
      cat: 'tcp', level, client, server, rows, ISNc, ISNs,
      part2: { base, S, lens, seqs, nSeg, lostIdx, frozenAck, received, dups, resps, fast: dups >= 3, lostSeq: seqs[lostIdx], finalAck: base + lens.reduce((a, b) => a + b, 0) }
    };
  }

  // answers: { rows: [{syn,fin,seq,ack}...], p2: { resps:[{len,syn,fin,seq,ack}], fast, lostSeq, finalAck } }
  function grade(ex, answers) {
    let correct = 0, total = 0;
    const marks = ex.rows.map((r, i) => {
      const a = answers.rows[i] || {};
      const m = {};
      ['syn', 'fin', 'seq', 'ack'].forEach(f => {
        if (r.given[f]) return;
        total++;
        let exp = f === 'syn' || f === 'fin' ? String(r[f]) : String(r[f]);
        const got = (a[f] === undefined ? '' : String(a[f])).trim();
        const ok = got === exp;
        if (ok) correct++;
        m[f] = {
          ok,
          msg: f === 'seq' ? r.calcSeq : f === 'ack' ? r.calcAck :
            `SYN/FIN: ${f.toUpperCase()} = ${r[f]}${r.syn || r.fin ? ' (questi flag consumano un numero di sequenza, +1)' : ' (ACK puro: non consuma nulla)'}`
        };
      });
      return m;
    });
    const p2 = ex.part2;
    const marksP2 = { resps: [], fast: null, lostSeq: null, finalAck: null };
    // la parte perdita esiste solo dal livello 2 in su: non conteggiarla altrove
    if (ex.level >= 2) {
      (answers.p2 && answers.p2.resps || []).forEach((r, i) => {
      const exp = p2.resps[i];
      const m = {};
      ['len', 'syn', 'fin', 'seq', 'ack'].forEach(f => {
        total++;
        const ok = String(r[f] === undefined ? '' : r[f]).trim() === String(exp[f]);
        if (ok) correct++;
        m[f] = {
          ok,
          msg: f === 'ack' ? `Ack# = primo byte mancante = ${exp.ack}${exp.dup ? ' (ACK duplicato: il buco non si è chiuso)' : ''}`
            : f === 'seq' ? `Seq# = contatore del server, che non ha mandato dati: resta ${exp.seq}`
            : `${f.toUpperCase()} = ${exp[f]}`
        };
      });
    marksP2.resps.push(m);
    });
    total++; const okF = answers.p2 && answers.p2.fast === (p2.fast ? 'si' : 'no');
    if (okF) correct++;
    marksP2.fast = { ok: okF, msg: p2.fast ?
      `Il client riceve ${p2.dups} ACK duplicati (con lo stesso Ack#=${p2.frozenAck}): con 3 duplicati scatta il fast retransmit.` :
      `Il client riceve solo ${p2.dups} ACK duplicati: per il fast retransmit ne servono 3, quindi attende il timeout.` };
    total++; const okS = answers.p2 && String(answers.p2.lostSeq).trim() === String(p2.lostSeq);
    if (okS) correct++;
    marksP2.lostSeq = { ok: okS, msg: `Si ritrasmette il segmento mancante: Seq# = ${p2.lostSeq} (il buco inizia lì).` };
    total++; const okA = answers.p2 && String(answers.p2.finalAck).trim() === String(p2.finalAck);
    if (okA) correct++;
    marksP2.finalAck = { ok: okA, msg: `Dopo la ritrasmissione il server ha in buffer anche il segmento fuori ordine: un unico ACK cumulativo con Ack# = ${p2.finalAck} = base + tutti i ${p2.lens.reduce((a, b) => a + b, 0)} byte.` };
    }
    return { correct, total, marks, marksP2 };
  }

  function sol2answers(ex) {
    return {
      rows: ex.rows.map(r => ({ syn: String(r.syn), fin: String(r.fin), seq: String(r.seq), ack: r.ack === null ? '—' : String(r.ack) })),
      p2: { resps: ex.part2.resps.map(r => ({ len: String(r.len), syn: String(r.syn), fin: String(r.fin), seq: String(r.seq), ack: String(r.ack) })), fast: ex.part2.fast ? 'si' : 'no', lostSeq: String(ex.part2.lostSeq), finalAck: String(ex.part2.finalAck) }
    };
  }

  // ---- rendering ----
  const SECTION_LABEL = { open: 'Apertura connessione', data: 'Scambio dati', closeS: 'Chiusura connessione lato server', closeC: 'Chiusura connessione lato client' };

  function render(ex, root, state) {
    state.fields = { rows: [], p2: { resps: [], fast: null, lostSeq: null, finalAck: null } };
    root.appendChild(U.h('p', { class: 'small' },
      `Client ${ex.client} · Server ${ex.server}. Completa i campi mancanti della traccia (SYN e FIN valgono 0 o 1; il primo Ack# è "—").`));

    const table = U.h('table', { class: 'grid tcp-grid' });
    let lastSection = null;
    ex.rows.forEach((r, i) => {
      if (r.section !== lastSection) {
        lastSection = r.section;
        table.appendChild(U.h('tr', { class: 'section-row' }, U.h('td', { colspan: '7' }, SECTION_LABEL[r.section])));
      }
      const tr = U.h('tr', {},
        U.h('td', { class: 'lbl-td' }, `${r.dir === 'c' ? ex.client : ex.server} → ${r.dir === 'c' ? ex.server : ex.client}`),
        U.h('td', { class: 'lbl-td' }, String(r.len)));
      const cells = {};
      ['syn', 'fin', 'seq', 'ack'].forEach(f => {
        state.fields.rows[i] = state.fields.rows[i] || {};
        if (r.given[f]) {
          tr.appendChild(U.h('td', { class: 'given' }, f === 'ack' && r.ack === null ? '—' : String(r[f])));
        } else {
          const inp = U.h('input', { class: 'cell', type: 'text' });
          state.fields.rows[i][f] = inp;
          tr.appendChild(U.h('td', {}, inp));
        }
      });
      table.appendChild(tr);
    });
    root.appendChild(U.h('div', { class: 'card' }, U.h('h4', {}, 'Traccia della connessione'), table));

    // ---- parte 2 ----
    const p2 = ex.part2;
    if (ex.level >= 2) {
      root.appendChild(U.h('div', { class: 'card' },
        U.h('h4', {}, 'Perdita di un segmento'),
        U.h('p', { class: 'small' },
          `In una successiva connessione il client, mentre il server non ha dati da inviare, manda ${p2.lens.reduce((a, b) => a + b, 0)} byte in ${p2.nSeg} segmenti (Ack# = ${p2.S} in tutti). Il server riceve solo ${p2.received.map(x => 'il ' + (x + 1) + '°').join(', ')}; si perde il ${p2.lostIdx + 1}°.`),
        U.h('table', { class: 'data' },
          U.h('tr', {}, ['#', 'Lungh.', 'Seq#'].map(t => U.h('th', {}, t))),
          p2.seqs.map((s, i) => U.h('tr', { class: i === p2.lostIdx ? 'lost' : '' },
            U.h('td', {}, String(i + 1)),
            U.h('td', {}, String(p2.lens[i])),
            U.h('td', {}, String(s))))),
        U.h('p', { class: 'small' }, `a) Scrivi i ${p2.received.length} segmenti con cui il SERVER risponde a ciascun segmento ricevuto (Lungh., SYN, FIN, Seq#, Ack#).`)));

      const t2 = U.h('table', { class: 'grid' },
        U.h('tr', {}, ['#', 'Lungh.', 'SYN', 'FIN', 'Seq#', 'Ack#'].map(t => U.h('th', {}, t))));
      p2.received.forEach((segIdx, k) => {
        const tr = U.h('tr', {}, U.h('td', { class: 'lbl-td' }, `risp. ${k + 1} (al ${segIdx + 1}°)`));
        state.fields.p2.resps.push({});
        ['len', 'syn', 'fin', 'seq', 'ack'].forEach(f => {
          const inp = U.h('input', { class: 'cell', type: 'text' });
          state.fields.p2.resps[k][f] = inp;
          tr.appendChild(U.h('td', {}, inp));
        });
        t2.appendChild(tr);
      });
      root.appendChild(U.h('div', { class: 'card' }, U.h('h4', {}, 'a) Risposte del server'), t2));

      const selF = U.h('select', { class: 'cell' },
        U.h('option', { value: '' }, '— scegli —'),
        U.h('option', { value: 'si' }, 'Sì'),
        U.h('option', { value: 'no' }, 'No'));
      state.fields.p2.fast = selF;
      const inpS = U.h('input', { class: 'cell num', type: 'text', placeholder: 'Seq#' });
      state.fields.p2.lostSeq = inpS;
      root.appendChild(U.h('div', { class: 'card' },
        U.h('h4', {}, 'b) Fast retransmit'),
        U.h('div', { class: 'num-row' }, U.h('span', { class: 'small' }, 'Il client effettuerà un fast retransmit?'), selF),
        U.h('div', { class: 'num-row' }, U.h('span', { class: 'small' }, 'Quale segmento ritrasmette (Seq#)?'), inpS)));

      const inpA = U.h('input', { class: 'cell num', type: 'text' });
      state.fields.p2.finalAck = inpA;
      root.appendChild(U.h('div', { class: 'card' },
        U.h('h4', {}, 'c) Dopo la ritrasmissione'),
        U.h('div', { class: 'num-row' }, U.h('span', { class: 'small' }, 'Il server conserva i segmenti fuori ordine: quale Ack# invia dopo aver ricevuto la ritrasmissione?'), inpA)));
    }
  }

  function check(ex, root, state, explain) {
    U.resetFb(root);
    const answers = {
      rows: state.fields.rows.map(fr => {
        const a = {};
        for (const f in fr) a[f] = fr[f] ? fr[f].value : '';
        return a;
      }),
      p2: {
        resps: state.fields.p2.resps.map(fr => {
          const a = {};
          for (const f in fr) a[f] = fr[f].value;
          return a;
        }),
        fast: state.fields.p2.fast ? state.fields.p2.fast.value : null,
        lostSeq: state.fields.p2.lostSeq ? state.fields.p2.lostSeq.value : null,
        finalAck: state.fields.p2.finalAck ? state.fields.p2.finalAck.value : null
      }
    };
    const res = grade(ex, answers);
    ex.rows.forEach((r, i) => {
      const m = res.marks[i];
      for (const f in m) {
        U.fb(state.fields.rows[i][f], m[f].ok, m[f].ok ? null : (explain ? m[f].msg : '✗'));
      }
    });
    res.marksP2.resps.forEach((m, k) => {
      for (const f in m) U.fb(state.fields.p2.resps[k][f], m[f].ok, m[f].ok ? null : (explain ? m[f].msg : '✗'));
    });
    if (state.fields.p2.fast && res.marksP2.fast) {
      U.fb(state.fields.p2.fast, res.marksP2.fast.ok, res.marksP2.fast.ok ? null : (explain ? res.marksP2.fast.msg : '✗'));
      U.fb(state.fields.p2.lostSeq, res.marksP2.lostSeq.ok, res.marksP2.lostSeq.ok ? null : (explain ? res.marksP2.lostSeq.msg : '✗'));
      U.fb(state.fields.p2.finalAck, res.marksP2.finalAck.ok, res.marksP2.finalAck.ok ? null : (explain ? res.marksP2.finalAck.msg : '✗'));
    }
    return res;
  }

  function solution(ex, root) {
    root.appendChild(U.h('div', { class: 'card sol' },
      U.h('h4', {}, 'Soluzione traccia'),
      U.h('table', { class: 'data' },
        U.h('tr', {}, ['#', 'Dir.', 'Len', 'SYN', 'FIN', 'Seq#', 'Ack#'].map(t => U.h('th', {}, t))),
        ex.rows.map((r, i) => U.h('tr', {},
          U.h('td', {}, String(i + 1)),
          U.h('td', {}, r.dir === 'c' ? 'C → S' : 'S → C'),
          U.h('td', {}, String(r.len)),
          U.h('td', {}, String(r.syn)),
          U.h('td', {}, String(r.fin)),
          U.h('td', {}, String(r.seq)),
          U.h('td', {}, r.ack === null ? '—' : String(r.ack)))))));
    if (ex.level >= 2) {
      const p2 = ex.part2;
      root.appendChild(U.h('div', { class: 'card sol' },
        U.h('h4', {}, 'Soluzione parte perdita'),
        U.h('p', { class: 'sol-body' },
          `a) ${p2.received.length} risposte, tutte con Len 0, SYN 0, FIN 0, Seq# ${p2.S} e Ack# ${p2.frozenAck} (la prima normale, le altre duplicate: manca sempre il byte ${p2.frozenAck}). ` +
          `b) ${p2.fast ? `Sì: ${p2.dups} ACK duplicati → fast retransmit del segmento con Seq# ${p2.lostSeq}` : `No: solo ${p2.dups} ACK duplicati (ne servono 3) → si attende il timeout e si ritrasmette Seq# ${p2.lostSeq}`}. ` +
          `c) Ack# ${p2.finalAck}: un unico ACK cumulativo, perché con la ritrasmissione si chiude il buco e il server ha già in buffer anche il segmento fuori ordine.`)));
    }
  }

  function hints(ex) {
    const H = ['Regola base: Seq# = numero del PRIMO byte di dati nel segmento; ogni host ha il suo contatore, che parte dall\'ISN scelto nel SYN.',
      'Ack# = prossimo byte che mi aspetto dall\'altro host = Seq# + Lunghezza dell\'ultimo segmento ricevuto in ordine (+1 se era un SYN o un FIN).',
      'SYN e FIN consumano 1 numero di sequenza; un ACK puro (Len 0) non consuma nulla.',
      'Metodo dei due contatori: tieni a lato il "prossimo Seq#" di ciascun host. Per ogni riga: Seq# = contatore del mittente; Ack# = contatore dell\'altro; poi aggiorna il contatore del mittente (+Len, +1 per SYN/FIN).'];
    if (ex.level >= 2) H.push('Con una perdita: l\'Ack# del ricevente resta FERMO al primo byte mancante. Ogni segmento successivo fuori ordine produce un ACK duplicato con lo stesso numero.');
    return H;
  }

  // ---- testo per la correzione in chat ----
  function chatText(ex, state) {
    const lines = [];
    lines.push(`#4 · TCP: Seq# e Ack# (livello ${ex.level})`);
    lines.push('## Testo');
    lines.push(`Connessione TCP tra client ${ex.client} e server ${ex.server}. Completa i campi mancanti della traccia.`);
    lines.push('Traccia (i valori tra [parentesi] sono i miei, "__" = non ancora compilato, quelli senza parentesi erano già dati):');
    ex.rows.forEach((r, i) => {
      const f = state.fields.rows[i] || {};
      const val = k => r.given[k]
        ? (k === 'ack' && r.ack === null ? '—' : String(r[k]))
        : `[${f[k] ? (f[k].value || '__') : '__'}]`;
      lines.push(`${i + 1}. ${r.dir === 'c' ? 'client → server' : 'server → client'}  Len=${r.len}  SYN=${val('syn')}  FIN=${val('fin')}  Seq#=${val('seq')}  Ack#=${val('ack')}`);
    });
    if (ex.level >= 2) {
      const p2 = ex.part2;
      lines.push('');
      lines.push(`Seconda connessione: il client manda ${p2.lens.reduce((a, b) => a + b, 0)} byte in ${p2.nSeg} segmenti (Ack# = ${p2.S} in tutti, il server non ha dati). Segmenti: ${p2.seqs.map((s, i) => `Seq#=${s} (Len=${p2.lens[i]})`).join('; ')}. Il server riceve solo ${p2.received.map(x => 'il ' + (x + 1) + '°').join(', ')}: si perde il ${p2.lostIdx + 1}°.`);
      lines.push('a) I segmenti con cui il server risponde a ciascun segmento ricevuto; b) fast retransmit? quale segmento e quando; c) Ack# dopo la ritrasmissione.');
      lines.push('');
      lines.push('## Le mie risposte (parte perdita)');
      state.fields.p2.resps.forEach((row, k) => {
        const v = f => (row[f] ? (row[f].value || '__') : '__');
        lines.push(`- risposta ${k + 1}: Len=${v('len')}  SYN=${v('syn')}  FIN=${v('fin')}  Seq#=${v('seq')}  Ack#=${v('ack')}`);
      });
      const sel = state.fields.p2.fast;
      lines.push(`- b) fast retransmit: ${sel && sel.value ? (sel.value === 'si' ? 'sì' : 'no') : '__'}; segmento ritrasmesso Seq#=${state.fields.p2.lostSeq ? (state.fields.p2.lostSeq.value || '__') : '__'}`);
      lines.push(`- c) Ack# dopo la ritrasmissione: ${state.fields.p2.finalAck ? (state.fields.p2.finalAck.value || '__') : '__'}`);
    }
    return lines.join('\n');
  }

  RA.tcp = {
    id: 'tcp', num: '4', name: 'TCP: Seq# e Ack#',
    desc: 'Completa la traccia con il metodo dei due contatori; perdite e ACK duplicati.',
    examPoints: 5, gen, grade, sol2answers, render, check, solution, hints, chatText
  };
})();
