// ============================================================
// RetiApp · util.js — helper condivisi (nessuna dipendenza)
// ============================================================
window.RetiApp = window.RetiApp || {};
(function () {
  const RA = window.RetiApp;

  RA.util = {
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
    pow2ceil(n) { let p = 1; while (p < n) p *= 2; return p; },

    // ---- IP ----
    ip2int(s) {
      const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec((s || '').trim());
      if (!m) return null;
      const o = m.slice(1).map(Number);
      if (o.some(x => x > 255)) return null;
      return ((o[0] << 24) | (o[1] << 16) | (o[2] << 8) | o[3]) >>> 0;
    },
    int2ip(n) { return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.'); },
    parsePrefix(s) {
      const m = /^(\d{1,3}(?:\.\d{1,3}){3})\s*\/\s*(\d{1,2})$/.exec((s || '').trim());
      if (!m) return null;
      const ip = RA.util.ip2int(m[1]);
      const n = Number(m[2]);
      if (ip === null || n < 0 || n > 32) return null;
      return { ip, n };
    },
    fmtPrefix(ip, n) { return RA.util.int2ip(ip) + '/' + n; },
    maskOf(n) { return n === 0 ? 0 : (~((1 << (32 - n)) - 1)) >>> 0; },
    fmtMask(n) { return RA.util.int2ip(RA.util.maskOf(n)); },
    inSub(ip, net, size) { return ip >= net && ip < net + size; },

    norm(t) { return (t || '').toLowerCase().replace(/\s+/g, ' '); },

    // ---- DOM ----
    h(tag, attrs, ...kids) {
      const el = document.createElement(tag);
      if (attrs) for (const k in attrs) {
        if (k === 'class') el.className = attrs[k];
        else if (k === 'text') el.textContent = attrs[k];
        else if (k === 'html') el.innerHTML = attrs[k];
        else if (k.startsWith('on')) el.addEventListener(k.slice(2), attrs[k]);
        else el.setAttribute(k, attrs[k]);
      }
      for (const kid of kids.flat(9)) {
        if (kid === null || kid === undefined || kid === false) continue;
        el.appendChild(typeof kid === 'string' ? document.createTextNode(kid) : kid);
      }
      return el;
    },
    clear(el) { while (el && el.firstChild) el.removeChild(el.firstChild); },

    // feedback su un input: verde se ok, rosso + messaggio (in modalità aiuti) se err
    fb(input, ok, msg) {
      if (!input) return;
      input.classList.remove('ok', 'err');
      input.classList.add(ok ? 'ok' : 'err');
      let f = input.nextElementSibling;
      if (f && f.classList && f.classList.contains('fb')) f.remove();
      if (!ok && msg) {
        f = RA.util.h('div', { class: 'fb' }, msg);
        f.setAttribute('style', 'white-space:normal');
        input.insertAdjacentElement('afterend', f);
      }
    },
    resetFb(root) {
      root.querySelectorAll('.ok,.err').forEach(i => i.classList.remove('ok', 'err'));
      root.querySelectorAll('.fb').forEach(f => f.remove());
    },

    // copertura parole chiave: groups = [ [sinonimo, sinonimo...], ... ]
    kwCoverage(text, groups) {
      const t = RA.util.norm(text);
      let found = 0;
      const missing = [];
      groups.forEach((g, i) => {
        if (g.some(kw => t.includes(RA.util.norm(kw)))) found++;
        else missing.push(i);
      });
      return { found, total: groups.length, missing };
    },
    pct(a, b) { return b === 0 ? 1 : a / b; }
  };
})();
