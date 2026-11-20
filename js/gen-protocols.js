// ============================================================
// RetiApp · gen-protocols.js — Esercizio 2 · Protocolli e pila Internet
// Contratto dei moduli: docs/moduli.md (modello: gen-http.js)
// ============================================================
(function () {
  const RA = window.RetiApp;
  const U = RA.util;

  // ---------------- opzioni delle select ----------------
  const LV_OPTS = [['5', 'Applicazione (5)'], ['4', 'Trasporto (4)'], ['3', 'Rete (3)'], ['2', 'Collegamento (2)'], ['1', 'Fisico (1)']];
  const ON_OPTS = [
    ['tcp', 'TCP'],
    ['udp', 'UDP'],
    ['ip', 'direttamente dentro IP'],
    ['l2', 'direttamente nel frame di livello 2'],
    ['l1', 'direttamente sul mezzo fisico (bit)'],
    ['none', 'nessun messaggio proprio: è una funzione del router']
  ];
  const lvLabel = v => (LV_OPTS.find(o => o[0] === v) || ['', v])[1];
  const onLabel = v => (ON_OPTS.find(o => o[0] === v) || ['', v])[1];

  // gruppo di parole chiave; le parole corte ricevono anche la variante con il punto
  // (U.kw cerca le parole corte come parola intera: "porta 53." altrimenti non verrebbe trovata)
  function G(label, any) {
    const out = [];
    any.forEach(k => { out.push(k); if (k.replace(/[^a-z0-9]/gi, '').length < 4) out.push(k + '.'); });
    return { label, any: out };
  }
  const MAIL = G('la posta elettronica', ['posta', 'mail', 'email', 'e-mail', 'messaggi di posta']);
  const TERM = G('accesso a un terminale remoto', ['terminal', 'remot', 'shell', 'login']);
  const INTRA = G('routing intra-AS (dentro un Autonomous System)', ['intra', 'interno', 'dentro un as', 'stesso as', 'interior']);

  // ---------------- banca dei protocolli ----------------
  // lv: livelli accettati (il primo è la risposta modello) · on: trasporti accettati
  // tier: 'app' | 'core' (comuni non applicativi) | 'base' (applicativi meno comuni) | 'trap'
  // dxLvl / dxOn: errori tipici sul livello / sul trasporto · dxDesc: errori tipici nella descrizione
  const DB = [
    {
      id: 'HTTP', name: 'HTTP', grp: 'http', tier: 'app', lv: ['5'], on: ['tcp'],
      uses: 'TCP, porta 80 (443 con HTTPS; HTTP/3 invece usa QUIC su UDP)',
      why: 'i suoi messaggi viaggiano su TCP (porta 80): è un\'applicazione',
      scope: 'trasferire pagine e oggetti web tra browser e server',
      detail: 'richiesta/risposta (GET, POST); stateless, lo stato si tiene con i cookie',
      q: 'Ha una porta nota: chi trasporta le sue richieste?',
      dq: 'cosa trasferisce, con quale schema di messaggi, su quale porta',
      kw: [G('trasferire pagine e oggetti web', ['pagin', 'web', 'ipertest', 'oggett']), G('schema richiesta/risposta (GET, POST…)', ['richiest', 'rispost', 'get', 'post']), G('porta 80 (443 con HTTPS)', ['80', '443'])],
      model: 'Trasferisce pagine e oggetti web tra browser e server con uno schema richiesta/risposta (GET, POST). Porta 80, 443 con HTTPS. È stateless: lo stato si mantiene con i cookie.'
    },
    {
      id: 'FTP', name: 'FTP', grp: 'ftp', tier: 'app', lv: ['5'], on: ['tcp'],
      uses: 'TCP, porta 21 (controllo) e 20 (dati)',
      why: 'i suoi messaggi viaggiano su TCP (porte 21 e 20): è un\'applicazione',
      scope: 'trasferire file tra client e server',
      detail: 'due connessioni TCP separate: controllo (21) e dati (20)',
      q: 'Comandi e file passano su connessioni con porte note: di che trasporto?',
      dq: 'cosa trasferisce e la sua particolarità sulle connessioni (con le porte)',
      kw: [G('trasferire file', ['file']), G('due connessioni: controllo e dati', ['due conn', '2 conn', 'controllo', 'connessione dati', 'canale dati', 'connessione per i dati']), G('porte 21 e 20', ['21', '20'])],
      model: 'Trasferisce file tra client e server. Usa due connessioni TCP separate: una di controllo (porta 21) per i comandi e una per i dati (porta 20).'
    },
    {
      id: 'SMTP', name: 'SMTP', grp: 'smtp', tier: 'app', lv: ['5'], on: ['tcp'],
      uses: 'TCP, porta 25 (587 per l\'invio dal client)',
      why: 'i suoi messaggi viaggiano su TCP (porta 25): è un\'applicazione',
      scope: 'inviare la posta e inoltrarla tra server di posta',
      detail: 'protocollo push; la lettura si fa con POP3 o IMAP',
      q: 'Posta in uscita: su quale trasporto viaggia, con quale porta?',
      dq: 'che cosa fa con la posta (inviare o leggere?), su quale porta',
      kw: [MAIL, G('invio e inoltro tra server (push)', ['invi', 'inoltr', 'push', 'spedi']), G('porta 25 (587 dal client)', ['25', '587'])],
      model: 'Invia la posta dal client al proprio server e la inoltra tra server di posta (protocollo push). TCP porta 25 (587 per l\'invio dal client). Per leggere la posta si usano POP3 o IMAP.',
      dxDesc: [{ has: ['legg', 'scaric'], not: ['invi', 'inoltr', 'spedi'], sample: 'serve a leggere la posta', msg: 'SMTP serve a inviare e inoltrare la posta (push). Per leggerla dal server si usano POP3 o IMAP.' }]
    },
    {
      id: 'POP3', name: 'POP3', grp: 'mailread', tier: 'base', lv: ['5'], on: ['tcp'],
      uses: 'TCP, porta 110',
      why: 'i suoi messaggi viaggiano su TCP (porta 110): è un\'applicazione',
      scope: 'scaricare la posta dal proprio server',
      detail: 'di solito scarica i messaggi e li toglie dal server (IMAP invece li lascia lì)',
      q: 'Il client scarica la posta con una connessione affidabile: quale trasporto?',
      dq: 'cosa fa con la posta (in che direzione), su quale porta',
      kw: [MAIL, G('scaricare/leggere la posta dal server', ['scaric', 'legg', 'recuper']), G('porta 110', ['110'])],
      model: 'Permette al client di scaricare (leggere) la posta dal proprio server. TCP porta 110. Gestione essenziale: di solito scarica i messaggi e li cancella dal server, a differenza di IMAP.',
      dxDesc: [{ has: ['invi', 'spedi'], not: ['scaric', 'legg', 'recuper'], sample: 'serve a inviare le email', msg: 'POP3 non invia: scarica la posta dal server. L\'invio è compito di SMTP.' }]
    },
    {
      id: 'IMAP', name: 'IMAP', grp: 'mailread', tier: 'base', lv: ['5'], on: ['tcp'],
      uses: 'TCP, porta 143',
      why: 'i suoi messaggi viaggiano su TCP (porta 143): è un\'applicazione',
      scope: 'leggere e gestire la posta lasciandola sul server',
      detail: 'cartelle sul server, sincronizzazione tra più dispositivi',
      q: 'Come POP3: su quale trasporto viaggia?',
      dq: 'cosa fa con la posta, dove restano i messaggi, su quale porta',
      kw: [MAIL, G('posta lasciata sul server (cartelle, sincronizzazione)', ['sul server', 'resta', 'cartell', 'sincronizz', 'gestir', 'consult']), G('porta 143', ['143'])],
      model: 'Permette di leggere e gestire la posta lasciandola sul server (cartelle, sincronizzazione tra più dispositivi). TCP porta 143.',
      dxDesc: [{ has: ['invi', 'spedi'], not: ['legg', 'consult', 'gestir'], sample: 'serve a inviare le email', msg: 'IMAP non invia: serve a leggere e gestire la posta sul server. L\'invio è compito di SMTP.' }]
    },
    {
      id: 'DNS', name: 'DNS', grp: 'dns', tier: 'app', lv: ['5'], on: ['udp'],
      uses: 'UDP, porta 53 (TCP solo per risposte grandi)',
      why: 'serve alla rete, ma i suoi messaggi viaggiano su UDP (porta 53): è un\'applicazione',
      scope: 'tradurre i nomi di dominio in indirizzi IP',
      detail: 'database distribuito e gerarchico: root, TLD, autoritativi; cache',
      q: 'Una domanda e una risposta brevi, porta 53: con quale trasporto?',
      dq: 'cosa traduce in cosa, com\'è organizzato, su quale porta',
      kw: [G('tradurre nomi in indirizzi IP', ['nomi', 'nome', 'domin', 'risoluz', 'risolve']), G('gerarchia root/TLD/autoritativi, cache', ['root', 'radice', 'tld', 'autoritativ', 'gerarch', 'distribuit', 'cache']), G('porta 53', ['53'])],
      model: 'Traduce i nomi di dominio in indirizzi IP (record A; altri record: MX, NS, CNAME). È un database distribuito e gerarchico: server root, TLD e autoritativi, con le cache. Di norma UDP porta 53.',
      dxLvl: { '3': 'Il DNS serve alla rete, ma i suoi messaggi viaggiano su UDP (porta 53): è un\'applicazione (5).' },
      dxOn: { tcp: 'Il DNS usa di norma UDP (porta 53): una domanda e una risposta brevi non giustificano una connessione. TCP solo per risposte grandi.' },
      dxDesc: [{ has: ['assegn'], not: ['nomi', 'nome', 'domin'], sample: 'assegna gli indirizzi IP agli host', msg: 'Assegnare gli IP è il compito di DHCP. Il DNS traduce i nomi di dominio in indirizzi IP.' }]
    },
    {
      id: 'DHCP', name: 'DHCP', grp: 'dhcp', tier: 'trap', mild: true, lv: ['5'], on: ['udp'],
      uses: 'UDP, porte 67 (server) e 68 (client), in broadcast',
      why: 'assegna gli IP, ma i suoi messaggi viaggiano su UDP (67/68): è un\'applicazione',
      scope: 'assegnare automaticamente IP, maschera, gateway e server DNS',
      detail: '4 messaggi Discover, Offer, Request, ACK (DORA) in broadcast',
      trapTxt: 'Configura gli indirizzi IP, ma questo non lo rende di livello 3 (e tanto meno di livello 1): i suoi messaggi sono datagrammi UDP, quindi è un\'applicazione.',
      q: 'Il client non ha ancora un IP e non può aprire connessioni: i suoi messaggi su cosa viaggiano?',
      dq: 'cosa assegna (quattro cose), come si chiamano i messaggi, su quali porte',
      kw: [G('assegnare automaticamente la configurazione', ['assegn', 'configur', 'automatic']), G('IP, maschera, gateway, server DNS', ['maschera', 'gateway', 'dns']), G('quattro messaggi DORA in broadcast', ['dora', 'discover', 'broadcast', 'offer']), G('porte 67/68', ['67', '68'])],
      model: 'Assegna automaticamente a un host che entra in rete indirizzo IP, maschera, default gateway e server DNS. Usa 4 messaggi (Discover, Offer, Request, ACK: DORA), inviati in broadcast perché il client non ha ancora un IP. UDP porte 67 (server) e 68 (client).',
      dxLvl: {
        '3': 'DHCP assegna gli indirizzi IP, ma i suoi messaggi viaggiano su UDP (porte 67/68): è un\'applicazione (5), non un protocollo di rete.',
        '2': 'Il broadcast non lo rende di livello 2: è un broadcast IP di datagrammi UDP. DHCP è un\'applicazione (5).',
        '1': 'Il livello 1 è il fisico (i bit sul cavo): DHCP è un\'applicazione (5) su UDP. Se intendevi "il primo dall\'alto", scrivi sempre il nome del livello.'
      },
      dxOn: {
        ip: 'DHCP non sta direttamente in IP: i suoi messaggi sono datagrammi UDP (porte 67/68), mandati in broadcast perché il client non ha ancora un indirizzo.',
        tcp: 'DHCP usa UDP, non TCP: il client non ha ancora un IP, non può aprire una connessione e manda in broadcast.',
        l2: 'DHCP non sta direttamente nel frame: è UDP dentro IP (in broadcast, porte 67/68).'
      },
      dxDesc: [{ has: ['nomi', 'nome'], not: ['assegn', 'configur'], sample: 'traduce i nomi in indirizzi', msg: 'Tradurre i nomi è il compito del DNS. DHCP assegna a un host IP, maschera, gateway e server DNS.' }]
    },
    {
      id: 'SSH', name: 'SSH', grp: 'term', tier: 'base', lv: ['5'], on: ['tcp'],
      uses: 'TCP, porta 22',
      why: 'i suoi messaggi viaggiano su TCP (porta 22): è un\'applicazione',
      scope: 'accesso a un terminale remoto cifrato',
      detail: 'versione sicura di Telnet; anche trasferimento file (SCP/SFTP)',
      q: 'Una sessione interattiva lunga e affidabile, porta 22: quale trasporto?',
      dq: 'a cosa serve, cosa lo distingue da Telnet, su quale porta',
      kw: [TERM, G('comunicazione cifrata', ['cifrat', 'sicur', 'crittograf']), G('porta 22', ['22'])],
      model: 'Accesso a un terminale remoto (login e comandi su un\'altra macchina) con comunicazione cifrata; permette anche il trasferimento di file (SCP/SFTP). TCP porta 22: è la versione sicura di Telnet.'
    },
    {
      id: 'Telnet', name: 'Telnet', grp: 'term', tier: 'base', lv: ['5'], on: ['tcp'],
      uses: 'TCP, porta 23',
      why: 'i suoi messaggi viaggiano su TCP (porta 23): è un\'applicazione',
      scope: 'accesso a un terminale remoto, in chiaro',
      detail: 'nessuna cifratura (password comprese): sostituito da SSH',
      q: 'Come SSH, sulla porta 23: quale trasporto?',
      dq: 'a cosa serve, cosa gli manca rispetto a SSH, su quale porta',
      kw: [TERM, G('traffico in chiaro, senza cifratura', ['chiaro', 'non cifrat', 'senza cifratura', 'insicur', 'nessuna cifratura', 'non sicur']), G('porta 23', ['23'])],
      model: 'Accesso a un terminale remoto, ma con tutto il traffico in chiaro (password comprese, nessuna cifratura). TCP porta 23. Oggi è sostituito da SSH.',
      dxDesc: [{ has: ['cifrat', 'sicur'], not: ['chiaro', 'non cifr', 'senza', 'nessuna', 'insicur', 'non sicur'], sample: 'terminale remoto cifrato', msg: 'Telnet NON cifra: tutto passa in chiaro, password comprese. La versione cifrata è SSH.' }]
    },
    {
      id: 'SNMP', name: 'SNMP', grp: 'snmp', tier: 'base', lv: ['5'], on: ['udp'],
      uses: 'UDP, porte 161 e 162 (trap)',
      why: 'i suoi messaggi viaggiano su UDP (porte 161/162): è un\'applicazione',
      scope: 'gestione e monitoraggio degli apparati di rete',
      detail: 'il manager interroga gli agent; gli apparati possono mandare avvisi (trap)',
      q: 'Brevi interrogazioni agli apparati, porte 161/162: quale trasporto?',
      dq: 'a cosa serve, chi interroga chi, su quali porte',
      kw: [G('gestione e monitoraggio degli apparati', ['gestion', 'monitor', 'apparat', 'dispositiv']), G('manager/agent, MIB, trap', ['agent', 'mib', 'trap', 'manager', 'interroga']), G('porte 161/162', ['161', '162'])],
      model: 'Gestione e monitoraggio degli apparati di rete (router, switch, server): un manager interroga gli agent sui dispositivi, che descrivono il loro stato (MIB) e possono mandare avvisi (trap). UDP porte 161 e 162 (trap).'
    },
    {
      id: 'BGP', name: 'BGP', grp: 'bgp', tier: 'trap', lv: ['5', '3'], on: ['tcp'],
      uses: 'TCP, porta 179',
      why: 'è routing tra AS (servizio del livello di rete), ma i suoi messaggi viaggiano su TCP porta 179: tecnicamente è un\'applicazione. "Livello 3" è accettato, ma va citato TCP 179',
      scope: 'routing tra Autonomous System diversi (inter-AS): il collante di Internet',
      detail: 'path vector: annuncia percorsi come sequenze di AS, con politiche',
      trapTxt: 'Il suo scopo è di rete (decide le rotte tra AS), ma gira su TCP 179: la risposta ideale cita entrambe le cose. "Livello 3, usato nel routing" è accettabile ma incompleto.',
      q: 'Due router di AS diversi tengono aperta una sessione affidabile, porta 179: su cosa?',
      dq: 'che tipo di routing fa (dentro o tra AS?), che tipo di algoritmo, il trasporto con la porta',
      kw: [G('routing tra AS (inter-AS)', ['inter-as', 'inter as', 'interas', 'tra as', 'autonomous', 'autonom', 'tra sistemi']), G('path vector: percorsi come sequenze di AS', ['path vector', 'path-vector', 'sequenz', 'percors']), G('politiche di instradamento', ['politic', 'policy']), G('TCP porta 179', ['179'])],
      model: 'Protocollo di routing inter-AS (tra Autonomous System diversi): è il collante di Internet e fa parte del piano di controllo del livello di rete. È di tipo path vector: annuncia percorsi come sequenze di AS e permette politiche di instradamento. Implementato come applicazione su TCP porta 179.',
      dxLvl: {
        '4': 'TCP 179 è il trasporto che BGP usa, non il suo livello: BGP è un\'applicazione (5) al servizio del livello di rete (3).',
        '2': 'BGP non lavora con i MAC: è routing tra AS (servizio di rete) implementato come applicazione su TCP 179.'
      },
      dxOn: {
        udp: 'BGP usa TCP porta 179: tra due router vicini serve una sessione affidabile e ordinata. È RIP che usa UDP.',
        ip: 'Direttamente dentro IP ci sta OSPF (protocollo 89). BGP viaggia su TCP porta 179.'
      },
      dxDesc: [{ has: ['intra'], not: ['inter'], sample: 'routing intra-AS', msg: 'BGP è inter-AS (tra AS diversi). Intra-AS sono RIP e OSPF.' }]
    },
    {
      id: 'RIP', name: 'RIP', grp: 'rip', tier: 'trap', lv: ['5'], on: ['udp'],
      uses: 'UDP, porta 520',
      why: 'fa routing (servizio del livello di rete), ma i suoi messaggi viaggiano su UDP porta 520: è un\'applicazione al servizio del livello di rete',
      scope: 'routing intra-AS di tipo distance vector',
      detail: 'Bellman-Ford, metrica = numero di salti (max 15)',
      trapTxt: 'Come OSPF serve al routing, ma a differenza di OSPF viaggia su UDP 520: è un\'applicazione (5) al servizio del livello di rete. Citare il trasporto è il dettaglio che dà il punteggio pieno.',
      q: 'I router si scambiano i vettori di distanza sulla porta 520: con quale trasporto?',
      dq: 'dentro o tra AS, che tipo di algoritmo, che metrica, il trasporto con la porta',
      kw: [INTRA, G('distance vector (Bellman-Ford)', ['distance vector', 'distance-vector', 'bellman', 'vettor']), G('metrica: numero di salti (max 15)', ['salti', 'hop', '15']), G('UDP porta 520', ['520'])],
      model: 'Protocollo di routing intra-AS di tipo distance vector (algoritmo di Bellman-Ford): i router vicini si scambiano i vettori delle distanze. La metrica è il numero di salti (massimo 15). Viaggia su UDP porta 520: è un\'applicazione al servizio del livello di rete.',
      dxLvl: {
        '3': 'RIP fa routing come OSPF, ma a differenza di OSPF i suoi messaggi viaggiano su UDP porta 520: è un\'applicazione (5) al servizio del livello di rete.',
        '4': 'UDP 520 è il trasporto che RIP usa, non il suo livello: RIP è un\'applicazione (5) al servizio del livello di rete.'
      },
      dxOn: {
        ip: 'Direttamente dentro IP ci sta OSPF (protocollo 89). RIP viaggia su UDP porta 520.',
        tcp: 'RIP usa UDP (porta 520), non TCP: è BGP che usa TCP (179).'
      },
      dxDesc: [{ has: ['dijkstra', 'link state', 'link-state'], not: ['bellman', 'distance'], sample: 'routing link state con Dijkstra', msg: 'Link state e Dijkstra sono di OSPF. RIP è distance vector (Bellman-Ford).' }]
    },
    {
      id: 'OSPF', name: 'OSPF', grp: 'ospf', tier: 'trap', lv: ['3'], on: ['ip'],
      uses: 'direttamente dentro IP (numero di protocollo 89), senza TCP né UDP',
      why: 'i suoi messaggi stanno direttamente dentro IP (protocollo 89), senza TCP/UDP: è di livello rete',
      scope: 'routing intra-AS di tipo link state',
      detail: 'ogni router conosce la topologia e calcola i cammini minimi con Dijkstra',
      trapTxt: 'Non confonderlo con RIP: OSPF è incapsulato direttamente in IP (protocollo 89, che non è una porta), quindi è di rete (3).',
      q: 'I suoi messaggi hanno una porta TCP/UDP, o un numero di protocollo IP (89)?',
      dq: 'dentro o tra AS, che tipo di algoritmo e quale, come viaggiano i messaggi',
      kw: [INTRA, G('link state: ogni router conosce la topologia', ['link state', 'link-state', 'stato dei link', 'topologia', 'mappa']), G('Dijkstra, cammini minimi', ['dijkstra', 'cammin', 'percorsi minim']), G('incapsulato in IP, protocollo 89', ['89'])],
      model: 'Protocollo di routing intra-AS di tipo link state: ogni router conosce l\'intera topologia (stato dei link) e calcola i cammini minimi con l\'algoritmo di Dijkstra. I messaggi sono incapsulati direttamente in IP (protocollo 89), senza TCP né UDP.',
      dxLvl: {
        '5': 'OSPF non viaggia su TCP/UDP: i suoi messaggi stanno direttamente dentro IP (protocollo 89), quindi è di rete (3). È RIP che, su UDP, è un\'applicazione.',
        '4': 'OSPF non è un trasporto e non ha porte: sta direttamente dentro IP (protocollo 89), livello rete (3).'
      },
      dxOn: {
        udp: 'È RIP che usa UDP (520). OSPF è incapsulato direttamente in IP con numero di protocollo 89 (89 non è una porta).',
        tcp: 'È BGP che usa TCP (179). OSPF è incapsulato direttamente in IP, protocollo 89.'
      },
      dxDesc: [{ has: ['bellman', 'distance vector', 'distance-vector'], not: ['dijkstra', 'link state', 'link-state'], sample: 'routing distance vector con Bellman-Ford', msg: 'Distance vector e Bellman-Ford sono di RIP. OSPF è link state e usa Dijkstra.' }]
    },
    {
      id: 'ICMP', name: 'ICMP', grp: 'icmp', tier: 'trap', core: '3', lv: ['3'], on: ['ip'],
      uses: 'direttamente dentro IP (numero di protocollo 1)',
      why: 'i suoi messaggi stanno direttamente dentro IP (protocollo 1), senza TCP/UDP: è di livello rete',
      scope: 'messaggi di errore e di diagnostica tra host e router',
      detail: 'destinazione irraggiungibile, TTL scaduto, echo request/reply: ping e traceroute',
      trapTxt: 'ping e traceroute sono programmi, ma ICMP non ha porte e non usa TCP/UDP: sta dentro IP (protocollo 1), quindi è di rete (3).',
      q: 'ping è un programma, ma i messaggi ICMP hanno una porta?',
      dq: 'a cosa servono i suoi messaggi, quali programmi lo usano, come viaggia',
      kw: [G('errori e diagnostica', ['error', 'diagnost', 'segnal', 'controllo']), G('ping, traceroute, echo, TTL scaduto', ['ping', 'traceroute', 'echo', 'ttl', 'irraggiungibil', 'unreachable']), G('incapsulato direttamente in IP (protocollo 1)', ['dentro ip', 'in ip', 'incapsulat', 'protocollo 1'])],
      model: 'Messaggi di errore e di diagnostica tra host e router: destinazione irraggiungibile, TTL scaduto, echo request/reply. Lo usano ping e traceroute. Viaggia incapsulato direttamente in IP (protocollo 1).',
      dxLvl: {
        '5': 'ping e traceroute sono programmi, ma ICMP non viaggia su TCP/UDP: sta dentro IP (protocollo 1), quindi è di rete (3).',
        '4': 'ICMP non ha porte e non è un trasporto: sta direttamente dentro IP (protocollo 1), livello rete (3).'
      },
      dxOn: {
        udp: 'ICMP non usa né TCP né UDP (non ha porte): sta direttamente dentro IP, protocollo 1.',
        tcp: 'ICMP non usa né TCP né UDP (non ha porte): sta direttamente dentro IP, protocollo 1.'
      }
    },
    {
      id: 'NAT', name: 'NAT', grp: 'nat', tier: 'trap', mild: true, lv: ['3'], on: ['none'],
      uses: 'nessun messaggio proprio: è una funzione del router che riscrive i datagrammi in transito',
      why: 'è una funzione del router di bordo, che lavora a livello di rete; ma tocca anche le porte (livello 4)',
      scope: 'tradurre gli IP privati della LAN nell\'IP pubblico del router',
      detail: 'riscrive anche le porte (tabella di traduzione): viola la stratificazione',
      trapTxt: 'Livello 3 è giusto, ma va aggiunto che modifica anche le porte (livello 4): per questo si dice che viola la separazione tra i livelli.',
      q: 'Il NAT manda messaggi suoi, o modifica i datagrammi degli altri mentre li inoltra?',
      dq: 'cosa traduce in cosa, quali campi riscrive (anche di quale livello), con quale struttura',
      kw: [G('IP privati ↔ IP pubblico', ['privat', 'pubblic']), G('riscrive anche le porte', ['porta', 'porte', 'napt', 'pat']), G('tabella di traduzione', ['tabella']), G('viola la stratificazione (tocca il livello 4)', ['stratificaz', 'end-to-end', 'end to end', 'viola', 'livello 4', 'trasporto'])],
      model: 'Funzione del router di bordo: traduce gli IP privati della LAN nell\'unico IP pubblico. Riscrive IP e porta sorgente dei datagrammi uscenti e IP e porta destinazione di quelli entranti, usando una tabella di traduzione. Tocca anche le porte (livello 4), quindi viola la stratificazione.',
      dxLvl: {
        '4': 'Il NAT tocca anche le porte, ma è una funzione del router, che lavora a livello di rete (3): per questo si dice che viola la stratificazione.',
        '5': 'Il NAT non è un\'applicazione: non ha messaggi suoi, riscrive i datagrammi nel router (livello 3).'
      },
      dxOn: {
        tcp: 'Il NAT non manda messaggi propri su TCP/UDP: riscrive IP e porte dei datagrammi che attraversano il router.',
        udp: 'Il NAT non manda messaggi propri su TCP/UDP: riscrive IP e porte dei datagrammi che attraversano il router.',
        ip: 'Il NAT non ha messaggi suoi dentro IP: modifica i datagrammi IP degli altri mentre li inoltra.'
      }
    },
    {
      id: 'ARP', name: 'ARP', grp: 'arp', tier: 'trap', mild: true, lv: ['2'], on: ['l2'],
      uses: 'direttamente nel frame Ethernet, non in IP',
      why: 'il messaggio ARP sta direttamente nel frame Ethernet: si colloca tra 2 e 3; con un numero, collegamento (2)',
      scope: 'trovare il MAC di un vicino nella stessa LAN, dato il suo IP',
      detail: 'richiesta in broadcast "chi ha questo IP?", risposta con il MAC',
      trapTxt: 'Traduce IP → MAC (non il contrario) e non viaggia in IP: sta nel frame Ethernet. "Tra 2 e 3", e se serve un numero collegamento (2), non 3.',
      q: 'Il messaggio ARP serve PRIMA di poter mandare un datagramma IP sul link: dove viaggia allora?',
      dq: 'cosa trova a partire da cosa, dove vale, come chiede, come viaggia',
      kw: [G('trovare il MAC dato l\'IP', ['mac']), G('nella stessa LAN', ['lan', 'stessa rete', 'stesso link', 'sottorete', 'locale', 'vicin']), G('richiesta in broadcast', ['broadcast']), G('incapsulato nel frame Ethernet', ['frame', 'ethernet'])],
      model: 'Trova il MAC di un vicino nella stessa LAN dato il suo IP (traduzione IP → MAC): l\'host chiede in broadcast "chi ha questo IP?" e il proprietario risponde con il suo MAC. Il messaggio ARP sta direttamente nel frame Ethernet, non in IP: si colloca tra livello 2 e 3.',
      dxLvl: {
        '3': 'ARP non viaggia dentro IP: il messaggio sta direttamente nel frame Ethernet. Si colloca tra 2 e 3; se serve un numero, collegamento (2).',
        '5': 'ARP non ha porte e non usa TCP/UDP: il messaggio sta nel frame Ethernet, collegamento (2).'
      },
      dxOn: {
        ip: 'ARP serve proprio a trovare il MAC prima di poter mandare il datagramma IP: il messaggio ARP sta direttamente nel frame Ethernet, non in IP.',
        udp: 'ARP non usa UDP né IP: il messaggio sta direttamente nel frame Ethernet.'
      },
      dxDesc: [{ re: '\\b(mac (in|a|verso) ip|dal mac|dato il mac|da mac a ip)\\b', notRe: '\\b(ip (in|a|verso) mac|dato l ip|dall ip|ip mac)\\b', sample: 'dato il MAC trova l\'IP', msg: 'Direzione sbagliata: ARP traduce IP → MAC. L\'host conosce l\'IP del vicino (o del gateway) e chiede il suo MAC.' }]
    },
    {
      id: 'ETH', name: 'Ethernet', grp: 'l2', tier: 'core', core: '2', lv: ['2'], on: ['l1'],
      uses: 'il livello fisico (bit su cavo o fibra)',
      why: 'consegna frame con indirizzi MAC sullo stesso link: è il livello di collegamento',
      scope: 'consegnare frame tra nodi dello stesso link o LAN',
      detail: 'indirizzi MAC a 48 bit; accesso al mezzo (CSMA/CD), oggi switch',
      q: 'Lavora con i MAC e non attraversa i router: cosa c\'è sotto il frame?',
      dq: 'cosa consegna e dove, con quali indirizzi, un dettaglio sull\'accesso al mezzo',
      kw: [G('consegna di frame sullo stesso link', ['frame']), G('indirizzi MAC', ['mac']), G('accesso al mezzo (CSMA/CD), switch', ['csma', 'accesso al mezzo', 'switch', 'collision'])],
      model: 'Consegna i frame tra nodi dello stesso link o della stessa LAN usando gli indirizzi MAC (48 bit). Definisce il formato del frame e l\'accesso al mezzo (CSMA/CD nell\'Ethernet condiviso; oggi LAN commutate con switch). Sotto c\'è il livello fisico (cavo, fibra).',
      dxLvl: { '1': 'Ethernet definisce anche il fisico, ma il frame con gli indirizzi MAC è collegamento (2).' },
      dxOn: { l2: 'Ethernet È il livello 2: i suoi frame viaggiano sul mezzo fisico (bit su cavo o fibra).', ip: 'È il contrario: IP viaggia dentro il frame Ethernet, non Ethernet dentro IP.' }
    },
    {
      id: 'WIFI', name: 'Wi-Fi', grp: 'l2', tier: 'core', core: '2', lv: ['2'], on: ['l1'],
      uses: 'il livello fisico radio',
      why: 'consegna frame con indirizzi MAC sullo stesso link (radio): è il livello di collegamento',
      scope: 'consegnare frame tra stazioni e access point, senza fili',
      detail: 'IEEE 802.11, indirizzi MAC, accesso al mezzo con CSMA/CA',
      q: 'Come Ethernet ma via radio: cosa c\'è sotto il frame?',
      dq: 'cosa consegna e tra chi, con quali indirizzi, come accede al mezzo radio',
      kw: [G('frame senza fili tra stazioni e access point', ['frame', 'wireless', 'senza fili', 'radio']), G('indirizzi MAC', ['mac']), G('802.11, access point, CSMA/CA', ['access point', 'csma', '802.11'])],
      model: 'Collegamento senza fili (standard IEEE 802.11): consegna i frame tra le stazioni e l\'access point usando gli indirizzi MAC. L\'accesso al mezzo radio usa CSMA/CA (evita le collisioni). Sotto c\'è il livello fisico radio.',
      dxLvl: { '1': 'Wi-Fi definisce anche il fisico radio, ma il frame con gli indirizzi MAC è collegamento (2).' },
      dxOn: { l2: 'Wi-Fi È il livello 2: i suoi frame viaggiano sul mezzo fisico (onde radio).' }
    },
    {
      id: 'TCP', name: 'TCP', grp: 'tcp', tier: 'core', core: '4', lv: ['4'], on: ['ip'],
      uses: 'IP: i segmenti viaggiano dentro i datagrammi',
      why: 'definisce le porte e la comunicazione tra processi: è il trasporto',
      scope: 'trasporto affidabile e orientato alla connessione tra processi',
      detail: 'numeri di sequenza, ACK, ritrasmissione; controllo di flusso e di congestione',
      q: 'Le porte le definisce lui: cosa c\'è subito sotto il segmento?',
      dq: 'che servizio offre, con quali meccanismi, tra chi (come si identificano)',
      kw: [G('affidabile, orientato alla connessione', ['affidabil', 'connession']), G('numeri di sequenza, ACK, ritrasmissione', ['sequenz', 'ack', 'riscontr', 'ritrasm']), G('controllo di flusso e di congestione', ['flusso', 'congestion']), G('porte per identificare i processi', ['porta', 'porte', 'process'])],
      model: 'Trasporto affidabile e orientato alla connessione (three-way handshake) tra processi identificati dalle porte. Numera i byte (numeri di sequenza), usa riscontri (ACK) e ritrasmette i segmenti persi; fa controllo di flusso e di congestione.',
      dxLvl: { '3': 'TCP non instrada i pacchetti: definisce le porte e la comunicazione tra processi, è trasporto (4). Viaggia dentro IP.', '5': 'TCP non è un\'applicazione: è lui il trasporto (4) su cui viaggiano le applicazioni.' },
      dxOn: {
        tcp: 'TCP è esso stesso il trasporto: i suoi segmenti viaggiano dentro i datagrammi IP.',
        udp: 'TCP non sta dentro UDP: sono due trasporti alternativi, entrambi dentro IP.',
        l2: 'Tra TCP e il frame c\'è IP: segmento → datagramma IP → frame.'
      }
    },
    {
      id: 'UDP', name: 'UDP', grp: 'udp', tier: 'core', core: '4', lv: ['4'], on: ['ip'],
      uses: 'IP: i datagrammi UDP viaggiano dentro i datagrammi IP',
      why: 'definisce le porte e la comunicazione tra processi: è il trasporto',
      scope: 'trasporto senza connessione e senza garanzie tra processi',
      detail: 'niente ACK né ritrasmissioni: leggero, usato da DNS, DHCP, streaming',
      q: 'Le porte le definisce lui: cosa c\'è subito sotto?',
      dq: 'che servizio offre (con quali garanzie?), tra chi, chi lo usa',
      kw: [G('senza connessione né garanzie', ['senza connession', 'nessuna garanzia', 'senza garanzi', 'best effort', 'non affidabil', 'inaffidabil']), G('porte per identificare i processi', ['porta', 'porte', 'process']), G('leggero: lo usano DNS, DHCP, streaming, VoIP', ['legger', 'veloc', 'dns', 'streaming', 'voip', 'dhcp'])],
      model: 'Trasporto senza connessione e senza garanzie (niente ACK, ritrasmissioni, ordine o controllo di congestione): consegna datagrammi tra processi identificati dalle porte, con un checksum. È leggero e veloce: lo usano DNS, DHCP, streaming e VoIP.',
      dxLvl: { '3': 'UDP non instrada: definisce le porte e la comunicazione tra processi, è trasporto (4). Viaggia dentro IP.', '5': 'UDP non è un\'applicazione: è il trasporto (4) su cui viaggiano DNS, DHCP, RIP…' },
      dxOn: {
        udp: 'UDP è esso stesso il trasporto: i suoi datagrammi viaggiano dentro IP.',
        tcp: 'UDP non sta dentro TCP: sono due trasporti alternativi, entrambi dentro IP.',
        l2: 'Tra UDP e il frame c\'è IP.'
      }
    },
    {
      id: 'IP', name: 'IP', grp: 'ip', tier: 'core', core: '3', lv: ['3'], on: ['l2'],
      uses: 'il livello di collegamento: i datagrammi viaggiano dentro i frame',
      why: 'indirizza e inoltra i datagrammi tra reti: è il livello di rete',
      scope: 'indirizzare e inoltrare i datagrammi da una rete all\'altra',
      detail: 'best effort, senza connessione; i router decidono hop-by-hop sulla destinazione',
      q: 'Il datagramma IP, sul singolo link, dentro cosa viaggia?',
      dq: 'cosa fa (indirizzi e inoltro), che garanzie dà, chi decide la strada',
      kw: [G('indirizzamento e inoltro dei datagrammi', ['indirizz', 'inoltr', 'instrad']), G('best effort, senza connessione', ['best effort', 'best-effort', 'senza connession', 'nessuna garanzia', 'non affidabil', 'inaffidabil']), G('decisione hop-by-hop dei router (destinazione, TTL)', ['hop', 'router', 'ttl', 'destinazion'])],
      model: 'Indirizzamento e inoltro (instradamento) dei datagrammi da una rete all\'altra. Servizio best effort, senza connessione: nessuna garanzia di consegna. Ogni router decide hop-by-hop in base all\'indirizzo di destinazione; il TTL evita i cicli infiniti.',
      dxLvl: { '4': 'IP non ha porte e non distingue i processi: indirizza e inoltra i datagrammi tra reti, livello rete (3).', '2': 'IP attraversa i router da una rete all\'altra: è il livello di rete (3). Il livello 2 è quello dei frame e dei MAC.' },
      dxOn: { ip: 'IP è esso stesso il livello di rete: i suoi datagrammi viaggiano dentro i frame di livello 2.', l1: 'Tra IP e il mezzo fisico c\'è il livello di collegamento: il datagramma viaggia dentro un frame.' }
    },
    {
      id: 'QUIC', name: 'QUIC', grp: 'quic', tier: 'trap', lv: ['4', '5'], on: ['udp'],
      uses: 'UDP, porta 443',
      why: 'offre un servizio di trasporto (affidabile, cifrato) per HTTP/3, ma è implementato sopra UDP: trasporto (4) realizzato come applicazione su UDP',
      scope: 'trasporto affidabile e cifrato su cui viaggia HTTP/3',
      detail: 'TLS integrato, più flussi indipendenti in una connessione, handshake rapido',
      trapTxt: 'Fa il lavoro di TCP+TLS, ma i suoi pacchetti viaggiano su UDP (porta 443): si accetta trasporto (4) o applicazione (5), purché si citi UDP.',
      q: 'HTTP/3 non usa TCP: QUIC su che cosa si appoggia?',
      dq: 'chi lo usa, che servizio offre, su quale porta',
      kw: [G('trasporto affidabile e cifrato per HTTP/3', ['http/3', 'http3', 'affidabil', 'cifrat']), G('più flussi indipendenti, handshake rapido', ['multiplex', 'flussi', 'stream', '0-rtt', 'handshake']), G('porta 443', ['443'])],
      model: 'Protocollo di trasporto affidabile e cifrato (TLS integrato) usato da HTTP/3. Gira su UDP, porta 443, e implementa da sé ritrasmissioni e controllo di congestione; porta più flussi (stream) indipendenti nella stessa connessione, con un handshake più rapido di TCP+TLS.',
      dxLvl: { '3': 'QUIC non instrada: offre il trasporto a HTTP/3 ed è implementato sopra UDP (trasporto 4, o applicazione 5 su UDP).' },
      dxOn: { tcp: 'QUIC nasce proprio per non usare TCP: viaggia su UDP (porta 443) e fa da sé affidabilità e controllo di congestione.', ip: 'QUIC non sta direttamente in IP: viaggia su UDP, porta 443.' }
    }
  ];
  const byId = id => DB.find(p => p.id === id);

  // ---------------- parametri e costruzione ----------------
  // sceglie k protocolli dal pool senza doppioni (né stesso id né stesso gruppo)
  function take(pool, k, chosen) {
    const out = [];
    U.shuffle(pool).forEach(p => {
      if (out.length >= k) return;
      if (chosen.concat(out).some(c => c.id === p.id || c.grp === p.grp)) return;
      out.push(p);
    });
    chosen.push(...out);
    return out;
  }
  const NONAPP_CORE = () => DB.filter(p => p.tier === 'core');

  function randomParams(level) {
    const chosen = [];
    const trapOK = p => p.tier === 'trap';
    const nonTrap = p => p.tier !== 'trap';
    if (level <= 1) {
      // 4 protocolli comuni, uno per livello (5, 4, 3, 2)
      take(DB.filter(p => p.tier === 'app'), 1, chosen);
      take(DB.filter(p => p.core === '4'), 1, chosen);
      take(DB.filter(p => p.core === '3'), 1, chosen);
      take(DB.filter(p => p.core === '2'), 1, chosen);
    } else if (level === 2) {
      // 1 trappola "leggera" + trasporto + rete/collegamento + 2 applicazioni
      take(DB.filter(p => p.mild), 1, chosen);
      take(DB.filter(p => p.core === '4'), 1, chosen);
      take(DB.filter(p => p.id === 'IP' || p.core === '2'), 1, chosen);
      take(DB.filter(p => p.tier === 'app' || p.tier === 'base'), 2, chosen);
    } else if (level === 3) {
      // 1 trappola (anche OSPF, RIP, ICMP) + 4 senza trappola, almeno uno non applicativo
      take(DB.filter(p => ['DHCP', 'ARP', 'NAT', 'ICMP', 'OSPF', 'RIP'].includes(p.id)), 1, chosen);
      take(NONAPP_CORE(), 1, chosen);
      take(DB.filter(nonTrap), 3, chosen);
    } else if (level === 4) {
      // 2 trappole + 3 senza trappola (almeno uno non applicativo)
      take(DB.filter(trapOK), 2, chosen);
      take(NONAPP_CORE(), 1, chosen);
      take(DB.filter(nonTrap), 2, chosen);
    } else {
      // 3 trappole, con una coppia che si confonde, + 2 senza trappola
      const pairs = [['RIP', 'OSPF'], ['ICMP', 'OSPF'], ['BGP', 'RIP'], ['ARP', 'NAT'], ['QUIC', 'RIP'], ['DHCP', 'ARP']];
      U.pick(pairs).forEach(id => chosen.push(byId(id)));
      take(DB.filter(trapOK), 1, chosen);
      take(DB.filter(nonTrap), 2, chosen);
    }
    return { level, items: U.shuffle(chosen.map(p => p.id)) };
  }

  function build(p) {
    const items = p.items.map(id => U.clone(byId(id)));
    return { cat: 'protocols', level: p.level, params: p, items };
  }
  const gen = level => build(randomParams(level));

  // ---------------- passi ----------------
  const keyOf = (i, f) => `p${i + 1}.${f}`;
  function steps(ex) {
    return [
      { id: 'stack', title: 'Dove viaggia e a che livello', keys: ex.items.flatMap((_, i) => [keyOf(i, 'on'), keyOf(i, 'lvl')]) },
      { id: 'desc', title: 'Scopo e dettaglio tecnico', keys: ex.items.map((_, i) => keyOf(i, 'desc')) }
    ];
  }
  function parseKey(key) {
    const m = /^p(\d+)\.(lvl|on|desc)$/.exec(key);
    return m ? { i: Number(m[1]) - 1, f: m[2] } : null;
  }

  // ---------------- correzione ----------------
  function lvlMsg(it) {
    const alt = it.lv.length > 1 ? ` (accettato anche ${it.lv.slice(1).map(lvLabel).join(', ')})` : '';
    return `${it.name}: ${lvLabel(it.lv[0])}${alt}. Perché ${it.why}.`;
  }
  function onMsg(it) { return `${it.name}: si appoggia su ${it.uses}.`; }

  function grade(ex, a) {
    let correct = 0, total = 0;
    const marks = {};
    ex.items.forEach((it, i) => {
      const kl = keyOf(i, 'lvl'), ko = keyOf(i, 'on'), kd = keyOf(i, 'desc');
      const vl = String(a[kl] == null ? '' : a[kl]).trim();
      const vo = String(a[ko] == null ? '' : a[ko]).trim();
      const okL = it.lv.includes(vl), okO = it.on.includes(vo);
      total += 3;
      correct += (okL ? 1 : 0) + (okO ? 1 : 0);
      marks[kl] = { ok: okL, msg: lvlMsg(it) };
      marks[ko] = { ok: okO, msg: onMsg(it) };
      const g = U.gradeOpen(a[kd], it.kw, `${it.name}: scopo + un dettaglio tecnico.`);
      correct += g.part;
      marks[kd] = { ok: g.part >= 1 - 1e-9, part: g.part, msg: g.msg };
    });
    return { correct, total, marks };
  }

  function sol2answers(ex) {
    const a = {};
    ex.items.forEach((it, i) => {
      a[keyOf(i, 'on')] = it.on[0];
      a[keyOf(i, 'lvl')] = it.lv[0];
      a[keyOf(i, 'desc')] = it.model;
    });
    return a;
  }

  // ---------------- errori tipici ----------------
  const plain = t => ' ' + U.norm(t).replace(/[^a-z0-9]+/g, ' ') + ' ';
  function descDx(it, text) {
    const t = U.norm(text), tp = plain(text);
    for (const d of (it.dxDesc || [])) {
      // le espressioni sono stringhe: ex deve restare JSON
      if (d.re) { if (new RegExp(d.re).test(tp) && !(d.notRe && new RegExp(d.notRe).test(tp))) return d.msg; continue; }
      if (d.has.some(w => t.includes(w)) && !d.not.some(w => t.includes(w))) return d.msg;
    }
    return null;
  }

  function diagnose(ex, key, value, answers) {
    const v = String(value == null ? '' : value).trim();
    if (v === '') return null;
    const pk = parseKey(key);
    if (!pk || !ex.items[pk.i]) return null;
    const it = ex.items[pk.i];
    if (pk.f === 'lvl') {
      if (it.lv.includes(v)) return null;
      if (it.dxLvl && it.dxLvl[v]) return it.dxLvl[v];
      if (v === '1') return `Il livello 1 è il fisico (i bit sul mezzo): ${it.name} non sta lì. Se intendevi "il primo dall'alto", scrivi sempre il nome del livello.`;
      const myOn = answers && String(answers[keyOf(pk.i, 'on')] || '').trim();
      if (myOn && it.on.includes(myOn) && (myOn === 'tcp' || myOn === 'udp') && it.lv.includes('5'))
        return `Hai detto, giustamente, che viaggia su ${myOn.toUpperCase()}: allora per il criterio della guida è un'applicazione (5), anche se serve alla rete.`;
      return null;
    }
    if (pk.f === 'on') {
      if (it.on.includes(v)) return null;
      if (it.dxOn && it.dxOn[v]) return it.dxOn[v];
      const right = it.on[0];
      if ((right === 'tcp' || right === 'udp') && (v === 'tcp' || v === 'udp'))
        return `${it.name} usa ${right.toUpperCase()}, non ${v.toUpperCase()}: ${it.uses}.`;
      if ((right === 'tcp' || right === 'udp') && v === 'ip')
        return `${it.name} ha una porta nota (${it.uses}): direttamente in IP stanno solo i protocolli senza porte, come ICMP e OSPF.`;
      return null;
    }
    return descDx(it, v);
  }

  function diagnoseCases(ex) {
    const out = [];
    ex.items.forEach((it, i) => {
      const lk = Object.keys(it.dxLvl || {}).find(v => !it.lv.includes(v));
      if (lk) out.push({ key: keyOf(i, 'lvl'), value: lk, expect: it.dxLvl[lk].slice(0, 40) });
      else if (it.lv[0] !== '1') out.push({ key: keyOf(i, 'lvl'), value: '1', expect: 'il livello 1 è il fisico' });
      const ok = Object.keys(it.dxOn || {}).find(v => !it.on.includes(v));
      if (ok) out.push({ key: keyOf(i, 'on'), value: ok, expect: it.dxOn[ok].slice(0, 40) });
      else if (it.on[0] === 'tcp' || it.on[0] === 'udp') {
        const other = it.on[0] === 'tcp' ? 'udp' : 'tcp';
        out.push({ key: keyOf(i, 'on'), value: other, expect: `non ${other}` });
      }
      (it.dxDesc || []).forEach(d => out.push({ key: keyOf(i, 'desc'), value: d.sample, expect: d.msg.slice(0, 40) }));
    });
    // DHCP/RIP: livello sbagliato ma trasporto giusto → il criterio della guida
    ex.items.forEach((it, i) => {
      if (it.lv.length === 1 && it.lv[0] === '5' && !(it.dxLvl && it.dxLvl['4']) && (it.on[0] === 'tcp' || it.on[0] === 'udp'))
        out.push({ key: keyOf(i, 'lvl'), value: '4', expect: 'criterio della guida' });
    });
    return out;
  }

  // ---------------- aiuti ----------------
  function fieldHint(ex, key) {
    const pk = parseKey(key);
    if (!pk || !ex.items[pk.i]) return 'Rileggi il testo della domanda.';
    const it = ex.items[pk.i];
    if (pk.f === 'on') return `${it.name}: ${it.q}`;
    if (pk.f === 'lvl') return 'Decidi prima "viaggiano dentro…": TCP/UDP → applicazione; direttamente in IP → rete (TCP e UDP stessi → trasporto); frame di livello 2 → collegamento. ' + it.q;
    return `${it.name}: scrivi ${it.dq}.`;
  }

  function hints(ex) {
    const a = sol2answers(ex);
    return [
      {
        step: 'stack', title: 'Il criterio dei due passi',
        metodo: 'Passo 1: chi trasporta i suoi messaggi? Se viaggiano dentro TCP o UDP è un\'applicazione (5), anche se il suo scopo riguarda la rete. Se stanno direttamente dentro IP senza TCP/UDP è di rete (3), salvo TCP e UDP stessi, che definiscono le porte (trasporto, 4). Se stanno nel frame e non attraversano i router è collegamento (2). Passo 2: quale servizio offre? Per BGP, RIP, DHCP, ARP la risposta migliore cita entrambe le cose.',
        applicato: ex.items.map(it => `· ${it.name}: ${it.q}`).join('\n'),
        svolto: ex.items.map(it => `· ${it.name}: ${onLabel(it.on[0])} → ${lvLabel(it.lv[0])}${it.lv.length > 1 ? ' (o ' + it.lv.slice(1).map(lvLabel).join(', ') + ')' : ''}. ${it.why.charAt(0).toUpperCase() + it.why.slice(1)}.`).join('\n')
      },
      {
        step: 'desc', title: 'Scopo e dettaglio tecnico',
        metodo: 'Per ogni protocollo una o due righe: scopo + un dettaglio tecnico che dimostra che lo conosci (porta, trasporto, algoritmo, nomi dei messaggi). Il dettaglio è quello che fa prendere il punteggio pieno.',
        applicato: ex.items.map(it => `· ${it.name}: ${it.dq}.`).join('\n'),
        svolto: ex.items.map((it, i) => `· ${it.name}: ${a[keyOf(i, 'desc')]}`).join('\n')
      }
    ];
  }

  // ---------------- disegno ----------------
  function render(ex, root, ctx) {
    root.appendChild(U.h('div', { class: 'card intro' },
      U.h('p', {}, U.h('b', {}, 'Testo. '), 'Descrivere lo scopo e il livello della pila Internet in cui operano i seguenti protocolli: ',
        U.h('b', {}, ex.items.map(it => it.name).join(', ')), '.'),
      U.h('p', { class: 'small' }, 'Prima decidi dove viaggiano i messaggi di ciascun protocollo: è il criterio per trovare il livello. Poi scrivi scopo e un dettaglio tecnico. Le descrizioni si valutano dai punti chiave citati; per una correzione completa usa 📝.')));

    root.appendChild(U.card('a) I messaggi di ciascun protocollo dentro cosa viaggiano? A quale livello opera?', { step: 'stack' },
      U.table(['Protocollo', 'I suoi messaggi viaggiano dentro…', 'Livello'], ex.items.map((it, i) => [
        U.label(it.name),
        U.sel(ctx, keyOf(i, 'on'), ON_OPTS, { label: `${it.name}: viaggia dentro` }),
        U.sel(ctx, keyOf(i, 'lvl'), LV_OPTS, { label: `${it.name}: livello` })
      ]))));

    root.appendChild(U.card('b) A cosa serve? Scopo + un dettaglio tecnico (porta, algoritmo, messaggi)', { step: 'desc' },
      ex.items.map((it, i) => U.h('div', { class: 'proto-item' },
        U.h('div', { class: 'proto-name' }, it.name),
        U.ta(ctx, keyOf(i, 'desc'), { rows: 2, ph: 'scopo + un dettaglio tecnico…', label: `${it.name}: descrizione` })))));
  }

  function solution(ex, root) {
    const traps = ex.items.filter(it => it.trapTxt);
    root.appendChild(U.h('div', { class: 'card sol' },
      U.h('h4', {}, 'Soluzione'),
      U.h('p', { class: 'sol-body' }, 'Per ogni protocollo: prima dove viaggiano i messaggi, da lì il livello; poi scopo e dettaglio.'),
      U.table(['Protocollo', 'Si appoggia su', 'Livello', 'Scopo', 'Dettaglio tecnico'], ex.items.map(it => [
        U.label(it.name), it.uses, lvLabel(it.lv[0]) + (it.lv.length > 1 ? ' (o ' + it.lv.slice(1).map(lvLabel).join(', ') + ')' : ''), it.scope, it.detail
      ])),
      traps.length ? U.h('div', {},
        U.h('p', { class: 'sol-body' }, U.h('b', {}, 'Le trappole di questo esercizio')),
        traps.map(it => U.h('p', { class: 'sol-body' }, U.h('b', {}, it.name + ': '), it.trapTxt))) : null,
      ex.items.some(it => it.id === 'RIP') && ex.items.some(it => it.id === 'OSPF') ?
        U.h('p', { class: 'small' }, 'RIP e OSPF servono entrambi al routing intra-AS: la differenza di livello sta tutta nel trasporto (RIP su UDP 520, OSPF direttamente in IP).') : null,
      U.h('p', { class: 'sol-body' }, U.h('b', {}, 'Risposte modello')),
      ex.items.map(it => U.h('p', { class: 'sol-body' }, U.h('b', {}, `${it.name} — ${lvLabel(it.lv[0])}. `), it.model))));
  }

  function chatText(ex, a) {
    const v = k => (a && String(a[k] || '').trim()) || '__';
    const L = [];
    L.push(`#2 · Protocolli e pila Internet (livello ${ex.level})`);
    L.push('## Testo');
    L.push('Descrivere lo scopo e il livello della pila Internet in cui operano i seguenti protocolli: ' + ex.items.map(it => it.name).join(', ') + '.');
    L.push('');
    L.push('## Le mie risposte');
    ex.items.forEach((it, i) => {
      const on = v(keyOf(i, 'on')), lv = v(keyOf(i, 'lvl'));
      L.push(`- ${it.name} — viaggia dentro: ${on === '__' ? on : onLabel(on)}; livello: ${lv === '__' ? lv : lvLabel(lv)}; scopo: ${v(keyOf(i, 'desc'))}`);
    });
    return L.join('\n');
  }

  RA.protocols = {
    id: 'protocols', num: '2', name: 'Protocolli e pila Internet', examPoints: 4,
    desc: 'Livello e scopo dei protocolli: dove viaggiano i messaggi (TCP, UDP, IP, frame) e le trappole BGP, RIP, DHCP, ARP, NAT.',
    method: {
      intro: 'Domanda di teoria: per ogni protocollo livello (nome + numero), scopo e un dettaglio tecnico. Sembra facile, ma i punti si perdono sul livello: decidilo con un criterio, non a memoria.',
      steps: [
        'Chi trasporta i messaggi? Dentro TCP o UDP → applicazione (5), anche se serve alla rete (DNS, DHCP, RIP, BGP).',
        'Direttamente dentro IP, senza porte → rete (3): ICMP (protocollo 1), OSPF (protocollo 89). TCP e UDP, che le porte le definiscono, sono il trasporto (4).',
        'Lavora con i MAC e non attraversa i router (ARP, Ethernet, Wi-Fi) → collegamento (2). ARP "tra 2 e 3": con un numero, 2.',
        'Poi il servizio offerto: per BGP, RIP, DHCP, ARP cita sia dove gira sia a quale livello serve.',
        'Scrivi una o due righe: livello (nome + numero), scopo, un dettaglio tecnico (porta, trasporto, algoritmo, messaggi).'
      ],
      traps: [
        'DHCP assegna gli IP ma è un\'applicazione su UDP 67/68: non è di livello 3, e tanto meno di livello 1.',
        'RIP e OSPF fanno entrambi routing intra-AS: RIP viaggia su UDP 520 (applicazione), OSPF dentro IP (rete).',
        'BGP: "livello 3" è accettabile ma incompleto. Aggiungi inter-AS, path vector, TCP 179.',
        'ARP traduce IP → MAC, non il contrario, e sta nel frame Ethernet, non in IP.',
        'NAT: livello 3, ma riscrive anche le porte (livello 4): per questo viola la stratificazione.',
        'Il livello 1 è il fisico. Se intendi "il primo dall\'alto" scrivi il nome: applicazione.'
      ],
      formulas: [
        ['5 Applicazione', 'messaggi · nomi, URL · HTTP, FTP, SMTP, POP3/IMAP, DNS, DHCP, SSH, SNMP, BGP, RIP'],
        ['4 Trasporto', 'segmenti · porte · TCP, UDP (QUIC su UDP)'],
        ['3 Rete', 'datagrammi · indirizzi IP · IP, ICMP, OSPF, NAT'],
        ['2 Collegamento', 'frame · indirizzi MAC · Ethernet, Wi-Fi, ARP'],
        ['1 Fisico', 'bit sul mezzo · cavo, fibra, radio'],
        ['Porte', 'HTTP 80/443 · FTP 21/20 · SMTP 25 · POP3 110 · IMAP 143 · DNS 53 · DHCP 67/68 · SSH 22 · Telnet 23 · SNMP 161/162 · BGP 179 · RIP 520'],
        ['Dentro IP', 'ICMP = protocollo 1 · OSPF = protocollo 89 (numeri di protocollo, non porte)'],
        ['Routing', 'intra-AS: RIP (distance vector, Bellman-Ford), OSPF (link state, Dijkstra) · inter-AS: BGP (path vector)']
      ]
    },
    traces: [{
      id: 'sim-protocols', set: 'simulato',
      title: 'Esame simulato · Protocolli (OSPF, ICMP, DNS, SMTP, RIP)',
      source: 'Esame_Simulato_TESTO.pdf pag. 4 · soluzioni pag. 4',
      params: { level: 4, items: ['OSPF', 'ICMP', 'DNS', 'SMTP', 'RIP'] },
      expect: {
        'p1.lvl': '3', 'p1.on': 'ip',
        'p2.lvl': '3', 'p2.on': 'ip',
        'p3.lvl': '5', 'p3.on': 'udp',
        'p4.lvl': '5', 'p4.on': 'tcp',
        'p5.lvl': '5', 'p5.on': 'udp'
      }
    }],
    randomParams, build, gen, steps, grade, sol2answers, render, solution, hints, fieldHint, diagnose, diagnoseCases, chatText
  };
})();
