// ============================================================
// RetiApp · gen-vlsm.js — Esercizio 1 · Indirizzamento IP e routing
// Contratto dei moduli: vedi docs/moduli.md
// La topologia (router, link, LAN, router di bordo) è descritta nei params.
// ============================================================
(function () {
  const RA = window.RetiApp;
  const U = RA.util;

  const ROUTERS = ['R1', 'R2', 'R3'];
  const LAN_NAMES = ['Net_A', 'Net_B', 'Net_C', 'Net_D'];
  const FIRST_OCT = [200, 201, 193, 195, 143, 151, 130, 82, 62, 90, 185, 213];
  const EXT_IP = U.ip2int('8.8.8.8');
  const P2 = n => Math.pow(2, n);

  function linksOf(topo) {
    const L = [{ name: 'Link_1', a: 'R1', b: 'R2' }, { name: 'Link_2', a: 'R2', b: 'R3' }, { name: 'Link_3', a: 'R1', b: 'R3' }];
    return topo === 'chain' ? L.slice(0, 2) : L;
  }

  // ---------------- grafo ----------------
  function adj(ex) {
    const A = {};
    ex.routers.forEach(r => { A[r] = []; });
    ex.links.forEach(l => { A[l.a].push({ r: l.b, link: l.name }); A[l.b].push({ r: l.a, link: l.name }); });
    return A;
  }
  function allDist(ex) {
    const A = adj(ex), D = {};
    ex.routers.forEach(s => {
      D[s] = { [s]: 0 };
      const q = [s];
      while (q.length) {
        const x = q.shift();
        A[x].forEach(n => { if (D[s][n.r] === undefined) { D[s][n.r] = D[s][x] + 1; q.push(n.r); } });
      }
    });
    return D;
  }
  function sharedLink(ex, a, b) {
    const l = ex.links.find(l => (l.a === a && l.b === b) || (l.a === b && l.b === a));
    return l ? l.name : null;
  }
  function netsOfRouter(ex, R) { return ex.nets.filter(n => n.routers.includes(R)).map(n => n.name); }
  function netByName(ex, name) { return ex.nets.find(n => n.name === name); }

  // per il router X: reti connesse, vicini ammessi (cammino minimo, pareggi = tutti) e default
  function routeInfo(ex, X) {
    const D = allDist(ex), nb = adj(ex)[X];
    const best = targets => {
      let b = Infinity, out = [];
      nb.forEach(n => {
        const c = 1 + Math.min(...targets.map(t => D[n.r][t]));
        if (c < b) { b = c; out = [n.r]; } else if (c === b) out.push(n.r);
      });
      return { hops: b, via: out.sort() };
    };
    const allowed = {}, hops = {};
    ex.nets.forEach(n => {
      if (n.routers.includes(X)) allowed[n.name] = 'conn';
      else { const r = best(n.routers); allowed[n.name] = r.via; hops[n.name] = r.hops; }
    });
    let ext, extHops = 0;
    if (X === ex.border) ext = ['isp'];
    else { const r = best([ex.border]); ext = r.via; extHops = r.hops; }
    const V = nb.map(n => n.r).sort().concat(X === ex.border ? ['isp'] : []);
    return { allowed, hops, ext, extHops, V };
  }

  // blocchi liberi (allineati) dello spazio, dato un piano {nome: {net, size}}
  function freeBlocks(start, space, plan) {
    const list = Object.values(plan);
    const out = [];
    (function rec(ip, size) {
      const ov = list.filter(s => s.net < ip + size && ip < s.net + s.size);
      if (!ov.length) { out.push({ net: ip, size }); return; }
      if (ov.some(s => s.net <= ip && s.net + s.size >= ip + size)) return;
      if (size <= 1) return;
      rec(ip, size / 2); rec(ip + size / 2, size / 2);
    })(start, space);
    return out;
  }

  // tabella minima: righe connesse fisse + programmazione dinamica sull'albero dei prefissi
  // (ogni foglia è una sottorete o un blocco libero; il libero segue la default)
  function optimalRows(ex, plan, X) {
    const info = routeInfo(ex, X);
    const list = Object.keys(plan).map(n => ({ name: n, net: plan[n].net, size: plan[n].size }));
    const memo = {};
    function f(ip, size, inh, d) {
      const key = ip + '/' + size + '/' + inh + '/' + d;
      if (memo[key]) return memo[key];
      let res;
      const exact = list.find(s => s.net === ip && s.size === size);
      const ov = list.some(s => s.net < ip + size && ip < s.net + s.size);
      if (exact || !ov) {
        const S = exact ? info.allowed[exact.name] : [d];
        if (S === 'conn' || S.includes(inh)) res = { cost: 0, rows: [] };
        else res = { cost: 1, rows: [{ net: ip, size, v: S[0] }] };
      } else {
        const h = size / 2;
        const a = f(ip, h, inh, d), b = f(ip + h, h, inh, d);
        res = { cost: a.cost + b.cost, rows: a.rows.concat(b.rows) };
        info.V.forEach(v => {
          if (v === inh) return;
          const a2 = f(ip, h, v, d), b2 = f(ip + h, h, v, d);
          const c = 1 + a2.cost + b2.cost;
          if (c < res.cost) res = { cost: c, rows: [{ net: ip, size, v }].concat(a2.rows, b2.rows) };
        });
      }
      memo[key] = res;
      return res;
    }
    let best = null;
    info.ext.forEach(d => {
      const r = f(ex.start, ex.space, d, d);
      if (!best || r.cost < best.cost) best = { cost: r.cost, rows: r.rows, d };
    });
    const conn = ex.nets.filter(n => info.allowed[n.name] === 'conn').length;
    return { rows: best.rows, d: best.d, conn, count: conn + best.rows.length + 1 };
  }

  // ---------------- parametri ----------------
  function tryParams(level) {
    const L = level;
    let topo = 'triangle';
    if (L <= 3 && U.chance([0, 0.5, 0.4, 0.25][L])) topo = 'chain';
    const nL = topo === 'chain' ? 3 : (L === 4 ? 4 : L === 5 ? (U.chance(0.5) ? 4 : 3) : 3);
    const prefix = L === 1 ? 24 : L === 2 ? U.pick([24, 25]) : L === 3 ? U.pick([25, 26]) : L === 4 ? U.pick([24, 25]) : U.pick([24, 25, 26]);
    const space = P2(32 - prefix);
    const nLinks = topo === 'chain' ? 2 : 3;
    const fill = [null, [0.25, 0.6], [0.45, 0.8], [0.6, 0.92], [0.65, 0.97], [0.88, 1]][L];
    const SZ = [8, 16, 32, 64, 128].filter(s => s <= space / 2);
    const sizes = [];
    for (let i = 0; i < nL; i++) sizes.push(U.pick(SZ));
    const total = U.sum(sizes) + 4 * nLinks;
    if (total > space || total / space < fill[0] || total / space > fill[1]) return null;
    if (L <= 2 && new Set(sizes).size < nL) return null;
    // host: indirizzi necessari (host + 3) tra metà blocco (esclusa) e blocco
    const hosts = sizes.map(s => U.rndInt(s / 2 - 2, s - 3));
    const big = sizes.indexOf(Math.max(...sizes));
    if (L === 5) hosts[big] = U.chance(0.6) ? sizes[big] / 2 - 2 : sizes[big] - 3; // caso al limite
    else if (L >= 3 && U.chance(0.3)) hosts[big] = sizes[big] / 2 - 2;

    const last = U.rndInt(0, 256 / space - 1) * space;
    const net = [U.pick(FIRST_OCT), U.rndInt(1, 254), U.rndInt(0, 255), last].join('.');

    // posizione delle LAN
    const order = U.shuffle(ROUTERS);
    const lans = hosts.map((h, i) => ({ name: LAN_NAMES[i], hosts: h, router: i < 3 ? order[i] : U.pick(ROUTERS) }));
    if (topo === 'triangle' && nL === 4) lans[3].router = U.pick(ROUTERS);

    let border;
    if (topo === 'chain') border = L === 1 ? 'R1' : U.pick(['R1', 'R3']);
    else border = L <= 2 ? 'R1' : (U.chance(0.5) ? 'R1' : U.pick(['R2', 'R3']));
    const nonBorder = ROUTERS.filter(r => r !== border);
    const asked = L >= 3 && U.chance(0.3) ? border : U.pick(nonBorder);

    // domanda iii
    let q3;
    if (topo === 'chain') {
      const side = R => lans.filter(l => l.router === R).map(l => l.name).concat(L >= 3 && border === R ? ['Internet'] : []);
      const A = U.pick(side('R1')), B = U.pick(side('R3'));
      q3 = U.chance(0.5) ? { src: A, dst: B } : { src: B, dst: A };
    } else {
      const ends = lans.map(l => ({ id: l.name, r: l.router })).concat(L >= 3 ? [{ id: 'Internet', r: border }] : []);
      const s = U.pick(ends);
      const d = U.pick(ends.filter(e => e.r !== s.r && !(e.id === 'Internet' && s.id === 'Internet')));
      q3 = { src: s.id, dst: d.id };
    }
    return { level: L, net, prefix, topo, border, lans, asked, q3, askCost: L >= 3 };
  }

  function randomParams(level) {
    for (let i = 0; i < 4000; i++) {
      const p = tryParams(level);
      if (p) return p;
    }
    return U.clone(TRACES[0].params);
  }

  // ---------------- costruzione ----------------
  function build(p) {
    const start = U.ip2int(p.net);
    const space = P2(32 - p.prefix);
    const links = linksOf(p.topo);
    const nets = p.lans.map(l => ({ name: l.name, kind: 'lan', hosts: l.hosts, routers: [l.router] }))
      .concat(links.map(l => ({ name: l.name, kind: 'link', routers: [l.a, l.b] })));
    const need = {}, size = {}, pf = {};
    nets.forEach(n => {
      need[n.name] = n.kind === 'lan' ? n.hosts + 3 : 4;
      size[n.name] = Math.max(4, U.pow2ceil(need[n.name]));
      pf[n.name] = 32 - Math.log2(size[n.name]);
    });
    // ordine decrescente; a parità prima le LAN, poi per nome
    const order = nets.map(n => n.name).sort((a, b) => size[b] - size[a] ||
      (netKind(nets, a) === netKind(nets, b) ? 0 : netKind(nets, a) === 'lan' ? -1 : 1) || (a < b ? -1 : 1));
    const sub = {};
    let cur = start;
    order.forEach(n => { sub[n] = { net: cur, size: size[n], pf: pf[n] }; cur += size[n]; });
    const used = cur - start;

    // interfacce: LAN → primo utile; /30 → estremo "a" il primo, "b" il secondo (salvo scambio dichiarato)
    const swap = p.swap || [];
    const iface = {};
    ROUTERS.forEach(R => { iface[R] = {}; });
    nets.forEach(n => {
      const s = sub[n.name];
      if (n.kind === 'lan') iface[n.routers[0]][n.name] = s.net + 1;
      else {
        const sw = swap.includes(n.name);
        iface[n.routers[0]][n.name] = s.net + (sw ? 2 : 1);
        iface[n.routers[1]][n.name] = s.net + (sw ? 1 : 2);
      }
    });

    const ex = {
      cat: 'vlsm', level: p.level, params: p,
      start, prefix: p.prefix, space, topo: p.topo, border: p.border, routers: ROUTERS.slice(),
      lans: p.lans, links, nets, need, size, pf, order, sub, iface, used,
      asked: p.asked, askCost: !!p.askCost
    };
    ex.free = freeBlocks(start, space, sub);

    // domanda iii: router di partenza/arrivo, router da attraversare, link da evitare
    const rOf = id => id === 'Internet' ? p.border : p.lans.find(l => l.name === id).router;
    const q = { src: p.q3.src, dst: p.q3.dst, srcR: rOf(p.q3.src), dstR: rOf(p.q3.dst) };
    q.via = ROUTERS.find(r => r !== q.srcR && r !== q.dstR);
    if (p.topo === 'chain') { q.link = 'Link_3'; q.newLink = { name: 'Link_3', a: 'R1', b: 'R3' }; }
    else q.link = sharedLink(ex, q.srcR, q.dstR);
    q.altLinks = [sharedLink(ex, q.srcR, q.via), sharedLink(ex, q.via, q.dstR)];
    q.altCost = 2;
    q.costMin = q.altCost + 1;
    ex.q3 = q;

    // tabella di routing del router richiesto (soluzione aggregata)
    const X = p.asked;
    const info = routeInfo(ex, X);
    const opt = optimalRows(ex, sub, X);
    const nh = v => v === 'isp' ? 'ISP' : U.int2ip(iface[v][sharedLink(ex, X, v)]);
    const routes = [];
    nets.filter(n => info.allowed[n.name] === 'conn').sort((a, b) => sub[a.name].net - sub[b.name].net)
      .forEach(n => routes.push({ dest: U.fmtPrefix(sub[n.name].net, sub[n.name].pf), nh: 'direttamente connessa', what: n.name }));
    opt.rows.slice().sort((a, b) => a.net - b.net || b.size - a.size).forEach(r => {
      const exact = nets.find(n => sub[n.name].net === r.net && sub[n.name].size === r.size);
      routes.push({ dest: U.fmtPrefix(r.net, 32 - Math.log2(r.size)), nh: nh(r.v), what: exact ? exact.name : 'aggregato', v: r.v, net: r.net, size: r.size });
    });
    routes.push({ dest: '0.0.0.0/0', nh: nh(opt.d), what: 'default', v: opt.d });
    ex.routes = routes;
    ex.rtRows = Math.max(7, routes.length);
    return ex;
  }
  function netKind(nets, name) { return nets.find(n => n.name === name).kind; }
  const gen = level => build(randomParams(level));

  // ---------------- passi ----------------
  function steps(ex) {
    const N = ex.nets.map(n => n.name);
    const ifKeys = [];
    ex.routers.forEach(R => netsOfRouter(ex, R).forEach(n => ifKeys.push(`if.${R}.${n}`)));
    const addr = [];
    N.forEach(n => ['mask', 'first', 'last', 'bcast'].forEach(f => addr.push(`sub.${n}.${f}`)));
    return [
      { id: 'need', title: 'Indirizzi necessari', keys: N.map(n => 'need.' + n) },
      { id: 'pf', title: 'Assegnazione dei blocchi', keys: N.map(n => `sub.${n}.pf`) },
      { id: 'addr', title: 'Maschera, range e broadcast', keys: addr },
      { id: 'if', title: 'Interfacce dei router', keys: ifKeys },
      { id: 'rt', title: `Tabella di routing di ${ex.asked}`, keys: [], prefixes: ['rt.'] },
      { id: 'q3', title: 'Forzare un percorso', keys: ex.askCost ? ['q3', 'q3cost'] : ['q3'] }
    ];
  }

  // ---------------- lettura delle risposte ----------------
  function inSpace(ex, net, size) { return net >= ex.start && net + size <= ex.start + ex.space; }

  // controllo dei prefissi scritti: ok solo se dimensione giusta, allineato, nello spazio, senza sovrapposizioni
  function checkPf(ex, a) {
    const out = {};
    const accepted = [];
    ex.nets.forEach(n => {
      const name = n.name;
      const p = U.parsePrefix(a['sub.' + name + '.pf']);
      const r = { ok: false, why: null, p };
      if (!p) r.why = 'format';
      else {
        const size = P2(32 - p.n);
        const base = p.ip - (p.ip % size);
        r.size = size; r.net = p.ip;
        if (!inSpace(ex, base, size)) r.why = 'out';
        else if (p.ip % size !== 0) r.why = 'align';
        else if (p.n > ex.pf[name]) r.why = 'small';
        else if (p.n < ex.pf[name]) r.why = 'big';
        else {
          const o = accepted.find(s => s.net < p.ip + size && p.ip < s.net + s.size);
          if (o) { r.why = 'overlap'; r.other = o.name; }
          else { r.ok = true; accepted.push({ name, net: p.ip, size }); }
        }
      }
      out[name] = r;
    });
    return out;
  }

  // contesto di correzione: piano effettivo (quello dell'utente se valido) e interfacce di riferimento
  function evalCtx(ex, a) {
    a = a || {};
    const pfc = checkPf(ex, a);
    // riferimento per maschera/range/broadcast: la rete scritta se è un blocco allineato nello spazio
    const ref = {};
    ex.nets.forEach(n => {
      const r = pfc[n.name];
      if (r.p && r.size >= 4 && r.why !== 'out' && r.why !== 'align' && r.why !== 'format') ref[n.name] = { net: r.net, size: r.size, pf: r.p.n, own: true };
      else ref[n.name] = Object.assign({ own: false }, ex.sub[n.name]);
    });
    // piano effettivo
    let plan = {};
    ex.nets.forEach(n => { plan[n.name] = pfc[n.name].ok ? { net: pfc[n.name].net, size: ex.size[n.name], pf: ex.pf[n.name] } : U.clone(ex.sub[n.name]); });
    const L = Object.keys(plan);
    let clash = false;
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const s = plan[L[i]], t = plan[L[j]];
      if (s.net < t.net + t.size && t.net < s.net + s.size) clash = true;
    }
    if (clash) { plan = U.clone(ex.sub); }
    // interfacce
    const ifv = {}, ifok = {}, ifwhy = {};
    ex.routers.forEach(R => netsOfRouter(ex, R).forEach(n => {
      const k = `if.${R}.${n}`;
      const v = U.ip2int(a[k]);
      const s = plan[n];
      ifv[k] = v;
      ifok[k] = v !== null && v > s.net && v < s.net + s.size - 1;
      if (!ifok[k]) ifwhy[k] = v === null ? 'format' : 'out';
    }));
    ex.links.forEach(l => {
      const ka = `if.${l.a}.${l.name}`, kb = `if.${l.b}.${l.name}`;
      if (ifok[ka] && ifok[kb] && ifv[ka] === ifv[kb]) { ifok[ka] = ifok[kb] = false; ifwhy[ka] = ifwhy[kb] = 'same'; }
    });
    const ifOf = (R, n) => {
      const k = `if.${R}.${n}`;
      if (ifok[k]) return ifv[k];
      const s = plan[n];
      let off = ex.iface[R][n] - ex.sub[n].net;
      const nd = netByName(ex, n);
      if (nd.kind === 'link') {
        const other = nd.routers.find(r => r !== R);
        const ko = `if.${other}.${n}`;
        if (ifok[ko] && ifv[ko] === s.net + off) off = off === 1 ? 2 : 1;
      }
      return s.net + off;
    };
    return { pfc, ref, plan, clash, ifv, ifok, ifwhy, ifOf };
  }

  function parseDest(s) {
    const t = String(s == null ? '' : s).trim();
    if (t === '') return { empty: true };
    if (/^(0\.0\.0\.0(\s*\/\s*0)?|0\s*\/\s*0|default|internet)$/i.test(t)) return { ip: 0, n: 0 };
    const p = U.parsePrefix(t);
    if (!p) return { bad: 'format' };
    if (p.n === 0 && p.ip !== 0) return { bad: 'host', ip: p.ip, n: 0 };
    if (p.n > 0 && p.n < 32 && p.ip % P2(32 - p.n) !== 0) return { bad: 'host', ip: p.ip, n: p.n };
    return { ip: p.ip, n: p.n };
  }
  function parseNh(s) {
    const t = U.norm(s);
    if (t === '') return { empty: true };
    const ips = (t.match(/\d{1,3}(?:\.\d{1,3}){3}/g) || []).map(U.ip2int).filter(x => x !== null);
    if (ips.length) return { toks: ips.map(ip => ({ ip })) };
    if (/^[-–—]+$/.test(t) || /dirett|conness|diretta|direct|connected/.test(t)) return { toks: [{ c: 'conn' }] };
    if (/\b(isp|provider)\b|internet/.test(t)) return { toks: [{ c: 'isp' }] };
    if (/null|scart|drop|discard|blackhole/.test(t)) return { toks: [{ c: 'null' }] };
    return { bad: true };
  }
  function collectRows(a) {
    const idx = new Set();
    Object.keys(a || {}).forEach(k => { const m = /^rt\.(\d+)\.(dest|nh)$/.exec(k); if (m) idx.add(Number(m[1])); });
    return Array.from(idx).sort((x, y) => x - y).map(i => {
      const rd = String(a[`rt.${i}.dest`] == null ? '' : a[`rt.${i}.dest`]).trim();
      const rh = String(a[`rt.${i}.nh`] == null ? '' : a[`rt.${i}.nh`]).trim();
      return { i, rd, rh, d: parseDest(rd), h: parseNh(rh) };
    });
  }
  const covers = (r, ip) => r.d.n === 0 || (ip >= r.d.ip && ip < r.d.ip + P2(32 - r.d.n));
  const usable = r => r.d.ip !== undefined && r.d.bad === undefined && !r.d.empty;

  // valore di un next-hop: 'conn' | 'isp' | 'null' | nome del vicino | 'ip:...' (sconosciuto) | '?' (illeggibile)
  function nhValues(ex, ec, X, r) {
    if (!r.h.toks) return ['?'];
    const nb = adj(ex)[X];
    return r.h.toks.map(t => {
      if (t.c) return t.c;
      const n = nb.find(n => ec.ifOf(n.r, n.link) === t.ip);
      return n ? n.r : 'ip:' + t.ip;
    });
  }
  function resolve(ex, ec, X, rows, ip) {
    let best = -1, win = [];
    rows.forEach(r => {
      if (!covers(r, ip)) return;
      if (r.d.n > best) { best = r.d.n; win = [r]; } else if (r.d.n === best) win.push(r);
    });
    const set = Array.from(new Set([].concat(...win.map(r => nhValues(ex, ec, X, r))))).sort();
    return { win, set };
  }

  function routeTests(ex, ec) {
    const X = ex.asked;
    const info = routeInfo(ex, X);
    const T = [];
    ex.nets.forEach(n => {
      const s = ec.plan[n.name];
      T.push({ id: n.name, label: `${n.name} (${U.fmtPrefix(s.net, s.pf)})`, pts: [s.net + 1, s.net + s.size - 2], exp: info.allowed[n.name], net: s.net, pf: s.pf });
    });
    if (ex.used < ex.space) {
      const fb = freeBlocks(ex.start, ex.space, ec.plan);
      T.push({ id: 'free', label: `spazio libero (${fb.map(b => U.fmtPrefix(b.net, 32 - Math.log2(b.size))).join(', ')})`, pts: [].concat(...fb.map(b => [b.net, b.net + b.size - 1])), exp: info.ext, free: true });
    }
    const outside = ex.start + ex.space < P2(32) ? ex.start + ex.space : ex.start - 1;
    T.push({ id: 'ext', label: `Internet (es. 8.8.8.8 e ${U.int2ip(outside)}, fuori dallo spazio)`, pts: [EXT_IP, outside], exp: info.ext, ext: true });
    return { T, info };
  }
  function testOk(t, set) {
    if (!set.length) return false;
    if (t.exp === 'conn') return set.length === 1 && set[0] === 'conn';
    return set.every(v => t.exp.includes(v) || (t.free && v === 'null'));
  }

  // ---------------- correzione ----------------
  function grade(ex, a) {
    a = a || {};
    let correct = 0, total = 0;
    const marks = {}, summary = [];
    const ec = evalCtx(ex, a);
    const X = ex.asked;

    // 1. indirizzi necessari
    ex.nets.forEach(n => {
      const k = 'need.' + n.name;
      total++;
      const ok = U.numEq(a[k], ex.need[n.name]);
      if (ok) correct++;
      marks[k] = { ok, msg: n.kind === 'lan' ? `${n.name}: ${n.hosts} host + 1 (interfaccia del router) + 2 (rete e broadcast) = ${ex.need[n.name]}` : `${n.name}: 2 interfacce (una per router) + 2 (rete e broadcast) = 4` };
    });

    // 2. rete/prefisso
    ex.nets.forEach(n => {
      const k = `sub.${n.name}.pf`;
      total++;
      const r = ec.pfc[n.name];
      if (r.ok) correct++;
      const s = ex.size[n.name];
      marks[k] = {
        ok: r.ok,
        msg: `${n.name}: ${ex.need[n.name]} indirizzi → blocco da ${s} → /${ex.pf[n.name]}. La rete parte da un multiplo di ${s}, dentro ${U.fmtPrefix(ex.start, ex.prefix)}, senza sovrapporsi alle altre (in ordine decrescente: ${U.fmtPrefix(ex.sub[n.name].net, ex.pf[n.name])}).` +
          (r.why === 'overlap' ? ` Ora si sovrappone a ${r.other}.` : '')
      };
    });

    // 3. maschera, primo, ultimo, broadcast (coerenti con la rete scritta, se è un blocco valido)
    ex.nets.forEach(n => {
      const R = ec.ref[n.name];
      const base = `sub.${n.name}.`;
      const src = R.own ? `la tua rete ${U.fmtPrefix(R.net, R.pf)}` : `${U.fmtPrefix(R.net, R.pf)}`;
      const chk = (f, ok, msg) => { total++; if (ok) correct++; marks[base + f] = { ok, msg }; };
      chk('mask', String(a[base + 'mask'] == null ? '' : a[base + 'mask']).replace(/\s/g, '') === U.fmtMask(R.pf),
        `maschera di /${R.pf}: ${U.fmtMask(R.pf)} (nell'ottetto del confine 256 − ${Math.min(R.size, 256)} = ${256 - Math.min(R.size, 256)})`);
      chk('first', U.ip2int(a[base + 'first']) === R.net + 1, `primo utile = rete + 1 = ${U.int2ip(R.net + 1)} (per ${src})`);
      chk('last', U.ip2int(a[base + 'last']) === R.net + R.size - 2, `ultimo utile = broadcast − 1 = ${U.int2ip(R.net + R.size - 2)} (per ${src})`);
      chk('bcast', U.ip2int(a[base + 'bcast']) === R.net + R.size - 1, `broadcast = rete + ${R.size} − 1 = ${U.int2ip(R.net + R.size - 1)} (per ${src})`);
    });

    // 4. interfacce
    ex.routers.forEach(R => netsOfRouter(ex, R).forEach(nm => {
      const k = `if.${R}.${nm}`;
      const s = ec.plan[nm];
      const nd = netByName(ex, nm);
      total++;
      const ok = ec.ifok[k];
      if (ok) correct++;
      marks[k] = {
        ok,
        msg: `${R} su ${nm}: un indirizzo utile di ${U.fmtPrefix(s.net, s.pf)} (${U.int2ip(s.net + 1)} – ${U.int2ip(s.net + s.size - 2)})` +
          (nd.kind === 'link' ? `, diverso da quello di ${nd.routers.find(r => r !== R)} sullo stesso link.` : nd.kind === 'lan' ? ': è il default gateway degli host.' : '.')
      };
    }));

    // 5. tabella di routing: punti di test con longest prefix match
    const rows = collectRows(a);
    const live = rows.filter(r => !(r.d.empty && r.h.empty));
    live.forEach(r => {
      const kd = `rt.${r.i}.dest`, kh = `rt.${r.i}.nh`;
      marks[kd] = r.d.empty ? { ok: false, msg: 'Manca la destinazione: rete/prefisso, oppure 0.0.0.0/0 per la default.' }
        : r.d.bad === 'format' ? { ok: false, msg: 'Scrivi la destinazione come rete/prefisso (es. 200.15.42.192/27) o 0.0.0.0/0 per la default.' }
          : r.d.bad === 'host' ? { ok: false, msg: `Non è un indirizzo di rete: con /${r.d.n} i bit di host devono essere tutti a 0.` }
            : { ok: true, msg: null };
      marks[kh] = r.h.empty ? { ok: false, msg: 'Manca il next-hop.' }
        : r.h.bad ? { ok: false, msg: `Next-hop: «direttamente connessa» per le reti di ${X}, altrimenti l'IP del vicino sul link condiviso` + (X === ex.border ? '; per la default verso Internet scrivi ISP.' : '.') }
          : { ok: true, msg: null };
    });
    const valid = live.filter(usable);
    const { T, info } = routeTests(ex, ec);
    const nhTxt = v => v === 'isp' ? 'ISP (provider)' : `${U.int2ip(ec.ifOf(v, sharedLink(ex, X, v)))} (${v})`;
    const expTxt = t => t.exp === 'conn' ? '«direttamente connessa»' : t.exp.map(nhTxt).join(' oppure ');
    T.forEach(t => {
      total++;
      let ok = true, bad = null;
      t.pts.forEach(ip => {
        const r = resolve(ex, ec, X, valid, ip);
        if (ok && !testOk(t, r.set)) { ok = false; bad = { ip, r }; }
      });
      if (ok) correct++;
      let text;
      if (ok) text = `${t.label}: ✓`;
      else if (!bad.r.win.length) {
        text = `${t.label}: nessuna riga la copre. ` + (t.exp === 'conn' ? `${X} ha un'interfaccia lì: serve la riga «direttamente connessa».` : `Serve una riga (o la default) con next-hop ${expTxt(t)}.`);
      } else {
        const got = bad.r.win.map(w => `riga ${w.i}`).join(', ');
        if (t.exp === 'conn') text = `${t.label}: vince ${got}, ma ${X} ha un'interfaccia su questa rete: next-hop «direttamente connessa».`;
        else if (bad.r.set.includes('conn')) text = `${t.label}: vince ${got} con «direttamente connessa», ma ${X} non ha interfacce lì: serve ${expTxt(t)}.`;
        else text = `${t.label}: vince ${got}, ma il next-hop giusto è ${expTxt(t)}` + (t.ext && X === ex.border ? '' : ' (il vicino sul cammino più corto, IP sul link condiviso)') + '.';
        // a chi dare la colpa: alla riga esatta (next-hop) o all'aggregato che copre troppo (destinazione)
        bad.r.win.forEach(w => {
          const exactNet = t.net !== undefined && w.d.ip === t.net && w.d.n === t.pf;
          const isDef = w.d.n === 0;
          // un IP che non è di nessun vicino sul link condiviso è sempre un errore di next-hop
          const unknownNh = nhValues(ex, ec, X, w).some(v => v === '?' || v.startsWith('ip:'));
          if (exactNet || unknownNh || (isDef && (t.ext || t.free))) {
            if (marks[`rt.${w.i}.nh`].ok) marks[`rt.${w.i}.nh`] = { ok: false, msg: text };
          } else if (!isDef) {
            if (marks[`rt.${w.i}.dest`].ok) marks[`rt.${w.i}.dest`] = { ok: false, msg: `Questa riga copre anche ${t.label}, che deve andare a ${expTxt(t)}: restringi il prefisso o aggiungi una riga più specifica.` };
          }
        });
      }
      summary.push({ ok, step: 'rt', text, short: ok ? text : `${t.label}: ✗` });
    });

    // aggregazione: un punto se c'è la default e nessuna riga è superflua
    total++;
    const sig = rs => T.map(t => t.pts.map(ip => resolve(ex, ec, X, rs, ip).set.join(',')).join(';')).join('|');
    const full = sig(valid);
    const redundant = valid.filter(r => sig(valid.filter(x => x !== r)) === full);
    const hasDef = valid.some(r => r.d.n === 0);
    if (!valid.length) summary.push({ ok: false, step: 'rt', text: 'Aggregazione: la tabella è vuota.' });
    else if (!hasDef) summary.push({ ok: false, step: 'rt', text: `Aggregazione: manca la rotta di default 0.0.0.0/0 (verso ${X === ex.border ? 'il provider' : 'il router di bordo ' + ex.border}): copre Internet e assorbe tutte le reti con lo stesso next-hop.` });
    else if (redundant.length) {
      summary.push({
        ok: 'warn', step: 'rt',
        text: 'Aggregazione: ' + redundant.map(r => {
          const rest = valid.filter(x => x !== r);
          const ip = r.d.n === 0 ? EXT_IP : r.d.ip;
          const w = resolve(ex, ec, X, rest, ip).win;
          const by = w.length && w.every(x => x.d.n === 0) ? 'dalla default' : 'da un\'aggregazione (o da una riga uguale)';
          return `riga ${r.i} (${r.rd}) assorbita ${by}: togliendola nessuna destinazione cambia next-hop`;
        }).join('; ') + '. Aggrega il più possibile: toglila.'
      });
    } else {
      correct++;
      const opt = optimalRows(ex, ec.plan, X);
      const nDest = new Set(valid.map(r => r.d.ip + '/' + r.d.n)).size;
      const allOk = summary.every(s => s.ok === true);
      if (allOk && nDest > opt.count) summary.push({ ok: 'warn', step: 'rt', text: `Aggregazione: nessuna riga superflua, ma la tabella minima ha ${opt.count} righe (un solo next-hop nei pareggi, blocchi contigui e allineati con lo stesso next-hop fusi in un prefisso più corto).` });
      else summary.push({ ok: true, step: 'rt', text: 'Aggregazione: c\'è la default e nessuna riga è superflua ✓' });
    }

    // 6. forzatura del percorso
    const g = U.gradeOpen(a.q3, q3Groups(ex), 'Le leve sono costo del link, rotta statica, policy-based routing; poi il traffico di ritorno.');
    total++;
    correct += g.part;
    marks.q3 = { ok: g.part >= 1 - 1e-9, part: g.part, msg: g.msg };
    if (ex.askCost) {
      total++;
      const ok = U.numEq(a.q3cost, ex.q3.costMin);
      if (ok) correct++;
      marks.q3cost = { ok, msg: `Il percorso per ${ex.q3.via} costa ${ex.q3.altLinks.join(' + ')} = 1 + 1 = ${ex.q3.altCost}: ${ex.q3.link} deve costare di più, non uguale (pareggio). Minimo intero: ${ex.q3.costMin}.` };
    }
    return { correct, total, marks, summary };
  }

  function q3Groups(ex) {
    const q = ex.q3;
    return [
      { label: `aumentare il costo di ${q.link} sopra la somma degli altri (${q.altLinks.join(' + ')})`, any: ['costo', 'metrica', 'peso'] },
      { label: `rotta statica su ${q.srcR} con next-hop ${q.via}`, any: ['statica', 'statico', 'static'] },
      { label: 'policy-based routing (regola su sorgente e destinazione)', any: ['policy', 'pbr', 'sorgente'] },
      { label: 'il traffico di ritorno resta sul percorso diretto (asimmetrico)', any: ['ritorno', 'asimmetric', 'inverso', 'risposta'] }
    ];
  }

  // ---------------- risposte modello ----------------
  function q3Model(ex) {
    const q = ex.q3;
    const dstPf = q.dst === 'Internet' ? '0.0.0.0/0' : U.fmtPrefix(ex.sub[q.dst].net, ex.pf[q.dst]);
    const viaIp = U.int2ip(ex.iface[q.via][sharedLink(ex, q.srcR, q.via)]);
    const srcTxt = q.src === 'Internet' ? 'Internet (pacchetti entrati dall\'interfaccia verso il provider)' : q.src;
    return `(1) Costo: portare il costo di ${q.link} sopra la somma dei costi di ${q.altLinks.join(' e ')} (es. ${q.costMin} contro 1 + 1): il cammino minimo da ${q.srcR} a ${q.dstR} diventa ${q.srcR} → ${q.via} → ${q.dstR}. Effetto collaterale: tutto il traffico tra ${q.srcR} e ${q.dstR} passa per ${q.via}, non solo quello richiesto; ${q.link} resta come riserva. ` +
      `(2) Più mirato: su ${q.srcR} una rotta statica ${dstPf} con next-hop ${viaIp} (${q.via} sul link ${sharedLink(ex, q.srcR, q.via)}); la statica ha distanza amministrativa più bassa e prevale sulla rotta dinamica, poi ${q.via} inoltra già verso ${q.dstR}. ` +
      `(3) Policy-based routing su ${q.srcR}: se sorgente ∈ ${srcTxt} e destinazione ∈ ${q.dst} → inoltra a ${q.via}. ` +
      `Il traffico di ritorno da ${q.dst} a ${q.src} continua a usare ${q.link} (percorso asimmetrico) se non si configura la stessa cosa anche su ${q.dstR}: il routing IP decide per destinazione, router per router.`;
  }

  function sol2answers(ex) {
    const a = {};
    ex.nets.forEach(n => { a['need.' + n.name] = String(ex.need[n.name]); });
    ex.nets.forEach(n => {
      const s = ex.sub[n.name], b = `sub.${n.name}.`;
      a[b + 'pf'] = U.fmtPrefix(s.net, s.pf);
      a[b + 'mask'] = U.fmtMask(s.pf);
      a[b + 'first'] = U.int2ip(s.net + 1);
      a[b + 'last'] = U.int2ip(s.net + s.size - 2);
      a[b + 'bcast'] = U.int2ip(s.net + s.size - 1);
    });
    ex.routers.forEach(R => netsOfRouter(ex, R).forEach(n => { a[`if.${R}.${n}`] = U.int2ip(ex.iface[R][n]); }));
    for (let i = 1; i <= ex.rtRows; i++) {
      const r = ex.routes[i - 1];
      a[`rt.${i}.dest`] = r ? r.dest : '';
      a[`rt.${i}.nh`] = r ? r.nh : '';
    }
    a.q3 = q3Model(ex);
    if (ex.askCost) a.q3cost = String(ex.q3.costMin);
    return a;
  }

  // ---------------- errori tipici ----------------
  function diagnose(ex, key, value, answers) {
    const v = String(value == null ? '' : value).trim();
    if (v === '') return null;
    let m;
    if ((m = /^need\.(.+)$/.exec(key))) {
      const n = netByName(ex, m[1]);
      const x = Number(v);
      if (!n || !Number.isFinite(x)) return null;
      if (n.kind === 'link') {
        if (x === 2) return 'Un link ha 2 interfacce, ma servono anche rete e broadcast: 2 + 2 = 4.';
        if (x === 3) return 'Su un link non c\'è un "router in più": le due interfacce sono già i due router. 2 + 2 = 4.';
        return null;
      }
      const h = n.hosts;
      if (x === h + 2) return 'Hai dimenticato il +1 del router: anche l\'interfaccia del router sulla LAN prende un indirizzo (è il default gateway degli host).';
      if (x === h + 1) return 'Mancano rete e broadcast: i due indirizzi riservati di ogni sottorete non si assegnano a nessuno (+2).';
      if (x === h) return 'Hai contato solo gli host: aggiungi 1 per il router e 2 per rete e broadcast.';
      if (x === ex.size[n.name] && x !== ex.need[n.name]) return 'Questo è già il blocco arrotondato alla potenza di 2: qui scrivi gli indirizzi necessari (host + 1 + 2), l\'arrotondamento è il passo dopo.';
      return null;
    }
    if ((m = /^sub\.(.+)\.(pf|mask|first|last|bcast)$/.exec(key))) {
      const name = m[1], f = m[2];
      const ec = evalCtx(ex, Object.assign({}, answers || {}, { [key]: value }));
      if (f === 'pf') {
        const r = ec.pfc[name];
        const need = ex.need[name];
        switch (r.why) {
          case 'format': return `Scrivi rete/prefisso, per esempio ${U.fmtPrefix(ex.start, ex.pf[name])}.`;
          case 'out': return `Fuori dallo spazio assegnato: tutto deve stare tra ${U.int2ip(ex.start)} e ${U.int2ip(ex.start + ex.space - 1)}.`;
          case 'align': return `Rete non allineata: un blocco da ${r.size} può partire solo da un multiplo di ${r.size} (nell'ultimo ottetto: ${multiples(r.size)}).`;
          case 'small': {
            const lim = netByName(ex, name).kind === 'lan' && need - 1 <= r.size ? ' Senza il +1 del router ci starebbe: è proprio il caso al limite.' : '';
            return `Un /${r.p.n} ha ${r.size} indirizzi, meno dei ${need} necessari: serve un /${ex.pf[name]} (${ex.size[name]}).` + lim;
          }
          case 'big': return `Blocco troppo grande: un /${r.p.n} ha ${r.size} indirizzi, ma ne bastano ${ex.size[name]} (/${ex.pf[name]}). Si spreca spazio e alla fine le altre reti non ci stanno.`;
          case 'overlap': return `Si sovrappone a ${r.other}: due sottoreti non possono condividere indirizzi. Metti i blocchi uno dopo l'altro, dal più grande.`;
          default: return null;
        }
      }
      const R = ec.ref[name];
      if (f === 'mask') {
        const t = v.replace(/\s/g, '');
        for (let k = 8; k <= 32; k++) if (k !== R.pf && t === U.fmtMask(k)) return `Questa è la maschera di /${k}: per /${R.pf} il blocco è ${R.size}, quindi nell'ottetto del confine va 256 − ${Math.min(R.size, 256)} = ${256 - Math.min(R.size, 256)}.`;
        const lo = Number(t.split('.')[3]);
        if (R.size < 256 && lo === R.size) return `Nell'ottetto del confine va 256 − blocco, non il blocco: 256 − ${R.size} = ${256 - R.size}.`;
        return null;
      }
      const x = U.ip2int(v);
      if (x === null) return 'Scrivi un indirizzo IP completo (quattro numeri separati da punti).';
      const bc = R.net + R.size - 1;
      if (f === 'first') {
        if (x === R.net) return 'Questo è l\'indirizzo di rete, che non si assegna: il primo utile è rete + 1.';
        return null;
      }
      if (f === 'last') {
        if (x === bc) return 'Questo è il broadcast, che non si assegna: l\'ultimo utile è broadcast − 1.';
        if (x === bc + 1) return 'Questo è già fuori dalla sottorete (è la rete successiva): l\'ultimo utile è broadcast − 1.';
        return null;
      }
      if (f === 'bcast') {
        if (x === bc + 1) return `Sbagliato di uno: rete + ${R.size} è già la rete successiva. Il broadcast è rete + dimensione − 1.`;
        if (x === bc - 1) return 'Questo è l\'ultimo utile: il broadcast è l\'indirizzo subito dopo (tutti i bit di host a 1).';
        for (let k = 1; k <= 8; k++) if (P2(k) !== R.size && x === R.net + P2(k) - 1) return `Questo è il broadcast di un blocco da ${P2(k)} (/${32 - k}): ${name} ha un blocco da ${R.size}.`;
        return null;
      }
    }
    if ((m = /^if\.(R\d)\.(.+)$/.exec(key))) {
      const R = m[1], name = m[2];
      const ec = evalCtx(ex, Object.assign({}, answers || {}, { [key]: value }));
      const x = U.ip2int(v);
      if (x === null) return 'Scrivi un indirizzo IP completo.';
      const s = ec.plan[name];
      if (x === s.net) return `È l'indirizzo di rete di ${name}: non si assegna a un'interfaccia.`;
      if (x === s.net + s.size - 1) return `È il broadcast di ${name}: non si assegna a un'interfaccia.`;
      if (ec.ifwhy[key] === 'same') {
        const other = netByName(ex, name).routers.find(r => r !== R);
        return `È lo stesso indirizzo di ${other} su ${name}: sul /30 i due estremi prendono i due indirizzi utili, uno per router.`;
      }
      if (!(x > s.net && x < s.net + s.size - 1)) {
        const where = Object.keys(ec.plan).find(n => x >= ec.plan[n].net && x < ec.plan[n].net + ec.plan[n].size);
        return (where ? `Questo indirizzo sta in ${where}, non in ${name}` : `Questo indirizzo non sta in ${name}`) + ': l\'interfaccia deve stare nella sottorete a cui è collegata.';
      }
      return null;
    }
    if ((m = /^rt\.(\d+)\.(dest|nh)$/.exec(key))) {
      const i = m[1];
      const A = Object.assign({}, answers || {}, { [key]: value });
      const ec = evalCtx(ex, A);
      const X = ex.asked;
      const d = parseDest(A[`rt.${i}.dest`]);
      if (m[2] === 'dest') {
        if (d.bad === 'format') return 'Scrivi la destinazione come rete/prefisso, oppure 0.0.0.0/0 per la default.';
        if (d.bad === 'host') {
          const nn = d.ip - (d.ip % P2(32 - d.n));
          return `Non è un indirizzo di rete: con /${d.n} la rete che lo contiene è ${U.fmtPrefix(nn, d.n)}.`;
        }
        if (d.ip !== undefined && d.n > 0) {
          const same = Object.keys(ec.plan).find(n => ec.plan[n].net === d.ip && ec.plan[n].pf !== d.n);
          if (same) return `${same} è ${U.fmtPrefix(ec.plan[same].net, ec.plan[same].pf)}: con /${d.n} la riga ${d.n < ec.plan[same].pf ? 'copre anche altre reti' : 'copre solo una parte della rete'}.`;
        }
        return null;
      }
      if (/^r\d$/i.test(v)) return `Scrivi l'IP del vicino sul link condiviso, non il nome del router: il next-hop serve per l'ARP.`;
      const h = parseNh(v);
      if (!h.toks) return null;
      const destNet = d.ip !== undefined && d.n > 0 ? Object.keys(ec.plan).find(n => ec.plan[n].net === d.ip && ec.plan[n].pf === d.n) : null;
      const isConn = destNet && netByName(ex, destNet).routers.includes(X);
      const hasIp = h.toks.some(t => t.ip !== undefined);
      if (isConn && hasIp) return `${X} ha un'interfaccia su ${destNet}: il next-hop è «direttamente connessa», non un IP (consegna da solo, con l'ARP).`;
      if (destNet && !isConn && h.toks.some(t => t.c === 'conn')) return `${X} non ha interfacce su ${destNet}: serve l'IP del vicino sul link condiviso.`;
      for (const t of h.toks) {
        if (t.ip === undefined) continue;
        const own = netsOfRouter(ex, X).find(n => ec.ifOf(X, n) === t.ip);
        if (own) return `È un indirizzo di ${X} stesso (su ${own}): il next-hop è l'interfaccia del VICINO sul link condiviso.`;
        for (const R of ex.routers) {
          if (R === X) continue;
          const on = netsOfRouter(ex, R).find(n => ec.ifOf(R, n) === t.ip);
          if (!on) continue;
          const sl = sharedLink(ex, X, R);
          if (!sl) return `${R} non è un vicino diretto di ${X}: il next-hop è il primo router sul cammino, con l'IP sul link che condivide con ${X}.`;
          if (on !== sl) return `È un'interfaccia di ${R}, ma non sul link che condivide con ${X} (${sl}): il next-hop deve stare su una rete direttamente connessa, altrimenti l'ARP non lo trova.`;
        }
      }
      return null;
    }
    if (key === 'q3cost') {
      const x = Number(v);
      if (!Number.isFinite(x)) return null;
      if (x === ex.q3.altCost) return `Con ${x} c'è un pareggio con il percorso per ${ex.q3.via} (1 + 1): il traffico potrebbe ancora usare ${ex.q3.link}. Serve un costo strettamente maggiore.`;
      if (x < ex.q3.altCost) return `Con ${x} il collegamento diretto costa ancora meno del giro per ${ex.q3.via} (${ex.q3.altCost}).`;
      if (x > ex.q3.costMin) return `Funziona, ma non è il minimo: basta superare di 1 la somma degli altri link (${ex.q3.altCost}).`;
      return null;
    }
    return null;
  }
  function multiples(size) {
    const out = [];
    for (let x = 0; x < 256 && out.length < 6; x += size) out.push('.' + x);
    return out.join(', ') + (256 / size > 6 ? ', …' : '');
  }

  function diagnoseCases(ex) {
    const sol = sol2answers(ex);
    const out = [];
    const lan = ex.nets.find(n => n.kind === 'lan');
    out.push({ key: 'need.' + lan.name, value: String(lan.hosts + 2), expect: '+1 del router' });
    out.push({ key: 'need.' + lan.name, value: String(lan.hosts + 1), expect: 'rete e broadcast' });
    const bigLan = ex.nets.filter(n => n.kind === 'lan').sort((a, b) => ex.size[b.name] - ex.size[a.name])[0];
    const bs = ex.sub[bigLan.name];
    out.push({ key: `sub.${bigLan.name}.pf`, value: U.fmtPrefix(bs.net, bs.pf + 1), expect: 'meno dei' });
    out.push({ key: `sub.${bigLan.name}.pf`, value: U.fmtPrefix(bs.net + 4, bs.pf), expect: 'non allineata' });
    out.push({ key: `sub.${bigLan.name}.bcast`, value: U.int2ip(bs.net + bs.size), expect: 'rete successiva' });
    out.push({ key: `sub.${bigLan.name}.last`, value: U.int2ip(bs.net + bs.size - 1), expect: 'è il broadcast' });
    out.push({ key: `sub.${bigLan.name}.mask`, value: U.fmtMask(bs.pf + 1), expect: 'maschera di /' });
    // interfaccia LAN messa su un link
    const R0 = lan.routers[0];
    out.push({ key: `if.${R0}.${lan.name}`, value: U.int2ip(ex.sub.Link_1.net + 1), expect: 'nella sottorete a cui' });
    const l1 = ex.links[0];
    out.push({ key: `if.${l1.b}.${l1.name}`, value: sol[`if.${l1.a}.${l1.name}`], expect: 'stesso indirizzo' });
    // tabella di routing
    const X = ex.asked;
    const idx = ex.routes.findIndex(r => r.v && r.v !== 'isp');
    if (idx >= 0) {
      const r = ex.routes[idx];
      const own = U.int2ip(ex.iface[X][sharedLink(ex, X, r.v)]);
      out.push({ key: `rt.${idx + 1}.nh`, value: own, expect: 'stesso' });
      const otherIf = netsOfRouter(ex, r.v).find(n => n !== sharedLink(ex, X, r.v));
      out.push({ key: `rt.${idx + 1}.nh`, value: U.int2ip(ex.iface[r.v][otherIf]), expect: 'non sul link' });
    }
    const ci = ex.routes.findIndex(r => r.nh === 'direttamente connessa');
    const nb = adj(ex)[X][0];
    out.push({ key: `rt.${ci + 1}.nh`, value: U.int2ip(ex.iface[nb.r][nb.link]), expect: 'direttamente connessa' });
    if (ex.askCost) out.push({ key: 'q3cost', value: String(ex.q3.altCost), expect: 'pareggio' });
    return out;
  }

  // ---------------- aiuti ----------------
  function spaceTxt(ex) {
    return `${U.fmtPrefix(ex.start, ex.prefix)} → ${32 - ex.prefix} bit di host → ${ex.space} indirizzi, da ${U.int2ip(ex.start)} a ${U.int2ip(ex.start + ex.space - 1)}`;
  }
  function blocksSum(ex) {
    const lanS = ex.nets.filter(n => n.kind === 'lan').map(n => ex.size[n.name]);
    return `${lanS.join(' + ')} + ${ex.links.length}×4 = ${ex.used}`;
  }

  function hints(ex) {
    const X = ex.asked;
    const info = routeInfo(ex, X);
    const lans = ex.nets.filter(n => n.kind === 'lan');
    const q = ex.q3;
    return [
      {
        step: 'need', title: 'Quanti indirizzi servono a ogni sottorete',
        metodo: 'Per ogni LAN: host + 1 (l\'interfaccia del router, che è il default gateway) + 2 (rete e broadcast). Per ogni link tra router: 2 interfacce + 2 = 4. Il +1 del router è l\'errore più frequente.',
        applicato: `Spazio: ${spaceTxt(ex)}. LAN: ${lans.map(n => `${n.name} ${n.hosts} host`).join(', ')}. Link: ${ex.links.map(l => l.name).join(', ')}.`,
        svolto: ex.nets.map(n => n.kind === 'lan' ? `${n.name}: ${n.hosts} + 1 + 2 = ${ex.need[n.name]}` : `${n.name}: 2 + 2 = 4`).join('\n')
      },
      {
        step: 'pf', title: 'Blocchi e assegnazione',
        metodo: 'Arrotonda alla potenza di 2 superiore: è il blocco; prefisso = 32 − log2(blocco). Controlla che la somma stia nello spazio, poi assegna dal blocco più grande al più piccolo, uno dopo l\'altro dall\'inizio: così ogni blocco parte da un multiplo della sua dimensione (allineamento) e non restano buchi.',
        applicato: `Blocchi: ${ex.nets.map(n => `${n.name} ${ex.size[n.name]}`).join(', ')}. Somma: ${blocksSum(ex)} su ${ex.space}. Si parte da ${U.int2ip(ex.start)}.`,
        svolto: ex.order.map(n => `${n}: ${ex.need[n]} → blocco ${ex.size[n]} → ${U.fmtPrefix(ex.sub[n].net, ex.pf[n])}`).join('\n') +
          (ex.free.length ? `\nLibero: ${ex.free.map(b => U.fmtPrefix(b.net, 32 - Math.log2(b.size))).join(', ')}` : '\nLo spazio è usato tutto.')
      },
      {
        step: 'addr', title: 'Maschera, range e broadcast',
        metodo: 'Maschera: nell\'ottetto del confine vale 256 − blocco (64 → 192, 16 → 240, 4 → 252). Broadcast = rete + blocco − 1. Primo utile = rete + 1, ultimo utile = broadcast − 1.',
        applicato: ex.order.slice(0, 3).map(n => `${n}: rete ${U.int2ip(ex.sub[n].net)}, blocco ${ex.size[n]} → maschera con 256 − ${ex.size[n]}, broadcast = ${ex.sub[n].net & 255} + ${ex.size[n]} − 1 nell'ultimo ottetto`).join('\n'),
        svolto: ex.nets.map(n => { const s = ex.sub[n.name]; return `${n.name}: ${U.fmtPrefix(s.net, s.pf)} · ${U.fmtMask(s.pf)} · ${U.int2ip(s.net + 1)} – ${U.int2ip(s.net + s.size - 2)} · broadcast ${U.int2ip(s.net + s.size - 1)}`; }).join('\n')
      },
      {
        step: 'if', title: 'Indirizzi delle interfacce dei router',
        metodo: 'Ogni router ha un indirizzo in ogni sottorete a cui è collegato. Sulla LAN di solito il primo utile (va bene anche un altro, basta essere coerenti). Sul /30 di un link i due utili vanno uno per estremo.',
        applicato: ex.routers.map(R => `${R}: ${netsOfRouter(ex, R).join(', ')}`).join('\n') + `\n${ex.border} ha anche l'interfaccia verso Internet, ma quell'indirizzo lo dà il provider.`,
        svolto: ex.routers.map(R => `${R}: ` + netsOfRouter(ex, R).map(n => `${n} ${U.int2ip(ex.iface[R][n])}`).join(', ')).join('\n')
      },
      {
        step: 'rt', title: `Tabella di routing di ${X}`,
        metodo: 'Reti su cui il router ha un\'interfaccia: «direttamente connessa». Reti remote: IP del vicino sul cammino più corto, preso sul link che li collega (serve l\'ARP). Pareggio: uno dei due o entrambi. Default 0.0.0.0/0 verso il router di bordo. Poi aggrega: una rete con lo stesso next-hop della default si toglie (longest prefix match).',
        applicato: `${X} è collegato a: ${netsOfRouter(ex, X).join(', ')}. Vicini: ${adj(ex)[X].map(n => `${n.r} su ${n.link}`).join(', ')}. ` +
          (X === ex.border ? `${X} è il router di bordo: la sua default va al provider (scrivi ISP).` : `La default va verso ${ex.border}${info.extHops > 1 ? ' (passando per il vicino sul cammino)' : ''}.`),
        svolto: ex.routes.map(r => `${r.dest} → ${r.nh}`).join('\n')
      },
      {
        step: 'q3', title: 'Forzare un percorso',
        metodo: 'Tre leve: (1) alzare il costo del link diretto sopra la somma degli altri; (2) rotta statica sul router di partenza con next-hop il router da attraversare; (3) policy-based routing su sorgente e destinazione. Dì anche gli effetti collaterali e che il traffico di ritorno non cambia (percorso asimmetrico).',
        applicato: `Oggi il traffico da ${q.src} a ${q.dst} va da ${q.srcR} a ${q.dstR} direttamente su ${q.link}. Il giro per ${q.via} usa ${q.altLinks.join(' e ')}: costo 1 + 1.`,
        svolto: q3Model(ex) + (ex.askCost ? `\nCosto minimo di ${q.link}: ${q.altCost} + 1 = ${q.costMin} (con ${q.altCost} sarebbe un pareggio).` : '')
      }
    ];
  }

  function fieldHint(ex, key) {
    let m;
    const X = ex.asked;
    if ((m = /^need\.(.+)$/.exec(key))) {
      const n = netByName(ex, m[1]);
      return n.kind === 'lan' ? `${n.name} ha ${n.hosts} host: aggiungi l'interfaccia del router e i due indirizzi riservati.` : 'Link punto-punto: quante interfacce ci sono? Poi aggiungi rete e broadcast.';
    }
    if ((m = /^sub\.(.+)\.(pf|mask|first|last|bcast)$/.exec(key))) {
      return {
        pf: `Blocco = potenza di 2 ≥ indirizzi necessari. La rete parte da un multiplo del blocco, dentro ${U.int2ip(ex.start)} – ${U.int2ip(ex.start + ex.space - 1)}, dopo i blocchi più grandi.`,
        mask: 'Nell\'ottetto del confine: 256 − dimensione del blocco.',
        first: 'Indirizzo di rete + 1.',
        last: 'Broadcast − 1.',
        bcast: 'Rete + dimensione del blocco − 1.'
      }[m[2]];
    }
    if ((m = /^if\.(R\d)\.(.+)$/.exec(key))) {
      const n = netByName(ex, m[2]);
      return n.kind === 'lan' ? `Un indirizzo utile di ${n.name} (di solito il primo): sarà il default gateway degli host.` : `Uno dei due utili del /30 di ${n.name}; l'altro va a ${n.routers.find(r => r !== m[1])}.`;
    }
    if (/^rt\.\d+\.dest$/.test(key)) return 'Rete/prefisso di destinazione, come nello schema; 0.0.0.0/0 per la default. Una riga per ogni rete che non è già coperta dalla default con lo stesso next-hop.';
    if (/^rt\.\d+\.nh$/.test(key)) return `«direttamente connessa» se ${X} ha un'interfaccia su quella rete; altrimenti l'IP del vicino sul link che condivide con ${X}` + (X === ex.border ? '; per la default di un router di bordo: ISP.' : '.') + ' Nel pareggio puoi scrivere uno o entrambi gli IP.';
    if (key === 'q3') return `Tre leve: costo di ${ex.q3.link}, rotta statica su ${ex.q3.srcR}, policy-based routing. E il traffico di ritorno che strada fa?`;
    if (key === 'q3cost') return 'Il percorso alternativo costa la somma dei suoi link; quello diretto deve costare di più, non uguale.';
    return 'Rileggi il testo della domanda.';
  }

  // ---------------- figura ----------------
  function svgTopology(ex) {
    const W = 560;
    const pos = {};
    let H, out = '';
    const tri = ex.topo === 'triangle';
    if (tri) {
      H = 345;
      const others = ex.routers.filter(r => r !== ex.border);
      pos[ex.border] = { x: 280, y: 125, slots: ['right', 'left'] };
      pos[others[0]] = { x: 160, y: 250, slots: ['below', 'left'] };
      pos[others[1]] = { x: 400, y: 250, slots: ['below', 'right'] };
    } else {
      H = 262;
      pos.R1 = { x: 110, y: 165, slots: ['below'] };
      pos.R2 = { x: 280, y: 165, slots: ['below'] };
      pos.R3 = { x: 450, y: 165, slots: ['below'] };
    }
    const RR = 18, BW = 100, BH = 34;
    const cx = U.sum(ex.routers.map(r => pos[r].x)) / 3, cy = U.sum(ex.routers.map(r => pos[r].y)) / 3;
    // Internet
    const b = pos[ex.border];
    const cloudY = tri ? 40 : 45;
    out += `<ellipse cx="${b.x}" cy="${cloudY}" rx="62" ry="22" class="cloud"/>`;
    out += `<text x="${b.x}" y="${cloudY + 4}" text-anchor="middle" class="lbl b">INTERNET</text>`;
    out += `<line x1="${b.x}" y1="${cloudY + 22}" x2="${b.x}" y2="${b.y - RR}" class="link"/>`;
    // link nuovo della domanda iii (catena)
    if (ex.q3.newLink) {
      const p1 = pos[ex.q3.newLink.a], p2 = pos[ex.q3.newLink.b];
      out += `<path d="M${p1.x},${p1.y} Q${(p1.x + p2.x) / 2},30 ${p2.x},${p2.y}" class="link" stroke-dasharray="6 4"/>`;
      out += `<text x="${(p1.x + p2.x) / 2}" y="90" text-anchor="middle" class="lbl small">${ex.q3.newLink.name} (si aggiunge nella domanda iii)</text>`;
    }
    // link
    ex.links.forEach(l => {
      const p1 = pos[l.a], p2 = pos[l.b];
      out += `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" class="link"/>`;
      const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      let lx, ly, anchor;
      if (tri) {
        let ux = mx - cx, uy = my - cy;
        const len = Math.hypot(ux, uy) || 1;
        ux /= len; uy /= len;
        lx = mx + ux * 16; ly = my + uy * 16 + 4;
        anchor = ux < -0.3 ? 'end' : ux > 0.3 ? 'start' : 'middle';
        if (anchor === 'middle' && uy > 0) ly += 6;
      } else { lx = mx; ly = my - 8; anchor = 'middle'; }
      out += `<text x="${Math.round(lx)}" y="${Math.round(ly)}" text-anchor="${anchor}" class="lbl small">${l.name}</text>`;
    });
    // LAN
    ex.routers.forEach(R => {
      const p = pos[R];
      ex.lans.filter(l => l.router === R).forEach((l, i) => {
        const slot = p.slots[i] || p.slots[0];
        let bx, by, x1, y1, x2, y2;
        if (slot === 'below') { bx = p.x - BW / 2; by = p.y + (tri ? 50 : 50); x1 = p.x; y1 = p.y + RR; x2 = p.x; y2 = by; }
        else if (slot === 'right') { bx = p.x + RR + (tri && R === ex.border ? 22 : 27); by = p.y - BH / 2; x1 = p.x + RR; y1 = p.y; x2 = bx; y2 = p.y; }
        else { bx = p.x - RR - (tri && R === ex.border ? 22 : 27) - BW; by = p.y - BH / 2; x1 = p.x - RR; y1 = p.y; x2 = bx + BW; y2 = p.y; }
        out += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="link"/>`;
        out += `<rect x="${bx}" y="${by}" width="${BW}" height="${BH}" rx="4" class="lan"/>`;
        out += `<text x="${bx + BW / 2}" y="${by + 14}" text-anchor="middle" class="lbl b">${l.name}</text>`;
        out += `<text x="${bx + BW / 2}" y="${by + 27}" text-anchor="middle" class="lbl small">${l.hosts} host</text>`;
      });
    });
    // router sopra le linee
    ex.routers.forEach(R => {
      const p = pos[R];
      out += `<circle cx="${p.x}" cy="${p.y}" r="${RR}" class="router"/>`;
      out += `<text x="${p.x}" y="${p.y + 4}" text-anchor="middle" class="lbl w">${R}</text>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" class="fig" role="img" aria-label="topologia della rete">${out}</svg>`;
  }

  // ---------------- testo ----------------
  function q3Text(ex) {
    const q = ex.q3;
    if (q.newLink) {
      return `Si aggiunge un nuovo collegamento ${q.newLink.name} tra R1 e R3 (stesso costo degli altri; il suo indirizzamento non è richiesto). Dopo l'aggiunta il traffico da ${q.src} a ${q.dst} userebbe ${q.newLink.name}. Come si può fare in modo che continui a passare per ${q.via}, senza eliminare ${q.link}?`;
    }
    return `Se l'organizzazione volesse forzare il traffico da ${q.src} a ${q.dst} a passare per ${q.via}, come potrebbe ottenerlo (senza eliminare ${q.link})?`;
  }
  function costText(ex) {
    const q = ex.q3;
    return `Costo minimo intero da dare a ${q.link} (gli altri link valgono 1) perché quel traffico passi per ${q.via}:`;
  }
  function introText(ex) {
    const X = ex.asked;
    return `Alla tua organizzazione è assegnato lo spazio ${U.fmtPrefix(ex.start, ex.prefix)}. La figura mostra la struttura interna: ${ex.border} è il router di bordo, collegato a Internet (l'indirizzo verso il provider lo assegna il provider e non fa parte dello spazio). ` +
      `Link punto-punto: ${ex.links.map(l => `${l.name} (${l.a}–${l.b})`).join(', ')}. LAN: ${ex.lans.map(l => `${l.name} ${l.hosts} host su ${l.router}`).join(', ')}.` +
      (X === ex.border ? ` Nella tabella di ${X} la default va al provider: come next-hop scrivi «ISP».` : '');
  }

  // ---------------- disegno ----------------
  function render(ex, root, ctx) {
    root.appendChild(U.h('div', { class: 'card intro' },
      U.fig(svgTopology(ex), ex.q3.newLink ? 'Topologia. Tratteggiato: il link che si aggiunge solo nella domanda iii (non va indirizzato né messo in tabella).' : 'Topologia dell\'esercizio.'),
      U.h('p', {}, U.h('b', {}, 'Testo. '), introText(ex)),
      U.h('p', { class: 'small' }, 'i. Schema di indirizzamento: per ogni sottorete indirizzi necessari, rete/prefisso, maschera, range utile e broadcast; poi gli IP delle interfacce dei router. ii. Tabella di routing. iii. Forzare un percorso.')));

    // i. schema
    const rows = ex.nets.map(n => {
      const lbl = n.kind === 'lan' ? `${n.name} (su ${n.routers[0]})` : `${n.name} (${n.routers.join('–')})`;
      const b = `sub.${n.name}.`;
      return [U.label(lbl), U.given(n.kind === 'lan' ? String(n.hosts) : '—'),
        U.inp(ctx, 'need.' + n.name, { w: 'xs', label: `indirizzi necessari ${n.name}` }),
        U.inp(ctx, b + 'pf', { w: 'm', ph: 'a.b.c.d/n', label: `rete/prefisso ${n.name}` }),
        U.inp(ctx, b + 'mask', { w: 'm', label: `maschera ${n.name}` }),
        U.inp(ctx, b + 'first', { w: 'm', label: `primo utile ${n.name}` }),
        U.inp(ctx, b + 'last', { w: 'm', label: `ultimo utile ${n.name}` }),
        U.inp(ctx, b + 'bcast', { w: 'm', label: `broadcast ${n.name}` })];
    });
    root.appendChild(U.card('i. Schema di indirizzamento', { step: 'need' },
      U.h('p', { class: 'small' }, `Spazio ${U.fmtPrefix(ex.start, ex.prefix)}. Indirizzi necessari: per una LAN host + router + rete e broadcast; per un link le 2 interfacce + rete e broadcast.`),
      U.table(['Sottorete', 'Host', 'Indirizzi necessari', 'Rete/prefisso', 'Maschera', 'Primo utile', 'Ultimo utile', 'Broadcast'], rows)));

    // interfacce
    const linkNames = ex.links.map(l => l.name);
    const ifRows = ex.routers.map(R => {
      const myLans = ex.lans.filter(l => l.router === R);
      return [U.label(R + (R === ex.border ? ' (bordo)' : '')),
        myLans.map(l => U.h('div', { class: 'num-row' }, U.h('span', { class: 'row-lbl' }, l.name + ':'), U.inp(ctx, `if.${R}.${l.name}`, { w: 'm', label: `${R} su ${l.name}` }))),
        ...linkNames.map(L => netByName(ex, L).routers.includes(R) ? U.inp(ctx, `if.${R}.${L}`, { w: 'm', label: `${R} su ${L}` }) : U.given('—'))];
    });
    root.appendChild(U.card('… e indirizzi IP delle interfacce dei router', { step: 'if' },
      U.table(['Router', 'Interfaccia su LAN', ...linkNames], ifRows),
      U.h('p', { class: 'small' }, `${ex.border} ha anche un'interfaccia verso Internet: il suo indirizzo lo assegna il provider.`)));

    // ii. tabella di routing (righe dinamiche)
    let n = ex.rtRows;
    Object.keys(ctx.initial || {}).forEach(k => { const m = /^rt\.(\d+)\./.exec(k); if (m) n = Math.max(n, Number(m[1])); });
    const tbl = U.table(['#', 'Destinazione (rete/prefisso)', 'Next-hop'], []);
    const tbody = tbl.querySelector('tbody');
    const rowEl = i => U.h('tr', {},
      U.h('td', { class: 'lbl-td' }, String(i)),
      U.h('td', {}, U.inp(ctx, `rt.${i}.dest`, { w: 'l', ph: i === 1 ? 'es. ' + U.fmtPrefix(ex.start, ex.prefix + 2) : '', label: `destinazione riga ${i}` })),
      U.h('td', {}, U.inp(ctx, `rt.${i}.nh`, { w: 'l', ph: i === 1 ? 'IP del vicino o «direttamente connessa»' : '', label: `next-hop riga ${i}` })));
    for (let i = 1; i <= n; i++) tbody.appendChild(rowEl(i));
    root.appendChild(U.card(`ii. Tabella di routing di ${ex.asked}`, { step: 'rt' },
      U.h('p', { class: 'small' }, `I link hanno tutti lo stesso costo. Aggrega il più possibile. Per le reti connesse scrivi «direttamente connessa»; nel pareggio puoi mettere uno dei due next-hop o entrambi (separati da «o»).` +
        (ex.asked === ex.border ? ' Per la default verso Internet scrivi «ISP».' : '')),
      tbl,
      U.h('button', { class: 'btn ghost sm', type: 'button', text: '+ aggiungi riga', onclick: () => { n++; tbody.appendChild(rowEl(n)); } })));

    // iii. forzatura
    root.appendChild(U.card('iii. ' + q3Text(ex), { step: 'q3' },
      U.ta(ctx, 'q3', { rows: 4, ph: 'costo del link… rotta statica… policy-based routing… traffico di ritorno…' }),
      ex.askCost ? U.row(costText(ex), U.inp(ctx, 'q3cost', { w: 'xs', label: 'costo minimo' })) : null));
  }

  // ---------------- soluzione ----------------
  function solution(ex, root) {
    const X = ex.asked;
    const info = routeInfo(ex, X);
    const q = ex.q3;
    const pfx = (net, size) => U.fmtPrefix(net, 32 - Math.log2(size));
    const nhTxt = v => v === 'isp' ? 'ISP' : `${U.int2ip(ex.iface[v][sharedLink(ex, X, v)])} (${v})`;
    const card = U.h('div', { class: 'card sol' }, U.h('h4', {}, 'Soluzione'));
    const P = (...k) => card.appendChild(U.h('p', { class: 'sol-body' }, ...k));

    P(U.h('b', {}, '1. Spazio. '), spaceTxt(ex) + '.');
    P(U.h('b', {}, '2. Indirizzi necessari e blocchi. '), 'LAN: host + 1 (router) + 2 (rete e broadcast); link: 2 + 2 = 4. Si arrotonda alla potenza di 2 superiore.');
    card.appendChild(U.table(['Sottorete', 'Calcolo', 'Blocco', 'Prefisso', 'Perché non il blocco più piccolo'],
      ex.nets.map(n => [n.name, n.kind === 'lan' ? `${n.hosts} + 1 + 2 = ${ex.need[n.name]}` : '2 + 2 = 4', String(ex.size[n.name]), '/' + ex.pf[n.name],
        n.kind === 'lan' ? `un /${ex.pf[n.name] + 1} ha ${ex.size[n.name] / 2} indirizzi < ${ex.need[n.name]}` : 'è già il minimo con 2 interfacce'])));
    P(U.h('b', {}, '3. Ci sta? '), `${blocksSum(ex)} ≤ ${ex.space}: ci sta` + (ex.used < ex.space ? `, avanzano ${ex.space - ex.used} indirizzi.` : ', senza avanzi: lo spazio è usato tutto.'));
    P(U.h('b', {}, '4. Assegnazione in ordine decrescente. '), 'Ogni blocco deve partire da un multiplo della sua dimensione. Mettendo prima i più grandi, la fine di ogni blocco è già un multiplo valido per quelli più piccoli che seguono: niente buchi.');
    card.appendChild(U.table(['Ordine', 'Sottorete', 'Blocco', 'Parte da', 'Allineamento'],
      ex.order.map((n, i) => { const s = ex.sub[n]; const o = s.net & 255; return [String(i + 1), n, String(s.size), U.int2ip(s.net), `${o} = ${o / s.size} × ${s.size}`]; })));
    card.appendChild(U.table(['Sottorete', 'Rete/prefisso', 'Maschera', 'Primo utile', 'Ultimo utile', 'Broadcast'],
      ex.nets.map(n => { const s = ex.sub[n.name]; return [n.name, U.fmtPrefix(s.net, s.pf), U.fmtMask(s.pf), U.int2ip(s.net + 1), U.int2ip(s.net + s.size - 2), U.int2ip(s.net + s.size - 1)]; })
        .concat(ex.free.map(b => ['(libero)', pfx(b.net, b.size), '', '', '', '']))));
    P('Broadcast = rete + blocco − 1; maschera = 256 − blocco nell\'ultimo ottetto.');
    P(U.h('b', {}, '5. Interfacce. '), 'Sulla LAN il primo utile; sui /30 un indirizzo per estremo.');
    card.appendChild(U.table(['Router', 'Interfacce'], ex.routers.map(R => [R + (R === ex.border ? ' (bordo)' : ''), netsOfRouter(ex, R).map(n => `${n}: ${U.int2ip(ex.iface[R][n])}`).join(' · ') + (R === ex.border ? ' · Internet: dal provider' : '')])));

    // routing
    P(U.h('b', {}, `6. Tabella di routing di ${X}, versione completa (per ragionare). `));
    const full = ex.nets.map(n => {
      const s = ex.sub[n.name];
      const al = info.allowed[n.name];
      if (al === 'conn') return [`${U.fmtPrefix(s.net, s.pf)} (${n.name})`, 'direttamente connessa', `${X} ha un'interfaccia su ${n.name}`];
      return [`${U.fmtPrefix(s.net, s.pf)} (${n.name})`, al.map(nhTxt).join(' oppure '), al.length > 1 ? `pareggio: ${al.join(' e ')} a ${info.hops[n.name]} salt${info.hops[n.name] === 1 ? 'o' : 'i'}` : `${info.hops[n.name]} salt${info.hops[n.name] === 1 ? 'o' : 'i'} via ${al[0]}`];
    });
    full.push(['0.0.0.0/0 (Internet)', info.ext.map(nhTxt).join(' oppure '), X === ex.border ? `${X} è il router di bordo: la default va al provider` : `verso il router di bordo ${ex.border}`]);
    card.appendChild(U.table(['Destinazione', 'Next-hop', 'Perché'], full));
    P(U.h('b', {}, 'Tabella aggregata (la risposta). '), 'Longest prefix match: vince la riga con il prefisso più lungo che contiene la destinazione.');
    card.appendChild(U.table(['Destinazione', 'Next-hop'], ex.routes.map(r => [r.dest + (r.what === 'default' ? ' (default)' : r.what !== 'aggregato' && r.what ? ` (${r.what})` : ' (aggregato)'), r.nh])));
    const why = [];
    ex.nets.forEach(n => {
      if (info.allowed[n.name] === 'conn') return;
      const s = ex.sub[n.name];
      const row = ex.routes.filter(r => r.net !== undefined && s.net >= r.net && s.net < r.net + r.size).sort((a, b) => b.size - a.size).pop();
      if (row && row.what === n.name) why.push(`${n.name}: resta, il suo next-hop (${row.nh}) è diverso da quello della default.`);
      else if (row) why.push(`${n.name}: fusa nell'aggregato ${row.dest}, blocchi contigui e allineati con lo stesso next-hop.`);
      else why.push(`${n.name}: tolta, ${info.allowed[n.name].length > 1 ? 'nel pareggio si sceglie il vicino della default, quindi ' : ''}ha lo stesso next-hop della default che la copre già.`);
    });
    if (ex.free.length) why.push(`Spazio libero: segue la default.` + (X === ex.border ? ' Nota: sul router di bordo una rotta «scarta» (null route) per tutto ' + U.fmtPrefix(ex.start, ex.prefix) + ' evita che quei pacchetti rimbalzino con il provider fino allo scadere del TTL.' : ''));
    card.appendChild(U.h('ul', { class: 'sol-body' }, why.map(w => U.h('li', {}, w))));

    // iii
    P(U.h('b', {}, '7. Forzare il percorso. '), `Oggi il traffico da ${q.src} a ${q.dst} va da ${q.srcR} a ${q.dstR} su ${q.link} (1 salto) invece di ${q.srcR} → ${q.via} → ${q.dstR} (2 salti).`);
    const dstPf = q.dst === 'Internet' ? '0.0.0.0/0' : U.fmtPrefix(ex.sub[q.dst].net, ex.pf[q.dst]);
    card.appendChild(U.table(['Leva', 'Come', 'Effetto collaterale'], [
      [`Costo di ${q.link}`, `costo(${q.link}) > costo(${q.altLinks[0]}) + costo(${q.altLinks[1]}), es. ${q.costMin} contro 1 + 1`, `sposta su ${q.via} tutto il traffico tra ${q.srcR} e ${q.dstR}, non solo questo; ${q.link} resta di riserva`],
      [`Rotta statica su ${q.srcR}`, `${dstPf} via ${U.int2ip(ex.iface[q.via][sharedLink(ex, q.srcR, q.via)])} (${q.via}); la statica vince sulla dinamica (distanza amministrativa più bassa)`, `riguarda solo quella destinazione; se il link verso ${q.via} cade va tolta o affiancata da una di riserva`],
      [`Policy-based routing su ${q.srcR}`, `se sorgente ∈ ${q.src} e destinazione ∈ ${q.dst} → inoltra a ${q.via}`, 'la più precisa, ma è configurazione specifica, non routing classico']
    ]));
    P(`Traffico di ritorno: ${q.dstR} decide da solo e continua a usare ${q.link} (percorso asimmetrico), a meno di configurare la stessa cosa anche lì.`);
    if (ex.askCost) P(U.h('b', {}, 'Costo minimo. '), `Il giro per ${q.via} costa ${q.altCost}; con ${q.link} = ${q.altCost} c'è pareggio (ECMP), quindi serve ${q.costMin}.`);
    root.appendChild(card);
  }

  function chatText(ex, a) {
    const v = k => (a && String(a[k] == null ? '' : a[k]).trim()) || '__';
    const L = [];
    L.push(`#1 · Indirizzamento IP e routing (livello ${ex.level})`);
    L.push('## Testo');
    L.push(introText(ex));
    L.push('i) Schema di indirizzamento (indirizzi necessari, rete/prefisso, maschera, range utile, broadcast) e IP delle interfacce dei router.');
    L.push(`ii) Tabella di routing di ${ex.asked} (destinazione / next-hop), costi dei link uguali, aggregando il più possibile.`);
    L.push(`iii) ${q3Text(ex)}` + (ex.askCost ? ` ${costText(ex)}` : ''));
    L.push('');
    L.push('## Le mie risposte');
    L.push('(i) Sottoreti:');
    ex.nets.forEach(n => {
      const b = `sub.${n.name}.`;
      L.push(`- ${n.name}${n.kind === 'lan' ? ` (${n.hosts} host)` : ` (${n.routers.join('–')})`}: necessari ${v('need.' + n.name)} | ${v(b + 'pf')} | maschera ${v(b + 'mask')} | utili ${v(b + 'first')} – ${v(b + 'last')} | broadcast ${v(b + 'bcast')}`);
    });
    L.push('(i) Interfacce:');
    ex.routers.forEach(R => L.push(`- ${R}: ` + netsOfRouter(ex, R).map(n => `${n} ${v(`if.${R}.${n}`)}`).join(', ')));
    L.push(`(ii) Tabella di routing di ${ex.asked}:`);
    const rows = collectRows(a).filter(r => r.rd !== '' || r.rh !== '');
    if (!rows.length) L.push('- (nessuna riga compilata)');
    else rows.forEach(r => L.push(`- ${r.rd || '__'} → ${r.rh || '__'}`));
    L.push(`(iii) ${v('q3')}`);
    if (ex.askCost) L.push(`Costo minimo di ${ex.q3.link}: ${v('q3cost')}`);
    return L.join('\n');
  }

  const TRACES = [{
    id: 'sim-vlsm', set: 'simulato',
    title: 'Esame simulato · Indirizzamento IP e routing (200.15.42.128/25)',
    source: 'Esame_Simulato_TESTO.pdf pag. 1-2 · soluzioni pag. 1-3',
    params: {
      level: 3, net: '200.15.42.128', prefix: 25, topo: 'triangle', border: 'R1',
      lans: [{ name: 'Net_A', hosts: 40, router: 'R2' }, { name: 'Net_B', hosts: 22, router: 'R3' }, { name: 'Net_C', hosts: 10, router: 'R1' }],
      asked: 'R2', q3: { src: 'Net_C', dst: 'Net_A' }, askCost: false
    },
    expect: {
      'need.Net_A': '43', 'need.Net_B': '25', 'need.Net_C': '13',
      'sub.Net_A.pf': '200.15.42.128/26', 'sub.Net_A.bcast': '200.15.42.191',
      'sub.Net_B.pf': '200.15.42.192/27', 'sub.Net_B.bcast': '200.15.42.223',
      'sub.Net_C.pf': '200.15.42.224/28', 'sub.Net_C.bcast': '200.15.42.239',
      'sub.Link_1.pf': '200.15.42.240/30', 'sub.Link_1.bcast': '200.15.42.243',
      'sub.Link_2.pf': '200.15.42.244/30', 'sub.Link_2.bcast': '200.15.42.247',
      'sub.Link_3.pf': '200.15.42.248/30', 'sub.Link_3.bcast': '200.15.42.251',
      'if.R1.Net_C': '200.15.42.225', 'if.R1.Link_1': '200.15.42.241', 'if.R1.Link_3': '200.15.42.249',
      'if.R2.Net_A': '200.15.42.129', 'if.R2.Link_1': '200.15.42.242', 'if.R2.Link_2': '200.15.42.245',
      'if.R3.Net_B': '200.15.42.193', 'if.R3.Link_2': '200.15.42.246', 'if.R3.Link_3': '200.15.42.250',
      'rt.1.dest': '200.15.42.128/26', 'rt.1.nh': 'direttamente connessa',
      'rt.2.dest': '200.15.42.240/30', 'rt.3.dest': '200.15.42.244/30',
      'rt.4.dest': '200.15.42.192/27', 'rt.4.nh': '200.15.42.246',
      'rt.5.dest': '0.0.0.0/0', 'rt.5.nh': '200.15.42.241', 'rt.6.dest': ''
    }
  }, {
    id: 'guida1-vlsm',
    title: 'Guida 1 · Indirizzamento IP e routing (143.31.107.0/25)',
    source: 'Guida_1_Indirizzamento_IP_e_Routing.pdf pag. 2-6',
    params: {
      level: 3, net: '143.31.107.0', prefix: 25, topo: 'triangle', border: 'R1',
      lans: [{ name: 'Net_A', hosts: 25, router: 'R1' }, { name: 'Net_B', hosts: 51, router: 'R2' }, { name: 'Net_C', hosts: 11, router: 'R3' }],
      asked: 'R3', q3: { src: 'Net_B', dst: 'Net_A' }, askCost: false,
      swap: ['Link_2'] // nella guida R3 ha .117 e R2 .118 su Link_2
    },
    expect: {
      'sub.Net_B.pf': '143.31.107.0/26', 'sub.Net_B.bcast': '143.31.107.63',
      'sub.Net_A.pf': '143.31.107.64/27', 'sub.Net_A.bcast': '143.31.107.95',
      'sub.Net_C.pf': '143.31.107.96/28', 'sub.Net_C.bcast': '143.31.107.111',
      'sub.Link_1.pf': '143.31.107.112/30', 'sub.Link_1.bcast': '143.31.107.115',
      'sub.Link_2.pf': '143.31.107.116/30', 'sub.Link_2.bcast': '143.31.107.119',
      'sub.Link_3.pf': '143.31.107.120/30', 'sub.Link_3.bcast': '143.31.107.123'
    }
  }];

  RA.vlsm = {
    id: 'vlsm', num: '1', name: 'Indirizzamento IP e routing', examPoints: 10,
    desc: 'VLSM su topologie diverse, interfacce dei router, tabella di routing aggregata, forzatura di un percorso.',
    method: {
      intro: 'Di solito è l\'esercizio che vale di più. Tre domande: schema di indirizzamento, tabella di routing di un router aggregata il più possibile, forzare un percorso. Motiva ogni passaggio.',
      steps: [
        'Spazio: /n → 32 − n bit di host → 2^(32−n) indirizzi. Tutto deve stare lì dentro.',
        'Indirizzi necessari: LAN = host + 1 (router) + 2 (rete e broadcast); link = 2 + 2 = 4.',
        'Blocco = potenza di 2 superiore; prefisso = 32 − log2(blocco). Controlla che la somma dei blocchi stia nello spazio.',
        'Assegna dal blocco più grande al più piccolo, uno dopo l\'altro dall\'inizio dello spazio: ogni blocco resta allineato a un multiplo della sua dimensione.',
        'Per ogni sottorete: rete/prefisso, maschera (256 − blocco), primo utile (rete + 1), ultimo utile (broadcast − 1), broadcast (rete + blocco − 1).',
        'Interfacce: un indirizzo per ogni rete a cui il router è collegato (sulla LAN di solito il primo utile, sui /30 uno per estremo).',
        'Tabella di routing: connesse → «direttamente connessa»; remote → IP del vicino sul link condiviso, lungo il cammino più corto; default 0.0.0.0/0 verso il router di bordo. Poi togli le righe con lo stesso next-hop della default e fondi i blocchi contigui allineati con lo stesso next-hop.',
        'Forzare un percorso: costo del link (sopra la somma degli altri), rotta statica, policy-based routing; cita gli effetti collaterali e il traffico di ritorno asimmetrico.'
      ],
      traps: [
        'Dimenticare il +1 del router: nei casi al limite (62 host in un /26) la rete non ci sta più.',
        'Assegnare prima i blocchi piccoli: il blocco grande deve saltare al multiplo successivo e si sprecano indirizzi.',
        'Broadcast sbagliato di uno: rete + blocco è già la rete successiva.',
        'Next-hop sbagliato: non l\'IP del router stesso, non un IP qualsiasi del vicino, ma quello sul link condiviso (l\'ARP funziona solo nella stessa sottorete).',
        'Rete connessa con un IP come next-hop: il router consegna da solo, scrivi «direttamente connessa».',
        'Dimenticare la default verso Internet, o lasciare righe che la default assorbe già.',
        'Costo del link uguale alla somma degli altri: è un pareggio, non basta.'
      ],
      formulas: [
        ['/24', '255.255.255.0 · 256 indirizzi · 254 utili'],
        ['/25', '255.255.255.128 · 128 · 126'],
        ['/26', '255.255.255.192 · 64 · 62 (LAN da 31 a 60 host)'],
        ['/27', '255.255.255.224 · 32 · 30 (LAN da 15 a 28 host)'],
        ['/28', '255.255.255.240 · 16 · 14 (LAN da 7 a 12 host)'],
        ['/29', '255.255.255.248 · 8 · 6 (LAN fino a 5 host)'],
        ['/30', '255.255.255.252 · 4 · 2 (link punto-punto)'],
        ['Maschera', 'nell\'ottetto del confine: 256 − blocco'],
        ['Broadcast', 'rete + blocco − 1 · la rete successiva parte da broadcast + 1'],
        ['Necessari', 'LAN: host + 1 + 2 · link: 2 + 2 = 4'],
        ['Routing', 'longest prefix match · connesse: «direttamente connessa» · remote: IP del vicino sul link condiviso · default 0.0.0.0/0 verso il bordo · pareggio: uno o entrambi']
      ]
    },
    traces: TRACES,
    randomParams, build, gen, steps, grade, sol2answers, render, solution, hints, fieldHint, diagnose, diagnoseCases, chatText
  };
})();
