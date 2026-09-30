/* ===== Guía Arquitectura II: resaltado ASM, simulador paso a paso, tabla del profe, conversor,
   direccionamiento, trazas en papel, banco de ejercicios con comparador y cuestionarios =====
   Usa window.ASM (asm8086.js) y window.ARQ (arqui2-datos.js). Todo corre en el navegador:
   el progreso y los borradores se guardan en localStorage. */
(function () {
  'use strict';
  const A = window.ASM, D = window.ARQ;
  if (!A || !D) return;
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { } }
  };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hex = A.hex;
  const pct = x => Math.floor(x * 1000) / 10;

  /* ---------- Enlaces internos: abrir los <details> que contienen el destino ---------- */
  function abrirHasta(hash) {
    let el = null;
    try { el = hash && hash.length > 1 && document.getElementById(decodeURIComponent(hash.slice(1))); } catch (e) { }
    for (let p = el && el.parentElement; p; p = p.parentElement) if (p.tagName === 'DETAILS' && !p.open) p.open = true;
  }
  document.addEventListener('click', e => { const a = e.target.closest('a[href^="#"]'); if (a) abrirHasta(a.getAttribute('href')); }, true);
  addEventListener('hashchange', () => abrirHasta(location.hash));
  abrirHasta(location.hash);

  /* ---------- Resaltado de ensamblador ---------- */
  const MNEM = new Set('MOV LEA ADD SUB ADC SBB INC DEC NEG NOT MUL DIV IMUL IDIV CMP AND OR XOR TEST SHR SHL SAL SAR JMP LOOP PUSH POP INT RET HLT NOP CALL XCHG CBW CLC STC JE JZ JNE JNZ JB JC JNAE JAE JNB JNC JBE JNA JA JNBE JL JNGE JGE JNL JLE JNG JG JNLE JS JNS JO JNO JP JPE JNP JPO JCXZ'.split(' '));
  const REGS = new Set('AX BX CX DX SI DI BP SP AL AH BL BH CL CH DL DH CS DS SS ES IP EAX EBX ECX EDX ESI EDI EBP ESP EIP RAX RBX RCX RDX RSI RDI RBP RSP RIP R8 R9 R10 R11 R12 R13 R14 R15 R8D R8W R8B'.split(' '));
  const DIREC = new Set('DB DW DD DUP EQU ORG OFFSET PTR BYTE WORD .MODEL .STACK .DATA .CODE END SMALL SEGMENT ENDS ASSUME @DATA PROC ENDP'.split(' '));
  function commentAt(line) {
    let q = null;
    for (let i = 0; i < line.length; i++) { const c = line[i]; if (q) { if (c === q) q = null; } else if (c === "'" || c === '"') q = c; else if (c === ';') return i; }
    return -1;
  }
  function hlAsm(src) {
    return String(src).split('\n').map(line => {
      const ci = commentAt(line), code = ci >= 0 ? line.slice(0, ci) : line, com = ci >= 0 ? line.slice(ci) : '';
      let out = '', last = 0, m;
      const re = /'[^']*'?|"[^"]*"?|[A-Za-z_@.][\w@.]*|\d\w*/g;
      while ((m = re.exec(code))) {
        out += esc(code.slice(last, m.index)); last = re.lastIndex;
        const t = m[0], U = t.toUpperCase();
        let cls = '';
        if (t[0] === "'" || t[0] === '"') cls = 'tk-str';
        else if (/^\d/.test(t)) cls = 'tk-num';
        else if (MNEM.has(U)) cls = 'tk-kw';
        else if (REGS.has(U)) cls = 'tk-type';
        else if (DIREC.has(U)) cls = 'tk-attr';
        else if (code[re.lastIndex] === ':') cls = 'tk-lbl';
        out += cls ? `<span class="${cls}">${esc(t)}</span>` : esc(t);
      }
      out += esc(code.slice(last));
      if (com) out += `<span class="tk-com">${esc(com)}</span>`;
      return out;
    }).join('\n');
  }
  const codeBox = (src, file) => `<div class="codebox">${file ? `<div class="file">${file}</div>` : ''}<pre class="code" data-lang="asm">${hlAsm(src)}</pre></div>`;
  $$('pre.code[data-lang="asm"]').forEach(pre => { pre.innerHTML = hlAsm(pre.textContent); });

  /* ---------- Formatos numéricos ---------- */
  const signed = (v, bits) => bits === 16 ? (v << 16 >> 16) : bits === 8 ? (v << 24 >> 24) : v;
  const bin = (v, bits) => (v >>> 0).toString(2).padStart(bits, '0').replace(/(\d{4})(?=\d)/g, '$1 ');
  const chr = v => v >= 32 && v < 127 ? String.fromCharCode(v) : v >= 128 && v < 256 ? A.CP437[v] : '';
  function fmtVal(v, fmt, bits) {
    switch (fmt) {
      case 'h': return hex(v, bits / 4) + 'h';
      case 'd': return String(v);
      case 's': return String(signed(v, bits)).replace('-', '−');
      case 'o': return (v >>> 0).toString(8);
      case 'b': return bin(v, bits);
      case 'c': return chr(v) || `control ${hex(v, 2)}h`;
      case 'f': return String(v);
    }
    return String(v);
  }
  // Interpreta lo que escribe el alumno según el formato pedido
  function parseAns(s, fmt) {
    s = String(s || '').trim().replace(/−/g, '-');
    if (!s) return null;
    if (fmt === 'c') return s.replace(/^['"]|['"]$/g, '')[0] || null;
    if (fmt === 'f') { const t = s.toLowerCase(); if (['1', 'si', 'sí', 's', 'true', 'x'].includes(t)) return 1; if (['0', 'no', 'n', 'false'].includes(t)) return 0; return null; }
    const t = s.replace(/\s+/g, '').toUpperCase();
    if (fmt === 'h') { const m = t.replace(/^0X/, '').replace(/H$/, ''); return /^[0-9A-F]+$/.test(m) ? parseInt(m, 16) : null; }
    if (fmt === 'o') { const m = t.replace(/[OQ]$/, ''); return /^[0-7]+$/.test(m) ? parseInt(m, 8) : null; }
    if (fmt === 'b') { const m = t.replace(/B$/, ''); return /^[01]+$/.test(m) ? parseInt(m, 2) : null; }
    if (fmt === 'd' || fmt === 's') { const m = t.replace(/D$/, ''); return /^-?\d+$/.test(m) ? parseInt(m, 10) : null; }
    return null;
  }
  const FMT_NOMBRE = { h: 'hex', d: 'decimal', s: 'decimal con signo', o: 'octal', b: 'binario', c: 'ASCII', f: '0 / 1' };

  /* ---------- Tabla de registros "del profe" (estilo hoja de cálculo) ---------- */
  const R64 = { RAX: 'AX', RBX: 'BX', RCX: 'CX', RDX: 'DX', RSI: 'SI', RDI: 'DI', RBP: 'BP', RSP: 'SP', RIP: 'IP' };
  function tablaProfe(regs, o = {}) {
    const left = o.left || ['RAX', 'RBX', 'RCX', 'RDX', 'RSI', 'RDI', 'RBP', 'RSP'];
    const right = o.right || ['CS', 'SS', 'ES', 'DS'];
    const val = n => { const k = R64[n] || n; return regs[n] != null ? regs[n] : regs[k] != null ? regs[k] : 0; };
    const rows = Math.max(left.length, right.length);
    let h = `<div class="tbl-wrap profe-wrap"><table class="profe"${o.id ? ` id="${o.id}"` : ''}><tbody>`;
    for (let i = 0; i < rows; i++) {
      const l = left[i], r = right[i];
      h += '<tr>';
      if (l) {
        const v = val(l), lo = o.edit ? `<input class="profe-in" data-reg="${l}" value="${hex(v)}" maxlength="4" aria-label="${l} (16 bits bajos)" spellcheck="false">` : hex(v);
        h += `<th>${l}</th><td>0000</td><td>0000</td><td>0000</td><td class="lo">${lo}</td>`;
      } else h += '<th></th><td></td><td></td><td></td><td></td>';
      if (r) {
        const v = val(r), cell = o.edit ? `<input class="profe-in" data-reg="${r}" value="${hex(v)}" maxlength="4" aria-label="${r}" spellcheck="false">` : hex(v);
        h += `<th class="sg">${r}</th><td class="lo">${cell}</td>`;
      } else h += '<th class="sg"></th><td></td>';
      h += '</tr>';
    }
    return h + '</tbody></table></div>';
  }
  $$('[data-profe]').forEach(el => {
    const o = JSON.parse(el.dataset.profe);
    const regs = {}; for (const k in o.regs) regs[k] = parseInt(o.regs[k], 16);
    el.innerHTML = tablaProfe(regs, o);
  });

  /* ---------- Pantalla de 80×25 (colores CGA) ---------- */
  function scrHTML(m, minRows = 3) {
    let last = -1;
    for (let y = 24; y >= 0 && last < 0; y--) for (let x = 0; x < 80; x++) if (m.scr[y * 80 + x] !== 32 || m.att[y * 80 + x] !== 7) { last = y; break; }
    const rows = Math.max(minRows, Math.min(25, Math.max(last, m.row) + 1));
    let h = '';
    for (let y = 0; y < rows; y++) {
      let cur = -1, run = '';
      const flush = () => { if (run) h += cur === 7 ? esc(run) : `<span class="c${(cur & 15).toString(16)} b${((cur >> 4) & 7).toString(16)}">${esc(run)}</span>`; run = ''; };
      for (let x = 0; x < 80; x++) {
        const p = y * 80 + x, a = m.att[p], c = A.CP437[m.scr[p]] || ' ';
        if (y === m.row && x === m.col && m.state !== 'exit' && m.state !== 'end' && m.state !== 'halt') { flush(); h += `<span class="cur">${esc(c)}</span>`; cur = -1; continue; }
        if (a !== cur) { flush(); cur = a; }
        run += c;
      }
      flush();
      h += '\n';
    }
    return `<pre class="scr">${h.replace(/ +\n/g, '\n')}</pre>`;
  }
  // Firma de pantalla (texto + colores) para comparar dos ejecuciones
  function firma(m) {
    let s = m.screenText() + '|';
    for (let p = 0; p < 2000; p++) if (m.scr[p] !== 32) s += m.att[p].toString(16);
    return s;
  }

  /* ---------- Descripciones para el paso a paso ---------- */
  const DESC = {
    MOV: 'copia el origen en el destino (el origen no cambia)', LEA: 'carga la dirección (desplazamiento) de la variable, no su contenido',
    ADD: 'suma el origen al destino', SUB: 'resta el origen al destino', INC: 'suma 1 (no toca CF)', DEC: 'resta 1 (no toca CF)',
    NEG: 'complemento a 2: invierte los bits y suma 1', MUL: 'multiplica sin signo (8 bits: AX = AL × op · 16 bits: DX:AX = AX × op)',
    DIV: 'divide sin signo (8 bits: AL = cociente, AH = residuo · 16 bits: AX y DX)', CMP: 'resta sin guardar: solo ajusta las banderas',
    JMP: 'salta siempre', LOOP: 'CX = CX − 1 y salta si CX ≠ 0', PUSH: 'SP = SP − 2 y guarda el valor en SS:SP', POP: 'lee la palabra de SS:SP y SP = SP + 2',
    SHR: 'corre los bits a la derecha (÷ 2)', SHL: 'corre los bits a la izquierda (× 2)', RET: 'regresa (en un .COM termina el programa)',
    HLT: 'detiene el procesador', XOR: 'O exclusivo bit a bit (no se usa en el curso)', AND: 'Y bit a bit (no se usa en el curso)', OR: 'O bit a bit (no se usa en el curso)', NOT: 'invierte los bits', NOP: 'no hace nada'
  };
  const JDESC = { JE: 'salta si ZF = 1 (iguales)', JZ: 'salta si ZF = 1', JNE: 'salta si ZF = 0 (distintos)', JNZ: 'salta si ZF = 0', JB: 'salta si CF = 1 (menor, sin signo)', JC: 'salta si CF = 1', JAE: 'salta si CF = 0 (mayor o igual, sin signo)', JNB: 'salta si CF = 0', JNC: 'salta si CF = 0', JBE: 'salta si CF = 1 o ZF = 1 (menor o igual)', JA: 'salta si CF = 0 y ZF = 0 (mayor, sin signo)', JL: 'salta si SF ≠ OF (menor, con signo)', JG: 'salta si ZF = 0 y SF = OF (mayor, con signo)', JLE: 'salta si ZF = 1 o SF ≠ OF', JGE: 'salta si SF = OF' };
  const I21 = { 0x01: 'lee una tecla con eco y la deja en AL', 0x02: 'imprime el carácter que está en DL', 0x07: 'lee una tecla sin eco', 0x08: 'lee una tecla sin eco', 0x09: 'imprime la cadena de DS:DX hasta el $', 0x0A: 'lee una cadena con Enter en el búfer DS:DX', 0x4C: 'termina el programa y regresa al sistema' };
  const I10 = { 0x00: 'cambia el modo de video (AL = 03h: texto 80×25) y limpia la pantalla', 0x02: 'mueve el cursor a la fila DH, columna DL', 0x03: 'lee la posición del cursor: fila → DH, columna → DL', 0x09: 'escribe AL con el color BL, CX veces, sin mover el cursor', 0x0E: 'imprime AL como teletipo' };
  const FLAGS = ['CF', 'ZF', 'SF', 'OF', 'PF', 'AF', 'IF', 'DF'];
  const FLAG_TIP = { CF: 'Acarreo / préstamo (sin signo)', ZF: 'Cero: el resultado fue 0', SF: 'Signo: bit más alto = 1', OF: 'Desbordamiento con signo', PF: 'Paridad: cantidad par de unos en el byte bajo', AF: 'Acarreo auxiliar (entre nibbles)', IF: 'Interrupciones habilitadas', DF: 'Dirección (instrucciones de cadena)' };
  const snap = m => ({ r: Array.from(m.r), s: Array.from(m.s), f: Object.assign({}, m.f), ip: m.ip });
  const parseAddr = (s, dflt) => { const m = String(s).trim().match(/^([0-9A-Fa-f]{1,4})\s*:\s*([0-9A-Fa-f]{1,4})h?$/); return m ? [parseInt(m[1], 16), parseInt(m[2], 16)] : dflt; };
  const parseRegs = s => { const o = {}; String(s || '').split(/[,\s]+/).filter(Boolean).forEach(kv => { const [k, v] = kv.split('='); if (k && v) o[k.toUpperCase()] = parseInt(v, 16); }); return o; };

  /* ---------- Simulador paso a paso (widget) ---------- */
  class Emu {
    constructor(el, cfg) {
      this.el = el; this.cfg = cfg; this.inputStr = cfg.input || '';
      el.classList.add('emu');
      const screen = cfg.screen !== false && (cfg.editable || cfg.screen);
      el.innerHTML = `
        ${cfg.editable ? `<div class="emu-edit">
          <div class="row">
            <div class="field"><label>Ejemplo</label><select class="emu-ej"></select></div>
            <div class="field"><label>Teclado (lo que escribirá el usuario; \\r = Enter)</label><input class="emu-in" spellcheck="false" autocomplete="off"></div>
          </div>
          <label class="sr-only">Código</label>
          <textarea class="reto-code emu-ta" spellcheck="false" autocomplete="off"></textarea>
          <p class="reto-hint">Pega tu programa (org 100h o .MODEL SMALL) y pulsa <b>Ensamblar</b>. Tab inserta espacios.</p>
        </div>` : ''}
        <div class="emu-bar">
          ${cfg.editable ? '<button type="button" class="btn" data-a="load">Ensamblar</button>' : ''}
          <button type="button" class="btn sec" data-a="reset" title="Volver al inicio">⟲ Reiniciar</button>
          <button type="button" class="btn sec" data-a="back" title="Deshacer el último paso">◀ Atrás</button>
          <button type="button" class="btn" data-a="step" title="Ejecutar la instrucción amarilla">Paso ▶</button>
          <button type="button" class="btn sec" data-a="run" title="Ejecutar hasta el final o hasta pedir teclado">Ejecutar todo ⏭</button>
          <label class="emu-hide"><input type="checkbox" data-a="hide"> Ocultar valores (predice y toca para ver)</label>
        </div>
        <div class="emu-status" aria-live="polite"></div>
        <div class="emu-key" hidden><span>⌨ El programa espera teclado:</span><input class="emu-key-in" maxlength="40" spellcheck="false" autocomplete="off" placeholder="escribe y Enter"><button type="button" class="btn" data-a="send">Enviar</button><button type="button" class="btn sec" data-a="enter">Enter ↵</button></div>
        <div class="emu-grid${screen ? ' has-scr' : ''}">
          <div class="emu-pane emu-code-pane"><div class="emu-h">Código <span class="muted">· amarillo = siguiente (IP)</span></div><pre class="emu-code"></pre></div>
          <div class="emu-pane"><div class="emu-h">Registros</div><div class="emu-regs"></div><div class="emu-h">Banderas</div><div class="emu-flags"></div></div>
          <div class="emu-pane emu-mem-pane"><div class="mcol"><div class="emu-h">Memoria <input class="emu-addr" spellcheck="false" aria-label="Dirección segmento:desplazamiento" title="Escribe segmento:desplazamiento y Enter"> <span class="muted">azul = se escribió en este paso</span></div><div class="emu-mem"></div></div><div class="scol"><div class="emu-h">Pila <span class="muted">(desde SS:SP)</span></div><div class="emu-stack"></div></div></div>
          ${screen ? '<div class="emu-pane emu-scr-pane"><div class="emu-h">Pantalla <span class="muted">(emulator screen)</span></div><div class="emu-scr"></div></div>' : ''}
        </div>
        <div class="emu-exp"></div>`;
      this.q = s => el.querySelector(s);
      el.addEventListener('click', e => {
        const b = e.target.closest('[data-a]');
        if (b && b.tagName === 'BUTTON') { this[b.dataset.a](); return; }
        const v = e.target.closest('.hiding .v');
        if (v) v.classList.toggle('peek');
      });
      this.q('[data-a="hide"]').addEventListener('change', e => { el.classList.toggle('hiding', e.target.checked); });
      this.q('.emu-addr').addEventListener('keydown', e => { if (e.key === 'Enter') { this.watch = parseAddr(e.target.value, this.watch); this.follow = false; this.render(); } });
      this.q('.emu-key-in').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); this.send('key'); } });
      if (cfg.editable) {
        this.ta = this.q('.emu-ta'); this.inEl = this.q('.emu-in');
        const sel = this.q('.emu-ej');
        sel.innerHTML = cfg.examples.map((x, i) => `<option value="${i}">${esc(x.nombre)}</option>`).join('');
        const pick = i => { const x = cfg.examples[i]; this.ta.value = x.code; this.inEl.value = (x.input || '').replace(/\r/g, '\\r'); this.load(); };
        sel.addEventListener('change', () => pick(+sel.value));
        tabIndent(this.ta, '   ');
        pick(0);
      } else this.load();
    }
    src() { return this.cfg.editable ? this.ta.value : this.cfg.code; }
    load() {
      if (this.cfg.editable) this.inputStr = this.inEl.value.replace(/\\r/g, '\r');
      try { this.prog = A.assemble(this.src(), { snippet: !!this.cfg.snippet }); this.err = null; }
      catch (e) { this.prog = null; this.err = e; }
      this.reset();
    }
    fresh() { return new A.Machine(this.prog, { regs: this.cfg.regs, mem: this.cfg.mem, input: this.inputStr }); }
    reset() {
      this.prev = null; this.lastIns = null; this.outDelta = ''; this.follow = true;
      if (this.prog) {
        this.m = this.fresh(); this.mem0 = this.m.mem.slice();
        const dflt = this.prog.mode === 'exe' ? [this.prog.dataSeg, 0] : this.prog.mode === 'com' ? [0x0700, 0x0100] : [this.m.get('DS'), 0];
        this.watch = parseAddr(this.cfg.watch || '', dflt);
      } else this.m = null;
      this.render();
    }
    one() {
      const m = this.m;
      this.prev = snap(m); this.lastIns = m.p.code[m.ip];
      const ob = m.out.length;
      m.step();
      this.outDelta = m.out.slice(ob);
      if (m.state === 'input') { this.prev = null; this.lastIns = null; }
      if (this.follow && m.wFirst) this.watch = [m.wFirst[0], m.wFirst[1]];
    }
    step() { if (!this.m) return; if (this.m.state === 'run') this.one(); this.render(); }
    run() {
      if (!this.m) return;
      let n = 0;
      while (this.m.state === 'run' && n < 20000) { this.one(); n++; }
      this.render(n >= 20000 ? 'Se pausó tras 20 000 pasos: ¿ciclo infinito?' : '');
    }
    back() {
      if (!this.m || this.m.steps === 0) return;
      const target = this.m.steps - 1, w = this.watch, fol = this.follow;
      const m = this.fresh(); this.m = m;
      while (m.steps < target - 1 && m.state === 'run') m.step();
      this.prev = null; this.lastIns = null; this.outDelta = '';
      if (target >= 1 && m.state === 'run') this.one();
      this.watch = w; this.follow = fol;
      this.render();
    }
    // Enviar: solo las teclas escritas · Enter ↵: las teclas + Enter · Enter en el cuadro vacío: un Enter
    send(cr) {
      const inp = this.q('.emu-key-in');
      let txt = inp.value;
      if (cr === 'key') { if (!txt) txt = '\r'; } else if (cr === true) txt += '\r';
      if (!txt || !this.m) return;
      this.inputStr += txt; this.m.addInput(txt); this.m.resume(); inp.value = '';
      if (this.cfg.editable) this.inEl.value = this.inputStr.replace(/\r/g, '\\r');
      this.run();
    }
    enter() { this.send(true); }
    render(note) {
      const m = this.m, st = this.q('.emu-status');
      const key = this.q('.emu-key');
      if (!m) {
        const e = this.err;
        st.className = 'emu-status bad';
        st.innerHTML = e ? `Error de ensamblado${e.line ? ` en la línea ${e.line}` : ''}: ${esc(e.message)}` : 'Sin programa.';
        this.q('.emu-code').innerHTML = this.listing(e && e.line);
        ['.emu-regs', '.emu-flags', '.emu-mem', '.emu-stack', '.emu-exp'].forEach(s => { this.q(s).innerHTML = ''; });
        if (this.q('.emu-scr')) this.q('.emu-scr').innerHTML = '';
        key.hidden = true;
        return;
      }
      const S = {
        run: `Paso ${m.steps} · la siguiente es la línea ${m.line()}`,
        input: 'Esperando teclado: el programa llamó a INT 21h para leer.',
        exit: `Programa terminado (paso ${m.steps}).`, halt: `HLT: procesador detenido (paso ${m.steps}).`,
        end: `Fin del código (paso ${m.steps}): ya no hay más instrucciones.`,
        error: `Error en la línea ${m.errLine}: ${m.error}`, limit: m.error || 'Demasiados pasos.'
      };
      st.className = 'emu-status' + (m.state === 'error' || m.state === 'limit' ? ' bad' : m.state === 'run' ? '' : ' fin');
      st.textContent = (note ? note + ' ' : '') + (S[m.state] || m.state);
      key.hidden = m.state !== 'input';
      this.q('.emu-code').innerHTML = this.listing();
      const pre = this.q('.emu-code'), cur = pre.querySelector('.cur') || pre.querySelector('.done');
      if (cur) { const top = cur.offsetTop - pre.offsetTop; if (top < pre.scrollTop + 10 || top > pre.scrollTop + pre.clientHeight - 30) pre.scrollTop = Math.max(0, top - pre.clientHeight / 3); }
      this.q('.emu-regs').innerHTML = this.regsHTML();
      this.q('.emu-flags').innerHTML = FLAGS.map(f => `<span class="flag${this.prev && this.prev.f[f] !== m.f[f] ? ' chg' : ''}" title="${FLAG_TIP[f]}"><b>${f}</b><i class="v">${m.f[f] ? 1 : 0}</i></span>`).join('');
      const ai = this.q('.emu-addr'); if (document.activeElement !== ai) ai.value = `${hex(this.watch[0])}:${hex(this.watch[1])}`;
      this.q('.emu-mem').innerHTML = this.memHTML();
      this.q('.emu-stack').innerHTML = this.stackHTML();
      if (this.q('.emu-scr')) this.q('.emu-scr').innerHTML = scrHTML(m);
      this.q('.emu-exp').innerHTML = this.explain();
    }
    listing(errLine) {
      const lines = this.prog ? this.prog.lines : this.src().split(/\r?\n/);
      const m = this.m, cur = m && (m.state === 'run' || m.state === 'input') ? m.line() : 0;
      const done = this.lastIns ? this.lastIns.ln : 0;
      return lines.map((l, i) => {
        const n = i + 1, cls = n === cur ? 'cur' : n === done ? 'done' : n === errLine || (m && m.state === 'error' && n === m.errLine) ? 'err' : '';
        return `<span class="ln${cls ? ' ' + cls : ''}"><i>${n}</i>${hlAsm(l) || ' '}</span>`;
      }).join('');
    }
    regsHTML() {
      const m = this.m, p = this.prev;
      const ch16 = i => p && p.r[i] !== m.r[i], chS = i => p && p.s[i] !== m.s[i];
      const byte = (i, hi) => { const v = hi ? m.r[i] >> 8 : m.r[i] & 255, o = p ? (hi ? p.r[i] >> 8 : p.r[i] & 255) : v; return `<td class="v${o !== v ? ' chg' : ''}">${hex(v, 2)}</td>`; };
      const gen = [['AX', 0], ['BX', 3], ['CX', 1], ['DX', 2]], idx = [['SI', 6], ['DI', 7], ['BP', 5], ['SP', 4]];
      let h = '<table class="rt"><thead><tr><th></th><th>H</th><th>L</th><th class="gap"></th><th></th><th></th></tr></thead><tbody>';
      for (let k = 0; k < 4; k++) {
        const [n, i] = gen[k], [n2, i2] = idx[k];
        h += `<tr><th>${n}</th>${byte(i, 1)}${byte(i, 0)}<td class="gap"></td><th>${n2}</th><td class="v w${ch16(i2) ? ' chg' : ''}">${hex(m.r[i2])}</td></tr>`;
      }
      h += '</tbody></table><table class="rt seg"><tbody><tr>';
      [['CS', 1], ['DS', 3], ['SS', 2], ['ES', 0]].forEach(([n, i]) => { h += `<th>${n}</th><td class="v w${chS(i) ? ' chg' : ''}">${hex(m.s[i])}</td>`; });
      return h + '</tr></tbody></table>';
    }
    memHTML() {
      const m = this.m, [seg, off] = this.watch, base = off & 0xFFF0;
      let h = '<table class="mt"><tbody>';
      for (let r = 0; r < 4; r++) {
        const o = (base + r * 16) & 0xFFFF;
        h += `<tr><th>${hex(seg)}:${hex(o)}</th>`;
        let asc = '';
        for (let i = 0; i < 16; i++) {
          const p = m.phys(seg, o + i), v = m.mem[p];
          const cls = m.touched.has(p) ? ' hot' : v !== this.mem0[p] ? ' chg' : '';
          h += `<td class="v${cls}${i === 8 ? ' mid' : ''}" title="${hex(seg)}:${hex((o + i) & 0xFFFF)} → física ${hex(p, 5)}h">${hex(v, 2)}</td>`;
          asc += chr(v) || '.';
        }
        h += `<td class="asc v">${esc(asc)}</td></tr>`;
      }
      return h + '</tbody></table>';
    }
    stackHTML() {
      const m = this.m, ss = m.get('SS'), sp = m.get('SP');
      let h = '<table class="st"><tbody>';
      for (let k = 0; k < 5; k++) {
        const o = sp + k * 2; if (o > 0xFFFF) break;
        const w = m.rw(ss, o), hot = m.touched.has(m.phys(ss, o)) || m.touched.has(m.phys(ss, o + 1));
        h += `<tr${k === 0 ? ' class="top"' : ''}><th>${hex(ss)}:${hex(o)}</th><td class="v${hot ? ' hot' : ''}">${hex(w)}</td><td class="muted">${k === 0 ? '← SP' : ''}</td></tr>`;
      }
      return h + '</tbody></table>';
    }
    explain() {
      const m = this.m, p = this.prev, ins = this.lastIns;
      if (!ins || !p) {
        if (m.state === 'input') return '⌨ Escribe una tecla abajo (o en el cuadro de teclado) para continuar.';
        return m.steps ? '' : 'Pulsa <b>Paso ▶</b> para ejecutar la instrucción amarilla. Antes de hacerlo, intenta predecir qué registro va a cambiar.';
      }
      const op = ins.op;
      let what = DESC[op] || JDESC[op] || '';
      if (op === 'INT') {
        const n = ins.ops[0].v & 255, ah = p.r[0] >> 8;
        what = n === 0x21 ? `DOS, función AH = ${hex(ah, 2)}h: ${I21[ah] || 'otra función'}` : n === 0x10 ? `BIOS de video, AH = ${hex(ah, 2)}h: ${I10[ah] || 'otra función'}` : 'interrupción';
      }
      const ch = [];
      A.R16.forEach((n, i) => { if (p.r[i] !== m.r[i]) ch.push(`<b>${n}</b>: ${hex(p.r[i])}h → <b>${hex(m.r[i])}h</b>` + (i < 4 ? ` <span class="muted">(${n[0]}H = ${hex(m.r[i] >> 8, 2)}h, ${n[0]}L = ${hex(m.r[i] & 255, 2)}h)</span>` : '')); });
      A.SR.forEach((n, i) => { if (p.s[i] !== m.s[i]) ch.push(`<b>${n}</b>: ${hex(p.s[i])}h → <b>${hex(m.s[i])}h</b>`); });
      const fl = FLAGS.filter(f => p.f[f] !== m.f[f]).map(f => `${f} ${p.f[f] ? 1 : 0}→${m.f[f] ? 1 : 0}`);
      if (fl.length) ch.push('Banderas: ' + fl.join(', '));
      if (m.touched.size) {
        const ps = [...m.touched].sort((a, b) => a - b), w = m.wFirst;
        ch.push(`Memoria: ${w ? `${hex(w[0])}:${hex(w[1])} (física ${hex(ps[0], 5)}h)` : hex(ps[0], 5) + 'h'} ← ${ps.map(x => hex(m.mem[x], 2) + 'h').join(' ')}` + (ps.length === 2 ? ' <span class="muted">(little endian: primero el byte bajo)</span>' : ''));
      }
      if (op === 'LOOP' || /^J/.test(op)) {
        const taken = m.ip !== p.ip + 1;
        ch.push(taken ? `➜ <b>Saltó</b> a <code>${esc(ins.ops[0].name)}</code> (línea ${m.p.code[m.ip] ? m.p.code[m.ip].ln : '—'})` : '➜ <b>No saltó</b>: la condición no se cumplió, sigue con la siguiente línea');
      }
      if (this.outDelta) ch.push(`Pantalla: «<code>${esc(this.outDelta.replace(/\n/g, '↵'))}</code>»`);
      if (!ch.length) ch.push('No cambió ningún registro visible.');
      return `<div><code class="ins">${hlAsm(ins.text)}</code> — ${what}</div><ul class="v" title="En modo ocultar: toca para ver qué cambió">${ch.map(x => `<li>${x}</li>`).join('')}</ul>`;
    }
  }
  function tabIndent(ta, ind) {
    let escaped = false;
    ta.addEventListener('keydown', e => {
      if (e.key === 'Escape') { escaped = true; return; }
      if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey && !escaped) {
        e.preventDefault();
        ta.setRangeText(ind, ta.selectionStart, ta.selectionEnd, 'end');
        ta.dispatchEvent(new Event('input'));
      }
      escaped = false;
    });
  }

  // Demos del simulador escritos en la página: <div data-emu="idDelScript" data-regs="AX=3000,…">
  $$('[data-emu]').forEach(el => {
    const s = document.getElementById(el.dataset.emu);
    if (!s) return;
    const mem = {};
    if (el.dataset.mem) el.dataset.mem.split(';').forEach(part => { const [addr, bytes] = part.split('='); const [sg, of] = parseAddr(addr, [0, 0]); bytes.split(/[\s,]+/).filter(Boolean).forEach((b, i) => { mem[((sg << 4) + of + i) & 0xFFFFF] = parseInt(b, 16); }); });
    new Emu(el, { code: s.textContent.replace(/^\n/, ''), regs: parseRegs(el.dataset.regs), mem, snippet: !/org|\.model/i.test(s.textContent), input: (el.dataset.input || '').replace(/\\r/g, '\r'), watch: el.dataset.watch, screen: el.dataset.screen === '1' });
  });

  /* ---------- Simulador libre ---------- */
  const sandbox = $('#sandbox');
  if (sandbox) {
    const ex = D.BANCO.find(e => e.id === 'e20');
    const examples = [
      { nombre: 'Hoja de Actividades · Parte 2 (en un .COM)', code: $('#src-actividades') ? $('#src-actividades').textContent.replace(/^\n/, '') : '', input: '' },
      { nombre: 'Examen: clasificador de caracteres', code: A.fill(ex.plantilla, ex.bloques.map(b => b.sol)), input: 'Hola123456789' },
      ...D.BANCO.filter(e => ['e03', 'e08', 'e09', 'e14', 'e16', 'e19', 'e21'].includes(e.id)).map(e => ({ nombre: `Ej. ${e.id.slice(1)} · ${e.titulo}`, code: A.fill(e.plantilla, e.bloques.map(b => b.sol)), input: e.pruebas[0].in })),
      { nombre: 'En blanco (org 100h)', code: 'org 100h\n\n.DATA\nmsj db 13,10,\'Hola$\'\n\n.CODE\nlea dx, msj\nmov ah, 09h\nint 21h\n\nmov ah, 4ch\nint 21h\nret', input: '' }
    ];
    new Emu(sandbox, { editable: true, examples, screen: true });
  }

  /* ---------- Conversor (el cuadro de la hoja de actividades) ---------- */
  const conv = $('#convApp');
  if (conv) {
    const inp = $('#convIn'), bits = $('#convBits'), out = $('#convOut');
    const leer = s => {
      s = s.trim(); if (!s) return null;
      if (/^'.'$|^".?"$/.test(s)) return s.charCodeAt(1);
      if (s.length === 1 && !/\d/.test(s)) return s.charCodeAt(0);
      const t = s.replace(/−/g, '-').toUpperCase();
      if (/^-\d+$/.test(t)) return parseInt(t, 10);
      return A.num(t);
    };
    const fila = (v, b, tit) => `<tr><th>${tit}</th><td class="mono">${hex(v, b / 4)}</td><td class="mono">${fmtVal(v, 's', b)}</td><td class="mono">${v}</td><td class="mono">${esc(chr(v) || '—')}</td><td class="mono">${v.toString(8)}</td><td class="mono">${bin(v, b)}</td></tr>`;
    const calc = () => {
      const b = +bits.value, mask = b === 8 ? 255 : 65535;
      let v = leer(inp.value);
      if (v == null || isNaN(v)) { out.innerHTML = '<p class="errmsg">Escribe un número: 26h, 38, 100110b, 46o, -38 o un carácter como \'A\'.</p>'; return; }
      if (v > mask || v < -(mask + 1) / 2) { out.innerHTML = `<p class="errmsg">${inp.value} no cabe en ${b} bits (máximo ${hex(mask, b / 4)}h = ${mask}).</p>`; return; }
      v &= mask;
      const n = (-v) & mask, inv = (~v) & mask, sb = b === 8 ? 0x80 : 0x8000;
      const digs = hex(v, b / 4).split('');
      let h = `<div class="tbl-wrap"><table class="conv-t"><thead><tr><th></th><th>Hexadecimal</th><th>Decimal con signo</th><th>Decimal sin signo</th><th>Carácter ASCII</th><th>Octal</th><th>Binario</th></tr></thead><tbody>`;
      h += fila(v, b, 'El valor') + fila(n, b, 'Después de NEG') + '</tbody></table></div>';
      h += '<ol class="steps small">';
      h += `<li><b>Hex → decimal sin signo</b>${digs.map((d, i) => `${d}×16<sup>${digs.length - 1 - i}</sup>`).join(' + ')} = ${digs.map((d, i) => parseInt(d, 16) * 16 ** (digs.length - 1 - i)).join(' + ')} = <b>${v}</b></li>`;
      h += `<li><b>Hex → binario</b> (cada dígito hex son 4 bits): ${digs.map(d => `${d} = ${parseInt(d, 16).toString(2).padStart(4, '0')}`).join(' · ')} → <b>${bin(v, b)}</b></li>`;
      const b3 = v.toString(2).padStart(Math.ceil(b / 3) * 3, '0').match(/.{3}/g);
      h += `<li><b>Binario → octal</b> (grupos de 3 desde la derecha): ${b3.join(' ')} → <b>${v.toString(8)}</b></li>`;
      h += `<li><b>¿Con signo?</b> El bit más alto (${v & sb ? '1' : '0'}) ${v & sb ? `es 1 → negativo: ${v} − ${mask + 1} = <b>${signed(v, b)}</b>` : `es 0 → positivo: igual que sin signo, <b>${v}</b>`}.</li>`;
      h += `<li><b>ASCII</b>: ${v < 32 ? 'menor que 20h → carácter de control (no se ve)' : v < 127 ? `${hex(v, 2)}h es «${esc(chr(v))}»` : v < 256 ? `mayor que 7Fh → fuera del ASCII estándar; en la pantalla del EMU8086 (tabla 437) se ve «${esc(chr(v))}»` : 'solo aplica a un byte'}.</li>`;
      h += `<li><b>NEG</b> (complemento a 2): invertir ${bin(v, b)} → ${bin(inv, b)} y sumar 1 → <b>${bin(n, b)}</b> = ${hex(n, b / 4)}h. ${v === 0 ? 'NEG de 0 da 0 y deja CF = 0.' : `CF = 1 (siempre que el valor no sea 0) y SF = ${n & sb ? 1 : 0}.`}</li>`;
      out.innerHTML = h + '</ol>';
    };
    inp.addEventListener('input', calc); bits.addEventListener('change', calc);
    calc();
  }

  /* ---------- Direccionamiento (tabla del profe + calculadora) ---------- */
  const MODOS = ['Registro', 'Inmediato', 'Directo', 'Indirecto por registro', 'Base más índice', 'Relativo a registro', 'Base relativa más índice', 'Índice escalado', 'Código'];
  const REG16 = { AX: 'AX', EAX: 'AX', RAX: 'AX', BX: 'BX', EBX: 'BX', RBX: 'BX', CX: 'CX', ECX: 'CX', RCX: 'CX', DX: 'DX', EDX: 'DX', RDX: 'DX', SI: 'SI', ESI: 'SI', RSI: 'SI', DI: 'DI', EDI: 'DI', RDI: 'DI', BP: 'BP', EBP: 'BP', RBP: 'BP', SP: 'SP', ESP: 'SP', R8: 'R8', R8D: 'R8', R8W: 'R8' };
  function dirCalc(ins, st) {
    ins = ins.trim();
    if (/CS\s*:\s*IP|siguiente instrucci/i.test(ins)) {
      const ea = st.IP, ph = (st.CS * 16 + ea);
      return { modo: 'Código', seg: 'CS', segv: st.CS, why: 'El procesador busca la siguiente instrucción en CS:IP (en x64, RIP).', terms: [['IP', ea]], ea, ph };
    }
    const m = ins.match(/^\s*([A-Za-z]+)\s+(.+)$/);
    if (!m) throw new Error('Escribe una instrucción como MOV AX, [BX+SI]');
    const ops = []; let d = 0, cur = '';
    for (const c of m[2]) { if (c === '[') d++; if (c === ']') d--; if (c === ',' && !d) { ops.push(cur.trim()); cur = ''; } else cur += c; }
    ops.push(cur.trim());
    const memOp = ops.find(o => /\[|ARRAY/i.test(o));
    if (!memOp) {
      const src = ops[1] || '';
      const inm = A.num(src.toUpperCase()) != null || /^'.'$/.test(src);
      return { modo: inm ? 'Inmediato' : 'Registro', nomem: true, why: inm ? `El dato ${src} viene dentro de la instrucción: no se lee memoria.` : `Los dos operandos son registros (${ops.join(' ← ')}): no se lee memoria.` };
    }
    let t = memOp.toUpperCase().replace(/\b(BYTE|WORD|DWORD)\s+PTR\b/g, '').trim(), seg = null;
    let mm = t.match(/^(CS|DS|ES|SS)\s*:\s*/); if (mm) { seg = mm[1]; t = t.slice(mm[0].length); }
    mm = t.match(/\[\s*(CS|DS|ES|SS)\s*:/); if (mm) { seg = mm[1]; t = t.replace(/(CS|DS|ES|SS)\s*:/, ''); }
    t = t.replace(/\[/g, '+').replace(/\]/g, '').replace(/^\+/, '');
    const terms = [], toks = t.match(/[+-]?[^+-]+/g) || [];
    let regs = 0, scaled = false, disp = false, bp = false;
    toks.forEach(raw => {
      let s = raw.trim(), sign = 1;
      if (s[0] === '+') s = s.slice(1).trim(); else if (s[0] === '-') { sign = -1; s = s.slice(1).trim(); }
      const sc = s.match(/^(\d+)\s*[*×]\s*([A-Z0-9]+)$|^([A-Z0-9]+)\s*[*×]\s*(\d+)$/);
      if (sc) {
        const k = +(sc[1] || sc[4]), r = sc[2] || sc[3], v = st[REG16[r]]; if (v == null) throw new Error(`No conozco el registro ${r}`);
        scaled = true; regs++; terms.push([`${k} × ${r}`, k * v, `${k} × ${hex(v)}h`]); return;
      }
      if (REG16[s]) { const v = st[REG16[s]]; regs++; if (REG16[s] === 'BP') bp = true; terms.push([s, sign * v]); return; }
      if (s === 'ARRAY') { disp = true; terms.push(['ARRAY', sign * st.ARRAY]); return; }
      const n = A.num(s); if (n == null) throw new Error(`No entiendo “${s}”`);
      disp = true; terms.push([sign < 0 ? '−' + s : s, sign * n]);
    });
    const modo = scaled ? 'Índice escalado' : !regs ? 'Directo' : regs === 1 && !disp ? 'Indirecto por registro' : regs === 2 && !disp ? 'Base más índice' : regs === 1 ? 'Relativo a registro' : 'Base relativa más índice';
    const segN = seg || (bp ? 'SS' : 'DS');
    const why = seg ? `El prefijo ${seg}: obliga a usar ${seg}.` : bp ? 'La dirección usa BP → por defecto se usa SS (la pila).' : 'BX, SI, DI o un desplazamiento directo → por defecto se usa DS.';
    const ea = terms.reduce((a, x) => a + x[1], 0) & (scaled ? 0xFFFFFFFF : 0xFFFF);
    return { modo, seg: segN, segv: st[segN], why, terms, ea, ph: st[segN] * 16 + ea };
  }
  function dirHTML(r) {
    if (r.nomem) return `<p><span class="badge ofi">${r.modo}</span> ${r.why}</p>`;
    const w = 5, line = (v, lab, op = '+') => `<tr><td class="op">${op}</td><td class="mono">${hex(v, w)}</td><td class="muted">${lab}</td></tr>`;
    let h = `<p><span class="badge ofi">${r.modo}</span> Segmento: <b>${r.seg} = ${hex(r.segv)}h</b>. ${r.why}</p>`;
    const termTxt = t => t[2] ? `${t[0]} (${t[2]})` : A.num(t[0].replace('−', '').toUpperCase()) != null ? `${t[0].startsWith('−') ? '−' : ''}${hex(Math.abs(t[1]) & 0xFFFF)}h` : `${t[0]} (${hex(Math.abs(t[1]) & 0xFFFF)}h)`;
    h += `<p class="small">Desplazamiento (dirección efectiva) = ${r.terms.map(termTxt).join(' + ').replace(/\+ −/g, '− ')} = <b>${hex(r.ea)}h</b></p>`;
    h += '<table class="suma"><tbody>' + line(r.segv * 16, `${r.seg} × 10h (se le agrega un 0)`, '') + r.terms.map(t => line(Math.abs(t[1]), t[0], t[1] < 0 ? '−' : '+')).join('') + `<tr class="tot"><td class="op">=</td><td class="mono">${hex(r.ph, w)}</td><td><b>dirección física</b></td></tr></tbody></table>`;
    return h;
  }
  const dirApp = $('#dirApp');
  if (dirApp) {
    const base = Object.assign({}, D.TABLA_PROFE);
    $('#dirTabla').innerHTML = tablaProfe(base, { edit: true, left: ['RAX', 'RBX', 'RCX', 'RDX', 'RSI', 'RDI', 'R8', 'RIP'] });
    const state = () => {
      const st = { AX: 0, BX: 0, CX: 0, DX: 0, SI: 0, DI: 0, BP: 0, SP: 0, R8: 0, IP: 0, CS: 0, SS: 0, ES: 0, DS: 0 };
      $$('#dirTabla .profe-in').forEach(i => { const k = R64[i.dataset.reg] || i.dataset.reg; const v = parseInt(i.value, 16); st[k] = isNaN(v) ? 0 : v & 0xFFFF; });
      st.ARRAY = A.num(($('#dirArr').value || '0').toUpperCase().replace(/^(?=[A-F])/, '0')) || 0;
      st.BP = parseInt($('#dirBp').value, 16) || 0;
      return st;
    };
    const go = () => { try { $('#dirOut').innerHTML = dirHTML(dirCalc($('#dirIn').value, state())); } catch (e) { $('#dirOut').innerHTML = `<p class="errmsg">${esc(e.message)}</p>`; } };
    $('#dirGo').addEventListener('click', go);
    ['#dirIn', '#dirArr', '#dirBp'].forEach(s => $(s).addEventListener('keydown', e => { if (e.key === 'Enter') go(); }));
    dirApp.addEventListener('input', e => { if (e.target.matches('.profe-in')) go(); });
    $$('[data-dir]').forEach(b => b.addEventListener('click', () => { $('#dirIn').value = b.dataset.dir; go(); }));
    go();

    // Ejercicios con la tabla fija del profe
    const ej = $('#dirEj');
    if (ej) {
      const fijo = Object.assign({ AX: 0x1000, BX: 0x20, CX: 4, DX: 2, SI: 0x100, DI: 0x200, BP: 0, SP: 0, R8: 0x50, IP: 0x4000, CS: 0x700, SS: 0x3000, ES: 0x5000, DS: 0x8000, ARRAY: 0 });
      const resp = D.DIRS.map(x => {
        const st = Object.assign({}, fijo);
        const a = (x.nota || '').match(/ARRAY\s*=\s*([0-9A-F]+)H/i); if (a) st.ARRAY = parseInt(a[1], 16);
        const b = (x.nota || '').match(/BP\s*=\s*([0-9A-F]+)H/i); if (b) st.BP = parseInt(b[1], 16);
        return dirCalc(x.cs ? 'CS:IP' : x.ins, st);
      });
      ej.innerHTML = `<div class="tbl-wrap"><table class="dir-ej"><thead><tr><th>#</th><th>Instrucción</th><th>Modo de direccionamiento</th><th>Dirección física</th><th></th></tr></thead><tbody>${D.DIRS.map((x, i) => `<tr data-i="${i}"><td class="mono">${i + 1}</td><td><code>${esc(x.ins)}</code>${x.nota ? `<div class="small muted">${esc(x.nota)}</div>` : ''}</td><td><select aria-label="Modo"><option value="">— elige —</option>${MODOS.map(mo => `<option>${mo}</option>`).join('')}</select></td><td><input class="ans mono" placeholder="${resp[i].nomem ? 'no aplica (—)' : 'ej. 80120h'}" spellcheck="false" autocomplete="off" aria-label="Dirección física"></td><td class="mk"></td></tr><tr class="calc" hidden><td></td><td colspan="4"></td></tr>`).join('')}</tbody></table></div>
        <div class="reto-ctrl"><button type="button" class="btn" id="dirRev">Revisar</button><button type="button" class="btn sec" id="dirSol">👀 Mostrar cálculos</button><button type="button" class="btn sec" id="dirReset">Borrar</button><span class="dir-score small"></span></div>`;
      const rows = $$('tr[data-i]', ej);
      const revisar = () => {
        let ok = 0;
        rows.forEach(tr => {
          const i = +tr.dataset.i, r = resp[i], sel = $('select', tr).value, inp = $('input', tr).value.trim();
          const mOk = sel === r.modo;
          const aOk = r.nomem ? (!inp || /^[—-]+$|^no/i.test(inp)) : parseAns(inp, 'h') === r.ph;
          const good = mOk && aOk; if (good) ok++;
          $('.mk', tr).innerHTML = good ? '<span class="ok">✓</span>' : `<span class="no">✗</span><span class="small muted">${!mOk ? 'modo' : ''}${!mOk && !aOk ? ' y ' : ''}${!aOk ? 'dirección' : ''}</span>`;
        });
        $('.dir-score', ej).textContent = `${ok} de ${rows.length} correctas`;
      };
      $('#dirRev').addEventListener('click', revisar);
      $('#dirSol').addEventListener('click', () => rows.forEach(tr => { const c = tr.nextElementSibling; c.hidden = !c.hidden; if (!c.hidden) $('td:last-child', c).innerHTML = dirHTML(resp[+tr.dataset.i]); }));
      $('#dirReset').addEventListener('click', () => { rows.forEach(tr => { $('select', tr).value = ''; $('input', tr).value = ''; $('.mk', tr).innerHTML = ''; tr.nextElementSibling.hidden = true; }); $('.dir-score', ej).textContent = ''; });
    }
  }

  /* ---------- Trazas en papel ---------- */
  function trazaRun(t) {
    const prog = A.assemble(t.code, { snippet: true });
    const mem = {};
    for (const k in t.mem || {}) { const [s, o] = parseAddr(k, [0, 0]); t.mem[k].forEach((b, i) => { mem[((s << 4) + o + i) & 0xFFFFF] = b; }); }
    const m = new A.Machine(prog, { regs: t.ini, mem });
    const snaps = [];
    while (m.state === 'run') { m.step(); snaps.push({ r: Array.from(m.r), s: Array.from(m.s), f: Object.assign({}, m.f), mem: m.mem.slice() }); }
    return { snaps, mem };
  }
  function trazaVal(sn, que) {
    if (que.startsWith('m:')) { const [, s, o] = que.split(':'); return { v: sn.mem[(parseInt(s, 16) << 4) + parseInt(o, 16)], bits: 8 }; }
    if (que.startsWith('f:')) return { v: sn.f[que.slice(2)] ? 1 : 0, bits: 1 };
    const i16 = A.R16.indexOf(que), i8 = A.R8.indexOf(que);
    if (i16 >= 0) return { v: sn.r[i16], bits: 16 };
    if (i8 >= 0) return { v: i8 < 4 ? sn.r[i8] & 255 : sn.r[i8 - 4] >> 8, bits: 8 };
    return { v: sn.s[A.SR.indexOf(que)], bits: 16 };
  }
  const trazasEl = $('#trazasApp');
  if (trazasEl) {
    trazasEl.innerHTML = D.TRAZAS.map((t, ti) => {
      const lines = t.code.split('\n');
      return `<article class="traza" id="traza-${t.id}">
        <h3><span class="qn">${t.id.toUpperCase()}</span>${esc(t.titulo)} <span class="lvl l${t.nivel}">Nivel ${t.nivel}</span></h3>
        <p class="small"><span class="badge">${esc(t.fuente)}</span> ${t.enun}</p>
        <div class="traza-grid">
          <div><div class="emu-h">Estado inicial</div>${tablaProfe(t.ini)}${t.mem ? `<p class="small">Memoria: ${Object.keys(t.mem).map(k => `${k} = ${t.mem[k].map(b => hex(b, 2)).join(' ')}`).join('; ')}</p>` : ''}</div>
          <div><div class="emu-h">Instrucciones</div><ol class="traza-code">${lines.map(l => `<li><code>${hlAsm(l)}</code></li>`).join('')}</ol></div>
        </div>
        <div class="tbl-wrap"><table class="traza-ask"><thead><tr><th>Después de</th><th>¿Qué?</th><th>Formato</th><th>Tu respuesta</th><th></th></tr></thead><tbody>
          ${t.ask.map(([paso, que, fmt, lab], i) => `<tr data-i="${i}"><td class="mono">instr. ${paso}</td><td>${esc(lab)}</td><td class="small muted">${FMT_NOMBRE[fmt]}</td><td><input class="ans mono" spellcheck="false" autocomplete="off" aria-label="${esc(lab)}"></td><td class="mk"></td></tr>`).join('')}
        </tbody></table></div>
        <div class="reto-ctrl">
          <button type="button" class="btn" data-t="rev">Revisar</button>
          <button type="button" class="btn sec" data-t="pista">💡 Pista <span class="pc">0/${t.pistas.length}</span></button>
          <button type="button" class="btn sec" data-t="sol">👀 Mostrar solución</button>
          <button type="button" class="btn sec" data-t="emu">▶ Ver paso a paso</button>
          <button type="button" class="btn sec" data-t="clr">Borrar</button>
          <span class="small score"></span>
        </div>
        <ol class="pistas"></ol>
        <div class="traza-emu" hidden></div>
      </article>`;
    }).join('');
    D.TRAZAS.forEach(t => {
      const art = $('#traza-' + t.id), res = trazaRun(t);
      let np = 0, emu = null;
      const exp = t.ask.map(([paso, que, fmt]) => { const { v, bits } = trazaVal(res.snaps[paso - 1], que); return { v, bits, fmt }; });
      art.addEventListener('click', e => {
        const b = e.target.closest('[data-t]'); if (!b) return;
        const k = b.dataset.t, rows = $$('tr[data-i]', art);
        if (k === 'rev') {
          let ok = 0;
          rows.forEach(tr => {
            const x = exp[+tr.dataset.i], a = parseAns($('input', tr).value, x.fmt);
            const good = x.fmt === 'c' ? a === chr(x.v) : x.fmt === 's' ? a === signed(x.v, x.bits) : a === x.v;
            if (good) ok++;
            $('.mk', tr).innerHTML = a == null ? '<span class="muted">—</span>' : good ? '<span class="ok">✓</span>' : '<span class="no">✗</span>';
          });
          $('.score', art).textContent = `${ok} de ${rows.length}`;
          const best = store.get('arqui2-trazas') || {}; best[t.id] = Math.max(best[t.id] || 0, ok / rows.length); store.set('arqui2-trazas', best);
        } else if (k === 'pista') {
          if (np < t.pistas.length) { $('.pistas', art).insertAdjacentHTML('beforeend', `<li>${t.pistas[np]}</li>`); np++; $('.pc', b).textContent = `${np}/${t.pistas.length}`; }
        } else if (k === 'sol') {
          rows.forEach(tr => { const x = exp[+tr.dataset.i]; $('.mk', tr).innerHTML = `<span class="solv mono">${esc(fmtVal(x.v, x.fmt, x.bits))}</span>`; });
        } else if (k === 'clr') {
          rows.forEach(tr => { $('input', tr).value = ''; $('.mk', tr).innerHTML = ''; });
          $('.score', art).textContent = '';
        } else if (k === 'emu') {
          const box = $('.traza-emu', art); box.hidden = !box.hidden;
          if (!box.hidden && !emu) emu = new Emu(box, { code: t.code, regs: t.ini, mem: res.mem, snippet: true, watch: t.watch || (t.ask.find(a => a[1].startsWith('m:')) || [0, 'm:' + hex(t.ini.DS) + ':0000'])[1].slice(2) });
          b.textContent = box.hidden ? '▶ Ver paso a paso' : '✕ Cerrar paso a paso';
        }
      });
    });
  }

  /* ---------- Banco de ejercicios ---------- */
  const bancoEl = $('#bancoApp');
  if (bancoEl) {
    const KEY = 'arqui2-banco', best = store.get(KEY) || {};
    const NIV = ['', 'Fácil', 'Básico', 'Intermedio', 'Avanzado', 'Parcial'];
    let cur = null, filtro = 0, np = [], t0 = 0, tAcc = 0, tick = 0;
    const listEl = $('#bancoList'), panel = $('#bancoPanel');
    const estado = id => { const b = best[id]; return !b ? '' : b.ok ? 'ok' : b.logic ? 'warn' : 'bad'; };
    const bestTxt = id => { const b = best[id]; return !b ? 'Sin intentos' : `${b.ok ? '✅ Aprobado' : b.logic ? '🟡 Funciona' : '❌ Pendiente'} · ${pct(b.sim)}%${b.ayuda ? ' · con ayuda' : ''}`; };
    function renderList() {
      const tot = D.BANCO.length, ok = D.BANCO.filter(e => best[e.id] && best[e.id].ok).length;
      $('#bancoResumen').innerHTML = `<b>${ok}</b> de ${tot} aprobados <span class="bar" role="progressbar" aria-label="Ejercicios aprobados" aria-valuemin="0" aria-valuemax="${tot}" aria-valuenow="${ok}"><i style="width:${100 * ok / tot}%"></i></span>`;
      listEl.innerHTML = D.BANCO.filter(e => !filtro || e.nivel === filtro).map(e => `<button type="button" class="reto-card banco-card ${estado(e.id)}" data-id="${e.id}" aria-pressed="${cur && cur.id === e.id}">
        <span class="m"><span class="lvl l${e.nivel}">${e.id.slice(1)} · ${NIV[e.nivel]}</span><span>${e.estilo === 'lab' ? 'org 100h' : '.MODEL SMALL'}</span><span>⏱ ${e.min} min</span></span>
        <span class="t">${esc(e.titulo)}</span><span class="m">${esc(e.patron)}</span><span class="best">${bestTxt(e.id)}</span></button>`).join('');
    }
    $$('#bancoFiltro button').forEach(b => b.addEventListener('click', () => {
      filtro = +b.dataset.n; $$('#bancoFiltro button').forEach(x => x.setAttribute('aria-selected', String(x === b))); renderList();
    }));
    listEl.addEventListener('click', e => { const c = e.target.closest('.banco-card'); if (c) select(c.dataset.id, true); });

    const fmtT = ms => { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
    const elapsed = () => tAcc + (t0 ? performance.now() - t0 : 0);
    function paintClock() { const c = $('#bancoClock'); if (!c || !cur) return; const ms = elapsed(); c.textContent = `⏱ ${fmtT(ms)} / ${cur.min}:00`; c.classList.toggle('over', ms > cur.min * 60000); }
    function startClock() { if (!t0) { t0 = performance.now(); tick = setInterval(paintClock, 500); } }
    function stopClock() { if (t0) { tAcc += performance.now() - t0; t0 = 0; } clearInterval(tick); paintClock(); }

    function tplHTML(e) {
      const parts = e.plantilla.split(/\{\{B(\d+)\}\}/);
      let h = '';
      parts.forEach((p, i) => {
        if (i % 2 === 0) h += hlAsm(p.replace(/^\n/, '').replace(/\n$/, ''));
        else { const b = e.bloques[+p - 1]; h += `\n<a class="tpl-slot" href="#blq-${e.id}-${p}">✍ BLOQUE ${p}: ${esc(b.titulo)} — lo escribes tú</a>\n`; }
      });
      return h;
    }
    function select(id, scroll) {
      if (cur) saveDraft();
      cur = D.BANCO.find(x => x.id === id);
      stopClock(); tAcc = 0; t0 = 0;
      np = cur.bloques.map(() => 0);
      const draft = store.get('arqui2-draft:' + id) || [];
      const e = cur;
      panel.hidden = false;
      panel.innerHTML = `
        <div class="reto-head"><h3>${e.id.slice(1)} · ${esc(e.titulo)}</h3><button type="button" class="reto-clock banco-clock" id="bancoClock" title="Pausar / seguir el cronómetro">⏱ 00:00 / ${e.min}:00</button></div>
        <p class="small"><span class="lvl l${e.nivel}">Nivel ${e.nivel} · ${NIV[e.nivel]}</span> <span class="badge">${esc(e.patron)}</span> <span class="badge">${e.estilo === 'lab' ? 'Estilo lab · org 100h' : 'Estilo examen · .MODEL SMALL'}</span> <span class="muted">${bestTxt(e.id)}</span></p>
        <div class="key"><b>Enunciado</b><p>${e.enun}</p></div>
        <div class="grid g2">
          <div class="card tile"><span class="tag">USA EXACTAMENTE ESTOS NOMBRES</span>
            <table class="vars"><tbody>${e.vars.map(v => `<tr><td><code>${esc(v[0])}</code></td><td class="small muted">${esc(v[1])}</td><td class="small">${v[2]}</td></tr>`).join('')}</tbody></table></div>
          <div class="card tile"><span class="tag">ETIQUETAS Y REGISTROS</span>
            ${e.etiquetas.length ? `<p class="small">Etiquetas:</p><div class="chips">${e.etiquetas.map(x => `<span class="chip"><b>${esc(x)}</b></span>`).join('')}</div>` : '<p class="small">Sin etiquetas: el código va de corrido.</p>'}
            <p class="small">Registros:</p><div class="chips">${e.regs.map(x => `<span class="chip"><b>${x}</b></span>`).join('')}</div>
            <p class="small muted">El comparador ignora mayúsculas, espacios, comentarios, 09h = 9, 'A' = 41h, LEA = MOV OFFSET y el orden de instrucciones independientes.</p></div>
        </div>
        <details class="qa tpl-det" open><summary><span class="qn">PLANTILLA</span>Lo que ya viene dado (como en el examen)</summary><div class="ans"><div class="codebox"><pre class="code tpl">${tplHTML(e)}</pre></div></div></details>
        ${e.bloques.map((b, i) => `
          <section class="blq" id="blq-${e.id}-${i + 1}">
            <h4><span class="qn">BLOQUE ${i + 1}</span>${esc(b.titulo)}</h4>
            <ol class="small blq-instr">${b.instr.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
            <label class="sr-only" for="ta-${e.id}-${i}">Tu código del bloque ${i + 1}</label>
            <textarea class="reto-code blq-ta" id="ta-${e.id}-${i}" data-b="${i}" spellcheck="false" autocomplete="off" placeholder="; escribe aquí el bloque ${i + 1}…">${esc(draft[i] || '')}</textarea>
            <div class="reto-ctrl">
              <button type="button" class="btn sec" data-k="pista" data-b="${i}">💡 Pista <span class="pc">0/${b.pistas.length}</span></button>
              <button type="button" class="btn sec" data-k="sol" data-b="${i}" aria-pressed="false">👀 Solución del bloque</button>
            </div>
            <ol class="pistas" data-b="${i}"></ol>
            <div class="blq-sol" data-b="${i}" hidden>${codeBox(b.sol, `Solución · bloque ${i + 1}`)}</div>
          </section>`).join('')}
        <div class="reto-ctrl banco-main">
          <button type="button" class="btn" data-k="rev">✔ Revisar</button>
          <button type="button" class="btn sec" data-k="run">▶ Probar<span class="lg"> en el simulador</span></button>
          <button type="button" class="btn sec" data-k="allsol">👀 Solución<span class="lg"> completa</span></button>
          <button type="button" class="btn sec" data-k="clr">🧹 Borrar<span class="lg"> mis bloques</span></button>
        </div>
        <p class="reto-hint">Tab inserta 3 espacios · Esc y luego Tab para salir del cuadro. Tu código se guarda en este navegador.</p>
        <div id="bancoRes" aria-live="polite"></div>
        <h4>Preguntas del ejercicio</h4>
        ${e.preguntas.map((q, i) => `<details class="qa"><summary><span class="qn">${q.t === 'd' ? 'DIRECTA' : 'ABIERTA'}</span>${q.q}</summary><div class="ans"><p>${q.a}</p></div></details>`).join('')}`;
      $$('.blq-ta', panel).forEach(ta => { tabIndent(ta, '   '); ta.addEventListener('input', () => { startClock(); saveDraft(); }); });
      $('#bancoClock').addEventListener('click', () => { if (t0) stopClock(); else startClock(); });
      paintClock();
      renderList();
      if (scroll) panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    const userBlocks = () => $$('.blq-ta', panel).map(t => t.value);
    function saveDraft() { if (cur) store.set('arqui2-draft:' + cur.id, userBlocks()); }
    function marcarAyuda() { if (!cur) return; const b = best[cur.id] || { sim: 0, ok: false, logic: false }; if (!b.ok) { b.ayuda = true; best[cur.id] = b; store.set(KEY, best); } }

    function fillMap(tpl, blocks) {
      const parts = tpl.split(/\{\{B(\d+)\}\}/); let src = '', line = 1; const map = [];
      parts.forEach((p, i) => {
        if (i % 2 === 0) { src += p; line += (p.match(/\n/g) || []).length; }
        else { const b = +p - 1, code = blocks[b] || ''; const n = (code.match(/\n/g) || []).length; map.push({ b, start: line, end: line + n }); src += code; line += n; }
      });
      return { src, map };
    }
    const donde = (fm, ln) => { const x = fm.map.find(r => ln >= r.start && ln <= r.end); return x ? `bloque ${x.b + 1}, línea ${ln - x.start + 1}` : `línea ${ln} de la plantilla completa`; };
    function probar(e, blocks) {
      const sols = e.bloques.map(b => b.sol);
      return e.pruebas.map(p => {
        let tpl = e.plantilla; if (p.rep) tpl = tpl.split(p.rep[0]).join(p.rep[1]);
        const fm = fillMap(tpl, blocks), ru = A.runProgram(fm.src, p.in), rs = A.runProgram(A.fill(tpl, sols), p.in);
        let st = 'ok', msg = '';
        if (ru.phase === 'asm') { st = 'asm'; msg = `Error de sintaxis (${donde(fm, ru.line)}): ${ru.error}`; }
        else if (ru.state === 'error') { st = 'run'; msg = `Error al ejecutar (${donde(fm, ru.line)}): ${ru.error}`; }
        else if (ru.state === 'limit') { st = 'limit'; msg = 'Ciclo infinito: pasaron 200 000 instrucciones sin terminar.'; }
        else if (firma(ru.m) !== firma(rs.m)) { st = 'diff'; msg = 'La pantalla no queda igual que con la solución.'; }
        return { p, ru, rs, st, msg };
      });
    }
    function diffHTML(bl) {
      const rows = bl.diff;
      if (!rows.length) return '<p class="small muted">Bloque vacío.</p>';
      let h = '<div class="diff">', eqRun = [];
      const flushEq = () => {
        if (eqRun.length > 4) h += eqRun.slice(0, 2).join('') + `<div class="dl gapl">… ${eqRun.length - 4} líneas iguales …</div>` + eqRun.slice(-2).join('');
        else h += eqRun.join('');
        eqRun = [];
      };
      rows.forEach(d => {
        if (d.t === 'eq') { eqRun.push(`<div class="dl eq"><span class="dm">✓</span><code>${hlAsm(d.u.o)}</code></div>`); return; }
        flushEq();
        h += d.t === 'miss' ? `<div class="dl miss"><span class="dm">falta</span><code>${hlAsm(d.s.o)}</code></div>` : `<div class="dl extra"><span class="dm">sobra</span><code>${hlAsm(d.u.o)}</code></div>`;
      });
      flushEq();
      return h + '</div>';
    }
    function revisar() {
      const e = cur, blocks = userBlocks();
      stopClock();
      const cmp = A.compare(blocks, e.bloques.map(b => b.sol), e.plantilla);
      const tests = probar(e, blocks);
      const logic = tests.every(t => t.st === 'ok');
      const vacios = cmp.blocks.map((b, i) => b.empty ? i + 1 : 0).filter(Boolean);
      const simOk = cmp.sim >= 0.95 && !vacios.length;
      const ok = simOk && logic;
      const syn = tests.find(t => t.st === 'asm'), run = tests.find(t => t.st === 'run' || t.st === 'limit');
      let v;
      if (ok) v = `<div class="verdict ok"><b>✅ Correcto.</b> Similitud ${pct(cmp.sim)}% (mínimo 95%) y la misma salida que la solución en las ${tests.length} prueba${tests.length > 1 ? 's' : ''}.</div>`;
      else if (vacios.length) v = `<div class="verdict bad"><b>Falta escribir el bloque ${vacios.join(' y ')}.</b></div>`;
      else if (syn) v = `<div class="verdict bad"><b>❌ ${esc(syn.msg)}</b><br><span class="small">En el examen en papel no hay ensamblador que te avise: revisa nombres de variables y etiquetas, comas y corchetes.</span></div>`;
      else if (run) v = `<div class="verdict bad"><b>❌ ${esc(run.msg)}</b></div>`;
      else if (logic) v = `<div class="verdict warn"><b>🟡 La lógica funciona</b> (misma salida en todas las pruebas), pero tu código se parece <b>${pct(cmp.sim)}%</b> al del profe (mínimo 95%). Revisa las diferencias: en papel se califica contra el patrón.</div>`;
      else v = `<div class="verdict bad"><b>❌ Error lógico:</b> ${tests.filter(t => t.st === 'diff').length} de ${tests.length} prueba${tests.length > 1 ? 's dan' : ' da'} otra pantalla. Similitud ${pct(cmp.sim)}%. Mira abajo qué debió salir y qué sale con tu código.</div>`;
      const meters = cmp.blocks.map((b, i) => `<div class="meter"><span>Bloque ${i + 1}</span><span class="bar"><i class="${b.sim >= 0.95 ? 'ok' : b.sim >= 0.8 ? 'warn' : 'bad'}" style="width:${Math.max(2, b.sim * 100)}%"></i></span><b>${pct(b.sim)}%</b></div>`).join('');
      const warns = cmp.warns.length ? `<div class="key warn"><b>Fuera del temario</b><ul class="small">${cmp.warns.map(w => `<li>Bloque ${w.block + 1}, línea ${w.ln}: ${esc(w.msg)}</li>`).join('')}</ul></div>` : '';
      const diffs = cmp.blocks.map((b, i) => `<details class="qa"${b.sim < 1 ? ' open' : ''}><summary><span class="qn">DIFERENCIAS</span>Bloque ${i + 1} · ${pct(b.sim)}%</summary><div class="ans"><p class="small muted">✓ igual · <span class="miss-t">falta</span> = está en la solución y no en tu código · <span class="extra-t">sobra</span> = está en tu código y no en la solución. Las instrucciones independientes se muestran en un orden normalizado.</p>${diffHTML(b)}</div></details>`).join('');
      const pruebas = tests.map((t, i) => `<details class="qa"${t.st !== 'ok' ? ' open' : ''}><summary><span class="qn">${t.st === 'ok' ? '✓' : '✗'} PRUEBA ${i + 1}</span>Teclado: <code>${esc(JSON.stringify(t.p.in).slice(1, -1)) || '(nada)'}</code>${t.p.nota ? ` <span class="muted small">· ${esc(t.p.nota)}</span>` : ''}${t.st !== 'ok' ? ` — <span class="no">${esc(t.msg)}</span>` : ''}</summary><div class="ans">
        <div class="grid g2x"><div><div class="emu-h">Esperado (solución)</div>${scrHTML(t.rs.m)}</div><div><div class="emu-h">Tu programa</div>${t.ru.m ? scrHTML(t.ru.m) : `<p class="errmsg">${esc(t.msg)}</p>`}</div></div></div></details>`).join('');
      $('#bancoRes').innerHTML = v + `<div class="meters">${meters}<div class="meter tot"><span>Total</span><span class="bar"><i class="${cmp.sim >= 0.95 ? 'ok' : 'warn'}" style="width:${Math.max(2, cmp.sim * 100)}%"></i></span><b>${pct(cmp.sim)}%</b></div></div>` + warns + '<h4>Pruebas en el simulador</h4>' + pruebas + '<h4>Comparación con la solución</h4>' + diffs;
      const prev = best[e.id], intento = { sim: cmp.sim, ok, logic, ayuda: prev ? !!prev.ayuda : false };
      if (!prev || (ok && !prev.ok) || (!!prev.ok === ok && (logic && !prev.logic || intento.sim > prev.sim))) { best[e.id] = intento; store.set(KEY, best); }
      renderList();
      $('#bancoRes').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    function correr() {
      const e = cur, tests = probar(e, userBlocks());
      $('#bancoRes').innerHTML = '<h4>Tu programa en el simulador</h4>' + tests.map((t, i) => `<div class="card"><p class="small"><b>Prueba ${i + 1}</b> · teclado: <code>${esc(JSON.stringify(t.p.in).slice(1, -1)) || '(nada)'}</code> ${t.msg ? `<span class="no">— ${esc(t.msg)}</span>` : '<span class="ok">✓ igual a la solución</span>'}</p>${t.ru.m ? scrHTML(t.ru.m) : `<p class="errmsg">${esc(t.msg)}</p>`}</div>`).join('');
      $('#bancoRes').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    panel.addEventListener('click', ev => {
      const b = ev.target.closest('[data-k]'); if (!b || !cur) return;
      const k = b.dataset.k, i = +b.dataset.b;
      if (k === 'pista') {
        const bl = cur.bloques[i];
        if (np[i] < bl.pistas.length) { $(`.pistas[data-b="${i}"]`, panel).insertAdjacentHTML('beforeend', `<li>${esc(bl.pistas[np[i]])}</li>`); np[i]++; $('.pc', b).textContent = `${np[i]}/${bl.pistas.length}`; }
      } else if (k === 'sol') {
        const box = $(`.blq-sol[data-b="${i}"]`, panel); box.hidden = !box.hidden; b.setAttribute('aria-pressed', String(!box.hidden)); if (!box.hidden) marcarAyuda();
      } else if (k === 'allsol') {
        $$('.blq-sol', panel).forEach(x => { x.hidden = false; }); $$('[data-k="sol"]', panel).forEach(x => x.setAttribute('aria-pressed', 'true')); marcarAyuda();
      } else if (k === 'clr') {
        $$('.blq-ta', panel).forEach(t => { t.value = ''; }); saveDraft(); $('#bancoRes').innerHTML = '';
      } else if (k === 'rev') revisar();
      else if (k === 'run') correr();
    });
    renderList();
  }

  /* ---------- Preguntas directas (clic en la opción) ---------- */
  const quizEl = $('#quizApp');
  if (quizEl) {
    const cats = ['Todas', ...new Set(D.QUIZ.map(q => q[0]))];
    let cat = 'Todas', ans = {};
    quizEl.innerHTML = `<div class="assoc-bar"><span class="score" id="quizScore"></span><span class="spacer"></span><div class="assoc-tabs" role="tablist">${cats.map(c => `<button type="button" role="tab" data-c="${c}" aria-selected="${c === cat}">${c}</button>`).join('')}</div><button type="button" class="btn sec" id="quizReset">Reiniciar</button></div><ol class="assoc-list" id="quizList"></ol>`;
    const paint = () => {
      const qs = D.QUIZ.map((q, i) => [q, i]).filter(([q]) => cat === 'Todas' || q[0] === cat);
      $('#quizList').innerHTML = qs.map(([q, i]) => {
        const a = ans[i];
        return `<li class="assoc-item${a == null ? '' : a === q[3] ? ' ok' : ' bad'}" data-i="${i}"><div class="q"><span class="qn mono">Q${i + 1}</span> ${esc(q[1])}</div><div class="assoc-opts">${q[2].map((o, j) => `<button type="button" class="assoc-opt${a == null ? '' : j === q[3] ? ' right' : j === a ? ' wrong' : ''}" data-j="${j}"${a != null ? ' disabled' : ''}>${String.fromCharCode(97 + j)}) ${esc(o)}</button>`).join('')}</div>${a != null ? `<p class="assoc-exp"><b>${a === q[3] ? 'Correcto.' : 'Respuesta: ' + String.fromCharCode(97 + q[3]) + ') ' + esc(q[2][q[3]]) + '.'}</b> ${esc(q[4])}</p>` : ''}</li>`;
      }).join('');
      const tot = Object.keys(ans).length, ok = Object.keys(ans).filter(i => ans[i] === D.QUIZ[i][3]).length;
      $('#quizScore').textContent = `${ok} / ${tot} correctas · ${D.QUIZ.length} preguntas`;
    };
    quizEl.addEventListener('click', e => {
      const t = e.target.closest('[data-c]'); if (t) { cat = t.dataset.c; $$('[data-c]', quizEl).forEach(b => b.setAttribute('aria-selected', String(b === t))); paint(); return; }
      const o = e.target.closest('.assoc-opt'); if (o) { const i = +o.closest('[data-i]').dataset.i; if (ans[i] == null) { ans[i] = +o.dataset.j; paint(); } }
    });
    $('#quizReset').addEventListener('click', () => { ans = {}; paint(); });
    paint();
  }

  /* ---------- Preguntas abiertas ---------- */
  const abEl = $('#abiertasApp');
  if (abEl) {
    const K = 'arqui2-abiertas', saved = store.get(K) || {};
    abEl.innerHTML = D.ABIERTAS.map((q, i) => `<details class="qa"><summary><span class="qn">A${i + 1}</span>${esc(q.q)}</summary><div class="ans">
      <label class="small muted" for="ab-${i}">Tu respuesta (como la escribirías en el examen):</label>
      <textarea class="reto-code ab-ta" id="ab-${i}" data-i="${i}" spellcheck="true">${esc(saved[i] || '')}</textarea>
      <div class="reto-ctrl"><button type="button" class="btn sec" data-ab="${i}">👀 Ver respuesta modelo</button></div>
      <div class="ab-sol" hidden><div class="key ok"><b>Respuesta modelo</b><p>${q.a}</p></div><p class="small"><b>Tu respuesta debería mencionar:</b></p><ul class="reto-check">${q.puntos.map(p => `<li><label><input type="checkbox"><span>${esc(p)}</span></label></li>`).join('')}</ul></div>
    </div></details>`).join('');
    abEl.addEventListener('input', e => { if (e.target.matches('.ab-ta')) { saved[e.target.dataset.i] = e.target.value; store.set(K, saved); } });
    abEl.addEventListener('click', e => { const b = e.target.closest('[data-ab]'); if (b) { const s = b.closest('.ans').querySelector('.ab-sol'); s.hidden = !s.hidden; b.textContent = s.hidden ? '👀 Ver respuesta modelo' : '🙈 Ocultar respuesta'; } });
  }
})();
