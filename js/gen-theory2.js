// ============================================================
// RetiApp · gen-theory2.js — Extra · Domande di teoria della 2ª parte
// (risposta chiusa + domande aperte d'esame valutate a parole chiave)
// Contratto dei moduli: docs/moduli.md (modello: gen-theory.js)
// ============================================================
(function () {
  const RA = window.RetiApp;
  const U = RA.util;

  // ---------------- argomenti ----------------
  const TOPICS = [
    { id: 'link', title: 'Livello di collegamento', concept: `Il livello di collegamento sposta frame tra nodi adiacenti. Gli indirizzi MAC (48 bit) valgono solo sul singolo link: ARP trova il MAC di un IP della stessa sottorete (request in broadcast, reply in unicast); per un IP fuori dalla sottorete si cerca il MAC del gateway. Lo switch impara da solo (self-learning) e inoltra per MAC senza toccare gli indirizzi; il router lavora a livello 3 e rifà il frame a ogni salto. Le VLAN dividono uno switch in più LAN separate: per passare da una all'altra serve un router.` },
    { id: 'mac', title: 'Accesso multiplo e rilevazione degli errori', concept: `Su un canale condiviso serve un protocollo di accesso multiplo: suddivisione del canale (TDMA, FDMA), accesso casuale (ALOHA, CSMA, CSMA/CD) o a turni (polling, token). Gli accessi casuali accettano le collisioni e le recuperano con attese casuali, sempre più lunghe se le collisioni si ripetono. Parità e CRC rilevano gli errori aggiungendo bit di ridondanza ai dati.` },
    { id: 'routing', title: 'Routing', concept: `Link state (OSPF): ogni router conosce tutta la topologia e calcola i cammini minimi con Dijkstra. Distance vector (RIP): ogni router conosce solo i vicini e i loro vettori e aggiorna le stime con Bellman-Ford, in modo iterativo, asincrono e distribuito. Dentro un AS si usa un protocollo intra-AS (RIP, OSPF); tra AS diversi si usa BGP, dove contano anche le politiche dei provider. ICMP riporta errori e informazioni con un tipo e un codice.` },
    { id: 'wireless', title: 'Wireless e mobilità', concept: `Il canale radio si attenua, subisce interferenze e cammini multipli: gli errori sono più frequenti e una stazione non sente sempre le altre (terminale nascosto). Per questo 802.11 non rileva le collisioni ma cerca di evitarle (CSMA/CA) e vuole un ACK per ogni frame. Nelle reti cellulari e nella mobilità c'è sempre una rete di casa (home) che sa dove si trova il dispositivo.` },
    { id: 'security', title: 'Sicurezza', concept: `Le proprietà da garantire sono riservatezza, autenticazione, integrità e disponibilità. La cifratura simmetrica (AES) è veloce ma richiede una chiave condivisa; quella a chiave pubblica (RSA) risolve la distribuzione delle chiavi ma è lenta: in pratica si usa la pubblica per scambiare una chiave di sessione simmetrica. Firma = digest cifrato con la chiave privata; il certificato di una CA lega una chiave pubblica a un'identità. TLS, IPsec e WPA applicano queste idee a livelli diversi.` }
  ];
  const OPEN_STEP = { id: 'open', title: 'Domande aperte d\'esame', concept: `Una risposta aperta si valuta sui punti chiave. Definisci il concetto, spiega il meccanismo passo per passo, di' perché serve e dove si usa. Usa i termini tecnici giusti (chi corregge li cerca) e frasi brevi: meglio un elenco ordinato di passi che un paragrafo vago.` };
  const topicOf = id => id === 'open' ? OPEN_STEP : TOPICS.find(t => t.id === id);
  const TORDER = TOPICS.map(t => t.id);

  // ---------------- banca delle domande chiuse ----------------
  // Q(id, argomento, difficoltà, testo, indizio, perché, [giusta, [sbagliata, errore], ...])
  // La prima opzione è sempre quella giusta: l'ordine mostrato lo decide randomParams.
  const BANK = [];
  function Q(id, topic, d, q, hint, why, opts) {
    BANK.push({
      id, topic, d, q, hint, why,
      opts: opts.map((o, i) => i === 0 ? { t: o, err: null } : { t: o[0], err: o[1] })
    });
  }

  // ===== Livello di collegamento =====
  Q('l-services', 'link', 1,
    `Quale di questi NON è un servizio del livello di collegamento?`,
    `Il livello di collegamento lavora tra due nodi adiacenti: quale opzione riguarda invece l'intero percorso?`,
    `Il livello di collegamento sposta frame tra nodi adiacenti: framing, rilevazione degli errori, controllo di flusso, a volte consegna affidabile. Scegliere il percorso tra reti diverse è il routing, compito del livello di rete.`,
    [`Scegliere il percorso dei datagrammi tra reti diverse`,
      [`Incapsulare il datagramma in un frame (framing)`, `Il framing è il servizio base del livello di collegamento: il datagramma viaggia dentro un frame con i MAC.`],
      [`Rilevare gli errori nei frame ricevuti`, `La rilevazione degli errori (CRC, parità) è proprio un servizio del collegamento.`],
      [`Regolare la velocità tra due nodi adiacenti (controllo di flusso)`, `Il controllo di flusso tra nodi adiacenti è uno dei servizi del collegamento.`]]);
  Q('l-mac48', 'link', 1,
    `Quanto è lungo un indirizzo MAC?`,
    `Pensa al formato AA:BB:CC:DD:EE:FF: quante coppie esadecimali?`,
    `Un MAC ha 6 byte = 48 bit, scritti come 6 coppie esadecimali. Il costruttore compra dall'IEEE un blocco di indirizzi e ne assegna uno a ogni scheda.`,
    [`48 bit (6 byte)`,
      [`32 bit`, `32 bit è la lunghezza di un indirizzo IPv4, non di un MAC.`],
      [`128 bit`, `128 bit è la lunghezza di un indirizzo IPv6.`],
      [`24 bit`, `24 bit è solo la prima metà del MAC, quella che identifica il costruttore.`]]);
  Q('l-arp-msg', 'link', 2,
    `Come viaggiano la request e la reply di ARP?`,
    `Chi chiede non sa a chi rivolgersi; chi risponde invece sa chi ha chiesto.`,
    `La request va in broadcast (FF:FF:FF:FF:FF:FF) perché il mittente non conosce ancora il MAC cercato. La reply va in unicast: chi risponde legge il MAC del richiedente nella request.`,
    [`Request in broadcast, reply in unicast verso chi ha chiesto`,
      [`Entrambe in broadcast`, `La reply non serve a tutti: chi risponde conosce già il MAC del richiedente (è scritto nella request) e gli risponde direttamente.`],
      [`Request in unicast al router, reply in broadcast`, `È il contrario: chi chiede non conosce il MAC, quindi deve chiedere a tutti.`],
      [`Entrambe in UDP verso la porta 67`, `UDP 67/68 è DHCP. ARP non usa IP né UDP: viaggia direttamente nel frame.`]]);
  Q('l-arp-gw', 'link', 2,
    `Un host deve inviare un datagramma a un IP che NON è nella sua sottorete. Di quale MAC ha bisogno?`,
    `Il frame arriva solo fino al prossimo nodo sul link.`,
    `Il frame viaggia solo sul link locale: va mandato al default gateway, il router della LAN. Il datagramma dentro mantiene l'IP del destinatario finale. ARP si usa solo dentro la propria sottorete.`,
    [`Del default gateway (il router della sua LAN)`,
      [`Del destinatario finale`, `La request ARP è in broadcast e non attraversa il router: il MAC di un host di un'altra rete non si può chiedere, e comunque non servirebbe.`],
      [`Di nessuno: usa il MAC broadcast FF:FF:FF:FF:FF:FF`, `Il broadcast si usa per la request ARP, non per i dati: il frame dati va al MAC del gateway.`],
      [`Del server DNS`, `Il DNS traduce nomi in IP; per uscire dalla LAN il frame va al router.`]]);
  Q('l-arp-ttl', 'link', 2,
    `Perché le righe della tabella ARP hanno un TTL?`,
    `Un'associazione IP-MAC resta vera per sempre?`,
    `Le associazioni IP-MAC possono cambiare (scheda sostituita, IP riassegnato da DHCP, host spento). Con il TTL una riga scade e alla prossima necessità si rifà la richiesta ARP.`,
    [`Perché le associazioni IP-MAC possono cambiare: scadendo, si rinnovano`,
      [`Per limitare il numero di router che il frame attraversa`, `Quello è il TTL del datagramma IP. Il TTL della tabella ARP è un tempo di scadenza della riga.`],
      [`Perché la tabella ARP la scrive a mano l'amministratore`, `La tabella ARP si riempie da sola con le reply: è un dato acquisito durante il funzionamento.`],
      [`Per sapere quanti salti dista l'host`, `ARP lavora solo nella propria LAN: lì non ci sono salti da contare.`]]);
  Q('l-eth-frame', 'link', 2,
    `Quali campi ha un frame Ethernet, nell'ordine?`,
    `La scheda deve capire il prima possibile se il frame è per lei.`,
    `Preambolo (7 + 1 byte), MAC destinazione (6), MAC sorgente (6), tipo (2), dati, CRC. La destinazione viene prima così la scheda decide subito se tenere il frame.`,
    [`Preambolo, MAC destinazione, MAC sorgente, tipo, dati, CRC`,
      [`Preambolo, MAC sorgente, MAC destinazione, tipo, dati, CRC`, `L'ordine è destinazione e poi sorgente: la scheda guarda subito se il frame è suo.`],
      [`MAC destinazione, MAC sorgente, IP destinazione, IP sorgente, dati`, `Gli IP stanno nel datagramma, cioè dentro il campo dati: il frame ha solo i MAC.`],
      [`Preambolo, MAC destinazione, MAC sorgente, numero di sequenza, dati, ACK`, `Ethernet non ha numeri di sequenza né ACK: è non affidabile.`]]);
  Q('l-preamble', 'link', 3,
    `A cosa servono i 7 byte 10101010 e il byte 10101011 del preambolo Ethernet?`,
    `Il ricevente deve "agganciarsi" al ritmo dei bit prima di leggere.`,
    `L'alternanza di 0 e 1 sincronizza il clock del ricevente; l'ultimo byte, che finisce con 11, segnala che subito dopo inizia il frame vero (il MAC di destinazione).`,
    [`A sincronizzare il clock del ricevente; l'ultimo byte segnala l'inizio del frame`,
      [`Contengono il CRC del frame`, `Il CRC sta in coda al frame, dopo i dati.`],
      [`Sono l'indirizzo di broadcast`, `Il broadcast è il MAC FF:FF:FF:FF:FF:FF, nel campo destinazione.`],
      [`Indicano il protocollo di livello superiore`, `Questo lo fa il campo tipo (2 byte), dopo i MAC.`]]);
  Q('l-eth-unrel', 'link', 2,
    `Ethernet è affidabile e orientato alla connessione?`,
    `Pensa a cosa succede a un frame con il CRC sbagliato.`,
    `Ethernet è connectionless (nessun handshake) e non affidabile: il ricevente non manda ACK né NACK e i frame con CRC errato si scartano. Il recupero, se serve, lo fa TCP.`,
    [`No: è connectionless e non affidabile (niente ACK, i frame errati si scartano)`,
      [`Sì: fa un handshake e ritrasmette i frame persi`, `Ethernet non fa handshake e non ritrasmette: se un frame si perde, ci pensa un livello superiore (TCP).`],
      [`È connectionless ma affidabile: il ricevente manda un ACK per ogni frame`, `L'ACK per ogni frame c'è in 802.11 (wireless), non in Ethernet.`],
      [`È orientato alla connessione ma non affidabile`, `Ethernet non apre connessioni: ogni frame viaggia da solo.`]]);
  Q('l-type', 'link', 1,
    `A cosa serve il campo tipo (2 byte) del frame Ethernet?`,
    `Il ricevente, tolto il frame, a chi passa i dati?`,
    `Il tipo dice a quale protocollo di livello superiore consegnare il contenuto (per esempio IP o ARP): è il demultiplexing del livello di collegamento.`,
    [`Indica il protocollo di livello superiore a cui consegnare i dati (es. IP, ARP)`,
      [`Indica la lunghezza del CRC`, `Il CRC ha lunghezza fissa; il tipo identifica il protocollo trasportato.`],
      [`Indica il tipo di cavo`, `Il mezzo fisico non è scritto nel frame.`],
      [`Contiene il numero della VLAN`, `Il VLAN ID sta nel tag 802.1Q da 4 byte, aggiunto solo sui trunk.`]]);
  Q('l-switch-learn', 'link', 2,
    `Come costruisce lo switch la propria tabella?`,
    `Quale indirizzo del frame dice dove si trova chi l'ha mandato?`,
    `Self-learning: per ogni frame ricevuto lo switch memorizza MAC sorgente → porta di arrivo (con un tempo di scadenza). Non serve configurarlo: è plug-and-play.`,
    [`Da solo: per ogni frame memorizza MAC sorgente → porta di arrivo`,
      [`Dal MAC di destinazione dei frame`, `La destinazione non dice dove sta nessuno: si impara dalla sorgente, perché il mittente è certamente dietro la porta da cui arriva il frame.`],
      [`La configura a mano l'amministratore`, `Lo switch è plug-and-play: impara da solo.`],
      [`Con un protocollo di routing come OSPF`, `I protocolli di routing riempiono le tabelle dei router (livello 3), non quelle degli switch.`]]);
  Q('l-switch-unknown', 'link', 2,
    `Uno switch riceve un frame con un MAC di destinazione che non è nella sua tabella. Cosa fa?`,
    `Lo switch non sa dove sia il destinatario, ma non vuole perderlo.`,
    `Fa flooding: inoltra il frame su tutte le porte tranne quella di arrivo (solo quelle della stessa VLAN, più i trunk). Quando il destinatario risponderà, lo switch imparerà dove si trova.`,
    [`Lo inoltra su tutte le porte tranne quella di arrivo (flooding)`,
      [`Lo scarta`, `Scarta il router quando non ha una rotta. Lo switch invece inonda.`],
      [`Manda una ARP request per trovarlo`, `ARP la fanno host e router per tradurre IP in MAC; lo switch è trasparente e non manda richieste.`],
      [`Lo rimanda indietro sulla porta di arrivo`, `La porta di arrivo è l'unica su cui NON lo manda: il mittente sta lì.`]]);
  Q('l-switch-transp', 'link', 3,
    `Perché si dice che lo switch è "trasparente" agli host?`,
    `A quale MAC un host indirizza i propri frame?`,
    `Gli host non sanno che lo switch esiste: indirizzano i frame al MAC del destinatario (o del gateway), mai a quello dello switch, e lo switch li inoltra senza cambiare gli indirizzi.`,
    [`Gli host non sanno che c'è: indirizzano i frame al destinatario e lo switch non cambia gli indirizzi`,
      [`Perché fa passare il traffico tra VLAN diverse`, `Lo switch isola le VLAN: per passare da una all'altra serve un router.`],
      [`Perché ogni host lo configura come default gateway`, `Il default gateway è il router, configurato con il suo IP.`],
      [`Perché inoltra anche i frame con il CRC sbagliato`, `I frame corrotti si scartano; "trasparente" riguarda gli indirizzi, non gli errori.`]]);
  Q('l-hub', 'link', 3,
    `Qual è la differenza tra un hub e uno switch?`,
    `Uno dei due non legge nemmeno gli indirizzi.`,
    `L'hub lavora a livello fisico: ripete i bit su tutte le porte, quindi tutte le porte condividono lo stesso canale e possono collidere. Lo switch legge il MAC e inoltra il frame solo sulla porta giusta.`,
    [`L'hub ripete i bit su tutte le porte; lo switch inoltra il frame solo sulla porta del destinatario`,
      [`L'hub impara i MAC, lo switch ripete su tutte le porte`, `Sono invertiti: è lo switch che impara i MAC.`],
      [`L'hub lavora a livello 3 e instrada per IP`, `L'hub è un apparato di livello 1: non legge né MAC né IP.`],
      [`Nessuna: sono due nomi dello stesso apparato`, `Sono diversi: l'hub ripete i bit a tutti, lo switch filtra per MAC.`]]);
  Q('l-router-frame', 'link', 2,
    `Un datagramma attraversa un router (senza NAT). Cosa cambia?`,
    `Il frame vale per un solo link; il datagramma per tutto il percorso.`,
    `Il router toglie il frame, decide l'uscita con l'IP di destinazione e crea un frame nuovo: MAC sorgente = sua interfaccia di uscita, MAC destinazione = prossimo nodo. Gli IP di sorgente e destinazione restano uguali.`,
    [`Il frame è nuovo (MAC sorgente e destinazione cambiano), gli IP restano uguali`,
      [`Cambiano gli IP, restano i MAC`, `È il contrario: gli IP valgono da un capo all'altro, i MAC solo sul singolo link.`],
      [`Non cambia nulla`, `Questo è lo switch. Il router rifà il frame a ogni salto.`],
      [`Cambiano sia gli IP sia i MAC`, `Senza NAT gli IP non si toccano: il destinatario deve sapere chi ha scritto.`]]);
  Q('l-vlan-tag', 'link', 3,
    `Quanto è lungo il tag 802.1Q e cosa contiene?`,
    `Due campi da 2 byte.`,
    `Il tag VLAN aggiunge 4 byte all'header: 2 byte di Tag Protocol Identifier (dice "frame con tag") e 2 byte di Tag Control Information, che contengono il VLAN ID.`,
    [`4 byte: identificatore del tag e informazioni di controllo con il VLAN ID`,
      [`2 byte con il MAC dello switch`, `Un MAC è di 6 byte e lo switch non mette il proprio MAC nei frame.`],
      [`4 byte con l'IP del router della VLAN`, `Nel tag non c'è nessun IP: c'è il numero della VLAN.`],
      [`6 byte: il MAC della VLAN`, `Una VLAN non ha un MAC: è un gruppo di porte identificato da un numero.`]]);
  Q('l-vlan-trunk', 'link', 3,
    `A cosa serve una porta trunk?`,
    `Due switch con le stesse VLAN: quanti cavi servono tra loro?`,
    `Un trunk trasporta su un solo link i frame di più VLAN tra switch (o verso il router); ogni frame porta il tag 802.1Q che dice a quale VLAN appartiene.`,
    [`A trasportare su un solo link i frame di più VLAN, ciascuno con il tag della sua VLAN`,
      [`A instradare i pacchetti tra VLAN diverse`, `Il trunk trasporta, non instrada: tra VLAN diverse serve un router.`],
      [`A collegare un host a tutte le VLAN insieme`, `Una porta di accesso verso un host appartiene a una sola VLAN.`],
      [`È la porta verso Internet`, `Il trunk collega switch (o switch e router); l'uscita verso Internet è compito del router.`]]);
  Q('l-vlan-router', 'link', 2,
    `Due host sono sullo stesso switch ma in VLAN diverse. Come comunicano?`,
    `Una VLAN si comporta come una LAN separata, con la sua sottorete.`,
    `Ogni VLAN è un dominio di broadcast separato e di solito una sottorete diversa: lo switch non inoltra frame da una VLAN all'altra. Serve un router (o un'interfaccia di livello 3) che faccia da gateway.`,
    [`Solo passando da un router`,
      [`Direttamente: sono sullo stesso switch fisico`, `Lo switch con le VLAN si comporta come più switch separati: non inoltra tra VLAN.`],
      [`Direttamente, se prima fanno una ARP request`, `La request ARP è un broadcast e resta nella VLAN di chi la manda.`],
      [`Non possono comunicare in nessun modo`, `Possono, passando dal router: è proprio il motivo per cui il router ha un'interfaccia per ogni VLAN.`]]);
  Q('l-vlan-bcast', 'link', 4,
    `Un host della VLAN 10 manda una ARP request. Su quali porte la inoltra lo switch?`,
    `Il broadcast resta dentro la propria VLAN, ma deve poter raggiungere anche gli altri switch.`,
    `Il broadcast va su tutte le porte della VLAN 10 tranne quella di arrivo, e sui trunk (con il tag 10), così raggiunge la VLAN 10 anche sugli altri switch.`,
    [`Su tutte le porte della VLAN 10 e sui trunk, tranne quella di arrivo`,
      [`Su tutte le porte dello switch`, `Senza VLAN sarebbe così; con le VLAN il broadcast resta nella VLAN di provenienza.`],
      [`Solo sulla porta del router`, `La request ARP è per un host della LAN: deve raggiungere tutti gli host della VLAN.`],
      [`Su nessuna: nelle VLAN il broadcast è vietato`, `Il broadcast c'è: la VLAN ne limita solo l'estensione.`]]);
  Q('l-mpls', 'link', 3,
    `Come inoltra i pacchetti un router intermedio MPLS (LSR)?`,
    `MPLS esiste proprio per non dover fare il longest prefix match a ogni salto.`,
    `L'LSR guarda solo l'etichetta (label) e la usa come indice nella propria tabella: interfaccia di uscita ed eventuale nuova etichetta. Non legge l'IP.`,
    [`In base all'etichetta (label), senza leggere l'IP`,
      [`Con il longest prefix match sull'IP di destinazione`, `Questo è l'inoltro IP normale; in MPLS l'IP lo guarda solo il router di bordo.`],
      [`In base al MAC di destinazione`, `Il MAC serve sul singolo link; il percorso MPLS lo decide l'etichetta.`],
      [`Togliendo l'etichetta e leggendo l'IP per sceglierne una nuova`, `Leggere l'IP lo fa solo il LER ai bordi della rete MPLS.`]]);
  Q('l-mpls-ler', 'link', 4,
    `In una rete MPLS chi mette e chi toglie l'etichetta?`,
    `Edge = bordo.`,
    `Il LER (Label Edge Router) all'ingresso esamina l'IP e assegna l'etichetta del percorso; il LER all'uscita la toglie e il pacchetto prosegue come normale pacchetto IP.`,
    [`I router di bordo (LER): uno la mette all'ingresso, l'altro la toglie all'uscita`,
      [`L'host mittente, quando crea il datagramma`, `Gli host non sanno nulla di MPLS: l'etichetta è aggiunta ai bordi della rete MPLS.`],
      [`Ogni LSR la toglie e la rimette uguale`, `Gli LSR si limitano a leggere l'etichetta (ed eventualmente sostituirla) per inoltrare.`],
      [`Il server DNS`, `Il DNS non ha nessun ruolo nell'inoltro.`]]);
  Q('l-host-logic', 'link', 3,
    `Un host deve inviare a un certo IP. Come decide se è nella propria LAN?`,
    `Bastano i dati di configurazione dell'host.`,
    `Confronta la parte di rete dei due indirizzi (IP AND subnet mask) usando IP e maschera configurati. Se coincide, il frame va al destinatario; altrimenti al default gateway. Solo dopo cerca il MAC (tabella ARP o richiesta ARP).`,
    [`Confronta la parte di rete (IP AND maschera) del proprio IP e di quello di destinazione`,
      [`Manda una ARP request: se qualcuno risponde, è nella LAN`, `Prima si decide a chi mandare il frame (destinatario o gateway), poi si fa ARP verso quell'IP.`],
      [`Chiede al server DNS`, `Il DNS traduce nomi in IP: non sa nulla della tua LAN.`],
      [`Guarda la tabella dello switch`, `L'host non vede la tabella dello switch: lo switch è trasparente.`]]);
  Q('l-router-drop', 'link', 3,
    `Un router riceve un datagramma per una rete che non compare nella sua tabella di routing (e non c'è una rotta di default). Cosa fa?`,
    `Il router non fa flooding come lo switch.`,
    `Se l'IP di destinazione non è in nessuna rete della tabella, il router scarta il datagramma (e può avvisare il mittente con ICMP "destinazione irraggiungibile").`,
    [`Lo scarta (e può mandare un ICMP di destinazione irraggiungibile)`,
      [`Lo inoltra su tutte le interfacce`, `Il flooding è un comportamento dello switch. Il router senza rotta scarta.`],
      [`Fa una ARP request per l'IP di destinazione`, `ARP si usa solo per le reti direttamente connesse; qui il router non sa nemmeno da che parte andare.`],
      [`Lo rimanda al mittente`, `Il router non rimanda indietro il datagramma; al massimo manda un messaggio ICMP.`]]);
  Q('l-router-arp', 'link', 4,
    `Il router deve consegnare un datagramma a un host di una rete direttamente connessa, ma non ha il suo MAC. Cosa fa?`,
    `Sull'ultimo salto il router si comporta come un host.`,
    `Per l'ultimo salto il router usa la stessa logica di un host: ARP request in broadcast su quell'interfaccia, attende la reply, aggiorna la tabella ARP e trasmette il frame. Senza reply non può consegnare.`,
    [`Come un host: ARP request in broadcast su quell'interfaccia, poi trasmette il frame`,
      [`Usa il MAC del proprio default gateway`, `L'host è su una rete direttamente connessa: il frame va a lui, non a un altro router.`],
      [`Scarta subito il datagramma`, `Il router conosce la rete: prima prova a trovare il MAC con ARP.`],
      [`Manda il datagramma in broadcast`, `I dati non si mandano in broadcast: si chiede il MAC con ARP e poi si manda in unicast.`]]);
  Q('l-arp-noreply', 'link', 4,
    `B (192.168.1.4/24) fa ping a 192.168.2.20. La rete 192.168.2.0/24 è collegata al router, ma nessun host ha quell'IP. Cosa succede?`,
    `Segui la logica: B decide, poi il router decide.`,
    `L'IP è fuori dalla rete di B, quindi B manda il frame al MAC del router. Il router conosce la rete 2.0/24 (direttamente connessa) e fa una ARP request per 2.20: nessuno risponde e il datagramma non si consegna.`,
    [`B manda il frame al router; il router fa una ARP request per 2.20 che resta senza risposta`,
      [`B fa una ARP request per 192.168.2.20`, `2.20 è fuori dalla sottorete di B: B cerca il MAC del gateway, non quello del destinatario.`],
      [`Il router scarta subito perché la rete non è in tabella`, `La rete 2.0/24 è direttamente connessa, quindi è in tabella: il router prova con ARP. Scarterebbe subito una rete sconosciuta, per esempio 3.20.`],
      [`Lo switch risponde al posto dell'host mancante`, `Lo switch non risponde mai alle richieste ARP: è trasparente.`]]);
  Q('l-web-order', 'link', 3,
    `Un portatile appena collegato alla LAN apre una pagina web. In che ordine intervengono i protocolli?`,
    `Prima di tutto serve un indirizzo; per uscire dalla LAN serve il MAC del gateway.`,
    `DHCP dà IP, gateway e DNS; ARP trova il MAC del gateway per mandare fuori la query; DNS traduce il nome; TCP apre la connessione (handshake); infine HTTP chiede la pagina.`,
    [`DHCP → ARP → DNS → TCP → HTTP`,
      [`ARP → DHCP → DNS → TCP → HTTP`, `Senza DHCP l'host non conosce l'IP del gateway: non saprebbe per quale IP fare ARP.`],
      [`DHCP → DNS → ARP → HTTP → TCP`, `HTTP viaggia dentro TCP: la connessione va aperta prima della richiesta. E la query DNS esce dalla LAN, quindi serve prima il MAC del gateway.`],
      [`DNS → DHCP → ARP → TCP → HTTP`, `Senza un IP (DHCP) e l'IP del server DNS non si può fare nessuna query DNS.`]]);
  Q('l-web-dhcp', 'link', 3,
    `Cosa riceve il client nel DHCP ACK, nel cammino di una richiesta web?`,
    `Tutto quello che serve per uscire dalla LAN e risolvere un nome.`,
    `Il DHCP ACK porta l'IP del client (con la maschera), l'IP del router di primo salto (gateway) e l'IP del server DNS. Il MAC del gateway lo trova poi con ARP.`,
    [`Il proprio IP, l'IP del router di primo salto e l'IP del server DNS`,
      [`Il MAC del router di primo salto`, `Il MAC del gateway si ottiene dopo, con ARP.`],
      [`L'IP del sito web`, `L'IP del sito lo dà il DNS, dopo.`],
      [`Solo il proprio IP`, `Senza gateway e DNS l'host non potrebbe uscire dalla LAN né risolvere nomi.`]]);

  // ===== Accesso multiplo e rilevazione degli errori =====
  Q('m-cat', 'mac', 1,
    `Quali sono le tre famiglie di protocolli di accesso multiplo?`,
    `Il canale si può dividere, si può usare a caso o a turno.`,
    `Suddivisione del canale (TDMA, FDMA), accesso casuale (ALOHA, CSMA) e a rotazione (polling, token passing).`,
    [`Suddivisione del canale, accesso casuale, a rotazione`,
      [`Unicast, multicast, broadcast`, `Questi sono tipi di destinazione, non modi di accedere al canale.`],
      [`TCP, UDP, IP`, `Sono protocolli di trasporto e di rete, non di accesso al canale.`],
      [`Statici, dinamici, ibridi`, `È una classificazione del routing, non dell'accesso multiplo.`]]);
  Q('m-tdma', 'mac', 1,
    `In TDMA, cosa succede allo slot di un nodo che non ha nulla da trasmettere?`,
    `Lo slot appartiene a quel nodo.`,
    `In TDMA ogni nodo ha il suo slot fisso nel turno: se non lo usa resta vuoto. Niente collisioni, ma spreco di banda quando pochi nodi trasmettono.`,
    [`Resta vuoto: nessun altro può usarlo`,
      [`Lo usa il nodo successivo`, `Gli slot sono assegnati in modo fisso: nessuno può prendere quello di un altro.`],
      [`Viene dato al nodo con più traffico`, `Questo sarebbe un protocollo a turni dinamico; TDMA è statico.`],
      [`Il turno si accorcia`, `Il turno ha lunghezza fissa: è il limite di TDMA.`]]);
  Q('m-fdma', 'mac', 1,
    `FDMA divide il canale in:`,
    `F = frequency.`,
    `FDMA (Frequency Division) assegna a ogni nodo una banda di frequenza: anche qui, se il nodo tace, la sua banda resta inutilizzata.`,
    [`Bande di frequenza, una per nodo`,
      [`Slot di tempo, uno per nodo`, `Questo è TDMA (Time Division).`],
      [`Codici ortogonali, uno per nodo`, `Questo è CDMA (Code Division).`],
      [`Turni assegnati da un token`, `Questo è il token passing, un protocollo a rotazione.`]]);
  Q('m-aloha-eff', 'mac', 2,
    `Con molti nodi, qual è l'efficienza massima di slotted ALOHA e di pure ALOHA?`,
    `1/e ≈ 0,37 e la sua metà.`,
    `Slotted ALOHA: 1/e ≈ 0,37 (37% degli slot utili). Pure ALOHA: 1/(2e) ≈ 0,18, la metà, perché senza slot la finestra di vulnerabilità raddoppia.`,
    [`0,37 per slotted e 0,18 per pure`,
      [`0,18 per slotted e 0,37 per pure`, `Sono invertiti: gli slot riducono le collisioni, quindi lo slotted è il migliore.`],
      [`1 per slotted e 0,5 per pure`, `Con le collisioni l'efficienza non arriva mai a 1.`],
      [`0,5 per slotted e 0,25 per pure`, `Il massimo è 1/e ≈ 0,37, non 0,5.`]]);
  Q('m-pure-why', 'mac', 3,
    `Perché pure ALOHA rende la metà di slotted ALOHA?`,
    `Con chi può collidere un frame se si può trasmettere in qualunque istante?`,
    `Senza slot un frame collide con chi inizia nel tempo di un frame prima o dopo di lui: la finestra di vulnerabilità è doppia, e l'efficienza si dimezza (da 1/e a 1/(2e)).`,
    [`Senza slot un frame può collidere con chi inizia poco prima o poco dopo: la finestra di vulnerabilità raddoppia`,
      [`Perché usa frame lunghi il doppio`, `I frame hanno la stessa lunghezza; cambia il momento in cui possono partire.`],
      [`Perché ritrasmette sempre due volte`, `Si ritrasmette solo dopo una collisione, con una certa probabilità.`],
      [`Perché non usa il CRC`, `Il CRC rileva errori, non c'entra con le collisioni.`]]);
  Q('m-slotted-sync', 'mac', 2,
    `Cosa richiede slotted ALOHA che pure ALOHA non richiede?`,
    `Tutti devono sapere quando inizia uno slot.`,
    `Slotted ALOHA trasmette solo all'inizio di uno slot: i nodi devono essere sincronizzati. È il prezzo da pagare per dimezzare le collisioni.`,
    [`La sincronizzazione dei nodi sull'inizio degli slot`,
      [`Un nodo master che assegna i turni`, `ALOHA è completamente decentralizzato: il master c'è nel polling.`],
      [`L'ascolto del canale prima di trasmettere`, `Il carrier sense è di CSMA: ALOHA non ascolta.`],
      [`Un token che gira tra i nodi`, `Il token è del token passing.`]]);
  Q('m-csma-coll', 'mac', 2,
    `Con CSMA (ascolto prima di trasmettere) le collisioni possono ancora capitare?`,
    `Il segnale impiega del tempo per arrivare.`,
    `Sì: per il ritardo di propagazione un nodo può sentire il canale libero mentre la trasmissione di un altro non gli è ancora arrivata. Più è lungo il ritardo, più è probabile.`,
    [`Sì, per il ritardo di propagazione del segnale`,
      [`No, l'ascolto del canale le elimina`, `L'ascolto le riduce ma non le elimina: un nodo non sente subito chi ha appena iniziato a trasmettere lontano.`],
      [`Solo se i nodi sono più di dieci`, `Ne bastano due che partono quasi insieme.`],
      [`Solo nelle reti wireless`, `Capitano anche su un cavo condiviso: è il motivo di CSMA/CD.`]]);
  Q('m-cd', 'mac', 2,
    `Cosa fa un nodo CSMA/CD quando rileva una collisione?`,
    `CD = collision detection: la collisione si scopre mentre si trasmette.`,
    `Interrompe subito la trasmissione (non spreca il canale), manda un segnale di jam perché tutti se ne accorgano e attende un backoff esponenziale binario prima di riprovare.`,
    [`Interrompe, invia un segnale di jam e attende un backoff esponenziale binario`,
      [`Completa il frame e aspetta l'ACK`, `Completare un frame già corrotto spreca il canale; e Ethernet non usa ACK.`],
      [`Ritrasmette subito`, `Se tutti ritrasmettono subito, ricollidono: serve un'attesa casuale.`],
      [`Manda un RTS al destinatario`, `RTS/CTS è un'opzione di 802.11 (CSMA/CA), non di CSMA/CD.`]]);
  Q('m-backoff', 'mac', 3,
    `Dopo la 3ª collisione consecutiva dello stesso frame, CSMA/CD sceglie K in quale insieme?`,
    `Dopo n collisioni: da 0 a 2^n − 1.`,
    `Backoff esponenziale binario: dopo n collisioni si sceglie K a caso in {0, 1, …, 2^n − 1} e si aspetta K·512 tempi di bit. Con n = 3: {0, …, 7}.`,
    [`{0, 1, …, 7}`,
      [`{0, 1, 2, 3}`, `Questo è l'intervallo dopo la 2ª collisione (2² − 1 = 3).`],
      [`{0, 1, …, 8}`, `Il massimo è 2³ − 1 = 7, non 2³.`],
      [`Sempre {0, 1}`, `L'intervallo raddoppia a ogni collisione: {0, 1} vale solo dopo la prima.`]]);
  Q('m-backoff-why', 'mac', 3,
    `Perché in CSMA/CD l'intervallo di backoff raddoppia a ogni collisione?`,
    `Tante collisioni di fila dicono qualcosa sul carico.`,
    `Più collisioni = probabilmente più nodi in gara. Allargando l'intervallo, la probabilità che due nodi scelgano lo stesso K diminuisce; con poco carico invece l'attesa resta breve.`,
    [`Più collisioni indicano più nodi: un intervallo più ampio rende meno probabile scegliere lo stesso K`,
      [`Per dare la precedenza al nodo che ha colliso di più`, `È il contrario: chi ha colliso di più tende ad aspettare di più.`],
      [`Per risparmiare energia`, `Lo scopo è ridurre le collisioni, non il consumo.`],
      [`Per sincronizzare gli slot`, `CSMA/CD non ha slot da sincronizzare.`]]);
  Q('m-cd-eff', 'mac', 4,
    `L'efficienza di CSMA/CD è 1 / (1 + 5·tprop/ttrans). Quando si avvicina a 1?`,
    `Guarda la frazione tprop/ttrans: quando va a 0?`,
    `Quando tprop → 0 (nodi vicini) o ttrans → ∞ (frame lunghi): le collisioni si scoprono subito e occupano una parte trascurabile del tempo.`,
    [`Quando tprop tende a 0 o ttrans tende all'infinito`,
      [`Quando ttrans tende a 0`, `Con frame cortissimi il tempo perso nelle collisioni pesa di più: l'efficienza scende.`],
      [`Quando tprop cresce`, `Più ritardo di propagazione significa collisioni scoperte più tardi: efficienza peggiore.`],
      [`Mai: il massimo è 0,37 come slotted ALOHA`, `CSMA/CD è molto meglio di ALOHA e può avvicinarsi a 1.`]]);
  Q('m-polling', 'mac', 2,
    `Quali sono i difetti del polling?`,
    `C'è un nodo speciale che interroga gli altri.`,
    `Il master interroga i nodi uno alla volta: c'è overhead per i messaggi di polling, latenza, e se il master si guasta si ferma tutta la rete. In compenso non ci sono collisioni.`,
    [`Overhead dei messaggi di polling, latenza e un solo punto di guasto (il master)`,
      [`Collisioni frequenti`, `Nel polling trasmette solo il nodo interrogato: niente collisioni.`],
      [`Serve sincronizzare gli slot`, `La sincronizzazione degli slot è un requisito di slotted ALOHA e TDMA.`],
      [`Spreca bande di frequenza fisse`, `Questo è il limite di FDMA.`]]);
  Q('m-token', 'mac', 2,
    `Nel token passing, chi può trasmettere?`,
    `Il token è un "permesso" che gira.`,
    `Trasmette solo il nodo che ha il token; finito (o se non ha nulla), lo passa al successivo. Difetti: overhead del token e guasto se il token si perde o il nodo che lo tiene si blocca.`,
    [`Solo il nodo che possiede il token, che poi lo passa al successivo`,
      [`Chiunque senta il canale libero`, `Questo è CSMA, un accesso casuale.`],
      [`Il nodo scelto dal master`, `Questo è il polling.`],
      [`Tutti insieme, con codici diversi`, `Questo è CDMA.`]]);
  Q('m-parity', 'mac', 2,
    `Cosa rileva un singolo bit di parità?`,
    `Se due bit si invertono, cambia il numero di 1 dispari/pari?`,
    `Il bit di parità rileva un numero dispari di bit errati. Due errori nello stesso blocco si compensano e passano inosservati.`,
    [`Un numero dispari di bit errati (non due errori nello stesso blocco)`,
      [`Qualunque errore`, `Con due bit invertiti la parità torna giusta: l'errore non si vede.`],
      [`Due errori, e li corregge`, `La parità singola non corregge e non vede i doppi errori.`],
      [`Solo gli errori sull'ultimo bit`, `Rileva un errore su qualunque bit, purché il numero di errori sia dispari.`]]);
  Q('m-parity2d', 'mac', 3,
    `Cosa aggiunge la parità bidimensionale rispetto alla parità singola?`,
    `Una riga e una colonna sbagliate si incrociano in un punto.`,
    `Con un bit di parità per ogni riga e per ogni colonna, un errore singolo fa fallire una riga e una colonna: il loro incrocio individua il bit, che quindi si può correggere.`,
    [`Individua riga e colonna del bit errato, quindi corregge un errore singolo`,
      [`Rileva qualunque numero di errori`, `Anche in due dimensioni alcuni schemi di errori (quattro bit "a rettangolo") passano inosservati.`],
      [`Elimina il bisogno di controllare in ricezione`, `Il controllo lo fa sempre il ricevente.`],
      [`Usa meno bit di ridondanza`, `Ne usa di più: uno per riga e uno per colonna.`]]);
  Q('m-crc', 'mac', 3,
    `Come controlla il CRC il ricevente?`,
    `Mittente e ricevente hanno concordato un generatore G.`,
    `Il mittente sceglie i bit R in modo che <D,R> sia divisibile per G (in aritmetica modulo 2). Il ricevente divide <D,R> per G: resto diverso da 0 = errore.`,
    [`Divide <D,R> per il generatore G in modulo 2: resto diverso da 0 significa errore`,
      [`Conta i bit a 1 di ogni riga`, `Questo è il controllo di parità.`],
      [`Somma le parole a 16 bit in complemento a 1`, `Questo è il checksum di Internet (UDP, TCP, IP).`],
      [`Confronta un hash MD5`, `MD5 è un hash crittografico, usato per l'integrità contro le modifiche volute, non per gli errori di trasmissione.`]]);
  Q('m-crc-burst', 'mac', 4,
    `Con un generatore G di r+1 bit, quali errori rileva sicuramente il CRC?`,
    `Il CRC è forte sugli errori consecutivi.`,
    `Il CRC con r bit di controllo rileva tutti i burst (errori consecutivi) lunghi meno di r+1 bit, oltre a molti altri errori con alta probabilità.`,
    [`Tutti i burst di errori lunghi meno di r+1 bit`,
      [`Tutti gli errori possibili`, `Nessun codice rileva tutti gli errori: si può solo ridurre la probabilità che uno sfugga.`],
      [`Solo gli errori su un singolo bit`, `Il CRC è molto più potente della parità: rileva anche i burst.`],
      [`Tutti i burst fino a 2r bit`, `La garanzia vale per burst più corti di r+1 bit.`]]);
  Q('m-ethernet', 'mac', 2,
    `Quale protocollo di accesso usava Ethernet su bus o con hub?`,
    `Su un cavo un nodo può ascoltare mentre trasmette.`,
    `Ethernet usava CSMA/CD con backoff esponenziale binario. Con gli switch full-duplex ogni link è dedicato e le collisioni spariscono.`,
    [`CSMA/CD con backoff esponenziale binario`,
      [`CSMA/CA con RTS/CTS`, `Questo è 802.11 (wireless).`],
      [`Token passing`, `Il token passing era di altre LAN (Token Ring), non di Ethernet.`],
      [`TDMA a slot fissi`, `Ethernet è ad accesso casuale, senza slot assegnati.`]]);
  Q('m-ideal', 'mac', 3,
    `Cosa farebbe il protocollo di accesso multiplo ideale su un canale broadcast a R bit/s?`,
    `Pensa sia al caso con un solo nodo attivo sia a quello con M nodi.`,
    `Un nodo da solo trasmette a R; con M nodi attivi ognuno ha in media R/M; tutto decentralizzato, senza nodi speciali né sincronizzazione.`,
    [`Un nodo da solo usa tutto R, con M nodi attivi ognuno ha in media R/M, senza coordinatore`,
      [`Ogni nodo ha sempre R/M, anche se è l'unico attivo`, `Questo è il comportamento di TDMA/FDMA, che spreca il canale quando pochi trasmettono.`],
      [`Ogni nodo ha sempre R anche se trasmettono tutti`, `Il canale è uno solo: con M nodi attivi va diviso.`],
      [`Un nodo master assegna la banda`, `L'ideale è decentralizzato: un master è un punto di guasto.`]]);
  Q('m-no-cd-wifi', 'mac', 4,
    `Perché in una rete wireless non si usa CSMA/CD?`,
    `Riusciresti a sentire un sussurro lontano mentre gridi?`,
    `Mentre trasmette, il nodo riceve il proprio segnale fortissimo e non sente quello debole degli altri; inoltre con il terminale nascosto la collisione avviene al ricevente, non al mittente. Quindi le collisioni si evitano (CSMA/CA) invece di rilevarle.`,
    [`Il nodo non riesce a rilevare la collisione mentre trasmette, e c'è il terminale nascosto`,
      [`Perché le onde radio non collidono`, `Collidono eccome: due segnali sovrapposti al ricevente sono illeggibili.`],
      [`Perché in wireless il canale non è condiviso`, `Il canale radio è condiviso per natura: tutti trasmettono nello stesso spazio.`],
      [`Perché il segnale di jam disturberebbe gli AP vicini`, `Il problema è a monte: la collisione non si riesce proprio a sentire.`]]);

  // ===== Routing =====
  Q('r-ls-global', 'routing', 1,
    `Quale famiglia di algoritmi di routing richiede che ogni router conosca tutta la topologia?`,
    `Uno dei due "inonda" la rete con lo stato dei link.`,
    `Link state: ogni router riceve lo stato di tutti i link, conosce il grafo completo e calcola i cammini minimi con Dijkstra (OSPF). Il distance vector lavora invece con informazioni locali.`,
    [`Link state (Dijkstra)`,
      [`Distance vector (Bellman-Ford)`, `Nel distance vector ogni router conosce solo i vicini e i loro vettori.`],
      [`Hot potato`, `L'hot potato è un criterio di BGP per scegliere il gateway di uscita.`],
      [`Self-learning`, `Il self-learning è il modo in cui lo switch impara i MAC.`]]);
  Q('r-dv-props', 'routing', 2,
    `Il distance vector è un algoritmo:`,
    `Ogni nodo ricalcola per conto suo quando qualcosa cambia.`,
    `Iterativo (si ripete finché nessuna stima cambia), asincrono (i nodi non vanno al passo) e distribuito (ogni nodo calcola con le informazioni dei vicini e le ridistribuisce).`,
    [`Iterativo, asincrono e distribuito`,
      [`Centralizzato e sincrono`, `Non c'è nessun nodo centrale e i nodi non procedono al passo.`],
      [`Globale: ogni nodo conosce tutto il grafo`, `Questo è il link state.`],
      [`Eseguito una sola volta all'avvio`, `Si ripete a ogni cambiamento di un vicino o del costo di un link.`]]);
  Q('r-bf', 'routing', 2,
    `L'equazione di Bellman-Ford: dx(y) = ?`,
    `Per ogni vicino: quanto costa arrivarci + quanto dice lui.`,
    `dx(y) = min su v vicini di { c(x,v) + dv(y) }: per ogni vicino v si somma il costo del link verso v e la distanza annunciata da v, e si prende il minimo.`,
    [`min sui vicini v di { c(x,v) + dv(y) }`,
      [`max sui vicini v di { c(x,v) + dv(y) }`, `Si cerca il cammino più corto: minimo, non massimo.`],
      [`c(x,y)`, `Il link diretto (se c'è) è solo una delle possibilità: un cammino attraverso un vicino può costare meno.`],
      [`min sui vicini v di dv(y)`, `Manca il costo del link per arrivare al vicino: senza, ogni vicino sembra gratis.`]]);
  Q('r-dv-calc', 'routing', 3,
    `X ha due vicini: A (link di costo 2) e B (link di costo 5). A annuncia dA(Z) = 6, B annuncia dB(Z) = 1. Quanto vale dX(Z)?`,
    `Calcola c(X,v) + dv(Z) per ogni vicino.`,
    `Via A: 2 + 6 = 8. Via B: 5 + 1 = 6. Il minimo è 6, con next-hop B.`,
    [`6, via B`,
      [`8, via A`, `A è il vicino più vicino, ma conta il totale: 2 + 6 = 8 > 5 + 1 = 6.`],
      [`1, via B`, `1 è la distanza annunciata da B: va aggiunto il costo del link X-B (5).`],
      [`2, via A`, `2 è solo il costo del link X-A, non la distanza fino a Z.`]]);
  Q('r-dv-when', 'routing', 2,
    `Quando un nodo distance vector invia il proprio vettore ai vicini?`,
    `I vicini hanno bisogno di saperlo solo se c'è una novità.`,
    `Quando il suo vettore cambia (per il vettore nuovo di un vicino o per un costo di link cambiato): rileva, ricalcola, e se cambia avvisa i vicini. RIP in più lo manda anche periodicamente (ogni 30 s).`,
    [`Quando il suo vettore cambia (e in RIP anche periodicamente)`,
      [`Solo all'avvio`, `Le stime cambiano nel tempo: i vicini vanno aggiornati.`],
      [`A tutti i router della rete, in flooding`, `Il flooding a tutti è del link state; il DV parla solo con i vicini.`],
      [`Solo quando un vicino lo chiede`, `L'aggiornamento parte da chi ha una novità, senza richiesta.`]]);
  Q('r-cti', 'routing', 3,
    `Che cos'è il count-to-infinity?`,
    `Succede nel distance vector quando un costo aumenta.`,
    `Dopo un aumento di costo (o un guasto) due nodi si basano ciascuno sulla stima vecchia dell'altro: si scambiano vettori che crescono a piccoli passi per molte iterazioni, con un ciclo nel frattempo. Le cattive notizie viaggiano lente.`,
    [`Dopo un aumento di costo i nodi si rimandano stime vecchie e la distanza cresce lentamente per molte iterazioni`,
      [`Un ciclo infinito dell'algoritmo di Dijkstra`, `Dijkstra (link state) termina sempre; il problema è del distance vector.`],
      [`Il TTL di un datagramma che arriva a 0`, `Il TTL scade per i cicli, ma il count-to-infinity è il modo lento in cui convergono le stime DV.`],
      [`Un attacco di tipo DoS`, `Non è un attacco: è un difetto di convergenza dell'algoritmo.`]]);
  Q('r-cti-num', 'routing', 5,
    `Costi: X–Y = 4, Y–Z = 1, X–Z = 50, quindi dY(X) = 4 e dZ(X) = 5 (via Y). Il link X–Y sale a 60. Senza poisoned reverse, quale nuova stima calcola Y per X?`,
    `Y non sa che la stima di Z passa proprio da Y.`,
    `Y calcola min{ 60 + 0 ; 1 + dZ(X) } = min{60 ; 1 + 5} = 6, via Z. Ma dZ(X) = 5 passava da Y: si crea un ciclo e le stime salgono di poco a ogni scambio (count-to-infinity) fino a superare 50.`,
    [`6, via Z (1 + 5)`,
      [`60, con il link diretto`, `Y crede ancora alla stima di Z (5), che sembra più conveniente: 1 + 5 = 6 < 60.`],
      [`51, via Z (1 + 50)`, `Z non ha annunciato 50: ha annunciato 5, la sua stima vecchia via Y.`],
      [`Infinito`, `L'infinito lo annuncia il poisoned reverse; qui non c'è.`]]);
  Q('r-poison', 'routing', 3,
    `Poisoned reverse: Z raggiunge X passando per Y. Cosa annuncia Z a Y come distanza verso X?`,
    `Z vuole impedire che Y torni indietro attraverso Z.`,
    `Z annuncia a Y dZ(X) = ∞: così Y non userà mai Z per tornare verso X, e il ciclo a due nodi non si forma.`,
    [`Infinito`,
      [`Il suo costo reale`, `Annunciando il costo reale, Y potrebbe usare Z per X dopo un guasto, creando un ciclo.`],
      [`Niente: Z non annuncia X a Y`, `Il poisoned reverse annuncia esplicitamente ∞.`],
      [`Zero`, `Zero farebbe credere a Y che Z sia X stesso.`]]);
  Q('r-poison-limit', 'routing', 5,
    `Il poisoned reverse risolve sempre il count-to-infinity?`,
    `Il "veleno" è mandato solo al vicino da cui si passa.`,
    `No: evita i cicli tra due vicini, ma con cicli di tre o più nodi il problema può restare.`,
    [`No: evita i cicli tra due vicini, non quelli con tre o più nodi`,
      [`Sì, sempre`, `Con cicli più lunghi di due nodi il veleno non basta.`],
      [`Sì, ma solo con OSPF`, `OSPF è link state e non ha il count-to-infinity.`],
      [`Non serve: il distance vector non ha questo problema`, `Il count-to-infinity è proprio il problema tipico del distance vector.`]]);
  Q('r-good-news', 'routing', 4,
    `In un distance vector, come si propagano una diminuzione e un aumento di costo?`,
    `"Good news travels fast".`,
    `Una diminuzione si propaga in fretta: chi la riceve la adotta subito. Un aumento può richiedere molte iterazioni, perché i nodi si appoggiano a stime vecchie (count-to-infinity).`,
    [`La diminuzione in fretta, l'aumento può richiedere molte iterazioni`,
      [`La diminuzione lentamente, l'aumento in fretta`, `È il contrario: le buone notizie viaggiano veloci.`],
      [`Entrambi in una sola iterazione`, `Gli aumenti possono richiedere molte iterazioni.`],
      [`Non si propagano: ogni nodo conosce già tutto`, `Questo sarebbe il link state.`]]);
  Q('r-as', 'routing', 1,
    `Che cos'è un Autonomous System (AS)?`,
    `Una sola amministrazione.`,
    `Un AS è un insieme di reti e router sotto un unico controllo amministrativo (per esempio un ISP). Dentro usa un solo protocollo intra-AS; con gli altri AS parla tramite i router di confine.`,
    [`Un insieme di reti e router sotto un unico controllo amministrativo`,
      [`Un singolo router di confine`, `Il router di confine collega l'AS agli altri: l'AS è tutto l'insieme.`],
      [`Un'area OSPF`, `Le aree OSPF sono suddivisioni interne a un AS.`],
      [`Un indirizzo IP pubblico`, `Un AS ha molti prefissi e un suo numero identificativo, non è un indirizzo.`]]);
  Q('r-intra-inter', 'routing', 1,
    `Quale protocollo si usa per il routing tra AS diversi?`,
    `Il protocollo "di confine".`,
    `BGP (Border Gateway Protocol) è il protocollo inter-AS di Internet. RIP e OSPF sono intra-AS.`,
    [`BGP`,
      [`OSPF`, `OSPF è intra-AS (link state).`],
      [`RIP`, `RIP è intra-AS (distance vector).`],
      [`ICMP`, `ICMP riporta errori e informazioni: non calcola rotte.`]]);
  Q('r-rip', 'routing', 2,
    `Quale di queste descrizioni è RIP?`,
    `RIP conta i salti.`,
    `RIP è intra-AS, distance vector, con metrica il numero di salti (al massimo 15), vettori mandati ai vicini ogni 30 s su UDP (porta 520).`,
    [`Intra-AS, distance vector, metrica = numero di salti, aggiornamenti periodici su UDP`,
      [`Intra-AS, link state, Dijkstra, aree e backbone`, `Questo è OSPF.`],
      [`Inter-AS, path vector, sessioni TCP tra peer`, `Questo è BGP.`],
      [`Livello di collegamento, traduce IP in MAC`, `Questo è ARP.`]]);
  Q('r-ospf-steps', 'routing', 3,
    `In che ordine lavora OSPF?`,
    `Prima si conoscono i vicini, alla fine si calcola.`,
    `Messaggi Hello per scoprire i vicini → LSA per annunciare lo stato dei link → ogni router costruisce la LSDB (la topologia) → Dijkstra sulla LSDB produce l'albero dei cammini minimi.`,
    [`Hello → LSA → LSDB → Dijkstra`,
      [`LSA → Hello → Dijkstra → LSDB`, `Gli LSA si scambiano con i vicini già scoperti con Hello, e Dijkstra si applica alla LSDB già costruita.`],
      [`Hello → vettore delle distanze → Bellman-Ford`, `Questo è il distance vector: OSPF è link state.`],
      [`OPEN → UPDATE → KEEPALIVE`, `Questi sono i messaggi di BGP.`]]);
  Q('r-ospf-update', 'routing', 2,
    `Quando e a chi manda aggiornamenti OSPF?`,
    `Link state: tutti devono avere la stessa mappa.`,
    `OSPF manda gli LSA quando cambia lo stato di un link (oltre a un raro rinfresco), in flooding a tutti i router dell'area. Tutti hanno così la stessa LSDB.`,
    [`Quando cambia lo stato di un link, in flooding a tutti i router dell'area`,
      [`Ogni 30 secondi, solo ai vicini, con tutto il vettore delle distanze`, `Questo è RIP.`],
      [`Con messaggi UPDATE su una sessione TCP`, `Questo è BGP.`],
      [`Mai: la topologia si configura a mano`, `OSPF scopre e annuncia la topologia da solo.`]]);
  Q('r-ospf-area', 'routing', 3,
    `Perché OSPF si può dividere in aree?`,
    `Il link state chiede di conoscere tutta la mappa: in una rete enorme…`,
    `Per scalare: ogni router conosce nei dettagli solo la propria area; le aree comunicano attraverso la backbone (area 0) tramite i router di bordo area, che riassumono le distanze.`,
    [`Per scalare: ogni router conosce i dettagli solo della propria area, collegata alla backbone (area 0)`,
      [`Per usare RIP dentro ogni area`, `Tutte le aree usano OSPF: la gerarchia è interna al protocollo.`],
      [`Perché ogni area è un AS diverso`, `Le aree stanno tutte dentro lo stesso AS.`],
      [`Per cifrare il traffico tra le aree`, `Le aree servono a ridurre il carico di calcolo e di messaggi, non a cifrare.`]]);
  Q('r-ospf-routers', 'routing', 4,
    `Quale router OSPF scambia informazioni di routing con altri AS?`,
    `Boundary = confine dell'AS.`,
    `Il boundary router (router di confine dell'AS) parla con gli altri AS. L'area border router riassume la propria area verso la backbone; il backbone router instrada dentro la backbone.`,
    [`Il boundary router`,
      [`L'area border router`, `L'area border router collega un'area alla backbone, dentro lo stesso AS.`],
      [`Il backbone router`, `Il backbone router lavora nell'area 0, dentro l'AS.`],
      [`Qualunque router interno`, `I router interni conoscono solo la propria area.`]]);
  Q('r-bgp-tcp', 'routing', 2,
    `Su cosa viaggiano i messaggi BGP tra due peer?`,
    `BGP ha bisogno di una consegna affidabile e ordinata.`,
    `BGP usa connessioni TCP (porta 179) tra i peer: per questo è un protocollo applicativo, anche se serve al routing.`,
    [`Su TCP (porta 179)`,
      [`Su UDP (porta 520)`, `UDP 520 è RIP.`],
      [`Direttamente su IP`, `Direttamente su IP viaggiano OSPF e ICMP.`],
      [`Dentro ICMP`, `ICMP non trasporta messaggi di altri protocolli di routing.`]]);
  Q('r-bgp-msgs', 'routing', 3,
    `Quale messaggio BGP annuncia una nuova rotta (o ne ritira una)?`,
    `Aggiornare = …`,
    `UPDATE annuncia o ritira rotte. OPEN apre la sessione e autentica, KEEPALIVE la tiene viva, NOTIFICATION segnala errori e chiude.`,
    [`UPDATE`,
      [`OPEN`, `OPEN apre la sessione e autentica il mittente.`],
      [`KEEPALIVE`, `KEEPALIVE serve solo a dire "sono ancora qui" in assenza di UPDATE.`],
      [`NOTIFICATION`, `NOTIFICATION riporta errori e chiude la sessione.`]]);
  Q('r-ebgp', 'routing', 3,
    `Qual è la differenza tra eBGP e iBGP?`,
    `e = external, i = internal.`,
    `eBGP: sessioni tra router di AS diversi, per imparare le rotte dagli AS vicini. iBGP: sessioni tra router dello stesso AS, per diffondere all'interno le rotte imparate.`,
    [`eBGP tra router di AS diversi; iBGP tra router dello stesso AS per diffondere le rotte apprese`,
      [`eBGP dentro l'AS, iBGP tra AS diversi`, `Sono invertiti: e = external (tra AS), i = internal (dentro l'AS).`],
      [`eBGP è cifrato, iBGP no`, `La differenza è tra chi sono i peer, non la cifratura.`],
      [`iBGP è il nome di OSPF quando lavora con BGP`, `iBGP è BGP vero e proprio, su TCP, tra router dello stesso AS.`]]);
  Q('r-aspath', 'routing', 3,
    `A cosa serve l'attributo AS-PATH di BGP?`,
    `È una lista.`,
    `AS-PATH elenca gli AS attraversati dall'annuncio. Un AS che vede il proprio numero nel path rifiuta l'annuncio (niente cicli), e a parità di altro si preferisce il path più corto.`,
    [`Elenca gli AS attraversati: evita i cicli e permette di preferire i percorsi più corti`,
      [`Contiene l'IP del router a cui mandare il traffico`, `Questo è NEXT-HOP.`],
      [`Indica la preferenza locale della rotta`, `Questo è local preference, decisa dall'amministratore.`],
      [`Elenca i router interni attraversati`, `BGP ragiona per AS: i router interni non compaiono.`]]);
  Q('r-nexthop', 'routing', 4,
    `In BGP, cosa contiene l'attributo NEXT-HOP?`,
    `Da dove si esce per seguire quell'AS-PATH?`,
    `NEXT-HOP è l'IP dell'interfaccia del router che inizia l'AS-PATH, cioè il router (dell'AS vicino) a cui mandare il traffico. Il router interno lo raggiunge con il routing intra-AS.`,
    [`L'IP del router da cui inizia l'AS-PATH, a cui va mandato il traffico`,
      [`L'elenco degli AS da attraversare`, `Questo è AS-PATH.`],
      [`Il numero dell'AS di destinazione`, `Il numero dell'AS d'origine è l'ultimo elemento dell'AS-PATH.`],
      [`Il MAC del router successivo`, `BGP lavora con indirizzi IP; il MAC si trova poi con ARP.`]]);
  Q('r-hotpotato', 'routing', 4,
    `Hot potato routing: tra due gateway di uscita ugualmente buoni secondo BGP, quale sceglie il router?`,
    `"Patata bollente": liberarsene il prima possibile.`,
    `Sceglie il gateway (NEXT-HOP) con il costo intra-AS più basso: fa uscire il pacchetto dal proprio AS il prima possibile, senza curarsi di quanto resta dopo.`,
    [`Quello con il costo intra-AS minore per raggiungerlo`,
      [`Quello con l'AS-PATH più lungo`, `Un AS-PATH più lungo è peggiore; e l'hot potato interviene a parità di AS-PATH.`],
      [`Quello più vicino alla destinazione finale`, `È proprio il contrario: l'hot potato guarda solo il costo dentro il proprio AS.`],
      [`Uno a caso`, `La scelta è deterministica: costo intra-AS minore.`]]);
  Q('r-bgp-order', 'routing', 5,
    `Con più rotte BGP per lo stesso prefisso, in che ordine si applicano i criteri di scelta?`,
    `Prima la politica, poi la lunghezza, poi la vicinanza.`,
    `1) local preference (la politica dell'amministratore), 2) AS-PATH più corto, 3) NEXT-HOP più vicino (hot potato), 4) altri criteri.`,
    [`Local preference → AS-PATH più corto → NEXT-HOP più vicino (hot potato)`,
      [`AS-PATH più corto → local preference → hot potato`, `La politica (local preference) viene prima della lunghezza del percorso.`],
      [`Hot potato → AS-PATH più corto → local preference`, `L'hot potato è quasi l'ultimo criterio: si usa a parità degli altri.`],
      [`Si sceglie sempre l'AS-PATH più corto e basta`, `Le politiche (local preference) possono far preferire un percorso più lungo.`]]);
  Q('r-policy', 'routing', 5,
    `A, B, C sono provider; w è un cliente di A. B riceve da A la rotta A-w. B la annuncia a C?`,
    `Un provider trasporta volentieri solo il traffico dei propri clienti.`,
    `No: né A né C sono clienti di B, quindi B non vuole trasportare traffico C → A per conto d'altri. Non annunciando B-A-w a C, C userà la propria rotta C-A-w.`,
    [`No: né A né C sono suoi clienti, e B non vuole trasportare il loro traffico`,
      [`Sì: BGP annuncia sempre tutte le rotte che conosce`, `BGP è guidato dalle politiche: un AS annuncia solo ciò che gli conviene.`],
      [`Sì, perché così C ha un percorso più corto`, `C-B-A-w è più lungo di C-A-w; e comunque decide la politica di B.`],
      [`No, perché l'AS-PATH contiene già B`, `L'AS-PATH è A w: B non compare, il motivo è la politica commerciale.`]]);
  Q('r-icmp-ping', 'routing', 2,
    `Quali messaggi ICMP usa il ping?`,
    `Echo request e echo reply: uno ha tipo 8.`,
    `Il ping manda echo request (tipo 8, codice 0) e riceve echo reply (tipo 0, codice 0).`,
    [`Echo request tipo 8 codice 0 ed echo reply tipo 0 codice 0`,
      [`Echo request tipo 0 ed echo reply tipo 8`, `Sono invertiti: la richiesta è l'8, la risposta lo 0.`],
      [`Tipo 11 codice 0 e tipo 3 codice 3`, `Questi sono TTL scaduto e porta irraggiungibile: li usa traceroute.`],
      [`Tipo 3 codice 0 e tipo 3 codice 1`, `Sono "rete irraggiungibile" e "host irraggiungibile".`]]);
  Q('r-traceroute', 'routing', 3,
    `Come scopre traceroute i router del percorso?`,
    `Cosa fa un router quando il TTL arriva a 0?`,
    `Manda pacchetti con TTL = 1, 2, 3, …: il router dove il TTL arriva a 0 scarta il pacchetto e risponde con ICMP tipo 11 codice 0 (TTL scaduto), rivelando il proprio indirizzo. La destinazione risponde con porta irraggiungibile (3/3) e traceroute si ferma.`,
    [`Manda pacchetti con TTL crescente: ogni router dove il TTL scade risponde con ICMP tipo 11`,
      [`Manda un echo request a ogni router della rete`, `Traceroute non conosce i router in anticipo: li scopre facendo scadere il TTL.`],
      [`Legge le tabelle di routing dei router`, `I router non mostrano la loro tabella agli host.`],
      [`Interroga BGP`, `BGP è tra router di confine: gli host non lo usano.`]]);
  Q('r-icmp-33', 'routing', 3,
    `Un host riceve un messaggio ICMP di tipo 3, codice 3. Cosa significa?`,
    `Tipo 3 = destinazione irraggiungibile; il codice dice cosa.`,
    `Tipo 3 è la famiglia "destinazione irraggiungibile"; codice 3 = porta di destinazione irraggiungibile (nessun processo in ascolto). 3/0 rete, 3/1 host.`,
    [`Porta di destinazione irraggiungibile`,
      [`Rete di destinazione irraggiungibile`, `Questa è 3/0.`],
      [`Host di destinazione irraggiungibile`, `Questa è 3/1.`],
      [`TTL scaduto`, `Questo è il tipo 11, codice 0.`]]);
  Q('r-icmp-lvl', 'routing', 2,
    `Come viaggia un messaggio ICMP?`,
    `Non ha porte.`,
    `ICMP viaggia direttamente dentro IP (numero di protocollo 1) ed è considerato parte del livello di rete.`,
    [`Direttamente dentro IP: fa parte del livello di rete`,
      [`Su UDP`, `ICMP non ha porte: sta direttamente dentro IP.`],
      [`Su TCP`, `ICMP non apre connessioni.`],
      [`Direttamente nel frame, come ARP`, `ICMP ha bisogno di IP per arrivare a destinazione oltre i router.`]]);

  // ===== Wireless e mobilità =====
  Q('w-ap', 'wireless', 1,
    `Che ruolo ha una base station (access point)?`,
    `Sta tra il mondo radio e quello cablato.`,
    `La base station / AP collega gli host wireless alla rete cablata e coordina la trasmissione degli host associati nella sua area di copertura.`,
    [`Collega gli host wireless alla rete cablata e ne coordina la trasmissione`,
      [`È un host mobile che si sposta tra le reti`, `L'host mobile è l'utente; la base station è fissa e fa da ponte.`],
      [`Instrada il traffico tra AS diversi`, `Il routing tra AS è compito dei router BGP.`],
      [`Assegna i MAC agli host`, `I MAC sono scritti nelle schede dal costruttore.`]]);
  Q('w-adhoc', 'wireless', 1,
    `Cosa caratterizza una rete wireless ad hoc?`,
    `Ad hoc: "fatta sul momento".`,
    `In una rete ad hoc non c'è base station: gli host comunicano direttamente tra loro quando sono a portata radio (e, se multi-hop, si inoltrano i pacchetti a vicenda).`,
    [`Non c'è base station: gli host comunicano direttamente tra loro`,
      [`Gli host passano tutti da un AP collegato alla rete cablata`, `Questa è la modalità con infrastruttura.`],
      [`È una rete cablata temporanea`, `Ad hoc è una modalità wireless.`],
      [`È la rete cellulare 4G`, `La rete cellulare ha un'infrastruttura (le base station).`]]);
  Q('w-diff', 'wireless', 2,
    `Perché un link wireless ha più errori di un link cablato?`,
    `Il segnale viaggia nell'aria, tra muri e altri segnali.`,
    `Il segnale radio si attenua con la distanza e gli ostacoli, subisce interferenze da altre sorgenti e arriva per più cammini (riflessioni, multipath), che si sovrappongono.`,
    [`Attenuazione, interferenze e propagazione su più cammini (multipath)`,
      [`Perché usa frame più lunghi`, `La lunghezza dei frame non è il problema: lo è il mezzo.`],
      [`Perché gli host wireless non hanno un indirizzo MAC`, `Hanno un MAC come le schede cablate.`],
      [`Perché usa UDP invece di TCP`, `Il trasporto non c'entra: gli errori nascono nel mezzo fisico.`]]);
  Q('w-snr', 'wireless', 2,
    `Se l'SNR (rapporto segnale/rumore) aumenta, cosa fa la BER?`,
    `Più segnale rispetto al rumore = bit più facili da riconoscere.`,
    `La BER (probabilità di bit errato) diminuisce: con più SNR il segnale si distingue meglio dal rumore.`,
    [`Diminuisce`,
      [`Aumenta`, `È il contrario: più segnale rispetto al rumore, meno errori.`],
      [`Non cambia`, `SNR e BER sono legati: è il motivo della rate adaptation.`],
      [`Diventa sempre zero`, `Diminuisce, ma un po' di errori restano sempre possibili.`]]);
  Q('w-rate', 'wireless', 3,
    `Rate adaptation in 802.11: il dispositivo si allontana dall'AP e l'SNR scende. Cosa succede?`,
    `A parità di modulazione, meno SNR significa più errori.`,
    `Si passa a una modulazione più robusta e più lenta: il rate scende, ma la BER resta accettabile. Se l'SNR risale, il rate risale.`,
    [`Si abbassa la velocità di trasmissione per tenere bassa la BER`,
      [`Si alza la velocità per finire prima`, `A velocità più alta, con poco SNR, gli errori aumenterebbero.`],
      [`Il dispositivo viene disconnesso`, `Prima di perdere la connessione si riduce il rate.`],
      [`Non cambia nulla: il rate è fisso`, `In 802.11 il rate si adatta dinamicamente alla qualità del canale.`]]);
  Q('w-hidden', 'wireless', 2,
    `Che cos'è il problema del terminale nascosto?`,
    `Due stazioni sentono l'AP ma non si sentono tra loro.`,
    `A e C trasmettono verso B ma non si sentono (distanza o ostacolo): il carrier sense non li ferma, e le loro trasmissioni collidono su B. Per questo 802.11 usa ACK e, se serve, RTS/CTS.`,
    [`A e C trasmettono a B ma non si sentono tra loro: i loro segnali collidono su B`,
      [`Un host che non manda i beacon`, `I beacon li manda l'AP; il terminale nascosto è un problema di collisioni.`],
      [`Una rete con l'SSID nascosto`, `L'SSID nascosto è un'opzione di configurazione dell'AP, non questo problema.`],
      [`Un attaccante che ascolta di nascosto`, `L'ascolto di nascosto è eavesdropping, un problema di sicurezza.`]]);
  Q('w-cdma', 'wireless', 3,
    `In CDMA, come trasmettono più utenti insieme sulla stessa frequenza?`,
    `Ognuno ha un "codice" diverso.`,
    `Ogni utente moltiplica i propri bit per una sua sequenza di chipping. Se i codici sono ortogonali, il ricevente recupera i bit di un utente con il prodotto scalare tra il segnale ricevuto e il codice di quell'utente.`,
    [`Ognuno codifica i bit con un proprio codice; con codici ortogonali il ricevente li separa con il prodotto scalare`,
      [`Usano slot di tempo diversi`, `Questo è TDMA.`],
      [`Usano bande di frequenza diverse`, `Questo è FDMA; in CDMA la frequenza è la stessa.`],
      [`Si passano un token`, `Questo è il token passing.`]]);
  Q('w-beacon', 'wireless', 2,
    `Cosa contiene il beacon frame di un AP?`,
    `Serve a farsi trovare.`,
    `Il beacon, trasmesso periodicamente, annuncia la presenza dell'AP: contiene l'SSID (nome della rete) e il MAC dell'AP.`,
    [`L'SSID e il MAC dell'AP`,
      [`La password della rete`, `La password non si trasmette mai in chiaro in un beacon.`],
      [`L'IP del server DNS`, `L'IP del DNS lo dà DHCP, dopo l'associazione.`],
      [`L'elenco degli host associati`, `Il beacon serve a farsi trovare, non a elencare i client.`]]);
  Q('w-scan', 'wireless', 2,
    `Scansione passiva e attiva in 802.11:`,
    `Passiva = solo ascolto.`,
    `Passiva: l'host ascolta i beacon degli AP. Attiva: l'host manda una richiesta (probe) in broadcast e gli AP rispondono. Poi sceglie un AP e si associa.`,
    [`Passiva: l'host ascolta i beacon. Attiva: l'host manda una richiesta in broadcast e gli AP rispondono`,
      [`Passiva: l'host manda richieste. Attiva: ascolta i beacon`, `Sono invertite: ascoltare è la modalità passiva.`],
      [`Passiva con il cavo, attiva via radio`, `Entrambe sono via radio.`],
      [`La passiva la fa l'AP, l'attiva il DHCP`, `La scansione la fa l'host per trovare un AP.`]]);
  Q('w-backoff', 'wireless', 3,
    `In CSMA/CA (802.11), come funziona il contatore di backoff?`,
    `Il tempo si "spende" solo quando il canale è libero.`,
    `Il mittente sceglie un backoff casuale; il contatore scende solo mentre il canale è libero e si ferma quando è occupato. A zero trasmette tutto il frame e aspetta l'ACK; senza ACK raddoppia l'intervallo e riprova.`,
    [`Scende solo mentre il canale è libero e si ferma quando è occupato; a zero si trasmette`,
      [`Scende sempre, e a zero si trasmette anche se il canale è occupato`, `Il contatore si blocca a canale occupato: così chi ha già aspettato di più parte prima.`],
      [`Si usa solo dopo aver rilevato una collisione`, `In wireless le collisioni non si rilevano: il backoff serve a evitarle.`],
      [`Raddoppia a ogni frame consegnato con successo`, `L'intervallo cresce quando manca l'ACK, non quando va tutto bene.`]]);
  Q('w-ack', 'wireless', 2,
    `Perché in 802.11 il destinatario manda un ACK per ogni frame?`,
    `Il mittente può sapere da solo se il frame è arrivato?`,
    `In wireless il mittente non può rilevare le collisioni (né quelle dovute al terminale nascosto): solo l'ACK, mandato dopo un breve intervallo SIFS, gli dice che il frame è arrivato. Senza ACK ritrasmette.`,
    [`Il mittente non può rilevare le collisioni: solo l'ACK gli dice che il frame è arrivato`,
      [`Per il controllo di congestione di TCP`, `Questo ACK è del livello di collegamento, indipendente da TCP.`],
      [`Perché lo richiede IP`, `IP non chiede conferme: è best effort.`],
      [`Per sincronizzare gli slot`, `802.11 non usa slot sincronizzati come slotted ALOHA.`]]);
  Q('w-rtscts', 'wireless', 3,
    `Cos'è RTS/CTS in 802.11?`,
    `È una "prenotazione" del canale.`,
    `È opzionale: il mittente manda un breve RTS; l'AP risponde con un CTS che sentono tutti, anche i terminali nascosti, che restano in silenzio per la durata indicata. Si usa di solito per frame lunghi.`,
    [`Una prenotazione opzionale del canale: RTS breve dal mittente, CTS dell'AP che zittisce tutti`,
      [`Un passaggio obbligatorio prima di ogni frame`, `È facoltativo: per frame corti costa più di quanto rende.`],
      [`Il modo in cui 802.11 rileva le collisioni`, `802.11 non rileva le collisioni: RTS/CTS serve a evitarle.`],
      [`Lo scambio delle chiavi di WPA`, `RTS/CTS non ha a che fare con la sicurezza.`]]);
  Q('w-rts-why', 'wireless', 4,
    `Perché RTS/CTS riduce il danno delle collisioni?`,
    `Cosa collide, se si collide?`,
    `Le collisioni possono avvenire solo tra i brevi RTS, che costano poco; il lungo frame di dati parte solo dopo il CTS, con il canale prenotato.`,
    [`Le collisioni possono riguardare solo i brevi RTS, non i lunghi frame di dati`,
      [`Perché elimina il bisogno dell'ACK`, `L'ACK resta: RTS/CTS si aggiunge, non lo sostituisce.`],
      [`Perché assegna a ogni host una frequenza diversa`, `Questo è FDMA.`],
      [`Perché cifra i frame`, `RTS/CTS non cifra nulla.`]]);
  Q('w-4addr', 'wireless', 4,
    `Un host wireless manda un frame verso il router R collegato all'AP. Come sono gli indirizzi del frame 802.11?`,
    `Sul link radio il ricevente è l'AP, ma l'AP deve sapere a chi passare il frame.`,
    `Indirizzo 1 = MAC dell'AP (chi riceve sul link radio), indirizzo 2 = MAC dell'host (chi trasmette), indirizzo 3 = MAC del router R. L'AP poi crea un frame Ethernet con destinazione R e sorgente l'host. Il 4º indirizzo si usa solo in casi particolari (ad hoc).`,
    [`1 = MAC dell'AP, 2 = MAC dell'host, 3 = MAC del router R`,
      [`1 = MAC del router R, 2 = MAC dell'host, come in Ethernet`, `Sul link radio il frame deve essere ricevuto dall'AP: il primo indirizzo è il suo.`],
      [`1 = IP del router, 2 = IP dell'host`, `Nel frame ci sono MAC, non IP.`],
      [`Solo due indirizzi, come in Ethernet`, `Il frame 802.11 ne ha quattro: serve anche dire a chi l'AP deve inoltrare.`]]);
  Q('w-power', 'wireless', 3,
    `Come funziona il power management di 802.11?`,
    `Chi tiene i frame mentre il nodo dorme?`,
    `Il nodo avvisa l'AP che va a dormire; l'AP tiene in buffer i frame per lui e lo indica nel beacon successivo. Il nodo si sveglia prima del beacon e, se ci sono frame, li chiede.`,
    [`L'AP tiene in buffer i frame per il nodo addormentato e lo segnala nel beacon successivo`,
      [`L'AP abbassa la potenza di trasmissione`, `Il risparmio è del dispositivo che spegne la radio, non dell'AP.`],
      [`Il nodo spegne la scheda e i frame per lui vanno persi`, `I frame non si perdono: li conserva l'AP.`],
      [`Il nodo riduce la velocità al minimo`, `Ridurre la velocità è la rate adaptation, non il power management.`]]);
  Q('w-hss', 'wireless', 2,
    `Nel 4G/LTE, cosa fa l'HSS?`,
    `Home Subscriber Server: gli abbonati.`,
    `L'HSS, nella rete di casa, conserva i dati degli abbonati (IMSI, contratto, chiavi) e collabora con l'MME per autenticarli.`,
    [`Conserva i dati degli abbonati nella rete di casa e collabora con l'MME per l'autenticazione`,
      [`È la base station che parla con i telefoni`, `La base station è l'eNode-B.`],
      [`Collega la rete cellulare a Internet`, `Questo è il P-GW.`],
      [`Gestisce l'handover tra base station`, `L'handover lo coordina l'MME con le base station.`]]);
  Q('w-mme', 'wireless', 3,
    `Nel 4G/LTE, di cosa si occupa l'MME?`,
    `Mobility Management Entity.`,
    `L'MME gestisce autenticazione (insieme all'HSS), mobilità e handover, traccia dove si trova il dispositivo e configura i tunnel tra base station e gateway.`,
    [`Autenticazione con l'HSS, mobilità, handover e configurazione dei tunnel`,
      [`Collega la rete cellulare a Internet`, `Questo è il P-GW.`],
      [`Trasmette sul canale radio`, `La trasmissione radio è dell'eNode-B.`],
      [`Contiene l'IMSI dell'utente`, `L'IMSI sta nella SIM (e nell'HSS).`]]);
  Q('w-pgw', 'wireless', 3,
    `Quale elemento della rete LTE collega la rete cellulare all'Internet pubblica?`,
    `PDN = packet data network.`,
    `Il P-GW (PDN gateway) è il punto di uscita verso Internet; il traffico arriva dall'eNode-B al S-GW e dal S-GW al P-GW, dentro tunnel.`,
    [`Il P-GW`,
      [`Il S-GW`, `Il S-GW sta tra le base station e il P-GW: è il punto d'ingresso della rete, non l'uscita verso Internet.`],
      [`L'eNode-B`, `L'eNode-B è la base station, al bordo radio.`],
      [`L'HSS`, `L'HSS è un database degli abbonati.`]]);
  Q('w-imsi', 'wireless', 2,
    `Cos'è l'IMSI?`,
    `S = subscriber.`,
    `L'IMSI (International Mobile Subscriber Identity) identifica l'abbonato; è memorizzato nella SIM e il dispositivo lo presenta quando si associa alla rete.`,
    [`L'identificativo dell'abbonato, memorizzato nella SIM`,
      [`L'indirizzo IP del telefono`, `L'IP viene assegnato dalla rete, l'IMSI è fisso nella SIM.`],
      [`Il MAC dell'eNode-B`, `L'IMSI identifica l'utente, non la base station.`],
      [`La chiave di sessione della connessione`, `La chiave si deriva dopo l'autenticazione; l'IMSI è un identificativo.`]]);
  Q('w-handover', 'wireless', 4,
    `Handover tra due base station della stessa rete: chi dice al S-GW di spostare il tunnel verso la nuova base station?`,
    `La nuova BS avvisa l'entità che gestisce la mobilità.`,
    `La BS di origine sceglie la BS di destinazione, che prealloca le risorse e risponde; il mobile passa alla nuova BS; la nuova BS informa l'MME, e l'MME dice al S-GW di cambiare l'estremo del tunnel.`,
    [`L'MME, avvisato dalla nuova base station`,
      [`Il telefono, direttamente`, `Il telefono non parla con il S-GW: la rete gestisce il tunnel.`],
      [`L'HSS`, `L'HSS è un database degli abbonati: non gestisce i tunnel.`],
      [`La base station di origine, prima di tutto il resto`, `La BS di origine avvia l'handover, ma il tunnel lo sposta l'MME quando la nuova BS ha preso il mobile.`]]);
  Q('w-home', 'wireless', 2,
    `Cosa sono home network e visited network?`,
    `"Casa" è dove hai il contratto.`,
    `Home network: la rete del gestore con cui si ha l'abbonamento, dove l'HSS conosce l'utente. Visited network: la rete in cui il dispositivo si trova in quel momento, con accordi con la rete di casa.`,
    [`Home: la rete del gestore dell'abbonamento. Visited: la rete in cui il dispositivo si trova ora`,
      [`Home: la Wi-Fi di casa. Visited: qualunque altra Wi-Fi`, `Sono concetti della mobilità/rete cellulare, non delle reti domestiche.`],
      [`Home: la rete che ha visitato per prima. Visited: le successive`, `Home è la rete di registrazione, non la prima visitata.`],
      [`Sono due nomi della stessa rete`, `Sono diverse proprio quando il dispositivo si sposta (roaming).`]]);
  Q('w-indirect', 'wireless', 3,
    `Routing indiretto: come arriva un datagramma dal corrispondente al dispositivo mobile?`,
    `Il corrispondente conosce solo l'indirizzo permanente.`,
    `Il corrispondente manda all'indirizzo permanente; nella rete di casa l'home agent lo intercetta e lo inoltra in tunnel al care-of-address nella visited network.`,
    [`Va all'indirizzo permanente; l'home agent lo intercetta e lo inoltra al care-of-address`,
      [`Il corrispondente lo manda direttamente al care-of-address`, `Questo è il routing diretto.`],
      [`Lo manda in broadcast a tutte le reti`, `Il broadcast non attraversa i router.`],
      [`I router di Internet aggiornano le tabelle per seguire il mobile`, `Questo è l'approccio "se ne occupa il routing", che non scala.`]]);
  Q('w-indirect-pro', 'wireless', 4,
    `Vantaggio e svantaggio del routing indiretto?`,
    `Il corrispondente non si accorge di nulla, ma il percorso…`,
    `Vantaggio: è trasparente al corrispondente e il mobile mantiene il suo indirizzo, quindi le connessioni (TCP) restano attive cambiando rete. Svantaggio: è inefficiente (triangle routing), soprattutto se mobile e corrispondente sono vicini.`,
    [`Trasparente e le connessioni restano attive; ma inefficiente perché passa sempre dalla rete di casa`,
      [`Efficiente, ma il corrispondente deve conoscere il care-of-address`, `Questo descrive il routing diretto.`],
      [`Non richiede l'home agent, ma cambia l'IP a ogni spostamento`, `L'home agent è proprio il cuore del routing indiretto.`],
      [`È sicuro perché cifra, ma è lento`, `La cifratura non c'entra: il punto è il percorso a triangolo.`]]);
  Q('w-direct', 'wireless', 4,
    `Nel routing diretto, cosa fa il corrispondente?`,
    `Evita il giro dalla rete di casa.`,
    `Chiede alla rete di casa il care-of-address del mobile e gli manda i datagrammi direttamente: più efficiente, ma non trasparente (il corrispondente deve partecipare).`,
    [`Ottiene il care-of-address dalla rete di casa e invia direttamente lì`,
      [`Invia all'indirizzo permanente e lascia fare all'home agent`, `Questo è il routing indiretto.`],
      [`Invia al proprio router di default e basta`, `Senza il care-of-address i datagrammi andrebbero alla rete di casa.`],
      [`Si sposta nella stessa rete del mobile`, `Il corrispondente resta dov'è.`]]);
  Q('w-coa', 'wireless', 3,
    `Cos'è il care-of-address (COA)?`,
    `Care of = "presso".`,
    `È l'indirizzo temporaneo del mobile nella visited network. L'home agent mantiene il legame (binding) tra l'indirizzo permanente e il COA.`,
    [`L'indirizzo temporaneo del mobile nella visited network`,
      [`L'indirizzo permanente del mobile nella rete di casa`, `Quello è l'home address; il COA cambia a ogni rete visitata.`],
      [`L'indirizzo dell'home agent`, `L'home agent sta nella rete di casa e ha il proprio indirizzo.`],
      [`Il MAC dell'AP a cui è associato`, `Il COA è un indirizzo IP.`]]);

  // ===== Sicurezza =====
  Q('s-props', 'security', 1,
    `Quale proprietà garantisce che solo mittente e destinatario capiscano il contenuto del messaggio?`,
    `Riguarda chi può leggere, non chi ha scritto.`,
    `Riservatezza (confidenzialità): si ottiene cifrando. L'integrità riguarda le modifiche, l'autenticazione l'identità, la disponibilità l'accesso al servizio.`,
    [`Riservatezza`,
      [`Integrità`, `L'integrità garantisce che il messaggio non sia stato alterato, non che nessun altro lo legga.`],
      [`Autenticazione`, `L'autenticazione conferma l'identità di chi comunica.`],
      [`Disponibilità`, `La disponibilità riguarda la possibilità di usare il servizio (minacciata dal DoS).`]]);
  Q('s-dos', 'security', 1,
    `Trudy rende un server irraggiungibile inondandolo di richieste. Che attacco è?`,
    `Il servizio viene negato agli utenti.`,
    `Denial of Service (DoS): sovraccaricando le risorse si impedisce agli utenti legittimi di usare il servizio. Colpisce la disponibilità.`,
    [`Denial of Service (DoS)`,
      [`Eavesdropping`, `L'eavesdropping è l'ascolto dei messaggi: colpisce la riservatezza.`],
      [`IP spoofing`, `Lo spoofing falsifica l'indirizzo sorgente per sembrare un altro.`],
      [`Man in the middle`, `Il MITM si mette in mezzo e intercetta/modifica i messaggi.`]]);
  Q('s-sym-problem', 'security', 2,
    `Qual è il problema principale della crittografia simmetrica?`,
    `Alice e Bob devono avere la stessa chiave…`,
    `Le due parti devono condividere la stessa chiave segreta: come farlo in modo sicuro su una rete insicura? La crittografia a chiave pubblica nasce per risolvere questo.`,
    [`Come condividere in modo sicuro la chiave tra le due parti`,
      [`È troppo lenta`, `La simmetrica è veloce; è RSA a essere lento.`],
      [`Non si può usare per messaggi lunghi`, `Si usa proprio per cifrare i dati, anche lunghi.`],
      [`Si rompe sempre per forza bruta`, `Con chiavi lunghe (AES) la forza bruta è impraticabile.`]]);
  Q('s-des-aes', 'security', 2,
    `Quanto sono lunghe le chiavi di DES e di AES?`,
    `DES è vecchio e rotto; AES ha tre varianti.`,
    `DES usa una chiave di 56 bit (su blocchi di 64 bit) ed è stato rotto per forza bruta; AES usa chiavi di 128, 192 o 256 bit ed è considerato sicuro.`,
    [`DES 56 bit; AES 128, 192 o 256 bit`,
      [`DES 128 bit; AES 56 bit`, `Sono invertiti: AES ha sostituito DES proprio perché 56 bit sono pochi.`],
      [`Entrambi 1024 bit`, `1024 bit (e oltre) sono tipici di RSA, non della cifratura simmetrica.`],
      [`Entrambi 64 bit`, `64 bit è la dimensione del blocco di DES, non della chiave.`]]);
  Q('s-rsa-keys', 'security', 3,
    `In RSA, come sono fatte le chiavi?`,
    `n = p·q compare in entrambe.`,
    `Si scelgono due primi grandi p e q, n = p·q e z = (p−1)(q−1); e coprimo con z, d tale che e·d mod z = 1. Chiave pubblica K+ = (n, e), privata K− = (n, d).`,
    [`K+ = (n, e) e K− = (n, d), con n = p·q ed e·d mod z = 1`,
      [`K+ = (p, q) e K− = n`, `p e q devono restare segreti: chi li conosce calcola subito d.`],
      [`K+ = (n, d) e K− = (n, e)`, `Per convenzione la pubblica usa e (si cifra con c = m^e mod n) e la privata d.`],
      [`K+ = e e K− = p + q`, `Entrambe le chiavi contengono il modulo n = p·q.`]]);
  Q('s-rsa-enc', 'security', 3,
    `Con RSA, come si cifra e si decifra un messaggio m?`,
    `Potenze modulo n.`,
    `Cifratura con la pubblica: c = m^e mod n. Decifratura con la privata: m = c^d mod n.`,
    [`c = m^e mod n; m = c^d mod n`,
      [`c = m^d mod n; m = c^e mod n`, `Per cifrare con la chiave pubblica si usa e; d è nella privata. (Con d si firma, non si cifra per un destinatario.)`],
      [`c = m·e mod n; m = c·d mod n`, `RSA usa l'esponenziazione modulare, non la moltiplicazione.`],
      [`c = m mod e; m = c mod d`, `Il modulo è n, e ed d sono gli esponenti.`]]);
  Q('s-rsa-d', 'security', 4,
    `RSA con p = 5, q = 7, e = 5. Quale di questi è un valore valido di d?`,
    `Calcola z = (p−1)(q−1) e cerca d con e·d mod z = 1.`,
    `n = 35, z = 4·6 = 24. Serve 5·d mod 24 = 1: d = 29 va bene (5·29 = 145 = 6·24 + 1). È l'esempio delle slide (anche d = 5 funzionerebbe, ma non è tra le opzioni).`,
    [`29`,
      [`24`, `24 è z: 5·24 mod 24 = 0, non 1.`],
      [`35`, `35 è n: 5·35 = 175, 175 mod 24 = 7, non 1.`],
      [`6`, `5·6 = 30, 30 mod 24 = 6, non 1.`]]);
  Q('s-rsa-c', 'security', 4,
    `Con la chiave pubblica K+ = (n = 35, e = 5), quanto vale la cifratura di m = 3?`,
    `c = m^e mod n.`,
    `c = 3^5 mod 35 = 243 mod 35 = 243 − 6·35 = 243 − 210 = 33.`,
    [`33`,
      [`243`, `243 è 3^5: manca il modulo 35.`],
      [`15`, `15 = 3·5: RSA usa la potenza, non il prodotto.`],
      [`8`, `8 = 3 + 5: RSA usa la potenza modulo n.`]]);
  Q('s-rsa-safe', 'security', 3,
    `Perché RSA è considerato sicuro?`,
    `Cosa servirebbe per ricavare d dalla chiave pubblica?`,
    `Per ricavare d bisognerebbe conoscere z, quindi scomporre n nei due primi p e q: con numeri di migliaia di bit nessuno sa farlo in tempi ragionevoli.`,
    [`Perché per ricavare la chiave privata bisognerebbe scomporre n nei suoi fattori primi, cosa impraticabile per numeri grandi`,
      [`Perché la chiave pubblica è segreta`, `La chiave pubblica è pubblica per definizione.`],
      [`Perché usa chiavi di 56 bit`, `56 bit sono DES, ed è stato rotto.`],
      [`Perché l'aritmetica modulare non ha proprietà utili`, `Al contrario: RSA funziona proprio grazie alle proprietà dell'aritmetica modulare.`]]);
  Q('s-rsa-slow', 'security', 2,
    `Perché in pratica RSA si usa solo per scambiare una chiave di sessione?`,
    `Confronta la velocità con DES/AES.`,
    `L'esponenziazione modulare è molto pesante: DES è almeno 100 volte più veloce di RSA. Quindi RSA cifra solo la chiave di sessione simmetrica, che poi cifra i dati.`,
    [`Perché è molto più lento della cifratura simmetrica`,
      [`Perché non può cifrare più di 56 bit`, `RSA cifra numeri minori di n, che ha migliaia di bit; il limite è la lentezza.`],
      [`Perché la chiave di sessione è più sicura di RSA`, `Il motivo è l'efficienza: la sicurezza di RSA protegge proprio la chiave di sessione.`],
      [`Perché RSA non garantisce la riservatezza`, `RSA garantisce riservatezza: solo il destinatario ha la privata.`]]);
  Q('s-rsa-prop', 'security', 3,
    `Quale proprietà di RSA permette di usarlo anche per la firma digitale?`,
    `L'ordine delle due chiavi.`,
    `K−(K+(m)) = m = K+(K−(m)): applicando le due chiavi in qualunque ordine si riottiene m. Chi "cifra" con la privata produce una firma che chiunque verifica con la pubblica.`,
    [`K−(K+(m)) = m = K+(K−(m)): l'ordine con cui si applicano le chiavi non conta`,
      [`K+(K+(m)) = m`, `Applicare due volte la pubblica non restituisce m: serve la coppia pubblica/privata.`],
      [`La chiave pubblica si ricava dalla privata e viceversa`, `Dalla pubblica NON si deve poter ricavare la privata.`],
      [`[(a mod n) + (b mod n)] mod n = (a + b) mod n`, `È una proprietà dell'aritmetica modulare, ma non spiega la firma.`]]);
  Q('s-sign', 'security', 2,
    `Come si firma digitalmente un messaggio m?`,
    `La firma la può produrre solo il mittente.`,
    `Si calcola il digest H(m) e lo si cifra con la propria chiave privata: si invia m insieme a K−(H(m)). Solo chi ha la privata può produrla, chiunque la verifica con la pubblica.`,
    [`Si cifra il digest H(m) con la propria chiave privata e lo si invia insieme a m`,
      [`Si cifra m con la chiave pubblica del destinatario`, `Questo dà riservatezza, non prova chi ha scritto: chiunque conosce la pubblica del destinatario.`],
      [`Si cifra H(m) con la propria chiave pubblica`, `La pubblica la conoscono tutti: chiunque potrebbe produrre quella "firma".`],
      [`Si cifra m con la chiave di sessione`, `La chiave di sessione è condivisa da entrambi: non prova chi dei due ha scritto.`]]);
  Q('s-verify', 'security', 3,
    `Bob riceve m e la firma K−A(H(m)). Come la verifica?`,
    `Due digest da confrontare.`,
    `Applica alla firma la chiave pubblica di Alice e ottiene H(m); poi calcola lui H(m) sul messaggio ricevuto. Se coincidono, il messaggio è integro ed è stato firmato da Alice.`,
    [`Applica K+A alla firma, calcola H(m) sul messaggio e confronta i due digest`,
      [`Applica la propria chiave privata alla firma`, `La firma è stata fatta con la privata di Alice: si apre con la pubblica di Alice.`],
      [`Chiede ad Alice la sua chiave privata`, `La chiave privata non si comunica mai a nessuno.`],
      [`Decifra H(m) per ottenere m`, `Un hash non è invertibile: da H(m) non si risale a m.`]]);
  Q('s-nonrep', 'security', 3,
    `Perché la firma digitale garantisce la non ripudiabilità?`,
    `Chi altro potrebbe aver prodotto la firma?`,
    `Solo il mittente possiede la chiave privata che produce una firma verificabile con la sua pubblica: non può negare di aver firmato.`,
    [`Perché solo il mittente possiede la chiave privata con cui è stata prodotta`,
      [`Perché il messaggio viaggia cifrato`, `La cifratura dà riservatezza, non prova chi ha scritto.`],
      [`Perché è firmata con una chiave condivisa`, `Con una chiave condivisa ciascuno dei due potrebbe averla prodotta.`],
      [`Perché contiene l'indirizzo IP del mittente`, `L'IP si falsifica facilmente (spoofing).`]]);
  Q('s-md5', 'security', 1,
    `Quanto è lungo il digest di MD5?`,
    `Lo stesso numero di bit di un indirizzo IPv6.`,
    `MD5 produce un digest di 128 bit, qualunque sia la lunghezza del messaggio. SHA-1 ne produce 160, SHA-256 ne produce 256.`,
    [`128 bit`,
      [`160 bit`, `160 bit è SHA-1.`],
      [`256 bit`, `256 bit è SHA-256.`],
      [`Quanto il messaggio`, `Un hash produce sempre un digest di lunghezza fissa.`]]);
  Q('s-hash-coll', 'security', 3,
    `Quale di queste è la proprietà giusta di una funzione hash crittografica?`,
    `Il digest ha lunghezza fissa, i messaggi possibili sono infiniti.`,
    `Le collisioni esistono per forza (infiniti messaggi, digest di lunghezza fissa): la proprietà è che sia computazionalmente impossibile trovarne una, cioè trovare x ≠ y con H(x) = H(y).`,
    [`È computazionalmente impossibile trovare due messaggi diversi con lo stesso digest`,
      [`Due messaggi diversi non possono mai avere lo stesso digest`, `Le collisioni esistono per forza: il digest ha lunghezza fissa e i messaggi sono infiniti. Devono solo essere impossibili da trovare.`],
      [`Dal digest si ricava il messaggio con la chiave giusta`, `Un hash non ha chiave e non è invertibile.`],
      [`Il digest è lungo quanto il messaggio`, `Il digest ha lunghezza fissa (128 bit per MD5).`]]);
  Q('s-playback', 'security', 2,
    `Alice si autentica mandando la password cifrata. Perché non basta?`,
    `Trudy ha bisogno di leggere la password?`,
    `Trudy può registrare il pacchetto con la password cifrata e rimandarlo uguale più tardi (playback attack): non le serve decifrarlo.`,
    [`Trudy può registrare il pacchetto e rimandarlo uguale (playback attack)`,
      [`Perché Trudy può sempre decifrare la password`, `Non serve decifrarla: basta rimandare lo stesso pacchetto.`],
      [`Perché la password cifrata è più lunga`, `La lunghezza non c'entra.`],
      [`Perché la cifratura cambia la password`, `La password cifrata si decifra correttamente; il problema è il riutilizzo.`]]);
  Q('s-nonce', 'security', 2,
    `A cosa serve il nonce nei protocolli di autenticazione?`,
    `Nonce = number used once.`,
    `Bob manda un numero R usato una sola volta; Alice lo restituisce cifrato con la chiave condivisa. Una risposta registrata non vale per un nonce nuovo: niente playback.`,
    [`È un numero usato una sola volta: una risposta registrata non vale per il nonce successivo`,
      [`È la chiave condivisa tra Alice e Bob`, `Il nonce viaggia in chiaro: la chiave resta segreta e serve a cifrarlo.`],
      [`È il numero di sequenza dei pacchetti TCP`, `Il nonce è di sicurezza, scelto a caso, non un numero di sequenza.`],
      [`Serve a comprimere il messaggio`, `Il nonce non comprime nulla.`]]);
  Q('s-mitm', 'security', 3,
    `Bob chiede ad Alice la sua chiave pubblica e la riceve sulla rete. Perché è vulnerabile al man in the middle?`,
    `Chi garantisce che la chiave ricevuta sia di Alice?`,
    `Trudy, in mezzo, sostituisce la chiave di Alice con la propria: Bob cifra per Trudy, che legge, ricifra con la vera chiave di Alice e inoltra. Nessuno se ne accorge. Serve un certificato.`,
    [`Trudy può sostituire la chiave pubblica di Alice con la propria, e Bob non può accorgersene senza un certificato`,
      [`Perché Trudy può ricavare la privata dalla pubblica`, `Dalla pubblica non si ricava la privata: Trudy usa una coppia sua.`],
      [`Perché la chiave pubblica viaggia in chiaro`, `Viaggiare in chiaro va bene, è pubblica: il problema è che nessuno ne garantisce il proprietario.`],
      [`Perché RSA è lento`, `La lentezza non c'entra con il MITM.`]]);
  Q('s-cert', 'security', 2,
    `Cosa contiene un certificato digitale?`,
    `Lega due cose ed è firmato da qualcuno.`,
    `L'identità del soggetto e la sua chiave pubblica (più validità e dati della CA), firmati con la chiave privata della CA.`,
    [`L'identità del soggetto e la sua chiave pubblica, firmati con la chiave privata della CA`,
      [`La chiave privata del soggetto`, `La chiave privata non si mette mai in un certificato.`],
      [`La chiave pubblica del soggetto, firmata con la chiave pubblica della CA`, `Con la pubblica non si firma: la firma la fa la CA con la sua privata, e si verifica con la pubblica.`],
      [`Username e password del soggetto`, `Il certificato lega identità e chiave pubblica, non contiene credenziali.`]]);
  Q('s-cert-verify', 'security', 3,
    `Come verifica un client il certificato ricevuto dal server?`,
    `Chi ha firmato il certificato?`,
    `Con la chiave pubblica della CA che l'ha firmato, che il client già conosce (per esempio preinstallata nel browser o nel sistema operativo).`,
    [`Con la chiave pubblica della CA, che conosce già`,
      [`Con la chiave privata della CA`, `La privata della CA la conosce solo la CA: si verifica con la pubblica.`],
      [`Con la chiave pubblica del server scritta nel certificato`, `La chiave del server è proprio ciò che va garantito: non può garantire se stessa.`],
      [`Chiedendo al server di confermarlo`, `Un server falso confermerebbe qualunque cosa.`]]);
  Q('s-pgp-ks', 'security', 3,
    `E-mail sicura (PGP): Alice cifra il messaggio con una chiave di sessione KS. Con cosa cifra KS?`,
    `Solo Bob deve poterla leggere.`,
    `KS si cifra con la chiave pubblica di Bob: solo Bob, con la sua privata, la recupera e poi decifra il messaggio.`,
    [`Con la chiave pubblica di Bob`,
      [`Con la propria chiave privata`, `Chiunque la decifrerebbe con la pubblica di Alice: niente riservatezza.`],
      [`Con KS stessa`, `Bob non ha KS: non potrebbe decifrarla.`],
      [`Non la cifra: la manda in chiaro`, `Chiunque la intercetti leggerebbe il messaggio.`]]);
  Q('s-pgp-keys', 'security', 4,
    `In PGP, per avere riservatezza, autenticazione e integrità, quali chiavi usa Alice?`,
    `Una per firmare, una per i dati, una per proteggere quella dei dati.`,
    `Tre: la propria privata (firma del digest), una chiave di sessione simmetrica KS (cifra messaggio e firma), la pubblica di Bob (cifra KS).`,
    [`La propria privata, una chiave di sessione simmetrica e la pubblica di Bob`,
      [`Solo la pubblica di Bob`, `Basta per la riservatezza, ma non per autenticazione e integrità (serve la firma).`],
      [`La privata di Bob e la pubblica di Alice`, `Alice non conosce la privata di Bob.`],
      [`Solo la chiave di sessione`, `Come la condividerebbe con Bob? E chi garantirebbe il mittente?`]]);
  Q('s-tls-lvl', 'security', 2,
    `Quale livello della pila Internet provvede al recapito del record SSL/TLS?`,
    `TLS sta sopra qualcosa di affidabile.`,
    `TLS sta tra l'applicazione e il trasporto: i suoi record viaggiano dentro una connessione TCP, quindi li recapita il livello di trasporto.`,
    [`Il livello di trasporto (TCP)`,
      [`Il livello di rete, come IPsec`, `IPsec lavora a livello di rete; TLS si appoggia su TCP.`],
      [`Il livello di collegamento`, `Il record TLS non sa nulla dei frame: viaggia in un flusso TCP.`],
      [`Il livello applicazione direttamente su UDP`, `Il TLS classico ha bisogno di TCP (consegna affidabile e ordinata).`]]);
  Q('s-tls-keys', 'security', 3,
    `Quali chiavi si derivano dal master secret in SSL/TLS?`,
    `Due direzioni × (cifratura, MAC).`,
    `Quattro chiavi: Kc (cifratura client → server), Mc (MAC client → server), Ks (cifratura server → client), Ms (MAC server → client).`,
    [`Kc, Mc, Ks, Ms: cifratura e MAC per ciascuna direzione`,
      [`La chiave pubblica e la chiave privata del client`, `Le coppie pubblica/privata non si derivano dal master secret.`],
      [`Una sola chiave per tutto`, `Si usano chiavi diverse per cifratura e integrità, e per le due direzioni.`],
      [`La chiave privata della CA`, `La chiave privata della CA la conosce solo la CA.`]]);
  Q('s-tls-ssl-keys', 'security', 4,
    `Quali chiavi entrano in gioco in una sessione SSL/TLS?`,
    `Una coppia asimmetrica per partire, chiavi simmetriche per lavorare.`,
    `La coppia pubblica/privata del server (pubblica nel certificato, usata dal client per cifrare il pre-master secret) e le chiavi simmetriche derivate dal master secret (Kc, Mc, Ks, Ms) per i dati. Le chiavi private non vengono mai scambiate.`,
    [`La coppia pubblica/privata del server per l'handshake e le chiavi simmetriche di sessione per i dati`,
      [`Client e server si scambiano le rispettive chiavi private`, `Le chiavi private non si scambiano mai: se viaggiassero, non sarebbero più private.`],
      [`Solo le chiavi pubbliche di client e server`, `Con le sole chiavi pubbliche i dati sarebbero lentissimi da cifrare; i dati usano chiavi simmetriche.`],
      [`Solo una password scelta dall'utente`, `TLS non usa password: usa certificato e chiavi derivate.`]]);
  Q('s-record-enc', 'security', 3,
    `Nel record SSL/TLS, quali campi sono cifrati e con quale tipo di cifratura?`,
    `L'header serve a leggere il record.`,
    `Sono cifrati i dati e il MAC, con cifratura simmetrica (Kc dal client, Ks dal server). L'header (tipo, versione, lunghezza) resta in chiaro.`,
    [`Dati e MAC, con cifratura simmetrica`,
      [`Tutto il record, header compreso, con la chiave pubblica del server`, `L'header resta in chiaro, e i dati non si cifrano con la pubblica (troppo lento): si usa la chiave simmetrica.`],
      [`Solo l'header, con cifratura simmetrica`, `È il contrario: l'header è in chiaro, i dati cifrati.`],
      [`Niente: il MAC basta a proteggere i dati`, `Il MAC dà integrità, non riservatezza: i dati vanno cifrati.`]]);
  Q('s-tls-seq', 'security', 3,
    `Perché il MAC di un record TLS include il numero di sequenza?`,
    `Cosa potrebbe fare Trudy con record validi già visti?`,
    `MAC = H(Mx, dati, tipo, numero di sequenza): così Trudy non può riordinare, ripetere o cancellare record, perché il MAC non tornerebbe con il numero atteso.`,
    [`Per impedire che Trudy riordini, ripeta o cancelli record`,
      [`Per sapere quanto è lungo il record`, `La lunghezza sta nell'header.`],
      [`Per cifrare i dati`, `La cifratura la fa la chiave Kc/Ks; il MAC serve all'integrità.`],
      [`Perché TCP non ha numeri di sequenza`, `TCP li ha, ma Trudy può manipolare i segmenti: serve un numero protetto dal MAC.`]]);
  Q('s-tls-type', 'security', 4,
    `A cosa serve il campo tipo del record TLS, incluso nel MAC?`,
    `Cosa succede se Trudy chiude la connessione TCP con un FIN falso?`,
    `Il tipo distingue un record di dati (0) da uno di chiusura (1). Così la fine della sessione è autenticata: un FIN TCP falso non può troncare la trasmissione senza che ce ne si accorga (attacco di troncamento).`,
    [`Distingue dati e chiusura, contro l'attacco di troncamento`,
      [`Indica l'algoritmo di cifratura scelto`, `L'algoritmo si sceglie nell'handshake, non record per record.`],
      [`Indica la versione di TLS`, `La versione ha un campo suo.`],
      [`Indica se il record è compresso`, `Il tipo serve a distinguere dati e chiusura.`]]);
  Q('s-tls-premaster', 'security', 4,
    `Nell'handshake TLS con RSA, come arriva al server il pre-master secret?`,
    `Solo il server deve poterlo leggere.`,
    `Il client lo genera, lo cifra con la chiave pubblica del server (presa dal certificato verificato) e lo invia. Solo il server lo decifra con la sua privata.`,
    [`Il client lo genera e lo cifra con la chiave pubblica del server`,
      [`Il server lo genera e lo cifra con la propria chiave privata`, `Ciò che è cifrato con la privata del server lo legge chiunque con la pubblica.`],
      [`Viaggia in chiaro, protetto dal MAC`, `Chi lo intercetta calcolerebbe tutte le chiavi.`],
      [`Il client manda la propria chiave privata`, `Le chiavi private non si scambiano mai.`]]);
  Q('s-tls-nonce', 'security', 4,
    `Perché nell'handshake TLS client e server mandano ciascuno un nonce?`,
    `Una sessione registrata potrebbe essere rigiocata?`,
    `Con nonce nuovi le chiavi della sessione cambiano ogni volta: Trudy non può rigiocare l'handshake e i record di una sessione registrata (attacco di replay).`,
    [`Per rendere diverse le chiavi a ogni sessione e impedire il replay di una sessione registrata`,
      [`Per indicare la versione del protocollo`, `La versione ha un campo suo.`],
      [`Per firmare il certificato`, `Il certificato è firmato dalla CA.`],
      [`Per numerare i record`, `I record si numerano con il numero di sequenza.`]]);
  Q('s-tls-hsmac', 'security', 5,
    `Perché alla fine dell'handshake TLS client e server si mandano un MAC di tutti i messaggi di handshake?`,
    `I primi messaggi viaggiano in chiaro.`,
    `I primi messaggi (come la lista di algoritmi) sono in chiaro: un man in the middle potrebbe modificarli, per esempio togliendo gli algoritmi più forti. Il MAC finale lo rivela.`,
    [`Per accorgersi se un man in the middle ha modificato i messaggi in chiaro, per esempio la lista di algoritmi`,
      [`Per cifrare i dati che seguono`, `I dati si cifrano con Kc/Ks; il MAC dell'handshake verifica l'integrità.`],
      [`Per chiudere la connessione`, `La chiusura usa il record di tipo chiusura.`],
      [`Per scambiare il pre-master secret`, `Il pre-master secret viaggia prima, cifrato con la pubblica del server.`]]);
  Q('s-ipsec-ah', 'security', 2,
    `IPsec: qual è la differenza tra AH ed ESP?`,
    `Uno dei due cifra.`,
    `AH (Authentication Header) dà autenticazione e integrità, ma niente riservatezza. ESP (Encapsulating Security Payload) dà anche riservatezza, perché cifra.`,
    [`AH dà autenticazione e integrità; ESP anche la riservatezza`,
      [`AH cifra, ESP no`, `È il contrario: è ESP che cifra.`],
      [`Sono identici, cambia solo il nome`, `AH non cifra, ESP sì.`],
      [`AH è per IPv4, ESP per IPv6`, `Entrambi esistono per IPv4 e IPv6.`]]);
  Q('s-ipsec-mode', 'security', 3,
    `IPsec: transport mode e tunnel mode?`,
    `Cosa viene protetto: solo il carico o tutto il datagramma?`,
    `Transport: protegge solo il payload del datagramma (tipico tra host). Tunnel: protegge l'intero datagramma originale e aggiunge un nuovo header IP (tipico tra router, nelle VPN).`,
    [`Transport protegge solo il payload; tunnel protegge l'intero datagramma e aggiunge un nuovo header IP`,
      [`Transport protegge l'intero datagramma, tunnel solo il payload`, `Sono invertiti.`],
      [`Transport usa TCP, tunnel usa UDP`, `IPsec lavora a livello di rete, sotto il trasporto.`],
      [`Transport è AH, tunnel è ESP`, `Modalità e protocollo sono indipendenti: si può avere ESP in transport o in tunnel.`]]);
  Q('s-ipsec-spi', 'security', 3,
    `Come capisce chi riceve un datagramma IPsec quale SA applicare?`,
    `Un numero a 32 bit nell'header IPsec.`,
    `L'SPI (Security Parameter Index, 32 bit) nell'header ESP/AH identifica la SA: il ricevente lo usa come indice nel SAD per trovare algoritmi e chiavi.`,
    [`Dall'SPI nell'header IPsec, usato come indice nel SAD`,
      [`Dall'IP sorgente`, `Lo stesso mittente può avere più SA: serve l'SPI.`],
      [`Dalla porta TCP`, `Con ESP le porte sono cifrate: non si possono leggere.`],
      [`Dal TTL`, `Il TTL non identifica nulla.`]]);
  Q('s-sad-spd', 'security', 4,
    `IPsec: che differenza c'è tra SPD e SAD?`,
    `Policy = cosa; Association = come.`,
    `L'SPD (Security Policy Database) dice COSA fare con un datagramma: usare IPsec o no, e con quale SA. Il SAD (Security Association Database) dice COME: algoritmi, chiavi, numeri di sequenza della SA.`,
    [`L'SPD dice cosa fare con un datagramma (IPsec sì/no, quale SA); il SAD come farlo (algoritmi e chiavi della SA)`,
      [`L'SPD contiene le chiavi, il SAD le regole`, `Sono invertiti.`],
      [`Sono la stessa tabella`, `Sono due database distinti, consultati in momenti diversi.`],
      [`L'SPD sta nei router, il SAD negli host`, `Entrambi stanno in ogni estremo IPsec.`]]);
  Q('s-ike', 'security', 3,
    `A cosa serve IKE in IPsec?`,
    `Key Exchange.`,
    `IKE negozia, stabilisce e gestisce le SA di IPsec, autenticando le parti con una chiave pre-condivisa (PSK) o con la crittografia a chiave pubblica (PKI). Prima crea una SA IKE, poi con quella negozia le SA IPsec.`,
    [`A negoziare e gestire le SA di IPsec, autenticando le parti con PSK o con chiavi pubbliche`,
      [`A cifrare i dati di ogni datagramma`, `I dati li cifra ESP con le chiavi della SA; IKE prepara le SA.`],
      [`A scegliere il percorso dei datagrammi`, `Il percorso lo decide il routing.`],
      [`A sostituire TLS`, `TLS e IPsec lavorano a livelli diversi.`]]);
  Q('s-ipsec-conn', 'security', 4,
    `IP è connectionless. E IPsec?`,
    `Prima di inviare dati protetti bisogna accordarsi.`,
    `IPsec è orientato alla connessione: prima di inviare si stabilisce una Security Association (unidirezionale), con algoritmi, chiavi e numeri di sequenza.`,
    [`È orientato alla connessione: prima si stabilisce una Security Association`,
      [`È connectionless come IP`, `Senza una SA i due estremi non saprebbero che chiavi e algoritmi usare.`],
      [`Usa una connessione TCP`, `IPsec sta sotto TCP; la "connessione" è la SA a livello di rete.`],
      [`Apre una connessione per ogni datagramma`, `La SA vale per molti datagrammi.`]]);
  Q('s-vpn', 'security', 2,
    `Cos'è una VPN?`,
    `Una rete privata… virtuale.`,
    `Una rete privata costruita sopra l'Internet pubblica: il traffico tra le sedi viaggia cifrato (per esempio con IPsec in tunnel mode), senza dover posare link e router propri.`,
    [`Una rete privata sopra Internet, con il traffico tra le sedi cifrato (es. IPsec in tunnel)`,
      [`Una rete fisica separata con router e link propri`, `È proprio ciò che la VPN evita: usa la rete pubblica.`],
      [`Una VLAN tra due switch`, `Le VLAN sono a livello 2 dentro una LAN.`],
      [`Un firewall software`, `Il firewall filtra; la VPN cifra il traffico tra sedi.`]]);
  Q('s-wep', 'security', 3,
    `Perché la cifratura WEP è debole?`,
    `Quanti IV diversi ci sono con 24 bit?`,
    `L'IV è di soli 24 bit, cambia a ogni frame e viaggia in chiaro: dopo pochi milioni di frame si ripete. Con un testo noto Trudy ricava il keystream di quell'IV e decifra i frame successivi che lo riusano.`,
    [`L'IV è di 24 bit e viaggia in chiaro: si ripete presto e con un testo noto si ricava il keystream`,
      [`Perché non usa nessuna chiave`, `WEP usa una chiave condivisa; il problema è l'IV corto.`],
      [`Perché usa RSA`, `WEP usa una cifratura a flusso simmetrica.`],
      [`Perché l'IV è di 256 bit e rallenta tutto`, `L'IV è di 24 bit: troppo corto, non troppo lungo.`]]);
  Q('s-wpa3', 'security', 4,
    `WPA3 (come nelle slide): da cosa si ricava la chiave di sessione K(M-AP)?`,
    `Ognuno la calcola da sé.`,
    `Dalla password condivisa e dai due nonce (NonceAS e NonceM): dispositivo e server di autenticazione la calcolano ciascuno per conto proprio, e un HMAC dimostra che conoscono la stessa password. La chiave non viaggia mai.`,
    [`Dalla password condivisa e dai due nonce, calcolata da ciascuno senza trasmetterla`,
      [`L'AP la sceglie e la manda in chiaro`, `Chiunque ascolti la leggerebbe.`],
      [`Dall'IV di 24 bit come in WEP`, `È proprio la debolezza che WPA3 evita.`],
      [`Dalla chiave privata del dispositivo`, `WPA3 personal si basa sulla password condivisa, non su una coppia di chiavi.`]]);
  Q('s-lte-auth', 'security', 5,
    `Nel 4G, chi autentica il dispositivo mobile?`,
    `Il segreto sta nella SIM e nella rete di casa.`,
    `L'HSS della rete di casa, che condivide una chiave con la SIM, genera un token di autenticazione e la risposta attesa; l'MME della rete visitata confronta la risposta del telefono con quella attesa. Il telefono a sua volta autentica la rete dal token.`,
    [`L'HSS della rete di casa insieme all'MME della rete visitata, con la chiave condivisa con la SIM`,
      [`La base station, con una password inserita dall'utente`, `Non c'è password dell'utente: si usa la chiave nella SIM.`],
      [`Il P-GW con un certificato`, `Il P-GW è il gateway verso Internet, non l'autenticatore.`],
      [`Nessuno: basta presentare l'IMSI`, `L'IMSI identifica, non autentica: chiunque potrebbe copiarlo.`]]);
  Q('s-fw-stateless', 'security', 2,
    `In base a cosa decide un filtro di pacchetti stateless?`,
    `Ogni pacchetto è valutato da solo.`,
    `Solo sui campi del singolo pacchetto: IP sorgente e destinazione, porte TCP/UDP, protocollo, tipo di messaggio ICMP, bit SYN e ACK. Non ricorda nulla dei pacchetti precedenti.`,
    [`Sui campi del singolo pacchetto: IP, porte, protocollo, tipo ICMP, bit SYN/ACK`,
      [`Sul contenuto applicativo dei messaggi`, `Questo è l'application gateway (o un IDS).`],
      [`Sullo stato delle connessioni TCP`, `Questo è il filtro stateful.`],
      [`Sull'utente che ha mandato il pacchetto`, `Il filtro di pacchetti non sa chi è l'utente.`]]);
  Q('s-fw-stateful', 'security', 3,
    `Perché serve un filtro stateful oltre a quello stateless?`,
    `Basta il bit ACK per dire che c'è una connessione?`,
    `Lo stateless accetta un segmento con il bit ACK anche se non esiste nessuna connessione (Trudy può costruirlo). Lo stateful tiene la tabella delle connessioni TCP e accetta solo i pacchetti che appartengono a una connessione esistente.`,
    [`Lo stateless accetta un segmento con ACK anche senza connessione; lo stateful controlla che la connessione esista`,
      [`Perché lo stateless non legge le porte`, `Lo stateless legge porte e bit: gli manca la memoria delle connessioni.`],
      [`Perché lo stateful cifra i pacchetti`, `Nessuno dei due cifra.`],
      [`Perché lo stateless non funziona con UDP`, `Filtra anche UDP; il punto è la memoria delle connessioni TCP.`]]);
  Q('s-acl', 'security', 3,
    `Come si applicano le regole di una ACL (access control list)?`,
    `L'ordine conta.`,
    `Dalla prima all'ultima: vale la prima regola la cui condizione corrisponde al pacchetto. Di solito l'ultima è "deny all", per scartare tutto ciò che non è permesso esplicitamente.`,
    [`Dalla prima all'ultima: vale la prima che corrisponde (di solito l'ultima è "deny all")`,
      [`Vale la regola più specifica, come nel longest prefix match`, `In una ACL decide l'ordine, non la specificità.`],
      [`Vale l'ultima che corrisponde`, `Ci si ferma alla prima.`],
      [`Si applicano tutte e vince la maggioranza`, `Non c'è nessun voto: la prima regola che corrisponde decide.`]]);
  Q('s-acl-syn', 'security', 4,
    `ACL: Allow 222.22/16 → esterno, TCP, porta sorgente > 1023, porta destinazione 80; Allow esterno → 222.22/16, TCP, porta sorgente 80, porta destinazione > 1023, bit ACK; Deny all. Arriva da fuori un SYN verso 222.22.1.1 porta 80. Cosa succede?`,
    `Controlla la direzione e i bit di ogni regola.`,
    `La prima regola è per il traffico in uscita; la seconda accetta in entrata solo segmenti con ACK dalla porta 80 esterna. Un SYN verso la porta 80 interna non corrisponde a nessuna Allow: vale il Deny finale.`,
    [`Viene scartato: nessuna regola Allow lo copre e vale il Deny finale`,
      [`Passa con la seconda regola`, `La seconda richiede porta sorgente 80 e bit ACK; questo SYN ha destinazione 80 e nessun ACK.`],
      [`Passa con la prima regola`, `La prima vale per i pacchetti che escono da 222.22/16, non per quelli che entrano.`],
      [`Passa perché la porta 80 è sempre aperta`, `Nella ACL nulla è aperto se non c'è una regola Allow.`]]);
  Q('s-alg', 'security', 4,
    `Che cosa fa un application gateway (ALG)?`,
    `Lavora più in alto di un filtro di pacchetti.`,
    `Fa da intermediario per un'applicazione e decide in base ai dati applicativi (per esempio quali utenti possono usare telnet). Serve un gateway per ogni applicazione, e i client devono sapere come parlargli.`,
    [`Filtra in base ai dati di livello applicazione, facendo da intermediario (un gateway per applicazione)`,
      [`Filtra solo per IP e porte`, `Questo è il filtro di pacchetti.`],
      [`Traduce indirizzi privati in pubblici`, `Questo è il NAT.`],
      [`Cifra il traffico tra due sedi`, `Questo è una VPN.`]]);
  Q('s-ids', 'security', 3,
    `Che cosa fa un IDS (Intrusion Detection System)?`,
    `Detection: rileva e avvisa.`,
    `Analizza i pacchetti (anche il contenuto, non solo gli header) e li confronta con firme di attacchi noti o cerca anomalie, anche correlando più pacchetti; quando trova qualcosa genera un allarme.`,
    [`Esamina i pacchetti, anche nel contenuto, cerca firme di attacchi o anomalie e genera allarmi`,
      [`Assegna gli indirizzi IP`, `Questo è DHCP.`],
      [`Cifra i pacchetti sospetti`, `L'IDS rileva, non cifra.`],
      [`Filtra solo in base alla porta di destinazione`, `Questo è un semplice filtro di pacchetti.`]]);

  const bankById = id => BANK.find(b => b.id === id);
  const LETTERS = ['a', 'b', 'c', 'd', 'e'];

  // ---------------- domande aperte d'esame ----------------
  // groups: punti chiave (con sinonimi) per U.gradeOpen · model: risposta modello (prende il 100%)
  // dx: errori tipici riconosciuti sul testo normalizzato { re, notRe, msg } (stringhe: ex resta JSON)
  // dxCase: una risposta con quell'errore, usata dall'autotest
  function G(label, any) { return { label, any }; }
  const OPEN = [
    {
      id: 'pki', topic: 'security', d: 4,
      q: `Spiegare gli aspetti essenziali della PKI (infrastruttura a chiave pubblica): chiavi pubbliche e private, proprietà aritmetiche, certificazione.`,
      hint: `Tre parti: le due chiavi e il loro uso; RSA con l'aritmetica modulare e la proprietà K−(K+(m)) = m = K+(K−(m)); la CA e il certificato.`,
      groups: [
        G('coppia di chiavi: pubblica K+, nota a tutti', ['pubblica', 'public']),
        G('chiave privata K−, segreta, nota solo al proprietario', ['privata', 'private', 'segreta']),
        G('proprietà: applicando le due chiavi in qualunque ordine si riottiene m', ['viceversa', 'qualunque ordine', 'qualsiasi ordine', 'riottiene', 'si ottiene m', 'commutat']),
        G('aritmetica modulare (RSA: c = m^e mod n, m = c^d mod n)', ['modul', 'mod n', 'rsa']),
        G('sicurezza: dalla pubblica non si ricava la privata (fattorizzare n = p·q è impraticabile)', ['fattori', 'fattorizz', 'scompor', 'numeri primi', 'primi']),
        G('uso: cifrare per il destinatario e firmare con la propria privata', ['firma', 'firmare']),
        G('certificazione: una Certification Authority (CA) lega identità e chiave pubblica', ['certificat', 'certification authority', 'ca', 'autorita di certificazione']),
        G('il certificato è firmato con la chiave privata della CA e si verifica con la pubblica della CA', ['privata della ca', 'firmato dalla ca', 'firma della ca', 'pubblica della ca'])
      ],
      model: `Nella crittografia a chiave pubblica ogni entità ha una coppia di chiavi: una chiave pubblica K+, nota a tutti, e una chiave privata K−, segreta e conosciuta solo dal proprietario. Chi vuole mandare un messaggio riservato a Bob lo cifra con la chiave pubblica di Bob; solo Bob, con la sua privata, può decifrarlo. ` +
        `Proprietà aritmetiche: le chiavi si costruiscono con l'aritmetica modulare (RSA). Si scelgono due numeri primi grandi p e q, si calcolano n = p·q e z = (p−1)(q−1), si sceglie e coprimo con z e d tale che e·d mod z = 1: K+ = (n, e), K− = (n, d). Si cifra con c = m^e mod n e si decifra con m = c^d mod n. ` +
        `Vale K−(K+(m)) = m = K+(K−(m)): applicando le due chiavi in qualunque ordine (prima la pubblica e poi la privata, o viceversa) si riottiene m. Per questo la privata serve anche a firmare: la firma digitale è K−(H(m)) e chiunque la verifica con la pubblica. ` +
        `È sicuro perché dalla chiave pubblica non si ricava la privata senza scomporre n nei fattori primi p e q, cosa impraticabile per numeri grandi. RSA è lento, quindi in pratica si usa per scambiare una chiave di sessione simmetrica. ` +
        `Certificazione: bisogna essere sicuri che una chiave pubblica appartenga davvero a chi dice di esserne il proprietario, altrimenti Trudy può fare man in the middle. Una Certification Authority (CA) verifica l'identità del soggetto e rilascia un certificato che lega identità e chiave pubblica, firmato con la chiave privata della CA; chi lo riceve lo verifica con la chiave pubblica della CA.`,
      dx: [
        { re: 'stessa chiave', msg: `Nella crittografia a chiave pubblica le due chiavi sono DIVERSE: una pubblica e una privata. Una stessa chiave condivisa è la crittografia simmetrica.` },
        { re: 'privata[a-z ]{0,25}(nota|conosciuta|condivisa) (a|da) tutti', msg: `È la chiave PUBBLICA a essere nota a tutti; la privata la conosce solo il proprietario.` }
      ],
      dxCase: `Le due parti usano la stessa chiave per cifrare e decifrare.`
    },
    {
      id: 'hash', topic: 'security', d: 3,
      q: `Indicare le proprietà principali di una funzione di hashing (crittografica).`,
      hint: `Cosa entra e cosa esce (lunghezze), quanto costa calcolarla, si può invertire?, collisioni, piccole modifiche, a cosa serve.`,
      groups: [
        G('input di lunghezza qualsiasi → digest di lunghezza fissa', ['lunghezza fissa', 'dimensione fissa', 'fissa', 'fisso', 'prefissata']),
        G('esempi di lunghezza: MD5 128 bit, SHA-1 160, SHA-256 256', ['md5', '128', 'sha', '256', '160']),
        G('facile e veloce da calcolare', ['facile', 'veloce', 'efficien', 'rapid']),
        G('non invertibile (one-way): dal digest non si risale al messaggio', ['non invertibil', 'one-way', 'one way', 'unidirezional', 'risalire', 'irreversibil']),
        G('resistente alle collisioni: computazionalmente impossibile trovare x ≠ y con lo stesso digest', ['collision', 'stesso digest', 'stesso hash', 'stessa impronta']),
        G('effetto valanga: una piccola modifica cambia completamente il digest', ['valanga', 'piccola modifica', 'cambia completamente', 'un solo bit', 'minima modifica']),
        G('uso: integrità e firma digitale (si firma il digest)', ['integrita', 'firma'])
      ],
      model: `Una funzione di hash H prende un messaggio m di lunghezza qualsiasi e produce un digest (impronta) di lunghezza fissa: 128 bit per MD5, 160 per SHA-1, 256 per SHA-256. Proprietà principali: ` +
        `1) è deterministica e facile e veloce da calcolare; ` +
        `2) è non invertibile (one-way): dal digest non si può risalire al messaggio; ` +
        `3) è resistente alle collisioni: le collisioni esistono per forza (messaggi infiniti, digest di lunghezza fissa), ma è computazionalmente impossibile trovare due messaggi x ≠ y con lo stesso digest, o un altro messaggio con lo stesso digest di uno dato; ` +
        `4) effetto valanga: una piccola modifica del messaggio, anche di un solo bit, cambia completamente il digest. ` +
        `Per questo il digest si usa per controllare l'integrità e nella firma digitale: invece di firmare tutto il messaggio si firma H(m) con la chiave privata, e il ricevente confronta il digest decifrato con quello che calcola lui.`,
      dx: [
        { re: 'sempre divers|mai lo stesso|mai uguali|non esistono collision|non possono avere lo stesso|non possono mai avere', notRe: 'computazional|impossibile trovare|difficile trovare', msg: `Le collisioni esistono per forza: il digest ha lunghezza fissa e i messaggi possibili sono infiniti. La proprietà giusta è che sia computazionalmente impossibile TROVARNE una.` },
        { re: 'decifr', msg: `Un hash non si "decifra": non ha chiave e non è invertibile. Nella firma si decifra con la chiave pubblica il digest cifrato, non il digest stesso.` }
      ],
      dxCase: `Messaggi diversi danno sempre digest diversi.`
    },
    {
      id: 'cert', topic: 'security', d: 3,
      q: `Spiegare la necessità della certificazione e il principio alla base della creazione di un certificato.`,
      hint: `Perché non basta ricevere la chiave pubblica di Bob? Chi garantisce il legame, cosa contiene il certificato, con quale chiave è firmato e come si verifica.`,
      groups: [
        G('serve una garanzia che la chiave pubblica appartenga davvero a chi dice di esserne il proprietario', ['appartien', 'davvero', 'legame', 'lega', 'associa']),
        G('altrimenti attacco man in the middle: Trudy si spaccia per Bob con la propria chiave', ['man in the middle', 'man-in-the-middle', 'mitm', 'spacci', 'impersona', 'trudy', 'finge']),
        G('ente terzo fidato: la Certification Authority (CA)', ['certification authority', 'autorita di certificazione', 'ca', 'ente fidato', 'ente terzo']),
        G('la CA verifica l\'identità di chi registra la chiave', ['identita']),
        G('il certificato contiene identità e chiave pubblica del soggetto', ['chiave pubblica']),
        G('firmato con la chiave privata della CA', ['privata della ca', 'firmato dalla ca', 'firma della ca', 'chiave privata della']),
        G('si verifica con la chiave pubblica della CA, già nota (preinstallata)', ['pubblica della ca', 'preinstallat'])
      ],
      model: `Con la crittografia a chiave pubblica chi riceve la chiave pubblica di Bob deve essere sicuro che appartenga davvero a Bob. Se la chiave arriva senza garanzie, Trudy può spacciarsi per Bob mandando la propria chiave pubblica (attacco man in the middle): Alice cifrerebbe per Trudy e accetterebbe come di Bob le firme di Trudy. ` +
        `Serve quindi un ente terzo fidato, la Certification Authority (CA), che lega in modo verificabile un'identità alla sua chiave pubblica. ` +
        `Principio: Bob genera la sua coppia di chiavi, si registra presso la CA e dimostra la propria identità; la CA crea un certificato che contiene l'identità di Bob e la sua chiave pubblica (con il periodo di validità e i dati della CA) e lo firma con la chiave privata della CA. ` +
        `Chi riceve il certificato lo verifica con la chiave pubblica della CA, che conosce già (per esempio preinstallata nel browser): se la firma è valida, la chiave pubblica è davvero di Bob.`,
      dx: [
        { re: 'restitui\\w* (una |la )?chiave|ci da (una |la )?chiave|fornisce (una |la )?chiave|genera (una |la )?chiave pubblica', msg: `La CA non crea le tue chiavi: la coppia la generi tu e registri la pubblica. La CA verifica la tua identità e FIRMA il certificato che lega identità e chiave pubblica.` },
        { re: '(firmat|cifrat)\\w* (con )?(la )?chiave pubblica della ca', msg: `Il certificato è firmato con la chiave PRIVATA della CA; con la sua chiave pubblica si verifica.` }
      ],
      dxCase: `Si chiede alla CA, che dopo aver verificato chi siamo ci restituisce una chiave pubblica e il certificato.`
    },
    {
      id: 'csma', topic: 'mac', d: 4,
      q: `Spiegare significato, caratteristiche e campi di applicazione di CSMA/CD e CSMA/CA.`,
      hint: `Parti da CSMA (ascolto del canale) e dal perché le collisioni restano possibili. Poi CD: cosa fa quando rileva una collisione e dove si usa. Poi CA: perché in wireless non si rilevano, come si evitano, l'ACK, RTS/CTS.`,
      groups: [
        G('CSMA: ascolta il canale prima di trasmettere (carrier sense)', ['ascolta', 'carrier sense', 'sente il canale', 'canale libero']),
        G('le collisioni restano possibili per il ritardo di propagazione', ['propagazione']),
        G('CD: rileva la collisione mentre trasmette, interrompe e manda il segnale di jam', ['jam', 'interromp']),
        G('CD: backoff esponenziale binario (K in {0..2^n − 1}, attesa K·512 bit)', ['esponenzial', 'binary exponential', '512']),
        G('CD si usa nelle LAN cablate (Ethernet su bus o hub)', ['ethernet', 'cablat', 'cavo']),
        G('CA: in wireless le collisioni non si possono rilevare (segnale debole, terminale nascosto)', ['nascost', 'non si possono rilevare', 'non puo rilevare', 'non riesce a rilevare', 'non rileva']),
        G('CA: attesa DIFS e backoff casuale, il contatore scende solo a canale libero', ['difs', 'contatore', 'conto alla rovescia', 'countdown']),
        G('CA: il destinatario conferma con un ACK; senza ACK si ritrasmette', ['ack']),
        G('CA: prenotazione opzionale del canale con RTS/CTS', ['rts']),
        G('CA si usa nelle reti wireless 802.11 (Wi-Fi)', ['802.11', 'wi-fi', 'wifi', 'wireless', 'wlan'])
      ],
      model: `CSMA (Carrier Sense Multiple Access) è un protocollo di accesso multiplo casuale: prima di trasmettere il nodo ascolta il canale e trasmette solo se è libero; se è occupato rimanda. Le collisioni restano possibili per il ritardo di propagazione: due nodi possono sentire il canale libero e partire quasi insieme. ` +
        `CSMA/CD (Collision Detection): mentre trasmette il nodo continua ad ascoltare; se rileva una collisione interrompe subito la trasmissione e invia un segnale di jam, così tutti se ne accorgono; poi attende un backoff esponenziale binario: dopo la n-esima collisione sceglie K a caso in {0, …, 2^n − 1} e aspetta K·512 tempi di bit prima di riprovare. Interrompere subito evita di sprecare il canale. Si usa nelle LAN cablate: Ethernet su bus o con hub (con gli switch full-duplex le collisioni non ci sono più). ` +
        `CSMA/CA (Collision Avoidance): in wireless un nodo non può rilevare le collisioni mentre trasmette (il proprio segnale copre quello debole degli altri) e c'è il problema del terminale nascosto, quindi le collisioni si cercano di evitare. Il mittente, se sente il canale libero, aspetta un breve intervallo DIFS e trasmette; altrimenti sceglie un backoff casuale: il contatore scende solo quando il canale è libero e si ferma quando è occupato; a zero trasmette tutto il frame. Il destinatario risponde con un ACK dopo un breve SIFS; senza ACK il mittente ritrasmette con un backoff più lungo. ` +
        `Facoltativamente si prenota il canale con RTS/CTS: il mittente manda un breve RTS, l'AP risponde con un CTS che sentono tutti, anche i terminali nascosti, che restano in silenzio. Si usa nelle reti wireless 802.11 (Wi-Fi).`,
      dx: [
        { re: '\\brts\\b', notRe: 'opzional|facoltativ|eventual|puo|non obbligator|se serve|frame lunghi|grandi', msg: `RTS/CTS in 802.11 è FACOLTATIVO (di solito per frame lunghi): il CSMA/CA di base è ascolto, DIFS, backoff casuale e ACK.` },
        { re: '\\bca\\b[a-z ]{0,60}(rileva|si accorge)[a-z ]{0,20}collision', notRe: 'non (puo |riesce a |si possono )?rilev', msg: `CSMA/CA non rileva le collisioni (in wireless non si può): cerca di evitarle, e si accorge che qualcosa è andato storto solo perché manca l'ACK.` }
      ],
      dxCase: `CSMA/CD rileva le collisioni. CSMA/CA funziona come CD ma prima di trasmettere il mittente manda un RTS e il ricevente risponde con un CTS.`
    },
    {
      id: 'dv', topic: 'routing', d: 4,
      q: `Spiegare, attraverso un semplice esempio, il principio di funzionamento di un protocollo di routing di tipo Distance Vector.`,
      hint: `Cosa conosce ogni nodo, cosa si scambiano i nodi e quando, l'equazione di Bellman-Ford. Poi un esempio con tre router e i costi dei link: fai vedere un ricalcolo con i numeri.`,
      groups: [
        G('ogni nodo conosce solo i costi dei link verso i vicini', ['vicin']),
        G('mantiene un vettore delle distanze stimate verso tutte le destinazioni', ['vettore', 'distance vector', 'tabella delle distanze']),
        G('Bellman-Ford: dx(y) = min sui vicini v di { c(x,v) + dv(y) }', ['bellman', 'min', 'minimo']),
        G('ogni nodo invia il proprio vettore ai vicini quando cambia', ['invia', 'manda', 'annuncia', 'comunica', 'propaga']),
        G('algoritmo iterativo, asincrono e distribuito', ['iterativ', 'asincron', 'distribuit']),
        G('esempio con nodi e costi', ['esempio']),
        G('converge quando nessun vettore cambia più', ['converg', 'stabil']),
        G('problema del count-to-infinity e poisoned reverse', ['infinit', 'poison']),
        G('esempio di protocollo: RIP', ['rip'])
      ],
      model: `In un protocollo distance vector (per esempio RIP) ogni router conosce solo il costo dei link verso i propri vicini e mantiene un vettore delle distanze: la stima del costo minimo verso ogni destinazione. ` +
        `Quando il vettore cambia (e in RIP anche periodicamente) lo invia ai vicini; quando riceve il vettore di un vicino ricalcola le stime con l'equazione di Bellman-Ford: dx(y) = min su v { c(x,v) + dv(y) }, cioè per ogni vicino il costo del link più la distanza annunciata dal vicino, scegliendo il minimo. Se il proprio vettore cambia, lo annuncia a sua volta. ` +
        `L'algoritmo è iterativo, asincrono e distribuito, e converge quando nessun vettore cambia più. ` +
        `Esempio: tre router X, Y, Z con c(X,Y) = 2, c(Y,Z) = 1, c(X,Z) = 7. All'inizio X conosce solo i vicini: dX = [X 0, Y 2, Z 7]. Y gli manda dY = [X 2, Y 0, Z 1]. X ricalcola dX(Z) = min{ c(X,Z) + dZ(Z) = 7 ; c(X,Y) + dY(Z) = 2 + 1 = 3 } = 3, via Y, e annuncia il nuovo vettore a Y e Z. Dopo pochi scambi tutti i vettori sono stabili. ` +
        `Difetto: se un costo aumenta, le cattive notizie si propagano lentamente (count-to-infinity); il poisoned reverse lo attenua: se Z passa per Y per raggiungere X, annuncia a Y una distanza infinita verso X.`,
      dx: [
        { re: 'dijkstra|topologia completa|intera topologia|tutta la topologia|conosce tutta la rete', msg: `Questo è il link state. Nel distance vector un nodo NON conosce la topologia: conosce solo i costi verso i vicini e i vettori che i vicini gli mandano.` },
        { re: 'a tutti i (nodi|router)', notRe: 'vicin', msg: `Nel distance vector il vettore si manda solo ai VICINI, non a tutti i router (il flooding a tutti è del link state).` }
      ],
      dxCase: `Ogni router conosce la topologia completa e calcola i cammini con Dijkstra.`
    },
    {
      id: 'ssl', topic: 'security', d: 5,
      q: `Descrivere gli elementi essenziali della fase di handshake SSL.`,
      hint: `Su cosa si appoggia; i messaggi del client e del server (algoritmi, nonce, certificato); come arriva al server il segreto comune; quali chiavi se ne ricavano; perché alla fine si scambiano un MAC dei messaggi.`,
      groups: [
        G('parte dopo l\'apertura della connessione TCP', ['tcp']),
        G('il client propone gli algoritmi di cifratura (cipher suite), il server sceglie', ['algoritm', 'cipher', 'suite']),
        G('nonce del client e del server', ['nonce']),
        G('il server manda il proprio certificato', ['certificat']),
        G('il client verifica il certificato con la chiave pubblica della CA', ['ca', 'certification authority', 'autorita']),
        G('il client manda il pre-master secret cifrato con la chiave pubblica del server', ['pre-master', 'premaster', 'pre master']),
        G('dal master secret si derivano le quattro chiavi Kc, Mc, Ks, Ms', ['master secret', 'kc', 'mc', 'ks', 'ms', 'quattro chiavi', '4 chiavi']),
        G('MAC di tutti i messaggi di handshake, contro le manomissioni di un MITM', ['tutti i messaggi', 'messaggi di handshake', 'manomess']),
        G('poi i dati usano chiavi simmetriche (le chiavi private non si scambiano)', ['simmetric'])
      ],
      model: `L'handshake SSL/TLS avviene dopo l'apertura della connessione TCP e serve ad autenticare il server, scegliere gli algoritmi e stabilire un segreto comune da cui derivare le chiavi. ` +
        `1) Il client manda la lista degli algoritmi di cifratura che supporta (cipher suite) e un nonce. ` +
        `2) Il server sceglie gli algoritmi dalla lista e risponde con la scelta, il suo certificato e un proprio nonce. ` +
        `3) Il client verifica il certificato con la chiave pubblica della CA che l'ha firmato, ne estrae la chiave pubblica del server, genera un pre-master secret e lo manda cifrato con la chiave pubblica del server: solo il server, con la sua chiave privata, può leggerlo. Le chiavi private non vengono mai scambiate. ` +
        `4) Client e server calcolano, ciascuno per conto proprio, dal pre-master secret e dai due nonce il master secret, e da questo le quattro chiavi di sessione: Kc e Mc (cifratura e MAC dal client al server), Ks e Ms (dal server al client). ` +
        `5) Il client manda un MAC di tutti i messaggi di handshake, 6) il server fa lo stesso: così si scopre se un man in the middle ha modificato i messaggi in chiaro, per esempio togliendo gli algoritmi più forti dalla lista. ` +
        `I nonce rendono ogni sessione diversa e impediscono il replay di una sessione registrata. Da qui in poi i dati viaggiano nei record, cifrati con le chiavi simmetriche.`,
      dx: [
        { re: 'scambi\\w*[a-z ]{0,40}privat|privat\\w*[a-z ]{0,20}(scambiat|inviat|mandat)', notRe: 'non (vengono |sono )?(mai )?scambi|mai scambi', msg: `Nell'handshake le chiavi private non si scambiano mai: il client cifra il pre-master secret con la chiave PUBBLICA del server, e solo il server lo legge con la sua privata.` },
        { re: 'chiave pubblica del client', msg: `Nel TLS di base il client non usa una propria coppia di chiavi: è il server ad autenticarsi con il certificato, e il client usa la pubblica del server.` }
      ],
      dxCase: `Il server manda il certificato, poi client e server si scambiano le chiavi pubbliche e private per stabilire una connessione sicura.`
    },
    {
      id: 'record', topic: 'security', d: 4,
      q: `Descrivere il record SSL/TLS: significato dei campi, quali sono cifrati e con quale cifratura, quale livello lo recapita.`,
      hint: `Header (tre campi), dati, MAC: cosa entra nel MAC e perché. Poi: cosa resta in chiaro, che tipo di chiave cifra, su cosa viaggia il record.`,
      groups: [
        G('campo tipo (content type)', ['tipo', 'type']),
        G('campo versione del protocollo', ['versione', 'version']),
        G('campo lunghezza dei dati', ['lunghezza', 'length']),
        G('frammento di dati (fino a circa 16 KB)', ['dati', 'fragment', 'frammento']),
        G('MAC = H(Mx, dati, tipo, numero di sequenza) per l\'integrità', ['mac']),
        G('il numero di sequenza nel MAC impedisce riordino e replay', ['sequenza', 'sequence']),
        G('il tipo distingue dati e chiusura (contro il troncamento)', ['troncament', 'chiusura', 'truncation']),
        G('dati e MAC cifrati con cifratura simmetrica (Kc o Ks); header in chiaro', ['simmetric']),
        G('recapitato dal livello di trasporto (TCP)', ['tcp', 'trasporto'])
      ],
      model: `Il record SSL/TLS è l'unità con cui viaggiano i dati dopo l'handshake. Il flusso dell'applicazione è diviso in frammenti (fino a circa 16 KB) e ogni record ha: un header con tipo (content type), versione del protocollo e lunghezza dei dati; il frammento di dati; il MAC. ` +
        `Il tipo distingue i record di dati da quelli di chiusura: così un FIN TCP falso non può troncare la sessione (attacco di troncamento). La lunghezza dice dove finiscono i dati e inizia il MAC. ` +
        `Il MAC, calcolato come H(Mx, dati, tipo, numero di sequenza) con la chiave Mc o Ms, garantisce l'integrità; il numero di sequenza non viaggia nel record ma è contato da entrambi, e impedisce di riordinare, ripetere o cancellare record. ` +
        `Sono cifrati solo i dati e il MAC, con cifratura simmetrica (chiave Kc dal client, Ks dal server); l'header resta in chiaro perché serve a leggere il record. ` +
        `Il record è recapitato dal livello di trasporto: viaggia dentro una connessione TCP.`,
      dx: [
        { re: 'chiave pubblica|chiave privata', msg: `I record si cifrano con chiavi SIMMETRICHE (Kc o Ks) derivate dal master secret: la coppia pubblica/privata del server si usa solo nell'handshake.` },
        { re: 'livello (di )?rete|\\bip\\b', notRe: 'tcp|trasporto', msg: `Il record TLS non viaggia direttamente su IP: lo recapita il livello di trasporto, dentro una connessione TCP (è IPsec che lavora a livello di rete).` }
      ],
      dxCase: `Il record ha tipo, versione, lunghezza, dati e MAC; tutto viene cifrato con la chiave pubblica del server.`
    },
    {
      id: 'pgp', topic: 'security', d: 5,
      q: `Descrivere come Alice invia a Bob una e-mail sicura (schema di PGP) con riservatezza, autenticazione e integrità, e cosa fa Bob per leggerla.`,
      hint: `Alice usa tre chiavi: quale per la firma, quale per il messaggio, quale per proteggere la chiave del messaggio? Bob ripercorre i passi al contrario.`,
      groups: [
        G('Alice calcola il digest H(m) con una funzione di hash', ['hash', 'digest', 'impronta']),
        G('firma: cifra il digest con la propria chiave privata', ['privata di alice', 'sua chiave privata', 'propria chiave privata', 'privata del mittente']),
        G('genera una chiave di sessione simmetrica KS e cifra messaggio e firma', ['sessione', 'simmetric']),
        G('cifra KS con la chiave pubblica di Bob', ['pubblica di bob', 'pubblica del destinatario']),
        G('Bob recupera KS con la propria chiave privata', ['privata di bob', 'privata del destinatario']),
        G('Bob verifica la firma con la chiave pubblica di Alice', ['pubblica di alice', 'pubblica del mittente']),
        G('confronta i due digest: uguali = integro e autentico', ['confront', 'uguali', 'coincid', 'combaci']),
        G('le chiavi pubbliche sono garantite da un certificato (CA)', ['certificat', 'ca'])
      ],
      model: `Alice vuole riservatezza, autenticazione e integrità e usa tre chiavi: la sua privata, la pubblica di Bob e una chiave di sessione simmetrica. ` +
        `1) Calcola il digest H(m) del messaggio con una funzione di hash. 2) Cifra il digest con la sua chiave privata: è la firma digitale, che dà autenticazione e integrità. 3) Genera una chiave di sessione simmetrica KS e cifra con KS il messaggio insieme alla firma (riservatezza; la cifratura simmetrica è veloce). 4) Cifra KS con la chiave pubblica di Bob, così solo Bob può recuperarla, e invia tutto. ` +
        `Bob: 1) con la chiave privata di Bob decifra KS; 2) con KS decifra messaggio e firma; 3) applica alla firma la chiave pubblica di Alice e ottiene il digest calcolato da Alice; 4) calcola lui H(m) e confronta: se i due digest sono uguali il messaggio è integro e viene davvero da Alice. ` +
        `Le chiavi pubbliche di Alice e di Bob devono essere garantite da un certificato rilasciato da una CA.`,
      dx: [
        { re: 'alice[a-z ]{0,80}privata di bob', msg: `Alice non conosce la chiave privata di Bob: usa la PUBBLICA di Bob per cifrare la chiave di sessione. La privata di Bob la usa solo Bob, per recuperarla.` },
        { re: 'cifra[a-z ]{0,30}(messaggio|m) con (la )?(sua |propria )?chiave privata', msg: `Cifrare tutto il messaggio con la privata di Alice non dà riservatezza (chiunque lo apre con la sua pubblica) ed è lento: con la privata si firma solo il digest, il messaggio si cifra con la chiave di sessione.` }
      ],
      dxCase: `Alice cifra la chiave di sessione con la chiave privata di Bob e la manda insieme al messaggio.`
    }
  ];
  const openById = id => OPEN.find(o => o.id === id);

  // ---------------- parametri e costruzione ----------------
  // n: domande chiuse · min/max: difficoltà ammesse · hard: quante almeno di difficoltà ≥ 3
  // open: domande aperte · omax: difficoltà massima delle aperte
  const LEVELS = {
    1: { n: 6, min: 1, max: 2, hard: 0, open: 0, omax: 0 },
    2: { n: 7, min: 1, max: 3, hard: 2, open: 0, omax: 0 },
    3: { n: 7, min: 1, max: 4, hard: 3, open: 1, omax: 4 },
    4: { n: 8, min: 2, max: 5, hard: 5, open: 1, omax: 5 },
    5: { n: 9, min: 3, max: 5, hard: 9, open: 2, omax: 5 }
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
    // aperte: se sono due, di argomenti diversi quando possibile
    const open = [];
    const opool = U.shuffle(OPEN.filter(o => o.d <= L.omax));
    for (let i = 0; i < L.open && opool.length; i++) {
      let j = opool.findIndex(o => !open.some(x => x.topic === o.topic));
      if (j < 0) j = 0;
      open.push(opool.splice(j, 1)[0]);
    }
    return {
      level,
      qs: chosen.map(q => ({ id: q.id, ord: U.shuffle(q.opts.map((_, i) => i)) })),
      open: open.map(o => o.id)
    };
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
    // le aperte sono copiate per intero: ex deve restare solo dati
    const open = (p.open || []).map(id => U.clone(openById(id)));
    return { cat: 'theory2', level: p.level, params: p, items: sorted, open };
  }
  const gen = level => build(randomParams(level));

  // ---------------- passi ----------------
  const keyOf = i => `q${i + 1}`;
  const okeyOf = i => `a${i + 1}`;
  function topicsIn(ex) { return TORDER.filter(t => ex.items.some(it => it.topic === t)); }
  function steps(ex) {
    const out = topicsIn(ex).map(t => ({
      id: t, title: topicOf(t).title,
      keys: ex.items.map((it, i) => it.topic === t ? keyOf(i) : null).filter(Boolean)
    }));
    if (ex.open.length) out.push({ id: 'open', title: OPEN_STEP.title, keys: ex.open.map((_, i) => okeyOf(i)) });
    return out;
  }
  function itemOf(ex, key) {
    const m = /^q(\d+)$/.exec(key);
    return m ? ex.items[Number(m[1]) - 1] || null : null;
  }
  function openOf(ex, key) {
    const m = /^a(\d+)$/.exec(key);
    return m ? ex.open[Number(m[1]) - 1] || null : null;
  }
  const optText = (it, i) => `${LETTERS[i]}) ${it.opts[i].t}`;

  // ---------------- correzione ----------------
  const OPEN_INTRO = 'Una risposta completa tocca tutti i punti chiave.';
  function grade(ex, a) {
    let correct = 0, total = 0;
    const marks = {};
    ex.items.forEach((it, i) => {
      const k = keyOf(i);
      const ok = String(a[k] == null ? '' : a[k]).trim() === LETTERS[it.ok];
      total++;
      if (ok) correct++;
      marks[k] = { ok, msg: `Risposta giusta: ${optText(it, it.ok)}. ${it.why}` };
    });
    ex.open.forEach((o, i) => {
      const k = okeyOf(i);
      const g = U.gradeOpen(a[k], o.groups, OPEN_INTRO);
      total++;
      correct += g.part;
      // "ok" pieno solo con tutti i punti chiave; parziale altrimenti (giallo)
      marks[k] = { ok: g.part >= 1 - 1e-9, part: g.part, msg: g.msg || 'Tutti i punti chiave ci sono.' };
    });
    return { correct, total, marks };
  }

  function sol2answers(ex) {
    const a = {};
    ex.items.forEach((it, i) => { a[keyOf(i)] = LETTERS[it.ok]; });
    ex.open.forEach((o, i) => { a[okeyOf(i)] = o.model; });
    return a;
  }

  // ---------------- errori tipici ----------------
  const plain = t => ' ' + U.norm(t).replace(/[^a-z0-9]+/g, ' ') + ' ';
  function openDx(o, text) {
    const tp = plain(text);
    for (const d of (o.dx || [])) {
      if (new RegExp(d.re).test(tp) && !(d.notRe && new RegExp(d.notRe).test(tp))) return d.msg;
    }
    return null;
  }
  function diagnose(ex, key, value) {
    const v = String(value == null ? '' : value).trim();
    if (v === '') return null;
    const o = openOf(ex, key);
    if (o) return openDx(o, v);
    const it = itemOf(ex, key);
    if (!it) return null;
    const i = LETTERS.indexOf(v);
    if (i < 0 || i >= it.opts.length || i === it.ok) return null;
    return it.opts[i].err;
  }

  function diagnoseCases(ex) {
    const out = ex.items.map((it, i) => {
      const w = it.opts.findIndex((o, j) => j !== it.ok);
      return { key: keyOf(i), value: LETTERS[w], expect: it.opts[w].err.slice(0, 40) };
    });
    ex.open.forEach((o, i) => {
      const msg = openDx(o, o.dxCase);
      if (msg) out.push({ key: okeyOf(i), value: o.dxCase, expect: msg.slice(0, 40) });
    });
    return out;
  }

  // ---------------- aiuti ----------------
  function fieldHint(ex, key) {
    const o = openOf(ex, key);
    if (o) return `${o.hint} La correzione cerca ${o.groups.length} punti chiave: usa i termini tecnici.`;
    const it = itemOf(ex, key);
    return it ? it.hint + ' Elimina prima le opzioni che descrivono un altro protocollo o un altro meccanismo.' : 'Rileggi il testo della domanda.';
  }

  function hints(ex) {
    const out = topicsIn(ex).map(t => {
      const its = ex.items.map((it, i) => [it, i]).filter(x => x[0].topic === t);
      return {
        step: t, title: topicOf(t).title,
        metodo: topicOf(t).concept,
        applicato: its.map(([it, i]) => `${i + 1}. ${it.hint}`).join('\n'),
        svolto: its.map(([it, i]) => `${i + 1}. ${optText(it, it.ok)} — ${it.why}`).join('\n')
      };
    });
    if (ex.open.length) {
      out.push({
        step: 'open', title: OPEN_STEP.title,
        metodo: OPEN_STEP.concept,
        applicato: ex.open.map((o, i) => `A${i + 1}. ${o.hint} (punti chiave cercati: ${o.groups.length})`).join('\n'),
        svolto: ex.open.map((o, i) => `A${i + 1}. ${o.model}`).join('\n\n')
      });
    }
    return out;
  }

  // ---------------- disegno ----------------
  function render(ex, root, ctx) {
    root.appendChild(U.h('div', { class: 'card intro' },
      U.h('p', {}, U.h('b', {}, 'Domande di teoria, seconda parte. '),
        `${ex.items.length} domande a risposta chiusa su livello di collegamento, accesso multiplo, routing, wireless e sicurezza: per ognuna una sola opzione è giusta.` +
        (ex.open.length ? ` In fondo ${ex.open.length === 1 ? 'una domanda aperta' : ex.open.length + ' domande aperte'} come all'esame, corrette sui punti chiave.` : '')),
      U.h('p', { class: 'small' }, 'Prima di scegliere, elimina le opzioni che descrivono un altro protocollo o un altro meccanismo, poi chiediti il perché della regola.')));
    topicsIn(ex).forEach(t => {
      root.appendChild(U.card(topicOf(t).title, { step: t },
        ex.items.map((it, i) => it.topic !== t ? null : U.h('div', { class: 'q-item' },
          U.h('div', { class: 'q-text' }, `${i + 1}. ${it.q}`),
          U.sel(ctx, keyOf(i), it.opts.map((_, j) => [LETTERS[j], optText(it, j)]), { label: `domanda ${i + 1}` })))));
    });
    if (ex.open.length) {
      root.appendChild(U.card(OPEN_STEP.title, { step: 'open' },
        U.h('p', { class: 'small' }, 'Rispondi come all\'esame: definizione, meccanismo passo per passo, perché serve, dove si usa. La correzione cerca i termini tecnici.'),
        ex.open.map((o, i) => U.h('div', { class: 'q-item' },
          U.h('div', { class: 'q-text' }, `A${i + 1}. ${o.q}`),
          U.ta(ctx, okeyOf(i), { rows: 7, ph: 'Scrivi la tua risposta…', label: `domanda aperta ${i + 1}` })))));
    }
  }

  function solution(ex, root) {
    root.appendChild(U.h('div', { class: 'card sol' },
      U.h('h4', {}, 'Soluzione'),
      ex.items.length ? U.table(['#', 'Argomento', 'Risposta'], ex.items.map((it, i) => [String(i + 1), topicOf(it.topic).title, optText(it, it.ok)])) : null,
      topicsIn(ex).map(t => U.h('div', {},
        U.h('p', { class: 'sol-body' }, U.h('b', {}, topicOf(t).title)),
        ex.items.map((it, i) => it.topic !== t ? null : U.h('div', { class: 'q-item' },
          U.h('div', { class: 'q-text' }, `${i + 1}. ${it.q}`),
          U.h('p', { class: 'sol-body' }, U.h('b', {}, optText(it, it.ok) + '. '), it.why),
          U.h('p', { class: 'small' }, 'Le altre: ' + it.opts.map((o, j) => j === it.ok ? null : `${LETTERS[j]}) ${o.err}`).filter(Boolean).join(' · ')))))),
      ex.open.length ? U.h('div', {},
        U.h('p', { class: 'sol-body' }, U.h('b', {}, OPEN_STEP.title)),
        ex.open.map((o, i) => U.h('div', { class: 'q-item' },
          U.h('div', { class: 'q-text' }, `A${i + 1}. ${o.q}`),
          U.h('p', { class: 'small' }, 'Punti chiave: ' + o.groups.map(g => g.label).join(' · ')),
          U.h('p', { class: 'sol-body' }, U.h('b', {}, 'Risposta modello. '), o.model)))) : null));
  }

  function chatText(ex, a) {
    const L = [];
    L.push(`Extra · Domande di teoria, 2ª parte (livello ${ex.level})`);
    L.push('## Domande chiuse e mie risposte');
    ex.items.forEach((it, i) => {
      const v = a && String(a[keyOf(i)] || '').trim();
      const j = LETTERS.indexOf(v);
      L.push(`${i + 1}. [${topicOf(it.topic).title}] ${it.q}`);
      it.opts.forEach((_, k) => L.push(`   ${optText(it, k)}`));
      L.push(`   Mia risposta: ${j >= 0 && j < it.opts.length ? LETTERS[j] : '__'}`);
    });
    if (ex.open.length) {
      L.push('## Domande aperte e mie risposte');
      ex.open.forEach((o, i) => {
        const v = a && String(a[okeyOf(i)] || '').trim();
        L.push(`A${i + 1}. ${o.q}`);
        L.push(`   Mia risposta: ${v || '__'}`);
      });
    }
    return L.join('\n');
  }

  RA.theory2 = {
    id: 'theory2', num: 'T', name: 'Domande di teoria · 2ª parte', part: 2, examPoints: 0, extra: true,
    desc: 'Domande chiuse e domande aperte d\'esame sulla seconda parte: collegamento, accesso multiplo, routing, wireless, sicurezza.',
    method: {
      intro: 'Le domande della seconda parte premiano chi sa il perché dei meccanismi: chi impara cosa, chi cifra con quale chiave, chi decide il percorso. Nelle aperte conta toccare tutti i punti chiave con i termini giusti.',
      steps: [
        'Individua l\'argomento: livello di collegamento, accesso multiplo, routing, wireless o sicurezza.',
        'Elimina le opzioni che descrivono un altro protocollo (Dijkstra è link state, non distance vector; RTS/CTS è 802.11, non Ethernet) o un altro livello (MAC sul link, IP da un capo all\'altro).',
        'Nelle domande sulle chiavi chiediti sempre: chi conosce questa chiave? Ciò che è cifrato con una chiave pubblica lo legge solo il proprietario della privata; ciò che è cifrato con una privata lo legge chiunque (è una firma).',
        'Rifai i conti invece di andare a memoria: Bellman-Ford, backoff 2^n − 1, RSA con mod n.',
        'Nelle aperte: definizione, meccanismo passo per passo, perché serve, dove si usa. Chiudi con i limiti (count-to-infinity, terminale nascosto, man in the middle).'
      ],
      traps: [
        'ARP solo nella propria sottorete: per un IP esterno si cerca il MAC del gateway.',
        'Lo switch impara dalla sorgente e, se non conosce la destinazione, fa flooding (nella VLAN); il router senza rotta scarta.',
        'CSMA/CA non rileva le collisioni: le evita, e si accorge dei problemi solo dalla mancanza di ACK. RTS/CTS è facoltativo.',
        'Le collisioni di un hash esistono: devono solo essere impossibili da trovare.',
        'Nell\'handshake TLS le chiavi private non si scambiano mai: viaggia il pre-master secret cifrato con la pubblica del server.',
        'Il certificato è firmato con la chiave PRIVATA della CA e si verifica con la sua pubblica.'
      ],
      formulas: [
        ['Frame Ethernet', 'preambolo 7+1 · MAC dest 6 · MAC sorg 6 · tipo 2 · dati · CRC'],
        ['Tag 802.1Q', '4 byte: TPID (2) + TCI con VLAN ID (2)'],
        ['ALOHA', 'slotted 1/e ≈ 0,37 · pure 1/(2e) ≈ 0,18'],
        ['CSMA/CD', 'dopo n collisioni K ∈ {0 … 2^n − 1}, attesa K·512 tempi di bit · efficienza 1/(1 + 5·tprop/ttrans)'],
        ['Bellman-Ford', 'dx(y) = min_v { c(x,v) + dv(y) }'],
        ['ICMP', '8/0 echo request · 0/0 echo reply · 3/x destinazione irraggiungibile · 11/0 TTL scaduto'],
        ['RSA', 'n = p·q · z = (p−1)(q−1) · e·d mod z = 1 · c = m^e mod n · m = c^d mod n'],
        ['Chiavi', 'DES 56 bit · AES 128/192/256 · MD5 128 bit · IV WEP 24 bit · SPI 32 bit'],
        ['TLS', 'master secret → Kc, Mc, Ks, Ms · MAC = H(Mx, dati, tipo, seq#)']
      ]
    },
    traces: [{
      id: 'pdf-teoria2',
      title: 'Domande di teoria del secondo parziale',
      source: 'domande_teoria_secondo_parziale.pdf',
      params: {
        level: 5,
        qs: [
          { id: 's-record-enc', ord: [1, 0, 2, 3] },
          { id: 's-tls-ssl-keys', ord: [2, 3, 0, 1] },
          { id: 's-tls-lvl', ord: [3, 1, 2, 0] }
        ],
        open: ['pki', 'hash', 'cert', 'csma', 'dv', 'ssl', 'record', 'pgp']
      },
      expect: { q1: 'b', q2: 'c', q3: 'd' }
    }],
    randomParams, build, gen, steps, grade, sol2answers, render, solution, hints, fieldHint, diagnose, diagnoseCases, chatText
  };
})();
