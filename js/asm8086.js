/* ===== Motor 8086 de la guía de Arquitectura II (sin DOM) =====
   1) Ensamblador mínimo del subconjunto del curso: org 100h o .MODEL SMALL, DB/DW/DUP/EQU,
      etiquetas, MOV, LEA, ADD, SUB, INC, DEC, NEG, MUL, DIV, CMP, saltos, LOOP, PUSH, POP,
      SHR, INT 21h e INT 10h. Arma la memoria como EMU8086 (PSP en 0700h).
   2) Simulador paso a paso: registros, banderas, memoria, pila y pantalla de 80×25.
   3) Comparador "plano": normaliza el código (mayúsculas, números, LEA = MOV OFFSET, orden de
      instrucciones independientes, nombres de etiquetas) y mide la similitud por tokens.
   Se usa en el navegador (window.ASM) y en Node (module.exports) para las pruebas. */
(function (root) {
  'use strict';

  const R16 = ['AX', 'CX', 'DX', 'BX', 'SP', 'BP', 'SI', 'DI'];
  const R8 = ['AL', 'CL', 'DL', 'BL', 'AH', 'CH', 'DH', 'BH'];
  const SR = ['ES', 'CS', 'SS', 'DS'];
  const hex = (v, n = 4) => (v >>> 0).toString(16).toUpperCase().padStart(n, '0');

  class AsmError extends Error { constructor(msg, line) { super(msg); this.line = line; } }

  /* ---------- Léxico ---------- */
  function stripComment(s) {
    let q = null;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (q) { if (c === q) q = null; }
      else if (c === "'" || c === '"') q = c;
      else if (c === ';') return s.slice(0, i);
    }
    return s;
  }
  const TOK = /'[^']*'|"[^"]*"|[A-Za-z_@?$.][\w@?$.]*|\d\w*|[+\-*\/\[\]:(),]|\S/g;
  function tokenize(s) {
    return (s.match(TOK) || []).map(t => (t[0] === "'" || t[0] === '"') ? { s: t.slice(1, -1), q: true } : { s: t.toUpperCase() });
  }
  function splitArgs(toks) {
    const out = [[]]; let d = 0;
    for (const t of toks) {
      if (!t.q && (t.s === '[' || t.s === '(')) d++;
      if (!t.q && (t.s === ']' || t.s === ')')) d--;
      if (!t.q && t.s === ',' && d === 0) out.push([]); else out[out.length - 1].push(t);
    }
    return out.length === 1 && !out[0].length ? [] : out;
  }
  function num(s) {
    if (/^[0-9][0-9A-F]*H$/.test(s)) return parseInt(s.slice(0, -1), 16);
    if (/^0X[0-9A-F]+$/.test(s)) return parseInt(s.slice(2), 16);
    if (/^[01]+B$/.test(s)) return parseInt(s.slice(0, -1), 2);
    if (/^[0-7]+[OQ]$/.test(s)) return parseInt(s.slice(0, -1), 8);
    if (/^[0-9]+D?$/.test(s)) return parseInt(s, 10);
    return null;
  }
  const isIdent = t => !t.q && /^[A-Z_@?$.][\w@?$.]*$/.test(t.s);

  /* Expresión numérica: + - * / ( ) números 'c' constantes OFFSET @DATA $ */
  function evalExpr(toks, look, line) {
    let i = 0;
    const peek = () => toks[i], eat = () => toks[i++];
    function factor() {
      const t = eat();
      if (!t) throw new AsmError('Expresión incompleta', line);
      if (t.q) {
        if (t.s.length === 1) return t.s.charCodeAt(0) & 0xFF;
        if (t.s.length === 2) return ((t.s.charCodeAt(0) & 0xFF) << 8) | (t.s.charCodeAt(1) & 0xFF);
        throw new AsmError(`La cadena '${t.s}' no es un número`, line);
      }
      if (t.s === '-') return -factor();
      if (t.s === '+') return factor();
      if (t.s === '(') { const v = expr(); if (!peek() || eat().s !== ')') throw new AsmError('Falta ")"', line); return v; }
      const n = num(t.s);
      if (n !== null) return n;
      if (t.s === 'OFFSET') { const u = eat(); if (!u) throw new AsmError('OFFSET sin nombre', line); return look(u.s, 'offset'); }
      if (isIdent(t)) return look(t.s, 'value');
      throw new AsmError(`No entiendo "${t.s}"`, line);
    }
    function term() { let v = factor(); while (peek() && !peek().q && (peek().s === '*' || peek().s === '/')) { const o = eat().s, w = factor(); v = o === '*' ? v * w : Math.trunc(v / w); } return v; }
    function expr() { let v = term(); while (peek() && !peek().q && (peek().s === '+' || peek().s === '-')) { const o = eat().s, w = term(); v = o === '+' ? v + w : v - w; } return v; }
    const v = expr();
    if (i < toks.length) throw new AsmError(`Sobra "${toks[i].s}" en la expresión`, line);
    return v;
  }

  /* ---------- Ensamblador ---------- */
  const JCC = { JE: 'Z', JZ: 'Z', JNE: 'NZ', JNZ: 'NZ', JB: 'C', JC: 'C', JNAE: 'C', JAE: 'NC', JNB: 'NC', JNC: 'NC', JBE: 'BE', JNA: 'BE', JA: 'A', JNBE: 'A', JL: 'L', JNGE: 'L', JGE: 'GE', JNL: 'GE', JLE: 'LE', JNG: 'LE', JG: 'G', JNLE: 'G', JS: 'S', JNS: 'NS', JO: 'O', JNO: 'NO', JP: 'P', JPE: 'P', JNP: 'NP', JPO: 'NP', JCXZ: 'CXZ' };
  const OPS = new Set(['MOV', 'LEA', 'ADD', 'SUB', 'ADC', 'SBB', 'INC', 'DEC', 'NEG', 'NOT', 'MUL', 'DIV', 'IMUL', 'IDIV', 'CMP', 'AND', 'OR', 'XOR', 'TEST', 'SHR', 'SHL', 'SAL', 'SAR', 'JMP', 'LOOP', 'PUSH', 'POP', 'INT', 'RET', 'HLT', 'NOP', 'CALL', 'XCHG', 'CBW', 'CLC', 'STC', ...Object.keys(JCC)]);
  const DIRS = new Set(['DB', 'DW', 'EQU', '=', 'SEGMENT', 'ENDS', 'PROC', 'ENDP']);

  function assemble(src, opt = {}) {
    const lines = String(src).replace(/\t/g, ' ').split(/\r?\n/);
    const recs = [];
    let mode = null, stackSize = 0x100, entryName = null, sec = null;
    const consts = Object.assign({}, opt.consts || {});

    /* Pasada 1: separar etiquetas, directivas, datos e instrucciones */
    let pending = null;  // nombre de variable en una línea sola (raro)
    lines.forEach((raw, idx) => {
      const ln = idx + 1;
      let toks = tokenize(stripComment(raw).trim());
      if (!toks.length) return;
      // Etiqueta "NOMBRE:" al inicio
      if (toks.length >= 2 && isIdent(toks[0]) && !toks[1].q && toks[1].s === ':' && !SR.includes(toks[0].s)) {
        recs.push({ t: 'label', name: toks[0].s, ln, sec });
        toks = toks.slice(2);
        if (!toks.length) return;
      }
      const a = toks[0].s, b = toks[1] && !toks[1].q ? toks[1].s : '';
      if (!toks[0].q && a[0] === '.') {
        if (a === '.MODEL') { mode = 'exe'; return; }
        if (a === '.STACK') { mode = 'exe'; if (toks.length > 1) stackSize = evalExpr(toks.slice(1), n => { throw new AsmError('Tamaño de pila inválido', ln); }, ln); recs.push({ t: 'sec', name: 'STACK', ln, size: stackSize }); sec = 'STACK'; return; }
        if (a === '.DATA') { sec = 'DATA'; recs.push({ t: 'sec', name: 'DATA', ln }); return; }
        if (a === '.CODE') { sec = 'CODE'; recs.push({ t: 'sec', name: 'CODE', ln }); return; }
        if (a === '.386' || a === '.8086') return;
        throw new AsmError(`Directiva desconocida ${a}`, ln);
      }
      if (a === 'ORG') { if (!mode) mode = 'com'; recs.push({ t: 'org', v: evalExpr(toks.slice(1), n => consts[n], ln), ln }); return; }
      if (a === 'END') { if (toks[1]) entryName = toks[1].s; return; }
      if (a === 'ASSUME' || a === 'NAME' || a === 'TITLE' || a === 'INCLUDE') return;
      if (isIdent(toks[0]) && DIRS.has(b)) {
        if (b === 'EQU' || b === '=') {
          consts[a] = evalExpr(toks.slice(2), n => { if (n in consts) return consts[n]; throw new AsmError(`${n} no está definido antes de ${a}`, ln); }, ln);
          return;
        }
        if (b === 'SEGMENT') { mode = 'exe'; sec = a === 'CODE' || a === 'CSEG' ? 'CODE' : a === 'STACK' || a === 'SSEG' ? 'STACK' : a === 'DATA' || a === 'DSEG' ? 'DATA' : a; recs.push({ t: 'sec', name: sec, ln, segName: a }); return; }
        if (b === 'ENDS' || b === 'PROC' || b === 'ENDP') return;
        recs.push({ t: 'data', name: a, size: b === 'DB' ? 1 : 2, args: splitArgs(toks.slice(2)), ln, sec });
        return;
      }
      if (a === 'DB' || a === 'DW') { recs.push({ t: 'data', name: null, size: a === 'DB' ? 1 : 2, args: splitArgs(toks.slice(1)), ln, sec }); return; }
      if (a === 'ENDS') return;
      if (!OPS.has(a)) throw new AsmError(`Instrucción desconocida: ${a}`, ln);
      recs.push({ t: 'ins', op: a, args: splitArgs(toks.slice(1)), ln, sec, text: raw.trim() });
    });
    void pending;
    if (!mode) mode = opt.snippet ? 'snip' : 'com';

    /* Pasada 2: memoria. Primero los tamaños (los datos pueden usar constantes) */
    const vars = {}, labels = {}, segs = {};
    const dataBytes = (r, look) => {
      const out = [];
      const item = arg => {
        if (!arg.length) throw new AsmError('Falta un valor en ' + (r.size === 1 ? 'DB' : 'DW'), r.ln);
        const di = arg.findIndex(t => !t.q && t.s === 'DUP');
        if (di >= 0) {
          const n = evalExpr(arg.slice(0, di), look, r.ln);
          const inner = arg.slice(di + 1);
          if (!inner.length || inner[0].s !== '(' || inner[inner.length - 1].s !== ')') throw new AsmError('DUP necesita paréntesis: 20 DUP(0)', r.ln);
          const one = [];
          splitArgs(inner.slice(1, -1)).forEach(x => one.push(...itemBytes(x)));
          for (let k = 0; k < n; k++) out.push(...one);
          return;
        }
        out.push(...itemBytes(arg));
      };
      const itemBytes = arg => {
        if (arg.length === 1 && arg[0].q && r.size === 1) return Array.from(arg[0].s).map(c => c.charCodeAt(0) & 0xFF);
        if (arg.length === 1 && !arg[0].q && arg[0].s === '?') return r.size === 1 ? [0] : [0, 0];
        const v = evalExpr(arg, look, r.ln);
        if (r.size === 1) { if (v > 255 || v < -128) throw new AsmError(`El valor ${v} no cabe en un byte (DB)`, r.ln); return [v & 0xFF]; }
        return [v & 0xFF, (v >> 8) & 0xFF];
      };
      r.args.forEach(item);
      return out;
    };
    const lookNoLabels = (n, how) => {
      if (n in consts) return consts[n];
      if (how === 'offset' || n === '$') return 0;
      throw new AsmError(`${n} no está definido`, 0);
    };
    recs.forEach(r => { if (r.t === 'data') r.bytes = dataBytes(r, lookNoLabels); });

    // Secciones
    const sections = [];
    const secOf = name => { let s = sections.find(x => x.name === name); if (!s) { s = { name, lc: 0, size: 0 }; sections.push(s); } return s; };
    const code = [];
    if (mode === 'com' || mode === 'snip') {
      const s = secOf('ALL'); s.lc = mode === 'com' ? 0x100 : (opt.codeOrg || 0);
      recs.forEach(r => {
        if (r.t === 'org') s.lc = r.v;
        else if (r.t === 'label') { labels[r.name] = { sec: s, off: s.lc, idx: code.length, ln: r.ln }; }
        else if (r.t === 'data') { r.sec2 = s; r.off = s.lc; if (r.name) vars[r.name] = { sec: s, off: s.lc, size: r.size, ln: r.ln }; s.lc += r.bytes.length; }
        else if (r.t === 'ins') { r.sec2 = s; r.off = s.lc; r.idx = code.length; code.push(r); s.lc += estSize(r); }
      });
      s.size = s.lc;
    } else {
      let cur = null;
      recs.forEach(r => {
        if (r.t === 'sec') { cur = secOf(r.name); if (r.size) cur.lc += r.size; if (r.segName) cur.segName = r.segName; return; }
        if (!cur) cur = secOf('CODE');
        if (r.t === 'label') labels[r.name] = { sec: cur, off: cur.lc, idx: code.length, ln: r.ln };
        else if (r.t === 'data') { r.sec2 = cur; r.off = cur.lc; if (r.name) vars[r.name] = { sec: cur, off: cur.lc, size: r.size, ln: r.ln }; cur.lc += r.bytes.length; }
        else if (r.t === 'ins') { r.sec2 = cur; r.off = cur.lc; r.idx = code.length; code.push(r); cur.lc += estSize(r); }
      });
      sections.forEach(s => { s.size = s.lc; });
    }
    // Segmentos: COM todo en 0700h; EXE a partir de 0710h en el orden en que aparecen
    let base = 0x0710;
    sections.forEach(s => {
      if (mode === 'com') s.seg = 0x0700;
      else if (mode === 'snip') s.seg = opt.codeSeg != null ? opt.codeSeg : 0x0700;
      else { s.seg = base; base += Math.max(1, Math.ceil(s.size / 16)); }
      segs[s.name] = s.seg;
      if (s.segName) segs[s.segName] = s.seg;
    });
    const dataSeg = segs.DATA != null ? segs.DATA : (sections[0] ? sections[0].seg : 0x0700);

    // Resolución de nombres para expresiones
    const look = (n, how, ln) => {
      if (n in consts) return consts[n];
      if (n === '@DATA') return dataSeg;
      if (n === '@CODE') return segs.CODE != null ? segs.CODE : dataSeg;
      if (segs[n] != null && !vars[n] && !labels[n]) return segs[n];
      if (how === 'offset') {
        if (vars[n]) return vars[n].off;
        if (labels[n]) return labels[n].off;
        if (opt.vars && opt.vars[n]) return opt.vars[n].off;
      }
      if (vars[n] || (opt.vars && opt.vars[n])) throw new AsmError(`${n} es una variable: para su dirección usa OFFSET ${n} o LEA`, ln);
      if (labels[n]) return labels[n].off;
      throw new AsmError(`"${n}" no está definido (¿variable o constante mal escrita?)`, ln);
    };
    recs.forEach(r => { if (r.t === 'data') { r.bytes = dataBytes(r, (n, how) => look(n, how, r.ln)); } });
    const blocks = [];
    recs.forEach(r => { if (r.t === 'data' && r.bytes.length) blocks.push({ phys: ((r.sec2.seg << 4) + r.off) & 0xFFFFF, bytes: r.bytes }); });

    const varOf = n => vars[n] || (opt.vars && opt.vars[n]);
    const ctx = { consts, look, varOf, segs };
    // Operandos e instrucciones
    code.forEach(r => {
      r.ops = r.args.map(a => parseOperand(a, ctx, r.ln, r.op));
      validate(r, labels);
    });
    let entry = 0;
    if (entryName) { if (!labels[entryName]) throw new AsmError(`END ${entryName}: la etiqueta no existe`, 0); entry = labels[entryName].idx; }
    const codeSec = sections.find(s => s.name === 'CODE') || sections[0];
    const stackSec = sections.find(s => s.name === 'STACK');
    return {
      mode, code, labels, vars, consts, segs, blocks, entry, dataSeg,
      codeSeg: codeSec ? codeSec.seg : 0x0700,
      stack: stackSec ? { seg: stackSec.seg, sp: stackSec.size & 0xFFFF } : null,
      lines
    };
  }

  function estSize(r) {
    const op = r.op, a = r.args;
    if (op === 'INT') return 2;
    if (JCC[op] || op === 'LOOP') return 2;
    if (op === 'JMP' || op === 'CALL') return 3;
    if (['RET', 'HLT', 'NOP', 'CBW', 'CLC', 'STC'].includes(op)) return 1;
    const m = a.some(x => x.some(t => t.s === '[') || x.some(t => isIdent(t) && !R16.includes(t.s) && !R8.includes(t.s) && !SR.includes(t.s) && t.s !== 'OFFSET'));
    if ((op === 'PUSH' || op === 'POP' || op === 'INC' || op === 'DEC') && a[0] && a[0].length === 1 && R16.includes(a[0][0].s)) return 1;
    return m ? 4 : (a[1] && a[1].length === 1 && (R8.includes(a[1][0].s) || R16.includes(a[1][0].s)) ? 2 : 3);
  }

  function parseOperand(toks, ctx, ln, op) {
    let size = 0, seg = null, t = toks.slice();
    if (t.length >= 2 && !t[0].q && (t[0].s === 'BYTE' || t[0].s === 'WORD') && t[1].s === 'PTR') { size = t[0].s === 'BYTE' ? 1 : 2; t = t.slice(2); }
    if (t.length >= 2 && !t[0].q && SR.includes(t[0].s) && t[1].s === ':') { seg = t[0].s; t = t.slice(2); }
    if (t.length >= 3 && t[0].s === '[' && SR.includes(t[1].s) && t[2].s === ':') { seg = t[1].s; t = [t[0], ...t.slice(3)]; }
    if (!t.length) throw new AsmError('Falta un operando', ln);
    if (t.length === 1 && !t[0].q) {
      const s = t[0].s;
      if (R16.includes(s)) return { k: 'r16', r: s, size: 2 };
      if (R8.includes(s)) return { k: 'r8', r: s, size: 1 };
      if (SR.includes(s)) return { k: 'sr', r: s, size: 2 };
      if (/^E[ABCD]X$|^E[SD]I$|^E[BS]P$|^R[ABCD]X$|^R\d+[BWD]?$/.test(s)) throw new AsmError(`${s} es un registro de 32/64 bits: el 8086 solo tiene registros de 16 bits (AX, BX…)`, ln);
    }
    if ((JCC[op] || op === 'JMP' || op === 'LOOP' || op === 'CALL') && t.length === 1 && isIdent(t[0])) return { k: 'lbl', name: t[0].s };
    // ¿Memoria? Corchetes o una variable sin OFFSET delante
    let isMem = t.some(x => !x.q && x.s === '[');
    for (let i = 0; i < t.length && !isMem; i++) if (isIdent(t[i]) && ctx.varOf(t[i].s) && !(i > 0 && t[i - 1].s === 'OFFSET')) isMem = true;
    if (!isMem) {
      if (seg) throw new AsmError(`${seg}: solo va delante de una dirección de memoria`, ln);
      const v = evalExpr(t, (n, how) => ctx.look(n, how, ln), ln);
      return { k: 'imm', v, size: 0, chr: t.length === 1 && t[0].q };
    }
    const regs = []; let disp = 0, sign = 1, sym = null, expectOp = false;
    for (let i = 0; i < t.length; i++) {
      const x = t[i];
      if (!x.q && (x.s === '+' || x.s === '[')) { sign = 1; expectOp = false; continue; }
      if (!x.q && x.s === ']') { expectOp = false; continue; }
      if (!x.q && x.s === '-') { sign = -1; continue; }
      if (!x.q && x.s === '*') throw new AsmError('El escalado (2*SI) es de 32 bits: el 8086 no lo permite', ln);
      if (expectOp) throw new AsmError('Falta un + entre los términos de la dirección', ln);
      expectOp = true;
      if (!x.q && ['BX', 'BP', 'SI', 'DI'].includes(x.s)) {
        if (sign < 0) throw new AsmError('Un registro no puede restarse dentro de [ ]', ln);
        regs.push(x.s); continue;
      }
      if (!x.q && (R16.includes(x.s) || R8.includes(x.s))) throw new AsmError(`En el 8086 solo BX, BP, SI y DI van dentro de [ ] (usaste ${x.s})`, ln);
      if (!x.q && /^E[ABCD]X$|^E[SD]I$|^R\d+$/.test(x.s)) throw new AsmError(`${x.s} es de 32/64 bits: en el 8086 usa BX, BP, SI o DI`, ln);
      if (isIdent(x) && ctx.varOf(x.s)) { const v = ctx.varOf(x.s); disp += sign * v.off; if (!sym) sym = x.s; if (!size) size = v.size; continue; }
      if (!x.q && x.s === 'OFFSET') continue;
      disp += sign * evalExpr([x], (n, how) => ctx.look(n, how, ln), ln);
    }
    const nb = regs.filter(r => r === 'BX' || r === 'BP').length, ni = regs.filter(r => r === 'SI' || r === 'DI').length;
    if (nb > 1 || ni > 1) throw new AsmError(`Combinación no válida [${regs.join('+')}]: se permite una base (BX o BP) y un índice (SI o DI)`, ln);
    return { k: 'mem', seg, regs, disp: disp & 0xFFFF, size, sym };
  }

  const opName = o => o.k === 'imm' ? 'un número' : o.k === 'mem' ? 'memoria' : o.r;
  function validate(r, labels) {
    const [a, b] = r.ops, op = r.op, ln = r.ln;
    const need = n => { if (r.ops.length !== n) throw new AsmError(`${op} lleva ${n === 0 ? 'ningún operando' : n === 1 ? '1 operando' : n + ' operandos'}`, ln); };
    const sizeOf = () => {
      const s = (a.k === 'r8' || a.k === 'r16' || a.k === 'sr') ? a.size : (b && (b.k === 'r8' || b.k === 'r16' || b.k === 'sr')) ? b.size : a.size || (b && b.size) || 0;
      if ((a.k === 'r8' && b && (b.k === 'r16' || b.k === 'sr')) || ((a.k === 'r16' || a.k === 'sr') && b && b.k === 'r8')) throw new AsmError(`Tamaños distintos: ${a.r} y ${b.r} (8 y 16 bits)`, ln);
      if (a.k === 'mem' && a.size && b && (b.k === 'r8' || b.k === 'r16') && a.size !== b.size) throw new AsmError(`${a.sym || 'La variable'} es de ${a.size * 8} bits y ${b.r} de ${b.size * 8}`, ln);
      if (b && b.k === 'mem' && b.size && (a.k === 'r8' || a.k === 'r16') && a.size !== b.size) throw new AsmError(`${b.sym || 'La variable'} es de ${b.size * 8} bits y ${a.r} de ${a.size * 8}`, ln);
      return s || 1;
    };
    const immFits = (o, s) => { if (o && o.k === 'imm' && (o.v > (s === 1 ? 255 : 65535) || o.v < (s === 1 ? -128 : -32768))) throw new AsmError(`El valor ${o.v} no cabe en ${s * 8} bits`, ln); };
    if (JCC[op] || op === 'JMP' || op === 'LOOP' || op === 'CALL') {
      need(1);
      if (a.k !== 'lbl') throw new AsmError(`${op} necesita una etiqueta`, ln);
      if (!labels[a.name]) throw new AsmError(`La etiqueta ${a.name} no existe`, ln);
      a.idx = labels[a.name].idx; return;
    }
    switch (op) {
      case 'MOV': case 'ADD': case 'SUB': case 'ADC': case 'SBB': case 'CMP': case 'AND': case 'OR': case 'XOR': case 'TEST': case 'XCHG':
        need(2);
        if (a.k === 'imm') throw new AsmError(`El destino de ${op} no puede ser un número`, ln);
        if (a.k === 'mem' && b.k === 'mem') throw new AsmError(`${op} no puede ir de memoria a memoria: pásalo por un registro (ej. MOV AL, x / MOV y, AL)`, ln);
        if (a.k === 'sr' || b.k === 'sr') {
          if (op !== 'MOV') throw new AsmError(`${op} no trabaja con registros de segmento`, ln);
          if (a.k === 'sr' && b.k === 'imm') throw new AsmError(`No se puede cargar ${a.r} con un número directo: pásalo por AX (MOV AX, @DATA / MOV ${a.r}, AX)`, ln);
          if (a.k === 'sr' && a.r === 'CS') throw new AsmError('CS no se puede cambiar con MOV', ln);
          if (a.k === 'sr' && b.k === 'sr') throw new AsmError('No se puede mover de segmento a segmento: usa AX de puente', ln);
        }
        r.size = sizeOf(); immFits(b, r.size); return;
      case 'LEA':
        need(2);
        if (a.k !== 'r16') throw new AsmError('LEA carga una dirección en un registro de 16 bits (DX, SI, DI, BX…)', ln);
        if (b.k !== 'mem') throw new AsmError('LEA necesita una variable o dirección: LEA DX, MENSAJE', ln);
        r.size = 2; return;
      case 'INC': case 'DEC': case 'NEG': case 'NOT':
        need(1);
        if (a.k === 'imm' || a.k === 'sr') throw new AsmError(`${op} necesita un registro o variable (no ${opName(a)})`, ln);
        r.size = a.size || 1; return;
      case 'MUL': case 'DIV': case 'IMUL': case 'IDIV':
        need(1);
        if (a.k === 'imm') throw new AsmError(`${op} no acepta números directos: carga el valor en un registro (ej. MOV BL, 10 / ${op} BL)`, ln);
        if (a.k === 'sr') throw new AsmError(`${op} no trabaja con registros de segmento`, ln);
        r.size = a.size || 1; return;
      case 'SHR': case 'SHL': case 'SAL': case 'SAR':
        need(2);
        if (a.k === 'imm' || a.k === 'sr') throw new AsmError(`${op} necesita un registro o variable`, ln);
        if (!(b.k === 'imm' && b.v === 1) && !(b.k === 'r8' && b.r === 'CL')) throw new AsmError(`En el 8086 solo se desplaza 1 posición o CL posiciones (${op} AL, 1 o ${op} AL, CL)`, ln);
        r.size = a.size || 1; return;
      case 'PUSH': case 'POP':
        need(1);
        if (a.k === 'imm') throw new AsmError(`${op} con número directo no existe en el 8086: usa un registro`, ln);
        if (a.k === 'r8') throw new AsmError(`${op} trabaja con 16 bits: usa ${a.r[0]}X, no ${a.r}`, ln);
        if (op === 'POP' && a.k === 'sr' && a.r === 'CS') throw new AsmError('POP CS no está permitido', ln);
        r.size = 2; return;
      case 'INT':
        need(1);
        if (a.k !== 'imm') throw new AsmError('INT necesita un número (INT 21h)', ln);
        return;
      case 'RET': case 'HLT': case 'NOP': case 'CBW': case 'CLC': case 'STC':
        return;
    }
  }

  /* ---------- Simulador ---------- */
  function parity(v) { v &= 0xFF; let p = 0; while (v) { p ^= v & 1; v >>= 1; } return p ? 0 : 1; }
  const DOS_DOT = 0xFA;

  class Machine {
    constructor(prog, opt = {}) {
      this.p = prog;
      this.mem = new Uint8Array(0x100000);
      this.r = new Uint16Array(8); this.s = new Uint16Array(4);
      this.f = { CF: 0, PF: 0, AF: 0, ZF: 0, SF: 0, TF: 0, IF: 1, DF: 0, OF: 0 };
      this.scr = new Uint8Array(2000).fill(32); this.att = new Uint8Array(2000).fill(7);
      this.row = 0; this.col = 0; this.out = '';
      this.input = []; this.inPos = 0;
      this.addInput(opt.input || '');
      this.steps = 0; this.state = 'run'; this.error = null; this.errLine = 0; this.exitCode = null;
      this.changed = new Set(); this.touched = new Set(); this.callDepth = 0;
      for (const b of prog.blocks) this.mem.set(b.bytes, b.phys);
      this.mem[0x7000] = 0xCD; this.mem[0x7001] = 0x20;  // PSP: INT 20h
      if (prog.mode === 'com') {
        this.s.fill(0x0700); this.set('SP', 0xFFFE);
      } else if (prog.mode === 'exe') {
        this.set('DS', 0x0700); this.set('ES', 0x0700); this.set('CS', prog.codeSeg);
        if (prog.stack) { this.set('SS', prog.stack.seg); this.set('SP', prog.stack.sp); }
        else { this.set('SS', 0x0700); this.set('SP', 0xFFFE); }
      } else {
        this.s.fill(0x0700); this.set('SP', 0xFFFE);
      }
      if (opt.regs) for (const k in opt.regs) this.set(k, opt.regs[k]);
      if (opt.flags) Object.assign(this.f, opt.flags);
      if (opt.mem) for (const k in opt.mem) this.mem[+k & 0xFFFFF] = opt.mem[k] & 0xFF;
      this.ip = prog.entry;
      this.changed.clear();
      if (!prog.code.length) this.state = 'end';
    }
    addInput(str) { for (const ch of String(str)) this.input.push(ch === '\n' ? 13 : ch.charCodeAt(0) & 0xFF); }
    get(n) {
      let i = R16.indexOf(n); if (i >= 0) return this.r[i];
      i = R8.indexOf(n); if (i >= 0) return i < 4 ? this.r[i] & 0xFF : this.r[i - 4] >> 8;
      i = SR.indexOf(n); if (i >= 0) return this.s[i];
      throw new Error('Registro ' + n);
    }
    set(n, v) {
      let i = R16.indexOf(n);
      if (i >= 0) { this.r[i] = v; this.changed.add(n); return; }
      i = R8.indexOf(n);
      if (i >= 0) { if (i < 4) this.r[i] = (this.r[i] & 0xFF00) | (v & 0xFF); else this.r[i - 4] = (this.r[i - 4] & 0xFF) | ((v & 0xFF) << 8); this.changed.add(n); this.changed.add(R16[i % 4]); return; }
      i = SR.indexOf(n);
      if (i >= 0) { this.s[i] = v; this.changed.add(n); return; }
      throw new Error('Registro ' + n);
    }
    phys(seg, off) { return ((seg << 4) + (off & 0xFFFF)) & 0xFFFFF; }
    rb(seg, off) { return this.mem[this.phys(seg, off)]; }
    rw(seg, off) { return this.rb(seg, off) | (this.rb(seg, off + 1) << 8); }
    wb(seg, off, v) { const p = this.phys(seg, off); this.mem[p] = v & 0xFF; if (!this.touched.size) this.wFirst = [seg, off & 0xFFFF]; this.touched.add(p); }
    ww(seg, off, v) { this.wb(seg, off, v); this.wb(seg, off + 1, v >> 8); }
    ea(o) {
      let off = o.disp;
      for (const r of o.regs) off += this.get(r);
      off &= 0xFFFF;
      const seg = this.get(o.seg || (o.regs.includes('BP') ? 'SS' : 'DS'));
      return { seg, off };
    }
    rd(o, size) {
      if (o.k === 'r8' || o.k === 'r16' || o.k === 'sr') return this.get(o.r);
      if (o.k === 'imm') return o.v & (size === 1 ? 0xFF : 0xFFFF);
      const { seg, off } = this.ea(o);
      return size === 1 ? this.rb(seg, off) : this.rw(seg, off);
    }
    wr(o, size, v) {
      v &= size === 1 ? 0xFF : 0xFFFF;
      if (o.k === 'r8' || o.k === 'r16' || o.k === 'sr') return this.set(o.r, v);
      const { seg, off } = this.ea(o);
      if (size === 1) this.wb(seg, off, v); else this.ww(seg, off, v);
    }
    szf(v, size) { const m = size === 1 ? 0xFF : 0xFFFF, sb = size === 1 ? 0x80 : 0x8000; v &= m; this.f.ZF = v === 0 ? 1 : 0; this.f.SF = v & sb ? 1 : 0; this.f.PF = parity(v); }
    add(a, b, size, c = 0) {
      const m = size === 1 ? 0xFF : 0xFFFF, sb = size === 1 ? 0x80 : 0x8000, r = a + b + c;
      this.f.CF = r > m ? 1 : 0; this.f.OF = ((a ^ r) & (b ^ r) & sb) ? 1 : 0; this.f.AF = ((a ^ b ^ r) & 0x10) ? 1 : 0;
      this.szf(r, size); return r & m;
    }
    sub(a, b, size, c = 0) {
      const m = size === 1 ? 0xFF : 0xFFFF, sb = size === 1 ? 0x80 : 0x8000, r = a - b - c;
      this.f.CF = r < 0 ? 1 : 0; this.f.OF = ((a ^ b) & (a ^ r) & sb) ? 1 : 0; this.f.AF = ((a ^ b ^ r) & 0x10) ? 1 : 0;
      this.szf(r, size); return r & m;
    }
    push(v) { const sp = (this.get('SP') - 2) & 0xFFFF; this.set('SP', sp); this.ww(this.get('SS'), sp, v); }
    pop() { const sp = this.get('SP'), v = this.rw(this.get('SS'), sp); this.set('SP', (sp + 2) & 0xFFFF); return v; }
    cond(c) {
      const f = this.f;
      switch (c) {
        case 'Z': return f.ZF; case 'NZ': return !f.ZF; case 'C': return f.CF; case 'NC': return !f.CF;
        case 'BE': return f.CF || f.ZF; case 'A': return !f.CF && !f.ZF;
        case 'L': return f.SF !== f.OF; case 'GE': return f.SF === f.OF; case 'LE': return f.ZF || f.SF !== f.OF; case 'G': return !f.ZF && f.SF === f.OF;
        case 'S': return f.SF; case 'NS': return !f.SF; case 'O': return f.OF; case 'NO': return !f.OF;
        case 'P': return f.PF; case 'NP': return !f.PF; case 'CXZ': return this.get('CX') === 0;
      }
      return false;
    }
    /* Pantalla (teletipo como DOS) */
    scroll() { this.scr.copyWithin(0, 80); this.scr.fill(32, 1920); this.att.copyWithin(0, 80); this.att.fill(7, 1920); this.row = 24; }
    putc(c) {
      this.out += c === 10 ? '\n' : c === 13 ? '' : c === 8 ? '⌫' : CP437[c];
      if (c === 13) { this.col = 0; return; }
      if (c === 10) { if (++this.row > 24) this.scroll(); return; }
      if (c === 8) { if (this.col > 0) this.col--; return; }
      if (c === 7) return;
      const p = this.row * 80 + this.col;
      this.scr[p] = c; this.att[p] = 7;
      if (++this.col >= 80) { this.col = 0; if (++this.row > 24) this.scroll(); }
    }
    cls() { this.scr.fill(32); this.att.fill(7); this.row = 0; this.col = 0; this.out += '\n[pantalla limpia]\n'; }
    key() { if (this.inPos >= this.input.length) { const e = new Error('input'); e.waitInput = true; throw e; } return this.input[this.inPos++]; }
    int21() {
      const ah = this.get('AH');
      switch (ah) {
        case 0x01: { const c = this.key(); this.set('AL', c); this.putc(c); return; }
        case 0x07: case 0x08: { this.set('AL', this.key()); return; }
        case 0x02: { const c = this.get('DL'); this.putc(c); this.set('AL', c); return; }
        case 0x06: { const c = this.get('DL'); if (c !== 0xFF) { this.putc(c); this.set('AL', c); return; } if (this.inPos < this.input.length) { this.set('AL', this.key()); this.f.ZF = 0; } else { this.set('AL', 0); this.f.ZF = 1; } return; }
        case 0x09: {
          const ds = this.get('DS'); let off = this.get('DX'), n = 0;
          for (; ;) {
            const c = this.rb(ds, off);
            if (c === 0x24) break;
            this.putc(c); off = (off + 1) & 0xFFFF;
            if (++n > 4000) throw new Error(`INT 21h/09h no encontró el "$" final en ${hex(ds)}:${hex(this.get('DX'))}. ¿Falta el '$' en la cadena, o no pusiste MOV AX,@DATA / MOV DS,AX?`);
          }
          this.set('AL', 0x24); return;
        }
        case 0x0A: {
          const ds = this.get('DS'), dx = this.get('DX'), max = this.rb(ds, dx);
          let end = this.input.indexOf(13, this.inPos);
          if (end < 0) { const e = new Error('input'); e.waitInput = true; throw e; }
          const got = [];
          while (this.inPos <= end) {
            const c = this.input[this.inPos++];
            if (c === 13) break;
            if (c === 8) { if (got.length) { got.pop(); this.putc(8); this.putc(32); this.putc(8); } continue; }
            if (got.length < max - 1) { got.push(c); this.putc(c); }
          }
          if (max === 0) return;
          this.wb(ds, dx + 1, got.length);
          got.forEach((c, k) => this.wb(ds, dx + 2 + k, c));
          this.wb(ds, dx + 2 + got.length, 13);
          this.putc(13);
          return;
        }
        case 0x4C: this.exitCode = this.get('AL'); this.state = 'exit'; return;
        case 0x00: this.exitCode = 0; this.state = 'exit'; return;
        default: throw new Error(`INT 21h con AH=${hex(ah, 2)}h: función no incluida en el curso ni en este simulador`);
      }
    }
    int10() {
      const ah = this.get('AH');
      switch (ah) {
        case 0x00: this.cls(); return;
        case 0x02: this.row = Math.min(24, this.get('DH')); this.col = Math.min(79, this.get('DL')); return;
        case 0x03: this.set('DH', this.row); this.set('DL', this.col); this.set('CX', 0x0607); return;
        case 0x06: if (this.get('AL') === 0) { this.scr.fill(32); this.att.fill(this.get('BH') || 7); } return;
        case 0x09: case 0x0A: {
          const c = this.get('AL'), a = this.get('BL'); let n = this.get('CX'), p = this.row * 80 + this.col;
          this.out += CP437[c].repeat(Math.max(0, Math.min(n, 2000 - p)));
          while (n-- > 0 && p < 2000) { this.scr[p] = c; if (ah === 0x09) this.att[p] = a; p++; }
          return;
        }
        case 0x0E: this.putc(this.get('AL')); return;
        default: throw new Error(`INT 10h con AH=${hex(ah, 2)}h: función no incluida en este simulador`);
      }
    }
    exec(ins) {
      const [a, b] = ins.ops, s = ins.size || 1, op = ins.op;
      if (JCC[op]) return this.cond(JCC[op]) ? a.idx : undefined;
      switch (op) {
        case 'MOV': this.wr(a, s, this.rd(b, s)); return;
        case 'XCHG': { const x = this.rd(a, s), y = this.rd(b, s); this.wr(a, s, y); this.wr(b, s, x); return; }
        case 'LEA': this.set(a.r, this.ea(b).off); return;
        case 'ADD': this.wr(a, s, this.add(this.rd(a, s), this.rd(b, s), s)); return;
        case 'ADC': this.wr(a, s, this.add(this.rd(a, s), this.rd(b, s), s, this.f.CF)); return;
        case 'SUB': this.wr(a, s, this.sub(this.rd(a, s), this.rd(b, s), s)); return;
        case 'SBB': this.wr(a, s, this.sub(this.rd(a, s), this.rd(b, s), s, this.f.CF)); return;
        case 'CMP': this.sub(this.rd(a, s), this.rd(b, s), s); return;
        case 'AND': case 'OR': case 'XOR': case 'TEST': {
          const x = this.rd(a, s), y = this.rd(b, s), r = op === 'OR' ? x | y : op === 'XOR' ? x ^ y : x & y;
          this.f.CF = 0; this.f.OF = 0; this.szf(r, s); if (op !== 'TEST') this.wr(a, s, r); return;
        }
        case 'NOT': this.wr(a, s, ~this.rd(a, s)); return;
        case 'INC': { const cf = this.f.CF; this.wr(a, s, this.add(this.rd(a, s), 1, s)); this.f.CF = cf; return; }
        case 'DEC': { const cf = this.f.CF; this.wr(a, s, this.sub(this.rd(a, s), 1, s)); this.f.CF = cf; return; }
        case 'NEG': { const x = this.rd(a, s); this.wr(a, s, this.sub(0, x, s)); this.f.CF = x ? 1 : 0; return; }
        case 'MUL': case 'IMUL': {
          const x = this.rd(a, s);
          if (s === 1) {
            let al = this.get('AL'), r;
            if (op === 'IMUL') { const sx = x << 24 >> 24, sa = al << 24 >> 24; r = (sa * sx) & 0xFFFF; } else r = al * x;
            this.set('AX', r); this.f.CF = this.f.OF = (r >> 8) ? 1 : 0;
          } else {
            let ax = this.get('AX'), r;
            if (op === 'IMUL') { r = (ax << 16 >> 16) * (x << 16 >> 16); r = r >>> 0; } else r = ax * x;
            this.set('AX', r & 0xFFFF); this.set('DX', Math.floor(r / 65536) & 0xFFFF); this.f.CF = this.f.OF = this.get('DX') ? 1 : 0;
          }
          return;
        }
        case 'DIV': case 'IDIV': {
          const x = this.rd(a, s);
          if (x === 0) throw new Error(`División entre cero: ${op} ${ins.ops[0].r || 'operando'} con valor 0 (INT 0)`);
          if (s === 1) {
            const ax = this.get('AX'), q = Math.floor(ax / x), r = ax % x;
            if (q > 0xFF) throw new Error(`DIV desbordado: AX=${hex(ax)}h (${ax}) ÷ ${x} = ${q}, no cabe en AL. ¿Olvidaste MOV AH, 0 antes de DIV?`);
            this.set('AL', q); this.set('AH', r);
          } else {
            const dd = this.get('DX') * 65536 + this.get('AX'), q = Math.floor(dd / x), r = dd % x;
            if (q > 0xFFFF) throw new Error(`DIV desbordado: DX:AX=${dd} ÷ ${x} = ${q}, no cabe en AX. ¿Olvidaste MOV DX, 0?`);
            this.set('AX', q); this.set('DX', r);
          }
          return;
        }
        case 'SHR': case 'SHL': case 'SAL': case 'SAR': {
          let x = this.rd(a, s); const n = b.k === 'imm' ? 1 : this.get('CL') & 0x1F, sb = s === 1 ? 0x80 : 0x8000, m = s === 1 ? 0xFF : 0xFFFF;
          if (!n) return;
          const orig = x;
          for (let k = 0; k < n; k++) {
            if (op === 'SHR') { this.f.CF = x & 1; x >>= 1; }
            else if (op === 'SAR') { this.f.CF = x & 1; x = (x >> 1) | (x & sb); }
            else { this.f.CF = x & sb ? 1 : 0; x = (x << 1) & m; }
          }
          this.f.OF = op === 'SHR' ? (orig & sb ? 1 : 0) : op === 'SAR' ? 0 : ((x & sb ? 1 : 0) ^ this.f.CF);
          this.szf(x, s); this.wr(a, s, x); return;
        }
        case 'CBW': this.set('AH', this.get('AL') & 0x80 ? 0xFF : 0); return;
        case 'CLC': this.f.CF = 0; return;
        case 'STC': this.f.CF = 1; return;
        case 'JMP': return a.idx;
        case 'LOOP': { const cx = (this.get('CX') - 1) & 0xFFFF; this.set('CX', cx); return cx ? a.idx : undefined; }
        case 'CALL': this.push(this.ip + 1); this.callDepth++; return a.idx;
        case 'RET':
          if (this.callDepth > 0) { this.callDepth--; return this.pop(); }
          this.state = 'exit'; this.exitCode = 0; return;
        case 'PUSH': this.push(this.rd(a, 2)); return;
        case 'POP': this.wr(a, 2, this.pop()); return;
        case 'HLT': this.state = 'halt'; return;
        case 'NOP': return;
        case 'INT': {
          const n = a.v & 0xFF;
          if (n === 0x21) return void this.int21();
          if (n === 0x10) return void this.int10();
          if (n === 0x20) { this.state = 'exit'; this.exitCode = 0; return; }
          if (n === 0x16) { this.set('AL', this.key()); this.set('AH', 0); return; }
          throw new Error(`INT ${hex(n, 2)}h no está incluida en este simulador`);
        }
      }
      throw new Error(`${op} no está soportada por el simulador`);
    }
    step() {
      if (this.state !== 'run') return this.state;
      const ins = this.p.code[this.ip];
      if (!ins) { this.state = 'end'; return this.state; }
      this.changed.clear(); this.touched.clear(); this.wFirst = null;
      let next = this.ip + 1;
      try {
        const j = this.exec(ins);
        if (j !== undefined) next = j;
      } catch (e) {
        if (e.waitInput) { this.state = 'input'; return 'input'; }
        this.state = 'error'; this.error = e.message; this.errLine = ins.ln; return 'error';
      }
      if (this.state === 'run' || this.state === 'exit' || this.state === 'halt') this.ip = this.state === 'run' ? next : this.ip;
      this.steps++;
      if (this.state === 'run' && next >= this.p.code.length) this.state = 'end';
      return this.state;
    }
    resume() { if (this.state === 'input') this.state = 'run'; }
    run(limit = 200000) {
      while (this.state === 'run') {
        if (this.steps >= limit) { this.state = 'limit'; this.error = `Se detuvo tras ${limit} pasos: ¿ciclo infinito? (revisa que CX no empiece en 0 y que los saltos lleguen a la salida)`; break; }
        this.step();
      }
      return this.state;
    }
    line() { const i = this.p.code[this.ip]; return i ? i.ln : 0; }
    screenText() {
      const rows = [];
      for (let y = 0; y < 25; y++) {
        let s = '';
        for (let x = 0; x < 80; x++) s += CP437[this.scr[y * 80 + x]];
        rows.push(s.replace(/\s+$/, ''));
      }
      while (rows.length && !rows[rows.length - 1]) rows.pop();
      return rows.join('\n');
    }
  }

  /* Tabla CP437 (la que usa la pantalla de EMU8086) */
  const CP437 = (' ☺☻♥♦♣♠•◘○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼' +
    ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~⌂' +
    'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ').split('');
  CP437[0] = ' '; CP437[13] = ' '; CP437[10] = ' ';

  /* Ejecuta un programa completo con una entrada y devuelve la pantalla */
  function runProgram(src, input, opt = {}) {
    let prog;
    try { prog = assemble(src, opt); }
    catch (e) { return { ok: false, phase: 'asm', error: e.message, line: e.line || 0 }; }
    const m = new Machine(prog, Object.assign({}, opt, { input }));
    m.run(opt.limit || 200000);
    return { ok: m.state !== 'error' && m.state !== 'limit', phase: 'run', state: m.state, error: m.error, line: m.errLine, screen: m.screenText(), m };
  }

  /* ---------- Comparador plano ---------- */
  const ALIAS = { JZ: 'JE', JNZ: 'JNE', JC: 'JB', JNAE: 'JB', JNB: 'JAE', JNC: 'JAE', JNA: 'JBE', JNBE: 'JA', JNGE: 'JL', JNL: 'JGE', JNG: 'JLE', JNLE: 'JG', SAL: 'SHL', JPE: 'JP', JPO: 'JNP' };
  const CURSO = new Set(['MOV', 'LEA', 'ADD', 'SUB', 'INC', 'DEC', 'NEG', 'MUL', 'DIV', 'CMP', 'JMP', 'JE', 'JNE', 'JB', 'JBE', 'JA', 'JAE', 'LOOP', 'PUSH', 'POP', 'INT', 'SHR', 'HLT', 'RET']);
  const BYTEREGS = { AX: ['AL', 'AH'], BX: ['BL', 'BH'], CX: ['CL', 'CH'], DX: ['DL', 'DH'] };
  const regRes = r => BYTEREGS[r] || [r];
  const REG_ORDER = ['BX', 'BP', 'SI', 'DI'];

  function canonOp(toks, ctx) {
    let t = toks.filter(x => x.q || (x.s !== 'PTR' && x.s !== 'BYTE' && x.s !== 'WORD'));
    let seg = '';
    if (t.length >= 2 && !t[0].q && SR.includes(t[0].s) && t[1].s === ':') { seg = t[0].s + ':'; t = t.slice(2); }
    if (t.length >= 3 && t[0].s === '[' && SR.includes(t[1].s) && t[2].s === ':') { seg = t[1].s + ':'; t = [t[0], ...t.slice(3)]; }
    const raw = t.map(x => x.q ? `'${x.s}'` : x.s).join('');
    if (t.length === 1 && !t[0].q && (R16.includes(t[0].s) || R8.includes(t[0].s) || SR.includes(t[0].s))) return { s: seg + t[0].s, reg: t[0].s };
    const val = n => (n in ctx.consts) ? ctx.consts[n] : undefined;
    const evalLoose = arr => { try { return evalExpr(arr, n => { const v = val(n); if (v === undefined) throw new Error('x'); return v; }, 0); } catch (e) { return null; } };
    if (t.length && !t[0].q && t[0].s === 'OFFSET') {
      const rest = t.slice(1), ids = [], nums = [];
      let sign = 1;
      rest.forEach(x => { if (!x.q && x.s === '+') sign = 1; else if (!x.q && x.s === '-') sign = -1; else if (isIdent(x) && val(x.s) === undefined) ids.push(x.s); else nums.push({ x, sign }); });
      const n = nums.reduce((acc, o) => { const v = evalLoose([o.x]); return acc + (v == null ? 0 : o.sign * v); }, 0);
      return { s: 'OFFSET ' + ids.join('+') + (n ? (n > 0 ? '+' : '') + n : ''), imm: true };
    }
    let isMem = t.some(x => !x.q && x.s === '[') || t.some((x, i) => isIdent(x) && ctx.vars.has(x.s) && !(i > 0 && t[i - 1].s === 'OFFSET'));
    if (!isMem) {
      const v = evalLoose(t);
      if (v != null) return { s: String(v), imm: true };
      return { s: seg + raw, imm: true, lbl: t.length === 1 && isIdent(t[0]) ? t[0].s : null };
    }
    const regs = [], syms = []; let n = 0, sign = 1;
    for (const x of t) {
      if (!x.q && (x.s === '+' || x.s === '[' || x.s === ']')) { if (x.s !== ']') sign = 1; continue; }
      if (!x.q && x.s === '-') { sign = -1; continue; }
      if (!x.q && (REG_ORDER.includes(x.s) || R16.includes(x.s))) { regs.push(x.s); continue; }
      if (isIdent(x) && val(x.s) === undefined) { syms.push(x.s); continue; }
      const v = evalLoose([x]); n += v == null ? 0 : sign * v;
    }
    regs.sort((p, q) => REG_ORDER.indexOf(p) - REG_ORDER.indexOf(q));
    const parts = [...syms.sort(), ...regs];
    let s = parts.join('+');
    if (n) s += (s ? (n > 0 ? '+' : '') : '') + n;
    return { s: seg + '[' + (s || '0') + ']', mem: true, addr: regs.flatMap(regRes), seg: seg ? seg.slice(0, 2) : null };
  }

  /* Convierte un bloque de texto en líneas canónicas con dependencias */
  function parseBlock(text, ctx) {
    const out = [];
    String(text || '').replace(/\t/g, ' ').split(/\r?\n/).forEach((raw, idx) => {
      let toks = tokenize(stripComment(raw).trim());
      if (!toks.length) return;
      const orig = raw.trim();
      while (toks.length >= 2 && isIdent(toks[0]) && !toks[1].q && toks[1].s === ':' && !SR.includes(toks[0].s)) {
        out.push({ kind: 'label', name: toks[0].s, o: orig, ln: idx + 1 });
        toks = toks.slice(2);
      }
      if (!toks.length) return;
      let op = toks[0].q ? toks[0].s : toks[0].s;
      op = ALIAS[op] || op;
      if (toks[1] && !toks[1].q && ['DB', 'DW', 'EQU'].includes(toks[1].s)) {
        out.push({ kind: 'ins', op: 'DATA', ops: [], c: toks.map(x => x.q ? `'${x.s}'` : x.s).join(' '), o: orig, ln: idx + 1, barrier: true });
        return;
      }
      const args = splitArgs(toks.slice(1));
      const jump = JCC[op] || op === 'JMP' || op === 'LOOP' || op === 'CALL';
      let ops = args.map(a => jump && a.length === 1 && isIdent(a[0]) ? { s: a[0].s, lbl: a[0].s } : canonOp(a, ctx));
      if (op === 'LEA' && ops[1] && ops[1].mem && !ops[1].addr.length && !ops[1].seg) {
        const inner = ops[1].s.slice(1, -1);
        op = 'MOV'; ops = [ops[0], { s: 'OFFSET ' + inner, imm: true }];
      }
      if (op === 'MOV' && ops[0] && ops[0].reg === 'AX' && ops[1] && ops[1].imm && /^\d+$/.test(ops[1].s) && (+ops[1].s >> 8) === 0x4C) {
        ops = [{ s: 'AH', reg: 'AH' }, { s: String(0x4C), imm: true }];
      }
      out.push({ kind: 'ins', op, ops, o: orig, ln: idx + 1, jump });
    });
    return out;
  }

  function deps(l) {
    const op = l.op, [a, b] = l.ops || [];
    const res = o => !o ? [] : o.reg ? regRes(o.reg) : o.mem ? ['M'] : [];
    const adr = o => o && o.mem ? [...o.addr, ...(o.seg ? [o.seg] : [])] : [];
    const W = new Set(), R = new Set();
    const w = arr => arr.forEach(x => W.add(x)), r = arr => arr.forEach(x => R.add(x));
    const wide = o => o && ((o.reg && R16.includes(o.reg)) || false);
    switch (op) {
      case 'MOV': if (!a || !b) return null; w(res(a)); r(res(b)); r(adr(a)); r(adr(b)); break;
      case 'LEA': if (!a || !b) return null; w(res(a)); r(adr(b)); break;
      case 'ADD': case 'SUB': case 'ADC': case 'SBB': case 'AND': case 'OR': case 'XOR':
        if (!a || !b) return null; w(res(a)); W.add('F'); r(res(a)); r(res(b)); r(adr(a)); r(adr(b)); if (op === 'ADC' || op === 'SBB') R.add('F'); break;
      case 'CMP': case 'TEST': if (!a || !b) return null; W.add('F'); r(res(a)); r(res(b)); r(adr(a)); r(adr(b)); break;
      case 'INC': case 'DEC': case 'NEG': if (!a) return null; w(res(a)); W.add('F'); r(res(a)); r(adr(a)); break;
      case 'NOT': if (!a) return null; w(res(a)); r(res(a)); r(adr(a)); break;
      case 'MUL': case 'DIV': case 'IMUL': case 'IDIV': {
        if (!a) return null; r(res(a)); r(adr(a)); W.add('F');
        if (wide(a)) { w(['AL', 'AH', 'DL', 'DH']); r(['AL', 'AH']); if (op.endsWith('DIV')) r(['DL', 'DH']); }
        else { w(['AL', 'AH']); r(op.endsWith('DIV') ? ['AL', 'AH'] : ['AL']); }
        break;
      }
      case 'SHR': case 'SHL': case 'SAR': if (!a || !b) return null; w(res(a)); W.add('F'); r(res(a)); r(res(b)); r(adr(a)); break;
      default: return null;
    }
    return { W, R };
  }
  const meets = (x, y) => { for (const v of x) if (y.has(v)) return true; return false; };

  function lineStr(l, map) {
    if (l.kind === 'label') return (map[l.name] || l.name) + ':';
    if (l.op === 'DATA') return l.c;
    const ops = (l.ops || []).map(o => o.lbl && map[o.lbl] ? map[o.lbl] : o.s);
    return l.op + (ops.length ? ' ' + ops.join(',') : '');
  }

  /* Orden canónico: dentro de cada tramo sin saltos ni etiquetas, las instrucciones
     independientes se ordenan igual en los dos códigos (topológico + alfabético). */
  function canonicalize(lines, map) {
    lines.forEach(l => { l.c = lineStr(l, map); if (l.kind === 'ins' && !l.jump) l.dep = deps(l); });
    // Salida del programa: MOV AH,4Ch + INT 21h (o RET al final) = EXIT
    const out = [];
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (l.kind === 'ins' && l.op === 'INT' && l.ops[0] && l.ops[0].s === '33') {
        let j = out.length - 1, found = -1;
        while (j >= 0 && out[j].kind === 'ins' && out[j].dep) {
          if (out[j].dep.W.has('AH')) { if (out[j].c === 'MOV AH,76') found = j; break; }
          j--;
        }
        if (found >= 0) { const mv = out.splice(found, 1)[0]; out.push({ kind: 'ins', op: 'EXIT', ops: [], c: 'EXIT', o: mv.o + ' / ' + l.o, ln: l.ln }); continue; }
      }
      out.push(l);
    }
    while (out.length && out[out.length - 1].kind === 'ins' && out[out.length - 1].op === 'RET') { const r = out.pop(); out.push({ kind: 'ins', op: 'EXIT', ops: [], c: 'EXIT', o: r.o, ln: r.ln }); break; }
    for (let i = out.length - 1; i > 0; i--) if (out[i].c === 'EXIT' && out[i - 1].c === 'EXIT') out.splice(i, 1);
    // Reordenar tramos
    const res = []; let run = [];
    const flush = () => {
      if (run.length > 1) {
        const n = run.length, pred = run.map(() => new Set());
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
          const A = run[i].dep, B = run[j].dep;
          if (meets(A.W, B.R) || meets(A.W, B.W) || meets(B.W, A.R)) pred[j].add(i);
        }
        const done = new Set();
        while (done.size < n) {
          let best = -1;
          for (let i = 0; i < n; i++) if (!done.has(i) && [...pred[i]].every(p => done.has(p)) && (best < 0 || run[i].c < run[best].c)) best = i;
          done.add(best); res.push(run[best]);
        }
      } else res.push(...run);
      run = [];
    };
    out.forEach(l => { if (l.kind === 'ins' && l.dep) run.push(l); else { flush(); res.push(l); } });
    flush();
    res.forEach(l => { l.toks = l.kind === 'label' ? [l.c] : [l.op, ...((l.c.indexOf(' ') > 0) ? l.c.slice(l.c.indexOf(' ') + 1).split(',') : [])]; });
    return res;
  }

  function levenshtein(a, b) {
    const n = a.length, m = b.length;
    if (!n) return m; if (!m) return n;
    let prev = new Array(m + 1), cur = new Array(m + 1);
    for (let j = 0; j <= m; j++) prev[j] = j;
    for (let i = 1; i <= n; i++) {
      cur[0] = i;
      for (let j = 1; j <= m; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      [prev, cur] = [cur, prev];
    }
    return prev[m];
  }
  function lineDiff(u, s) {
    const n = u.length, m = s.length, L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = u[i].c === s[j].c ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    const out = []; let i = 0, j = 0;
    while (i < n && j < m) {
      if (u[i].c === s[j].c) { out.push({ t: 'eq', u: u[i], s: s[j] }); i++; j++; }
      else if (L[i + 1][j] >= L[i][j + 1]) { out.push({ t: 'extra', u: u[i] }); i++; }
      else { out.push({ t: 'miss', s: s[j] }); j++; }
    }
    while (i < n) out.push({ t: 'extra', u: u[i++] });
    while (j < m) out.push({ t: 'miss', s: s[j++] });
    return out;
  }

  /* Contexto del comparador a partir de la plantilla (variables, constantes, etiquetas) */
  function templateContext(template) {
    const vars = new Set(), consts = {}, labels = new Set();
    String(template || '').replace(/\{\{B\d+\}\}/g, '').split(/\r?\n/).forEach(raw => {
      const toks = tokenize(stripComment(raw).trim());
      if (toks.length >= 2 && isIdent(toks[0]) && !toks[1].q) {
        if (toks[1].s === 'DB' || toks[1].s === 'DW') vars.add(toks[0].s);
        else if (toks[1].s === 'EQU' || toks[1].s === '=') { try { consts[toks[0].s] = evalExpr(toks.slice(2), n => { if (n in consts) return consts[n]; throw new Error(); }, 0); } catch (e) { } }
        else if (toks[1].s === ':') labels.add(toks[0].s);
      }
    });
    return { vars, consts, labels };
  }

  function compare(userBlocks, solBlocks, template) {
    const ctx = templateContext(template);
    const U = userBlocks.map(b => parseBlock(b, ctx)), S = solBlocks.map(b => parseBlock(b, ctx));
    // Etiquetas propias: las que coinciden con la solución se quedan; las demás se emparejan en orden
    const sLab = S.flat().filter(l => l.kind === 'label').map(l => l.name);
    const uLab = U.flat().filter(l => l.kind === 'label').map(l => l.name);
    const map = {}, used = new Set(uLab.filter(n => sLab.includes(n)));
    const free = sLab.filter(n => !used.has(n));
    uLab.forEach(n => { if (!sLab.includes(n) && !ctx.labels.has(n) && free.length) map[n] = free.shift(); });
    const warns = [];
    U.forEach((blk, bi) => blk.forEach(l => {
      if (l.kind !== 'ins' || l.op === 'DATA') return;
      if (!CURSO.has(l.op) && OPS.has(l.op)) warns.push({ block: bi, ln: l.ln, op: l.op, msg: l.op === 'XOR' || l.op === 'AND' || l.op === 'OR' ? `${l.op} no se usa en los documentos del curso` : ['JG', 'JL', 'JGE', 'JLE'].includes(l.op) ? `${l.op} es un salto con signo: en los documentos solo se usan JB/JBE/JA/JE/JNE` : `${l.op} no aparece en los documentos del curso` });
      else if (!OPS.has(l.op) && l.op !== 'EXIT') warns.push({ block: bi, ln: l.ln, op: l.op, msg: `"${l.op}" no es una instrucción del 8086 (¿error de dedo?)` });
    }));
    const blocks = U.map((u, bi) => {
      const cu = canonicalize(u, map), cs = canonicalize(S[bi] || [], {});
      const tu = cu.flatMap(l => l.toks), ts = cs.flatMap(l => l.toks);
      const d = levenshtein(tu, ts), mx = Math.max(tu.length, ts.length);
      return { sim: mx ? 1 - d / mx : 1, dist: d, tokens: ts.length, diff: lineDiff(cu, cs), empty: !cu.length };
    });
    const tot = blocks.reduce((a, b) => a + Math.max(b.tokens, 1), 0);
    const sim = blocks.reduce((a, b) => a + b.sim * Math.max(b.tokens, 1), 0) / tot;
    return { sim, blocks, warns, labelMap: map };
  }

  const fill = (template, blocks) => String(template).replace(/\{\{B(\d+)\}\}/g, (_, i) => blocks[+i - 1] || '');

  const API = { assemble, Machine, runProgram, compare, fill, templateContext, parseBlock, canonicalize, tokenize, stripComment, evalExpr, num, hex, CP437, AsmError, R8, R16, SR };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.ASM = API;
})(typeof window !== 'undefined' ? window : globalThis);
