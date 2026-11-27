// ============================================================
// RetiApp · gen-l2.js — Seconda parte · Esercizio 1 · ARP, switch e VLAN
// Contratto dei moduli: vedi docs/moduli.md (modello: gen-nat.js)
// Il simulatore segue le tre "logiche di funzionamento" del corso
// (logica-Host.pdf, logica-Router.pdf, logica-Switch.pdf).
// ============================================================
(function () {
  const RA = window.RetiApp;
  const U = RA.util;

  const BCAST = 'FF:FF';
  const NAMES = 'ABCDEFGHILMNOPQRSTUVZ'.split('');
  const TYPES = [['arpReq', 'ARP request'], ['arpRep', 'ARP reply'], ['icmpReq', 'ICMP echo request'], ['icmpRep', 'ICMP echo reply']];
  const TNAME = Object.fromEntries(TYPES);
  const COLS = ['type', 'ms', 'md', 'is', 'id'];
  const CNAME = { type: 'tipo', ms: 'MAC sorgente', md: 'MAC destinazione', is: 'IP sorgente', id: 'IP destinazione (ARP: IP cercato)' };
  const OUTS = [
    ['noarp', 'La ARP request resta senza risposta: il ping non parte'],
    ['rarp', 'Il router inoltra verso la VLAN giusta, ma la sua ARP request resta senza risposta'],
    ['rdrop', 'Il router non ha una rotta per quella rete: scarta il pacchetto'],
    ['ok', 'Il ping riesce']
  ];

  // ---------------- helper di rete ----------------
  const ipInt = s => U.ip2int(s);
  const net24 = ip => (ipInt(ip) & 0xFFFFFF00) >>> 0;
  const sameNet = (a, b) => net24(a) === net24(b);
  const normMac = v => String(v == null ? '' : v).trim().toUpperCase().replace(/[-.\s]/g, ':');
  function macEq(v, sol) {
    const m = normMac(v);
    if (sol === BCAST) return m === 'FF:FF' || m === 'FF:FF:FF:FF:FF:FF' || m === 'BROADCAST';
    return m === sol;
  }
  // accetta l'IP completo o la forma breve del testo ("1.3" per 192.168.1.3)
  function ipEq(v, sol) {
    const s = String(v == null ? '' : v).trim();
    if (!s) return false;
    const n = ipInt(s);
    if (n !== null) return n === ipInt(sol);
    return /^\d{1,3}\.\d{1,3}$/.test(s) && sol.endsWith('.' + s);
  }
  const short = ip => ip.split('.').slice(2).join('.');
  const hx = () => U.pick('0123456789ABCDEF'.split('')) + U.pick('0123456789ABCDEF'.split(''));

  // ---------------- topologia ----------------
  function topo(p) {
    const T = { p, nsw: p.nsw, vlans: p.vlans, devs: [] };
    T.vlanOfPort = (s, port) => {
      if (port === '24') return null;
      if (port === 'G1' || port === 'G2') { const r = (p.router || []).find(x => x.ifn === port); return r ? r.vlan : null; }
      return p.portVlan[port];
    };
    T.ports = s => {
      const ps = Object.keys(p.portVlan).sort((a, b) => Number(a) - Number(b));
      if (s === 0 && p.router) p.router.forEach(r => ps.push(r.ifn));
      if (p.nsw > 1) ps.push('24');
      return ps;
    };
    T.isTrunk = port => port === '24';
    p.hosts.forEach(h => T.devs.push({ name: h.n, kind: 'host', ip: h.ip, mac: h.mac, sw: h.sw, port: String(h.port), vlan: p.portVlan[h.port] }));
    (p.router || []).forEach(r => T.devs.push({ name: 'R', ifn: r.ifn, kind: 'router', ip: r.ip, mac: r.mac, sw: 0, port: r.ifn, vlan: r.vlan }));
    T.label = d => d.kind === 'router' ? `R (${d.ifn})` : d.name;
    T.at = (s, port) => T.devs.find(d => d.sw === s && d.port === port) || null;
    T.byMac = mac => T.devs.find(d => d.mac === mac) || null;
    T.byIp = ip => T.devs.find(d => d.ip === ip) || null;
    T.host = n => T.devs.find(d => d.kind === 'host' && d.name === n) || null;
    T.vlanInfo = v => p.vlans.find(x => x.id === v);
    T.rif = v => T.devs.find(d => d.kind === 'router' && d.vlan === v) || null;
    return T;
  }

  // ---------------- simulatore ----------------
  function newState(T) {
    const p = T.p;
    const st = { arp: {}, sw: [] };
    T.devs.forEach(d => { st.arp[d.name] = st.arp[d.name] || {}; });
    Object.keys(p.arp || {}).forEach(n => (p.arp[n] || []).forEach(([ip, mac]) => { st.arp[n][ip] = mac; }));
    if (p.router) {
      const known = p.rArp === 'all' ? T.devs.filter(d => d.kind === 'host').map(d => d.ip) : (p.rArp || []);
      known.forEach(ip => { const d = T.byIp(ip); if (d) st.arp.R[ip] = d.mac; });
    }
    for (let s = 0; s < T.nsw; s++) st.sw.push(((p.swInit && p.swInit[s]) || []).map(e => ({ mac: e[0], port: String(e[1]), vlan: e[2], init: true })));
    return st;
  }

  // consegna a livello 2: riempie fr.sw con l'azione di ogni switch, restituisce i dispositivi raggiunti
  function deliver(T, st, fr, from) {
    fr.sw = Array.from({ length: T.nsw }, () => ({ act: 'none' }));
    const got = [];
    const visit = (s, inPort, vlan) => {
      const tab = st.sw[s];
      const info = fr.sw[s];
      info.inPort = inPort;
      const e = tab.find(x => x.mac === fr.ms && x.vlan === vlan);
      if (!e) { tab.push({ mac: fr.ms, port: inPort, vlan, by: fr.key }); info.learned = true; }
      else if (e.port !== inPort) { e.port = inPort; e.by = fr.key; info.learned = true; info.moved = true; }
      let outs;
      const flood = () => T.ports(s).filter(q => q !== inPort && (T.isTrunk(q) || T.vlanOfPort(s, q) === vlan));
      if (fr.md === BCAST) { info.act = 'flood'; info.why = 'bcast'; outs = flood(); }
      else {
        const d = tab.find(x => x.mac === fr.md && x.vlan === vlan);
        if (!d) { info.act = 'flood'; info.why = 'unknown'; outs = flood(); }
        else if (d.port === inPort) { info.act = 'drop'; info.why = 'same'; outs = []; }
        else { info.act = 'p:' + d.port; info.why = 'known'; outs = [d.port]; }
      }
      outs.forEach(q => {
        if (T.isTrunk(q)) visit(1 - s, '24', vlan);
        else { const dv = T.at(s, q); if (dv) got.push(dv); }
      });
    };
    visit(from.sw, from.port, from.vlan);
    fr.reach = got.map(d => T.label(d));
    return got;
  }

  function emit(T, st, run, fr, from) {
    fr.n = run.frames.length + 1;
    fr.key = `${run.tag}.f${fr.n}`;
    fr.from = T.label(from);
    run.frames.push(fr);
    return deliver(T, st, fr, from);
  }

  // ARP: restituisce il MAC di ip oppure null (nessuna risposta)
  function resolve(T, st, run, dev, ip) {
    const tbl = st.arp[dev.name];
    if (tbl[ip]) return tbl[ip];
    const got = emit(T, st, run, { t: 'arpReq', ms: dev.mac, md: BCAST, is: dev.ip, id: ip }, dev);
    const tgt = got.find(d => d.ip === ip);
    if (!tgt) return null;
    st.arp[tgt.name][dev.ip] = dev.mac; // il destinatario della request impara il mittente
    const got2 = emit(T, st, run, { t: 'arpRep', ms: tgt.mac, md: dev.mac, is: tgt.ip, id: dev.ip }, tgt);
    if (!got2.includes(dev)) throw new Error('ARP reply non consegnata');
    tbl[ip] = tgt.mac;
    return tgt.mac;
  }

  // invio di un datagramma (ping o risposta) da un host; il router inoltra
  function sendIp(T, st, run, dev, pkt) {
    const same = sameNet(dev.ip, pkt.dst);
    const gwIf = T.rif(dev.vlan);
    if (!same && !gwIf) return { fail: 'nogw' };
    const nh = same ? pkt.dst : gwIf.ip;
    const mac = resolve(T, st, run, dev, nh);
    if (!mac) return { fail: same ? 'noarp' : 'nogwarp' };
    const got = emit(T, st, run, { t: pkt.t, ms: dev.mac, md: mac, is: pkt.src, id: pkt.dst }, dev);
    const rcv = got.find(d => d.mac === mac);
    if (!rcv) throw new Error('frame non consegnato');
    if (rcv.kind !== 'router') return { ok: true, at: rcv };
    // router: logica di inoltro
    const out = T.devs.find(d => d.kind === 'router' && sameNet(d.ip, pkt.dst));
    if (!out) return { fail: 'rdrop' };
    const m2 = resolve(T, st, run, out, pkt.dst);
    if (!m2) return { fail: 'rarp' };
    const got2 = emit(T, st, run, { t: pkt.t, ms: out.mac, md: m2, is: pkt.src, id: pkt.dst }, out);
    const r2 = got2.find(d => d.mac === m2);
    if (!r2) throw new Error('frame del router non consegnato');
    return { ok: true, at: r2 };
  }

  function ping(T, st, run, from, to) {
    const r = sendIp(T, st, run, from, { t: 'icmpReq', src: from.ip, dst: to });
    if (!r.ok) return r;
    const back = sendIp(T, st, run, r.at, { t: 'icmpRep', src: r.at.ip, dst: from.ip });
    if (!back.ok) throw new Error('risposta del ping non consegnata');
    return { ok: true };
  }

  const tblCopy = st => st.sw.map(t => t.map(e => Object.assign({}, e)));
  const arpCopy = st => JSON.parse(JSON.stringify(st.arp));

  // ---------------- costruzione ----------------
  function build(p) {
    const T = topo(p);
    const st = newState(T);
    const startArp = arpCopy(st);
    const startSw = tblCopy(st);
    const tests = p.tests.map((t, i) => {
      const run = { tag: `t${i + 1}`, frames: [] };
      const from = T.host(t.from);
      const res = ping(T, st, run, from, t.to);
      if (!res.ok) throw new Error(`test ${i + 1} non riesce (${res.fail})`);
      return { i: i + 1, from: t.from, to: t.to, toName: T.byIp(t.to).name, frames: run.frames, sw: tblCopy(st), arp: arpCopy(st) };
    });
    const finalSw = tblCopy(st);
    const fails = (p.fails || []).map((t, k) => {
      const run = { tag: `x${k + 1}`, frames: [] };
      const from = T.host(t.from);
      const res = ping(T, st, run, from, t.to);
      if (res.ok) throw new Error('il test impossibile riesce');
      const f = run.frames[0];
      return { i: k + 1, from: t.from, to: t.to, first: { t: f.t, md: f.md, id: f.id, ms: f.ms }, out: res.fail === 'nogwarp' ? 'noarp' : res.fail, frames: run.frames };
    });
    const macs = T.devs.map(d => ({ label: T.label(d), mac: d.mac, vlan: d.vlan }));
    return {
      cat: 'l2', level: p.level, params: p,
      nsw: p.nsw, vlans: p.vlans, router: p.router, portVlan: p.portVlan,
      hosts: T.devs.filter(d => d.kind === 'host').map(d => ({ n: d.name, ip: d.ip, mac: d.mac, sw: d.sw, port: d.port, vlan: d.vlan })),
      startArp, startSw, rArp: p.rArp || null,
      tests, fails, macs,
      table: macs.map(m => ({ mac: m.mac, label: m.label, vlan: m.vlan, ports: finalSw.map(t => { const e = t.find(x => x.mac === m.mac && x.vlan === m.vlan); return e ? e.port : '-'; }) }))
    };
  }

  // ---------------- parametri casuali ----------------
  function macs(n, avoid) {
    const out = [];
    while (out.length < n) { const m = `${hx()}:${hx()}`; if (m !== BCAST && !out.includes(m) && !(avoid || []).includes(m)) out.push(m); }
    return out;
  }
  function randomParams(level) {
    for (let t = 0; t < 200; t++) {
      try { const p = tryParams(level); build(p); return p; } catch (e) { /* riprova */ }
    }
    throw new Error('generatore l2: nessuna configurazione valida');
  }
  function tryParams(level) {
    const twoVlan = level >= 3;
    const nsw = level === 1 ? 1 : 2;
    const vid = level <= 3 ? [1, 2] : U.pick([[1, 2], [10, 20], [2, 3], [100, 200]]);
    let bases;
    if (level <= 3) { const a = U.pick([1, 10, 0, 5]); bases = [`192.168.${a}`, `192.168.${a + 1}`]; }
    else bases = U.pick([[`10.${U.rndInt(0, 50)}.1`, null], [`172.${U.rndInt(16, 31)}.10`, null], [`192.168.${U.rndInt(20, 60)}`, null]]).map((b, i) => b || null);
    if (level > 3) { const pre = bases[0].split('.').slice(0, 2).join('.'); const c = Number(bases[0].split('.')[2]); bases = [bases[0], `${pre}.${c + U.pick([1, 10, 2])}`]; }
    const gwOct = level >= 4 ? U.pick([1, 254]) : 1;
    const vlans = (twoVlan ? [0, 1] : [0]).map(i => ({ id: vid[i], net: `${bases[i]}.0`, gw: twoVlan ? `${bases[i]}.${gwOct}` : null }));
    const portVlan = {};
    for (let q = 1; q <= 6; q++) portVlan[String(q)] = twoVlan ? (q <= 3 ? vid[0] : vid[1]) : vid[0];
    // host
    let slots = [];
    for (let s = 0; s < nsw; s++) for (let q = 1; q <= 6; q++) slots.push({ sw: s, port: String(q) });
    let nh = level === 1 ? 4 : level === 2 ? 6 : level === 3 ? 8 : U.rndInt(9, 12);
    let chosen;
    if (twoVlan) {
      // almeno due host per VLAN per switch
      chosen = [];
      for (let s = 0; s < nsw; s++) [[1, 2, 3], [4, 5, 6]].forEach(g => U.sample(g, 2).forEach(q => chosen.push({ sw: s, port: String(q) })));
      const rest = U.shuffle(slots.filter(x => !chosen.some(c => c.sw === x.sw && c.port === x.port)));
      chosen = chosen.concat(rest.slice(0, Math.max(0, nh - chosen.length)));
    } else chosen = U.sample(slots, nh);
    chosen.sort((a, b) => a.sw - b.sw || Number(a.port) - Number(b.port));
    const ms = macs(chosen.length + 2);
    const usedOct = {};
    const hosts = chosen.map((c, i) => {
      const v = portVlan[c.port];
      const vi = vlans.findIndex(x => x.id === v);
      const used = usedOct[vi] = usedOct[vi] || [gwOct];
      let o; do { o = level <= 3 ? U.rndInt(2, 60) : U.rndInt(2, 250); } while (used.includes(o));
      used.push(o);
      return { n: NAMES[i], sw: c.sw, port: c.port, ip: `${bases[vi]}.${o}`, mac: ms[i] };
    });
    const router = twoVlan ? vlans.map((v, i) => ({ ifn: 'G' + (i + 1), vlan: v.id, ip: v.gw, mac: ms[chosen.length + i] })) : null;
    const vOf = h => portVlan[h.port];
    // sorgente: host della prima VLAN sullo switch 1
    const srcCands = hosts.filter(h => vOf(h) === vid[0] && h.sw === 0);
    const X = U.pick(srcCands);
    const sameSw = hosts.filter(h => h !== X && vOf(h) === vid[0] && h.sw === X.sw);
    const otherSw = hosts.filter(h => vOf(h) === vid[0] && h.sw !== X.sw);
    const arp = {}; const add = (n, ip, mac) => { (arp[n] = arp[n] || []).push([ip, mac]); };
    const tests = [];
    const t1 = U.pick(sameSw);
    tests.push({ from: X.n, to: t1.ip });
    if (level === 1) {
      const t2 = U.pick(sameSw.filter(h => h !== t1));
      tests.push({ from: X.n, to: t2.ip });
      add(X.n, t2.ip, t2.mac); add(t2.n, X.ip, X.mac);
    } else {
      const t2 = U.pick(otherSw);
      tests.push({ from: X.n, to: t2.ip });
      add(X.n, t2.ip, t2.mac);
      if (level === 3 || U.chance(level === 2 ? 0.3 : 0.6)) add(t2.n, X.ip, X.mac);
    }
    let rArp = null, swInit = null;
    const fails = [];
    if (twoVlan) {
      const other = hosts.filter(h => vOf(h) === vid[1]);
      const t3 = U.pick(level >= 4 ? other : other.filter(h => h.sw !== X.sw).concat(other).slice(0, 3));
      tests.push({ from: X.n, to: t3.ip });
      if (level === 3 || U.chance(0.5)) add(X.n, vlans[0].gw, router[0].mac);
      if (level >= 4 && U.chance(0.35)) add(t3.n, vlans[1].gw, router[1].mac);
      rArp = 'all';
      if (level === 5) {
        // il router non conosce ancora un host; un secondo host fa un ping
        const unk = U.pick(hosts.filter(h => h !== X));
        rArp = hosts.filter(h => h !== unk).map(h => h.ip);
        const Y = U.pick(hosts.filter(h => h !== X && vOf(h) === vid[1]));
        const yTo = U.pick(hosts.filter(h => vOf(h) === vid[0] && h !== X));
        tests.push({ from: Y.n, to: yTo.ip });
        // tabelle iniziali: righe rimaste da traffico precedente (lo switch 1 ha già cancellato quella del router)
        swInit = [[], []];
        swInit[1].push([router[0].mac, '24', vid[0]]);
        const s2h = hosts.filter(h => h.sw === 1);
        if (s2h.length) { const z = U.pick(s2h); swInit[1].push([z.mac, z.port, vOf(z)]); swInit[0].push([z.mac, '24', vOf(z)]); }
      }
      if (level >= 4) {
        const usedA = hosts.filter(h => vOf(h) === vid[0]).map(h => Number(h.ip.split('.')[3])).concat([gwOct]);
        let o; do { o = U.rndInt(2, 250); } while (usedA.includes(o));
        fails.push({ from: X.n, to: `${bases[0]}.${o}` });
        if (U.chance(0.5)) {
          const usedB = other.map(h => Number(h.ip.split('.')[3])).concat([gwOct]);
          let o2; do { o2 = U.rndInt(2, 250); } while (usedB.includes(o2));
          fails.push({ from: X.n, to: `${bases[1]}.${o2}` });
        } else {
          const pre = bases[0].split('.').slice(0, 2).join('.');
          fails.push({ from: X.n, to: `${pre}.${Number(bases[1].split('.')[2]) + U.rndInt(3, 9)}.${U.rndInt(2, 250)}` });
        }
      }
    }
    return { level, nsw, vlans, router, portVlan, hosts, arp, rArp, swInit, tests, fails };
  }
  const gen = level => build(randomParams(level));

  // ---------------- chiavi ----------------
  const fk = (t, f, c) => `t${t}.f${f}.${c}`;
  const swCols = ex => Array.from({ length: ex.nsw }, (_, s) => 's' + (s + 1));
  const frameCols = ex => COLS.concat(swCols(ex));
  const xKeys = k => [`x${k}.type`, `x${k}.md`, `x${k}.id`, `x${k}.out`];
  const tabKey = (s, m) => `tab.s${s + 1}.${m.mac}@${m.vlan}`;
  function steps(ex) {
    const out = ex.tests.map(t => ({ id: 't' + t.i, title: `Test ${t.i}: ping ${short(t.to)}`, keys: t.frames.flatMap(f => frameCols(ex).map(c => fk(t.i, f.n, c))) }));
    if (ex.fails.length) out.push({ id: 'x', title: 'Ping impossibili: primo frame', keys: ex.fails.flatMap(x => xKeys(x.i)) });
    out.push({ id: 'tab', title: 'Tabelle degli switch', keys: ex.table.flatMap(m => m.ports.map((_, s) => tabKey(s, m))) });
    return out;
  }
  function parse(key) {
    let m = /^t(\d+)\.f(\d+)\.(\w+)$/.exec(key);
    if (m) return { kind: 'f', t: Number(m[1]), f: Number(m[2]), c: m[3] };
    m = /^x(\d+)\.(\w+)$/.exec(key);
    if (m) return { kind: 'x', k: Number(m[1]), c: m[2] };
    m = /^tab\.s(\d)\.(.+)@(\d+)$/.exec(key);
    if (m) return { kind: 'tab', s: Number(m[1]) - 1, mac: m[2], vlan: Number(m[3]) };
    return null;
  }
  const frameOf = (ex, pk) => { const t = ex.tests[pk.t - 1]; return t ? t.frames[pk.f - 1] : null; };
  const solVal = (f, c) => c === 'type' ? f.t : c.startsWith('s') && c.length === 2 ? f.sw[Number(c[1]) - 1].act : f[c];

  // ---------------- descrizioni ----------------
  const devName = (ex, mac) => { if (mac === BCAST) return 'broadcast'; const m = ex.macs.find(x => x.mac === mac); return m ? m.label : mac; };
  const ipName = (ex, ip) => { const h = ex.hosts.find(x => x.ip === ip); if (h) return h.n; const r = (ex.router || []).find(x => x.ip === ip); return r ? `R (${r.ifn})` : ip; };
  function actTxt(a) {
    if (a === 'none') return 'non lo riceve';
    if (a === 'flood') return 'flooding';
    if (a === 'drop') return 'scarta (destinazione sulla porta d\'ingresso)';
    return 'inoltra su porta ' + a.slice(2);
  }
  function frameTxt(ex, f) {
    const v = f.t.startsWith('arp') ? (f.t === 'arpReq' ? `chi ha ${f.id}? (da ${f.is})` : `${f.is} è ${f.ms}`) : `${f.is} → ${f.id}`;
    return `${TNAME[f.t]} da ${f.from}: MAC ${f.ms} → ${f.md === BCAST ? 'FF:FF (broadcast)' : f.md} · ${v}`;
  }
  function swWhy(ex, f, s) {
    const i = f.sw[s];
    const sn = `SWITCH ${s + 1}`;
    if (i.act === 'none') return `${sn} non riceve il frame: ${s === 0 ? 'SWITCH 2' : 'SWITCH 1'} non lo manda sulla porta 24.`;
    const learn = i.learned ? `impara ${f.ms} (${devName(ex, f.ms)}) sulla porta ${i.inPort}` : `conosce già ${f.ms} sulla porta ${i.inPort}`;
    if (i.why === 'bcast') return `${sn} riceve dalla porta ${i.inPort}, ${learn}; destinazione broadcast → flooding su tutte le porte della VLAN tranne la ${i.inPort}${ex.nsw > 1 ? ' (trunk 24 compreso)' : ''}.`;
    if (i.why === 'unknown') return `${sn} riceve dalla porta ${i.inPort}, ${learn}; non conosce ancora ${f.md} (${devName(ex, f.md)}) → flooding nella VLAN.`;
    if (i.why === 'same') return `${sn} riceve dalla porta ${i.inPort}, ${learn}; sa che ${f.md} sta proprio dietro la porta ${i.inPort} → scarta il frame (filtering).`;
    return `${sn} riceve dalla porta ${i.inPort}, ${learn}; sa già che ${f.md} (${devName(ex, f.md)}) è sulla porta ${i.act.slice(2)} → inoltra solo lì.`;
  }
  function frameWhy(ex, t, f) {
    const from = f.from;
    if (f.t === 'arpReq') return `${from} deve mandare un frame a ${f.id} ma non ne conosce il MAC: ARP request in broadcast (MAC dest FF:FF), IP cercato ${f.id}.`;
    if (f.t === 'arpRep') return `${from} riconosce il proprio IP nella request: risponde in unicast a ${f.md} (${devName(ex, f.md)}) e intanto memorizza l'associazione ${f.id} ↔ ${f.md}.`;
    const toR = (ex.router || []).some(r => r.mac === f.md);
    const fromR = from.startsWith('R');
    const kind = f.t === 'icmpReq' ? 'richiesta' : 'risposta';
    if (fromR) return `Il router inoltra la ${kind}: rifà il frame con MAC sorgente quello dell'interfaccia di uscita (${f.ms}) e MAC destinazione ${f.md} (${devName(ex, f.md)}). Gli IP non cambiano: ${f.is} → ${f.id}.`;
    if (toR) return `${f.id} non è nella rete di ${from}: il frame va al gateway (MAC ${f.md}), ma l'IP di destinazione resta ${f.id}.`;
    return `${f.id} è nella stessa rete di ${from}: frame diretto a ${f.md} (${devName(ex, f.md)}).`;
  }

  // ---------------- correzione ----------------
  function fieldOk(c, v, sol) {
    if (c === 'ms' || c === 'md') return macEq(v, sol);
    if (c === 'is' || c === 'id') return ipEq(v, sol);
    return String(v == null ? '' : v).trim() === String(sol);
  }
  function grade(ex, a) {
    let correct = 0, total = 0;
    const marks = {};
    ex.tests.forEach(t => t.frames.forEach(f => frameCols(ex).forEach(c => {
      const k = fk(t.i, f.n, c);
      const sol = solVal(f, c);
      const ok = fieldOk(c, a[k], sol);
      total++; if (ok) correct++;
      let msg;
      if (c.length === 2 && c[0] === 's') msg = swWhy(ex, f, Number(c[1]) - 1);
      else msg = `Frame ${f.n}: ${CNAME[c]} = ${c === 'type' ? TNAME[sol] : sol}. ${frameWhy(ex, t, f)}`;
      marks[k] = { ok, msg };
    })));
    ex.fails.forEach(x => {
      const sol = { type: x.first.t, md: x.first.md, id: x.first.id, out: x.out };
      ['type', 'md', 'id', 'out'].forEach(c => {
        const k = `x${x.i}.${c}`;
        const ok = c === 'md' ? macEq(a[k], sol.md) : c === 'id' ? ipEq(a[k], sol.id) : String(a[k] == null ? '' : a[k]) === sol[c];
        total++; if (ok) correct++;
        marks[k] = { ok, msg: failWhy(ex, x) };
      });
    });
    ex.table.forEach(m => m.ports.forEach((port, s) => {
      const k = tabKey(s, m);
      const ok = String(a[k] == null ? '' : a[k]).trim() === port;
      total++; if (ok) correct++;
      marks[k] = { ok, msg: tabWhy(ex, m, s) };
    }));
    return { correct, total, marks };
  }
  function failWhy(ex, x) {
    const src = ex.hosts.find(h => h.n === x.from);
    const same = sameNet(src.ip, x.to);
    const f = x.first;
    let t = same ? `${x.to} è nella rete di ${x.from}, che non ne conosce il MAC: il primo frame è una ARP request in broadcast per ${x.to}.`
      : f.t === 'arpReq' ? `${x.to} non è nella rete di ${x.from}: serve il gateway, di cui ${x.from} non conosce il MAC → ARP request per ${f.id}.`
        : `${x.to} non è nella rete di ${x.from}: il primo frame è l'ICMP echo request diretto al MAC del gateway (${f.md}), con IP destinazione ${x.to}.`;
    if (x.out === 'noarp') t += ' Nessuno ha quell\'IP: la request resta senza risposta e il ping non parte.';
    if (x.out === 'rarp') t += ' Il router ha la rete in tabella (direttamente connessa) e fa una ARP request sull\'altra VLAN: nessuno risponde.';
    if (x.out === 'rdrop') t += ' Il router non ha una rotta per quella rete e scarta il pacchetto (al più risponde con ICMP destination unreachable, tipo 3).';
    return t;
  }
  function tabWhy(ex, m, s) {
    const port = m.ports[s];
    const sn = `SWITCH ${s + 1}`;
    if (port === '-') return `${sn} non ha mai ricevuto un frame con sorgente ${m.mac} (${m.label}) nella VLAN ${m.vlan}: nessuna riga.`;
    const by = findLearn(ex, m, s);
    return `${sn} ha imparato ${m.mac} (${m.label}) sulla porta ${port}${by ? ` (${by})` : ''}: è la porta da cui è arrivato un frame con quel MAC sorgente.`;
  }
  function findLearn(ex, m, s) {
    if ((ex.startSw[s] || []).some(e => e.mac === m.mac && e.vlan === m.vlan)) return 'riga già presente all\'inizio';
    for (const t of ex.tests) for (const f of t.frames) {
      if (f.ms === m.mac && f.sw[s] && f.sw[s].learned) return `test ${t.i}, frame ${f.n}`;
    }
    return null;
  }

  function sol2answers(ex) {
    const a = {};
    ex.tests.forEach(t => t.frames.forEach(f => frameCols(ex).forEach(c => { a[fk(t.i, f.n, c)] = String(solVal(f, c)); })));
    ex.fails.forEach(x => { a[`x${x.i}.type`] = x.first.t; a[`x${x.i}.md`] = x.first.md; a[`x${x.i}.id`] = x.first.id; a[`x${x.i}.out`] = x.out; });
    ex.table.forEach(m => m.ports.forEach((port, s) => { a[tabKey(s, m)] = port; }));
    return a;
  }

  // ---------------- errori tipici ----------------
  function diagnose(ex, key, value) {
    const v = String(value == null ? '' : value).trim();
    if (v === '') return null;
    const pk = parse(key);
    if (!pk) return null;
    if (pk.kind === 'tab') {
      const m = ex.table.find(x => x.mac === pk.mac && x.vlan === pk.vlan);
      if (!m) return null;
      const sol = m.ports[pk.s];
      if (v === sol) return null;
      const dev = ex.hosts.find(h => h.mac === m.mac);
      if (sol === '-') return `Riga inventata: SWITCH ${pk.s + 1} non ha mai visto passare un frame con sorgente ${m.mac}. Lo switch impara solo dal MAC sorgente dei frame che riceve.`;
      if (v === '-') return `Riga dimenticata: ${findLearn(ex, m, pk.s) || 'un frame'} con sorgente ${m.mac} è passato da SWITCH ${pk.s + 1}.`;
      if (dev && dev.sw !== pk.s && v === dev.port) return `${m.label} è collegato all'altro switch: SWITCH ${pk.s + 1} lo vede dietro la porta trunk 24, non sulla porta ${v}.`;
      return null;
    }
    if (pk.kind === 'x') {
      const x = ex.fails[pk.k - 1];
      if (!x) return null;
      if (pk.c === 'md' && x.first.md !== BCAST && macEq(v, BCAST)) return 'La destinazione è in un\'altra rete e il MAC del gateway è già noto: niente ARP, il frame va diretto al router.';
      if (pk.c === 'md' && x.first.md === BCAST && !macEq(v, BCAST)) return 'Per un IP sconosciuto serve prima una ARP request, sempre in broadcast (FF:FF).';
      if (pk.c === 'id' && (ex.router || []).some(r => r.ip === v || ipEq(v, r.ip)) && x.first.t === 'icmpReq') return 'Il MAC di destinazione è quello del gateway, ma l\'IP di destinazione resta quello che si vuole raggiungere.';
      if (pk.c === 'out' && v !== x.out) return failWhy(ex, x);
      return null;
    }
    const f = frameOf(ex, pk);
    if (!f) return null;
    const c = pk.c;
    const sol = solVal(f, c);
    if (fieldOk(c, v, sol)) return null;
    const fromR = f.from.startsWith('R');
    const rmacs = (ex.router || []).map(r => r.mac);
    if (c === 'type') {
      if (sol === 'arpReq' && v.startsWith('icmp')) return `Prima del ping serve il MAC: ${f.from} non ha ${f.id} nella sua ARP table, quindi parte una ARP request.`;
      if (sol.startsWith('icmp') && v.startsWith('arp')) return `${f.from} conosce già il MAC che gli serve (è nella ARP table${f.n > 1 ? ' o l\'ha appena imparato' : ''}): niente ARP, parte direttamente l'ICMP.`;
      if ((sol === 'icmpReq' && v === 'icmpRep') || (sol === 'icmpRep' && v === 'icmpReq')) return 'Richiesta e risposta invertite: la echo request va verso la destinazione del ping, la echo reply torna verso chi ha fatto il ping.';
      if (sol === 'arpRep' && v === 'arpReq') return 'La request è il frame precedente: questo è la risposta di chi possiede l\'IP cercato.';
      return null;
    }
    if (c === 'md') {
      if (f.t === 'arpRep' && macEq(v, BCAST)) return 'La ARP reply è unicast: chi risponde conosce già il MAC del richiedente (era il mittente della request).';
      if (f.t === 'arpReq' && !macEq(v, BCAST)) return 'La ARP request va in broadcast (FF:FF): il mittente non sa ancora chi ha quell\'IP.';
      if (rmacs.includes(f.md) && ex.hosts.some(h => h.ip === f.id && macEq(v, h.mac))) return `MAC del destinatario finale in un frame che deve andare al gateway: ${f.id} è in un'altra rete, il frame si ferma al router (${f.md}).`;
      if (rmacs.includes(normMac(v)) && !rmacs.includes(f.md)) return `${f.id} è nella stessa rete del mittente: il frame va direttamente all'host, non al router.`;
      return null;
    }
    if (c === 'ms') {
      if (fromR) {
        const h = ex.hosts.find(x => x.ip === f.is);
        if (h && macEq(v, h.mac)) return `Il router non "passa" il frame: ne crea uno nuovo, con MAC sorgente quello della sua interfaccia di uscita (${f.ms}). Il MAC di ${h.n} vale solo nella sua LAN.`;
        if (rmacs.includes(normMac(v))) return `Interfaccia sbagliata: il router esce dall'interfaccia della VLAN di destinazione, con MAC ${f.ms}.`;
      }
      return null;
    }
    if (c === 'is' || c === 'id') {
      if (fromR && (ex.router || []).some(r => ipEq(v, r.ip))) return 'Il router cambia i MAC ma non gli IP: sorgente e destinazione IP restano quelle originali del ping.';
      if (!fromR && f.t.startsWith('icmp') && rmacs.includes(f.md) && (ex.router || []).some(r => ipEq(v, r.ip))) return 'Il frame va al MAC del gateway, ma il datagramma IP è diretto all\'host finale: l\'IP del router non compare.';
      if (ipEq(v, c === 'is' ? f.id : f.is)) return 'IP sorgente e destinazione invertiti.';
      return null;
    }
    if (c.length === 2 && c[0] === 's') {
      const s = Number(c[1]) - 1;
      const info = f.sw[s];
      if (v === 'flood' && info.why === 'known') return `SWITCH ${s + 1} conosce già ${f.md}: ${findLearnMac(ex, f, s)}. Con la destinazione in tabella non serve il flooding.`;
      if (v.startsWith('p:') && info.why === 'unknown') return `SWITCH ${s + 1} non ha ancora una riga per ${f.md} (${devName(ex, f.md)}) nella VLAN: deve fare flooding.`;
      if (v.startsWith('p:') && info.why === 'bcast') return 'Frame broadcast: lo switch lo manda su tutte le porte della VLAN tranne quella di ingresso (flooding).';
      if (v === 'none' && info.act !== 'none') return `Il frame arriva a SWITCH ${s + 1} dalla porta ${info.inPort}${info.inPort === '24' ? ' (trunk): l\'altro switch lo ha mandato anche lì' : ''}.`;
      if (v !== 'none' && info.act === 'none') return `SWITCH ${s + 1} non vede questo frame: l'altro switch lo inoltra solo sulla porta della destinazione, non sul trunk.`;
      if (v === 'flood' && info.why === 'same') return `SWITCH ${s + 1} sa che ${f.md} è dietro la porta ${info.inPort}, da cui il frame è appena arrivato: lo scarta.`;
      return null;
    }
    return null;
  }
  function findLearnMac(ex, f, s) {
    const m = ex.macs.find(x => x.mac === f.md);
    return m ? (findLearn(ex, { mac: m.mac, vlan: m.vlan }, s) || 'l\'ha imparato prima') : 'l\'ha imparato prima';
  }

  function diagnoseCases(ex) {
    const out = [];
    const all = ex.tests.flatMap(t => t.frames.map(f => [t, f]));
    const req = all.find(([, f]) => f.t === 'arpReq');
    if (req) out.push({ key: fk(req[0].i, req[1].n, 'type'), value: 'icmpReq', expect: 'serve il MAC' });
    const rep = all.find(([, f]) => f.t === 'arpRep');
    if (rep) out.push({ key: fk(rep[0].i, rep[1].n, 'md'), value: 'FF:FF', expect: 'unicast' });
    const fr = all.find(([, f]) => f.from.startsWith('R') && f.t.startsWith('icmp'));
    if (fr) {
      const h = ex.hosts.find(x => x.ip === fr[1].is);
      if (h) out.push({ key: fk(fr[0].i, fr[1].n, 'ms'), value: h.mac, expect: 'ne crea uno nuovo' });
      out.push({ key: fk(fr[0].i, fr[1].n, 'is'), value: ex.router.find(r => r.mac === fr[1].ms).ip, expect: 'non gli IP' });
    }
    const toR = all.find(([, f]) => !f.from.startsWith('R') && f.t.startsWith('icmp') && (ex.router || []).some(r => r.mac === f.md));
    if (toR) {
      const h = ex.hosts.find(x => x.ip === toR[1].id);
      if (h) out.push({ key: fk(toR[0].i, toR[1].n, 'md'), value: h.mac, expect: 'destinatario finale' });
    }
    const unk = all.find(([, f]) => f.sw[0].why === 'unknown');
    if (unk) out.push({ key: fk(unk[0].i, unk[1].n, 's1'), value: 'p:' + (ex.portVlan['1'] ? '1' : '2'), expect: 'flooding' });
    const known = all.find(([, f]) => f.sw[0].why === 'known');
    if (known) out.push({ key: fk(known[0].i, known[1].n, 's1'), value: 'flood', expect: 'conosce già' });
    const t = ex.table.find(m => m.ports[0] === '-');
    if (t) out.push({ key: tabKey(0, t), value: '1', expect: 'riga inventata' });
    return out.filter(dc => {
      const pk = parse(dc.key);
      if (pk.kind !== 'f') return true;
      return !fieldOk(pk.c, dc.value, solVal(frameOf(ex, pk), pk.c));
    });
  }

  // ---------------- aiuti ----------------
  function fieldHint(ex, key) {
    const pk = parse(key);
    if (!pk) return 'Rileggi il testo.';
    if (pk.kind === 'tab') return `Segui i frame dei test: SWITCH ${pk.s + 1} impara ${pk.mac} solo se riceve un frame con quel MAC sorgente. Su quale porta arriva? (Dall'altro switch si arriva dalla 24.) Se non lo vede mai: "—".`;
    if (pk.kind === 'x') {
      if (pk.c === 'out') return 'Chi dovrebbe rispondere? Esiste un host con quell\'IP? Il router ha una rete che contiene quell\'IP?';
      return 'Logica dell\'host: la destinazione è nella mia rete (IP e maschera)? Se no, il frame va al gateway. Ho il MAC che mi serve nella ARP table?';
    }
    const f = frameOf(ex, pk);
    if (!f) return 'Rileggi il testo.';
    const c = pk.c;
    if (c === 'type') return 'Chi trasmette ora? Ha già il MAC che gli serve (ARP table)? Se no: ARP request. Chi riceve una request per il proprio IP risponde con la reply; poi parte (o torna) l\'ICMP.';
    if (c === 'ms') return 'MAC sorgente = scheda di rete di chi trasmette questo frame. Se trasmette il router, è il MAC dell\'interfaccia da cui esce.';
    if (c === 'md') return 'MAC destinazione = prossimo dispositivo nella stessa LAN: l\'host finale se è nella stessa rete, altrimenti il gateway. ARP request: broadcast FF:FF.';
    if (c === 'is' || c === 'id') return 'Gli IP del ping non cambiano lungo il percorso (il router cambia solo i MAC). Per ARP: IP del mittente e IP cercato (request) / IP del richiedente (reply).';
    const s = Number(c[1]) - 1;
    return `SWITCH ${s + 1}: riceve questo frame? Se sì: impara il MAC sorgente; destinazione broadcast o sconosciuta nella VLAN → flooding; nota → solo quella porta. Ricorda le righe imparate dai frame precedenti.`;
  }

  const listFrames = (ex, t) => t.frames.map(f => `${f.n}. ${frameTxt(ex, f)}\n   ` + f.sw.map((_, s) => `SW${s + 1}: ${actTxt(f.sw[s].act)}`).join(' · ')).join('\n');
  function hints(ex) {
    const H = ex.tests.map(t => {
      const src = ex.hosts.find(h => h.n === t.from);
      const same = sameNet(src.ip, t.to);
      const gw = same ? null : (ex.router || []).find(r => r.vlan === src.vlan);
      const nh = same ? t.to : gw.ip;
      const knows = (t.i === 1 ? ex.startArp : ex.tests[t.i - 2].arp)[t.from][nh];
      return {
        step: 't' + t.i, title: `Test ${t.i}: ${t.from} → ping ${t.to}`,
        metodo: 'Logica dell\'host: (1) la destinazione è nella mia rete? Sì → frame diretto all\'host; no → frame al gateway. (2) Ho il MAC nella ARP table? No → ARP request in broadcast, attendo la reply. (3) Invio l\'ICMP. Il router riceve, sceglie l\'interfaccia di uscita e rifà il frame (MAC nuovi, IP uguali). La risposta fa lo stesso percorso al contrario, con la stessa logica. Ogni switch: impara il MAC sorgente; broadcast o destinazione sconosciuta → flooding nella VLAN; nota → una sola porta.',
        applicato: `${t.from} (${src.ip}) vuole raggiungere ${t.to}: ${same ? 'stessa rete /24' : `rete diversa → serve il gateway ${gw.ip}`}. Il MAC di ${nh} ${knows ? 'è già' : 'NON è'} nella ARP table di ${t.from}. Ricorda cosa hanno imparato switch e ARP table nei test precedenti. Questo test produce ${t.frames.length} frame.`,
        svolto: listFrames(ex, t)
      };
    });
    if (ex.fails.length) {
      H.push({
        step: 'x', title: 'Ping impossibili',
        metodo: 'Applica la logica dell\'host solo fino al primo frame: stessa rete → serve il MAC dell\'host (ARP se non è noto); rete diversa → frame al gateway con l\'IP finale. Poi chiediti chi risponderebbe: un host con quell\'IP? Il router ha quella rete?',
        applicato: ex.fails.map(x => `${x.from} → ${x.to}: ${sameNet(ex.hosts.find(h => h.n === x.from).ip, x.to) ? 'stessa rete del mittente' : 'rete diversa dal mittente'}.`).join(' '),
        svolto: ex.fails.map(x => `${x.to}: primo frame ${TNAME[x.first.t]}, MAC dest ${x.first.md}, IP dest ${x.first.id} → ${OUTS.find(o => o[0] === x.out)[1]}.`).join('\n')
      });
    }
    H.push({
      step: 'tab', title: 'Tabelle degli switch',
      metodo: 'Una riga nasce quando lo switch riceve un frame con quel MAC sorgente: porta = porta di arrivo. Un dispositivo dell\'altro switch si vede dietro la trunk 24. Chi non ha mai trasmesso un frame che passi da quello switch non ha righe.',
      applicato: 'Ripercorri i frame dei test in ordine e, per ognuno, guarda quali switch lo ricevono e da quale porta.',
      svolto: ex.table.map(m => `${m.mac} (${m.label}, VLAN ${m.vlan}): ` + m.ports.map((p, s) => `SW${s + 1} ${p === '-' ? '—' : 'porta ' + p}`).join(', ')).join('\n')
    });
    return H;
  }

  // ---------------- figura ----------------
  function figure(ex) {
    const NSW = ex.nsw;
    const SWW = 330, SX = [20, 410], SY = ex.router ? 120 : 40, SH = 58;
    const W = NSW === 2 ? 760 : 370;
    const portX = (s, q) => SX[s] + 28 + (Number(q) - 1) * 55;
    const HY = SY + SH + 70;
    const VH = HY + 64;
    const L = [];
    L.push(`<svg viewBox="0 0 ${W} ${VH}" class="fig" role="img" aria-label="Switch con le porte numerate, VLAN, host collegati${ex.router ? ' e router con due interfacce' : ''}">`);
    if (ex.router) {
      const rx = SX[0] + 70, rw = 190;
      L.push(`<rect x="${rx}" y="8" width="${rw}" height="34" rx="17" class="box router"/>`);
      L.push(`<text x="${rx + rw / 2}" y="30" text-anchor="middle" class="lbl w">R</text>`);
      ex.router.forEach((r, i) => {
        const x = SX[0] + 90 + i * 150;
        L.push(`<line x1="${x}" y1="42" x2="${x}" y2="${SY}" class="link"/>`);
        L.push(`<text x="${x + (i ? 6 : -6)}" y="60" text-anchor="${i ? 'start' : 'end'}" class="lbl small">${r.ip}</text>`);
        L.push(`<text x="${x + (i ? 6 : -6)}" y="73" text-anchor="${i ? 'start' : 'end'}" class="lbl small">MAC ${r.mac}</text>`);
        L.push(`<text x="${x + (i ? 6 : -6)}" y="${SY - 6}" text-anchor="${i ? 'start' : 'end'}" class="port-n">${r.ifn} (VLAN ${r.vlan})</text>`);
      });
    }
    for (let s = 0; s < NSW; s++) {
      L.push(`<rect x="${SX[s]}" y="${SY}" width="${SWW}" height="${SH}" rx="6" class="box sw"/>`);
      L.push(`<text x="${SX[s] + SWW / 2}" y="${SY + 34}" text-anchor="middle" class="lbl w">SWITCH ${s + 1}</text>`);
      // VLAN
      const groups = {};
      Object.keys(ex.portVlan).forEach(q => { (groups[ex.portVlan[q]] = groups[ex.portVlan[q]] || []).push(q); });
      Object.keys(groups).forEach(v => {
        const qs = groups[v];
        const x0 = portX(s, qs[0]) - 22, x1 = portX(s, qs[qs.length - 1]) + 22;
        L.push(`<ellipse cx="${(x0 + x1) / 2}" cy="${SY + SH + 36}" rx="${(x1 - x0) / 2}" ry="13" class="lan"/>`);
        L.push(`<text x="${(x0 + x1) / 2}" y="${SY + SH + 40}" text-anchor="middle" class="lbl small">VLAN ${v}</text>`);
      });
      for (let q = 1; q <= 6; q++) {
        const x = portX(s, q);
        L.push(`<line x1="${x}" y1="${SY + SH}" x2="${x}" y2="${HY - 14}" class="link"/>`);
        L.push(`<text x="${x + 4}" y="${SY + SH + 14}" class="port-n">${q}</text>`);
      }
    }
    if (NSW === 2) {
      L.push(`<line x1="${SX[0] + SWW}" y1="${SY + SH / 2}" x2="${SX[1]}" y2="${SY + SH / 2}" class="link hl"/>`);
      L.push(`<text x="${SX[0] + SWW + 6}" y="${SY + SH / 2 - 6}" class="port-n">24</text>`);
      L.push(`<text x="${SX[1] - 6}" y="${SY + SH / 2 - 6}" text-anchor="end" class="port-n">24</text>`);
      L.push(`<text x="${(SX[0] + SWW + SX[1]) / 2}" y="${SY + SH / 2 + 16}" text-anchor="middle" class="lbl small">trunk</text>`);
    }
    ex.hosts.forEach(h => {
      const x = portX(h.sw, h.port);
      L.push(`<rect x="${x - 15}" y="${HY - 14}" width="30" height="20" rx="3" class="box"/>`);
      L.push(`<text x="${x}" y="${HY + 1}" text-anchor="middle" class="lbl b">${h.n}</text>`);
      L.push(`<text x="${x}" y="${HY + 22}" text-anchor="middle" class="lbl small">.${h.ip.split('.').slice(2).join('.')}</text>`);
      L.push(`<text x="${x}" y="${HY + 35}" text-anchor="middle" class="lbl small">${h.mac}</text>`);
    });
    L.push('</svg>');
    return L.join('');
  }

  // ---------------- testo ----------------
  function introText(ex) {
    const p = ex.params;
    const nh = ex.hosts.length;
    let t = `Gli ${nh} host in figura (da ${ex.hosts[0].n} a ${ex.hosts[nh - 1].n}) sono collegati ${ex.nsw > 1 ? 'a due switch, uniti dalla porta 24 (trunk, porta tutte le VLAN)' : 'a uno switch'}.`;
    if (ex.router) {
      const [v1, v2] = ex.vlans;
      t += ` Le porte 1-3 sono nella VLAN ${v1.id} e le porte 4-6 nella VLAN ${v2.id}; il router R è collegato allo switch 1 con l'interfaccia G1 (VLAN ${v1.id}) e G2 (VLAN ${v2.id}). Alla VLAN ${v1.id} è assegnata la rete ${v1.net}/24 (gateway ${v1.gw}), alla VLAN ${v2.id} la rete ${v2.net}/24 (gateway ${v2.gw}).`;
    } else {
      t += ` Tutte le porte sono nella VLAN ${ex.vlans[0].id}; la rete è ${ex.vlans[0].net}/24.`;
    }
    return t;
  }
  function stateLines(ex) {
    const L = [];
    Object.keys(ex.startArp).forEach(n => {
      if (n === 'R') return;
      const e = Object.entries(ex.startArp[n]);
      if (e.length) L.push(`l'host ${n} ha appreso ${e.map(([ip, mac]) => `${ip} ↔ ${mac} (${ipName(ex, ip)})`).join(' e ')}`);
    });
    const others = ex.hosts.filter(h => !Object.keys(ex.startArp[h.n] || {}).length).map(h => h.n);
    if (others.length) L.push(`${others.length === ex.hosts.length ? 'gli host' : 'gli altri host'} non conoscono nessuna associazione IP-MAC`);
    if (ex.router) {
      if (ex.rArp === 'all') L.push(`il router conosce le associazioni IP-MAC di tutti gli ${ex.hosts.length} host`);
      else { const miss = ex.hosts.filter(h => !ex.rArp.includes(h.ip)).map(h => h.n); L.push(`il router conosce le associazioni IP-MAC di tutti gli host tranne ${miss.join(', ')}`); }
    }
    const init = ex.startSw.some(t => t.length);
    if (!init) L.push('gli switch hanno le tabelle vuote');
    else ex.startSw.forEach((t, s) => L.push(`la tabella di SWITCH ${s + 1} contiene ${t.length ? t.map(e => `${e.mac} → porta ${e.port} (VLAN ${e.vlan})`).join(', ') : 'nessuna riga'}`));
    return L;
  }
  const testLine = (ex, t) => `ping ${t.to}${ex.tests.some(x => x.from !== ex.tests[0].from) ? ` (da ${t.from})` : ''}`;

  const swOptions = (ex, s) => {
    const ports = Object.keys(ex.portVlan).sort((a, b) => Number(a) - Number(b));
    if (s === 0 && ex.router) ex.router.forEach(r => ports.push(r.ifn));
    if (ex.nsw > 1) ports.push('24');
    return [['none', 'non lo riceve'], ['flood', 'flooding nella VLAN']].concat(ports.map(q => ['p:' + q, 'inoltra su ' + q])).concat([['drop', 'scarta (filtering)']]);
  };
  const tabOptions = (ex, s) => {
    const ports = Object.keys(ex.portVlan).sort((a, b) => Number(a) - Number(b));
    if (s === 0 && ex.router) ex.router.forEach(r => ports.push(r.ifn));
    if (ex.nsw > 1) ports.push('24');
    return [['-', '— (nessuna riga)']].concat(ports.map(q => [q, 'porta ' + q]));
  };

  function render(ex, root, ctx) {
    const src = ex.tests[0].from;
    root.appendChild(U.h('div', { class: 'card intro' },
      U.h('p', {}, U.h('b', {}, 'Testo. '), introText(ex)),
      U.fig(figure(ex), 'Sotto ogni host: ultimi ottetti dell\'IP e 2 byte del MAC (come nel testo d\'esame).'),
      U.table(['Host', 'Switch', 'Porta', 'VLAN', 'IP', 'MAC'], ex.hosts.map(h => [U.label(h.n), String(h.sw + 1), h.port, String(h.vlan), U.given(h.ip), U.given(h.mac)])
        .concat((ex.router || []).map(r => [U.label(`R (${r.ifn})`), '1', r.ifn, String(r.vlan), U.given(r.ip), U.given(r.mac)]))),
      U.h('p', {}, U.h('b', {}, 'In un determinato momento: ')),
      U.h('ul', {}, stateLines(ex).map(s => U.h('li', {}, s))),
      U.h('p', {}, `${src} effettua in sequenza i seguenti test di connettività, attendendo e ottenendo per ognuno risposta dal destinatario prima di passare al successivo: `,
        ex.tests.map((t, i) => `${i + 1}) ${testLine(ex, t)}`).join(' · '), '.'),
      U.h('p', { class: 'small' }, 'Per ogni test indica, frame per frame, il tipo, gli indirizzi MAC e IP (per ARP: IP del mittente e IP cercato/richiedente) e cosa fa ciascuno switch quando lo riceve. MAC nella forma a 2 byte del testo (es. AA:11), broadcast FF:FF. Gli IP puoi scriverli interi o abbreviati come nel testo (es. 1.3).')));

    const head = ['#', 'Tipo', 'MAC sorg.', 'MAC dest.', 'IP sorg.', 'IP dest. / cercato'].concat(swCols(ex).map((_, s) => `SWITCH ${s + 1}`));
    ex.tests.forEach(t => {
      root.appendChild(U.card(`Test ${t.i}: ${testLine(ex, t)}`, { step: 't' + t.i },
        U.table(head, t.frames.map(f => [U.label(String(f.n)),
          U.sel(ctx, fk(t.i, f.n, 'type'), TYPES, { label: `test ${t.i} frame ${f.n} tipo`, ph: '—' }),
          U.inp(ctx, fk(t.i, f.n, 'ms'), { w: 's', label: `test ${t.i} frame ${f.n} MAC sorgente`, ph: 'AA:11' }),
          U.inp(ctx, fk(t.i, f.n, 'md'), { w: 's', label: `test ${t.i} frame ${f.n} MAC destinazione` }),
          U.inp(ctx, fk(t.i, f.n, 'is'), { w: 'm', label: `test ${t.i} frame ${f.n} IP sorgente` }),
          U.inp(ctx, fk(t.i, f.n, 'id'), { w: 'm', label: `test ${t.i} frame ${f.n} IP destinazione` })
        ].concat(swCols(ex).map((c, s) => U.sel(ctx, fk(t.i, f.n, c), swOptions(ex, s), { label: `test ${t.i} frame ${f.n} switch ${s + 1}`, ph: '—' })))))));
    });
    if (ex.fails.length) {
      root.appendChild(U.card(`${ex.fails.map((x, k) => `${ex.tests.length + k + 1}) ping ${x.to}`).join(' · ')} — senza possibilità di successo`, { step: 'x' },
        U.h('p', { class: 'small' }, `Come sarebbe formato il primo frame inviato da ${ex.fails[0].from}? E perché il test fallisce?`),
        U.table(['Test', 'Tipo del primo frame', 'MAC dest.', 'IP dest. / cercato', 'Esito'], ex.fails.map(x => [U.label(`ping ${x.to}`),
          U.sel(ctx, `x${x.i}.type`, TYPES, { label: `ping ${x.to} tipo`, ph: '—' }),
          U.inp(ctx, `x${x.i}.md`, { w: 's', label: `ping ${x.to} MAC destinazione` }),
          U.inp(ctx, `x${x.i}.id`, { w: 'm', label: `ping ${x.to} IP destinazione` }),
          U.sel(ctx, `x${x.i}.out`, OUTS, { label: `ping ${x.to} esito` })]))));
    }
    root.appendChild(U.card(`Tabelle degli switch dopo ${ex.tests.length === 1 ? 'il test' : `i test 1-${ex.tests.length}`} (self-learning)`, { step: 'tab' },
      U.h('p', { class: 'small' }, 'Per ogni MAC indica su quale porta lo ha imparato ciascuno switch, oppure "—" se non ha nessuna riga.'),
      U.table(['Dispositivo', 'MAC', 'VLAN'].concat(swCols(ex).map((_, s) => `SWITCH ${s + 1}`)), ex.table.map(m => [U.label(m.label), U.given(m.mac), String(m.vlan)]
        .concat(m.ports.map((_, s) => U.sel(ctx, tabKey(s, m), tabOptions(ex, s), { label: `${m.label} switch ${s + 1}`, ph: '…' })))))));
  }

  function solution(ex, root) {
    const kids = [U.h('h4', {}, 'Soluzione'),
      U.h('p', { class: 'sol-body' }, 'Si applicano in ordine le tre logiche: host (stessa rete? MAC in ARP table?), switch (impara la sorgente; broadcast o destinazione ignota → flooding nella VLAN; nota → una porta) e router (rete di destinazione → interfaccia di uscita, frame nuovo con MAC nuovi e IP invariati).')];
    ex.tests.forEach(t => {
      kids.push(U.h('p', { class: 'sol-body' }, U.h('b', {}, `Test ${t.i}: ${testLine(ex, t)}`)));
      kids.push(U.table(['#', 'Frame', 'Perché'].concat(swCols(ex).map((_, s) => `SWITCH ${s + 1}`)), t.frames.map(f => [U.label(String(f.n)), frameTxt(ex, f), frameWhy(ex, t, f)]
        .concat(f.sw.map((_, s) => swWhy(ex, f, s))))));
    });
    if (ex.fails.length) {
      kids.push(U.h('p', { class: 'sol-body' }, U.h('b', {}, 'Ping impossibili')));
      kids.push(U.h('ul', { class: 'sol-body' }, ex.fails.map(x => U.h('li', {}, `ping ${x.to}: primo frame ${TNAME[x.first.t]} con MAC sorgente ${x.first.ms}, MAC destinazione ${x.first.md}, IP ${x.first.t === 'arpReq' ? 'cercato' : 'destinazione'} ${x.first.id}. ${failWhy(ex, x)}`))));
    }
    kids.push(U.h('p', { class: 'sol-body' }, U.h('b', {}, 'Tabelle finali degli switch')));
    for (let s = 0; s < ex.nsw; s++) {
      const rows = ex.table.filter(m => m.ports[s] !== '-').map(m => [m.ports[s], m.mac, String(m.vlan), m.label, findLearn(ex, m, s) || '']);
      kids.push(U.h('p', { class: 'small' }, `SWITCH ${s + 1}`));
      kids.push(U.table(['Interfaccia', 'MAC', 'VLAN', 'Dispositivo', 'Imparato da'], rows.length ? rows : [['—', '', '', '', '']]));
    }
    root.appendChild(U.h('div', { class: 'card sol' }, kids));
  }

  function chatText(ex, a) {
    const v = k => (a && String(a[k] == null ? '' : a[k]).trim()) || '__';
    const L = [];
    L.push(`#1 · ARP, switch e VLAN (livello ${ex.level})`);
    L.push('## Testo');
    L.push(introText(ex));
    L.push('Host: ' + ex.hosts.map(h => `${h.n} (SW${h.sw + 1} porta ${h.port}, VLAN ${h.vlan}, ${h.ip}, ${h.mac})`).join('; ') + '.');
    if (ex.router) L.push('Router: ' + ex.router.map(r => `${r.ifn} ${r.ip} ${r.mac} (VLAN ${r.vlan})`).join('; ') + '.');
    L.push('Stato iniziale: ' + stateLines(ex).join('; ') + '.');
    L.push('Test: ' + ex.tests.map((t, i) => `${i + 1}) ${testLine(ex, t)}`).join(' · '));
    if (ex.fails.length) L.push('Ping impossibili (primo frame): ' + ex.fails.map(x => x.to).join(', '));
    L.push('');
    L.push('## Le mie risposte');
    ex.tests.forEach(t => {
      L.push(`Test ${t.i}:`);
      t.frames.forEach(f => {
        const ty = TNAME[a && a[fk(t.i, f.n, 'type')]] || '__';
        L.push(`- frame ${f.n}: ${ty} | MAC ${v(fk(t.i, f.n, 'ms'))} → ${v(fk(t.i, f.n, 'md'))} | IP ${v(fk(t.i, f.n, 'is'))} → ${v(fk(t.i, f.n, 'id'))} | ` +
          swCols(ex).map((c, s) => { const o = swOptions(ex, s).find(x => x[0] === (a && a[fk(t.i, f.n, c)])); return `SW${s + 1}: ${o ? o[1] : '__'}`; }).join(' | '));
      });
    });
    ex.fails.forEach(x => {
      const o = OUTS.find(y => y[0] === (a && a[`x${x.i}.out`]));
      L.push(`- ping ${x.to}: ${TNAME[a && a[`x${x.i}.type`]] || '__'}, MAC dest ${v(`x${x.i}.md`)}, IP ${v(`x${x.i}.id`)}; esito: ${o ? o[1] : '__'}`);
    });
    L.push('Tabelle: ' + ex.table.map(m => `${m.mac}: ` + m.ports.map((_, s) => `SW${s + 1} ${v(tabKey(s, m))}`).join(', ')).join('; '));
    return L.join('\n');
  }

  // ---------------- tracce ----------------
  const PV = { 1: 1, 2: 1, 3: 1, 4: 2, 5: 2, 6: 2 };
  const PDF = {
    level: 4, nsw: 2,
    vlans: [{ id: 1, net: '192.168.1.0', gw: '192.168.1.1' }, { id: 2, net: '192.168.2.0', gw: '192.168.2.1' }],
    router: [{ ifn: 'G1', vlan: 1, ip: '192.168.1.1', mac: '11:11' }, { ifn: 'G2', vlan: 2, ip: '192.168.2.1', mac: '22:22' }],
    portVlan: PV,
    hosts: [
      { n: 'A', sw: 0, port: '1', ip: '192.168.1.3', mac: 'AA:11' }, { n: 'B', sw: 0, port: '2', ip: '192.168.1.4', mac: 'BB:22' },
      { n: 'C', sw: 0, port: '3', ip: '192.168.1.5', mac: 'CC:33' }, { n: 'D', sw: 0, port: '4', ip: '192.168.2.4', mac: 'EE:55' },
      { n: 'E', sw: 0, port: '5', ip: '192.168.2.5', mac: 'AB:66' }, { n: 'F', sw: 0, port: '6', ip: '192.168.2.6', mac: 'BC:77' },
      { n: 'G', sw: 1, port: '1', ip: '192.168.1.6', mac: '5A:31' }, { n: 'H', sw: 1, port: '2', ip: '192.168.1.7', mac: '4B:23' },
      { n: 'I', sw: 1, port: '3', ip: '192.168.1.8', mac: '7C:53' }, { n: 'L', sw: 1, port: '4', ip: '192.168.2.7', mac: '4E:51' },
      { n: 'M', sw: 1, port: '5', ip: '192.168.2.8', mac: '1B:86' }, { n: 'N', sw: 1, port: '6', ip: '192.168.2.9', mac: 'AC:72' }
    ],
    arp: { B: [['192.168.1.7', '4B:23'], ['192.168.1.1', '11:11']], H: [['192.168.1.4', 'BB:22']] },
    rArp: 'all', swInit: null,
    tests: [{ from: 'B', to: '192.168.1.3' }, { from: 'B', to: '192.168.1.7' }, { from: 'B', to: '192.168.2.8' }],
    fails: [{ from: 'B', to: '192.168.2.20' }, { from: 'B', to: '192.168.3.20' }]
  };
  const SIM = {
    level: 4, nsw: 2,
    vlans: [{ id: 1, net: '10.0.1.0', gw: '10.0.1.1' }, { id: 2, net: '10.0.2.0', gw: '10.0.2.1' }],
    router: [{ ifn: 'G1', vlan: 1, ip: '10.0.1.1', mac: '0A:01' }, { ifn: 'G2', vlan: 2, ip: '10.0.2.1', mac: '0A:02' }],
    portVlan: PV,
    hosts: [
      { n: 'A', sw: 0, port: '1', ip: '10.0.1.10', mac: '3C:11' }, { n: 'B', sw: 0, port: '2', ip: '10.0.1.11', mac: '7E:22' },
      { n: 'C', sw: 0, port: '4', ip: '10.0.2.10', mac: '5A:33' }, { n: 'D', sw: 0, port: '5', ip: '10.0.2.11', mac: '9F:44' },
      { n: 'E', sw: 1, port: '1', ip: '10.0.1.20', mac: '1B:55' }, { n: 'F', sw: 1, port: '2', ip: '10.0.1.21', mac: 'C4:66' },
      { n: 'G', sw: 1, port: '4', ip: '10.0.2.20', mac: '2D:77' }, { n: 'H', sw: 1, port: '5', ip: '10.0.2.21', mac: 'E8:88' }
    ],
    arp: { A: [['10.0.1.1', '0A:01'], ['10.0.1.21', 'C4:66']], F: [['10.0.1.10', '3C:11']] },
    rArp: 'all', swInit: null,
    tests: [{ from: 'A', to: '10.0.1.11' }, { from: 'A', to: '10.0.1.21' }, { from: 'A', to: '10.0.2.20' }],
    fails: [{ from: 'A', to: '10.0.1.30' }, { from: 'A', to: '10.0.3.5' }]
  };
  const exp = (s, mac, vlan, v) => ({ [`tab.s${s}.${mac}@${vlan}`]: v });

  RA.l2 = {
    id: 'l2', num: '1', name: 'ARP, switch e VLAN', part: 2, examPoints: 10, extra: false,
    desc: 'Ping in sequenza: frame ARP e ICMP, MAC e IP di ogni frame, flooding e inoltro degli switch, VLAN e router, tabelle per self-learning.',
    method: {
      intro: 'È l\'esercizio grande della seconda parte. Non si inventa nulla: si applicano, frame per frame, le tre logiche di funzionamento (host, switch, router) e si tiene traccia di cosa imparano ARP table e switch table.',
      steps: [
        'Host che deve inviare: la destinazione è nella mia rete (IP + maschera)? Sì → il frame va all\'host; no → va al gateway (default gateway della VLAN).',
        'Ho il MAC del prossimo dispositivo nella ARP table? No → ARP request in broadcast (MAC dest FF:FF, IP cercato). Risponde solo chi ha quell\'IP, con una ARP reply unicast; entrambi memorizzano l\'associazione.',
        'Switch che riceve un frame: impara MAC sorgente → porta di arrivo (nella VLAN della porta). Se la destinazione è broadcast o non è in tabella → flooding su tutte le porte della stessa VLAN tranne quella d\'ingresso, trunk compreso. Se è in tabella → solo quella porta.',
        'Router: riceve il frame indirizzato al suo MAC, guarda l\'IP di destinazione, sceglie l\'interfaccia della rete giusta e crea un frame NUOVO: MAC sorgente = sua interfaccia di uscita, MAC destinazione = host finale (con ARP se serve). Gli IP non cambiano.',
        'La risposta (echo reply) segue la stessa logica dall\'altra parte: chi risponde potrebbe non conoscere il MAC del gateway o del mittente e dover fare ARP a sua volta.',
        'Tabelle finali: ripercorri i frame; ogni switch ha una riga per ogni MAC sorgente che ha visto, con la porta da cui è arrivato (24 per i dispositivi dell\'altro switch).'
      ],
      traps: [
        'Il router cambia i MAC ma non gli IP: nel frame inoltrato l\'IP sorgente è ancora quello dell\'host che ha fatto il ping.',
        'Verso un\'altra rete il MAC di destinazione è quello del gateway, non dell\'host finale.',
        'La ARP reply è unicast; il destinatario della request impara subito il MAC del richiedente (non dovrà fare ARP per rispondere).',
        'Il flooding resta nella VLAN della porta d\'ingresso: un frame della VLAN 1 non esce mai su una porta della VLAN 2 (per passare serve il router).',
        'Uno switch impara anche dai frame che inoltra in flooding: dopo un broadcast conosce la porta del mittente.',
        'Un frame unicast a destinazione nota non arriva all\'altro switch: niente riga nuova laggiù.',
        'Se la destinazione è nella stessa rete ma non esiste, il ping fallisce già all\'ARP; se la rete non è nella tabella del router, il router scarta.'
      ],
      formulas: [
        ['Stessa rete?', 'IP_dest AND maschera = IP_mio AND maschera'],
        ['ARP request', 'MAC dest FF:FF:FF:FF:FF:FF (broadcast), "chi ha IP x?"'],
        ['ARP reply', 'unicast al richiedente: "IP x è MAC y"'],
        ['Switch', 'impara (MAC sorg, porta, VLAN) · broadcast/ignota → flooding nella VLAN · nota → una porta'],
        ['Router', 'MAC: nuovi a ogni salto · IP: invariati end-to-end'],
        ['Tag VLAN 802.1Q', '4 byte: TPID (2) + TCI con VLAN ID (12 bit) — solo sulle porte trunk'],
        ['ICMP', 'echo request tipo 8 · echo reply tipo 0 · destination unreachable tipo 3']
      ]
    },
    traces: [
      {
        id: 'sim-l2', set: 'simulato',
        title: 'Esame simulato · ARP, switch e VLAN (10.0.1.0/24 e 10.0.2.0/24)',
        source: 'Esame_Simulato_2_TESTO.pdf, esercizio 1 · soluzioni pag. 1-3',
        params: SIM,
        expect: Object.assign(
          { 't1.f1.type': 'arpReq', 't1.f1.md': 'FF:FF', 't1.f1.s2': 'flood', 't1.f2.s1': 'p:1', 't1.f4.s1': 'p:1',
            't2.f1.s1': 'flood', 't2.f1.s2': 'flood', 't2.f2.s2': 'p:24', 't2.f2.s1': 'p:1',
            't3.f1.md': '0A:01', 't3.f1.id': '10.0.2.20', 't3.f2.ms': '0A:02', 't3.f2.md': '2D:77', 't3.f2.is': '10.0.1.10',
            't3.f3.type': 'arpReq', 't3.f3.id': '10.0.2.1', 't3.f4.s1': 'p:24', 't3.f5.s1': 'p:G2', 't3.f6.ms': '0A:01', 't3.f6.s2': 'none',
            'x1.type': 'arpReq', 'x1.md': 'FF:FF', 'x1.out': 'noarp', 'x2.type': 'icmpReq', 'x2.md': '0A:01', 'x2.out': 'rdrop' },
          exp(1, '3C:11', 1, '1'), exp(1, '7E:22', 1, '2'), exp(1, 'C4:66', 1, '24'), exp(1, '0A:02', 2, 'G2'), exp(1, '2D:77', 2, '24'), exp(1, '0A:01', 1, 'G1'),
          exp(2, '3C:11', 1, '24'), exp(2, '7E:22', 1, '-'), exp(2, 'C4:66', 1, '2'), exp(2, '0A:02', 2, '24'), exp(2, '2D:77', 2, '4'), exp(2, '0A:01', 1, '-'))
      },
      {
        id: 'pdf-l2',
        title: 'Esercizi seconda parte · 12 host, 2 switch, VLAN 1 e 2',
        source: 'Esercizi seconda parte.pdf, pag. 3-6 (soluzione degli studenti)',
        params: PDF,
        expect: Object.assign(
          { 't1.f1.type': 'arpReq', 't1.f2.ms': 'AA:11', 't1.f3.md': 'AA:11', 't2.f1.md': '4B:23', 't2.f1.s1': 'flood', 't2.f2.s2': 'p:24',
            't3.f1.md': '11:11', 't3.f2.ms': '22:22', 't3.f2.md': '1B:86', 't3.f2.is': '192.168.1.4', 't3.f2.id': '192.168.2.8',
            't3.f3.type': 'arpReq', 't3.f3.ms': '1B:86', 't3.f4.ms': '22:22', 't3.f6.ms': '11:11', 't3.f6.md': 'BB:22', 't3.f6.s1': 'p:2',
            'x1.type': 'icmpReq', 'x1.md': '11:11', 'x1.id': '192.168.2.20', 'x1.out': 'rarp', 'x2.md': '11:11', 'x2.id': '192.168.3.20', 'x2.out': 'rdrop' },
          exp(1, 'BB:22', 1, '2'), exp(1, 'AA:11', 1, '1'), exp(1, '4B:23', 1, '24'), exp(1, '22:22', 2, 'G2'), exp(1, '1B:86', 2, '24'), exp(1, '11:11', 1, 'G1'),
          exp(2, 'BB:22', 1, '24'), exp(2, '4B:23', 1, '2'), exp(2, '22:22', 2, '24'), exp(2, '1B:86', 2, '5'), exp(2, 'AA:11', 1, '-'), exp(2, '11:11', 1, '-'))
      }
    ],
    randomParams, build, gen, steps, grade, sol2answers, render, solution, hints, fieldHint, diagnose, diagnoseCases, chatText
  };
})();
