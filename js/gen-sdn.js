// ============================================================
// RetiApp · gen-sdn.js — Esercizio 5 · SDN e flow table
// Contratto: docs/moduli.md · correzione per SIMULAZIONE dei pacchetti
// ============================================================
(function () {
  const RA = window.RetiApp;
  const U = RA.util;

  // ---------------- topologia fissa ----------------
  // triangolo s1–s2–s3, due host per switch; i numeri di porta sono nei params
  const SW = ['s1', 's2', 's3'];
  const HOSTS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
  const NODES = SW.concat(HOSTS);
  const IPS = { h1: '10.1.0.1', h2: '10.1.0.2', h3: '10.2.0.3', h4: '10.2.0.4', h5: '10.3.0.5', h6: '10.3.0.6' };
  const HOSTS_OF = { s1: ['h1', 'h2'], s2: ['h3', 'h4'], s3: ['h5', 'h6'] };
  const SW_OF = { h1: 's1', h2: 's1', h3: 's2', h4: 's2', h5: 's3', h6: 's3' };
  const DEF_PRIO = 1;        // priorità di una regola scritta senza priorità
  const MIN_ROWS = 8;        // righe minime della flow table
  const PM_POINTS = 2;       // punti della mappa delle porte (12 caselle)
  const FIELDS = ['sw', 'in', 'src', 'dst', 'out', 'prio'];

  const isHost = n => /^h[1-6]$/.test(n);
  const subnet = sw => `10.${sw.slice(1)}.*.*`;
  const listIt = arr => arr.length <= 1 ? (arr[0] || '') : arr.slice(0, -1).join(', ') + ' e ' + arr[arr.length - 1];
  const portOf = (ex, sw, node) => {
    for (let p = 1; p <= 4; p++) if (ex.ports[sw][p] === node) return p;
    return null;
  };
  const pmKeys = () => SW.flatMap(s => [1, 2, 3, 4].map(p => `pm.${s}.${p}`));

  // ---------------- match sugli IP ----------------
  // accetta: vuoto / * / *.*.*.* (qualsiasi), IP esatto, jolly 10.3.*.* (anche 10.3.*), prefisso 10.3.0.0/16
  function parsePat(s) {
    const t = String(s == null ? '' : s).trim().replace(/\s+/g, '').toLowerCase();
    if (t === '' || t === '*' || t === 'any' || t === 'qualsiasi' || t === '*.*.*.*') return { ip: 0, n: 0 };
    if (t.includes('/')) {
      const p = U.parsePrefix(t);
      if (!p) return null;
      return { ip: (p.ip & U.maskOf(p.n)) >>> 0, n: p.n };
    }
    if (t.includes('*')) {
      const parts = t.split('.');
      if (parts.length > 4 || parts[parts.length - 1] !== '*') return null;
      while (parts.length < 4) parts.push('*');
      const k = parts.indexOf('*');
      if (parts.slice(k).some(x => x !== '*')) return null;
      const fixed = parts.slice(0, k);
      if (fixed.some(x => !/^\d{1,3}$/.test(x) || Number(x) > 255)) return null;
      const oct = fixed.map(Number).concat([0, 0, 0, 0]).slice(0, 4);
      return { ip: U.ip2int(oct.join('.')), n: 8 * k };
    }
    const ip = U.ip2int(t);
    return ip === null ? null : { ip, n: 32 };
  }
  const patMatch = (p, ipInt) => p.n === 0 || ((ipInt & U.maskOf(p.n)) >>> 0) === p.ip;
  const ipInt = h => U.ip2int(IPS[h]);

  function matchRule(r, sw, inP, sI, dI) {
    return r.sw === sw && (r.inP === null || r.inP === inP) && patMatch(r.srcP, sI) && patMatch(r.dstP, dI);
  }
  function compileExisting(e, k) {
    return {
      id: 'x' + k, user: false, sw: e.sw,
      inP: e.in === null || e.in === undefined || e.in === '' ? null : Number(e.in),
      srcP: parsePat(e.src), dstP: parsePat(e.dst), out: Number(e.out),
      prio: e.prio === null || e.prio === undefined ? DEF_PRIO : Number(e.prio),
      raw: { sw: e.sw, in: e.in == null ? '' : String(e.in), src: e.src || '', dst: e.dst || '', out: String(e.out), prio: e.prio == null ? '' : String(e.prio) }
    };
  }
  // testo del match nella sintassi dell'esame
  function fmtMatch(r) {
    const p = [];
    if (r.in !== '' && r.in !== null && r.in !== undefined) p.push(`ingress=${r.in}`);
    if (r.src) p.push(`IP src=${r.src}`);
    if (r.dst) p.push(`IP dst=${r.dst}`);
    return p.length ? p.join(', ') : 'qualsiasi pacchetto (*)';
  }

  // ---------------- parametri e costruzione ----------------
  function randomParams(level) {
    const ports = {};
    SW.forEach(s => {
      const neigh = HOSTS_OF[s].concat(SW.filter(x => x !== s));
      const perm = U.shuffle([1, 2, 3, 4]);
      ports[s] = {};
      neigh.forEach((n, i) => { ports[s][perm[i]] = n; });
    });
    const [A, B, C] = U.shuffle(SW);          // A = switch delle sorgenti, B = di passaggio, C = delle destinazioni
    const [a1, a2] = U.shuffle(HOSTS_OF[A]);
    const [c1, c2] = U.shuffle(HOSTS_OF[C]);
    const [b1, b2] = U.shuffle(HOSTS_OF[B]);
    const As = HOSTS_OF[A], Cs = HOSTS_OF[C];
    const pOf = (sw, n) => Number(Object.keys(ports[sw]).find(p => ports[sw][p] === n));
    const fl = (srcs, dsts, path, ret) => ({ srcs, dsts, path, ret: !!ret });
    // entry d'esempio come all'esame: traffico di un host di B, non tocca i flussi richiesti
    const example = bh => {
      const T = U.pick([A, C]);
      return { sw: B, in: pOf(B, bh), src: IPS[bh], dst: subnet(T), out: pOf(B, T), prio: null };
    };
    // entry già presente che si sovrappone ai flussi: va battuta con la priorità
    const clash = () => ({ sw: A, in: null, src: '', dst: subnet(C), out: pOf(A, U.pick([B, C])), prio: U.pick([10, 20, 50]) });
    let flows, existing;
    if (level <= 1) {
      flows = [fl([a1], [U.pick(Cs)], [A, C])];
      existing = [example(b1)];
    } else if (level === 2) {
      flows = [fl([a1], Cs, [A, B, C]), fl([a2], Cs, [A, C])];
      existing = [example(b1)];
    } else if (level === 3) {
      flows = [fl([a1], Cs, [A, B, C]), fl([a2], Cs, [A, C]), fl(Cs, As, [C, A], true)];
      existing = [example(b1)];
    } else if (level === 4) {
      flows = [fl([a1], Cs, [A, B, C]), fl([a2], Cs, [A, C]), fl(Cs, As, [C, A], true)];
      existing = [clash()];
    } else {
      flows = [fl([a1], Cs, [A, B, C]), fl([a2], Cs, [A, C]), fl([c1], As, [C, A], true), fl([c2], As, [C, B, A], true), fl([b1], Cs, [B, C])];
      existing = [example(b2)];
      if (U.chance(0.5)) existing.push(clash());
    }
    return { level, ports, flows, existing };
  }

  function flowText(f) {
    const S = listIt(f.srcs), D = listIt(f.dsts), P = f.path;
    const head = f.ret ? `il traffico di risposta da ${S} verso ${D}` : `il traffico generato da ${S} diretto verso ${D}`;
    return head + ' ' + (P.length === 2 ? `vada direttamente da ${P[0]} a ${P[1]}` : `passi da ${P[1]} e poi da ${P[2]}`);
  }

  function build(p) {
    const ports = {};
    SW.forEach(s => { ports[s] = {}; [1, 2, 3, 4].forEach(n => { ports[s][n] = p.ports[s][n]; }); });
    const flows = p.flows.map((f, i) => ({
      id: String.fromCharCode(97 + i), srcs: f.srcs.slice(), dsts: f.dsts.slice(), path: f.path.slice(), ret: !!f.ret, text: flowText(f)
    }));
    const pairs = [];
    flows.forEach(f => f.srcs.forEach(s => f.dsts.forEach(d => pairs.push({ flow: f.id, src: s, dst: d, path: f.path.slice() }))));
    const existing = (p.existing || []).map(e => ({
      sw: e.sw, in: e.in === null || e.in === undefined || e.in === '' ? null : Number(e.in),
      src: e.src || '', dst: e.dst || '', out: Number(e.out), prio: e.prio === null || e.prio === undefined ? null : Number(e.prio)
    }));
    const ex = { cat: 'sdn', level: p.level, params: p, ports, ips: Object.assign({}, IPS), flows, pairs, existing, prio: p.level >= 4 };
    ex.sol = modelRules(ex);
    return ex;
  }
  const gen = level => build(randomParams(level));

  // ---------------- soluzione modello: insieme minimo di regole ----------------
  // · switch prima dell'ultimo: ingress + IP src + IP dst (src esatto, o jolly se tutte le sorgenti
  //   del flusso fanno la stessa strada; dst esatto se è uno solo, altrimenti il jolly della sottorete)
  // · ultimo switch: solo IP dst, una regola per host (vale per tutti i flussi che arrivano lì)
  // · le entry già presenti si riusano se fanno già la cosa giusta; se si sovrappongono con
  //   un'azione diversa la regola nuova prende una priorità più alta
  function modelRules(ex) {
    const exist = ex.existing.map(compileExisting);
    const out = [];
    const notes = [];
    const add = (r, fid) => {
      const k = [r.sw, r.in, r.src, r.dst, r.out, r.prio].join('|');
      const old = out.find(x => x.k === k);
      if (old) { if (!old.per.includes(fid)) old.per.push(fid); return; }
      out.push(Object.assign({ k, per: [fid] }, r));
    };
    ex.flows.forEach(f => {
      f.path.forEach((sw, k) => {
        const last = k === f.path.length - 1;
        if (last) {
          f.dsts.forEach(d => add({ sw, in: '', src: '', dst: IPS[d], out: String(portOf(ex, sw, d)), prio: '', why: `consegna a ${d}` }, f.id));
          return;
        }
        const next = f.path[k + 1], prev = k ? f.path[k - 1] : null;
        const expOut = portOf(ex, sw, next);
        let covered = true, clashP = 0, coverBy = null;
        f.srcs.forEach(s => f.dsts.forEach(d => {
          const inP = prev ? portOf(ex, sw, prev) : portOf(ex, sw, s);
          const m = exist.filter(r => matchRule(r, sw, inP, ipInt(s), ipInt(d)));
          m.forEach(r => { if (r.out !== expOut) clashP = Math.max(clashP, r.prio); });
          if (!m.length) { covered = false; return; }
          const top = Math.max(...m.map(r => r.prio));
          const win = m.filter(r => r.prio === top);
          if (win.every(r => r.out === expOut)) coverBy = win[0]; else covered = false;
        }));
        if (covered) {
          notes.push(`Su ${sw} il flusso ${f.id} non ha bisogno di una regola nuova: l'entry già presente (${fmtMatch(coverBy.raw)} → forward(${coverBy.out})) lo manda già verso ${next}.`);
          return;
        }
        const prio = clashP ? String(clashP + 10) : '';
        if (clashP) notes.push(`Su ${sw} il traffico del flusso ${f.id} fa match anche con l'entry già presente (priorità ${clashP}), che lo manderebbe dalla parte sbagliata: la regola nuova ha priorità ${prio} (basta un numero maggiore di ${clashP}).`);
        add({
          sw,
          in: prev ? String(portOf(ex, sw, prev)) : (f.srcs.length === 1 ? String(portOf(ex, sw, f.srcs[0])) : ''),
          src: f.srcs.length === 1 ? IPS[f.srcs[0]] : subnet(SW_OF[f.srcs[0]]),
          dst: f.dsts.length === 1 ? IPS[f.dsts[0]] : subnet(SW_OF[f.dsts[0]]),
          out: String(expOut), prio,
          why: prev ? `da ${prev} verso ${next}` : `${listIt(f.srcs)} verso ${next}`
        }, f.id);
      });
    });
    return { rules: SW.flatMap(s => out.filter(r => r.sw === s)), notes };
  }

  // ---------------- passi ----------------
  function steps(ex) {
    return [
      { id: 'pm', title: 'Mappa delle porte', keys: pmKeys() },
      { id: 'r', title: 'Entry delle flow table', keys: [], prefixes: ['e'] }
    ];
  }

  // ---------------- lettura delle righe dell'utente ----------------
  const FORMAT_MSG = 'Formato non valido: scrivi un IP esatto (10.1.0.1), un jolly (10.1.*.*) o un prefisso (10.1.0.0/16); vuoto = qualsiasi.';
  function readRows(ex, a) {
    const idx = new Set();
    Object.keys(a || {}).forEach(k => { const m = /^e(\d+)\.(sw|in|src|dst|out|prio)$/.exec(k); if (m) idx.add(Number(m[1])); });
    const rows = [];
    Array.from(idx).sort((x, y) => x - y).forEach(i => {
      const g = f => String(a['e' + i + '.' + f] == null ? '' : a['e' + i + '.' + f]).trim();
      const raw = { sw: g('sw'), in: g('in'), src: g('src'), dst: g('dst'), out: g('out'), prio: ex.prio ? g('prio') : '' };
      if (Object.values(raw).every(v => v === '')) return;     // riga vuota: ignorata
      const errs = {};
      const r = { i, id: 'e' + i, user: true, raw, errs };
      if (!raw.sw) errs.sw = { msg: 'Manca lo switch su cui installare la regola.' };
      else if (!SW.includes(raw.sw)) errs.sw = { msg: 'Switch non valido: scegli s1, s2 o s3.' };
      else r.sw = raw.sw;
      if (raw.in === '' || raw.in === '*') r.inP = null;
      else if (/^[1-4]$/.test(raw.in)) r.inP = Number(raw.in);
      else errs.in = { msg: 'Porta d\'ingresso non valida: un numero da 1 a 4, oppure vuota (= qualsiasi).' };
      r.srcP = parsePat(raw.src);
      if (!r.srcP) errs.src = { msg: FORMAT_MSG, diag: { kind: 'format' } };
      r.dstP = parsePat(raw.dst);
      if (!r.dstP) errs.dst = { msg: FORMAT_MSG, diag: { kind: 'format' } };
      const mo = /^(?:forward\s*\(\s*)?([1-4])\s*\)?$/i.exec(raw.out);
      if (raw.out === '') errs.out = { msg: 'Manca l\'azione: forward(porta d\'uscita).' };
      else if (!mo) errs.out = { msg: 'Azione non valida: forward(1), forward(2), forward(3) o forward(4).' };
      else r.out = Number(mo[1]);
      if (raw.prio === '') r.prio = DEF_PRIO;
      else if (/^\d{1,5}$/.test(raw.prio)) r.prio = Number(raw.prio);
      else errs.prio = { msg: 'Priorità non valida: un numero intero (più alto = vince). Vuota = 1.' };
      rows.push(r);
    });
    return rows;
  }
  const rowName = r => r.user ? `riga ${r.i}` : `l'entry già presente su ${r.sw}`;
  const ruleDesc = r => `${r.raw.sw}: ${fmtMatch(r.raw)} → forward(${r.raw.out})`;

  // ---------------- simulazione di un pacchetto ----------------
  function simulate(ex, rules, src, dst) {
    let sw = SW_OF[src], inP = portOf(ex, sw, src);
    const sI = ipInt(src), dI = ipInt(dst);
    const hops = [];
    for (let k = 0; k < 8; k++) {
      const at = { sw, inP, from: ex.ports[sw][inP] };
      const m = rules.filter(r => matchRule(r, sw, inP, sI, dI));
      if (!m.length) return { hops, end: 'nomatch', at };
      const top = Math.max(...m.map(r => r.prio));
      const win = m.filter(r => r.prio === top), lose = m.filter(r => r.prio < top);
      const outs = Array.from(new Set(win.map(r => r.out)));
      if (outs.length > 1) return { hops, end: 'conflict', at, win, top };
      const out = outs[0], next = ex.ports[sw][out];
      hops.push({ sw, inP, out, next, win, lose, top });
      if (isHost(next)) return { hops, end: 'host', host: next };
      inP = portOf(ex, next, sw);
      sw = next;
    }
    return { hops, end: 'loop' };
  }

  // ---------------- analisi completa (usata da grade e diagnose) ----------------
  function analyze(ex, a) {
    a = a || {};
    const rows = readRows(ex, a);
    const valid = rows.filter(r => !Object.keys(r.errs).length);
    const rules = valid.concat(ex.existing.map(compileExisting));
    const info = {};
    rows.forEach(r => { info[r.i] = { used: false, errs: Object.assign({}, r.errs) }; });
    const setErr = (r, f, msg, diag) => {
      if (!r.user) return;
      const e = info[r.i].errs;
      if (!e[f]) e[f] = { msg, diag };
    };
    const fails = [];

    const pairRes = ex.pairs.map(pr => {
      const name = `${pr.src} → ${pr.dst}`;
      const res = simulate(ex, rules, pr.src, pr.dst);
      const P = pr.path;
      const trail = [];
      for (let k = 0; k < P.length; k++) {
        const sw = P[k], last = k === P.length - 1;
        const expNext = last ? pr.dst : P[k + 1];
        const expOut = portOf(ex, sw, expNext);
        const hop = res.hops[k];
        if (!hop) {
          const at = res.at;
          fails.push({ pr, name, sw, inP: at.inP, from: at.from, expNext, expOut });
          if (res.end === 'nomatch') {
            return { ok: false, name, text: `${name}: su ${sw} nessuna regola fa match (entra dalla porta ${at.inP}, da ${at.from})` + (last ? '. Manca la regola dell\'ultimo switch, quella che consegna all\'host.' : '.') };
          }
          // conflitto: stessa priorità, azioni diverse
          const wrongU = res.win.filter(r => r.user && r.out !== expOut);
          const rightU = res.win.filter(r => r.user && r.out === expOut);
          const existWrong = res.win.some(r => !r.user && r.out !== expOut);
          wrongU.forEach(r => {
            // il messaggio va su un campo compilato (su un campo vuoto l'app mostrerebbe "Da compilare")
            const f = r.raw.src && r.srcP.n < 32 ? 'src' : r.raw.dst && r.dstP.n < 32 ? 'dst' : 'sw';
            setErr(r, f, `Su ${sw} questa regola fa match anche su ${name}, che deve andare verso ${expNext}: il match è troppo largo.`, { kind: 'broad', pair: name, sw, expNext });
          });
          if (existWrong) rightU.forEach(r => setErr(r, ex.prio ? 'prio' : 'src', `Su ${sw} questa regola ha la stessa priorità (${res.top}) dell'entry già presente, che fa un'altra cosa: è un conflitto.`, { kind: 'prio', P: res.top, sw }));
          return { ok: false, name, text: `${name}: su ${sw} conflitto: ${res.win.map(r => `${rowName(r)} (forward(${r.out}))`).join(' e ')} fanno match con la stessa priorità ma azioni diverse.` };
        }
        if (hop.next === expNext) {
          hop.win.forEach(r => { if (r.user) info[r.i].used = true; });
          trail.push(`${sw} [in ${hop.inP}, out ${hop.out}]`);
          continue;
        }
        // uscita sbagliata
        fails.push({ pr, name, sw, inP: hop.inP, from: ex.prev, expNext, expOut });
        const userWin = hop.win.filter(r => r.user);
        let extra = '';
        if (userWin.length) {
          userWin.forEach(r => setErr(r, 'out', `Su ${sw} questa regola manda ${name} sulla porta ${r.out} (verso ${hop.next}), ma deve andare verso ${expNext}.`, { kind: 'out', sw, expNext, pair: name }));
        } else {
          extra = ` (vince l'entry già presente, priorità ${hop.top})`;
          hop.lose.filter(r => r.user && r.out === expOut).forEach(r =>
            setErr(r, 'prio', `Su ${sw} vince l'entry già presente (priorità ${hop.top}): questa regola ha priorità ${r.prio}, più bassa, e non viene mai applicata.`, { kind: 'prio', P: hop.top, sw }));
        }
        const text = isHost(expNext)
          ? `${name}: su ${sw} esce dalla porta ${hop.out} verso ${hop.next}, ma doveva essere consegnato a ${expNext}${extra}.`
          : `${name}: esce da ${sw} sulla porta ${hop.out} verso ${hop.next}, ma doveva andare ${P.length === 2 ? 'direttamente ' : ''}a ${expNext}${extra}.`;
        return { ok: false, name, text };
      }
      return { ok: true, name, text: `${name}: ${trail.join(' → ')} → ${pr.dst} ✓` };
    });
    // correggi il "from" delle situazioni di uscita sbagliata
    fails.forEach(f => { f.from = ex.ports[f.sw][f.inP]; });

    // regole quasi giuste: non usate, sbagliate in un solo criterio rispetto a un pacchetto perso
    valid.filter(r => !info[r.i].used && !Object.keys(info[r.i].errs).length).forEach(r => {
      for (const f of fails) {
        if (r.out !== f.expOut) continue;
        const sI = ipInt(f.pr.src), dI = ipInt(f.pr.dst);
        const crit = { sw: r.sw === f.sw, in: r.inP === null || r.inP === f.inP, src: patMatch(r.srcP, sI), dst: patMatch(r.dstP, dI) };
        const bad = Object.keys(crit).filter(k => !crit[k]);
        if (bad.length !== 1) continue;
        const b = bad[0];
        if (b === 'sw') setErr(r, 'sw', `Questa regola farebbe match su ${f.sw}, dove arriva ${f.name}, non su ${r.sw}.`, { kind: 'sw', sw: f.sw, pair: f.name });
        else if (b === 'in') setErr(r, 'in', `Su ${f.sw} il pacchetto ${f.name} entra dalla porta ${f.inP} (quella verso ${f.from}), non dalla ${r.inP}.`, { kind: 'in', sw: f.sw, inP: f.inP, from: f.from, pair: f.name });
        else if (b === 'src') setErr(r, 'src', `IP src ${r.raw.src} non comprende ${f.pr.src} (${IPS[f.pr.src]}): la regola non fa match su ${f.name}.`, { kind: 'src', pair: f.name });
        else setErr(r, 'dst', `IP dst ${r.raw.dst} non comprende ${f.pr.dst} (${IPS[f.pr.dst]}): la regola non fa match su ${f.name}.`, { kind: 'dst', pair: f.name });
        break;
      }
    });

    // traffico non richiesto catturato dalle regole dell'utente (jolly troppo larghi)
    const req = new Set(ex.pairs.map(p => p.src + '>' + p.dst));
    const broad = {};
    HOSTS.forEach(s => HOSTS.forEach(d => {
      if (s === d || req.has(s + '>' + d)) return;
      const res = simulate(ex, rules, s, d);
      let flagged = false;
      for (const hop of res.hops) {
        if (hop.next === d) break;
        const uw = hop.win.filter(r => r.user);
        if (uw.length) { uw.forEach(r => (broad[r.i] = broad[r.i] || []).push(`${s} → ${d}`)); flagged = true; break; }
      }
      if (!flagged && res.end === 'conflict') res.win.filter(r => r.user).forEach(r => (broad[r.i] = broad[r.i] || []).push(`${s} → ${d}`));
    }));
    const warns = [];
    // "regola inutile" solo quando tutti i percorsi funzionano: prima, una regola giusta
    // può restare inutilizzata solo perché il pacchetto si è perso a monte
    const allOk = pairRes.every(x => x.ok);
    valid.forEach(r => {
      const inf = info[r.i];
      if (Object.keys(inf.errs).length) return;
      const b = broad[r.i];
      const bl = b ? b.slice(0, 3).join(', ') + (b.length > 3 ? '…' : '') : '';
      if (!inf.used && b) warns.push(`Riga ${r.i} (${ruleDesc(r)}) non serve a nessuno dei flussi richiesti e cattura traffico non richiesto (${bl}): toglila.`);
      else if (!inf.used && allOk) warns.push(`Riga ${r.i} (${ruleDesc(r)}) non viene mai applicata ai flussi richiesti: è inutile, puoi toglierla.`);
      else if (b) warns.push(`Riga ${r.i} (${ruleDesc(r)}) cattura anche ${bl}, traffico che il testo non chiede: jolly troppo largo? Restringi il match (porta d'ingresso, IP src o IP dst).`);
    });
    return { rows, info, pairRes, warns };
  }

  // ---------------- correzione ----------------
  function grade(ex, a) {
    a = a || {};
    const marks = {};
    let pmOk = 0;
    SW.forEach(s => [1, 2, 3, 4].forEach(p => {
      const k = `pm.${s}.${p}`, right = ex.ports[s][p];
      const ok = String(a[k] == null ? '' : a[k]).trim() === right;
      if (ok) pmOk++;
      marks[k] = { ok, msg: `La porta ${p} di ${s} è il cavo verso ${right}: guarda il numero rosso scritto vicino a ${s}.` };
    }));
    const an = analyze(ex, a);
    an.rows.forEach(r => {
      const inf = an.info[r.i];
      const errF = Object.keys(inf.errs);
      const fields = FIELDS.filter(f => f !== 'prio' || ex.prio);
      if (errF.length) errF.forEach(f => { marks[`e${r.i}.${f}`] = { ok: false, msg: inf.errs[f].msg }; });
      else if (inf.used) fields.forEach(f => { marks[`e${r.i}.${f}`] = { ok: true, msg: null }; });
    });
    const okPairs = an.pairRes.filter(x => x.ok).length;
    const summary = an.pairRes.map(x => ({ ok: x.ok, text: x.text, short: x.ok ? x.text : `${x.name}: il pacchetto non segue il percorso richiesto.`, step: 'r' }))
      .concat(an.warns.map(t => ({ ok: 'warn', text: t, step: 'r' })));
    if (!an.rows.length) summary.unshift({ ok: false, text: 'Nessuna regola scritta nella flow table.', step: 'r' });
    return {
      correct: pmOk * PM_POINTS / 12 + okPairs,
      total: PM_POINTS + ex.pairs.length,
      marks, summary
    };
  }

  function sol2answers(ex) {
    const a = {};
    SW.forEach(s => [1, 2, 3, 4].forEach(p => { a[`pm.${s}.${p}`] = ex.ports[s][p]; }));
    const R = ex.sol.rules;
    const n = Math.max(MIN_ROWS, R.length);
    for (let i = 1; i <= n; i++) {
      const r = R[i - 1];
      a[`e${i}.sw`] = r ? r.sw : '';
      a[`e${i}.in`] = r ? r.in : '';
      a[`e${i}.src`] = r ? r.src : '';
      a[`e${i}.dst`] = r ? r.dst : '';
      a[`e${i}.out`] = r ? r.out : '';
      if (ex.prio) a[`e${i}.prio`] = r ? r.prio : '';
    }
    return a;
  }

  // ---------------- errori tipici ----------------
  function diagnose(ex, key, value, answers) {
    const v = String(value == null ? '' : value).trim();
    if (v === '') return null;
    answers = answers || {};
    let m = /^pm\.(s[123])\.([1-4])$/.exec(key);
    if (m) {
      const S = m[1], p = Number(m[2]), right = ex.ports[S][p];
      if (v === right) return null;
      if (v === S) return `Uno switch non è collegato a se stesso: dietro le porte di ${S} ci sono i suoi due host e gli altri due switch.`;
      if (isHost(v) && SW_OF[v] !== S) return `${v} non è collegato a ${S}: è attaccato a ${SW_OF[v]}. Gli host di ${S} sono ${listIt(HOSTS_OF[S])}.`;
      if (SW.includes(v) && ex.ports[v][p] === S) return `Hai letto il numero dall'altro capo del cavo: ${p} è la porta di ${v} verso ${S}. Ogni switch numera le sue porte: conta solo il numero scritto vicino a ${S}.`;
      if (NODES.includes(v)) return `${v} è collegato a ${S}, ma su un altro cavo: segui il cavo che ha il numero ${p} vicino a ${S}.`;
      return null;
    }
    m = /^e(\d+)\.(sw|in|src|dst|out|prio)$/.exec(key);
    if (!m) return null;
    const i = Number(m[1]), f = m[2];
    const an = analyze(ex, Object.assign({}, answers, { [key]: value }));
    const inf = an.info[i];
    const err = inf && inf.errs[f];
    if (!err || !err.diag) return null;
    const d = err.diag;
    const n = Number(v.replace(/\D/g, ''));
    switch (d.kind) {
      case 'format': return FORMAT_MSG;
      case 'out': {
        if (answers[`pm.${d.sw}.${n}`] === d.expNext && ex.ports[d.sw][n] !== d.expNext) return `Nella tua mappa la porta ${n} di ${d.sw} va a ${d.expNext}, ma la mappa è sbagliata: correggi prima il passo 1, poi la regola.`;
        if (!isHost(d.expNext) && ex.ports[d.expNext][n] === d.sw) return `Hai usato il numero dall'altro capo del cavo: ${n} è la porta di ${d.expNext} verso ${d.sw}. Nella regola di ${d.sw} va il numero che ha ${d.sw} su quel cavo.`;
        const other = SW.find(S2 => S2 !== d.sw && ex.ports[S2][n] === d.expNext);
        if (other) return `È la porta di un altro switch: forward(${n}) su ${other} va verso ${d.expNext}, ma la regola è su ${d.sw}, che usa i suoi numeri di porta.`;
        return `forward(${n}) su ${d.sw} porta a ${ex.ports[d.sw][n]}, non a ${d.expNext}: rileggi la mappa delle porte di ${d.sw}.`;
      }
      case 'in': {
        if (answers[`pm.${d.sw}.${n}`] === d.from && ex.ports[d.sw][n] !== d.from) return `Nella tua mappa la porta ${n} di ${d.sw} va a ${d.from}, ma la mappa è sbagliata: correggi prima il passo 1.`;
        if (!isHost(d.from) && ex.ports[d.from][n] === d.sw) return `Hai usato il numero dall'altro capo del cavo: ${n} è la porta di ${d.from} verso ${d.sw}. La porta d'ingresso è quella di ${d.sw}, lo switch su cui installi la regola.`;
        return `Il pacchetto ${d.pair} arriva a ${d.sw} da ${d.from}: la porta d'ingresso è quella che su ${d.sw} porta a ${d.from}, non la ${n}.`;
      }
      case 'broad': return `Jolly troppo largo: questa regola cattura anche ${d.pair}, che deve andare verso ${d.expNext}. Restringi il match: IP src esatto o porta d'ingresso.`;
      case 'prio': {
        const pv = /^\d+$/.test(v) ? Number(v) : DEF_PRIO;
        if (f === 'prio' && pv === d.P) return `A parità di priorità (${d.P}) due regole con azioni diverse sono in conflitto: serve una priorità MAGGIORE di ${d.P}.`;
        if (f === 'prio') return `Priorità ${pv} troppo bassa: su ${d.sw} l'entry già presente ha priorità ${d.P} e vince lei. Serve un numero maggiore di ${d.P}.`;
        return `Questa regola si sovrappone all'entry già presente su ${d.sw}: serve una priorità più alta.`;
      }
      case 'sw': return `Regola sullo switch sbagliato: il pacchetto ${d.pair} arriva su ${d.sw}. Ogni switch del percorso ha bisogno della sua regola.`;
      case 'src': case 'dst': return err.msg;
      default: return null;
    }
  }

  function diagnoseCases(ex) {
    const out = [];
    const sol = sol2answers(ex);
    // mappa: host di un altro switch
    const p1 = 1;
    const foreign = HOSTS.find(h => SW_OF[h] !== 's1');
    out.push({ key: `pm.s1.${p1}`, value: foreign, expect: 'non è collegato' });
    // mappa: numero letto dall'altro capo del cavo
    outer: for (const S of SW) for (let p = 1; p <= 4; p++) {
      const Y = SW.find(y => y !== S && ex.ports[y][p] === S && ex.ports[S][p] !== y);
      if (Y) { out.push({ key: `pm.${S}.${p}`, value: Y, expect: 'altro capo' }); break outer; }
    }
    const R = ex.sol.rules;
    const toSw = R.map((r, j) => ({ r, i: j + 1, X: ex.ports[r.sw][Number(r.out)] })).filter(x => SW.includes(x.X));
    // forward: numero dell'altro capo
    const c1 = toSw.find(x => portOf(ex, x.X, x.r.sw) !== Number(x.r.out));
    if (c1) out.push({ key: `e${c1.i}.out`, value: String(portOf(ex, c1.X, c1.r.sw)), expect: 'altro capo' });
    // forward: porta di un altro switch
    for (const x of toSw) {
      const Y = SW.find(y => y !== x.r.sw && y !== x.X);
      const q = portOf(ex, Y, x.X);
      if (q !== Number(x.r.out) && ex.ports[x.X][q] !== x.r.sw) { out.push({ key: `e${x.i}.out`, value: String(q), expect: 'porta di un altro switch' }); break; }
    }
    // ingresso: numero dell'altro capo (switch intermedio)
    const c3 = R.map((r, j) => ({ r, i: j + 1 })).find(x => x.r.in !== '' && SW.includes(ex.ports[x.r.sw][Number(x.r.in)]) &&
      portOf(ex, ex.ports[x.r.sw][Number(x.r.in)], x.r.sw) !== Number(x.r.in));
    if (c3) out.push({ key: `e${c3.i}.in`, value: String(portOf(ex, ex.ports[c3.r.sw][Number(c3.r.in)], c3.r.sw)), expect: 'altro capo' });
    // priorità uguale a quella dell'entry già presente
    if (ex.prio) {
      const j = R.findIndex(r => r.prio !== '');
      if (j >= 0) out.push({ key: `e${j + 1}.prio`, value: String(Number(R[j].prio) - 10), expect: 'parità' });
    }
    // formato dell'IP
    if (sol['e1.src'] !== undefined) out.push({ key: 'e1.src', value: '10.1.0', expect: 'formato' });
    return out;
  }

  // ---------------- aiuti ----------------
  function fieldHint(ex, key) {
    let m = /^pm\.(s[123])\.([1-4])$/.exec(key);
    if (m) return `Nella figura segui i quattro cavi di ${m[1]}: quello con il numero rosso ${m[2]} scritto VICINO a ${m[1]} dove porta? Il numero all'altro capo dello stesso cavo appartiene all'altro switch.`;
    m = /^e\d+\.(\w+)$/.exec(key);
    const f = m ? m[1] : '';
    const ex1 = ex.existing[0];
    return {
      sw: 'Lo switch su cui installi la regola. Ogni switch del percorso ne ha bisogno, compreso l\'ultimo, che consegna all\'host.',
      in: 'Porta d\'ingresso di QUESTO switch: quella da cui arriva il pacchetto (verso l\'host sorgente o verso lo switch precedente). Vuota = qualsiasi porta.',
      src: 'IP esatto (es. 10.1.0.1), jolly (10.1.*.*) o prefisso (10.1.0.0/16); vuoto = qualsiasi. Serve esatto quando due sorgenti vanno verso le stesse destinazioni per strade diverse.',
      dst: 'IP esatto o jolly. Il jolly (es. 10.3.*.*) va bene se tutti gli host che copre devono uscire dalla stessa porta; sull\'ultimo switch serve un IP per host.',
      out: 'forward(porta d\'uscita): la porta di QUESTO switch verso il prossimo nodo del percorso. Leggila dalla tua mappa delle porte (passo 1).',
      prio: 'Vince il numero più alto; vuota = 1. Serve solo se la regola si sovrappone a un\'entry già presente con un\'azione diversa' +
        (ex1 && ex1.prio ? ` (qui l'entry già presente su ${ex1.sw} ha priorità ${ex1.prio}).` : '.')
    }[f] || 'Rileggi il testo dell\'esercizio.';
  }

  function mapLines(ex) {
    return SW.map(s => `${s}: ` + [1, 2, 3, 4].map(p => `${p}→${ex.ports[s][p]}`).join(', '));
  }
  // percorso con [in, out] su ogni switch, come nelle soluzioni del PDF
  function pathText(ex, f) {
    const P = f.path;
    const parts = P.map((sw, k) => {
      const inP = k === 0 ? f.srcs.map(s => portOf(ex, sw, s)).join('/') : String(portOf(ex, sw, P[k - 1]));
      const outP = k === P.length - 1
        ? (f.dsts.length === 1 ? String(portOf(ex, sw, f.dsts[0])) : f.dsts.map(d => `${portOf(ex, sw, d)} per ${d}`).join(', '))
        : String(portOf(ex, sw, P[k + 1]));
      return `${sw} [in ${inP}, out ${outP}]`;
    });
    return `${f.srcs.join('/')} → ${parts.join(' → ')} → ${f.dsts.join('/')}`;
  }
  function ruleLine(ex, r) {
    return `${r.sw}: ${fmtMatch(r)} → forward(${r.out})` + (r.prio ? `, priorità ${r.prio}` : '') + `   [${r.per.join(', ')}]`;
  }
  function granularity(ex) {
    const L = [
      'Sugli switch prima dell\'ultimo il match ha porta d\'ingresso + IP src + IP dst: la sorgente distingue i flussi che vanno verso le stesse destinazioni per strade diverse (esatta, oppure con il jolly se tutte le sorgenti del flusso fanno la stessa strada); la destinazione usa il jolly della sottorete quando entrambi gli host di arrivo stanno oltre lo stesso collegamento.',
      'Sull\'ultimo switch basta l\'IP di destinazione: da qualunque porta arrivi, il pacchetto per un host esce sempre dalla stessa porta. Serve una regola per ogni host di destinazione, e la stessa regola vale per tutti i flussi che arrivano lì.'
    ];
    return L.concat(ex.sol.notes);
  }

  function hints(ex) {
    const f0 = ex.flows[0];
    const s0 = f0.srcs[0], sw0 = f0.path[0], nx0 = f0.path[1];
    const ex1 = ex.existing.find(e => e.prio);
    return [
      {
        step: 'pm', title: 'Passo 1 · Mappa delle porte',
        metodo: 'Per ogni switch scrivi cosa c\'è dietro ciascuna delle 4 porte. Il numero rosso vicino a uno switch è la porta di QUELLO switch: lo stesso cavo ha due numeri, uno per capo. È il passo che evita quasi tutti gli errori.',
        applicato: `Parti da s1: dai suoi quattro cavi escono h1, h2, s2 e s3. Per ciascuno leggi il numero scritto vicino a s1 (non quello all'altro capo). Poi fai lo stesso per s2 (h3, h4, s1, s3) e s3 (h5, h6, s1, s2).`,
        svolto: mapLines(ex).join('\n')
      },
      {
        step: 'r', title: 'Passo 2 · Percorsi richiesti',
        metodo: 'Per ogni flusso elenca gli switch attraversati, in ordine, dall\'host sorgente all\'host di destinazione. Il traffico di ritorno è un percorso nuovo.',
        applicato: ex.flows.map(f => `${f.id}) ${listIt(f.srcs)} → ${listIt(f.dsts)}: ${f.path.join(' → ')}`).join('\n'),
        svolto: ex.flows.map(f => `${f.id}) ${pathText(ex, f)}`).join('\n')
      },
      {
        step: 'r', title: 'Passo 3 · Ingresso e uscita su ogni switch → una regola',
        metodo: 'Su ogni switch del percorso: porta d\'ingresso = quella da cui arriva il pacchetto, porta d\'uscita = quella verso il prossimo switch o verso l\'host finale. Regola: match = ingress + IP src + IP dst, action = forward(uscita). Non dimenticare l\'ultimo switch.',
        applicato: `Esempio, flusso ${f0.id}: su ${sw0} il traffico di ${s0} entra dalla porta che porta a ${s0} ed esce da quella verso ${nx0}. Leggi i due numeri nella tua mappa di ${sw0}, poi fai lo stesso sugli switch successivi.`,
        svolto: ex.sol.rules.map(r => ruleLine(ex, r)).join('\n')
      },
      {
        step: 'r', title: 'Passo 4 · Granularità' + (ex1 ? ' e priorità' : ''),
        metodo: 'IP esatto dove serve distinguere (sorgenti che fanno strade diverse), jolly dove la strada è la stessa (es. 10.3.*.* se h5 e h6 escono dalla stessa porta). All\'ultimo switch una regola per host. Se una tua regola si sovrappone a un\'entry già presente con azione diversa, dalle una priorità più alta. Infine segui un pacchetto per flusso, regola per regola.',
        applicato: (ex.flows.length > 1 ? `Guarda quali sorgenti vanno verso le stesse destinazioni per strade diverse: sullo switch dove le strade si separano serve l'IP src esatto o la porta d'ingresso. ` : `C'è un solo flusso verso un solo host: IP esatti, così la regola non cattura altro traffico. `) +
          (ex1 ? `L'entry già presente su ${ex1.sw} (${fmtMatch({ in: ex1.in, src: ex1.src, dst: ex1.dst })} → forward(${ex1.out}), priorità ${ex1.prio}) cattura anche uno dei tuoi flussi: per quale serve una priorità maggiore di ${ex1.prio}, e per quale invece fa già la cosa giusta?` : 'Controlla che i jolly non catturino traffico che deve fare un\'altra strada.'),
        svolto: granularity(ex).join('\n')
      }
    ];
  }

  // ---------------- disegno ----------------
  const POS = {
    s1: [170, 120], s2: [430, 120], s3: [300, 275],
    h1: [62, 58], h2: [62, 182], h3: [538, 58], h4: [538, 182], h5: [188, 342], h6: [412, 342]
  };
  function svgFig(ex, hl) {
    const used = new Set();
    const lk = (a, b) => [a, b].sort().join('|');
    if (hl) ex.pairs.forEach(pr => {
      const seq = [pr.src].concat(pr.path, [pr.dst]);
      for (let k = 0; k + 1 < seq.length; k++) used.add(lk(seq[k], seq[k + 1]));
    });
    let s = `<svg class="fig" viewBox="0 0 600 372" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Tre switch collegati a triangolo, due host per switch, porte numerate">`;
    // collegamenti
    SW.forEach(sw => [1, 2, 3, 4].forEach(p => {
      const n = ex.ports[sw][p];
      if (SW.includes(n) && n < sw) return;   // ogni cavo tra switch una volta sola
      const [x1, y1] = POS[sw], [x2, y2] = POS[n];
      s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="link${used.has(lk(sw, n)) ? ' hl' : ''}"/>`;
    }));
    // numeri di porta: sul cavo, a 46 px dal centro dello switch a cui appartengono
    SW.forEach(sw => [1, 2, 3, 4].forEach(p => {
      const n = ex.ports[sw][p];
      const [x1, y1] = POS[sw], [x2, y2] = POS[n];
      const L = Math.hypot(x2 - x1, y2 - y1);
      const cx = (x1 + (x2 - x1) * 46 / L).toFixed(1), cy = (y1 + (y2 - y1) * 46 / L).toFixed(1);
      s += `<circle cx="${cx}" cy="${cy}" r="9" class="port"/><text x="${cx}" y="${(Number(cy) + 4).toFixed(1)}" text-anchor="middle" class="port-n">${p}</text>`;
    }));
    // nodi
    SW.forEach(sw => {
      const [x, y] = POS[sw];
      s += `<rect x="${x - 26}" y="${y - 16}" width="52" height="32" rx="6" class="sw"/><text x="${x}" y="${y + 5}" text-anchor="middle" class="lbl w">${sw}</text>`;
    });
    HOSTS.forEach(h => {
      const [x, y] = POS[h];
      s += `<rect x="${x - 42}" y="${y - 17}" width="84" height="34" rx="4" class="box"/>` +
        `<text x="${x}" y="${y - 3}" text-anchor="middle" class="lbl b">${h}</text>` +
        `<text x="${x}" y="${y + 11}" text-anchor="middle" class="lbl small">${IPS[h]}</text>`;
    });
    return s + '</svg>';
  }

  function existingTable(ex) {
    const head = ['Switch', 'Match', 'Action'].concat(ex.prio ? ['Priorità'] : []);
    return U.table(head, ex.existing.map(e => [U.label(e.sw), U.given(fmtMatch({ in: e.in, src: e.src, dst: e.dst })), U.given(`forward(${e.out})`)]
      .concat(ex.prio ? [U.given(e.prio === null ? `${DEF_PRIO} (predefinita)` : String(e.prio))] : [])));
  }

  function render(ex, root, ctx) {
    root.appendChild(U.h('div', { class: 'card intro' },
      U.h('p', {}, U.h('b', {}, 'Testo. '), 'Rete SDN con tre switch collegati a triangolo; a ogni switch sono attaccati due host. I numeri rossi sono le porte: ogni switch numera le SUE porte, quindi lo stesso cavo ha due numeri, uno per capo.'),
      U.fig(svgFig(ex, false), 'Numeri rossi = porte dello switch (il numero vicino a uno switch è la porta di quello switch).'),
      ex.existing.length ? U.h('p', {}, ex.existing.length === 1 ? 'Entry già presente:' : 'Entry già presenti:') : null,
      ex.existing.length ? existingTable(ex) : null,
      U.h('p', {}, 'Con la stessa sintassi (match → action) scrivi le entry da dare agli switch affinché:'),
      U.h('ol', { type: 'a' }, ex.flows.map(f => U.h('li', {}, f.text + '.'))),
      U.h('p', { class: 'small' },
        'Sintassi delle righe: porta d\'ingresso (vuota = qualsiasi); IP src e IP dst come IP esatto (10.1.0.1), jolly (10.3.*.*) o prefisso (10.3.0.0/16), vuoto = qualsiasi; action = forward(porta). ' +
        (ex.prio ? 'Priorità: vince il numero più alto, vuota = 1; due regole con la stessa priorità e azioni diverse sono in conflitto. ' : '') +
        'Le righe vuote vengono ignorate. Nessuna regola fa match → il pacchetto va al controller (percorso sbagliato).')));

    root.appendChild(U.card('1 · Mappa delle porte: cosa c\'è dietro ogni porta?', { step: 'pm' },
      U.h('p', { class: 'small' }, 'Compilala prima delle regole: è il passo che evita quasi tutti gli errori.'),
      U.table(['Switch', 'Porta 1', 'Porta 2', 'Porta 3', 'Porta 4'], SW.map(s =>
        [U.label(s)].concat([1, 2, 3, 4].map(p => U.sel(ctx, `pm.${s}.${p}`, NODES.map(n => [n, n]), { w: 's', ph: '—', label: `porta ${p} di ${s}` })))), { cls: 'center' })));

    const head = ['#', 'Switch', 'Porta d\'ingresso', 'IP src', 'IP dst', 'Action'].concat(ex.prio ? ['Priorità'] : []);
    const wrap = U.table(head, []);
    const tbody = wrap.querySelector('tbody');
    let maxI = 0;
    Object.keys((ctx && ctx.initial) || {}).forEach(k => { const m = /^e(\d+)\./.exec(k); if (m) maxI = Math.max(maxI, Number(m[1])); });
    let next = 1;
    const addRow = () => {
      const i = next++;
      const cells = [
        U.h('td', { class: 'lbl-td' }, String(i)),
        U.h('td', {}, U.sel(ctx, `e${i}.sw`, SW.map(s => [s, s]), { w: 'xs', ph: '—', label: `riga ${i}: switch` })),
        U.h('td', {}, U.sel(ctx, `e${i}.in`, [1, 2, 3, 4].map(p => [String(p), String(p)]), { w: 's', ph: 'qualsiasi', label: `riga ${i}: porta d'ingresso` })),
        U.h('td', {}, U.inp(ctx, `e${i}.src`, { w: 'm', ph: '* = qualsiasi', label: `riga ${i}: IP src` })),
        U.h('td', {}, U.inp(ctx, `e${i}.dst`, { w: 'm', ph: '* = qualsiasi', label: `riga ${i}: IP dst` })),
        U.h('td', {}, U.sel(ctx, `e${i}.out`, [1, 2, 3, 4].map(p => [String(p), `forward(${p})`]), { w: 's', ph: '—', label: `riga ${i}: action` }))
      ];
      if (ex.prio) cells.push(U.h('td', {}, U.inp(ctx, `e${i}.prio`, { w: 'xs', ph: '1', label: `riga ${i}: priorità` })));
      tbody.appendChild(U.h('tr', {}, cells));
    };
    for (let k = 0; k < Math.max(MIN_ROWS, maxI); k++) addRow();
    root.appendChild(U.card('2 · Entry delle flow table (match → action)', { step: 'r' },
      U.h('p', { class: 'small' }, 'Una riga per regola. Segui ogni flusso switch per switch: porta d\'ingresso, porta d\'uscita, poi la granularità di IP src e IP dst. La verifica simula i pacchetti di ogni coppia sorgente → destinazione.'),
      wrap,
      U.h('button', { class: 'btn ghost', type: 'button', text: '+ aggiungi riga', onclick: addRow })));
  }

  function solution(ex, root) {
    const head = ['Switch', 'Match', 'Action'].concat(ex.prio ? ['Priorità'] : [], ['Per quale flusso', 'Perché']);
    root.appendChild(U.h('div', { class: 'card sol' },
      U.h('h4', {}, 'Soluzione'),
      U.h('p', { class: 'sol-body' }, U.h('b', {}, 'Passo 1 · Mappa delle porte. '), 'Per ogni switch, il numero scritto vicino a lui su ciascun cavo:'),
      U.table(['Switch', 'Porta 1', 'Porta 2', 'Porta 3', 'Porta 4'], SW.map(s => [U.label(s)].concat([1, 2, 3, 4].map(p => ex.ports[s][p]))), { cls: 'center' }),
      U.h('p', { class: 'sol-body' }, U.h('b', {}, 'Passi 2-3 · Percorsi con [porta d\'ingresso, porta d\'uscita] su ogni switch:')),
      U.table(['Flusso', 'Percorso'], ex.flows.map(f => [f.id + ')', pathText(ex, f)])),
      U.fig(svgFig(ex, true), 'In evidenza i collegamenti usati dai percorsi richiesti. Numeri rossi = porte dello switch.'),
      U.h('p', { class: 'sol-body' }, U.h('b', {}, 'Passo 4 · Le regole '), '(una soluzione minima; le entry già presenti restano):'),
      U.table(head, ex.sol.rules.map(r => [U.label(r.sw), fmtMatch(r), `forward(${r.out})`]
        .concat(ex.prio ? [r.prio || `${DEF_PRIO} (vuota)`] : [], [r.per.join(', '), r.why]))),
      U.h('p', { class: 'sol-body' }, U.h('b', {}, 'Perché questa granularità. ')),
      U.h('ul', { class: 'small' }, granularity(ex).map(t => U.h('li', {}, t))),
      U.h('p', { class: 'small' }, 'Va bene anche una versione più specifica (per esempio porta d\'ingresso e IP src anche sull\'ultimo switch): più righe, stesso effetto. L\'importante è che ogni pacchetto richiesto segua il percorso e che nessun jolly catturi traffico che deve fare un\'altra strada.')));
  }

  function chatText(ex, a) {
    a = a || {};
    const v = k => String(a[k] == null ? '' : a[k]).trim();
    const L = [];
    L.push(`#5 · SDN e flow table (livello ${ex.level})`);
    L.push('## Testo');
    L.push('Rete SDN: s1 con h1, h2; s2 con h3, h4; s3 con h5, h6. Switch collegati a triangolo (s1–s2, s1–s3, s2–s3).');
    L.push('Host: ' + HOSTS.map(h => `${h} = ${IPS[h]}`).join(', ') + '.');
    L.push('Porte (dalla figura) — ' + mapLines(ex).join('; ') + '.');
    ex.existing.forEach(e => L.push(`Entry già presente su ${e.sw}: ${fmtMatch({ in: e.in, src: e.src, dst: e.dst })} → forward(${e.out})` + (e.prio ? `, priorità ${e.prio}` : '') + '.'));
    L.push('Scrivere le entry match → action da dare agli switch affinché:');
    ex.flows.forEach(f => L.push(`${f.id}) ${f.text}.`));
    if (ex.prio) L.push('(Priorità: vince la più alta, vuota = 1.)');
    L.push('');
    L.push('## Le mie risposte');
    L.push('Mappa delle porte: ' + SW.map(s => `${s}: ` + [1, 2, 3, 4].map(p => `${p}→${v(`pm.${s}.${p}`) || '__'}`).join(', ')).join('; '));
    const rows = readRows(ex, a);
    if (!rows.length) L.push('Flow table: (nessuna regola scritta)');
    rows.forEach(r => {
      const x = r.raw;
      L.push(`- ${x.sw || '__'}: ${fmtMatch(x)} → forward(${x.out || '__'})` + (ex.prio && x.prio ? `, priorità ${x.prio}` : ''));
    });
    return L.join('\n');
  }

  RA.sdn = {
    id: 'sdn', num: '5', name: 'SDN e flow table', examPoints: 4,
    desc: 'Mappa delle porte e entry match → action per far seguire ai flussi i percorsi richiesti; verifica simulando i pacchetti.',
    method: {
      intro: 'Si scrivono regole match → action perché ogni flusso segua il percorso richiesto. Con SDN il match può guardare anche la sorgente: due pacchetti verso la stessa destinazione possono fare strade diverse. Si lavora switch per switch, seguendo i pacchetti.',
      steps: [
        'Mappa delle porte: per ogni switch scrivi cosa c\'è dietro ogni porta (il numero vicino a uno switch è la porta di quello switch).',
        'Percorsi: per ogni flusso elenca gli switch attraversati, in ordine.',
        'Ingresso e uscita: su ogni switch del percorso la porta da cui arriva il pacchetto e quella verso il prossimo nodo. Regola: match = ingress + IP src + IP dst, action = forward(uscita).',
        'Granularità: IP esatto dove serve distinguere, jolly dove la strada è la stessa; sull\'ultimo switch una regola per host di destinazione.',
        'Verifica finale: segui un pacchetto di ogni flusso regola per regola, dalla porta d\'ingresso fino all\'host.'
      ],
      traps: [
        'Numero di porta dello switch sbagliato: lo stesso cavo ha due numeri, uno per capo. Nella regola di uno switch compaiono solo i SUOI numeri.',
        'Ultimo switch dimenticato: anche lo switch dell\'host di destinazione ha bisogno di una regola per consegnare il pacchetto.',
        'Jolly troppo largo: una regola con IP src 10.1.*.* cattura sia h1 sia h2; se devono fare strade diverse serve l\'IP esatto o la porta d\'ingresso.',
        'Entry già presenti: se si sovrappongono alla tua regola con un\'azione diversa, vince la priorità più alta; a parità è un conflitto.',
        'Traffico di ritorno: è un percorso nuovo, con sorgente e destinazione invertite. Se il testo non lo chiede, non serve.'
      ],
      formulas: [
        ['Sintassi', 'match: ingress port = 3, IP Src = 10.1.0.1, IP Dst = 10.3.*.* → action: forward(1)'],
        ['Match', 'porta d\'ingresso, IP src, IP dst (anche MAC, porte TCP/UDP); campo assente = qualsiasi'],
        ['Action', 'forward(porta) · drop · invio al controller · modifica di un campo'],
        ['Jolly', '10.3.*.* = 10.3.0.0/16 = ogni IP che inizia per 10.3'],
        ['Priorità', 'vince la più alta; stessa priorità e azioni diverse = conflitto'],
        ['Nessun match', 'il pacchetto va al controller (o viene scartato)']
      ]
    },
    traces: [
      {
        id: 'sim-sdn', set: 'simulato',
        title: 'Esame simulato · SDN (h1, h2 → h5, h6 e ritorno)',
        source: 'Esame_Simulato_TESTO.pdf pag. 8 · soluzioni pag. 8-9',
        params: {
          level: 3,
          ports: {
            s1: { 1: 's2', 2: 's3', 3: 'h1', 4: 'h2' },
            s2: { 1: 's1', 2: 's3', 3: 'h3', 4: 'h4' },
            s3: { 1: 's1', 2: 's2', 3: 'h5', 4: 'h6' }
          },
          flows: [
            { srcs: ['h1'], dsts: ['h5', 'h6'], path: ['s1', 's2', 's3'], ret: false },
            { srcs: ['h2'], dsts: ['h5', 'h6'], path: ['s1', 's3'], ret: false },
            { srcs: ['h5', 'h6'], dsts: ['h1', 'h2'], path: ['s3', 's1'], ret: true }
          ],
          existing: [{ sw: 's2', in: 3, src: '10.2.0.3', dst: '10.1.*.*', out: 1, prio: null }]
        },
        expect: {
          'pm.s1.1': 's2', 'pm.s1.2': 's3', 'pm.s1.3': 'h1', 'pm.s1.4': 'h2',
          'pm.s2.1': 's1', 'pm.s2.2': 's3', 'pm.s2.3': 'h3', 'pm.s2.4': 'h4',
          'pm.s3.1': 's1', 'pm.s3.2': 's2', 'pm.s3.3': 'h5', 'pm.s3.4': 'h6'
        }
      },
      {
        id: 'guida5-sdn',
        title: 'Guida 5 · esempio svolto (h4 via s1, h3 diretto)',
        source: 'Guida_5_SDN_Flow_Table.pdf pag. 1-2',
        params: {
          level: 2,
          ports: {
            s1: { 1: 's3', 2: 'h1', 3: 'h2', 4: 's2' },
            s2: { 1: 's3', 2: 's1', 3: 'h3', 4: 'h4' },
            s3: { 1: 'h6', 2: 'h5', 3: 's1', 4: 's2' }
          },
          flows: [
            { srcs: ['h4'], dsts: ['h5', 'h6'], path: ['s2', 's1', 's3'], ret: false },
            { srcs: ['h3'], dsts: ['h5', 'h6'], path: ['s2', 's3'], ret: false }
          ],
          existing: []
        },
        expect: {
          'pm.s1.1': 's3', 'pm.s1.2': 'h1', 'pm.s1.3': 'h2', 'pm.s1.4': 's2',
          'pm.s2.1': 's3', 'pm.s2.2': 's1', 'pm.s2.3': 'h3', 'pm.s2.4': 'h4',
          'pm.s3.1': 'h6', 'pm.s3.2': 'h5', 'pm.s3.3': 's1', 'pm.s3.4': 's2'
        }
      }
    ],
    randomParams, build, gen, steps, grade, sol2answers, render, solution, hints, fieldHint, diagnose, diagnoseCases, chatText
  };
})();
