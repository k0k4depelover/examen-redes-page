/* ===== Datos de Desarrollo Web · Parcial II (window.WEB2) =====
   Ejercicios de fetch (corregidos por comportamiento), diagnóstico del caso integral, quiz y preguntas abiertas.
   Sirve en Node: require('./js/web2-datos.js') → { EJERCICIOS, DIAGNOSTICO, QUIZ, ABIERTAS, correr }. */

/* Ejecuta el código del alumno contra un servidor simulado. Es autocontenida (se inyecta en un Worker con toString()).
   Devuelve { resultados:[{n, ok, d}], error, consola:[] }. */
async function web2Correr(codigo, ej, crearAPI) {
  const consola = [], peticiones = [];
  let srv = null, sid = null, activas = 0, maxActivas = 0;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const API = crearAPI();
  const resultados = [];
  const H = {
    peticiones, resultados,
    montar(cfg) {
      srv = API.crear(cfg.modo || 'corregido'); sid = null; peticiones.length = 0; maxActivas = 0;
      if (cfg.login) { const u = { ana: ['ana@example.test', 'ana12345'], bruno: ['bruno@example.test', 'bruno12345'] }[cfg.login]; sid = srv.handle({ method: 'POST', path: '/login', body: { email: u[0], password: u[1] } }).sid; }
    },
    maxActivas: () => maxActivas,
    check(n, ok, d) { resultados.push({ n, ok: !!ok, d: d || '' }); },
    /* ejecuta f y devuelve { v } o { e: mensaje } */
    async probar(f) { try { return { v: await f() }; } catch (e) { return { e: String((e && e.message) || e) }; } }
  };
  async function fetch(url, opts) {
    opts = opts || {};
    const reg = { method: String(opts.method || 'GET').toUpperCase(), url: String(url), headers: opts.headers || {}, cuerpoCrudo: opts.body == null ? null : opts.body, body: null, jsonValido: true };
    peticiones.push(reg);
    if (typeof opts.body === 'string') { try { reg.body = JSON.parse(opts.body); } catch (e) { reg.jsonValido = false; reg.body = {}; } } else if (opts.body != null) { reg.jsonValido = false; reg.body = {}; }
    activas++; if (activas > maxActivas) maxActivas = activas;
    await new Promise(r => setTimeout(r, 6));
    const u = srv.parseUrl(reg.url);
    const r = srv.handle({ method: reg.method, path: u.path, query: u.query, body: reg.body, sid });
    if (r.sid) sid = r.sid;
    activas--;
    const texto = JSON.stringify(r.body === undefined ? null : r.body);
    return { ok: r.status >= 200 && r.status < 300, status: r.status, statusText: String(r.status), headers: { get: () => 'application/json' }, json: async () => JSON.parse(texto), text: async () => texto };
  }
  let F;
  try {
    const exporta = '{' + ej.exporta.join(',') + '}';
    F = new Function('fetch', 'esc', 'console', '"use strict";\n' + codigo + '\n;return ' + exporta + ';')(fetch, esc, { log: (...a) => consola.push(a.map(String).join(' ')) });
  } catch (e) {
    const m = String((e && e.message) || e);
    return { resultados: [], consola, error: /is not defined/.test(m) ? 'Falta definir ' + m.replace(' is not defined', '') + ' (¿escribiste el nombre exacto de la función?)' : 'Error en tu código: ' + m };
  }
  try { await (0, eval)('(' + ej.pruebas + ')')(F, H); } catch (e) { return { resultados, consola, error: 'Tu función lanzó un error no esperado: ' + String((e && e.message) || e) }; }
  return { resultados, consola, error: null };
}

(function () {
  /* ======================= 8 ejercicios de fetch y plantillas =======================
     Cada uno: titulo, tema, enunciado (HTML), exporta (nombres que debe definir el alumno), inicial, solucion, pistas[],
     pruebas (función async (F, H) → usa H.montar / H.check / H.probar / H.peticiones). */
  const EJERCICIOS = [
    {
      id: 'e1', titulo: 'Leer un recurso y distinguir el 404', tema: 'fetch GET',
      enunciado: 'Ana (cliente) ya inició sesión en el servidor <b>corregido</b>. Escribe <code>obtenerRecurso(id)</code>: pide <code>/recurso?id=…</code>, devuelve el objeto <code>resource</code> si hay 200, <code>null</code> si el servidor responde 404 y <b>lanza un Error</b> con cualquier otro fallo (400, 401…). Recuerda: <code>fetch</code> <u>no</u> rechaza la promesa por un 404.',
      exporta: ['obtenerRecurso'],
      inicial: 'async function obtenerRecurso(id) {\n  // 1) pide /recurso?id=… (codifica el id)\n  // 2) 404 → return null\n  // 3) !ok → throw new Error(...)\n  // 4) devuelve el campo resource del JSON\n}\n',
      solucion: 'async function obtenerRecurso(id) {\n  const respuesta = await fetch(\'/recurso?id=\' + encodeURIComponent(id));\n  if (respuesta.status === 404) return null;\n  if (!respuesta.ok) throw new Error(\'HTTP \' + respuesta.status);\n  const datos = await respuesta.json();\n  return datos.resource;\n}\n',
      pistas: ['fetch solo rechaza por error de red. Un 404 o un 500 llegan como respuesta normal: revisa respuesta.status / respuesta.ok.', 'El cuerpo JSON se lee con await respuesta.json().', 'encodeURIComponent(id) evita que un id raro como "1 OR 1=1" rompa la URL.'],
      pruebas: async function (F, H) {
        H.montar({ modo: 'corregido', login: 'ana' });
        const a = await H.probar(() => F.obtenerRecurso(1));
        H.check('id 1 → recurso "Manual de ventas"', a.v && a.v.titulo === 'Manual de ventas', a.e || JSON.stringify(a.v));
        const b = await H.probar(() => F.obtenerRecurso(2));
        H.check('id 2 (ajeno) → null, no lanza', b.v === null, b.e || 'devolvió ' + JSON.stringify(b.v));
        const c = await H.probar(() => F.obtenerRecurso(99));
        H.check('id 99 (no existe) → null', c.v === null, c.e || 'devolvió ' + JSON.stringify(c.v));
        const d = await H.probar(() => F.obtenerRecurso('abc'));
        H.check('id "abc" (400) → lanza Error', d.e !== undefined, d.e ? d.e : 'no lanzó nada');
        await H.probar(() => F.obtenerRecurso('1 OR 1=1'));
        const u = H.peticiones[H.peticiones.length - 1];
        H.check('codifica el id en la URL (sin espacios crudos)', u && !/ /.test(u.url), u ? u.url : 'sin petición');
      }
    },
    {
      id: 'e2', titulo: 'Iniciar sesión con POST y JSON', tema: 'fetch POST',
      enunciado: 'Escribe <code>entrar(email, password)</code>: envía un <b>POST</b> a <code>/login</code> con el cuerpo en JSON y la cabecera <code>Content-Type: application/json</code>. Devuelve <code>true</code> si entró y <code>false</code> si no. Las credenciales <u>nunca</u> van en la URL.',
      exporta: ['entrar'],
      inicial: 'async function entrar(email, password) {\n  // POST /login con JSON\n}\n',
      solucion: 'async function entrar(email, password) {\n  const respuesta = await fetch(\'/login\', {\n    method: \'POST\',\n    headers: { \'Content-Type\': \'application/json\' },\n    body: JSON.stringify({ email, password })\n  });\n  return respuesta.ok;\n}\n',
      pistas: ['fetch(url, { method, headers, body }): el segundo argumento es un objeto de opciones.', 'El body debe ser un string: JSON.stringify({ … }).', 'respuesta.ok es true solo con status 200–299.'],
      pruebas: async function (F, H) {
        H.montar({ modo: 'corregido' });
        const a = await H.probar(() => F.entrar('ana@example.test', 'ana12345'));
        H.check('credenciales correctas → true', a.v === true, a.e || 'devolvió ' + JSON.stringify(a.v));
        const p = H.peticiones[0] || {};
        H.check('usa el método POST', p.method === 'POST', 'método: ' + p.method);
        const cab = Object.keys(p.headers || {}).find(k => k.toLowerCase() === 'content-type');
        H.check('cabecera Content-Type: application/json', cab && /json/i.test(p.headers[cab]), cab ? p.headers[cab] : 'falta la cabecera');
        H.check('el cuerpo es JSON válido con email y password', p.jsonValido && p.body && p.body.email === 'ana@example.test' && p.body.password === 'ana12345', p.cuerpoCrudo === null ? 'no enviaste body' : String(p.cuerpoCrudo));
        H.check('las credenciales no van en la URL', !/password|ana12345/.test(p.url || ''), p.url);
        H.montar({ modo: 'corregido' });
        const b = await H.probar(() => F.entrar('ana@example.test', 'equivocada'));
        H.check('contraseña incorrecta → false (no lanza)', b.v === false, b.e || 'devolvió ' + JSON.stringify(b.v));
        H.montar({ modo: 'corregido' });
        const c = await H.probar(() => F.entrar('carla@example.test', 'carla12345'));
        H.check('cuenta inactiva → false', c.v === false, b.e || 'devolvió ' + JSON.stringify(c.v));
      }
    },
    {
      id: 'e3', titulo: 'Cambiar contraseña sin user_id', tema: 'fetch + CSRF',
      enunciado: 'Es la corrección de <code>cuenta.js</code>. Escribe <code>cambiarPassword(actual, nueva)</code>: primero pide <code>GET /cuenta</code> para obtener el token <code>csrf</code>; luego hace <code>POST /api/cambiar_password</code> con <code>current_password</code>, <code>new_password</code> y <code>csrf</code>. <b>No envíes <code>user_id</code></b>: la cuenta sale de la sesión. Devuelve <code>{ ok, mensaje }</code> (mensaje = el campo <code>message</code> del JSON).',
      exporta: ['cambiarPassword'],
      inicial: 'async function cambiarPassword(actual, nueva) {\n  // 1) GET /cuenta → csrf\n  // 2) POST /api/cambiar_password (sin user_id)\n  // 3) return { ok, mensaje }\n}\n',
      solucion: 'async function cambiarPassword(actual, nueva) {\n  const cuenta = await (await fetch(\'/cuenta\')).json();\n  const respuesta = await fetch(\'/api/cambiar_password\', {\n    method: \'POST\',\n    headers: { \'Content-Type\': \'application/json\' },\n    body: JSON.stringify({ current_password: actual, new_password: nueva, csrf: cuenta.csrf })\n  });\n  const datos = await respuesta.json();\n  return { ok: respuesta.ok, mensaje: datos.message };\n}\n',
      pistas: ['El token CSRF no se inventa en el cliente: el servidor lo entrega en GET /cuenta.', 'Dos awaits encadenados: await fetch(...) y luego await respuesta.json().', 'Devuelve el mensaje aunque falle: la interfaz lo mostrará con textContent.'],
      pruebas: async function (F, H) {
        H.montar({ modo: 'corregido', login: 'ana' });
        const a = await H.probar(() => F.cambiarPassword('ana12345', 'Nueva2026x'));
        H.check('datos correctos → { ok: true }', a.v && a.v.ok === true, a.e || JSON.stringify(a.v));
        const post = H.peticiones.find(p => p.method === 'POST') || {};
        H.check('NO envía user_id', post.body && !('user_id' in post.body), JSON.stringify(post.body));
        H.check('envía el token csrf', post.body && typeof post.body.csrf === 'string' && post.body.csrf.length > 3, JSON.stringify(post.body));
        H.check('envía current_password y new_password', post.body && post.body.current_password === 'ana12345' && post.body.new_password === 'Nueva2026x', JSON.stringify(post.body));
        H.montar({ modo: 'corregido', login: 'ana' });
        const b = await H.probar(() => F.cambiarPassword('equivocada', 'Nueva2026x'));
        H.check('contraseña actual mala → ok:false con mensaje', b.v && b.v.ok === false && typeof b.v.mensaje === 'string' && b.v.mensaje.length > 0, b.e || JSON.stringify(b.v));
        H.montar({ modo: 'corregido', login: 'ana' });
        const c = await H.probar(() => F.cambiarPassword('ana12345', '123'));
        H.check('nueva contraseña débil (422) → ok:false y explica por qué', c.v && c.v.ok === false && /8/.test(c.v.mensaje || ''), b.e || JSON.stringify(c.v));
      }
    },
    {
      id: 'e4', titulo: 'Reintentar cuando el servidor falla', tema: 'errores HTTP',
      enunciado: 'El endpoint <code>/api/inestable?fallos=N</code> responde <b>503</b> las primeras N veces y luego 200. Escribe <code>cargarConReintento(url, intentos)</code>: hace hasta <code>intentos</code> peticiones; devuelve el JSON de la primera que salga bien, o <code>null</code> si se agotan. No hagas más peticiones de las necesarias.',
      exporta: ['cargarConReintento'],
      inicial: 'async function cargarConReintento(url, intentos) {\n  // for … hasta intentos; si respuesta.ok → return json\n}\n',
      solucion: 'async function cargarConReintento(url, intentos) {\n  for (let i = 1; i <= intentos; i++) {\n    const respuesta = await fetch(url);\n    if (respuesta.ok) return respuesta.json();\n  }\n  return null;\n}\n',
      pistas: ['Un 503 no lanza excepción: tienes que mirar respuesta.ok dentro del ciclo.', 'Sal del ciclo con return en cuanto una petición salga bien.', 'Después del for, return null.'],
      pruebas: async function (F, H) {
        H.montar({ modo: 'corregido' });
        const a = await H.probar(() => F.cargarConReintento('/api/inestable?fallos=2', 3));
        H.check('falla 2 veces y a la 3.ª funciona → objeto con ok:true', a.v && a.v.ok === true, a.e || JSON.stringify(a.v));
        H.check('hizo exactamente 3 peticiones', H.peticiones.length === 3, 'hizo ' + H.peticiones.length);
        H.montar({ modo: 'corregido' });
        const b = await H.probar(() => F.cargarConReintento('/api/inestable?fallos=5', 2));
        H.check('si se agotan los intentos → null', b.v === null, b.e || JSON.stringify(b.v));
        H.check('no pasa de 2 peticiones', H.peticiones.length === 2, 'hizo ' + H.peticiones.length);
        H.montar({ modo: 'corregido' });
        await H.probar(() => F.cargarConReintento('/api/inestable?fallos=0', 3));
        H.check('si funciona a la primera, solo 1 petición', H.peticiones.length === 1, 'hizo ' + H.peticiones.length);
      }
    },
    {
      id: 'e5', titulo: 'Varias peticiones en paralelo', tema: 'Promise.all',
      enunciado: 'Escribe <code>titulosVisibles(ids)</code>: pide <code>/recurso?id=…</code> de <b>todos</b> los ids a la vez (no uno por uno) y devuelve la lista de títulos de los que sí se pudieron ver, en el mismo orden. Los que respondan 404 se omiten.',
      exporta: ['titulosVisibles'],
      inicial: 'async function titulosVisibles(ids) {\n  // Promise.all + map, luego filtra las que no sean ok\n}\n',
      solucion: 'async function titulosVisibles(ids) {\n  const respuestas = await Promise.all(ids.map(id => fetch(\'/recurso?id=\' + id)));\n  const titulos = [];\n  for (const respuesta of respuestas) {\n    if (respuesta.ok) titulos.push((await respuesta.json()).resource.titulo);\n  }\n  return titulos;\n}\n',
      pistas: ['ids.map(id => fetch(...)) crea un arreglo de promesas sin esperar ninguna.', 'await Promise.all(promesas) espera a todas y conserva el orden.', 'Un await dentro de un for…of sí es secuencial: úsalo solo para leer el JSON, no para pedir.'],
      pruebas: async function (F, H) {
        H.montar({ modo: 'corregido', login: 'ana' });
        const a = await H.probar(() => F.titulosVisibles([1, 2, 3, 4, 99]));
        H.check('Ana solo ve el recurso 1', a.v && a.v.length === 1 && a.v[0] === 'Manual de ventas', a.e || JSON.stringify(a.v));
        H.check('las 5 peticiones se lanzaron a la vez (paralelo)', H.maxActivas() >= 5, 'máximo simultáneo: ' + H.maxActivas());
        H.montar({ modo: 'corregido', login: 'bruno' });
        const b = await H.probar(() => F.titulosVisibles([4, 1, 99, 2]));
        H.check('Bruno (admin) ve 3 y conserva el orden pedido', b.v && JSON.stringify(b.v) === JSON.stringify(['Presupuesto reservado', 'Manual de ventas', 'Plan anual de TI']), a.e || JSON.stringify(b.v));
      }
    },
    {
      id: 'e6', titulo: 'Plantilla de una tarjeta con escape', tema: 'plantillas · XSS',
      enunciado: 'Escribe <code>renderTarjeta(recurso)</code>: devuelve el HTML <code>&lt;article class="tarjeta"&gt;&lt;h3&gt;título&lt;/h3&gt;&lt;p&gt;descripción&lt;/p&gt;&lt;span class="estado"&gt;estado&lt;/span&gt;&lt;/article&gt;</code>. Los datos vienen del servidor (o de otro usuario): <b>escápalos</b> con la función <code>esc()</code> que ya existe.',
      exporta: ['renderTarjeta'],
      inicial: 'function renderTarjeta(recurso) {\n  return \'\';\n}\n',
      solucion: 'function renderTarjeta(recurso) {\n  return \'<article class="tarjeta">\' +\n    \'<h3>\' + esc(recurso.titulo) + \'</h3>\' +\n    \'<p>\' + esc(recurso.descripcion) + \'</p>\' +\n    \'<span class="estado">\' + esc(recurso.estado) + \'</span>\' +\n    \'</article>\';\n}\n',
      pistas: ['esc(texto) convierte < > & " \' en entidades HTML.', 'Escapa cada valor que venga de fuera, no la plantilla completa (perderías tus propias etiquetas).', 'Se escapa al insertar en el HTML, no al guardar en la base de datos.'],
      pruebas: async function (F, H) {
        const ok = { titulo: 'Manual', descripcion: 'Texto', estado: 'publicado' };
        const a = await H.probar(() => F.renderTarjeta(ok));
        H.check('estructura: <article class="tarjeta"> con h3, p y span', typeof a.v === 'string' && /^<article class="tarjeta"><h3>Manual<\/h3><p>Texto<\/p><span class="estado">publicado<\/span><\/article>$/.test(a.v), a.e || String(a.v));
        const b = await H.probar(() => F.renderTarjeta({ titulo: '<img src=x onerror=alert(1)>', descripcion: 'x', estado: 'x' }));
        H.check('un título con <img onerror> NO genera etiqueta', typeof b.v === 'string' && b.v.indexOf('<img') < 0 && b.v.indexOf('&lt;img') >= 0, b.e || String(b.v));
        const c = await H.probar(() => F.renderTarjeta({ titulo: 'a', descripcion: 'Ventas & TI', estado: 'x' }));
        H.check('& se convierte en &amp;', typeof c.v === 'string' && c.v.indexOf('Ventas &amp; TI') >= 0, c.e || String(c.v));
        const d = await H.probar(() => F.renderTarjeta({ titulo: '" onmouseover="robar()', descripcion: 'x', estado: 'x' }));
        H.check('las comillas dobles se escapan (&quot;)', typeof d.v === 'string' && d.v.indexOf('&quot;') >= 0 && d.v.indexOf('"robar') < 0, d.e || String(d.v));
      }
    },
    {
      id: 'e7', titulo: 'Un motor de plantillas de {{ llaves }}', tema: 'plantillas',
      enunciado: 'Escribe <code>renderPlantilla(plantilla, datos)</code>: reemplaza cada <code>{{clave}}</code> por el valor escapado de <code>datos</code>. Debe aceptar espacios (<code>{{ nombre }}</code>) y rutas con punto (<code>{{usuario.rol}}</code>). Si la clave no existe, deja vacío. Ojo: el número <code>0</code> es un valor válido.',
      exporta: ['renderPlantilla'],
      inicial: 'function renderPlantilla(plantilla, datos) {\n  return plantilla;\n}\n',
      solucion: 'function renderPlantilla(plantilla, datos) {\n  return plantilla.replace(/\\{\\{\\s*([\\w.]+)\\s*\\}\\}/g, (_, ruta) => {\n    const valor = ruta.split(\'.\').reduce((o, k) => (o == null ? undefined : o[k]), datos);\n    return valor == null ? \'\' : esc(valor);\n  });\n}\n',
      pistas: ['String.replace acepta una expresión regular con /g y una función que devuelve el reemplazo.', 'La regex: /\\{\\{\\s*([\\w.]+)\\s*\\}\\}/g → el grupo 1 es la ruta ("usuario.rol").', 'Para rutas: ruta.split(".").reduce((obj, k) => obj?.[k], datos). Y compara con == null, no con ||, o perderás el 0.'],
      pruebas: async function (F, H) {
        const t = (plantilla, datos) => H.probar(() => F.renderPlantilla(plantilla, datos));
        let r = await t('Hola {{nombre}}', { nombre: 'Ana' });
        H.check('sustituye {{nombre}}', r.v === 'Hola Ana', r.e || String(r.v));
        r = await t('Hola {{ nombre }}!', { nombre: 'Ana' });
        H.check('acepta espacios dentro de las llaves', r.v === 'Hola Ana!', r.e || String(r.v));
        r = await t('Rol: {{usuario.rol}}', { usuario: { rol: 'admin' } });
        H.check('rutas con punto ({{usuario.rol}})', r.v === 'Rol: admin', r.e || String(r.v));
        r = await t('[{{falta}}]', { nombre: 'x' });
        H.check('clave inexistente → vacío', r.v === '[]', r.e || String(r.v));
        r = await t('Quedan {{n}}', { n: 0 });
        H.check('el número 0 se imprime ("0")', r.v === 'Quedan 0', r.e || String(r.v));
        r = await t('<p>{{texto}}</p>', { texto: '<script>x</script>' });
        H.check('escapa el valor pero no la plantilla', r.v === '<p>&lt;script&gt;x&lt;/script&gt;</p>', r.e || String(r.v));
        r = await t('Sin marcas', {});
        H.check('sin marcas devuelve la plantilla igual', r.v === 'Sin marcas', r.e || String(r.v));
      }
    },
    {
      id: 'e8', titulo: 'Construir una URL con parámetros', tema: 'URL · query string',
      enunciado: 'Escribe <code>construirURL(base, params)</code>: arma <code>base?clave=valor&…</code> <b>codificando</b> los valores (espacios, &amp;, acentos). Ignora los parámetros con valor <code>null</code> o <code>undefined</code>; si no queda ninguno, devuelve solo la base. El <code>0</code> sí se conserva.',
      exporta: ['construirURL'],
      inicial: 'function construirURL(base, params) {\n  return base;\n}\n',
      solucion: 'function construirURL(base, params) {\n  const q = new URLSearchParams();\n  for (const [clave, valor] of Object.entries(params)) {\n    if (valor !== null && valor !== undefined) q.append(clave, valor);\n  }\n  const texto = q.toString();\n  return texto ? base + \'?\' + texto : base;\n}\n',
      pistas: ['URLSearchParams codifica por ti: q.append(clave, valor) y q.toString().', 'Object.entries(params) da pares [clave, valor].', 'Filtra con !== null && !== undefined (no con "if (valor)", que pierde el 0).'],
      pruebas: async function (F, H) {
        const p = (b, o) => { const r = F.construirURL(b, o); const i = r.indexOf('?'); return { base: i < 0 ? r : r.slice(0, i), q: i < 0 ? {} : Object.fromEntries(new URLSearchParams(r.slice(i + 1))), crudo: r }; };
        let r = await H.probar(() => p('/recurso', { id: 2 }));
        H.check('/recurso + {id:2} → /recurso?id=2', r.v && r.v.crudo === '/recurso?id=2', r.e || (r.v && r.v.crudo));
        r = await H.probar(() => p('/buscar', { q: 'a b&c', n: 'ñandú' }));
        H.check('codifica espacios, & y acentos (se recuperan intactos)', r.v && r.v.q.q === 'a b&c' && r.v.q.n === 'ñandú' && !/ /.test(r.v.crudo), r.e || (r.v && r.v.crudo));
        r = await H.probar(() => p('/x', { a: 1, b: null, c: undefined }));
        H.check('ignora null y undefined', r.v && r.v.crudo === '/x?a=1', r.e || (r.v && r.v.crudo));
        r = await H.probar(() => p('/x', {}));
        H.check('sin parámetros → solo la base (sin "?")', r.v && r.v.crudo === '/x', r.e || (r.v && r.v.crudo));
        r = await H.probar(() => p('/x', { id: 0 }));
        H.check('el 0 se conserva', r.v && r.v.crudo === '/x?id=0', r.e || (r.v && r.v.crudo));
      }
    }
  ];
  EJERCICIOS.forEach(e => { e.pruebasSrc = String(e.pruebas); });

  /* ======================= Diagnóstico del caso integral: 14 hallazgos =======================
     cat: aut (autenticación) · auz (autorización) · dat (datos) · dis (diseño) · man (mantenibilidad) · sev: 3 alta, 2 media, 1 baja */
  const CATS = { aut: 'Autenticación', auz: 'Autorización', dat: 'Datos', dis: 'Diseño', man: 'Mantenibilidad' };
  const DIAGNOSTICO = [
    { cat: 'aut', sev: 3, donde: 'api/cambiar_password.php', hallazgo: 'No exige sesión: cambia la contraseña de la cuenta que diga el JSON.', impacto: 'Con un user_id ajeno y la contraseña actual de esa cuenta se cambia sin haber iniciado sesión (se verificó en el código del profe).', alt: 'Auth::user() al inicio; si no hay usuario → 401. El user_id del JSON no se lee.' },
    { cat: 'auz', sev: 3, donde: 'public/js/cuenta.js', hallazgo: 'El navegador fija data.user_id = 1 y el servidor lo cree.', impacto: 'Cualquiera edita el JSON (DevTools, curl) y apunta a otra cuenta. Es la "pista principal".', alt: 'Quitar user_id del cliente; el servidor toma la cuenta de la sesión.' },
    { cat: 'aut', sev: 3, donde: 'api/cambiar_password.php', hallazgo: 'Sin verificación del método HTTP ni token CSRF; acepta cualquier método.', impacto: 'Otro sitio podría hacer que el navegador de la víctima dispare el cambio; un GET/OPTIONS tampoco se rechaza.', alt: 'Exigir POST (405 si no), token CSRF de la sesión (403 si no coincide).' },
    { cat: 'dat', sev: 2, donde: 'api/cambiar_password.php', hallazgo: 'No valida la nueva contraseña: acepta "123", vacía, e incluso cae en error 500 si falta (password_hash(null)).', impacto: 'Contraseñas débiles; errores internos que filtran comportamiento.', alt: 'Validar longitud/composición, que sea distinta de la actual y devolver 422 con un mensaje claro.' },
    { cat: 'aut', sev: 2, donde: 'api/cambiar_password.php', hallazgo: 'No comprueba que la cuenta esté activa ni cierra otras sesiones tras el cambio.', impacto: 'Una cuenta inactiva puede cambiar su contraseña; una sesión robada sigue viva después del cambio.', alt: 'Verificar activo = 1, invalidar las demás sesiones y renovar el token.' },
    { cat: 'aut', sev: 2, donde: 'public/login.php', hallazgo: 'El flujo no sigue el orden método → datos → credenciales → cuenta activa → sesión; no valida formato y usa SELECT *.', impacto: 'Se consulta la BD con datos sin validar y se trae el hash completo sin necesidad.', alt: 'Orden de la Pista 3; SELECT solo de las columnas necesarias; 405/400 tempranos.' },
    { cat: 'aut', sev: 1, donde: 'src/Auth.php', hallazgo: 'session_start() sin opciones de cookie (HttpOnly, Secure, SameSite) y sin límite de intentos de login.', impacto: 'La cookie queda más expuesta (XSS, CSRF) y se permite fuerza bruta.', alt: 'session_set_cookie_params con httponly/secure/samesite y limitar intentos por cuenta e IP.', ded: true },
    { cat: 'auz', sev: 3, donde: 'public/login.php', hallazgo: 'Tras entrar redirige a recurso.php?id=1&rol=<rol>&acceso=1: el rol y el acceso viajan en la URL.', impacto: 'Enseña a confiar en la URL y filtra el rol. Aunque recurso.php hoy no los lee, invita a que alguien lo haga.', alt: 'Redirigir sin rol ni acceso: la identidad sale de la sesión y el rol de la BD.' },
    { cat: 'auz', sev: 3, donde: 'src/ResourceService.php', hallazgo: 'Un cliente ve CUALQUIER recurso publicado con visible = 1; nunca consulta accesos_recursos.', impacto: 'Ana (cliente) abre el "Plan anual de TI" de Bruno con id=2. La tabla de accesos no sirve de nada.', alt: 'Exigir relación autorizada: propietario o fila en accesos_recursos con puede_ver = 1.' },
    { cat: 'auz', sev: 2, donde: 'src/ResourceService.php', hallazgo: 'Devuelve 403 "Sin permiso" a un recurso ajeno y 404 a uno inexistente.', impacto: 'Permite enumerar qué ids existen: 403 = existe pero no es tuyo.', alt: 'Mismo 404 y mismo mensaje público para inexistente y ajeno.' },
    { cat: 'auz', sev: 2, donde: 'src/ResourceService.php', hallazgo: 'Un recurso que no está "publicado" da 404 a todos, incluso a su propietario y al admin; y el admin ve todo sin distinguir la acción (ver/editar).', impacto: 'El dueño no puede ver su propio borrador; no hay política por acción.', alt: 'Matriz rol × propietario × estado × acción (p. ej. match). El propietario ve sus borradores.', ded: true },
    { cat: 'man', sev: 2, donde: 'src/ResourceService.php', hallazgo: 'Ocho niveles de if anidados mezclan autenticación, rol, estado y construcción de la respuesta.', impacto: 'Difícil de leer, de probar y de cambiar sin romper otra regla.', alt: 'Guard clauses (retornos tempranos), funciones pequeñas con nombre y una política de permisos.' },
    { cat: 'dis', sev: 1, donde: 'public/js/cuenta.js', hallazgo: 'Muestra response.text() tal cual (JSON crudo) sin mirar response.ok ni manejar errores de red.', impacto: 'El usuario ve {"message":"…"} y un fallo de red lanza una excepción sin capturar.', alt: 'try/catch, revisar response.ok, leer response.json() y mostrar data.message con textContent.' },
    { cat: 'dat', sev: 2, donde: 'database/portal.sql', hallazgo: 'Columnas repetidas (email/correo, rol/rol_nombre, propietario_nombre/propietario_email), sin NOT NULL ni UNIQUE(email), estados como texto libre, sin índices, y accesos_recursos repite rol y no tiene UNIQUE(recurso_id, usuario_id).', impacto: 'Si el correo cambia hay que actualizar dos columnas; nada impide duplicados ni estados como "publicdo".', alt: 'Una sola fuente por dato; tabla roles; ENUM o tabla de estados; NOT NULL; UNIQUE; índices en las claves foráneas.' }
  ];

  /* ======================= Preguntas directas (categoría, pregunta, opciones, correcta, explicación) ======================= */
  const QUIZ = [
    ['Web y HTTP', '¿Qué hace el DNS?', ['Cifra la comunicación entre navegador y servidor', 'Traduce un nombre como umg.edu.gt en la dirección IP del servidor', 'Guarda las páginas web en caché', 'Asigna la IP a cada usuario'], 1, 'Es la "agenda de contactos" de Internet: nombre legible → IP.'],
    ['Web y HTTP', 'El usuario no ha iniciado sesión y pide una página privada. ¿Qué código HTTP corresponde?', ['200', '401', '404', '500'], 1, '401 = no autenticado. 403 = autenticado pero sin permiso. 404 = no existe. 500 = fallo del servidor.'],
    ['Web y HTTP', '¿Qué método HTTP es el adecuado para enviar datos nuevos en el cuerpo de la petición?', ['GET', 'POST', 'OPTIONS', 'Ninguno: los datos van en la URL'], 1, 'POST envía datos en el body. GET los pone en la URL y no debe usarse para credenciales.'],
    ['Web y HTTP', 'Una petición (request) se compone de…', ['Código de estado, headers y body', 'Método, URL, headers y (opcional) body', 'Solo la URL', 'Dominio y dirección IP'], 1, 'La respuesta es la que trae el código de estado.'],
    ['Web y HTTP', '¿Qué aporta HTTPS frente a HTTP?', ['Hace el sitio más rápido', 'Cifra y valida la comunicación con claves criptográficas', 'Evita el XSS', 'Elimina la necesidad de contraseñas'], 1, 'HTTPS = HTTP + TLS: protege la conexión, pero no arregla un XSS ni un control de acceso roto.'],
    ['HTML y CSS', '¿Qué etiqueta agrupa los enlaces principales de navegación?', ['<header>', '<nav>', '<aside>', '<main>'], 1, '<nav> define el bloque de navegación. <main> es el contenido principal y debe haber uno solo.'],
    ['HTML y CSS', 'Del centro hacia afuera, el modelo de cajas es…', ['margin, border, padding, content', 'content, padding, border, margin', 'content, border, padding, margin', 'padding, content, margin, border'], 1, 'Contenido → relleno (padding, espacio interno) → borde → margen (espacio externo).'],
    ['HTML y CSS', '@media (max-width: 768px) { … } aplica los estilos…', ['Solo si la pantalla mide más de 768 px', 'Hasta esa anchura (pantallas de 768 px o menos)', 'Solo en impresión', 'Siempre'], 1, 'max-width = hasta ese tamaño; min-width = desde ese tamaño. Mobile First se escribe con min-width.'],
    ['HTML y CSS', '¿Para qué sirve <label for="nombre">?', ['Para dar estilo al input', 'Para asociar el texto al campo con id="nombre" (accesibilidad y clic)', 'Para validar el campo', 'Para enviar el formulario'], 1, 'El lector de pantalla anuncia el label y luego el tipo de campo.'],
    ['HTML y CSS', 'Flexbox vs Grid: ¿cuál es la diferencia principal?', ['Flexbox es solo para móvil', 'Flexbox distribuye en una dimensión; Grid en dos (filas y columnas)', 'Grid no admite gap', 'No hay diferencia'], 1, 'Flexbox: barras y filas o columnas. Grid: galerías y layouts con columnas controladas.'],
    ['JavaScript y DOM', 'if (true) { var mensaje = "Hola"; } console.log(mensaje); ¿qué imprime?', ['ReferenceError', '"Hola"', 'undefined', 'null'], 1, 'var tiene alcance de función; let y const, de bloque (con ellos daría ReferenceError).'],
    ['JavaScript y DOM', '¿Qué devuelve console.log("1" === 1)?', ['true', 'false', 'undefined', 'Error'], 1, '=== compara valor y tipo: string ≠ number.'],
    ['JavaScript y DOM', 'document.querySelectorAll("p")…', ['Devuelve solo el primer <p>', 'Devuelve todos los <p> que coinciden con el selector', 'Devuelve un booleano', 'Modifica los <p>'], 1, 'querySelector devuelve el primero; querySelectorAll, todos.'],
    ['JavaScript y DOM', '¿Qué hace event.preventDefault() en un evento "submit"?', ['Envía el formulario dos veces', 'Evita el envío y la recarga por defecto para manejarlo con JS', 'Borra los campos', 'Valida el formulario'], 1, 'Es lo que permite enviar con fetch sin recargar la página.'],
    ['JavaScript y DOM', '¿Qué eventos pueden afectar el rendimiento si su listener hace trabajo costoso?', ['click', 'scroll, mousemove y resize (se disparan muchísimas veces)', 'submit', 'Ninguno'], 1, 'Un click rara vez importa; scroll/mousemove/resize se repiten y conviene que su función sea liviana.'],
    ['PHP y APIs', '¿Dónde se ejecuta el código PHP?', ['En el navegador', 'En el servidor: el cliente solo recibe el resultado', 'En el DNS', 'En ambos'], 1, 'Por eso el cliente no puede ver el código que generó el HTML.'],
    ['PHP y APIs', '¿Qué guarda $_SESSION y cómo se identifica al visitante?', ['Datos entre peticiones, con un identificador de sesión (cookie o URL)', 'Solo las cookies del navegador', 'Variables de JavaScript', 'El historial de navegación'], 0, 'session_start() recupera la sesión del visitante. En el caso integral, de ahí sale la identidad.'],
    ['PHP y APIs', 'De los tipos de API de la clase, ¿cuál es la más popular y flexible hoy?', ['SOAP', 'RPC', 'REST', 'WebSocket'], 2, 'REST: el cliente hace solicitudes y el servidor responde (normalmente JSON). WebSocket es bidireccional.'],
    ['fetch', 'Haces fetch("/recurso?id=99") y el servidor responde 404. ¿Qué pasa con la promesa?', ['Se rechaza y cae en catch', 'Se resuelve normalmente; hay que revisar response.ok / status', 'Se queda pendiente', 'Lanza un SyntaxError'], 1, 'fetch solo se rechaza ante fallos de red. Los status 4xx/5xx llegan como respuesta.'],
    ['fetch', 'Para enviar un objeto como JSON con fetch…', ['body: objeto', 'headers Content-Type: application/json y body: JSON.stringify(objeto)', 'method: "JSON"', 'Basta con la URL'], 1, 'El body debe ser string; la cabecera dice cómo interpretarlo.'],
    ['fetch', '¿Qué devuelve respuesta.json()?', ['El objeto directamente', 'Una promesa: hay que usar await', 'Un string', 'Un booleano'], 1, 'const datos = await respuesta.json();'],
    ['fetch', 'Necesitas pedir 5 recursos sin esperar a que termine cada uno. Usas…', ['Un for con await dentro', 'Promise.all(ids.map(id => fetch(…)))', 'setInterval', 'XMLHttpRequest síncrono'], 1, 'Promise.all lanza todas a la vez y conserva el orden del arreglo.'],
    ['Plantillas y XSS', 'Un comentario de un usuario se inserta con elemento.innerHTML = comentario. ¿Cuál es el riesgo?', ['Ninguno', 'XSS: el navegador interpreta etiquetas y atributos como <img onerror=…>', 'Se pierde el comentario', 'Error de sintaxis'], 1, 'Usa textContent o escapa antes de insertar.'],
    ['Plantillas y XSS', 'Un comentario malicioso se guarda en la base de datos y ataca a cada visitante. ¿Qué tipo de XSS es?', ['Reflejado', 'Almacenado (Stored)', 'Basado en DOM', 'CSRF'], 1, 'Reflejado: viaja en la URL/formulario y vuelve en la respuesta. DOM: ocurre solo en el navegador.'],
    ['Plantillas y XSS', 'Al escapar, el carácter < se convierte en…', ['&gt;', '&lt;', '&amp;', '&quot;'], 1, '& → &amp; · < → &lt; · > → &gt; · " → &quot;.'],
    ['Plantillas y XSS', 'Content-Security-Policy: default-src \'self\' permite…', ['Cargar recursos de cualquier origen', 'Solo recursos del mismo origen del sitio (sin subdominios)', 'Solo HTTPS', 'Nada'], 1, '*.trusted.com añadiría ese dominio y sus subdominios. Es una defensa adicional, no sustituye escapar.'],
    ['Caso integral', 'recurso.php?id=2&rol=admin&acceso=1. ¿Qué puede hacer el servidor con "rol" y "acceso"?', ['Usarlos para decidir el permiso', 'Ignorarlos: el rol vigente sale de la sesión y la BD', 'Compararlos con un token', 'Guardarlos en cookie'], 1, 'La URL solo identifica la solicitud; es manipulable.'],
    ['Caso integral', 'cuenta.js envía user_id en el JSON. ¿Cuál es la corrección?', ['Cifrar el user_id', 'Quitarlo: la cuenta sale de la sesión en el servidor', 'Ponerlo en una cookie', 'Validarlo con JavaScript'], 1, 'Cualquier dato del cliente es editable; lo confiable está en la sesión y la BD.'],
    ['Caso integral', '¿Cómo se guardan y comprueban las contraseñas en PHP?', ['md5 y ==', 'password_hash() y password_verify()', 'En texto plano cifrado con base64', 'Solo en la sesión'], 1, 'password_hash incluye sal y costo; nunca se guarda la contraseña.'],
    ['Caso integral', '¿Por qué conviene el mismo 404 para un recurso inexistente y uno ajeno?', ['Es más rápido', 'Para no revelar qué ids existen', 'Porque 403 no existe', 'Por compatibilidad con HTML'], 1, 'Con 403 un atacante enumera los recursos que existen.'],
    ['Caso integral', 'Una consulta preparada (PDO prepare + execute) sirve para…', ['Acelerar cualquier consulta', 'Separar la instrucción SQL de los datos y evitar la inyección SQL', 'Cifrar la base de datos', 'Evitar el XSS'], 1, 'Los parámetros nunca se concatenan al SQL.'],
    ['Caso integral', 'El ResourceService tiene 8 ifs anidados. ¿Qué técnica propone la pista 7?', ['Más comentarios', 'Guard clauses (retornos tempranos), funciones pequeñas y match/política de permisos', 'Un solo if gigante', 'Cambiar a JavaScript'], 1, 'Además: no cambiar reglas, nombres y estructura a la vez; comprobar los mismos escenarios antes y después.'],
    ['Caso integral', 'Tras un login correcto, ¿qué se debe hacer con el identificador de sesión?', ['Dejarlo igual', 'Regenerarlo (session_regenerate_id(true))', 'Enviarlo en la URL', 'Guardarlo en localStorage'], 1, 'Evita la fijación de sesión.']
  ];

  /* ======================= Preguntas abiertas ======================= */
  const ABIERTAS = [
    { q: 'Explica qué ocurre desde que escribes una URL en el navegador hasta que ves la página.', a: 'El navegador pide al <b>DNS</b> la IP del dominio. Abre la conexión con el servidor (con <b>HTTPS</b> se cifra con TLS) y envía una <b>request</b> (método GET, URL, headers). El servidor procesa (por ejemplo ejecuta PHP), y responde con un <b>código de estado</b>, headers y un body (HTML). El navegador construye el <b>DOM</b>, pide los recursos adicionales (CSS, JS, imágenes) y dibuja la página.', puntos: ['DNS: nombre → IP', 'Request: método, URL, headers, body', 'Response: código de estado, headers, body', 'HTTP vs HTTPS', 'El navegador arma el DOM y pide CSS/JS/imágenes'] },
    { q: '¿Por qué la validación en el HTML o en JavaScript no es suficiente?', a: 'Todo lo que corre en el navegador puede ser editado o saltado (DevTools, curl, un fetch manual). La validación del cliente mejora la experiencia, pero el <b>servidor debe repetir las validaciones críticas</b>: formato, permisos, existencia del recurso, estado de la cuenta.', puntos: ['El cliente es manipulable', 'Sirve para la experiencia de usuario', 'El servidor repite las validaciones críticas', 'Ejemplo: required o user_id del fetch'] },
    { q: 'En el caso integral, ¿qué datos de la solicitud no se deben creer y de dónde sale lo confiable?', a: 'No se creen el <code>id</code>, <code>rol</code> y <code>acceso</code> de la URL, ni el <code>user_id</code> o los campos del JSON: son datos de solicitud que el cliente puede cambiar. La <b>identidad</b> sale de la sesión (la cookie solo ayuda a encontrarla); la <b>cuenta activa, el rol vigente, el recurso, su propietario y sus accesos</b> se consultan en la base de datos con consultas preparadas.', puntos: ['URL, formulario y JSON son manipulables', 'La sesión da la identidad', 'Rol, estado y relación salen de la BD', 'Consultas con parámetros'] },
    { q: 'Explica el fallo de cambiar_password.php y cómo lo corregirías.', a: 'Usa el <code>user_id</code> del JSON para decidir qué cuenta actualiza y <b>no exige sesión</b>: con el id y la contraseña actual de otra cuenta se cambia sin iniciar sesión. Corrección: obtener el usuario con <code>Auth::user()</code> (401 si no hay), exigir POST y token CSRF, verificar que la cuenta esté activa, comprobar <code>password_verify</code> de la actual, validar la nueva, actualizar solo esa cuenta con <code>password_hash</code> y cerrar las otras sesiones.', puntos: ['user_id del cliente = pista principal', 'Usuario desde la sesión', 'POST + CSRF', 'password_verify / password_hash', 'Validar la nueva contraseña', 'Mensaje genérico'] },
    { q: 'Explica qué es XSS, sus tres tipos y cómo prevenirlo.', a: 'XSS ocurre cuando la aplicación no valida ni codifica lo que escribe el usuario y se ejecuta JavaScript malicioso en el navegador de otros. <b>Almacenado</b>: se guarda en el servidor y se ejecuta con cada visita. <b>Reflejado</b>: viaja en la URL o formulario y vuelve en la respuesta. <b>Basado en DOM</b>: ocurre al modificar el DOM en el cliente. Prevención: <b>escapar al insertar</b> (textContent en vez de innerHTML, esc() en plantillas), validar entradas, librerías seguras y una <b>CSP</b> como capa adicional.', puntos: ['Definición de XSS', 'Almacenado, reflejado, DOM', 'textContent / escape al insertar', 'Validar entradas', 'CSP como defensa extra'] },
    { q: 'Describe cómo consumes una API con fetch y cómo manejas los errores.', a: 'Con <code>await fetch(url, { method, headers, body })</code>. Para JSON: cabecera <code>Content-Type: application/json</code> y <code>JSON.stringify</code>. fetch <b>solo rechaza la promesa ante errores de red</b>; los 4xx/5xx llegan como respuesta, así que reviso <code>respuesta.ok</code> o <code>status</code>. Leo el cuerpo con <code>await respuesta.json()</code>, envuelvo en <code>try/catch</code>, muestro el mensaje con <code>textContent</code> y, si necesito varias peticiones a la vez, uso <code>Promise.all</code>.', puntos: ['fetch con method, headers y body', 'JSON.stringify + Content-Type', 'response.ok / status (404 no rechaza)', 'await response.json()', 'try/catch', 'Promise.all para paralelo'] },
    { q: '¿Qué es una plantilla y por qué hay que escapar los datos?', a: 'Una plantilla es un HTML con huecos (<code>{{titulo}}</code>) que se rellena con datos para generar la interfaz. Como los datos pueden venir de otro usuario o de una API, hay que <b>escaparlos al insertarlos</b> (< → &lt;, & → &amp;, " → &quot;): así el navegador los muestra como texto y no los interpreta como etiquetas ni atributos con eventos (XSS). Se escapa el dato, no la plantilla.', puntos: ['Plantilla = HTML con huecos', 'Datos externos no son confiables', 'Escapar < > & "', 'Escapar el dato, no la plantilla'] },
    { q: 'Explica cómo refactorizarías ResourceService::show.', a: 'Primero describo el comportamiento actual con una tabla de escenarios. Luego extraigo decisiones con nombre (usuario activo, id válido, recurso visible, permiso) y uso <b>guard clauses</b>: cada condición de error retorna temprano (401, 403, 400, 404) y el camino feliz queda plano. La política por rol/propietario/estado/acción se expresa con <code>match</code> o una función <code>puedeVer()</code> que consulta <code>accesos_recursos</code>. Cambio una sola dimensión a la vez y repito los mismos escenarios.', puntos: ['Describir el comportamiento actual', 'Guard clauses', 'Funciones pequeñas con una responsabilidad', 'match / política de permisos', 'Un cambio a la vez + mismos escenarios'] },
    { q: 'Explica Responsive Design, Mobile First y media queries con un ejemplo.', a: 'Responsive es que la página <b>reorganice</b> su contenido según el tamaño de pantalla (no hacer zoom). <b>Mobile First</b>: se diseña primero para celular y se añaden estilos para pantallas mayores con <code>min-width</code>. Las media queries aplican estilos solo si se cumple una condición: <code>@media (max-width:768px){ .contenedor{ flex-direction:column; } }</code>. Breakpoints habituales: celular hasta 767 px, tablet 768–1023 px, escritorio desde 1024 px.', puntos: ['Reorganiza, no hace zoom', 'Mobile First', 'Media queries con ejemplo', 'Breakpoints 767 / 768–1023 / 1024'] },
    { q: '¿Qué mejorarías del SQL de portal.sql y por qué?', a: 'Cada cambio debe resolver una inconsistencia concreta: quitar columnas duplicadas (email/correo, rol/rol_nombre, propietario_nombre/email, que se derivan del propietario), <code>NOT NULL</code> donde el dato es obligatorio, <code>UNIQUE(email)</code>, estados controlados (ENUM o tabla), tabla de roles, <code>UNIQUE(recurso_id, usuario_id)</code> en accesos, e índices en las claves foráneas. No normalizar por reflejo.', puntos: ['Columnas duplicadas → una sola fuente', 'NOT NULL y UNIQUE(email)', 'Estados controlados', 'Roles/permisos separados', 'Índices en claves foráneas'] }
  ];

  const WEB2 = { EJERCICIOS, DIAGNOSTICO, CATS, QUIZ, ABIERTAS, correr: web2Correr };
  if (typeof window !== 'undefined') { window.WEB2 = WEB2; window.web2Correr = web2Correr; }
  if (typeof module !== 'undefined' && module.exports) module.exports = WEB2;
})();
