// ============================================================
// RetiApp · gen-nat.js — Esercizio 3 · NAT
// Contratto dei moduli: vedi docs/moduli.md (modello: gen-http.js)
// ============================================================
(function () {
  const RA = window.RetiApp;
  const U = RA.util;

  // primi ottetti "pubblici" (niente 10, 127, 172, 192, 100, 169, ≥224)
  const PUB_FIRST = [82, 93, 151, 77, 128, 141, 87, 95, 62, 185, 213, 79, 130, 146, 195, 217];
  const SRV_PORTS = [80, 443, 8080, 25, 587, 110, 143, 993, 22, 21];
  const C_PORTS = [8080, 2222, 3389, 5000, 9000, 8443, 25565, 4444, 5900, 8888];
  const SVC = { 80: 'web', 443: 'web', 8080: 'web', 25: 'di posta', 587: 'di posta', 110: 'di posta', 143: 'di posta', 993: 'di posta', 22: 'SSH', 21: 'FTP' };
  const KIND = [
    { side: 'LAN', out: true, phase: 'prima del NAT' },   // 1: host → server, prima
    { side: 'WAN', out: true, phase: 'dopo il NAT' },     // 2: host → server, dopo
    { side: 'WAN', out: false, phase: 'prima del NAT' },  // 3: server → host, prima
    { side: 'LAN', out: false, phase: 'dopo il NAT' }     // 4: server → host, dopo
  ];
  const FIELDS = ['srcIp', 'dstIp', 'srcPort', 'dstPort'];
  const FNAME = { srcIp: 'IP sorgente', dstIp: 'IP destinazione', srcPort: 'porta sorgente', dstPort: 'porta destinazione' };
  const OTHER = { srcIp: 'dstIp', dstIp: 'srcIp', srcPort: 'dstPort', dstPort: 'srcPort' };

  // ---------------- parametri e costruzione ----------------
  function pubIp() { return `${U.pick(PUB_FIRST)}.${U.rndInt(1, 254)}.${U.rndInt(0, 254)}.${U.rndInt(1, 254)}`; }
  function freshPort(used, lo, hi, ok) {
    for (let t = 0; t < 500; t++) {
      const p = U.rndInt(lo, hi);
      if (!used.includes(p) && (!ok || ok(p))) { used.push(p); return p; }
    }
    throw new Error('nessuna porta libera');
  }

  function randomParams(level) {
    // rete LAN: livello 1 solo 192.168.x / 10.0.0, poi tutte e tre le classi private
    let base;
    if (level <= 1) base = U.pick([`192.168.${U.rndInt(0, 9)}`, '10.0.0']);
    else base = U.pick([`192.168.${U.rndInt(0, 30)}`, `10.${U.rndInt(0, 40)}.${U.rndInt(0, 40)}`, `172.${U.rndInt(16, 31)}.${U.rndInt(0, 30)}`]);
    const rOct = level <= 1 ? 1 : U.pick([1, 1, 254]);
    const routerLan = `${base}.${rOct}`;

    // L5: tre host verso un server, oppure due host verso due server diversi
    const threeHosts = level === 5 && U.chance(0.5);
    const nHosts = threeHosts ? 3 : 2;
    const nSrv = level === 5 && !threeHosts ? 2 : 1;

    const pub = pubIp();
    const srvIps = [];
    while (srvIps.length < nSrv) { const s = pubIp(); if (s !== pub && !srvIps.includes(s)) srvIps.push(s); }
    const usedPorts = [];
    const srvPorts = level <= 1 ? [U.pick([80, 443])] : U.sample(SRV_PORTS, nSrv);
    srvPorts.forEach(p => usedPorts.push(p));

    // IP degli host (ultimo ottetto)
    const octs = U.sample(Array.from({ length: level <= 1 ? 48 : 252 }, (_, i) => i + 2).filter(o => o !== rOct), nHosts).sort((a, b) => a - b);

    // porte LAN: diverse ai livelli 1-2, uguali (almeno due host) dal 3
    const lanPorts = [];
    if (level <= 2) {
      for (let i = 0; i < nHosts; i++) lanPorts.push(freshPort(usedPorts, 1024, 64000));
    } else {
      const same = freshPort(usedPorts, 40000, 64000);
      lanPorts.push(same, same);
      if (nHosts === 3) lanPorts.push(U.chance(0.5) ? same : freshPort(usedPorts, 1024, 64000));
    }

    // porte WAN: consecutive al livello 1, sparse dal 2
    let wanPorts = [];
    if (level <= 1) {
      const b = U.pick([5001, 6001, 7001, 10001, 20001, 40001].filter(x => !usedPorts.includes(x) && !usedPorts.includes(x + 1)));
      wanPorts = [b, b + 1];
      wanPorts.forEach(p => usedPorts.push(p));
    } else {
      for (let i = 0; i < nHosts; i++) {
        wanPorts.push(freshPort(usedPorts, 1024, 64000, p => wanPorts.every(w => Math.abs(w - p) > 1)));
      }
    }

    const hosts = octs.map((o, i) => ({ ip: `${base}.${o}`, lanPort: lanPorts[i], wanPort: wanPorts[i], srv: nSrv === 2 ? i : 0 }));
    const servers = srvIps.map((ip, i) => ({ ip, port: srvPorts[i] }));
    const askB = level >= 3;
    const askC = level >= 4;
    const cPort = askC ? U.pick(C_PORTS.filter(p => !wanPorts.includes(p))) : null;
    const cHost = askC ? (level === 5 ? U.rndInt(0, nHosts - 1) : 0) : null;
    return { level, pub, lanNet: `${base}.0/24`, routerLan, hosts, servers, askB, askC, cPort, cHost };
  }

  function build(p) {
    const hosts = p.hosts.map((h, i) => ({ i, name: `host ${i + 1}`, ip: h.ip, lanPort: Number(h.lanPort), wanPort: Number(h.wanPort), srv: h.srv || 0 }));
    const servers = p.servers.map((s, i) => ({
      i, name: p.servers.length > 1 ? `server ${'AB'[i]}` : 'server', ip: s.ip, port: Number(s.port), svc: SVC[s.port] || ''
    }));
    const flows = [];
    hosts.forEach(h => {
      const s = servers[h.srv];
      const n0 = 4 * h.i;
      flows.push({ n: n0 + 1, h: h.i, kind: 0, srcIp: h.ip, dstIp: s.ip, srcPort: h.lanPort, dstPort: s.port });
      flows.push({ n: n0 + 2, h: h.i, kind: 1, srcIp: p.pub, dstIp: s.ip, srcPort: h.wanPort, dstPort: s.port });
      flows.push({ n: n0 + 3, h: h.i, kind: 2, srcIp: s.ip, dstIp: p.pub, srcPort: s.port, dstPort: h.wanPort });
      flows.push({ n: n0 + 4, h: h.i, kind: 3, srcIp: s.ip, dstIp: h.ip, srcPort: s.port, dstPort: h.lanPort });
    });
    flows.forEach(f => { f.side = KIND[f.kind].side; });
    // host che condividono la stessa porta LAN (domanda b)
    const groups = {};
    hosts.forEach(h => { (groups[h.lanPort] = groups[h.lanPort] || []).push(h.i); });
    const big = Object.values(groups).sort((a, b) => b.length - a.length)[0];
    const sameGroup = big.length > 1 ? big : [];
    const askB = !!p.askB && sameGroup.length > 1;
    const askC = !!p.askC && p.cPort != null;
    return {
      cat: 'nat', level: p.level, params: p,
      pub: p.pub, lanNet: p.lanNet, routerLan: p.routerLan,
      hosts, servers, flows, sameGroup,
      askB, askC, cPort: askC ? Number(p.cPort) : null, cHost: askC ? (p.cHost || 0) : null,
      sol: { b: 'dist', c1: 'drop', c2: 'fwd' }
    };
  }
  const gen = level => build(randomParams(level));

  // ---------------- piccoli helper ----------------
  const fkey = (n, f) => `f${n}.${f}`;
  const flowKeys = (ex, kinds) => ex.flows.filter(f => kinds.includes(f.kind)).flatMap(f => FIELDS.map(c => fkey(f.n, c)));
  const qKeys = ex => (ex.askB ? ['b'] : []).concat(ex.askC ? ['c1', 'c2'] : []);
  const hostSideField = (f, c) => KIND[f.kind].out ? (c === 'srcIp' || c === 'srcPort') : (c === 'dstIp' || c === 'dstPort');
  const srvOf = (ex, h) => ex.servers[ex.hosts[h].srv];
  const srvTxt = (ex, h) => ex.servers.length > 1 ? srvOf(ex, h).name : 'server';
  const nums = (ex, kind) => ex.flows.filter(f => f.kind === kind).map(f => f.n);
  function dirTxt(ex, f) {
    const h = ex.hosts[f.h].name, s = srvTxt(ex, f.h);
    return KIND[f.kind].out ? `${h} → ${s}` : `${s} → ${h}`;
  }
  function ipEq(a, b) { const x = U.ip2int(a); return x !== null && x === U.ip2int(b); }
  function portOf(v) { const s = String(v == null ? '' : v).trim(); return /^\d{1,5}$/.test(s) ? Number(s) : null; }
  function isPrivate(n) {
    return (n >>> 24) === 10 || ((n >>> 20) === ((172 << 4) | 1)) || ((n >>> 16) === ((192 << 8) | 168));
  }
  function parseKey(key) {
    const m = /^f(\d+)\.(srcIp|dstIp|srcPort|dstPort)$/.exec(key);
    return m ? { n: Number(m[1]), c: m[2] } : null;
  }

  // ---------------- domande b) e c): opzioni ----------------
  function sameTxt(ex) {
    const g = ex.sameGroup.map(i => ex.hosts[i]);
    const who = g.length === ex.hosts.length ? (g.length === 2 ? 'I due host' : 'I tre host') : `Gli host ${g.map(h => h.i + 1).join(' e ')}`;
    return { who, port: g.length ? g[0].lanPort : null, hosts: g };
  }
  function bOptions() {
    return [
      ['lan', 'Sul lato LAN due host non possono avere la stessa porta sorgente'],
      ['dist', 'Sul lato WAN hanno lo stesso IP: solo la porta WAN dice a chi consegnare le risposte'],
      ['hide', 'Per sicurezza: così da fuori non si vede la porta privata di ogni host'],
      ['rand', 'È un caso: il NAT poteva anche dare la stessa porta WAN a tutti e due']
    ];
  }
  function c1Options(ex) {
    return [
      ['host', 'Lo inoltra all\'host 1, il primo della tabella'],
      ['drop', `Lo scarta: nessuna riga della tabella ha porta WAN ${ex.cPort}`],
      ['all', 'Lo inoltra a tutti gli host della LAN: risponde chi lo aspettava'],
      ['back', 'Lo rimanda indietro all\'host esterno che l\'ha inviato']
    ];
  }
  function c2Options(ex) {
    const h = ex.hosts[ex.cHost];
    return [
      ['none', 'Niente: il NAT crea da solo la riga al primo segmento in ingresso'],
      ['priv', `Che l'host esterno mandi il segmento direttamente a ${h.ip}`],
      ['fwd', `Port forwarding: riga statica ${ex.pub}:${ex.cPort} → ${h.ip}:${ex.cPort} (o UPnP/relay)`],
      ['wkp', 'Usare una porta nota (80 o 443) come destinazione: sono sempre aperte']
    ];
  }
  function optWhy(ex, key, v) {
    const s = sameTxt(ex);
    const ch = ex.askC ? ex.hosts[ex.cHost] : null;
    const W = {
      b: {
        lan: `Sul lato LAN non c'è conflitto: gli IP privati sono diversi (${s.hosts.map(h => h.ip).join(', ')}), quindi le coppie IP:porta sono già distinte. Il problema nasce sul lato WAN, dove l'IP è uno solo.`,
        hide: `Nascondere la porta privata è un effetto collaterale. Il motivo vero: con lo stesso IP pubblico ${ex.pub}, porte WAN uguali renderebbero impossibile smistare le risposte.`,
        rand: `Non è un caso: se la porta WAN fosse la stessa, una risposta verso ${ex.pub}:${s.port} potrebbe essere di più host e il NAT non saprebbe a chi consegnarla.`
      },
      c1: {
        host: 'Il NAT consegna solo se trova una riga con quella porta WAN; non sceglie un host "di default". Qui la riga non c\'è, quindi scarta.',
        all: `Il NAT non fa broadcast: senza una riga per la porta ${ex.cPort} non sa a chi mandare il segmento e lo scarta.`,
        back: `Il NAT non rimbalza i segmenti al mittente: senza una riga per la porta ${ex.cPort} lo scarta.`
      },
      c2: ch ? {
        none: 'Le righe dinamiche nascono solo dai pacchetti in USCITA (connessioni aperte dalla LAN). Per una connessione aperta dall\'esterno la riga va configurata a mano.',
        priv: `Gli IP privati non sono instradabili su Internet: un segmento verso ${ch.ip} non arriverebbe nemmeno al router.`,
        wkp: 'Sul NAT nessuna porta è "aperta" di per sé, nemmeno quelle note: senza una riga in tabella il segmento viene scartato comunque.'
      } : {}
    };
    return (W[key] && W[key][v]) || null;
  }

  // ---------------- passi ----------------
  function steps(ex) {
    const s = [
      { id: 'lan', title: 'Andata, lato LAN', keys: flowKeys(ex, [0]) },
      { id: 'wan', title: 'Andata, lato WAN (tabella)', keys: flowKeys(ex, [1]) },
      { id: 'ret', title: 'Ritorni: sorgente e destinazione scambiate', keys: flowKeys(ex, [2, 3]) }
    ];
    if (qKeys(ex).length) s.push({ id: 'q', title: 'Domande', keys: qKeys(ex) });
    return s;
  }

  // ---------------- correzione ----------------
  // descrizione del valore giusto di un campo (usata nei messaggi)
  function valueDesc(ex, f, c) {
    const h = ex.hosts[f.h];
    if (!hostSideField(f, c)) return c.endsWith('Ip') ? `IP del ${srvTxt(ex, f.h)}, mai tradotto` : `porta del ${srvTxt(ex, f.h)}, mai tradotta`;
    if (f.side === 'LAN') return c.endsWith('Ip') ? `IP privato dell'${h.name}` : `porta privata dell'${h.name} (colonna LAN)`;
    return c.endsWith('Ip') ? 'IP pubblico del NAT (colonna WAN)' : `porta WAN dell'${h.name} (colonna WAN)`;
  }
  function cellMsg(ex, f, c) {
    return `Flusso ${f.n} (${dirTxt(ex, f)}, ${KIND[f.kind].phase} = lato ${f.side}): ${FNAME[c]} = ${valueDesc(ex, f, c)}, cioè ${f[c]}.`;
  }
  function qMsg(ex, k) {
    const ch = ex.askC ? ex.hosts[ex.cHost] : null;
    return {
      b: `Sul lato WAN tutti gli host hanno lo stesso IP pubblico (${ex.pub}): la porta WAN è l'unico campo che distingue le connessioni e dice al NAT a chi consegnare le risposte.`,
      c1: `Nella tabella non c'è nessuna riga con porta WAN ${ex.cPort}: il NAT non sa a chi consegnare il segmento e lo scarta.`,
      c2: ch ? `Serve una riga statica di port forwarding (${ex.pub}:${ex.cPort} → ${ch.ip}:${ex.cPort}) configurata sul router, oppure NAT traversal (UPnP, relay).` : ''
    }[k];
  }

  function grade(ex, a) {
    let correct = 0, total = 0;
    const marks = {};
    ex.flows.forEach(f => FIELDS.forEach(c => {
      const k = fkey(f.n, c);
      const ok = c.endsWith('Ip') ? ipEq(a[k], f[c]) : portOf(a[k]) === f[c];
      total++;
      if (ok) correct++;
      marks[k] = { ok, msg: cellMsg(ex, f, c) };
    }));
    qKeys(ex).forEach(k => {
      const ok = String(a[k] == null ? '' : a[k]) === ex.sol[k];
      total++;
      if (ok) correct++;
      marks[k] = { ok, msg: qMsg(ex, k) };
    });
    return { correct, total, marks };
  }

  function sol2answers(ex) {
    const a = {};
    ex.flows.forEach(f => FIELDS.forEach(c => { a[fkey(f.n, c)] = String(f[c]); }));
    qKeys(ex).forEach(k => { a[k] = ex.sol[k]; });
    return a;
  }

  // ---------------- errori tipici ----------------
  function diagnose(ex, key, value, answers) {
    const v = String(value == null ? '' : value).trim();
    if (v === '') return null;
    if (key === 'b' || key === 'c1' || key === 'c2') return v === ex.sol[key] ? null : optWhy(ex, key, v);
    const pk = parseKey(key);
    if (!pk) return null;
    const f = ex.flows.find(x => x.n === pk.n);
    if (!f) return null;
    const c = pk.c;
    const h = ex.hosts[f.h];
    const srv = srvOf(ex, f.h);
    const isIp = c.endsWith('Ip');
    const others = ex.hosts.filter(x => x.i !== f.h);
    const back = !KIND[f.kind].out;
    const swapMsg = back
      ? `Sorgente e destinazione non scambiate: nel flusso ${f.n} i dati tornano DAL ${srvTxt(ex, f.h)}. Prendi la riga di andata dello stesso lato (flusso ${f.kind === 2 ? f.n - 1 : f.n - 3}) e scambia sorgente e destinazione.`
      : `Sorgente e destinazione invertite: nel flusso ${f.n} i dati vanno dall'${h.name} verso il ${srvTxt(ex, f.h)}, quindi la sorgente è dal lato dell'host.`;

    if (isIp) {
      const n = U.ip2int(v);
      if (n === null) return 'Non è un indirizzo IP valido: servono 4 numeri da 0 a 255 separati da punti.';
      if (n === U.ip2int(f[c])) return null;
      if (n === U.ip2int(f[OTHER[c]])) return swapMsg;
      if (n === U.ip2int(ex.routerLan)) return `L'IP LAN del router (${ex.routerLan}) non compare nei flussi: il router traduce gli indirizzi, ma la connessione è tra l'${h.name} e il ${srvTxt(ex, f.h)}.`;
      if (hostSideField(f, c)) {
        if (f.side === 'LAN' && n === U.ip2int(ex.pub)) return `IP pubblico in un flusso lato LAN (lato confuso): il flusso ${f.n} è ${KIND[f.kind].phase}, dentro la rete privata, dove l'${h.name} compare con il suo IP privato.`;
        if (f.side === 'WAN' && isPrivate(n)) return `IP privato sul lato WAN (lato confuso): il flusso ${f.n} viaggia su Internet, dove gli IP privati non circolano. Qui il NAT compare con il suo IP pubblico.`;
        const o = others.find(x => U.ip2int(x.ip) === n);
        if (o) return `È l'IP dell'${o.name}: il flusso ${f.n} riguarda l'${h.name} (flussi ${4 * f.h + 1}-${4 * f.h + 4}).`;
        return null;
      }
      const os = ex.servers.find(s => s.i !== srv.i && U.ip2int(s.ip) === n);
      if (os) return `È l'IP del ${os.name}: l'${h.name} parla con il ${srv.name} (${srv.ip}).`;
      return `Il lato server non cambia mai: in tutti i flussi dell'${h.name} l'IP del ${srvTxt(ex, f.h)} è sempre ${srv.ip}. Il NAT traduce solo il lato dell'host.`;
    }

    const p = portOf(v);
    if (p === null || p > 65535) return 'Una porta è un numero intero da 0 a 65535 (16 bit).';
    if (p === f[c]) return null;
    if (p === f[OTHER[c]]) return swapMsg;
    if (hostSideField(f, c)) {
      if (f.side === 'LAN' && p === h.wanPort) return `Porta WAN sul lato LAN: dentro la rete privata l'${h.name} usa la sua porta privata (colonna LAN). La porta ${h.wanPort} esiste solo fuori dal NAT.`;
      if (f.side === 'WAN' && p === h.lanPort) return `Porta LAN sul lato WAN: uscendo il NAT sostituisce la porta privata ${h.lanPort} con quella della colonna WAN, nella riga dell'${h.name}.`;
      const o = others.find(x => x.wanPort === p || x.lanPort === p);
      if (o) return `È la porta dell'${o.name} (${o.wanPort === p ? 'colonna WAN' : 'colonna LAN'}): il flusso ${f.n} riguarda l'${h.name}, usa la sua riga della tabella.`;
      return null;
    }
    const os = ex.servers.find(s => s.i !== srv.i && s.port === p);
    if (os) return `È la porta del ${os.name}: l'${h.name} parla con il ${srv.name}, porta ${srv.port}.`;
    return `Porta del server cambiata: il NAT non tocca mai IP e porta del ${srvTxt(ex, f.h)}, che restano ${srv.ip}:${srv.port} in tutti i flussi dell'${h.name}.`;
  }

  function diagnoseCases(ex) {
    const h0 = ex.hosts[0];
    const out = [
      { key: 'f1.srcIp', value: ex.pub, expect: 'lato confuso' },
      { key: 'f2.srcIp', value: h0.ip, expect: 'lato confuso' },
      { key: 'f1.srcPort', value: String(h0.wanPort), expect: 'porta WAN sul lato LAN' },
      { key: 'f2.srcPort', value: String(h0.lanPort), expect: 'porta LAN sul lato WAN' },
      { key: 'f1.dstIp', value: h0.ip, expect: 'invertite' },
      { key: 'f3.srcIp', value: ex.pub, expect: 'non scambiate' },
      { key: 'f3.dstPort', value: String(srvOf(ex, 0).port), expect: 'non scambiate' },
      { key: 'f4.srcPort', value: String(h0.wanPort), expect: 'porta del server' },
      { key: 'f2.dstIp', value: ex.routerLan, expect: 'IP LAN del router' },
      { key: 'f6.srcPort', value: String(h0.wanPort), expect: 'host 1' },
      { key: 'f5.srcIp', value: h0.ip, expect: 'host 1' }
    ];
    if (ex.askB) out.push({ key: 'b', value: 'lan', expect: 'non c\'è conflitto' }, { key: 'b', value: 'rand', expect: 'non è un caso' });
    if (ex.askC) out.push({ key: 'c1', value: 'all', expect: 'broadcast' }, { key: 'c2', value: 'none', expect: 'righe dinamiche' }, { key: 'c2', value: 'priv', expect: 'non sono instradabili' });
    return out;
  }

  // ---------------- aiuti ----------------
  function fieldHint(ex, key) {
    if (key === 'b') return 'Pensa alle risposte che arrivano dal server: su cosa si basa il NAT per capire a quale host consegnarle?';
    if (key === 'c1') return 'Il NAT consegna un segmento in ingresso solo se trova una riga con quella porta WAN. C\'è?';
    if (key === 'c2') return 'Le righe dinamiche nascono dal traffico in uscita. Per una connessione che parte da fuori, chi crea la riga?';
    const pk = parseKey(key);
    const f = pk && ex.flows.find(x => x.n === pk.n);
    if (!f) return 'Rileggi il testo della domanda.';
    const c = pk.c;
    const h = ex.hosts[f.h];
    const st = srvTxt(ex, f.h);
    const head = `Flusso ${f.n} = lato ${f.side}, ${KIND[f.kind].out ? `dall'${h.name} verso il ${st}` : `dal ${st} verso ${f.side === 'WAN' ? 'il NAT' : `l'${h.name}`}`}: `;
    if (!hostSideField(f, c)) return head + (c.endsWith('Ip') ? `${c === 'srcIp' ? 'la sorgente' : 'la destinazione'} è il ${st}, che il NAT non tocca mai.` : `porta del ${st}, nota dal testo e sempre uguale.`);
    const who = c.startsWith('src') ? 'la sorgente' : 'la destinazione';
    if (f.side === 'LAN') return head + (c.endsWith('Ip') ? `${who} è l'host stesso, con il suo IP privato.` : `porta nella colonna LAN della riga dell'${h.name}.`);
    return head + (c.endsWith('Ip') ? `${who} è l'IP pubblico del NAT.` : `porta nella colonna WAN della riga dell'${h.name}.`);
  }

  const flowLine = f => `Flusso ${f.n}: ${f.srcIp}:${f.srcPort} → ${f.dstIp}:${f.dstPort}`;
  function hints(ex) {
    const F = k => ex.flows.filter(f => f.kind === k);
    const H = [
      {
        step: 'lan', title: 'Andata, lato LAN (prima del NAT)',
        metodo: 'Passo 1, il lato: prima del NAT i dati in uscita sono ancora nella LAN, quindi compare l\'IP privato dell\'host. Passo 2, la direzione: verso il server, sorgente = host, destinazione = server. Passo 3, la riga: porta sorgente dalla colonna LAN della riga dell\'host; IP e porta del server sono quelli noti.',
        applicato: `Flussi ${nums(ex, 0).join(', ')}. Ogni host ha la sua riga in tabella: cerca la riga con il suo IP privato (${ex.hosts.map(h => h.ip).join(', ')}) e leggi la porta nella colonna LAN.`,
        svolto: F(0).map(flowLine).join('\n')
      },
      {
        step: 'wan', title: 'Andata, lato WAN (dopo il NAT)',
        metodo: 'Uscendo, il NAT sostituisce IP e porta sorgente con la coppia della colonna WAN, nella STESSA riga dell\'host. La destinazione (il server) non si tocca.',
        applicato: `Flussi ${nums(ex, 1).join(', ')}. L'IP pubblico del NAT è ${ex.pub}; la porta WAN è quella sulla riga di ciascun host.`,
        svolto: F(1).map(f => `${flowLine(f)}   (riga dell'${ex.hosts[f.h].name}: ${ex.hosts[f.h].ip}:${ex.hosts[f.h].lanPort} ↔ ${ex.pub}:${ex.hosts[f.h].wanPort})`).join('\n')
      },
      {
        step: 'ret', title: 'Ritorni: scambia sorgente e destinazione',
        metodo: 'Per le risposte scambia sorgente e destinazione della riga di andata sullo STESSO lato. Attenzione: per i dati dal server "prima del NAT" è il lato WAN, "dopo il NAT" è il lato LAN (il contrario dei flussi in uscita).',
        applicato: ex.hosts.map(h => `Flusso ${4 * h.i + 3} = flusso ${4 * h.i + 2} scambiato (lato WAN); flusso ${4 * h.i + 4} = flusso ${4 * h.i + 1} scambiato (lato LAN).`).join(' '),
        svolto: ex.flows.filter(f => f.kind >= 2).map(flowLine).join('\n')
      }
    ];
    if (qKeys(ex).length) {
      const parts = [], app = [], sv = [];
      if (ex.askB) {
        parts.push('b) Le risposte arrivano tutte allo stesso IP pubblico: il NAT le smista guardando solo la porta WAN di destinazione.');
        app.push(`b) ${sameTxt(ex).who} hanno porta privata ${sameTxt(ex).port}, ma tutti escono come ${ex.pub}.`);
        sv.push('b) ' + qMsg(ex, 'b'));
      }
      if (ex.askC) {
        parts.push('c) Le righe dinamiche nascono solo dal traffico in uscita. Un segmento verso una porta senza riga non ha destinatario; per accettare connessioni dall\'esterno serve una riga statica.');
        app.push(`c) Cerca la porta ${ex.cPort} nella colonna WAN della tabella.`);
        sv.push('c) ' + qMsg(ex, 'c1') + ' ' + qMsg(ex, 'c2'));
      }
      H.push({ step: 'q', title: 'Domande', metodo: parts.join(' '), applicato: app.join(' '), svolto: sv.join('\n') });
    }
    return H;
  }

  // ---------------- figura ----------------
  // Tre zone: LAN (host, x 4-234) · router (x 240-320) · WAN (nuvola + server, x 326-556).
  // Ogni host ha una "fascia" alta 76 px centrata in yc: andata a yc-13, ritorno a yc+13,
  // collegamento a yc. Tutte le frecce sono orizzontali: non si incrociano mai.
  function figure(ex) {
    const NH = ex.hosts.length;
    const yc = i => 78 + 76 * i;
    const top = yc(0) - 34, bot = yc(NH - 1) + 34;
    const VH = bot + 44;
    const RX = 240, RW = 80, RC = RX + RW / 2;
    const SX = 452, SW = 102, SC = SX + SW / 2;
    const HX = 14, HW = 106, HC = HX + HW / 2;
    const L = [];
    L.push(`<svg viewBox="0 0 560 ${VH}" class="fig" role="img" aria-label="Rete con NAT: host a sinistra, router al centro, Internet e server a destra, frecce numerate dei flussi">`);
    L.push(U.svgArrowDefs('ah-nat'));
    L.push(U.svgArrowDefs('ah-nat-b').replace('class="ah"', 'class="ah2"'));
    // zone
    L.push(`<rect x="4" y="26" width="230" height="${VH - 30}" rx="8" class="zone"/>`);
    L.push(`<rect x="326" y="26" width="230" height="${VH - 30}" rx="8" class="zone"/>`);
    L.push('<text x="12" y="18" class="side">LAN · indirizzi privati</text>');
    L.push('<text x="548" y="18" text-anchor="end" class="side">WAN · Internet</text>');
    // nuvola (dietro alle frecce)
    const cy = (top + bot) / 2;
    L.push(`<ellipse cx="386" cy="${cy}" rx="56" ry="${(bot - top) / 2 + 4}" class="cloud"/>`);
    L.push(`<text x="386" y="${(yc(0) + yc(1)) / 2 + 4}" text-anchor="middle" class="lbl small">Internet</text>`);
    // collegamenti
    ex.hosts.forEach(h => {
      const y = yc(h.i);
      L.push(`<line x1="${HX + HW}" y1="${y}" x2="${RX}" y2="${y}" class="link"/>`);
      L.push(`<line x1="${RX + RW}" y1="${y}" x2="${SX}" y2="${y}" class="link"/>`);
    });
    // host
    ex.hosts.forEach(h => {
      const y = yc(h.i);
      L.push(`<rect x="${HX}" y="${y - 20}" width="${HW}" height="40" rx="5" class="box"/>`);
      L.push(`<text x="${HC}" y="${y - 4}" text-anchor="middle" class="lbl b">Host ${h.i + 1}</text>`);
      L.push(`<text x="${HC}" y="${y + 11}" text-anchor="middle" class="lbl small">${h.ip}</text>`);
    });
    // router
    L.push(`<rect x="${RX}" y="${top}" width="${RW}" height="${bot - top}" rx="6" class="box router"/>`);
    L.push(`<text x="${RC}" y="${cy - 2}" text-anchor="middle" class="lbl w">Router</text>`);
    L.push(`<text x="${RC}" y="${cy + 12}" text-anchor="middle" class="lbl w">NAT</text>`);
    L.push(`<text x="${RX - 8}" y="${bot + 16}" text-anchor="end" class="lbl small">IP LAN</text>`);
    L.push(`<text x="${RX - 8}" y="${bot + 30}" text-anchor="end" class="lbl">${ex.routerLan}</text>`);
    L.push(`<text x="${RX + RW + 10}" y="${bot + 16}" class="lbl small">IP pubblico</text>`);
    L.push(`<text x="${RX + RW + 10}" y="${bot + 30}" class="lbl">${ex.pub}</text>`);
    // server (una casella per server, alta quanto le fasce dei suoi host)
    ex.servers.forEach(s => {
      const hs = ex.hosts.filter(h => h.srv === s.i).map(h => h.i);
      if (!hs.length) return;
      const y0 = yc(Math.min(...hs)) - 30, y1 = yc(Math.max(...hs)) + 30, c = (y0 + y1) / 2;
      L.push(`<rect x="${SX}" y="${y0}" width="${SW}" height="${y1 - y0}" rx="5" class="box"/>`);
      L.push(`<text x="${SC}" y="${c - 8}" text-anchor="middle" class="lbl b">${ex.servers.length > 1 ? 'Server ' + 'AB'[s.i] : 'Server'}</text>`);
      L.push(`<text x="${SC}" y="${c + 7}" text-anchor="middle" class="lbl small">${s.ip}</text>`);
      L.push(`<text x="${SC}" y="${c + 20}" text-anchor="middle" class="lbl small">porta ${s.port}</text>`);
    });
    // frecce e numeri: andata sopra (piena), ritorno sotto (tratteggiata)
    const dots = [];
    const arrow = (x1, x2, y, isBack, n, dx) => {
      L.push(`<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" class="arrow${isBack ? ' back' : ''}" marker-end="url(#${isBack ? 'ah-nat-b' : 'ah-nat'})"/>`);
      dots.push(`<circle cx="${dx}" cy="${y}" r="9" class="flow-dot${isBack ? ' back' : ''}"/><text x="${dx}" y="${y + 4}" text-anchor="middle" class="flow-n">${n}</text>`);
    };
    ex.hosts.forEach(h => {
      const y = yc(h.i), n = 4 * h.i;
      arrow(HX + HW + 2, RX - 2, y - 13, false, n + 1, 162);        // 1: host → router (LAN)
      arrow(RX + RW + 2, SX - 2, y - 13, false, n + 2, 366);        // 2: router → server (WAN)
      arrow(SX - 2, RX + RW + 2, y + 13, true, n + 3, 410);         // 3: server → router (WAN)
      arrow(RX - 2, HX + HW + 2, y + 13, true, n + 4, 198);         // 4: router → host (LAN)
    });
    L.push(dots.join(''));
    L.push('</svg>');
    return L.join('');
  }

  // ---------------- testo ----------------
  function introText(ex) {
    const NH = ex.hosts.length;
    const sv = s => `${s.svc ? s.svc + ' ' : ''}${s.ip} (porta ${s.port})`;
    let t;
    if (ex.servers.length === 1) {
      t = `${NH === 2 ? 'I due host' : 'I tre host'} di una rete privata (${ex.lanNet}) con NAT hanno ciascuno una connessione TCP aperta con il server ${sv(ex.servers[0])}.`;
    } else {
      t = `Due host di una rete privata (${ex.lanNet}) con NAT hanno una connessione TCP aperta: l'host 1 con il server A, ${sv(ex.servers[0])}; l'host 2 con il server B, ${sv(ex.servers[1])}.`;
    }
    t += ` Il router NAT ha IP ${ex.routerLan} sul lato LAN e IP pubblico ${ex.pub}.`;
    const dest = ex.servers.length > 1 ? 'il suo server' : 'il server';
    t += ` Le frecce numerate indicano: 1) dati dall'host 1 verso ${dest}, prima del NAT; 2) gli stessi dati dopo il NAT; 3) dati da ${dest} verso l'host 1, prima del NAT; 4) gli stessi dati dopo il NAT; 5-8) lo stesso per l'host 2` +
      (NH === 3 ? '; 9-12) lo stesso per l\'host 3.' : '.');
    return t;
  }
  function bText(ex) { const s = sameTxt(ex); return `b) ${s.who} usano la stessa porta sorgente ${s.port}: perché il NAT ha assegnato porte diverse sul lato WAN?`; }
  function cText(ex) { return `c) Un host esterno invia un segmento TCP a ${ex.pub} porta ${ex.cPort}.`; }
  function c2Text(ex) { return `Cosa servirebbe per far arrivare la connessione all'host ${ex.cHost + 1}?`; }
  const rowLabel = (ex, f) => `${f.n} · ${dirTxt(ex, f)}, ${KIND[f.kind].phase}`;
  const natRows = ex => ex.hosts.map(h => [U.given(`${ex.pub}, ${h.wanPort}`), U.given(`${h.ip}, ${h.lanPort}`)]);

  function render(ex, root, ctx) {
    root.appendChild(U.h('div', { class: 'card intro' },
      U.h('p', {}, U.h('b', {}, 'Testo. '), introText(ex)),
      U.fig(figure(ex), 'Frecce piene: dati verso il server · tratteggiate: risposte. Il numero nel cerchio è il flusso.'),
      U.h('p', { class: 'small' }, U.h('b', {}, 'NAT translation table')),
      U.table(['WAN (IP, porta)', 'LAN (IP, porta)'], natRows(ex))));

    root.appendChild(U.card('a) Indicare IP e porte di sorgente e destinazione per ciascun flusso', { step: 'lan' },
      U.table(['Flusso', 'IP sorgente', 'IP destinazione', 'Porta sorg.', 'Porta dest.'],
        ex.flows.map(f => [U.label(rowLabel(ex, f))].concat(FIELDS.map(c =>
          U.inp(ctx, fkey(f.n, c), { w: c.endsWith('Ip') ? 'm' : 's', label: `flusso ${f.n}, ${FNAME[c]}` })))))));

    if (ex.askB) {
      root.appendChild(U.card(bText(ex), { step: 'q' },
        U.h('div', { class: 'q-item' }, U.sel(ctx, 'b', bOptions(ex), { label: 'risposta b' }))));
    }
    if (ex.askC) {
      root.appendChild(U.card(cText(ex), { step: 'q' },
        U.h('div', { class: 'q-item' }, U.h('div', { class: 'q-text' }, 'Cosa fa il NAT?'),
          U.sel(ctx, 'c1', c1Options(ex), { label: 'risposta c, cosa fa il NAT' })),
        U.h('div', { class: 'q-item' }, U.h('div', { class: 'q-text' }, c2Text(ex)),
          U.sel(ctx, 'c2', c2Options(ex), { label: 'risposta c, cosa servirebbe' }))));
    }
  }

  function solution(ex, root) {
    const usedRow = f => {
      const h = ex.hosts[f.h];
      const col = f.side === 'LAN' ? `colonna LAN (${h.ip}, ${h.lanPort})` : `colonna WAN (${ex.pub}, ${h.wanPort})`;
      const from = f.kind === 2 ? ` · flusso ${f.n - 1} scambiato` : f.kind === 3 ? ` · flusso ${f.n - 3} scambiato` : '';
      return `${h.name}, ${col}${from}`;
    };
    const lanIps = ex.hosts.map(h => h.ip).join(', ');
    const srvList = ex.servers.map(s => `${s.ip}:${s.port}`).join(' e ');
    const checks = [
      `Il lato server non cambia: ${srvList} ${ex.servers.length > 1 ? 'compaiono in tutte le righe del rispettivo host' : 'compare in tutte le righe'}.`,
      `Gli IP privati (${lanIps}) solo nelle righe lato LAN (flussi ${ex.flows.filter(f => f.side === 'LAN').map(f => f.n).join(', ')}); l'IP pubblico ${ex.pub} solo in quelle lato WAN.`,
      'Ogni host ha una sola porta privata e una sola porta WAN, le stesse in andata e ritorno: ' +
        ex.hosts.map(h => `${h.name} ${h.lanPort} ↔ ${h.wanPort}`).join('; ') + '.',
      'Simmetria: il ritorno è l\'andata dello stesso lato con sorgente e destinazione scambiate.'
    ];
    const kids = [
      U.h('h4', {}, 'Soluzione'),
      U.h('p', { class: 'sol-body' }, 'Per ogni freccia: (1) il lato, (2) la direzione, (3) la riga della tabella. La tabella NAT dà la coppia di ogni host:'),
      U.table(['Host', 'LAN (IP, porta)', 'WAN (IP, porta)'], ex.hosts.map(h => [U.label(h.name), `${h.ip}, ${h.lanPort}`, `${ex.pub}, ${h.wanPort}`])),
      U.h('p', { class: 'sol-body' }, U.h('b', {}, 'a) '), 'I flussi:'),
      U.table(['Flusso', 'Direzione', 'Lato', 'IP sorgente', 'IP destinazione', 'Porta sorg.', 'Porta dest.', 'Riga della tabella usata'],
        ex.flows.map(f => [U.label(String(f.n)), `${dirTxt(ex, f)}, ${KIND[f.kind].phase}`, f.side, f.srcIp, f.dstIp, String(f.srcPort), String(f.dstPort), usedRow(f)])),
      U.h('p', { class: 'sol-body' }, U.h('b', {}, 'Controllo rapido (30 secondi)')),
      U.h('ul', { class: 'sol-body' }, checks.map(t => U.h('li', {}, t)))
    ];
    if (ex.askB) {
      const s = sameTxt(ex);
      kids.push(U.h('p', { class: 'sol-body' }, U.h('b', {}, 'b) '),
        `${qMsg(ex, 'b')} Sul lato LAN non c'è conflitto, perché gli IP privati sono diversi. Se il NAT avesse usato la stessa porta WAN, una risposta verso ${ex.pub}:${s.port} potrebbe essere dell'${s.hosts.map(h => h.name).join(' o dell\'')}: il NAT non saprebbe a chi consegnarla.` +
        (ex.servers.length > 1 ? ' Vale anche con server diversi: la tabella del NAT associa la coppia (IP pubblico, porta WAN) a un solo host.' : '')));
    }
    if (ex.askC) {
      kids.push(U.h('p', { class: 'sol-body' }, U.h('b', {}, 'c) '),
        `${qMsg(ex, 'c1')} Le righe dinamiche si creano solo quando un host della LAN apre una connessione verso l'esterno. ${qMsg(ex, 'c2')}`));
    }
    root.appendChild(U.h('div', { class: 'card sol' }, kids));
  }

  function chatText(ex, a) {
    const v = k => (a && String(a[k] == null ? '' : a[k]).trim()) || '__';
    const optLabel = (opts, k) => { const o = opts.find(x => x[0] === (a && a[k])); return o ? o[1] : '__'; };
    const L = [];
    L.push(`#3 · NAT (livello ${ex.level})`);
    L.push('## Testo');
    L.push(introText(ex));
    L.push('Tabella di traduzione NAT (WAN ↔ LAN): ' + ex.hosts.map(h => `[${ex.pub}, ${h.wanPort}] ↔ [${h.ip}, ${h.lanPort}]`).join('; ') + '.');
    L.push('a) Indicare IP e porte di sorgente e destinazione per ciascun flusso.');
    if (ex.askB) L.push(bText(ex));
    if (ex.askC) L.push(`${cText(ex)} Cosa succede? ${c2Text(ex)}`);
    L.push('');
    L.push('## Le mie risposte');
    ex.flows.forEach(f => {
      L.push(`- Flusso ${rowLabel(ex, f)}: IP sorgente ${v(fkey(f.n, 'srcIp'))} | IP dest. ${v(fkey(f.n, 'dstIp'))} | porta sorg. ${v(fkey(f.n, 'srcPort'))} | porta dest. ${v(fkey(f.n, 'dstPort'))}`);
    });
    if (ex.askB) L.push(`- b) ${optLabel(bOptions(ex), 'b')}`);
    if (ex.askC) {
      L.push(`- c) Cosa fa il NAT: ${optLabel(c1Options(ex), 'c1')}`);
      L.push(`- c) Cosa servirebbe: ${optLabel(c2Options(ex), 'c2')}`);
    }
    return L.join('\n');
  }

  // ---------------- tracce ----------------
  const SIM = {
    level: 4, pub: '82.54.12.200', lanNet: '192.168.1.0/24', routerLan: '192.168.1.1',
    hosts: [{ ip: '192.168.1.10', lanPort: 51000, wanPort: 6001, srv: 0 }, { ip: '192.168.1.20', lanPort: 51000, wanPort: 6002, srv: 0 }],
    servers: [{ ip: '151.101.1.69', port: 443 }],
    askB: true, askC: true, cPort: 8080, cHost: 0
  };
  const GUIDA = {
    level: 1, pub: '128.86.129.71', lanNet: '10.0.0.0/24', routerLan: '10.0.0.1',
    hosts: [{ ip: '10.0.0.2', lanPort: 3346, wanPort: 5001, srv: 0 }, { ip: '10.0.0.3', lanPort: 4419, wanPort: 5002, srv: 0 }],
    servers: [{ ip: '141.82.41.78', port: 80 }],
    askB: false, askC: false, cPort: null, cHost: null
  };
  // le 8 righe come nelle soluzioni dei PDF: [IP sorg., IP dest., porta sorg., porta dest.]
  function expectOf(rows, extra) {
    const e = {};
    rows.forEach((r, i) => FIELDS.forEach((c, j) => { e[fkey(i + 1, c)] = String(r[j]); }));
    return Object.assign(e, extra || {});
  }

  RA.nat = {
    id: 'nat', num: '3', name: 'NAT', examPoints: 5, extra: false,
    desc: 'IP e porte di ogni flusso prima e dopo il NAT, porte WAN diverse, segmenti in ingresso senza riga.',
    method: {
      intro: 'Esercizio meccanico: per ogni freccia decidi lato e direzione, poi copia i valori dalla riga giusta della tabella NAT. Se applichi le regole non sbagli.',
      steps: [
        'Il lato: da che parte del router è la freccia? Lato LAN → compare l\'IP privato dell\'host. Lato WAN → compare l\'IP pubblico del NAT.',
        'La direzione: verso il server, sorgente = host (o NAT) e destinazione = server; dal server, il contrario. Per le risposte scambia sorgente e destinazione della riga di andata sullo stesso lato.',
        'La riga: prendi i valori dalla riga dell\'host giusto, colonna LAN per i flussi lato LAN e colonna WAN per quelli lato WAN. IP e porta del server restano sempre quelli noti.',
        'Controllo rapido: il server compare in tutte le righe; IP privati solo lato LAN, IP pubblico solo lato WAN; ogni host ha sempre la stessa porta privata e la stessa porta WAN.'
      ],
      traps: [
        'Per i flussi dal server, "prima del NAT" è il lato WAN e "dopo il NAT" è il lato LAN: il contrario dei flussi in uscita.',
        'Il NAT non tocca mai IP e porta del server.',
        'L\'IP LAN del router non compare nei flussi: il router traduce, ma non è un estremo della connessione.',
        'Due host con la stessa porta privata hanno porte WAN diverse: usa sempre la riga dell\'host giusto.',
        'Un segmento in ingresso su una porta senza riga viene scartato: le righe dinamiche nascono solo dal traffico in uscita (serve il port forwarding).'
      ],
      formulas: [
        ['Classi private', '10.0.0.0/8 · 172.16.0.0/12 · 192.168.0.0/16'],
        ['In uscita', 'sorgente (IP privato, porta LAN) → (IP pubblico, porta WAN)'],
        ['In entrata', 'destinazione (IP pubblico, porta WAN) → (IP privato, porta LAN)'],
        ['Connessioni per IP pubblico', 'porta a 16 bit → circa 65.000'],
        ['Cosa ricalcola il NAT', 'checksum IP e checksum TCP/UDP (lo pseudo-header contiene gli IP)'],
        ['Port forwarding', 'riga statica: IP pubblico:porta → IP privato:porta'],
        ['Critiche', 'viola end-to-end e stratificazione (un dispositivo L3 cambia campi L4); soluzione: IPv6']
      ]
    },
    traces: [
      {
        id: 'sim-nat', set: 'simulato',
        title: 'Esame simulato · NAT (82.54.12.200)',
        source: 'Esame_Simulato_TESTO.pdf pag. 4-5 · soluzioni pag. 4-5',
        params: SIM,
        expect: expectOf([
          ['192.168.1.10', '151.101.1.69', 51000, 443],
          ['82.54.12.200', '151.101.1.69', 6001, 443],
          ['151.101.1.69', '82.54.12.200', 443, 6001],
          ['151.101.1.69', '192.168.1.10', 443, 51000],
          ['192.168.1.20', '151.101.1.69', 51000, 443],
          ['82.54.12.200', '151.101.1.69', 6002, 443],
          ['151.101.1.69', '82.54.12.200', 443, 6002],
          ['151.101.1.69', '192.168.1.20', 443, 51000]
        ], { b: 'dist', c1: 'drop', c2: 'fwd' })
      },
      {
        id: 'guida3-nat',
        title: 'Guida 3 · NAT (128.86.129.71)',
        source: 'Guida_3_NAT.pdf pag. 1-2',
        params: GUIDA,
        expect: expectOf([
          ['10.0.0.2', '141.82.41.78', 3346, 80],
          ['128.86.129.71', '141.82.41.78', 5001, 80],
          ['141.82.41.78', '128.86.129.71', 80, 5001],
          ['141.82.41.78', '10.0.0.2', 80, 3346],
          ['10.0.0.3', '141.82.41.78', 4419, 80],
          ['128.86.129.71', '141.82.41.78', 5002, 80],
          ['141.82.41.78', '128.86.129.71', 80, 5002],
          ['141.82.41.78', '10.0.0.3', 80, 4419]
        ])
      }
    ],
    randomParams, build, gen, steps, grade, sol2answers, render, solution, hints, fieldHint, diagnose, diagnoseCases, chatText
  };
})();
