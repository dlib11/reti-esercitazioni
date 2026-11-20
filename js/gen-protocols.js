// ============================================================
// RetiApp · gen-protocols.js — Esercizio 2 · Protocolli e pila
// ============================================================
(function () {
  const RA = window.RetiApp;
  const U = RA.util;

  // livelli selezionabili: valore -> etichetta
  const LEVEL_OPTS = [
    ['1', 'Fisico (1)'],
    ['2', 'Collegamento (2)'],
    ['2-3', 'Collegamento (2, tra 2 e 3)'],
    ['3', 'Rete (3)'],
    ['4', 'Trasporto (4)'],
    ['5', 'Applicazione (5)']
  ];

  // acc: livello/i accettati (stringa o array)
  // kws: gruppi di sinonimi per lo scopo (basta 1 per gruppo)
  // db: risposta modello completa
  const DB = [
    {
      n: 'HTTP', acc: '5', minLv: 1, trap: false,
      kws: [['pagina', 'web', 'oggett'], ['tcp'], ['80', '443']],
      db: 'Livello applicativo (5). Trasferisce pagine e oggetti web tra browser e server con richieste GET/POST e risposte. Si appoggia su TCP, porta 80 (HTTPS su 443; HTTP/3 usa QUIC su UDP). È stateless: lo stato si mantiene con i cookie.',
      hint: 'Chi lo trasporta? Ha una porta nota (80): viaggia su TCP.'
    },
    {
      n: 'DNS', acc: '5', minLv: 1, trap: false,
      kws: [['nome', 'risoluzione'], ['indirizz'], ['udp'], ['53']],
      db: 'Livello applicativo (5). Traduce nomi di dominio in indirizzi IP (e viceversa). Usa UDP porta 53 (TCP per risposte grandi). La risoluzione può passare per cache, server locale, root, TLD e server autoritativo.',
      hint: 'Serve alla rete, ma i suoi messaggi viaggiano su UDP 53: è un\'applicazione.'
    },
    {
      n: 'SMTP', acc: '5', minLv: 1, trap: false,
      kws: [['posta', 'email', 'mail'], ['invi'], ['tcp'], ['25']],
      db: 'Livello applicativo (5). Invia e inoltra la posta tra server di posta. Usa TCP porta 25 (587 per l\'invio dal client). Per leggere la posta si usano invece POP3 o IMAP.',
      hint: 'Posta: due verbi — inviare (SMTP) o leggere (POP3/IMAP)?'
    },
    {
      n: 'POP3', acc: '5', minLv: 1, trap: false,
      kws: [['posta', 'email', 'mail'], ['scaric', 'legg', 'recuper'], ['tcp'], ['110']],
      db: 'Livello applicativo (5). Consente al client di scaricare la posta dal server. Usa TCP porta 110. A differenza di IMAP, gestisce la casella in modo essenziale (scaricamento e cancellazione).',
      hint: 'Serve per leggere la posta dal server, su TCP.'
    },
    {
      n: 'IMAP', acc: '5', minLv: 1, trap: false,
      kws: [['posta', 'email', 'mail'], ['legg', 'consult', 'sincronizz'], ['tcp'], ['143']],
      db: 'Livello applicativo (5). Consente di consultare e gestire la posta direttamente sul server (cartelle, sincronizzazione). Usa TCP porta 143.',
      hint: 'Come POP3, ma la posta resta sul server: TCP 143.'
    },
    {
      n: 'FTP', acc: '5', minLv: 1, trap: false,
      kws: [['file', 'documenti'], ['trasfer', 'copiare', 'trasferiment'], ['tcp'], ['21', '20'], ['due', '2 connessioni']],
      db: 'Livello applicativo (5). Trasferisce file tra client e server. Usa TCP con due connessioni separate: controllo su porta 21 e dati su porta 20.',
      hint: 'Trasferisce file su TCP, ma con una particolarità: due connessioni.'
    },
    {
      n: 'SSH', acc: '5', minLv: 1, trap: false,
      kws: [['terminale', 'remot', 'shell', 'accesso'], ['cifrat', 'sicur'], ['tcp'], ['22']],
      db: 'Livello applicativo (5). Accesso a terminale remoto cifrato (e trasferimento file con SCP/SFTP). Usa TCP porta 22. È la versione sicura di Telnet.',
      hint: 'Telnet ma cifrato: TCP 22.'
    },
    {
      n: 'Telnet', acc: '5', minLv: 1, trap: false,
      kws: [['terminale', 'remot', 'shell', 'accesso'], ['tcp'], ['23']],
      db: 'Livello applicativo (5). Terminale remoto in chiaro (niente cifratura). Usa TCP porta 23. Sostituito in pratica da SSH.',
      hint: 'TCP 23, come SSH ma senza cifratura.'
    },
    {
      n: 'SNMP', acc: '5', minLv: 2, trap: false,
      kws: [['gestion', 'monitor', 'apparati', 'reti'], ['udp'], ['161', '162']],
      db: 'Livello applicativo (5). Gestione e monitoraggio di apparati di rete (router, switch, server). Usa UDP porte 161/162 (trap).',
      hint: 'Monitoraggio degli apparati: viaggia su UDP.'
    },
    {
      n: 'DHCP', acc: '5', minLv: 2, trap: true,
      kws: [['ip', 'indirizz', 'configur'], ['assegn', 'automatic'], ['udp'], ['67', '68'], ['broadcast']],
      db: 'Livello applicativo (5), su UDP (porte 67 server / 68 client). Assegna automaticamente a un host che entra in rete: indirizzo IP, maschera, default gateway e server DNS. Funziona in 4 messaggi (Discover, Offer, Request, ACK — DORA), inviati in broadcast perché il client non ha ancora un IP. Attenzione: configura gli IP ma NON è di livello 3: è un\'applicazione.',
      hint: 'Trappola: dà gli indirizzi IP, ma come viaggiano i suoi messaggi? Su UDP: applicazione.'
    },
    {
      n: 'TCP', acc: '4', minLv: 2, trap: false,
      kws: [['affidabil', 'connessione', 'risc', 'ritrasmission'], ['segment'], ['ip'], ['port']],
      db: 'Livello trasporto (4), si appoggia su IP. Trasporto affidabile, orientato alla connessione: numeri di sequenza e riscontri (ACK), ritrasmissione in caso di perdita, controllo di flusso e di congestione. Scambia segmenti tra processi identificati dalle porte.',
      hint: 'È lui a offrire il servizio affidabile: è lui il livello 4.'
    },
    {
      n: 'UDP', acc: '4', minLv: 2, trap: false,
      kws: [['datagram', 'senza connessione', 'best effort', 'nessuna garanzia'], ['ip'], ['port'], ['veloc', 'legger']],
      db: 'Livello trasporto (4), si appoggia su IP. Datagrammi senza connessione né garanzie (niente ACK, ordine, controllo di flusso): più leggero e veloce di TCP. Usato per DNS, VoIP, streaming, DHCP.',
      hint: 'Il trasporto "nudo": niente garanzie, massima velocità.'
    },
    {
      n: 'IP', acc: '3', minLv: 2, trap: false,
      kws: [['datagram', 'instrad', 'inoltro'], ['indirizz'], ['rout', 'router'], ['best effort', 'senza connessione']],
      db: 'Livello rete (3), si appoggia sul livello collegamento (2). Indirizzamento e inoltro dei datagrammi tra reti (best effort, senza connessione). Ogni router prende decisioni hop-by-hop in base all\'indirizzo di destinazione.',
      hint: 'È il protocollo che dà il nome al "livello IP": il livello 3.'
    },
    {
      n: 'Ethernet', acc: '2', minLv: 2, trap: false,
      kws: [['frame'], ['mac'], ['link', 'locale'], ['cavo', 'lan']],
      db: 'Livello collegamento (2), sopra il fisico (1). Consegna frame tra nodi dello stesso link/LAN usando indirizzi MAC. Definisce formattazione del frame e accesso al mezzo (CSMA/CD nel classico Ethernet condiviso).',
      hint: 'Lavora con i MAC nello stesso link: livello 2.'
    },
    {
      n: 'OSPF', acc: '3', minLv: 3, trap: false,
      kws: [['routing', 'rotte', 'instradam'], ['intra', 'interno', 'stato'], ['dijkstra'], ['ip'], ['89']],
      db: 'Livello rete (3): i suoi messaggi viaggiano direttamente dentro IP (protocollo 89), non su TCP/UDP. Protocollo di routing intra-AS (link state): ogni router costruisce la mappa della topologia e calcola i cammini minimi con Dijkstra.',
      hint: 'Routing interno: i suoi messaggi stanno DENTRO IP (proto 89), non su TCP.'
    },
    {
      n: 'ICMP', acc: '3', minLv: 3, trap: false,
      kws: [['error', 'diagnostic', 'control'], ['ping', 'traceroute'], ['ip'], ['segnal']],
      db: 'Livello rete (3): incapsulato dentro IP (protocollo 1). Segnala errori e informazioni di controllo: echo request/reply (ping), destination unreachable, time exceeded (usato da traceroute).',
      hint: 'Ping e traceroute: messaggi dentro IP, non un\'applicazione.'
    },
    {
      n: 'RIP', acc: '5', minLv: 3, trap: true,
      kws: [['routing', 'rotte', 'instradam'], ['intra', 'interno', 'distance'], ['vector', 'bellman'], ['udp'], ['520']],
      db: 'Attenzione: è un protocollo di routing intra-AS (distance vector, algoritmo di Bellman-Ford), quindi fa parte del "servizio di rete" — MA i suoi messaggi viaggiano come applicazione su UDP porta 520. Risposta ideale: "protocollo di routing interno (distance vector) implementato come applicazione su UDP 520".',
      hint: 'Trappola: fa routing, ma viaggia su UDP 520: applicazione a tutti gli effetti.'
    },
    {
      n: 'NAT', acc: '3', minLv: 3, trap: true,
      kws: [['traduc', 'tradurre', 'riscriv'], ['privat', 'pubblic'], ['port'], ['router']],
      db: 'Opera nel router, livello rete (3): riscrive l\'IP sorgente dei datagrammi uscenti (privato → pubblico) e l\'IP destinazione di quelli entranti. MA riscrive anche le PORTE (livello 4): per questo si dice che viola la separazione tra i livelli. Soluzione di lungo periodo: IPv6.',
      hint: 'Livello 3, ma tocca anche le porte: dilo, è il punto che fa la differenza.'
    },
    {
      n: 'BGP', acc: ['3', '5'], minLv: 4, trap: true,
      kws: [['routing', 'rotte'], ['as', 'autonom', 'inter'], ['path', 'percorso'], ['tcp'], ['179'], ['politic']],
      db: 'Protocollo di routing inter-AS: il "collante" di Internet, parte del piano di controllo del livello di rete. MA è implementato come applicazione su TCP porta 179. È di tipo path vector: annuncia percorsi come sequenze di AS e permette politiche di instradamento. (Accettabile anche solo "livello 3", ma citare TCP 179 vale di più.)',
      hint: 'Il caso più trabocchetto: routing tra AS, ma gira su TCP 179.'
    },
    {
      n: 'ARP', acc: ['2', '2-3'], minLv: 4, trap: true,
      kws: [['mac'], ['ip'], ['traduc', 'trovare', 'risolver', 'chied'], ['broadcast'], ['frame', 'ethernet'], ['lan', 'stesso']],
      db: 'Traduce IP → MAC (non il contrario!) dentro la stessa LAN: l\'host che conosce l\'IP chiede in broadcast "chi ha questo IP?". I messaggi ARP sono incapsulati direttamente in frame Ethernet, NON in IP. Si colloca tra i livelli 2 e 3; se serve un numero: livello collegamento (2).',
      hint: 'Trappola: IP verso MAC, e viaggia in frame Ethernet (non in IP).'
    }
  ];

  function gen(level) {
    let pool;
    if (level <= 1) pool = DB.filter(p => p.minLv <= 1);
    else if (level === 2) pool = DB.filter(p => p.minLv <= 2);
    else if (level === 3) pool = DB.filter(p => p.minLv <= 3);
    else pool = DB; // 4-5: tutte, con le trappole in testa
    let chosen = U.shuffle(pool).slice(0, level <= 2 ? 4 : 5);
    if (level >= 5) { // metà almeno trappole
      const traps = U.shuffle(DB.filter(p => p.trap));
      chosen = U.shuffle(chosen.slice(0, 2).concat(traps.slice(0, 3)));
    }
    return {
      cat: 'protocols',
      level,
      items: chosen.map(p => ({ name: p.n, ref: p }))
    };
  }

  // ---- verifica (pura) ----
  // answers: { items: [{ lv, purpose }] }
  function grade(ex, answers) {
    let correct = 0, total = 0;
    const marks = ex.items.map((it, i) => {
      const a = answers.items[i] || {};
      const acc = [].concat(it.ref.acc);
      const okLv = a.lv && acc.includes(a.lv);
      total += 2;
      correct += okLv ? 1 : 0;
      const cov = U.kwCoverage(a.purpose, it.ref.kws);
      correct += cov.found / cov.total;
      return { okLv, accLv: acc, cov, m: a };
    });
    return { correct, total, marks };
  }

  function sol2answers(ex) {
    return { items: ex.items.map(it => ({ lv: [].concat(it.ref.acc)[0], purpose: it.ref.db })) };
  }

  // ---- rendering ----
  function render(ex, root, state) {
    state.fields = [];
    ex.items.forEach((it, i) => {
      const row = U.h('div', { class: 'card proto-item' },
        U.h('div', { class: 'proto-name' }, `${i + 1}. ${it.name}`),
        U.h('label', { class: 'small' }, 'Livello:'),
        (() => {
          const sel = U.h('select', { class: 'cell' },
            U.h('option', { value: '' }, '— scegli —'),
            LEVEL_OPTS.map(([v, l]) => U.h('option', { value: v }, l)));
          state.fields.push({ kind: 'lv', i, el: sel });
          return sel;
        })(),
        U.h('label', { class: 'small', style: 'display:block;margin-top:8px' }, 'A cosa serve (1-2 righe):'),
        (() => {
          const ta = U.h('textarea', { class: 'cell', rows: '2', placeholder: 'scopo + un dettaglio tecnico (porta, trasporto, algoritmo)...' });
          state.fields.push({ kind: 'purpose', i, el: ta });
          return ta;
        })()
      );
      root.appendChild(row);
    });
  }

  function check(ex, root, state, explain) {
    U.resetFb(root);
    const answers = { items: state.fields.reduce((acc, f) => {
      if (f.kind === 'lv') acc[f.i] = acc[f.i] || {}, acc[f.i].lv = f.el.value;
      else acc[f.i] = acc[f.i] || {}, acc[f.i].purpose = f.el.value;
      return acc;
    }, []) };
    const res = grade(ex, answers);
    res.marks.forEach((m, i) => {
      const lvEl = state.fields.find(f => f.kind === 'lv' && f.i === i).el;
      const taEl = state.fields.find(f => f.kind === 'purpose' && f.i === i).el;
      U.fb(lvEl, m.okLv, m.okLv ? null : `${ex.items[i].name}: livello corretto: ${m.accLv.map(l => (LEVEL_OPTS.find(o => o[0] === l) || ['', l])[1]).join(' oppure ')}. ` +
        (explain ? (ex.items[i].ref.trap ? 'È uno dei casi che fanno sbagliare: ragiona su chi lo trasporta.' : 'Chiediti: i suoi messaggi viaggiano dentro IP, su TCP/UDP o in frame di livello 2?') : ''));
      const okKw = m.cov.found >= Math.ceil(m.cov.total / 2);
      U.fb(taEl, okKw, okKw ? null :
        (explain ? `Nella risposta mancano concetti chiave (trovati ${m.cov.found}/${m.cov.total}). ` +
          (m.cov.missing.length ? 'Suggerimento: ' + m.cov.missing.map(idx => {
            const opts = ex.items[i].ref.kws[idx];
            return `parole come "${opts.slice(0, 2).join('", "')}"`;
          }).join('; ') : '') : '✗'));
    });
    return res;
  }

  function solution(ex, root) {
    ex.items.forEach((it, i) => {
      root.appendChild(U.h('div', { class: 'card sol' },
        U.h('div', { class: 'proto-name' }, `${i + 1}. ${it.name}`),
        U.h('div', { class: 'sol-body', text: it.ref.db })));
    });
  }

  function hints(ex) {
    const hs = ['Criterio dei due passi: (1) CHI trasporta i suoi messaggi? Se viaggiano dentro TCP o UDP è applicazione (5), anche se il suo scopo riguarda la rete. (2) Se sta dentro IP senza TCP/UDP (ICMP, OSPF) è livello rete (3). Se lavora con i MAC e non attraversa i router (ARP, Ethernet) è collegamento (2).'];
    const tricky = ex.items.find(it => it.ref.trap);
    if (tricky) hs.push(`Attenzione a ${tricky.name}: è uno dei casi che fanno perdere punti. ${tricky.hint}`);
    hs.push('Risposta completa = livello (nome + numero) + scopo + un dettaglio tecnico (porta, trasporto, algoritmo): è quello che dimostra che lo conosci.');
    return hs;
  }

  // ---- testo per la correzione in chat ----
  function chatText(ex, state) {
    const lines = [];
    lines.push(`#2 · Protocolli e pila Internet (livello ${ex.level})`);
    lines.push('## Testo');
    lines.push('Per ciascun protocollo: a quale livello della pila Internet opera e a cosa serve (scopo + un dettaglio tecnico).');
    lines.push('Protocolli: ' + ex.items.map(it => it.name).join(', ') + '.');
    lines.push('');
    lines.push('## Le mie risposte');
    ex.items.forEach((it, i) => {
      const lvEl = state.fields.find(f => f.kind === 'lv' && f.i === i).el;
      const puEl = state.fields.find(f => f.kind === 'purpose' && f.i === i).el;
      const lvTxt = lvEl.value ? lvEl.options[lvEl.selectedIndex].text : '__';
      lines.push(`- ${it.name} — livello: ${lvTxt}; scopo: ${puEl.value.trim() || '__'}`);
    });
    return lines.join('\n');
  }

  RA.protocols = {
    id: 'protocols', num: '2', name: 'Protocolli e pila Internet',
    desc: 'Livello e scopo dei protocolli: OSPF, ICMP, DNS, BGP, ARP...',
    examPoints: 4, gen, grade, sol2answers, render, check, solution, hints, chatText
  };
})();
