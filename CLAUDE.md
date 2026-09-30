# Portal de guías de examen (UMG 2026)

Sitio **100 % estático** (HTML + CSS + JS sin build, sin dependencias, sin backend). Cada examen es una página
`<curso>/<examen>/index.html` con su guía, cuestionarios y laboratorios. El portal (`index.html`) lista los cursos
desde `js/examenes.js`. Todo corre en el navegador; el progreso y los borradores viven en `localStorage`.

- Idioma: **español** (código, comentarios, textos de UI y mensajes de error). Responde al usuario en español.
- Antes de cambios estructurales (renombrar carpetas, cambiar el catálogo, tocar `main.js`/`styles.css` globales), **pregunta con una recomendación**.
- Despliegue: push a `main` → GitHub Actions sube todo el repo a S3 + CloudFront (`.github/workflows/deploy.yml`, excluye `.git*`, `.claude/*` y `*.md`).
  **No dejes archivos temporales en el repo** (se publicarían). Nunca hagas push directo a `main`: rama `feat/...` + PR. Commit/push solo si el usuario lo pide.

## Estructura (`tree /f`)

```
C:.
|   index.html                      Portal: lista de cursos y exámenes (lo pinta js/portal.js)
|   CLAUDE.md                       Este archivo
|
+---.github
|   \---workflows
|           deploy.yml              Deploy a S3 + CloudFront en cada push a main
|
+---analisis-2\parcial-2
|           index.html              Análisis de Sistemas II (ERP, MVC, componentes)   · usa js/analisis2.js
+---arquitectura-2\parcial-2
|           index.html              Arquitectura II (ensamblador 8086)                · usa asm8086.js, arqui2-datos.js, arqui2.js
+---redes-1\parcial-2
|           index.html              Redes I (TCP/IP, Hamming, Viterbi)                · todo en main.js
+---desarrollo-web\parcial-2        (EN CONSTRUCCIÓN, ver "Plan Desarrollo Web")
|           index.html
|
+---css
|       styles.css                  ÚNICA hoja de estilos (tokens, componentes, una sección por guía al final)
+---img
|       logo.svg
\---js
        main.js                     Núcleo común: progreso, índice lateral, pizarra, anotaciones (lápiz). Lo cargan TODAS las guías
        portal.js                   Pinta el portal y el avance de cada tarjeta
        examenes.js                 Catálogo window.CURSOS (agregar exámenes aquí)
        comunes.js                  Componentes generales reutilizables (window.Comunes): quiz, abiertas, pistas, resaltado, store
        analisis2.js                Lógica específica de Análisis II
        asm8086.js                  Motor 8086: ensamblador, simulador, comparador de código (window.ASM). Sirve en Node
        arqui2-datos.js             Datos de Arquitectura II: banco de 21 ejercicios, trazas, quiz, abiertas (window.ARQ)
        arqui2.js                   UI de Arquitectura II: simulador paso a paso, trazas, banco, direcciones
```

Regenera el árbol con `cmd /c "tree /f /a"` (Windows) cuando cambie la estructura.

## Convenciones de una guía (copia `arquitectura-2/parcial-2/index.html` como esqueleto)

1. `<body data-exam="<curso>/<examen>" data-store="<clave-única>-done">`: `main.js` guarda el avance en `localStorage[data-store]` y publica `progreso:<data-exam>` para el portal.
2. Cada sección es `<section id="x" class="topic" data-sec="xx">` con `.sec-head` + `<button class="mark-btn" data-mark="xx">`; el índice lateral (`nav.side a[data-sec="xx"]`) marca las repasadas. El contador del header se calcula solo.
3. Orden de scripts (al final del body): librerías propias → `../../js/main.js` → `../../js/comunes.js` → `../../js/<curso>.js`.
4. Mantén el bloque `.fab-dock` + `#board` (pizarra/anotar) copiado de otra guía: `main.js` lo necesita.
5. Registrar el examen en `js/examenes.js` (quita `proximamente`). El id debe ser igual a `data-exam` y a la carpeta.
6. Insignias: `<span class="badge ded">deducido</span>` para lo que se infirió y **no** lo dijo el profesor. Sé honesto con esto.
7. Estilos nuevos de una guía: al final de `css/styles.css` bajo `/* ===== Guía <Curso> ===== */`. Usa los tokens (`--accent`, `--ok`, `--err`, `--surface`, `--text-2`…); nunca colores sueltos: hay modo claro/oscuro y impresión.
8. Móvil: probar a 390 px sin scroll horizontal; tablas dentro de `.tbl-wrap`; barras sticky compactas.
9. Datos externos (API, usuario) **siempre** con `esc()` / `textContent`, nunca `innerHTML` directo.

## Componentes

### HTML + CSS (sin JS)
| Componente | Markup |
|---|---|
| Tarjeta en rejilla | `<div class="grid g2|g3"><div class="card tile"><span class="tag">ETIQUETA</span><h4>…</h4><p class="small">…</p></div></div>` |
| Nota destacada | `<div class="key [warn|ok]"><b>Título</b><p>…</p></div>` |
| Pregunta desplegable | `<details class="qa"><summary><span class="qn">Q1</span>Pregunta</summary><div class="ans">…</div></details>` |
| Tabla | `<div class="tbl-wrap"><table>…</table></div>` |
| Código | `<div class="codebox"><div class="file">archivo.php</div><pre class="code" data-lang="php">…</pre></div>` (lo resalta `comunes.js`; `asm` lo resalta `arqui2.js`) |
| Figura SVG | `<figure><svg class="dg wide" viewBox=…>` con nodos `nd nd-m nd-c nd-v nd-x nd-db`, flechas `ar acc`, texto `c b mono sm xs mut` + `<figcaption>` |
| Fórmula / chips / nivel | `.formula` · `.chips > .chip` · `.lvl.l1…l5` · `.badge` |
| Veredicto / medidores / diff | `.verdict.ok|warn|bad` · `.meters > .meter` · `.diff > .dl.eq|miss|extra` |

### JavaScript (`window.Comunes`, archivo `js/comunes.js`)
- `Comunes.store.get/set(k, v)` · `Comunes.esc(s)` · `Comunes.$`, `$$`.
- `Comunes.quiz('#quizApp', [[categoria, pregunta, [opciones], indiceCorrecto, explicacion], …])`: pestañas por categoría, corrección al clic.
- `Comunes.abiertas('#abiertasApp', [{q, a, puntos:[…]}], 'clave-ls')`: textarea que se guarda + respuesta modelo + checklist.
- `Comunes.pistas(contenedor, ['p1','p2','p3'])`: botón "💡 Pista n/3".
- `Comunes.resaltar(src)` / `resaltarPagina()` / `codeBox(src, titulo)`.
- Abre `<details>` al navegar a un ancla interna (automático).

### Específicos de Arquitectura II (no generalizados aún)
`ASM.assemble/Machine/runProgram/compare` (motor + comparador), `Emu` (simulador paso a paso con `data-emu`), tabla del profe (`[data-profe]`), banco de ejercicios con plantilla por bloques `{{B1}}`.

## Cómo probar sin servidor
- Lógica pura (motor, datos): scripts de Node que hacen `require('./js/xxx.js')` (los módulos exportan con `module.exports` además de `window.X`). Ver el patrón de `test-banco.js` (21 ejercicios × comparador).
- Visual / interacción: Chrome headless por CDP (`--headless=new --remote-debugging-port`), abriendo `file:///…/index.html`; capturar con `Page.captureScreenshot`; comprobar móvil con `Emulation.setDeviceMetricsOverride(390×844, mobile)`; emular `prefers-reduced-motion: reduce` porque la página usa `scroll-behavior: smooth`.
- Los archivos temporales van a `$CLAUDE_JOB_DIR/tmp` o al scratchpad, **nunca** dentro del repo.
- Si el sistema detiene el servidor local por memoria, no lo reinicies solo; usa `file://`.

## Plan Desarrollo Web · Parcial II (en construcción)
Fuentes: 12 PPTX del Ing. Leonel Domínguez (convertidos con `markitdown`, **obligatorio** para no gastar tokens) y el repo
`donaldosorio/Examen-Desarrollo-Web` (un laboratorio PHP+MySQL "caso-integral" con 8 pistas y README con entregables).
Foco pedido: **consumir APIs (fetch) y plantillas**; práctico.
- Servidor simulado en el navegador (`js/web2-api.js`, sin red): mismas reglas que el PHP del profe en modo *original* y modo *corregido*; contraseñas de prueba inventadas (el SQL del profe no trae texto plano).
- Laboratorio de peticiones + matriz de 14 pruebas manuales (pista 8), 8 ejercicios de `fetch` corregidos por comportamiento (Worker con timeout), demo de plantilla → HTML con/sin escape, diagnóstico de 14 hallazgos, quiz, abiertas y repaso de las clases 1–8.
- Hechos verificados del repo del profe: `recurso.php` **no lee** `rol`/`acceso` de la URL (el fallo real es que todo cliente ve cualquier recurso publicado y visible); `cambiar_password.php` no exige sesión (con `user_id` ajeno y la contraseña de esa cuenta funciona sin iniciar sesión).
