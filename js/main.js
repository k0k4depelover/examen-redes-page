/* ===== Núcleo de cálculo (sin DOM) ===== */
const STATES = ['00', '01', '10', '11'];
const SNAME = { '00': 'a', '01': 'b', '10': 'c', '11': 'd' };
const xor = (a, b) => a ^ b;
const hd = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return d; };
const clean = s => (s || '').replace(/[^01]/g, '');

/* Código de la clase 15/16: R=1/3, K=3. Registros R1(entrada) R2 R3; estado = R2R3
   S1 = R1 ; S2 = R1 xor R3 ; S3 = R1 xor R2 xor R3 ; siguiente estado = R1 R2 */
const CODE13 = {
  id: 'c13', n: 3,
  step(st, u) {
    const r2 = +st[0], r3 = +st[1];
    return { out: '' + u + (u ^ r3) + (u ^ r2 ^ r3), next: '' + u + r2 };
  }
};
/* Código del repaso (Trellis estándar R=1/2, K=3, generadores 111 y 101)
   o1 = u xor s1 xor s2 ; o2 = u xor s2 ; siguiente estado = u s1 */
const CODE12 = {
  id: 'c12', n: 2,
  step(st, u) {
    const s1 = +st[0], s2 = +st[1];
    return { out: '' + (u ^ s1 ^ s2) + (u ^ s2), next: '' + u + s1 };
  }
};

function convEncode(code, bits, rtl) {
  bits = clean(bits);
  const seq = rtl ? bits.split('').reverse().join('') : bits;
  let st = '00'; const rows = [];
  for (const b of seq) {
    const u = +b, r = code.step(st, u);
    rows.push({ u, st, out: r.out, next: r.next });
    st = r.next;
  }
  return rows;
}

function viterbi(code, rx) {
  const INF = 1e9;
  let met = { '00': 0, '01': INF, '10': INF, '11': INF };
  let path = { '00': '', '01': '', '10': '', '11': '' };
  const stages = []; // por etapa: {met, surv:{estado:{from,u,out,cost}}, cands:[...]}
  for (const r of rx) {
    const nm = { '00': INF, '01': INF, '10': INF, '11': INF }, np = {}, surv = {}, cands = [];
    for (const s of STATES) {
      if (met[s] >= INF) continue;
      for (const u of [0, 1]) {
        const { out, next } = code.step(s, u);
        const bm = hd(out, r), c = met[s] + bm;
        cands.push({ from: s, to: next, u, out, bm, cost: c });
        if (c < nm[next]) { nm[next] = c; np[next] = path[s] + u; surv[next] = { from: s, u, out, cost: c }; }
      }
    }
    met = nm; path = np; stages.push({ met: { ...nm }, surv, cands });
  }
  let best = null;
  for (const s of STATES) if (met[s] < INF && (best === null || met[s] < met[best])) best = s;
  const ties = STATES.filter(s => met[s] === met[best]);
  // reconstruir la secuencia de estados del camino ganador
  const seq = [best];
  for (let t = stages.length - 1; t >= 0; t--) seq.unshift(stages[t].surv[seq[0]].from);
  return { bits: path[best] || '', metric: met[best], end: best, ties, stages, seq, paths: path, finalMet: met };
}

/* Hamming con paridad par; posiciones 1..n de izquierda a derecha; paridades en potencias de 2 */
function hamParityCount(m) { let p = 0; while ((1 << p) < p + m + 1) p++; return p; }
function hamEncode(data) {
  data = clean(data); const m = data.length, p = hamParityCount(m), n = m + p;
  const w = new Array(n + 1).fill(null); let k = 0;
  for (let i = 1; i <= n; i++) if (i & (i - 1)) w[i] = +data[k++];
  const rows = [];
  for (let j = 0; j < p; j++) {
    const pos = 1 << j; const cover = [];
    let s = 0;
    for (let i = 1; i <= n; i++) if ((i & pos) && i !== pos) { s ^= w[i]; cover.push(i); }
    w[pos] = s; rows.push({ pos, cover, value: s });
  }
  return { n, m, p, word: w.slice(1).join(''), rows, w };
}
function hamSyndrome(word) {
  word = clean(word); const n = word.length; const w = [0, ...word.split('').map(Number)];
  let s = 0; const checks = [];
  for (let pos = 1; pos <= n; pos <<= 1) {
    let x = 0; for (let i = 1; i <= n; i++) if (i & pos) x ^= w[i];
    checks.push({ pos, value: x }); if (x) s += pos;
  }
  return { s, checks };
}
function hamData(word) { return clean(word).split('').filter((_, i) => ((i + 1) & i)).join(''); }
function hamLabels(n) {
  const out = []; let d = 1, p = 1;
  for (let i = 1; i <= n; i++) out.push((i & (i - 1)) ? 'M' + (d++) : 'P' + (p++));
  return out;
}

/* ===== Render SVG de Trellis ===== */
function trellisSVG(opts) {
  const { code, T, rx = null, result = null, pathSeq = null, showLabels = true, showAll = true, title = '', inputs = null } = opts;
  const colW = opts.colW || 92, rowH = opts.rowH || 62, left = 58, top = rx || inputs ? 66 : 30, bottom = result ? 44 : 26;
  const W = left + T * colW + 36, H = top + 3 * rowH + bottom;
  const X = t => left + t * colW, Y = s => top + STATES.indexOf(s) * rowH;
  let g = '';
  // encabezados de tiempo
  for (let t = 0; t <= T; t++) g += `<text x="${X(t)}" y="${top - (rx || inputs ? 46 : 14)}" class="tl-t">t${t}</text>`;
  if (rx) rx.forEach((r, i) => { g += `<text x="${(X(i) + X(i + 1)) / 2}" y="${top - 24}" class="tl-rx">${r}</text>`; });
  else if (inputs) inputs.forEach((r, i) => { g += `<text x="${(X(i) + X(i + 1)) / 2}" y="${top - 24}" class="tl-rx">${r}</text>`; });
  // alcanzables
  const reach = [new Set(['00'])];
  for (let t = 0; t < T; t++) { const s = new Set(); for (const a of reach[t]) for (const u of [0, 1]) s.add(code.step(a, u).next); reach.push(s); }
  const onPath = new Set();
  if (pathSeq) for (let t = 0; t < pathSeq.length - 1; t++) onPath.add(t + ':' + pathSeq[t] + '>' + pathSeq[t + 1]);
  const survSet = new Set();
  if (result) result.stages.forEach((st, t) => { for (const to in st.surv) survSet.add(t + ':' + st.surv[to].from + '>' + to); });
  let edges = '', labels = '', hi = '';
  for (let t = 0; t < T; t++) for (const s of reach[t]) for (const u of [0, 1]) {
    const { out, next } = code.step(s, u);
    const key = t + ':' + s + '>' + next;
    const x1 = X(t), y1 = Y(s), x2 = X(t + 1), y2 = Y(next);
    let cls = 'tl-e' + (u ? ' one' : '');
    if (result) cls += survSet.has(key) ? ' surv' : ' dead';
    const isP = onPath.has(key);
    if (!showAll && !isP) continue;
    const line = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${cls}${isP ? ' path' : ''}"/>`;
    if (isP) hi += line; else edges += line;
    if (showLabels) {
      const f = u ? 0.34 : 0.5; const lx = x1 + (x2 - x1) * f, ly = y1 + (y2 - y1) * f + (y1 === y2 ? -6 : -3);
      let txt = out;
      if (result && rx) { const bm = hd(out, rx[t]); txt = out; }
      labels += `<text x="${lx}" y="${ly}" class="tl-l${isP ? ' on' : ''}${(result && !survSet.has(key)) || (pathSeq && !isP) ? ' dim' : ''}">${txt}</text>`;
    }
  }
  // nodos
  let nodes = '';
  for (let t = 0; t <= T; t++) for (const s of STATES) {
    const r = reach[t] && reach[t].has(s);
    nodes += `<circle cx="${X(t)}" cy="${Y(s)}" r="${r ? 4.5 : 3}" class="tl-n${r ? '' : ' off'}${pathSeq && pathSeq[t] === s ? ' on' : ''}"/>`;
    if (result && t > 0 && r) {
      const m = result.stages[t - 1].met[s];
      if (m < 1e9) nodes += `<g class="tl-m${pathSeq && pathSeq[t] === s ? ' on' : ''}"><rect x="${X(t) + 6}" y="${Y(s) - 22}" width="18" height="16" rx="8"/><text x="${X(t) + 15}" y="${Y(s) - 10.5}">${m}</text></g>`;
    }
  }
  let rows = '';
  for (const s of STATES) rows += `<text x="${left - 16}" y="${Y(s) + 4}" class="tl-s">${SNAME[s]}·${s}</text>`;
  let foot = '';
  if (result && pathSeq) {
    for (let t = 0; t < T; t++) {
      const st = result.stages[t].surv[pathSeq[t + 1]];
      foot += `<text x="${(X(t) + X(t + 1)) / 2}" y="${H - 14}" class="tl-dec">${st ? st.u : ''}</text>`;
    }
  }
  return `<svg viewBox="0 0 ${W} ${H}" class="trellis" role="img" aria-label="${title || 'Diagrama de Trellis'}">${rows}${g}${edges}${hi}${labels}${nodes}${foot}</svg>`;
}




/* ===== Renderizadores HTML (compartidos por la compilación y el laboratorio) ===== */
function bitsHTML(str, o = {}) {
  const par = o.par || new Set(), err = o.err || new Set(), fix = o.fix || new Set();
  let h = `<div class="bits${o.idx ? ' idx' : ''}" aria-label="${str}">`;
  str.split('').forEach((b, i) => {
    const p = i + 1; const c = 'bit' + (b === '1' ? ' one' : '') + (par.has(p) ? ' p' : '') + (err.has(p) ? ' e' : '') + (fix.has(p) ? ' fix' : '');
    h += `<span class="${c}"${o.idx ? ` data-i="${p}"` : ''}>${b}</span>`;
  });
  return h + '</div>';
}
const isPow2 = i => (i & (i - 1)) === 0;
function hamHeadRows(n, extra) {
  const labels = hamLabels(n); const w = Math.max(3, n.toString(2).length);
  let h = '<tr><th>Posición</th>';
  for (let i = 1; i <= n; i++) h += `<th${isPow2(i) ? ' class="p"' : ''}>${i}<br><span style="font-weight:500">${i.toString(2).padStart(w, '0')}</span></th>`;
  h += extra.map(e => `<th>${e}</th>`).join('') + '</tr><tr><th></th>';
  labels.forEach((l, i) => h += `<th${isPow2(i + 1) ? ' class="p"' : ''}>${l}</th>`);
  return h + extra.map(() => '<th></th>').join('') + '</tr>';
}
function hamEncHTML(data) {
  const e = hamEncode(data); const n = e.n; const w = e.w;
  let h = `<div class="tbl-wrap"><table class="bitt">${hamHeadRows(n, ['Unos', 'Paridad par'])}<tr><td>Datos</td>`;
  for (let i = 1; i <= n; i++) h += isPow2(i) ? '<td class="x">·</td>' : `<td class="hl">${w[i]}</td>`;
  h += '<td></td><td></td></tr>';
  let pi = 1;
  for (let pos = 1; pos <= n; pos <<= 1, pi++) {
    let ones = 0, row = `<tr><td>P${pi}</td>`;
    for (let i = 1; i <= n; i++) {
      if (i === pos) { row += `<td class="p">${w[pos]}</td>`; continue; }
      if ((i & pos) && !isPow2(i)) { row += `<td>${w[i]}</td>`; ones += w[i]; } else row += '<td class="x">·</td>';
    }
    h += row + `<td>${ones}</td><td>${ones % 2 === 0 ? 'par → 0' : 'impar → 1'}</td></tr>`;
  }
  h += '<tr><td>n (palabra)</td>';
  for (let i = 1; i <= n; i++) h += `<td class="${isPow2(i) ? 'p' : 'hl'}">${w[i]}</td>`;
  h += `<td colspan="2">H(${n},${e.m})</td></tr></table></div>`;
  const par = new Set(); for (let i = 1; i <= n; i <<= 1) par.add(i);
  return h + '<p class="small muted" style="margin-top:4px">Palabra codificada (naranja = paridad):</p>' + bitsHTML(e.word, { par, idx: true });
}
function hamDecHTML(word) {
  word = clean(word); const n = word.length; const w = [0, ...word.split('').map(Number)];
  let h = `<div class="tbl-wrap"><table class="bitt">${hamHeadRows(n, ['Unos', 'Recalculada', 'Recibida', 'Diferencia'])}`;
  h += '<tr><td>Recibido</td>'; for (let i = 1; i <= n; i++) h += `<td class="${isPow2(i) ? 'p' : ''}">${w[i]}</td>`; h += '<td colspan="4"></td></tr>';
  h += '<tr><td>Datos</td>'; for (let i = 1; i <= n; i++) h += isPow2(i) ? '<td class="x">·</td>' : `<td class="hl">${w[i]}</td>`; h += '<td colspan="4"></td></tr>';
  let pi = 1; const diffs = [];
  for (let pos = 1; pos <= n; pos <<= 1, pi++) {
    let ones = 0, row = `<tr><td>P${pi}</td>`; const cells = [];
    for (let i = 1; i <= n; i++) {
      if (i === pos) { cells.push(null); continue; }
      if ((i & pos) && !isPow2(i)) { cells.push(`<td>${w[i]}</td>`); ones += w[i]; } else cells.push('<td class="x">·</td>');
    }
    const calc = ones % 2, got = w[pos], d = calc ^ got; diffs.push({ pos, d, pi });
    row += cells.map(c => c === null ? `<td class="p">${calc}</td>` : c).join('');
    h += row + `<td>${ones}</td><td>${calc}</td><td>${got}</td><td class="${d ? 'e' : 'k'}">${d}${d ? ' error' : ''}</td></tr>`;
  }
  h += '</table></div>';
  const s = diffs.reduce((a, x) => a + (x.d ? x.pos : 0), 0);
  const synBits = diffs.slice().reverse().map(x => x.d).join('');
  const synLbl = diffs.slice().reverse().map(x => 'P' + x.pi).join(' ');
  h += `<p style="margin-top:8px">Síndrome leído de abajo hacia arriba (${synLbl}) = <b class="mono">${synBits}</b> = <b>${s}</b> en decimal.</p>`;
  const par = new Set(); for (let i = 1; i <= n; i <<= 1) par.add(i);
  if (s === 0) return h + `<p>Síndrome 0 → <b>no hay error</b>. Datos: <b class="mono">${hamData(word)}</b></p>` + bitsHTML(word, { par, idx: true });
  if (s > n) return h + `<p class="errmsg">El síndrome (${s}) apunta fuera de la palabra: hubo más de un error y Hamming no puede corregirlo.</p>`;
  const f = word.split(''); f[s - 1] = f[s - 1] === '1' ? '0' : '1'; const fw = f.join('');
  h += '<p class="small muted">Recibida (error en rojo):</p>' + bitsHTML(word, { par, err: new Set([s]), idx: true });
  h += `<p class="small muted">Corregida (bit ${s} volteado):</p>` + bitsHTML(fw, { par, fix: new Set([s]), idx: true });
  return h + `<p>Datos corregidos: <b class="mono">${hamData(fw)}</b></p>`;
}
function convTableHTML(bits, dir) {
  const rows = convEncode(CODE13, bits, dir === 'rtl');
  let h = '<div class="tbl-wrap"><table class="bitt"><tr><th>Paso</th><th>Entrada u</th><th>R1 R2 R3</th><th>Estado R2R3</th><th>S1 = R1</th><th>S2 = R1⊕R3</th><th>S3 = R1⊕R2⊕R3</th><th>Salida</th><th>Siguiente</th></tr>';
  rows.forEach((r, i) => {
    h += `<tr><td>${i + 1}</td><td class="hl">${r.u}</td><td>${r.u} ${r.st[0]} ${r.st[1]}</td><td>${r.st} <span class="muted">${SNAME[r.st]}</span></td><td>${r.out[0]}</td><td>${r.out[1]}</td><td>${r.out[2]}</td><td class="k">${r.out}</td><td>${r.next} <span class="muted">${SNAME[r.next]}</span></td></tr>`;
  });
  return h + `</table></div><p class="small muted">Secuencia codificada: <b class="mono" style="color:var(--text)">${rows.map(r => r.out).join(' ')}</b></p>`;
}
function convTruthHTML() {
  let h = '<div class="tbl-wrap"><table class="bitt"><tr><th>Entrada (R1)</th><th>Estado R2 R3</th><th>S1</th><th>S2</th><th>S3</th><th>Salida</th><th>Siguiente estado</th></tr>';
  for (const st of STATES) for (const u of [0, 1]) {
    const r = CODE13.step(st, u);
    h += `<tr><td>${u}</td><td>${st} (${SNAME[st]})</td><td>${r.out[0]}</td><td>${r.out[1]}</td><td>${r.out[2]}</td><td class="k">${r.out}</td><td>${r.next} (${SNAME[r.next]})</td></tr>`;
  }
  return h + '</table></div>';
}
function trans12HTML() {
  let h = '<div class="tbl-wrap"><table class="bitt"><tr><th>Estado actual</th><th>Entrada 0 (sólida)</th><th>Entrada 1 (punteada)</th></tr>';
  for (const st of STATES) { const a = CODE12.step(st, 0), b = CODE12.step(st, 1); h += `<tr><td>${SNAME[st]} = ${st}</td><td>sale <b>${a.out}</b> → ${SNAME[a.next]} (${a.next})</td><td>sale <b>${b.out}</b> → ${SNAME[b.next]} (${b.next})</td></tr>`; }
  return h + '</table></div>';
}
function enc12HTML(data) {
  const rows = convEncode(CODE12, data, false);
  let h = '<div class="tbl-wrap"><table class="bitt"><tr><th>Etapa / tiempo</th>' + rows.map((_, i) => `<th>t=${i + 1}</th>`).join('') + '</tr>';
  h += '<tr><td>Datos</td>' + rows.map(r => `<td class="hl">${r.u}</td>`).join('') + '</tr>';
  h += '<tr><td>Estado presente</td>' + rows.map(r => `<td>${r.st}</td>`).join('') + '</tr>';
  h += '<tr><td>Codificado</td>' + rows.map(r => `<td class="k">${r.out}</td>`).join('') + '</tr>';
  h += '<tr><td>Siguiente estado</td>' + rows.map(r => `<td>${r.next}</td>`).join('') + '</tr>';
  return h + '</table></div>';
}
function vitTableHTML(rx) {
  const v = viterbi(CODE12, rx);
  let h = '<div class="tbl-wrap"><table class="bitt"><tr><th>Estado \\ tiempo</th>' + rx.map((_, i) => `<th>t${i + 1}</th>`).join('') + '</tr>';
  h += '<tr><td>Recibido</td>' + rx.map(r => `<td class="hl">${r}</td>`).join('') + '</tr>';
  for (const s of STATES) {
    h += `<tr><td>${SNAME[s]} = ${s}</td>`;
    v.stages.forEach((st, t) => {
      const m = st.met[s];
      if (m >= 1e9) { h += '<td class="x">—</td>'; return; }
      h += `<td class="${v.seq[t + 1] === s ? 'k' : ''}">${m} <span class="muted" style="font-size:11px">←${SNAME[st.surv[s].from]}</span></td>`;
    });
    h += '</tr>';
  }
  h += '<tr><td>Bit decodificado</td>' + v.bits.split('').map(b => `<td class="k">${b}</td>`).join('') + '</tr></table></div>';
  const tie = v.ties.length > 1 ? ` <span class="muted">(empate con ${v.ties.filter(x => x !== v.end).map(x => SNAME[x] + ' = ' + x).join(', ')})</span>` : '';
  return h + `<p class="small">Métrica acumulada por estado (← estado del que viene el sobreviviente). Verde = camino ganador. Final: estado <b>${SNAME[v.end]} (${v.end})</b> con métrica <b>${v.metric}</b>${tie} → decodificado <b class="mono">${v.bits}</b>.</p>`;
}
function vitSVG(rx) { const v = viterbi(CODE12, rx); return trellisSVG({ code: CODE12, T: rx.length, rx, result: v, pathSeq: v.seq, title: 'Viterbi para ' + rx.join(' ') }); }
function pathSeqOf(code, data, rtl) { const rows = convEncode(code, data, rtl); return ['00', ...rows.map(r => r.next)]; }
function hamCoverSVG() {
  const n = 7, cw = 64, x0 = 90, y0 = 40, rh = 40, lab = hamLabels(n);
  let s = `<svg viewBox="0 0 ${x0 + n * cw + 20} ${y0 + 3 * rh + 50}" role="img" aria-label="Cobertura de paridades H(7,4)">`;
  for (let i = 1; i <= n; i++) {
    const x = x0 + (i - 1) * cw + cw / 2;
    s += `<text x="${x}" y="18" text-anchor="middle" font-weight="700"${isPow2(i) ? ' fill="var(--par)"' : ''}>${lab[i - 1]}</text><text x="${x}" y="33" text-anchor="middle" class="mono mut" font-size="11">${i.toString(2).padStart(3, '0')}</text>`;
    s += `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y0 + 3 * rh}" stroke="var(--sep)"/>`;
  }
  [1, 2, 4].forEach((p, r) => {
    const y = y0 + r * rh + rh / 2; const pts = [];
    s += `<text x="10" y="${y + 5}" font-weight="700" fill="var(--par)">P${r + 1}</text><text x="40" y="${y + 5}" class="mut mono" font-size="11">bit ${r + 1}</text>`;
    for (let i = 1; i <= n; i++) if (i & p) pts.push(x0 + (i - 1) * cw + cw / 2);
    s += `<line x1="${pts[0]}" y1="${y}" x2="${pts[pts.length - 1]}" y2="${y}" stroke="var(--par)" stroke-width="3" opacity=".35"/>`;
    for (let i = 1; i <= n; i++) if (i & p) s += `<circle cx="${x0 + (i - 1) * cw + cw / 2}" cy="${y}" r="${i === p ? 9 : 7}" fill="${i === p ? 'var(--par)' : 'var(--text)'}"/>`;
  });
  return s + `<text x="${x0}" y="${y0 + 3 * rh + 30}" class="mut" font-size="12">P1 = 1,3,5,7 · P2 = 2,3,6,7 · P3 = 4,5,6,7</text></svg>`;
}


/* ===== Interfaz: navegación, progreso y laboratorio ===== */
(function () {
  const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  };
  // Menú móvil
  const side = $('#side'), btn = $('#menuBtn'), scrim = $('#scrim');
  const setMenu = open => { side.classList.toggle('open', open); scrim.classList.toggle('show', open); btn.setAttribute('aria-expanded', open); };
  btn.addEventListener('click', () => setMenu(!side.classList.contains('open')));
  scrim.addEventListener('click', () => setMenu(false));
  $$('nav.side a').forEach(a => a.addEventListener('click', () => { if (innerWidth <= 1000) setMenu(false); }));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setMenu(false); });

  // Progreso: cada examen usa su propia clave (data-store) y publica un resumen
  // en 'progreso:<data-exam>' para que el portal muestre el avance en su tarjeta.
  const storeKey = document.body.dataset.store || 'redes2-done', examId = document.body.dataset.exam;
  const done = store.get(storeKey) || {};
  const marks = $$('[data-mark]');
  function paint() {
    let c = 0;
    marks.forEach(b => {
      const k = b.dataset.mark, on = !!done[k]; if (on) c++;
      b.setAttribute('aria-pressed', on); b.textContent = on ? '✓ Repasado' : 'Marcar como repasado';
      const link = $(`nav.side a[data-sec="${k}"]`); if (link) link.classList.toggle('is-done', on);
    });
    $('#progress').textContent = `${c} de ${marks.length} repasados`;
    if (examId) store.set('progreso:' + examId, { done: c, total: marks.length });
  }
  marks.forEach(b => b.addEventListener('click', () => { done[b.dataset.mark] = !done[b.dataset.mark]; store.set(storeKey, done); paint(); }));
  paint();

  // Sección activa
  const links = $$('nav.side a[href^="#"]');
  const secs = links.map(a => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(ents => {
      ents.forEach(en => { if (en.isIntersecting) { links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + en.target.id)); } });
    }, { rootMargin: '-45% 0px -50% 0px' });
    secs.forEach(s => io.observe(s));
  }

  // Al imprimir, abrir todas las respuestas
  addEventListener('beforeprint', () => $$('details').forEach(d => d.open = true));

  // ---- Laboratorio ----
  if (!$('#hamGo')) return;   // página sin laboratorio
  const onlyBits = s => /^[01\s]*$/.test(s);
  function run(id, fn) { const el = $(id); try { el.innerHTML = fn(); } catch (e) { el.innerHTML = `<p class="errmsg">${e.message}</p>`; } }
  function ham() {
    const d = $('#hamIn').value, r = $('#hamRx').value;
    if (!onlyBits(d) || !clean(d)) throw new Error('Escribe solo 0 y 1 en los datos.');
    if (clean(d).length > 26) throw new Error('Usa como máximo 26 bits de datos.');
    const e = hamEncode(d);
    let h = `<p>m = ${e.m} → 2<sup>p</sup> ≥ p + ${e.m} + 1 → <b>p = ${e.p}</b>, n = ${e.n} → <b>H(${e.n},${e.m})</b></p><h4>Codificación</h4>` + hamEncHTML(d);
    if (clean(r)) {
      if (!onlyBits(r)) throw new Error('La palabra recibida solo puede tener 0 y 1.');
      if (clean(r).length !== e.n) h += `<p class="errmsg">La palabra recibida debe tener ${e.n} bits para este código (tiene ${clean(r).length}).</p>`;
      else h += '<h4>Decodificación de la palabra recibida</h4>' + hamDecHTML(r);
    }
    return h;
  }
  function conv() {
    const m = $('#convIn').value;
    if (!onlyBits(m) || !clean(m)) throw new Error('Escribe solo 0 y 1.');
    if (clean(m).length > 24) throw new Error('Usa como máximo 24 bits.');
    const dir = $('#convDir').value;
    return convTableHTML(m, dir) + `<figure>${trellisSVG({ code: CODE13, T: clean(m).length, pathSeq: pathSeqOf(CODE13, m, dir === 'rtl'), inputs: convEncode(CODE13, m, dir === 'rtl').map(r => 'u=' + r.u), colW: 84 })}<figcaption>Camino en el Trellis R = 1/3.</figcaption></figure>`;
  }
  function vit() {
    const d = $('#vitData').value, r = $('#vitRx').value; let h = '';
    if (!onlyBits(d) || !onlyBits(r)) throw new Error('Escribe solo 0, 1 y espacios.');
    if (clean(d)) {
      if (clean(d).length > 16) throw new Error('Usa como máximo 16 bits de datos.');
      h += '<h4>Codificación</h4>' + enc12HTML(d) + `<figure>${trellisSVG({ code: CODE12, T: clean(d).length, pathSeq: pathSeqOf(CODE12, d, false), inputs: clean(d).split('') })}</figure>`;
    }
    const rb = clean(r);
    if (rb) {
      if (rb.length % 2) throw new Error('El recibido debe tener un número par de bits (pares por instante).');
      if (rb.length > 32) throw new Error('Usa como máximo 16 pares recibidos.');
      const rx = rb.match(/../g);
      h += '<h4>Decodificación (Viterbi)</h4>' + `<figure>${vitSVG(rx)}</figure>` + vitTableHTML(rx);
    }
    return h || '<p class="muted">Escribe datos o un recibido.</p>';
  }
  $('#hamGo').addEventListener('click', () => run('#hamOut', ham));
  $('#convGo').addEventListener('click', () => run('#convOut', conv));
  $('#vitGo').addEventListener('click', () => run('#vitOut', vit));
  ['#hamIn', '#hamRx'].forEach(s => $(s).addEventListener('keydown', e => { if (e.key === 'Enter') run('#hamOut', ham); }));
  $('#convIn').addEventListener('keydown', e => { if (e.key === 'Enter') run('#convOut', conv); });
  ['#vitData', '#vitRx'].forEach(s => $(s).addEventListener('keydown', e => { if (e.key === 'Enter') run('#vitOut', vit); }));
  run('#hamOut', ham); run('#convOut', conv); run('#vitOut', vit);
})();


/* ===== Motor de trazo (compartido por la pizarra y las anotaciones) =====
   Técnica de perfect-freehand (la que usa Excalidraw): suavizado de la entrada,
   presión simulada por velocidad y contorno relleno con curvas.
   Un trazo es {pts:[{x,y,p}], size, sim, box}; pathD() devuelve su contorno como
   datos de path SVG, que sirven igual para <path d> y para new Path2D(). */
const Ink = (() => {
  const STREAMLINE = 0.5, THINNING = 0.6, RATE = 0.275;
  function addPoint(s, x, y, pressure) {
    const pts = s.pts, prev = pts[pts.length - 1];
    if (!prev) { pts.push({ x, y, p: s.sim ? 0.5 : pressure }); return; }
    const t = 0.15 + (1 - STREAMLINE) * 0.85;
    const nx = prev.x + (x - prev.x) * t, ny = prev.y + (y - prev.y) * t;
    const d = Math.hypot(nx - prev.x, ny - prev.y);
    if (d < 0.5) return;
    let p = pressure;
    if (s.sim) {                 // más rápido = más delgado, como un plumón real
      const sp = Math.min(1, d / s.size), rp = Math.min(1, 1 - sp);
      p = Math.min(1, prev.p + (rp - prev.p) * (sp * RATE));
    }
    pts.push({ x: nx, y: ny, p });
  }
  const radius = (s, p) => Math.max(0.6, s.size * (0.5 - THINNING * (0.5 - p)));
  const f = n => Math.round(n * 100) / 100;

  // sx escala el trazo en horizontal (anotaciones cuando cambia el ancho de la página)
  function pathD(s, sx = 1) {
    const pts = sx === 1 ? s.pts : s.pts.map(q => ({ x: q.x * sx, y: q.y, p: q.p })), n = pts.length;
    if (n < 2) {
      const q = pts[0], r = f(radius(s, 0.5));
      return `M${f(q.x - r)} ${f(q.y)}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
    }
    const left = [], right = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
      const r = radius(s, pts[i].p);
      left.push([pts[i].x - dy * r, pts[i].y + dx * r]);
      right.push([pts[i].x + dy * r, pts[i].y - dx * r]);
    }
    const cap = (q, r, from) => {             // media circunferencia redondeada
      const out = [];
      for (let k = 1; k < 8; k++) {
        const a = from - Math.PI * k / 8;
        out.push([q.x + Math.cos(a) * r, q.y + Math.sin(a) * r]);
      }
      return out;
    };
    const dirOf = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
    const endDir = dirOf(pts[n - 2], pts[n - 1]), startDir = dirOf(pts[0], pts[1]);
    const poly = [
      ...left,
      ...cap(pts[n - 1], radius(s, pts[n - 1].p), endDir + Math.PI / 2),
      ...right.reverse(),
      ...cap(pts[0], radius(s, pts[0].p), startDir - Math.PI / 2),
    ];
    const mid = (a, b) => f((a[0] + b[0]) / 2) + ' ' + f((a[1] + b[1]) / 2);
    const m = poly.length, out = ['M' + mid(poly[m - 1], poly[0])];
    for (let i = 0; i < m; i++) {
      const a = poly[i], b = poly[(i + 1) % m];
      out.push(`Q${f(a[0])} ${f(a[1])} ${mid(a, b)}`);
    }
    return out.join('') + 'Z';
  }

  function bounds(s) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const q of s.pts) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y); }
    return [x0, y0, x1, y1];
  }

  function segDist(px, py, a, b) {
    const vx = b.x - a.x, vy = b.y - a.y, l2 = vx * vx + vy * vy;
    const t = l2 ? Math.max(0, Math.min(1, ((px - a.x) * vx + (py - a.y) * vy) / l2)) : 0;
    return Math.hypot(px - (a.x + vx * t), py - (a.y + vy * t));
  }
  // ¿El círculo de radio r en (x, y) toca el trazo? (requiere s.box)
  function hits(s, x, y, r) {
    const reach = r + s.size * 0.5, [x0, y0, x1, y1] = s.box;
    if (x < x0 - reach || x > x1 + reach || y < y0 - reach || y > y1 + reach) return false;
    const pts = s.pts;
    for (let i = 0; i < pts.length; i++) if (segDist(x, y, pts[i], pts[Math.min(i + 1, pts.length - 1)]) <= reach) return true;
    return false;
  }

  return { addPoint, pathD, bounds, hits };
})();


/* ===== Pizarra flotante =====
   Dibuja con el motor Ink sobre dos canvas (base + trazo en curso).
   Todo vive en memoria: ocultar conserva el dibujo, recargar la página lo borra. */
(() => {
  const $ = id => document.getElementById(id);
  const board = $('board');
  if (!board) return;
  const fab = $('boardFab'), bar = $('boardBar'), area = $('boardArea'), grip = $('boardResize');
  const base = $('boardBase'), live = $('boardLive'), eraserEl = $('boardEraser');
  const bgSel = $('boardBg'), undoBtn = $('boardUndo'), redoBtn = $('boardRedo'), clearBtn = $('boardClear');
  const bctx = base.getContext('2d'), lctx = live.getContext('2d');
  const mobile = matchMedia('(max-width:640px)');
  const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  const strokes = [];            // {pts:[{x,y,p}], color, size, sim, path, box}
  const undoStack = [], redoStack = [];
  let tool = 'pen', color = '--text', size = 8, bg = 'plain';
  let W = 0, H = 0, dpr = 1;
  let active = null;             // pointerId que está dibujando/borrando
  let cur = null;                // trazo en curso
  let erasing = null;            // Set de trazos marcados por el borrador
  let lastErase = null, liveQueued = false;
  const ERASER_R = 10;

  function finalize(s) {
    s.path = new Path2D(Ink.pathD(s));
    s.box = Ink.bounds(s);
  }

  /* --- Render --- */
  function drawBg() {
    const c = bctx;
    if (bg === 'grid') {
      c.strokeStyle = cssVar('--sep'); c.lineWidth = 1; c.beginPath();
      for (let x = 24.5; x < W; x += 24) { c.moveTo(x, 0); c.lineTo(x, H); }
      for (let y = 24.5; y < H; y += 24) { c.moveTo(0, y); c.lineTo(W, y); }
      c.stroke();
    } else if (bg === 'trellis') {
      // Espaciado fijo: al redimensionar, la plantilla no se mueve bajo el dibujo
      const x0 = 84, dx = 84, y0 = 64, dy = 64;
      c.strokeStyle = cssVar('--sep'); c.lineWidth = 1; c.beginPath();
      for (let i = 0; i < 4; i++) { c.moveTo(x0, y0 + i * dy + 0.5); c.lineTo(W, y0 + i * dy + 0.5); }
      c.stroke();
      c.font = '600 12px ' + cssVar('--mono'); c.fillStyle = cssVar('--text-2'); c.textBaseline = 'middle';
      c.textAlign = 'right';
      ['a·00', 'b·01', 'c·10', 'd·11'].forEach((label, i) => c.fillText(label, x0 - 16, y0 + i * dy));
      c.textAlign = 'center';
      for (let t = 0, x = x0; x < W - 16; t++, x += dx) {
        c.fillText('t=' + t, x, y0 - 34);
        for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(x, y0 + i * dy, 4, 0, Math.PI * 2); c.fill(); }
      }
    }
  }

  function redraw() {
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bctx.clearRect(0, 0, W, H);
    drawBg();
    const colors = {};
    for (const s of strokes) {
      bctx.globalAlpha = erasing && erasing.has(s) ? 0.2 : 1;
      bctx.fillStyle = colors[s.color] || (colors[s.color] = cssVar(s.color));
      bctx.fill(s.path);
    }
    bctx.globalAlpha = 1;
    syncButtons();
  }

  function drawLive() {
    liveQueued = false;
    lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lctx.clearRect(0, 0, W, H);
    if (!cur || !cur.pts.length) return;
    lctx.fillStyle = cssVar(cur.color);
    lctx.fill(new Path2D(Ink.pathD(cur)));
  }
  const queueLive = () => { if (!liveQueued) { liveQueued = true; requestAnimationFrame(drawLive); } };

  function resize() {
    const r = area.getBoundingClientRect();
    if (!r.width || !r.height) return;
    dpr = window.devicePixelRatio || 1; W = r.width; H = r.height;
    for (const c of [base, live]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    redraw(); drawLive();
  }
  new ResizeObserver(resize).observe(area);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redraw);
  new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* --- Borrador: marca trazos completos y los quita al soltar (como Excalidraw) --- */
  function eraseAt(x, y) {
    let hit = false;
    for (const s of strokes) {
      if (!erasing.has(s) && Ink.hits(s, x, y, ERASER_R)) { erasing.add(s); hit = true; }
    }
    if (hit) redraw();
  }
  function showEraser(x, y) {
    eraserEl.style.display = 'block';
    eraserEl.style.width = eraserEl.style.height = ERASER_R * 2 + 'px';
    eraserEl.style.transform = `translate(${x - ERASER_R}px,${y - ERASER_R}px)`;
  }

  /* --- Entrada de puntero --- */
  const pos = e => { const r = area.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  area.addEventListener('pointerdown', e => {
    if (active !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    area.setPointerCapture(e.pointerId);
    active = e.pointerId;
    const [x, y] = pos(e);
    if (tool === 'eraser' || e.button === 5) {        // 5 = goma de un lápiz óptico
      erasing = new Set(); lastErase = [x, y];
      showEraser(x, y); eraseAt(x, y);
    } else {
      cur = { pts: [], color, size, sim: !(e.pointerType === 'pen' && e.pressure > 0) };
      Ink.addPoint(cur, x, y, e.pressure || 0.5);
      queueLive();
    }
  });
  area.addEventListener('pointermove', e => {
    const [x, y] = pos(e);
    if (tool === 'eraser' || erasing) showEraser(x, y);
    if (e.pointerId !== active) return;
    if (erasing) {                                    // muestrea el tramo para no saltarse trazos
      const [lx, ly] = lastErase, steps = Math.max(1, Math.ceil(Math.hypot(x - lx, y - ly) / 4));
      for (let k = 1; k <= steps; k++) eraseAt(lx + (x - lx) * k / steps, ly + (y - ly) * k / steps);
      lastErase = [x, y];
    } else if (cur) {
      const evs = (e.getCoalescedEvents && e.getCoalescedEvents()) || [];
      for (const ev of evs.length ? evs : [e]) { const [cx, cy] = pos(ev); Ink.addPoint(cur, cx, cy, ev.pressure || 0.5); }
      queueLive();
    }
  });
  function endPointer(e) {
    if (e.pointerId !== active) return;
    active = null;
    if (erasing) {
      if (erasing.size) {
        const items = [...erasing].map(s => ({ s, i: strokes.indexOf(s) })).sort((a, b) => a.i - b.i);
        for (let k = items.length - 1; k >= 0; k--) strokes.splice(items[k].i, 1);
        record({ type: 'erase', items });
      }
      erasing = null; redraw();
      if (tool !== 'eraser') eraserEl.style.display = 'none';
      return;
    }
    if (cur) {
      const [x, y] = pos(e), last = cur.pts[cur.pts.length - 1];
      if (e.type === 'pointerup' && Math.hypot(x - last.x, y - last.y) > 0.5) cur.pts.push({ x, y, p: last.p });
      finalize(cur);
      strokes.push(cur);
      record({ type: 'add', s: cur });
      cur = null;
      drawLive(); redraw();
    }
  }
  area.addEventListener('pointerup', endPointer);
  area.addEventListener('pointercancel', endPointer);
  area.addEventListener('pointerleave', () => { if (!erasing) eraserEl.style.display = 'none'; });

  /* --- Historial --- */
  function record(a) { undoStack.push(a); redoStack.length = 0; syncButtons(); }
  function apply(a, forward) {
    if (a.type === 'add') { if (forward) strokes.push(a.s); else strokes.splice(strokes.lastIndexOf(a.s), 1); }
    else if (a.type === 'erase') {
      if (forward) a.items.forEach(({ s }) => strokes.splice(strokes.indexOf(s), 1));
      else a.items.forEach(({ s, i }) => strokes.splice(i, 0, s));
    } else if (a.type === 'clear') {
      if (forward) strokes.length = 0; else strokes.push(...a.items);
    }
  }
  function undo() { const a = undoStack.pop(); if (!a) return; apply(a, false); redoStack.push(a); redraw(); }
  function redo() { const a = redoStack.pop(); if (!a) return; apply(a, true); undoStack.push(a); redraw(); }
  function clearAll() { if (!strokes.length) return; record({ type: 'clear', items: strokes.splice(0) }); redraw(); }
  function syncButtons() {
    undoBtn.disabled = !undoStack.length;
    redoBtn.disabled = !redoStack.length;
    clearBtn.disabled = !strokes.length;
  }
  undoBtn.addEventListener('click', undo);
  redoBtn.addEventListener('click', redo);
  clearBtn.addEventListener('click', clearAll);

  /* --- Herramientas --- */
  const press = (attr, value) => board.querySelectorAll(`[${attr}]`).forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute(attr) === value)));
  function setTool(t) {
    tool = t; press('data-tool', t);
    area.classList.toggle('erasing', t === 'eraser');
    if (t !== 'eraser') eraserEl.style.display = 'none';
  }
  function setBg(v) { bg = v; bgSel.value = v; redraw(); }
  board.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
  board.querySelectorAll('[data-color]').forEach(b => b.addEventListener('click', () => { color = b.dataset.color; press('data-color', color); setTool('pen'); }));
  board.querySelectorAll('[data-size]').forEach(b => b.addEventListener('click', () => { size = +b.dataset.size; press('data-size', b.dataset.size); setTool('pen'); }));
  bgSel.addEventListener('change', () => setBg(bgSel.value));

  /* --- Ventana: mostrar/ocultar, mover, redimensionar y plegar ---
     En escritorio se redimensiona desde los 4 bordes y las 4 esquinas. Límites: como máximo casi
     toda la pantalla sin tapar la barra superior; si el alto baja de COLLAPSE_AT se pliega y
     queda solo la barra (doble clic en la barra pliega o despliega). El dibujo no se escala. */
  const MIN_W = 320, MIN_H = 220, COLLAPSE_AT = 120, TOP = 64, M = 8;
  const barH = () => bar.offsetHeight + 2;       // alto de la ventana plegada (barra + bordes)
  let rect = null;               // {x,y,w,h} en escritorio, una vez que el usuario la mueve; h = alto desplegada
  let collapsed = false;
  function applyRect() {
    if (mobile.matches || !rect) {
      collapsed = false;
      board.classList.remove('collapsed');
      board.style.left = board.style.top = board.style.width = board.style.height = board.style.right = board.style.bottom = '';
      return;
    }
    const vw = innerWidth, vh = innerHeight;
    rect.w = Math.max(MIN_W, Math.min(rect.w, vw - 2 * M));
    rect.h = Math.max(MIN_H, Math.min(rect.h, vh - TOP - M));
    const h = collapsed ? barH() : rect.h;
    rect.x = Math.max(M, Math.min(rect.x, vw - rect.w - M));
    rect.y = Math.max(TOP, Math.min(rect.y, vh - h - M));
    board.classList.toggle('collapsed', collapsed);
    Object.assign(board.style, { left: rect.x + 'px', top: rect.y + 'px', width: rect.w + 'px', height: h + 'px', right: 'auto', bottom: 'auto' });
  }
  function resizeFrom(dir, s, dx, dy) {
    const vw = innerWidth, vh = innerHeight;
    const L0 = s.x, R0 = s.x + s.w, T0 = s.y, B0 = s.y + (s.c ? barH() : s.h);
    if (dir.includes('e')) rect.w = Math.min(Math.max(R0 + dx, L0 + MIN_W), vw - M) - L0;
    if (dir.includes('w')) { rect.x = Math.max(Math.min(L0 + dx, R0 - MIN_W), M); rect.w = R0 - rect.x; }
    if (!dir.includes('n') && !dir.includes('s')) return;
    const raw = dir.includes('s') ? B0 + dy - T0 : B0 - (T0 + dy);
    if (raw < COLLAPSE_AT) {                     // muy baja: se pliega y recuerda su alto
      collapsed = true;
      rect.h = s.h;
      rect.y = dir.includes('n') ? B0 - barH() : T0;
      return;
    }
    collapsed = false;
    const h = Math.max(raw, MIN_H);
    if (dir.includes('s')) {
      rect.y = T0;
      rect.h = Math.min(h, vh - M - T0);
      if (rect.h < MIN_H) { rect.h = MIN_H; rect.y = vh - M - MIN_H; }
    } else {
      rect.y = Math.max(B0 - h, TOP);
      rect.h = B0 - rect.y;
    }
  }
  function ensureRect() {
    if (!rect) { const r = board.getBoundingClientRect(); rect = { x: r.left, y: r.top, w: r.width, h: r.height }; }
  }
  function toggleCollapse() {
    if (mobile.matches || board.hidden) return;
    ensureRect();
    collapsed = !collapsed;
    applyRect();
  }
  function setOpen(open) {
    board.hidden = !open;
    fab.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('board-on', open);
    if (open) { applyRect(); resize(); }
  }
  fab.addEventListener('click', () => setOpen(board.hidden));
  $('boardHide').addEventListener('click', () => setOpen(false));
  document.addEventListener('click', e => {
    const opener = e.target.closest('.board-open[data-board]');
    if (!opener) return;
    setBg(opener.dataset.board);
    setOpen(true);
  });

  function draggable(handle, onMove) {
    handle.addEventListener('pointerdown', e => {
      if (mobile.matches || e.button !== 0 || e.target.closest('button,select,label')) return;
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      ensureRect();
      const sx = e.clientX, sy = e.clientY, start = { ...rect, c: collapsed };
      board.classList.add('dragging');
      const move = ev => { onMove(start, ev.clientX - sx, ev.clientY - sy); applyRect(); };
      const up = () => {
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        handle.removeEventListener('pointercancel', up);
        board.classList.remove('dragging');
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
      handle.addEventListener('pointercancel', up);
    });
  }
  draggable(bar, (s, dx, dy) => { rect.x = s.x + dx; rect.y = s.y + dy; });
  bar.title = 'Arrastra para mover · doble clic para plegar o desplegar';
  bar.addEventListener('dblclick', e => { if (!e.target.closest('button,select,label')) toggleCollapse(); });
  // Bordes y esquinas para redimensionar (la esquina inferior derecha es el asa visible de siempre)
  draggable(grip, (s, dx, dy) => resizeFrom('se', s, dx, dy));
  for (const dir of ['n', 's', 'e', 'w', 'ne', 'nw', 'sw']) {
    const edge = document.createElement('div');
    edge.className = 'board-edge ' + dir;
    edge.setAttribute('aria-hidden', 'true');
    board.appendChild(edge);
    draggable(edge, (s, dx, dy) => resizeFrom(dir, s, dx, dy));
  }
  addEventListener('resize', () => { if (!board.hidden) applyRect(); });
  mobile.addEventListener('change', applyRect);

  /* --- Atajos (solo con la pizarra abierta y fuera de campos de texto) --- */
  document.addEventListener('keydown', e => {
    if (board.hidden || e.target.closest('input,textarea,select,[contenteditable]')) return;
    const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
    if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    else if (!mod && !e.altKey && k === 'p') setTool('pen');
    else if (!mod && !e.altKey && k === 'e') setTool('eraser');
  });

  syncButtons();
})();


/* ===== Anotaciones sobre la página =====
   Lápiz como el de los PDF en Edge, sobre todas las secciones de <main> (incluidos el
   cuestionario y el laboratorio). Cada sección lleva una capa SVG; cada trazo guarda
   coordenadas relativas a su ancla (el <details> que lo contiene o, si no, la sección),
   así acompaña al contenido cuando algo se abre o se cierra más arriba. Si cambia el
   ancho, se escala en horizontal.
   El stylus dibuja siempre; el mouse solo con el modo "Anotar" activo; el dedo nunca.
   Un toque sin arrastrar sobre un control (enlace, botón, summary…) pasa como clic.
   Todo vive en memoria: recargar la página lo borra. */
(() => {
  const $ = id => document.getElementById(id);
  const fab = $('inkFab'), board = $('board'), srcTools = board && board.querySelector('.board-tools');
  const hosts = [...document.querySelectorAll('main > section')];
  if (!fab || !srcTools || !hosts.length) return;
  const body = document.body, SVG = 'http://www.w3.org/2000/svg';
  const ERASER_R = 10, TAP_SLOP = 4, INTERACTIVE = 'a,button,summary,input,select,textarea,label';

  const layer = new Map();       // sección → <svg>
  for (const h of hosts) {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('class', 'ink-layer');
    svg.setAttribute('aria-hidden', 'true');
    h.classList.add('ink-host');
    h.appendChild(svg);
    layer.set(h, svg);
  }

  // Barra: copia de la de la pizarra (misma paleta, grosores e iconos)
  const bar = srcTools.cloneNode(true);
  bar.id = 'inkBar'; bar.hidden = true;
  bar.classList.replace('board-tools', 'ink-bar');
  bar.setAttribute('aria-label', 'Herramientas de anotación');
  const acts = { boardUndo: 'undo', boardRedo: 'redo', boardClear: 'clear' };
  bar.querySelectorAll('[id]').forEach(b => { b.dataset.act = acts[b.id]; b.removeAttribute('id'); });
  const btn = act => bar.querySelector(`[data-act="${act}"]`);
  const undoBtn = btn('undo'), redoBtn = btn('redo'), clearBtn = btn('clear');
  clearBtn.title = 'Borrar todas las anotaciones'; clearBtn.setAttribute('aria-label', clearBtn.title);
  const closeBtn = document.createElement('button');
  Object.assign(closeBtn, { type: 'button', className: 'bd-btn', title: 'Terminar de anotar (Esc)' });
  closeBtn.setAttribute('aria-label', 'Terminar de anotar');
  closeBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
  bar.querySelector('.bd-group').append(closeBtn);
  const eraserEl = document.createElement('div');
  eraserEl.className = 'ink-eraser';
  body.append(bar, eraserEl);

  const strokes = [];            // {host, anchor, inBody, w0, pts, color, size, sim, box, el, sx, ax, ay, vis}
  const undoStack = [], redoStack = [];
  let tool = 'pen', color = '--text', size = 8, on = false;
  let active = null, start = null, moved = false;
  let cur = null, erasing = null, lastErase = null, liveQueued = false, drewAt = 0;

  /* --- Posición: cada trazo sigue a su ancla --- */
  function docRect(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, shown: el.getClientRects().length > 0 };
  }
  function place(s, rects) {
    const get = el => { let r = rects.get(el); if (!r) rects.set(el, r = docRect(el)); return r; };
    const a = get(s.anchor);
    s.vis = a.shown && !(s.inBody && s.anchor.tagName === 'DETAILS' && !s.anchor.open);
    s.el.style.display = s.vis ? '' : 'none';
    if (!s.vis) return;
    const h = get(s.host), sx = a.w / s.w0 || 1;
    if (Math.abs(sx - s.sx) > 0.002) { s.sx = sx; s.el.setAttribute('d', Ink.pathD(s, sx)); }
    s.ax = a.x; s.ay = a.y;
    s.el.setAttribute('transform', `translate(${a.x - h.x} ${a.y - h.y})`);
  }
  function relayout() { const rects = new Map(); for (const s of strokes) place(s, rects); }
  let layoutQueued = false;
  function queueLayout() {
    if (layoutQueued || !strokes.length) return;
    layoutQueued = true;
    requestAnimationFrame(() => { layoutQueued = false; relayout(); });
  }
  new ResizeObserver(queueLayout).observe(document.querySelector('main'));
  document.addEventListener('toggle', queueLayout, true);
  addEventListener('resize', queueLayout);

  /* --- Entrada --- */
  const hostOf = el => el instanceof Element ? el.closest('.ink-host') : null;
  const draws = e => e.pointerType === 'pen' || (on && e.pointerType === 'mouse' && e.button === 0);
  const penEraser = e => e.pointerType === 'pen' && (e.button === 5 || e.button === 2);   // goma o botón lateral
  const docXY = e => [e.clientX + scrollX, e.clientY + scrollY];

  function showEraser(e) {
    eraserEl.style.display = 'block';
    eraserEl.style.width = eraserEl.style.height = ERASER_R * 2 + 'px';
    eraserEl.style.transform = `translate(${e.clientX - ERASER_R}px,${e.clientY - ERASER_R}px)`;
  }
  function eraseAt(x, y) {
    for (const s of strokes) {
      if (!s.vis || erasing.has(s)) continue;
      if (Ink.hits(s, (x - s.ax) / s.sx, y - s.ay, ERASER_R)) { erasing.add(s); s.el.style.opacity = '.2'; }
    }
  }
  function drawLive() {
    liveQueued = false;
    if (cur && cur.pts.length) cur.el.setAttribute('d', Ink.pathD(cur));
  }
  const queueLive = () => { if (!liveQueued) { liveQueued = true; requestAnimationFrame(drawLive); } };

  document.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch') body.classList.remove('ink-pen');
    const host = hostOf(e.target);
    if (!host || active !== null || !draws(e)) return;
    const tap = !!e.target.closest(INTERACTIVE);
    if (!tap) e.preventDefault();          // sin selección de texto ni foco
    relayout();
    active = e.pointerId; start = { x: e.clientX, y: e.clientY, host, tap }; moved = false;
    const [x, y] = docXY(e);
    if (tool === 'eraser' || penEraser(e)) {
      erasing = new Set(); lastErase = [x, y];
      showEraser(e); eraseAt(x, y);
      return;
    }
    const anchor = e.target.closest('details') || host, a = docRect(anchor), h = docRect(host);
    const el = document.createElementNS(SVG, 'path');
    el.style.fill = `var(${color})`;
    el.setAttribute('transform', `translate(${a.x - h.x} ${a.y - h.y})`);
    layer.get(host).appendChild(el);
    cur = {
      host, anchor, inBody: !e.target.closest('summary'), w0: a.w, sx: 1, ax: a.x, ay: a.y, vis: true,
      pts: [], color, size, sim: !(e.pointerType === 'pen' && e.pressure > 0), el
    };
    Ink.addPoint(cur, x - a.x, y - a.y, e.pressure || 0.5);
    queueLive();
  }, true);

  document.addEventListener('pointermove', e => {
    const overHost = hostOf(e.target);
    if (erasing || (tool === 'eraser' && overHost && (e.pointerType === 'pen' || (on && e.pointerType === 'mouse')))) showEraser(e);
    else eraserEl.style.display = 'none';
    if (e.pointerId !== active) return;
    if (!moved && Math.hypot(e.clientX - start.x, e.clientY - start.y) > TAP_SLOP) {
      moved = true;
      // Captura tardía: si se capturara al tocar, el clic de un toque no llegaría al control
      try { start.host.setPointerCapture(e.pointerId); } catch (err) { }
    }
    if (erasing) {                        // muestrea el tramo para no saltarse trazos
      const [x, y] = docXY(e), [lx, ly] = lastErase, steps = Math.max(1, Math.ceil(Math.hypot(x - lx, y - ly) / 4));
      for (let k = 1; k <= steps; k++) eraseAt(lx + (x - lx) * k / steps, ly + (y - ly) * k / steps);
      lastErase = [x, y];
    } else if (cur) {
      const evs = (e.getCoalescedEvents && e.getCoalescedEvents()) || [];
      for (const ev of evs.length ? evs : [e]) { const [x, y] = docXY(ev); Ink.addPoint(cur, x - cur.ax, y - cur.ay, ev.pressure || 0.5); }
      queueLive();
    }
  });

  function endPointer(e) {
    if (e.pointerId !== active) return;
    active = null;
    const cancelled = e.type === 'pointercancel';
    if (erasing) {
      erasing.forEach(s => { s.el.style.opacity = ''; });
      if (!cancelled && erasing.size) {
        const items = [...erasing].map(s => ({ s, i: strokes.indexOf(s) })).sort((a, b) => a.i - b.i);
        items.forEach(({ s }) => detach(s));
        record({ type: 'erase', items });
      }
      erasing = null;
      if (tool !== 'eraser') eraserEl.style.display = 'none';
      if (!cancelled) drewAt = performance.now();
      return;
    }
    if (!cur) return;
    const s = cur; cur = null;
    if (cancelled || (start.tap && !moved)) { s.el.remove(); return; }   // toque a un control: que sea clic
    const [x, y] = docXY(e), last = s.pts[s.pts.length - 1];
    if (Math.hypot(x - s.ax - last.x, y - s.ay - last.y) > 0.5) s.pts.push({ x: x - s.ax, y: y - s.ay, p: last.p });
    s.box = Ink.bounds(s);
    s.el.setAttribute('d', Ink.pathD(s));
    strokes.push(s);
    record({ type: 'add', s });
    drewAt = performance.now();
  }
  document.addEventListener('pointerup', endPointer);
  document.addEventListener('pointercancel', endPointer);
  // Tras dibujar, el clic que sigue al levantar no debe abrir un details ni seguir un enlace
  addEventListener('click', e => {
    if (performance.now() - drewAt < 500 && hostOf(e.target)) { e.preventDefault(); e.stopPropagation(); drewAt = 0; }
  }, true);
  document.addEventListener('contextmenu', e => { if (e.pointerType === 'pen' && hostOf(e.target)) e.preventDefault(); });

  // Que el stylus no desplace la página: touch-action se decide al tocar, así que se
  // activa mientras el lápiz está cerca (hover) y se quita cuando sale de rango.
  document.addEventListener('pointerover', e => { if (e.pointerType === 'pen') body.classList.add('ink-pen'); });
  document.addEventListener('pointerout', e => {
    if (e.pointerType === 'pen' && !e.relatedTarget && active === null) body.classList.remove('ink-pen');
  });
  // iPad/Android: el lápiz también genera touch events con touchType "stylus"
  for (const h of hosts) h.addEventListener('touchstart', e => {
    if ([...e.changedTouches].some(t => t.touchType === 'stylus') && !e.target.closest(INTERACTIVE)) e.preventDefault();
  }, { passive: false });

  /* --- Historial --- */
  function attach(s, i = strokes.length) { strokes.splice(i, 0, s); layer.get(s.host).appendChild(s.el); }
  function detach(s) { strokes.splice(strokes.indexOf(s), 1); s.el.remove(); }
  function record(a) { undoStack.push(a); redoStack.length = 0; syncButtons(); }
  function apply(a, forward) {
    if (a.type === 'add') forward ? attach(a.s) : detach(a.s);
    else if (a.type === 'erase') forward ? a.items.forEach(({ s }) => detach(s)) : a.items.forEach(({ s, i }) => attach(s, i));
    else if (a.type === 'clear') forward ? a.items.forEach(detach) : a.items.forEach(s => attach(s));
    relayout();
  }
  function undo() { const a = undoStack.pop(); if (!a) return; apply(a, false); redoStack.push(a); syncButtons(); }
  function redo() { const a = redoStack.pop(); if (!a) return; apply(a, true); undoStack.push(a); syncButtons(); }
  function clearAll() {
    if (!strokes.length) return;
    const items = strokes.slice();
    items.forEach(detach);
    record({ type: 'clear', items });
  }
  function syncButtons() {
    undoBtn.disabled = !undoStack.length;
    redoBtn.disabled = !redoStack.length;
    clearBtn.disabled = !strokes.length;
  }
  undoBtn.addEventListener('click', undo);
  redoBtn.addEventListener('click', redo);
  clearBtn.addEventListener('click', clearAll);

  /* --- Herramientas y modo --- */
  const press = (attr, value) => bar.querySelectorAll(`[${attr}]`).forEach(b => b.setAttribute('aria-pressed', String(b.getAttribute(attr) === value)));
  function setTool(t) { tool = t; press('data-tool', t); body.classList.toggle('ink-erasing', t === 'eraser'); }
  bar.querySelectorAll('[data-tool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
  bar.querySelectorAll('[data-color]').forEach(b => b.addEventListener('click', () => { color = b.dataset.color; press('data-color', color); setTool('pen'); }));
  bar.querySelectorAll('[data-size]').forEach(b => b.addEventListener('click', () => { size = +b.dataset.size; press('data-size', b.dataset.size); setTool('pen'); }));

  function setOn(v) {
    on = v; bar.hidden = !v;
    fab.setAttribute('aria-expanded', String(v));
    body.classList.toggle('ink-on', v);
    if (!v) eraserEl.style.display = 'none';
  }
  fab.addEventListener('click', () => setOn(!on));
  closeBtn.addEventListener('click', () => setOn(false));

  /* --- Atajos (modo activo, pizarra cerrada y fuera de campos de texto) --- */
  document.addEventListener('keydown', e => {
    if (!on || !board.hidden || e.target.closest('input,textarea,select,[contenteditable]')) return;
    const k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
    if (mod && k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if (mod && (k === 'y' || (k === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
    else if (!mod && !e.altKey && k === 'p') setTool('pen');
    else if (!mod && !e.altKey && k === 'e') setTool('eraser');
    else if (k === 'escape') setOn(false);
  });

  syncButtons();
})();
