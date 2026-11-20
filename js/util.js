// ============================================================
// RetiApp · util.js — helper condivisi (nessuna dipendenza)
// Contratto dei moduli: vedi docs/moduli.md
// ============================================================
window.RetiApp = window.RetiApp || {};
(function () {
  const RA = window.RetiApp;

  const U = RA.util = {
    // ---- numeri casuali ----
    rndInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); },
    pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    // k elementi distinti, in ordine casuale
    sample(arr, k) { return U.shuffle(arr).slice(0, k); },
    chance(p) { return Math.random() < p; },
    pow2ceil(n) { let p = 1; while (p < n) p *= 2; return p; },
    sum(arr) { return arr.reduce((a, b) => a + b, 0); },
    clone(o) { return JSON.parse(JSON.stringify(o)); },

    // ---- IP ----
    ip2int(s) {
      const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(String(s == null ? '' : s).trim());
      if (!m) return null;
      const o = m.slice(1).map(Number);
      if (o.some(x => x > 255)) return null;
      return ((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0;
    },
    int2ip(n) { return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.'); },
    parsePrefix(s) {
      const m = /^(\d{1,3}(?:\.\d{1,3}){3})\s*\/\s*(\d{1,2})$/.exec(String(s == null ? '' : s).trim());
      if (!m) return null;
      const ip = U.ip2int(m[1]);
      const n = Number(m[2]);
      if (ip === null || n < 0 || n > 32) return null;
      return { ip, n };
    },
    fmtPrefix(ip, n) { return U.int2ip(ip) + '/' + n; },
    maskOf(n) { return n === 0 ? 0 : (~((1 << (32 - n)) - 1)) >>> 0; },
    fmtMask(n) { return U.int2ip(U.maskOf(n)); },
    inSub(ip, net, size) { return ip >= net && ip < net + size; },
    // ultimo ottetto, comodo nei messaggi ("…​.129")
    lastOct(n) { return '.' + (n & 255); },

    // ---- testo ----
    norm(t) {
      return String(t == null ? '' : t).toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/\s+/g, ' ').trim();
    },
    // confronto di numeri scritti dall'utente ("  121 " == 121)
    numEq(a, b) {
      const s = String(a == null ? '' : a).trim();
      if (s === '') return false;
      return s === String(b).trim();
    },
    // copertura parole chiave
    // groups = [ { label: 'riga vuota', any: ['riga vuota', 'linea vuota'] }, ... ]
    // (accetta anche il vecchio formato: [ ['dns','risoluz'], ... ])
    // Le parole chiave corte (< 4 lettere) devono comparire come parola intera:
    // così "ip" non viene trovato dentro "principale" e "as" dentro "base".
    kw(text, groups) {
      const t = ' ' + U.norm(text).replace(/[^a-z0-9./:-]+/g, ' ') + ' ';
      const found = [], missing = [];
      groups.forEach((g, i) => {
        const list = Array.isArray(g) ? g : g.any;
        const label = Array.isArray(g) ? g[0] : g.label;
        const hit = list.some(kw => {
          const k = U.norm(kw);
          if (k.replace(/[^a-z0-9]/g, '').length < 4) return t.includes(' ' + k + ' ') || t.includes(' ' + k + ':') || t.includes(' ' + k + '/');
          return t.includes(k);
        });
        (hit ? found : missing).push({ i, label });
      });
      return { found: found.length, total: groups.length, missing, foundList: found };
    },
    // valutazione uniforme di una risposta aperta: punteggio = coperti/totale,
    // "ok" quando si coprono almeno il 60% dei punti chiave
    gradeOpen(text, groups, intro) {
      const c = U.kw(text, groups);
      const part = c.total ? c.found / c.total : 1;
      const ok = c.found >= Math.ceil(c.total * 0.6);
      const msg = ok && c.missing.length === 0 ? null :
        `${intro ? intro + ' ' : ''}Punti chiave citati: ${c.found}/${c.total}.` +
        (c.missing.length ? ` Manca: ${c.missing.map(m => m.label).join('; ')}.` : '');
      return { ok, part, msg, cov: c };
    },
    pct(a, b) { return b === 0 ? 1 : a / b; },

    // ---- DOM ----
    h(tag, attrs, ...kids) {
      const el = document.createElement(tag);
      if (attrs) for (const k in attrs) {
        const v = attrs[k];
        if (v === undefined || v === null || v === false) continue;
        if (k === 'class') el.className = v;
        else if (k === 'text') el.textContent = v;
        else if (k === 'html') el.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? '' : v);
      }
      for (const kid of kids.flat(9)) {
        if (kid === null || kid === undefined || kid === false) continue;
        el.appendChild(typeof kid === 'string' || typeof kid === 'number' ? document.createTextNode(String(kid)) : kid);
      }
      return el;
    },
    clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); },

    // ---- campi registrati nel contesto (ctx.fields[key] = elemento) ----
    // opts: { w: 'xs'|'s'|'m'|'l'|'xl', ph, label (aria), cls }
    inp(ctx, key, opts) {
      opts = opts || {};
      const el = U.h('input', {
        class: 'cell' + (opts.w ? ' w-' + opts.w : '') + (opts.cls ? ' ' + opts.cls : ''),
        type: 'text', placeholder: opts.ph, 'aria-label': opts.label || key,
        'data-key': key, autocomplete: 'off', spellcheck: 'false'
      });
      U._register(ctx, key, el);
      return el;
    },
    // options: [[value, label], ...] (la prima opzione vuota la aggiunge lui)
    sel(ctx, key, options, opts) {
      opts = opts || {};
      const el = U.h('select', { class: 'cell' + (opts.w ? ' w-' + opts.w : ''), 'data-key': key, 'aria-label': opts.label || key },
        U.h('option', { value: '' }, opts.ph || '— scegli —'),
        options.map(([v, l]) => U.h('option', { value: v }, l)));
      U._register(ctx, key, el);
      return el;
    },
    ta(ctx, key, opts) {
      opts = opts || {};
      const el = U.h('textarea', { class: 'cell ta', rows: opts.rows || 3, placeholder: opts.ph, 'data-key': key, 'aria-label': opts.label || key });
      U._register(ctx, key, el);
      return el;
    },
    _register(ctx, key, el) {
      if (!ctx || !ctx.fields) return;
      ctx.fields[key] = el;
      if (ctx.initial && ctx.initial[key] !== undefined && ctx.initial[key] !== null) el.value = ctx.initial[key];
    },
    // ---- mattoncini di impaginazione ----
    // card con titolo; opts.step = id del passo del metodo (serve alla modalità guidata)
    card(title, opts, ...kids) {
      opts = opts || {};
      return U.h('div', { class: 'card' + (opts.cls ? ' ' + opts.cls : ''), 'data-step': opts.step },
        title ? U.h('h4', {}, title) : null, kids);
    },
    // tabella con intestazione vera (<thead>) dentro un contenitore che scorre in orizzontale
    // head: ['Col1', 'Col2'] · rows: [[cella, cella], ...] (cella = stringa, nodo o {td: nodo, cls, colspan})
    table(head, rows, opts) {
      opts = opts || {};
      const mkCell = (tag, c) => {
        if (c && typeof c === 'object' && !(c instanceof Node) && ('td' in c)) {
          return U.h(tag, { class: c.cls, colspan: c.colspan, title: c.title }, c.td);
        }
        return U.h(tag, {}, c);
      };
      const t = U.h('table', { class: 'tbl' + (opts.cls ? ' ' + opts.cls : '') },
        head ? U.h('thead', {}, U.h('tr', {}, head.map(x => mkCell('th', x)))) : null,
        U.h('tbody', {}, rows.map(r => {
          if (r && r.section) return U.h('tr', { class: 'section-row' }, U.h('td', { colspan: r.colspan || (head ? head.length : 1) }, r.section));
          if (r && r.tr) return U.h('tr', { class: r.cls }, r.tr.map(c => mkCell('td', c)));
          return U.h('tr', {}, r.map(c => mkCell('td', c)));
        })));
      return U.h('div', { class: 'table-wrap' }, t);
    },
    given(text) { return { td: String(text), cls: 'given', title: 'valore dato dal testo' }; },
    label(text) { return { td: text, cls: 'lbl-td' }; },
    // riga "etichetta: campo"
    row(labelText, ...kids) { return U.h('div', { class: 'num-row' }, U.h('span', { class: 'row-lbl' }, labelText), kids); },
    // figura SVG (stringa) in un contenitore che scorre su schermi stretti
    fig(svg, caption) {
      return U.h('div', { class: 'fig-wrap' }, U.h('div', { html: svg }), caption ? U.h('p', { class: 'fig-cap small' }, caption) : null);
    },
    // marker per le frecce SVG (da mettere in <defs>); id unico per figura
    svgArrowDefs(id) {
      return `<defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="ah"/></marker></defs>`;
    },

    // ---- risposte ----
    collect(fields) {
      const a = {};
      for (const k in fields) if (fields[k]) a[k] = fields[k].value;
      return a;
    },
    restore(fields, answers) {
      if (!answers) return;
      for (const k in answers) if (fields[k] && answers[k] !== undefined && answers[k] !== null) fields[k].value = answers[k];
    },
    filled(answers) { return Object.values(answers || {}).some(v => String(v == null ? '' : v).trim() !== ''); },

    // ---- feedback su un campo ----
    // state: 'ok' | 'err' | 'part'; msg: testo (solo in modalità con spiegazioni)
    fb(el, state, msg) {
      if (!el) return;
      el.classList.remove('ok', 'err', 'part');
      el.classList.add(state === true ? 'ok' : state === false ? 'err' : state);
      el.removeAttribute('data-fb');
      let f = el.nextElementSibling;
      if (f && f.classList && f.classList.contains('fb')) f.remove();
      if (state !== 'ok' && state !== true && msg) {
        el.setAttribute('data-fb', msg);
        f = U.h('div', { class: 'fb' }, msg);
        el.insertAdjacentElement('afterend', f);
      }
    },
    resetFb(root) {
      root.querySelectorAll('.ok,.err,.part').forEach(i => { if (i.matches('input,select,textarea')) i.classList.remove('ok', 'err', 'part'); });
      root.querySelectorAll('[data-fb]').forEach(i => i.removeAttribute('data-fb'));
      root.querySelectorAll('.fb').forEach(f => f.remove());
    },

    // ---- passi del metodo ----
    keyInStep(step, key) {
      return (step.keys || []).includes(key) || (step.prefixes || []).some(p => key.startsWith(p));
    },
    stepOfKey(steps, key) {
      for (let i = 0; i < steps.length; i++) if (U.keyInStep(steps[i], key)) return i;
      return -1;
    },

    // ---- date ----
    fmtDate(ts) {
      const d = new Date(ts);
      return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: '2-digit' }) + ' ' +
        d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    }
  };
})();
