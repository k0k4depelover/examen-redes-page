/* ===== Servidor simulado del "caso integral" (Desarrollo Web · Parcial II) =====
   Reproduce, SIN red, las reglas del PHP del profe (repo donaldosorio/Examen-Desarrollo-Web):
     · modo 'original'  → login.php, recurso.php (ResourceService::show) y cambiar_password.php tal cual.
     · modo 'corregido' → las reglas de la lista "Reglas que debe cumplir la versión corregida" del README.
   Todo es síncrono y puro: sirve en el navegador, en un Worker y en Node (module.exports).
   Las contraseñas son inventadas para la práctica (el SQL del profe solo trae hashes).
   Las respuestas son JSON en ambos modos (el PHP real devuelve HTML en login.php y recurso.php). */
function crearWeb2API() {
  'use strict';

  /* ---------- Datos de partida (portal.sql + 2 recursos extra para poder probar más casos) ---------- */
  const DATOS = () => ({
    usuarios: [
      { id: 1, nombre: 'Ana Cliente', email: 'ana@example.test', pass: 'ana12345', rol: 'cliente', activo: 1 },
      { id: 2, nombre: 'Bruno Admin', email: 'bruno@example.test', pass: 'bruno12345', rol: 'admin', activo: 1 },
      { id: 3, nombre: 'Carla Inactiva', email: 'carla@example.test', pass: 'carla12345', rol: 'cliente', activo: 0 }
    ],
    recursos: [
      { id: 1, titulo: 'Manual de ventas', descripcion: 'Documento interno de ejemplo', propietario_id: 1, estado: 'publicado', visible: 1 },
      { id: 2, titulo: 'Plan anual de TI', descripcion: 'Documento restringido de ejemplo', propietario_id: 2, estado: 'publicado', visible: 1 },
      // 3 y 4 NO están en portal.sql: se agregaron para las pruebas de "no publicado" y "visible = 0"
      { id: 3, titulo: 'Borrador de política de TI', descripcion: 'Aún no se publica', propietario_id: 2, estado: 'borrador', visible: 1 },
      { id: 4, titulo: 'Presupuesto reservado', descripcion: 'Solo dirección', propietario_id: 2, estado: 'publicado', visible: 0 }
    ],
    // tabla accesos_recursos de portal.sql: (recurso, usuario, rol, puede_ver, puede_editar)
    accesos: [
      { recurso_id: 1, usuario_id: 1, rol: 'cliente', puede_ver: 1, puede_editar: 0 },
      { recurso_id: 2, usuario_id: 2, rol: 'admin', puede_ver: 1, puede_editar: 1 }
    ]
  });

  const GENERICO = 'No se pudo cambiar la contraseña';

  function crear(modo) {
    let db, sesiones, n, intentosInestable;
    const corregido = () => modo === 'corregido';
    function reset() { db = DATOS(); sesiones = {}; n = 0; intentosInestable = 0; }
    reset();

    const nuevoSid = () => 'sid' + (++n) + Math.random().toString(36).slice(2, 7);
    const nuevoCsrf = () => 'csrf' + Math.random().toString(36).slice(2, 10);
    const usuarioPor = id => db.usuarios.find(u => u.id === id) || null;
    const recursoPor = id => db.recursos.find(r => r.id === id) || null;

    /* Auth::user(): la sesión solo nos dice QUÉ id; el resto se lee de la "BD". */
    function usuarioDeSesion(sid) {
      const s = sesiones[sid]; if (!s || typeof s.user_id !== 'number') return null;
      return usuarioPor(s.user_id);
    }
    const pub = r => ({ id: r.id, titulo: r.titulo, descripcion: r.descripcion, estado: r.estado, visible: r.visible });
    const res = (status, body, traza, extra) => Object.assign({ status, body, traza: traza || [] }, extra || {});

    /* ======================= LOGIN ======================= */
    function login(req) {
      const t = [];
      const body = req.body && typeof req.body === 'object' ? req.body : {};
      if (!corregido()) {
        const email = body.email == null ? '' : String(body.email), password = body.password == null ? '' : String(body.password);
        const u = db.usuarios.find(x => x.email === email);
        t.push(u ? 'SELECT * FROM usuarios WHERE email = :email → encontró la cuenta' : 'SELECT … → sin fila');
        if (u && u.pass === password && u.activo) {
          const sid = nuevoSid(); sesiones[sid] = { user_id: u.id, csrf: nuevoCsrf() };
          t.push('password_verify OK y activo = 1 → session_regenerate_id + $_SESSION[user_id]');
          t.push('⚠ redirige a recurso.php?id=1&rol=' + u.rol + '&acceso=1 (el rol viaja en la URL)');
          return res(302, { location: 'recurso.php?id=1&rol=' + encodeURIComponent(u.rol) + '&acceso=1' }, t, { sid });
        }
        t.push(u ? (u.activo ? 'contraseña incorrecta' : 'cuenta inactiva') + ' → mismo mensaje genérico (pero status 200 y sin validar método ni formato)' : 'sin cuenta → mismo mensaje genérico');
        return res(200, { message: 'No se pudo iniciar sesión.' }, t);
      }
      // --- corregido: método → datos → credenciales → activa → sesión ---
      if (req.method !== 'POST') return res(405, { message: 'Método no permitido' }, ['1. ¿método esperado? No: solo POST']);
      t.push('1. método POST ✓');
      const email = typeof body.email === 'string' ? body.email.trim() : '', password = typeof body.password === 'string' ? body.password : '';
      if (!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(email) || !password || password.length > 200)
        return res(400, { message: 'Datos inválidos' }, t.concat('2. ¿campos presentes y con formato válido? No → se corta antes de tocar la BD'));
      t.push('2. campos presentes y con formato válido ✓');
      const u = db.usuarios.find(x => x.email === email);
      // un solo mensaje y un solo status para "no existe", "contraseña mala" e "inactiva" (no se puede enumerar correos)
      if (!u || u.pass !== password || !u.activo)
        return res(401, { message: 'Credenciales inválidas' }, t.concat('3-5. cuenta existe + password_verify + activa: alguna falló → respuesta general 401, sin decir cuál'));
      t.push('3. credenciales ✓ · 4. password_verify ✓ · 5. cuenta activa ✓');
      const sid = nuevoSid(); sesiones[sid] = { user_id: u.id, csrf: nuevoCsrf() };
      t.push('6. session_regenerate_id(true) → cookie nueva; el rol NO se envía al cliente');
      return res(200, { message: 'Sesión iniciada', usuario: { nombre: u.nombre } }, t, { sid });
    }

    /* ======================= RECURSO ======================= */
    /* Copia fiel de ResourceService::show (modo original). */
    function mostrarOriginal(q, user, t) {
      if (user === null) { t.push('sin sesión → 401'); return res(401, { message: 'Debe iniciar sesión' }, t); }
      if (user.activo != 1) { t.push('cuenta inactiva → 403'); return res(403, { message: 'Cuenta inactiva' }, t); }
      if (q.id === undefined) { t.push('falta id → 400'); return res(400, { message: 'Falta ID' }, t); }
      if (q.id === '' || isNaN(Number(q.id))) { t.push('is_numeric(id) es falso → 400'); return res(400, { message: 'ID inválido' }, t); }
      const r = recursoPor(parseInt(q.id, 10));
      if (!r) { t.push('no existe → 404'); return res(404, { message: 'No encontrado' }, t); }
      if (r.estado !== 'publicado') { t.push('estado ≠ publicado → 404 (incluso para el dueño y el admin)'); return res(404, { message: 'No encontrado' }, t); }
      t.push('rol y acceso de la URL: NO se leen (ResourceService solo usa $request[\'id\'])');
      if (user.rol === 'admin') { t.push('rol (de la BD) = admin → 200'); return res(200, { resource: pub(r) }, t); }
      if (r.propietario_id == user.id) { t.push('es el propietario → 200'); return res(200, { resource: pub(r) }, t); }
      if (user.rol === 'cliente' && r.visible == 1) { t.push('⚠ cliente + visible = 1 → 200 (no mira accesos_recursos: cualquier cliente ve cualquier recurso publicado y visible)'); return res(200, { resource: pub(r) }, t); }
      t.push('ninguna regla aplica → 403 (y con eso confirma que el recurso existe)');
      return res(403, { message: 'Sin permiso' }, t);
    }
    /* Política del modo corregido: guard clauses + decisión por rol y relación. */
    function puedeVer(user, r) {
      if (user.rol === 'admin') return 'admin ve todos los recursos (decisión de política)';
      if (r.propietario_id === user.id) return 'propietario';
      const a = db.accesos.find(x => x.recurso_id === r.id && x.usuario_id === user.id && x.puede_ver === 1);
      if (a && r.estado === 'publicado') return 'fila en accesos_recursos con puede_ver = 1 y recurso publicado';
      return null;
    }
    function mostrarCorregido(q, user, t) {
      if (user === null) { t.push('1. sesión válida: no → 401'); return res(401, { message: 'Debe iniciar sesión' }, t); }
      t.push('1. sesión válida ✓ (identidad = sesión, no la URL)');
      if (user.activo !== 1) { t.push('2. cuenta activa (leída de la BD): no → 403'); return res(403, { message: 'Cuenta inactiva' }, t); }
      t.push('2. cuenta activa (leída de la BD) ✓');
      if (!/^[1-9]\d{0,9}$/.test(String(q.id === undefined ? '' : q.id))) { t.push('3. id es entero positivo: no → 400'); return res(400, { message: 'ID inválido' }, t); }
      t.push('3. id entero positivo ✓ (consulta con parámetro, nunca concatenada)');
      t.push('rol y acceso de la URL ignorados por completo');
      const r = recursoPor(parseInt(q.id, 10));
      const motivo = r && puedeVer(user, r);
      if (!r || !motivo) {
        t.push(!r ? '4. el recurso no existe → 404' : '4. existe pero no tiene relación autorizada → el MISMO 404 (no revela que existe)');
        return res(404, { message: 'No encontrado' }, t);
      }
      t.push('4. permiso concedido: ' + motivo);
      return res(200, { resource: pub(r) }, t);
    }
    function recurso(req) {
      const t = [], user = usuarioDeSesion(req.sid), q = req.query || {};
      if (req.method !== 'GET' && corregido()) return res(405, { message: 'Método no permitido' }, ['solo GET']);
      return corregido() ? mostrarCorregido(q, user, t) : mostrarOriginal(q, user, t);
    }

    /* ======================= CAMBIAR CONTRASEÑA ======================= */
    function cambiarPassword(req) {
      const t = [], body = req.body && typeof req.body === 'object' ? req.body : {};
      if (!corregido()) {
        const id = body.user_id === undefined ? null : body.user_id;
        t.push('$userId = $body[\'user_id\'] → ' + JSON.stringify(id) + ' (sale del JSON del cliente; nunca se mira la sesión)');
        const u = db.usuarios.find(x => x.id === id);
        if (!u || u.pass !== (body.current_password === undefined ? '' : body.current_password)) {
          t.push('no existe esa cuenta o la contraseña actual no coincide con ELLA → 400');
          return res(400, { message: GENERICO }, t);
        }
        if (body.new_password === undefined) { t.push('password_hash(null) lanza TypeError en PHP 8 → 500'); return res(500, { message: 'Error interno' }, t); }
        u.pass = String(body.new_password);
        t.push('⚠ UPDATE usuarios SET password … WHERE id = ' + u.id + ' (sin sesión, sin CSRF, sin validar la nueva contraseña)');
        return res(200, { message: 'Contraseña actualizada' }, t);
      }
      if (req.method !== 'POST') return res(405, { message: 'Método no permitido' }, ['1. solo POST']);
      t.push('1. método POST ✓');
      const s = sesiones[req.sid], user = usuarioDeSesion(req.sid);
      if (!user) return res(401, { message: 'Debe iniciar sesión' }, t.concat('2. el usuario sale de la sesión: no hay sesión → 401 (el user_id del JSON ni se mira)'));
      t.push('2. usuario = sesión → ' + user.nombre + ' (el user_id del JSON se ignora)');
      if (user.activo !== 1) return res(403, { message: 'Cuenta inactiva' }, t.concat('3. cuenta activa: no → 403'));
      t.push('3. cuenta activa ✓');
      if (typeof body.csrf !== 'string' || body.csrf !== s.csrf) return res(403, { message: 'Token CSRF inválido' }, t.concat('4. token CSRF de la sesión: no coincide → 403'));
      t.push('4. CSRF ✓');
      if (typeof body.current_password !== 'string' || user.pass !== body.current_password)
        return res(400, { message: GENERICO }, t.concat('5. password_verify(actual) contra LA cuenta de la sesión: falló → 400 genérico'));
      t.push('5. contraseña actual ✓');
      const n = typeof body.new_password === 'string' ? body.new_password : '';
      if (n.length < 8 || !/[A-Za-z]/.test(n) || !/\d/.test(n) || n === body.current_password)
        return res(422, { message: 'La nueva contraseña debe tener 8+ caracteres, letras y números, y ser distinta de la actual' }, t.concat('6. validar la nueva contraseña: no cumple → 422'));
      t.push('6. nueva contraseña válida ✓');
      user.pass = n;
      Object.keys(sesiones).forEach(k => { if (k !== req.sid && sesiones[k].user_id === user.id) delete sesiones[k]; });
      s.csrf = nuevoCsrf();
      t.push('7. UPDATE solo de esa cuenta (password_hash) + se cierran las otras sesiones y se renueva el token');
      return res(200, { message: 'Contraseña actualizada' }, t);
    }

    /* ======================= CUENTA (pantalla: entrega el token CSRF) ======================= */
    function cuenta(req) {
      const user = usuarioDeSesion(req.sid);
      if (!user) return res(401, { message: 'Debe iniciar sesión' }, ['sin sesión']);
      return res(200, { usuario: { nombre: user.nombre }, csrf: corregido() ? sesiones[req.sid].csrf : undefined }, ['sesión ✓' + (corregido() ? ' → el servidor incrusta el token CSRF en la página' : ' (el modo original no tiene CSRF)')]);
    }

    /* ======================= Endpoint de práctica: falla las primeras N veces (503) ======================= */
    function inestable(req) {
      const q = req.query || {}, fallos = Math.max(0, parseInt(q.fallos, 10) || 0);
      intentosInestable++;
      if (intentosInestable <= fallos) return res(503, { message: 'Servicio no disponible' }, ['intento ' + intentosInestable + ' de ' + fallos + ' que fallan']);
      return res(200, { ok: true, intento: intentosInestable }, ['intento ' + intentosInestable + ' → responde bien']);
    }

    const RUTAS = { '/login': login, '/recurso': recurso, '/api/cambiar_password': cambiarPassword, '/cuenta': cuenta, '/api/inestable': inestable };

    /* req = { method, path, query:{}, body:{}, sid } → { status, body, traza[], sid? } */
    function handle(req) {
      const r = Object.assign({ method: 'GET', query: {}, body: null, sid: null }, req);
      r.method = String(r.method).toUpperCase();
      const f = RUTAS[r.path];
      if (!f) return res(404, { message: 'Ruta no encontrada: ' + r.path }, ['no existe esa ruta en el simulador']);
      return f(r);
    }
    /* Conveniencia: "/recurso?id=2&rol=admin" → { path, query } */
    function parseUrl(url) {
      const i = String(url).indexOf('?'), path = i < 0 ? String(url) : String(url).slice(0, i), query = {};
      if (i >= 0) String(url).slice(i + 1).split('&').forEach(p => { if (!p) return; const j = p.indexOf('='), k = decodeURIComponent((j < 0 ? p : p.slice(0, j)).replace(/\+/g, ' ')); query[k] = j < 0 ? '' : decodeURIComponent(p.slice(j + 1).replace(/\+/g, ' ')); });
      return { path: path.replace(/^(\.\.\/|\.\/)+/, '/').replace(/^\/?(public\/)?/, '/').replace(/^\/(recurso|login|cuenta)\.php$/, '/$1'), query };
    }
    const estado = () => ({ modo, usuarios: db.usuarios.map(u => ({ id: u.id, nombre: u.nombre, email: u.email, rol: u.rol, activo: u.activo, pass: u.pass })), sesiones: Object.keys(sesiones).map(k => ({ sid: k, user_id: sesiones[k].user_id })) });
    const desactivar = id => { const u = usuarioPor(id); if (u) u.activo = 0; };
    return { modo, handle, parseUrl, reset, estado, desactivar, DATOS };
  }

  /* ======================= Matriz de 14 pruebas manuales (Pista 8) =======================
     Cada prueba corre en un servidor nuevo. `pasos` se ejecutan en orden; se compara el status del ÚLTIMO.
     esperado = { original, corregido } (status HTTP). `dato` = qué dato confiable decide en el modo corregido. */
  const LOGIN_ANA = { tipo: 'login', email: 'ana@example.test', password: 'ana12345' };
  const LOGIN_BRUNO = { tipo: 'login', email: 'bruno@example.test', password: 'bruno12345' };
  const PRUEBAS = [
    { id: 1, nombre: 'Visitante sin sesión', usuario: 'nadie', manipulado: '—', pasos: [{ tipo: 'req', method: 'GET', path: '/recurso', query: { id: '1' } }],
      esperado: { original: 401, corregido: 401 }, dato: 'la sesión: no existe' },
    { id: 2, nombre: 'Usuario inactivo intenta entrar (Carla)', usuario: 'Carla (activo = 0)', manipulado: 'credenciales correctas', pasos: [{ tipo: 'login', email: 'carla@example.test', password: 'carla12345' }],
      esperado: { original: 200, corregido: 401 }, dato: 'la BD: activo = 0 (y respuesta general)' },
    { id: 3, nombre: 'Cuenta desactivada con la sesión ya abierta', usuario: 'Ana', manipulado: 'el admin la desactiva después de entrar', pasos: [LOGIN_ANA, { tipo: 'desactivar', id: 1 }, { tipo: 'req', method: 'GET', path: '/recurso', query: { id: '1' } }],
      esperado: { original: 403, corregido: 403 }, dato: 'la BD, consultada en cada petición' },
    { id: 4, nombre: 'Cliente ve su propio recurso', usuario: 'Ana (cliente)', manipulado: '—', pasos: [LOGIN_ANA, { tipo: 'req', method: 'GET', path: '/recurso', query: { id: '1' } }],
      esperado: { original: 200, corregido: 200 }, dato: 'propietario_id = id de la sesión' },
    { id: 5, nombre: 'Cliente cambia el id por el de otro recurso', usuario: 'Ana (cliente)', manipulado: 'id=2 (recurso de Bruno)', pasos: [LOGIN_ANA, { tipo: 'req', method: 'GET', path: '/recurso', query: { id: '2' } }],
      esperado: { original: 200, corregido: 404 }, dato: 'relación autorizada (propietario o accesos_recursos)' },
    { id: 6, nombre: 'Rol y acceso cambiados en la URL', usuario: 'Ana (cliente)', manipulado: 'id=4&rol=admin&acceso=1', pasos: [LOGIN_ANA, { tipo: 'req', method: 'GET', path: '/recurso', query: { id: '4', rol: 'admin', acceso: '1' } }],
      esperado: { original: 403, corregido: 404 }, dato: 'rol leído de la BD (la URL se ignora)' },
    { id: 7, nombre: 'SQL en el id', usuario: 'Ana (cliente)', manipulado: "id=1 OR 1=1", pasos: [LOGIN_ANA, { tipo: 'req', method: 'GET', path: '/recurso', query: { id: '1 OR 1=1' } }],
      esperado: { original: 400, corregido: 400 }, dato: 'validación del formato + consulta con parámetros' },
    { id: 8, nombre: 'Recurso inexistente', usuario: 'Ana (cliente)', manipulado: 'id=99', pasos: [LOGIN_ANA, { tipo: 'req', method: 'GET', path: '/recurso', query: { id: '99' } }],
      esperado: { original: 404, corregido: 404 }, dato: 'la BD: no hay fila' },
    { id: 9, nombre: 'Recurso en borrador (no publicado), de otra persona', usuario: 'Ana (cliente)', manipulado: 'id=3', pasos: [LOGIN_ANA, { tipo: 'req', method: 'GET', path: '/recurso', query: { id: '3' } }],
      esperado: { original: 404, corregido: 404 }, dato: 'estado del recurso + propietario' },
    { id: 10, nombre: 'HTML / SQL en el correo del login', usuario: 'visitante', manipulado: "email = ' OR '1'='1", pasos: [{ tipo: 'login', email: "' OR '1'='1", password: 'x' }],
      esperado: { original: 200, corregido: 400 }, dato: 'validación del formato antes de tocar la BD' },
    { id: 11, nombre: 'user_id cambiado en el fetch', usuario: 'Ana (cliente)', manipulado: 'user_id=2 + la contraseña de Bruno', pasos: [LOGIN_ANA, { tipo: 'req', method: 'POST', path: '/api/cambiar_password', body: { user_id: 2, current_password: 'bruno12345', new_password: 'Nueva2026x', csrf: '@csrf' } }],
      esperado: { original: 200, corregido: 400 }, dato: 'la cuenta sale de la sesión (Ana), no del JSON' },
    { id: 12, nombre: 'Cambiar contraseña sin iniciar sesión', usuario: 'nadie', manipulado: 'user_id=1 + la contraseña de Ana', pasos: [{ tipo: 'req', method: 'POST', path: '/api/cambiar_password', body: { user_id: 1, current_password: 'ana12345', new_password: 'Nueva2026x' } }],
      esperado: { original: 200, corregido: 401 }, dato: 'la sesión: no existe' },
    { id: 13, nombre: 'Contraseña actual incorrecta', usuario: 'Ana (cliente)', manipulado: 'current_password=equivocada', pasos: [LOGIN_ANA, { tipo: 'req', method: 'POST', path: '/api/cambiar_password', body: { user_id: 1, current_password: 'equivocada', new_password: 'Nueva2026x', csrf: '@csrf' } }],
      esperado: { original: 400, corregido: 400 }, dato: 'password_verify contra la cuenta de la sesión' },
    { id: 14, nombre: 'Nueva contraseña inválida', usuario: 'Ana (cliente)', manipulado: 'new_password=123', pasos: [LOGIN_ANA, { tipo: 'req', method: 'POST', path: '/api/cambiar_password', body: { user_id: 1, current_password: 'ana12345', new_password: '123', csrf: '@csrf' } }],
      esperado: { original: 200, corregido: 422 }, dato: 'reglas de la contraseña en el servidor' }
  ];

  /* Ejecuta una prueba en un servidor nuevo del modo dado. Devuelve { status, traza, body, pasos[] }. */
  function ejecutarPrueba(prueba, modo) {
    const s = crear(modo); let sid = null, ultimo = null; const pasos = [];
    prueba.pasos.forEach(p => {
      if (p.tipo === 'desactivar') { s.desactivar(p.id); pasos.push('El administrador desactiva la cuenta ' + p.id); return; }
      if (p.tipo === 'login') {
        ultimo = s.handle({ method: 'POST', path: '/login', body: { email: p.email, password: p.password } });
        if (ultimo.sid) sid = ultimo.sid; pasos.push('POST /login ' + p.email + ' → ' + ultimo.status); return;
      }
      let body = p.body;
      if (body && body.csrf === '@csrf') { const c = s.handle({ method: 'GET', path: '/cuenta', sid }); body = Object.assign({}, body, { csrf: c.body.csrf }); }
      ultimo = s.handle({ method: p.method, path: p.path, query: p.query, body, sid });
      pasos.push(p.method + ' ' + p.path + (p.query ? '?' + Object.keys(p.query).map(k => k + '=' + p.query[k]).join('&') : '') + (body ? ' ' + JSON.stringify(body) : '') + ' → ' + ultimo.status);
    });
    return { status: ultimo.status, body: ultimo.body, traza: ultimo.traza, pasos };
  }

  return { crear, PRUEBAS, ejecutarPrueba };
}

(function () {
  const API = crearWeb2API();
  if (typeof window !== 'undefined') { window.crearWeb2API = crearWeb2API; window.Web2API = API; }
  if (typeof module !== 'undefined' && module.exports) module.exports = Object.assign({ crearWeb2API }, API);
})();
