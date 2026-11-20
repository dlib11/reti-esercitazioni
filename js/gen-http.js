// ============================================================
// RetiApp · gen-http.js — Esercizio 6 · HTTP: dalla URL alla pagina
// Modulo di riferimento per il contratto in docs/moduli.md
// ============================================================
(function () {
  const RA = window.RetiApp;
  const U = RA.util;

  const HOSTS = ['www.reti.it', 'www.unidemo.it', 'www.ateneo-demo.it', 'www.biblio-demo.org', 'www.musei-demo.it', 'www.sport-demo.com'];
  const PATHS = ['corsi/reti.html', 'index.html', 'news/oggi.html', 'didattica/esami.html', 'orari.html', 'eventi/2026.html'];
  const CDNS = ['img.cdn-demo.com', 'static.cdn-net.org', 'media.fotohost.net', 'cdn.imgserver.it'];
  const IMGS = ['logo.png', 'foto1.jpg', 'banner.gif', 'mappa.png', 'grafico.png', 'foto2.jpg', 'icona.png'];

  // ---------------- parametri e costruzione ----------------
  function randomParams(level) {
    const host = U.pick(HOSTS);
    const path = U.pick(PATHS);
    let nImg, nCdn, https = false, askTimes = false, pipelining = false;
    if (level <= 1) { nImg = U.rndInt(1, 2); nCdn = 0; }
    else if (level === 2) { nImg = U.rndInt(2, 3); nCdn = 1; }
    else if (level === 3) { nImg = U.rndInt(3, 4); nCdn = 1; askTimes = true; }
    else if (level === 4) { nImg = U.rndInt(3, 5); nCdn = 2; https = U.chance(0.5); askTimes = !https; }
    else { nImg = U.rndInt(4, 6); nCdn = 2; askTimes = true; pipelining = true; }
    const cdns = U.sample(CDNS, nCdn);
    const names = U.sample(IMGS, nImg);
    // almeno un'immagine sul server della pagina e almeno una su ogni CDN
    const hostsOfImg = names.map((_, i) => i < nCdn ? cdns[i] : (i === nCdn ? host : U.pick([host].concat(cdns))));
    const images = U.shuffle(names.map((name, i) => ({ name, host: hostsOfImg[i] })));
    return { level, host, path, https, images, askTimes, pipelining };
  }

  function build(p) {
    const port = p.https ? 443 : 80;
    const hosts = [p.host];
    p.images.forEach(im => { if (!hosts.includes(im.host)) hosts.push(im.host); });
    const H = hosts.length;                 // host distinti
    const O = 1 + p.images.length;          // oggetti: pagina + immagini
    const perHost = hosts.map(h => ({ host: h, objs: (h === p.host ? 1 : 0) + p.images.filter(i => i.host === h).length }));
    const sol = { dnsNp: H, dnsP: H, tcpNp: O, tcpP: H };
    // tempi in RTT (connessioni in serie, DNS = 1 RTT per host, trasmissione trascurata)
    const own = p.images.filter(i => i.host === p.host).length;
    sol.tNp = H + 2 * O;
    sol.tP = H + H + O;
    sol.tPipe = H + U.sum(perHost.map(x => 1 + (x.host === p.host ? 1 + (own ? 1 : 0) : 1)));
    return {
      cat: 'http', level: p.level, params: p,
      host: p.host, path: p.path, https: p.https, port,
      url: `${p.https ? 'https' : 'http'}://${p.host}/${p.path}`,
      images: p.images, hosts, perHost, H, O, own,
      askTimes: !!p.askTimes, pipelining: !!p.pipelining, sol
    };
  }
  const gen = level => build(randomParams(level));

  // ---------------- passi ----------------
  const NUMS = ['dnsNp', 'tcpNp', 'dnsP', 'tcpP'];
  function timeKeys(ex) { return ex.askTimes ? (ex.pipelining ? ['tNp', 'tP', 'tPipe'] : ['tNp', 'tP']) : []; }
  function steps(ex) {
    const s = [
      { id: 'a', title: 'Prima della richiesta', keys: ['oa'] },
      { id: 'b', title: 'Richiesta', keys: ['ob'] },
      { id: 'c', title: 'Risposta', keys: ['oc'] },
      { id: 'd', title: 'Conteggi DNS e TCP', keys: NUMS.slice() },
      { id: 'e', title: 'GET condizionale', keys: ['oe'] }
    ];
    if (ex.askTimes) s.push({ id: 'f', title: 'Tempi in RTT', keys: timeKeys(ex) });
    return s;
  }

  // ---------------- risposte aperte: punti chiave ----------------
  function openGroups(ex) {
    const oa = [
      { label: 'analisi della URL (host, porta, percorso)', any: ['url', 'percorso', 'path', 'host'] },
      { label: 'risoluzione DNS del nome', any: ['dns', 'risoluz', 'risolve'] },
      { label: 'cache e server DNS locale (root, TLD, autoritativo)', any: ['cache', 'locale', 'root', 'tld', 'autoritativ'] },
      { label: 'connessione TCP', any: ['tcp'] },
      { label: 'three-way handshake (SYN, SYN-ACK, ACK)', any: ['handshake', 'three-way', 'three way', '3-way', 'syn'] },
      { label: `porta ${ex.port}`, any: [String(ex.port)] }
    ];
    if (ex.https) oa.push({ label: 'handshake TLS (certificato, chiavi)', any: ['tls', 'ssl', 'certificat'] });
    return {
      oa,
      ob: [
        { label: `riga di richiesta: GET /${ex.path}`, any: ['get'] },
        { label: 'versione HTTP/1.1', any: ['http/1.1', '1.1'] },
        { label: `header Host: ${ex.host} (obbligatorio)`, any: ['host:', 'host'] },
        { label: 'altri header (User-Agent, Accept, Connection…)', any: ['user-agent', 'accept', 'connection', 'header', 'intestazion'] },
        { label: 'riga vuota alla fine degli header', any: ['riga vuota', 'linea vuota', 'crlf', 'vuota'] }
      ],
      oc: [
        { label: 'riga di stato HTTP/1.1 200 OK', any: ['200'] },
        { label: 'header (Date, Server, Last-Modified, Content-Type, Content-Length)', any: ['date', 'server', 'last-modified', 'content-type', 'content-length'] },
        { label: 'riga vuota', any: ['riga vuota', 'linea vuota', 'crlf', 'vuota'] },
        { label: 'corpo con l\'HTML della pagina', any: ['corpo', 'html', 'body'] }
      ],
      oe: [
        { label: 'GET condizionale', any: ['condizional', 'if-modified-since', 'if-none-match'] },
        { label: 'header If-Modified-Since con la data (o If-None-Match con l\'ETag)', any: ['if-modified-since', 'if-none-match', 'etag'] },
        { label: 'risposta 304 Not Modified', any: ['304'] },
        { label: 'corpo vuoto: il browser usa la copia in cache', any: ['cache', 'corpo vuoto', 'senza corpo', 'nessun corpo'] }
      ]
    };
  }
  const OPEN_INTRO = {
    oa: 'Servono: analisi della URL, DNS, connessione TCP con handshake.',
    ob: 'La richiesta ha riga di richiesta, header, riga vuota.',
    oc: 'La risposta ha riga di stato, header, riga vuota, corpo.',
    oe: 'Serve la GET condizionale e la risposta 304.'
  };

  // ---------------- correzione ----------------
  function numMsg(ex, k) {
    const s = ex.sol;
    return {
      dnsNp: `una risoluzione per ogni host distinto (${ex.hosts.join(', ')}) = ${s.dnsNp}`,
      dnsP: `il DNS non dipende dalla persistenza: ancora ${s.dnsP} host distinti`,
      tcpNp: `senza persistenza 1 connessione per OGGETTO: pagina + ${ex.images.length} immagini = ${s.tcpNp}`,
      tcpP: `con la persistenza 1 connessione per HOST: ${s.tcpP}`,
      tNp: `${ex.H} RTT di DNS + 2 RTT per ciascuno dei ${ex.O} oggetti = ${s.tNp} RTT`,
      tP: `${ex.H} RTT di DNS + ${ex.H} handshake (uno per host) + 1 RTT per ciascuno dei ${ex.O} oggetti = ${s.tP} RTT`,
      tPipe: `${ex.H} RTT di DNS + per ogni host: handshake + un "giro" per le richieste in pipeline (sul server della pagina prima la pagina, poi tutte le sue immagini insieme) = ${s.tPipe} RTT`
    }[k];
  }

  function grade(ex, a) {
    let correct = 0, total = 0;
    const marks = {};
    NUMS.concat(timeKeys(ex)).forEach(k => {
      total++;
      const ok = U.numEq(a[k], ex.sol[k]);
      if (ok) correct++;
      marks[k] = { ok, msg: numMsg(ex, k) };
    });
    const G = openGroups(ex);
    ['oa', 'ob', 'oc', 'oe'].forEach(k => {
      const g = U.gradeOpen(a[k], G[k], OPEN_INTRO[k]);
      total++;
      correct += g.part;
      marks[k] = { ok: g.part >= 1 - 1e-9 ? true : false, part: g.part, msg: g.msg };
      // "ok" pieno solo con tutti i punti chiave; parziale altrimenti (giallo)
    });
    return { correct, total, marks };
  }

  function sol2answers(ex) {
    const a = {
      oa: `Il browser analizza la URL: protocollo ${ex.https ? 'https' : 'http'}, quindi porta di default ${ex.port}; host ${ex.host}; percorso /${ex.path}. ` +
        `Risolve ${ex.host} con il DNS: guarda prima nella propria cache, poi chiede al server DNS locale (UDP porta 53), che se serve interroga root, TLD e server autoritativo e restituisce l'IP (record A). ` +
        `Apre una connessione TCP verso IP:${ex.port} con il three-way handshake (SYN, SYN-ACK, ACK)` +
        (ex.https ? ', poi esegue l\'handshake TLS (certificato del server, accordo sulle chiavi)' : '') + '. Solo dopo invia la richiesta HTTP.',
      ob: `GET /${ex.path} HTTP/1.1\nHost: ${ex.host}\nUser-Agent: Mozilla/5.0\nAccept: text/html\nConnection: keep-alive\n(riga vuota che chiude gli header; nessun corpo per una GET)`,
      oc: 'HTTP/1.1 200 OK\nDate: ...\nServer: Apache\nLast-Modified: ...\nContent-Type: text/html; charset=UTF-8\nContent-Length: ...\n(riga vuota)\n<html> ... corpo con l\'HTML della pagina ... </html>',
      oe: 'Il browser manda una GET condizionale con l\'header If-Modified-Since: <data del Last-Modified della copia in cache> (oppure If-None-Match con l\'ETag). Se la pagina non è cambiata il server risponde 304 Not Modified con corpo vuoto e il browser usa la copia in cache.'
    };
    NUMS.concat(timeKeys(ex)).forEach(k => { a[k] = String(ex.sol[k]); });
    return a;
  }

  // ---------------- errori tipici ----------------
  function diagnose(ex, key, value, answers) {
    const v = String(value == null ? '' : value).trim();
    if (v === '') return null;
    const n = Number(v);
    const s = ex.sol;
    const cdnImgs = ex.images.filter(i => i.host !== ex.host).length;
    switch (key) {
      case 'dnsNp': case 'dnsP':
        if (n === ex.O && ex.O !== ex.H) return 'Hai contato una risoluzione per oggetto: il DNS si fa una volta per HOST, poi il nome resta in cache.';
        if (n === 1 && ex.H > 1) return `Hai dimenticato ${ex.hosts.slice(1).join(' e ')}: le immagini su un altro host richiedono anche loro una risoluzione DNS.`;
        if (key === 'dnsP' && n !== s.dnsP && answers && U.numEq(answers.dnsNp, s.dnsNp)) return 'Il numero di risoluzioni DNS non cambia con la persistenza: dipende solo da quanti host distinti ci sono.';
        return null;
      case 'tcpNp':
        if (n === ex.images.length && n !== ex.H) return 'Hai dimenticato la pagina HTML: è il primo oggetto e ha la sua connessione.';
        if (n === ex.H && ex.H !== ex.O) return 'Questo è il conteggio della versione persistente. Senza persistenza la connessione si chiude dopo ogni risposta: serve una connessione per OGNI oggetto.';
        if (n === ex.images.length) return 'Senza persistenza serve una connessione per OGNI oggetto, pagina HTML compresa.';
        return null;
      case 'tcpP':
        if (n === 1 && ex.H > 1) return 'Una connessione TCP collega due host precisi: per ogni altro host (CDN) serve una connessione in più, anche con HTTP persistente.';
        if (n === ex.O && ex.O !== ex.H) return 'Questo è il conteggio non persistente. Con la persistenza la stessa connessione si riusa per tutti gli oggetti dello stesso host.';
        if (cdnImgs > 1 && n > s.tcpP && n < ex.O) return 'Con la persistenza basta UNA connessione per ogni host, anche se da quell\'host scarichi più immagini.';
        return null;
      case 'tNp':
        if (n === 2 * ex.O) return 'Hai dimenticato le risoluzioni DNS: ognuna costa 1 RTT.';
        if (n === ex.H + ex.O || n === s.tP) return 'Senza persistenza ogni oggetto costa 2 RTT: 1 per l\'handshake TCP e 1 per richiesta e risposta.';
        return null;
      case 'tP':
        if (n === ex.H + ex.O) return 'Hai dimenticato l\'handshake: anche con la persistenza ogni connessione (una per host) costa 1 RTT per aprirsi.';
        if (n === s.tNp) return 'Questo è il tempo non persistente. Con la persistenza l\'handshake si paga una volta per host, poi 1 RTT per oggetto.';
        if (n === ex.O + ex.H && n !== s.tP) return 'Ricordati anche il DNS: 1 RTT per ogni host.';
        return null;
      case 'tPipe':
        if (n === s.tP) return 'Con il pipelining le richieste allo stesso host partono tutte insieme: 1 RTT per tutte le immagini di quell\'host, non 1 per immagine.';
        if (n === s.tPipe - 1) return 'La pagina va scaricata PRIMA delle immagini (il browser scopre le immagini leggendo l\'HTML): sul server della pagina servono due giri, uno per la pagina e uno per le immagini.';
        return null;
      default: return null;
    }
  }

  function diagnoseCases(ex) {
    const out = [{ key: 'tcpNp', value: String(ex.images.length), expect: 'pagina HTML' }].filter(() => ex.images.length !== ex.H);
    if (ex.H > 1) {
      out.push({ key: 'tcpP', value: '1', expect: 'due host precisi' });
      out.push({ key: 'dnsNp', value: '1', expect: 'Hai dimenticato' });
    }
    if (ex.O !== ex.H) out.push({ key: 'tcpNp', value: String(ex.H), expect: 'versione persistente' });
    if (ex.askTimes) {
      out.push({ key: 'tNp', value: String(2 * ex.O), expect: 'risoluzioni DNS' });
      out.push({ key: 'tP', value: String(ex.H + ex.O), expect: 'handshake' });
      if (ex.pipelining) out.push({ key: 'tPipe', value: String(ex.sol.tP), expect: 'pipelining' });
    }
    return out;
  }

  // ---------------- aiuti ----------------
  function fieldHint(ex, key) {
    return {
      oa: 'Quattro cose in ordine: cosa ricavi dalla URL, come trovi l\'IP, cosa apri prima di poter parlare con il server' + (ex.https ? ', e cosa aggiunge https' : '') + '.',
      ob: 'Tre parti: riga di richiesta (metodo, percorso, versione), righe di header (quale è obbligatorio in HTTP/1.1?), riga vuota.',
      oc: 'Tre parti più il corpo: riga di stato (versione, codice, frase), header, riga vuota, corpo.',
      oe: 'Quale header aggiunge il browser per dire "ce l\'ho già, del giorno X"? E con quale codice risponde il server se non è cambiata?',
      dnsNp: `Conta gli host DISTINTI che compaiono: la pagina e le immagini. Ogni host si risolve una volta sola.`,
      dnsP: 'La persistenza cambia le connessioni TCP, non il DNS.',
      tcpNp: `Conta gli oggetti: la pagina più ${ex.images.length === 1 ? 'l\'immagine' : 'le immagini'}. Senza persistenza ognuno ha la sua connessione.`,
      tcpP: 'Con la persistenza una connessione resta aperta e si riusa, ma solo verso lo STESSO host.',
      tNp: 'Somma: 1 RTT di DNS per host + 2 RTT per ogni oggetto (handshake + richiesta).',
      tP: 'Somma: DNS (1 RTT per host) + 1 handshake per host + 1 RTT per ogni oggetto.',
      tPipe: 'Per ogni host: handshake + giri di richieste. Le richieste in pipeline allo stesso host costano 1 RTT tutte insieme, ma la pagina va letta prima delle immagini.'
    }[key] || 'Rileggi il testo della domanda.';
  }

  function hints(ex) {
    const s = ex.sol;
    const H = [
      {
        step: 'a', title: 'Cosa succede prima della richiesta',
        metodo: 'Il browser non può parlare con un nome: deve (1) analizzare la URL, (2) risolvere il nome con il DNS, (3) aprire la connessione TCP con il three-way handshake. Solo dopo manda la GET.',
        applicato: `Dalla URL ${ex.url}: protocollo ${ex.https ? 'https' : 'http'} → porta ${ex.port}, host ${ex.host}, percorso /${ex.path}. Il nome da risolvere è ${ex.host}.` + (ex.https ? ' Con https, dopo l\'handshake TCP c\'è anche quello TLS.' : ''),
        svolto: sol2answers(ex).oa
      },
      {
        step: 'b', title: 'Com\'è fatta la richiesta',
        metodo: 'Riga di richiesta (metodo, percorso, versione), poi gli header uno per riga, poi una riga vuota. Una GET non ha corpo. In HTTP/1.1 l\'header Host è obbligatorio (più siti sullo stesso IP).',
        applicato: `La prima riga è con il metodo GET e il percorso /${ex.path}. L'header obbligatorio vale ${ex.host}.`,
        svolto: sol2answers(ex).ob
      },
      {
        step: 'c', title: 'Com\'è fatta la risposta',
        metodo: 'Riga di stato (versione, codice, frase), header (Date, Server, Last-Modified, Content-Type, Content-Length), riga vuota, corpo con l\'oggetto.',
        applicato: 'La pagina esiste: il codice è quello di "richiesta riuscita". Il corpo contiene l\'HTML.',
        svolto: sol2answers(ex).oc
      },
      {
        step: 'd', title: 'Conteggi DNS e TCP',
        metodo: 'DNS = numero di host distinti (con la cache vuota, uno per host). TCP non persistente = numero di oggetti (pagina + immagini). TCP persistente = numero di host distinti.',
        applicato: `Host distinti: ${ex.hosts.join(', ')}. Oggetti: la pagina + ${ex.images.length} immagini.`,
        svolto: `DNS: ${s.dnsNp} e ${s.dnsP}. TCP non persistente: ${s.tcpNp} (un oggetto, una connessione). TCP persistente: ${s.tcpP} (una per host).\n` +
          ex.perHost.map(x => `· ${x.host}: ${x.objs} oggett${x.objs === 1 ? 'o' : 'i'}`).join('\n')
      },
      {
        step: 'e', title: 'GET condizionale',
        metodo: 'Il browser chiede "mandamela solo se è cambiata dal giorno X" con If-Modified-Since (o If-None-Match con l\'ETag). Se non è cambiata il server risponde 304 Not Modified senza corpo.',
        applicato: 'La data da mettere nell\'header è quella del Last-Modified ricevuto il giorno prima.',
        svolto: sol2answers(ex).oe
      }
    ];
    if (ex.askTimes) {
      H.push({
        step: 'f', title: 'Tempi in RTT',
        metodo: 'Senza persistenza: 2 RTT per oggetto (handshake + richiesta). Con persistenza: 1 handshake per host, poi 1 RTT per oggetto. Con pipelining: tutte le richieste allo stesso host in 1 RTT. In più 1 RTT di DNS per ogni host.',
        applicato: `Qui: ${ex.H} host (quindi ${ex.H} RTT di DNS), ${ex.O} oggetti.` + (ex.pipelining ? ` Sul server della pagina: prima la pagina, poi ${ex.own} immagin${ex.own === 1 ? 'e' : 'i'} insieme.` : ''),
        svolto: timeBreakdown(ex).join('\n')
      });
    }
    return H;
  }

  function timeBreakdown(ex) {
    const s = ex.sol;
    const out = [
      `Non persistente: DNS ${ex.H} + 2 × ${ex.O} oggetti = ${s.tNp} RTT`,
      `Persistente: DNS ${ex.H} + handshake ${ex.H} + ${ex.O} oggetti = ${s.tP} RTT`
    ];
    if (ex.pipelining) {
      const parts = ex.perHost.map(x => x.host === ex.host ? `${x.host}: 1 + 1 (pagina)${ex.own ? ' + 1 (immagini)' : ''}` : `${x.host}: 1 + 1`);
      out.push(`Pipelining: DNS ${ex.H} + [${parts.join('; ')}] = ${s.tPipe} RTT`);
    }
    return out;
  }

  // ---------------- disegno ----------------
  function render(ex, root, ctx) {
    root.appendChild(U.h('div', { class: 'card intro' },
      U.h('p', {}, U.h('b', {}, 'Testo. '), `Un browser richiede la URL `, U.h('code', {}, ex.url), `. La pagina contiene ${ex.images.length} immagin${ex.images.length === 1 ? 'e' : 'i'}:`),
      U.table(['Immagine', 'Si trova su'], ex.images.map(im => [im.name, im.host === ex.host ? im.host + ' (stesso host della pagina)' : im.host + ' (host diverso)'])),
      U.h('p', { class: 'small' }, 'Rispondi alle domande nell\'ordine. Le parti aperte si valutano dai punti chiave citati; per una correzione completa usa 📝.')));

    root.appendChild(U.card('a) Quali operazioni deve effettuare il browser prima di poter inviare la richiesta HTTP?', { step: 'a' },
      U.ta(ctx, 'oa', { rows: 4, ph: 'analisi della URL, DNS, connessione TCP…' })));
    root.appendChild(U.card('b) Come sarà strutturata la richiesta HTTP per la pagina?', { step: 'b' },
      U.ta(ctx, 'ob', { rows: 5, ph: 'GET … HTTP/1.1\nHost: …' })));
    root.appendChild(U.card('c) Se la pagina è presente nel server, come sarà strutturata la risposta?', { step: 'c' },
      U.ta(ctx, 'oc', { rows: 5, ph: 'HTTP/1.1 … \nheader…' })));
    root.appendChild(U.card('d) Con cache DNS vuota e nessuna connessione parallela, quante risoluzioni DNS e quante connessioni TCP servono per pagina e immagini?', { step: 'd' },
      U.table(['', 'HTTP non persistente', 'HTTP persistente'], [
        [U.label('Risoluzioni DNS'), U.inp(ctx, 'dnsNp', { w: 'xs', label: 'DNS non persistente' }), U.inp(ctx, 'dnsP', { w: 'xs', label: 'DNS persistente' })],
        [U.label('Connessioni TCP'), U.inp(ctx, 'tcpNp', { w: 'xs', label: 'TCP non persistente' }), U.inp(ctx, 'tcpP', { w: 'xs', label: 'TCP persistente' })]
      ], { cls: 'center' })));
    root.appendChild(U.card('e) Il giorno dopo il browser ha ancora la pagina in cache. Come può evitare di riscaricarla se non è cambiata, e cosa risponde il server?', { step: 'e' },
      U.ta(ctx, 'oe', { rows: 3, ph: 'If-… / 304…' })));
    if (ex.askTimes) {
      const rows = [
        [U.label('HTTP non persistente'), U.inp(ctx, 'tNp', { w: 's', label: 'tempo non persistente' })],
        [U.label('HTTP persistente, senza pipelining'), U.inp(ctx, 'tP', { w: 's', label: 'tempo persistente' })]
      ];
      if (ex.pipelining) rows.push([U.label('HTTP persistente con pipelining'), U.inp(ctx, 'tPipe', { w: 's', label: 'tempo con pipelining' })]);
      root.appendChild(U.card('f) Tempo totale per pagina e immagini, in RTT', { step: 'f' },
        U.h('p', { class: 'small' }, 'Ipotesi: ogni risoluzione DNS costa 1 RTT, i tempi di trasmissione sono trascurabili, una connessione alla volta (nessuna in parallelo).'),
        U.table(['Caso', 'Tempo totale (RTT)'], rows)));
    }
  }

  function solution(ex, root) {
    const a = sol2answers(ex);
    const s = ex.sol;
    root.appendChild(U.h('div', { class: 'card sol' },
      U.h('h4', {}, 'Soluzione'),
      U.h('p', { class: 'sol-body' }, U.h('b', {}, 'a) '), a.oa),
      U.h('p', { class: 'sol-body' }, U.h('b', {}, 'b) '), 'Riga di richiesta, header (Host obbligatorio), riga vuota:'),
      U.h('pre', {}, a.ob),
      U.h('p', { class: 'sol-body' }, U.h('b', {}, 'c) '), 'Riga di stato, header, riga vuota, corpo:'),
      U.h('pre', {}, a.oc),
      U.h('p', { class: 'sol-body' }, U.h('b', {}, 'd) '), 'Prima elenco host e oggetti, poi conto:'),
      U.table(['Host', 'Oggetti scaricati da lì'], ex.perHost.map(x => [x.host, String(x.objs)])),
      U.table(['', 'Non persistente', 'Persistente', 'Perché'], [
        [U.label('DNS'), String(s.dnsNp), String(s.dnsP), 'uno per host distinto, in entrambi i casi'],
        [U.label('TCP'), String(s.tcpNp), String(s.tcpP), 'non persistente: uno per oggetto · persistente: uno per host']
      ]),
      ex.images.some(i => i.host !== ex.host) ? U.h('p', { class: 'small' }, 'Errore tipico: dimenticare che le immagini su un altro host richiedono comunque un DNS e una connessione in più, anche con HTTP persistente.') : null,
      U.h('p', { class: 'sol-body' }, U.h('b', {}, 'e) '), a.oe),
      ex.askTimes ? U.h('div', {}, U.h('p', { class: 'sol-body' }, U.h('b', {}, 'f) '), 'Tempi:'), U.h('pre', {}, timeBreakdown(ex).join('\n'))) : null));
  }

  function chatText(ex, a) {
    const v = k => (a && String(a[k] || '').trim()) || '__';
    const L = [];
    L.push(`#6 · HTTP (livello ${ex.level})`);
    L.push('## Testo');
    L.push(`Un browser richiede la URL ${ex.url}. La pagina contiene ${ex.images.length} immagini: ${ex.images.map(i => `${i.name} su ${i.host}`).join(', ')}.`);
    L.push('a) operazioni prima della richiesta; b) struttura della richiesta; c) struttura della risposta; d) quante risoluzioni DNS e connessioni TCP (cache DNS vuota, nessuna connessione parallela), con HTTP non persistente e persistente; e) GET condizionale il giorno dopo.' +
      (ex.askTimes ? ' f) tempo totale in RTT (DNS = 1 RTT per host, trasmissione trascurabile)' + (ex.pipelining ? ', anche con pipelining.' : '.') : ''));
    L.push('');
    L.push('## Le mie risposte');
    L.push(`a) ${v('oa')}`);
    L.push(`b)\n${v('ob')}`);
    L.push(`c)\n${v('oc')}`);
    L.push(`d) DNS: non persistente ${v('dnsNp')}, persistente ${v('dnsP')} · TCP: non persistente ${v('tcpNp')}, persistente ${v('tcpP')}`);
    L.push(`e) ${v('oe')}`);
    if (ex.askTimes) L.push(`f) non persistente ${v('tNp')} RTT · persistente ${v('tP')} RTT` + (ex.pipelining ? ` · pipelining ${v('tPipe')} RTT` : ''));
    return L.join('\n');
  }

  RA.http = {
    id: 'http', num: '6', name: 'HTTP', examPoints: 7,
    desc: 'Dalla URL alla pagina: operazioni preliminari, richiesta, risposta, conteggi DNS/TCP, GET condizionale, tempi in RTT.',
    method: {
      intro: 'Domanda aperta: i punti arrivano dai dettagli. Rispondi con un blocco per ogni parte, nello stesso ordine della domanda.',
      steps: [
        'Prima della richiesta: analisi della URL (protocollo → porta, host, percorso), risoluzione DNS (cache, server locale UDP 53, root/TLD/autoritativo), connessione TCP con three-way handshake (+ TLS se https).',
        'Richiesta: "GET /percorso HTTP/1.1", header (Host obbligatorio, User-Agent, Accept, Connection), riga vuota, nessun corpo.',
        'Risposta: "HTTP/1.1 200 OK", header (Date, Server, Last-Modified, Content-Type, Content-Length), riga vuota, corpo con l\'HTML.',
        'Conteggi: DNS = host distinti; TCP non persistente = oggetti; TCP persistente = host distinti.',
        'Pagina in cache: GET condizionale con If-Modified-Since (o If-None-Match) → 304 Not Modified senza corpo.'
      ],
      traps: [
        'L\'immagine su un altro host (CDN) costa sempre un DNS e una connessione in più, anche con la persistenza.',
        'Senza Host la richiesta HTTP/1.1 è incompleta: sullo stesso IP possono esserci più siti.',
        'Non dimenticare la riga vuota: separa gli header dal corpo.',
        '"Handshake con il sito" è vago: scrivi three-way handshake TCP sulla porta 80 (443 con https).'
      ],
      formulas: [
        ['Porte', 'http 80 · https 443 · DNS UDP 53'],
        ['Non persistente', '2 RTT per oggetto (handshake + richiesta)'],
        ['Persistente', '1 handshake per host + 1 RTT per oggetto'],
        ['Pipelining', '1 handshake per host + 1 RTT per tutte le richieste allo stesso host'],
        ['Codici', '200 OK · 301 spostato · 304 non modificato · 400 richiesta errata · 404 non trovato · 500 errore del server']
      ]
    },
    traces: [{
      id: 'sim-http', set: 'simulato',
      title: 'Esame simulato · HTTP (www.unidemo.it)',
      source: 'Esame_Simulato_TESTO.pdf pag. 9 · soluzioni pag. 10',
      params: {
        level: 3, host: 'www.unidemo.it', path: 'corsi/reti.html', https: false, askTimes: false, pipelining: false,
        images: [{ name: 'immagine1', host: 'www.unidemo.it' }, { name: 'immagine2', host: 'www.unidemo.it' }, { name: 'immagine3', host: 'img.cdn-demo.com' }]
      },
      expect: { dnsNp: '2', dnsP: '2', tcpNp: '4', tcpP: '2' }
    }],
    randomParams, build, gen, steps, grade, sol2answers, render, solution, hints, fieldHint, diagnose, diagnoseCases, chatText
  };
})();
