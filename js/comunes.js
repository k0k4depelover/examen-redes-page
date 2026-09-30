/* ===== Componentes de uso general (window.Comunes) =====
   Sirven para cualquier guía nueva sin depender de un curso concreto. Usan las clases que ya
   existen en css/styles.css (assoc-*, qa, codebox, reto-*), así que no necesitan CSS propio.
   Cargar DESPUÉS de main.js:  <script src="../../js/comunes.js"></script>
   Catálogo y ejemplos de uso: ver CLAUDE.md, sección "Componentes". */
(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  /* localStorage a prueba de fallos (modo privado, cuota llena, JSON roto). */
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  };

  /* Escapa texto para meterlo en HTML. Úsalo SIEMPRE con datos que no sean tuyos. */
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* Al navegar a #id dentro de un <details> cerrado, lo abre. Se activa solo al cargar el script. */
  function abrirHasta(hash) {
    let el = null;
    try { el = hash && hash.length > 1 && document.getElementById(decodeURIComponent(hash.slice(1))); } catch (e) { }
    for (let p = el && el.parentElement; p; p = p.parentElement) if (p.tagName === 'DETAILS' && !p.open) p.open = true;
  }
  document.addEventListener('click', e => { const a = e.target.closest('a[href^="#"]'); if (a) abrirHasta(a.getAttribute('href')); }, true);
  addEventListener('hashchange', () => abrirHasta(location.hash));
  abrirHasta(location.hash);

  /* ---------- Resaltado de código (JS, PHP, SQL, HTML, CSS, JSON) ----------
     Clases: tk-kw palabra clave · tk-type tipo/variable PHP · tk-str cadena · tk-num número · tk-com comentario. */
  const KW = new Set(('const let var function return if else elseif for foreach while do switch case break continue new class extends ' +
    'async await try catch finally throw import export from default typeof instanceof in of this null true false undefined ' +
    'match fn public private protected static final declare namespace use require require_once include echo endif endforeach endwhile ' +
    'SELECT FROM WHERE INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE PRIMARY KEY FOREIGN REFERENCES NOT NULL UNIQUE DEFAULT INDEX ' +
    'AUTO_INCREMENT ENUM JOIN ON AND OR LIMIT ORDER BY CASCADE').split(' '));
  function resaltar(src) {
    const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|--[^\n]*|<!--[\s\S]*?-->|#[^\n]*)|("(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)|(\$[A-Za-z_]\w*)|(\b\d+(?:\.\d+)?\b)|([A-Za-z_][\w-]*)/g;
    let out = '', last = 0, m;
    src = String(src);
    while ((m = re.exec(src))) {
      out += esc(src.slice(last, m.index)); last = re.lastIndex;
      const t = m[0];
      let c = '';
      if (m[1]) c = 'tk-com'; else if (m[2]) c = 'tk-str'; else if (m[3]) c = 'tk-type'; else if (m[4]) c = 'tk-num';
      else if (KW.has(t) || KW.has(t.toUpperCase())) c = 'tk-kw';
      out += c ? `<span class="${c}">${esc(t)}</span>` : esc(t);
    }
    return out + esc(src.slice(last));
  }
  /* Resalta todos los <pre class="code" data-lang="js|php|sql|html|css|json"> (excepto asm, que lo hace arqui2.js). */
  function resaltarPagina(root = document) {
    $$('pre.code[data-lang]', root).forEach(p => { if (p.dataset.lang !== 'asm' && !p.dataset.hl) { p.innerHTML = resaltar(p.textContent); p.dataset.hl = '1'; } });
  }
  const codeBox = (src, titulo) => `<div class="codebox">${titulo ? `<div class="file">${esc(titulo)}</div>` : ''}<pre class="code" data-hl="1">${resaltar(src)}</pre></div>`;

  /* ---------- Preguntas directas (opción múltiple) ----------
     Comunes.quiz('#quizApp', [[categoria, pregunta, [opciones], indiceCorrecto, explicacion], ...]) */
  function quiz(el, datos) {
    el = typeof el === 'string' ? $(el) : el; if (!el) return;
    const cats = ['Todas', ...new Set(datos.map(q => q[0]))];
    let cat = 'Todas', ans = {};
    el.innerHTML = `<div class="assoc-bar"><span class="score" data-q="score"></span><span class="spacer"></span><div class="assoc-tabs" role="tablist">${cats.map(c => `<button type="button" role="tab" data-c="${esc(c)}" aria-selected="${c === cat}">${esc(c)}</button>`).join('')}</div><button type="button" class="btn sec" data-q="reset">Reiniciar</button></div><ol class="assoc-list" data-q="list"></ol>`;
    const paint = () => {
      $('[data-q="list"]', el).innerHTML = datos.map((q, i) => [q, i]).filter(([q]) => cat === 'Todas' || q[0] === cat).map(([q, i]) => {
        const a = ans[i];
        return `<li class="assoc-item${a == null ? '' : a === q[3] ? ' ok' : ' bad'}" data-i="${i}"><div class="q"><span class="qn mono">Q${i + 1}</span> ${esc(q[1])}</div><div class="assoc-opts">${q[2].map((o, j) => `<button type="button" class="assoc-opt${a == null ? '' : j === q[3] ? ' right' : j === a ? ' wrong' : ''}" data-j="${j}"${a != null ? ' disabled' : ''}>${String.fromCharCode(97 + j)}) ${esc(o)}</button>`).join('')}</div>${a != null ? `<p class="assoc-exp"><b>${a === q[3] ? 'Correcto.' : 'Respuesta: ' + String.fromCharCode(97 + q[3]) + ') ' + esc(q[2][q[3]]) + '.'}</b> ${esc(q[4])}</p>` : ''}</li>`;
      }).join('');
      const tot = Object.keys(ans).length, ok = Object.keys(ans).filter(i => ans[i] === datos[i][3]).length;
      $('[data-q="score"]', el).textContent = `${ok} / ${tot} correctas · ${datos.length} preguntas`;
    };
    el.addEventListener('click', e => {
      const t = e.target.closest('[data-c]'); if (t) { cat = t.dataset.c; $$('[data-c]', el).forEach(b => b.setAttribute('aria-selected', String(b === t))); paint(); return; }
      const o = e.target.closest('.assoc-opt'); if (o) { const i = +o.closest('[data-i]').dataset.i; if (ans[i] == null) { ans[i] = +o.dataset.j; paint(); } }
      if (e.target.closest('[data-q="reset"]')) { ans = {}; paint(); }
    });
    paint();
  }

  /* ---------- Preguntas abiertas (texto libre + respuesta modelo + lista de puntos) ----------
     Comunes.abiertas('#abiertasApp', [{q, a, puntos:[...]}], 'clave-localstorage') */
  function abiertas(el, lista, clave) {
    el = typeof el === 'string' ? $(el) : el; if (!el) return;
    const saved = store.get(clave) || {};
    el.innerHTML = lista.map((q, i) => `<details class="qa"><summary><span class="qn">A${i + 1}</span>${esc(q.q)}</summary><div class="ans">
      <label class="small muted" for="${clave}-${i}">Tu respuesta (como la escribirías en el examen):</label>
      <textarea class="reto-code ab-ta" id="${clave}-${i}" data-i="${i}" spellcheck="true">${esc(saved[i] || '')}</textarea>
      <div class="reto-ctrl"><button type="button" class="btn sec" data-ab="${i}">👀 Ver respuesta modelo</button></div>
      <div class="ab-sol" hidden><div class="key ok"><b>Respuesta modelo</b><p>${q.a}</p></div><p class="small"><b>Tu respuesta debería mencionar:</b></p><ul class="reto-check">${q.puntos.map(p => `<li><label><input type="checkbox"><span>${esc(p)}</span></label></li>`).join('')}</ul></div>
    </div></details>`).join('');
    el.addEventListener('input', e => { if (e.target.matches('.ab-ta')) { saved[e.target.dataset.i] = e.target.value; store.set(clave, saved); } });
    el.addEventListener('click', e => { const b = e.target.closest('[data-ab]'); if (b) { const s = b.closest('.ans').querySelector('.ab-sol'); s.hidden = !s.hidden; b.textContent = s.hidden ? '👀 Ver respuesta modelo' : '🙈 Ocultar respuesta'; } });
  }

  /* ---------- Pistas y solución por niveles ----------
     Comunes.pistas(contenedor, ['pista 1', 'pista 2', 'pista 3'])  → botón "💡 Pista n/3" que las revela una a una. */
  function pistas(cont, lista) {
    const btn = document.createElement('button'), ol = document.createElement('ol');
    btn.type = 'button'; btn.className = 'btn sec'; ol.className = 'pistas'; let n = 0;
    const pinta = () => { btn.innerHTML = `💡 Pista <span class="pc">${n}/${lista.length}</span>`; btn.disabled = n >= lista.length; };
    btn.addEventListener('click', () => { if (n < lista.length) { ol.insertAdjacentHTML('beforeend', `<li>${esc(lista[n++])}</li>`); pinta(); } });
    pinta(); cont.append(btn, ol);
  }

  window.Comunes = { $, $$, store, esc, abrirHasta, resaltar, resaltarPagina, codeBox, quiz, abiertas, pistas };
  if (document.readyState !== 'loading') resaltarPagina(); else document.addEventListener('DOMContentLoaded', () => resaltarPagina());
})();
