/* ===== Guía Análisis II: resaltado de código, juego asociativo y reto contrarreloj ===== */
(function () {
  const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  };
  const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  /* ---------- Resaltado de sintaxis (C#, SQL, XML) ---------- */
  const CS_KW = new Set(('abstract as base bool break byte case catch char class const continue decimal default do double else enum event false finally float for foreach get set if in int interface internal is long namespace new null object out override params private protected public readonly ref return sealed short static string struct switch this throw true try typeof uint ulong using var virtual void while value partial').split(' '));
  const CS_TYPES = new Set(('DateTime List IEnumerable DataTable DataRow OdbcConnection OdbcCommand OdbcParameter OdbcDataAdapter OdbcException CommandType Exception MessageBox MessageBoxButtons MessageBoxIcon Form EventArgs Convert ValidationContext ValidationResult Validator String Dictionary KeyValuePair Control UserControl AutoCompleteStringCollection AutoCompleteMode AutoCompleteSource Application STAThread Empleados Repositorio RepositorioMaestro RepositorioEmpleados ModeloEmpleado EstadoEntidad ValidacionDatos ComboI ModeloComboI RepositorioComboI TipoPermiso Proveedores RepositorioProveedores FormManualdeUsuario').split(' '));
  const SQL_KW = new Set(('select from where insert into values value update set delete create table primary key not null auto_increment int varchar date tinyint engine default charset collate character alter add modify like and or order by limit offset text timestamp unique drop database if exists').split(' '));

  function hlCs(src) {
    const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|(@"(?:[^"]|"")*"|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])+')|(\b\d+(?:\.\d+)?\b)|([\p{L}_][\p{L}\p{N}_]*)/gu;
    let out = '', last = 0, prevWord = '', m;
    while ((m = re.exec(src))) {
      const gap = src.slice(last, m.index);
      out += esc(gap);
      if (/\S/.test(gap)) prevWord = '';
      const t = m[0];
      if (m[1]) out += `<span class="tk-com">${esc(t)}</span>`;
      else if (m[2]) out += `<span class="tk-str">${esc(t)}</span>`;
      else if (m[3]) out += `<span class="tk-num">${t}</span>`;
      else {
        const before = src.slice(Math.max(0, m.index - 120), m.index);
        if (CS_KW.has(t)) out += `<span class="tk-kw">${t}</span>`;
        else if (/(^|\n)[ \t]*\[$/.test(before)) out += `<span class="tk-attr">${esc(t)}</span>`;
        else if (CS_TYPES.has(t) || /^(I[A-Z]|Cls|Frm)[A-Za-z]/.test(t) || ['class', 'interface', 'enum', 'new', 'struct'].includes(prevWord)) out += `<span class="tk-type">${esc(t)}</span>`;
        else out += esc(t);
        prevWord = t;
      }
      last = re.lastIndex;
    }
    return out + esc(src.slice(last));
  }
  function hlSql(src) {
    const re = /(--[^\n]*|\/\*[\s\S]*?\*\/)|('(?:[^'\\]|\\.)*')|(`[^`]*`)|(\b\d+\b)|([\p{L}_][\p{L}\p{N}_]*)/gu;
    let out = '', last = 0, m;
    while ((m = re.exec(src))) {
      out += esc(src.slice(last, m.index));
      const t = m[0];
      if (m[1]) out += `<span class="tk-com">${esc(t)}</span>`;
      else if (m[2]) out += `<span class="tk-str">${esc(t)}</span>`;
      else if (m[3]) out += `<span class="tk-type">${esc(t)}</span>`;
      else if (m[4]) out += `<span class="tk-num">${t}</span>`;
      else out += SQL_KW.has(t.toLowerCase()) ? `<span class="tk-kw">${t}</span>` : esc(t);
      last = re.lastIndex;
    }
    return out + esc(src.slice(last));
  }
  function hlXml(src) {
    const re = /(<!--[\s\S]*?-->)|(<\/?[\w.:-]+)|("[^"]*")/g;
    let out = '', last = 0, m;
    while ((m = re.exec(src))) {
      out += esc(src.slice(last, m.index));
      if (m[1]) out += `<span class="tk-com">${esc(m[0])}</span>`;
      else if (m[2]) out += esc(m[0].startsWith('</') ? '</' : '<') + `<span class="tk-kw">${esc(m[0].replace(/^<\/?/, ''))}</span>`;
      else out += `<span class="tk-str">${esc(m[0])}</span>`;
      last = re.lastIndex;
    }
    return out + esc(src.slice(last));
  }
  const HL = { cs: hlCs, sql: hlSql, xml: hlXml };
  $$('pre.code[data-lang]').forEach(pre => {
    const fn = HL[pre.dataset.lang];
    if (fn) pre.innerHTML = fn(pre.textContent);
  });

  /* ---------- Juego asociativo ---------- */
  const RONDAS = {
    capa: {
      opts: ['Modelo', 'Controlador', 'Vista', 'Ejecución'],
      items: [
        ['<code>connectionString = "Dsn=umg_didactica";</code>', 0, 'La conexión solo vive en el Modelo (<code>Repositorio</code>).'],
        ['<code>"INSERT INTO empleados value (NULL, ?, ?, ?, ?)"</code>', 0, 'Todo el SQL está en <code>RepositorioEmpleados</code> (Modelo).'],
        ['<code>interface IRepositorioGenerico&lt;Entity&gt;</code>', 0, 'Carpeta <code>Contratos</code> del Modelo.'],
        ['La entidad <code>public class Empleados { … }</code>', 0, 'Carpeta <code>Entidades</code> del Modelo.'],
        ['<code>EjecucionNonQuery(_comandoTexto, _parametros, _comandoTipo)</code>', 0, '<code>RepositorioMaestro</code>, en el Modelo: ejecuta el SQL.'],
        ['<code>protected OdbcConnection ObtenerConexion()</code>', 0, '<code>Repositorio</code> (Modelo).'],
        ['<code>OdbcDataAdapter.Fill(dtDatos)</code> del ComboI', 0, '<code>RepositorioComboI</code>, en <code>Capa_Modelo_ComboI</code>.'],
        ['Leer columnas, PK y FK de <code>INFORMATION_SCHEMA</code>', 0, '<code>ClsEsquema</code> del Navegador y <code>ClsSentenciasFiltroSimple</code> de Consultas: acceso a datos = Modelo.'],
        ['<code>ClsModeloBitacora</code> (inserta en <code>tblbitacora</code>)', 0, 'Por su nombre y porque escribe en la BD es Modelo; se invoca desde el <code>GrabarCambios</code> del Controlador.'],
        ['<code>[Required]</code> y <code>[StringLength(maximumLength:10, MinimumLength =10)]</code>', 1, 'Se declaran en <code>ModeloEmpleado</code>, la clase del Controlador.'],
        ['<code>switch (Estado) { case EstadoEntidad.Added: … }</code>', 1, '<code>GrabarCambios()</code> decide qué pedir al repositorio: Controlador.'],
        ['<code>enum EstadoEntidad { Added, Deleted, Modified }</code>', 1, 'Está en <code>CapaControlador_prototipoumg2k26</code>.'],
        ['<code>CalcularEdad(DateTime date)</code>', 1, 'Regla de negocio del Controlador.'],
        ['<code>FindbyId(string filter)</code>', 1, 'Filtra en memoria la lista del Controlador.'],
        ['<code>GetAll()</code> que convierte <code>Empleados</code> en <code>ModeloEmpleado</code> y calcula la edad', 1, 'Es el <code>GetAll</code> del Controlador (el del Modelo solo lee filas).'],
        ['El texto <code>"Grabacion exitosa"</code> se arma en…', 1, 'En <code>GrabarCambios()</code> del Controlador; la Vista solo lo muestra.'],
        ['Traducir “Contiene” a <code>LIKE \'%valor%\'</code> y escapar comodines', 1, '<code>ClsControladorFiltroSimple.ConsultasFuncBuscar</code> (Controlador de Consultas).'],
        ['Validar que el filtro tenga campo, operador y valor', 1, '<code>ConsultasFuncValidarFiltro</code>, en el Controlador de Consultas.'],
        ['<code>enviarDatos(_tabla, _campo1, _campo2)</code>', 1, '<code>ModeloComboI</code>, en <code>Capa_Controlador_ComboI</code>.'],
        ['Combinar los permisos de todos los roles del usuario', 1, '<code>SeguridadMetObtenerPermisosSesion</code>, del Controlador de Seguridad.'],
        ['<code>Validator.TryValidateObject(instancia, contexto, resultados, true)</code>', 2, 'La ejecuta <code>Ayudas/ValidacionDatos</code>, en la Vista.'],
        ['<code>MessageBox.Show(resultado)</code>', 2, 'Mostrar mensajes es trabajo de la Vista.'],
        ['<code>panIngresoDatos.Enabled = true;</code>', 2, 'Estado de los controles del formulario: Vista.'],
        ['<code>dgvEmpleados.DataSource = empleado.GetAll();</code>', 2, 'El formulario llena su grid con lo que da el Controlador.'],
        ['<code>cboPrueba.AutoCompleteCustomSource = coleccion;</code>', 2, '<code>ComboI</code>, en <code>Capa_Vista_ComboI</code>.'],
        ['<code>FrmMDISeguridad</code> y los botones del menú lateral', 2, 'El MDI es un formulario de <code>CapaVista_Seguridad</code>.'],
        ['<code>navegador1.NavegadorMetConfigurar("tblempleado", 4, 5);</code>', 2, 'Va en el constructor del formulario que aloja el control: Vista.'],
        ['Elegir DateTimePicker o CheckBox según el tipo de columna', 2, '<code>ClsTipoColumna</code> / <code>ClsCrudFormulario</code> en <code>CapaVista_Navegador</code>.'],
        ['Deshabilitar el botón Eliminar si no hay permiso (<code>MapaBotones</code>)', 2, 'Se hace en el <code>Load</code> del formulario (Vista), con el helper de Seguridad.'],
        ['<code>Application.Run(new FrmEmpleados());</code>', 3, 'Solo el proyecto de ejecución (<code>WinExe</code>) arranca la aplicación.'],
        ['<code>[STAThread] static void Main()</code>', 3, '<code>Program.cs</code> del proyecto de ejecución.'],
        ['Una única referencia: <code>CapaVista_prototipoumg2k26.dll</code>', 3, 'El EXE solo conoce a la Vista.']
      ]
    },
    comp: {
      opts: ['Seguridad', 'Navegador', 'Consultas', 'Reporteador'],
      items: [
        ['<code>tblbitacora</code>', 0, 'La bitácora de auditoría es de Seguridad.'],
        ['Código de recuperación de 6 caracteres enviado por correo', 0, 'Ventana 2002 de Seguridad.'],
        ['Permisos Insertar/Editar/Eliminar/Imprimir por Rol + Módulo + Aplicación', 0, '<code>tblrolmoduloaplicacion</code>, ventana 2010.'],
        ['MDI 2003 con KPIs (usuarios, aplicaciones, perfiles…)', 0, 'El MDI principal es de Seguridad.'],
        ['DLL SeguridadAutenticacion, SeguridadEncriptación y LDAP / Active Directory', 0, 'Su diagrama de componentes.'],
        ['Error 2010-02 “Ya existe un perfil asignado con esos permisos…”', 0, 'Asignación Aplicación–Perfil (error 1062).'],
        ['<code>NavegadorMetConfigurar(tabla, …)</code>', 1, 'La única API del Navegador.'],
        ['Barra de 14 botones que se arrastra desde el Toolbox', 1, 'El Navegador es un UserControl.'],
        ['Genera el formulario leyendo PK, FK y tipos de la tabla', 1, 'Formularios dinámicos del Navegador.'],
        ['“La impresión de reportes está pendiente de integración…”', 1, 'Mensaje actual del botón Imprimir del Navegador.'],
        ['“Error al contar los registros de la tabla”', 1, 'Error del Navegador cuando Consultas no encuentra la tabla.'],
        ['Ventana 4002 ConsultasComplejas', 2, 'Consultas usa el rango 4000–4999.'],
        ['<code>tblConsulta</code> con <code>queryConsulta</code>', 2, 'Consultas reutilizables en <code>dbConsulta</code>.'],
        ['Operadores Contiene / Comienza con / Termina con', 2, 'Filtro de la ventana 4001.'],
        ['<code>new FrmConsultasSimples("tabla", "campoId")</code>', 2, 'Integración de Consultas.'],
        ['Estándar EST-10: fondo #EDE7DA, botones de 80×80', 2, 'Controles de <code>CapaVista_Componentes</code>.'],
        ['Mantenimiento 4003 con condiciones AND/OR y ORDER BY', 2, 'Consultas_Mantenimiento.'],
        ['<code>BD_Reportes</code>', 3, 'Almacén de los DFD del Reporteador.'],
        ['<code>clsReporteLogistica</code>, <code>clsReporteVentas</code>…', 3, 'Especializaciones de <code>clsReporte</code>.'],
        ['Vista previa en un ReportViewer de un .RDLC registrado por código de aplicación', 3, 'Acordado en la reunión del 22/09.'],
        ['DFD “Sistema de reportes” entre Usuario y Sistema de datos', 3, 'Diagrama de contexto del Reporteador.'],
        ['Casos de uso Guardar, Editar, Eliminar, Limpiar… que incluyen “Registrar en Bitácora”', 3, 'Casos de uso del Reporteador.']
      ]
    }
  };

  const assoc = $('#assocApp');
  if (assoc) {
    const list = $('#assocList'), scoreEl = $('#assocScore'), bestEl = $('#assocBest');
    const best = store.get('analisis2-assoc') || {};
    let ronda = 'capa', ok = 0, answered = 0, total = 0;
    const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    function paintScore() {
      scoreEl.textContent = `${ok} / ${answered} · ${total - answered} por responder`;
      bestEl.textContent = best[ronda] != null ? `Mejor: ${best[ronda]} / ${total}` : '';
    }
    function render() {
      const r = RONDAS[ronda];
      ok = answered = 0; total = r.items.length;
      list.innerHTML = '';
      shuffle(r.items.slice()).forEach(([q, a, exp]) => {
        const li = document.createElement('li');
        li.className = 'assoc-item';
        li.innerHTML = `<div class="q">${q}</div><div class="assoc-opts">${r.opts.map((o, i) => `<button type="button" class="assoc-opt" data-i="${i}">${o}</button>`).join('')}</div><p class="assoc-exp" hidden></p>`;
        li.querySelector('.assoc-opts').addEventListener('click', e => {
          const b = e.target.closest('.assoc-opt');
          if (!b || li.dataset.done) return;
          li.dataset.done = '1';
          const pick = +b.dataset.i, right = pick === a;
          answered++; if (right) ok++;
          li.classList.add(right ? 'ok' : 'bad');
          li.querySelectorAll('.assoc-opt').forEach(x => { x.disabled = true; if (+x.dataset.i === a) x.classList.add('right'); });
          if (!right) b.classList.add('wrong');
          const p = li.querySelector('.assoc-exp');
          p.innerHTML = `${right ? '✓' : '✗'} <b>${r.opts[a]}.</b> ${exp}`;
          p.hidden = false;
          if (answered === total && (best[ronda] == null || ok > best[ronda])) { best[ronda] = ok; store.set('analisis2-assoc', best); }
          paintScore();
        });
        list.appendChild(li);
      });
      paintScore();
    }
    assoc.querySelectorAll('[data-ronda]').forEach(t => t.addEventListener('click', () => {
      ronda = t.dataset.ronda;
      assoc.querySelectorAll('[data-ronda]').forEach(x => x.setAttribute('aria-selected', String(x === t)));
      render();
    }));
    $('#assocReset').addEventListener('click', render);
    render();
  }

  /* ---------- Reto contrarreloj ---------- */
  const CAPAS = {
    m: ['Modelo', 'ly-m'], c: ['Controlador', 'ly-c'], v: ['Vista', 'ly-v'], x: ['Ejecución', 'ly-x'],
    k: ['ComboI · 3 capas', ''], n: ['Seguridad + Navegador', 'cp-n'], s: ['Seguridad', 'cp-s'], q: ['Consultas', 'cp-c'], all: ['Todo el prototipo', 'ly-x']
  };
  const PROTO = ['src-empleados', 'src-irepogen', 'src-irepoemp', 'src-repositorio', 'src-repomaestro', 'src-repoemp', 'src-estado', 'src-modeloemp', 'src-validacion', 'src-frmemp', 'src-program'];
  const RETOS = [
    { id: 'entidad', capa: 'm', titulo: 'Entidad Empleados', min: 3, ref: ['src-empleados'],
      enun: 'Escribe la clase <code>Empleados</code> en el namespace <code>CapaModelo_prototipoumg2k26.Entidades</code> con sus 5 propiedades autoimplementadas.',
      check: [['Namespace <code>…Entidades</code>', /namespace\s+CapaModelo_prototipoumg2k26\.Entidades/], ['<code>public class Empleados</code>', /public\s+class\s+Empleados\b/], ['<code>int IdPK { get; set; }</code>', /int\s+IdPK\s*\{\s*get;\s*set;\s*\}/], ['<code>string IdNumero</code>, <code>Nombre</code> y <code>Correo</code>', /string\s+IdNumero[\s\S]*string\s+Nombre[\s\S]*string\s+Correo/], ['<code>DateTime Cumpleaños</code>', /DateTime\s+Cumplea[ñn]os/]] },
    { id: 'contratos', capa: 'm', titulo: 'Contratos (interfaces)', min: 4, ref: ['src-irepogen', 'src-irepoemp'],
      enun: 'Escribe <code>IRepositorioGenerico&lt;Entity&gt;</code> con sus 4 operaciones y <code>IRepositorioEmpleados</code> que lo cierra con <code>Empleados</code>.',
      check: [['<code>interface IRepositorioGenerico&lt;Entity&gt;</code>', /interface\s+IRepositorioGenerico\s*<\s*Entity\s*>/], ['<code>where Entity : class</code>', /where\s+Entity\s*:\s*class/], ['<code>int Agregar(Entity …)</code>', /int\s+Agregar\s*\(\s*Entity/], ['<code>int Editar</code> e <code>int Remover</code>', /int\s+Editar\s*\([\s\S]*int\s+Remover\s*\(/], ['<code>IEnumerable&lt;Entity&gt; GetAll()</code>', /IEnumerable\s*<\s*Entity\s*>\s+GetAll\s*\(\s*\)/], ['<code>IRepositorioEmpleados : IRepositorioGenerico&lt;Empleados&gt;</code>', /IRepositorioEmpleados\s*:\s*IRepositorioGenerico\s*<\s*Empleados\s*>/], ['<code>using …Entidades;</code>', /using\s+CapaModelo_prototipoumg2k26\.Entidades\s*;/]] },
    { id: 'conexion', capa: 'm', titulo: 'Repositorio (la conexión)', min: 3, ref: ['src-repositorio'],
      enun: 'Escribe la clase abstracta <code>Repositorio</code> con la cadena de conexión por DSN y el método que crea la conexión.',
      check: [['<code>using System.Data.Odbc;</code>', /using\s+System\.Data\.Odbc\s*;/], ['<code>public abstract class Repositorio</code>', /abstract\s+class\s+Repositorio\b/], ['<code>readonly string connectionString</code>', /readonly\s+string\s+connectionString/], ['<code>"Dsn=umg_didactica"</code>', /"Dsn=umg_didactica"/], ['<code>protected OdbcConnection ObtenerConexion()</code>', /protected\s+OdbcConnection\s+ObtenerConexion\s*\(\s*\)/], ['<code>return new OdbcConnection(connectionString)</code>', /new\s+OdbcConnection\s*\(\s*connectionString\s*\)/]] },
    { id: 'maestro', capa: 'm', titulo: 'RepositorioMaestro', min: 10, ref: ['src-repomaestro'],
      enun: 'Escribe <code>RepositorioMaestro</code> con <code>EjecucionNonQuery</code> (INSERT/UPDATE/DELETE con parámetros) y <code>EjecucionConsulta</code> (SELECT → DataTable).',
      check: [['<code>abstract class RepositorioMaestro : Repositorio</code>', /abstract\s+class\s+RepositorioMaestro\s*:\s*Repositorio/], ['Firma <code>int EjecucionNonQuery(string, List&lt;OdbcParameter&gt;, CommandType)</code>', /int\s+EjecucionNonQuery\s*\(\s*string\s+\w+\s*,\s*List\s*<\s*OdbcParameter\s*>\s*\w+\s*,\s*CommandType/], ['<code>using (var conexion = ObtenerConexion())</code>', /using\s*\(\s*var\s+\w+\s*=\s*ObtenerConexion\s*\(\s*\)\s*\)/], ['<code>conexion.Open()</code>', /\.Open\s*\(\s*\)/], ['<code>new OdbcCommand()</code> con Connection, CommandText y CommandType', /new\s+OdbcCommand[\s\S]*CommandText[\s\S]*CommandType/], ['<code>Parameters.AddRange(… .ToArray())</code>', /Parameters\.AddRange\s*\([\s\S]*?ToArray\s*\(\s*\)\s*\)/], ['<code>return … ExecuteNonQuery()</code>', /return\s+\w+\.ExecuteNonQuery\s*\(\s*\)/], ['<code>DataTable EjecucionConsulta(string, CommandType)</code>', /DataTable\s+EjecucionConsulta\s*\(\s*string\s+\w+\s*,\s*CommandType/], ['<code>ExecuteReader()</code> + <code>.Load(reader)</code>', /ExecuteReader\s*\(\s*\)[\s\S]*\.Load\s*\(/]] },
    { id: 'repoemp', capa: 'm', titulo: 'RepositorioEmpleados', min: 12, ref: ['src-repoemp'],
      enun: 'Escribe <code>RepositorioEmpleados</code>: los 4 SQL en el constructor, <code>Agregar</code>, <code>Editar</code>, <code>Remover</code> y <code>GetAll</code>.',
      check: [['<code>: RepositorioMaestro, IRepositorioEmpleados</code>', /RepositorioEmpleados\s*:\s*RepositorioMaestro\s*,\s*IRepositorioEmpleados/], ['<code>SELECT * FROM empleados</code>', /SELECT\s+\*\s+FROM\s+empleados/i], ['INSERT con <code>(NULL, ?, ?, ?, ?)</code>', /INSERT\s+INTO\s+empleados[\s\S]*\(\s*NULL\s*,\s*\?\s*,\s*\?\s*,\s*\?\s*,\s*\?\s*\)/i], ['UPDATE … <code>WHERE IdPK=?</code>', /UPDATE\s+empleados\s+SET[\s\S]*WHERE\s+IdPK\s*=\s*\?/i], ['DELETE … <code>WHERE IdPK=?</code>', /DELETE\s+FROM\s+empleados\s+WHERE\s+IdPK\s*=\s*\?/i], ['<code>new OdbcParameter(…)</code>', /new\s+OdbcParameter\s*\(/], ['<code>EjecucionNonQuery(insert, _parametros, CommandType.Text)</code>', /EjecucionNonQuery\s*\(\s*insert\s*,\s*\w+\s*,\s*CommandType\.Text\s*\)/], ['En Editar, <code>IdPK</code> es el último parámetro', /Cumplea[ñn]os\s*\)\s*\)\s*;\s*\n?\s*\w+\.Add\s*\(\s*new\s+OdbcParameter\s*\(\s*"[^"]*"\s*,\s*entidad\.IdPK/], ['<code>foreach (DataRow row in tblTabla.Rows)</code>', /foreach\s*\(\s*DataRow\s+\w+\s+in\s+\w+\.Rows\s*\)/], ['<code>Convert.ToInt32(row[0])</code> y <code>Convert.ToDateTime(row[4])</code>', /Convert\.ToInt32\s*\(\s*\w+\[0\]\s*\)[\s\S]*Convert\.ToDateTime\s*\(\s*\w+\[4\]\s*\)/]] },
    { id: 'controlador', capa: 'c', titulo: 'EstadoEntidad + ModeloEmpleado', min: 15, ref: ['src-estado', 'src-modeloemp'],
      enun: 'Escribe el enum <code>EstadoEntidad</code> y la clase <code>ModeloEmpleado</code>: campos, propiedades con DataAnnotations, <code>Estado</code>, constructor, <code>GrabarCambios</code>, <code>GetAll</code>, <code>FindbyId</code> y <code>CalcularEdad</code>.',
      check: [['<code>enum EstadoEntidad { Added, Deleted, Modified }</code>', /enum\s+EstadoEntidad\s*\{\s*Added\s*,\s*Deleted\s*,\s*Modified\s*\}/], ['<code>using System.ComponentModel.DataAnnotations;</code>', /using\s+System\.ComponentModel\.DataAnnotations\s*;/], ['Campo <code>IRepositorioEmpleados RepositorioEmpleados</code>', /IRepositorioEmpleados\s+RepositorioEmpleados\s*;/], ['<code>[Required]</code> y <code>[RegularExpression(…)]</code>', /\[Required[\s\S]*\[RegularExpression/], ['<code>[StringLength(maximumLength:10, MinimumLength =10 …)]</code>', /StringLength\s*\(\s*maximumLength\s*:\s*10\s*,\s*MinimumLength\s*=\s*10/], ['<code>EstadoEntidad Estado {private get; set;}</code>', /EstadoEntidad\s+Estado\s*\{\s*private\s+get\s*;\s*set\s*;\s*\}/], ['Constructor con <code>new RepositorioEmpleados()</code>', /=\s*new\s+RepositorioEmpleados\s*\(\s*\)/], ['<code>string GrabarCambios()</code> con <code>switch (Estado)</code>', /string\s+GrabarCambios\s*\(\s*\)[\s\S]*switch\s*\(\s*Estado\s*\)/], ['Added → <code>Agregar</code>, Modified → <code>Editar</code>, Deleted → <code>Remover</code>', /Added[\s\S]*Agregar[\s\S]*Modified[\s\S]*Editar[\s\S]*Deleted[\s\S]*Remover/], ['Mapea el correo: <code>.Correo = _correo</code>', /\.Correo\s*=\s*_correo/], ['<code>catch (Exception ex)</code> → <code>ex.ToString()</code>', /catch\s*\(\s*Exception\s+\w+\s*\)[\s\S]*\.ToString\s*\(\s*\)/], ['<code>List&lt;ModeloEmpleado&gt; GetAll()</code>', /List\s*<\s*ModeloEmpleado\s*>\s+GetAll\s*\(\s*\)/], ['<code>FindbyId</code> con <code>FindAll</code>', /FindbyId[\s\S]*FindAll/], ['<code>CalcularEdad</code>', /int\s+CalcularEdad\s*\(\s*DateTime/]] },
    { id: 'validacion', capa: 'v', titulo: 'ValidacionDatos', min: 5, ref: ['src-validacion'],
      enun: 'Escribe la clase <code>ValidacionDatos</code> (carpeta <code>Ayudas</code>) que valida cualquier objeto con sus DataAnnotations y muestra los errores.',
      check: [['<code>new ValidationContext(instancia)</code>', /new\s+ValidationContext\s*\(\s*\w+\s*\)/], ['<code>List&lt;ValidationResult&gt;</code>', /List\s*<\s*ValidationResult\s*>/], ['<code>Validator.TryValidateObject(…, true)</code>', /Validator\.TryValidateObject\s*\([^)]*true\s*\)/], ['<code>bool Validar()</code>', /bool\s+Validar\s*\(\s*\)/], ['Junta <code>item.ErrorMessage</code>', /\.ErrorMessage/], ['<code>MessageBox.Show(Mensaje)</code>', /MessageBox\.Show\s*\(/]] },
    { id: 'frm', capa: 'v', titulo: 'FrmEmpleados (code-behind)', min: 15, ref: ['src-frmemp'],
      enun: 'Escribe el código de <code>FrmEmpleados</code>: carga del grid, Nuevo, Editar, Grabar (con validación), Reinicio, Borrar y búsqueda.',
      check: [['<code>using CapaControlador_prototipoumg2k26;</code>', /using\s+CapaControlador_prototipoumg2k26\s*;/], ['<code>ModeloEmpleado empleado = new ModeloEmpleado()</code>', /ModeloEmpleado\s+empleado\s*=\s*new\s+ModeloEmpleado\s*\(\s*\)/], ['Panel deshabilitado al iniciar', /panIngresoDatos\.Enabled\s*=\s*false/], ['<code>dgvEmpleados.DataSource = empleado.GetAll()</code>', /DataSource\s*=\s*empleado\.GetAll\s*\(\s*\)/], ['Nuevo → <code>EstadoEntidad.Added</code>', /Estado\s*=\s*EstadoEntidad\.Added/], ['Editar: <code>SelectedRows.Count &gt; 0</code> y <code>Modified</code>', /SelectedRows\.Count\s*>\s*0[\s\S]*EstadoEntidad\.Modified/], ['Editar: <code>CurrentRow.Cells[0]</code> → <code>IdPK</code>', /IdPK\s*=\s*Convert\.ToInt32\s*\(\s*dgvEmpleados\.CurrentRow\.Cells\[0\]/], ['Grabar: <code>new Ayudas.ValidacionDatos(empleado).Validar()</code>', /ValidacionDatos\s*\(\s*empleado\s*\)\.Validar\s*\(\s*\)/], ['Grabar: <code>GrabarCambios()</code> + <code>MessageBox</code>', /GrabarCambios\s*\(\s*\)[\s\S]*MessageBox\.Show/], ['<code>Reinicio()</code> limpia y bloquea', /void\s+Reinicio\s*\(\s*\)/], ['Borrar → <code>EstadoEntidad.Deleted</code>', /EstadoEntidad\.Deleted/], ['Búsqueda con <code>FindbyId(txtSearch.Text)</code>', /FindbyId\s*\(\s*txtSearch\.Text\s*\)/]] },
    { id: 'program', capa: 'x', titulo: 'Program.cs y referencias', min: 4, ref: ['src-program'],
      enun: 'Escribe el <code>Program.cs</code> del proyecto de ejecución y di qué referencia necesita el proyecto.',
      check: [['<code>static class Program</code>', /static\s+class\s+Program/], ['<code>[STAThread]</code>', /\[STAThread\]/], ['<code>static void Main()</code>', /static\s+void\s+Main\s*\(\s*\)/], ['<code>Application.EnableVisualStyles()</code>', /Application\.EnableVisualStyles\s*\(\s*\)/], ['<code>SetCompatibleTextRenderingDefault(false)</code>', /SetCompatibleTextRenderingDefault\s*\(\s*false\s*\)/], ['<code>Application.Run(new CapaVista_prototipoumg2k26.Formas.FrmEmpleados())</code>', /Application\.Run\s*\(\s*new\s+(CapaVista_prototipoumg2k26\.Formas\.)?FrmEmpleados\s*\(\s*\)\s*\)/], ['Referencia solo a <code>CapaVista_prototipoumg2k26.dll</code> (Browse / HintPath)', null]] },
    { id: 'combo', capa: 'k', titulo: 'ComboInteligente completo', min: 12, ref: ['src-repocombo', 'src-modelocombo', 'src-combo'],
      enun: 'Escribe las 3 capas del ComboI: <code>RepositorioComboI.obtenerDatos</code>, <code>ModeloComboI.enviarDatos</code> y el UserControl <code>ComboI.llenarCombo</code> con autocompletar.',
      check: [['<code>RepositorioComboI : Repositorio</code>', /RepositorioComboI\s*:\s*Repositorio/], ['SQL con <code>where estado = 1</code>', /where\s+estado\s*=\s*1/i], ['<code>OdbcDataAdapter</code> + <code>Fill</code>', /OdbcDataAdapter[\s\S]*\.Fill\s*\(/], ['<code>DataTable enviarDatos(…)</code>', /DataTable\s+enviarDatos\s*\(/], ['<code>ComboI : UserControl</code>', /ComboI\s*:\s*UserControl/], ['<code>void llenarCombo(string _tabla, string _campo1, string _campo2)</code>', /void\s+llenarCombo\s*\(\s*string\s+\w+\s*,\s*string\s+\w+\s*,\s*string\s+\w+\s*\)/], ['<code>DataSource</code>, <code>ValueMember</code>, <code>DisplayMember</code>', /DataSource[\s\S]*ValueMember[\s\S]*DisplayMember/], ['<code>AutoCompleteStringCollection</code>', /AutoCompleteStringCollection/], ['<code>AutoCompleteMode.SuggestAppend</code> y <code>AutoCompleteSource.CustomSource</code>', /AutoCompleteMode\.SuggestAppend[\s\S]*AutoCompleteSource\.CustomSource|AutoCompleteSource\.CustomSource[\s\S]*AutoCompleteMode\.SuggestAppend/]] },
    { id: 'navmdi', capa: 'n', titulo: 'Navegador en el MDI de Seguridad', min: 6, ref: ['src-nav-form', 'src-nav-mdi'],
      enun: 'Escribe el formulario que configura el Navegador para una tabla y el evento del botón del MDI que verifica el acceso y lo abre.',
      check: [['<code>InitializeComponent()</code> antes de configurar', /InitializeComponent\s*\(\s*\)\s*;[\s\S]*NavegadorMetConfigurar/], ['<code>navegador1.NavegadorMetConfigurar("tabla", n, n)</code>', /navegador1\.NavegadorMetConfigurar\s*\(\s*"\w+"\s*,\s*\d+\s*,\s*\d+\s*\)/], ['<code>if (!ClsSeguridadFormHelper.SeguridadMetTieneAcceso(…))</code>', /!\s*ClsSeguridadFormHelper\.SeguridadMetTieneAcceso\s*\(/], ['<code>IdModulo:</code> e <code>IdAplicacion:</code>', /IdModulo\s*:\s*\d+\s*,\s*IdAplicacion\s*:\s*\d+/], ['Mensaje de acceso denegado + <code>return</code>', /MessageBox\.Show[\s\S]*return\s*;/], ['<code>.ShowDialog()</code>', /\.ShowDialog\s*\(\s*\)/], ['El formulario está en <code>CapaVista_Seguridad</code> y el control viene de <code>CapaVista_Navegador.dll</code> (Toolbox)', null]] },
    { id: 'segboton', capa: 's', titulo: 'Seguridad por botón + bitácora', min: 8, ref: ['src-seg-load', 'src-seg-grabar'],
      enun: 'Escribe el <code>Load</code> que mapea botones a permisos con el helper de Seguridad y un <code>GrabarCambios</code> que registre cada operación en la bitácora y traduzca el error 1062.',
      check: [['<code>Dictionary&lt;Control, TipoPermiso&gt;</code>', /Dictionary\s*<\s*Control\s*,\s*TipoPermiso\s*>/], ['<code>TipoPermiso.Insertar / Editar / Eliminar</code>', /TipoPermiso\.Insertar[\s\S]*TipoPermiso\.Editar[\s\S]*TipoPermiso\.Eliminar/], ['<code>SeguridadMetInicializarSeguridad(this, ID_MODULO, ID_APLICACION, MapaBotones)</code>', /SeguridadMetInicializarSeguridad\s*\(\s*this\s*,/], ['<code>if (!_MisPermisos.TieneAcceso) return;</code>', /!\s*\w+\.TieneAcceso[\s\S]*return/], ['<code>switch (Estado)</code> con los tres casos', /switch\s*\(\s*Estado\s*\)[\s\S]*Added[\s\S]*Modified[\s\S]*Deleted/], ['<code>SeguridadMetRegistrarAccion("INSERT", …)</code>', /SeguridadMetRegistrarAccion\s*\(\s*"INSERT"/], ['UPDATE y DELETE también se registran', /"UPDATE"[\s\S]*"DELETE"|"DELETE"[\s\S]*"UPDATE"/], ['<code>catch (OdbcException …)</code> con <code>NativeError == 1062</code>', /catch\s*\(\s*OdbcException[\s\S]*NativeError\s*==\s*1062/]] },
    { id: 'consultas', capa: 'q', titulo: 'Abrir Consultas y recibir el valor', min: 4, ref: ['src-con-uso'],
      enun: 'Escribe el código que abre la ventana 4001 sobre una tabla y, si el usuario eligió un registro, pone el valor en un TextBox.',
      check: [['<code>using (FrmConsultasSimples … = new FrmConsultasSimples("tabla", "campoId"))</code>', /using\s*\(\s*(FrmConsultasSimples|var)\s+\w+\s*=\s*new\s+FrmConsultasSimples\s*\(\s*"\w+"\s*,\s*"\w+"\s*\)\s*\)/], ['<code>.ShowDialog()</code>', /\.ShowDialog\s*\(\s*\)/], ['<code>if (….SeleccionRealizada)</code>', /if\s*\(\s*\w+\.SeleccionRealizada\s*\)/], ['<code>….CampoSeleccionado</code> al TextBox', /\.Text\s*=\s*\w+\.CampoSeleccionado/]] },
    { id: 'maraton', capa: 'all', titulo: 'Maratón: el prototipo desde cero', min: 75, ref: PROTO,
      enun: 'Todo el prototipo de memoria: Modelo (6 archivos), Controlador (2), Vista (2) y Ejecución (1). Escríbelo en Visual Studio y pega aquí lo que quieras que se revise, o marca la lista a mano.',
      check: [['Entidad <code>Empleados</code>', /class\s+Empleados\b/], ['<code>IRepositorioGenerico&lt;Entity&gt;</code> e <code>IRepositorioEmpleados</code>', /IRepositorioGenerico\s*<\s*Entity\s*>[\s\S]*IRepositorioEmpleados/], ['<code>Repositorio</code> con <code>"Dsn=umg_didactica"</code>', /"Dsn=umg_didactica"/], ['<code>RepositorioMaestro</code> con NonQuery y Consulta', /EjecucionNonQuery[\s\S]*EjecucionConsulta|EjecucionConsulta[\s\S]*EjecucionNonQuery/], ['SQL de <code>RepositorioEmpleados</code> con <code>?</code>', /INSERT\s+INTO\s+empleados[\s\S]*\?/i], ['<code>EstadoEntidad</code>', /enum\s+EstadoEntidad/], ['<code>ModeloEmpleado</code> con DataAnnotations', /class\s+ModeloEmpleado[\s\S]*\[Required/], ['<code>GrabarCambios</code> con <code>switch (Estado)</code>', /GrabarCambios[\s\S]*switch\s*\(\s*Estado\s*\)/], ['<code>ValidacionDatos</code> con <code>TryValidateObject</code>', /TryValidateObject/], ['<code>FrmEmpleados</code>: Nuevo, Editar, Grabar, Borrar', /Added[\s\S]*Modified[\s\S]*Deleted/], ['<code>Program.cs</code> con <code>Application.Run</code>', /Application\.Run/], ['Referencias por DLL en orden Modelo → Controlador → Vista → Ejecución y compilación sin errores', null], ['DSN creado y el formulario muestra los datos', null]] }
  ];

  const app = $('#retoApp');
  if (!app) return;
  const KEY = 'analisis2-reto';
  const best = store.get(KEY) || {};
  const listEl = $('#retoList'), panel = $('#retoPanel'), clock = $('#retoClock'), code = $('#retoCode');
  const btnStart = $('#retoStart'), btnPause = $('#retoPause'), btnEnd = $('#retoEnd');
  const drafts = {};
  let cur = null, running = false, startedAt = 0, spent = 0, timer = 0, escaped = false;

  const fmt = ms => { const s = Math.floor(Math.abs(ms) / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
  const elapsed = () => spent + (running ? performance.now() - startedAt : 0);
  const badge = c => `<span class="ly ${CAPAS[c][1]}">${CAPAS[c][0]}</span>`;
  const bestTxt = r => { const b = best[r.id]; return b ? `Mejor: ${b.pct}% en ${fmt(b.ms)}` : 'Sin intentos'; };

  function renderList() {
    listEl.innerHTML = RETOS.map(r => `<button type="button" class="reto-card" data-id="${r.id}" aria-pressed="${cur && cur.id === r.id}"><span class="t">${r.titulo}</span><span class="m">${badge(r.capa)} ⏱ ${r.min} min</span><span class="best">${bestTxt(r)}</span></button>`).join('');
  }
  function paintClock() {
    if (!cur) return;
    const left = cur.min * 60000 - elapsed();
    clock.textContent = (left < 0 ? '+' : '') + fmt(left);
    clock.classList.toggle('over', left < 0);
    clock.classList.toggle('warn', left >= 0 && left < 60000);
  }
  function stop() { if (running) { spent += performance.now() - startedAt; running = false; } clearInterval(timer); timer = 0; }
  function resetClock() {
    stop(); spent = 0;
    btnStart.disabled = false; btnStart.textContent = 'Empezar';
    btnPause.disabled = true; btnPause.textContent = 'Pausar';
    btnEnd.disabled = true;
    $('#retoResult').hidden = true;
    paintClock();
  }
  function select(id) {
    if (cur) drafts[cur.id] = code.value;
    cur = RETOS.find(r => r.id === id);
    resetClock();
    code.value = drafts[id] || '';
    $('#retoTitulo').textContent = cur.titulo;
    $('#retoMeta').innerHTML = `${badge(cur.capa)} · tiempo sugerido ${cur.min} min · ${bestTxt(cur)}`;
    $('#retoEnun').innerHTML = `<p>${cur.enun}</p>`;
    panel.hidden = false;
    renderList();
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function score() {
    const boxes = $$('#retoCheck input');
    const n = boxes.filter(b => b.checked).length, pct = boxes.length ? Math.round(100 * n / boxes.length) : 0;
    const ms = elapsed(), over = ms - cur.min * 60000;
    $('#retoSum').innerHTML = `<span class="big">${pct}%</span><span>${n} de ${boxes.length} puntos</span><span>⏱ ${fmt(ms)}${over > 0 ? ` (te pasaste ${fmt(over)})` : ' (a tiempo)'}</span>`;
    const b = best[cur.id];
    if (!b || pct > b.pct || (pct === b.pct && ms < b.ms)) { best[cur.id] = { pct, ms }; store.set(KEY, best); renderList(); }
    $('#retoMeta').innerHTML = `${badge(cur.capa)} · tiempo sugerido ${cur.min} min · ${bestTxt(cur)}`;
  }
  function finish() {
    stop();
    btnStart.disabled = true; btnPause.disabled = true; btnEnd.disabled = true;
    const txt = code.value;
    $('#retoCheck').innerHTML = cur.check.map(([t, re], i) => {
      const auto = !!(re && txt.trim() && re.test(txt));
      return `<li><label><input type="checkbox" data-i="${i}"${auto ? ' checked' : ''}><span>${t}</span>${auto ? '<span class="auto">detectado</span>' : (re ? '' : '<span class="auto" style="color:var(--text-2)">revisa tú</span>')}</label></li>`;
    }).join('');
    const ref = $('#retoRef'); ref.innerHTML = '';
    cur.ref.forEach(id => {
      const pre = document.getElementById(id); if (!pre) return;
      const box = (pre.closest('.codebox') || pre).cloneNode(true);
      box.removeAttribute('id'); box.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
      ref.appendChild(box);
    });
    $('#retoResult').hidden = false;
    score();
  }

  listEl.addEventListener('click', e => { const c = e.target.closest('.reto-card'); if (c) select(c.dataset.id); });
  btnStart.addEventListener('click', () => {
    if (running) return;
    running = true; startedAt = performance.now();
    timer = setInterval(paintClock, 250);
    btnStart.disabled = true; btnPause.disabled = false; btnEnd.disabled = false;
    code.focus();
  });
  btnPause.addEventListener('click', () => {
    if (running) { stop(); btnPause.textContent = 'Continuar'; }
    else { running = true; startedAt = performance.now(); timer = setInterval(paintClock, 250); btnPause.textContent = 'Pausar'; }
    paintClock();
  });
  btnEnd.addEventListener('click', finish);
  $('#retoReset').addEventListener('click', resetClock);
  $('#retoClear').addEventListener('click', () => { code.value = ''; if (cur) drafts[cur.id] = ''; code.focus(); });
  $('#retoCheck').addEventListener('change', score);
  code.addEventListener('keydown', e => {
    if (e.key === 'Escape') { escaped = true; return; }
    if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && !escaped) {
      e.preventDefault();
      const s = code.selectionStart, en = code.selectionEnd;
      code.setRangeText('    ', s, en, 'end');
    }
    escaped = false;
  });
  renderList();
})();
