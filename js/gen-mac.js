// ============================================================
// RetiApp · gen-mac.js — Esercizio 6 · Accesso multiplo e rilevazione errori
// CRC, parità, CSMA/CD (backoff ed efficienza), ALOHA, CSMA/CD vs CSMA/CA
// Contratto dei moduli: vedi docs/moduli.md (modello: gen-nat.js)
// ============================================================
(function () {
  const RA = window.RetiApp;
  const U = RA.util;

  // ---------------- dati fissi ----------------
  const GEN = {
    3: ['1001', '1011', '1101', '1111'],
    4: ['10011', '11001', '10101', '10111', '11111'],
    5: ['100101', '110101', '101001', '111011']
  };
  const ORD = ['', 'prima', 'seconda', 'terza', 'quarta', 'quinta', 'sesta', 'settima', 'ottava', 'nona', 'decima',
    'undicesima', 'dodicesima', 'tredicesima', 'quattordicesima', 'quindicesima'];
  const LETTERS = ['a', 'b', 'c', 'd'];
  const V_PROP = 2e8; // m/s
  const STEP_TITLE = {
    crc: 'CRC', par: 'Bit di parità', bo: 'CSMA/CD: backoff esponenziale binario',
    eff: 'CSMA/CD: efficienza', alo: 'ALOHA', q: 'CSMA/CD e CSMA/CA'
  };

  // domande chiuse: la prima opzione è quella giusta, ogni sbagliata ha il suo perché
  const Q = (id, q, hint, why, ...opts) => ({ id, q, hint, why, opts: opts.map(([t, err]) => ({ t, err })) });
  const BANK = [
    Q('nocd', 'Perché 802.11 (Wi-Fi) non usa la collision detection come Ethernet?',
      'Pensa a cosa riesce a sentire una radio mentre trasmette, e a due stazioni che non si vedono.',
      'Una radio non può ascoltare mentre trasmette: il proprio segnale è molto più forte di quelli in arrivo. E anche potendo, con il terminale nascosto e l\'attenuazione alcune collisioni avvengono solo al ricevitore.',
      ['Una stazione non può ascoltare mentre trasmette e, per terminale nascosto e attenuazione, molte collisioni non si sentirebbero comunque', ''],
      ['Perché nel wireless le collisioni non avvengono mai', 'Le collisioni avvengono eccome: il canale radio è condiviso. Il problema è che non si riescono a rilevare.'],
      ['Perché il Wi-Fi è full-duplex e i due versi non si disturbano', 'Una radio 802.11 è half-duplex: trasmette o riceve, non tutte e due insieme. Proprio per questo non può ascoltare mentre trasmette.'],
      ['Perché la collision detection funziona solo con frame più corti di 64 byte', 'Il limite dei 64 byte serve a Ethernet per accorgersi della collisione prima di finire il frame; non spiega perché in radio non si rileva.']),
    Q('rtscts', 'A cosa serve lo scambio RTS/CTS in 802.11?',
      'Chi sente il CTS? Anche le stazioni che non sentono il mittente?',
      'L\'RTS chiede il canale, il CTS dell\'AP lo concede: tutti i vicini dell\'AP sentono il CTS (anche quelli nascosti al mittente) e rimandano le loro trasmissioni. Le collisioni restano possibili solo sui brevi RTS.',
      ['A prenotare il canale: il CTS lo sentono tutti i vicini dell\'AP, anche quelli nascosti al mittente, che rimandano le trasmissioni', ''],
      ['A rilevare le collisioni mentre si trasmettono i dati', 'RTS/CTS le evita prima (collision avoidance). Il rilevamento durante la trasmissione è di CSMA/CD.'],
      ['A confermare che il frame dati è arrivato integro', 'Quello è l\'ACK, che arriva dopo i dati. RTS/CTS viene prima, per riservare il canale.'],
      ['A cifrare il frame dati prima dell\'invio', 'RTS e CTS sono brevi frame di controllo, non c\'entrano con la cifratura.']),
    Q('ack', 'Perché 802.11 usa un ACK a livello link, che Ethernet non ha?',
      'Come fa il mittente wireless a sapere che il frame non è finito in una collisione?',
      'In radio il mittente non può accorgersi della collisione: l\'unico modo di sapere che il frame è arrivato è l\'ACK del ricevente. Se l\'ACK non arriva entro il timeout, ritrasmette.',
      ['Perché il mittente non può rilevare la collisione: se l\'ACK non arriva entro il timeout ritrasmette', ''],
      ['Per sostituire l\'ACK di TCP, che in Wi-Fi non si usa', 'TCP continua a usare i suoi ACK end-to-end; l\'ACK 802.11 vale solo sul singolo collegamento radio.'],
      ['Perché lo usa anche Ethernet, per lo stesso motivo', 'Ethernet (CSMA/CD) non ha ACK di livello link: la collisione la rileva da sé ascoltando il cavo mentre trasmette.'],
      ['Per annunciare la presenza dell\'AP alle nuove stazioni', 'Quello è il beacon frame, con SSID e MAC dell\'AP.']),
    Q('difs', 'Cosa sono DIFS e SIFS in 802.11?',
      'Sono frame o intervalli di tempo? Quale dei due è più corto, e chi deve passare per primo?',
      'Sono attese a canale libero: DIFS prima di trasmettere (o di contare il backoff), SIFS, più corto, prima di ACK e CTS. Così le risposte passano prima di qualunque nuova trasmissione.',
      ['Attese a canale libero: DIFS prima di trasmettere, SIFS (più corto) prima di ACK e CTS, che così hanno la precedenza', ''],
      ['Due tipi di frame di controllo, come RTS e CTS', 'Non sono frame: sono intervalli di tempo in cui il canale deve restare libero.'],
      ['Attese in cui SIFS è più lungo di DIFS, per dare tempo al ricevente', 'È il contrario: SIFS è più corto, così ACK e CTS passano prima di chiunque altro.'],
      ['I tempi di backoff scelti dopo una collisione rilevata', 'Il backoff è casuale e si conta a slot; DIFS e SIFS sono fissi. E in 802.11 la collisione non si rileva.']),
    Q('bofree', 'In CSMA/CA, una stazione trova il canale occupato. Quando si libera, perché non trasmette subito?',
      'Chi altro stava aspettando che il canale si liberasse?',
      'Tutte le stazioni in attesa vedono il canale liberarsi nello stesso istante: se trasmettessero subito collidrebbero di sicuro. Il backoff casuale (contato solo a canale libero) le distanzia.',
      ['Perché anche le altre stazioni in attesa lo trovano libero nello stesso istante: il backoff casuale evita che partano insieme', ''],
      ['Per risparmiare batteria', 'Il backoff serve a ridurre le collisioni, non a risparmiare energia.'],
      ['Perché deve prima ricevere l\'ACK del frame precedente di un\'altra stazione', 'L\'ACK riguarda solo chi ha trasmesso il frame. L\'attesa serve a non partire insieme alle altre stazioni in coda.'],
      ['Non è vero: in CSMA/CA a canale libero si trasmette sempre subito', 'Subito (dopo un DIFS) solo se il canale era libero fin dall\'inizio. Se era occupato si fa il backoff, perché anche gli altri stanno aspettando.']),
    Q('where', 'Dove si usano CSMA/CD e CSMA/CA?',
      'La collision detection richiede di ascoltare il canale mentre si trasmette: dove è possibile?',
      'CSMA/CD nell\'Ethernet cablata half-duplex (cavo condiviso o hub), dove si può ascoltare il cavo mentre si trasmette. CSMA/CA nelle LAN wireless 802.11, dove la collisione non si rileva e si cerca di evitarla.',
      ['CSMA/CD nell\'Ethernet cablata half-duplex (bus o hub); CSMA/CA nelle LAN wireless 802.11', ''],
      ['CSMA/CD nel Wi-Fi, CSMA/CA nell\'Ethernet', 'Invertiti: la collision detection richiede di ascoltare mentre si trasmette, possibile sul cavo ma non in radio.'],
      ['Tutti e due nel Wi-Fi: CD vicino all\'AP, CA lontano', '802.11 usa sempre CSMA/CA: nemmeno vicino all\'AP una radio può ascoltare mentre trasmette.'],
      ['CSMA/CD nelle reti cellulari, CSMA/CA sui collegamenti punto-punto', 'Le reti cellulari usano suddivisione del canale (es. CDMA, TDMA); un punto-punto full-duplex non ha bisogno di accesso multiplo.']),
    Q('switch', 'In una LAN Ethernet con switch e collegamenti full-duplex, CSMA/CD…',
      'Su un collegamento punto-punto full-duplex, con chi potrebbe collidere un frame?',
      'Con lo switch ogni collegamento è punto-punto e full-duplex (due versi separati): non c\'è nessun mezzo condiviso, quindi nessuna collisione. CSMA/CD serve solo su mezzo condiviso half-duplex.',
      ['Non serve: ogni collegamento è punto-punto con i due versi separati, quindi non ci sono collisioni', ''],
      ['Serve ancora di più, perché lo switch inoltra tutto in broadcast', 'Lo switch inoltra in modo selettivo (tabella di commutazione) e ogni porta è un dominio di collisione a sé.'],
      ['Viene sostituito da CSMA/CA', 'CSMA/CA è del wireless. Sul cavo full-duplex non serve nessun accesso multiplo.'],
      ['Serve solo per i frame broadcast', 'Anche i broadcast viaggiano su collegamenti punto-punto full-duplex: nessuna collisione.']),
    Q('hidden', 'Terminale nascosto: A e C trasmettono a B, ma A e C non si sentono. Cosa succede?',
      'A e C fanno carrier sense: cosa sentono?',
      'A e C trovano il canale libero (non si sentono), trasmettono insieme e i segnali si sovrappongono in B. Né A né C se ne accorgono: per questo servono ACK e RTS/CTS.',
      ['Il carrier sense non aiuta: A e C trovano il canale libero, trasmettono insieme e i frame collidono in B', ''],
      ['A e C si accorgono della collisione e mandano un segnale di jam', 'Non si sentono: non possono rilevare niente. Per questo in 802.11 servono ACK e RTS/CTS.'],
      ['B riceve il segnale più forte e scarta l\'altro senza problemi', 'Di solito i due segnali si sovrappongono e B non decodifica nessuno dei due.'],
      ['Non succede nulla: l\'AP assegna a ciascuno il suo slot di tempo', 'L\'accesso di 802.11 è casuale (CSMA/CA), non a slot assegnati come TDMA.']),
    Q('jam', 'In CSMA/CD, cosa fa un adattatore che rileva una collisione?',
      'Conviene finire il frame? E se riprovasse subito, cosa farebbe l\'altro nodo?',
      'Interrompe subito (inutile sprecare il canale), manda il jam perché tutti si accorgano della collisione, poi aspetta K·512 tempi di bit con K casuale (backoff esponenziale binario).',
      ['Interrompe la trasmissione, invia un segnale di jam e attende un backoff esponenziale binario prima di riprovare', ''],
      ['Completa il frame e aspetta l\'ACK del destinatario', 'Continuare è proprio lo spreco che la CD evita: interrompe subito. Ed Ethernet non ha ACK di livello link.'],
      ['Ritrasmette subito il frame', 'Anche l\'altro nodo farebbe lo stesso e ricollidebbero: serve un\'attesa casuale.'],
      ['Attende sempre 512 tempi di bit e riprova', 'L\'attesa è K·512 tempi di bit con K casuale: se fosse fissa i due nodi ricollidebbero.']),
    Q('bexp', 'Perché nel backoff di CSMA/CD l\'intervallo di K raddoppia a ogni collisione?',
      'Cosa indicano tante collisioni di fila sul carico della rete?',
      'Molte collisioni di fila indicano molti nodi in gara: raddoppiando l\'intervallo diminuisce la probabilità che due nodi scelgano lo stesso K. Con pochi nodi l\'attesa resta breve.',
      ['Più collisioni indicano più nodi in gara: con un intervallo più largo è meno probabile scegliere lo stesso K', ''],
      ['Per punire il nodo che ha causato la collisione', 'Tutti i nodi coinvolti fanno lo stesso backoff: non c\'è un colpevole.'],
      ['Per rendere l\'attesa prevedibile dagli altri nodi', 'K è casuale proprio perché i nodi NON scelgano la stessa attesa.'],
      ['Per sincronizzare i nodi sugli slot, come in slotted ALOHA', 'CSMA/CD non richiede sincronizzazione: è uno dei suoi vantaggi rispetto a slotted ALOHA.']),
    Q('effq', 'Quando l\'efficienza di CSMA/CD tende a 1?',
      'Guarda la formula 1/(1 + 5·tprop/ttrans): cosa deve fare il rapporto?',
      'L\'efficienza è 1/(1 + 5·tprop/ttrans): tende a 1 quando tprop → 0 (cavi corti) o ttrans → ∞ (frame lunghi).',
      ['Quando tprop → 0 o ttrans → ∞ (cavi corti, frame lunghi)', ''],
      ['Quando cresce il bitrate, a parità di frame e cavo', 'Con un bitrate più alto ttrans diminuisce: a = tprop/ttrans cresce e l\'efficienza scende.'],
      ['Quando il cavo è più lungo', 'Un cavo più lungo aumenta tprop: le collisioni si scoprono più tardi e l\'efficienza scende.'],
      ['Mai: il massimo è 1/e ≈ 0,37', '1/e è il limite di slotted ALOHA, non di CSMA/CD.']),
    Q('cavscd', 'Qual è la differenza essenziale tra CSMA/CD e CSMA/CA?',
      'CD = Collision Detection, CA = Collision Avoidance: rilevare o evitare?',
      'CSMA/CD rileva la collisione durante la trasmissione e la interrompe. CSMA/CA non può rilevarla: cerca di evitarla prima (DIFS, backoff anche a canale libero, RTS/CTS) e scopre un problema solo se manca l\'ACK.',
      ['CD rileva la collisione mentre trasmette e interrompe; CA cerca di evitarla prima e si accorge dei problemi solo dalla mancanza dell\'ACK', ''],
      ['CA rileva le collisioni più in fretta di CD', 'CA non le rileva affatto: le evita. Il rilevamento è di CD.'],
      ['CD ascolta il canale prima di trasmettere, CA no', 'Tutti e due fanno carrier sense (la "CS" del nome). La differenza è cosa succede dopo.'],
      ['Sono lo stesso protocollo con nomi diversi per cavo e radio', 'Si comportano in modo diverso: CA ha ACK, DIFS/SIFS e RTS/CTS; CD ha jam e interruzione immediata.'])
  ];
  const bankById = id => BANK.find(b => b.id === id);

  // ---------------- livelli ----------------
  // crc: [r ammessi, lunghezza minima e massima di D, frame ricevuto da controllare]
  const LV = {
    1: { crc: [[3], 6, 6, false], par: { w1: 7, rx1: true, m: null }, bo: { k: [1, 4], R: [10], us: false }, eff: false, alo: null, q: 1 },
    2: { crc: [[3], 7, 8, false], par: { w1: 8, rx1: false, m: [3, 4] }, bo: { k: [2, 6], R: [10, 100], us: true }, eff: false, alo: null, q: 2 },
    3: { crc: [[3, 4], 8, 9, true], par: { w1: 0, rx1: false, m: [4, 5] }, bo: { k: [3, 10], R: [10, 100, 1000], us: true }, eff: true, alo: null, q: 2 },
    4: { crc: [[4], 8, 10, true], par: null, bo: { k: [7, 15], R: [10, 100, 1000], us: true }, eff: true, alo: { ext: false }, q: 3 },
    5: { crc: [[4, 5], 10, 12, true], par: { w1: 0, rx1: false, m: [4, 6] }, bo: { k: [9, 15], R: [100, 1000], us: true }, eff: true, alo: { ext: true }, q: 4 }
  };

  // ---------------- bit e numeri ----------------
  const rndBits = n => Array.from({ length: n }, () => U.rndInt(0, 1)).join('');
  const ones = s => s.split('').filter(c => c === '1').length;
  const flip = c => (c === '1' ? '0' : '1');
  // divisione modulo 2 (XOR) di dividend per G, riga per riga
  function crcDiv(dividend, G) {
    const r = G.length - 1;
    const b = dividend.split('');
    const n = b.length;
    const lines = [dividend];
    let quot = '';
    for (let i = 0; i + r < n; i++) {
      if (b[i] !== '1') { quot += '0'; continue; }
      quot += '1';
      for (let j = 0; j <= r; j++) b[i + j] = b[i + j] === G[j] ? '0' : '1';
      lines.push(' '.repeat(i) + G);
      lines.push(' '.repeat(i) + '-'.repeat(r + 1));
      let f = b.indexOf('1');
      if (f < 0 || f > n - r) f = n - r;
      lines.push(' '.repeat(f) + b.slice(f).join(''));
    }
    return { rem: b.slice(n - r).join(''), quot: quot.replace(/^0+(?=.)/, ''), lines };
  }
  // numero scritto dall'utente: virgola o punto, frazioni a/b, percentuali, unità in coda
  function parseNum(v) {
    let s = String(v == null ? '' : v).trim().toLowerCase().replace(/\s+/g, '');
    if (!s) return null;
    s = s.replace(/(µs|μs|us|ns|ms|s|bit|mbps)$/, '');
    let pct = false;
    if (s.endsWith('%')) { pct = true; s = s.slice(0, -1); }
    const conv = t => {
      if (t.includes('.') && t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
      else t = t.replace(',', '.');
      return /^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/.test(t) ? Number(t) : null;
    };
    let x;
    const fr = /^([^/]+)\/([^/]+)$/.exec(s);
    if (fr) { const a = conv(fr[1]), b = conv(fr[2]); x = a !== null && b ? a / b : null; } else x = conv(s);
    if (x === null || !isFinite(x)) return null;
    return pct ? x / 100 : x;
  }
  // intero (accetta "3.584" e "3 584" come migliaia)
  function parseIntIt(v) {
    let s = String(v == null ? '' : v).trim().replace(/\s+/g, '');
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    return /^\d+$/.test(s) ? Number(s) : null;
  }
  // K massimo: accetta anche "{0,…,7}" o "0-7"
  function parseK(v) {
    const s = String(v == null ? '' : v).trim();
    const nums = s.match(/\d+/g);
    if (nums && nums.length >= 2 && nums[0] === '0' && /[^\d\s.]/.test(s)) return Number(nums[nums.length - 1]);
    return parseIntIt(s);
  }
  const bitsOf = v => String(v == null ? '' : v).replace(/\s+/g, '');
  const fmt = (x, d) => String(Number(x.toFixed(d))).replace('.', ',');
  // tolleranze: [relativa, assoluta]
  const TOL = {
    'bo.us': [0.01, 0.001], 'eff.tp': [0.01, 0.001], 'eff.tt': [0.01, 0.001],
    'eff.a': [0.01, 0.001], 'eff.e': [0.01, 0.002],
    'alo.s': [0.01, 0.002], 'alo.pbest': [0.01, 0.002], 'alo.smax': [0.01, 0.002],
    'alo.lim': [0, 0.005], 'alo.pure': [0, 0.005]
  };
  const near = (x, t, tol) => x !== null && Math.abs(x - t) <= Math.max(tol[1], tol[0] * Math.abs(t)) + 1e-12;

  // ---------------- parametri e costruzione ----------------
  function randomParams(level) {
    const L = LV[level] || LV[3];
    const p = { level };
    const r = U.pick(L.crc[0]);
    const D = '1' + rndBits(U.rndInt(L.crc[1], L.crc[2]) - 1);
    const G = U.pick(GEN[r]);
    let recv = null;
    if (L.crc[3]) {
      const T = D + crcDiv(D + '0'.repeat(r), G).rem;
      if (U.chance(0.5)) recv = T;
      else {
        const i = U.rndInt(0, T.length - 2);
        recv = T.split('').map((c, j) => (j === i || (j === i + 1 && U.chance(0.4)) ? flip(c) : c)).join('');
      }
    }
    p.crc = { D, G, recv };
    if (L.par) {
      const par = { w1: null, rx1: null, m: null };
      if (L.par.w1) par.w1 = rndBits(L.par.w1);
      if (L.par.rx1) {
        const w = rndBits(7);
        let rx = w + (ones(w) % 2);
        if (U.chance(0.5)) { const i = U.rndInt(0, 7); rx = rx.split('').map((c, j) => (j === i ? flip(c) : c)).join(''); }
        par.rx1 = rx;
      }
      if (L.par.m) {
        const [R, C] = L.par.m;
        par.m = { rows: Array.from({ length: R }, () => rndBits(C)), er: U.rndInt(0, R - 1), ec: U.rndInt(0, C - 1) };
      }
      p.par = par;
    } else p.par = null;
    p.bo = { k: U.rndInt(L.bo.k[0], L.bo.k[1]), R: U.pick(L.bo.R), us: L.bo.us };
    if (L.eff) {
      const Rs = level <= 3 ? [10, 100] : [10, 100, 1000];
      for (let t = 0; t < 200; t++) {
        const e = { L: U.pick([100, 200, 250, 500, 750, 1000, 1500, 2000, 2500]), F: U.pick([64, 100, 125, 250, 500, 1000, 1250, 1500]), R: U.pick(Rs) };
        const a = (e.L / V_PROP) / (8 * e.F / (e.R * 1e6));
        if (a >= 0.01 && a <= 2) { p.eff = e; break; }
      }
    }
    if (!p.eff) p.eff = null;
    if (L.alo) {
      const N = U.rndInt(level >= 5 ? 3 : 2, 10);
      const ps = [0.1, 0.2, 0.25, 0.3, 0.4, 0.5].filter(x => Math.abs(x - 1 / N) > 1e-9);
      p.alo = { N, p: U.pick(ps), ext: !!L.alo.ext };
    } else p.alo = null;
    p.qs = U.sample(BANK, L.q).map(q => ({ id: q.id, ord: U.shuffle(q.opts.map((_, i) => i)) }));
    return p;
  }

  function build(p) {
    const ex = { cat: 'mac', level: p.level, params: p, sol: {} };
    const S = ex.sol;
    if (p.crc) {
      const { D, G } = p.crc;
      const r = G.length - 1;
      const dividend = D + '0'.repeat(r);
      const dv = crcDiv(dividend, G);
      const c = { D, G, r, dividend, R: dv.rem, T: D + dv.rem, quot: dv.quot, lines: dv.lines, Rnz: crcDiv(D, G).rem, recv: null };
      S['crc.R'] = c.R; S['crc.T'] = c.T;
      if (p.crc.recv) {
        const rv = crcDiv(p.crc.recv, G);
        Object.assign(c, { recv: p.crc.recv, rrem: rv.rem, rlines: rv.lines, err: /1/.test(rv.rem) ? 'si' : 'no', rz: crcDiv(p.crc.recv + '0'.repeat(r), G).rem });
        S['crc.rr'] = c.rrem; S['crc.err'] = c.err;
      }
      ex.crc = c;
    }
    if (p.par) {
      const q = { w1: p.par.w1, rx1: p.par.rx1, m: null };
      if (q.w1) { q.p1 = String(ones(q.w1) % 2); S['par.p1'] = q.p1; }
      if (q.rx1) { q.e1 = ones(q.rx1) % 2 ? 'si' : 'no'; S['par.e1'] = q.e1; }
      if (p.par.m) {
        const rows = p.par.m.rows.map(s => s.split('').map(Number));
        const R = rows.length, C = rows[0].length, er = p.par.m.er, ec = p.par.m.ec;
        const rowPar = rows.map(r => U.sum(r) % 2);
        const colPar = Array.from({ length: C }, (_, j) => U.sum(rows.map(r => r[j])) % 2);
        const corner = U.sum(rowPar) % 2;
        const recv = rows.map(r => r.slice());
        recv[er][ec] = 1 - recv[er][ec];
        q.m = { R, C, er, ec, rowPar, colPar, corner, recv, bit: rows[er][ec] };
        S['par.row'] = String(er + 1); S['par.col'] = String(ec + 1); S['par.bit'] = String(rows[er][ec]);
      }
      ex.par = q;
    }
    if (p.bo) {
      const k = Number(p.bo.k), R = Number(p.bo.R);
      const ke = Math.min(k, 10);
      const kmax = Math.pow(2, ke) - 1;
      const bits = kmax * 512;
      ex.bo = { k, ke, kmax, bits, R, us: bits / R, askUs: !!p.bo.us };
      S['bo.kmax'] = String(kmax); S['bo.bits'] = String(bits);
      if (ex.bo.askUs) S['bo.us'] = fmt(ex.bo.us, 3);
    }
    if (p.eff) {
      const { L, F, R } = p.eff;
      const tp = L / V_PROP * 1e6, tt = 8 * F / R;
      const a = tp / tt, e = 1 / (1 + 5 * a);
      ex.eff = { L, F, R, tp, tt, a, e };
      S['eff.tp'] = fmt(tp, 3); S['eff.tt'] = fmt(tt, 3); S['eff.a'] = fmt(a, 4); S['eff.e'] = fmt(e, 3);
    }
    if (p.alo) {
      const { N, p: pr, ext } = p.alo;
      const s = N * pr * Math.pow(1 - pr, N - 1);
      const smax = Math.pow(1 - 1 / N, N - 1);
      ex.alo = { N, p: pr, ext: !!ext, s, smax, pbest: 1 / N };
      S['alo.s'] = fmt(s, 3); S['alo.pbest'] = `1/${N}`; S['alo.smax'] = fmt(smax, 3);
      if (ext) { S['alo.lim'] = fmt(1 / Math.E, 3); S['alo.pure'] = fmt(1 / (2 * Math.E), 3); }
    }
    ex.items = (p.qs || []).map(x => {
      const src = bankById(x.id);
      const ord = x.ord && x.ord.length === src.opts.length ? x.ord : src.opts.map((_, i) => i);
      return { id: src.id, q: src.q, hint: src.hint, why: src.why, opts: ord.map(i => ({ t: src.opts[i].t, err: src.opts[i].err })), ok: ord.indexOf(0) };
    });
    ex.items.forEach((it, i) => { S[`q${i + 1}`] = LETTERS[it.ok]; });
    return ex;
  }
  const gen = level => build(randomParams(level));

  // ---------------- passi ----------------
  const keysWith = (ex, pre) => Object.keys(ex.sol).filter(k => k.startsWith(pre + '.'));
  function steps(ex) {
    const s = [];
    ['crc', 'par', 'bo', 'eff', 'alo'].forEach(id => { if (ex[id]) s.push({ id, title: STEP_TITLE[id], keys: keysWith(ex, id) }); });
    if (ex.items.length) s.push({ id: 'q', title: STEP_TITLE.q, keys: ex.items.map((_, i) => `q${i + 1}`) });
    return s;
  }
  // lettera della parte (a, b, c…) secondo le parti presenti
  const letterOf = (ex, id) => 'abcdef'[Math.max(0, steps(ex).findIndex(s => s.id === id))] + ')';
  const PART_NAME = { crc: 'CRC', par: 'bit di parità', bo: 'backoff di CSMA/CD', eff: 'efficienza di CSMA/CD', alo: 'ALOHA', q: 'domande su CSMA/CD e CSMA/CA' };
  const itemOf = (ex, key) => { const m = /^q(\d+)$/.exec(key); return m ? ex.items[Number(m[1]) - 1] || null : null; };
  const optText = (it, i) => `${LETTERS[i]}) ${it.opts[i].t}`;

  // ---------------- correzione ----------------
  function check(ex, key, v) {
    const s = String(v == null ? '' : v).trim();
    if (s === '') return false;
    if (/^q\d+$/.test(key)) return s === ex.sol[key];
    switch (key) {
      case 'crc.R': case 'crc.T': case 'crc.rr': case 'par.p1': case 'par.bit': return bitsOf(s) === ex.sol[key];
      case 'crc.err': case 'par.e1': return s === ex.sol[key];
      case 'par.row': case 'par.col': return parseIntIt(s) === Number(ex.sol[key]);
      case 'bo.kmax': return parseK(s) === ex.bo.kmax;
      case 'bo.bits': return parseIntIt(s) === ex.bo.bits;
      case 'bo.us': return near(parseNum(s), ex.bo.us, TOL[key]);
      case 'eff.tp': case 'eff.tt': case 'eff.a': case 'eff.e': return near(parseNum(s), ex.eff[key.slice(4)], TOL[key]);
      case 'alo.s': case 'alo.pbest': case 'alo.smax': return near(parseNum(s), ex.alo[key.slice(4)], TOL[key]);
      case 'alo.lim': return near(parseNum(s), 1 / Math.E, TOL[key]);
      case 'alo.pure': return near(parseNum(s), 1 / (2 * Math.E), TOL[key]);
    }
    return false;
  }

  // messaggio con la regola giusta (sempre mostrato quando il campo è sbagliato)
  function msgOf(ex, key) {
    const c = ex.crc, q = ex.par, b = ex.bo, e = ex.eff, a = ex.alo;
    const it = itemOf(ex, key);
    if (it) return `Risposta giusta: ${optText(it, it.ok)}. ${it.why}`;
    const M = {
      'crc.R': c && `R ha r = ${c.r} bit (r = lunghezza di G − 1). Si divide D seguito da ${c.r} zeri (${c.dividend}) per G = ${c.G} modulo 2 (XOR, niente riporti): il resto è R = ${c.R}.`,
      'crc.T': c && `Il frame trasmesso è <D,R>: D seguito da R al posto degli zeri, cioè ${c.D} ${c.R} = ${c.T}. È divisibile per G.`,
      'crc.rr': c && c.recv && `Il ricevitore divide il frame ricevuto così com'è (senza aggiungere zeri) per G = ${c.G}: il resto è ${c.rrem}.`,
      'crc.err': c && c.recv && (c.err === 'si' ? `Resto ${c.rrem} ≠ 0: il frame non è divisibile per G, c'è un errore.` : `Resto ${c.rrem} = 0: il frame è divisibile per G, nessun errore rilevato.`),
      'par.p1': q && q.w1 && `Parità pari: gli 1 nei dati sono ${ones(q.w1)}; il bit di parità rende pari il totale, quindi vale ${q.p1}.`,
      'par.e1': q && q.rx1 && `La parola ricevuta ha ${ones(q.rx1)} bit a 1 (parità compresa): ${q.e1 === 'si' ? 'numero dispari, quindi c\'è un errore' : 'numero pari, nessun errore rilevato'}.`,
      'par.row': q && q.m && `Ricalcola la parità di ogni riga: solo la riga ${q.m.er + 1} ha un numero dispari di 1 (bit di parità compreso).`,
      'par.col': q && q.m && `Ricalcola la parità di ogni colonna: solo la colonna ${q.m.ec + 1} ha un numero dispari di 1 (bit di parità compreso).`,
      'par.bit': q && q.m && `Il bit in riga ${q.m.er + 1}, colonna ${q.m.ec + 1} è arrivato come ${q.m.recv[q.m.er][q.m.ec]}: il valore corretto è l'inverso, ${q.m.bit}.`,
      'bo.kmax': b && `Dopo k collisioni K si sceglie in {0, …, 2^k − 1}${b.k > 10 ? ', con k fermo a 10 oltre la decima collisione' : ''}: qui 2^${b.ke} − 1 = ${b.kmax}.`,
      'bo.bits': b && `Attesa = K · 512 tempi di bit; la massima è con K = ${b.kmax}: ${b.kmax} · 512 = ${b.bits} tempi di bit.`,
      'bo.us': b && `Un tempo di bit a ${b.R} Mbps dura 1/${b.R} µs: ${b.bits} / ${b.R} = ${fmt(b.us, 3)} µs.`,
      'eff.tp': e && `tprop = L / v = ${e.L} m / (2·10^8 m/s) = ${fmt(e.tp, 3)} µs.`,
      'eff.tt': e && `ttrans = dimensione in bit / bitrate = ${e.F}·8 bit / ${e.R} Mbps = ${fmt(e.tt, 3)} µs.`,
      'eff.a': e && `a = tprop / ttrans = ${fmt(e.tp, 3)} / ${fmt(e.tt, 3)} = ${fmt(e.a, 4)}.`,
      'eff.e': e && `Efficienza = 1 / (1 + 5a) = 1 / (1 + 5·${fmt(e.a, 4)}) = ${fmt(e.e, 3)}.`,
      'alo.s': a && `Efficienza = N·p·(1−p)^(N−1) = ${a.N}·${fmt(a.p, 2)}·${fmt(1 - a.p, 2)}^${a.N - 1} = ${fmt(a.s, 3)}.`,
      'alo.pbest': a && `L'efficienza è massima per p = 1/N = 1/${a.N}.`,
      'alo.smax': a && `Con p = 1/N: (1 − 1/N)^(N−1) = (${a.N - 1}/${a.N})^${a.N - 1} = ${fmt(a.smax, 3)}.`,
      'alo.lim': `Per N → ∞, (1 − 1/N)^(N−1) → 1/e ≈ 0,37: al massimo il 37% degli slot porta un frame.`,
      'alo.pure': `Pure ALOHA: un frame è vulnerabile per il doppio del tempo, l'efficienza massima si dimezza: 1/(2e) ≈ 0,18.`
    };
    return M[key] || 'Rileggi il testo.';
  }

  function grade(ex, ans) {
    const marks = {};
    let correct = 0;
    const keys = Object.keys(ex.sol);
    keys.forEach(k => {
      const ok = check(ex, k, ans[k]);
      if (ok) correct++;
      marks[k] = { ok, msg: msgOf(ex, k) };
    });
    return { correct, total: keys.length, marks };
  }
  function sol2answers(ex) { return Object.assign({}, ex.sol); }

  // ---------------- errori tipici ----------------
  function diagnose(ex, key, value, answers) {
    const v = String(value == null ? '' : value).trim();
    if (v === '' || check(ex, key, v)) return null;
    const it = itemOf(ex, key);
    if (it) { const i = LETTERS.indexOf(v); return i >= 0 && i < it.opts.length && i !== it.ok ? it.opts[i].err : null; }
    const c = ex.crc, q = ex.par, b = ex.bo, e = ex.eff, a = ex.alo;
    const tol = TOL[key];
    const x = parseNum(v);
    const is = t => near(x, t, tol);

    if (key === 'crc.R' || key === 'crc.T' || key === 'crc.rr') {
      const s = bitsOf(v);
      if (!/^[01]+$/.test(s)) return 'Scrivi solo bit: 0 e 1.';
      if (key === 'crc.R') {
        if (s === c.Rnz) return `Hai diviso D senza aggiungere r zeri: prima si moltiplica D per 2^r, cioè si accodano ${c.r} zeri (${c.dividend}), poi si divide per G.`;
        if (s === '0' + c.R || s.length === c.r + 1) return `R ha r bit, non r+1: con G di ${c.G.length} bit, r = ${c.r}. Il resto della divisione per un G di r+1 bit ha sempre r bit.`;
        if (s === c.quot) return 'Questo è il quoziente: al CRC serve il resto della divisione.';
        if (s === c.T) return 'Questo è il frame intero <D,R>: qui serve solo R, gli ultimi r bit.';
        if (s.length !== c.r) return `R ha esattamente r = ${c.r} bit (lunghezza di G meno 1), anche se comincia con degli zeri.`;
        return 'Ricontrolla la divisione: a ogni passo fai XOR con G solo se il primo bit rimasto è 1, e abbassa i bit uno alla volta (niente sottrazioni con riporto).';
      }
      if (key === 'crc.T') {
        if (s === c.dividend) return `Hai lasciato gli r zeri: nel frame trasmesso al loro posto va R (${c.D} seguito da R).`;
        if (s === c.R + c.D) return 'Ordine invertito: prima i dati D, poi R in coda.';
        if (s === c.D + '0' + c.R) return `R ha r bit, non r+1: il frame è lungo ${c.D.length} + ${c.r} = ${c.T.length} bit.`;
        if (s === c.D + c.Rnz) return 'Il frame usa un R calcolato senza aggiungere r zeri a D: rifai R dividendo D·2^r.';
        if (answers && s === c.D + bitsOf(answers['crc.R']) && bitsOf(answers['crc.R']) !== c.R) return 'Il frame è coerente con il tuo R: è R che va corretto.';
        if (s.startsWith(c.D) && s.length === c.T.length) return `La parte D è giusta: correggi gli ultimi ${c.r} bit, che sono R.`;
        return `Il frame è <D,R>: i ${c.D.length} bit di D seguiti dagli ${c.r} bit di R (${c.T.length} bit in tutto).`;
      }
      if (c.recv) {
        if (s === c.rz) return 'Il ricevitore non aggiunge zeri: divide il frame ricevuto <D,R> così com\'è per G.';
        if (s.length !== c.r) return `Il resto ha r = ${c.r} bit.`;
      }
      return null;
    }
    if (key === 'crc.err') return c.err === 'si' ? `Il resto (${c.rrem}) non è zero: il frame ricevuto non è divisibile per G, quindi c'è un errore.` : `Il resto è ${c.rrem}, cioè zero: il frame ricevuto è divisibile per G, nessun errore rilevato.`;
    if (key === 'par.p1') {
      const s = bitsOf(v);
      if (s.length > 1 || !/^[01]$/.test(s)) return 'Il bit di parità è un solo bit: 0 oppure 1.';
      return `Hai usato la parità dispari: con parità pari il totale degli 1 (dati + parità) deve essere pari. Nei dati gli 1 sono ${ones(q.w1)}.`;
    }
    if (key === 'par.e1') return `Conta gli 1 della parola ricevuta, parità compresa: sono ${ones(q.rx1)}. Con parità pari un numero dispari vuol dire errore${q.e1 === 'no' ? '; qui è pari. (Attenzione: due errori non si vedrebbero.)' : '.'}`;
    if (key === 'par.row' || key === 'par.col') {
      const n = parseIntIt(v);
      const m = q.m;
      if (key === 'par.row' && n === m.ec + 1 && m.ec !== m.er) return 'Righe e colonne scambiate: la riga è quella orizzontale con parità sbagliata.';
      if (key === 'par.col' && n === m.er + 1 && m.er !== m.ec) return 'Righe e colonne scambiate: la colonna è quella verticale con parità sbagliata.';
      if (key === 'par.row' && n === m.R + 1) return 'La riga di parità è giusta: l\'errore è in una riga di dati, quella con il numero di 1 dispari.';
      if (key === 'par.col' && n === m.C + 1) return 'La colonna di parità è giusta: l\'errore è in una colonna di dati, quella con il numero di 1 dispari.';
      return null;
    }
    if (key === 'par.bit') {
      const m = q.m;
      if (bitsOf(v) === String(m.recv[m.er][m.ec])) return 'Questo è il valore ricevuto, quello sbagliato: il bit corretto è il suo inverso.';
      return 'Il bit corretto è 0 oppure 1.';
    }
    if (key === 'bo.kmax') {
      const n = parseK(v);
      if (n === null) return 'Scrivi il valore massimo di K (un intero).';
      if (b.k > 10 && n === Math.pow(2, b.k) - 1) return `Oltre la decima collisione l'intervallo smette di crescere: k si ferma a 10 e K resta in {0, …, 1023}.`;
      if (n === Math.pow(2, b.ke)) return `K va da 0 a 2^k − 1: sono 2^k valori, contando lo 0. Qui K ≤ ${b.kmax}.`;
      if (n === Math.pow(2, b.ke - 1) - 1) return `Usa k = numero di collisioni (${b.k}), non k − 1: dopo la ${ORD[b.k]} collisione K ≤ 2^${b.ke} − 1.`;
      if (n === b.k) return 'k è il numero di collisioni; K è il numero casuale, che arriva fino a 2^k − 1.';
      return null;
    }
    if (key === 'bo.bits') {
      const n = parseIntIt(v);
      if (n === null) return 'Scrivi un numero intero di tempi di bit.';
      if (n === b.kmax) return 'Manca il fattore 512: l\'attesa è K · 512 tempi di bit, non K.';
      if (b.k > 10 && n === (Math.pow(2, b.k) - 1) * 512) return 'Oltre la decima collisione K resta in {0, …, 1023}: l\'attesa massima è 1023 · 512.';
      if (n === (b.kmax + 1) * 512) return `K massimo è 2^k − 1 = ${b.kmax}, non 2^k: attesa massima ${b.kmax} · 512.`;
      if (n === b.kmax * 64) return 'Hai usato 64 (i byte): l\'unità è 512 tempi di bit (= 64 byte, il frame minimo).';
      return null;
    }
    if (key === 'bo.us') {
      if (x === null) return 'Scrivi un numero (virgola o punto per i decimali).';
      if (is(b.us * 1000)) return `Hai scritto i ns, non i µs: 1 µs = 1000 ns. ${b.bits} / ${b.R} = ${fmt(b.us, 3)} µs.`;
      if (is(b.us / 1000)) return 'Hai scritto i ms, non i µs: a R Mbps un bit dura 1/R µs.';
      if (is(b.kmax / b.R)) return 'Manca il fattore 512: prima K · 512 tempi di bit, poi dividi per il bitrate.';
      if (b.k <= 10 && is((b.kmax + 1) * 512 / b.R)) return `K massimo è 2^k − 1 = ${b.kmax}, non 2^k.`;
      if (b.k > 10 && is((Math.pow(2, b.k) - 1) * 512 / b.R)) return 'Oltre la decima collisione K resta in {0, …, 1023}.';
      if (is(b.bits * b.R)) return 'I tempi di bit vanno DIVISI per il bitrate: a R Mbps un bit dura 1/R µs.';
      if (answers && parseIntIt(answers['bo.bits']) !== null && parseIntIt(answers['bo.bits']) !== b.bits && is(parseIntIt(answers['bo.bits']) / b.R)) return 'Il conto in µs è coerente con i tuoi tempi di bit: correggi prima quelli.';
      return null;
    }
    if (key.startsWith('eff.')) {
      if (x === null) return 'Scrivi un numero (virgola o punto per i decimali).';
      const ttB = e.F / e.R;
      if (key === 'eff.tp') {
        if (is(e.L / 3e8 * 1e6)) return 'Nel cavo il segnale viaggia a 2·10^8 m/s, non a 3·10^8 (velocità della luce nel vuoto).';
        if (is(e.tp * 1000)) return 'Hai scritto i ns: servono i µs (1 µs = 1000 ns).';
        if (is(e.tp / 1e6)) return 'Questo è in secondi: servono i µs (moltiplica per 10^6).';
        if (is(2 * e.tp)) return 'tprop è il ritardo di sola andata tra i due nodi più lontani, non andata e ritorno.';
        return null;
      }
      if (key === 'eff.tt') {
        if (is(ttB)) return 'Hai diviso i byte per il bitrate: prima converti la dimensione in bit (× 8).';
        if (is(e.tt * 1000)) return 'Hai scritto i ns: servono i µs (1 µs = 1000 ns).';
        if (is(e.tt / 1e6)) return 'Questo è in secondi: servono i µs.';
        return null;
      }
      if (key === 'eff.a') {
        if (is(1 / e.a)) return 'Rapporto invertito: a = tprop / ttrans (propagazione sopra, trasmissione sotto).';
        if (is(e.tp / ttB)) return 'ttrans calcolato con i byte: la dimensione del frame va in bit (× 8).';
        if (is(e.a * 1000) || is(e.a / 1000)) return 'Unità diverse tra tprop e ttrans: esprimi tutti e due in µs prima di dividere.';
        return null;
      }
      if (key === 'eff.e') {
        if (x > 1) return 'Un\'efficienza è una frazione tra 0 e 1.';
        if (is(1 / (1 + 5 / e.a))) return 'Hai usato a invertito: l\'efficienza è 1 / (1 + 5·tprop/ttrans).';
        if (is(1 / (1 + e.a))) return 'Manca il fattore 5: efficienza = 1 / (1 + 5a).';
        if (is(5 * e.a / (1 + 5 * e.a))) return 'Questa è la frazione persa: l\'efficienza è 1 / (1 + 5a).';
        const ua = answers ? parseNum(answers['eff.a']) : null;
        if (ua !== null && !near(ua, e.a, TOL['eff.a']) && is(1 / (1 + 5 * ua))) return 'La formula è giusta, ma la tua a è sbagliata: correggi prima a.';
        return null;
      }
    }
    if (key.startsWith('alo.')) {
      if (x === null) return 'Scrivi un numero (virgola o punto per i decimali, oppure una frazione come 1/4).';
      const N = a ? a.N : 0, p = a ? a.p : 0;
      if (key === 'alo.s') {
        if (is(N * p * Math.pow(1 - p, N))) return 'Esponente sbagliato: gli ALTRI nodi sono N − 1, quindi (1 − p)^(N−1).';
        if (is(p * Math.pow(1 - p, N - 1))) return 'Questa è la probabilità che vinca un nodo specifico: per l\'efficienza moltiplica per N (uno qualsiasi degli N).';
        if (is(N * p)) return 'Manca (1 − p)^(N−1): gli altri N − 1 nodi devono restare zitti.';
        return null;
      }
      if (key === 'alo.pbest') {
        if (is(1 / Math.E)) return '1/e è l\'efficienza limite, non la probabilità: il massimo si ha con p = 1/N.';
        if (is(p)) return `Il p del testo (${fmt(p, 2)}) non è quello ottimo: deriva N·p·(1−p)^(N−1) e trovi p = 1/N.`;
        if (is(N)) return 'È una probabilità: p = 1/N, non N.';
        return null;
      }
      if (key === 'alo.smax') {
        if (is(1 / Math.E)) return `1/e è il limite per N → ∞; con N = ${N} finito il massimo è (1 − 1/N)^(N−1), un po' più alto.`;
        if (is(a.s)) return `Questa è l'efficienza con il p del testo: il massimo si ha con p = 1/N = 1/${N}.`;
        return null;
      }
      if (key === 'alo.lim' && is(1 / (2 * Math.E))) return 'Questo è il limite di pure ALOHA: slotted ALOHA arriva a 1/e ≈ 0,37.';
      if (key === 'alo.pure' && is(1 / Math.E)) return 'Questo è slotted ALOHA: pure ALOHA ha la metà, 1/(2e) ≈ 0,18, perché un frame è vulnerabile per il doppio del tempo.';
      return null;
    }
    return null;
  }

  function diagnoseCases(ex) {
    const out = [];
    const add = (key, value, expect) => { if (key in ex.sol && !check(ex, key, value)) out.push({ key, value: String(value), expect }); };
    const c = ex.crc, q = ex.par, b = ex.bo, e = ex.eff, a = ex.alo;
    if (c) {
      add('crc.R', c.Rnz, 'senza aggiungere r zeri');
      add('crc.R', '0' + c.R, 'r+1');
      add('crc.T', c.dividend, 'lasciato gli r zeri');
      add('crc.T', c.R + c.D, 'ordine invertito');
      if (c.recv) {
        add('crc.err', c.err === 'si' ? 'no' : 'si', 'resto');
        if (c.rz !== c.rrem) add('crc.rr', c.rz, 'non aggiunge zeri');
      }
    }
    if (q) {
      if (q.w1) add('par.p1', String(1 - Number(q.p1)), 'parità dispari');
      if (q.rx1) add('par.e1', q.e1 === 'si' ? 'no' : 'si', 'conta gli 1');
      if (q.m) {
        if (q.m.er !== q.m.ec) { add('par.row', String(q.m.ec + 1), 'scambiate'); add('par.col', String(q.m.er + 1), 'scambiate'); }
        add('par.bit', String(1 - q.m.bit), 'valore ricevuto');
      }
    }
    if (b) {
      if (b.k <= 10) add('bo.kmax', String(Math.pow(2, b.k)), '2^k − 1');
      else add('bo.kmax', String(Math.pow(2, b.k) - 1), '1023');
      add('bo.bits', String(b.kmax), 'fattore 512');
      if (b.k <= 10) add('bo.bits', String((b.kmax + 1) * 512), '2^k − 1');
      if (b.askUs) {
        add('bo.us', fmt(b.us * 1000, 3), 'ns');
        add('bo.us', fmt(b.kmax / b.R, 4), 'fattore 512');
      }
    }
    if (e) {
      if (!near(1 / e.a, e.a, TOL['eff.a'])) add('eff.a', fmt(1 / e.a, 4), 'invertito');
      if (!near(1 / (1 + 5 / e.a), e.e, TOL['eff.e'])) add('eff.e', fmt(1 / (1 + 5 / e.a), 3), 'invertito');
      add('eff.e', fmt(1 / (1 + e.a), 3), 'fattore 5');
      add('eff.tt', fmt(e.F / e.R, 3), 'byte');
      add('eff.tp', fmt(e.L / 3e8 * 1e6, 3), '2·10^8');
    }
    if (a) {
      add('alo.s', fmt(a.p * Math.pow(1 - a.p, a.N - 1), 4), 'un nodo');
      add('alo.smax', fmt(1 / Math.E, 3), 'limite');
      add('alo.pbest', fmt(1 / Math.E, 3), 'efficienza limite');
      if (a.ext) { add('alo.lim', '0,18', 'pure ALOHA'); add('alo.pure', '0,37', 'metà'); }
    }
    ex.items.forEach((it, i) => {
      const w = it.opts.findIndex((_, j) => j !== it.ok);
      add(`q${i + 1}`, LETTERS[w], it.opts[w].err.slice(0, 40));
    });
    return out;
  }

  // ---------------- aiuti ----------------
  function fieldHint(ex, key) {
    const it = itemOf(ex, key);
    if (it) return it.hint + ' Elimina prima le opzioni che descrivono l\'altro protocollo.';
    const c = ex.crc, b = ex.bo, e = ex.eff, a = ex.alo;
    const H = {
      'crc.R': c && `G ha ${c.G.length} bit, quindi r = ${c.G.length - 1}: accoda r zeri a D e dividi modulo 2. R sono gli ultimi r bit rimasti.`,
      'crc.T': 'Il frame trasmesso è D seguito da R: R prende il posto degli zeri aggiunti.',
      'crc.rr': 'Il ricevitore divide il frame ricevuto per lo stesso G, senza aggiungere zeri.',
      'crc.err': 'Resto zero = nessun errore rilevato; resto diverso da zero = errore.',
      'par.p1': 'Conta gli 1 dei dati: con parità pari il bit di parità rende pari il totale.',
      'par.e1': 'Conta gli 1 dell\'intera parola ricevuta, bit di parità compreso.',
      'par.row': 'Per ogni riga conta gli 1, bit di parità compreso: quale riga ha un totale dispari?',
      'par.col': 'Per ogni colonna conta gli 1, bit di parità compreso: quale colonna ha un totale dispari?',
      'par.bit': 'All\'incrocio tra la riga e la colonna sbagliate c\'è il bit errato: correggerlo vuol dire invertirlo.',
      'bo.kmax': b && `Dopo k collisioni K ∈ {0, …, 2^k − 1}${b.k > 10 ? '; attento: oltre 10 collisioni k non cresce più' : ''}.`,
      'bo.bits': 'L\'attesa è K · 512 tempi di bit: usa il K più grande possibile.',
      'bo.us': b && `A ${b.R} Mbps un bit dura 1/${b.R} µs: dividi i tempi di bit per ${b.R}.`,
      'eff.tp': 'tprop = lunghezza del cavo / velocità di propagazione (2·10^8 m/s). Esprimilo in µs.',
      'eff.tt': 'ttrans = dimensione del frame in bit / bitrate. Con il bitrate in Mbps il risultato è già in µs.',
      'eff.a': 'a = tprop / ttrans, tutti e due nella stessa unità.',
      'eff.e': 'Efficienza = 1 / (1 + 5a).',
      'alo.s': a && `Un nodo vince se trasmette (p) e gli altri N − 1 tacciono ((1 − p)^(N−1)); vince uno qualsiasi degli N.`,
      'alo.pbest': 'Il p che massimizza N·p·(1 − p)^(N−1) si trova derivando: dipende solo da N.',
      'alo.smax': 'Sostituisci p = 1/N nella formula dell\'efficienza.',
      'alo.lim': 'Cosa diventa (1 − 1/N)^(N−1) per N molto grande?',
      'alo.pure': 'In pure ALOHA un frame può essere colpito da trasmissioni iniziate nell\'intervallo prima e in quello dopo.'
    };
    return H[key] || (e ? 'Rileggi il testo: i dati sono nella card.' : 'Rileggi il testo della domanda.');
  }

  const pre = lines => lines.join('\n');
  function hints(ex) {
    const H = [];
    const c = ex.crc, q = ex.par, b = ex.bo, e = ex.eff, a = ex.alo;
    if (c) H.push({
      step: 'crc', title: 'CRC: resto della divisione modulo 2',
      metodo: 'G ha r+1 bit, quindi R ne ha r. Accoda r zeri a D (D·2^r) e dividi per G modulo 2: a ogni passo, se il primo bit rimasto è 1 fai XOR con G, altrimenti scendi di un bit. Il resto (r bit) è R; il frame trasmesso è <D,R>. Il ricevitore divide il frame per G: resto ≠ 0 vuol dire errore.',
      applicato: `G = ${c.G} → r = ${c.r}. Dividendo: ${c.dividend} (D con ${c.r} zeri).` + (c.recv ? ` Frame ricevuto da dividere: ${c.recv}.` : ''),
      svolto: `${pre(c.lines)}\nR = ${c.R} · frame = ${c.T}` + (c.recv ? `\nRicevuto ${c.recv}: resto ${c.rrem} → ${c.err === 'si' ? 'errore' : 'nessun errore'}` : '')
    });
    if (q) {
      const ap = [], sv = [];
      if (q.w1) { ap.push(`Dati ${q.w1}: conta gli 1.`); sv.push(`${q.w1}: ${ones(q.w1)} uni → parità ${q.p1}.`); }
      if (q.rx1) { ap.push(`Parola ricevuta ${q.rx1}: conta gli 1.`); sv.push(`${q.rx1}: ${ones(q.rx1)} uni → ${q.e1 === 'si' ? 'dispari, errore' : 'pari, nessun errore'}.`); }
      if (q.m) {
        ap.push(`Matrice ${q.m.R}×${q.m.C}: ricalcola la parità di ogni riga e di ogni colonna e confrontala con quella ricevuta.`);
        sv.push(`Riga ${q.m.er + 1} e colonna ${q.m.ec + 1} hanno parità sbagliata: il bit all'incrocio è arrivato ${q.m.recv[q.m.er][q.m.ec]}, quello giusto è ${q.m.bit}.`);
      }
      H.push({
        step: 'par', title: 'Parità pari',
        metodo: 'Parità pari: il bit di parità vale 1 se gli 1 dei dati sono dispari, così il totale diventa pari. Una dimensione rileva un numero dispari di errori ma non li localizza. In due dimensioni (parità per riga e per colonna) un errore singolo sbaglia una riga e una colonna: il bit all\'incrocio è quello da invertire.',
        applicato: ap.join(' '), svolto: sv.join('\n')
      });
    }
    if (b) H.push({
      step: 'bo', title: 'Backoff esponenziale binario',
      metodo: 'Dopo la k-esima collisione l\'adattatore sceglie K a caso in {0, 1, …, 2^k − 1} e aspetta K · 512 tempi di bit. Oltre 10 collisioni l\'intervallo resta {0, …, 1023}. Un tempo di bit a R Mbps dura 1/R µs.',
      applicato: `k = ${b.k}${b.k > 10 ? ' (> 10: si usa 10)' : ''}, bitrate ${b.R} Mbps → tempo di bit 1/${b.R} µs.`,
      svolto: `K ∈ {0, …, 2^${b.ke} − 1} = {0, …, ${b.kmax}}\nattesa massima = ${b.kmax} · 512 = ${b.bits} tempi di bit` + (b.askUs ? `\n= ${b.bits} / ${b.R} µs = ${fmt(b.us, 3)} µs` : '')
    });
    if (e) H.push({
      step: 'eff', title: 'Efficienza di CSMA/CD',
      metodo: 'tprop = L / v (v = 2·10^8 m/s); ttrans = bit del frame / bitrate; a = tprop/ttrans; efficienza = 1/(1 + 5a). Più il cavo è corto e il frame lungo, più a è piccolo e l\'efficienza si avvicina a 1.',
      applicato: `L = ${e.L} m, frame ${e.F} byte = ${e.F * 8} bit, R = ${e.R} Mbps. Con R in Mbps, bit/R dà µs.`,
      svolto: `tprop = ${e.L} / 2·10^8 s = ${fmt(e.tp, 3)} µs\nttrans = ${e.F * 8} / ${e.R} µs = ${fmt(e.tt, 3)} µs\na = ${fmt(e.a, 4)}\nefficienza = 1/(1 + 5·${fmt(e.a, 4)}) = ${fmt(e.e, 3)}`
    });
    if (a) H.push({
      step: 'alo', title: 'Slotted ALOHA',
      metodo: 'Uno slot è utile se trasmette esattamente un nodo: N·p·(1 − p)^(N−1). È massima per p = 1/N e vale (1 − 1/N)^(N−1), che per N → ∞ tende a 1/e ≈ 0,37. Pure ALOHA ha la metà: 1/(2e) ≈ 0,18.',
      applicato: `N = ${a.N}, p = ${fmt(a.p, 2)}: calcola ${a.N}·${fmt(a.p, 2)}·${fmt(1 - a.p, 2)}^${a.N - 1}.`,
      svolto: `efficienza = ${fmt(a.s, 3)} · p ottimo = 1/${a.N} · massimo = (${a.N - 1}/${a.N})^${a.N - 1} = ${fmt(a.smax, 3)}` + (a.ext ? ' · limite 1/e ≈ 0,368 · pure ALOHA 1/(2e) ≈ 0,184' : '')
    });
    if (ex.items.length) H.push({
      step: 'q', title: STEP_TITLE.q,
      metodo: 'CSMA/CD rileva la collisione ascoltando il cavo mentre trasmette, interrompe, manda il jam e fa backoff: serve solo su mezzo condiviso half-duplex. In radio non si può ascoltare mentre si trasmette e c\'è il terminale nascosto: CSMA/CA evita le collisioni (DIFS, backoff, RTS/CTS) e usa l\'ACK di livello link.',
      applicato: ex.items.map((it, i) => `${i + 1}. ${it.hint}`).join('\n'),
      svolto: ex.items.map((it, i) => `${i + 1}. ${optText(it, it.ok)} — ${it.why}`).join('\n')
    });
    return H;
  }

  // ---------------- figure ----------------
  // frame <D,R>: caselle dei bit di D, poi r caselle "?" per R
  function figCrc(c) {
    const n = c.D.length + c.r;
    const w = Math.min(32, Math.floor(520 / n));
    const x0 = (560 - n * w) / 2;
    const L = [`<svg viewBox="0 0 560 96" class="fig" role="img" aria-label="Frame trasmesso: i bit di D seguiti dagli r bit di R">`];
    c.D.split('').forEach((bit, i) => {
      L.push(`<rect x="${x0 + i * w}" y="30" width="${w}" height="28" class="box"/><text x="${x0 + i * w + w / 2}" y="49" text-anchor="middle" class="lbl">${bit}</text>`);
    });
    for (let i = 0; i < c.r; i++) {
      const x = x0 + (c.D.length + i) * w;
      L.push(`<rect x="${x}" y="30" width="${w}" height="28" class="box router"/><text x="${x + w / 2}" y="49" text-anchor="middle" class="lbl w">?</text>`);
    }
    L.push(`<text x="${x0 + c.D.length * w / 2}" y="20" text-anchor="middle" class="lbl b">D: ${c.D.length} bit di dati</text>`);
    L.push(`<text x="${x0 + (c.D.length + c.r / 2) * w}" y="20" text-anchor="middle" class="lbl b">R: ${c.r} bit</text>`);
    L.push(`<text x="280" y="82" text-anchor="middle" class="lbl small">&lt;D,R&gt; = D·2^r XOR R deve essere divisibile per G = ${c.G}</text>`);
    L.push('</svg>');
    return L.join('');
  }
  // valori possibili di K: una casella per valore (o i primi e l'ultimo)
  function figBackoff(b) {
    const all = b.kmax + 1 <= 16;
    const vals = all ? Array.from({ length: b.kmax + 1 }, (_, i) => i) : [0, 1, 2, 3, 4, 5, null, b.kmax];
    const w = Math.min(56, Math.floor(500 / vals.length));
    const x0 = (560 - vals.length * w) / 2;
    const L = [`<svg viewBox="0 0 560 104" class="fig" role="img" aria-label="Valori possibili di K dopo ${b.k} collisioni">`];
    L.push(`<text x="280" y="16" text-anchor="middle" class="side">VALORI POSSIBILI DI K DOPO ${b.k} COLLISIONI (UNO SCELTO A CASO)</text>`);
    vals.forEach((v, i) => {
      const x = x0 + i * w;
      if (v === null) { L.push(`<text x="${x + w / 2}" y="49" text-anchor="middle" class="lbl b">…</text>`); return; }
      const last = v === b.kmax;
      L.push(`<rect x="${x + 1}" y="28" width="${w - 2}" height="30" rx="3" class="box${last ? ' router' : ''}"/>`);
      L.push(`<text x="${x + w / 2}" y="48" text-anchor="middle" class="lbl${last ? ' w' : ''}">${last ? '?' : v}</text>`);
    });
    L.push(`<text x="280" y="78" text-anchor="middle" class="lbl small">attesa = K · 512 tempi di bit · tempo di bit a ${b.R} Mbps = 1/${b.R} µs</text>`);
    L.push(`<text x="280" y="94" text-anchor="middle" class="lbl small">la casella piena è il K massimo da trovare</text>`);
    L.push('</svg>');
    return L.join('');
  }
  // cavo con due nodi agli estremi
  function figBus(e) {
    const L = [`<svg viewBox="0 0 560 100" class="fig" role="img" aria-label="Due nodi agli estremi di un cavo lungo ${e.L} metri">`];
    L.push(U.svgArrowDefs('ah-mac'));
    L.push('<line x1="96" y1="44" x2="464" y2="44" class="link"/>');
    L.push('<rect x="20" y="26" width="76" height="36" rx="5" class="box"/><text x="58" y="49" text-anchor="middle" class="lbl b">Nodo A</text>');
    L.push('<rect x="464" y="26" width="76" height="36" rx="5" class="box"/><text x="502" y="49" text-anchor="middle" class="lbl b">Nodo B</text>');
    L.push(`<text x="280" y="36" text-anchor="middle" class="lbl">cavo L = ${e.L} m · v = 2·10^8 m/s</text>`);
    L.push('<line x1="100" y1="66" x2="460" y2="66" class="arrow" marker-end="url(#ah-mac)"/>');
    L.push(`<text x="280" y="84" text-anchor="middle" class="lbl small">tprop: il primo bit di A arriva a B · ttrans: A mette sul cavo ${e.F} byte a ${e.R} Mbps</text>`);
    L.push('</svg>');
    return L.join('');
  }

  // ---------------- testo ----------------
  const ROUND = 'Puoi usare la virgola o il punto. Tempi in µs con al massimo 3 decimali; a con 4 decimali; efficienze e probabilità con 3 decimali.';
  function boText(b) { return `Ethernet a ${b.R} Mbps con CSMA/CD. Un adattatore subisce la ${ORD[b.k]} collisione consecutiva sullo stesso frame (k = ${b.k}).`; }
  function effText(e) { return `Due nodi agli estremi di un cavo Ethernet lungo ${e.L} m (propagazione 2·10^8 m/s), frame da ${e.F} byte, bitrate ${e.R} Mbps.`; }
  function aloText(a) { return `Slotted ALOHA con N = ${a.N} nodi; ogni nodo trasmette in uno slot con probabilità p = ${fmt(a.p, 2)}.`; }
  const errOpts = () => [['si', 'Sì, c\'è un errore'], ['no', 'No, nessun errore rilevato']];

  function render(ex, root, ctx) {
    const c = ex.crc, q = ex.par, b = ex.bo, e = ex.eff, a = ex.alo;
    const parts = steps(ex).map(s => PART_NAME[s.id]);
    const Lt = id => letterOf(ex, id);
    root.appendChild(U.h('div', { class: 'card intro' },
      U.h('p', {}, U.h('b', {}, 'Testo. '), `Esercizio sul livello di collegamento: ${parts.join(', ')}.`),
      U.h('p', { class: 'small' }, ROUND)));
    const row = (lbl, key, w, ph) => U.row(lbl, U.inp(ctx, key, { w, ph, label: lbl }));
    if (c) {
      root.appendChild(U.card(`${Lt('crc')} CRC`, { step: 'crc' },
        U.h('p', {}, `Dati D = ${c.D}, generatore G = ${c.G}. Calcolare i bit di controllo R e il frame trasmesso <D,R>.`),
        U.fig(figCrc(c), 'Il trasmettitore sceglie R in modo che <D,R> sia divisibile per G (modulo 2).'),
        row('R =', 'crc.R', 'm', 'bit'),
        row('Frame trasmesso <D,R> =', 'crc.T', 'xl', 'bit'),
        c.recv ? [
          U.h('p', {}, `Il ricevitore riceve il frame ${c.recv}.`),
          row('Resto della divisione per G =', 'crc.rr', 'm', 'bit'),
          U.row('C\'è un errore?', U.sel(ctx, 'crc.err', errOpts(), { label: 'errore nel frame ricevuto' }))
        ] : null));
    }
    if (q) {
      const kids = [];
      if (q.w1) kids.push(U.h('p', {}, `Parità pari a una dimensione. Dati: ${q.w1}.`), row('Bit di parità =', 'par.p1', 'xs', '0/1'));
      if (q.rx1) kids.push(U.h('p', {}, `Arriva la parola ${q.rx1} (7 bit di dati + 1 bit di parità pari in coda).`),
        U.row('C\'è un errore?', U.sel(ctx, 'par.e1', errOpts(), { label: 'errore nella parola ricevuta' })));
      if (q.m) {
        const m = q.m;
        kids.push(U.h('p', {}, `Parità pari a due dimensioni: matrice di ${m.R}×${m.C} bit di dati con parità di riga (ultima colonna) e di colonna (ultima riga). Durante la trasmissione un bit di dati si è invertito. Ecco la matrice ricevuta:`));
        const head = [''].concat(Array.from({ length: m.C }, (_, j) => `col ${j + 1}`), ['parità']);
        const rows = m.recv.map((r, i) => [U.label(`riga ${i + 1}`)].concat(r.map(x => U.given(x)), [U.given(m.rowPar[i])]));
        rows.push([U.label('parità')].concat(m.colPar.map(x => U.given(x)), [U.given(m.corner)]));
        kids.push(U.table(head, rows, { cls: 'center' }));
        kids.push(row('Riga dell\'errore (1-' + m.R + ') =', 'par.row', 'xs'), row('Colonna dell\'errore (1-' + m.C + ') =', 'par.col', 'xs'), row('Valore corretto del bit =', 'par.bit', 'xs', '0/1'));
      }
      root.appendChild(U.card(`${Lt('par')} Bit di parità`, { step: 'par' }, kids));
    }
    if (b) {
      root.appendChild(U.card(`${Lt('bo')} CSMA/CD: backoff esponenziale binario`, { step: 'bo' },
        U.h('p', {}, boText(b) + ' Quali valori può assumere K? Qual è l\'attesa massima prima di ritrasmettere?'),
        U.fig(figBackoff(b)),
        row('K ∈ {0, …, __}: K massimo =', 'bo.kmax', 's'),
        row('Attesa massima (tempi di bit) =', 'bo.bits', 'm'),
        b.askUs ? row('Attesa massima (µs) =', 'bo.us', 'm') : null));
    }
    if (e) {
      root.appendChild(U.card(`${Lt('eff')} CSMA/CD: efficienza`, { step: 'eff' },
        U.h('p', {}, effText(e) + ' Calcolare l\'efficienza di CSMA/CD.'),
        U.fig(figBus(e)),
        row('tprop (µs) =', 'eff.tp', 'm'), row('ttrans (µs) =', 'eff.tt', 'm'),
        row('a = tprop / ttrans =', 'eff.a', 'm'), row('Efficienza =', 'eff.e', 'm')));
    }
    if (a) {
      root.appendChild(U.card(`${Lt('alo')} ALOHA`, { step: 'alo' },
        U.h('p', {}, aloText(a)),
        row('Efficienza con questo p =', 'alo.s', 'm'),
        row('p che massimizza l\'efficienza =', 'alo.pbest', 'm'),
        row('Efficienza massima con N = ' + a.N + ' =', 'alo.smax', 'm'),
        a.ext ? [row('Limite per N → ∞ (slotted) =', 'alo.lim', 'm'), row('Efficienza massima di pure ALOHA =', 'alo.pure', 'm')] : null));
    }
    if (ex.items.length) {
      root.appendChild(U.card(`${Lt('q')} CSMA/CD e CSMA/CA`, { step: 'q' },
        ex.items.map((it, i) => U.h('div', { class: 'q-item' },
          U.h('div', { class: 'q-text' }, `${i + 1}. ${it.q}`),
          U.sel(ctx, `q${i + 1}`, it.opts.map((_, j) => [LETTERS[j], optText(it, j)]), { label: `domanda ${i + 1}` })))));
    }
  }

  function solution(ex, root) {
    const c = ex.crc, q = ex.par, b = ex.bo, e = ex.eff, a = ex.alo;
    const P = (...k) => U.h('p', { class: 'sol-body' }, ...k);
    const B = t => U.h('b', {}, t);
    const kids = [U.h('h4', {}, 'Soluzione')];
    const Lt = id => letterOf(ex, id) + ' ';
    if (c) {
      kids.push(P(B(Lt('crc') + 'CRC. '), `G = ${c.G} ha ${c.G.length} bit, quindi r = ${c.r}. Si accodano ${c.r} zeri a D e si divide ${c.dividend} per G modulo 2: a ogni riga, se il primo bit rimasto è 1, XOR con G.`));
      kids.push(U.h('pre', {}, pre(c.lines)));
      kids.push(P(`Resto R = ${c.R} (ultimi ${c.r} bit). Frame trasmesso <D,R> = ${c.D} ${c.R} = ${c.T}. Verifica: ${c.T} diviso per G dà resto 0.`));
      if (c.recv) {
        kids.push(P(`Ricevuto ${c.recv}: il ricevitore lo divide per G così com'è (senza zeri aggiunti).`));
        kids.push(U.h('pre', {}, pre(c.rlines)));
        kids.push(P(`Resto ${c.rrem}: ${c.err === 'si' ? 'diverso da zero, il frame contiene un errore e viene scartato.' : 'zero, nessun errore rilevato.'}`));
      }
    }
    if (q) {
      if (q.w1) kids.push(P(B(Lt('par') + 'Parità a una dimensione. '), `Dati ${q.w1}: ${ones(q.w1)} bit a 1, ${ones(q.w1) % 2 ? 'dispari' : 'pari'}. Con parità pari il bit di parità vale ${q.p1}, così il totale è pari.`));
      if (q.rx1) kids.push(P(B(Lt('par') + 'Parola ricevuta. '), `${q.rx1} contiene ${ones(q.rx1)} bit a 1: ${q.e1 === 'si' ? 'dispari, quindi c\'è (almeno) un errore.' : 'pari, nessun errore rilevato. Un numero pari di errori però non si vedrebbe.'}`));
      if (q.m) {
        const m = q.m;
        const rs = m.recv.map((r, i) => U.sum(r) + m.rowPar[i]);
        const cs = Array.from({ length: m.C }, (_, j) => U.sum(m.recv.map(r => r[j])) + m.colPar[j]);
        kids.push(P(B(Lt('par') + 'Parità a due dimensioni. '), 'Per ogni riga e colonna si contano gli 1 ricevuti, bit di parità compreso: con parità pari il totale deve essere pari.'));
        kids.push(U.table(['', 'Uni (con parità)', 'Esito'], rs.map((n, i) => [U.label(`riga ${i + 1}`), String(n), n % 2 ? 'dispari ✗' : 'pari']).concat(cs.map((n, j) => [U.label(`col ${j + 1}`), String(n), n % 2 ? 'dispari ✗' : 'pari']))));
        kids.push(P(`L'errore è all'incrocio tra riga ${m.er + 1} e colonna ${m.ec + 1}: è arrivato ${m.recv[m.er][m.ec]}, il valore corretto è ${m.bit}. La parità a due dimensioni localizza un errore singolo e quindi lo corregge.`));
      }
    }
    if (b) {
      kids.push(P(B(Lt('bo') + 'Backoff. '), `Dopo la ${ORD[b.k]} collisione${b.k > 10 ? ' (oltre la decima k resta 10)' : ''}: K ∈ {0, …, 2^${b.ke} − 1} = {0, …, ${b.kmax}}. Attesa massima = ${b.kmax} · 512 = ${b.bits} tempi di bit.` +
        (b.askUs ? ` A ${b.R} Mbps un bit dura 1/${b.R} µs = ${fmt(1000 / b.R, 3)} ns: ${b.bits} / ${b.R} = ${fmt(b.us, 3)} µs.` : '') +
        ' L\'intervallo raddoppia a ogni collisione perché più collisioni indicano più nodi in gara.'));
    }
    if (e) {
      kids.push(P(B(Lt('eff') + 'Efficienza. ')));
      kids.push(U.h('pre', {}, [
        `tprop  = L / v = ${e.L} m / 2·10^8 m/s = ${fmt(e.tp, 3)} µs`,
        `ttrans = ${e.F} byte · 8 / ${e.R} Mbps = ${e.F * 8} / ${e.R} µs = ${fmt(e.tt, 3)} µs`,
        `a      = tprop / ttrans = ${fmt(e.a, 4)}`,
        `eff    = 1 / (1 + 5a) = 1 / ${fmt(1 + 5 * e.a, 4)} = ${fmt(e.e, 3)}  (${fmt(e.e * 100, 1)}%)`
      ].join('\n')));
    }
    if (a) {
      kids.push(P(B(Lt('alo') + 'ALOHA. '), `Uno slot è utile se trasmette esattamente uno degli N nodi: N·p·(1−p)^(N−1) = ${a.N}·${fmt(a.p, 2)}·${fmt(1 - a.p, 2)}^${a.N - 1} = ${fmt(a.s, 3)}. ` +
        `Derivando rispetto a p il massimo è per p = 1/N = 1/${a.N}, e vale (1 − 1/${a.N})^${a.N - 1} = ${fmt(a.smax, 3)}.` +
        (a.ext ? ' Per N → ∞ tende a 1/e ≈ 0,37 (37% degli slot utili). In pure ALOHA un frame è vulnerabile per due tempi di frame: 1/(2e) ≈ 0,18.' : '')));
    }
    if (ex.items.length) {
      kids.push(P(B(Lt('q') + 'CSMA/CD e CSMA/CA.')));
      ex.items.forEach((it, i) => kids.push(U.h('div', { class: 'q-item' },
        U.h('div', { class: 'q-text' }, `${i + 1}. ${it.q}`),
        P(B(optText(it, it.ok) + '. '), it.why),
        U.h('p', { class: 'small' }, 'Le altre: ' + it.opts.map((o, j) => (j === it.ok ? null : `${LETTERS[j]}) ${o.err}`)).filter(Boolean).join(' · ')))));
    }
    root.appendChild(U.h('div', { class: 'card sol' }, kids));
  }

  function chatText(ex, ans) {
    const v = k => (ans && String(ans[k] == null ? '' : ans[k]).trim()) || '__';
    const yn = k => ({ si: 'sì', no: 'no' })[ans && ans[k]] || '__';
    const c = ex.crc, q = ex.par, b = ex.bo, e = ex.eff, a = ex.alo;
    const Lt = id => letterOf(ex, id);
    const L = [`#6 · Accesso multiplo e rilevazione errori (livello ${ex.level})`, '## Testo', ROUND];
    const R = ['', '## Le mie risposte'];
    if (c) {
      L.push(`${Lt('crc')} CRC: D = ${c.D}, G = ${c.G}. Calcolare R e il frame trasmesso <D,R>.` + (c.recv ? ` Il ricevitore riceve ${c.recv}: resto? c'è un errore?` : ''));
      R.push(`- R = ${v('crc.R')} · frame = ${v('crc.T')}` + (c.recv ? ` · resto ricevuto = ${v('crc.rr')} · errore: ${yn('crc.err')}` : ''));
    }
    if (q) {
      if (q.w1) { L.push(`${Lt('par')} Parità pari: dati ${q.w1}, bit di parità?`); R.push(`- bit di parità = ${v('par.p1')}`); }
      if (q.rx1) { L.push(`${Lt('par')} Ricevuta la parola ${q.rx1} (ultimo bit = parità pari): c'è un errore?`); R.push(`- errore nella parola: ${yn('par.e1')}`); }
      if (q.m) {
        const m = q.m;
        L.push(`${Lt('par')} Parità pari a due dimensioni, matrice ricevuta (ultima colonna e ultima riga = parità), un bit di dati invertito:`);
        m.recv.forEach((r, i) => L.push(`   ${r.join(' ')} | ${m.rowPar[i]}`));
        L.push(`   ${m.colPar.join(' ')} | ${m.corner}`);
        R.push(`- errore in riga ${v('par.row')}, colonna ${v('par.col')}, bit corretto ${v('par.bit')}`);
      }
    }
    if (b) {
      L.push(`${Lt('bo')} ${boText(b)} Valori di K e attesa massima (tempi di bit${b.askUs ? ' e µs' : ''})?`);
      R.push(`- K ∈ {0, …, ${v('bo.kmax')}} · attesa massima ${v('bo.bits')} tempi di bit` + (b.askUs ? ` = ${v('bo.us')} µs` : ''));
    }
    if (e) {
      L.push(`${Lt('eff')} ${effText(e)} Efficienza di CSMA/CD?`);
      R.push(`- tprop = ${v('eff.tp')} µs · ttrans = ${v('eff.tt')} µs · a = ${v('eff.a')} · efficienza = ${v('eff.e')}`);
    }
    if (a) {
      L.push(`${Lt('alo')} ${aloText(a)} Efficienza, p ottimo, efficienza massima${a.ext ? ', limite per N → ∞ e pure ALOHA' : ''}.`);
      R.push(`- efficienza = ${v('alo.s')} · p ottimo = ${v('alo.pbest')} · massimo = ${v('alo.smax')}` + (a.ext ? ` · limite = ${v('alo.lim')} · pure = ${v('alo.pure')}` : ''));
    }
    ex.items.forEach((it, i) => {
      L.push(`${Lt('q').slice(0, 1)}${i + 1}) ${it.q}`);
      it.opts.forEach((_, j) => L.push(`   ${optText(it, j)}`));
      const s = ans && String(ans[`q${i + 1}`] || '').trim();
      R.push(`- ${Lt('q').slice(0, 1)}${i + 1}) ${LETTERS.includes(s) ? s : '__'}`);
    });
    return L.concat(R).join('\n');
  }

  // ---------------- tracce ----------------
  const SIM = {
    level: 3, crc: { D: '10011010', G: '1101', recv: null }, par: null,
    bo: { k: 3, R: 100, us: true }, eff: null, alo: null,
    qs: [{ id: 'nocd', ord: [2, 0, 3, 1] }, { id: 'rtscts', ord: [1, 3, 0, 2] }]
  };
  const GUIDA = { level: 1, crc: { D: '101110', G: '1001', recv: null }, par: null, bo: null, eff: null, alo: null, qs: [] };

  RA.mac = {
    id: 'mac', num: '6', name: 'Accesso multiplo e rilevazione errori', part: 2, examPoints: 4, extra: false,
    desc: 'CRC con divisione modulo 2, parità a una e due dimensioni, backoff ed efficienza di CSMA/CD, ALOHA, CSMA/CD vs CSMA/CA.',
    method: {
      intro: 'Esercizio di calcolo con poche formule: CRC e parità sono conti sui bit, il backoff e l\'efficienza di CSMA/CD sono due righe ciascuno. Le domande chiuse chiedono il perché di CSMA/CA nel wireless.',
      steps: [
        'CRC: r = lunghezza di G − 1. Accoda r zeri a D e dividi per G con lo XOR (niente riporti). Il resto, di r bit, è R; il frame è D seguito da R. Il ricevitore divide il frame per G: resto ≠ 0 → errore.',
        'Parità pari: il bit di parità rende pari il numero di 1. In due dimensioni la riga e la colonna con parità sbagliata indicano il bit da invertire.',
        'Backoff: dopo k collisioni K ∈ {0, …, 2^k − 1} (k al massimo 10), attesa K·512 tempi di bit; a R Mbps un bit dura 1/R µs.',
        'Efficienza CSMA/CD: tprop = L/v, ttrans = bit/R, a = tprop/ttrans, efficienza = 1/(1 + 5a).',
        'Slotted ALOHA: N·p·(1−p)^(N−1), massimo con p = 1/N, limite 1/e ≈ 0,37; pure ALOHA 1/(2e) ≈ 0,18.',
        'CSMA/CD vs CSMA/CA: in radio non si può ascoltare mentre si trasmette e c\'è il terminale nascosto, quindi niente detection: si evita (DIFS, backoff, RTS/CTS) e si conferma con l\'ACK.'
      ],
      traps: [
        'R ha r bit, uno in meno di G: se il resto comincia con 0 gli zeri iniziali vanno scritti.',
        'Gli r zeri si aggiungono solo in trasmissione; il ricevitore divide il frame così com\'è.',
        'K arriva a 2^k − 1, non a 2^k; oltre la decima collisione resta in {0, …, 1023}.',
        'L\'attesa è K · 512 tempi di bit: non dimenticare il 512. A 100 Mbps un bit dura 0,01 µs = 10 ns.',
        'a = tprop / ttrans, non il contrario; ttrans si calcola in bit (byte × 8).',
        'Con switch e collegamenti full-duplex non ci sono collisioni: CSMA/CD non serve.'
      ],
      formulas: [
        ['CRC', '<D,R> = D·2^r XOR R divisibile per G (G di r+1 bit); rileva burst fino a r bit'],
        ['Parità pari', 'bit = (numero di 1 nei dati) mod 2'],
        ['Backoff', 'K ∈ {0, …, 2^min(k,10) − 1} · attesa = K · 512 tempi di bit'],
        ['Tempo di bit', '1/R: 10 Mbps → 0,1 µs · 100 Mbps → 0,01 µs · 1 Gbps → 1 ns'],
        ['Efficienza CSMA/CD', '1 / (1 + 5·tprop/ttrans)'],
        ['Slotted ALOHA', 'N·p·(1−p)^(N−1) · max con p = 1/N · → 1/e ≈ 0,37'],
        ['Pure ALOHA', '1/(2e) ≈ 0,18'],
        ['802.11', 'DIFS > SIFS · ACK di livello link · RTS/CTS contro il terminale nascosto']
      ]
    },
    traces: [
      {
        id: 'sim-mac', set: 'simulato',
        title: 'Esame simulato · CRC, backoff e CSMA',
        source: 'Esame_Simulato_2_TESTO.pdf, esercizio 6',
        params: SIM,
        expect: { 'crc.R': '101', 'crc.T': '10011010101', 'bo.kmax': '7', 'bo.bits': '3584', 'bo.us': '35,84', q1: 'b', q2: 'c' }
      },
      {
        id: 'guida4-crc',
        title: 'Guida 4 · CRC (D = 101110, G = 1001)',
        source: 'Guida_4_Accesso_Multiplo_Link.pdf',
        params: GUIDA,
        expect: { 'crc.R': '011', 'crc.T': '101110011' }
      }
    ],
    randomParams, build, gen, steps, grade, sol2answers, render, solution, hints, fieldHint, diagnose, diagnoseCases, chatText
  };
})();
