// ============================================================
// RetiApp · gen-subnet.js — Seconda parte · Esercizio 2 · Connettività e subnet mask
// Due host collegati da un cavo non si vedono: perché, quale IP dare a B,
// quale maschera (cambiando il minor numero di bit) li mette nella stessa rete.
// Contratto dei moduli: vedi docs/moduli.md
// ============================================================
(function () {
  const RA = window.RetiApp;
  const U = RA.util;

  const WHY = [
    ['diff', 'Applicando la maschera, A e B risultano in due reti diverse: ciascuno manderebbe il pacchetto al gateway, che non c\'è'],
    ['cable', 'Un cavo diretto tra due host non basta: serve sempre uno switch in mezzo'],
    ['mask', 'Le due maschere sono uguali: con maschere uguali due host non possono comunicare'],
    ['bcast', 'Uno dei due indirizzi è l\'indirizzo di broadcast della propria rete']
  ];
  const WHY_ERR = {
    cable: 'Il cavo non è il problema: le schede di rete moderne (Auto MDI-X) funzionano anche collegate direttamente. Il problema è di livello 3: le reti calcolate con la maschera sono diverse.',
    mask: 'Avere maschere uguali è normale (anzi, necessario in una LAN). Il problema è che, con quella maschera, gli indirizzi cadono in due blocchi diversi.',
    bcast: 'Controlla: nessuno dei due è il broadcast del proprio blocco. Il problema è che i blocchi sono diversi.'
  };

  // ---------------- helper ----------------
  const blockOf = (ip, n) => (ip & U.maskOf(n)) >>> 0;
  const bcastOf = (ip, n) => (blockOf(ip, n) + Math.pow(2, 32 - n) - 1) >>> 0;
  const validHost = (ip, n) => ip !== blockOf(ip, n) && ip !== bcastOf(ip, n);
  function bestPrefix(a, b, n) {
    for (let p = n; p >= 1; p--) if (blockOf(a, p) === blockOf(b, p) && validHost(a, p) && validHost(b, p)) return p;
    return null;
  }
  const bin8 = x => x.toString(2).padStart(8, '0');
  // ottetto "interessante": quello in cui cade il confine della maschera
  const octIdx = n => Math.min(3, Math.floor((n - 1) / 8));
  const octet = (ip, i) => (ip >>> (24 - 8 * i)) & 255;
  function binIp(ip, n) {
    const i = octIdx(n);
    return [0, 1, 2, 3].map(j => j === i ? bin8(octet(ip, j)) : String(octet(ip, j))).join('.');
  }
  function parseMask(v) {
    const s = String(v == null ? '' : v).trim();
    let m = /^\/?\s*(\d{1,2})$/.exec(s);
    if (m) { const n = Number(m[1]); return n >= 0 && n <= 32 ? n : null; }
    const x = U.ip2int(s);
    if (x === null) return null;
    for (let n = 0; n <= 32; n++) if (U.maskOf(n) === x) return n;
    return null;
  }

  // ---------------- parametri e costruzione ----------------
  function randomParams(level) {
    for (let t = 0; t < 500; t++) {
      let n, base;
      if (level <= 2) { n = U.pick([28, 29, 29, 30]); }
      else if (level === 3) { n = U.rndInt(26, 30); }
      else if (level === 4) { n = U.pick([24, 25, 26, 27, 28]); }
      else { n = U.pick([20, 21, 22, 23, 24]); }
      const first = level <= 3 ? U.pick([192, 172, 10, 200, 150]) : U.pick([10, 172, 192]);
      const o2 = first === 192 ? 168 : first === 172 ? U.rndInt(16, 31) : U.rndInt(0, 254);
      base = (((first << 24) | (o2 << 16) | (U.rndInt(0, 254) << 8)) >>> 0);
      const size = Math.pow(2, 32 - n);
      // A in un blocco, B in un blocco vicino (1 bit a L1-2, fino a 3 bit dopo)
      const dist = level <= 2 ? 1 : U.rndInt(1, level >= 5 ? 3 : 2);
      const span = size * Math.pow(2, dist);
      const sup = (base & U.maskOf(n - dist)) >>> 0;
      const blocks = [];
      for (let k = 0; k < span / size; k++) blocks.push(sup + k * size);
      const bA = U.pick(blocks);
      const bB = U.pick(blocks.filter(x => x !== bA));
      const a = bA + U.rndInt(1, size - 2), b = bB + U.rndInt(1, size - 2);
      if (n >= 30 && size < 4) continue;
      const p = bestPrefix(a, b, n);
      if (p === null || p >= n) continue;
      if (n - p !== dist) continue;
      if (n - p > 4) continue;
      return { level, a: U.int2ip(a), b: U.int2ip(b), n, ipBModel: null };
    }
    return { level, a: '192.150.181.198', b: '192.150.181.206', n: 29, ipBModel: null };
  }

  function build(p) {
    const a = U.ip2int(p.a), b = U.ip2int(p.b), n = Number(p.n);
    const netA = blockOf(a, n), netB = blockOf(b, n);
    const size = Math.pow(2, 32 - n);
    const best = bestPrefix(a, b, n);
    const first = netA + 1, last = netA + size - 2;
    let model = p.ipBModel ? U.ip2int(p.ipBModel) : (first === a ? first + 1 : first);
    const lv = p.level;
    // prefisso comune più lungo (senza il controllo rete/broadcast), per spiegare la trappola
    let common = n; while (common > 0 && blockOf(a, common) !== blockOf(b, common)) common--;
    return {
      cat: 'subnet', level: lv, params: p,
      a: p.a, b: p.b, n, mask: U.fmtMask(n),
      netA: U.int2ip(netA), netB: U.int2ip(netB), bcA: U.int2ip(bcastOf(a, n)), bcB: U.int2ip(bcastOf(b, n)),
      first: U.int2ip(first), last: U.int2ip(last), size,
      ipB: U.int2ip(model),
      best, bestMask: U.fmtMask(best), bits: n - best, common,
      hosts: Math.pow(2, 32 - best) - 2,
      askRange: lv >= 3, askMask: lv >= 2, askHosts: lv >= 4,
      oct: octIdx(n)
    };
  }
  const gen = level => build(randomParams(level));

  // ---------------- passi ----------------
  function keys(ex) {
    return {
      why: ['netA', 'netB', 'why'],
      ip: (ex.askRange ? ['first', 'last'] : []).concat(['ipB']),
      mask: ex.askMask ? ['mask', 'bits'].concat(ex.askHosts ? ['hosts'] : []) : []
    };
  }
  function steps(ex) {
    const K = keys(ex);
    const s = [
      { id: 'why', title: 'Perché non c\'è connettività', keys: K.why },
      { id: 'ip', title: 'Nuovo IP per B', keys: K.ip }
    ];
    if (K.mask.length) s.push({ id: 'mask', title: 'Nuova maschera', keys: K.mask });
    return s;
  }

  // ---------------- correzione ----------------
  const ipOk = (v, sol) => { const x = U.ip2int(v); return x !== null && x === U.ip2int(sol); };
  function ipBCheck(ex, v) {
    const x = U.ip2int(v);
    if (x === null) return { ok: false, why: 'Non è un indirizzo IP valido.' };
    const netA = U.ip2int(ex.netA);
    if (blockOf(x, ex.n) !== netA) return { ok: false, why: `${v} non sta nel blocco di A (${ex.netA}/${ex.n}, da ${ex.first} a ${ex.last}).` };
    if (x === netA) return { ok: false, why: `${v} è l'indirizzo di rete del blocco: non si assegna a un host.` };
    if (x === U.ip2int(ex.bcA)) return { ok: false, why: `${v} è l'indirizzo di broadcast del blocco: non si assegna a un host.` };
    if (x === U.ip2int(ex.a)) return { ok: false, why: `${v} è già l'indirizzo di A: due host con lo stesso IP vanno in conflitto.` };
    return { ok: true };
  }
  function grade(ex, a) {
    const marks = {};
    let correct = 0, total = 0;
    const put = (k, ok, msg) => { total++; if (ok) correct++; marks[k] = { ok, msg }; };
    put('netA', ipOk(a.netA, ex.netA), `Rete di A = ${ex.a} AND ${ex.mask} = ${ex.netA} (blocco di ${ex.size} indirizzi).`);
    put('netB', ipOk(a.netB, ex.netB), `Rete di B = ${ex.b} AND ${ex.mask} = ${ex.netB}.`);
    put('why', String(a.why || '') === 'diff', `Le reti sono diverse (${ex.netA} ≠ ${ex.netB}): ciascun host considera l'altro "fuori rete" e cercherebbe di passare dal gateway, che non esiste.`);
    if (ex.askRange) {
      put('first', ipOk(a.first, ex.first), `Primo indirizzo utilizzabile = rete + 1 = ${ex.first}.`);
      put('last', ipOk(a.last, ex.last), `Ultimo utilizzabile = broadcast − 1 = ${ex.last} (broadcast ${ex.bcA}).`);
    }
    const c = ipBCheck(ex, a.ipB);
    put('ipB', c.ok, `Qualunque indirizzo da ${ex.first} a ${ex.last} diverso da ${ex.a} (es. ${ex.ipB}).`);
    if (ex.askMask) {
      put('mask', parseMask(a.mask) === ex.best, `Maschera ${ex.bestMask} (/${ex.best}): ${ex.bits} bit in meno, il minimo perché A e B finiscano nello stesso blocco come indirizzi di host validi.`);
      put('bits', U.numEq(a.bits, ex.bits), `${ex.n} − ${ex.best} = ${ex.bits} bit spostati da rete a host.`);
      if (ex.askHosts) put('hosts', U.numEq(a.hosts, ex.hosts), `2^(32 − ${ex.best}) − 2 = ${ex.hosts} host.`);
    }
    return { correct, total, marks };
  }
  function sol2answers(ex) {
    const s = { netA: ex.netA, netB: ex.netB, why: 'diff', ipB: ex.ipB };
    if (ex.askRange) { s.first = ex.first; s.last = ex.last; }
    if (ex.askMask) { s.mask = ex.bestMask; s.bits = String(ex.bits); if (ex.askHosts) s.hosts = String(ex.hosts); }
    return s;
  }

  // ---------------- errori tipici ----------------
  function diagnose(ex, key, value) {
    const v = String(value == null ? '' : value).trim();
    if (!v) return null;
    if (key === 'why') return v === 'diff' ? null : WHY_ERR[v] || null;
    if (key === 'netA' || key === 'netB') {
      const ip = key === 'netA' ? ex.a : ex.b;
      if (ipOk(v, ip)) return 'Questo è l\'indirizzo dell\'host: l\'indirizzo di rete si ottiene con l\'AND bit a bit tra IP e maschera (gli host bit vanno a 0).';
      if (ipOk(v, key === 'netA' ? ex.bcA : ex.bcB)) return 'Questo è il broadcast (host bit a 1): l\'indirizzo di rete ha gli host bit a 0.';
      if (ipOk(v, key === 'netA' ? ex.netB : ex.netA)) return 'Hai scambiato A e B.';
      return null;
    }
    if (key === 'ipB') { const c = ipBCheck(ex, v); return c.ok ? null : c.why; }
    if (key === 'first' && ipOk(v, ex.netA)) return 'L\'indirizzo di rete non è utilizzabile: il primo host è rete + 1.';
    if (key === 'last' && ipOk(v, ex.bcA)) return 'Il broadcast non è utilizzabile: l\'ultimo host è broadcast − 1.';
    if (key === 'mask') {
      const m = parseMask(v);
      if (m === null) return 'Scrivi la maschera in decimale puntato (es. 255.255.255.240) o come prefisso (/28).';
      if (m > ex.n) return 'Allungando la maschera le reti si stringono: A e B resterebbero separati. Bisogna accorciarla (spostare bit da rete a host).';
      if (m === ex.common && ex.common !== ex.best) return `Con /${m} A e B sono nello stesso blocco, ma uno dei due diventa l'indirizzo di rete o di broadcast: serve un bit in più per gli host (/${ex.best}).`;
      if (m < ex.best) return `Funziona, ma non è il minimo: basta /${ex.best} (${ex.bits} bit), tu ne hai tolti ${ex.n - m}.`;
      if (m > ex.best && m < ex.n) return `Con /${m} A e B sono ancora in blocchi diversi: confronta i bit dell'ottetto interessante finché diventano uguali.`;
      return null;
    }
    if (key === 'bits' && U.numEq(v, ex.best)) return 'Questo è il nuovo prefisso: la domanda chiede di quanti bit lo hai accorciato.';
    if (key === 'hosts' && U.numEq(v, ex.hosts + 2)) return 'Togli rete e broadcast: 2^h − 2.';
    return null;
  }
  function diagnoseCases(ex) {
    const out = [
      { key: 'netA', value: ex.a, expect: 'AND' },
      { key: 'why', value: 'cable', expect: 'Auto MDI-X' },
      { key: 'ipB', value: ex.netA, expect: 'indirizzo di rete' },
      { key: 'ipB', value: ex.a, expect: 'conflitto' }
    ];
    if (ex.askMask) {
      out.push({ key: 'mask', value: '/' + Math.min(32, ex.n + 1), expect: 'accorciarla' });
      if (ex.best > 1) out.push({ key: 'mask', value: '/' + (ex.best - 1), expect: 'non è il minimo' });
      if (ex.common !== ex.best) out.push({ key: 'mask', value: '/' + ex.common, expect: 'un bit in più' });
    }
    return out;
  }

  // ---------------- aiuti ----------------
  function fieldHint(ex, key) {
    const H = {
      netA: 'AND tra IP e maschera: basta l\'ottetto in cui cade il confine della maschera, scritto in binario.',
      netB: 'Stessa operazione con l\'IP di B: se il risultato è diverso da quello di A, sono in reti diverse.',
      why: 'Un host manda direttamente all\'altro solo se lo considera nella propria rete (IP AND maschera uguali).',
      first: 'Rete + 1.', last: 'Broadcast − 1 (broadcast = rete + dimensione del blocco − 1).',
      ipB: 'Tieni la parte di rete di A e scegli una parte host che non sia tutta 0, tutta 1, né quella di A.',
      mask: 'Accorcia la maschera un bit alla volta finché i bit di rete di A e B coincidono: la prima maschera che li unisce è quella giusta.',
      bits: 'Differenza tra il vecchio e il nuovo prefisso.',
      hosts: '2^(bit di host) − 2.'
    };
    return H[key] || 'Rileggi il testo.';
  }
  function hints(ex) {
    const i = ex.oct;
    const A = U.ip2int(ex.a), B = U.ip2int(ex.b);
    const H = [
      {
        step: 'why', title: 'Perché non c\'è connettività',
        metodo: 'Due host si parlano direttamente solo se sono nella stessa rete: IP AND maschera deve dare lo stesso risultato per entrambi. Scrivi in binario l\'ottetto in cui cade il confine della maschera.',
        applicato: `Maschera /${ex.n}: il confine cade nel ${i + 1}° ottetto. A: ${binIp(A, ex.n)}; B: ${binIp(B, ex.n)}. Guarda i primi ${ex.n - 8 * i} bit di quell'ottetto.`,
        svolto: `Rete di A ${ex.netA}, rete di B ${ex.netB}: diverse. Per A, B è "fuori rete" (e viceversa): manderebbero al gateway, che non c'è.`
      },
      {
        step: 'ip', title: 'Nuovo IP per B',
        metodo: 'B deve avere la stessa parte di rete di A e una parte host valida: non tutta a 0 (rete), non tutta a 1 (broadcast), non uguale ad A.',
        applicato: `Blocco di A: ${ex.netA}/${ex.n}, ${ex.size} indirizzi.`,
        svolto: `Utilizzabili da ${ex.first} a ${ex.last}; per esempio ${ex.ipB}.`
      }
    ];
    if (ex.askMask) {
      H.push({
        step: 'mask', title: 'Nuova maschera',
        metodo: 'Lasciando gli IP, accorcia la maschera di un bit alla volta: i due IP finiscono nello stesso blocco quando i bit di rete coincidono. Poi controlla che A e B non siano l\'indirizzo di rete o di broadcast del nuovo blocco.',
        applicato: `Confronta i bit di ${binIp(A, ex.n)} e ${binIp(B, ex.n)} da sinistra: dove differiscono per la prima volta?`,
        svolto: `Il prefisso comune è /${ex.common}${ex.common !== ex.best ? `, ma con /${ex.common} uno dei due è rete o broadcast: serve /${ex.best}` : ''}. Nuova maschera ${ex.bestMask} (/${ex.best}), ${ex.bits} bit in meno${ex.askHosts ? `, ${ex.hosts} host` : ''}.`
      });
    }
    return H;
  }

  // ---------------- disegno ----------------
  function figure(ex) {
    return `<svg viewBox="0 0 560 120" class="fig" role="img" aria-label="Due host A e B collegati da un cavo">
      <rect x="40" y="20" width="70" height="46" rx="5" class="box"/><text x="75" y="49" text-anchor="middle" class="lbl b">A</text>
      <rect x="450" y="20" width="70" height="46" rx="5" class="box"/><text x="485" y="49" text-anchor="middle" class="lbl b">B</text>
      <line x1="110" y1="43" x2="450" y2="43" class="link hl"/>
      <text x="20" y="88" class="lbl">IP: ${ex.a}</text><text x="20" y="104" class="lbl small">subnet mask: ${ex.mask}</text>
      <text x="540" y="88" text-anchor="end" class="lbl">IP: ${ex.b}</text><text x="540" y="104" text-anchor="end" class="lbl small">subnet mask: ${ex.mask}</text>
    </svg>`;
  }
  function render(ex, root, ctx) {
    root.appendChild(U.h('div', { class: 'card intro' },
      U.h('p', {}, U.h('b', {}, 'Testo. '), 'Nello scenario in figura i due host, collegati da un cavo di rete, non hanno connettività.'),
      U.fig(figure(ex))));
    root.appendChild(U.card('1. Spiegare perché', { step: 'why' },
      U.row('Indirizzo di rete di A', U.inp(ctx, 'netA', { w: 'm', label: 'rete di A' })),
      U.row('Indirizzo di rete di B', U.inp(ctx, 'netB', { w: 'm', label: 'rete di B' })),
      U.h('div', { class: 'q-item' }, U.h('div', { class: 'q-text' }, 'Motivo'), U.sel(ctx, 'why', WHY, { label: 'motivo' }))));
    root.appendChild(U.card('2. Dare un possibile valore all\'IP di B affinché si abbia connettività', { step: 'ip' },
      ex.askRange ? U.row('Primo indirizzo utilizzabile della rete di A', U.inp(ctx, 'first', { w: 'm', label: 'primo utilizzabile' })) : null,
      ex.askRange ? U.row('Ultimo indirizzo utilizzabile della rete di A', U.inp(ctx, 'last', { w: 'm', label: 'ultimo utilizzabile' })) : null,
      U.row('Nuovo IP di B', U.inp(ctx, 'ipB', { w: 'm', label: 'nuovo IP di B' }))));
    if (ex.askMask) {
      root.appendChild(U.card('3. Lasciando invariati gli IP, modificare la subnet mask dei due host del minor numero di bit possibile', { step: 'mask' },
        U.row('Nuova subnet mask (decimale puntato o /n)', U.inp(ctx, 'mask', { w: 'l', label: 'nuova maschera' })),
        U.row('Di quanti bit è stata accorciata', U.inp(ctx, 'bits', { w: 'xs', label: 'bit' })),
        ex.askHosts ? U.row('Host indirizzabili nella nuova rete', U.inp(ctx, 'hosts', { w: 's', label: 'host' })) : null));
    }
  }
  function solution(ex, root) {
    const A = U.ip2int(ex.a), B = U.ip2int(ex.b);
    const pre = [
      `A     ${binIp(A, ex.n)}`,
      `B     ${binIp(B, ex.n)}`,
      `mask  ${binIp(U.maskOf(ex.n), ex.n)}   (/${ex.n})`
    ].join('\n');
    const kids = [U.h('h4', {}, 'Soluzione'),
      U.h('p', { class: 'sol-body' }, 'Espandiamo in binario l\'ottetto in cui cade il confine della maschera:'),
      U.h('pre', {}, pre),
      U.h('p', { class: 'sol-body' }, U.h('b', {}, '1. '), `Applicando la maschera: rete di A ${ex.netA}, rete di B ${ex.netB}. Sono diverse: per A, B è fuori dalla propria rete (e viceversa), quindi nessuno dei due prova a consegnare direttamente il frame all'altro (non fa nemmeno la ARP request): cercherebbe il gateway, che non c'è.`),
      U.h('p', { class: 'sol-body' }, U.h('b', {}, '2. '), `B deve stare nel blocco di A, ${ex.netA}/${ex.n}: indirizzi utilizzabili da ${ex.first} a ${ex.last} (broadcast ${ex.bcA}), escluso ${ex.a}. Per esempio ${ex.ipB} (${binIp(U.ip2int(ex.ipB), ex.n)}).`)];
    if (ex.askMask) {
      kids.push(U.h('p', { class: 'sol-body' }, U.h('b', {}, '3. '), `Accorciamo la maschera finché i bit di rete coincidono: il prefisso comune è /${ex.common}.` +
        (ex.common !== ex.best ? ` Però con /${ex.common} uno dei due indirizzi diventa la rete o il broadcast del nuovo blocco: si scende a /${ex.best}.` : '') +
        ` Nuova maschera ${ex.bestMask} (/${ex.best}), ${ex.bits} bit in meno: entrambi sono in ${U.int2ip(blockOf(A, ex.best))}/${ex.best}` + (ex.askHosts ? `, che ha ${ex.hosts} indirizzi per host.` : '.')));
    }
    root.appendChild(U.h('div', { class: 'card sol' }, kids));
  }
  function chatText(ex, a) {
    const v = k => (a && String(a[k] == null ? '' : a[k]).trim()) || '__';
    const L = [`#2 · Connettività e subnet mask (livello ${ex.level})`, '## Testo',
      `Due host collegati da un cavo non hanno connettività. A: ${ex.a}, B: ${ex.b}, maschera ${ex.mask} su entrambi.`,
      '1) Spiegare perché. 2) Dare un possibile IP a B per avere connettività.' + (ex.askMask ? ' 3) Lasciando gli IP, modificare la maschera del minor numero di bit possibile.' : ''),
      '', '## Le mie risposte',
      `- Rete di A: ${v('netA')} · rete di B: ${v('netB')} · motivo: ${(WHY.find(w => w[0] === (a && a.why)) || [0, '__'])[1]}`];
    if (ex.askRange) L.push(`- Range di A: ${v('first')} – ${v('last')}`);
    L.push(`- Nuovo IP di B: ${v('ipB')}`);
    if (ex.askMask) L.push(`- Nuova maschera: ${v('mask')} (${v('bits')} bit)` + (ex.askHosts ? ` · host: ${v('hosts')}` : ''));
    return L.join('\n');
  }

  RA.subnet = {
    id: 'subnet', num: '2', name: 'Connettività e subnet mask', part: 2, examPoints: 4, extra: false,
    desc: 'Due host su un cavo non si vedono: reti diverse con la maschera, nuovo IP per B, maschera accorciata del minimo numero di bit.',
    method: {
      intro: 'Esercizio breve e meccanico: tutto si decide scrivendo in binario l\'ottetto in cui cade il confine della maschera.',
      steps: [
        'Scrivi in binario l\'ottetto "interessante" dei due IP e della maschera.',
        'Rete = IP AND maschera. Se le reti di A e B sono diverse, ognuno considera l\'altro fuori rete: niente comunicazione diretta.',
        'Nuovo IP per B: stessa parte di rete di A, parte host valida (non tutta 0, non tutta 1, diversa da A).',
        'Nuova maschera: sposta il confine a sinistra un bit alla volta finché i bit di rete coincidono.',
        'Controllo finale: A e B devono restare host validi nel nuovo blocco. Se lo erano con la maschera lunga lo restano: il blocco si allarga e i loro bit di host non diventano tutti 0 o tutti 1.'
      ],
      traps: [
        'L\'indirizzo di rete ha gli host bit a 0, il broadcast a 1: nessuno dei due si assegna a un host.',
        'Allungare la maschera non serve mai a unire due host: le reti si restringono.',
        '"Minor numero di bit": non basta una maschera che funzioni, deve essere la più lunga possibile.',
        'Il problema non è il cavo: è di livello 3 (le reti calcolate con la maschera).'
      ],
      formulas: [
        ['Rete', 'IP AND maschera'],
        ['Broadcast', 'rete + 2^(32−n) − 1'],
        ['Host utilizzabili', '2^(32−n) − 2'],
        ['Stessa rete?', 'IP_A AND maschera = IP_B AND maschera'],
        ['Valori di un ottetto di maschera', '128 · 192 · 224 · 240 · 248 · 252 · 254 · 255']
      ]
    },
    traces: [
      {
        id: 'sim-subnet', set: 'simulato',
        title: 'Esame simulato · connettività (172.20.14.37 e .53, /29)',
        source: 'Esame_Simulato_2_TESTO.pdf, esercizio 2',
        params: { level: 4, a: '172.20.14.37', b: '172.20.14.53', n: 29, ipBModel: '172.20.14.34' },
        expect: { netA: '172.20.14.32', netB: '172.20.14.48', first: '172.20.14.33', last: '172.20.14.38', ipB: '172.20.14.34', mask: '255.255.255.224', bits: '2', hosts: '30' }
      },
      {
        id: 'pdf-subnet',
        title: 'Esercizi seconda parte · due host su un cavo (.198 e .206, /29)',
        source: 'Esercizi seconda parte.pdf, pag. 2',
        params: { level: 2, a: '192.150.181.198', b: '192.150.181.206', n: 29, ipBModel: '192.150.181.194' },
        expect: { netA: '192.150.181.192', netB: '192.150.181.200', ipB: '192.150.181.194', mask: '255.255.255.240', bits: '1' }
      }
    ],
    randomParams, build, gen, steps, grade, sol2answers, render, solution, hints, fieldHint, diagnose, diagnoseCases, chatText
  };
})();
