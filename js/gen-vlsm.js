// ============================================================
// RetiApp · gen-vlsm.js — Esercizio 1 · Indirizzamento IP e routing
// ============================================================
(function () {
  const RA = window.RetiApp;
  const U = RA.util;

  // Topologia fissa: R1 (bordo, Net_A) — R2 (Net_B) — R3 (Net_C)
  // Link_1: R1–R2 · Link_2: R2–R3 · Link_3: R1–R3
  const NETS = ['Net_A', 'Net_B', 'Net_C', 'Link_1', 'Link_2', 'Link_3'];
  const LINK_ROUTERS = { Link_1: ['R1', 'R2'], Link_2: ['R2', 'R3'], Link_3: ['R1', 'R3'] };
  const LAN_ROUTER = { Net_A: 'R1', Net_B: 'R2', Net_C: 'R3' };
  const ROUTER_LAN = { R1: 'Net_A', R2: 'Net_B', R3: 'Net_C' };
  const ROUTER_LINKS = { R1: ['Link_1', 'Link_3'], R2: ['Link_1', 'Link_2'], R3: ['Link_2', 'Link_3'] };
  function neighbors(X) { return { R1: ['R2', 'R3'], R2: ['R1', 'R3'], R3: ['R1', 'R2'] }[X]; }
  function sharedLink(a, b) { return NETS.find(n => (LINK_ROUTERS[n] || []).includes(a) && (LINK_ROUTERS[n] || []).includes(b)); }
  function ownersOf(net) { return LAN_ROUTER[net] ? [LAN_ROUTER[net]] : LINK_ROUTERS[net].slice(); }
  function hopDist(a, b) { return a === b ? 0 : 1; } // triangolo: tutti adiacenti

  function gen(level) {
    // spazio e numero di host per livello
    let prefix, hA, hB, hC;
    if (level <= 1) { prefix = 24; hA = U.rndInt(17, 28); hB = U.rndInt(5, 12); hC = U.rndInt(2, 5); }
    else if (level === 2) { prefix = 25; hA = U.rndInt(30, 58); hB = U.rndInt(13, 28); hC = U.rndInt(2, 5); }
    else if (level === 3) { prefix = 25; hA = U.rndInt(30, 58); hB = U.rndInt(13, 28); hC = U.rndInt(7, 12); }
    else if (level === 4) { prefix = 26; hA = U.rndInt(13, 28); hB = U.rndInt(3, 5); hC = U.rndInt(2, 5); }
    else { prefix = 25; hA = U.rndInt(56, 60); hB = U.rndInt(13, 28); hC = U.rndInt(7, 12); }
    const hosts = { Net_A: hA, Net_B: hB, Net_C: hC };

    const A = U.pick([200, 201, 143, 130, 82, 151, 62]);
    const B = U.rndInt(1, 250);
    const blockSize = Math.pow(2, 32 - prefix);
    // ultimo ottetto del punto di partenza: allineato alla dimensione del blocco
    const blockC = U.rndInt(0, 256 / blockSize - 1) * blockSize;
    const start = (((A << 24) | (B << 16) | (blockC << 8)) >>> 0);

    // dimensioni attese
    const need = {}, size = {}, expPrefix = {};
    NETS.forEach(n => {
      need[n] = n.startsWith('Net') ? hosts[n] + 3 : 4;
      size[n] = U.pow2ceil(need[n]);
      expPrefix[n] = 32 - Math.log2(size[n]);
    });

    // soluzione canonica: dal blocco più grande al più piccolo, dall'inizio dello spazio
    const order = NETS.slice().sort((a, b) => size[b] - size[a] || NETS.indexOf(a) - NETS.indexOf(b));
    const sol = { subnets: {}, iface: {} };
    let cur = start;
    order.forEach(n => {
      sol.subnets[n] = {
        net: cur, size: size[n], prefix: expPrefix[n],
        mask: U.fmtMask(expPrefix[n]),
        first: cur + 1, last: cur + size[n] - 2, bcast: cur + size[n] - 1
      };
      cur += size[n];
    });
    // interfacce dei router: primo utile della LAN; sul /30 il router "più piccolo" prende il primo
    sol.iface = {
      R1: { LAN: sol.subnets.Net_A.first, Link_1: sol.subnets.Link_1.net + 1, Link_3: sol.subnets.Link_3.net + 1 },
      R2: { LAN: sol.subnets.Net_B.first, Link_1: sol.subnets.Link_1.net + 2, Link_2: sol.subnets.Link_2.net + 1 },
      R3: { LAN: sol.subnets.Net_C.first, Link_2: sol.subnets.Link_2.net + 2, Link_3: sol.subnets.Link_3.net + 2 }
    };

    const askedRouter = U.pick(['R2', 'R3']);
    // domanda (iii): forzatura percorso dal punto di vista del router richiesto nella (ii)
    const q3 = askedRouter === 'R2'
      ? { traffic: 'da Net_B a Net_A', via: 'R3', normally: 'R2 → R1 direttamente via Link_1', forced: 'R2 → R3 → R1 (Link_2 + Link_3)' }
      : { traffic: 'da Net_C a Net_B', via: 'R1', normally: 'R3 → R2 direttamente via Link_2', forced: 'R3 → R1 → R2 (Link_3 + Link_1)' };

    return { cat: 'vlsm', level, start, prefix, blockSize, hosts, need, size, expPrefix, sol, askedRouter, q3 };
  }

  // ---------------- VERIFICA ----------------
  // answers: {
  //   subnets: { Net_A: {pf, mask, first, last, bcast}, ... },
  //   iface: { R1: {LAN, Link_1, Link_2, Link_3}, ... },   ('' se non applicabile)
  //   routes: [ {dest, nh} ],
  //   q3: 'testo'
  // }
  function grade(ex, answers) {
    let correct = 0, total = 0;
    const marks = { subnets: {}, iface: {}, routes: [], routeTests: [], q3: null, notes: [] };

    // ---- (i) sottoreti ----
    const userSub = {}; // nome -> {net, size} se valido
    NETS.forEach(n => {
      const a = (answers.subnets || {})[n] || {};
      const m = { pf: null, n: null, net: null, mask: null, first: null, last: null, bcast: null };
      const expP = ex.expPrefix[n], expSize = ex.size[n];
      total += 6;
      const parsed = U.parsePrefix(a.pf);

      if (!parsed) {
        const bad = { ok: false, msg: 'scrivi la rete in forma indirizzo/prefisso, es. ' + U.fmtPrefix(ex.sol.subnets[n].net, expP) };
        m.pf = bad; m.n = bad; m.net = bad; m.mask = bad; m.first = bad; m.last = bad; m.bcast = bad;
        marks.subnets[n] = m;
        return;
      }

      // (1) prefisso della giusta dimensione
      const userN = parsed.n;
      m.n = {
        ok: userN === expP,
        msg: `${n}${n.startsWith('Net') ? ` ha ${ex.hosts[n]} host → servono ${ex.need[n]} indirizzi (host + router + rete/broadcast) → blocco da ${expSize}` : ` (link punto-punto: 2 interfacce + rete/broadcast = 4)`} → prefisso /${expP}`
      };
      if (userN === expP) correct++;
      const userSize = Math.pow(2, 32 - userN);

      // (2) rete: allineata, dentro il blocco, senza sovrapposizioni
      const aligned = parsed.ip % userSize === 0;
      const inBlock = parsed.ip >= ex.start && parsed.ip + userSize <= ex.start + ex.blockSize;
      let netOk = aligned && inBlock && userN === expP;
      m.net = {
        ok: netOk,
        msg: !aligned
          ? `il blocco da ${userSize} deve partire da un multiplo di ${userSize} (allineamento)`
          : !inBlock
            ? `fuori dallo spazio assegnato (${U.fmtPrefix(ex.start, ex.prefix)} → ${U.int2ip(ex.start + ex.blockSize - 1)})`
            : userN !== expP
              ? `dimensione del blocco sbagliata: vedi il messaggio del prefisso`
              : `rete valida: ${U.fmtPrefix(parsed.ip, userN)}`
      };
      if (netOk) {
        for (const o in userSub) {
          const us = userSub[o];
          if (!(parsed.ip + userSize <= us.net || us.net + us.size <= parsed.ip)) {
            netOk = false;
            m.net = { ok: false, msg: `si sovrappone con ${o} (${U.fmtPrefix(us.net, 32 - Math.log2(us.size))})` };
          }
        }
        if (netOk) userSub[n] = { net: parsed.ip, size: userSize };
      }
      m.net.ok = netOk;
      if (netOk) correct++;

      // (3) maschera: coerente col SUO prefisso
      const expMask = U.fmtMask(userN);
      m.mask = { ok: (a.mask || '').replace(/\s/g, '') === expMask, msg: `la maschera di /${userN} è ${expMask} (trucco: 256 − ${userSize})` };
      if (m.mask.ok) correct++;

      // (4-6) range e broadcast: coerenti con la rete scelta dall'utente (se valida) o col canonico
      const refNet = userSub[n] ? userSub[n].net : ex.sol.subnets[n].net;
      const refSize = userSub[n] ? userSub[n].size : expSize;
      const refFirst = refNet + 1, refLast = refNet + refSize - 2, refBcast = refNet + refSize - 1;
      m.first = { ok: U.ip2int(a.first) === refFirst, msg: `primo utile = rete + 1 = ${U.int2ip(refFirst)}` };
      if (m.first.ok) correct++;
      m.last = { ok: U.ip2int(a.last) === refLast, msg: `ultimo utile = broadcast − 1 = ${U.int2ip(refLast)}` };
      if (m.last.ok) correct++;
      m.bcast = { ok: U.ip2int(a.bcast) === refBcast, msg: `broadcast = rete + dimensione − 1 = ${U.int2ip(refBcast)}` };
      if (m.bcast.ok) correct++;
      marks.subnets[n] = m;
    });

    // ---- (i-bis) interfacce dei router ----
    ['R1', 'R2', 'R3'].forEach(R => {
      const a = (answers.iface || {})[R] || {};
      marks.iface[R] = {};
      // LAN
      const lanNet = userSub[ROUTER_LAN[R]] || ex.sol.subnets[ROUTER_LAN[R]];
      total++;
      const lanIp = U.ip2int(a.LAN);
      const lanOk = lanIp !== null && lanIp > lanNet.net && lanIp < lanNet.net + lanNet.size;
      marks.iface[R].LAN = {
        ok: lanOk,
        msg: `l'interfaccia di ${R} su ${ROUTER_LAN[R]} deve appartenere a ${ROUTER_LAN[R]} (${U.int2ip(lanNet.net + 1)}–${U.int2ip(lanNet.net + lanNet.size - 2)}): è il default gateway degli host`
      };
      if (lanOk) correct++;
      ROUTER_LINKS[R].forEach(L => {
        total++;
        const linkNet = userSub[L] || ex.sol.subnets[L];
        const ip = U.ip2int(a[L]);
        const other = LINK_ROUTERS[L].find(x => x !== R);
        const otherIp = U.ip2int(((answers.iface || {})[other] || {})[L]);
        const ok = ip !== null && ip > linkNet.net && ip < linkNet.net + linkNet.size &&
          (otherIp === null || otherIp === null ? true : ip !== otherIp);
        marks.iface[R][L] = {
          ok,
          msg: `l'interfaccia di ${R} su ${L} deve stare in ${L} (${U.int2ip(linkNet.net + 1)}–${U.int2ip(linkNet.net + linkNet.size - 2)}), su un indirizzo diverso da quello di ${other}`
        };
        if (ok) correct++;
      });
    });

    // IP di riferimento per i next-hop: usa quelli dell'utente se validi, altrimenti i canonici
    function refIface(R, L) {
      const v = U.ip2int(((answers.iface || {})[R] || {})[L]);
      const linkNet = userSub[L] || ex.sol.subnets[L];
      if (v !== null && v > linkNet.net && v < linkNet.net + linkNet.size) return v;
      return ex.sol.iface[R][L];
    }

    // ---- (ii) tabella di routing di askedRouter ----
    const X = ex.askedRouter;
    // righe utente
    const rows = (answers.routes || []).map(r => {
      let dest = null, isDefault = false;
      const d = (r.dest || '').trim();
      if (/^(default|0\.0\.0\.0\s*\/\s*0)$/i.test(d)) { dest = { ip: 0, n: 0 }; isDefault = true; }
      else {
        const p = U.parsePrefix(d);
        if (p) dest = p;
      }
      return { dest, isDefault, nh: (r.nh || '').trim(), raw: d };
    });

    function isConnText(t) { return /^(dir|conness|direct|attach)/i.test(t); }

    // punti di test: 6 sottoreti + spazio libero + esterno
    const testPoints = NETS.map(n => {
      const us = userSub[n] || ex.sol.subnets[n];
      return { name: n, ip: us.net + 1 };
    });
    // spazio libero: primo gap non coperto dalle sottoreti dell'utente
    const covered = NETS.map(n => userSub[n]).filter(Boolean).sort((a, b) => a.net - b.net);
    let gap = null; let cur = ex.start;
    for (const c of covered) {
      if (c.net > cur) { gap = cur; break; }
      cur = Math.max(cur, c.net + c.size);
    }
    if (!gap && cur < ex.start + ex.blockSize) gap = cur;
    if (gap !== null) testPoints.push({ name: 'spazio libero', ip: gap });
    testPoints.push({ name: 'Internet (indirizzo esterno)', ip: U.ip2int('8.8.8.8') });

    const rowUsed = new Array(rows.length).fill(false);
    testPoints.forEach(tp => {
      total++; // un punto per ogni destinazione raggiungibile correttamente
      // riga vincente: prefisso più lungo che copre il punto
      let winner = null;
      rows.forEach((r, i) => {
        if (!r.dest) return;
        const sz = Math.pow(2, 32 - r.dest.n);
        if (tp.ip >= r.dest.ip && tp.ip < r.dest.ip + sz) {
          if (winner === null || r.dest.n > rows[winner].dest.n) winner = i;
        }
      });
      const isSubnet = NETS.includes(tp.name);
      const ownerRouters = isSubnet ? ownersOf(tp.name) : null;
      const connected = isSubnet && ownerRouters.includes(X);

      if (winner === null) {
        const neigh = connected ? 'segna la rete come direttamente connessa' : `aggiungi una riga o lascia che la default la copra (next-hop verso R1)`;
        marks.routeTests.push({ name: tp.name, ok: false, msg: `nessuna rotta copre ${tp.name}${isSubnet ? ` (${U.fmtPrefix((userSub[tp.name] || ex.sol.subnets[tp.name]).net, ex.expPrefix[tp.name])})` : ''}: ${neigh}` });
        return;
      }
      rowUsed[winner] = true;
      const w = rows[winner];
      if (connected) {
        const ok = isConnText(w.nh);
        marks.routeTests.push({
          name: tp.name, ok,
          msg: ok ? `${tp.name} è direttamente connessa a ${X}` : `${tp.name} è direttamente connessa a ${X}: il next-hop si scrive "direttamente connessa", non un IP`
        });
        if (ok) correct++;
        return;
      }
      // vicini ammessi (cammino minimo; pareggio = entrambi)
      let best = Infinity, allowed = [];
      const targets = ownerRouters || ['R1'];
      neighbors(X).forEach(N => {
        const c = 1 + Math.min(...targets.map(t => hopDist(N, t)));
        if (c < best) { best = c; allowed = [N]; }
        else if (c === best) allowed.push(N);
      });
      const expectedIPs = allowed.map(N => ({ N, ip: refIface(N, sharedLink(X, N)) }));
      const nhIp = U.ip2int(w.nh);
      const ok = nhIp !== null && expectedIPs.some(e => e.ip === nhIp);
      marks.routeTests.push({
        name: tp.name, ok,
        msg: ok
          ? `${tp.name}: next-hop valido verso ${expectedIPs.find(e => e.ip === nhIp).N}`
          : `per ${tp.name} il vicino giusto è ${allowed.join(' o ')}: next-hop = IP del vicino sul link condiviso (${expectedIPs.map(e => U.int2ip(e.ip) + ' (' + e.N + ')').join(' oppure ')})`
      });
      if (ok) correct++;
    });
    // conteggio righe valide
    // valutazione delle righe: solo note diagnostiche; il punteggio viene dai punti di test
    rows.forEach((r, i) => {
      const okParse = r.dest !== null;
      if (r.raw === '') { marks.routes.push({ ok: true, msg: null, empty: true }); return; }
      if (!okParse) marks.routes.push({ ok: false, msg: `destinazione "${r.raw}" non è in forma indirizzo/prefisso (o "0.0.0.0/0" per la default)` });
      else if (rowUsed[i]) marks.routes.push({ ok: true, msg: null });
      else marks.routes.push({ ok: true, msg: 'riga assorbita: non serve per nessuna destinazione (all\'esame aggrega il più possibile)', unused: true });
      if (marks.routes[i] && marks.routes[i].unused) {
        marks.notes.push(`la riga per ${r.raw} è assorbita da una rotta più generale: si può eliminare ("aggregando il più possibile")`);
      }
    });

    // ---- (iii) forzatura percorso ----
    total += 1;
    const q3 = answers.q3 || '';
    const cov = U.kwCoverage(q3, [
      ['costo', 'metrica', 'amministrar'],
      ['static'],
      ['policy', 'sorgente', 'regola'],
      ['ritorno', 'asimmetric', 'inverso']
    ]);
    marks.q3 = { ok: cov.found >= 2, cov };
    correct += Math.min(1, cov.found / 3);

    return { correct, total, marks };
  }

  function sol2answers(ex) {
    const S = ex.sol;
    const subnets = {};
    NETS.forEach(n => {
      const s = S.subnets[n];
      subnets[n] = {
        pf: U.fmtPrefix(s.net, s.prefix), mask: s.mask,
        first: U.int2ip(s.first), last: U.int2ip(s.last), bcast: U.int2ip(s.bcast)
      };
    });
    const iface = {
      R1: { LAN: U.int2ip(S.iface.R1.LAN), Link_1: U.int2ip(S.iface.R1.Link_1), Link_2: '', Link_3: U.int2ip(S.iface.R1.Link_3) },
      R2: { LAN: U.int2ip(S.iface.R2.LAN), Link_1: U.int2ip(S.iface.R2.Link_1), Link_2: U.int2ip(S.iface.R2.Link_2), Link_3: '' },
      R3: { LAN: U.int2ip(S.iface.R3.LAN), Link_1: '', Link_2: U.int2ip(S.iface.R3.Link_2), Link_3: U.int2ip(S.iface.R3.Link_3) }
    };
    // routing minimo del router richiesto
    const X = ex.askedRouter;
    const routes = [];
    // direttamente connesse
    routes.push({ dest: U.fmtPrefix(S.subnets[ROUTER_LAN[X]].net, S.subnets[ROUTER_LAN[X]].prefix), nh: 'direttamente connessa' });
    ROUTER_LINKS[X].forEach(L => routes.push({ dest: U.fmtPrefix(S.subnets[L].net, S.subnets[L].prefix), nh: 'direttamente connessa' }));
    // rete remota via l'altro vicino (non R1 se X≠R1)
    const otherNeighbor = neighbors(X).find(N => N !== 'R1');
    const remoteLan = ROUTER_LAN[otherNeighbor];
    routes.push({ dest: U.fmtPrefix(S.subnets[remoteLan].net, S.subnets[remoteLan].prefix), nh: U.int2ip(S.iface[otherNeighbor][sharedLink(X, otherNeighbor)]) });
    // default verso R1 (assorbe l'altra LAN, il link verso R1 e Internet)
    routes.push({ dest: '0.0.0.0/0', nh: U.int2ip(S.iface.R1[sharedLink(X, 'R1')]) });
    return { subnets, iface, routes, q3: 'Tre leve: (1) aumentare il costo di Link sopra la somma degli altri due, così il protocollo di routing preferisce il percorso più lungo; (2) rotta statica più mirata con distanza amministrativa più bassa; (3) policy-based routing sulla sorgente. Nota che il traffico di ritorno continuerà per la vecchia strada (percorso asimmetrico) se non si configura anche il router opposto.' };
  }

  // ---------------- RENDERING ----------------
  function svgTopology(ex) {
    return `<svg viewBox="0 0 520 350" class="fig">
      <ellipse cx="260" cy="26" rx="66" ry="22" class="cloud"/>
      <text x="260" y="30" text-anchor="middle" class="lbl">INTERNET</text>
      <line x1="260" y1="48" x2="260" y2="66" class="link"/>
      <rect x="30" y="52" width="110" height="34" rx="4" class="box"/>
      <text x="85" y="66" text-anchor="middle" class="lbl">Net_A</text>
      <text x="85" y="79" text-anchor="middle" class="lbl small">${ex.hosts.Net_A} host</text>
      <line x1="140" y1="80" x2="244" y2="98" class="link"/>
      <circle cx="260" cy="105" r="16" class="router"/><text x="260" y="110" text-anchor="middle" class="lbl">R1</text>
      <circle cx="115" cy="215" r="16" class="router"/><text x="115" y="220" text-anchor="middle" class="lbl">R2</text>
      <circle cx="405" cy="215" r="16" class="router"/><text x="405" y="220" text-anchor="middle" class="lbl">R3</text>
      <line x1="272" y1="115" x2="127" y2="205" class="link"/>
      <text x="175" y="150" class="lbl small">Link_1</text>
      <line x1="131" y1="215" x2="389" y2="215" class="link"/>
      <text x="260" y="208" text-anchor="middle" class="lbl small">Link_2</text>
      <line x1="272" y1="115" x2="393" y2="205" class="link"/>
      <text x="345" y="150" class="lbl small">Link_3</text>
      <line x1="115" y1="231" x2="115" y2="285" class="link"/>
      <rect x="55" y="285" width="120" height="34" rx="4" class="box"/>
      <text x="115" y="299" text-anchor="middle" class="lbl">Net_B</text>
      <text x="115" y="312" text-anchor="middle" class="lbl small">${ex.hosts.Net_B} host</text>
      <line x1="405" y1="231" x2="405" y2="285" class="link"/>
      <rect x="345" y="285" width="120" height="34" rx="4" class="box"/>
      <text x="405" y="299" text-anchor="middle" class="lbl">Net_C</text>
      <text x="405" y="312" text-anchor="middle" class="lbl small">${ex.hosts.Net_C} host</text>
    </svg>`;
  }

  function render(ex, root, state) {
    state.fields = { subnets: {}, iface: {}, routes: [], q3: null };
    root.appendChild(U.h('div', { class: 'card intro' },
      U.h('div', { html: svgTopology(ex) }),
      U.h('p', { class: 'small' },
        `Alla tua organizzazione è assegnato lo spazio ${U.fmtPrefix(ex.start, ex.prefix)} (da ${U.int2ip(ex.start)} a ${U.int2ip(ex.start + ex.blockSize - 1)}). R1 è collegato a Internet; l'indirizzo su quel lato lo assegna il provider e non fa parte dello spazio. Subnetta lo spazio per le 3 LAN e i 3 link.`)));

    // (i) tabella sottoreti
    const t1 = U.h('table', { class: 'grid' },
      U.h('tr', {}, ['Sottorete', 'Rete / prefisso', 'Maschera', 'Primo utile', 'Ultimo utile', 'Broadcast'].map(x => U.h('th', {}, x))));
    NETS.forEach(n => {
      const f = {};
      state.fields.subnets[n] = f;
      const label = n.startsWith('Net') ? `${n} (${ex.hosts[n]} host)` : `${n} (${LINK_ROUTERS[n].join('–')})`;
      const tr = U.h('tr', {}, U.h('td', { class: 'lbl-td' }, label));
      ['pf', 'mask', 'first', 'last', 'bcast'].forEach(k => {
        const inp = U.h('input', { class: 'cell', type: 'text' });
        f[k] = inp;
        tr.appendChild(U.h('td', {}, inp));
      });
      t1.appendChild(tr);
    });
    root.appendChild(U.h('div', { class: 'card' },
      U.h('h4', {}, 'i. Schema di indirizzamento'), t1,
      U.h('p', { class: 'small' }, 'Suggerimento d\'ordine: assegna i blocchi dal più grande al più piccolo, partendo dall\'inizio dello spazio.')));

    // (i-bis) interfacce
    const t2 = U.h('table', { class: 'grid' },
      U.h('tr', {}, ['Router', 'Interfaccia su LAN', 'Su Link_1', 'Su Link_2', 'Su Link_3'].map(x => U.h('th', {}, x))));
    ['R1', 'R2', 'R3'].forEach(R => {
      state.fields.iface[R] = {};
      const tr = U.h('tr', {}, U.h('td', { class: 'lbl-td' }, `${R} (LAN: ${ROUTER_LAN[R]})`));
      const cells = { LAN: true, Link_1: ROUTER_LINKS[R].includes('Link_1'), Link_2: ROUTER_LINKS[R].includes('Link_2'), Link_3: ROUTER_LINKS[R].includes('Link_3') };
      ['LAN', 'Link_1', 'Link_2', 'Link_3'].forEach(k => {
        if (cells[k]) {
          const inp = U.h('input', { class: 'cell', type: 'text' });
          state.fields.iface[R][k] = inp;
          tr.appendChild(U.h('td', {}, inp));
        } else {
          state.fields.iface[R][k] = null;
          tr.appendChild(U.h('td', { class: 'given' }, '—'));
        }
      });
      t2.appendChild(tr);
    });
    root.appendChild(U.h('div', { class: 'card' }, U.h('h4', {}, '… e indirizzi IP delle interfacce dei router'), t2));

    // (ii) tabella di routing
    const card3 = U.h('div', { class: 'card' },
      U.h('h4', {}, `ii. Tabella di routing di ${ex.askedRouter} (costi dei 3 link uguali; aggrega il più possibile)`));
    const t3 = U.h('table', { class: 'grid' },
      U.h('tr', {}, U.h('th', {}, 'Destinazione'), U.h('th', {}, 'Next-hop'), U.h('th', { class: 'th-mini' }, '')));
    function addRouteRow() {
      const f = { dest: U.h('input', { class: 'cell wide', type: 'text', placeholder: 'es. 200.x.y.0/26 o 0.0.0.0/0' }),
                  nh: U.h('input', { class: 'cell wide', type: 'text', placeholder: 'IP del vicino o "direttamente connessa"' }) };
      const tr = U.h('tr', {}, U.h('td', {}, f.dest), U.h('td', {}, f.nh));
      const rowObj = { fields: f, tr };
      tr.appendChild(U.h('td', {}, U.h('button', { class: 'mini', text: '✕', onclick: () => {
        state.fields.routes.splice(state.fields.routes.indexOf(rowObj), 1);
        tr.remove();
      } })));
      state.fields.routes.push(rowObj);
      t3.appendChild(tr);
    }
    for (let i = 0; i < 7; i++) addRouteRow();
    card3.appendChild(t3);
    card3.appendChild(U.h('button', { class: 'btn ghost', text: '+ aggiungi riga', onclick: addRouteRow }));
    root.appendChild(card3);

    // (iii) forzatura
    const ta = U.h('textarea', { class: 'cell ta', rows: '4' });
    state.fields.q3 = ta;
    root.appendChild(U.h('div', { class: 'card' },
      U.h('h4', {}, `iii. L'organizzazione vuole che il traffico ${ex.q3.traffic} passi per ${ex.q3.via}`),
      U.h('p', { class: 'small' }, `Oggi quel traffico farebbe ${ex.q3.normally}. Come si può forzare il percorso ${ex.q3.forced} senza eliminare link?`),
      ta,
      U.h('p', { class: 'chat-tip small' }, '💡 Domanda aperta: incolla qui la tua risposta in chat e te la correggo con i motivi dei punti persi.')));
  }

  function check(ex, root, state, explain) {
    U.resetFb(root);
    const answers = { subnets: {}, iface: {}, routes: state.fields.routes.map(r => ({ dest: r.fields.dest.value, nh: r.fields.nh.value })), q3: state.fields.q3.value };
    NETS.forEach(n => {
      const f = state.fields.subnets[n];
      answers.subnets[n] = { pf: f.pf.value, mask: f.mask.value, first: f.first.value, last: f.last.value, bcast: f.bcast.value };
    });
    ['R1', 'R2', 'R3'].forEach(R => {
      answers.iface[R] = {};
      ['LAN', 'Link_1', 'Link_2', 'Link_3'].forEach(k => {
        answers.iface[R][k] = state.fields.iface[R][k] ? state.fields.iface[R][k].value : '';
      });
    });
    const res = grade(ex, answers);
    const M = res.marks;

    NETs_fb: {
      NETS.forEach(n => {
        const m = M.subnets[n]; const f = state.fields.subnets[n];
        const pfParse = U.parsePrefix(answers.subnets[n].pf);
        U.fb(f.pf, pfParse !== null && m.n && m.n.ok && m.net.ok,
          pfParse === null ? (explain ? m.pf.msg : '✗') : (explain ? (m.n.ok ? m.net.msg : m.n.msg) : '✗'));
        U.fb(f.mask, m.mask.ok, m.mask.ok ? null : (explain ? m.mask.msg : '✗'));
        U.fb(f.first, m.first.ok, m.first.ok ? null : (explain ? m.first.msg : '✗'));
        U.fb(f.last, m.last.ok, m.last.ok ? null : (explain ? m.last.msg : '✗'));
        U.fb(f.bcast, m.bcast.ok, m.bcast.ok ? null : (explain ? m.bcast.msg : '✗'));
      });
    }
    ['R1', 'R2', 'R3'].forEach(R => {
      const m = M.iface[R];
      U.fb(state.fields.iface[R].LAN, m.LAN.ok, m.LAN.ok ? null : (explain ? m.LAN.msg : '✗'));
      ROUTER_LINKS[R].forEach(L => U.fb(state.fields.iface[R][L], m[L].ok, m[L].ok ? null : (explain ? m[L].msg : '✗')));
    });

    // riepilogo routing
    let rt = root.querySelector('.route-summary');
    if (rt) rt.remove();
    rt = U.h('div', { class: 'flow-summary card' }, U.h('h4', {}, `Verifica della tabella di ${ex.askedRouter}`));
    M.routeTests.forEach(t => {
      rt.appendChild(U.h('div', { class: 'flow-line ' + (t.ok ? 'ok-line' : 'err-line') },
        U.h('span', { class: 'flow-badge' }, t.ok ? '✓' : '✗'),
        U.h('span', {}, `${t.name}${!t.ok && explain ? ' — ' + t.msg : ''}`)));
    });
    M.notes.forEach(n => rt.appendChild(U.h('div', { class: 'flow-line warn-line' }, U.h('span', { class: 'flow-badge' }, '⚠'), U.h('span', {}, n))));
    root.insertBefore(rt, state.fields.q3.closest('.card'));

    const mq = M.q3;
    U.fb(state.fields.q3, mq.ok, mq.ok ? null :
      (explain ? `Punti chiave citati: ${mq.cov.found}/4. La risposta completa cita almeno due delle tre leve (aumentare il costo del link, rotta statica, policy-based routing) e idealmente accenna al traffico di ritorno.` : '✗'));
    return res;
  }

  function solution(ex, root) {
    const a = sol2answers(ex);
    root.appendChild(U.h('div', { class: 'card sol' },
      U.h('h4', {}, 'Soluzione'),
      U.h('p', { class: 'small' }, `Calcolo dei blocchi: ${NETS.filter(n => n.startsWith('Net')).map(n => `${n}: ${ex.hosts[n]} host + router + rete/broadcast = ${ex.need[n]} → blocco ${ex.size[n]} (/${ex.expPrefix[n]})`).join(' · ')} · Link: 4 indirizzi → /30. Totale ${Object.values(ex.size).reduce((x, y) => x + y, 0)} su ${ex.blockSize} disponibili.`),
      U.h('table', { class: 'data' },
        U.h('tr', {}, ['Sottorete', 'Rete', 'Maschera', 'Range utile', 'Broadcast'].map(x => U.h('th', {}, x))),
        NETS.map(n => {
          const s = ex.sol.subnets[n];
          return U.h('tr', {},
            U.h('td', {}, n),
            U.h('td', {}, U.fmtPrefix(s.net, s.prefix)),
            U.h('td', {}, s.mask),
            U.h('td', {}, `${U.int2ip(s.first)} – ${U.int2ip(s.last)}`),
            U.h('td', {}, U.int2ip(s.bcast)));
        })),
      U.h('table', { class: 'data', style: 'margin-top:10px' },
        U.h('tr', {}, ['Router', 'Su LAN', 'Link_1', 'Link_2', 'Link_3'].map(x => U.h('th', {}, x))),
        ['R1', 'R2', 'R3'].map(R => U.h('tr', {},
          U.h('td', {}, R),
          U.h('td', {}, U.int2ip(ex.sol.iface[R].LAN)),
          ...['Link_1', 'Link_2', 'Link_3'].map(L => U.h('td', {}, ROUTER_LINKS[R].includes(L) ? U.int2ip(ex.sol.iface[R][L]) : '—'))))),
      U.h('table', { class: 'data', style: 'margin-top:10px' },
        U.h('tr', {}, ['Destinazione (tabella di ' + ex.askedRouter + ')', 'Next-hop'].map(x => U.h('th', {}, x))),
        a.routes.map(r => U.h('tr', {}, U.h('td', {}, r.dest), U.h('td', {}, r.nh)))),
      U.h('p', { class: 'sol-body' },
        U.h('b', {}, 'iii. '), `Tre leve: (1) aumentare il costo di ${ex.askedRouter === 'R2' ? 'Link_1 sopra la somma di Link_2 + Link_3' : 'Link_2 sopra la somma di Link_3 + Link_1'} (es. 3 contro 1+1): il routing preferisce ${ex.q3.forced}, ma tutto il traffico tra i due router seguirà quella strada e il link resta come backup. (2) Rotta statica su ${ex.askedRouter} per la rete di destinazione con next-hop ${ex.q3.via}: più mirata, prevale sulle rotte dinamiche. (3) Policy-based routing: "se sorgente ∈ ${ex.q3.traffic.split(' ')[1]} e destinazione ∈ ${ex.q3.traffic.split(' ')[3]} → inoltra a ${ex.q3.via}". Nota il traffico di ritorno: resterà sul percorso diretto (percorso asimmetrico) a meno di configurare anche il router opposto.`)));
  }

  function hints(ex) {
    const H = [
      `Passo 1: quanta spazio hai? ${U.fmtPrefix(ex.start, ex.prefix)} → ${32 - ex.prefix} bit host → ${ex.blockSize} indirizzi (${U.int2ip(ex.start)} – ${U.int2ip(ex.start + ex.blockSize - 1)}).`,
      'Passo 2: per ogni LAN conta host + 1 (interfaccia del router!) + 2 (rete e broadcast). Per ogni link: 2 + 2 = 4. Arrotonda alla potenza di 2 superiore. È l\'errore più frequente: dimenticare il +1 del router.',
      'Passo 3: assegna i blocchi dal più grande al più piccolo, uno dopo l\'altro dall\'inizio dello spazio. Così ogni blocco è automaticamente allineato (un blocco di dimensione 2^k può partire solo da un multiplo di 2^k).',
      'Passo 4: broadcast = rete + dimensione − 1; primo utile = rete + 1; ultimo = broadcast − 1. Maschera: nell\'ottetto del confine vale 256 − dimensione del blocco.',
      `Passo 5 (tabella di ${ex.askedRouter}): tutte le direttamente connesse; per le remote il next-hop è l'IP del router vicino SUL LINK CONDIVISO (non un IP qualsiasi del vicino); Internet e tutto ciò che va verso R1 si assorbono nella default verso R1.`,
      'Passo 6 (aggregazione): se una rete remota ha lo stesso next-hop della default, la riga è inutile. Segnala eventuali pareggi (due cammini a costo uguale): puoi scrivere uno dei due o entrambi.'
    ];
    return H;
  }

  // ---- testo per la correzione in chat ----
  function chatText(ex, state) {
    const lines = [];
    lines.push(`#1 · Indirizzamento IP e routing (livello ${ex.level})`);
    lines.push('## Testo');
    lines.push(`Spazio assegnato all'organizzazione: ${U.fmtPrefix(ex.start, ex.prefix)} (da ${U.int2ip(ex.start)} a ${U.int2ip(ex.start + ex.blockSize - 1)}).`);
    lines.push(`Topologia: R1 è il router di bordo (verso Internet) con la LAN Net_A (${ex.hosts.Net_A} host); R2 con Net_B (${ex.hosts.Net_B} host); R3 con Net_C (${ex.hosts.Net_C} host). Link punto-punto: Link_1 (R1–R2), Link_2 (R2–R3), Link_3 (R1–R3), costi tutti uguali.`);
    lines.push('i) Schema di indirizzamento: per ogni sottorete indicare rete/prefisso, maschera, range di indirizzi utili, broadcast; e gli IP delle interfacce dei router.');
    lines.push(`ii) Tabella di routing di ${ex.askedRouter} (destinazione/next-hop), aggregando il più possibile.`);
    lines.push(`iii) Forzare che il traffico ${ex.q3.traffic} passi per ${ex.q3.via}, senza eliminare link.`);
    lines.push('');
    lines.push('## Le mie risposte');
    lines.push('(i) Sottoreti:');
    NETS.forEach(n => {
      const f = state.fields.subnets[n];
      const label = n.startsWith('Net') ? `${n} (${ex.hosts[n]} host)` : `${n} (${LINK_ROUTERS[n].join('–')})`;
      lines.push(`- ${label}: ${f.pf.value || '__'} | maschera ${f.mask.value || '__'} | range ${f.first.value || '__'} – ${f.last.value || '__'} | broadcast ${f.bcast.value || '__'}`);
    });
    lines.push('(i-bis) Interfacce dei router:');
    ['R1', 'R2', 'R3'].forEach(R => {
      const parts = [`LAN ${ROUTER_LAN[R]}: ${state.fields.iface[R].LAN ? (state.fields.iface[R].LAN.value || '__') : '—'}`];
      ['Link_1', 'Link_2', 'Link_3'].forEach(L => {
        parts.push(state.fields.iface[R][L] ? `${L}: ${state.fields.iface[R][L].value || '__'}` : `${L}: —`);
      });
      lines.push(`- ${R} → ${parts.join(', ')}`);
    });
    lines.push(`(ii) Tabella di routing di ${ex.askedRouter}:`);
    const routeRows = state.fields.routes.filter(r => r.fields.dest.value.trim() !== '' || r.fields.nh.value.trim() !== '');
    if (!routeRows.length) lines.push('- (nessuna riga compilata)');
    else routeRows.forEach(r => lines.push(`- ${r.fields.dest.value || '__'} → ${r.fields.nh.value || '__'}`));
    lines.push(`(iii) ${state.fields.q3.value.trim() || '(non ancora scritta)'}`);
    return lines.join('\n');
  }

  RA.vlsm = {
    id: 'vlsm', num: '1', name: 'Indirizzamento IP e routing',
    desc: 'VLSM, interfacce, tabella di routing con aggregazione, forzatura percorso.',
    examPoints: 10, gen, grade, sol2answers, render, check, solution, hints, chatText
  };
})();
