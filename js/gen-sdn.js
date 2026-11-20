// ============================================================
// RetiApp · gen-sdn.js — Esercizio 5 · SDN e flow table
// ============================================================
(function () {
  const RA = window.RetiApp;
  const U = RA.util;

  // Topologia (come l'esame): s1: h1,h2 · s2: h3,h4 · s3: h5,h6
  // collegamenti: s1–s2, s1–s3, s2–s3. I numeri di porta sono casuali.
  function gen(level) {
    const a1 = U.shuffle([1, 2, 3, 4]), a2 = U.shuffle([1, 2, 3, 4]), a3 = U.shuffle([1, 2, 3, 4]);
    const p1 = {}, p2 = {}, p3 = {};
    ['h1', 'h2', 's2', 's3'].forEach((k, i) => p1[k] = a1[i]);
    ['h3', 'h4', 's1', 's3'].forEach((k, i) => p2[k] = a2[i]);
    ['h5', 'h6', 's1', 's2'].forEach((k, i) => p3[k] = a3[i]);
    const portmaps = { s1: p1, s2: p2, s3: p3 };

    const sub1 = U.rndInt(1, 9);
    let sub2 = U.rndInt(1, 9); while (sub2 === sub1) sub2 = U.rndInt(1, 9);
    let sub3 = U.rndInt(1, 9); while (sub3 === sub1 || sub3 === sub2) sub3 = U.rndInt(1, 9);
    const hosts = {
      h1: `10.${sub1}.0.1`, h2: `10.${sub1}.0.2`,
      h3: `10.${sub2}.0.3`, h4: `10.${sub2}.0.4`,
      h5: `10.${sub3}.0.5`, h6: `10.${sub3}.0.6`
    };
    const hSw = { h1: 's1', h2: 's1', h3: 's2', h4: 's2', h5: 's3', h6: 's3' };
    const subOf = { h1: sub1, h2: sub1, h3: sub2, h4: sub2, h5: sub3, h6: sub3 };

    let flows;
    if (level <= 1) {
      flows = [
        { from: 'h1', to: ['h5', 'h6'], path: ['s1', 's2', 's3'], label: 'il traffico da h1 verso h5 e h6 passi da s2 e poi da s3' }
      ];
    } else if (level === 2) {
      flows = [
        { from: 'h1', to: ['h5', 'h6'], path: ['s1', 's2', 's3'], label: 'il traffico da h1 verso h5 e h6 passi da s2 e poi da s3' },
        { from: 'h2', to: ['h5', 'h6'], path: ['s1', 's3'], label: 'il traffico da h2 verso h5 e h6 vada direttamente da s1 a s3' }
      ];
    } else if (level <= 4) {
      flows = [
        { from: 'h1', to: ['h5', 'h6'], path: ['s1', 's2', 's3'], label: 'il traffico generato da h1 diretto verso h5 e h6 passi da s2 e poi da s3' },
        { from: 'h2', to: ['h5', 'h6'], path: ['s1', 's3'], label: 'il traffico generato da h2 diretto verso h5 e h6 vada direttamente da s1 a s3' },
        { from: 'h5', to: ['h1', 'h2'], path: ['s3', 's1'], label: 'il traffico di risposta da h5 verso h1 e h2 vada direttamente da s3 a s1' },
        { from: 'h6', to: ['h1', 'h2'], path: ['s3', 's1'], label: 'il traffico di risposta da h6 verso h1 e h2 vada direttamente da s3 a s1' }
      ];
    } else {
      flows = [
        { from: 'h1', to: ['h5', 'h6'], path: ['s1', 's2', 's3'], label: 'il traffico generato da h1 verso h5 e h6 passi da s2 e poi da s3' },
        { from: 'h2', to: ['h5', 'h6'], path: ['s1', 's3'], label: 'il traffico generato da h2 verso h5 e h6 vada direttamente da s1 a s3' },
        { from: 'h3', to: ['h1', 'h2'], path: ['s2', 's1'], label: 'il traffico generato da h3 verso h1 e h2 vada direttamente da s2 a s1' },
        { from: 'h5', to: ['h1', 'h2'], path: ['s3', 's1'], label: 'il traffico di risposta da h5 verso h1 e h2 vada direttamente da s3 a s1' },
        { from: 'h6', to: ['h1', 'h2'], path: ['s3', 's1'], label: 'il traffico di risposta da h6 verso h1 e h2 vada direttamente da s3 a s1' }
      ];
    }

    // pacchetti di test: uno per coppia (from, to)
    const packets = [];
    flows.forEach(f => f.to.forEach(dst => packets.push({ from: f.from, to: dst, path: f.path })));

    return { cat: 'sdn', level, hosts, hSw, portmaps, flows, packets, sub1, sub2, sub3, subOf };
  }

  // ---- soluzione canonica ----
  function solutionRules(ex) {
    const rules = [];
    const seen = {};
    function add(sw, ing, src, dst, act) {
      const key = [sw, ing, src, dst, act].join('|');
      if (seen[key]) return;
      seen[key] = true;
      rules.push({ sw, ing: String(ing), src, dst, act: String(act) });
    }
    ex.flows.forEach(f => {
      const srcIp = ex.hosts[f.from];
      const dstSub = `10.${ex.subOf[f.to[0]]}.*.*`;
      f.path.forEach((sw, k) => {
        // porta d'ingresso: quella dell'host (primo switch) o quella verso lo switch a monte
        const ing = k === 0 ? ex.portmaps[sw][f.from] : ex.portmaps[sw][f.path[k - 1]];
        const last = k === f.path.length - 1;
        if (!last) {
          const next = f.path[k + 1];
          add(sw, ing, srcIp, dstSub, ex.portmaps[sw][next]);
        } else {
          f.to.forEach(hh => add(sw, '', srcIp, ex.hosts[hh], ex.portmaps[sw][hh]));
        }
      });
    });
    // sull'ultimo switch basta la sola destinazione: fondi le regole con stessa dst+act su switch diversi ingressi
    return rules;
  }

  // ---- verifica: SIMULA i pacchetti con le regole dell'utente ----
  function ipMatch(pattern, ip) {
    const p = (pattern || '').trim().replace(/\s/g, '');
    if (!p || p === '*.*.*.*') return true;
    if (p.includes('*')) {
      const parts = p.split('.'), ipParts = ip.split('.');
      for (let i = 0; i < 4; i++) {
        if (parts[i] === undefined || parts[i] === '*') continue;
        if (parts[i] !== ipParts[i]) return false;
      }
      return true;
    }
    return p === ip;
  }

  function grade(ex, answers) {
    const rules = answers.rules || [];
    const ruleMarks = rules.map(() => ({ ok: true, msg: null, used: false }));
    const flowMarks = [];
    const notes = [];
    let correct = 0, total = 0;

    function matchedRules(sw, ing, src, dst) {
      return rules.map((r, i) => ({ r, i }))
        .filter(x => x.r.sw === sw && x.r.sw !== null &&
          // regola non compilata (nessun campo di match): ignorala
          !((x.r.src === '' || x.r.src === undefined) && (x.r.dst === '' || x.r.dst === undefined) && (x.r.ing === '' || x.r.ing === undefined || x.r.ing === '—')) &&
          (x.r.ing === '' || x.r.ing === '*' || Number(x.r.ing) === ing) &&
          ipMatch(x.r.src, src) && ipMatch(x.r.dst, dst));
    }

    ex.packets.forEach(pkt => {
      let ok = true, firstErr = null;
      let sw = ex.hSw[pkt.from];
      let ing = ex.portmaps[sw][pkt.from];
      const srcIp = ex.hosts[pkt.from], dstIp = ex.hosts[pkt.to];
      for (let step = 0; step < pkt.path.length; step++) {
        const last = step === pkt.path.length - 1;
        const nextNode = last ? pkt.to : pkt.path[step + 1];
        const expOut = ex.portmaps[sw][nextNode];
        const m = matchedRules(sw, ing, srcIp, dstIp);
        const goods = m.filter(x => String(x.r.act) === String(expOut));
        if (m.length === 0) {
          ok = false;
          firstErr = firstErr || `su ${sw} manca una regola per il pacchetto ${pkt.from}→${pkt.to} (ingresso ${ing}, IP src ${srcIp}, IP dst ${dstIp}): deve uscire dalla porta ${expOut}`;
        } else if (goods.length === 0) {
          const bad = m[0];
          ok = false;
          firstErr = firstErr || `su ${sw} il pacchetto ${pkt.from}→${pkt.to} (ingresso ${ing}) esce dalla porta ${bad.r.act} invece di ${expOut}: ricontrolla la mappa delle porte di ${sw}`;
          ruleMarks[bad.i] = { ok: false, msg: `instrada ${pkt.from}→${pkt.to} sulla porta sbagliata (attesa ${expOut})`, used: true };
        } else if (m.length > goods.length) {
          const bad = m.find(x => String(x.r.act) !== String(expOut));
          ok = false;
          firstErr = firstErr || `su ${sw} il pacchetto ${pkt.from}→${pkt.to} soddisfa regole in conflitto (forward(${expOut}) e forward(${bad.r.act})): un jolly è troppo largo o manca la sorgente nel match`;
          ruleMarks[bad.i] = { ok: false, msg: `in conflitto con un'altra regola per lo stesso pacchetto su ${sw}`, used: true };
        } else {
          goods.forEach(g => { ruleMarks[g.i].used = true; });
        }
        if (!last) { ing = ex.portmaps[nextNode][sw]; sw = nextNode; }
      }
      total++; if (ok) correct++;
      flowMarks.push({ from: pkt.from, to: pkt.to, ok, msg: firstErr });
    });

    rules.forEach((r, i) => {
      const isEmpty = !r.src && !r.dst && (!r.ing || r.ing === '—');
      if (!isEmpty && ruleMarks[i].ok && !ruleMarks[i].used) {
        notes.push(`regola su ${r.sw} (match: ${r.ing ? 'ingresso ' + r.ing + ', ' : ''}IP src ${r.src || 'qualsiasi'}, IP dst ${r.dst || 'qualsiasi'} → ${r.act === 'drop' ? 'drop' : 'forward(' + r.act + ')'}) non serve per nessuno dei percorsi richiesti`);
      }
    });
    return { correct, total, ruleMarks, flowMarks, notes };
  }

  function sol2answers(ex) { return { rules: solutionRules(ex) }; }

  // ---- rendering ----
  function svgDiagram(ex) {
    const p = ex.portmaps;
    const pos = {
      h1: [30, 40], h2: [30, 120], h3: [30, 200], h4: [30, 280],
      h5: [450, 40], h6: [450, 280],
      s1: [140, 80], s2: [140, 240], s3: [360, 160]
    };
    function line(x1, y1, x2, y2) { return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="link"/>`; }
    function portLabel(x1, y1, x2, y2, n) {
      const tx = x1 + (x2 - x1) * 0.15, ty = y1 + (y2 - y1) * 0.15;
      return `<circle cx="${tx}" cy="${ty}" r="11" class="port"/><text x="${tx}" y="${ty + 4}" text-anchor="middle" class="port-n">${n}</text>`;
    }
    const [s1x, s1y] = pos.s1, [s2x, s2y] = pos.s2, [s3x, s3y] = pos.s3;
    let s = `<svg viewBox="0 0 500 330" class="fig">`;
    // host–switch
    for (const h of ['h1', 'h2']) s += line(pos[h][0] + 60, pos[h][1], s1x - 18, s1y) + portLabel(pos[h][0] + 60, pos[h][1], s1x - 18, s1y, p.s1[h]);
    for (const h of ['h3', 'h4']) s += line(pos[h][0] + 60, pos[h][1], s2x - 18, s2y) + portLabel(pos[h][0] + 60, pos[h][1], s2x - 18, s2y, p.s2[h]);
    for (const h of ['h5', 'h6']) s += line(pos[h][0] - 60, pos[h][1], s3x + 18, s3y) + portLabel(pos[h][0] - 60, pos[h][1], s3x + 18, s3y, p.s3[h]);
    // switch–switch (porta vicino a ciascuno capo)
    s += line(s1x, s1y + 14, s2x, s2y - 14);
    s += portLabel(s1x, s1y + 14, s2x, s2y - 14, p.s1.s2) + portLabel(s2x, s2y - 14, s1x, s1y + 14, p.s2.s1);
    s += line(s1x + 18, s1y + 8, s3x - 18, s3y - 8);
    s += portLabel(s1x + 18, s1y + 8, s3x - 18, s3y - 8, p.s1.s3) + portLabel(s3x - 18, s3y - 8, s1x + 18, s1y + 8, p.s3.s1);
    s += line(s2x + 18, s2y - 8, s3x - 18, s3y + 8);
    s += portLabel(s2x + 18, s2y - 8, s3x - 18, s3y + 8, p.s2.s3) + portLabel(s3x - 18, s3y + 8, s2x + 18, s2y - 8, p.s3.s2);
    // nodi
    for (const h in pos) {
      const [x, y] = pos[h];
      const isSw = h.startsWith('s');
      s += isSw
        ? `<rect x="${x - 22}" y="${y - 16}" width="44" height="32" rx="6" class="sw"/><text x="${x}" y="${y + 5}" text-anchor="middle" class="lbl">${h}</text>`
        : `<rect x="${x - 55}" y="${y - 14}" width="115" height="28" rx="4" class="box"/><text x="${x}" y="${y + 5}" text-anchor="middle" class="lbl">${h} · ${ex.hosts[h]}</text>`;
    }
    s += `</svg>`;
    return s;
  }

  function render(ex, root, state) {
    state.ruleRows = [];
    root.appendChild(U.h('div', { class: 'card intro', html: svgDiagram(ex) }));
    root.appendChild(U.h('p', { class: 'small' },
      `Numeri nei cerchietti = porte degli switch (ogni switch usa i SUOI numeri: la porta ${ex.portmaps.s1.s2} di s1 e la porta ${ex.portmaps.s2.s1} di s2 sono lo stesso cavo).`));

    const tasks = U.h('ol', { class: 'small' }, ex.flows.map(f => {
      const route = f.path.join(' → ');
      return U.h('li', {}, `${f.label} (percorso atteso: ${route})`);
    }));
    root.appendChild(U.h('div', { class: 'card' },
      U.h('h4', {}, 'Con la sintassi match → action, scrivi le entry per i 3 switch (o per quelli che servono) affinché:'), tasks,
      U.h('p', { class: 'small' }, 'Sintassi: <code>ingresso</code> (porta d\'ingresso o —), <code>IP src</code> e <code>IP dst</code> (IP esatto o con jolly, es. 10.' + ex.sub3 + '.*.*), <code>action</code> = forward(porta).')));

    const rulesCard = U.h('div', { class: 'card' }, U.h('h4', {}, 'Flow table'));
    const rulesTable = U.h('table', { class: 'grid' },
      U.h('tr', {}, ['Switch', 'Ingresso', 'IP src', 'IP dst', 'Action'].map(t => U.h('th', {}, t))));
    function addRuleRow() {
      const fields = {};
      const tr = U.h('tr', { class: 'rule-row' });
      const swSel = U.h('select', { class: 'cell' }, ['s1', 's2', 's3'].map(v => U.h('option', { value: v }, v)));
      const ingSel = U.h('select', { class: 'cell' }, ['—', '1', '2', '3', '4'].map(v => U.h('option', { value: v === '—' ? '' : v }, v)));
      const srcInp = U.h('input', { class: 'cell', type: 'text', placeholder: `es. ${ex.hosts.h1} o 10.${ex.sub1}.*.*` });
      const dstInp = U.h('input', { class: 'cell', type: 'text', placeholder: `es. ${ex.hosts.h5} o 10.${ex.sub3}.*.*` });
      const actSel = U.h('select', { class: 'cell' }, ['forward(1)', 'forward(2)', 'forward(3)', 'forward(4)', 'drop'].map(v => U.h('option', { value: v === 'drop' ? 'drop' : v.slice(8, -1) }, v)));
      fields.sw = swSel; fields.ing = ingSel; fields.src = srcInp; fields.dst = dstInp; fields.act = actSel;
      state.ruleRows.push({ fields, tr });
      tr.appendChild(U.h('td', {}, swSel));
      tr.appendChild(U.h('td', {}, ingSel));
      tr.appendChild(U.h('td', {}, srcInp));
      tr.appendChild(U.h('td', {}, dstInp));
      tr.appendChild(U.h('td', {}, actSel));
      const del = U.h('button', { class: 'mini', text: '✕', onclick: () => {
        state.ruleRows.splice(state.ruleRows.indexOf(rowObj), 1);
        tr.remove();
      } });
      const rowObj = { fields, tr };
      tr.appendChild(U.h('td', {}, del));
      rulesTable.appendChild(tr);
    }
    const needed = 4 + ex.flows.length * 2;
    for (let i = 0; i < Math.min(needed, 10); i++) addRuleRow();
    rulesCard.appendChild(rulesTable);
    rulesCard.appendChild(U.h('button', { class: 'btn ghost', text: '+ aggiungi regola', onclick: addRuleRow }));
    root.appendChild(rulesCard);
    state.rulesTable = rulesTable;
  }

  function check(ex, root, state, explain) {
    U.resetFb(root);
    const answers = { rules: state.ruleRows.map(r => ({
      sw: r.fields.sw.value, ing: r.fields.ing.value, src: r.fields.src.value, dst: r.fields.dst.value, act: r.fields.act.value
    })) };
    const res = grade(ex, answers);

    state.ruleRows.forEach((row, i) => {
      const m = res.ruleMarks[i];
      if (!m.used && m.ok) return; // regola inutilizzata: nota, non errore
      const first = row.fields.sw;
      [row.fields.sw, row.fields.ing, row.fields.src, row.fields.dst, row.fields.act].forEach(el => {
        el.classList.remove('ok', 'err'); el.classList.add(m.ok ? 'ok' : 'err');
      });
      let f = row.tr.querySelector('.rule-msg');
      if (f) f.remove();
      if (!m.ok && m.msg) {
        f = U.h('td', { class: 'rule-msg', colspan: '6' }, (explain ? '⚠ ' + m.msg : '✗'));
        row.tr.insertAdjacentElement('afterend', U.h('tr', {}, f));
      }
    });

    // riepilogo per flusso
    let summ = root.querySelector('.flow-summary');
    if (summ) summ.remove();
    summ = U.h('div', { class: 'flow-summary card' }, U.h('h4', {}, 'Verifica dei percorsi'));
    res.flowMarks.forEach(fm => {
      summ.appendChild(U.h('div', { class: 'flow-line ' + (fm.ok ? 'ok-line' : 'err-line') },
        U.h('span', { class: 'flow-badge' }, fm.ok ? '✓' : '✗'),
        U.h('span', {}, `${fm.from} → ${fm.to}${!fm.ok && explain ? ' — ' + fm.msg : ''}`)));
    });
    res.notes.forEach(n => summ.appendChild(U.h('div', { class: 'flow-line warn-line' }, U.h('span', { class: 'flow-badge' }, '⚠'), U.h('span', {}, n))));
    root.appendChild(summ);
    return res;
  }

  function solution(ex, root) {
    const rules = solutionRules(ex);
    root.appendChild(U.h('div', { class: 'card sol' },
      U.h('h4', {}, 'Soluzione (una possibile)'),
      U.h('table', { class: 'data' },
        U.h('tr', {}, ['Switch', 'Match', 'Action'].map(t => U.h('th', {}, t))),
        rules.map(r => U.h('tr', {},
          U.h('td', {}, r.sw),
          U.h('td', {}, `${r.ing ? 'ingresso = ' + r.ing + ', ' : ''}IP src = ${r.src}, IP dst = ${r.dst}`),
          U.h('td', {}, 'forward(' + r.act + ')')))),
      U.h('p', { class: 'sol-body small' },
        'Nota la granularità: sugli switch intermedi la sorgente è esatta (serve a distinguere host che devono fare strade diverse) e la destinazione può usare il jolly; sull\'ultimo switch basta la sola destinazione, perché qualunque sia la porta d\'arrivo l\'host finale esce sempre dalla stessa porta.')));
  }

  function hints(ex) {
    const H = ['Passo 1: scrivi la mappa delle porte: per ogni switch, cosa c\'è dietro ogni porta. È il passo che evita quasi tutti gli errori. (Nella figura: il numero vicino allo switch è la porta di QUELLO switch.)',
      'Passo 2: traccia i percorsi: per ogni flusso richiesto, elenca gli switch attraversati in ordine.',
      'Passo 3: per ogni switch del percorso, una regola: match = porta d\'ingresso + IP src + IP dst, action = forward(porta d\'uscita verso il prossimo switch o verso l\'host finale).',
      'Passo 4: granularità. Usa l\'IP esatto dove serve distinguere (sorgenti che devono fare strade diverse) e il jolly dove la strada è la stessa (es. 10.' + ex.sub3 + '.*.* se h5 e h6 stanno oltre lo stesso link). Sull\'ultimo switch le destinazioni escono da porte diverse: servono regole separate per ogni host.'];
    return H;
  }

  // ---- testo per la correzione in chat ----
  function chatText(ex, state) {
    const lines = [];
    lines.push(`#5 · SDN e flow table (livello ${ex.level})`);
    lines.push('## Testo');
    lines.push('Rete SDN: s1 con h1, h2; s2 con h3, h4; s3 con h5, h6. Switch collegati: s1–s2, s1–s3, s2–s3.');
    const hostsTxt = Object.keys(ex.hosts).map(h => `${h} = ${ex.hosts[h]}`).join(', ');
    lines.push(`Host: ${hostsTxt}.`);
    const pm = ex.portmaps;
    lines.push(`Mappa delle porte — s1: h1→${pm.s1.h1}, h2→${pm.s1.h2}, verso s2→${pm.s1.s2}, verso s3→${pm.s1.s3}; s2: h3→${pm.s2.h3}, h4→${pm.s2.h4}, verso s1→${pm.s2.s1}, verso s3→${pm.s2.s3}; s3: h5→${pm.s3.h5}, h6→${pm.s3.h6}, verso s1→${pm.s3.s1}, verso s2→${pm.s3.s2}.`);
    lines.push('Con la sintassi match → action (ingresso, IP src, IP dst, forward(porta)), scrivi le entry affinché:');
    ex.flows.forEach((f, i) => {
      const route = f.path.join(' → ');
      lines.push(`${String.fromCharCode(97 + i)}) ${f.label} (percorso atteso: ${route}).`);
    });
    lines.push('');
    lines.push('## Le mie risposte');
    const filled = state.ruleRows.filter(r =>
      r.fields.src.value.trim() !== '' || r.fields.dst.value.trim() !== '' || r.fields.ing.value !== '');
    if (!filled.length) lines.push('- (nessuna regola scritta)');
    filled.forEach((r, i) => {
      const f = r.fields;
      lines.push(`- ${f.sw.value}: ingresso=${f.ing.value || '—'}, IP src=${f.src.value || 'qualsiasi'}, IP dst=${f.dst.value || 'qualsiasi'} → ${f.act.value === 'drop' ? 'drop' : 'forward(' + f.act.value + ')'}`);
    });
    return lines.join('\n');
  }

  RA.sdn = {
    id: 'sdn', num: '5', name: 'SDN e flow table',
    desc: 'Entry match/action per far seguire ai flussi i percorsi richiesti.',
    examPoints: 4, gen, grade, sol2answers, render, check, solution, hints, chatText
  };
})();
