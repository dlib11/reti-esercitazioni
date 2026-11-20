# Esercitazioni · Reti di calcolatori — Prima parte

App locale per esercitarti con gli esercizi della prima parte dell'esame.
Funziona offline, nessuna installazione: **doppio clic su `index.html`** e si apre nel browser.

## Cosa contiene

I 6 tipi di esercizio dell'esame, generati con **numeri sempre nuovi** a ogni volta:

1. **Indirizzamento IP e routing** — VLSM, interfacce dei router, tabella di routing con aggregazione, forzatura di un percorso (10 punti)
2. **Protocolli e pila Internet** — livello e scopo dei protocolli, incluse le trappole (BGP, ARP, RIP, DHCP...) (4 punti)
3. **NAT** — IP e porte prima/dopo il NAT, porte WAN diverse, port forwarding (5 punti)
4. **TCP: Seq# e Ack#** — traccia da completare col metodo dei due contatori + perdite, ACK duplicati, fast retransmit (5 punti)
5. **SDN e flow table** — entry match/action verificate simulando i pacchetti nella topologia (4 punti)
6. **HTTP** — operazioni prima della richiesta, struttura richiesta/risposta, conteggi DNS/TCP, GET condizionale (7 punti)

## Come si usa

- **Modalità manuale**: risolvi, premi *Verifica* e vedi solo ✓/✗.
- **Modalità con aiuti**: in più hai i **suggerimenti** progressivi (💡) e, dopo la verifica, la **spiegazione di ogni errore** con il metodo delle guide.
- **📖 Mostra soluzione** dà la risposta modello completa.
- **📝 Chiedi correzione in chat**: prepara in un colpo solo il testo dell'esercizio con la tua compilazione (i campi vuoti restano "__"), lo copia negli appunti e lo incolli in chat per fartelo correggere dall'assistente.
- **Difficoltà a scelta**: clicca le stelle (1–5) nella card di una categoria per bloccarne il livello, oppure premi **AUTO** per farla adattare da sola (sale sopra 85%, scende sotto 50%). Puoi cambiare livello anche dall'interno di un esercizio col menu accanto al titolo: vale dal prossimo esercizio.
- L'esame simulato parte da una **scelta di difficoltà** (Facile 2 · Medio 3 · Difficile 4 · Oltre l'esame 5), che aggiorna anche il livello fisso delle categorie nella home.
- **🏁 Esame simulato**: i 6 esercizi in sequenza con timer di 2 ore e punteggio come all'esame reale (35 punti).

Le domande aperte (protocolli, HTTP, forzatura percorso) hanno una valutazione a parole chiave + risposta modello: per una correzione completa, incolla la tua risposta in chat.

## Struttura

```
index.html          pagina principale
css/style.css       stile
js/
  util.js           helper (IP, DOM, parole chiave)
  storage.js        progressi e livello adattivo (localStorage)
  gen-*.js          i 6 generatori/verificatori di esercizi
  exam.js           modalità esame simulato
  app.js            home e navigazione
```
