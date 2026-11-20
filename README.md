# Esercitazioni · Reti di calcolatori — Prima parte

App locale per esercitarti con gli esercizi della prima parte dell'esame.
Funziona offline, nessuna installazione: **doppio clic su `index.html`** e si apre nel browser.

## Cosa contiene

I 6 tipi di esercizio dell'esame, generati con **numeri e situazioni sempre nuovi**:

1. **Indirizzamento IP e routing** (10 punti) — più topologie, VLSM con il calcolo degli indirizzi necessari, interfacce dei router, tabella di routing con aggregazione, forzatura di un percorso.
2. **Protocolli e pila Internet** (4 punti) — livello, "su cosa viaggia" e scopo, con le trappole (BGP, RIP, DHCP, ARP, NAT…).
3. **NAT** (5 punti) — IP e porte prima/dopo il NAT, stessa porta sorgente, port forwarding.
4. **TCP: Seq# e Ack#** (5 punti) — traccia da completare col metodo dei due contatori, perdite, ACK duplicati, fast retransmit.
5. **SDN e flow table** (4 punti) — mappa delle porte e regole match/action, corrette simulando i pacchetti.
6. **HTTP** (7 punti) — operazioni prima della richiesta, richiesta/risposta, conteggi DNS/TCP, GET condizionale, tempi in RTT.

In più, dalle guide: **finestra di congestione TCP** (Reno) e **domande di teoria** a risposta chiusa.

## Come si usa

- **Tre modalità** (in alto a destra):
  - *Manuale*: risolvi e premi *Verifica*, vedi solo ✓/✗, come all'esame.
  - *Con aiuti*: suggerimenti passo per passo su tre livelli (la regola → la regola con i tuoi numeri → il passo svolto), aiuto sul singolo campo quando lo selezioni, spiegazione dell'errore tipico dopo la verifica, pulsante *Controlla questo passo*.
  - *Guidata*: l'esercizio si sblocca un passo alla volta, nell'ordine del metodo delle guide.
- **📘 Metodo**: per ogni esercizio, il metodo, le trappole e un mini-formulario.
- **📖 Soluzione**: la soluzione con tutti i passaggi (se la apri prima di verificare, l'esercizio non conta per il livello).
- **📝 Chiedi correzione in chat**: prepara il testo dell'esercizio con le tue risposte (i campi vuoti come "__") da incollare in chat.
- **Difficoltà**: clicca le stelle (1–5) di una categoria per bloccarne il livello, oppure **AUTO** per farla adattare da sola (sale sopra 85%, scende sotto 50%).
- **🏁 Esame simulato**: i 6 esercizi con timer di 2 ore e punteggio come all'esame (35 punti). Niente aiuti durante la prova; alla consegna (o allo scadere del tempo) vedi punteggio e correzione di ogni esercizio. C'è anche la versione con gli esercizi del PDF dell'esame simulato.
- **📄 Tracce d'esame**: gli esercizi dell'esame simulato e gli esempi svolti delle guide, con gli stessi numeri del foglio.
- **📚 Storico e ripasso**: ogni esercizio verificato viene salvato con le tue risposte. Puoi rivederlo, rifarlo uguale e ripassare quelli andati male (sotto l'85%, con la soluzione aperta o con molti aiuti).
- **💾 Backup**: i progressi stanno nel browser. *Esporta* scarica un file `.json`; *Importa* lo ricarica (anche su un altro computer o browser).

## Struttura

```
index.html            pagina principale
css/style.css         stile
js/
  util.js             helper (IP, DOM, campi, tabelle, parole chiave)
  storage.js          progressi, livelli, storico, backup (localStorage)
  gen-*.js            un modulo per tipo di esercizio (vedi docs/moduli.md)
  exam.js             esame simulato
  history.js          storico e ripasso
  chat-export.js      testo per la correzione in chat
  selftest.js         controlli automatici dei moduli
  app.js              home, schermata dell'esercizio, aiuti, modalità
docs/moduli.md        contratto che ogni modulo di esercizio rispetta
tools/selftest-node.js  autotest da riga di comando
```

## Controlli automatici

```
node tools/selftest-node.js
```
Per ogni esercizio e livello genera centinaia di esercizi e controlla che la soluzione modello prenda il 100%, che ogni campo abbia il suo aiuto e che le tracce coincidano con le soluzioni dei PDF. Nel browser: apri `index.html?selftest` (servito da un server locale) per i controlli anche sul disegno.
