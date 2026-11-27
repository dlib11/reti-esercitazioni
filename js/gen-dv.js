// ============================================================
// RetiApp · gen-dv.js — Esercizio 3 (seconda parte) · Routing: Distance Vector e Dijkstra
// Contratto dei moduli: vedi docs/moduli.md (modello: gen-nat.js)
// ============================================================
(function () {
  const RA = window.RetiApp;
  const U = RA.util;
  const INF = Infinity;

  // risposte accettate per "infinito" e per "nessun next-hop"
  const INF_TXT = ['∞', '+∞', 'inf', 'infinito', 'infinity', 'oo', '-', '—'];
  const NONE_TXT = ['-', '—', 'nessuno', 'none', 'n/a', '∞', 'inf'];

  // Posizioni dei nodi (viewBox 540×280) e lati possibili: i lati candidati non si
  // incrociano mai, così la figura resta leggibile. "diag": una sola delle due diagonali.
  const LAYOUT = {
    3: { pos: [[90, 170], [270, 50], [450, 170]], cand: [[0, 1], [1, 2], [0, 2]] },
    4: { pos: [[70, 140], [270, 44], [270, 236], [470, 140]], cand: [[0, 1], [0, 2], [1, 2], [1, 3], [2, 3]] },
    5: { pos: [[60, 140], [210, 44], [210, 236], [410, 44], [410, 236]], cand: [[0, 1], [0, 2], [1, 2], [1, 3], [2, 4], [3, 4]], diag: [[1, 4], [2, 3]] },
    6: { pos: [[44, 140], [176, 44], [176, 236], [364, 44], [364, 236], [496, 140]], cand: [[0, 1], [0, 2], [1, 2], [1, 3], [2, 4], [3, 4], [3, 5], [4, 5]], diag: [[1, 4], [2, 3]] }
  };
  const EDGES_N = { 3: [2, 3], 4: [4, 5], 5: [5, 7], 6: [7, 9] };
  const LEVELS = {
    1: { n: [3], parts: 'ac' },
    2: { n: [4], parts: 'abc' },
    3: { n: [4, 5], parts: 'abcd' },
    4: { n: [5], parts: 'abcde', ng: 1 },
    5: { n: [6], parts: 'abcde', ng: 2 }
  };

  // ---------------- domande a scelta (parte e) ----------------
  // opts[0] è quella giusta; le altre hanno la spiegazione dell'errore
  const G = (id, easy, q, hint, why, opts) => ({ id, easy, q, hint, why, opts: opts.map(([v, t, err]) => ({ v, t, err: err || '' })) });
  const BANK = [
    G('cti', true, 'Il costo di un link aumenta molto. Cosa può succedere con distance vector senza poisoned reverse?',
      'Pensa a cosa sa un nodo dei vicini: solo le loro distanze, non i loro cammini.',
      'Un nodo DV conosce solo le distanze annunciate dai vicini, non i loro cammini. Se il link peggiora, un vicino può ancora annunciare il vecchio cammino che passava proprio da quel link: i due nodi si rimbalzano la stima e la alzano poco alla volta (count to infinity). Le cattive notizie viaggiano lentamente.',
      [['loop', 'Due nodi si rimandano la stima e la alzano poco a ogni scambio (count to infinity)'],
        ['fast', 'Tutti lo scoprono in una o due iterazioni, come quando il costo scende', 'Veloce è solo il caso del costo che scende ("le buone notizie viaggiano in fretta"). Se sale, un vicino può annunciare il vecchio cammino che passa dal link peggiorato.'],
        ['flood', 'Il router manda un LSA in flooding a tutta la rete e ognuno rifà Dijkstra', 'Questo è link state (OSPF): in distance vector un nodo parla solo con i vicini.'],
        ['none', 'Niente: un DV si ricalcola solo quando si aggiunge un link nuovo', 'Un DV si ricalcola a ogni cambio di costo di un link locale e a ogni vettore nuovo ricevuto da un vicino.']]),
    G('good', true, 'Il costo di un link diminuisce. Come si propaga la notizia con distance vector?',
      'Un costo più basso migliora subito il minimo di chi lo vede: serve aspettare qualcosa?',
      'Un costo più basso abbassa subito il minimo dei nodi vicini, che lo annunciano a loro volta: bastano poche iterazioni ("le buone notizie viaggiano in fretta").',
      [['fast', 'In fretta: ogni nodo migliora subito la stima e la annuncia, bastano poche iterazioni'],
        ['slow', 'Lentamente: la stima scende di poco a ogni scambio (count to infinity)', 'Il count to infinity succede quando il costo SALE: un nodo crede ancora al vecchio cammino del vicino.'],
        ['timer', 'Solo allo scadere di un timer periodico di 30 secondi', 'In DV un nodo invia il vettore appena cambia; i 30 s sono il refresh di RIP, non il modo in cui si propaga una notizia.'],
        ['ls', 'Ogni router riceve la nuova topologia e rifà Dijkstra', 'Questo è link state: in DV non c\'è la topologia completa.']]),
    G('prwhat', true, 'Cosa fa la tecnica del poisoned reverse?',
      'Il "veleno" serve a non far passare un vicino da te per tornare indietro.',
      'Se Z raggiunge D passando da Y, Z annuncia a Y distanza ∞ verso D. Così Y non proverà mai a raggiungere D passando da Z, e il ciclo Y→Z→Y non si forma.',
      [['inf', 'Se Z raggiunge D passando da Y, Z annuncia a Y distanza ∞ verso D'],
        ['all', 'Z annuncia ∞ verso D a tutti i suoi vicini', 'Il veleno va solo al vicino usato come next-hop verso D: agli altri Z annuncia il costo vero, altrimenti nessuno potrebbe passare da Z.'],
        ['drop', 'Z ignora i vettori che riceve dal suo next-hop', 'Z continua a usare i vettori di tutti i vicini: è l\'annuncio verso il next-hop che viene "avvelenato".'],
        ['ttl', 'Ogni vettore ha un TTL e viene scartato dopo 16 salti', 'Il limite di 16 (∞ in RIP) è un altro rimedio; poisoned reverse riguarda cosa si annuncia al next-hop.']]),
    G('lsdv', true, 'Quale differenza tra link state e distance vector è corretta?',
      'Chi conosce tutta la mappa della rete e chi solo i vicini?',
      'Link state: ogni nodo riceve in flooding gli LSA di tutti, ha la topologia completa e calcola Dijkstra. Distance vector: ogni nodo conosce solo i costi verso i vicini e i loro vettori, e applica Bellman-Ford.',
      [['ok', 'LS: topologia completa (flooding) e Dijkstra · DV: solo i vicini e i loro vettori, Bellman-Ford'],
        ['swap', 'LS: solo i vicini e Bellman-Ford · DV: topologia completa e Dijkstra', 'Hai invertito i due: Dijkstra ha bisogno della mappa completa, quindi è link state.'],
        ['central', 'LS è calcolato da un server centrale, DV è distribuito', 'Anche link state è distribuito: ogni router calcola da solo, ma con la mappa completa.'],
        ['same', 'Nessuna: cambiano solo i nomi dei messaggi', 'Cambia l\'informazione che ogni nodo ha: tutta la topologia (LS) o solo i vicini (DV).']]),
    G('ospf', true, 'Come funziona OSPF?',
      'OSPF è "Open Shortest Path First": quale algoritmo calcola lo shortest path con la mappa completa?',
      'OSPF è link state: i router si scoprono con i messaggi Hello, si scambiano LSA, costruiscono il database della topologia (LSDB) e calcolano i cammini minimi con Dijkstra.',
      [['ls', 'Link state: Hello per i vicini, LSA in flooding, LSDB, Dijkstra'],
        ['rip', 'Distance vector con metrica numero di hop: ogni router manda il vettore ai vicini', 'Questo è RIP, non OSPF.'],
        ['bgp', 'Path vector tra AS diversi, su sessioni TCP', 'Questo è BGP, il protocollo tra AS (inter-AS).'],
        ['periodic', 'Link state, ma ripete il flooding ogni 30 secondi anche se nulla cambia', 'In OSPF gli aggiornamenti partono quando la topologia cambia; ogni 30 s è il periodo di RIP.']]),
    G('igp', true, 'Quale associazione è corretta?',
      'Dentro un AS (intra-AS, IGP) o tra AS (inter-AS)?',
      'RIP e OSPF sono protocolli intra-AS (IGP): tutti i router dello stesso AS usano lo stesso. BGP collega AS diversi (inter-AS).',
      [['ok', 'RIP e OSPF: intra-AS (IGP) · BGP: inter-AS'],
        ['a', 'OSPF e BGP: intra-AS · RIP: inter-AS', 'BGP è il protocollo tra AS; RIP lavora dentro un AS.'],
        ['b', 'Tutti e tre sono inter-AS', 'RIP e OSPF lavorano dentro un solo AS.'],
        ['c', 'BGP: intra-AS · OSPF: inter-AS', 'Hai invertito: OSPF dentro l\'AS, BGP tra AS.']]),
    G('prlim', false, 'Poisoned reverse risolve sempre il count to infinity?',
      'Il veleno va al vicino diretto: e se il ciclo passa per tre nodi?',
      'No: evita i cicli tra due nodi vicini, ma con un ciclo di tre o più nodi un nodo può ancora ricevere un cammino che passa da lui stesso senza saperlo.',
      [['no', 'No: evita i cicli tra due nodi, non quelli di tre o più nodi'],
        ['yes', 'Sì, in ogni topologia', 'Il veleno va solo al next-hop diretto: un ciclo di tre o più nodi non viene visto.'],
        ['ls', 'Sì, ma solo se tutti i router usano link state', 'Poisoned reverse è una tecnica distance vector; link state non ha il count to infinity perché ogni nodo ha la mappa completa.'],
        ['down', 'Non serve: il count to infinity capita solo quando un costo scende', 'È il contrario: capita quando un costo SALE (cattive notizie).']]),
    G('robust', false, 'Un router guasto annuncia costi sbagliati. Cosa succede?',
      'In quale algoritmo i nodi usano i risultati dei vicini nei propri calcoli?',
      'In DV ogni nodo usa i vettori dei vicini per calcolare il proprio: un vettore sbagliato si propaga in tutta la rete. In LS un router annuncia solo i costi dei suoi link e ognuno calcola da sé: l\'errore resta limitato.',
      [['dv', 'Con DV l\'errore si propaga a tutta la rete; con LS resta limitato ai link di quel router'],
        ['ls', 'Con LS l\'errore si propaga a tutta la rete; con DV resta locale', 'Al contrario: in LS ognuno calcola da sé con la mappa; in DV i calcoli usano i vettori dei vicini.'],
        ['none', 'In entrambi nessun effetto: i vicini controllano ogni annuncio', 'Né LS né DV verificano i costi annunciati: si fidano dei messaggi.'],
        ['both', 'In entrambi tutta la rete si ferma finché il router non viene riavviato', 'La rete continua a inoltrare, solo con cammini sbagliati.']]),
    G('areas', false, 'Perché OSPF divide un AS in aree?',
      'Più la rete è grande, più LSA e più calcoli: come si riduce il lavoro?',
      'Per scalare: ogni router conosce in dettaglio solo la topologia della propria area; le aree si collegano tramite il backbone (area 0) e i router di bordo riassumono le distanze verso le reti della loro area.',
      [['scale', 'Per scalare: topologia dettagliata solo della propria area, aree unite dal backbone (area 0)'],
        ['sec', 'Per sicurezza: aree diverse non possono scambiarsi pacchetti', 'Le aree si scambiano traffico normalmente, attraverso il backbone.'],
        ['as', 'Ogni area è un AS diverso e parla BGP con le altre', 'Le aree sono dentro lo stesso AS: BGP serve tra AS diversi.'],
        ['opt', 'Per poter fare a meno dell\'area 0', 'L\'area 0 (backbone) è obbligatoria: tutte le altre aree sono collegate a lei.']]),
    G('when', false, 'Quando un nodo distance vector invia il proprio vettore?',
      'L\'algoritmo è iterativo, asincrono e distribuito: cosa scatena un invio?',
      'Quando il suo vettore cambia (per il costo di un link locale o per un vettore nuovo di un vicino): lo invia ai vicini, che ricalcolano e, se cambiano, lo inviano a loro volta.',
      [['chg', 'Ai vicini, quando il suo vettore cambia'],
        ['flood', 'A tutti i router della rete, in flooding', 'Il vettore va solo ai vicini; il flooding è di link state.'],
        ['once', 'Una sola volta, all\'avvio', 'Il vettore si reinvia ogni volta che cambia: è così che la rete converge.'],
        ['ask', 'Solo quando un vicino glielo chiede', 'Non serve richiesta: l\'invio parte dal cambiamento.']])
  ];
  const bankById = id => BANK.find(b => b.id === id);

  // ---------------- calcoli sul grafo ----------------
  const fmt = v => (v === INF || v == null) ? '∞' : String(v);
  function dijkstra(nodes, adj, s) {
    const dist = {}, pred = {}, prov = {};
    nodes.forEach(v => { dist[v] = INF; pred[v] = null; prov[v] = { costs: [], preds: [] }; });
    dist[s] = 0;
    const inN = [s], rows = [];
    const note = v => { if (dist[v] < INF) { prov[v].costs.push(dist[v]); prov[v].preds.push(pred[v]); } };
    nodes.forEach(v => { if (v !== s && adj[s][v] != null) { dist[v] = adj[s][v]; pred[v] = s; note(v); } });
    const snap = () => {
      const D = {}, P = {};
      nodes.forEach(v => { D[v] = dist[v]; P[v] = pred[v]; });
      rows.push({ inN: inN.slice(), D, P });
    };
    snap();
    while (inN.length < nodes.length) {
      let w = null;
      nodes.forEach(v => { if (!inN.includes(v) && (w === null || dist[v] < dist[w])) w = v; });
      if (dist[w] === INF) break;
      inN.push(w);
      nodes.forEach(v => {
        if (inN.includes(v) || adj[w][v] == null) return;
        if (dist[w] + adj[w][v] < dist[v]) { dist[v] = dist[w] + adj[w][v]; pred[v] = w; note(v); }
      });
      snap();
    }
    // numero di cammini minimi (per scartare i pareggi)
    const cnt = {};
    inN.forEach((v, i) => {
      cnt[v] = i === 0 ? 1 : 0;
      if (i) nodes.forEach(u => { if (adj[u][v] != null && cnt[u] && dist[u] + adj[u][v] === dist[v]) cnt[v] += cnt[u]; });
    });
    return { s, dist, pred, order: inN, rows, cnt, prov };
  }
  function pathOf(dj, y) {
    const p = [y];
    while (p[0] !== dj.s && dj.pred[p[0]] != null) p.unshift(dj.pred[p[0]]);
    return p;
  }
  const firstHop = (dj, y) => { const p = pathOf(dj, y); return p.length > 1 ? p[1] : '-'; };

  // tutto quello che serve, ricalcolato da ex (ex resta solo dati)
  function calc(ex) {
    const N = ex.nodes, X = ex.x;
    const adj = {};
    N.forEach(n => { adj[n] = {}; });
    ex.edges.forEach(([u, v, c]) => { adj[u][v] = c; adj[v][u] = c; });
    const nb = N.filter(n => n !== X && adj[X][n] != null);
    const others = N.filter(n => n !== X);
    const djs = {};
    const D = s => djs[s] || (djs[s] = dijkstra(N, adj, s));
    const d0 = (v, y) => v === y ? 0 : (adj[v][y] != null ? adj[v][y] : INF);
    const dx = D(X);
    const A = {}, B = {}, C = {};
    others.forEach(y => {
      A[y] = adj[X][y] != null ? adj[X][y] : INF;
      const bt = nb.map(v => ({ v, c: adj[X][v], d: d0(v, y), s: adj[X][v] + d0(v, y) }));
      const bm = Math.min(...bt.map(t => t.s));
      const barg = bt.filter(t => t.s === bm);
      B[y] = { cost: bm, nh: bm === INF ? '-' : barg[0].v, terms: bt, ties: bm < INF && barg.length > 1 };
      const ct = nb.map(v => ({ v, c: adj[X][v], d: D(v).dist[y], s: adj[X][v] + D(v).dist[y] }));
      C[y] = { cost: dx.dist[y], nh: firstHop(dx, y), terms: ct, path: pathOf(dx, y) };
    });
    const S = D(ex.src);
    return { adj, nb, others, A, B, C, dx, S, d0, D, X };
  }
  const srcOthers = ex => ex.nodes.filter(n => n !== ex.src);
  const pathTxt = p => p.join('→');
  const hasPart = (ex, p) => ex.parts.includes(p);

  function valid(level, ex, c) {
    const okTree = dj => ex.nodes.every(v => dj.dist[v] < INF && dj.cnt[v] === 1) &&
      new Set(ex.nodes.map(v => dj.dist[v])).size === ex.nodes.length;
    if (!okTree(c.dx) || !okTree(c.S)) return false;
    const o = c.others;
    if (o.some(y => c.B[y].ties)) return false;
    // dal livello 2 almeno due vicini: altrimenti il next-hop è sempre lo stesso
    if (level >= 2 && c.nb.length < 2) return false;
    const aNeC = o.some(y => c.A[y] !== c.C[y].cost);
    const bNeA = o.some(y => c.B[y].cost !== c.A[y]);
    const bNeC = o.some(y => c.B[y].cost !== c.C[y].cost);
    const indirect = o.some(y => c.C[y].nh !== y);
    const shortcut = o.some(y => c.A[y] < INF && c.C[y].cost < c.A[y]);
    if (level <= 1) return aNeC;
    if (level === 2) return bNeA;
    if (level === 3) return bNeA && indirect;
    if (level === 4) return bNeA && (bNeC || shortcut);
    return bNeC && shortcut;
  }

  // ---------------- parametri e costruzione ----------------
  const perm = k => U.shuffle(Array.from({ length: k }, (_, i) => i));
  function connected(n, ed) {
    const seen = new Set([0]);
    let grew = true;
    while (grew) {
      grew = false;
      ed.forEach(([i, j]) => {
        if (seen.has(i) !== seen.has(j)) { seen.add(i); seen.add(j); grew = true; }
      });
    }
    return seen.size === n;
  }
  function prQuestion(level, ex, c) {
    // poisoned reverse sul nodo X: a quale vicino, verso quale destinazione
    const poison = level < 5 || U.chance(0.75);
    const infCases = c.others.filter(t => c.C[t].nh !== t).map(t => ({ to: c.C[t].nh, dest: t }));
    const otherCases = [];
    c.others.forEach(t => c.nb.forEach(w => { if (w !== t && w !== c.C[t].nh) otherCases.push({ to: w, dest: t }); }));
    // con il veleno: 60% casi "via W" (risposta ∞); senza: soprattutto casi "via W" (risposta: il costo vero)
    let pool = infCases.length && U.chance(poison ? 0.6 : 0.7) ? infCases : otherCases;
    if (!pool.length) pool = infCases.length ? infCases : otherCases;
    const k = U.pick(pool);
    return { t: 'pr', to: k.to, dest: k.dest, poison, rk: perm(6) };
  }
  function randomParams(level) {
    const L = LEVELS[level] || LEVELS[3];
    for (let t = 0; t < 5000; t++) {
      const n = U.pick(L.n);
      const lay = LAYOUT[n];
      const lower = U.chance(0.5);
      const names = lower ? ['u', 'v', 'w', 'x', 'y', 'z'].slice(6 - n) : ['A', 'B', 'C', 'D', 'E', 'F'].slice(0, n);
      const cand = lay.cand.concat(lay.diag ? [U.pick(lay.diag)] : []);
      const [lo, hi] = EDGES_N[n];
      const chosen = U.sample(cand, Math.min(cand.length, U.rndInt(lo, hi)));
      if (!connected(n, chosen)) continue;
      const place = level >= 3 ? U.shuffle(names) : names.slice();
      const edges = chosen.map(([i, j]) => {
        const [u, v] = [place[i], place[j]].sort();
        return [u, v, U.rndInt(1, 9)];
      }).sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1]));
      const x = level <= 2 ? (lower ? 'x' : 'A') : U.pick(names);
      const p = { level, nodes: names, place, edges, x, src: x, parts: L.parts, qs: [] };
      const ex = { nodes: names, edges, x, src: x };
      const c = calc(ex);
      if (!valid(level, ex, c)) continue;
      if (L.parts.includes('e')) {
        p.qs.push(prQuestion(level, ex, c));
        U.sample(BANK.filter(b => level >= 5 || b.easy), L.ng).forEach(b => p.qs.push({ t: 'g', id: b.id, rk: perm(6) }));
      }
      return p;
    }
    throw new Error('dv: nessun grafo valido trovato');
  }

  // opzioni ordinate secondo la permutazione rk dei parametri
  const ordered = (opts, rk) => opts.map((o, i) => [o, rk && rk[i] != null ? rk[i] : i]).sort((a, b) => a[1] - b[1]).map(x => x[0]);
  function buildPr(ex, c, q) {
    const X = ex.x, W = q.to, T = q.dest;
    const viaW = c.C[T].nh === W;
    const dist = c.C[T].cost;
    const okV = q.poison && viaW ? '∞' : String(dist);
    const pth = pathTxt(c.C[T].path);
    const why = q.poison
      ? (viaW
        ? `${X} raggiunge ${T} passando proprio da ${W} (${pth}): con poisoned reverse gli annuncia ∞. Così ${W} non proverà mai a raggiungere ${T} passando da ${X}, e il ciclo ${W}→${X}→${W} non si forma.`
        : `${X} raggiunge ${T} via ${c.C[T].nh} (${pth}), non via ${W}: il veleno non serve e ${X} annuncia a ${W} il costo vero, ${dist}.`)
      : `Senza poisoned reverse ${X} annuncia a tutti i vicini lo stesso vettore: verso ${T} il costo minimo, ${dist} (${pth}).`;
    const cand = [
      ['∞', q.poison
        ? `Il veleno (∞) si annuncia solo al vicino da cui si passa: ${X} raggiunge ${T} via ${c.C[T].nh}, non via ${W}, quindi annuncia il costo vero.`
        : `Senza poisoned reverse non si annuncia mai ∞ a un nodo raggiungibile: ${X} annuncia il costo vero a tutti i vicini.`],
      [String(dist), `È il costo vero, ma ${X} raggiunge ${T} passando proprio da ${W} (${pth}): con poisoned reverse gli annuncia ∞.`],
      [String(dist + c.adj[X][W]), `Il costo del link ${X}–${W} lo aggiunge ${W} quando riceve il vettore, non ${X} quando lo annuncia.`],
      [String(c.D(W).dist[T]), `È la distanza di ${W} verso ${T}: ${X} annuncia la propria.`],
      [c.adj[X][T] != null ? String(c.adj[X][T]) : '0', c.adj[X][T] != null
        ? `È il costo del link diretto ${X}–${T}, ma ${X} annuncia la sua distanza minima.`
        : `0 lo annuncia solo un nodo verso sé stesso.`],
      ['0', `0 lo annuncia solo un nodo verso sé stesso.`],
      [String(dist + 1), `Non serve aggiungere nulla: ${X} annuncia esattamente la sua distanza minima verso ${T}.`]
    ];
    const seen = new Set();
    const opts = [];
    cand.forEach(([v, err]) => {
      if (seen.has(v) || opts.length >= 4) return;
      seen.add(v);
      opts.push({ v, t: v, err: v === okV ? '' : err });
    });
    const text = `${q.poison ? 'Con' : 'Senza'} poisoned reverse, a convergenza, quale distanza verso ${T} annuncia ${X} a ${W}?`;
    const hint = q.poison ? `Come raggiunge ${T} il nodo ${X}? Se il next-hop è proprio ${W}, scatta il veleno.` : `Senza veleno ${X} annuncia a tutti la sua distanza minima verso ${T}.`;
    return { kind: 'pr', q: text, hint, why, opts: ordered(opts, q.rk), ok: okV };
  }
  function buildQ(ex, c, q) {
    if (q.t === 'pr') return buildPr(ex, c, q);
    const b = bankById(q.id);
    return { kind: 'g', id: b.id, q: b.q, hint: b.hint, why: b.why, opts: ordered(b.opts.map(o => Object.assign({}, o)), q.rk), ok: b.opts[0].v };
  }

  function build(p) {
    const ex = {
      cat: 'dv', level: p.level, params: p,
      nodes: p.nodes.slice(), place: (p.place || p.nodes).slice(),
      edges: p.edges.map(e => [e[0], e[1], Number(e[2])]),
      x: p.x, src: p.src || p.x, parts: p.parts || 'abc', qs: []
    };
    if (hasPart(ex, 'e')) {
      const c = calc(ex);
      ex.qs = (p.qs || []).map(q => buildQ(ex, c, q));
    }
    return ex;
  }
  const gen = level => build(randomParams(level));

  // ---------------- chiavi e passi ----------------
  function stepKeys(ex) {
    const o = ex.nodes.filter(n => n !== ex.x);
    const so = srcOthers(ex);
    return {
      a: o.map(y => `a.${y}`),
      b: o.flatMap(y => [`b.${y}.cost`, `b.${y}.nh`]),
      c: o.flatMap(y => [`c.${y}.cost`, `c.${y}.nh`]),
      d: so.flatMap(y => [`dj.${y}.cost`, `dj.${y}.pred`]).concat(ex.nodes.slice(1).map((_, i) => `dj.order${i + 2}`)),
      e: ex.qs.map((_, i) => `e${i + 1}`)
    };
  }
  const STEP_TITLE = {
    a: 'a) DV iniziale',
    b: 'b) Una iterazione di Bellman-Ford',
    c: 'c) DV finale (cammini minimi)',
    d: 'd) Dijkstra',
    e: 'e) Domande'
  };
  function steps(ex) {
    const K = stepKeys(ex);
    return 'abcde'.split('').filter(p => hasPart(ex, p) && K[p].length).map(p => ({ id: p, title: STEP_TITLE[p], keys: K[p] }));
  }
  function parseKey(k) {
    let m;
    if ((m = /^a\.(\w+)$/.exec(k))) return { part: 'a', y: m[1], f: 'cost' };
    if ((m = /^dj\.order(\d+)$/.exec(k))) return { part: 'dj', f: 'order', i: Number(m[1]) };
    if ((m = /^(b|c|dj)\.(\w+)\.(cost|nh|pred)$/.exec(k))) return { part: m[1], y: m[2], f: m[3] };
    if ((m = /^e(\d+)$/.exec(k))) return { part: 'e', i: Number(m[1]) };
    return null;
  }

  // ---------------- lettura delle risposte ----------------
  function parseCost(v) {
    const s = U.norm(v).replace(/\s+/g, '');
    if (s === '') return undefined;
    if (INF_TXT.includes(s)) return INF;
    return /^\d+$/.test(s) ? Number(s) : NaN;
  }
  function parseNode(ex, v) {
    const s = U.norm(v);
    if (s === '') return undefined;
    const n = ex.nodes.find(x => U.norm(x) === s);
    if (n) return n;
    return NONE_TXT.includes(s) ? '-' : null;
  }

  // ---------------- risposte attese ----------------
  const termTxt = (X, y, t, fin) => `c(${X},${t.v}) + ${fin ? 'D' : 'd'}${t.v}(${y}) = ${t.c} + ${fmt(t.d)} = ${fmt(t.s)}`;
  const minTxt = terms => `min{${terms.map(t => `${t.c}+${fmt(t.d)}`).join(', ')}}`;
  function expected(ex, c) {
    const X = ex.x, E = {};
    const K = stepKeys(ex);
    if (hasPart(ex, 'a')) c.others.forEach(y => {
      E[`a.${y}`] = { kind: 'cost', val: c.A[y], msg: c.A[y] < INF ? `${y} è vicino di ${X}: nel DV iniziale c'è il costo del link ${X}–${y}, cioè ${c.A[y]}.` : `${y} non è vicino di ${X}: all'inizio ${X} non sa come raggiungerlo, quindi d${X}(${y}) = ∞.` };
    });
    if (hasPart(ex, 'b')) c.others.forEach(y => {
      const B = c.B[y];
      E[`b.${y}.cost`] = { kind: 'cost', val: B.cost, msg: `Con i vettori iniziali dei vicini: d${X}(${y}) = ${minTxt(B.terms)} = ${fmt(B.cost)}.` };
      E[`b.${y}.nh`] = { kind: 'node', val: B.nh, msg: B.nh === '-' ? `Dopo una iterazione ${y} è ancora ∞: nessun next-hop (—).` : `Il next-hop è il vicino che dà il minimo: ${minTxt(B.terms)} → via ${B.nh}.` };
    });
    if (hasPart(ex, 'c')) c.others.forEach(y => {
      const C = c.C[y];
      E[`c.${y}.cost`] = { kind: 'cost', val: C.cost, msg: `Cammino minimo ${pathTxt(C.path)} = ${C.cost} (con i vettori finali dei vicini: ${minTxt(C.terms)}).` };
      E[`c.${y}.nh`] = { kind: 'node', val: C.nh, msg: `Il cammino minimo ${pathTxt(C.path)} esce da ${X} verso ${C.nh}: next-hop = ${C.nh}.` };
    });
    if (hasPart(ex, 'd')) {
      const S = c.S;
      srcOthers(ex).forEach(y => {
        const p = pathTxt(pathOf(S, y));
        E[`dj.${y}.cost`] = { kind: 'cost', val: S.dist[y], msg: `D(${y}) = ${S.dist[y]}, cammino ${p}.` };
        E[`dj.${y}.pred`] = { kind: 'node', val: S.pred[y], msg: `p(${y}) è l'ultimo nodo prima di ${y} nel cammino minimo ${p}: ${S.pred[y]}.` };
      });
      K.d.filter(k => k.startsWith('dj.order')).forEach(k => {
        const i = Number(k.slice(8));
        const w = S.order[i - 1];
        E[k] = { kind: 'node', val: w, msg: `Al passo ${i - 1} entra in N' il nodo fuori da N' con D minimo: ${w} (D = ${S.dist[w]}).` };
      });
    }
    ex.qs.forEach((q, i) => {
      const o = q.opts.find(x => x.v === q.ok);
      E[`e${i + 1}`] = { kind: 'opt', val: q.ok, msg: `Risposta giusta: ${o ? o.t : q.ok}. ${q.why}` };
    });
    return E;
  }

  // ---------------- correzione ----------------
  function grade(ex, a) {
    const E = expected(ex, calc(ex));
    let correct = 0, total = 0;
    const marks = {};
    for (const k in E) {
      const e = E[k], v = a[k];
      let ok;
      if (e.kind === 'cost') ok = parseCost(v) === e.val;
      else if (e.kind === 'node') ok = parseNode(ex, v) === e.val;
      else ok = String(v == null ? '' : v).trim() === e.val;
      total++;
      if (ok) correct++;
      marks[k] = { ok, msg: e.msg };
    }
    return { correct, total, marks };
  }
  function sol2answers(ex) {
    const E = expected(ex, calc(ex));
    const a = {};
    for (const k in E) a[k] = E[k].kind === 'cost' ? fmt(E[k].val) : String(E[k].val);
    return a;
  }

  // ---------------- errori tipici ----------------
  function costDiag(ex, c, part, y, n) {
    const X = ex.x;
    if (part === 'a') {
      const link = c.adj[X][y];
      if (n === c.A[y]) return null;
      if (n === 0) return `0 è solo la distanza di ${X} da sé stesso.`;
      if (link == null) return `${y} non è vicino di ${X}: nel DV iniziale ${X} conosce solo i costi dei suoi link, quindi d${X}(${y}) = ∞.` +
        (n === c.C[y].cost ? ` ${n} è il costo minimo finale (parte c): per scoprirlo servono i vettori dei vicini.` : '');
      if (n === INF) return `${y} è vicino di ${X} (link di costo ${link}): il DV iniziale riporta il costo del link diretto, non ∞.`;
      if (n === c.C[y].cost) return `È il costo minimo finale: all'inizio ${X} non ha ancora i vettori dei vicini e usa solo il costo del link diretto ${X}–${y}, cioè ${link}.`;
      return `Nel DV iniziale c'è il costo del link diretto ${X}–${y}, scritto sul lato del grafo: ${link}.`;
    }
    if (part === 'b') {
      const B = c.B[y];
      if (n === B.cost) return null;
      if (n === 0) return `0 è solo la distanza di ${X} da sé stesso.`;
      if (B.cost === INF) return `Dopo una sola iterazione ${y} è ancora ∞: nessun vicino di ${X} è collegato direttamente a ${y}, e i vettori iniziali dei vicini contengono solo i loro link. ${y} si scopre all'iterazione successiva.`;
      if (n === c.C[y].cost) return `Questo è il valore finale (parte c). Dopo una sola iterazione ${X} usa solo i vettori iniziali dei vicini, che conoscono solo i propri link: il cammino ${pathTxt(c.C[y].path)} ha più di 2 link e non si vede ancora. Qui: ${minTxt(B.terms)} = ${B.cost}.`;
      if (n === INF) return `${y} è già raggiungibile dopo una iterazione: ${minTxt(B.terms)} = ${B.cost} via ${B.nh}.`;
      if (n === c.A[y]) return `È il valore iniziale: con i vettori dei vicini d${X}(${y}) può scendere. ${minTxt(B.terms)} = ${B.cost} via ${B.nh}.`;
      const bt = B.terms.find(t => t.v === B.nh);
      if (n === bt.d) return `Hai dimenticato il costo del link verso il vicino: ${termTxt(X, y, bt)}, non ${bt.d}.`;
      const ot = B.terms.find(t => t.s === n);
      if (ot) return `${n} è il termine via ${ot.v}, ma non è il minimo: ${minTxt(B.terms)} = ${B.cost} via ${B.nh}.`;
      return null;
    }
    // parte c (da X) o Dijkstra (dalla sorgente)
    const src = part === 'c' ? X : ex.src;
    const dj = part === 'c' ? c.dx : c.S;
    const exp = dj.dist[y];
    if (n === exp) return null;
    const pth = pathTxt(pathOf(dj, y));
    const link = c.adj[src][y];
    if (n === 0) return `0 è solo la distanza di ${src} da sé stesso.`;
    if (n === INF) return `Il grafo è connesso: a convergenza ogni nodo ha un costo finito. Cammino minimo: ${pth} = ${exp}.`;
    if (link != null && n === link && link > exp) return `È il costo del link diretto ${src}–${y}, ma c'è un cammino più corto: ${pth} = ${exp}.`;
    if (part === 'c') {
      if (n === c.B[y].cost) return `È il valore dopo una sola iterazione (parte b): a convergenza i vettori dei vicini sono già minimi e il cammino ${pth} costa ${exp}.`;
      const t = c.C[y].terms.find(x => x.v === c.C[y].nh);
      if (n === t.d) return `Hai dimenticato il costo del link verso il vicino: ${termTxt(X, y, t, true)}, non ${t.d}.`;
      const ot = c.C[y].terms.find(x => x.s === n);
      if (ot) return `È il costo passando da ${ot.v}, ma non è il minimo: ${minTxt(c.C[y].terms)} = ${exp} via ${c.C[y].nh}.`;
      return null;
    }
    if (dj.prov[y].costs.includes(n)) return `È un valore provvisorio della tabella: D(${y}) può ancora scendere finché ${y} non entra in N'. Il valore finale è ${exp} (${pth}).`;
    return null;
  }
  function nodeDiag(ex, c, part, f, y, nd) {
    const X = ex.x;
    if (part === 'b' || part === 'c') {
      const R = part === 'b' ? c.B[y] : c.C[y];
      const exp = R.nh;
      if (nd === exp) return null;
      if (exp === '-') return `Dopo una sola iterazione ${y} è ancora a ∞: non c'è ancora un next-hop (scegli "—").`;
      if (nd === '-') return `${y} è raggiungibile: il next-hop è il vicino che dà il minimo, ${minTxt(R.terms)} → via ${exp}.`;
      if (part === 'b' && nd === c.C[y].nh) return `Questo è il next-hop finale. Dopo una sola iterazione il minimo è ${minTxt(R.terms)} = ${R.cost}, via ${exp}.`;
      if (nd === X) return `Il next-hop non può essere ${X} stesso: è il vicino a cui ${X} passa il pacchetto.`;
      if (part === 'c' && nd === c.dx.pred[y]) return `Hai messo il predecessore (l'ultimo nodo prima di ${y}). Il next-hop è il PRIMO nodo dopo ${X} nel cammino ${pathTxt(c.C[y].path)}: ${exp}.`;
      if (c.adj[X][nd] == null) return `Il next-hop è sempre un vicino di ${X} (il primo router a cui passa il pacchetto): ${nd} non è collegato a ${X}.`;
      if (nd === y) return `Il link diretto ${X}–${y} non è la scelta migliore: ${minTxt(R.terms)} → via ${exp} costa ${fmt(R.cost)}.`;
      const t = R.terms.find(x => x.v === nd);
      return `Via ${nd} il costo è ${t.c} + ${fmt(t.d)} = ${fmt(t.s)}, ma il minimo è via ${exp} (${fmt(R.cost)}).`;
    }
    const S = c.S;
    if (f === 'order') return null;
    const exp = S.pred[y];
    if (nd === exp) return null;
    const pth = pathTxt(pathOf(S, y));
    if (nd === '-') return `Il grafo è connesso: ogni nodo diverso dalla sorgente ha un predecessore.`;
    if (nd === y) return `p(${y}) è il nodo da cui si arriva a ${y}, non ${y} stesso.`;
    if (nd === firstHop(S, y)) return `Hai messo il next-hop (il primo nodo dopo ${ex.src}). p(${y}) è l'ultimo nodo PRIMA di ${y} nel cammino minimo ${pth}: ${exp}.`;
    if (c.adj[y][nd] == null) return `p(${y}) deve essere un vicino di ${y}: ${nd} non è collegato a ${y}.`;
    if (S.prov[y].preds.includes(nd)) return `È un predecessore provvisorio: è stato sostituito quando un altro nodo è entrato in N' e ha offerto un cammino più corto (${pth}).`;
    return `Passando da ${nd}: D(${nd}) + c(${nd},${y}) = ${S.dist[nd]} + ${c.adj[y][nd]} = ${S.dist[nd] + c.adj[y][nd]}, più di ${S.dist[y]} (${pth}).`;
  }
  function diagnose(ex, key, value) {
    const v = String(value == null ? '' : value).trim();
    if (v === '') return null;
    const pk = parseKey(key);
    if (!pk) return null;
    if (pk.part === 'e') {
      const q = ex.qs[pk.i - 1];
      if (!q || v === q.ok) return null;
      const o = q.opts.find(x => x.v === v);
      return o && o.err ? o.err : null;
    }
    const c = calc(ex);
    if (pk.f === 'order') {
      const S = c.S, exp = S.order[pk.i - 1];
      const nd = parseNode(ex, v);
      if (!exp || nd === exp) return null;
      if (!nd || nd === '-') return 'Scegli il nome di un nodo.';
      const pos = S.order.indexOf(nd);
      if (pos < pk.i - 1) return `${nd} è già in N' (entrato ${pos === 0 ? 'all\'inizio, è la sorgente' : `al passo ${pos}`}).`;
      return `A ogni passo entra il nodo fuori da N' con D minimo: qui ${exp} (D = ${S.dist[exp]}). ${nd} ha D = ${S.dist[nd]}, entra dopo.`;
    }
    const all = pk.part === 'dj' ? srcOthers(ex) : c.others;
    if (!all.includes(pk.y)) return null;
    if (pk.f === 'cost') {
      const n = parseCost(v);
      if (Number.isNaN(n)) return 'Scrivi un numero intero oppure ∞ (vanno bene anche inf, infinito, oo, -).';
      return costDiag(ex, c, pk.part, pk.y, n);
    }
    const nd = parseNode(ex, v);
    if (nd === null) return `Scrivi il nome di un nodo (${ex.nodes.join(', ')}).`;
    return nodeDiag(ex, c, pk.part, pk.f, pk.y, nd);
  }

  function diagnoseCases(ex) {
    const c = calc(ex), X = ex.x, out = [];
    const o = c.others;
    const first = f => o.find(f);
    if (hasPart(ex, 'a')) {
      const y1 = first(y => c.A[y] === INF);
      if (y1) out.push({ key: `a.${y1}`, value: String(c.C[y1].cost), expect: 'non è vicino' });
      const y2 = first(y => c.A[y] < INF && c.C[y].cost < c.A[y]);
      if (y2) out.push({ key: `a.${y2}`, value: String(c.C[y2].cost), expect: 'link diretto' });
    }
    if (hasPart(ex, 'b')) {
      const y1 = first(y => c.B[y].cost < INF && c.B[y].cost !== c.C[y].cost);
      if (y1) out.push({ key: `b.${y1}.cost`, value: String(c.C[y1].cost), expect: 'una sola iterazione' });
      const y2 = first(y => c.B[y].cost === INF);
      if (y2) out.push({ key: `b.${y2}.cost`, value: String(c.C[y2].cost), expect: 'ancora ∞' });
      const y3 = first(y => {
        const B = c.B[y];
        if (B.cost === INF || B.nh === y) return false;
        const d = B.terms.find(t => t.v === B.nh).d;
        return d !== 0 && d !== B.cost && d !== c.C[y].cost && d !== c.A[y];
      });
      if (y3) out.push({ key: `b.${y3}.cost`, value: String(c.B[y3].terms.find(t => t.v === c.B[y3].nh).d), expect: 'costo del link' });
      const y4 = first(y => c.B[y].nh !== '-' && c.C[y].nh !== c.B[y].nh);
      if (y4) out.push({ key: `b.${y4}.nh`, value: c.C[y4].nh, expect: 'una sola iterazione' });
    }
    if (hasPart(ex, 'c')) {
      const y1 = first(y => c.dx.pred[y] !== c.C[y].nh && c.dx.pred[y] !== X);
      if (y1) out.push({ key: `c.${y1}.nh`, value: c.dx.pred[y1], expect: 'predecessore' });
      const y2 = first(y => c.A[y] < INF && c.A[y] > c.C[y].cost);
      if (y2) out.push({ key: `c.${y2}.cost`, value: String(c.A[y2]), expect: 'link diretto' });
    }
    if (hasPart(ex, 'd')) {
      const S = c.S, so = srcOthers(ex);
      const y1 = so.find(y => S.pred[y] !== ex.src && firstHop(S, y) !== S.pred[y]);
      if (y1) out.push({ key: `dj.${y1}.pred`, value: firstHop(S, y1), expect: 'next-hop' });
      const y2 = so.find(y => S.prov[y].costs.some(n => n !== S.dist[y] && n !== c.adj[ex.src][y]));
      if (y2) out.push({ key: `dj.${y2}.cost`, value: String(S.prov[y2].costs.find(n => n !== S.dist[y2] && n !== c.adj[ex.src][y2])), expect: 'provvisorio' });
      out.push({ key: 'dj.order2', value: S.order[S.order.length - 1], expect: 'D minimo' });
    }
    ex.qs.forEach((q, i) => {
      const w = q.opts.find(x => x.v !== q.ok && x.err);
      if (w) out.push({ key: `e${i + 1}`, value: w.v, expect: w.err.slice(0, 30) });
    });
    return out;
  }

  // ---------------- aiuti ----------------
  function fieldHint(ex, key) {
    const pk = parseKey(key);
    const X = ex.x;
    if (!pk) return 'Rileggi il testo della domanda.';
    if (pk.part === 'e') { const q = ex.qs[pk.i - 1]; return q ? q.hint : 'Rileggi la domanda.'; }
    if (pk.f === 'order') return `Al passo ${pk.i - 1} entra in N' il nodo, fra quelli non ancora in N', con il D provvisorio più piccolo.`;
    const y = pk.y;
    if (pk.part === 'a') return `${y} è collegato direttamente a ${X}? Se sì, il costo del link; se no, ∞.`;
    if (pk.part === 'b') return pk.f === 'cost'
      ? `Per ogni vicino v di ${X}: c(${X},v) + dv(${y}) con il vettore INIZIALE di v (solo i suoi link diretti). Prendi il minimo.`
      : `Il vicino che dà il minimo nella somma per ${y}; se il minimo è ∞, nessun next-hop.`;
    if (pk.part === 'c') return pk.f === 'cost'
      ? `Cerca sul grafo il cammino più economico da ${X} a ${y}, anche con più di due link.`
      : `Il primo nodo dopo ${X} lungo il cammino minimo verso ${y} (un vicino di ${X}).`;
    return pk.f === 'cost'
      ? `D(${y}) è definitivo quando ${y} entra in N': segui gli aggiornamenti D(${y}) = min(D(${y}), D(w) + c(w,${y})).`
      : `p(${y}) è il nodo w dell'ultimo aggiornamento di D(${y}): l'ultimo nodo prima di ${y}.`;
  }

  const vecTxt = (ex, f) => ex.nodes.map(y => `${y}=${fmt(f(y))}`).join(', ');
  function djLines(ex, c) {
    const S = c.S, so = srcOthers(ex);
    return S.rows.slice(0, -1).map((r, i) => {
      const next = S.rows[i + 1].inN[S.rows[i + 1].inN.length - 1];
      const vals = so.filter(v => !r.inN.includes(v)).map(v => `${v}: ${fmt(r.D[v])}${r.P[v] ? ',' + r.P[v] : ''}`).join('; ');
      return `Passo ${i}: N' = {${r.inN.join(',')}} · ${vals} → entra ${next}`;
    });
  }
  function hints(ex) {
    const c = calc(ex), X = ex.x, H = [];
    const nbTxt = c.nb.map(v => `${v} (link ${c.adj[X][v]})`).join(', ');
    if (hasPart(ex, 'a')) H.push({
      step: 'a', title: STEP_TITLE.a,
      metodo: 'All\'inizio un nodo conosce solo i costi dei suoi link: d(Y) = costo del link se Y è un vicino, ∞ se non lo è, 0 verso sé stesso.',
      applicato: `I vicini di ${X} sono ${nbTxt}. Gli altri nodi${c.others.filter(y => c.A[y] === INF).length ? ` (${c.others.filter(y => c.A[y] === INF).join(', ')})` : ''} non sono collegati direttamente.`,
      svolto: `DV iniziale di ${X}: ${vecTxt(ex, y => y === X ? 0 : c.A[y])}.`
    });
    if (hasPart(ex, 'b')) H.push({
      step: 'b', title: STEP_TITLE.b,
      metodo: 'Bellman-Ford una volta: per ogni destinazione Y, dX(Y) = min sui vicini v di { c(X,v) + dv(Y) }, usando i vettori INIZIALI dei vicini (solo i loro link diretti). Il next-hop è il vicino che dà il minimo. Così si vedono solo i cammini di al massimo 2 link.',
      applicato: `Vettori iniziali dei vicini di ${X}: ` + c.nb.map(v => `d${v} = [${vecTxt(ex, y => c.d0(v, y))}]`).join(' · ') + `. A ogni valore aggiungi il costo del link da ${X} a quel vicino.`,
      svolto: c.others.map(y => `d${X}(${y}) = ${minTxt(c.B[y].terms)} = ${fmt(c.B[y].cost)}${c.B[y].nh !== '-' ? ' via ' + c.B[y].nh : ''}`).join('\n')
    });
    if (hasPart(ex, 'c')) H.push({
      step: 'c', title: STEP_TITLE.c,
      metodo: 'A convergenza il DV contiene i costi dei cammini minimi. Stessa formula, ma con i vettori FINALI dei vicini; oppure cerca sul grafo il cammino più economico. Next-hop = primo nodo del cammino dopo X.',
      applicato: `Vettori finali dei vicini: ` + c.nb.map(v => `D${v} = [${vecTxt(ex, y => c.D(v).dist[y])}]`).join(' · ') + '.',
      svolto: c.others.map(y => `d${X}(${y}) = ${minTxt(c.C[y].terms)} = ${c.C[y].cost} via ${c.C[y].nh} (cammino ${pathTxt(c.C[y].path)})`).join('\n')
    });
    if (hasPart(ex, 'd')) H.push({
      step: 'd', title: STEP_TITLE.d,
      metodo: 'Dijkstra: N\' = {sorgente}; D(v) = costo del link dalla sorgente (∞ se non è vicina), p(v) = sorgente. A ogni passo entra in N\' il nodo w con D minimo fra quelli fuori; per ogni vicino v di w fuori da N\': se D(w) + c(w,v) < D(v), allora D(v) = D(w) + c(w,v) e p(v) = w.',
      applicato: `Parti da N' = {${ex.src}}: ` + srcOthers(ex).map(v => `D(${v}) = ${fmt(c.adj[ex.src][v] != null ? c.adj[ex.src][v] : INF)}`).join(', ') + '. Il primo a entrare è quello con D più piccolo; poi aggiorna i suoi vicini.',
      svolto: djLines(ex, c).join('\n') + `\nOrdine: ${c.S.order.join(', ')}. ` + srcOthers(ex).map(v => `D(${v}) = ${c.S.dist[v]}, p(${v}) = ${c.S.pred[v]}`).join(' · ')
    });
    if (ex.qs.length) H.push({
      step: 'e', title: STEP_TITLE.e,
      metodo: 'Poisoned reverse: se Z raggiunge D passando da Y, annuncia a Y distanza ∞ verso D (solo a Y). Le buone notizie (costo che scende) viaggiano in fretta, le cattive (costo che sale) possono dare count to infinity. LS = mappa completa e Dijkstra (OSPF); DV = vicini e Bellman-Ford (RIP).',
      applicato: ex.qs.map((q, i) => `${i + 1}. ${q.hint}`).join('\n'),
      svolto: ex.qs.map((q, i) => `${i + 1}. ${q.opts.find(o => o.v === q.ok).t} — ${q.why}`).join('\n')
    });
    return H;
  }

  // ---------------- figura ----------------
  function figure(ex) {
    const lay = LAYOUT[ex.nodes.length];
    const P = {};
    ex.place.forEach((nm, i) => { P[nm] = lay.pos[i]; });
    const L = [];
    L.push(`<svg viewBox="0 0 540 280" class="fig" role="img" aria-label="Grafo dei router: ${ex.edges.map(([u, v, c]) => `${u}-${v} costo ${c}`).join(', ')}">`);
    ex.edges.forEach(([u, v]) => {
      L.push(`<line x1="${P[u][0]}" y1="${P[u][1]}" x2="${P[v][0]}" y2="${P[v][1]}" class="link"/>`);
    });
    ex.edges.forEach(([u, v, c]) => {
      const mx = (P[u][0] + P[v][0]) / 2, my = (P[u][1] + P[v][1]) / 2;
      L.push(`<rect x="${mx - 11}" y="${my - 10}" width="22" height="20" rx="4" class="box"/>`);
      L.push(`<text x="${mx}" y="${my + 4}" text-anchor="middle" class="lbl b">${c}</text>`);
    });
    ex.nodes.forEach(nm => {
      const [x, y] = P[nm];
      const me = nm === ex.x;
      L.push(`<circle cx="${x}" cy="${y}" r="20" class="box${me ? ' router' : ''}"/>`);
      L.push(`<text x="${x}" y="${y + 5}" text-anchor="middle" class="lbl ${me ? 'w' : 'b'}">${nm}</text>`);
    });
    L.push('</svg>');
    return L.join('');
  }

  // ---------------- testo ----------------
  function introText(ex) {
    return `Una rete di ${ex.nodes.length} router (${ex.nodes.join(', ')}) è collegata come in figura; il numero su ogni link è il suo costo, uguale nei due versi. ` +
      `I router usano un algoritmo distance vector (Bellman-Ford): ogni nodo conosce i costi dei propri link e riceve i vettori distanza dei vicini. Si studia il nodo ${ex.x}.`;
  }
  const PART_TXT = {
    a: ex => `a) Scrivere il distance vector iniziale del nodo ${ex.x}.`,
    b: ex => `b) ${ex.x} riceve una volta i vettori iniziali dei suoi vicini. Scrivere il nuovo distance vector di ${ex.x} con il next-hop scelto.`,
    c: ex => `c) Scrivere il distance vector finale di ${ex.x} (a convergenza) con il next-hop.`,
    d: ex => `d) Applicare Dijkstra dal nodo ${ex.src}: per ogni nodo il costo minimo D(v) e il predecessore p(v), e l'ordine in cui i nodi entrano in N'.`,
    e: () => 'e) Rispondere alle domande.'
  };
  const linksTxt = ex => ex.edges.map(([u, v, c]) => `${u}-${v} ${c}`).join(', ');

  function render(ex, root, ctx) {
    const X = ex.x;
    const o = ex.nodes.filter(n => n !== X);
    const nodeOpts = list => list.map(n => [n, n]);
    root.appendChild(U.h('div', { class: 'card intro' },
      U.h('p', {}, U.h('b', {}, 'Testo. '), introText(ex)),
      U.fig(figure(ex), `Il nodo ${X} è evidenziato. Costi dei link: ${linksTxt(ex)}.`)));
    if (hasPart(ex, 'a')) {
      root.appendChild(U.card(PART_TXT.a(ex), { step: 'a' },
        U.table([''].concat(ex.nodes), [[U.label(`d${X}`)].concat(ex.nodes.map(y => y === X ? U.given('0') : U.inp(ctx, `a.${y}`, { w: 'xs', label: `DV iniziale di ${X} verso ${y}` })))]),
        U.h('p', { class: 'small' }, 'Per l\'infinito scrivi ∞ (va bene anche inf).')));
    }
    const vecCard = (p, title) => U.card(title, { step: p },
      U.table([''].concat(ex.nodes), [
        [U.label(`d${X} (costo)`)].concat(ex.nodes.map(y => y === X ? U.given('0') : U.inp(ctx, `${p}.${y}.cost`, { w: 'xs', label: `parte ${p}, costo verso ${y}` }))),
        [U.label('next-hop')].concat(ex.nodes.map(y => y === X ? U.given('—') : U.sel(ctx, `${p}.${y}.nh`,
          (p === 'b' ? [['-', '— (∞)']] : []).concat(nodeOpts(o)), { w: 's', ph: '?', label: `parte ${p}, next-hop verso ${y}` })))
      ]));
    if (hasPart(ex, 'b')) root.appendChild(vecCard('b', PART_TXT.b(ex)));
    if (hasPart(ex, 'c')) root.appendChild(vecCard('c', PART_TXT.c(ex)));
    if (hasPart(ex, 'd')) {
      const so = srcOthers(ex);
      root.appendChild(U.card(PART_TXT.d(ex), { step: 'd' },
        U.table(['Nodo v'].concat(so), [
          [U.label('D(v)')].concat(so.map(y => U.inp(ctx, `dj.${y}.cost`, { w: 'xs', label: `Dijkstra, D(${y})` }))),
          [U.label('p(v)')].concat(so.map(y => U.sel(ctx, `dj.${y}.pred`, nodeOpts(ex.nodes), { w: 's', ph: '?', label: `Dijkstra, p(${y})` })))
        ]),
        U.table(['Ordine di ingresso in N\''].concat(ex.nodes.map((_, i) => `${i + 1}°`)), [
          [U.label('nodo')].concat(ex.nodes.map((_, i) => i === 0 ? U.given(ex.src) : U.sel(ctx, `dj.order${i + 1}`, nodeOpts(srcOthers(ex)), { w: 's', ph: '?', label: `Dijkstra, nodo ${i + 1}° in N'` })))
        ])));
    }
    if (ex.qs.length) {
      root.appendChild(U.card(PART_TXT.e(ex), { step: 'e' },
        ex.qs.map((q, i) => U.h('div', { class: 'q-item' },
          U.h('div', { class: 'q-text' }, `${i + 1}. ${q.q}`),
          U.sel(ctx, `e${i + 1}`, q.opts.map(x => [x.v, x.t]), { label: `domanda ${i + 1}` })))));
    }
  }

  function solution(ex, root) {
    const c = calc(ex), X = ex.x;
    const kids = [
      U.h('h4', {}, 'Soluzione'),
      U.h('p', { class: 'sol-body' }, `Link: ${linksTxt(ex)}. Vicini di ${X}: ${c.nb.map(v => `${v} (${c.adj[X][v]})`).join(', ')}.`)
    ];
    if (hasPart(ex, 'a')) {
      kids.push(U.h('p', { class: 'sol-body' }, U.h('b', {}, 'a) '), 'Solo i link diretti: costo del link verso i vicini, ∞ verso gli altri.'),
        U.table([''].concat(ex.nodes), [[U.label(`d${X}`)].concat(ex.nodes.map(y => y === X ? '0' : fmt(c.A[y])))]));
    }
    const termRows = (R, fin) => c.others.map(y => [U.label(y), R[y].terms.map(t => termTxt(X, y, t, fin)).join(' · '), fmt(R[y].cost), R[y].nh === '-' ? '—' : R[y].nh]);
    if (hasPart(ex, 'b')) {
      kids.push(U.h('p', { class: 'sol-body' }, U.h('b', {}, 'b) '), `Una sola applicazione di Bellman-Ford con i vettori iniziali dei vicini: ` +
        c.nb.map(v => `d${v} = [${vecTxt(ex, y => c.d0(v, y))}]`).join(' · ') + '.'),
      U.table(['Destinazione', 'Termini c(X,v) + dv(Y)', `d${X}`, 'Next-hop'], termRows(c.B, false)));
      const diff = c.others.filter(y => c.B[y].cost !== c.C[y].cost);
      if (diff.length) kids.push(U.h('p', { class: 'small' }, `Attenzione: ${diff.join(', ')} ${diff.length > 1 ? 'hanno' : 'ha'} un cammino minimo con più di 2 link, che dopo una sola iterazione non si vede ancora (il valore cambia nella parte c).`));
    }
    if (hasPart(ex, 'c')) {
      kids.push(U.h('p', { class: 'sol-body' }, U.h('b', {}, 'c) '), 'A convergenza i vettori dei vicini sono i loro cammini minimi: ' +
        c.nb.map(v => `D${v} = [${vecTxt(ex, y => c.D(v).dist[y])}]`).join(' · ') + '.'),
      U.table(['Destinazione', 'Termini c(X,v) + Dv(Y)', `d${X}`, 'Next-hop', 'Cammino'],
        termRows(c.C, true).map((r, i) => r.concat(pathTxt(c.C[c.others[i]].path)))));
    }
    if (hasPart(ex, 'd')) {
      const S = c.S, so = srcOthers(ex);
      kids.push(U.h('p', { class: 'sol-body' }, U.h('b', {}, 'd) '), `Dijkstra da ${ex.src}. In ogni riga: D(v), p(v) per i nodi ancora fuori da N'; ▸ indica il nodo con D minimo, che entra al passo dopo.`),
        U.table(['Passo', 'N\''].concat(so.map(v => `D(${v}), p(${v})`)), S.rows.slice(0, -1).map((r, i) => {
          const next = S.rows[i + 1].inN[S.rows[i + 1].inN.length - 1];
          return [U.label(String(i)), `{${r.inN.join(',')}}`].concat(so.map(v => r.inN.includes(v) ? '' : `${fmt(r.D[v])}${r.P[v] ? ', ' + r.P[v] : ''}${v === next ? ' ▸' : ''}`));
        })),
        U.table(['Nodo', 'D(v)', 'p(v)', 'Cammino', 'Next-hop'], so.map(v => [U.label(v), String(S.dist[v]), S.pred[v], pathTxt(pathOf(S, v)), firstHop(S, v)])),
        U.h('p', { class: 'sol-body' }, `Ordine di ingresso in N': ${S.order.join(', ')}. Il predecessore è l'ultimo nodo prima di v; il next-hop (per la tabella di inoltro) è il primo dopo ${ex.src}: coincidono solo per i cammini di 1 o 2 link.`));
    }
    if (ex.qs.length) {
      kids.push(U.h('p', { class: 'sol-body' }, U.h('b', {}, 'e) ')));
      ex.qs.forEach((q, i) => kids.push(U.h('div', { class: 'q-item' },
        U.h('div', { class: 'q-text' }, `${i + 1}. ${q.q}`),
        U.h('p', { class: 'sol-body' }, U.h('b', {}, q.opts.find(o => o.v === q.ok).t + '. '), q.why),
        U.h('p', { class: 'small' }, 'Le altre: ' + q.opts.filter(o => o.v !== q.ok).map(o => `${o.t}: ${o.err}`).join(' · ')))));
    }
    root.appendChild(U.h('div', { class: 'card sol' }, kids));
  }

  function chatText(ex, a) {
    const v = k => (a && String(a[k] == null ? '' : a[k]).trim()) || '__';
    const X = ex.x, o = ex.nodes.filter(n => n !== X);
    const L = [];
    L.push(`#3 · Routing: Distance Vector e Dijkstra (livello ${ex.level})`);
    L.push('## Testo');
    L.push(introText(ex));
    L.push(`Link (costi): ${linksTxt(ex)}.`);
    'abcd'.split('').forEach(p => { if (hasPart(ex, p)) L.push(PART_TXT[p](ex)); });
    if (ex.qs.length) {
      L.push(PART_TXT.e(ex));
      ex.qs.forEach((q, i) => L.push(`${i + 1}. ${q.q} Opzioni: ${q.opts.map(x => x.t).join(' | ')}`));
    }
    L.push('');
    L.push('## Le mie risposte');
    if (hasPart(ex, 'a')) L.push(`- a) d${X}: ${X}=0, ${o.map(y => `${y}=${v(`a.${y}`)}`).join(', ')}`);
    ['b', 'c'].forEach(p => {
      if (hasPart(ex, p)) L.push(`- ${p}) d${X}: ${o.map(y => `${y}=${v(`${p}.${y}.cost`)} via ${v(`${p}.${y}.nh`)}`).join(', ')}`);
    });
    if (hasPart(ex, 'd')) {
      L.push(`- d) ${srcOthers(ex).map(y => `D(${y})=${v(`dj.${y}.cost`)} p(${y})=${v(`dj.${y}.pred`)}`).join(', ')}`);
      L.push(`- d) ordine in N': ${ex.src}, ${ex.nodes.slice(1).map((_, i) => v(`dj.order${i + 2}`)).join(', ')}`);
    }
    ex.qs.forEach((q, i) => {
      const ch = q.opts.find(x => a && x.v === a[`e${i + 1}`]);
      L.push(`- e${i + 1}) ${ch ? ch.t : '__'}`);
    });
    return L.join('\n');
  }

  // ---------------- tracce ----------------
  const SIM = {
    level: 5, nodes: ['A', 'B', 'C', 'D'], place: ['A', 'B', 'C', 'D'],
    edges: [['A', 'B', 1], ['A', 'C', 4], ['B', 'C', 2], ['B', 'D', 6], ['C', 'D', 1]],
    x: 'A', src: 'A', parts: 'abcde',
    qs: [{ t: 'pr', to: 'B', dest: 'D', poison: true, rk: [0, 1, 2, 3, 4, 5] }, { t: 'g', id: 'cti', rk: [1, 0, 3, 2] }]
  };
  const GUIDA = {
    level: 2, nodes: ['x', 'y', 'z'], place: ['x', 'y', 'z'],
    edges: [['x', 'y', 2], ['x', 'z', 7], ['y', 'z', 1]],
    x: 'x', src: 'x', parts: 'abc', qs: []
  };

  RA.dv = {
    id: 'dv', num: '3', name: 'Routing: Distance Vector e Dijkstra', part: 2, examPoints: 6, extra: false,
    desc: 'Distance vector iniziale, dopo un\'iterazione e finale con next-hop; Dijkstra; poisoned reverse, LS vs DV, OSPF.',
    method: {
      intro: 'Due algoritmi per lo stesso problema, il cammino minimo. Distance vector (Bellman-Ford): ogni nodo conosce solo i vicini e i loro vettori, e migliora la stima a ogni scambio. Link state (Dijkstra): ogni nodo ha la mappa completa e calcola tutto da solo.',
      steps: [
        'DV iniziale: costo del link diretto verso i vicini, ∞ verso gli altri, 0 verso sé stesso.',
        'Una iterazione: per ogni destinazione Y, dX(Y) = min sui vicini v di { c(X,v) + dv(Y) } con i vettori ricevuti. Scrivi tutti i termini, poi prendi il minimo: il vicino che lo dà è il next-hop.',
        'DV finale: stessa formula con i vettori finali dei vicini, cioè i cammini minimi. Controlla sul grafo cercando il cammino più economico.',
        'Dijkstra: N\' = {sorgente}; D(v) = costo del link (∞ se non vicino), p(v) = sorgente. A ogni passo entra in N\' il nodo con D minimo; per i suoi vicini fuori da N\', se D(w) + c(w,v) < D(v) aggiorna D(v) e metti p(v) = w.',
        'Domande: chiediti cosa sa ogni nodo (solo i vicini o tutta la mappa) e verso chi va il messaggio.'
      ],
      traps: [
        'Dopo UNA iterazione si vedono solo i cammini di al massimo 2 link: un nodo più lontano resta ∞, e un cammino minimo di 3 link non si vede ancora.',
        'Nella somma c(X,v) + dv(Y) non dimenticare il costo del link verso il vicino.',
        'Next-hop ≠ predecessore: il next-hop è il primo nodo dopo la sorgente (va nella tabella di inoltro), p(v) è l\'ultimo prima di v (serve a Dijkstra per ricostruire il cammino).',
        'Il link diretto non è sempre il cammino migliore.',
        'Poisoned reverse: se Z raggiunge D passando da Y, annuncia ∞ verso D solo a Y; agli altri vicini annuncia il costo vero.'
      ],
      formulas: [
        ['Bellman-Ford', 'dx(y) = min_v { c(x,v) + dv(y) }'],
        ['Dijkstra', 'D(v) = min( D(v), D(w) + c(w,v) ) per il nodo w appena entrato in N\''],
        ['Poisoned reverse', 'Z annuncia a Y: dZ(D) = ∞ se il next-hop di Z verso D è Y'],
        ['Notizie', 'costo che scende: poche iterazioni · costo che sale: count to infinity'],
        ['OSPF', 'link state · Hello, LSA in flooding, LSDB, Dijkstra · aree con backbone (area 0)'],
        ['RIP · BGP', 'RIP: distance vector, metrica hop · BGP: inter-AS, path vector, TCP']
      ]
    },
    traces: [
      {
        id: 'sim-dv', set: 'simulato',
        title: 'Esame simulato · Distance Vector (A, B, C, D)',
        source: 'Esame_Simulato_2_TESTO.pdf, esercizio 3',
        params: SIM,
        expect: {
          'a.B': '1', 'a.C': '4', 'a.D': '∞',
          'b.B.cost': '1', 'b.B.nh': 'B', 'b.C.cost': '3', 'b.C.nh': 'B', 'b.D.cost': '5', 'b.D.nh': 'C',
          'c.B.cost': '1', 'c.B.nh': 'B', 'c.C.cost': '3', 'c.C.nh': 'B', 'c.D.cost': '4', 'c.D.nh': 'B',
          'dj.B.cost': '1', 'dj.B.pred': 'A', 'dj.C.cost': '3', 'dj.C.pred': 'B', 'dj.D.cost': '4', 'dj.D.pred': 'C',
          'dj.order2': 'B', 'dj.order3': 'C', 'dj.order4': 'D',
          e1: '∞', e2: 'loop'
        }
      },
      {
        id: 'guida3-dv',
        title: 'Guida 3 · Distance Vector (x, y, z)',
        source: 'Guida_3_Routing_DV_Dijkstra.pdf',
        params: GUIDA,
        expect: {
          'a.y': '2', 'a.z': '7',
          'b.y.cost': '2', 'b.y.nh': 'y', 'b.z.cost': '3', 'b.z.nh': 'y',
          'c.y.cost': '2', 'c.y.nh': 'y', 'c.z.cost': '3', 'c.z.nh': 'y'
        }
      }
    ],
    randomParams, build, gen, steps, grade, sol2answers, render, solution, hints, fieldHint, diagnose, diagnoseCases, chatText
  };
})();
