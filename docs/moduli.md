# Contratto dei moduli di esercizio

Ogni tipo di esercizio è un file `js/gen-<id>.js` che registra un oggetto in `window.RetiApp.<id>`.
L'app (`js/app.js`) non conosce i dettagli dei singoli esercizi: usa solo le funzioni elencate qui.

## Regole generali

- **`ex` è solo dati.** L'oggetto esercizio deve poter passare da `JSON.stringify` e `JSON.parse` senza perdere niente: niente funzioni, niente elementi della pagina, niente riferimenti a liste esterne (copia i dati che servono). Lo storico e l'export salvano `ex` così com'è.
- **Risposte "piatte".** Le risposte sono una mappa `{ chiave: stringa }`. Le chiavi sono stabili e leggibili, per esempio `r3.seq`, `sub.Net_A.pf`, `f2.srcIp`.
- **Funzioni pure.** `build`, `grade`, `sol2answers`, `hints`, `fieldHint`, `diagnose` e `chatText` non toccano il DOM. Girano anche in Node (`tools/selftest-node.js`).
- **Caso casuale solo in `randomParams`.** `build(params)` è deterministica: stessi parametri, stesso esercizio. Le tracce d'esame sono semplicemente `params` scritti a mano.
- **Lingua.** Tutti i testi sono in italiano, con il tono delle guide: frasi brevi, il perché delle regole.

## Campi dell'oggetto modulo

| Campo | Tipo | Significato |
|---|---|---|
| `id` | stringa | uguale al nome in `RA` (`'tcp'`) |
| `num` | stringa | numero mostrato nella card (`'4'`, oppure `'E1'` per gli extra) |
| `name` | stringa | nome breve |
| `desc` | stringa | una riga per la card della home |
| `examPoints` | numero | punti all'esame (0 per gli extra) |
| `extra` | booleano | `true` se non fa parte dei 6 esercizi d'esame |
| `method` | oggetto | scheda "📘 Metodo": `{ intro, steps: [testo], traps: [testo], formulas: [[etichetta, valore]] }` |
| `traces` | array | tracce fisse: `[{ id, title, source, params, expect }]` (vedi sotto) |

## Funzioni

### `randomParams(level) → params`
Sceglie a caso i parametri per il livello 1-5. Ogni livello deve essere davvero diverso dal precedente.

### `build(params) → ex`
Costruisce l'esercizio e la sua soluzione. `ex` contiene almeno `cat` (= id), `level`, `params`.

### `gen(level) → ex`
Sempre `build(randomParams(level))`.

### `steps(ex) → [{ id, title, keys: [chiave], prefixes: [prefisso] }]`
I passi del metodo, nell'ordine in cui si risolve l'esercizio. Ogni chiave di `sol2answers(ex)` deve appartenere a un passo (per elenco in `keys` o per prefisso in `prefixes`, utile per le righe aggiunte dall'utente). La modalità guidata sblocca un passo alla volta.

### `render(ex, root, ctx)`
Disegna il testo e i campi dentro `root`.
- I campi si creano **solo** con `U.inp(ctx, key, opts)`, `U.sel(ctx, key, options, opts)` e `U.ta(ctx, key, opts)`: così vengono registrati in `ctx.fields` e precompilati con `ctx.initial`.
- Ogni card che contiene i campi di un passo si crea con `U.card(titolo, { step: id }, ...)`.
- Le tabelle si creano con `U.table(intestazioni, righe)`: hanno sempre l'intestazione (`<thead>`).
- Se il numero di righe dipende dall'utente (tabella di routing), usa `ctx.initial` per crearne abbastanza.
- Non mettere pulsanti di verifica o di soluzione: li aggiunge l'app.

### `grade(ex, answers) → { correct, total, marks, summary }`
- `marks[chiave] = { ok, msg, part }`: `msg` spiega la regola giusta; `part` (0-1) è il punteggio parziale delle risposte aperte.
- `summary` (facoltativo): `[{ ok, text, step }]` per controlli che non stanno su un solo campo (per esempio "Net_B raggiungibile dalla tabella").
- `correct` può essere frazionario; `total > 0`.

### `sol2answers(ex) → answers`
Le risposte modello. `grade(ex, sol2answers(ex))` deve dare `correct === total`.

### `solution(ex, root)`
La soluzione **con i passaggi** (calcoli, tabelle intermedie), non solo i risultati.

### `hints(ex) → [{ step, title, metodo, applicato, svolto }]`
Un suggerimento per passo, su tre livelli:
- `metodo`: la regola generale;
- `applicato`: la regola con i numeri di questo esercizio, senza dare il risultato;
- `svolto`: il passo risolto.

### `fieldHint(ex, key) → stringa`
Aiuto mirato sul singolo campo, mostrato quando l'utente lo seleziona. Non dà la risposta: dice dove guardare.

### `diagnose(ex, key, value, answers) → stringa | null`
Riconosce l'errore tipico dietro una risposta sbagliata (per esempio "Ack# più basso di 1: non hai contato il SYN"). `null` se non lo riconosce: allora l'app usa `marks[key].msg`.

### `diagnoseCases(ex) → [{ key, value, expect }]` (per l'autotest)
Errori tipici costruiti apposta: `diagnose(ex, key, value, …)` deve contenere il testo `expect`.

### `chatText(ex, answers) → stringa`
Testo dell'esercizio con le risposte dell'utente (i campi vuoti come `__`), da incollare in chat.

## Tracce fisse

```js
traces: [{
  id: 'sim-tcp',                 // unico in tutta l'app
  title: 'Esame simulato · TCP',
  source: 'Esame_Simulato_TESTO.pdf, pag. 6',
  set: 'simulato',               // facoltativo: tracce che compongono l'esame simulato dei PDF
  params: { ... },               // passati a build()
  expect: { 'r5.ack': '161' }    // valori presi dalla soluzione del PDF (controllati dall'autotest)
}]
```
