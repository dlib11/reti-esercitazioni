// ============================================================
// RetiApp · gen-nat.js — Esercizio 3 · NAT
// ============================================================
(function () {
  const RA = window.RetiApp;
  const U = RA.util;

  function gen(level) {
    const lanBase = `192.168.${U.rndInt(1, 9)}.`;
    const h1 = lanBase + '10', h2 = lanBase + '20';
    // porta sorgente: uguale sui due host dall'esame in su, diverse ai livelli bassi
    const samePort = level >= 3;
    const p1 = samePort ? U.rndInt(40000, 60000) : U.rndInt(40000, 49000);
    const p2 = samePort ? p1 : U.rndInt(50000, 60000);
    let w1 = U.rndInt(1024, 30000), w2 = U.rndInt(30001, 61000);
    const pub = `${U.pick([82, 93, 151, 77])}.${U.rndInt(1, 250)}.${U.rndInt(1, 250)}.${U.rndInt(1, 250)}`;
    const srv = `${U.pick([151, 140, 130])}.${U.rndInt(1, 250)}.${U.rndInt(1, 250)}.${U.pick([69, 78, 12])}`;
    const srvPort = U.pick([443, 80]);

    // 8 flussi attesi: [ip src, ip dst, porta src, porta dst]
    const flows = [
      [h1, srv, p1, srvPort],      // 1 H1→S, prima (LAN)
      [pub, srv, w1, srvPort],     // 2 H1→S, dopo  (WAN)
      [srv, pub, srvPort, w1],     // 3 S→H1, prima (WAN)
      [srv, h1, srvPort, p1],      // 4 S→H1, dopo  (LAN)
      [h2, srv, p2, srvPort],      // 5 H2→S, prima
      [pub, srv, w2, srvPort],      // 6 H2→S, dopo
      [srv, pub, srvPort, w2],     // 7 S→H2, prima
      [srv, h2, srvPort, p2]       // 8 S→H2, dopo
    ];
    return { cat: 'nat', level, h1, h2, p1, p2, samePort, pub, w1, w2, srv, srvPort, flows };
  }

  // answers: { flows: [[src,dst,ps,pd] x8], qB, qC }
  function grade(ex, answers) {
    let correct = 0, total = 0;
    const marks = (answers.flows || []).map((row, i) => row.map((v, c) => {
      total++;
      const ok = String(v || '').trim() === String(ex.flows[i][c]);
      if (ok) correct++;
      return { ok, msg: cellMsg(ex, i, c) };
    }));
    const openB = U.kwCoverage(answers.qB || '', [
      ['divers', 'distint', 'conflitt', 'collision'],
      ['rispost', 'ritorno', 'rientr', 'consegn'],
      ['pubblic', 'wan', 'stesso ip'],
      ['identific', 'distingu', 'sapere', 'a chi']
    ]);
    marks.b = { ok: openB.found >= 2, cov: openB };
    total++; correct += Math.min(1, openB.found / 4);
    const openC = U.kwCoverage(answers.qC || '', [
      ['scart', 'drop', 'ignor', 'buttat'],
      ['tabella', 'voce', 'riga'],
      ['forwarding', 'static', 'inoltro', 'regola']
    ]);
    marks.c = { ok: openC.found >= 2, cov: openC };
    total++; correct += Math.min(1, openC.found / 3);
    return { correct, total, marks };
  }

  function sol2answers(ex) {
    return {
      flows: ex.flows.map(r => r.map(String)),
      qB: 'I due host usano entrambi la porta sorgente ' + ex.p1 + ': sul lato LAN non c\'è conflitto (IP diversi), ma sul lato WAN l\'IP pubblico è lo stesso. Se il NAT assegnasse la stessa porta WAN a entrambi, non saprebbe a chi consegnare le risposte: l\'unica cosa che distingue le due connessioni è la porta di destinazione dei pacchetti in arrivo. Quindi assegna due porte WAN diverse (' + ex.w1 + ' e ' + ex.w2 + ') e registra entrambe in tabella.',
      qC: 'Un segmento destinato a ' + ex.pub + ' porta ' + U.rndInt(9000, 9999) + ' (senza voce in tabella) viene scartato: il NAT non trova nessuna riga che dica a quale host privato consegnarlo. Per far arrivare connessioni dall\'esterno a un host interno serve il port forwarding: una riga statica configurata a mano (es. porta WAN X → host interno, porta Y).'
    };
  }

  const SIDE = ['LAN (prima del NAT)', 'WAN (dopo il NAT)', 'WAN (prima del NAT)', 'LAN (dopo del NAT)'];
  function cellMsg(ex, i, c) {
    const host = i < 4 ? 1 : 2;
    const hIp = host === 1 ? ex.h1 : ex.h2, wanP = host === 1 ? ex.w1 : ex.w2, lanP = host === 1 ? ex.p1 : ex.p2;
    const who = ['sorgente', 'destinazione', 'sorgente', 'destinazione'][c];
    const rows = ['1-4', '5-8'][host - 1];
    switch (i % 4) {
      case 0: return `Flusso ${i + 1}, lato LAN in uscita: IP ${who} = ${c === 0 ? 'host ' + host + ' (' + hIp + ')' : 'server (' + ex.srv + ')'}, porta ${who} = ${c === 2 ? lanP + ' (porta sorgente privata dell\'host)' : ex.srvPort + ' (porta del server)'}.`;
      case 1: return `Flusso ${i + 1}, lato WAN in uscita: il NAT ha sostituito IP e porta sorgente con quelli pubblici della tabella (riga WAN dell'host ${host}): ${ex.pub}, ${wanP}. La destinazione non si tocca mai.`;
      case 2: return `Flusso ${i + 1}, lato WAN in entrata: sorgente = server (${ex.srv}, ${ex.srvPort}); destinazione = IP pubblico del NAT (${ex.pub}) sulla porta WAN dell'host ${host} (${wanP}).`;
      case 3: return `Flusso ${i + 1}, lato LAN in entrata: il NAT ha sostituito la destinazione con la riga LAN dell'host ${host}: ${hIp}, ${lanP}. La sorgente (server) resta invariata.`;
    }
  }

  // ---- rendering ----
  function svgDiagram(ex) {
    return `<svg viewBox="0 0 560 250" class="fig">
      <ellipse cx="280" cy="38" rx="70" ry="24" class="cloud"/>
      <text x="280" y="42" text-anchor="middle" class="lbl">INTERNET</text>
      <rect x="440" y="24" width="100" height="30" rx="4" class="box"/>
      <text x="490" y="38" text-anchor="middle" class="lbl">Server web</text>
      <text x="490" y="48" text-anchor="middle" class="lbl small">${ex.srv} (porta ${ex.srvPort})</text>
      <rect x="230" y="105" width="100" height="34" rx="4" class="box router"/>
      <text x="280" y="126" text-anchor="middle" class="lbl">Router NAT</text>
      <text x="280" y="155" text-anchor="middle" class="lbl small">${ex.pub} (lato WAN)</text>
      <rect x="80" y="205" width="120" height="34" rx="4" class="box"/>
      <text x="140" y="219" text-anchor="middle" class="lbl">Host 1</text>
      <text x="140" y="232" text-anchor="middle" class="lbl small">${ex.h1}</text>
      <rect x="360" y="205" width="120" height="34" rx="4" class="box"/>
      <text x="420" y="219" text-anchor="middle" class="lbl">Host 2</text>
      <text x="420" y="232" text-anchor="middle" class="lbl small">${ex.h2}</text>
      <line x1="140" y1="205" x2="250" y2="139" class="arrow"/>
      <line x1="155" y1="182" x2="270" y2="139" class="arrow dim"/>
      <line x1="280" y1="105" x2="280" y2="62" class="arrow"/>
      <line x1="300" y1="62" x2="300" y2="105" class="arrow dim"/>
      <line x1="310" y1="139" x2="415" y2="205" class="arrow dim"/>
      <line x1="295" y1="139" x2="435" y2="205" class="arrow"/>
      <text x="185" y="165" class="flow-n">1</text>
      <text x="168" y="190" class="flow-n">4</text>
      <text x="268" y="80" class="flow-n">2</text>
      <text x="315" y="80" class="flow-n">3</text>
      <text x="452" y="172" class="flow-n">5</text>
      <text x="470" y="195" class="flow-n">8</text>
      <text x="352" y="120" class="flow-n">6</text>
      <text x="330" y="120" class="flow-n">7</text>
    </svg>`;
  }

  function render(ex, root, state) {
    state.fields = { flows: [], qB: null, qC: null };
    root.appendChild(U.h('div', { class: 'card intro', html: svgDiagram(ex) }));

    root.appendChild(U.h('div', { class: 'card' },
      U.h('h4', {}, 'NAT translation table'),
      U.h('table', { class: 'data' },
        U.h('tr', {}, U.h('th', {}, 'WAN (IP, porta)'), U.h('th', {}, 'LAN (IP, porta)')),
        U.h('tr', {}, U.h('td', {}, `${ex.pub}, ${ex.w1}`), U.h('td', {}, `${ex.h1}, ${ex.p1}`)),
        U.h('tr', {}, U.h('td', {}, `${ex.pub}, ${ex.w2}`), U.h('td', {}, `${ex.h2}, ${ex.p2}`)))));

    root.appendChild(U.h('p', { class: 'small' },
      `I due host hanno entrambi una connessione TCP aperta con il server. Frecce dispari (1, 4, 5, 8) = lato LAN; frecce pari sul lato WAN. Flussi: 1) dati host 1 → server, prima del NAT; 2) idem dopo il NAT; 3) server → host 1 prima del NAT; 4) idem dopo; 5–8) lo stesso per l'host 2.`));

    const table = U.h('table', { class: 'grid' },
      U.h('tr', {},
        ['Flusso', 'Lato', 'IP sorgente', 'IP destinazione', 'Porta sorg.', 'Porta dest.']
          .map(t => U.h('th', {}, t))));
    const sides = ['LAN', 'WAN', 'WAN', 'LAN'];
    for (let i = 0; i < 8; i++) {
      const host = i < 4 ? 1 : 2;
      const d = i % 4;
      const arrow = d < 2 ? `H${host} → S` : `S → H${host}`;
      const row = U.h('tr', {},
        U.h('td', { class: 'lbl-td' }, `${i + 1} · ${arrow}`),
        U.h('td', { class: 'lbl-td' }, sides[d]));
      state.fields.flows.push([]);
      for (let c = 0; c < 4; c++) {
        const inp = U.h('input', { class: 'cell', type: 'text' });
        state.fields.flows[i].push(inp);
        row.appendChild(U.h('td', {}, inp));
      }
      table.appendChild(row);
    }
    root.appendChild(U.h('div', { class: 'card' },
      U.h('h4', {}, 'a) Indica IP e porte per ciascun flusso'), table));

    const taB = U.h('textarea', { class: 'cell ta', rows: '2' });
    state.fields.qB = taB;
    root.appendChild(U.h('div', { class: 'card' },
      U.h('label', { class: 'small' }, `b) ${ex.samePort ? `I due host usano entrambi la porta sorgente ${ex.p1}: perché il NAT ha assegnato due porte diverse sul lato WAN?` : 'Perché il NAT deve tenere traccia delle coppie (IP, porta) e non solo degli IP?'}`), taB));

    const taC = U.h('textarea', { class: 'cell ta', rows: '2' });
    state.fields.qC = taC;
    root.appendChild(U.h('div', { class: 'card' },
      U.h('label', { class: 'small' }, `c) Un host esterno invia un segmento TCP a ${ex.pub} su una porta qualsiasi senza voce in tabella: cosa succede? Cosa servirebbe per far arrivare la connessione a un host interno?`), taC));

    root.appendChild(U.h('p', { class: 'chat-tip small' }, '💡 b) e c) sono domande aprese: incolla qui la tua risposta in chat e te la correggo.'));
  }

  function check(ex, root, state, explain) {
    U.resetFb(root);
    const answers = { flows: [], qB: state.fields.qB.value, qC: state.fields.qC.value };
    state.fields.flows.forEach(r => answers.flows.push(r.map(i => i.value)));
    const res = grade(ex, answers);
    state.fields.flows.forEach((row, i) => row.forEach((inp, c) => {
      const m = res.marks[i][c];
      U.fb(inp, m.ok, m.ok ? null : (explain ? m.msg : '✗'));
    }));
    const mb = res.marks.b;
    U.fb(state.fields.qB, mb.ok, mb.ok ? null :
      (explain ? `Punti chiave: ${mb.cov.found}/4. La risposta completa spiega: stesso IP pubblico → le porte WAN distinguono; serve per sapere a chi consegnare le risposte.` : '✗'));
    const mc = res.marks.c;
    U.fb(state.fields.qC, mc.ok, mc.ok ? null :
      (explain ? `Punti chiave: ${mc.cov.found}/3. Il pacchetto viene scartato (nessuna voce in tabella); per esporre un host interno serve il port forwarding (riga statica).` : '✗'));
    return res;
  }

  function solution(ex, root) {
    const a = sol2answers(ex);
    root.appendChild(U.h('div', { class: 'card sol' },
      U.h('h4', {}, 'Soluzione'),
      U.h('table', { class: 'data' },
        U.h('tr', {}, ['Flusso', 'IP sorg.', 'IP dest.', 'Porta sorg.', 'Porta dest.'].map(t => U.h('th', {}, t))),
        ex.flows.map((r, i) => U.h('tr', {},
          U.h('td', {}, String(i + 1)),
          r.map(v => U.h('td', {}, String(v)))))),
      U.h('p', { class: 'sol-body' }, U.h('b', {}, 'b) '), a.qB),
      U.h('p', { class: 'sol-body' }, U.h('b', {}, 'c) '), a.qC)));
  }

  function hints(ex) {
    const H = ['Passo 1: guarda da che parte del router è la freccia. Lato LAN → compare l\'IP privato dell\'host; lato WAN → compare l\'IP pubblico del NAT.'];
    H.push('Passo 2: guarda la direzione. Verso il server: sorgente = host (o NAT), destinazione = server. Dal server: si scambiano sorgente e destinazione della riga di andata sullo stesso lato (il flusso 3 è il 2 scambiato, il 4 è l\'1 scambiato).');
    H.push('Passo 3: prendi i valori dalla riga giusta della tabella NAT: colonna LAN per i flussi lato LAN, colonna WAN per quelli lato WAN. IP e porta del server non cambiano MAI.');
    H.push('Controllo rapido: l\'IP privato compare solo nelle righe lato LAN, il pubblico solo in quelle lato WAN; ogni host ha sempre la stessa porta privata e la stessa porta WAN in andata e ritorno.');
    return H;
  }

  // ---- testo per la correzione in chat ----
  function chatText(ex, state) {
    const lines = [];
    lines.push(`#3 · NAT (livello ${ex.level})`);
    lines.push('## Testo');
    lines.push(`Rete privata con router NAT. Host 1 = ${ex.h1}, Host 2 = ${ex.h2}: entrambi hanno una connessione TCP aperta con il server web ${ex.srv} (porta ${ex.srvPort}). IP pubblico del NAT (lato WAN): ${ex.pub}.`);
    lines.push(`Tabella di traduzione: [${ex.pub}, ${ex.w1}] → [${ex.h1}, ${ex.p1}]; [${ex.pub}, ${ex.w2}] → [${ex.h2}, ${ex.p2}].`);
    lines.push('a) Indicare IP e porte di sorgente e destinazione per gli 8 flussi: 1) dati host1→server PRIMA del NAT (lato LAN); 2) DOPO il NAT (lato WAN); 3) server→host1 prima (lato WAN); 4) dopo (lato LAN); 5–8) lo stesso per l\'host 2.');
    lines.push(ex.samePort
      ? `b) I due host usano entrambi la porta sorgente ${ex.p1}: perché il NAT ha assegnato due porte diverse sul lato WAN?`
      : 'b) Perché il NAT deve tenere traccia delle coppie (IP, porta) e non solo degli IP?');
    lines.push('c) Un host esterno invia un segmento TCP all\'IP pubblico su una porta senza voce in tabella: cosa succede? Cosa servirebbe per far arrivare la connessione a un host interno?');
    lines.push('');
    lines.push('## Le mie risposte');
    const sides = ['LAN', 'WAN', 'WAN', 'LAN'];
    for (let i = 0; i < 8; i++) {
      const host = i < 4 ? 1 : 2;
      const d = i % 4;
      const arrow = d < 2 ? `H${host}→S` : `S→H${host}`;
      const cells = state.fields.flows[i].map(inp => inp.value || '__');
      lines.push(`- Flusso ${i + 1} (${arrow}, lato ${sides[d]}): IP sorgente ${cells[0]} | IP dest. ${cells[1]} | porta sorg. ${cells[2]} | porta dest. ${cells[3]}`);
    }
    lines.push(`- b) ${state.fields.qB.value.trim() || '__'}`);
    lines.push(`- c) ${state.fields.qC.value.trim() || '__'}`);
    return lines.join('\n');
  }

  RA.nat = {
    id: 'nat', num: '3', name: 'NAT',
    desc: 'IP e porte prima/dopo il NAT, porte WAN diverse, port forwarding.',
    examPoints: 5, gen, grade, sol2answers, render, check, solution, hints, chatText
  };
})();
