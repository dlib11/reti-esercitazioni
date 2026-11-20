// ============================================================
// RetiApp · gen-theory.js — Extra · Domande di teoria (risposta chiusa)
// Contratto dei moduli: docs/moduli.md (modello: gen-http.js)
// ============================================================
(function () {
  const RA = window.RetiApp;
  const U = RA.util;

  // ---------------- argomenti ----------------
  const TOPICS = [
    { id: 'ip', title: 'IP e routing', concept: 'Il router sceglie la riga con il prefisso più lungo che contiene la destinazione (longest prefix match). Il next-hop è l\'IP del vicino sul link condiviso, perché il MAC si trova con ARP solo nella stessa sottorete. Il routing è per destinazione e hop-by-hop: ogni router decide da solo.' },
    { id: 'proto', title: 'Protocolli e pila', concept: 'Chi trasporta i messaggi decide il livello: dentro TCP/UDP → applicazione (DNS, DHCP, RIP su UDP 520, BGP su TCP 179); direttamente dentro IP → rete (ICMP, OSPF); nel frame → collegamento (ARP). Routing intra-AS: RIP (distance vector) e OSPF (link state); inter-AS: BGP (path vector).' },
    { id: 'nat', title: 'NAT', concept: 'Il NAT traduce coppie (IP privato, porta) in (IP pubblico, porta): la porta pubblica, a 16 bit, distingue le connessioni. Il lato del server non cambia mai. Senza riga in tabella un pacchetto entrante si scarta. È criticato perché un apparato di livello 3 tocca campi di livello 4.' },
    { id: 'tcp', title: 'TCP', concept: 'Seq# = primo byte del segmento; SYN e FIN consumano un numero; Ack# = prossimo byte atteso, cumulativo. Ogni direzione si apre e si chiude da sola. Le perdite si scoprono con il timeout o con 3 ACK duplicati (fast retransmit).' },
    { id: 'sdn', title: 'SDN', concept: 'Piano di controllo (il controller decide) separato dal piano dati (gli switch inoltrano). Il controller installa regole match → action con OpenFlow. Vince la regola a priorità maggiore; senza match il pacchetto va di solito al controller. Il match può guardare anche la sorgente (generalized forwarding).' },
    { id: 'http', title: 'HTTP', concept: 'HTTP è stateless e viaggia su TCP: senza persistenza ogni oggetto costa 2 RTT (handshake + richiesta). Cookie per lo stato, cache e GET condizionale per non riscaricare. HTTP/2 multiplexa su una connessione, HTTP/3 usa QUIC su UDP.' },
    { id: 'dns', title: 'DNS', concept: 'Il DNS traduce nomi in indirizzi IP. L\'host chiede al server DNS locale (UDP 53), che usa la cache o interroga root → TLD → autoritativo. Senza l\'IP non si può aprire la connessione TCP.' }
  ];
  const topicOf = id => TOPICS.find(t => t.id === id);
  const TORDER = TOPICS.map(t => t.id);

  // ---------------- banca delle domande ----------------
  // Q(id, argomento, difficoltà, testo, indizio, perché, [giusta, [sbagliata, errore], ...])
  // La prima opzione è sempre quella giusta: l'ordine mostrato lo decide randomParams.
  const BANK = [];
  function Q(id, topic, d, q, hint, why, opts) {
    BANK.push({
      id, topic, d, q, hint, why,
      opts: opts.map((o, i) => i === 0 ? { t: o, err: null } : { t: o[0], err: o[1] })
    });
  }

  // ===== IP e routing =====
  Q('ip-31', 'ip', 3,
    'Su un link punto-punto tra due router si potrebbe usare un /31. Perché all\'esame si usa il /30?',
    'Confronta quanti indirizzi ha ciascun prefisso e quali sono riservati.',
    'Il /31 (RFC 3021) ha 2 indirizzi, entrambi assegnabili, senza rete né broadcast. È corretto, ma è un\'eccezione: salvo indicazioni, all\'esame si aspettano il /30, che come ogni sottorete ha rete, broadcast e 2 indirizzi utilizzabili.',
    ['Perché è la convenzione attesa: il /30 ha rete, broadcast e 2 indirizzi utilizzabili come ogni sottorete',
      ['Perché in IPv4 il /31 non esiste', 'Il /31 esiste (RFC 3021): 2 indirizzi senza rete né broadcast. Non è sbagliato, solo non è quello che si aspettano.'],
      ['Perché il /30 spreca meno indirizzi del /31', 'È il contrario: il /30 occupa 4 indirizzi, il /31 solo 2.'],
      ['Perché in un /31 c\'è posto per un solo router', 'Un /31 ha 2 indirizzi e senza rete e broadcast sono entrambi assegnabili: uno per estremo.']]);
  Q('ip-30', 'ip', 1,
    'Quanti indirizzi assegnabili alle interfacce ha una sottorete /30?',
    'Calcola 2^(32 − 30) e togli gli indirizzi riservati.',
    '2^(32−30) = 4 indirizzi, meno rete e broadcast = 2: proprio i due estremi di un link punto-punto.',
    ['2',
      ['4', '4 sono gli indirizzi totali: vanno tolti l\'indirizzo di rete e quello di broadcast.'],
      ['30', '30 è la lunghezza del prefisso, non il numero di indirizzi: gli host bit sono 32 − 30 = 2.'],
      ['6', '6 sono gli utilizzabili di un /29 (8 − 2).']]);
  Q('ip-plus1', 'ip', 1,
    'Una LAN ha 30 host. Qual è il blocco più piccolo che la contiene?',
    'Conta host + interfaccia del router + rete e broadcast, poi arrotonda alla potenza di 2.',
    '30 host + 1 router + 2 (rete e broadcast) = 33 indirizzi: un /27 ne ha 32 e non basta, serve un /26 (64).',
    ['/26 (64 indirizzi)',
      ['/27 (32 indirizzi)', '30 + 1 (router) + 2 (rete e broadcast) = 33 > 32: hai dimenticato il router o gli indirizzi riservati.'],
      ['/28 (16 indirizzi)', 'Un /28 ha 16 indirizzi: non basta nemmeno per i 30 host.'],
      ['/25 (128 indirizzi)', 'Ci sta, ma non è il più piccolo: 33 indirizzi entrano già in un /26.']]);
  Q('ip-order', 'ip', 2,
    'Nel subnetting a lunghezza variabile perché si assegnano i blocchi dal più grande al più piccolo?',
    'Pensa a dove può iniziare un blocco da 64 indirizzi.',
    'Un blocco di 2^k indirizzi deve iniziare a un multiplo di 2^k. Partendo dal più grande, la fine di ogni blocco è un punto di partenza valido per tutti i più piccoli: non restano buchi.',
    ['Perché ogni blocco deve partire da un multiplo della sua dimensione: così non restano buchi',
      ['Perché i router preferiscono le reti più grandi', 'L\'ordine non c\'entra con le preferenze dei router: è una questione di allineamento dei blocchi.'],
      ['Perché così le reti grandi hanno il broadcast più basso', 'Il valore del broadcast non conta: conta che ogni blocco sia allineato senza sprecare spazio.'],
      ['Perché lo richiede OSPF', 'OSPF non impone nessun ordine: l\'ordine serve solo a non lasciare buchi tra blocchi allineati.']]);
  Q('ip-lpm', 'ip', 2,
    'Tabella: 10.0.0.0/8 → A, 10.1.0.0/16 → B, 0.0.0.0/0 → C. Dove va un pacchetto per 10.1.2.3?',
    'Più righe contengono l\'indirizzo: quale è la più specifica?',
    'Lo contengono tutte e tre, ma vince il prefisso più lungo: /16 → B (longest prefix match).',
    ['B',
      ['A', 'Anche 10.0.0.0/8 contiene l\'indirizzo, ma /8 è più corto di /16: vince la riga più specifica.'],
      ['C', 'La default si usa solo se nessun\'altra riga contiene la destinazione.'],
      ['Su A e B a turno (ECMP)', 'ECMP vale tra rotte equivalenti per la stessa destinazione; qui i prefissi sono diversi e vince il più lungo.']]);
  Q('ip-lpm2', 'ip', 3,
    'Stessa tabella: 10.0.0.0/8 → A, 10.1.0.0/16 → B, 0.0.0.0/0 → C. Dove va un pacchetto per 10.200.1.1?',
    'Controlla davvero se 10.200.1.1 sta dentro 10.1.0.0/16.',
    '10.1.0.0/16 copre solo 10.1.x.x, quindi non contiene 10.200.1.1. Restano /8 e /0: vince /8 → A.',
    ['A',
      ['B', '10.1.0.0/16 contiene solo gli indirizzi 10.1.x.x: 10.200.1.1 non ci sta.'],
      ['C', 'La default vale solo se nessun\'altra riga contiene la destinazione, ma 10.0.0.0/8 la contiene.'],
      ['Viene scartato', 'Con una default in tabella c\'è sempre una riga che contiene la destinazione.']]);
  Q('ip-nexthop', 'ip', 2,
    'Nella tabella di routing di R3, il next-hop verso una rete remota deve essere…',
    'R3 deve poter mettere il pacchetto in un frame per il vicino.',
    'Il next-hop è l\'IP dell\'interfaccia del vicino sulla sottorete che condivide con R3: solo lì R3 può trovarne il MAC con ARP.',
    ['l\'IP dell\'interfaccia del vicino sul link condiviso con R3',
      ['un IP qualsiasi del router vicino, per esempio quello sulla sua LAN', 'Un IP del vicino su un\'altra sottorete non va bene: R3 non potrebbe trovarne il MAC con ARP.'],
      ['l\'indirizzo di rete della destinazione', 'L\'indirizzo di rete della destinazione è la colonna "destinazione", non il next-hop.'],
      ['il MAC del router vicino', 'La tabella di routing è di livello 3 e contiene IP: il MAC lo trova ARP al momento dell\'invio.']]);
  Q('ip-nexthop-why', 'ip', 3,
    'Perché il next-hop deve stare su una sottorete direttamente connessa al router?',
    'Cosa fa il router, a livello 2, per consegnare il pacchetto al vicino?',
    'Il router mette il datagramma in un frame indirizzato al MAC del vicino. Il MAC si ottiene con ARP, che funziona solo dentro la stessa sottorete.',
    ['Perché il MAC del next-hop si trova con ARP, che funziona solo nella stessa sottorete',
      ['Perché altrimenti il TTL scadrebbe prima', 'Il TTL non c\'entra: il problema è trovare il MAC del vicino per costruire il frame.'],
      ['Perché altrimenti la tabella non si può aggregare', 'L\'aggregazione riguarda le destinazioni, non i next-hop.'],
      ['Perché il next-hop riceve il pacchetto in un tunnel IP', 'Non c\'è nessun tunnel: il pacchetto viaggia in un frame di livello 2 verso il MAC del vicino.']]);
  Q('ip-ad', 'ip', 3,
    'R2 ha una rotta dinamica per Net_A via R1. Aggiungi una rotta statica per Net_A via R3. Quale usa R2?',
    'Tra rotte che vengono da fonti diverse, che cosa si confronta?',
    'Le rotte statiche hanno distanza amministrativa più bassa delle dinamiche: a parità di prefisso vince la statica.',
    ['La statica, perché ha distanza amministrativa più bassa',
      ['La dinamica, perché si aggiorna da sola', 'Essere aggiornata non conta: tra fonti diverse decide la distanza amministrativa, e la statica vince.'],
      ['Quella con meno salti', 'Il numero di salti si confronta dentro lo stesso protocollo; tra statica e dinamica decide la distanza amministrativa.'],
      ['Entrambe, alternandole', 'Non c\'è bilanciamento tra fonti diverse: la statica, con distanza amministrativa più bassa, sostituisce la dinamica.']]);
  Q('ip-return', 'ip', 4,
    'Con una rotta statica su R2 forzi il traffico Net_B → Net_A a passare da R3. Che strada fa il traffico di ritorno Net_A → Net_B?',
    'Chi decide la strada del ritorno?',
    'Il routing IP è per destinazione e hop-by-hop: il ritorno lo decide R1 con la sua tabella, che non è cambiata. Il percorso diventa asimmetrico, a meno di configurare anche R1.',
    ['Quella scelta da R1, che non è cambiata: il percorso diventa asimmetrico',
      ['Automaticamente lo stesso percorso al contrario', 'Ogni router decide da solo: cambiare R2 non cambia la scelta di R1.'],
      ['Viene scartato, perché la rotta statica vale in un solo verso', 'Il ritorno non viene scartato: segue semplicemente la tabella di R1.'],
      ['Passa da R3 perché R2 annuncia la statica', 'La statica resta locale a R2: R1 continua a usare la sua rotta.']]);
  Q('ip-agg', 'ip', 3,
    'Due /27 con lo stesso next-hop: 10.0.0.32/27 e 10.0.0.64/27. Si possono fondere in un /26?',
    'Un /26 da dove può iniziare?',
    'Un /26 (64 indirizzi) deve iniziare a un multiplo di 64: .0 o .64. Il blocco .32–.95 non è allineato, quindi non è un /26.',
    ['No: insieme non formano un /26 allineato (un /26 parte da .0 o da .64)',
      ['Sì, perché sono contigui', 'Contigui non basta: il blocco risultante deve essere allineato, e .32–.95 non lo è.'],
      ['Sì, in 10.0.0.32/26', '10.0.0.32/26 non è un indirizzo di rete valido: un /26 parte da un multiplo di 64.'],
      ['No, perché due /27 non si fondono mai', 'Due /27 si fondono se sono contigui e allineati, per esempio .0 e .32 → 10.0.0.0/26.']]);
  Q('ip-default', 'ip', 2,
    'Quando una rete remota si può togliere dalla tabella senza perdere raggiungibilità?',
    'Pensa a quale riga coprirebbe comunque quella destinazione.',
    'Se ha lo stesso next-hop della rotta di default, la default la copre già: la riga specifica è inutile.',
    ['Quando ha lo stesso next-hop della rotta di default',
      ['Quando è più piccola di un /28', 'La dimensione non conta: conta se un\'altra riga la porta allo stesso next-hop.'],
      ['Quando è a più di due salti', 'La distanza non conta: senza una riga che la copra, la rete diventa irraggiungibile.'],
      ['Mai: ogni rete deve avere la sua riga', 'Con la default e la fusione di blocchi la tabella si accorcia: è proprio l\'aggregazione.']]);
  Q('ip-null-loop', 'ip', 4,
    'Il router di bordo ha la default verso Internet, e il provider gli manda tutto il /25 dell\'organizzazione. Arriva un pacchetto per un indirizzo del /25 non assegnato a nessuna sottorete. Senza null route…',
    'Segui il pacchetto: quale riga usa il router di bordo, e cosa fa il provider?',
    'Nessuna sottorete lo contiene, quindi il router di bordo usa la default e lo rimanda al provider, che glielo rimanda: rimbalza finché il TTL scade.',
    ['rimbalza tra router di bordo e provider fino allo scadere del TTL',
      ['il router di bordo lo scarta subito', 'Senza una riga specifica vince la default: il router lo rimanda su Internet, non lo scarta.'],
      ['viene mandato in broadcast su tutte le LAN', 'I router non inoltrano in broadcast i pacchetti senza destinazione nota.'],
      ['il provider lo consegna all\'ultimo host attivo', 'Il provider conosce solo il /25 aggregato: lo rimanda al router di bordo.']]);
  Q('ip-null-lpm', 'ip', 5,
    'Il router di bordo ha una null route per l\'intero 143.31.107.0/25. Perché non blocca il traffico verso Net_A (143.31.107.64/27)?',
    'Due righe contengono la destinazione: quale vince?',
    'Per longest prefix match vince la riga /27 di Net_A, più specifica del /25. La null route scatta solo per gli indirizzi del /25 che nessuna sottorete contiene.',
    ['Perché per longest prefix match vince la riga più specifica /27',
      ['Perché la null route vale solo per il traffico in uscita', 'La null route vale per qualunque pacchetto; non blocca Net_A solo perché la riga /27 è più specifica.'],
      ['Perché la default 0.0.0.0/0 ha la precedenza', 'La default è il prefisso più corto di tutti: perde sempre contro /25 e /27.'],
      ['La blocca: per questo la null route si usa solo sui provider', 'Non la blocca: la riga /27 vince per longest prefix match.']]);

  // ===== Protocolli e pila =====
  Q('pr-criterio', 'proto', 1,
    'Qual è il criterio più sicuro per decidere il livello di un protocollo?',
    'Pensa a DHCP: dà gli indirizzi IP, eppure…',
    'Si guarda chi trasporta i suoi messaggi: dentro TCP o UDP → applicazione, anche se lo scopo riguarda la rete.',
    ['Guardare chi trasporta i suoi messaggi: dentro TCP o UDP → applicazione',
      ['Guardare lo scopo: se riguarda gli IP è di livello 3', 'DHCP assegna gli IP ma viaggia su UDP: è un\'applicazione. Lo scopo da solo inganna.'],
      ['Guardare se lo usano i router: allora è di rete', 'BGP e RIP girano sui router ma viaggiano su TCP/UDP: sono applicazioni.'],
      ['Guardare quanto è lunga la sua intestazione', 'La lunghezza dell\'intestazione non dice nulla sul livello.']]);
  Q('pr-intra', 'proto', 1,
    'Quali sono protocolli di routing intra-AS?',
    'Uno dei tre protocolli di routing lavora tra AS diversi.',
    'RIP e OSPF lavorano dentro un AS; BGP lavora tra AS diversi.',
    ['RIP e OSPF',
      ['BGP e OSPF', 'BGP è inter-AS: collega AS diversi.'],
      ['RIP e BGP', 'BGP è inter-AS: collega AS diversi.'],
      ['ICMP e ARP', 'ICMP (errori, ping) e ARP (IP → MAC) non sono protocolli di routing.']]);
  Q('pr-rip', 'proto', 2,
    'Che algoritmo e che trasporto usa RIP?',
    'RIP misura le distanze in salti e le scambia con i vicini.',
    'RIP è distance vector (Bellman-Ford, metrica = salti) e viaggia su UDP porta 520.',
    ['Distance vector (Bellman-Ford), su UDP 520',
      ['Link state (Dijkstra), direttamente in IP', 'Questo è OSPF.'],
      ['Path vector, su TCP 179', 'Questo è BGP.'],
      ['Distance vector, su TCP 520', 'L\'algoritmo è giusto, ma RIP usa UDP, non TCP.']]);
  Q('pr-ospf', 'proto', 2,
    'Che algoritmo usa OSPF e come viaggiano i suoi messaggi?',
    'Ogni router OSPF conosce tutta la mappa della rete.',
    'OSPF è link state: ogni router conosce la topologia e calcola i cammini minimi con Dijkstra. I messaggi stanno direttamente dentro IP (protocollo 89).',
    ['Link state (Dijkstra), direttamente dentro IP (protocollo 89)',
      ['Distance vector (Bellman-Ford), su UDP 520', 'Questo è RIP.'],
      ['Path vector, su TCP 179', 'Questo è BGP.'],
      ['Link state, su UDP porta 89', '89 è un numero di protocollo IP, non una porta UDP: OSPF non usa UDP.']]);
  Q('pr-bgp', 'proto', 2,
    'A cosa serve BGP?',
    'È il "collante" di Internet.',
    'BGP è il routing tra Autonomous System diversi (inter-AS): path vector, con politiche, su TCP 179.',
    ['Al routing tra Autonomous System diversi (inter-AS)',
      ['Al routing dentro un Autonomous System', 'Dentro un AS si usano RIP o OSPF; BGP collega AS diversi.'],
      ['Ad assegnare i numeri di AS ai provider', 'I numeri di AS li assegnano i registri, non un protocollo.'],
      ['A tradurre i nomi degli AS in indirizzi', 'Tradurre nomi è il compito del DNS.']]);
  Q('pr-bgp-lvl', 'proto', 4,
    'Qual è la descrizione più completa del livello di BGP?',
    'La guida chiede di citare due cose: dove gira e a quale livello serve.',
    'Lo scopo è di rete (rotte tra AS, piano di controllo), ma i messaggi viaggiano su TCP 179: tecnicamente è un\'applicazione.',
    ['Routing inter-AS, quindi piano di controllo della rete, implementato come applicazione su TCP 179',
      ['Livello di rete (3), perché decide le rotte', 'Accettabile ma incompleto: manca che gira su TCP 179, quindi è un\'applicazione.'],
      ['Livello di trasporto (4), perché usa TCP', 'TCP è il trasporto che BGP usa, non il livello di BGP.'],
      ['Livello di collegamento (2), perché parla solo con i router vicini', 'Parlare con i vicini non lo rende di livello 2: la sessione BGP è TCP sopra IP.']]);
  Q('pr-arp', 'proto', 2,
    'Cosa fa ARP?',
    'L\'host conosce l\'IP del gateway: cosa gli manca per costruire il frame?',
    'Dato l\'IP di un vicino nella stessa LAN, ARP ne trova il MAC con una richiesta in broadcast. Il messaggio sta nel frame Ethernet.',
    ['Dato l\'IP di un vicino nella stessa LAN, ne trova il MAC',
      ['Dato il MAC di un host, ne trova l\'IP', 'Direzione sbagliata: ARP va da IP a MAC.'],
      ['Assegna un indirizzo IP a chi entra in rete', 'Questo è DHCP.'],
      ['Traduce un nome di dominio in IP', 'Questo è il DNS.']]);
  Q('pr-dhcp', 'proto', 2,
    'DHCP assegna gli indirizzi IP. A che livello opera?',
    'Dove viaggiano i messaggi Discover, Offer, Request, ACK?',
    'I messaggi DHCP viaggiano su UDP (porte 67/68): è un\'applicazione (5), anche se configura gli IP.',
    ['Applicazione (5), su UDP 67/68',
      ['Rete (3), perché lavora con gli indirizzi IP', 'Lo scopo inganna: i messaggi viaggiano su UDP, quindi è un\'applicazione.'],
      ['Collegamento (2), perché usa il broadcast', 'Il broadcast DHCP è un broadcast IP di datagrammi UDP: resta un\'applicazione.'],
      ['Fisico (1), perché è il primo che si usa', 'Il livello 1 è quello dei bit sul cavo. Scrivi sempre il nome del livello.']]);
  Q('pr-dhcp-bcast', 'proto', 3,
    'Perché il messaggio DHCP Discover viene mandato in broadcast?',
    'Cosa non conosce ancora il client quando entra in rete?',
    'Il client non ha ancora un IP e non sa dove sia il server DHCP: l\'unico modo di raggiungerlo è il broadcast.',
    ['Perché il client non ha ancora un IP e non conosce l\'indirizzo del server',
      ['Per risparmiare banda', 'Il broadcast non risparmia banda: arriva a tutti. Si usa perché il client non sa a chi scrivere.'],
      ['Perché UDP non permette l\'unicast', 'UDP permette benissimo l\'unicast (es. DNS).'],
      ['Perché DHCP è di livello 2', 'DHCP è un\'applicazione su UDP: il broadcast è un broadcast IP.']]);
  Q('pr-icmp', 'proto', 2,
    'Su quale protocollo si basano ping e traceroute?',
    'Echo request/reply e "TTL scaduto" sono messaggi di diagnostica.',
    'Usano ICMP, che sta direttamente dentro IP (protocollo 1): echo request/reply per ping, time exceeded per traceroute.',
    ['ICMP, incapsulato direttamente in IP',
      ['UDP porta 53', 'UDP 53 è il DNS.'],
      ['ARP', 'ARP trova i MAC nella LAN: non fa diagnostica tra reti.'],
      ['TCP, con una connessione verso il destinatario', 'ping non apre connessioni: manda messaggi ICMP.']]);
  Q('pr-ports', 'proto', 1,
    'Quale abbinamento protocollo/porta è tutto giusto?',
    'Ricorda la porta della posta in uscita e quella del DNS.',
    'SMTP 25, DNS 53, HTTP 80, HTTPS 443.',
    ['SMTP 25 · DNS 53 · HTTP 80 · HTTPS 443',
      ['SMTP 110 · DNS 53 · HTTP 80 · HTTPS 443', '110 è POP3 (lettura della posta); SMTP usa 25.'],
      ['SMTP 25 · DNS 67 · HTTP 80 · HTTPS 443', '67 è DHCP (server); DNS usa 53.'],
      ['SMTP 25 · DNS 53 · HTTP 8080 · HTTPS 22', '22 è SSH; HTTP usa 80 e HTTPS 443.']]);
  Q('pr-mail', 'proto', 1,
    'Per leggere la posta dal proprio server il client usa…',
    'Un protocollo spinge la posta, altri la prelevano.',
    'Si legge con POP3 (TCP 110) o IMAP (TCP 143). SMTP serve a inviare e inoltrare (push).',
    ['POP3 o IMAP',
      ['SMTP', 'SMTP invia e inoltra la posta (push): non serve a leggerla.'],
      ['SNMP', 'SNMP gestisce e monitora gli apparati di rete.'],
      ['FTP', 'FTP trasferisce file, non gestisce caselle di posta.']]);
  Q('pr-ftp', 'proto', 3,
    'Cosa ha di particolare FTP rispetto agli altri protocolli applicativi?',
    'Comandi e file passano per la stessa strada?',
    'FTP usa due connessioni TCP separate: una di controllo (porta 21) per i comandi e una dati (porta 20) per i file.',
    ['Usa due connessioni TCP: controllo (21) e dati (20)',
      ['Viaggia su UDP per essere più veloce', 'FTP usa TCP: un file deve arrivare intero e in ordine.'],
      ['È stateless come HTTP', 'FTP tiene lo stato della sessione (utente, directory corrente) sulla connessione di controllo.'],
      ['Cifra sempre i file', 'FTP non cifra: le versioni cifrate sono SFTP (su SSH) o FTPS.']]);
  Q('pr-tcpudp', 'proto', 1,
    'Che cosa hanno in comune TCP e UDP?',
    'Cosa identificano i numeri di porta?',
    'Entrambi sono di trasporto: viaggiano dentro IP e usano le porte per distinguere i processi. Solo TCP è affidabile e orientato alla connessione.',
    ['Sono di trasporto: viaggiano dentro IP e usano le porte per i processi',
      ['Sono entrambi affidabili', 'UDP non dà garanzie: niente ACK né ritrasmissioni.'],
      ['Sono entrambi orientati alla connessione', 'UDP è senza connessione: manda datagrammi indipendenti.'],
      ['Sono entrambi di livello rete', 'TCP e UDP sono il trasporto (4): sopra IP.']]);

  // ===== NAT =====
  Q('nat-65k', 'nat', 2,
    'Quante connessioni contemporanee (per protocollo) può distinguere un NAT con un solo IP pubblico, all\'incirca?',
    'Quanti bit ha il campo porta?',
    'La porta pubblica distingue le connessioni ed è a 16 bit: 2^16 ≈ 65.000 (un po\' meno togliendo le porte riservate).',
    ['Circa 65.000: il campo porta è a 16 bit',
      ['256: un ottetto', 'La porta non è un ottetto: è a 16 bit.'],
      ['Illimitate', 'Ogni connessione occupa una porta pubblica: il limite è il numero di porte.'],
      ['Circa 4 miliardi: 32 bit', '32 bit è la dimensione di un indirizzo IPv4; la porta è a 16 bit.']]);
  Q('nat-checksum', 'nat', 4,
    'Oltre a indirizzi e porte, cosa deve ricalcolare il NAT?',
    'Il checksum di TCP/UDP copre solo l\'intestazione TCP/UDP?',
    'Il checksum IP (cambia l\'IP) e il checksum TCP/UDP, che copre anche uno pseudo-header con gli indirizzi IP (e la porta cambia).',
    ['Il checksum IP e il checksum TCP/UDP (che include uno pseudo-header con gli IP)',
      ['Solo il checksum IP: TCP non contiene indirizzi IP', 'Il checksum TCP/UDP copre uno pseudo-header con gli IP, e in più cambia la porta: va ricalcolato anche lui.'],
      ['Niente: i checksum li ricalcola il destinatario', 'Il destinatario li verifica, non li ricalcola: se il NAT non li aggiorna il pacchetto viene scartato.'],
      ['I numeri di sequenza TCP', 'Il NAT non tocca Seq# e Ack#: cambiano IP e porte, e quindi i checksum.']]);
  Q('nat-critica', 'nat', 3,
    'Perché il NAT è criticato?',
    'Pensa ai livelli: il NAT sta nel router, ma quali campi modifica?',
    'Viola il principio end-to-end (dall\'esterno non si raggiungono gli host interni) e la stratificazione (un apparato di livello 3 modifica le porte, di livello 4).',
    ['Viola il principio end-to-end e la stratificazione (un apparato di livello 3 tocca le porte)',
      ['Perché cifra il traffico e lo rallenta', 'Il NAT non cifra niente: riscrive indirizzi e porte.'],
      ['Perché consuma molti indirizzi pubblici', 'È il contrario: serve proprio a risparmiare indirizzi pubblici.'],
      ['Perché non funziona con TCP', 'Funziona con TCP e UDP: traduce proprio le loro porte.']]);
  Q('nat-in', 'nat', 2,
    'Dall\'esterno arriva un pacchetto per l\'IP pubblico del NAT su una porta che non ha nessuna riga in tabella. Cosa succede?',
    'Come fa il NAT a scegliere l\'host interno?',
    'Senza riga il NAT non sa a quale host privato consegnarlo: il pacchetto viene scartato.',
    ['Viene scartato: il NAT non sa a quale host interno mandarlo',
      ['Viene mandato in broadcast a tutta la LAN', 'Il NAT non inoltra in broadcast: senza riga scarta.'],
      ['Viene consegnato al primo host della LAN', 'Non esiste un host "di default" a meno di configurarlo (port forwarding).'],
      ['Il NAT crea una nuova riga e lo inoltra', 'Le righe si creano con il traffico in uscita, non con quello in entrata.']]);
  Q('nat-pf', 'nat', 2,
    'Un server web sta nella LAN privata dietro NAT. Come lo rendi raggiungibile da Internet?',
    'Serve una riga in tabella che esista anche senza traffico in uscita.',
    'Con il port forwarding: una riga statica, per esempio WAN:80 → 192.168.1.5:80.',
    ['Con il port forwarding: una riga statica IP pubblico:80 → IP privato:80',
      ['Pubblicando nel DNS il suo IP 192.168.x.x', 'Gli indirizzi privati non sono instradabili su Internet.'],
      ['Basta che il client esterno apra la connessione', 'Senza una riga in tabella il NAT scarta la richiesta in entrata.'],
      ['Con ARP sul router di bordo', 'ARP lavora dentro la LAN: non crea associazioni nella tabella NAT.']]);
  Q('nat-p2p', 'nat', 4,
    'Due peer di un\'applicazione P2P sono entrambi dietro NAT. Cosa può aiutarli a connettersi?',
    'Si chiama problema del NAT traversal.',
    'UPnP (l\'applicazione chiede al router di aprire una porta), STUN (scoprire IP e porta pubblici) o, in ultima istanza, un relay.',
    ['UPnP o STUN, oppure un relay',
      ['DHCP', 'DHCP assegna gli indirizzi dentro la LAN: non apre porte sul NAT.'],
      ['Aumentare il TTL dei pacchetti', 'Il TTL non c\'entra: manca una riga nella tabella NAT.'],
      ['Usare indirizzi privati diversi nelle due LAN', 'Gli indirizzi privati restano non raggiungibili dall\'esterno, qualunque siano.']]);
  Q('nat-ipv6', 'nat', 3,
    'Qual è la soluzione di lungo periodo alla scarsità di indirizzi che rende il NAT superfluo?',
    'Servono molti più indirizzi.',
    'IPv6: indirizzi a 128 bit, abbastanza per dare un indirizzo pubblico a ogni dispositivo.',
    ['IPv6',
      ['CIDR', 'CIDR aiuta ad assegnare e aggregare meglio, ma gli indirizzi IPv4 restano 2^32.'],
      ['DHCP', 'DHCP distribuisce indirizzi, non ne crea di nuovi.'],
      ['Usare più porte per host', 'Le porte sono già il trucco del NAT: non risolvono la scarsità.']]);
  Q('nat-sameport', 'nat', 3,
    'Due host interni aprono una connessione dalla stessa porta sorgente 50000 verso lo stesso server. Cosa fa il NAT?',
    'Lato WAN l\'IP sorgente è lo stesso per tutti e due.',
    'Lato LAN non c\'è conflitto (IP diversi), ma lato WAN l\'IP è unico: il NAT assegna porte pubbliche diverse, altrimenti non saprebbe a chi consegnare le risposte.',
    ['Assegna ai due host porte pubbliche diverse',
      ['Usa per entrambi la porta pubblica 50000: gli IP privati sono diversi', 'Lato WAN gli IP privati spariscono: con la stessa porta le risposte sarebbero indistinguibili.'],
      ['Rifiuta la seconda connessione', 'Non serve rifiutarla: basta una porta pubblica diversa.'],
      ['Cambia la porta del server', 'Il lato del server non si tocca mai.']]);
  Q('nat-server', 'nat', 1,
    'Nei flussi prima e dopo il NAT, quali valori restano sempre uguali?',
    'Il NAT traduce solo un lato della comunicazione.',
    'IP e porta del server non vengono mai toccati: compaiono uguali in tutti i flussi.',
    ['IP e porta del server',
      ['IP e porta dell\'host privato', 'Sono proprio quelli che il NAT sostituisce lato WAN.'],
      ['Solo la porta dell\'host privato', 'La porta privata diventa una porta pubblica lato WAN.'],
      ['Nessuno', 'Il lato del server resta sempre uguale.']]);
  Q('nat-private', 'nat', 1,
    'Quale di questi è un indirizzo privato?',
    'I blocchi privati sono 10/8, 172.16/12, 192.168/16.',
    '172.16.0.0/12 va da 172.16.0.0 a 172.31.255.255: 172.20.1.5 è privato.',
    ['172.20.1.5',
      ['172.32.1.5', '172.16.0.0/12 arriva fino a 172.31.255.255: 172.32 è fuori.'],
      ['11.0.0.1', 'Il blocco privato è 10.0.0.0/8: 11.x è pubblico.'],
      ['192.169.1.1', 'Il blocco privato è 192.168.0.0/16: 192.169 è fuori.']]);

  // ===== TCP =====
  Q('tcp-3way', 'tcp', 2,
    'Perché l\'apertura di una connessione TCP richiede tre messaggi?',
    'Cosa deve comunicare ciascun lato, e cosa deve sapere?',
    'Ognuno deve annunciare il proprio ISN e sapere che l\'altro l\'ha ricevuto: SYN (ISN client), SYN+ACK (ISN server + riscontro), ACK (riscontro dell\'ISN server).',
    ['Ognuno deve annunciare il proprio ISN e sapere che l\'altro l\'ha ricevuto',
      ['Uno per ogni livello coinvolto: rete, trasporto, applicazione', 'I livelli non c\'entrano: i tre messaggi servono a scambiare e riscontrare i due ISN.'],
      ['Per misurare tre volte l\'RTT e farne la media', 'Il numero di messaggi non nasce dalla misura dell\'RTT.'],
      ['Perché il terzo messaggio porta sempre i primi dati', 'Il terzo può portare dati, ma non è il motivo: serve a riscontrare l\'ISN del server.']]);
  Q('tcp-isn', 'tcp', 3,
    'Perché gli ISN (numeri di sequenza iniziali) sono scelti a caso?',
    'Cosa succede se una connessione nuova riusa le stesse porte di una vecchia?',
    'Per non confondere segmenti in ritardo di una connessione vecchia (stesse porte) con quelli della nuova.',
    ['Per non confondere segmenti di una connessione vecchia con quelli della nuova',
      ['Per cifrare i dati', 'TCP non cifra: la cifratura è di TLS.'],
      ['Perché partire da 0 sprecherebbe numeri', 'Lo spazio dei numeri è circolare: non si spreca nulla partendo da 0.'],
      ['Per distribuire il carico tra i server', 'L\'ISN non ha a che fare con il bilanciamento del carico.']]);
  Q('tcp-synfin', 'tcp', 3,
    'Perché SYN e FIN consumano un numero di sequenza anche con lunghezza 0?',
    'Come farebbe il mittente a sapere che il suo SYN è arrivato?',
    'Devono essere riscontrati in modo affidabile come i dati: Ack = ISN+1 significa senza ambiguità "SYN ricevuto".',
    ['Perché vanno riscontrati in modo affidabile: Ack = ISN+1 vuol dire "SYN ricevuto"',
      ['Perché contengono un byte di dati nascosto', 'SYN e FIN hanno lunghezza 0: il numero lo consumano solo per poter essere riscontrati.'],
      ['Per tenere i numeri di sequenza pari', 'Non c\'è nessuna regola sui numeri pari.'],
      ['È solo una convenzione storica, non serve a niente', 'Serve: senza, l\'ACK del SYN sarebbe indistinguibile da un ACK che non riscontra nulla.']]);
  Q('tcp-cum', 'tcp', 2,
    'Il ricevente ha tutti i byte fino al 96, poi riceve il segmento 128–140 (mancano 97–127). Che Ack# manda?',
    'L\'ACK di TCP è cumulativo.',
    'Ack# = prossimo byte atteso in ordine = 97. Il segmento 128–140 resta in buffer ma non si può riscontrare finché manca il buco.',
    ['97',
      ['141', 'Ack 141 vorrebbe dire "ho tutto fino a 140", ma mancano 97–127: l\'ACK è cumulativo.'],
      ['128', '128 è il primo byte del segmento arrivato, ma prima manca ancora 97.'],
      ['96', 'Ack# è il prossimo byte atteso, non l\'ultimo ricevuto: 96 + 1 = 97.']]);
  Q('tcp-pureack', 'tcp', 1,
    'Un host manda un ACK puro (lunghezza 0, senza SYN né FIN) con Seq# 61. Il suo segmento successivo ha Seq#…',
    'Cosa consuma numeri di sequenza?',
    'Un ACK puro non consuma numeri: il segmento successivo riparte da 61.',
    ['61',
      ['62', 'Solo SYN e FIN consumano un numero senza dati: un ACK puro no.'],
      ['0', 'La numerazione non riparte da capo.'],
      ['L\'Ack# dell\'ACK appena mandato', 'Seq# e Ack# sono due contatori diversi: il Seq# segue i byte che l\'host manda.']]);
  Q('tcp-ackdef', 'tcp', 1,
    'In un segmento TCP, Ack# = 500 significa…',
    'Ack# guarda avanti, non indietro.',
    'Ack# è il prossimo byte atteso: "ho ricevuto tutto fino al 499, aspetto il 500".',
    ['ho ricevuto tutto fino al byte 499, aspetto il 500',
      ['ho ricevuto il byte 500', 'Ack# è il prossimo byte atteso: il 500 non è ancora arrivato.'],
      ['ho ricevuto in tutto 500 byte', 'I numeri partono dall\'ISN, non da 0: Ack# non è un conteggio di byte.'],
      ['ho perso il byte 500', 'Un ACK non segnala perdite in modo esplicito: dice solo fin dove è arrivato tutto.']]);
  Q('tcp-close', 'tcp', 3,
    'Quanti segmenti servono, di solito, per chiudere una connessione TCP?',
    'Ogni direzione si chiude per conto suo.',
    'Ogni direzione: FIN e il suo ACK → 4 segmenti. Diventano 3 se l\'ACK e il FIN del secondo lato viaggiano insieme.',
    ['4 (FIN e ACK per ciascun lato), oppure 3 se ACK e secondo FIN viaggiano insieme',
      ['Sempre 3, come l\'apertura', 'Possono essere 3, ma di base sono 4: le due direzioni si chiudono separatamente.'],
      ['2: un FIN e un ACK', 'Così si chiude solo una direzione: l\'altro lato deve mandare il suo FIN.'],
      ['1: un FIN basta a chiudere tutto', 'Il FIN chiude solo la direzione di chi lo manda.']]);
  Q('tcp-half', 'tcp', 4,
    'Il client ha mandato FIN e ha ricevuto l\'ACK. Il server può ancora mandare dati al client?',
    'Il FIN del client chiude quale direzione?',
    'Sì: half-close. Il FIN del client chiude solo la direzione client → server; il server può mandare dati finché non manda il suo FIN.',
    ['Sì: ogni direzione si chiude separatamente (half-close)',
      ['No: dopo il primo FIN la connessione è chiusa', 'Il primo FIN chiude solo una direzione.'],
      ['Solo se il client riapre la connessione', 'Non serve riaprire: la direzione server → client è ancora aperta.'],
      ['Solo dati urgenti', 'Non c\'è nessuna limitazione ai dati urgenti: la direzione è aperta.']]);
  Q('tcp-fast', 'tcp', 3,
    'Quando il mittente TCP fa il fast retransmit?',
    'Conta gli ACK con lo stesso numero.',
    'Con 3 ACK duplicati (4 ACK con lo stesso numero) ritrasmette subito il segmento mancante, senza aspettare il timeout.',
    ['Quando riceve 3 ACK duplicati, prima che scada il timeout',
      ['Al primo ACK duplicato', 'Un solo duplicato può essere un semplice riordino: si aspettano 3 duplicati.'],
      ['Allo scadere del timeout', 'Quella è la ritrasmissione normale: il fast retransmit serve proprio a non aspettarla.'],
      ['Quando la finestra di ricezione è piena', 'La finestra piena ferma l\'invio, non provoca ritrasmissioni.']]);
  Q('tcp-reno', 'tcp', 4,
    'TCP Reno: come cambia la finestra di congestione con 3 ACK duplicati e con un timeout?',
    'Quale dei due eventi indica una congestione più grave?',
    '3 ACK duplicati: i segmenti passano ancora, la finestra si dimezza. Timeout: congestione grave, si riparte da 1 MSS (slow start).',
    ['3 ACK duplicati: si dimezza · timeout: riparte da 1 MSS',
      ['3 ACK duplicati: riparte da 1 MSS · timeout: si dimezza', 'È il contrario: il timeout è il segnale più grave e riporta a 1 MSS.'],
      ['In entrambi i casi riparte da 1 MSS', 'Questo era TCP Tahoe; Reno con 3 ACK duplicati dimezza.'],
      ['In entrambi i casi si dimezza', 'Con il timeout Reno riparte da 1 MSS.']]);
  Q('tcp-after', 'tcp', 4,
    'Il ricevente ha in buffer 128–140 e aspetta il 97. Arriva la ritrasmissione 97–127. Che Ack# manda?',
    'Dopo aver colmato il buco, fin dove ha tutto in ordine?',
    'Con 97–127 e 128–140 ha tutto fino a 140: un unico Ack# = 141 riscontra tutto.',
    ['141',
      ['128', 'Anche 128–140 è già in buffer: l\'ACK cumulativo arriva fino a 141.'],
      ['97', 'Il 97 è appena arrivato: l\'Ack# deve andare avanti.'],
      ['140', 'Ack# è il prossimo byte atteso: 140 + 1 = 141.']]);

  // ===== SDN =====
  Q('sdn-planes', 'sdn', 1,
    'Che cosa separa l\'architettura SDN?',
    'Chi decide e chi esegue.',
    'Il piano di controllo (chi decide i percorsi, il controller) dal piano dati (gli switch che inoltrano).',
    ['Il piano di controllo dal piano dati',
      ['Il livello 2 dal livello 3', 'Non è una separazione tra livelli della pila: è tra chi decide e chi inoltra.'],
      ['Il traffico TCP da quello UDP', 'SDN tratta qualunque traffico: separa decisione e inoltro.'],
      ['Gli host dai server', 'Gli host non c\'entrano: si parla di switch e controller.']]);
  Q('sdn-ctrl', 'sdn', 1,
    'In SDN chi calcola le regole e come arrivano agli switch?',
    'Un\'entità centrale e un protocollo standard.',
    'Un controller centrale calcola le regole e le installa nelle flow table con OpenFlow.',
    ['Un controller centrale, che le installa con OpenFlow',
      ['Ogni switch da solo, con OSPF', 'Questo è il routing tradizionale distribuito: in SDN decide il controller.'],
      ['Il server DHCP', 'DHCP assegna indirizzi agli host: non programma gli switch.'],
      ['I router di bordo, con BGP', 'BGP è routing tra AS: le flow table le scrive il controller.']]);
  Q('sdn-prio', 'sdn', 2,
    'Un pacchetto soddisfa due regole della flow table. Quale si applica?',
    'Ogni regola ha un campo apposta.',
    'Vince la regola con priorità maggiore.',
    ['Quella con priorità maggiore',
      ['Quella inserita per prima', 'L\'ordine di inserimento non conta: conta la priorità.'],
      ['Sempre quella con il match più specifico', 'In OpenFlow decide la priorità, non la specificità: per questo va indicata nei conflitti.'],
      ['Tutte e due, in sequenza', 'Si applica una sola regola: quella a priorità maggiore.']]);
  Q('sdn-miss', 'sdn', 2,
    'Cosa succede di solito a un pacchetto che non soddisfa nessuna regola della flow table?',
    'Chi può decidere cosa farne?',
    'Viene mandato al controller (o scartato, secondo la configurazione), che può decidere e installare una nuova regola.',
    ['Viene mandato al controller (o scartato)',
      ['Viene inoltrato su tutte le porte', 'L\'inondazione è il comportamento di uno switch tradizionale con MAC sconosciuto, non di una flow table.'],
      ['Torna al mittente', 'Non esiste un "rimanda indietro" automatico.'],
      ['Segue la rotta di default del router', 'Lo switch SDN non ha una tabella di routing: ha solo la flow table.']]);
  Q('sdn-src', 'sdn', 3,
    'Perché con SDN due pacchetti con la stessa destinazione possono fare strade diverse?',
    'Su quali campi può fare match una regola?',
    'Il match può guardare anche la sorgente, le porte, la porta d\'ingresso (generalized forwarding); un router IP classico decide solo sulla destinazione.',
    ['Perché il match può guardare anche la sorgente e altri campi, non solo la destinazione',
      ['Perché gli switch SDN usano BGP', 'BGP non c\'entra: è il match generalizzato della flow table.'],
      ['Perché OpenFlow cambia l\'IP di destinazione', 'Modificare i campi è possibile, ma non serve: basta fare match sulla sorgente.'],
      ['Non è possibile: si decide sempre sulla destinazione', 'Questo vale per il router IP classico, non per SDN.']]);
  Q('sdn-port', 'sdn', 3,
    'La porta 4 di s1 e la porta 2 di s2 sono lo stesso cavo. Nella regola di s1 che manda verso s2 scrivi…',
    'Ogni switch conosce solo i propri numeri di porta.',
    'Nella regola di uno switch compaiono solo i suoi numeri di porta: forward(4).',
    ['forward(4)',
      ['forward(2)', '2 è il numero della porta di s2: nella regola di s1 usi il numero di s1.'],
      ['forward(s2)', 'L\'azione indica una porta dello switch, non il nome del vicino.'],
      ['forward(4) e forward(2)', 'Ogni switch ha la sua regola con il suo numero: in s1 solo la 4.']]);
  Q('sdn-wild', 'sdn', 4,
    'Su s2, h3 (10.2.0.3) e h4 (10.2.0.4) devono uscire da porte diverse verso 10.3.*.*. Basta un match con IP src = 10.2.*.*?',
    'Il jolly cattura entrambi gli host?',
    'No: 10.2.*.* cattura entrambi e non puoi mandarli su porte diverse. Serve l\'IP sorgente esatto (o la porta d\'ingresso).',
    ['No: cattura entrambi; serve l\'IP sorgente esatto o la porta d\'ingresso',
      ['Sì: la priorità li separa', 'Con lo stesso match la priorità non distingue h3 da h4.'],
      ['Sì, se la regola ha due action', 'Più action si applicano allo stesso pacchetto: non lo mandano su strade diverse secondo l\'host.'],
      ['No, perché i jolly non sono ammessi sulla sorgente', 'I jolly sulla sorgente sono ammessi; qui il problema è che il jolly è troppo largo.']]);
  Q('sdn-last', 'sdn', 3,
    'Lo switch a cui è attaccato l\'host di destinazione ha bisogno di una regola per quel flusso?',
    'Senza regola, cosa fa lo switch del pacchetto?',
    'Sì: anche l\'ultimo switch deve sapere da quale porta consegnare il pacchetto all\'host.',
    ['Sì: deve sapere da quale porta consegnare all\'host',
      ['No: consegna in automatico agli host collegati', 'Lo switch SDN fa solo ciò che dice la flow table.'],
      ['No: ci pensa sempre il controller, pacchetto per pacchetto', 'Mandare ogni pacchetto al controller è lentissimo: le regole si installano negli switch.'],
      ['Solo se l\'host è un server', 'Vale per qualunque host di destinazione.']]);

  // ===== HTTP =====
  Q('http-state', 'http', 1,
    'HTTP è stateless. Come si mantiene uno stato, per esempio il carrello?',
    'Il server lascia al client un "biglietto" da ripresentare.',
    'Con i cookie: il server manda Set-Cookie nella risposta, il client lo rimanda con Cookie nelle richieste successive.',
    ['Con i cookie',
      ['Con il three-way handshake', 'L\'handshake apre la connessione TCP: non ricorda nulla tra una richiesta e l\'altra.'],
      ['Con la GET condizionale', 'La GET condizionale serve a non riscaricare un oggetto in cache.'],
      ['Con l\'header Host', 'Host dice quale sito sullo stesso IP: non tiene lo stato.']]);
  Q('http-cookie', 'http', 3,
    'Quale header usa il server per impostare un cookie, e quale il client per rimandarlo?',
    'Il server "imposta", il client "presenta".',
    'Il server manda Set-Cookie nella risposta; il client rimanda Cookie nelle richieste successive.',
    ['Set-Cookie (risposta) · Cookie (richiesta)',
      ['Cookie (risposta) · Set-Cookie (richiesta)', 'Sono invertiti: Set-Cookie lo manda il server.'],
      ['Set-Cookie in entrambe le direzioni', 'Il client non imposta cookie: rimanda quelli ricevuti con Cookie.'],
      ['Last-Modified · If-Modified-Since', 'Questi servono alla cache e alla GET condizionale.']]);
  Q('http-proxy', 'http', 2,
    'A cosa serve una web cache (proxy)?',
    'Il client chiede al proxy invece che al server d\'origine.',
    'Risponde con la propria copia, se valida: riduce il tempo di risposta e il traffico sul link d\'accesso.',
    ['Risponde dalla sua copia: meno tempo di risposta e meno traffico sul link d\'accesso',
      ['Cifra le pagine', 'La cifratura è di TLS (https).'],
      ['Risolve i nomi di dominio', 'Questo è il DNS.'],
      ['Assegna gli IP ai client', 'Questo è DHCP.']]);
  Q('http-h2', 'http', 3,
    'Qual è la novità principale di HTTP/2?',
    'Più richieste, una sola connessione.',
    'Multiplexing di più richieste e risposte su una sola connessione TCP, header compressi, server push.',
    ['Multiplexing di più richieste su una sola connessione',
      ['Il passaggio a UDP', 'Questo è HTTP/3 (su QUIC).'],
      ['L\'eliminazione dell\'header Host', 'Host resta necessario per il virtual hosting.'],
      ['Rende HTTP stateful', 'HTTP resta stateless: lo stato si tiene sempre con i cookie.']]);
  Q('http-h3', 'http', 4,
    'HTTP/3 viaggia su QUIC. Su che cosa si appoggia QUIC?',
    'Non è TCP.',
    'QUIC gira su UDP (porta 443) e implementa da sé affidabilità, controllo di congestione e cifratura.',
    ['Su UDP: affidabilità e congestione le implementa QUIC stesso',
      ['Su TCP porta 443', 'QUIC nasce proprio per non usare TCP.'],
      ['Direttamente dentro IP, come OSPF', 'QUIC usa UDP.'],
      ['Sul livello di collegamento', 'QUIC sta sopra UDP e IP.']]);
  Q('http-304', 'http', 1,
    'Il server risponde 304. Che cosa significa?',
    'È la risposta tipica a una GET condizionale.',
    '304 Not Modified: la copia in cache è ancora valida, la risposta non ha corpo.',
    ['Not Modified: la copia in cache è valida, corpo vuoto',
      ['Moved Permanently: l\'oggetto si è spostato', 'Quello è 301.'],
      ['Not Found: l\'oggetto non esiste', 'Quello è 404.'],
      ['Errore interno del server', 'Quello è 500.']]);
  Q('http-codes', 'http', 2,
    'Codici di risposta: oggetto inesistente e richiesta malformata?',
    'I 4xx sono errori del client.',
    '404 Not Found per l\'oggetto inesistente, 400 Bad Request per la richiesta malformata.',
    ['404 · 400',
      ['400 · 404', 'Sono invertiti: 404 è "non trovato", 400 "richiesta errata".'],
      ['500 · 404', '500 è un errore del server, non un oggetto inesistente.'],
      ['301 · 400', '301 indica un oggetto spostato, non inesistente.']]);
  Q('http-301', 'http', 3,
    'In una risposta 301 Moved Permanently, dove si trova la nuova URL?',
    'È un header della risposta.',
    'Nell\'header Location.',
    ['Nell\'header Location',
      ['Nell\'header Host', 'Host è un header della richiesta.'],
      ['Nell\'header Referer', 'Referer è un header della richiesta (la pagina di provenienza).'],
      ['Nell\'header Last-Modified', 'Last-Modified è la data di ultima modifica.']]);
  Q('http-host', 'http', 2,
    'Perché in HTTP/1.1 l\'header Host è obbligatorio?',
    'Lo stesso IP può ospitare più siti?',
    'Sullo stesso IP possono esserci più siti (virtual hosting): il server deve sapere quale si chiede.',
    ['Perché sullo stesso IP possono esserci più siti (virtual hosting)',
      ['Perché serve al DNS per risolvere il nome', 'Il DNS è già stato fatto prima della connessione.'],
      ['Perché serve al NAT per tradurre la porta', 'Il NAT non legge gli header HTTP.'],
      ['Perché contiene l\'IP del client', 'Host contiene il nome del sito richiesto, non l\'IP del client.']]);
  Q('http-2rtt', 'http', 2,
    'Senza connessioni persistenti, perché ogni oggetto costa 2 RTT (più la trasmissione)?',
    'Cosa si ripete per ogni oggetto?',
    '1 RTT per l\'handshake TCP (SYN → SYN-ACK) e 1 per la richiesta e l\'inizio della risposta (l\'ACK finale dell\'handshake viaggia con la GET).',
    ['1 RTT per l\'handshake TCP e 1 per richiesta e risposta',
      ['1 RTT per il DNS e 1 per la richiesta', 'Il DNS si fa una volta per host, non per oggetto.'],
      ['1 RTT per la richiesta e 1 per la chiusura', 'La chiusura non ritarda la ricezione dell\'oggetto.'],
      ['1 RTT per ogni header della risposta', 'Gli header arrivano tutti insieme nella risposta.']]);
  Q('http-pers', 'http', 3,
    'Pagina + 3 immagini sullo stesso server, HTTP persistente senza pipelining, DNS escluso. Quanti RTT?',
    'Handshake una volta, poi 1 RTT per oggetto.',
    '1 handshake + 4 oggetti × 1 RTT = 5 RTT.',
    ['5',
      ['8', '8 = 2 × 4 è il caso non persistente.'],
      ['3', '3 è il caso con pipelining (handshake + pagina + tutte le immagini insieme).'],
      ['4', 'Hai dimenticato l\'handshake: anche con la persistenza la connessione si apre una volta.']]);
  Q('http-blank', 'http', 1,
    'In un messaggio HTTP che cosa separa gli header dal corpo?',
    'È una riga particolare.',
    'Una riga vuota (CR LF).',
    ['Una riga vuota',
      ['L\'header Content-Length', 'Content-Length dice quanto è lungo il corpo, ma il confine è la riga vuota.'],
      ['Un carattere speciale di fine header', 'Nessun carattere speciale: una riga vuota.'],
      ['Niente: il corpo segue l\'ultimo header', 'Senza la riga vuota il server non saprebbe dove finiscono gli header.']]);

  // ===== DNS =====
  Q('dns-udp', 'dns', 1,
    'Su quale trasporto e porta viaggiano di norma le query DNS?',
    'Una domanda e una risposta brevi.',
    'UDP porta 53 (TCP solo per risposte grandi).',
    ['UDP 53',
      ['TCP 80', 'TCP 80 è HTTP.'],
      ['UDP 67', 'UDP 67 è DHCP (server).'],
      ['TCP 25', 'TCP 25 è SMTP.']]);
  Q('dns-order', 'dns', 2,
    'Con la cache vuota, il server DNS locale risolve www.reti.it interrogando, nell\'ordine…',
    'Si parte dalla cima della gerarchia.',
    'Root → TLD .it → server autoritativo di reti.it, che dà l\'indirizzo (record A).',
    ['root → TLD .it → autoritativo di reti.it',
      ['autoritativo → TLD → root', 'È al contrario: senza cache non si sa ancora chi sia l\'autoritativo, lo dice il TLD.'],
      ['TLD → root → autoritativo', 'Si parte dal root, che indica il server del TLD.'],
      ['solo il root, che conosce tutti i nomi', 'Il root conosce solo i server dei TLD: il DNS è distribuito.']]);
  Q('dns-cache', 'dns', 2,
    'Perché i server DNS usano la cache?',
    'Pensa al carico sui server root e TLD.',
    'Per non ripetere query già fatte: risposte più rapide e meno carico sui server root e TLD.',
    ['Per rispondere più in fretta e alleggerire root e TLD',
      ['Per tenere copia delle pagine web', 'Le pagine le tiene la web cache (proxy), non il DNS.'],
      ['Per assegnare gli indirizzi agli host', 'Questo è DHCP.'],
      ['Per cifrare le risposte', 'La cache non cifra niente.']]);
  Q('dns-local', 'dns', 2,
    'Chi interroga root, TLD e server autoritativo per conto dell\'host?',
    'L\'host fa una sola domanda.',
    'Il server DNS locale: l\'host gli fa una domanda e lui risolve il resto.',
    ['Il server DNS locale',
      ['Il browser, direttamente', 'Il browser chiede al server locale, che fa il giro per lui.'],
      ['Il router di default', 'Il router inoltra i pacchetti: non risolve i nomi.'],
      ['Il server web', 'Il server web non è ancora stato contattato: serve il suo IP.']]);
  Q('dns-tcp', 'dns', 4,
    'Quando il DNS usa TCP invece di UDP?',
    'Pensa alla dimensione dei messaggi.',
    'Per le risposte grandi (e per copiare intere zone tra server).',
    ['Per le risposte grandi',
      ['Sempre, per i record A', 'Le query normali, record A compresi, viaggiano su UDP.'],
      ['Quando il client ha un IP privato', 'L\'indirizzo del client non c\'entra.'],
      ['Mai', 'Lo usa per le risposte grandi.']]);
  Q('dns-rec', 'dns', 3,
    'Quale record DNS contiene l\'indirizzo IPv4 di un nome?',
    'Quello più comune.',
    'Il record A. MX indica il server di posta, NS il name server, CNAME un alias.',
    ['A',
      ['MX', 'MX indica il server di posta del dominio.'],
      ['NS', 'NS indica il name server del dominio.'],
      ['CNAME', 'CNAME è un alias verso un altro nome.']]);
  Q('dns-first', 'dns', 1,
    'Perché il browser fa la risoluzione DNS prima di aprire la connessione TCP?',
    'Con che cosa lavorano TCP e IP?',
    'TCP e IP lavorano con indirizzi numerici: non si può aprire una connessione verso un nome.',
    ['Perché non si può aprire una connessione verso un nome: serve l\'IP',
      ['Per sapere quale porta usare', 'La porta la dà la URL (http → 80), non il DNS.'],
      ['Per scaricare la pagina più in fretta', 'Il DNS non scarica nulla: dà l\'indirizzo.'],
      ['Non è vero: il DNS si fa dopo l\'handshake', 'Senza IP l\'handshake non può partire.']]);

  const bankById = id => BANK.find(b => b.id === id);
  const LETTERS = ['a', 'b', 'c', 'd', 'e'];

  // ---------------- parametri e costruzione ----------------
  const LEVELS = {
    1: { n: 6, min: 1, max: 2, hard: 0 },
    2: { n: 7, min: 1, max: 3, hard: 2 },
    3: { n: 8, min: 1, max: 4, hard: 3 },
    4: { n: 9, min: 2, max: 5, hard: 5 },
    5: { n: 10, min: 3, max: 5, hard: 10 }
  };
  // sceglie k domande dal pool alternando gli argomenti (il meno rappresentato per primo)
  function spread(pool, k, chosen) {
    const avail = U.shuffle(pool.filter(q => !chosen.includes(q)));
    while (k > 0 && avail.length) {
      const count = t => chosen.filter(q => q.topic === t).length;
      const topics = U.shuffle([...new Set(avail.map(q => q.topic))]);
      topics.sort((x, y) => count(x) - count(y));
      const i = avail.findIndex(q => q.topic === topics[0]);
      chosen.push(avail.splice(i, 1)[0]);
      k--;
    }
  }
  function randomParams(level) {
    const L = LEVELS[level] || LEVELS[3];
    const pool = BANK.filter(q => q.d >= L.min && q.d <= L.max);
    const chosen = [];
    spread(pool.filter(q => q.d >= 3), Math.min(L.hard, L.n), chosen);
    spread(pool, L.n - chosen.length, chosen);
    chosen.sort((x, y) => TORDER.indexOf(x.topic) - TORDER.indexOf(y.topic));
    return { level, qs: chosen.map(q => ({ id: q.id, ord: U.shuffle(q.opts.map((_, i) => i)) })) };
  }

  function build(p) {
    const items = p.qs.map(x => {
      const src = bankById(x.id);
      const ord = x.ord && x.ord.length === src.opts.length ? x.ord : src.opts.map((_, i) => i);
      return {
        id: src.id, topic: src.topic, d: src.d, q: src.q, hint: src.hint, why: src.why,
        opts: ord.map(i => ({ t: src.opts[i].t, err: src.opts[i].err })),
        ok: ord.indexOf(0)
      };
    });
    // in ordine di argomento (stabile): un passo per argomento
    const sorted = items.map((it, i) => [it, i]).sort((x, y) => (TORDER.indexOf(x[0].topic) - TORDER.indexOf(y[0].topic)) || (x[1] - y[1])).map(x => x[0]);
    return { cat: 'theory', level: p.level, params: p, items: sorted };
  }
  const gen = level => build(randomParams(level));

  // ---------------- passi ----------------
  const keyOf = i => `q${i + 1}`;
  function topicsIn(ex) { return TORDER.filter(t => ex.items.some(it => it.topic === t)); }
  function steps(ex) {
    return topicsIn(ex).map(t => ({
      id: t, title: topicOf(t).title,
      keys: ex.items.map((it, i) => it.topic === t ? keyOf(i) : null).filter(Boolean)
    }));
  }
  function itemOf(ex, key) {
    const m = /^q(\d+)$/.exec(key);
    return m ? ex.items[Number(m[1]) - 1] || null : null;
  }
  const optText = (it, i) => `${LETTERS[i]}) ${it.opts[i].t}`;

  // ---------------- correzione ----------------
  function grade(ex, a) {
    let correct = 0;
    const marks = {};
    ex.items.forEach((it, i) => {
      const k = keyOf(i);
      const ok = String(a[k] == null ? '' : a[k]).trim() === LETTERS[it.ok];
      if (ok) correct++;
      marks[k] = { ok, msg: `Risposta giusta: ${optText(it, it.ok)}. ${it.why}` };
    });
    return { correct, total: ex.items.length, marks };
  }

  function sol2answers(ex) {
    const a = {};
    ex.items.forEach((it, i) => { a[keyOf(i)] = LETTERS[it.ok]; });
    return a;
  }

  // ---------------- errori tipici ----------------
  function diagnose(ex, key, value) {
    const it = itemOf(ex, key);
    const v = String(value == null ? '' : value).trim();
    if (!it || v === '') return null;
    const i = LETTERS.indexOf(v);
    if (i < 0 || i >= it.opts.length || i === it.ok) return null;
    return it.opts[i].err;
  }

  function diagnoseCases(ex) {
    return ex.items.map((it, i) => {
      const w = it.opts.findIndex((o, j) => j !== it.ok);
      return { key: keyOf(i), value: LETTERS[w], expect: it.opts[w].err.slice(0, 40) };
    });
  }

  // ---------------- aiuti ----------------
  function fieldHint(ex, key) {
    const it = itemOf(ex, key);
    return it ? it.hint + ' Elimina prima le opzioni che descrivono un altro protocollo o un altro meccanismo.' : 'Rileggi il testo della domanda.';
  }

  function hints(ex) {
    return topicsIn(ex).map(t => {
      const its = ex.items.map((it, i) => [it, i]).filter(x => x[0].topic === t);
      return {
        step: t, title: topicOf(t).title,
        metodo: topicOf(t).concept,
        applicato: its.map(([it, i]) => `${i + 1}. ${it.hint}`).join('\n'),
        svolto: its.map(([it, i]) => `${i + 1}. ${optText(it, it.ok)} — ${it.why}`).join('\n')
      };
    });
  }

  // ---------------- disegno ----------------
  function render(ex, root, ctx) {
    root.appendChild(U.h('div', { class: 'card intro' },
      U.h('p', {}, U.h('b', {}, 'Domande di teoria. '), `${ex.items.length} domande a risposta chiusa sugli argomenti delle guide. Per ognuna una sola opzione è giusta.`),
      U.h('p', { class: 'small' }, 'Prima di scegliere, elimina le opzioni che descrivono un altro protocollo o un altro meccanismo, poi chiediti il perché della regola.')));
    topicsIn(ex).forEach(t => {
      root.appendChild(U.card(topicOf(t).title, { step: t },
        ex.items.map((it, i) => it.topic !== t ? null : U.h('div', { class: 'q-item' },
          U.h('div', { class: 'q-text' }, `${i + 1}. ${it.q}`),
          U.sel(ctx, keyOf(i), it.opts.map((_, j) => [LETTERS[j], optText(it, j)]), { label: `domanda ${i + 1}` })))));
    });
  }

  function solution(ex, root) {
    root.appendChild(U.h('div', { class: 'card sol' },
      U.h('h4', {}, 'Soluzione'),
      U.table(['#', 'Argomento', 'Risposta'], ex.items.map((it, i) => [String(i + 1), topicOf(it.topic).title, optText(it, it.ok)])),
      topicsIn(ex).map(t => U.h('div', {},
        U.h('p', { class: 'sol-body' }, U.h('b', {}, topicOf(t).title)),
        ex.items.map((it, i) => it.topic !== t ? null : U.h('div', { class: 'q-item' },
          U.h('div', { class: 'q-text' }, `${i + 1}. ${it.q}`),
          U.h('p', { class: 'sol-body' }, U.h('b', {}, optText(it, it.ok) + '. '), it.why),
          U.h('p', { class: 'small' }, 'Le altre: ' + it.opts.map((o, j) => j === it.ok ? null : `${LETTERS[j]}) ${o.err}`).filter(Boolean).join(' · '))))))));
  }

  function chatText(ex, a) {
    const L = [];
    L.push(`Extra · Domande di teoria (livello ${ex.level})`);
    L.push('## Domande e mie risposte');
    ex.items.forEach((it, i) => {
      const v = a && String(a[keyOf(i)] || '').trim();
      const j = LETTERS.indexOf(v);
      L.push(`${i + 1}. [${topicOf(it.topic).title}] ${it.q}`);
      it.opts.forEach((_, k) => L.push(`   ${optText(it, k)}`));
      L.push(`   Mia risposta: ${j >= 0 && j < it.opts.length ? LETTERS[j] : '__'}`);
    });
    return L.join('\n');
  }

  RA.theory = {
    id: 'theory', num: 'T', name: 'Domande di teoria', examPoints: 0, extra: true,
    desc: 'Domande a risposta chiusa sui "perché" delle guide: routing, protocolli, NAT, TCP, SDN, HTTP, DNS.',
    method: {
      intro: 'Le domande di teoria premiano chi conosce il perché delle regole. Ogni opzione sbagliata descrive di solito un altro protocollo o un meccanismo vicino: riconoscerlo è metà del lavoro.',
      steps: [
        'Leggi la domanda e individua l\'argomento: routing, protocolli, NAT, TCP, SDN, HTTP o DNS.',
        'Elimina le opzioni che descrivono un altro protocollo (es. "link state, Dijkstra" è OSPF, non RIP) o un altro meccanismo (cache vs cookie).',
        'Tra quelle rimaste chiediti il perché: quale regola della guida le giustifica? (longest prefix match, ARP solo nella sottorete, ACK cumulativo…).',
        'Attento ai numeri: porte, bit, RTT. Rifai il conto invece di andare a memoria.',
        'Diffida delle opzioni assolute ("sempre", "mai") e di quelle con le parti invertite (Set-Cookie/Cookie, IP→MAC).'
      ],
      traps: [
        'Lo scopo inganna: DHCP configura gli IP ma è un\'applicazione su UDP; RIP fa routing ma viaggia su UDP 520.',
        'L\'ACK di TCP è cumulativo: si ferma al primo byte mancante.',
        'Con 3 ACK duplicati Reno dimezza; con il timeout riparte da 1 MSS.',
        'In una flow table decide la priorità, non il prefisso più lungo; nel router IP decide il prefisso più lungo.',
        'Il NAT non tocca mai il lato del server.'
      ],
      formulas: [
        ['Prefisso /n', '2^(32−n) indirizzi, 2^(32−n) − 2 utilizzabili'],
        ['Routing', 'longest prefix match · statiche con distanza amministrativa più bassa delle dinamiche'],
        ['NAT', 'porta a 16 bit → ~65.000 connessioni per IP pubblico'],
        ['TCP', 'SYN e FIN consumano 1 · Ack# = prossimo byte atteso · fast retransmit con 3 ACK duplicati'],
        ['HTTP', '2 RTT per oggetto senza persistenza · 200 OK · 301 Location · 304 Not Modified · 400 · 404 · 500'],
        ['DNS', 'UDP 53 · root → TLD → autoritativo · record A']
      ]
    },
    traces: [],
    randomParams, build, gen, steps, grade, sol2answers, render, solution, hints, fieldHint, diagnose, diagnoseCases, chatText
  };
})();
