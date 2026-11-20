// ============================================================
// RetiApp · chat-export.js — prepara il testo dell'esercizio
// + compilazione dell'utente, da incollare in chat per la correzione
// ============================================================
(function () {
  const RA = window.RetiApp;
  const U = RA.util;

  function open(root, text) {
    let panel = root.querySelector('.chat-export');
    if (panel) panel.remove();

    const ta = U.h('textarea', { class: 'cell ta', readonly: 'readonly', rows: '16', spellcheck: 'false' });
    ta.value = text;

    const status = U.h('span', { class: 'small', style: 'align-self:center' }, '');

    const btn = U.h('button', {
      class: 'btn primary', text: '📋 Copia',
      onclick: async () => {
        let ok = false;
        try { await navigator.clipboard.writeText(text); ok = true; }
        catch (e) {
          try { ta.focus(); ta.select(); ok = document.execCommand('copy'); } catch (e2) { ok = false; }
        }
        if (ok) status.textContent = '✓ copiato: incollalo pure qui in chat';
        else {
          ta.focus(); ta.select();
          status.textContent = 'copia automatica bloccata: il testo è selezionato, premi ⌘C (o Ctrl+C)';
        }
      }
    });

    panel = U.h('div', { class: 'card chat-export' },
      U.h('h4', {}, '📝 Testo pronto per la correzione in chat'),
      U.h('p', { class: 'small' },
        'Qui sotto c\'è il testo dell\'esercizio con la tua compilazione (i campi che non hai ancora riempito appaiono come "__"). ',
        'Copia tutto e incollalo in chat: lo correggo io spiegandoti cosa è sbagliato e perché, senza darti subito la soluzione completa.'),
      ta,
      U.h('div', { class: 'btn-bar' },
        btn, status,
        U.h('button', { class: 'btn ghost', text: '✕ Chiudi', onclick: () => panel.remove() })));

    root.appendChild(panel);
    ta.focus(); ta.select();
    panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  RA.chat = { open };
})();
