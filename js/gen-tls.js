// ============================================================
// RetiApp · gen-tls.js — Esercizio 5 · SSL/TLS e firewall
// Contratto dei moduli: vedi docs/moduli.md (modello: gen-nat.js)
// ============================================================
(function () {
  const RA = window.RetiApp;
  const U = RA.util;

  // ---------------- record SSL: campi e significati ----------------
  const MEAN = {
    type: 'Tipo di contenuto del record (dati, handshake, chiusura…)',
    ver: 'Versione di SSL/TLS in uso, concordata nell\'handshake',
    len: 'Lunghezza del frammento: dice dove finiscono i dati e inizia il MAC',
    data: 'Frammento dei dati dell\'applicazione (al massimo circa 16 KB)',
    mac: 'Codice di integrità H(Mx, dati, tipo, seq#), con la chiave MAC del verso',
    msg: 'Il flusso di byte dell\'applicazione, prima di essere spezzato',
    frag: 'Un pezzo del flusso (al massimo circa 16 KB): ogni pezzo diventa un record',
    hdr: 'Intestazione del record: tipo, versione e lunghezza',
    encmac: 'Frammento e MAC cifrati insieme con la chiave simmetrica del verso (Kc o Ks)',
    seq: 'Numero di sequenza del record, letto dal ricevente',
    crc: 'Checksum per scoprire gli errori di trasmissione',
    pms: 'Pre-master secret cifrato con la chiave pubblica del server',
    port: 'Porte TCP di sorgente e destinazione'
  };
  // errori tipici sui significati "esca"
  const MEAN_ERR = {
    seq: 'Il numero di sequenza non viaggia nel record: lo contano mittente e destinatario e lo mettono solo dentro il calcolo del MAC.',
    crc: 'Il MAC non è una checksum: dipende da una chiave segreta (Mc o Ms), quindi chi modifica i dati non può ricalcolarlo. Gli errori di trasmissione li controlla già TCP.',
    pms: 'Il pre-master secret viaggia una volta sola, nell\'handshake: nei record ci sono solo i dati dell\'applicazione.',
    port: 'Le porte stanno nell\'header TCP, sotto SSL: il record non le contiene.'
  };
  const FIGS = {
    record: {
      fields: [
        { f: 'type', name: 'content type', mean: 'type', enc: 'no', why: 'Entra anche nel MAC: una chiusura falsa (un FIN TCP inventato) non può passare per la fine dei dati, perché la chiusura vera è un record di tipo "chiusura" autenticato.' },
        { f: 'ver', name: 'SSL version', mean: 'ver', enc: 'no', why: 'Il ricevente interpreta il record con le regole della versione giusta.' },
        { f: 'len', name: 'length', mean: 'len', enc: 'no', why: 'Il ricevente sa quanti byte leggere da TCP per questo record e, dopo aver decifrato, dove finiscono i dati e inizia il MAC.' },
        { f: 'data', name: 'data', mean: 'data', enc: 'si', why: 'SSL spezza il flusso in frammenti: si verifica il MAC di ogni pezzo appena arriva, senza aspettare la fine.' },
        { f: 'mac', name: 'MAC', mean: 'mac', enc: 'si', why: 'Il ricevente lo ricalcola: se coincide, il frammento non è stato modificato, ripetuto o riordinato (dentro c\'è il seq#).' }
      ],
      opts: ['type', 'ver', 'len', 'data', 'mac', 'seq', 'crc', 'port']
    },
    frag: {
      fields: [
        { f: 'data', name: 'data', mean: 'msg', enc: null, why: 'È il flusso che l\'applicazione scrive nel socket SSL.' },
        { f: 'frag', name: 'data fragment', mean: 'frag', enc: 'si', why: 'Con pezzi piccoli il MAC si verifica pezzo per pezzo, senza aspettare la fine del flusso.' },
        { f: 'mac', name: 'MAC', mean: 'mac', enc: 'si', why: 'Calcolato sul frammento in chiaro, con tipo e seq#; poi viene cifrato insieme al frammento.' },
        { f: 'hdr', name: 'record header', mean: 'hdr', enc: 'no', why: 'Resta in chiaro: il ricevente legge la lunghezza per sapere quanti byte decifrare.' },
        { f: 'encmac', name: 'encrypted data and MAC', mean: 'encmac', enc: null, why: 'È la parte protetta del record: riservatezza (cifratura) e integrità (MAC) insieme.' }
      ],
      opts: ['msg', 'frag', 'mac', 'hdr', 'encmac', 'seq', 'crc', 'pms']
    }
  };
  const ENC_OPTS = [['si', 'sì, cifrato'], ['no', 'no, in chiaro']];

  // ---------------- handshake TLS (6 passi del corso) ----------------
  const HS = [
    { c: 'hello', t: 'Il client invia la lista degli algoritmi che supporta e un nonce' },
    { c: 'choice', t: 'Il server sceglie gli algoritmi e risponde con la scelta, il certificato e il suo nonce' },
    { c: 'pms', t: 'Il client verifica il certificato, genera il pre-master secret e lo invia cifrato con la chiave pubblica del server' },
    { c: 'keys', t: 'Client e server calcolano, ognuno da sé, master secret e chiavi (Kc, Mc, Ks, Ms) da pre-master e nonce' },
    { c: 'macc', t: 'Il client invia un MAC di tutti i messaggi dell\'handshake' },
    { c: 'macs', t: 'Il server invia un MAC di tutti i messaggi dell\'handshake' }
  ];
  const HS_CODES = HS.map(s => s.c);

  // ---------------- domande chiuse ----------------
  // Q(id, passo, testo, indizio, perché, [[codice, giusta], [codice, sbagliata, errore], ...]) — la prima è giusta
  const BANK = [];
  function Q(id, part, q, hint, why, opts) {
    BANK.push({ id, part, q, hint, why, opts: opts.map(o => ({ c: o[0], t: o[1], err: o[2] || null })) });
  }
  // --- record ---
  Q('rec-cipher', 'record', 'Che tipo di cifratura si usa per i campi cifrati del record?',
    'La chiave pubblica è lenta: quando si usa, nell\'handshake o nei record?',
    'Cifratura simmetrica (es. AES) con la chiave di sessione del verso: Kc dal client al server, Ks dal server al client. La chiave pubblica serve solo nell\'handshake.',
    [['sym', 'Simmetrica, con la chiave di sessione del verso (Kc o Ks)'],
      ['pub', 'A chiave pubblica, con la chiave pubblica del server', 'La chiave pubblica serve solo nell\'handshake, per cifrare il pre-master secret: è troppo lenta per i dati. I record usano cifratura simmetrica.'],
      ['priv', 'Con la chiave privata del mittente (firma digitale)', 'Cifrare con la chiave privata è una firma: chiunque decifra con la pubblica, quindi niente riservatezza. I record usano chiavi simmetriche.'],
      ['hash', 'Nessuna cifratura: basta l\'hash del MAC', 'Il MAC dà integrità, non riservatezza: dati e MAC viaggiano cifrati con una chiave simmetrica.']]);
  Q('rec-layer', 'record', 'Quale livello della pila Internet provvede al recapito del record?',
    'SSL sta tra l\'applicazione e il trasporto: a chi consegna il record da spedire?',
    'Il livello di trasporto: SSL scrive il record in una connessione TCP, che lo recapita in modo affidabile e in ordine.',
    [['tr', 'Il trasporto: il record viaggia nel payload di segmenti TCP'],
      ['net', 'La rete: IP consegna i record', 'IP consegna i datagrammi, ma SSL lavora sopra TCP: il record è scritto in un socket TCP, che lo recapita. La risposta attesa è il trasporto.'],
      ['app', 'L\'applicazione: è HTTP a recapitarlo', 'HTTP sta sopra SSL: consegna i suoi dati a SSL, non il contrario.'],
      ['link', 'Il collegamento: i frame Ethernet', 'Il collegamento porta i frame da un nodo al successivo; il record lo consegna TCP, da un capo all\'altro.']]);
  Q('rec-keys', 'record', 'Quali chiavi si usano per proteggere i record?',
    'Dal master secret si ricavano più chiavi: quante, e per cosa?',
    'Le 4 chiavi simmetriche derivate dal master secret: Kc e Ks per cifrare, Mc e Ms per il MAC, una coppia per verso. Pubblica e privata servono solo nell\'handshake.',
    [['sess', 'Le chiavi di sessione simmetriche: Kc/Ks per cifrare, Mc/Ms per il MAC'],
      ['pubpriv', 'La chiave pubblica del server per cifrare e la privata per decifrare', 'Pubblica e privata servono nell\'handshake (per il pre-master secret); i record usano le chiavi di sessione simmetriche, molto più veloci.'],
      ['one', 'Una sola chiave di sessione, per cifratura e MAC nei due versi', 'Si derivano chiavi diverse per funzione (cifratura, MAC) e per verso: 4 chiavi. Usare la stessa chiave per tutto indebolisce la protezione.'],
      ['master', 'Il master secret, usato direttamente', 'Il master secret non si usa direttamente: da esso si derivano le 4 chiavi Kc, Mc, Ks, Ms.']]);
  [['cs', 'dal client al server', 'Kc', 'Mc', 'Ks', 'Ms'], ['sc', 'dal server al client', 'Ks', 'Ms', 'Kc', 'Mc']].forEach(([d, dt, K, M, K2, M2]) => {
    Q(`rec-key-${d}`, 'record', `Un record va ${dt}: con quale chiave si cifrano dati e MAC?`,
      'Ogni verso ha la sua coppia di chiavi: una per cifrare, una per il MAC.',
      `Con ${K}, la chiave di cifratura del verso ${dt}. ${M} serve per il MAC dello stesso verso.`,
      [[K, K],
        [K2, K2, `${K2} è la chiave di cifratura dell'altro verso: ogni verso ha la sua.`],
        [M, M, `${M} è la chiave del MAC, non della cifratura: si usa per calcolare H(${M}, dati, tipo, seq#).`],
        ['pubS', 'La chiave pubblica del server', 'La chiave pubblica del server serve solo nell\'handshake, per il pre-master secret: i record si cifrano con chiavi simmetriche.']]);
    Q(`rec-mac-${d}`, 'record', `Un record va ${dt}: con quale chiave si calcola il MAC?`,
      'Il MAC usa una chiave segreta diversa da quella di cifratura, una per verso.',
      `Con ${M}: MAC = H(${M}, dati, tipo, seq#). ${K} serve per cifrare lo stesso verso.`,
      [[M, M],
        [M2, M2, `${M2} è la chiave MAC dell'altro verso: ogni verso ha la sua.`],
        [K, K, `${K} è la chiave di cifratura: per il MAC c'è una chiave apposta, ${M}.`],
        ['privC', 'La chiave privata del mittente', 'Il MAC non è una firma digitale: usa una chiave segreta condivisa (simmetrica), derivata dal master secret.']]);
  });
  Q('rec-seq', 'record', 'Perché nel calcolo del MAC entra il numero di sequenza?',
    'Pensa a un attaccante che non può modificare i record ma può registrarli e rispedirli.',
    'Contro replay e riordino: un record ripetuto, tolto o spostato ha un seq# diverso da quello atteso, quindi il MAC non torna.',
    [['replay', 'Per scoprire record ripetuti (replay), tolti o scambiati di ordine'],
      ['tcp', 'Perché TCP non ha numeri di sequenza', 'TCP li ha, ma non sono protetti: un attaccante può riscriverli. Il seq# dentro il MAC è protetto dalla chiave Mx.'],
      ['read', 'Perché il ricevente lo legge dall\'header del record', 'Il seq# non viaggia nel record: lo contano mittente e destinatario e lo usano solo nel calcolo del MAC.'],
      ['frag', 'Per riassemblare i frammenti nell\'ordine giusto', 'L\'ordine lo garantisce già TCP: il seq# nel MAC serve a scoprire chi altera l\'ordine apposta.']]);
  Q('rec-type', 'record', 'Perché nel MAC entra anche il tipo del record (0 = dati, 1 = chiusura)?',
    'Cosa succede se un attaccante inventa un segmento TCP con FIN a metà trasferimento?',
    'Contro il troncamento: un FIN TCP falso non autenticato non chiude la sessione; la chiusura vera è un record di tipo 1, protetto dal MAC.',
    [['trunc', 'Contro il troncamento: la chiusura vera è un record di tipo 1 autenticato, non un FIN TCP'],
      ['dec', 'Per sapere con quale algoritmo decifrare il record', 'L\'algoritmo è deciso nell\'handshake, una volta sola. Il tipo nel MAC serve contro le chiusure false (troncamento).'],
      ['ver', 'Per negoziare la versione di SSL', 'La versione ha il suo campo e si negozia nell\'handshake. Il tipo nel MAC serve contro il troncamento.'],
      ['size', 'Per distinguere i dati dal MAC dentro il record', 'Dati e MAC li separa la lunghezza. Il tipo nel MAC impedisce di spacciare una chiusura falsa.']]);
  Q('rec-order', 'record', 'In che ordine si costruisce un record a partire da un frammento?',
    'Segui lo schema dall\'alto: cosa compare accanto al data fragment prima della cifratura?',
    'Frammento → MAC calcolato sul frammento in chiaro → frammento e MAC cifrati insieme → record header in chiaro davanti.',
    [['mte', 'Frammento → MAC sul frammento in chiaro → cifratura di frammento e MAC → header davanti'],
      ['etm', 'Frammento → cifratura → MAC sui dati cifrati → header davanti', 'Nello schema del corso il MAC si calcola sul frammento in chiaro e viene cifrato insieme a lui (blocco "encrypted data and MAC").'],
      ['hdrenc', 'Frammento → MAC → header → cifratura di tutto il record', 'L\'header resta in chiaro: il ricevente deve leggere la lunghezza prima di decifrare.'],
      ['end', 'Tutto il messaggio → un solo MAC alla fine → cifratura', 'Con un solo MAC in fondo si dovrebbe aspettare la fine del flusso per verificare: per questo si spezza in frammenti, ognuno con il suo MAC.']]);
  // --- handshake ---
  Q('hs-nonce', 'hsq', 'Perché nell\'handshake ci sono due nonce, uno del client e uno del server?',
    'Un attaccante registra un handshake intero e lo rispedisce il giorno dopo: cosa lo ferma?',
    'Contro il replay: con un nonce nuovo cambiano master secret e chiavi, quindi una sessione registrata non si può rigiocare.',
    [['replay', 'Contro il replay: un nonce nuovo cambia master secret e chiavi, una sessione registrata non si riusa'],
      ['enc', 'Servono a cifrare il pre-master secret', 'Il pre-master si cifra con la chiave pubblica del server. I nonce entrano nel calcolo delle chiavi per renderle uniche.'],
      ['sync', 'Sincronizzano i numeri di sequenza di TCP', 'I numeri di sequenza TCP li scambia l\'handshake TCP. I nonce di TLS servono contro il replay.'],
      ['id', 'Identificano la sessione al posto delle porte', 'I nonce non identificano nulla: sono numeri usati una volta sola, per rendere unica ogni sessione.']]);
  Q('hs-mac', 'hsq', 'Perché alla fine dell\'handshake client e server si mandano un MAC di tutti i messaggi scambiati?',
    'I primi messaggi (lista degli algoritmi) viaggiano in chiaro: cosa potrebbe fare un uomo nel mezzo?',
    'Un MITM potrebbe modificare i primi messaggi, ad esempio togliere dalla lista gli algoritmi forti. Con il MAC di tutto l\'handshake ognuno controlla che l\'altro abbia visto gli stessi messaggi.',
    [['mitm', 'Per scoprire un MITM che ha modificato i messaggi, ad esempio togliendo gli algoritmi forti'],
      ['key', 'Per trasmettere il master secret all\'altro', 'Il master secret non viaggia mai: lo calcolano entrambi da pre-master e nonce.'],
      ['cert', 'Per firmare il certificato del server', 'Il certificato lo firma la CA, prima della connessione. Il MAC finale protegge i messaggi dell\'handshake.'],
      ['ack', 'Per confermare la ricezione, come un ACK', 'Della consegna si occupa TCP. Il MAC finale serve a scoprire modifiche ai messaggi.']]);
  Q('hs-cert', 'hsq', 'A cosa serve il certificato che il server manda nell\'handshake?',
    'Chi firma il certificato, e cosa lega insieme?',
    'Lega la chiave pubblica all\'identità del server, con la firma di una CA: il client è sicuro di cifrare il pre-master per il server vero e non per un impostore.',
    [['auth', 'Lega la chiave pubblica all\'identità del server, con la firma di una CA'],
      ['sym', 'Contiene la chiave simmetrica di sessione', 'La chiave di sessione non viaggia: si deriva dal master secret. Il certificato porta la chiave pubblica del server.'],
      ['client', 'Autentica il client presso il server', 'Nell\'handshake del corso è il server ad autenticarsi con il certificato; il client lo verifica.'],
      ['priv', 'Trasporta la chiave privata del server', 'La chiave privata non lascia mai il server: il certificato contiene la chiave pubblica.']]);
  Q('hs-master', 'hsq', 'Cos\'è il master secret e cosa se ne ricava?',
    'Cosa viaggia cifrato nel passo 3, e cosa calcolano i due lati nel passo 4?',
    'È un segreto comune che client e server calcolano da pre-master secret e nonce; ne derivano 4 chiavi: Kc, Mc, Ks, Ms.',
    [['kdf', 'Un segreto calcolato da pre-master e nonce; ne derivano 4 chiavi: Kc, Mc, Ks, Ms'],
      ['sent', 'Il segreto che il client invia cifrato con la chiave pubblica del server', 'Viaggia il pre-master secret, non il master: il master lo calcolano entrambi, con i nonce.'],
      ['one', 'La chiave unica con cui si cifrano tutti i record nei due versi', 'Dal master secret si derivano chiavi diverse per verso e per funzione: 4 chiavi.'],
      ['priv', 'Un altro nome della chiave privata del server', 'La chiave privata serve solo a decifrare il pre-master; il master secret è un segreto condiviso, simmetrico.']]);
  // --- firewall ---
  Q('fw-state', 'fwq', 'Un filtro stateless ha la regola «allow, da fuori verso la rete interna, TCP, porta sorgente 80, porta destinazione > 1023, flag ACK». Arriva da fuori un segmento con ACK = 1 che rispetta la regola, ma nessun host interno ha aperto quella connessione. Cosa succede?',
    'Il filtro stateless guarda un pacchetto alla volta: sa quali connessioni sono aperte?',
    'Lo stateless lo lascia passare: guarda solo i campi del pacchetto, e ACK = 1 con le porte giuste basta. Lo stateful tiene la tabella delle connessioni e lo scarta, perché non appartiene a nessuna connessione aperta.',
    [['pass', 'Lo stateless lo lascia passare; uno stateful lo scarterebbe (nessuna connessione aperta)'],
      ['both', 'Lo scartano sia lo stateless sia lo stateful', 'Lo stateless non conosce le connessioni: guarda un pacchetto alla volta, e il segmento rispetta la regola.'],
      ['none', 'Passa sia nello stateless sia nello stateful', 'Lo stateful tiene traccia delle connessioni TCP: un ACK fuori da ogni connessione aperta viene scartato.'],
      ['syn', 'Lo stateless lo scarta perché prima non è passato il SYN', 'Ricordarsi del SYN vuol dire tenere uno stato: è proprio quello che lo stateless non fa.']]);
  Q('fw-hi', 'fwq', 'Perché nelle regole la porta del client è scritta "> 1023"?',
    'Quali porte usano i server, e quali i client?',
    'I server stanno sulle porte note (0-1023); i client usano porte effimere, sopra 1023. La regola così accetta qualsiasi client e lo distingue dal server.',
    [['eph', 'I client usano porte effimere sopra 1023; i server stanno sulle porte note (0-1023)'],
      ['sec', 'Le porte sopra 1023 sono cifrate', 'Nessuna porta è cifrata: è un numero nell\'header TCP/UDP.'],
      ['udp', 'Sopra 1023 ci sono solo porte UDP', 'TCP e UDP hanno entrambi porte da 0 a 65535.'],
      ['admin', 'Le porte sotto 1024 sono riservate al firewall', 'Le porte sotto 1024 sono quelle "note" dei servizi (80, 53, 22…), non del firewall.']]);
  Q('fw-ack', 'fwq', 'A cosa serve "flag ACK" nella regola che fa entrare le risposte web?',
    'Il primo segmento di una connessione TCP ha ACK = 0 o 1?',
    'Il primo segmento di una connessione (SYN) ha ACK = 0. Chiedendo ACK = 1 entrano solo segmenti di connessioni già avviate: un host esterno non può aprire una connessione verso la rete interna.',
    [['open', 'Fa entrare solo segmenti di connessioni già avviate: un SYN da fuori (ACK = 0) è bloccato'],
      ['fast', 'Fa passare più in fretta i segmenti di conferma', 'Il firewall non dà priorità: ACK = 1 è una condizione per far passare il segmento.'],
      ['data', 'Blocca i segmenti che portano dati', 'Quasi tutti i segmenti dopo il SYN hanno ACK = 1, dati compresi: la regola blocca le aperture da fuori.'],
      ['udp', 'Vale anche per le risposte DNS su UDP', 'UDP non ha flag: il flag ACK esiste solo in TCP.']]);
  // --- IPsec e WEP ---
  Q('ip-ah', 'sec', 'Cosa offre AH (Authentication Header) di IPsec?',
    'Il nome dice "authentication": e la riservatezza?',
    'Autenticazione della sorgente e integrità del datagramma, ma niente riservatezza: il payload viaggia in chiaro.',
    [['ai', 'Autenticazione e integrità, senza riservatezza'],
      ['all', 'Autenticazione, integrità e riservatezza', 'Questo è ESP: AH non cifra, il payload resta leggibile.'],
      ['conf', 'Solo riservatezza (cifratura)', 'AH non cifra nulla: dà autenticazione e integrità.'],
      ['ike', 'Lo scambio delle chiavi tra i due estremi', 'Le chiavi e le SA le negozia IKE, non AH.']]);
  Q('ip-esp', 'sec', 'Cosa aggiunge ESP rispetto ad AH?',
    'Uno dei due protocolli cifra il payload: quale?',
    'La riservatezza: ESP cifra il payload (con l\'ESP trailer) e aggiunge un MAC, quindi dà autenticazione, integrità e riservatezza.',
    [['conf', 'La riservatezza: cifra il payload, oltre ad autenticare e controllare l\'integrità'],
      ['auth', 'Solo l\'autenticazione, che AH non dà', 'AH l\'autenticazione la dà già: ESP aggiunge la cifratura.'],
      ['nothing', 'Niente: è un altro nome di AH', 'Sono due protocolli diversi: AH non cifra, ESP sì.'],
      ['tcp', 'L\'affidabilità, come TCP', 'IPsec non ritrasmette nulla: ESP aggiunge riservatezza.']]);
  Q('ip-mode', 'sec', 'Che differenza c\'è tra transport mode e tunnel mode?',
    'Quale delle due modalità aggiunge un nuovo header IP?',
    'Transport mode protegge solo il payload del datagramma, di solito tra host. Tunnel mode protegge l\'intero datagramma originale e aggiunge un nuovo header IP, di solito tra router (VPN).',
    [['tt', 'Transport protegge solo il payload (host); tunnel protegge tutto il datagramma e aggiunge un nuovo header IP (router, VPN)'],
      ['swap', 'Transport protegge tutto il datagramma; tunnel solo il payload', 'È il contrario: il tunnel incapsula tutto il datagramma originale sotto un nuovo header IP.'],
      ['tcp', 'Transport si usa con TCP, tunnel con UDP', 'La modalità non dipende dal protocollo di trasporto: cambia cosa viene protetto.'],
      ['enc', 'Transport non cifra, tunnel cifra', 'La cifratura la decide il protocollo (ESP sì, AH no), non la modalità.']]);
  Q('ip-sa', 'sec', 'Cos\'è una Security Association (SA) di IPsec?',
    'IPsec è orientato alla connessione: quante SA servono per parlare nei due versi?',
    'Una "connessione" logica unidirezionale, identificata da un SPI a 32 bit, con protocollo (AH o ESP), algoritmi e chiavi. Per i due versi servono due SA.',
    [['uni', 'Una connessione logica unidirezionale, con SPI a 32 bit, algoritmi e chiavi'],
      ['bi', 'Una connessione bidirezionale tra due router', 'La SA è unidirezionale: per i due versi ne servono due.'],
      ['tcp', 'Una connessione TCP cifrata', 'La SA è a livello di rete, sotto TCP: protegge i datagrammi IP.'],
      ['cert', 'Il certificato del router', 'La SA contiene lo stato (SPI, algoritmi, chiavi), non un certificato.']]);
  Q('ip-db', 'sec', 'Che ruolo hanno SPD e SAD?',
    'Uno dice se proteggere un datagramma, l\'altro come farlo.',
    'L\'SPD (policy) dice COSA fare: se usare IPsec e con quale SA. Il SAD dice COME: lo stato di ogni SA (chiavi, algoritmi, seq#), cercato con l\'SPI.',
    [['whathow', 'SPD dice cosa fare (se usare IPsec, quale SA); SAD dice come (stato della SA, cercato con l\'SPI)'],
      ['swap', 'SAD dice cosa fare; SPD contiene chiavi e algoritmi di ogni SA', 'Invertiti: SPD = policy (cosa), SAD = stato delle SA (come).'],
      ['dns', 'Sono i database dei nomi per trovare il router remoto', 'Non c\'entrano con il DNS: sono le tabelle di IPsec.'],
      ['ike', 'Sono i due messaggi della prima fase di IKE', 'Sono database locali di ogni estremo, non messaggi.']]);
  Q('wep-iv', 'sec', 'Perché la cifratura WEP si può violare?',
    'Quanti bit ha l\'IV, e viaggia in chiaro?',
    'L\'IV è di soli 24 bit, uno per frame, e viaggia in chiaro: prima o poi si ripete. Con lo stesso IV si ripete il keystream, e chi conosce un testo in chiaro decifra gli altri frame con quell\'IV.',
    [['iv', 'L\'IV di 24 bit viaggia in chiaro e si ripete: con lo stesso IV si ripete il keystream'],
      ['brute', 'La chiave segreta si trova per forza bruta in pochi secondi', 'Il punto debole non è la chiave in sé, ma l\'IV corto che si riusa.'],
      ['nonce', 'Il nonce di autenticazione è troppo lungo (128 byte)', 'La lunghezza del nonce non è il problema: è l\'IV di 24 bit che si ripete.'],
      ['open', 'Non cifra i dati, solo l\'autenticazione', 'WEP cifra i frame; il problema è il riuso dell\'IV.']]);

  const bankById = id => BANK.find(b => b.id === id);

  // ---------------- piccoli helper ----------------
  // permutazione deterministica (per tracce e parametri senza ordine)
  function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function detPerm(n, seed) {
    const a = Array.from({ length: n }, (_, i) => i);
    let x = hashStr(seed) || 1;
    for (let i = n - 1; i > 0; i--) { x = (Math.imul(x, 1103515245) + 12345) >>> 0; const j = (x >>> 8) % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const okPerm = (o, n) => Array.isArray(o) && o.length === n && o.slice().sort((a, b) => a - b).every((v, i) => v === i);
  const perm = n => U.shuffle(Array.from({ length: n }, (_, i) => i));
  const val = v => String(v == null ? '' : v).trim();

  function inNet(ip, pfx) {
    const n = U.ip2int(ip), p = U.parsePrefix(pfx);
    if (n === null || !p) return false;
    const m = U.maskOf(p.n);
    return ((n & m) >>> 0) === ((p.ip & m) >>> 0);
  }
  function netShort(pfx) {
    const [ip, n] = pfx.split('/');
    return ip.split('.').slice(0, Math.max(1, Math.ceil(Number(n) / 8))).join('.') + '/' + n;
  }
  function addrTxt(a, net) {
    return { in: netShort(net), out: 'fuori da ' + netShort(net), any: 'tutti', host: a.v, net: a.v ? netShort(a.v) : '' }[a.k];
  }
  function addrDesc(a, net) {
    return { in: `dentro ${netShort(net)}`, out: `fuori da ${netShort(net)}`, any: 'qualsiasi', host: `l'host ${a.v}`, net: `nella rete ${a.v ? netShort(a.v) : ''}` }[a.k];
  }
  const portTxt = p => p === 'any' ? 'tutte' : p === 'hi' ? '> 1023' : String(p);
  const flagTxt = f => f === 'any' ? 'qualsiasi' : f === 'ACK' ? 'ACK' : '—';
  const protoTxt = p => p === 'any' ? 'tutti' : p;
  const actTxt = a => a === 'allow' ? 'allow (passa)' : 'deny (scartato)';
  function addrOk(a, ip, net) {
    if (a.k === 'any') return true;
    if (a.k === 'in') return inNet(ip, net);
    if (a.k === 'out') return !inNet(ip, net);
    if (a.k === 'host') return ip === a.v;
    return inNet(ip, a.v);
  }
  const portOk = (r, p) => r === 'any' || (r === 'hi' ? p > 1023 : Number(r) === p);
  const hasAck = pk => /ACK/.test(pk.flags || '');
  // prima condizione della regola che il pacchetto non rispetta (null = la regola corrisponde)
  function whyNot(r, pk, net) {
    if (!addrOk(r.src, pk.src, net)) return { c: 'src', t: `la sorgente ${pk.src} non è ${addrDesc(r.src, net)}` };
    if (!addrOk(r.dst, pk.dst, net)) return { c: 'dst', t: `la destinazione ${pk.dst} non è ${addrDesc(r.dst, net)}` };
    if (r.proto !== 'any' && r.proto !== pk.proto) return { c: 'proto', t: `il protocollo è ${pk.proto}, la regola vuole ${r.proto}` };
    if (!portOk(r.sport, pk.sport)) return { c: 'sport', t: `la porta sorgente ${pk.sport} non è ${portTxt(r.sport)}` };
    if (!portOk(r.dport, pk.dport)) return { c: 'dport', t: `la porta destinazione ${pk.dport} non è ${portTxt(r.dport)}` };
    if (r.flag === 'ACK' && !hasAck(pk)) return { c: 'flag', t: 'la regola vuole il flag ACK, ma il segmento ha solo SYN (ACK = 0, apertura di connessione)' };
    return null;
  }
  const swapPk = pk => Object.assign({}, pk, { src: pk.dst, dst: pk.src, sport: pk.dport, dport: pk.sport });
  const pkTxt = pk => `${pk.src}:${pk.sport} → ${pk.dst}:${pk.dport} ${pk.proto}${pk.flags ? ' ' + pk.flags : ''}`;
  const ruleTxt = (r, i, net) => `R${i + 1} ${r.act} · src ${addrTxt(r.src, net)} · dst ${addrTxt(r.dst, net)} · ${protoTxt(r.proto)} · sport ${portTxt(r.sport)} · dport ${portTxt(r.dport)} · flag ${flagTxt(r.flag)}`;

  // ---------------- firewall: politiche e pacchetti casuali ----------------
  const ORG = ['222.22', '151.97', '130.192', '193.205', '141.250', '160.80', '131.175', '147.162'];
  const PUB = [82, 93, 77, 128, 87, 95, 62, 185, 213, 79, 146, 195, 217, 8, 31, 104, 52, 172];
  const R = (act, src, dst, proto, sport, dport, flag) => ({ act, src, dst, proto, sport, dport, flag });
  const IN = { k: 'in' }, OUT = { k: 'out' }, ANY = { k: 'any' };

  function genFw(level) {
    const b = U.pick(ORG);
    let net, inHost;
    if (level >= 5) {
      const c = U.rndInt(1, 250);
      net = `${b}.${c}.0/24`;
      inHost = () => `${b}.${c}.${U.rndInt(2, 254)}`;
    } else {
      net = `${b}.0.0/16`;
      inHost = () => `${b}.${U.rndInt(0, 255)}.${U.rndInt(1, 254)}`;
    }
    const blk = level >= 5 && U.chance(0.5) ? `${U.pick([66, 45, 91, 103, 176])}.${U.rndInt(1, 250)}.${U.rndInt(0, 250)}.0/24` : null;
    const ext = () => {
      for (;;) {
        const ip = `${U.pick(PUB)}.${U.rndInt(1, 254)}.${U.rndInt(0, 254)}.${U.rndInt(1, 254)}`;
        if (!inNet(ip, net) && !(blk && inNet(ip, blk)) && !(ip.startsWith('172.') && Number(ip.split('.')[1]) >= 16 && Number(ip.split('.')[1]) <= 31)) return ip;
      }
    };
    const blkHost = () => blk.replace(/\.0\/24$/, '.' + U.rndInt(1, 254));
    const hi = () => U.rndInt(1500, 62000);
    const P = level <= 3 ? 80 : U.pick([80, 443]);
    const S = inHost();
    const other = () => { for (;;) { const h = inHost(); if (h !== S) return h; } };
    const web = [R('allow', IN, OUT, 'TCP', 'hi', P, 'any'), R('allow', OUT, IN, 'TCP', P, 'hi', 'ACK')];
    const dns = [R('allow', IN, OUT, 'UDP', 'hi', 53, 'na'), R('allow', OUT, IN, 'UDP', 53, 'hi', 'na')];
    const ssh = [R('allow', OUT, { k: 'host', v: S }, 'TCP', 'hi', 22, 'any'), R('allow', { k: 'host', v: S }, OUT, 'TCP', 22, 'hi', 'ACK')];
    const denyAll = R('deny', ANY, ANY, 'any', 'any', 'any', 'any');
    const T = (src, sport, dst, dport, proto, flags) => ({ src, sport, dst, dport, proto, flags });
    const MK = {
      webOut: () => T(inHost(), hi(), ext(), P, 'TCP', 'SYN'),
      webReply: () => T(ext(), P, inHost(), hi(), 'TCP', 'ACK'),
      webIn: () => T(ext(), hi(), inHost(), P, 'TCP', 'SYN'),
      ackTrick: () => T(ext(), P, inHost(), hi(), 'TCP', 'SYN'),
      dnsQ: () => T(inHost(), hi(), ext(), 53, 'UDP', ''),
      dnsR: () => T(ext(), 53, inHost(), hi(), 'UDP', ''),
      dnsIn: () => T(ext(), hi(), inHost(), 53, 'UDP', ''),
      sshIn: () => T(ext(), hi(), S, 22, 'TCP', 'SYN'),
      sshOther: () => T(ext(), hi(), other(), 22, 'TCP', 'SYN'),
      sshReply: () => T(S, 22, ext(), hi(), 'TCP', 'ACK'),
      telnet: () => T(ext(), hi(), inHost(), 23, 'TCP', 'SYN'),
      blTrap: () => T(blkHost(), P, inHost(), hi(), 'TCP', 'ACK')
    };
    let rules, kinds;
    if (level <= 3) {
      rules = [].concat(...U.shuffle([web, dns]), [denyAll]);
      const allow = U.sample(['webOut', 'webReply', 'dnsQ', 'dnsR'], 2);
      kinds = allow.concat([U.pick(['webIn', 'dnsIn'])]);
    } else if (level === 4) {
      const useSsh = U.chance(0.5);
      rules = [].concat(...U.shuffle([web, useSsh ? ssh : dns]), [denyAll]);
      const pool = useSsh ? ['webOut', 'webReply', 'sshIn', 'sshOther', 'sshReply'] : ['webOut', 'webReply', 'dnsQ', 'dnsR', 'dnsIn', 'webIn'];
      kinds = ['ackTrick'].concat(U.sample(pool, 3));
    } else {
      const first = blk ? R('deny', { k: 'net', v: blk }, IN, 'any', 'any', 'any', 'any') : R('deny', OUT, IN, 'TCP', 'any', 23, 'any');
      rules = [first].concat(...U.shuffle([web, dns, ssh]), [denyAll]);
      kinds = [blk ? 'blTrap' : 'telnet', U.pick(['sshIn', 'sshOther'])]
        .concat(U.sample(['webOut', 'webReply', 'ackTrick', 'dnsQ', 'dnsR', 'sshReply', 'webIn'], 3));
    }
    const pkts = U.shuffle(kinds).map(k => MK[k]());
    return { net, rules, pkts };
  }

  // ---------------- parametri e costruzione ----------------
  const DIRQ = ['rec-key-cs', 'rec-key-sc', 'rec-mac-cs', 'rec-mac-sc'];
  function randomParams(level) {
    const p = { level, rec: null, hs: null, fw: null, qs: [] };
    let ids = [];
    if (level <= 1) {
      p.rec = { fig: U.pick(['record', 'record', 'frag']), fields: true };
      ids = ['rec-cipher', 'rec-layer', U.pick(['rec-keys'].concat(DIRQ))];
    } else if (level === 2) {
      p.rec = { fig: U.pick(['record', 'frag']), fields: true };
      p.hs = { order: true };
      ids = [p.rec.fig === 'frag' ? 'rec-order' : 'rec-keys'].concat(U.sample(['rec-seq', 'rec-type'].concat(U.sample(DIRQ, 1)), 2));
    } else if (level === 3) {
      p.hs = { order: true };
      p.fw = genFw(3);
      ids = U.sample(['hs-nonce', 'hs-mac', 'hs-cert', 'hs-master'], 2).concat([U.pick(['fw-hi', 'fw-ack'])]);
    } else if (level === 4) {
      p.fw = genFw(4);
      ids = ['fw-state'].concat(U.sample(['rec-seq', 'rec-type', 'hs-nonce', 'hs-mac', 'rec-cipher'], 2));
    } else {
      p.fw = genFw(5);
      ids = [U.pick(['ip-ah', 'ip-esp'])].concat(U.sample(['ip-mode', 'ip-sa', 'ip-db'], 2), ['wep-iv']);
    }
    if (p.rec) p.rec.ord = perm(FIGS[p.rec.fig].opts.length);
    if (p.hs) p.hs.ord = perm(HS.length);
    p.qs = ids.map(id => ({ id, ord: perm(bankById(id).opts.length) }));
    return p;
  }

  const PART_ORDER = ['campi', 'record', 'hs', 'hsq', 'fw', 'fwq', 'sec'];
  function build(p) {
    let rec = null, hs = null, fw = null;
    if (p.rec) {
      const F = FIGS[p.rec.fig] || FIGS.record;
      const ord = okPerm(p.rec.ord, F.opts.length) ? p.rec.ord : detPerm(F.opts.length, 'rec-' + p.rec.fig);
      rec = {
        fig: p.rec.fig === 'frag' ? 'frag' : 'record', fields: p.rec.fields !== false,
        list: F.fields.map(x => Object.assign({}, x)),
        opts: ord.map(i => [F.opts[i], MEAN[F.opts[i]]])
      };
    }
    if (p.hs && p.hs.order) {
      const ord = okPerm(p.hs.ord, HS.length) ? p.hs.ord : detPerm(HS.length, 'hs');
      hs = { opts: ord.map(i => [HS[i].c, HS[i].t]) };
    }
    if (p.fw) {
      const net = p.fw.net;
      const rules = p.fw.rules.map(r => U.clone(r));
      const pkts = p.fw.pkts.map((pk, i) => {
        const x = Object.assign({}, pk, { n: i + 1, sport: Number(pk.sport), dport: Number(pk.dport), flags: pk.flags || '' });
        x.first = rules.findIndex(r => !whyNot(r, x, net));
        if (x.first < 0) x.first = rules.length - 1;
        x.act = rules[x.first].act;
        return x;
      });
      fw = { net, rules, pkts };
    }
    const items = (p.qs || []).map(x => {
      const src = bankById(x.id);
      const ord = okPerm(x.ord, src.opts.length) ? x.ord : detPerm(src.opts.length, src.id);
      return { id: src.id, part: src.part, q: src.q, hint: src.hint, why: src.why, opts: ord.map(i => U.clone(src.opts[i])), ok: src.opts[0].c };
    }).sort((a, b) => PART_ORDER.indexOf(a.part) - PART_ORDER.indexOf(b.part));
    return { cat: 'tls', level: p.level, params: p, rec, hs, fw, items };
  }
  const gen = level => build(randomParams(level));

  // ---------------- chiavi e passi ----------------
  const recFields = ex => ex.rec && ex.rec.fields ? ex.rec.list : [];
  const meanKey = f => `rec.${f}.mean`, encKey = f => `rec.${f}.enc`;
  const hsKey = i => `hs.p${i + 1}`;
  const ruleKey = n => `fw.p${n}.rule`, actKey = n => `fw.p${n}.act`;
  const qKey = id => `q.${id}`;
  function campiKeys(ex) {
    const k = [];
    recFields(ex).forEach(x => { k.push(meanKey(x.f)); if (x.enc) k.push(encKey(x.f)); });
    return k;
  }
  const hsKeys = ex => ex.hs ? HS.map((_, i) => hsKey(i)) : [];
  const fwKeys = ex => ex.fw ? ex.fw.pkts.flatMap(pk => [ruleKey(pk.n), actKey(pk.n)]) : [];
  const itemKeys = (ex, part) => ex.items.filter(it => it.part === part).map(it => qKey(it.id));
  const STEP_TITLE = {
    campi: 'Record SSL: significato e cifratura dei campi', record: 'Record SSL: cifratura, chiavi, livello',
    hs: 'Handshake TLS: ordine dei passi', hsq: 'Handshake TLS: i perché',
    fw: 'Firewall: la prima regola che corrisponde', fwq: 'Firewall: stateless e stateful', sec: 'IPsec e WEP'
  };
  function steps(ex) {
    const keysOf = {
      campi: campiKeys(ex), record: itemKeys(ex, 'record'), hs: hsKeys(ex), hsq: itemKeys(ex, 'hsq'),
      fw: fwKeys(ex), fwq: itemKeys(ex, 'fwq'), sec: itemKeys(ex, 'sec')
    };
    return PART_ORDER.filter(s => keysOf[s].length).map(s => ({ id: s, title: STEP_TITLE[s], keys: keysOf[s] }));
  }
  function itemOf(ex, key) { const m = /^q\.(.+)$/.exec(key); return m ? ex.items.find(it => it.id === m[1]) || null : null; }
  function fieldOf(ex, key) {
    const m = /^rec\.(\w+)\.(mean|enc)$/.exec(key);
    if (!m) return null;
    const x = recFields(ex).find(y => y.f === m[1]);
    return x ? { x, what: m[2] } : null;
  }
  function pktOf(ex, key) {
    const m = /^fw\.p(\d+)\.(rule|act)$/.exec(key);
    if (!m || !ex.fw) return null;
    const pk = ex.fw.pkts.find(p => p.n === Number(m[1]));
    return pk ? { pk, what: m[2] } : null;
  }
  const optLbl = (it, c) => { const o = it.opts.find(x => x.c === c); return o ? o.t : '__'; };
  const hsTxt = c => (HS.find(s => s.c === c) || {}).t || '__';
  const ruleNum = v => { const m = /^r?\s*(\d+)$/i.exec(val(v)); return m ? Number(m[1]) : null; };

  // ---------------- correzione ----------------
  function encMsg(x) {
    return x.enc === 'no'
      ? `«${x.name}» viaggia in chiaro: il ricevente deve leggere l'header (tipo, versione, lunghezza) prima di decifrare.`
      : `«${x.name}» viaggia cifrato con la chiave simmetrica del verso (Kc o Ks), insieme al ${x.f === 'mac' ? 'frammento di dati' : 'MAC'}.`;
  }
  function fwMsg(ex, pk) {
    return `P${pk.n}: si applica R${pk.first + 1}, la prima regola che corrisponde → ${actTxt(pk.act)}.`;
  }
  function grade(ex, a) {
    let correct = 0, total = 0;
    const marks = {};
    const put = (k, ok, msg) => { total++; if (ok) correct++; marks[k] = { ok, msg }; };
    recFields(ex).forEach(x => {
      put(meanKey(x.f), val(a[meanKey(x.f)]) === x.mean, `«${x.name}»: ${MEAN[x.mean]}. ${x.why}`);
      if (x.enc) put(encKey(x.f), val(a[encKey(x.f)]) === x.enc, encMsg(x));
    });
    if (ex.hs) HS.forEach((s, i) => put(hsKey(i), val(a[hsKey(i)]) === s.c, `Passo ${i + 1}: ${s.t}.`));
    if (ex.fw) ex.fw.pkts.forEach(pk => {
      put(ruleKey(pk.n), ruleNum(a[ruleKey(pk.n)]) === pk.first + 1, fwMsg(ex, pk));
      put(actKey(pk.n), val(a[actKey(pk.n)]) === pk.act, fwMsg(ex, pk));
    });
    ex.items.forEach(it => put(qKey(it.id), val(a[qKey(it.id)]) === it.ok, `Risposta giusta: ${optLbl(it, it.ok)}. ${it.why}`));
    return { correct, total, marks };
  }

  function sol2answers(ex) {
    const a = {};
    recFields(ex).forEach(x => { a[meanKey(x.f)] = x.mean; if (x.enc) a[encKey(x.f)] = x.enc; });
    if (ex.hs) HS.forEach((s, i) => { a[hsKey(i)] = s.c; });
    if (ex.fw) ex.fw.pkts.forEach(pk => { a[ruleKey(pk.n)] = String(pk.first + 1); a[actKey(pk.n)] = pk.act; });
    ex.items.forEach(it => { a[qKey(it.id)] = it.ok; });
    return a;
  }

  // ---------------- errori tipici ----------------
  function diagRule(ex, pk, r) {
    const net = ex.fw.net, rule = ex.fw.rules[r - 1], f = pk.first + 1;
    if (!rule) return `La ACL ha ${ex.fw.rules.length} regole: scegli un numero tra 1 e ${ex.fw.rules.length}.`;
    const w = whyNot(rule, pk, net);
    if (!w) {
      return r === ex.fw.rules.length
        ? `Anche R${r}, il deny finale, corrisponde, ma la ACL si legge dall'alto: vale la prima regola che corrisponde, R${f}.`
        : `R${r} corrisponde, ma viene dopo R${f}: la ACL si legge dall'alto e vale la prima regola che corrisponde.`;
    }
    if (w.c === 'flag') return `Hai ignorato il flag ACK: R${r} vuole ACK = 1, ma P${pk.n} ha solo SYN (è un'apertura di connessione da fuori). Quindi R${r} non corrisponde; vale R${f}.`;
    if ((w.c === 'src' || w.c === 'dst' || w.c === 'sport' || w.c === 'dport') && !whyNot(rule, swapPk(pk), net)) {
      return `R${r} vale per il verso opposto: corrisponderebbe a un pacchetto ${pk.dst}:${pk.dport} → ${pk.src}:${pk.sport}. Qui ${w.t}. Vale R${f}.`;
    }
    return `R${r} non corrisponde: ${w.t}. La prima regola che corrisponde è R${f}.`;
  }
  function diagnose(ex, key, value, answers) {
    const v = val(value);
    if (v === '') return null;
    const it = itemOf(ex, key);
    if (it) { if (v === it.ok) return null; const o = it.opts.find(x => x.c === v); return o ? o.err : null; }
    const fo = fieldOf(ex, key);
    if (fo) {
      const x = fo.x;
      if (fo.what === 'enc') {
        if (v === x.enc) return null;
        if (x.enc === 'no') return `L'header viaggia in chiaro: chi riceve deve leggere la lunghezza per sapere quanti byte prendere da TCP e decifrare; tipo e versione servono a interpretare il record. Si cifrano solo dati e MAC.`;
        return 'Dati e MAC sono cifrati insieme con la chiave simmetrica del verso (Kc o Ks): senza cifratura non c\'è riservatezza, e il MAC da solo non nasconde nulla.';
      }
      if (v === x.mean) return null;
      if (MEAN_ERR[v]) return MEAN_ERR[v];
      const other = ex.rec.list.find(y => y.mean === v);
      if (other) return `Questo è il significato di «${other.name}», non di «${x.name}».`;
      return null;
    }
    const pm = /^hs\.p(\d)$/.exec(key);
    if (pm && ex.hs) {
      const i = Number(pm[1]);
      if (v === HS_CODES[i - 1]) return null;
      if (v === 'choice' && i === 1) return 'Il server non può scegliere gli algoritmi prima di conoscere la lista del client: il primo messaggio è del client.';
      if (v === 'hello') return 'La lista degli algoritmi, con il nonce del client, apre l\'handshake: è il passo 1.';
      if (v === 'pms' && i < 3) return 'Il pre-master si cifra con la chiave pubblica del server, che il client trova nel certificato: prima serve la risposta del server con il certificato.';
      if (v === 'keys' && i < 4) return 'Le chiavi derivano dal pre-master secret e dai due nonce: si calcolano solo quando il pre-master è arrivato al server.';
      if (v === 'macs' && i === 5) return 'Nella sequenza del corso il client manda il suo MAC per primo (passo 5), poi il server (passo 6).';
      if ((v === 'macc' || v === 'macs') && i < 5) return 'I MAC dell\'handshake chiudono l\'handshake: riassumono TUTTI i messaggi precedenti e si calcolano con le chiavi appena derivate.';
      const dup = HS.findIndex((_, j) => j !== i - 1 && val((answers || {})[hsKey(j)]) === v);
      if (dup >= 0) return `Hai messo lo stesso passo anche in posizione ${dup + 1}: ogni passo compare una volta sola.`;
      return null;
    }
    const po = pktOf(ex, key);
    if (po) {
      const pk = po.pk;
      if (po.what === 'rule') {
        const r = ruleNum(v);
        if (r === null) return 'Scrivi il numero della regola (1, 2, …).';
        if (r === pk.first + 1) return null;
        return diagRule(ex, pk, r);
      }
      if (v === pk.act) return null;
      if (pk.proto === 'TCP' && !hasAck(pk) && v === 'allow' && ex.fw.rules.some((r, j) => j < ex.fw.rules.length && r.act === 'allow' && (whyNot(r, pk, ex.fw.net) || {}).c === 'flag')) {
        return `Hai ignorato il flag ACK: la regola che lascerebbe passare P${pk.n} vuole ACK = 1, ma il segmento ha solo SYN. Vale R${pk.first + 1} → deny.`;
      }
      return `Decide R${pk.first + 1}, la prima regola che corrisponde: ${actTxt(pk.act)}.`;
    }
    return null;
  }

  function diagnoseCases(ex) {
    const out = [];
    const recF = recFields(ex);
    const hdrF = recF.find(x => x.enc === 'no'), encF = recF.find(x => x.enc === 'si');
    if (hdrF) out.push({ key: encKey(hdrF.f), value: 'si', expect: 'in chiaro' });
    if (encF) out.push({ key: encKey(encF.f), value: 'no', expect: 'cifrati insieme' });
    if (recF.length) {
      out.push({ key: meanKey('mac'), value: 'crc', expect: 'non è una checksum' });
      out.push({ key: meanKey(recF[0].f), value: 'seq', expect: 'non viaggia' });
      out.push({ key: meanKey(recF[1].f), value: recF[2].mean, expect: `significato di «${recF[2].name}»` });
    }
    if (ex.hs) {
      out.push({ key: 'hs.p1', value: 'choice', expect: 'primo messaggio' });
      out.push({ key: 'hs.p2', value: 'pms', expect: 'certificato' });
      out.push({ key: 'hs.p3', value: 'keys', expect: 'derivano' });
      out.push({ key: 'hs.p4', value: 'macc', expect: 'chiudono' });
      out.push({ key: 'hs.p5', value: 'macs', expect: 'per primo' });
    }
    if (ex.fw) {
      const seen = {};
      ex.fw.pkts.forEach(pk => {
        ex.fw.rules.forEach((_, j) => {
          if (j === pk.first) return;
          const d = diagRule(ex, pk, j + 1);
          const cat = /prima regola che corrisponde/.test(d) && !/non corrisponde/.test(d) ? 'prima regola che corrisponde'
            : /flag ACK/.test(d) ? 'ignorato il flag ACK' : /verso opposto/.test(d) ? 'verso opposto' : null;
          if (cat && !seen[cat]) { seen[cat] = 1; out.push({ key: ruleKey(pk.n), value: String(j + 1), expect: cat }); }
        });
        if (!seen.act) { seen.act = 1; out.push({ key: actKey(pk.n), value: pk.act === 'allow' ? 'deny' : 'allow', expect: `R${pk.first + 1}` }); }
      });
    }
    ex.items.forEach(it => {
      const w = it.opts.find(o => o.c !== it.ok);
      out.push({ key: qKey(it.id), value: w.c, expect: w.err.slice(0, 40) });
    });
    return out;
  }

  // ---------------- aiuti ----------------
  function fieldHint(ex, key) {
    const it = itemOf(ex, key);
    if (it) return it.hint;
    const fo = fieldOf(ex, key);
    if (fo) {
      if (fo.what === 'enc') return 'Chi riceve deve poter leggere alcuni campi PRIMA di decifrare: quali gli servono per sapere quanti byte prendere?';
      return ex.rec.fig === 'frag'
        ? `«${fo.x.name}»: segui lo schema dall'alto (data → frammenti → frammento + MAC → header + parte cifrata) e chiediti in che punto nasce questo blocco.`
        : `«${fo.x.name}»: chiediti cosa serve al ricevente per leggere e controllare il record. Attento alle esche: il seq# non viaggia, le porte stanno in TCP.`;
    }
    if (/^hs\.p\d$/.test(key)) return 'Per ogni passo chiediti cosa serve prima: il server sceglie da una lista, il pre-master si cifra con la chiave del certificato, le chiavi derivano dal pre-master, i MAC riassumono tutto.';
    const po = pktOf(ex, key);
    if (po) {
      const pk = po.pk;
      const dir = inNet(pk.src, ex.fw.net) ? 'in uscita (sorgente interna)' : 'in entrata (sorgente esterna)';
      return po.what === 'rule'
        ? `P${pk.n} è ${dir}, ${pk.proto}${pk.proto === 'TCP' ? `, flag ${pk.flags}` : ''}. Scorri la ACL dall'alto e fermati alla PRIMA regola con tutte le condizioni vere.`
        : 'L\'azione è quella della regola che hai trovato: la prima che corrisponde, non una successiva.';
    }
    return 'Rileggi il testo della domanda.';
  }

  function hints(ex) {
    const H = [];
    const S = steps(ex).map(s => s.id);
    const itemHints = part => {
      const its = ex.items.filter(it => it.part === part);
      return { app: its.map(it => `• ${it.hint}`).join('\n'), sv: its.map(it => `• ${optLbl(it, it.ok)} — ${it.why}`).join('\n') };
    };
    if (S.includes('campi')) {
      const fr = ex.rec.fig === 'frag';
      H.push({
        step: 'campi', title: STEP_TITLE.campi,
        metodo: 'Il record = header in chiaro (tipo, versione, lunghezza) + parte cifrata (frammento di dati + MAC). L\'header resta in chiaro perché il ricevente deve leggerlo prima di decifrare. Il seq# non viaggia: entra solo nel MAC.',
        applicato: fr
          ? 'Lo schema mostra la costruzione: il flusso "data" si spezza in frammenti; per ogni frammento si calcola il MAC; frammento e MAC si cifrano insieme; davanti si mette il record header.'
          : `I campi della figura: ${ex.rec.list.map(x => x.name).join(', ')}. Per ognuno chiediti: serve al ricevente prima di decifrare?`,
        svolto: ex.rec.list.map(x => `${x.name}: ${MEAN[x.mean]}${x.enc ? (x.enc === 'si' ? ' · cifrato' : ' · in chiaro') : ''}`).join('\n')
      });
    }
    if (S.includes('record')) {
      const t = itemHints('record');
      H.push({ step: 'record', title: STEP_TITLE.record,
        metodo: 'Handshake con chiave pubblica, dati con chiavi simmetriche. Dal master secret 4 chiavi: Kc e Mc per il verso client → server, Ks e Ms per il verso server → client. MAC = H(Mx, dati, tipo, seq#). SSL sta sopra TCP: è il trasporto a recapitare il record.',
        applicato: t.app, svolto: t.sv });
    }
    if (S.includes('hs')) {
      H.push({ step: 'hs', title: STEP_TITLE.hs,
        metodo: 'Prima si negoziano gli algoritmi (il client propone, il server sceglie e manda il certificato), poi si scambia il segreto (pre-master cifrato con la chiave pubblica del server), poi ognuno calcola le chiavi, infine i due MAC dell\'handshake.',
        applicato: 'Per ogni passo chiediti cosa serve prima: la scelta presuppone la lista; il pre-master presuppone il certificato; le chiavi presuppongono il pre-master; i MAC finali presuppongono le chiavi. Nel corso il client manda il MAC per primo.',
        svolto: HS.map((s, i) => `${i + 1}. ${s.t}`).join('\n') });
    }
    if (S.includes('hsq')) {
      const t = itemHints('hsq');
      H.push({ step: 'hsq', title: STEP_TITLE.hsq,
        metodo: 'Ogni elemento dell\'handshake ferma un attacco: certificato → impostore; nonce → replay; MAC di tutti i messaggi → MITM che toglie gli algoritmi forti; pre-master cifrato → nessuno ricava le chiavi.',
        applicato: t.app, svolto: t.sv });
    }
    if (S.includes('fw')) {
      const fw = ex.fw;
      H.push({ step: 'fw', title: STEP_TITLE.fw,
        metodo: 'Per ogni pacchetto scorri la ACL dall\'alto: decide la PRIMA regola in cui tutte le condizioni sono vere; le successive non contano. Controlla nell\'ordine: sorgente e destinazione (dentro o fuori), protocollo, porte (> 1023 = porta del client), flag ACK.',
        applicato: `Rete interna: ${netShort(fw.net)}. ` + fw.pkts.map(p => `P${p.n} è ${inNet(p.src, fw.net) ? 'in uscita' : 'in entrata'} (${p.proto}${p.proto === 'TCP' ? ' ' + p.flags : ''})`).join('; ') + '. Attento ai segmenti SYN da fuori: le regole con flag ACK non li fanno passare.',
        svolto: fw.pkts.map(p => pktTrace(ex, p)).join('\n') });
    }
    if (S.includes('fwq')) {
      const t = itemHints('fwq');
      H.push({ step: 'fwq', title: STEP_TITLE.fwq,
        metodo: 'Lo stateless guarda un pacchetto alla volta: IP, porte, protocollo, flag. Lo stateful tiene una tabella delle connessioni TCP e accetta un segmento solo se appartiene a una connessione aperta.',
        applicato: t.app, svolto: t.sv });
    }
    if (S.includes('sec')) {
      const t = itemHints('sec');
      H.push({ step: 'sec', title: STEP_TITLE.sec,
        metodo: 'IPsec: AH = autenticazione e integrità; ESP = anche riservatezza. Transport = solo payload (host); tunnel = tutto il datagramma con nuovo header IP (router, VPN). SA unidirezionale con SPI; SPD = cosa fare, SAD = come. WEP: IV di 24 bit in chiaro che si ripete.',
        applicato: t.app, svolto: t.sv });
    }
    return H;
  }
  function pktTrace(ex, p) {
    const fw = ex.fw;
    const no = fw.rules.slice(0, p.first).map((r, j) => `R${j + 1} no (${whyNot(r, p, fw.net).t})`);
    return `P${p.n} ${pkTxt(p)}: ${no.concat([`R${p.first + 1} sì → ${p.act}`]).join('; ')}`;
  }

  // ---------------- figure ----------------
  function recordFig() {
    return `<svg viewBox="0 0 560 210" class="fig" role="img" aria-label="Formato del record SSL: content type, SSL version, length, data, MAC">` +
      '<rect x="100" y="14" width="80" height="36" class="box"/><text x="140" y="30" text-anchor="middle" class="lbl b">content</text><text x="140" y="44" text-anchor="middle" class="lbl b">type</text>' +
      '<rect x="180" y="14" width="150" height="36" class="box"/><text x="255" y="37" text-anchor="middle" class="lbl b">SSL version</text>' +
      '<rect x="330" y="14" width="130" height="36" class="box"/><text x="395" y="37" text-anchor="middle" class="lbl b">length</text>' +
      '<rect x="100" y="50" width="360" height="110" class="box"/><text x="280" y="110" text-anchor="middle" class="lbl b">data</text>' +
      '<rect x="100" y="160" width="360" height="36" class="box"/><text x="280" y="183" text-anchor="middle" class="lbl b">MAC</text>' +
      '</svg>';
  }
  function fragFig() {
    const half = (x0) =>
      `<rect x="${x0}" y="84" width="110" height="36" class="box"/><text x="${x0 + 55}" y="99" text-anchor="middle" class="lbl b">data</text><text x="${x0 + 55}" y="113" text-anchor="middle" class="lbl b">fragment</text>` +
      `<rect x="${x0 + 110}" y="84" width="50" height="36" class="box"/><text x="${x0 + 135}" y="106" text-anchor="middle" class="lbl b">MAC</text>` +
      `<line x1="${x0}" y1="120" x2="${x0}" y2="150" class="link" stroke-dasharray="3 3"/><line x1="${x0 + 160}" y1="120" x2="${x0 + 160}" y2="150" class="link" stroke-dasharray="3 3"/>` +
      `<rect x="${x0 - 50}" y="150" width="50" height="36" class="box"/><text x="${x0 - 25}" y="165" text-anchor="middle" class="lbl small">record</text><text x="${x0 - 25}" y="178" text-anchor="middle" class="lbl small">header</text>` +
      `<rect x="${x0}" y="150" width="160" height="36" class="box"/><text x="${x0 + 80}" y="165" text-anchor="middle" class="lbl">encrypted</text><text x="${x0 + 80}" y="179" text-anchor="middle" class="lbl">data and MAC</text>`;
    return `<svg viewBox="0 0 560 200" class="fig" role="img" aria-label="Schema di frammentazione SSL: data, data fragment e MAC, record header e encrypted data and MAC">` +
      '<rect x="190" y="10" width="180" height="34" class="box"/><text x="280" y="32" text-anchor="middle" class="lbl b">data</text>' +
      '<line x1="200" y1="44" x2="80" y2="84" class="link" stroke-dasharray="3 3"/><line x1="270" y1="44" x2="240" y2="84" class="link" stroke-dasharray="3 3"/>' +
      '<line x1="290" y1="44" x2="340" y2="84" class="link" stroke-dasharray="3 3"/><line x1="360" y1="44" x2="500" y2="84" class="link" stroke-dasharray="3 3"/>' +
      half(80) + half(340) + '</svg>';
  }
  function fwFig(ex) {
    const fw = ex.fw;
    const hosts = [...new Set(fw.rules.filter(r => r.src.k === 'host' || r.dst.k === 'host').map(r => (r.src.k === 'host' ? r.src : r.dst).v))];
    const blk = fw.rules.find(r => r.src.k === 'net');
    const L = [`<svg viewBox="0 0 560 170" class="fig" role="img" aria-label="Rete interna ${netShort(fw.net)}, router firewall, Internet">`];
    L.push('<rect x="4" y="22" width="220" height="140" rx="8" class="zone"/><text x="12" y="16" class="side">RETE DELL\'ORGANIZZAZIONE</text>');
    L.push(`<text x="114" y="48" text-anchor="middle" class="lbl b">${netShort(fw.net)}</text>`);
    L.push('<rect x="24" y="62" width="80" height="34" rx="5" class="box"/><text x="64" y="83" text-anchor="middle" class="lbl small">host interni</text>');
    if (hosts.length) L.push(`<rect x="114" y="62" width="100" height="34" rx="5" class="box"/><text x="164" y="77" text-anchor="middle" class="lbl small">server SSH</text><text x="164" y="90" text-anchor="middle" class="lbl small">${hosts[0]}</text>`);
    L.push('<line x1="224" y1="92" x2="250" y2="92" class="link"/><line x1="330" y1="92" x2="360" y2="92" class="link"/>');
    L.push('<rect x="250" y="66" width="80" height="52" rx="6" class="box router"/><text x="290" y="88" text-anchor="middle" class="lbl w">Router</text><text x="290" y="103" text-anchor="middle" class="lbl w">firewall</text>');
    L.push('<ellipse cx="455" cy="92" rx="95" ry="60" class="cloud"/><text x="455" y="88" text-anchor="middle" class="lbl b">Internet</text>');
    L.push(`<text x="455" y="104" text-anchor="middle" class="lbl small">tutto ciò che è fuori da ${netShort(fw.net)}</text>`);
    if (blk) L.push(`<text x="455" y="120" text-anchor="middle" class="lbl small">(rete bloccata: ${netShort(blk.src.v)})</text>`);
    L.push('</svg>');
    return L.join('');
  }

  // ---------------- testo ----------------
  function introText(ex) {
    const parts = [];
    if (ex.rec) parts.push(ex.rec.fig === 'frag' ? 'sullo schema di frammentazione del flusso dei dati in SSL' : 'sul formato del record SSL');
    if (ex.hs) parts.push('sull\'handshake di TLS');
    if (ex.fw) parts.push(`su un firewall a filtro di pacchetti (stateless) che protegge la rete ${netShort(ex.fw.net)}`);
    if (ex.items.some(it => it.part === 'sec')) parts.push('su IPsec e WEP');
    if (!parts.length) parts.push('sulla sicurezza in rete');
    const list = parts.length > 1 ? parts.slice(0, -1).join(', ') + ' e ' + parts[parts.length - 1] : parts[0];
    return `Domande ${list}.`;
  }
  const fwHead = ['#', 'Azione', 'IP sorgente', 'IP destinazione', 'Protocollo', 'Porta sorg.', 'Porta dest.', 'Flag'];
  const fwRows = fw => fw.rules.map((r, i) => [U.label('R' + (i + 1)), U.given(r.act), U.given(addrTxt(r.src, fw.net)), U.given(addrTxt(r.dst, fw.net)),
    U.given(protoTxt(r.proto)), U.given(portTxt(r.sport)), U.given(portTxt(r.dport)), U.given(flagTxt(r.flag))]);

  function render(ex, root, ctx) {
    root.appendChild(U.h('div', { class: 'card intro' }, U.h('p', {}, U.h('b', {}, 'Testo. '), introText(ex))));
    if (ex.rec && recFields(ex).length) {
      const fr = ex.rec.fig === 'frag';
      root.appendChild(U.card(fr ? 'a) Schema di frammentazione SSL: significato dei blocchi e cosa viaggia cifrato' : 'a) Record SSL: significato di ogni campo e quali sono cifrati', { step: 'campi' },
        U.fig(fr ? fragFig() : recordFig(), fr ? 'Il flusso dei dati diventa una sequenza di record.' : 'Formato del record SSL.'),
        U.table(['Campo', 'Significato e utilizzo', 'Viaggia cifrato?'], ex.rec.list.map(x => [
          U.label(x.name),
          U.sel(ctx, meanKey(x.f), ex.rec.opts, { label: `significato di ${x.name}` }),
          x.enc ? U.sel(ctx, encKey(x.f), ENC_OPTS, { label: `${x.name} cifrato?` }) : '—'
        ]))));
    } else if (ex.rec) {
      root.appendChild(U.h('div', { class: 'card' }, U.fig(ex.rec.fig === 'frag' ? fragFig() : recordFig(), 'Formato del record SSL.')));
    }
    const qCard = (part, title) => {
      const its = ex.items.filter(it => it.part === part);
      if (!its.length) return;
      root.appendChild(U.card(title, { step: part }, its.map(it => U.h('div', { class: 'q-item' },
        U.h('div', { class: 'q-text' }, it.q),
        U.sel(ctx, qKey(it.id), it.opts.map(o => [o.c, o.t]), { label: it.q })))));
    };
    qCard('record', 'Record SSL: cifratura, chiavi e recapito');
    if (ex.hs) {
      root.appendChild(U.card('b) Mettere in ordine i 6 passi dell\'handshake TLS', { step: 'hs' },
        U.h('p', { class: 'small' }, 'Per ogni posizione scegli il passo. Ogni passo si usa una volta sola.'),
        U.table(['Posizione', 'Passo'], HS.map((_, i) => [U.label(String(i + 1)), U.sel(ctx, hsKey(i), ex.hs.opts, { label: `passo ${i + 1} dell'handshake` })]))));
    }
    qCard('hsq', 'Handshake TLS: perché');
    if (ex.fw) {
      const fw = ex.fw;
      const ruleOpts = fw.rules.map((_, i) => [String(i + 1), 'R' + (i + 1)]);
      root.appendChild(U.card(`c) Firewall stateless della rete ${netShort(fw.net)}: quale regola si applica a ogni pacchetto, e con quale azione?`, { step: 'fw' },
        U.fig(fwFig(ex), 'Le regole si applicano dalla prima all\'ultima.'),
        U.h('p', { class: 'small' }, U.h('b', {}, 'Access Control List')),
        U.table(fwHead, fwRows(fw)),
        U.h('p', { class: 'small' }, U.h('b', {}, 'Pacchetti')),
        U.table(['#', 'IP sorgente', 'Porta sorg.', 'IP destinazione', 'Porta dest.', 'Protocollo', 'Flag', 'Regola', 'Azione'],
          fw.pkts.map(p => [U.label('P' + p.n), U.given(p.src), U.given(p.sport), U.given(p.dst), U.given(p.dport), U.given(p.proto), U.given(p.flags || '—'),
            U.sel(ctx, ruleKey(p.n), ruleOpts, { label: `P${p.n}, regola`, w: 's' }),
            U.sel(ctx, actKey(p.n), [['allow', 'allow'], ['deny', 'deny']], { label: `P${p.n}, azione`, w: 's' })]))));
    }
    qCard('fwq', 'Firewall: domande');
    qCard('sec', 'd) IPsec e WEP');
  }

  function solution(ex, root) {
    const kids = [U.h('h4', {}, 'Soluzione')];
    if (ex.rec) {
      kids.push(U.h('p', { class: 'sol-body' }, U.h('b', {}, 'Record SSL. '),
        'Header in chiaro (tipo, versione, lunghezza), poi frammento e MAC cifrati insieme con cifratura simmetrica: Kc/Mc dal client al server, Ks/Ms dal server al client. MAC = H(Mx, dati, tipo, seq#); il seq# non viaggia. Il record lo recapita il trasporto (TCP).'));
      if (recFields(ex).length) {
        kids.push(U.table(['Campo', 'Significato', 'Cifrato', 'Perché'], ex.rec.list.map(x => [U.label(x.name), MEAN[x.mean], x.enc ? (x.enc === 'si' ? 'sì' : 'no') : '—', x.why])));
      }
    }
    if (ex.hs) {
      kids.push(U.h('p', { class: 'sol-body' }, U.h('b', {}, 'Handshake TLS. '), 'Ogni passo usa il risultato del precedente:'));
      kids.push(U.h('ol', { class: 'sol-body' }, HS.map(s => U.h('li', {}, s.t))));
      kids.push(U.h('p', { class: 'small' }, 'I passi 5 e 6 scoprono un MITM che ha modificato i primi messaggi (in chiaro), ad esempio togliendo gli algoritmi forti. I due nonce rendono uniche le chiavi di ogni sessione (niente replay).'));
    }
    if (ex.fw) {
      const fw = ex.fw;
      kids.push(U.h('p', { class: 'sol-body' }, U.h('b', {}, 'Firewall. '), 'Per ogni pacchetto si scorre la ACL dall\'alto: vale la prima regola che corrisponde.'));
      kids.push(U.table(['Pacchetto', 'Regole controllate', 'Regola', 'Azione'], fw.pkts.map(p => [
        U.label(`P${p.n} ${pkTxt(p)}`),
        fw.rules.slice(0, p.first).map((r, j) => `R${j + 1}: no, ${whyNot(r, p, fw.net).t}`).join(' · ') || '—',
        'R' + (p.first + 1), p.act])));
    }
    if (ex.items.length) {
      kids.push(U.h('p', { class: 'sol-body' }, U.h('b', {}, 'Domande')));
      ex.items.forEach(it => kids.push(U.h('div', { class: 'q-item' },
        U.h('div', { class: 'q-text' }, it.q),
        U.h('p', { class: 'sol-body' }, U.h('b', {}, optLbl(it, it.ok) + '. '), it.why),
        U.h('p', { class: 'small' }, 'Le altre: ' + it.opts.filter(o => o.c !== it.ok).map(o => `«${o.t}»: ${o.err}`).join(' · ')))));
    }
    root.appendChild(U.h('div', { class: 'card sol' }, kids));
  }

  function chatText(ex, a) {
    a = a || {};
    const v = k => val(a[k]) || '__';
    const L = [`#5 · SSL/TLS e firewall (livello ${ex.level})`, '## Testo', introText(ex)];
    if (ex.rec) L.push(ex.rec.fig === 'frag'
      ? 'Figura: data → (data fragment + MAC) → (record header + encrypted data and MAC).'
      : 'Figura: record SSL = content type | SSL version | length | data | MAC.');
    if (ex.fw) {
      L.push(`ACL (rete interna ${netShort(ex.fw.net)}):`);
      ex.fw.rules.forEach((r, i) => L.push('  ' + ruleTxt(r, i, ex.fw.net)));
      L.push('Pacchetti:');
      ex.fw.pkts.forEach(p => L.push(`  P${p.n}: ${pkTxt(p)}`));
    }
    L.push('', '## Le mie risposte');
    recFields(ex).forEach(x => {
      const m = ex.rec.opts.find(o => o[0] === val(a[meanKey(x.f)]));
      L.push(`- ${x.name}: significato ${m ? m[1] : '__'}${x.enc ? ` | cifrato: ${v(encKey(x.f))}` : ''}`);
    });
    if (ex.hs) HS.forEach((_, i) => { const c = val(a[hsKey(i)]); L.push(`- Handshake, passo ${i + 1}: ${c ? hsTxt(c) : '__'}`); });
    if (ex.fw) ex.fw.pkts.forEach(p => L.push(`- P${p.n}: regola R${v(ruleKey(p.n))}, azione ${v(actKey(p.n))}`));
    ex.items.forEach(it => { const c = val(a[qKey(it.id)]); L.push(`- ${it.q} → ${c ? optLbl(it, c) : '__'}`); });
    return L.join('\n');
  }

  // ---------------- tracce ----------------
  const SLIDE_ACL = [
    R('allow', IN, OUT, 'TCP', 'hi', 80, 'any'),
    R('allow', OUT, IN, 'TCP', 80, 'hi', 'ACK'),
    R('allow', IN, OUT, 'UDP', 'hi', 53, 'na'),
    R('allow', OUT, IN, 'UDP', 53, 'hi', 'na'),
    R('deny', ANY, ANY, 'any', 'any', 'any', 'any')
  ];
  const SIM = {
    level: 4,
    rec: { fig: 'record', fields: true },
    hs: { order: true },
    fw: {
      net: '222.22.0.0/16', rules: SLIDE_ACL,
      pkts: [
        { src: '222.22.1.5', sport: 3456, dst: '93.184.216.34', dport: 80, proto: 'TCP', flags: 'SYN' },
        { src: '93.184.216.34', sport: 80, dst: '222.22.1.5', dport: 3456, proto: 'TCP', flags: 'ACK' },
        { src: '130.10.5.5', sport: 4000, dst: '222.22.7.7', dport: 80, proto: 'TCP', flags: 'SYN' },
        { src: '222.22.3.3', sport: 5000, dst: '8.8.8.8', dport: 53, proto: 'UDP', flags: '' }
      ]
    },
    qs: [{ id: 'rec-cipher' }, { id: 'rec-layer' }]
  };
  const PDF_REC = { level: 1, rec: { fig: 'record', fields: true }, hs: null, fw: null, qs: [{ id: 'rec-cipher' }, { id: 'rec-keys' }, { id: 'rec-layer' }] };
  const REC_EXPECT = {
    'rec.type.mean': 'type', 'rec.type.enc': 'no', 'rec.ver.mean': 'ver', 'rec.ver.enc': 'no', 'rec.len.mean': 'len', 'rec.len.enc': 'no',
    'rec.data.mean': 'data', 'rec.data.enc': 'si', 'rec.mac.mean': 'mac', 'rec.mac.enc': 'si', 'q.rec-cipher': 'sym', 'q.rec-layer': 'tr'
  };

  RA.tls = {
    id: 'tls', num: '5', name: 'SSL/TLS e firewall', part: 2, examPoints: 5, extra: false,
    desc: 'Record SSL (campi, cifratura, chiavi), handshake TLS in ordine, ACL di un firewall stateless, IPsec e WEP.',
    method: {
      intro: 'Esercizio di sicurezza: quasi tutto si risolve chiedendosi "cosa serve prima?" e "quale attacco ferma?". Per il firewall è meccanico: la prima regola che corrisponde decide.',
      steps: [
        'Record SSL: header in chiaro (tipo, versione, lunghezza), poi frammento e MAC cifrati insieme. L\'header è in chiaro perché il ricevente deve leggerlo prima di decifrare.',
        'Chiavi: la chiave pubblica serve solo nell\'handshake (per il pre-master). I record usano 4 chiavi simmetriche dal master secret: Kc e Mc dal client al server, Ks e Ms dal server al client.',
        'Handshake: lista degli algoritmi + nonce → scelta + certificato + nonce → pre-master cifrato con la pubblica del server → chiavi calcolate da entrambi → MAC dell\'handshake del client → MAC del server.',
        'Firewall: per ogni pacchetto scorri la ACL dall\'alto; controlla sorgente/destinazione (dentro o fuori), protocollo, porte (> 1023 = client), flag ACK. La prima regola con tutte le condizioni vere decide.',
        'IPsec: AH autentica, ESP anche cifra; transport protegge il payload, tunnel tutto il datagramma.'
      ],
      traps: [
        'L\'header del record non è cifrato; dati e MAC sì.',
        'La cifratura dei record è simmetrica, non a chiave pubblica.',
        'Il record lo recapita il livello di trasporto (TCP), non la rete.',
        'Il seq# non viaggia nel record: entra solo nel MAC (contro replay e riordino). Il tipo nel MAC ferma il troncamento con un FIN TCP falso.',
        'Nella ACL vale la PRIMA regola che corrisponde, non l\'ultima né la "più precisa".',
        'Un SYN da fuori con porta sorgente 80 non passa la regola delle risposte web: manca il flag ACK.',
        'Uno stateless lascia passare un ACK fuori da ogni connessione; uno stateful no.'
      ],
      formulas: [
        ['MAC del record', 'H(Mx, dati, tipo, seq#) · Mx = Mc o Ms'],
        ['Chiavi dal master secret', 'Kc, Mc (client → server) · Ks, Ms (server → client)'],
        ['Master secret', 'da pre-master secret + nonce del client + nonce del server'],
        ['Frammento', 'al massimo circa 16 KB'],
        ['Porte', '0-1023 note (server) · > 1023 effimere (client)'],
        ['IPsec', 'AH: autenticazione + integrità · ESP: + riservatezza · SA unidirezionale, SPI 32 bit'],
        ['WEP', 'IV di 24 bit in chiaro, uno per frame → si ripete']
      ]
    },
    traces: [
      {
        id: 'sim-tls', set: 'simulato',
        title: 'Esame simulato · record SSL e firewall',
        source: 'Esame_Simulato_2_TESTO.pdf, esercizio 5',
        params: SIM,
        expect: Object.assign({}, REC_EXPECT, {
          'hs.p1': 'hello', 'hs.p2': 'choice', 'hs.p3': 'pms', 'hs.p4': 'keys', 'hs.p5': 'macc', 'hs.p6': 'macs',
          'fw.p1.rule': '1', 'fw.p1.act': 'allow', 'fw.p2.rule': '2', 'fw.p2.act': 'allow',
          'fw.p3.rule': '5', 'fw.p3.act': 'deny', 'fw.p4.rule': '3', 'fw.p4.act': 'allow'
        })
      },
      {
        id: 'pdf-ssl-record',
        title: 'Domande di teoria · formato del record SSL',
        source: 'domande_teoria_secondo_parziale.pdf, pag. 3',
        params: PDF_REC,
        expect: Object.assign({}, REC_EXPECT, { 'q.rec-keys': 'sess' })
      }
    ],
    randomParams, build, gen, steps, grade, sol2answers, render, solution, hints, fieldHint, diagnose, diagnoseCases, chatText
  };
})();
