// ============================================================
// RetiApp · gen-http.js — Esercizio 6 · HTTP
// ============================================================
(function () {
  const RA = window.RetiApp;
  const U = RA.util;

  const HOSTS = ['www.unidemo.it', 'www.reti-esercizi.net', 'www.appunti-web.org', 'www.materiale-didattico.it'];
  const CDNS = ['img.cdn-demo.com', 'static.imgfast.net', 'media.pixhost.org'];
  const PATHS = ['corsi/reti.html', 'appunti/index.html', 'didattica/reti.html', 'lezioni/rete.html'];

  function gen(level) {
    const https = level >= 5 && Math.random() < 0.5;
    const host = U.pick(HOSTS);
    const path = U.pick(PATHS);
    let cdnCount, imgCount;
    if (level <= 1) { cdnCount = 0; imgCount = 2; }
    else if (level === 2) { cdnCount = 1; imgCount = 2; }
    else if (level === 3) { cdnCount = 1; imgCount = 3; }
    else if (level === 4) { cdnCount = 2; imgCount = 4; }
    else { cdnCount = 2; imgCount = 5; }
    const cdns = U.shuffle(CDNS).slice(0, cdnCount);
    // distribuzione immagini: le prime imgCount-cdnCount sullo stesso host
    const images = [];
    const sameCount = imgCount - cdnCount;
    for (let i = 0; i < sameCount; i++) images.push({ host, name: 'immagine' + (i + 1) + '.png', own: true });
    cdns.forEach((c, i) => images.push({ host: c, name: 'immagine-cdn' + (i + 1) + '.png', own: false }));

    const distinctHosts = 1 + cdnCount;
    const objects = 1 + imgCount;
    const port = https ? 443 : 80;

    return {
      cat: 'http', level, https, host, path, cdns, images,
      url: `http${https ? 's' : ''}://${host}/${path}`,
      sol: { dnsNp: distinctHosts, tcpNp: objects, dnsP: distinctHosts, tcpP: distinctHosts }
    };
  }

  function numOk(v, exp, msg) { return { ok: String(v).trim() === String(exp), msg: msg + ': risposta corretta: ' + exp }; }

  // answers: { dnsNp, tcpNp, dnsP, tcpP, oa, ob, oc, oe }
  function grade(ex, answers) {
    let correct = 0, total = 0;
    const marks = {};
    [['dnsNp', 'Risoluzioni DNS (non persistente)'], ['tcpNp', 'Connessioni TCP (non persistente)'],
     ['dnsP', 'Risoluzioni DNS (persistente)'], ['tcpP', 'Connessioni TCP (persistente)']]
      .forEach(([k, label]) => {
        total++; const r = numOk(answers[k], ex.sol[k], label); marks[k] = r; if (r.ok) correct++;
      });

    // domande aperte: copertura parole chiave (peso 1 ciascuna)
    const opens = {
      oa: { txt: answers.oa, kws: [['dns', 'risoluz'], ['cache'], ['tcp', 'handshake', 'three'], ['port']] },
      ob: { txt: answers.ob, kws: [['get'], ['http/1.1'], ['host'], ['head', 'intestaz'], ['riga vuota']] },
      oc: { txt: answers.oc, kws: [['200'], ['date', 'server', 'last-modified', 'content-type', 'content-length'], ['riga vuota'], ['corpo', 'html']] },
      oe: { txt: answers.oe, kws: [['if-modified-since', 'condizional'], ['304'], ['last-modified']] }
    };
    for (const k in opens) {
      const cov = U.kwCoverage(opens[k].txt, opens[k].kws);
      marks[k] = { ok: cov.found >= Math.ceil(cov.total / 2), cov, partial: cov.found / cov.total };
      total++; correct += Math.min(1, cov.found / cov.total);
    }
    return { correct, total, marks };
  }

  function sol2answers(ex) {
    const port = ex.https ? 443 : 80;
    return {
      dnsNp: ex.sol.dnsNp, tcpNp: ex.sol.tcpNp, dnsP: ex.sol.dnsP, tcpP: ex.sol.tcpP,
      oa: `Il browser analizza la URL: protocollo ${ex.https ? 'https' : 'http'} → porta di default ${port}; host: ${ex.host}; percorso dell'oggetto: /${ex.path}. Risolve ${ex.host} tramite DNS (controlla prima la propria cache; poi chiede al server DNS locale su UDP porta 53, che interroga se necessario root, TLD e server autoritativo) e ottiene l'IP. Apre la connessione TCP verso IP:${port} con il three-way handshake (SYN, SYN-ACK, ACK)${ex.https ? ' e poi completa l\'handshake TLS per cifrare e autenticare' : ''}. Solo dopo può inviare la richiesta HTTP.`,
      ob: `GET /${ex.path} HTTP/1.1\nHost: ${ex.host}\nUser-Agent: Mozilla/5.0\nAccept: text/html\nConnection: keep-alive\n(riga vuota che chiude gli header; nessun corpo per una GET)`,
      oc: `HTTP/1.1 200 OK\nDate: ...\nServer: Apache\nLast-Modified: ...\nContent-Type: text/html; charset=UTF-8\nContent-Length: ...\n(riga vuota)\n<html> ... contenuto della pagina ... </html>`,
      oe: `Manda una GET condizionale con l'header If-Modified-Since: <data dell'ultima modifica che ha in cache, presa dal Last-Modified ricevuto il giorno prima>. Se la pagina non è cambiata il server risponde 304 Not Modified, con corpo vuoto: il browser usa la copia in cache senza riscaricarla.`
    };
  }

  // ---- rendering ----
  function render(ex, root, state) {
    state.fields = {};
    const imgList = ex.images.map(im => U.h('li', {}, `${im.name} — ${im.host}${im.own ? '' : ' (host diverso!'}`));
    // fix parentesi
    imgList.forEach((li, i) => { li.textContent = `${ex.images[i].name} — su ${ex.images[i].host}${ex.images[i].own ? '' : ' (host diverso)'}`; });

    root.appendChild(U.h('div', { class: 'card intro' },
      U.h('p', {}, U.h('b', {}, 'Domanda. '), `Un browser richiede la URL ${ex.url}. La pagina contiene ${ex.images.length} immagini: ${ex.images.filter(i => i.own).length} su ${ex.host}${ex.cdns.length ? `, ${ex.images.length - ex.images.filter(i => i.own).length} su altri host (${ex.cdns.join(', ')})` : ''}.`),
      U.h('ul', { class: 'small' }, imgList),
      U.h('p', { class: 'small' }, 'Rispondi a: a) operazioni prima della richiesta HTTP · b) struttura della richiesta · c) struttura della risposta · d) conteggi con DNS cache vuota e nessuna connessione parallela · e) GET condizionale il giorno dopo (la pagina è ancora in cache).')
    ));

    const mkTa = (key, label, ph, rows) => {
      const ta = U.h('textarea', { class: 'cell ta', rows: rows || 3, placeholder: ph });
      state.fields[key] = ta;
      return U.h('div', { class: 'card' }, U.h('label', { class: 'small' }, label), ta);
    };
    root.appendChild(mkTa('oa', 'a) Quali operazioni deve effettuare il browser prima di poter inviare la richiesta HTTP?', 'analisi URL, DNS, TCP...', 3));
    root.appendChild(mkTa('ob', 'b) Come sarà strutturata la richiesta HTTP per la pagina?', 'GET ... + header ...', 4));
    root.appendChild(mkTa('oc', 'c) Se la pagina è presente nel server, come sarà strutturata la risposta?', 'riga di stato + header + corpo...', 4));

    const numeric = U.h('div', { class: 'card' },
      U.h('label', { class: 'small' }, 'd) Assumendo cache DNS vuota e nessuna connessione parallela:'));
    [['dnsNp', 'Risoluzioni DNS con HTTP non persistente'], ['tcpNp', 'Connessioni TCP con HTTP non persistente'],
     ['dnsP', 'Risoluzioni DNS con HTTP persistente'], ['tcpP', 'Connessioni TCP con HTTP persistente']]
      .forEach(([k, label]) => {
        const inp = U.h('input', { class: 'cell num', type: 'text' });
        state.fields[k] = inp;
        numeric.appendChild(U.h('div', { class: 'num-row' }, U.h('span', { class: 'small' }, label), inp));
      });
    root.appendChild(numeric);
    root.appendChild(mkTa('oe', 'e) Il giorno dopo il browser ha ancora la pagina in cache. Come può evitare di riscaricarla se non è cambiata, e cosa risponde il server in quel caso?', 'If-... / 304...', 3));

    root.appendChild(U.h('p', { class: 'chat-tip small' }, '💡 Le parti a, b, c, e sono aperte: se vuoi, incolla qui la tua risposta in chat e te la correggo punto per punto.'));
  }

  function check(ex, root, state, explain) {
    U.resetFb(root);
    const answers = {};
    for (const k in state.fields) answers[k] = state.fields[k].value;
    const res = grade(ex, answers);
    const NUM_EXP = {
      dnsNp: 'host distinti coinvolti', tcpNp: '1 connessione per OGGETTO (non persistente)',
      dnsP: 'host distinti coinvolti', tcpP: '1 connessione per HOST (persistente)'
    };
    ['dnsNp', 'tcpNp', 'dnsP', 'tcpP'].forEach(k => {
      const m = res.marks[k];
      U.fb(state.fields[k], m.ok, m.ok ? null : (explain ? `${m.msg}. Servono ${NUM_EXP[k]}.` : '✗'));
    });
    ['oa', 'ob', 'oc', 'oe'].forEach(k => {
      const m = res.marks[k];
      U.fb(state.fields[k], m.ok, m.ok ? null :
        (explain ? `Copertura dei punti chiave: ${m.cov.found}/${m.cov.total}. Manca: ${m.cov.missing.map(i => {
          const opts = { oa: [['DNS/risoluzione', 'dns'], ['cache DNS', 'cache'], ['handshake TCP', 'tcp'], ['porta ' + (ex.https ? '443' : '80'), 'port']],
            ob: [['riga GET + percorso + versione', 'get'], ['header Host:', 'host'], ['altri header', 'head'], ['riga vuota a fine header', 'riga vuota']],
            oc: [['riga di stato 200 OK', '200'], ['header principali (Date, Server, Last-Modified, Content-Type, Content-Length)', 'h'], ['riga vuota', 'r'], ['corpo con l\'HTML', 'corpo']]}[k][i];
          return opts[0];
        }).join('; ')}. Guarda la soluzione per la risposta modello.` : '✗'));
    });
    return res;
  }

  function solution(ex, root) {
    const a = sol2answers(ex);
    root.appendChild(U.h('div', { class: 'card sol' },
      U.h('h4', {}, 'Risposta modello'),
      U.h('div', { class: 'sol-body' },
        U.h('p', {}, U.h('b', {}, 'a) '), a.oa),
        U.h('p', {}, U.h('b', {}, 'b) '), U.h('pre', { class: 'small' }, a.ob)),
        U.h('p', {}, U.h('b', {}, 'c) '), U.h('pre', { class: 'small' }, a.oc)),
        U.h('p', {}, U.h('b', {}, 'd) '), `Risoluzioni DNS: ${ex.sol.dnsP} (host distinti: ${[ex.host, ...ex.cdns].join(', ')}). Connessioni TCP non persistente: ${ex.sol.tcpNp} (una per oggetto: pagina + ${ex.images.length} immagini). Connessioni TCP persistente: ${ex.sol.tcpP} (una per host: si riusa con keep-alive).`),
        U.h('p', {}, U.h('b', {}, 'e) '), a.oe))));
  }

  function hints(ex) {
    const H = ['Prima della richiesta: la URL va analizzata (host, porta di default, percorso); il nome va risolto con DNS (cache → server locale UDP 53 → root/TLD/autoritativo); poi serve la connessione TCP verso IP:porta con il three-way handshake.'];
    H.push('Richiesta: riga di richiesta (GET percorso HTTP/1.1), header tra cui Host è OBBLIGATORIO in HTTP/1.1, riga vuota, corpo vuoto per una GET.');
    H.push('Conteggi: senza persistenza ogni oggetto (pagina + ogni immagine) costa una connessione TCP nuova; con la persistenza la connessione si riusa, quindi conta il numero di HOST distinti. Le immagini su un altro host richiedono DNS + connessione in più.');
    H.push('GET condizionale: If-Modified-Since con la data del Last-Modified → se non è cambiata il server risponde 304 Not Modified, corpo vuoto.');
    return H;
  }

  // ---- testo per la correzione in chat ----
  function chatText(ex, state) {
    const lines = [];
    const f = k => state.fields[k] ? (state.fields[k].value.trim() || '__') : '__';
    lines.push(`#6 · HTTP (livello ${ex.level})`);
    lines.push('## Testo');
    lines.push(`Un browser richiede la URL ${ex.url}. La pagina contiene ${ex.images.length} immagini: ${ex.images.map(im => `${im.name} su ${im.host}`).join('; ')}.`);
    lines.push('a) Quali operazioni deve effettuare il browser prima di poter inviare la richiesta HTTP?');
    lines.push('b) Come sarà strutturata la richiesta HTTP per la pagina?');
    lines.push('c) Se la pagina è presente nel server, come sarà strutturata la risposta?');
    lines.push('d) Assumendo cache DNS vuota e nessuna connessione parallela: quante risoluzioni DNS e quante connessioni TCP servono per pagina e immagini, con HTTP non persistente e con HTTP persistente?');
    lines.push('e) Il giorno dopo il browser ha ancora la pagina in cache: come può evitare di riscaricarla se non è cambiata, e cosa risponde il server in quel caso?');
    lines.push('');
    lines.push('## Le mie risposte');
    lines.push(`a) ${f('oa')}`);
    lines.push(`b) ${f('ob')}`);
    lines.push(`c) ${f('oc')}`);
    lines.push(`d) DNS non persistente: ${f('dnsNp')}; TCP non persistente: ${f('tcpNp')}; DNS persistente: ${f('dnsP')}; TCP persistente: ${f('tcpP')}`);
    lines.push(`e) ${f('oe')}`);
    return lines.join('\n');
  }

  RA.http = {
    id: 'http', num: '6', name: 'HTTP',
    desc: 'Dalla URL alla pagina: DNS, richiesta, risposta, conteggi, cache.',
    examPoints: 7, gen, grade, sol2answers, render, check, solution, hints, chatText
  };
})();
