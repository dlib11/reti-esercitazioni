// ============================================================
// RetiApp · gen-crypto.js — Esercizio 4 (seconda parte) · RSA, firma e PGP
// Contratto dei moduli: vedi docs/moduli.md (modello: gen-nat.js)
// ============================================================
(function () {
  const RA = window.RetiApp;
  const U = RA.util;

  // ---------------- aritmetica ----------------
  const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };
  // esponenziazione modulare con BigInt: niente overflow
  function powmod(b, e, n) {
    let r = 1n, x = BigInt(b) % BigInt(n), k = BigInt(e);
    const N = BigInt(n);
    while (k > 0n) { if (k & 1n) r = (r * x) % N; x = (x * x) % N; k >>= 1n; }
    return Number(r);
  }
  // il più piccolo d con e·d mod z = 1, scartando d = e (chiave privata uguale alla pubblica)
  function invD(e, z) {
    for (let d = 2; d <= 3 * z; d++) if ((e * d) % z === 1 && d !== e) return d;
    return null;
  }
  // inverso semplice (anche d = e), per riconoscere "d calcolato mod n"
  function inv(e, m) { for (let d = 1; d < m; d++) if ((e * d) % m === 1) return d; return null; }
  // tabella k·z + 1 per cercare d
  function dRows(e, z) {
    const rows = [];
    for (let k = 1; k <= 3 * e + 2; k++) {
      const v = k * z + 1, div = v % e === 0, dd = div ? v / e : null;
      rows.push({ k, v, div, dd, skip: div && dd === e });
      if (div && dd !== e) break;
    }
    return rows;
  }
  // quadrati successivi: b^(2^i) mod n e prodotto dei termini con bit a 1
  function powSteps(b, e, n) {
    const rows = [];
    let x = b % n;
    for (let p = 1; p <= e; p *= 2) { rows.push({ p, v: x, used: (e & p) !== 0 }); x = (x * x) % n; }
    const chain = [];
    let acc = 1;
    rows.filter(r => r.used).forEach(r => { const raw = acc * r.v; chain.push({ acc, f: r.v, raw, res: raw % n }); acc = raw % n; });
    return { rows, chain, res: acc };
  }
  const isInt = v => /^\d+$/.test(String(v == null ? '' : v).trim());
  const big = v => BigInt(String(v).trim());
  const eqInt = (v, x) => isInt(v) && big(v) === BigInt(x);

  // ---------------- chiavi e blocchi PGP ----------------
  const KEYS = [
    ['none', 'Nessuna chiave'], ['KA-', 'K_A⁻ (privata di Alice)'], ['KA+', 'K_A⁺ (pubblica di Alice)'],
    ['KB+', 'K_B⁺ (pubblica di Bob)'], ['KB-', 'K_B⁻ (privata di Bob)'], ['KS', 'K_S (di sessione, simmetrica)']
  ];
  const KNAME = { none: 'nessuna chiave', 'KA-': 'K_A⁻', 'KA+': 'K_A⁺', 'KB+': 'K_B⁺', 'KB-': 'K_B⁻', KS: 'K_S' };
  const PROPS = [
    ['int', 'Integrità del messaggio'], ['auth', 'Autenticazione del mittente e non ripudio'],
    ['conf', 'Riservatezza del messaggio'], ['keyd', 'Riservatezza (distribuzione) della chiave di sessione']
  ];
  const BLOCKS = [
    { id: 'H', name: 'H(·)', prop: 'int', key: 'none', why: 'L\'hash dà un\'impronta di lunghezza fissa di m: se m cambia, cambia l\'impronta. Non usa chiavi: chiunque, anche Bob, la può ricalcolare.' },
    { id: 'KA', name: 'K_A⁻(·)', prop: 'auth', key: 'KA-', why: 'Alice cifra H(m) con la SUA chiave privata: solo lei può produrre quella firma, e chiunque la verifica con K_A⁺. Alice non può negare di averla fatta (non ripudio).' },
    { id: 'KS', name: 'K_S(·)', prop: 'conf', key: 'KS', why: 'm e la firma si cifrano con la chiave di sessione simmetrica: è veloce (RSA sarebbe ~100 volte più lento) e solo chi ha K_S legge il messaggio.' },
    { id: 'KB', name: 'K_B⁺(·)', prop: 'keyd', key: 'KB+', why: 'K_S si cifra con la chiave PUBBLICA di Bob: può aprirla solo chi ha K_B⁻, cioè Bob. Così la chiave di sessione arriva solo a lui.' }
  ];
  const RX = [
    { id: 'ks', t: 'Recupera la chiave di sessione da K_B⁺(K_S)', key: 'KB-', res: 'K_B⁻(K_B⁺(K_S)) = K_S' },
    { id: 'dec', t: 'Decifra il blocco ricevuto e ottiene m e la firma', key: 'KS', res: 'K_S(K_S(m, firma)) = m e K_A⁻(H(m))' },
    { id: 'sig', t: 'Apre la firma e ottiene il digest calcolato da Alice', key: 'KA+', res: 'K_A⁺(K_A⁻(H(m))) = H(m)' },
    { id: 'cmp', t: 'Calcola H sul messaggio ricevuto e confronta i due digest', key: 'none', res: 'H(m ricevuto) = H(m) della firma ⇒ integro e di Alice' }
  ];
  const RXNEED = {
    dec: 'per decifrare il blocco serve K_S, che Bob ottiene solo aprendo K_B⁺(K_S)',
    sig: 'la firma viaggia dentro il blocco cifrato con K_S: prima va decifrato',
    cmp: 'per confrontare servono tutti e due i digest, e quello di Alice si ottiene solo aprendo la firma'
  };
  const RES_OPTS = [
    ['ok', 'Che m non è stato modificato e che l\'ha firmato Alice (integrità e autenticità)'],
    ['conf', 'Che nessun altro ha letto il messaggio durante il viaggio'],
    ['ks', 'Solo che la chiave di sessione era quella giusta'],
    ['bob', 'Che il messaggio era destinato proprio a lui']
  ];
  const RES_WHY = {
    conf: 'La riservatezza non si verifica confrontando digest: la garantiscono K_S e K_B⁺. Il confronto dice se m è integro e chi l\'ha firmato.',
    ks: 'Il confronto dice molto di più: digest uguali ⇒ m non è cambiato e la firma l\'ha fatta chi ha K_A⁻, cioè Alice.',
    bob: 'Che fosse per Bob lo garantisce K_B⁺(K_S), che solo lui può aprire. Il confronto riguarda integrità e autenticità.'
  };

  // ---------------- domande chiuse ----------------
  const TOPICS = { hash: 'Funzioni hash', ca: 'Certificazione (CA)', nonce: 'Nonce e playback', sym: 'Simmetrica e asimmetrica' };
  const BANK = [];
  function Q(id, topic, d, q, hint, why, opts) {
    BANK.push({ id, topic, d, q, hint, why, opts: opts.map((o, i) => i === 0 ? { t: o, err: null } : { t: o[0], err: o[1] }) });
  }
  Q('hash-coll', 'hash', 1, 'Che cosa vuol dire che una funzione hash crittografica è resistente alle collisioni?',
    'Il digest ha lunghezza fissa, i messaggi possibili sono infiniti: le collisioni esistono?',
    'Le collisioni esistono per forza (infiniti messaggi, digest di lunghezza fissa), ma trovarne una richiederebbe un tempo inaccettabile: è "computazionalmente impossibile".',
    ['È computazionalmente impossibile trovare x ≠ y con H(x) = H(y)',
      ['Messaggi diversi hanno sempre digest diversi, per costruzione', 'Impossibile: il digest ha lunghezza fissa e i messaggi sono infiniti, quindi le collisioni esistono. Sono solo impossibili da trovare in tempo utile.'],
      ['Dal digest si risale al messaggio solo conoscendo la chiave', 'L\'hash non usa chiavi e non si inverte con nessuna chiave: questa è un\'altra proprietà (non invertibilità).'],
      ['Il digest è lungo quanto il messaggio, così non si perde informazione', 'Il digest ha lunghezza fissa (128 bit MD5, 256 bit SHA-256), qualunque sia il messaggio.']]);
  Q('hash-len', 'hash', 1, 'Quanto è lungo il digest di MD5?',
    'È una funzione hash: la lunghezza dipende dal messaggio?',
    'MD5 produce sempre 128 bit, qualunque sia la lunghezza del messaggio.',
    ['128 bit, qualunque sia la lunghezza del messaggio',
      ['Quanto il messaggio', 'Un hash ha lunghezza fissa: è proprio questo che lo rende comodo da firmare.'],
      ['256 bit', '256 bit è SHA-256, non MD5.'],
      ['56 bit', '56 bit è la chiave di DES.']]);
  Q('hash-sign', 'hash', 2, 'Perché nella firma digitale Alice cifra H(m) con K_A⁻ invece di cifrare tutto m?',
    'Quanto costa RSA su un messaggio lungo? Quanto è lungo H(m)?',
    'Il digest è corto e di lunghezza fissa: firmare H(m) costa poco, mentre RSA su tutto m sarebbe lentissimo. Bob ricalcola H(m) e confronta.',
    ['Il digest è corto e di lunghezza fissa: firmarlo costa molto meno (RSA è lento)',
      ['Perché così il messaggio resta segreto', 'La firma non dà riservatezza: chiunque abbia K_A⁺ la apre, e m viaggia comunque.'],
      ['Perché H(m) si può invertire e Bob ritrova m', 'L\'hash non è invertibile: Bob ricalcola H(m) sul messaggio ricevuto e confronta.'],
      ['Perché K_A⁻ si può applicare solo a 128 bit', 'RSA cifra qualunque numero minore di n: il motivo è il costo, non un limite di lunghezza.']]);
  Q('hash-verify', 'hash', 2, 'Bob riceve m e K_A⁻(H(m)). Come verifica che m non sia stato modificato?',
    'L\'hash si può invertire? Quale chiave ha Bob per aprire la firma?',
    'Bob apre la firma con K_A⁺ e ottiene H(m) di Alice; poi calcola H sul messaggio ricevuto: se i due digest coincidono, m è integro.',
    ['Calcola H sul messaggio ricevuto e lo confronta con K_A⁺(K_A⁻(H(m)))',
      ['Inverte H sul digest e confronta il risultato con m', 'L\'hash non è invertibile: si va solo "in avanti", ricalcolando H sul messaggio ricevuto.'],
      ['Applica K_A⁻ alla firma e confronta', 'K_A⁻ è la chiave privata di Alice: Bob non ce l\'ha. La firma si apre con K_A⁺.'],
      ['Gli basta che la firma si decifri senza errori', 'RSA "decifra" sempre un numero: senza confronto con H(m ricevuto) Bob non sa se m è cambiato.']]);
  Q('hash-sha', 'hash', 3, 'Quale coppia funzione → lunghezza del digest è giusta?',
    'Il nome di una delle due funzioni contiene già la risposta.',
    'SHA-256 produce 256 bit, MD5 128 bit, sempre a lunghezza fissa.',
    ['SHA-256 → 256 bit',
      ['MD5 → 256 bit', 'MD5 produce 128 bit.'],
      ['SHA-256 → lunga quanto il messaggio', 'Ogni hash ha lunghezza fissa.'],
      ['MD5 → 56 bit', '56 bit è la chiave di DES, non un digest.']]);
  Q('ca-what', 'ca', 1, 'Che cosa contiene un certificato emesso da una CA?',
    'Cosa deve legare la CA? Con quale chiave firma?',
    'Il certificato lega la chiave pubblica di un\'entità alla sua identità, ed è firmato con la chiave privata della CA.',
    ['La chiave pubblica di un\'entità e la sua identità, firmate con la chiave privata della CA',
      ['La chiave privata dell\'entità, cifrata con la chiave pubblica della CA', 'La chiave privata non esce mai dal proprietario: il certificato lega una chiave PUBBLICA a un\'identità.'],
      ['La chiave di sessione da usare nella connessione', 'K_S si genera per ogni messaggio o sessione; la CA certifica chiavi pubbliche.'],
      ['L\'hash del messaggio firmato dal mittente', 'Quella è la firma digitale di un messaggio, non un certificato.']]);
  Q('ca-verify', 'ca', 2, 'Con quale chiave Alice verifica il certificato di Bob?',
    'Chi ha firmato il certificato? Con quale chiave lo ha fatto?',
    'La CA firma con la sua chiave privata, quindi il certificato si verifica con la chiave pubblica della CA, che tutti conoscono.',
    ['Con la chiave pubblica della CA',
      ['Con la chiave privata della CA', 'La privata della CA ce l\'ha solo la CA: serve per firmare, non per verificare.'],
      ['Con la chiave pubblica di Bob scritta nel certificato', 'Sarebbe un circolo: è proprio quella chiave da verificare. Un impostore ci metterebbe la sua.'],
      ['Con la chiave privata di Alice', 'La privata di Alice serve a firmare i suoi messaggi, non a verificare quelli degli altri.']]);
  Q('ca-mitm', 'ca', 2, 'Da quale attacco protegge la certificazione delle chiavi pubbliche?',
    'Pensa a Trudy che manda ad Alice la propria chiave pubblica dicendo di essere Bob.',
    'Senza certificato Trudy si mette in mezzo e spaccia la sua chiave pubblica per quella di Bob (man-in-the-middle). Il certificato della CA dice di chi è davvero la chiave.',
    ['Man-in-the-middle: Trudy spaccia la sua chiave pubblica per quella di Bob',
      ['Playback: il riuso di un messaggio registrato', 'Contro il playback si usa il nonce (un numero usato una sola volta).'],
      ['Ricerca della chiave per forza bruta', 'Contro la forza bruta serve una chiave lunga, non un certificato.'],
      ['DoS: sovraccarico del server', 'Il certificato non limita il traffico: contro il SYN flooding servono i firewall.']]);
  Q('ca-pgp', 'ca', 3, 'In PGP, perché Bob deve essere sicuro che K_A⁺ appartenga davvero ad Alice?',
    'Cosa potrebbe fare Trudy se Bob usasse la chiave pubblica di Trudy credendola di Alice?',
    'Se Bob usasse una chiave falsa, Trudy potrebbe firmare con la sua privata e la verifica riuscirebbe: la firma prova solo chi possiede la chiave privata corrispondente.',
    ['Altrimenti Trudy potrebbe firmare con la sua privata e la verifica riuscirebbe lo stesso',
      ['Altrimenti non riuscirebbe a decifrare K_S', 'K_S si apre con K_B⁻, la privata di Bob: K_A⁺ non c\'entra.'],
      ['Altrimenti non potrebbe calcolare l\'hash', 'H è pubblica e non usa chiavi.'],
      ['Non serve: la firma basta da sola', 'La firma prova solo chi ha la privata corrispondente alla chiave pubblica usata. Se la chiave pubblica è falsa, la prova non vale.']]);
  Q('nonce-def', 'nonce', 1, 'Che cos\'è un nonce e a che cosa serve nell\'autenticazione?',
    'Il nome viene da "number used once".',
    'Il nonce R è un numero usato una sola volta: chi risponde cifrandolo con la chiave condivisa dimostra di conoscerla ADESSO, quindi una risposta registrata non vale.',
    ['Un numero usato una sola volta: chi lo restituisce cifrato dimostra di avere la chiave adesso',
      ['Una password cifrata', 'Una password cifrata si può registrare e rispedire: è proprio l\'attacco di playback che il nonce impedisce.'],
      ['Il numero di sequenza dei segmenti TCP', 'Il numero di sequenza TCP non è segreto e non prova l\'identità.'],
      ['La chiave di sessione simmetrica', 'Il nonce non cifra nulla: è la sfida che l\'altro deve cifrare.']]);
  Q('nonce-play', 'nonce', 2, 'Alice manda a Bob la sua password cifrata. Perché Trudy può comunque impersonarla?',
    'Trudy deve per forza decifrare il pacchetto?',
    'A Trudy basta registrare il pacchetto e rispedirlo più tardi (playback): non deve decifrarlo. Per questo si usa un nonce diverso ogni volta.',
    ['Le basta registrare il pacchetto e rispedirlo (playback), senza decifrarlo',
      ['Perché la cifratura simmetrica si rompe facilmente', 'Non serve rompere la cifratura: il pacchetto cifrato funziona così com\'è.'],
      ['Perché conosce la chiave pubblica di Alice', 'La chiave pubblica la conoscono tutti, ma non permette di cifrare a nome di Alice.'],
      ['Non può: una password cifrata è sicura', 'È sicura da leggere, non da riusare: il playback rispedisce il pacchetto identico.']]);
  Q('nonce-ip', 'nonce', 1, 'Perché l\'indirizzo IP sorgente non basta per autenticare Alice?',
    'Chi scrive il campo IP sorgente di un pacchetto?',
    'L\'IP sorgente lo scrive chi manda il pacchetto: Trudy può falsificarlo (spoofing).',
    ['Trudy può falsificare l\'IP sorgente dei suoi pacchetti (spoofing)',
      ['Perché l\'IP cambia a ogni pacchetto', 'L\'IP di un host non cambia a ogni pacchetto: il problema è che chiunque può scriverne uno falso.'],
      ['Perché il NAT lo cifra', 'Il NAT traduce l\'indirizzo, non lo cifra.'],
      ['Basta, se Alice usa IPv6', 'Anche in IPv6 l\'indirizzo sorgente si può falsificare.']]);
  Q('sym-why', 'sym', 1, 'Perché in PGP il messaggio si cifra con la chiave di sessione e non con RSA?',
    'Quanto costa l\'esponenziazione modulare rispetto a DES/AES?',
    'RSA è lento (DES è almeno ~100 volte più veloce): con RSA si cifra solo K_S, che è corta; il messaggio, lungo, con la chiave simmetrica.',
    ['RSA è molto più lento (~100 volte DES): con RSA si cifra solo la chiave K_S, che è corta',
      ['RSA non può cifrare testo', 'RSA cifra numeri, e qualunque testo è una sequenza di bit, cioè un numero: il problema è la velocità.'],
      ['Così Bob non ha bisogno della sua chiave privata', 'Serve comunque: è con K_B⁻ che Bob recupera K_S.'],
      ['La chiave simmetrica è più sicura di RSA', 'Non è questione di sicurezza ma di costo dell\'esponenziazione modulare.']]);
  Q('sym-des', 'sym', 1, 'Quanto è lunga la chiave di DES?',
    'È lo standard "vecchio", rotto con la forza bruta.',
    'DES usa chiavi da 56 bit su blocchi da 64 bit: abbastanza corte da essere trovate per forza bruta.',
    ['56 bit (su blocchi da 64 bit)',
      ['128 bit', '128 bit è la chiave più corta di AES (e il digest di MD5).'],
      ['1024 bit', '1024 bit è l\'ordine di grandezza dei primi p e q di RSA.'],
      ['256 bit', '256 bit è la chiave più lunga di AES.']]);
  Q('sym-aes', 'sym', 2, 'Quali lunghezze di chiave usa AES?',
    'Sono tre, tutte multipli di 64.',
    'AES usa chiavi da 128, 192 o 256 bit: per forza bruta servirebbe un tempo enorme.',
    ['128, 192 o 256 bit',
      ['56 bit', '56 bit è DES, rotto per forza bruta.'],
      ['Solo 64 bit', '64 bit è la dimensione del blocco di DES.'],
      ['La stessa lunghezza del messaggio', 'Quello è il one-time pad, non AES.']]);
  Q('sym-problem', 'sym', 2, 'Qual è il problema principale della crittografia a chiave simmetrica?',
    'Alice e Bob devono avere la stessa chiave. Come ci arriva?',
    'Mittente e destinatario devono condividere la chiave senza che Trudy la intercetti: la chiave pubblica serve proprio a distribuirla.',
    ['Accordarsi sulla chiave senza che Trudy la intercetti',
      ['È troppo lenta', 'È veloce: lenta è la crittografia a chiave pubblica.'],
      ['Non garantisce la riservatezza', 'La garantisce, purché la chiave resti segreta.'],
      ['Serve una chiave diversa per ogni bit', 'No: una chiave cifra tutto il messaggio.']]);
  Q('sym-rsa', 'sym', 3, 'Su che cosa si basa la sicurezza di RSA?',
    'Chi conosce p e q può calcolare z e quindi d.',
    'Da n = p·q, con p e q enormi, non si riesce a risalire ai fattori: senza p e q non si calcola z, e senza z non si trova d.',
    ['Sulla difficoltà di fattorizzare n = p·q quando p e q sono primi enormi',
      ['Sul segreto dell\'algoritmo', 'L\'algoritmo è pubblico: segreta è solo la chiave privata d.'],
      ['Sulla lunghezza fissa del digest', 'Quella è una proprietà delle funzioni hash.'],
      ['Sul fatto che e sia molto grande', 'e può essere piccolo (3, 65537): la sicurezza sta nella fattorizzazione di n.']]);
  const bankById = id => BANK.find(b => b.id === id);
  const LETTERS = ['a', 'b', 'c', 'd'];

  // ---------------- parametri ----------------
  const PRIMES = { 1: [3, 5, 7, 11], 2: [3, 5, 7, 11, 13], 3: [5, 7, 11, 13, 17], 4: [7, 11, 13, 17, 19, 23], 5: [17, 19, 23, 29, 31, 37] };
  const QPLAN = { 1: [], 2: [['sym', 1, 1]], 3: [['sym', 1, 2], ['nonce', 1, 2]], 4: [['hash', 1, 2], ['ca', 1, 2]], 5: [['hash', 2, 3], ['ca', 2, 3], ['nonce', 1, 3], ['sym', 2, 3]] };

  function pickRsa(level) {
    for (let t = 0; t < 500; t++) {
      const [p, q] = U.sample(PRIMES[level], 2).sort((a, b) => a - b);
      const n = p * q, z = (p - 1) * (q - 1);
      const eMax = level <= 2 ? 7 : level <= 4 ? 13 : 31;
      const es = []; for (let e = 3; e <= Math.min(eMax, z - 1); e++) if (gcd(e, z) === 1 && (e * e) % z !== 1) es.push(e);
      if (!es.length) continue;
      const e = U.pick(es), d = invD(e, z);
      const mMax = level <= 2 ? Math.min(n - 1, 20) : n - 1;
      const ms = []; for (let m = 2; m <= mMax; m++) if (gcd(m, n) === 1 && powmod(m, e, n) !== m) ms.push(m);
      if (ms.length < 2) continue;
      const m = U.pick(ms);
      const r = { p, q, e, m, giveD: level === 1, askD: level >= 2, askDec: level >= 3, askSign: level === 5, mf: null, alt: null };
      if (level === 5) {
        const mfs = ms.filter(x => x !== m && powmod(x, d, n) !== powmod(x, e, n));
        if (!mfs.length) continue;
        r.mf = U.pick(mfs);
        const alt = altCandidates(e, z);
        if (!alt) continue;
        r.alt = alt;
      }
      return r;
    }
    throw new Error('nessuna chiave RSA adatta');
  }
  // un esponente alternativo valido e tre trappole (1, un pari, uno con un fattore dispari in comune con z)
  function altCandidates(e, z) {
    const odd = []; let x = z; while (x % 2 === 0) x /= 2;
    for (let f = 3; f <= x; f += 2) if (x % f === 0) { odd.push(f); while (x % f === 0) x /= f; }
    if (!odd.length) return null;
    const valid = []; for (let v = 3; v < Math.min(z, 80); v++) if (v !== e && gcd(v, z) === 1) valid.push(v);
    if (!valid.length) return null;
    const good = U.pick(valid);
    const f = U.pick(odd);
    const shared = U.pick([f, 3 * f, 5 * f].filter(v => v < z && v !== good));
    const evens = []; for (let v = 4; v < Math.min(z, 60); v += 2) if (![good, shared].includes(v)) evens.push(v);
    const list = [good, 1, U.pick(evens), shared];
    if (new Set(list).size < 4 || list.some(v => v == null)) return null;
    return U.shuffle(list);
  }
  function pickQs(level) {
    const out = [];
    QPLAN[level].forEach(([topic, lo, hi]) => {
      const pool = BANK.filter(b => b.topic === topic && b.d >= lo && b.d <= hi && !out.some(o => o.id === b.id));
      const b = U.pick(pool);
      out.push({ id: b.id, ord: U.shuffle([0, 1, 2, 3]) });
    });
    return out;
  }
  function randomParams(level) {
    level = Math.max(1, Math.min(5, level || 1));
    return {
      level, rsa: pickRsa(level), pgp: level >= 3, rx: level >= 4,
      rxOrd: U.shuffle(RX.map(r => r.id)), qs: pickQs(level)
    };
  }

  function build(p) {
    let rsa = null;
    if (p.rsa) {
      const r = p.rsa, P = Number(r.p), Qn = Number(r.q), e = Number(r.e), m = Number(r.m);
      const n = P * Qn, z = (P - 1) * (Qn - 1), d = invD(e, z);
      rsa = {
        p: P, q: Qn, e, m, n, z, d, c: powmod(m, e, n),
        giveD: !!r.giveD, askD: !!r.askD && !r.giveD, askDec: !!r.askDec, askSign: !!r.askSign && r.mf != null,
        mf: r.mf != null ? Number(r.mf) : null, alt: r.alt ? r.alt.map(Number) : null
      };
      if (rsa.askSign) rsa.s = powmod(rsa.mf, d, n);
      if (rsa.alt) rsa.altOk = rsa.alt.find(v => v > 1 && gcd(v, z) === 1);
    }
    const items = (p.qs || []).map(x => {
      const src = bankById(x.id);
      const ord = x.ord && x.ord.length === src.opts.length ? x.ord : src.opts.map((_, i) => i);
      return { id: src.id, topic: src.topic, q: src.q, hint: src.hint, why: src.why, opts: ord.map(i => ({ t: src.opts[i].t, err: src.opts[i].err })), ok: ord.indexOf(0) };
    });
    const rxOrd = p.rxOrd && p.rxOrd.length === 4 ? p.rxOrd.slice() : RX.map(r => r.id);
    return { cat: 'crypto', level: p.level, params: p, rsa, pgp: !!p.pgp, rx: !!p.rx, rxOrd, items };
  }
  const gen = level => build(randomParams(level));

  // ---------------- chiavi delle risposte ----------------
  const qKey = i => `q.${i + 1}`;
  function keysOf(ex) {
    const r = ex.rsa, k = { key: [], enc: [], sign: [], pgp: [], rx: [], q: [] };
    if (r) {
      k.key.push('rsa.n', 'rsa.z');
      if (r.askD) k.key.push('rsa.d');
      if (r.alt) k.key.push('rsa.e2');
      k.enc.push('rsa.c');
      if (r.askDec) k.enc.push('rsa.m2');
      if (r.askSign) k.sign.push('rsa.s', 'rsa.v');
    }
    if (ex.pgp) BLOCKS.forEach(b => k.pgp.push(`pgp.${b.id}.prop`, `pgp.${b.id}.key`));
    if (ex.rx) { k.rx.push('rx.1', 'rx.2', 'rx.3', 'rx.4'); RX.forEach(a => k.rx.push(`rx.k.${a.id}`)); k.rx.push('rx.res'); }
    ex.items.forEach((_, i) => k.q.push(qKey(i)));
    return k;
  }
  const STEP_T = { key: 'Chiavi RSA: n, z, d', enc: 'Cifratura e decifratura', sign: 'Firma RSA', pgp: 'Schema PGP: i blocchi', rx: 'Passi di Bob', q: 'Domande' };
  function steps(ex) {
    const k = keysOf(ex);
    return Object.keys(STEP_T).filter(id => k[id].length).map(id => ({ id, title: STEP_T[id], keys: k[id], prefixes: id === 'q' ? ['q.'] : [] }));
  }
  const allKeys = ex => [].concat(...Object.values(keysOf(ex)));

  // ---------------- soluzione modello ----------------
  function solOf(ex, key) {
    const r = ex.rsa;
    const S = {
      'rsa.n': r && r.n, 'rsa.z': r && r.z, 'rsa.d': r && r.d, 'rsa.c': r && r.c, 'rsa.m2': r && r.m,
      'rsa.s': r && r.s, 'rsa.v': r && r.mf, 'rsa.e2': r && r.altOk, 'rx.res': 'ok'
    };
    if (key in S) return String(S[key]);
    let m = /^pgp\.(\w+)\.(prop|key)$/.exec(key);
    if (m) { const b = BLOCKS.find(x => x.id === m[1]); return b[m[2]]; }
    m = /^rx\.(\d)$/.exec(key);
    if (m) return RX[Number(m[1]) - 1].id;
    m = /^rx\.k\.(\w+)$/.exec(key);
    if (m) return RX.find(a => a.id === m[1]).key;
    m = /^q\.(\d+)$/.exec(key);
    if (m) { const it = ex.items[Number(m[1]) - 1]; return it ? LETTERS[it.ok] : ''; }
    return '';
  }
  function sol2answers(ex) {
    const a = {};
    allKeys(ex).forEach(k => { a[k] = solOf(ex, k); });
    return a;
  }

  // ---------------- correzione ----------------
  function isRight(ex, key, v) {
    const r = ex.rsa;
    if (key === 'rsa.d') return isInt(v) && big(v) > 0n && (BigInt(r.e) * big(v)) % BigInt(r.z) === 1n && big(v) !== BigInt(r.e);
    if (key.startsWith('rsa.')) return eqInt(v, solOf(ex, key));
    return String(v == null ? '' : v).trim() === solOf(ex, key);
  }
  function msgOf(ex, key) {
    const r = ex.rsa;
    const M = r ? {
      'rsa.n': `n = p·q = ${r.p}·${r.q} = ${r.n}.`,
      'rsa.z': `z = (p−1)·(q−1) = ${r.p - 1}·${r.q - 1} = ${r.z}.`,
      'rsa.d': `d deve dare e·d mod z = 1, cioè ${r.e}·d − 1 divisibile per ${r.z}: il più piccolo è d = ${r.d} (${r.e}·${r.d} = ${r.e * r.d} = ${(r.e * r.d - 1) / r.z}·${r.z} + 1). Va bene anche ${r.d} + k·${r.z}.`,
      'rsa.c': `Si cifra con la chiave pubblica (n, e): c = m^e mod n = ${r.m}^${r.e} mod ${r.n} = ${r.c}.`,
      'rsa.m2': `Si decifra con la chiave privata (n, d): c^d mod n = ${r.c}^${r.d} mod ${r.n} = ${r.m}, il messaggio di partenza.`,
      'rsa.s': `La firma usa la chiave privata: s = m^d mod n = ${r.mf}^${r.d} mod ${r.n} = ${r.s}.`,
      'rsa.v': `La verifica usa la chiave pubblica: s^e mod n = ${r.s}^${r.e} mod ${r.n} = ${r.mf}, il messaggio firmato.`,
      'rsa.e2': r.alt ? `e deve essere maggiore di 1 e coprimo con z = ${r.z}: tra i valori proposti solo ${r.altOk} non ha divisori in comune con ${r.z}.` : ''
    } : {};
    if (M[key]) return M[key];
    let m = /^pgp\.(\w+)\.(prop|key)$/.exec(key);
    if (m) { const b = BLOCKS.find(x => x.id === m[1]); return `${b.name}: ${PROPS.find(x => x[0] === b.prop)[1].toLowerCase()}, chiave: ${KNAME[b.key]}. ${b.why}`; }
    m = /^rx\.(\d)$/.exec(key);
    if (m) { const a = RX[Number(m[1]) - 1]; return `Passo ${m[1]}: ${a.t.toLowerCase()} (${a.res}). Bob ripercorre lo schema all'indietro.`; }
    m = /^rx\.k\.(\w+)$/.exec(key);
    if (m) { const a = RX.find(x => x.id === m[1]); return `${a.t}: ${KNAME[a.key]} (${a.res}).`; }
    if (key === 'rx.res') return 'Digest uguali ⇒ m non è stato modificato (integrità) e la firma l\'ha fatta chi ha K_A⁻, cioè Alice (autenticità, non ripudio).';
    m = /^q\.(\d+)$/.exec(key);
    if (m) { const it = ex.items[Number(m[1]) - 1]; return `Risposta giusta: ${LETTERS[it.ok]}) ${it.opts[it.ok].t}. ${it.why}`; }
    return '';
  }
  function grade(ex, a) {
    a = a || {};
    const marks = {};
    let correct = 0;
    const keys = allKeys(ex);
    keys.forEach(k => {
      const ok = isRight(ex, k, a[k]);
      if (ok) correct++;
      marks[k] = { ok, msg: msgOf(ex, k) };
    });
    return { correct, total: keys.length, marks };
  }

  // ---------------- errori tipici ----------------
  function keyWhy(correct, v, bob) {
    if (correct === 'none') return 'La funzione hash non usa chiavi: è pubblica, chiunque la calcola. È proprio per questo che Bob può ricalcolarla e confrontare.';
    if (v === 'none') return 'Qui c\'è una cifratura o una decifratura: serve una chiave. Senza chiave lo fa chiunque, anche Trudy.';
    if (!bob && v === 'KB-') return 'K_B⁻ è la chiave privata di Bob: Alice non ce l\'ha. Alice usa la pubblica di Bob, K_B⁺.';
    if (bob && v === 'KA-') return 'Pubblica e privata scambiate: K_A⁻ è la privata di Alice e Bob non ce l\'ha. La firma si apre con la pubblica K_A⁺.';
    if (correct === 'KA-' && v === 'KA+') return 'Pubblica e privata scambiate: si firma con la privata K_A⁻, che ha solo Alice. Con la pubblica chiunque potrebbe produrre la stessa "firma".';
    if (correct === 'KB-' && v === 'KB+') return 'Pubblica e privata scambiate: K_B⁺(K_S) si apre solo con l\'altra chiave della coppia, la privata K_B⁻. Se bastasse la pubblica, chiunque leggerebbe K_S.';
    if (correct === 'KS') return 'Il blocco (m + firma) usa la chiave di sessione simmetrica K_S: è veloce, mentre RSA su dati lunghi sarebbe ~100 volte più lento.';
    if (v === 'KS') return 'K_S cifra solo il blocco m + firma. Qui serve una chiave della coppia pubblica/privata.';
    if (correct === 'KB+') return 'Per far leggere K_S solo a Bob, Alice la cifra con una chiave di Bob: la sua pubblica, K_B⁺.';
    if (correct === 'KA+') return 'La firma è stata fatta con K_A⁻: si apre con l\'altra chiave della coppia di Alice, K_A⁺.';
    if (correct === 'KB-') return 'K_S è stata cifrata con K_B⁺: la apre solo la privata di Bob, K_B⁻.';
    if (correct === 'KA-') return 'La firma la fa Alice con la sua chiave privata K_A⁻: solo lei la possiede.';
    return null;
  }
  const PROPWHY = {
    'H.conf': 'Integrità e riservatezza scambiate: l\'hash non nasconde nulla (m viaggia comunque). Serve a scoprire se m è stato modificato.',
    'H.auth': 'Da solo H(m) non dice chi ha scritto il messaggio: chiunque può calcolarlo. L\'autenticazione arriva quando Alice firma il digest con K_A⁻.',
    'H.keyd': 'L\'hash non tocca la chiave di sessione: lavora solo su m.',
    'KA.int': 'La firma con K_A⁻ dice CHI ha prodotto il digest (solo Alice ha K_A⁻): è l\'autenticazione. L\'integrità la dà l\'impronta H(m) che c\'è dentro.',
    'KA.conf': 'La firma non nasconde nulla: chiunque ha K_A⁺ la apre. Dice solo chi l\'ha fatta.',
    'KA.keyd': 'K_A⁻ si applica a H(m), non a K_S.',
    'KS.int': 'Integrità e riservatezza scambiate: K_S cifra il blocco perché lo legga solo chi ha K_S. L\'integrità la dà l\'hash firmato.',
    'KS.auth': 'K_S la conoscono sia Alice sia Bob: non prova chi ha scritto il messaggio. Lo prova la firma con K_A⁻.',
    'KS.keyd': 'K_S(·) cifra il messaggio con la chiave di sessione; a distribuire K_S pensa il blocco K_B⁺(·).',
    'KB.conf': 'K_B⁺ cifra solo K_S, non il messaggio: serve a consegnare K_S in modo che la legga solo Bob.',
    'KB.int': 'K_B⁺ non protegge m dalle modifiche: cifra K_S perché la legga solo Bob.',
    'KB.auth': 'K_B⁺ la conoscono tutti: non prova chi è il mittente. Fa sì che solo Bob possa leggere K_S.'
  };

  function diagnose(ex, key, value, answers) {
    const v = String(value == null ? '' : value).trim();
    if (v === '' || isRight(ex, key, v)) return null;
    const r = ex.rsa;
    if (key.startsWith('rsa.') && r) {
      if (key === 'rsa.e2') {
        const x = Number(v);
        if (x === 1) return 'e = 1 non va bene (serve 1 < e): c = m^1 = m, il messaggio non viene cifrato.';
        if (x % 2 === 0) return `${x} è pari e z = ${r.z} è sempre pari ((p−1) e (q−1) sono pari): hanno il fattore 2 in comune, quindi non è coprimo con z.`;
        const g = gcd(x, r.z);
        if (g > 1) return `mcd(${x}, ${r.z}) = ${g}: ${x} non è coprimo con z, quindi non esiste d con e·d mod z = 1.`;
        return null;
      }
      if (!isInt(v)) return 'Serve un numero intero positivo.';
      const x = big(v);
      const B = BigInt;
      if (key === 'rsa.n') {
        if (x === B(r.z)) return `Hai calcolato z = (p−1)(q−1). Il modulo n è il prodotto dei primi: n = p·q.`;
        if (x === B(r.p + r.q)) return 'Hai sommato p e q: n è il prodotto p·q.';
        return null;
      }
      if (key === 'rsa.z') {
        if (x === B(r.n)) return `Hai scritto n = p·q. z non è p·q: si toglie 1 a ciascun primo, z = (p−1)·(q−1).`;
        if (x === B((r.p + 1) * (r.q + 1))) return 'Hai usato p+1 e q+1: z = (p−1)·(q−1), con il meno.';
        if (x === B(r.p - 1 + r.q - 1)) return 'Hai sommato (p−1) e (q−1): z è il prodotto (p−1)·(q−1).';
        if (x === B(r.n - 1)) return 'n − 1 non è z: z = (p−1)·(q−1).';
        return null;
      }
      if (key === 'rsa.d') {
        if (x === B(r.e) && (r.e * r.e) % r.z === 1) return `d = e: il conto e·d mod z = 1 torna, ma così la chiave privata è uguale alla pubblica e chiunque decifra. Prendi il valore successivo, ${r.e} + k·${r.z} oppure il prossimo k·z + 1 divisibile per e.`;
        const dn = inv(r.e, r.n);
        if (dn && x === B(dn)) return `Hai calcolato d mod n invece che mod z: ${r.e}·${v} mod ${r.n} = 1, ma serve e·d mod z = 1 con z = ${r.z}.`;
        if ((B(r.e) * x) % B(r.n) === 1n) return `Hai calcolato d mod n invece che mod z: serve e·d mod z = 1 con z = ${r.z}.`;
        if ((B(r.e) * x) % B(r.z) !== 1n) return `Controlla: ${r.e}·${v} = ${B(r.e) * x}, che diviso per ${r.z} dà resto ${(B(r.e) * x) % B(r.z)}, non 1.`;
        return null;
      }
      if (key === 'rsa.c') {
        if (r.d !== r.e && x === B(powmod(r.m, r.d, r.n))) return 'Hai cifrato con d: per cifrare si usa la chiave pubblica di Bob (n, e). La privata d serve a decifrare (o a firmare).';
        if (x === B(r.m) ** B(r.e)) return `Manca il mod n: ${r.m}^${r.e} = ${v}, che va ridotto modulo ${r.n}.`;
        if (x === B((r.m * r.e) % r.n)) return 'Hai moltiplicato m·e: si eleva a potenza, c = m^e mod n.';
        if (x === B(powmod(r.m, r.e, r.z))) return 'Hai ridotto mod z: la cifratura lavora mod n, c = m^e mod n.';
        return null;
      }
      if (key === 'rsa.m2') {
        if (x === B(powmod(r.c, r.e, r.n))) return 'Hai usato e: per decifrare serve la chiave privata, m = c^d mod n.';
        if (x === B(r.c)) return 'È il testo cifrato: decifrando con d devi ritrovare il messaggio di partenza.';
        return 'La decifratura deve ridare il messaggio m di partenza: controlla c^d mod n riducendo a ogni passo.';
      }
      if (key === 'rsa.s') {
        if (x === B(powmod(r.mf, r.e, r.n))) return 'Hai firmato con la chiave pubblica e: così chiunque potrebbe "firmare". La firma usa la privata, s = m^d mod n.';
        if (x === B(r.mf)) return 'È il messaggio stesso: la firma è m^d mod n.';
        return null;
      }
      if (key === 'rsa.v') {
        if (x === B(powmod(r.s, r.d, r.n))) return 'Hai verificato con la privata d: chi verifica non ce l\'ha. Si usa la pubblica: s^e mod n.';
        if (x === B(r.s)) return 'È la firma stessa: la verifica è s^e mod n, e deve ridare il messaggio firmato.';
        return `La verifica di una firma giusta ridà sempre il messaggio firmato (${r.mf}): controlla s^e mod n.`;
      }
      return null;
    }
    let m = /^pgp\.(\w+)\.(prop|key)$/.exec(key);
    if (m) {
      const b = BLOCKS.find(x => x.id === m[1]);
      if (m[2] === 'prop') return PROPWHY[`${b.id}.${v}`] || null;
      return keyWhy(b.key, v, false);
    }
    m = /^rx\.(\d)$/.exec(key);
    if (m) {
      const i = Number(m[1]), pos = RX.findIndex(a => a.id === v) + 1;
      if (pos <= 0) return null;
      if (pos > i) return `Troppo presto: ${RXNEED[v]}.`;
      return `«${RX[pos - 1].t}» va fatto prima, al passo ${pos}: ${pos === 1 ? 'tutto il resto è cifrato con K_S' : RXNEED[RX[pos].id]}.`;
    }
    m = /^rx\.k\.(\w+)$/.exec(key);
    if (m) return keyWhy(RX.find(a => a.id === m[1]).key, v, true);
    if (key === 'rx.res') return RES_WHY[v] || null;
    m = /^q\.(\d+)$/.exec(key);
    if (m) {
      const it = ex.items[Number(m[1]) - 1], i = LETTERS.indexOf(v);
      return it && i >= 0 && i < it.opts.length && i !== it.ok ? it.opts[i].err : null;
    }
    return null;
  }

  function diagnoseCases(ex) {
    const r = ex.rsa, out = [];
    if (r) {
      out.push({ key: 'rsa.z', value: String(r.n), expect: 'non è p·q' });
      out.push({ key: 'rsa.z', value: String((r.p + 1) * (r.q + 1)), expect: 'p+1' });
      out.push({ key: 'rsa.n', value: String(r.z), expect: 'hai calcolato z' });
      out.push({ key: 'rsa.c', value: String(BigInt(r.m) ** BigInt(r.e)), expect: 'manca il mod n' });
      out.push({ key: 'rsa.c', value: String(powmod(r.m, r.d, r.n)), expect: 'hai cifrato con d' });
      out.push({ key: 'rsa.c', value: String((r.m * r.e) % r.n), expect: 'moltiplicato' });
      if (r.askD) {
        const dn = inv(r.e, r.n);
        if (dn) out.push({ key: 'rsa.d', value: String(dn), expect: 'mod n invece che mod z' });
        if ((r.e * r.e) % r.z === 1) out.push({ key: 'rsa.d', value: String(r.e), expect: 'chiave privata è uguale alla pubblica' });
      }
      if (r.askDec) out.push({ key: 'rsa.m2', value: String(powmod(r.c, r.e, r.n)), expect: 'hai usato e' });
      if (r.askSign) {
        out.push({ key: 'rsa.s', value: String(powmod(r.mf, r.e, r.n)), expect: 'chiave pubblica' });
        out.push({ key: 'rsa.v', value: String(powmod(r.s, r.d, r.n)), expect: 'verificato con la privata' });
      }
      if (r.alt) r.alt.filter(x => x !== r.altOk).forEach(x => out.push({ key: 'rsa.e2', value: String(x), expect: x === 1 ? 'e = 1' : 'coprimo' }));
    }
    if (ex.pgp) {
      out.push({ key: 'pgp.H.prop', value: 'conf', expect: 'integrità e riservatezza scambiate' });
      out.push({ key: 'pgp.KS.prop', value: 'int', expect: 'integrità e riservatezza scambiate' });
      out.push({ key: 'pgp.KA.key', value: 'KA+', expect: 'pubblica e privata scambiate' });
      out.push({ key: 'pgp.KB.key', value: 'KB-', expect: 'Alice non ce l\'ha' });
      out.push({ key: 'pgp.H.key', value: 'KA-', expect: 'non usa chiavi' });
    }
    if (ex.rx) {
      out.push({ key: 'rx.1', value: 'dec', expect: 'serve K_S' });
      out.push({ key: 'rx.4', value: 'ks', expect: 'va fatto prima' });
      out.push({ key: 'rx.k.ks', value: 'KB+', expect: 'pubblica e privata scambiate' });
      out.push({ key: 'rx.k.sig', value: 'KA-', expect: 'Bob non ce l\'ha' });
      out.push({ key: 'rx.res', value: 'conf', expect: 'riservatezza non si verifica' });
    }
    ex.items.forEach((it, i) => {
      const w = it.opts.findIndex((_, j) => j !== it.ok);
      out.push({ key: qKey(i), value: LETTERS[w], expect: it.opts[w].err.slice(0, 40) });
    });
    // tieni solo i casi davvero sbagliati e riconosciuti (con numeri piccoli due errori possono coincidere)
    return out.filter(dc => !isRight(ex, dc.key, dc.value) && (diagnose(ex, dc.key, dc.value, {}) || '').toLowerCase().includes(dc.expect.toLowerCase()));
  }

  // ---------------- aiuti ----------------
  function fieldHint(ex, key) {
    const r = ex.rsa;
    const H = {
      'rsa.n': 'Il modulo è il prodotto dei due primi.',
      'rsa.z': 'Togli 1 a ciascun primo e moltiplica.',
      'rsa.d': 'Cerca k = 1, 2, 3… finché k·z + 1 è divisibile per e: d = (k·z + 1)/e. Scarta d = e.',
      'rsa.e2': 'Un esponente valido è maggiore di 1 e non ha divisori in comune con z (mcd = 1). Ricorda che z è pari.',
      'rsa.c': 'Chiave pubblica (n, e): eleva m alla e e riduci mod n a ogni moltiplicazione.',
      'rsa.m2': 'Chiave privata (n, d): eleva c alla d con i quadrati successivi, sempre mod n.',
      'rsa.s': 'La firma la può calcolare solo il proprietario: quale chiave ha solo lui?',
      'rsa.v': 'La verifica la fa chiunque: quale chiave è nota a tutti?',
      'rx.res': 'Il confronto riguarda il digest: che cosa cambierebbe se Trudy modificasse m o firmasse al posto di Alice?'
    };
    if (H[key]) return H[key] + (r && key === 'rsa.c' ? ` Qui: ${r.m}^${r.e} mod ${r.n}.` : '');
    let m = /^pgp\.(\w+)\.(prop|key)$/.exec(key);
    if (m) {
      const b = BLOCKS.find(x => x.id === m[1]);
      return m[2] === 'prop'
        ? `Blocco ${b.name}: che cosa perderebbe Alice se lo togliesse? Chi riesce a leggere o a produrre il suo risultato?`
        : `Blocco ${b.name}: guarda il simbolo nella figura. Chi applica il blocco (Alice) può usare solo chiavi pubbliche altrui, le sue o K_S.`;
    }
    m = /^rx\.(\d)$/.exec(key);
    if (m) return `Posizione ${m[1]}: Bob disfa lo schema all'indietro. Di che cosa ha bisogno ogni azione per poter partire?`;
    m = /^rx\.k\.(\w+)$/.exec(key);
    if (m) return 'Per tornare indietro da una cifratura si usa l\'altra chiave della stessa coppia (o la stessa K_S, che è simmetrica). Bob ha solo le chiavi pubbliche altrui, la sua privata e K_S.';
    m = /^q\.(\d+)$/.exec(key);
    if (m) { const it = ex.items[Number(m[1]) - 1]; return it ? it.hint : 'Rileggi la domanda.'; }
    return 'Rileggi il testo della domanda.';
  }

  function dSearchTxt(r) {
    return dRows(r.e, r.z).map(x => `k = ${x.k}: ${x.k}·${r.z} + 1 = ${x.v}` + (x.div ? ` → /${r.e} = ${x.dd}` + (x.skip ? ' (= e, scartato)' : ' ✓') : ` → non divisibile per ${r.e}`)).join('\n');
  }
  function powTxt(b, e, n) {
    const ps = powSteps(b, e, n);
    const sq = ps.rows.map(x => `${b}^${x.p} mod ${n} = ${x.v}${x.used ? ' ●' : ''}`).join('\n');
    const ch = ps.chain.map(c => `${c.acc}·${c.f} = ${c.raw} → mod ${n} = ${c.res}`).join('\n');
    return `${e} = ${e.toString(2)}₂ = ${ps.rows.filter(x => x.used).map(x => x.p).join(' + ')}\n${sq}\nProdotto dei termini ●:\n${ch}`;
  }
  function hints(ex) {
    const r = ex.rsa, k = keysOf(ex), H = [];
    if (k.key.length) {
      H.push({
        step: 'key', title: STEP_T.key,
        metodo: 'n = p·q è il modulo (pubblico). z = (p−1)(q−1) resta segreto. e deve essere maggiore di 1 e coprimo con z. d è l\'inverso di e modulo z: e·d mod z = 1. Per trovarlo prova k = 1, 2, 3…: il primo k·z + 1 divisibile per e dà d = (k·z + 1)/e (se viene d = e, scartalo: la chiave privata sarebbe uguale alla pubblica).',
        applicato: `n = ${r.p}·${r.q}; z = (${r.p}−1)·(${r.q}−1). ` + (r.askD ? `Poi cerca il primo k con k·z + 1 divisibile per ${r.e}.` : `d = ${r.d} è dato: controlla che ${r.e}·${r.d} mod z faccia 1.`) +
          (r.alt ? ` Per l'altro esponente scomponi z in fattori e scarta i valori che ne condividono uno.` : ''),
        svolto: `n = ${r.n}; z = ${r.p - 1}·${r.q - 1} = ${r.z}.\n${dSearchTxt(r)}\nd = ${r.d}` + (r.alt ? `\nEsponente alternativo valido: ${r.altOk} (mcd(${r.altOk}, ${r.z}) = 1).` : '')
      });
    }
    if (k.enc.length) {
      H.push({
        step: 'enc', title: STEP_T.enc,
        metodo: 'Si cifra con la chiave pubblica (n, e): c = m^e mod n. Si decifra con la privata (n, d): m = c^d mod n. Con esponenti grandi usa i quadrati successivi e riduci mod n a ogni passo: il risultato non cambia e i numeri restano piccoli.',
        applicato: `c = ${r.m}^${r.e} mod ${r.n}.` + (r.askDec ? ` Poi c^d mod ${r.n} con il d trovato: deve tornare ${r.m}.` : ''),
        svolto: `c: ${powTxt(r.m, r.e, r.n)}` + (r.askDec ? `\n\nm: ${powTxt(r.c, r.d, r.n)}` : '')
      });
    }
    if (k.sign.length) {
      H.push({
        step: 'sign', title: STEP_T.sign,
        metodo: 'Firmare è applicare la chiave PRIVATA: s = m^d mod n, che solo il proprietario sa calcolare. Chiunque verifica con la pubblica: s^e mod n deve ridare m. Funziona perché K⁺(K⁻(m)) = m = K⁻(K⁺(m)).',
        applicato: `s = ${r.mf}^d mod ${r.n}; verifica: s^${r.e} mod ${r.n}.`,
        svolto: `s: ${powTxt(r.mf, r.d, r.n)}\n\nverifica: ${powTxt(r.s, r.e, r.n)}`
      });
    }
    if (k.pgp.length) {
      H.push({
        step: 'pgp', title: STEP_T.pgp,
        metodo: 'Per ogni blocco chiediti chi lo applica, con quale chiave, e chi può leggere o produrre il risultato. Hash → integrità. Cifrare con la propria privata → autenticazione (firma). Cifrare con K_S → riservatezza del messaggio. Cifrare K_S con la pubblica del destinatario → solo lui legge K_S.',
        applicato: 'I blocchi li applica tutti Alice: può usare solo la sua privata K_A⁻, le chiavi pubbliche (K_B⁺) e la chiave di sessione K_S che ha generato. H(·) non ha chiave.',
        svolto: BLOCKS.map(b => `${b.name}: ${PROPS.find(x => x[0] === b.prop)[1]} · chiave ${KNAME[b.key]}`).join('\n')
      });
    }
    if (k.rx.length) {
      H.push({
        step: 'rx', title: STEP_T.rx,
        metodo: 'Bob disfa lo schema all\'indietro: prima la chiave di sessione, poi il blocco cifrato, poi la firma, infine il confronto dei digest. Per ogni cifratura usa l\'altra chiave della coppia (K_S è simmetrica: la stessa).',
        applicato: 'K_S è cifrata con K_B⁺; il blocco con K_S; la firma con K_A⁻; H non ha chiave. Che cosa serve per aprire ciascuno?',
        svolto: RX.map((a, i) => `${i + 1}) ${a.t} — chiave ${KNAME[a.key]}: ${a.res}`).join('\n') + '\nDigest uguali ⇒ integrità e autenticità (non ripudio).'
      });
    }
    if (ex.items.length) {
      H.push({
        step: 'q', title: STEP_T.q,
        metodo: 'Hash: lunghezza fissa, non invertibile, collisioni impossibili da trovare. CA: firma con la sua privata il legame identità ↔ chiave pubblica; si verifica con la pubblica della CA; protegge dal man-in-the-middle. Nonce: numero usato una volta, contro il playback. DES 56 bit, AES 128/192/256, RSA ~100 volte più lento.',
        applicato: ex.items.map((it, i) => `${i + 1}. ${it.hint}`).join('\n'),
        svolto: ex.items.map((it, i) => `${i + 1}. ${LETTERS[it.ok]}) ${it.opts[it.ok].t} — ${it.why}`).join('\n')
      });
    }
    return H;
  }

  // ---------------- figura PGP ----------------
  // K con pedice e apice in SVG; "after" resta sulla linea di base
  const sK = (sub, sup, after) => sup
    ? `K<tspan dy="4" font-size="9">${sub}</tspan><tspan dy="-11" font-size="11">${sup}</tspan><tspan dy="7">${after || ''}</tspan>`
    : `K<tspan dy="4" font-size="9">${sub}</tspan><tspan dy="-4">${after || ''}</tspan>`;
  function figure() {
    const L = [];
    const box = (id, x, y, w, label, n) => {
      L.push(`<rect x="${x}" y="${y}" width="${w}" height="32" rx="5" class="box"/>`);
      L.push(`<text x="${x + w / 2}" y="${y + 21}" text-anchor="middle" class="lbl b">${label}</text>`);
      L.push(`<circle cx="${x}" cy="${y}" r="8" class="flow-dot"/><text x="${x}" y="${y + 4}" text-anchor="middle" class="flow-n">${n}</text>`);
    };
    const arr = (d, dashed) => L.push(`<path d="${d}" class="${dashed ? 'arrow back' : 'arrow'}" marker-end="url(#${dashed ? 'ah-pgp-b' : 'ah-pgp'})"/>`);
    const plus = (x, y) => { L.push(`<circle cx="${x}" cy="${y}" r="11" class="box"/>`); L.push(`<text x="${x}" y="${y + 5}" text-anchor="middle" class="lbl b">+</text>`); };
    L.push('<svg viewBox="0 0 640 274" class="fig" role="img" aria-label="Schema PGP: m passa per H e K_A meno, si unisce a m, viene cifrato con K_S; K_S viene cifrata con K_B più; tutto va su Internet">');
    L.push(U.svgArrowDefs('ah-pgp'));
    L.push(U.svgArrowDefs('ah-pgp-b').replace('class="ah"', 'class="ah2"'));
    L.push('<text x="8" y="16" class="side">ALICE (mittente)</text>');
    // riga alta: m → H → K_A⁻
    L.push('<text x="24" y="66" class="lbl b">m</text>');
    arr('M40,62 L72,62');
    box('H', 74, 46, 64, 'H(·)', 1);
    arr('M138,62 L160,62');
    box('KA', 162, 46, 78, sK('A', '−', '(·)'), 2);
    L.push(`<text x="201" y="22" text-anchor="middle" class="lbl">${sK('A', '−')}</text>`);
    arr('M201,28 L201,44', true);
    L.push(`<text x="250" y="52" class="lbl small">${sK('A', '−', '(H(m))')}</text>`);
    arr('M240,62 L300,62 L300,97');
    // m sotto, fino al primo "+"
    L.push('<text x="24" y="156" class="lbl b">m</text>');
    arr('M40,152 L300,152 L300,123');
    plus(300, 110);
    arr('M311,110 L340,110');
    box('KS', 342, 94, 78, sK('S', null, '(·)'), 3);
    L.push(`<text x="381" y="72" text-anchor="middle" class="lbl">${sK('S')}</text>`);
    arr('M381,77 L381,92', true);
    arr('M420,110 L500,110 L500,147');
    plus(500, 160);
    // K_S → K_B⁺
    L.push(`<text x="300" y="222" class="lbl">${sK('S')}</text>`);
    arr('M320,218 L340,218');
    box('KB', 342, 202, 78, sK('B', '+', '(·)'), 4);
    L.push(`<text x="381" y="268" text-anchor="middle" class="lbl">${sK('B', '+')}</text>`);
    arr('M381,252 L381,236', true);
    L.push(`<text x="428" y="240" class="lbl small">${sK('B', '+', '(K')}<tspan dy="4" font-size="9">S</tspan><tspan dy="-4">)</tspan></text>`);
    arr('M420,218 L500,218 L500,173');
    // → Internet
    arr('M511,160 L546,160');
    L.push('<ellipse cx="590" cy="160" rx="44" ry="24" class="cloud"/>');
    L.push('<text x="590" y="164" text-anchor="middle" class="lbl small">Internet</text>');
    L.push('</svg>');
    return L.join('');
  }

  // ---------------- testo ----------------
  function rsaText(ex) {
    const r = ex.rsa;
    let t = `Bob genera la sua coppia di chiavi RSA con i primi p = ${r.p} e q = ${r.q} ed esponente pubblico e = ${r.e}.`;
    if (r.giveD) t += ` La sua chiave privata è d = ${r.d}.`;
    t += ` Alice vuole inviargli il messaggio m = ${r.m}.`;
    if (r.askSign) t += ` Bob poi firma con RSA il messaggio di risposta m' = ${r.mf}.`;
    return t;
  }
  const PGP_TXT = 'Lo schema riassume il meccanismo PGP per l\'invio di mail sicure (m = messaggio; H = hash; K_A⁻ = chiave privata di Alice; K_B⁺ = chiave pubblica di Bob; K_S = chiave di sessione).';
  const optsOf = it => it.opts.map((o, j) => [LETTERS[j], `${LETTERS[j]}) ${o.t}`]);
  const rxOptions = ex => ex.rxOrd.map(id => [id, RX.find(a => a.id === id).t]);

  function render(ex, root, ctx) {
    const r = ex.rsa, k = keysOf(ex);
    const intro = [U.h('p', {}, U.h('b', {}, 'Testo. '), r ? rsaText(ex) : PGP_TXT)];
    if (r && ex.pgp) intro.push(U.h('p', {}, PGP_TXT));
    if (ex.pgp) intro.push(U.fig(figure(), 'Blocchi numerati: 1 H(·), 2 K_A⁻(·), 3 K_S(·), 4 K_B⁺(·). Frecce tratteggiate: la chiave usata dal blocco.'));
    root.appendChild(U.h('div', { class: 'card intro' }, intro));
    const n = (key, label, ph) => U.row(label, U.inp(ctx, key, { w: 's', label, ph }));
    if (k.key.length) {
      root.appendChild(U.card('a) Chiavi di Bob', { step: 'key' },
        n('rsa.n', 'n = p·q'), n('rsa.z', 'z = (p−1)·(q−1)'),
        r.askD ? n('rsa.d', 'd (con e·d mod z = 1)') : null,
        r.alt ? U.h('div', { class: 'q-item' }, U.h('div', { class: 'q-text' }, `Quale di questi valori sarebbe stato anche un esponente pubblico valido al posto di e = ${r.e}?`),
          U.sel(ctx, 'rsa.e2', r.alt.map(v => [String(v), String(v)]), { label: 'esponente alternativo', w: 's' })) : null));
    }
    if (k.enc.length) {
      root.appendChild(U.card(r.askDec ? 'b) Cifratura di m e verifica della decifratura' : 'b) Cifratura di m', { step: 'enc' },
        n('rsa.c', 'c = m^e mod n'), r.askDec ? n('rsa.m2', 'decifratura: c^d mod n') : null));
    }
    if (k.sign.length) {
      root.appendChild(U.card(`c) Firma RSA di m' = ${r.mf}`, { step: 'sign' },
        n('rsa.s', 'firma s'), n('rsa.v', 'verifica della firma')));
    }
    if (ex.pgp) {
      root.appendChild(U.card('Schema PGP: che cosa garantisce ogni blocco e con quale chiave', { step: 'pgp' },
        U.table(['Blocco', 'Cosa garantisce', 'Chiave usata'], BLOCKS.map((b, i) => [U.label(`${i + 1} · ${b.name}`),
          U.sel(ctx, `pgp.${b.id}.prop`, PROPS, { label: `blocco ${b.name}, proprietà` }),
          U.sel(ctx, `pgp.${b.id}.key`, KEYS, { label: `blocco ${b.name}, chiave` })]))));
    }
    if (ex.rx) {
      root.appendChild(U.card('Bob riceve il messaggio: i passi in ordine e la chiave di ogni azione', { step: 'rx' },
        U.table(['Passo', 'Azione'], [1, 2, 3, 4].map(i => [U.label(`${i}`), U.sel(ctx, `rx.${i}`, rxOptions(ex), { label: `passo ${i} di Bob` })])),
        U.table(['Azione', 'Chiave usata'], ex.rxOrd.map(id => [U.label(RX.find(a => a.id === id).t), U.sel(ctx, `rx.k.${id}`, KEYS, { label: `chiave per: ${id}` })])),
        U.h('div', { class: 'q-item' }, U.h('div', { class: 'q-text' }, 'Se i due digest coincidono, che cosa sa Bob?'),
          U.sel(ctx, 'rx.res', RES_OPTS, { label: 'esito del confronto' }))));
    }
    if (ex.items.length) {
      root.appendChild(U.card('Domande', { step: 'q' },
        ex.items.map((it, i) => U.h('div', { class: 'q-item' },
          U.h('div', { class: 'q-text' }, `${i + 1}. [${TOPICS[it.topic]}] ${it.q}`),
          U.sel(ctx, qKey(i), optsOf(it), { label: `domanda ${i + 1}` })))));
    }
  }

  function solution(ex, root) {
    const r = ex.rsa, kids = [U.h('h4', {}, 'Soluzione')];
    const pre = t => U.h('pre', {}, t);
    if (r) {
      kids.push(U.h('p', { class: 'sol-body' }, U.h('b', {}, 'Chiavi. '), `n = ${r.p}·${r.q} = ${r.n}; z = (${r.p}−1)·(${r.q}−1) = ${r.p - 1}·${r.q - 1} = ${r.z}. e = ${r.e} è coprimo con ${r.z} (mcd = 1), quindi d esiste.`));
      kids.push(U.h('p', { class: 'sol-body' }, `Ricerca di d (e·d mod z = 1 ⇔ e·d = k·z + 1):`));
      kids.push(U.table(['k', 'k·z + 1', `diviso per e = ${r.e}`], dRows(r.e, r.z).map(x => [String(x.k), String(x.v), x.div ? (x.skip ? `${x.dd} = e: scartato (privata = pubblica)` : `${x.dd} ✓`) : 'non divisibile'])));
      kids.push(U.h('p', { class: 'sol-body' }, `d = ${r.d}. Chiave pubblica K_B⁺ = (n, e) = (${r.n}, ${r.e}); chiave privata K_B⁻ = (n, d) = (${r.n}, ${r.d}).`));
      if (r.alt) kids.push(U.h('p', { class: 'sol-body' }, U.h('b', {}, 'Esponente alternativo. '), r.alt.map(v => v === r.altOk ? `${v}: mcd(${v}, ${r.z}) = 1 ✓` : v === 1 ? '1: non cifra (serve e > 1)' : `${v}: mcd(${v}, ${r.z}) = ${gcd(v, r.z)} ✗`).join(' · ')));
      kids.push(U.h('p', { class: 'sol-body' }, U.h('b', {}, 'Cifratura '), `con la pubblica: c = ${r.m}^${r.e} mod ${r.n} = ${r.c}. Quadrati successivi, riducendo mod n a ogni passo:`), pre(powTxt(r.m, r.e, r.n)));
      if (r.askDec) kids.push(U.h('p', { class: 'sol-body' }, U.h('b', {}, 'Decifratura '), `con la privata: ${r.c}^${r.d} mod ${r.n} = ${r.m} ✓ (si ritrova m).`), pre(powTxt(r.c, r.d, r.n)));
      if (r.askSign) {
        kids.push(U.h('p', { class: 'sol-body' }, U.h('b', {}, 'Firma '), `con la privata (solo Bob la sa fare): s = ${r.mf}^${r.d} mod ${r.n} = ${r.s}.`), pre(powTxt(r.mf, r.d, r.n)));
        kids.push(U.h('p', { class: 'sol-body' }, U.h('b', {}, 'Verifica '), `con la pubblica (la fa chiunque): ${r.s}^${r.e} mod ${r.n} = ${r.mf} ✓.`), pre(powTxt(r.s, r.e, r.n)));
      }
    }
    if (ex.pgp) {
      kids.push(U.h('p', { class: 'sol-body' }, U.h('b', {}, 'Schema PGP. '), 'Alice invia K_S(m, K_A⁻(H(m))) insieme a K_B⁺(K_S). Usa tre chiavi: la sua privata, la pubblica di Bob e la chiave di sessione.'));
      kids.push(U.table(['Blocco', 'Garantisce', 'Chiave', 'Perché'], BLOCKS.map((b, i) => [U.label(`${i + 1} · ${b.name}`), PROPS.find(x => x[0] === b.prop)[1], KNAME[b.key], b.why])));
    }
    if (ex.rx) {
      kids.push(U.h('p', { class: 'sol-body' }, U.h('b', {}, 'Passi di Bob '), '(lo schema percorso all\'indietro):'));
      kids.push(U.table(['#', 'Azione', 'Chiave', 'Risultato'], RX.map((a, i) => [String(i + 1), a.t, KNAME[a.key], a.res])));
      kids.push(U.h('p', { class: 'sol-body' }, msgOf(ex, 'rx.res')));
    }
    if (ex.items.length) {
      kids.push(U.h('p', { class: 'sol-body' }, U.h('b', {}, 'Domande')));
      ex.items.forEach((it, i) => kids.push(U.h('div', { class: 'q-item' },
        U.h('div', { class: 'q-text' }, `${i + 1}. ${it.q}`),
        U.h('p', { class: 'sol-body' }, U.h('b', {}, `${LETTERS[it.ok]}) ${it.opts[it.ok].t}. `), it.why),
        U.h('p', { class: 'small' }, 'Le altre: ' + it.opts.map((o, j) => j === it.ok ? null : `${LETTERS[j]}) ${o.err}`).filter(Boolean).join(' · ')))));
    }
    root.appendChild(U.h('div', { class: 'card sol' }, kids));
  }

  function chatText(ex, a) {
    a = a || {};
    const v = k => String(a[k] == null ? '' : a[k]).trim() || '__';
    const lab = (opts, k) => { const o = opts.find(x => x[0] === a[k]); return o ? o[1] : '__'; };
    const r = ex.rsa, L = [];
    L.push(`#4 · Crittografia: RSA, firma e PGP (livello ${ex.level})`);
    L.push('## Testo');
    if (r) L.push(rsaText(ex));
    if (ex.pgp) L.push(PGP_TXT + ' Schema: m → H(·) → K_A⁻(·) → K_A⁻(H(m)); "+" con m → K_S(·); "+" con K_B⁺(K_S), ottenuto da K_S → K_B⁺(·); → Internet.');
    L.push('');
    L.push('## Le mie risposte');
    if (r) {
      L.push(`- n = ${v('rsa.n')} · z = ${v('rsa.z')}` + (r.askD ? ` · d = ${v('rsa.d')}` : ` · (d = ${r.d} dato)`));
      if (r.alt) L.push(`- Esponente alternativo valido tra ${r.alt.join(', ')}: ${v('rsa.e2')}`);
      L.push(`- c = m^e mod n = ${v('rsa.c')}` + (r.askDec ? ` · decifratura c^d mod n = ${v('rsa.m2')}` : ''));
      if (r.askSign) L.push(`- Firma di m' = ${r.mf}: s = ${v('rsa.s')} · verifica = ${v('rsa.v')}`);
    }
    if (ex.pgp) BLOCKS.forEach(b => L.push(`- Blocco ${b.name}: garantisce ${lab(PROPS, `pgp.${b.id}.prop`)} · chiave ${lab(KEYS, `pgp.${b.id}.key`)}`));
    if (ex.rx) {
      [1, 2, 3, 4].forEach(i => L.push(`- Bob, passo ${i}: ${lab(rxOptions(ex), `rx.${i}`)}`));
      RX.forEach(x => L.push(`- Chiave per "${x.t}": ${lab(KEYS, `rx.k.${x.id}`)}`));
      L.push(`- Se i digest coincidono: ${lab(RES_OPTS, 'rx.res')}`);
    }
    ex.items.forEach((it, i) => {
      L.push(`${i + 1}. [${TOPICS[it.topic]}] ${it.q}`);
      it.opts.forEach((o, j) => L.push(`   ${LETTERS[j]}) ${o.t}`));
      const j = LETTERS.indexOf(String(a[qKey(i)] || '').trim());
      L.push(`   Mia risposta: ${j >= 0 && j < it.opts.length ? LETTERS[j] : '__'}`);
    });
    return L.join('\n');
  }

  // ---------------- tracce ----------------
  const PGP_EXPECT = {
    'pgp.H.prop': 'int', 'pgp.H.key': 'none', 'pgp.KA.prop': 'auth', 'pgp.KA.key': 'KA-',
    'pgp.KS.prop': 'conf', 'pgp.KS.key': 'KS', 'pgp.KB.prop': 'keyd', 'pgp.KB.key': 'KB+',
    'rx.1': 'ks', 'rx.2': 'dec', 'rx.3': 'sig', 'rx.4': 'cmp',
    'rx.k.ks': 'KB-', 'rx.k.dec': 'KS', 'rx.k.sig': 'KA+', 'rx.k.cmp': 'none', 'rx.res': 'ok'
  };

  RA.crypto = {
    id: 'crypto', num: '4', name: 'Crittografia: RSA, firma e PGP', part: 2, examPoints: 6, extra: false,
    desc: 'Chiavi RSA con primi piccoli (n, z, d), cifratura e firma, i blocchi dello schema PGP e i passi del destinatario.',
    method: {
      intro: 'Due parti indipendenti. RSA è un conto: n, z, d e poi potenze modulo n, riducendo a ogni passo. PGP è un ragionamento sulle chiavi: per ogni blocco chiediti chi lo applica, con quale chiave e chi può leggere o produrre il risultato.',
      steps: [
        'Chiavi: n = p·q, z = (p−1)(q−1). Controlla che e sia coprimo con z. Trova d con la tabella k·z + 1: il primo valore divisibile per e (diverso da e·e) dà d = (k·z + 1)/e.',
        'Cifratura con la pubblica (n, e): c = m^e mod n. Decifratura con la privata (n, d): c^d mod n deve ridare m. Usa i quadrati successivi: m, m², m⁴, … tutti mod n, poi moltiplica quelli dei bit a 1.',
        'Firma con la privata: s = m^d mod n. Verifica con la pubblica: s^e mod n = m.',
        'PGP, mittente: H(·) integrità; K_A⁻(·) firma = autenticazione e non ripudio; K_S(·) riservatezza del messaggio; K_B⁺(·) consegna K_S solo a Bob.',
        'PGP, destinatario: 1) K_B⁻ apre K_B⁺(K_S); 2) K_S decifra m e la firma; 3) K_A⁺ apre la firma → H(m); 4) Bob calcola H(m) sul messaggio ricevuto e confronta: uguali ⇒ integro e di Alice.'
      ],
      traps: [
        'z = (p−1)(q−1), non p·q: d si calcola modulo z, non modulo n.',
        'Si cifra con e (pubblica del destinatario), si firma con d (privata del mittente). Scambiarle annulla la sicurezza.',
        'Se e·e mod z = 1 il primo d trovato è e stesso: scartalo (chiave privata = pubblica), come nell\'esempio p = 5, q = 7, e = 5 → d = 29.',
        'e non deve avere fattori in comune con z: un e pari non va mai bene (z è pari).',
        'L\'hash non usa chiavi e non si inverte: Bob lo ricalcola e confronta.',
        'L\'integrità la dà l\'hash, la riservatezza la cifratura con K_S: non scambiarle.'
      ],
      formulas: [
        ['Chiavi RSA', 'n = p·q · z = (p−1)(q−1) · mcd(e, z) = 1 · e·d mod z = 1'],
        ['Cifra / decifra', 'c = m^e mod n · m = c^d mod n'],
        ['Firma / verifica', 's = m^d mod n · s^e mod n = m'],
        ['Proprietà', 'K⁻(K⁺(m)) = m = K⁺(K⁻(m)) · (a mod n)·(b mod n) mod n = a·b mod n'],
        ['PGP inviato', 'K_S(m, K_A⁻(H(m))) + K_B⁺(K_S)'],
        ['Lunghezze', 'MD5 128 bit · SHA-256 256 bit · DES 56 bit · AES 128/192/256 bit'],
        ['Velocità', 'DES almeno ~100 volte più veloce di RSA → RSA solo per la chiave di sessione']
      ]
    },
    traces: [
      {
        id: 'sim-crypto', set: 'simulato',
        title: 'Esame simulato · RSA e PGP (p=5, q=11)',
        source: 'Esame_Simulato_2_TESTO.pdf, esercizio 4',
        params: {
          level: 4, rsa: { p: 5, q: 11, e: 3, m: 8, giveD: false, askD: true, askDec: true, askSign: false, mf: null, alt: null },
          pgp: true, rx: true, rxOrd: ['dec', 'cmp', 'ks', 'sig'],
          qs: [{ id: 'hash-coll', ord: [1, 0, 2, 3] }, { id: 'ca-what', ord: [2, 3, 0, 1] }]
        },
        expect: Object.assign({ 'rsa.n': '55', 'rsa.z': '40', 'rsa.d': '27', 'rsa.c': '17', 'rsa.m2': '8', 'q.1': 'b', 'q.2': 'c' }, PGP_EXPECT)
      },
      {
        id: 'guida5-rsa',
        title: 'Guida 5 · RSA (p=5, q=7)',
        source: 'Guida_5_Crittografia_RSA_PGP.pdf',
        params: { level: 3, rsa: { p: 5, q: 7, e: 5, m: 12, giveD: false, askD: true, askDec: true, askSign: false, mf: null, alt: null }, pgp: false, rx: false, qs: [] },
        expect: { 'rsa.n': '35', 'rsa.z': '24', 'rsa.d': '29', 'rsa.c': '17', 'rsa.m2': '12' }
      },
      {
        id: 'pdf-pgp',
        title: 'Esercizi seconda parte · schema PGP',
        source: 'Esercizi seconda parte.pdf, pag. 1',
        params: { level: 4, rsa: null, pgp: true, rx: true, rxOrd: ['sig', 'ks', 'cmp', 'dec'], qs: [] },
        expect: PGP_EXPECT
      }
    ],
    randomParams, build, gen, steps, grade, sol2answers, render, solution, hints, fieldHint, diagnose, diagnoseCases, chatText
  };
})();
