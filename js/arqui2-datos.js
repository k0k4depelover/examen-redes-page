/* ===== Datos de la guía de Arquitectura II · Parcial II =====
   BANCO: ejercicios de programación (plantilla con {{B1}}, {{B2}}… + solución por bloque).
     El alumno escribe solo los bloques; la plantilla (datos y variables) viene dada, como en
     el examen. Cada prueba ejecuta la plantilla completa en el simulador con esa entrada
     (\r = Enter) y, si trae rep: [a, b], cambia a por b en la plantilla antes de correrla.
   TRAZAS: ejercicios en papel tipo Hoja de Actividades (estado inicial + código + casillas).
   QUIZ y ABIERTAS: preguntas directas y abiertas. */
(function (root) {
  'use strict';

  /* ---------- Plantillas repetidas ---------- */
  const LAB5_DATA = `org 100h

.DATA
msj1 db 13,10,'Ingrese la temperatura (0-9): $'
msj2 db 13,10,'Estado Bajo',13,10,'$'
msj3 db 13,10,'Estado Estable',13,10,'$'
msj4 db 13,10,'Estado Critico - Apagar el sistema',13,10,'$'
msj5 db 13,10,'Valor invalido, debe ser un digito del 0 al 9',13,10,'$'

.CODE
{{B1}}
ret`;

  /* Bloque 2 del examen: mostrar una categoría (se repite 4 veces con otros nombres) */
  const mostrar = (msj, cant, buf, p, sig, etiq) => `${etiq ? etiq + ':\n' : ''}   LEA DX, ${msj}
   MOV AH, 09h
   INT 21h

   MOV AL, ${cant}
   MOV AH, 0
   MOV BL, 10
   DIV BL
   MOV BH, AH
   CMP AL, 0
   JE ${p}_UNID
   MOV DL, AL
   ADD DL, 30h
   MOV AH, 02h
   INT 21h
${p}_UNID:
   MOV DL, BH
   ADD DL, 30h
   MOV AH, 02h
   INT 21h

   LEA DX, MSJ_LISTA
   MOV AH, 09h
   INT 21h

   CMP ${cant}, 0
   JNE ${p}_LISTAR
   LEA DX, MSJ_VACIO
   MOV AH, 09h
   INT 21h
   JMP ${sig}

${p}_LISTAR:
   MOV CL, ${cant}
   MOV CH, 0
   LEA SI, ${buf}

${p}_CICLO:
   MOV DL, [SI]
   MOV AH, 02h
   INT 21h
   MOV DL, ' '
   INT 21h
   INC SI
   LOOP ${p}_CICLO`;

  const REPETIR = `REPETIR:
   LEA DX, MSJ_REPETIR
   MOV AH, 09h
   INT 21h

   MOV AH, 01h
   INT 21h

   CMP AL, 'S'
   JE VOLVER
   CMP AL, 's'
   JE VOLVER
   JMP FIN_PROGRAMA

VOLVER:
   JMP INICIO_PROGRAMA

FIN_PROGRAMA:
   LEA DX, MSJ_FIN
   MOV AH, 09h
   INT 21h
   MOV AX, 4C00h
   INT 21h`;

  const BANCO = [
    /* ================= NIVEL 1 · FÁCIL ================= */
    {
      id: 'e01', nivel: 1, titulo: 'Tu primer mensaje', patron: 'Labs · INT 21h/09h', estilo: 'lab', min: 4,
      enun: 'Muestra en pantalla el mensaje <code>msj</code> y termina el programa.',
      vars: [['msj', 'DB', 'Cadena con salto de línea (13,10) y terminada en <code>$</code>']],
      etiquetas: [], regs: ['DX', 'AH'],
      plantilla: `org 100h

.DATA
msj db 13,10,'Hola! Bienvenido a Arquitectura 2',13,10,'$'

.CODE
{{B1}}
ret`,
      bloques: [{
        titulo: 'Mostrar el mensaje y salir',
        instr: ['Carga en DX la dirección de msj (LEA DX, … o MOV DX, OFFSET …).', 'Pon la función 09h en AH y llama a INT 21h.', 'Termina con la función 4Ch de INT 21h.'],
        sol: `lea dx, msj
mov ah, 09h
int 21h

mov ah, 4ch
int 21h`,
        pistas: ['Imprimir una cadena terminada en $ = INT 21h con AH = 09h; la dirección de la cadena va en DX.', 'Son dos llamadas a INT 21h: una con AH = 09h (imprimir) y otra con AH = 4Ch (salir al sistema).', 'lea dx, ___ / mov ah, ___ / int 21h / mov ah, ___ / int 21h']
      }],
      pruebas: [{ in: '', nota: 'no pide teclado' }],
      preguntas: [
        { t: 'd', q: '¿Qué registro le dice a INT 21h qué función ejecutar?', a: '<b>AH.</b> INT 21h mira AH: 09h imprime cadena, 01h lee tecla, 02h imprime carácter, 4Ch termina.' },
        { t: 'd', q: '¿Qué significan los bytes 13,10 al inicio de msj?', a: '<b>13 = 0Dh = CR</b> (regresa el cursor a la columna 0) y <b>10 = 0Ah = LF</b> (baja una línea). Juntos son un “Enter”.' },
        { t: 'a', q: '¿Qué pasaría si msj no terminara en $?', a: 'INT 21h/09h imprime byte por byte <b>hasta encontrar un 24h ($)</b>. Sin él sigue mostrando lo que haya después en memoria (basura: otras variables, código) hasta topar con un $ por casualidad.' }
      ]
    },
    {
      id: 'e02', nivel: 1, titulo: 'Eco de un carácter', patron: 'Lab de NEG · INT 21h/01h y 02h', estilo: 'lab', min: 6,
      enun: 'Pide un carácter, guárdalo en <code>BL</code> y vuelve a mostrarlo después de un mensaje.',
      vars: [['pedir', 'DB', 'Mensaje para pedir el carácter'], ['msg_res', 'DB', 'Mensaje antes de mostrar el carácter']],
      etiquetas: [], regs: ['DX', 'AH', 'AL', 'BL', 'DL'],
      plantilla: `org 100h

.DATA
pedir   db 13,10,'Ingrese un caracter: $'
msg_res db 13,10,'Usted ingreso: $'

.CODE
{{B1}}
ret`,
      bloques: [{
        titulo: 'Leer y repetir',
        instr: ['Muestra pedir.', 'Lee una tecla con eco (INT 21h, AH = 01h) y guárdala en BL.', 'Muestra msg_res.', 'Imprime el carácter guardado con INT 21h, AH = 02h (el carácter va en DL).', 'Termina con AH = 4Ch.'],
        sol: `lea dx, pedir
mov ah, 09h
int 21h

mov ah, 01h
int 21h
mov bl, al

lea dx, msg_res
mov ah, 09h
int 21h

mov dl, bl
mov ah, 02h
int 21h

mov ah, 4ch
int 21h`,
        pistas: ['La tecla que lee la función 01h queda en AL. La función 02h imprime lo que haya en DL.', 'Guarda AL en BL justo después de leer: la función 09h va a cambiar AL.', 'mov ah, 01h / int 21h / mov bl, al … mov dl, bl / mov ah, 02h / int 21h']
      }],
      pruebas: [{ in: 'K' }, { in: '7' }],
      preguntas: [
        { t: 'd', q: 'Si tecleas 7, ¿qué valor hexadecimal queda en AL?', a: '<b>37h</b>, el código ASCII del carácter “7”, no 07h.' },
        { t: 'd', q: '¿Qué valor deja INT 21h/09h en AL al terminar?', a: '<b>24h</b> (el “$”). Por eso el carácter no se puede dejar en AL.' },
        { t: 'a', q: '¿Por qué se copia AL a BL antes de mostrar msg_res?', a: 'Porque imprimir msg_res usa <code>MOV AH, 09h</code> e INT 21h/09h devuelve AL = 24h: el carácter se perdería. BL no lo toca ninguna de las dos funciones, así que ahí queda a salvo.' }
      ]
    },
    {
      id: 'e03', nivel: 1, titulo: 'Sumar 2 y complemento a 2', patron: 'Lab de NEG (igual al del curso)', estilo: 'lab', min: 8,
      enun: 'Pide un carácter ASCII, súmale 2, sácale el complemento a 2 con <code>NEG</code> y muestra el resultado. Es el laboratorio del curso tal cual.',
      vars: [['saludo', 'DB', 'Bienvenida'], ['pedir', 'DB', 'Mensaje para pedir el carácter'], ['msg_res', 'DB', 'Mensaje del resultado'], ['salto', 'DB', 'Solo 13,10,$']],
      etiquetas: [], regs: ['DX', 'AH', 'AL', 'BL', 'DL'],
      plantilla: `org 100h

.DATA
saludo  db 13,10,'*** Hola! Bienvenido al programa ***',13,10,'$'
pedir   db 13,10,'Ingrese un caracter ASCII: $'
msg_res db 13,10,'Caracter modificado: $'
salto   db 13,10,'$'

.CODE
{{B1}}
ret`,
      bloques: [{
        titulo: 'Todo el programa',
        instr: ['Muestra saludo y luego pedir.', 'Lee un carácter (AH = 01h) y guárdalo en BL.', 'Súmale 2 a BL.', 'Obtén el complemento a 2 de BL con NEG.', 'Muestra msg_res, el carácter de BL (AH = 02h) y salto.', 'No pongas salida: el ret ya está en la plantilla.'],
        sol: `lea dx, saludo
mov ah, 09h
int 21h

lea dx, pedir
mov ah, 09h
int 21h

mov ah, 01h
int 21h
mov bl, al

add bl, 2

neg bl

lea dx, msg_res
mov ah, 09h
int 21h

mov dl, bl
mov ah, 02h
int 21h

lea dx, salto
mov ah, 09h
int 21h`,
        pistas: ['Son cuatro impresiones con 09h (saludo, pedir, msg_res, salto) y una con 02h (el carácter).', 'Después de leer: mov bl, al → add bl, 2 → neg bl.', 'neg bl invierte los bits y suma 1. Para imprimir BL hay que pasarlo a DL.']
      }],
      pruebas: [{ in: 'A' }, { in: '0' }],
      preguntas: [
        { t: 'd', q: 'Si ingresas A (41h), ¿qué queda en BL al final?', a: '41h + 2 = 43h → NEG → <b>BDh</b> (189 sin signo, −67 con signo).' },
        { t: 'd', q: '¿Qué hace NEG en una sola frase?', a: 'Invierte todos los bits y suma 1 (complemento a 2): <b>cambia el signo</b> del número.' },
        { t: 'a', q: '¿Por qué en pantalla aparece un símbolo raro y no una letra?', a: 'BDh es mayor que 7Fh: está fuera del ASCII estándar (0–127). La pantalla usa la tabla extendida (página 437) y BDh se dibuja como ╜.' }
      ]
    },
    {
      id: 'e04', nivel: 1, titulo: 'El doble de un número', patron: 'Lab 2', estilo: 'lab', min: 8,
      enun: 'Pide un número del 0 al 4, guárdalo como número (no como ASCII) en <code>num1</code> y muestra su doble.',
      vars: [['mensaje1', 'DB', 'Pide el número'], ['mensajedob', 'DB', 'Antes del resultado'], ['num1', 'DB ?', 'El número ya convertido (0–4)']],
      etiquetas: [], regs: ['AH', 'AL', 'DX', 'DL'],
      plantilla: `org 100h

.DATA
mensaje1   db 13,10,'Ingresa un numero del 0 al 4: $'
mensajedob db 13,10,'El doble del numero es: $'
num1 db ?

.CODE
{{B1}}
ret`,
      bloques: [{
        titulo: 'Leer, duplicar y mostrar',
        instr: ['Muestra mensaje1 (como en el lab: mov ah, 09h y luego lea dx).', 'Lee un carácter (AH = 01h) y conviértelo de ASCII a número restando 30h.', 'Guárdalo en num1.', 'Muestra mensajedob.', 'Calcula el doble: AL = num1 y ADD AL, AL.', 'Conviértelo a ASCII (+30h), pásalo a DL e imprímelo con AH = 02h.', 'Termina con AH = 4Ch.'],
        sol: `mov ah, 09h
lea dx, mensaje1
int 21h

mov ah, 01h
int 21h
sub al, 30h
mov num1, al

mov ah, 09h
lea dx, mensajedob
int 21h

mov al, num1
add al, al
add al, 30h
mov dl, al
mov ah, 02h
int 21h

mov ah, 4ch
int 21h`,
        pistas: ['ASCII → número: SUB AL, 30h. Número → ASCII: ADD AL, 30h.', 'El doble sin MUL: sumar el número consigo mismo (ADD AL, AL).', 'sub al, 30h / mov num1, al … mov al, num1 / add al, al / add al, 30h / mov dl, al']
      }],
      pruebas: [{ in: '3' }, { in: '4' }, { in: '0' }],
      preguntas: [
        { t: 'd', q: 'Si ingresas 4, ¿qué valor hay en AL justo después de SUB AL, 30h?', a: '<b>04h</b> (34h − 30h).' },
        { t: 'd', q: '¿Qué imprime si ingresas 7?', a: '7 × 2 = 14 = 0Eh; + 30h = 3Eh → el carácter <b>“&gt;”</b>. Por eso el rango es 0–4: el doble debe ser de una cifra.' },
        { t: 'a', q: '¿Por qué hay que sumar 30h antes de imprimir?', a: 'INT 21h/02h imprime el <b>carácter</b> cuyo código está en DL. El número 8 (08h) es un carácter de control (retroceso); el dígito “8” es 38h. Sumar 30h convierte un valor 0–9 en su dígito ASCII.' }
      ]
    },
    {
      id: 'e05', nivel: 1, titulo: 'Resta de dos números', patron: 'Lab 2', estilo: 'lab', min: 10,
      enun: 'Pide dos números (0–4 y 5–9), guárdalos en <code>num1</code> y <code>num2</code> y muestra <b>segundo − primero</b>.',
      vars: [['mensaje1', 'DB', 'Pide el primero'], ['mensaje2', 'DB', 'Pide el segundo'], ['mensajeres', 'DB', 'Antes del resultado'], ['num1', 'DB ?', 'Primer número'], ['num2', 'DB ?', 'Segundo número']],
      etiquetas: [], regs: ['AH', 'AL', 'DX', 'DL'],
      plantilla: `org 100h

.DATA
mensaje1   db 13,10,'Ingresa un numero del 0 al 4: $'
mensaje2   db 13,10,'Ingresa un numero del 5 al 9: $'
mensajeres db 13,10,'La resta (segundo - primero) es: $'
num1 db ?
num2 db ?

.CODE
{{B1}}
ret`,
      bloques: [{
        titulo: 'Dos lecturas y la resta',
        instr: ['Pide el primer número con mensaje1, léelo, réstale 30h y guárdalo en num1.', 'Pide el segundo con mensaje2, léelo, réstale 30h y guárdalo en num2.', 'Muestra mensajeres.', 'AL = num2 − num1; conviértelo a ASCII y muéstralo con AH = 02h.', 'Termina con AH = 4Ch.'],
        sol: `mov ah, 09h
lea dx, mensaje1
int 21h
mov ah, 01h
int 21h
sub al, 30h
mov num1, al

mov ah, 09h
lea dx, mensaje2
int 21h
mov ah, 01h
int 21h
sub al, 30h
mov num2, al

mov ah, 09h
lea dx, mensajeres
int 21h

mov al, num2
sub al, num1
add al, 30h
mov dl, al
mov ah, 02h
int 21h

mov ah, 4ch
int 21h`,
        pistas: ['Es el mismo patrón de lectura dos veces: 09h (mensaje) → 01h (leer) → SUB AL, 30h → guardar.', 'La resta necesita un registro: MOV AL, num2 / SUB AL, num1.', 'mov al, num2 / sub al, num1 / add al, 30h / mov dl, al / mov ah, 02h / int 21h']
      }],
      pruebas: [{ in: '27' }, { in: '09' }, { in: '38' }],
      preguntas: [
        { t: 'd', q: '¿Por qué no se puede escribir SUB num2, num1?', a: 'El 8086 <b>no permite operaciones memoria–memoria</b>: uno de los dos operandos debe ser registro (MOV AL, num2 / SUB AL, num1).' },
        { t: 'a', q: '¿Qué pasaría si el usuario escribe 5 y luego 2?', a: '2 − 5 = −3 = <b>FDh</b> en complemento a 2. Al sumarle 30h se desborda y queda 2Dh, que es el guion “-”. No muestra “-3”: el programa asume que el segundo es mayor.' }
      ]
    },

    /* ================= NIVEL 2 · BÁSICO ================= */
    {
      id: 'e06', nivel: 2, titulo: 'Saludo con tu nombre (buffer 0Ah)', patron: 'Lab 2', estilo: 'lab', min: 10,
      enun: 'Pide el nombre completo con la función <code>0Ah</code> y responde “Hola &lt;nombre&gt;”.',
      vars: [['nombre', 'DB', 'Mensaje que pide el nombre'], ['buffer', 'DB 20 / DB ? / DB 20 DUP(\'$\')', 'Búfer de 0Ah: máximo, cantidad leída y los caracteres'], ['salto', 'DB', '13,10,$'], ['saludo', 'DB', '“Hola ”']],
      etiquetas: [], regs: ['AH', 'DX'],
      plantilla: `org 100h

.DATA
nombre db 'Escribe tu nombre completo: $'
buffer db 20
       db ?
       db 20 dup('$')
salto  db 13,10,'$'
saludo db 'Hola $'

.CODE
{{B1}}
ret`,
      bloques: [{
        titulo: 'Leer la cadena y saludar',
        instr: ['Muestra nombre.', 'Lee la cadena con INT 21h, AH = 0Ah (DX = dirección de buffer).', 'Muestra salto y luego saludo.', 'Muestra lo escrito: los caracteres empiezan en buffer + 2.', 'Termina con AH = 4Ch.'],
        sol: `mov ah, 09h
lea dx, nombre
int 21h

mov ah, 0ah
lea dx, buffer
int 21h

mov ah, 09h
lea dx, salto
int 21h

mov ah, 09h
lea dx, saludo
int 21h

mov ah, 09h
lea dx, buffer + 2
int 21h

mov ah, 4ch
int 21h`,
        pistas: ['0Ah recibe en DX la dirección del búfer completo (no de buffer + 2).', 'Los caracteres leídos empiezan en el tercer byte del búfer: buffer + 2.', 'mov ah, 0ah / lea dx, buffer / int 21h … mov ah, 09h / lea dx, buffer + 2 / int 21h']
      }],
      pruebas: [{ in: 'Oskar Cermeno\r' }, { in: 'Ana\r' }],
      preguntas: [
        { t: 'd', q: '¿Qué guarda DOS en buffer[0], buffer[1] y buffer[2…]?', a: '[0] = máximo de caracteres que caben (lo pones tú: 20); [1] = cuántos escribió el usuario (lo llena DOS); [2…] = los caracteres, seguidos de 0Dh (el Enter).' },
        { t: 'a', q: '¿Por qué el búfer se rellena con “$” y no con ceros?', a: 'Así, después de lo escrito ya hay un “$”, y se puede imprimir buffer + 2 directo con 09h sin tener que poner el terminador a mano.' }
      ]
    },
    {
      id: 'e07', nivel: 2, titulo: 'Validar un dígito', patron: 'Lab 5 (validación)', estilo: 'lab', min: 8,
      enun: 'Lee una tecla y di si es un dígito del 0 al 9 o no.',
      vars: [['msj1', 'DB', 'Pide el dígito'], ['msjv', 'DB', 'Mensaje de válido'], ['msji', 'DB', 'Mensaje de inválido']],
      etiquetas: ['no_valido', 'salida'], regs: ['AL', 'AH', 'DX'],
      plantilla: `org 100h

.DATA
msj1 db 13,10,'Ingrese un digito (0-9): $'
msjv db 13,10,'Digito valido',13,10,'$'
msji db 13,10,'Valor invalido, debe ser un digito del 0 al 9',13,10,'$'

.CODE
{{B1}}
ret`,
      bloques: [{
        titulo: 'Filtro de rango',
        instr: ['Muestra msj1 (usa mov dx, offset y mov ah, 9 como en el lab) y lee una tecla (mov ah, 1).', 'Si AL < \'0\' salta a no_valido (JB). Si AL > \'9\' salta a no_valido (JA).', 'Si pasó los dos filtros, muestra msjv y salta a salida.', 'no_valido: muestra msji.', 'salida: termina con AH = 4Ch.'],
        sol: `mov dx, offset msj1
mov ah, 9
int 21h

mov ah, 1
int 21h

cmp al, '0'
jb no_valido
cmp al, '9'
ja no_valido

mov dx, offset msjv
mov ah, 9
int 21h
jmp salida

no_valido:
mov dx, offset msji
mov ah, 9
int 21h

salida:
mov ah, 4ch
int 21h`,
        pistas: ['Un rango se valida con dos comparaciones: contra el límite inferior y contra el superior.', 'cmp al, \'0\' / jb no_valido — cmp al, \'9\' / ja no_valido', 'No olvides el jmp salida después del mensaje de válido, o caerá en no_valido.']
      }],
      pruebas: [{ in: '5' }, { in: 'x' }, { in: '/' }],
      preguntas: [
        { t: 'd', q: '¿Por qué se usan JB/JA y no JL/JG?', a: 'Los códigos ASCII son números <b>sin signo</b>: JB (below) y JA (above) comparan sin signo. JL/JG son con signo (y no aparecen en los documentos del curso).' },
        { t: 'd', q: '¿Qué hace CMP AL, \'0\' por dentro?', a: 'Resta AL − 30h <b>sin guardar el resultado</b>; solo actualiza las banderas (CF, ZF, SF…) para que el salto decida.' },
        { t: 'a', q: '¿Por qué hace falta el JMP salida después de mostrar msjv?', a: 'Las etiquetas no detienen la ejecución. Sin el JMP el programa seguiría de largo hacia no_valido y mostraría también el mensaje de inválido.' }
      ]
    },
    {
      id: 'e08', nivel: 2, titulo: 'Clasificar la temperatura', patron: 'Lab 5', estilo: 'lab', min: 12,
      enun: 'Lee una temperatura (0–9) y clasifícala: 0–4 bajo, 5–7 estable, 8–9 crítico; cualquier otra tecla es inválida. Es el Lab 5.',
      vars: [['msj1', 'DB', 'Pide la temperatura'], ['msj2', 'DB', 'Estado Bajo'], ['msj3', 'DB', 'Estado Estable'], ['msj4', 'DB', 'Estado Crítico'], ['msj5', 'DB', 'Valor inválido']],
      etiquetas: ['estado_bajo', 'estado_estable', 'estado_critico', 'no_valido', 'salida'], regs: ['AL', 'AH', 'DX'],
      plantilla: LAB5_DATA,
      bloques: [{
        titulo: 'Validar y clasificar',
        instr: ['Muestra msj1 y lee la temperatura (mov ah, 1).', 'Valida que sea un dígito: < \'0\' o > \'9\' → no_valido.', 'Clasifica: ≤ \'4\' → estado_bajo; ≤ \'7\' → estado_estable; si no, estado_critico (JMP).', 'Cada estado muestra su mensaje (msj2, msj3, msj4) y salta a salida.', 'no_valido muestra msj5 y cae en salida, que termina con AH = 4Ch.'],
        sol: `mov dx, offset msj1
mov ah, 9
int 21h

mov ah, 1
int 21h

cmp al, '0'
jb no_valido
cmp al, '9'
ja no_valido

cmp al, '4'
jbe estado_bajo
cmp al, '7'
jbe estado_estable
jmp estado_critico

estado_bajo:
mov dx, offset msj2
mov ah, 9
int 21h
jmp salida

estado_estable:
mov dx, offset msj3
mov ah, 9
int 21h
jmp salida

estado_critico:
mov dx, offset msj4
mov ah, 9
int 21h
jmp salida

no_valido:
mov dx, offset msj5
mov ah, 9
int 21h

salida:
mov ah, 4ch
int 21h`,
        pistas: ['Primero el filtro de dígito (JB/JA a no_valido), luego la cascada de rangos con JBE.', 'cmp al, \'4\' / jbe estado_bajo — cmp al, \'7\' / jbe estado_estable — jmp estado_critico', 'Cada estado: mov dx, offset msjN / mov ah, 9 / int 21h / jmp salida.']
      }],
      pruebas: [{ in: '2' }, { in: '6' }, { in: '9' }, { in: 'a' }],
      preguntas: [
        { t: 'd', q: '¿Qué salto usarías para “si AL ≤ \'4\'”?', a: '<code>CMP AL, \'4\'</code> y <b>JBE</b> (jump if below or equal).' },
        { t: 'a', q: '¿Por qué después de CMP AL, \'7\' / JBE estado_estable ya no hay que preguntar si AL ≥ 5?', a: 'Porque si la ejecución llegó ahí, el salto anterior ya descartó ≤ 4. Las comparaciones en cascada van cerrando el rango de abajo hacia arriba.' }
      ]
    },
    {
      id: 'e09', nivel: 2, titulo: 'Monitoreo continuo hasta crítico', patron: 'Lab 4 (ciclo con una sola salida)', estilo: 'lab', min: 12,
      enun: 'Igual que el Lab 5, pero el programa <b>vuelve a pedir</b> la temperatura hasta que llegue un estado crítico, que es la única salida. Es el Lab 4.',
      vars: [['msj1…msj5', 'DB', 'Los mismos mensajes del Lab 5']],
      etiquetas: ['inicio', 'estado_bajo', 'estado_estable', 'no_valido', 'estado_critico'], regs: ['AL', 'AH', 'DX'],
      plantilla: LAB5_DATA,
      bloques: [{
        titulo: 'Ciclo de monitoreo',
        instr: ['inicio: muestra msj1 y lee la temperatura.', 'Valida (no_valido si no es dígito) y clasifica igual que el Lab 5.', 'Bajo, estable e inválido muestran su mensaje y regresan con JMP inicio.', 'La única salida es estado_critico (escríbelo al final): muestra msj4 y termina con AH = 4Ch.'],
        sol: `inicio:
mov dx, offset msj1
mov ah, 9
int 21h

mov ah, 1
int 21h

cmp al, '0'
jb no_valido
cmp al, '9'
ja no_valido

cmp al, '4'
jbe estado_bajo
cmp al, '7'
jbe estado_estable
jmp estado_critico

estado_bajo:
mov dx, offset msj2
mov ah, 9
int 21h
jmp inicio

estado_estable:
mov dx, offset msj3
mov ah, 9
int 21h
jmp inicio

no_valido:
mov dx, offset msj5
mov ah, 9
int 21h
jmp inicio

estado_critico:
mov dx, offset msj4
mov ah, 9
int 21h

mov ah, 4ch
int 21h`,
        pistas: ['Es el Lab 5 con una etiqueta inicio arriba y JMP inicio en lugar de JMP salida.', 'Orden de las ramas: estado_bajo, estado_estable, no_valido y al final estado_critico (que no regresa).', 'estado_critico: mov dx, offset msj4 / mov ah, 9 / int 21h / mov ah, 4ch / int 21h']
      }],
      pruebas: [{ in: '26a9' }, { in: '8' }, { in: '0x5' }],
      preguntas: [
        { t: 'd', q: 'Con la entrada 2, 6, a, 9 ¿cuántas veces se ejecuta INT 21h/01h?', a: '<b>4</b>: una por vuelta. La cuarta (9) es crítica y termina.' },
        { t: 'd', q: 'Si la tercera entrada no llega (entrada 0 x 5), ¿termina el programa?', a: '<b>No.</b> Se queda esperando otra tecla: solo 8 o 9 lo terminan.' },
        { t: 'a', q: '¿Qué diferencia de estructura hay entre el Lab 4 y el Lab 5?', a: 'En el Lab 5 cada rama salta a salida (se ejecuta una vez). En el Lab 4 las ramas regresan con JMP inicio (ciclo infinito) y solo el estado crítico termina: tiene <b>una única salida</b>.' }
      ]
    },
    {
      id: 'e10', nivel: 2, titulo: '¿Qué tipo de carácter es?', patron: 'Examen · cascada de rangos ASCII', estilo: 'lab', min: 12,
      enun: 'Lee un carácter y di si es número, mayúscula, minúscula o especial usando la misma cascada de comparaciones del examen.',
      vars: [['pedir', 'DB', 'Pide el carácter'], ['msjNum', 'DB', 'Es un NUMERO'], ['msjMay', 'DB', 'Es una MAYUSCULA'], ['msjMin', 'DB', 'Es una MINUSCULA'], ['msjEsp', 'DB', 'Es ESPECIAL']],
      etiquetas: ['es_num', 'es_mayus', 'es_minus', 'es_espec', 'mostrar'], regs: ['AL', 'AH', 'DX'],
      plantilla: `org 100h

.DATA
pedir  db 13,10,'Ingrese un caracter: $'
msjNum db 13,10,'Es un NUMERO$'
msjMay db 13,10,'Es una MAYUSCULA$'
msjMin db 13,10,'Es una MINUSCULA$'
msjEsp db 13,10,'Es un caracter ESPECIAL$'

.CODE
{{B1}}
ret`,
      bloques: [{
        titulo: 'Cascada y un solo mostrar',
        instr: ['Muestra pedir y lee un carácter.', 'Cascada: < \'0\' → es_espec; ≤ \'9\' → es_num; < \'A\' → es_espec; ≤ \'Z\' → es_mayus; < \'a\' → es_espec; ≤ \'z\' → es_minus; si no, JMP es_espec.', 'es_num, es_mayus y es_minus solo cargan su mensaje en DX (LEA) y saltan a mostrar; es_espec va al final y cae directo.', 'mostrar: imprime con AH = 09h y termina con AH = 4Ch.'],
        sol: `lea dx, pedir
mov ah, 09h
int 21h

mov ah, 01h
int 21h

cmp al, '0'
jb es_espec
cmp al, '9'
jbe es_num
cmp al, 'A'
jb es_espec
cmp al, 'Z'
jbe es_mayus
cmp al, 'a'
jb es_espec
cmp al, 'z'
jbe es_minus
jmp es_espec

es_num:
lea dx, msjNum
jmp mostrar

es_mayus:
lea dx, msjMay
jmp mostrar

es_minus:
lea dx, msjMin
jmp mostrar

es_espec:
lea dx, msjEsp

mostrar:
mov ah, 09h
int 21h

mov ah, 4ch
int 21h`,
        pistas: ['La tabla ASCII sube así: especiales, 0–9 (30h–39h), especiales, A–Z (41h–5Ah), especiales, a–z (61h–7Ah), especiales.', 'Patrón por rango: CMP con el inicio + JB es_espec; CMP con el final + JBE a la categoría.', 'Cada categoría: lea dx, msjX / jmp mostrar. mostrar: mov ah, 09h / int 21h / mov ah, 4ch / int 21h']
      }],
      pruebas: [{ in: '7' }, { in: 'Q' }, { in: 'm' }, { in: '#' }, { in: '[' }],
      preguntas: [
        { t: 'd', q: '¿Qué rango ASCII tienen las mayúsculas?', a: '<b>41h (A) a 5Ah (Z)</b>. Minúsculas: 61h a 7Ah. Dígitos: 30h a 39h.' },
        { t: 'd', q: 'El carácter “[” (5Bh), ¿en qué categoría cae?', a: '<b>Especial</b>: es mayor que “Z” (5Ah) y menor que “a” (61h), así que lo atrapa el JB es_espec que va después de CMP AL, \'a\'.' },
        { t: 'a', q: '¿Por qué conviene cargar solo DX en cada rama y tener un único mostrar?', a: 'Evita repetir las líneas de INT 21h/09h en cada rama: menos código y menos lugares donde equivocarse. AH = 09h se pone una sola vez.' }
      ]
    },

    /* ================= NIVEL 3 · INTERMEDIO ================= */
    {
      id: 'e11', nivel: 3, titulo: 'Contar del 0 al 9 con LOOP', patron: 'Ciclo LOOP', estilo: 'lab', min: 8,
      enun: 'Imprime los dígitos 0123456789 usando <code>LOOP</code>.',
      vars: [['titulo', 'DB', 'Texto antes de los dígitos']],
      etiquetas: ['ciclo'], regs: ['CX', 'DL', 'AH'],
      plantilla: `org 100h

.DATA
titulo db 13,10,'Digitos: $'

.CODE
{{B1}}
ret`,
      bloques: [{
        titulo: 'El ciclo',
        instr: ['Muestra titulo.', 'CX = 10 (vueltas) y DL = \'0\' (primer carácter).', 'ciclo: mov ah, 02h / int 21h / inc dl / loop ciclo.', 'Termina con AH = 4Ch.'],
        sol: `lea dx, titulo
mov ah, 09h
int 21h

mov cx, 10
mov dl, '0'

ciclo:
mov ah, 02h
int 21h
inc dl
loop ciclo

mov ah, 4ch
int 21h`,
        pistas: ['LOOP usa CX como contador: cárgalo antes de la etiqueta, no dentro.', 'DL empieza en \'0\' (30h) y en cada vuelta INC DL lo pasa al siguiente dígito.', 'mov cx, 10 / mov dl, \'0\' / ciclo: mov ah, 02h / int 21h / inc dl / loop ciclo']
      }],
      pruebas: [{ in: '' }],
      preguntas: [
        { t: 'd', q: '¿Qué hace LOOP ciclo exactamente?', a: '<b>CX = CX − 1</b>; si CX ≠ 0 salta a ciclo. No modifica las banderas.' },
        { t: 'd', q: '¿Cuántas vueltas da si CX = 0 al entrar?', a: '<b>65 536</b>: el primer LOOP deja CX = FFFFh (≠ 0) y sigue.' },
        { t: 'a', q: '¿Por qué no se pierde DL al llamar a INT 21h/02h?', a: 'La función 02h lee DL y solo modifica AL (le copia el carácter). DL queda igual, así que INC DL avanza al siguiente dígito.' }
      ]
    },
    {
      id: 'e12', nivel: 3, titulo: 'N asteriscos separados', patron: 'Examen · plantilla .MODEL SMALL', estilo: 'examen', min: 8,
      enun: 'Primer ejercicio con la plantilla del examen: imprime <code>N</code> asteriscos separados por espacio. <code>N</code> es una constante <code>EQU</code>.',
      vars: [['N', 'EQU 7', 'Cantidad de asteriscos (en el examen: 10 + dígito de carné)'], ['MSJ', 'DB', 'Texto antes de los asteriscos']],
      etiquetas: ['CICLO'], regs: ['CX', 'DL', 'AH', 'DX'],
      plantilla: `.MODEL SMALL
.STACK 100h

N EQU 7

.DATA
   MSJ DB 0Dh, 0Ah, 'Asteriscos: $'

.CODE
START:
   MOV AX, @DATA
   MOV DS, AX

{{B1}}

   MOV AX, 4C00h
   INT 21h
END START`,
      bloques: [{
        titulo: 'Mensaje y ciclo',
        instr: ['Muestra MSJ.', 'Configura un bucle de exactamente N vueltas (usa CX).', 'CICLO: DL = \'*\', AH = 02h, INT 21h; luego DL = \' \' e INT 21h otra vez (AH sigue en 02h).', 'Cierra con LOOP CICLO. La salida ya está en la plantilla.'],
        sol: `   LEA DX, MSJ
   MOV AH, 09h
   INT 21h

   MOV CX, N
CICLO:
   MOV DL, '*'
   MOV AH, 02h
   INT 21h
   MOV DL, ' '
   INT 21h
   LOOP CICLO`,
        pistas: ['MOV CX, N: la constante se usa como un número.', 'Dentro del ciclo hay dos INT 21h: uno para el asterisco y otro para el espacio.', 'CICLO: MOV DL, \'*\' / MOV AH, 02h / INT 21h / MOV DL, \' \' / INT 21h / LOOP CICLO']
      }],
      pruebas: [{ in: '' }, { in: '', rep: ['N EQU 7', 'N EQU 12'], nota: 'con N = 12' }],
      preguntas: [
        { t: 'd', q: '¿Qué hace MOV AX, @DATA / MOV DS, AX?', a: 'Apunta DS al segmento de datos del programa. Se pasa por AX porque el 8086 <b>no permite cargar DS con un número directo</b>.' },
        { t: 'd', q: '¿Por qué el segundo INT 21h no necesita otro MOV AH, 02h?', a: 'Nada cambió AH entre las dos llamadas (02h solo modifica AL), así que sigue siendo la función 02h.' },
        { t: 'a', q: '¿Qué ventaja tiene N EQU 7 frente a escribir 7 dentro del código?', a: 'EQU es una constante: si cambia N (en el examen, 10 + tu dígito de carné) se cambia en un solo lugar y el ensamblador la sustituye en todo el código. No ocupa memoria.' }
      ]
    },
    {
      id: 'e13', nivel: 3, titulo: 'Contar los números que se teclean', patron: 'Examen · bloque 1 simplificado', estilo: 'examen', min: 12,
      enun: 'Lee exactamente <code>N</code> caracteres y cuenta cuántos son dígitos en <code>CANT_NUMS</code>. Luego muestra el total (una cifra).',
      vars: [['N', 'EQU 6', 'Caracteres a leer'], ['MSJ_PEDIR', 'DB', 'Ya se muestra en la plantilla'], ['MSJ_TOTAL', 'DB', 'Antes del total'], ['CANT_NUMS', 'DB 0', 'Contador de dígitos']],
      etiquetas: ['CAPTURA', 'SIGUIENTE'], regs: ['CX', 'AH', 'AL', 'DL'],
      plantilla: `.MODEL SMALL
.STACK 100h

N EQU 6

.DATA
   MSJ_PEDIR DB 0Dh, 0Ah, 'Ingrese 6 caracteres: $'
   MSJ_TOTAL DB 0Dh, 0Ah, 'Cantidad de numeros: $'
   CANT_NUMS DB 0

.CODE
START:
   MOV AX, @DATA
   MOV DS, AX

   LEA DX, MSJ_PEDIR
   MOV AH, 09h
   INT 21h

   ; BLOQUE 1: CAPTURA Y CONTEO
{{B1}}

   ; BLOQUE 2: MOSTRAR EL TOTAL
{{B2}}

   MOV AX, 4C00h
   INT 21h
END START`,
      bloques: [{
        titulo: 'Captura y conteo',
        instr: ['Bucle de exactamente N iteraciones con CX.', 'CAPTURA: lee un carácter con AH = 01h.', 'Si AL < \'0\' o AL > \'9\' salta a SIGUIENTE; si es dígito, INC CANT_NUMS.', 'SIGUIENTE: LOOP CAPTURA.'],
        sol: `   MOV CX, N
CAPTURA:
   MOV AH, 01h
   INT 21h
   CMP AL, '0'
   JB SIGUIENTE
   CMP AL, '9'
   JA SIGUIENTE
   INC CANT_NUMS
SIGUIENTE:
   LOOP CAPTURA`,
        pistas: ['El filtro es el mismo del Lab 5, pero en vez de ir a no_valido se salta al final de la vuelta.', 'INC funciona directo sobre una variable de memoria: INC CANT_NUMS.', 'CAPTURA: … CMP AL, \'0\' / JB SIGUIENTE / CMP AL, \'9\' / JA SIGUIENTE / INC CANT_NUMS / SIGUIENTE: LOOP CAPTURA']
      }, {
        titulo: 'Mostrar el total',
        instr: ['Muestra MSJ_TOTAL.', 'DL = CANT_NUMS + 30h e imprímelo con AH = 02h.'],
        sol: `   LEA DX, MSJ_TOTAL
   MOV AH, 09h
   INT 21h

   MOV DL, CANT_NUMS
   ADD DL, 30h
   MOV AH, 02h
   INT 21h`,
        pistas: ['El contador es un número (0–6): hay que convertirlo a ASCII.', 'MOV DL, CANT_NUMS / ADD DL, 30h', 'Luego MOV AH, 02h / INT 21h.']
      }],
      pruebas: [{ in: 'a1b2c3' }, { in: 'hola!!' }, { in: '987654' }],
      preguntas: [
        { t: 'd', q: '¿Por qué INC CANT_NUMS no necesita BYTE PTR?', a: 'Porque CANT_NUMS se declaró con <b>DB</b>: el ensamblador ya sabe que es de 8 bits.' },
        { t: 'd', q: 'Si los 6 caracteres son dígitos, ¿qué se imprime?', a: '<b>“6”</b> (06h + 30h = 36h).' },
        { t: 'a', q: '¿Qué fallaría si N fuera 12 y el usuario escribiera 12 dígitos?', a: 'El contador sería 12 (0Ch); + 30h = 3Ch = “&lt;”. Para dos cifras hay que dividir entre 10 (ejercicio 14, igual que el examen).' }
      ]
    },
    {
      id: 'e14', nivel: 3, titulo: 'Mostrar un número de 2 cifras (DIV)', patron: 'Examen · contador ≥ 10', estilo: 'examen', min: 10,
      enun: 'Muestra el valor de <code>CANTIDAD</code> en decimal con el método del examen: dividir entre 10, decenas y unidades; si las decenas son 0 no se imprimen.',
      vars: [['MSJ_TOTAL', 'DB', 'Ya se muestra en la plantilla'], ['CANTIDAD', 'DB 47', 'El número a mostrar (0–99)']],
      etiquetas: ['UNIDADES'], regs: ['AX', 'BL', 'BH', 'DL'],
      plantilla: `.MODEL SMALL
.STACK 100h
.DATA
   MSJ_TOTAL DB 0Dh, 0Ah, 'Total: $'
   CANTIDAD  DB 47
.CODE
START:
   MOV AX, @DATA
   MOV DS, AX

   LEA DX, MSJ_TOTAL
   MOV AH, 09h
   INT 21h

{{B1}}

   MOV AX, 4C00h
   INT 21h
END START`,
      bloques: [{
        titulo: 'Decenas y unidades',
        instr: ['AL = CANTIDAD y AH = 0 (AX = CANTIDAD).', 'BL = 10 y DIV BL: cociente (decenas) en AL, residuo (unidades) en AH.', 'Guarda las unidades en BH: MOV BH, AH.', 'Si AL = 0 salta a UNIDADES (sin cero a la izquierda).', 'Imprime AL + 30h (DL, AH = 02h).', 'UNIDADES: imprime BH + 30h.'],
        sol: `   MOV AL, CANTIDAD
   MOV AH, 0
   MOV BL, 10
   DIV BL
   MOV BH, AH
   CMP AL, 0
   JE UNIDADES
   MOV DL, AL
   ADD DL, 30h
   MOV AH, 02h
   INT 21h
UNIDADES:
   MOV DL, BH
   ADD DL, 30h
   MOV AH, 02h
   INT 21h`,
        pistas: ['DIV no acepta números: el divisor 10 va en un registro (BL).', 'Después de DIV BL: AL = decenas, AH = unidades. Guarda AH en BH antes de usar AH = 02h.', 'MOV AL, CANTIDAD / MOV AH, 0 / MOV BL, 10 / DIV BL / MOV BH, AH / CMP AL, 0 / JE UNIDADES …']
      }],
      pruebas: [{ in: '' }, { in: '', rep: ['DB 47', 'DB 7'], nota: 'CANTIDAD = 7' }, { in: '', rep: ['DB 47', 'DB 90'], nota: 'CANTIDAD = 90' }],
      preguntas: [
        { t: 'd', q: 'Con CANTIDAD = 47, ¿qué valen AL y AH después de DIV BL?', a: '<b>AL = 04h</b> (cociente) y <b>AH = 07h</b> (residuo).' },
        { t: 'd', q: '¿Por qué MOV AH, 0 antes de DIV BL?', a: 'DIV BL divide <b>AX completo</b> (16 bits) entre BL. Si AH tuviera basura el dividendo sería otro número y el cociente podría no caber en AL (error de división).' },
        { t: 'a', q: '¿Por qué se copia AH a BH antes de imprimir las decenas?', a: 'Para imprimir hay que hacer MOV AH, 02h, y eso borra el residuo que estaba en AH. BH lo guarda (INT 21h/02h no toca BX).' }
      ]
    },
    {
      id: 'e15', nivel: 3, titulo: 'Recorrer un arreglo con SI', patron: 'Examen · listar un buffer', estilo: 'examen', min: 10,
      enun: 'Muestra los <code>CANT</code> caracteres de <code>ARREGLO</code> separados por espacio, recorriéndolo con <code>SI</code>.',
      vars: [['MSJ_LISTA', 'DB', 'Ya se muestra en la plantilla'], ['ARREGLO', 'DB \'ARQUI\'', 'Los caracteres a mostrar'], ['CANT', 'DB 5', 'Cuántos hay']],
      etiquetas: ['CICLO'], regs: ['CL', 'CH', 'SI', 'DL', 'AH'],
      plantilla: `.MODEL SMALL
.STACK 100h
.DATA
   MSJ_LISTA DB 0Dh, 0Ah, 'Letras: $'
   ARREGLO   DB 'ARQUI'
   CANT      DB 5
.CODE
START:
   MOV AX, @DATA
   MOV DS, AX

   LEA DX, MSJ_LISTA
   MOV AH, 09h
   INT 21h

{{B1}}

   MOV AX, 4C00h
   INT 21h
END START`,
      bloques: [{
        titulo: 'Recorrido',
        instr: ['Contador: CL = CANT y CH = 0 (así CX = CANT).', 'SI = dirección de ARREGLO (LEA).', 'CICLO: DL = [SI] e imprímelo con AH = 02h; luego imprime un espacio.', 'INC SI y LOOP CICLO.'],
        sol: `   MOV CL, CANT
   MOV CH, 0
   LEA SI, ARREGLO
CICLO:
   MOV DL, [SI]
   MOV AH, 02h
   INT 21h
   MOV DL, ' '
   INT 21h
   INC SI
   LOOP CICLO`,
        pistas: ['CANT es un byte: no se puede hacer MOV CX, CANT. Llena CL y limpia CH.', '[SI] = el byte que está en la dirección DS:SI.', 'LEA SI, ARREGLO / CICLO: MOV DL, [SI] … INC SI / LOOP CICLO']
      }],
      pruebas: [{ in: '' }, { in: '', rep: ["'ARQUI'", "'8086!'"], nota: 'ARREGLO = 8086!' }],
      preguntas: [
        { t: 'd', q: '¿Por qué MOV CL, CANT y MOV CH, 0 en vez de MOV CX, CANT?', a: 'CANT es de 8 bits (DB) y CX de 16: <b>MOV CX, CANT da error de tamaños</b>. Se llena la parte baja y se limpia la alta.' },
        { t: 'd', q: '¿Qué diferencia hay entre MOV DL, SI y MOV DL, [SI]?', a: 'MOV DL, SI no es válido (16 → 8 bits). <b>[SI]</b> significa “el byte en la dirección DS:SI”: los corchetes leen memoria.' },
        { t: 'a', q: 'Explica qué es SI y por qué se incrementa.', a: 'SI (Source Index) funciona como <b>puntero</b>: guarda la dirección del elemento actual. INC SI lo mueve al siguiente byte del arreglo en cada vuelta.' }
      ]
    },
    {
      id: 'e16', nivel: 3, titulo: 'Copiar un arreglo al revés', patron: 'Hoja de Actividades · Parte 3', estilo: 'examen', min: 12,
      enun: 'Copia <code>ORIGEN</code> en <code>DESTINO</code> en orden inverso, con el mismo patrón de la Hoja de Actividades (<code>BL</code> de puente, <code>INC DI</code>, <code>DEC SI</code>), y muéstralo.',
      vars: [['MSJ', 'DB', 'Texto antes del resultado'], ['ORIGEN', 'DB \'HOLA\'', '4 bytes a copiar'], ['DESTINO', 'DB 4 DUP(\'*\'), \'$\'', '4 bytes + terminador']],
      etiquetas: ['COPIAR'], regs: ['DI', 'SI', 'CX', 'BL'],
      plantilla: `.MODEL SMALL
.STACK 100h
.DATA
   MSJ     DB 0Dh, 0Ah, 'Invertido: $'
   ORIGEN  DB 'HOLA'
   DESTINO DB 4 DUP('*'), '$'
.CODE
START:
   MOV AX, @DATA
   MOV DS, AX

   ; BLOQUE 1: COPIAR INVERTIDO
{{B1}}

   ; BLOQUE 2: MOSTRAR
{{B2}}

   MOV AX, 4C00h
   INT 21h
END START`,
      bloques: [{
        titulo: 'Copiar invertido',
        instr: ['DI = dirección de ORIGEN (MOV DI, OFFSET ORIGEN).', 'SI = dirección del último byte de DESTINO (MOV SI, OFFSET DESTINO + 3).', 'CX = 4.', 'COPIAR: BL = [DI]; [SI] = BL; INC DI; DEC SI; LOOP COPIAR.'],
        sol: `   MOV DI, OFFSET ORIGEN
   MOV SI, OFFSET DESTINO + 3
   MOV CX, 4
COPIAR:
   MOV BL, [DI]
   MOV [SI], BL
   INC DI
   DEC SI
   LOOP COPIAR`,
        pistas: ['DI lee de izquierda a derecha y SI escribe de derecha a izquierda.', 'No existe MOV [SI], [DI]: usa BL de intermediario.', 'COPIAR: MOV BL, [DI] / MOV [SI], BL / INC DI / DEC SI / LOOP COPIAR']
      }, {
        titulo: 'Mostrar',
        instr: ['Muestra MSJ y luego DESTINO (ya termina en $).'],
        sol: `   LEA DX, MSJ
   MOV AH, 09h
   INT 21h
   LEA DX, DESTINO
   MOV AH, 09h
   INT 21h`,
        pistas: ['Dos impresiones con 09h.', 'LEA DX, MSJ … LEA DX, DESTINO', 'Cada una: LEA DX, … / MOV AH, 09h / INT 21h']
      }],
      pruebas: [{ in: '' }, { in: '', rep: ["'HOLA'", "'ROMA'"], nota: 'ORIGEN = ROMA' }],
      preguntas: [
        { t: 'd', q: '¿Por qué no se puede hacer MOV [SI], [DI]?', a: 'Memoria a memoria <b>no existe</b> en el 8086: se usa BL como puente.' },
        { t: 'd', q: 'Después de la 2.ª vuelta, ¿dónde apuntan DI y SI?', a: '<b>DI = ORIGEN + 2</b> y <b>SI = DESTINO + 1</b>.' },
        { t: 'a', q: '¿Qué función realiza este código? (la pregunta de la hoja de actividades)', a: 'Copia ORIGEN en DESTINO <b>en orden inverso</b>: lee con DI avanzando (INC DI) y escribe con SI retrocediendo (DEC SI); BL es el intermediario porque no hay movimiento memoria–memoria. En la hoja, además, lee de CS:[DI] (los datos estaban en el segmento de código) y escribe en DS:[SI].' }
      ]
    },

    /* ================= NIVEL 4 · AVANZADO ================= */
    {
      id: 'e17', nivel: 4, titulo: 'Promedio de dos lecturas (SHR)', patron: 'Lab 6 · promedio móvil', estilo: 'lab', min: 14,
      enun: 'Lee dos temperaturas, promedia con <code>SHR</code> y di si el promedio es seguro (≤ 5) o crítico.',
      vars: [['msjPrompt', 'DB', 'Pide la temperatura'], ['msjSeguro', 'DB', 'Promedio seguro'], ['msjCritico', 'DB', 'Promedio crítico'], ['anterior', 'DB 0', 'Primera lectura (ya convertida)']],
      etiquetas: ['promedio_seguro', 'salida'], regs: ['AL', 'BL', 'DX', 'AH'],
      plantilla: `org 100h

.DATA
msjPrompt  db 13,10,'Ingrese la temperatura (0-9): $'
msjSeguro  db 13,10,'-> PROMEDIO BAJO/SEGURO',13,10,'$'
msjCritico db 13,10,'-> ALERTA: PROMEDIO CRITICO',13,10,'$'
anterior   db 0

.CODE
{{B1}}
{{B2}}
ret`,
      bloques: [{
        titulo: 'Dos lecturas',
        instr: ['Muestra msjPrompt, lee la 1.ª temperatura, conviértela (sub al, \'0\') y guárdala en anterior.', 'Muestra msjPrompt otra vez, lee la 2.ª, conviértela y guárdala en BL.'],
        sol: `mov dx, offset msjPrompt
mov ah, 9
int 21h
mov ah, 1
int 21h
sub al, '0'
mov anterior, al

mov dx, offset msjPrompt
mov ah, 9
int 21h
mov ah, 1
int 21h
sub al, '0'
mov bl, al`,
        pistas: ['El Lab 6 convierte con sub al, \'0\' (es lo mismo que 30h).', 'La primera va a memoria (anterior), la segunda se queda en BL.', 'mov ah, 1 / int 21h / sub al, \'0\' / mov anterior, al … mov bl, al']
      }, {
        titulo: 'Promedio y decisión',
        instr: ['AL = anterior + BL.', 'Divide entre 2 con SHR AL, 1.', 'Si AL ≤ 5 salta a promedio_seguro; si no, muestra msjCritico y salta a salida.', 'promedio_seguro: muestra msjSeguro.', 'salida: termina con AH = 4Ch.'],
        sol: `mov al, anterior
add al, bl
shr al, 1
cmp al, 5
jbe promedio_seguro

mov dx, offset msjCritico
mov ah, 9
int 21h
jmp salida

promedio_seguro:
mov dx, offset msjSeguro
mov ah, 9
int 21h

salida:
mov ah, 4ch
int 21h`,
        pistas: ['SHR AL, 1 corre los bits a la derecha: divide entre 2 sin decimales.', 'Compara con el número 5, no con \'5\': ya convertiste de ASCII.', 'mov al, anterior / add al, bl / shr al, 1 / cmp al, 5 / jbe promedio_seguro']
      }],
      pruebas: [{ in: '37' }, { in: '68' }, { in: '00' }, { in: '99' }],
      preguntas: [
        { t: 'd', q: '¿Qué hace SHR AL, 1?', a: 'Corre los bits de AL una posición a la derecha: <b>divide entre 2</b> (sin decimales). El bit que sale va a CF.' },
        { t: 'd', q: 'Con 6 y 8, ¿qué queda en AL después de SHR?', a: '6 + 8 = 14 = 0Eh → SHR → <b>07h</b>: crítico.' },
        { t: 'a', q: '¿Por qué aquí se compara con 5 y no con \'5\'?', a: 'Porque las lecturas ya se convirtieron a número con SUB AL, \'0\'. \'5\' sería 35h (53) y cualquier promedio 0–9 quedaría “seguro”.' }
      ]
    },
    {
      id: 'e18', nivel: 4, titulo: 'Repetir con S/s y limpiar pantalla', patron: 'Examen · bloque 3', estilo: 'examen', min: 14,
      enun: 'Cada vuelta limpia la pantalla, muestra el título y cuántas vueltas lleva. Al final pregunta si repetir: <b>S</b> o <b>s</b> vuelve a empezar; cualquier otra tecla sale.',
      vars: [['MSJ_TITULO', 'DB', 'Título'], ['MSJ_VUELTA', 'DB', 'Antes del número de vuelta'], ['MSJ_REPETIR', 'DB', 'Pregunta S/s'], ['MSJ_FIN', 'DB', 'Despedida'], ['VUELTAS', 'DB 0', 'Contador de vueltas (1–9)']],
      etiquetas: ['INICIO_PROGRAMA', 'REPETIR', 'VOLVER', 'FIN_PROGRAMA'], regs: ['AX', 'DX', 'DL', 'AL'],
      plantilla: `.MODEL SMALL
.STACK 100h
.DATA
   MSJ_TITULO  DB '=== CONTADOR DE VUELTAS ===$'
   MSJ_VUELTA  DB 0Dh, 0Ah, 'Vuelta numero: $'
   MSJ_REPETIR DB 0Dh, 0Ah, 'Desea repetir? (S = Si / Otra tecla = Salir): $'
   MSJ_FIN     DB 0Dh, 0Ah, 'Programa finalizado. Hasta luego!$'
   VUELTAS     DB 0
.CODE
START:
   MOV AX, @DATA
   MOV DS, AX

   ; BLOQUE 1: PANTALLA Y CONTADOR
{{B1}}

   ; BLOQUE 2: REPETICION O SALIDA
{{B2}}
END START`,
      bloques: [{
        titulo: 'Pantalla y contador',
        instr: ['INICIO_PROGRAMA: limpia la pantalla (MOV AX, 0003h / INT 10h).', 'Muestra MSJ_TITULO.', 'INC VUELTAS y muestra MSJ_VUELTA.', 'Imprime VUELTAS + 30h con AH = 02h.'],
        sol: `INICIO_PROGRAMA:
   MOV AX, 0003h
   INT 10h

   LEA DX, MSJ_TITULO
   MOV AH, 09h
   INT 21h

   INC VUELTAS
   LEA DX, MSJ_VUELTA
   MOV AH, 09h
   INT 21h

   MOV DL, VUELTAS
   ADD DL, 30h
   MOV AH, 02h
   INT 21h`,
        pistas: ['AX = 0003h pone AH = 00h (función “modo de video”) y AL = 03h (texto 80×25): limpia la pantalla.', 'VUELTAS está en memoria y no se reinicia: por eso cuenta entre vueltas.', 'INC VUELTAS … MOV DL, VUELTAS / ADD DL, 30h / MOV AH, 02h / INT 21h']
      }, {
        titulo: 'Repetición o salida',
        instr: ['REPETIR: muestra MSJ_REPETIR y lee una tecla (AH = 01h).', 'Si es \'S\' o \'s\' salta a VOLVER; si no, JMP FIN_PROGRAMA.', 'VOLVER: JMP INICIO_PROGRAMA.', 'FIN_PROGRAMA: muestra MSJ_FIN y termina con MOV AX, 4C00h / INT 21h.'],
        sol: REPETIR,
        pistas: ['Hay que comparar dos veces: con \'S\' (53h) y con \'s\' (73h).', 'CMP AL, \'S\' / JE VOLVER / CMP AL, \'s\' / JE VOLVER / JMP FIN_PROGRAMA', 'VOLVER solo tiene JMP INICIO_PROGRAMA (salto largo).']
      }],
      pruebas: [{ in: 'sSn' }, { in: 'x' }],
      preguntas: [
        { t: 'd', q: '¿Qué hace MOV AX, 0003h / INT 10h?', a: 'Función 00h de video (AH = 00h) con modo 03h (AL = 03h, texto 80×25 a color): reinicia el modo y <b>limpia la pantalla</b>.' },
        { t: 'd', q: 'Con la entrada s, S, n ¿qué vuelta se ve al final?', a: '<b>3</b> (una por la primera pasada y una por cada S/s).' },
        { t: 'a', q: '¿Por qué el examen usa JE VOLVER y en VOLVER un JMP INICIO_PROGRAMA, en vez de JE INICIO_PROGRAMA directo?', a: 'En el 8086 los saltos condicionales son <b>cortos</b>: solo llegan de −128 a +127 bytes. INICIO_PROGRAMA queda muy lejos, así que se salta a una etiqueta cercana que hace un JMP (salto cercano, sin ese límite dentro del segmento).' }
      ]
    },
    {
      id: 'e19', nivel: 4, titulo: 'Palabra a colores (INT 10h)', patron: 'Lab 8', estilo: 'lab', min: 18,
      enun: 'Lee una palabra (máximo 9 letras) y muéstrala letra por letra, cada una de un color del arreglo <code>colores</code>. Es el Lab 8.',
      vars: [['msjPrompt', 'DB', 'Pide la palabra'], ['salto', 'DB', '13,10,$'], ['buffer', 'DB 10 / DB 0 / DB 10 DUP(0)', 'Búfer de 0Ah'], ['colores', 'DB 0Ch, 0Ah…', '9 atributos de color']],
      etiquetas: ['imprimir_caracteres', 'siguiente', 'fin (en la plantilla)'], regs: ['CX', 'SI', 'DI', 'AL', 'BL', 'BH', 'DL'],
      plantilla: `org 100h

.DATA
msjPrompt db 'Ingrese una palabra (max 9 letras): $'
salto     db 13, 10, '$'
buffer    db 10
          db 0
          db 10 dup(0)
colores   db 0Ch, 0Ah, 0Bh, 0Dh, 0Eh, 09h, 05h, 02h, 03h

.CODE
inicio:
{{B1}}
{{B2}}
fin:
mov ah, 4Ch
int 21h
ret`,
      bloques: [{
        titulo: 'Leer la palabra',
        instr: ['Muestra msjPrompt (mov dx, offset … / mov ah, 9).', 'Lee la palabra con AH = 0Ah en buffer.', 'Muestra salto.', 'CL = buffer[1] (cantidad de letras). Si es 0, salta a fin.', 'CH = 0, SI = 0 (índice de letras) y DI = 0 (índice de colores).'],
        sol: `mov dx, offset msjPrompt
mov ah, 9
int 21h

mov dx, offset buffer
mov ah, 0Ah
int 21h

mov dx, offset salto
mov ah, 9
int 21h

mov cl, buffer[1]
cmp cl, 0
je fin
mov ch, 0
mov si, 0
mov di, 0`,
        pistas: ['buffer[1] es el byte que DOS llena con la cantidad de letras.', 'Si no escribió nada (CL = 0) el LOOP daría 65 536 vueltas: por eso el JE fin.', 'mov cl, buffer[1] / cmp cl, 0 / je fin / mov ch, 0 / mov si, 0 / mov di, 0']
      }, {
        titulo: 'Imprimir a colores',
        instr: ['imprimir_caracteres: PUSH CX.', 'Posición del cursor: AH = 03h, BH = 0, INT 10h (fila en DH, columna en DL).', 'AL = buffer[2 + si], BL = colores[di], BH = 0.', 'Carácter con color: AH = 09h, CX = 1, INT 10h.', 'Avanza el cursor: INC DL; AH = 02h, BH = 0, INT 10h.', 'INC SI e INC DI; CMP DI, 9 / JB siguiente; si no, DI = 0.', 'siguiente: POP CX y LOOP imprimir_caracteres.'],
        sol: `imprimir_caracteres:
push cx

mov ah, 03h
mov bh, 0
int 10h

mov al, buffer[2 + si]
mov bl, colores[di]
mov bh, 0
mov ah, 09h
mov cx, 1
int 10h

inc dl
mov ah, 02h
mov bh, 0
int 10h

inc si
inc di
cmp di, 9
jb siguiente
mov di, 0

siguiente:
pop cx
loop imprimir_caracteres`,
        pistas: ['INT 10h/09h usa CX como “cuántas veces”: guarda el contador del LOOP con PUSH CX.', 'Tres INT 10h por letra: 03h (leer cursor), 09h (escribir con color), 02h (mover cursor).', 'Si DI llega a 9 vuelve a 0 para reciclar los colores.']
      }],
      pruebas: [{ in: 'Buendia\r' }, { in: 'Arquitectura\r', nota: 'más de 9 letras' }, { in: '\r', nota: 'palabra vacía' }],
      preguntas: [
        { t: 'd', q: '¿Por qué hace falta PUSH CX / POP CX dentro del ciclo?', a: 'INT 10h/09h usa CX como cantidad de repeticiones (MOV CX, 1) y la función 03h también devuelve algo en CX: <b>se perdería el contador del LOOP</b>. La pila lo guarda y lo recupera.' },
        { t: 'd', q: '¿Qué color es el atributo 0Ch?', a: 'Nibble alto 0 = fondo negro; nibble bajo C = <b>texto rojo claro</b>.' },
        { t: 'a', q: '¿Por qué INT 10h/09h no avanza sola y hay que mover el cursor?', a: 'La función 09h escribe carácter + atributo en la posición actual pero <b>no mueve el cursor</b> (a diferencia de INT 21h/02h). Por eso se lee la posición (03h), se incrementa la columna y se reposiciona (02h).' }
      ]
    },

    /* ================= NIVEL 5 · PARCIAL ================= */
    {
      id: 'e20', nivel: 5, titulo: 'Parcial: clasificador de caracteres', patron: 'El examen tal cual (75 min)', estilo: 'examen', min: 75,
      enun: 'La evaluación práctica real: completa los 3 bloques de la plantilla. Lee <code>N</code> caracteres, guárdalos por categoría en su búfer, muestra el resumen con contadores de dos cifras y pregunta si repetir.',
      vars: [['N', 'EQU 12', '10 + último dígito de tu carné'], ['MSJ_…', 'DB', 'Mensajes (ya declarados)'], ['BUF_MAYUS, BUF_MINUS, BUF_NUMS, BUF_ESPEC', 'DB 20 DUP(0)', 'Búferes por categoría'], ['CANT_MAYUS, CANT_MINUS, CANT_NUMS, CANT_ESPEC', 'DB 0', 'Contadores (se reinician en el paso 0)']],
      etiquetas: ['CAPTURA', 'ES_NUM', 'ES_MAYUS', 'ES_MINUS', 'ES_ESPEC', 'SIGUIENTE', 'MAY_UNID', 'MAY_LISTAR', 'MAY_CICLO', 'MOSTRAR_MINUS', 'MIN_…', 'MOSTRAR_NUMS', 'NUM_…', 'MOSTRAR_ESPEC', 'ESP_…', 'REPETIR', 'VOLVER', 'FIN_PROGRAMA'], regs: ['CX', 'AL', 'BX', 'SI', 'DL', 'AH'],
      plantilla: `; ==========================================================================
; EVALUACION PRACTICA - ARQUITECTURA DE COMPUTADORAS (75 MINUTOS)
; PLANTILLA CORREGIDA PARA EMU8086
; ==========================================================================

.MODEL SMALL
.STACK 100h

N EQU 12              ; <<< N = 10 + 2 (digito carnet)

.DATA
   ; --- MENSAJES DE LA INTERFAZ ---
   MSJ_TITULO  DB 0Dh, 0Ah, '==================================================', 0Dh, 0Ah
               DB '        CLASIFICADOR DE CARACTERES (8086)        ', 0Dh, 0Ah
               DB '==================================================$'

   MSJ_PEDIR   DB 0Dh, 0Ah, 'Ingrese exactamente 12 caracteres seguidos: $'
   MSJ_RESULT  DB 0Dh, 0Ah, 0Dh, 0Ah, '--- RESUMEN DE CLASIFICACION ---$'

   MSJ_MAYUS   DB 0Dh, 0Ah, 0Dh, 0Ah, '1. MAYUSCULAS [Total: $'
   MSJ_MINUS   DB 0Dh, 0Ah, 0Dh, 0Ah, '2. MINUSCULAS [Total: $'
   MSJ_NUMS    DB 0Dh, 0Ah, 0Dh, 0Ah, '3. NUMEROS    [Total: $'
   MSJ_ESPEC   DB 0Dh, 0Ah, 0Dh, 0Ah, '4. ESPECIALES [Total: $'

   MSJ_LISTA   DB ']: $'
   MSJ_VACIO   DB 'Ninguno$'
   MSJ_REPETIR DB 0Dh, 0Ah, 0Dh, 0Ah, 'Desea repetir el proceso? (S = Si / Otra tecla = Salir): $'
   MSJ_FIN     DB 0Dh, 0Ah, 0Dh, 0Ah, 'Programa finalizado exitosamente. Hasta luego!$'

   ; --- BUFFERS EN MEMORIA (CAPACIDAD HASTA 20 BYTES) ---
   BUF_MAYUS   DB 20 DUP(0)
   BUF_MINUS   DB 20 DUP(0)
   BUF_NUMS    DB 20 DUP(0)
   BUF_ESPEC   DB 20 DUP(0)

   ; --- CONTADORES ---
   CANT_MAYUS  DB 0
   CANT_MINUS  DB 0
   CANT_NUMS   DB 0
   CANT_ESPEC  DB 0

.CODE
START:
   MOV AX, @DATA
   MOV DS, AX

INICIO_PROGRAMA:
   ; --- PASO 0: REINICIAR CONTADORES Y LIMPIAR PANTALLA ---
   MOV CANT_MAYUS, 0
   MOV CANT_MINUS, 0
   MOV CANT_NUMS, 0
   MOV CANT_ESPEC, 0

   MOV AX, 0003h        ; Limpiar pantalla
   INT 10h

   LEA DX, MSJ_TITULO
   MOV AH, 09h
   INT 21h

   LEA DX, MSJ_PEDIR
   MOV AH, 09h
   INT 21h

   ; ======================================================================
   ; BLOQUE 1: CAPTURA Y CLASIFICACION
   ; ======================================================================
{{B1}}

   ; ======================================================================
   ; BLOQUE 2: MOSTRAR RESULTADOS EN PANTALLA
   ; ======================================================================
{{B2}}

   ; ======================================================================
   ; BLOQUE 3: REPETICION O SALIDA DEL PROGRAMA
   ; ======================================================================
{{B3}}
END START`,
      bloques: [{
        titulo: 'Bloque 1 · Captura y clasificación',
        instr: ['Configurar un bucle de exactamente N iteraciones (usar CX).', 'CAPTURA: leer un carácter con INT 21h / AH = 01h.', 'Evaluar el rango ASCII en AL (cascada: \'0\', \'9\', \'A\', \'Z\', \'a\', \'z\') y saltar a ES_NUM, ES_MAYUS, ES_MINUS o ES_ESPEC.', 'Cada categoría: BL = CANT_x, BH = 0, MOV BUF_x[BX], AL, INC CANT_x y JMP SIGUIENTE (ES_ESPEC va última y cae directo).', 'SIGUIENTE: LOOP CAPTURA.'],
        sol: `   MOV CX, N

CAPTURA:
   MOV AH, 01h
   INT 21h

   CMP AL, '0'
   JB ES_ESPEC
   CMP AL, '9'
   JBE ES_NUM
   CMP AL, 'A'
   JB ES_ESPEC
   CMP AL, 'Z'
   JBE ES_MAYUS
   CMP AL, 'a'
   JB ES_ESPEC
   CMP AL, 'z'
   JBE ES_MINUS
   JMP ES_ESPEC

ES_NUM:
   MOV BL, CANT_NUMS
   MOV BH, 0
   MOV BUF_NUMS[BX], AL
   INC CANT_NUMS
   JMP SIGUIENTE

ES_MAYUS:
   MOV BL, CANT_MAYUS
   MOV BH, 0
   MOV BUF_MAYUS[BX], AL
   INC CANT_MAYUS
   JMP SIGUIENTE

ES_MINUS:
   MOV BL, CANT_MINUS
   MOV BH, 0
   MOV BUF_MINUS[BX], AL
   INC CANT_MINUS
   JMP SIGUIENTE

ES_ESPEC:
   MOV BL, CANT_ESPEC
   MOV BH, 0
   MOV BUF_ESPEC[BX], AL
   INC CANT_ESPEC

SIGUIENTE:
   LOOP CAPTURA`,
        pistas: ['El contador de cada categoría sirve también de índice: la posición libre del búfer es BUF_x + CANT_x.', 'BX es el único registro general que puede ir entre corchetes: BL = contador, BH = 0 → BX = contador.', 'ES_NUM: MOV BL, CANT_NUMS / MOV BH, 0 / MOV BUF_NUMS[BX], AL / INC CANT_NUMS / JMP SIGUIENTE']
      }, {
        titulo: 'Bloque 2 · Mostrar resultados',
        instr: ['Mostrar el título del resumen (MSJ_RESULT).', 'Para cada una de las 4 categorías (MAY, MIN, NUM, ESP): 1) imprimir la etiqueta (ej. MSJ_MAYUS).', '2) Convertir el contador a decenas y unidades (DIV entre 10) e imprimirlo (sin 0 a la izquierda: etiqueta x_UNID).', '3) Imprimir el cierre MSJ_LISTA.', '4) Si el contador es 0, imprimir MSJ_VACIO y saltar a la siguiente categoría (MOSTRAR_MINUS, MOSTRAR_NUMS, MOSTRAR_ESPEC, REPETIR).', '5) Si es > 0 (x_LISTAR), recorrer el búfer con SI y CX (x_CICLO) imprimiendo cada carácter seguido de un espacio.'],
        sol: `   LEA DX, MSJ_RESULT
   MOV AH, 09h
   INT 21h

   ; ---------------- 1. MAYUSCULAS ----------------
${mostrar('MSJ_MAYUS', 'CANT_MAYUS', 'BUF_MAYUS', 'MAY', 'MOSTRAR_MINUS')}

   ; ---------------- 2. MINUSCULAS ----------------
${mostrar('MSJ_MINUS', 'CANT_MINUS', 'BUF_MINUS', 'MIN', 'MOSTRAR_NUMS', 'MOSTRAR_MINUS')}

   ; ---------------- 3. NUMEROS ----------------
${mostrar('MSJ_NUMS', 'CANT_NUMS', 'BUF_NUMS', 'NUM', 'MOSTRAR_ESPEC', 'MOSTRAR_NUMS')}

   ; ---------------- 4. ESPECIALES ----------------
${mostrar('MSJ_ESPEC', 'CANT_ESPEC', 'BUF_ESPEC', 'ESP', 'REPETIR', 'MOSTRAR_ESPEC')}`,
        pistas: ['Escribe bien UNA categoría (mayúsculas) y copia el patrón cambiando nombres: es el 80% del bloque.', 'Por categoría: etiqueta → DIV BL (decenas/unidades) → MSJ_LISTA → CMP CANT_x, 0 / JNE x_LISTAR → Ninguno + JMP siguiente → x_LISTAR / x_CICLO.', 'x_CICLO: MOV DL, [SI] / MOV AH, 02h / INT 21h / MOV DL, \' \' / INT 21h / INC SI / LOOP x_CICLO']
      }, {
        titulo: 'Bloque 3 · Repetición o salida',
        instr: ['REPETIR: desplegar MSJ_REPETIR.', 'Leer una tecla con INT 21h / AH = 01h.', 'Si la tecla es \'S\' o \'s\', saltar a INICIO_PROGRAMA (a través de VOLVER).', 'Si es cualquier otra tecla, saltar a FIN_PROGRAMA: mostrar MSJ_FIN y terminar con AX = 4C00h.'],
        sol: REPETIR,
        pistas: ['Dos comparaciones: \'S\' y \'s\'.', 'JE VOLVER (cerca) y en VOLVER: JMP INICIO_PROGRAMA (lejos).', 'FIN_PROGRAMA: LEA DX, MSJ_FIN / MOV AH, 09h / INT 21h / MOV AX, 4C00h / INT 21h']
      }],
      pruebas: [{ in: 'Hola123456789', nota: 'la captura del examen' }, { in: 'ABCDEFGHIJKLn', nota: '12 mayúsculas (dos cifras)' }, { in: 'buendia12345S$#AB!!xyz09 ?n', nota: 'repite una vez' }],
      preguntas: [
        { t: 'd', q: '¿Por qué se usa BX como índice y no CX o DX?', a: 'En el 8086 solo <b>BX, BP, SI y DI</b> pueden ir entre corchetes. CX además es el contador del LOOP.' },
        { t: 'd', q: 'Con la entrada Hola12345678, ¿qué valores quedan en CANT_MAYUS, CANT_MINUS, CANT_NUMS y CANT_ESPEC?', a: '<b>1, 3, 8 y 0</b> (H · o l a · 1…8 · ninguno).' },
        { t: 'd', q: '¿Qué pasa si olvidas el paso 0 (reiniciar contadores) y repites?', a: 'Los contadores siguen desde la vuelta anterior: se suman categorías viejas y los búferes se escriben después de lo anterior.' },
        { t: 'a', q: 'Explica cómo MOV BUF_NUMS[BX], AL guarda cada dígito en la siguiente posición libre.', a: 'BUF_NUMS[BX] es la dirección <b>BUF_NUMS + BX</b>. BX vale el contador actual (BL = CANT_NUMS, BH = 0): con 0 dígitos escribe en BUF_NUMS+0, con 1 en BUF_NUMS+1… Luego INC CANT_NUMS avanza la posición para el siguiente.' },
        { t: 'a', q: '¿Por qué en el bloque 2 se guarda el residuo en BH y no en BL?', a: 'BL tiene el divisor 10 (ya no importa), pero lo que importa es que <b>AH se va a sobrescribir</b> con 02h para imprimir las decenas. BH (parte alta de BX) no lo toca INT 21h/02h, así que sirve para guardar las unidades.' }
      ]
    },
    {
      id: 'e21', nivel: 5, titulo: 'Parcial variante B: pares e impares', patron: 'Variante probable del examen', estilo: 'examen', min: 75,
      enun: 'Misma estructura del examen con otra clasificación: lee <code>N</code> caracteres; los dígitos pares van a <code>BUF_PARES</code>, los impares a <code>BUF_IMPARES</code> y todo lo demás a <code>BUF_OTROS</code>. La paridad se saca con <code>DIV</code> entre 2 (sin AND ni XOR).',
      vars: [['N', 'EQU 10', '10 + último dígito de tu carné'], ['BUF_PARES, BUF_IMPARES, BUF_OTROS', 'DB 20 DUP(0)', 'Búferes por categoría'], ['CANT_PARES, CANT_IMPARES, CANT_OTROS', 'DB 0', 'Contadores']],
      etiquetas: ['CAPTURA', 'ES_IMPAR', 'ES_PAR', 'ES_OTRO', 'SIGUIENTE', 'PAR_UNID', 'PAR_LISTAR', 'PAR_CICLO', 'MOSTRAR_IMPARES', 'IMP_…', 'MOSTRAR_OTROS', 'OTR_…', 'REPETIR', 'VOLVER', 'FIN_PROGRAMA'], regs: ['CX', 'AL', 'DL', 'BL', 'BX', 'SI'],
      plantilla: `; ==========================================================================
; EVALUACION PRACTICA - VARIANTE B (PRACTICA)
; ==========================================================================
.MODEL SMALL
.STACK 100h

N EQU 10              ; <<< N = 10 + 0 (digito carnet)

.DATA
   MSJ_TITULO   DB 0Dh, 0Ah, '=== CLASIFICADOR DE DIGITOS PARES E IMPARES ===$'
   MSJ_PEDIR    DB 0Dh, 0Ah, 'Ingrese exactamente 10 caracteres: $'
   MSJ_RESULT   DB 0Dh, 0Ah, 0Dh, 0Ah, '--- RESUMEN ---$'
   MSJ_PARES    DB 0Dh, 0Ah, '1. PARES   [Total: $'
   MSJ_IMPARES  DB 0Dh, 0Ah, '2. IMPARES [Total: $'
   MSJ_OTROS    DB 0Dh, 0Ah, '3. OTROS   [Total: $'
   MSJ_LISTA    DB ']: $'
   MSJ_VACIO    DB 'Ninguno$'
   MSJ_REPETIR  DB 0Dh, 0Ah, 0Dh, 0Ah, 'Desea repetir? (S = Si / Otra tecla = Salir): $'
   MSJ_FIN      DB 0Dh, 0Ah, 'Programa finalizado.$'

   BUF_PARES    DB 20 DUP(0)
   BUF_IMPARES  DB 20 DUP(0)
   BUF_OTROS    DB 20 DUP(0)

   CANT_PARES   DB 0
   CANT_IMPARES DB 0
   CANT_OTROS   DB 0

.CODE
START:
   MOV AX, @DATA
   MOV DS, AX

INICIO_PROGRAMA:
   MOV CANT_PARES, 0
   MOV CANT_IMPARES, 0
   MOV CANT_OTROS, 0

   MOV AX, 0003h
   INT 10h

   LEA DX, MSJ_TITULO
   MOV AH, 09h
   INT 21h

   LEA DX, MSJ_PEDIR
   MOV AH, 09h
   INT 21h

   ; BLOQUE 1: CAPTURA Y CLASIFICACION
{{B1}}

   ; BLOQUE 2: MOSTRAR RESULTADOS
{{B2}}

   ; BLOQUE 3: REPETIR O SALIR
{{B3}}
END START`,
      bloques: [{
        titulo: 'Bloque 1 · Captura y clasificación',
        instr: ['Bucle de N iteraciones con CX. CAPTURA: leer con AH = 01h.', 'Si AL < \'0\' o AL > \'9\' → ES_OTRO.', 'Guardar el carácter en DL (DIV va a borrar AL). AH = 0, BL = 2, DIV BL. Si AH (residuo) = 0 → ES_PAR.', 'ES_IMPAR (cae directo): BL = CANT_IMPARES, BH = 0, BUF_IMPARES[BX] = DL, INC, JMP SIGUIENTE.', 'ES_PAR: igual con PARES (guardando DL). ES_OTRO: igual con OTROS (guardando AL, que no se tocó).', 'SIGUIENTE: LOOP CAPTURA.'],
        sol: `   MOV CX, N

CAPTURA:
   MOV AH, 01h
   INT 21h

   CMP AL, '0'
   JB ES_OTRO
   CMP AL, '9'
   JA ES_OTRO

   MOV DL, AL
   MOV AH, 0
   MOV BL, 2
   DIV BL
   CMP AH, 0
   JE ES_PAR

ES_IMPAR:
   MOV BL, CANT_IMPARES
   MOV BH, 0
   MOV BUF_IMPARES[BX], DL
   INC CANT_IMPARES
   JMP SIGUIENTE

ES_PAR:
   MOV BL, CANT_PARES
   MOV BH, 0
   MOV BUF_PARES[BX], DL
   INC CANT_PARES
   JMP SIGUIENTE

ES_OTRO:
   MOV BL, CANT_OTROS
   MOV BH, 0
   MOV BUF_OTROS[BX], AL
   INC CANT_OTROS

SIGUIENTE:
   LOOP CAPTURA`,
        pistas: ['No hace falta restar 30h: \'0\' = 48 es par, así que el código ASCII tiene la misma paridad que el dígito.', 'DIV BL deja el cociente en AL (¡pierdes el carácter!) y el residuo en AH: guarda el carácter antes en DL.', 'MOV DL, AL / MOV AH, 0 / MOV BL, 2 / DIV BL / CMP AH, 0 / JE ES_PAR']
      }, {
        titulo: 'Bloque 2 · Mostrar resultados',
        instr: ['Mostrar MSJ_RESULT.', 'Por categoría (PAR, IMP, OTR): etiqueta, contador en decimal con DIV entre 10 (x_UNID), MSJ_LISTA.', 'Si el contador es 0: MSJ_VACIO y saltar a la siguiente (MOSTRAR_IMPARES, MOSTRAR_OTROS, REPETIR).', 'Si no (x_LISTAR / x_CICLO): recorrer el búfer con SI y CX imprimiendo cada carácter y un espacio.'],
        sol: `   LEA DX, MSJ_RESULT
   MOV AH, 09h
   INT 21h

   ; ---- 1. PARES ----
${mostrar('MSJ_PARES', 'CANT_PARES', 'BUF_PARES', 'PAR', 'MOSTRAR_IMPARES')}

   ; ---- 2. IMPARES ----
${mostrar('MSJ_IMPARES', 'CANT_IMPARES', 'BUF_IMPARES', 'IMP', 'MOSTRAR_OTROS', 'MOSTRAR_IMPARES')}

   ; ---- 3. OTROS ----
${mostrar('MSJ_OTROS', 'CANT_OTROS', 'BUF_OTROS', 'OTR', 'REPETIR', 'MOSTRAR_OTROS')}`,
        pistas: ['Es exactamente el bloque 2 del examen con 3 categorías en vez de 4.', 'Los contadores pueden llegar a 10: por eso se usa DIV entre 10 y no solo + 30h.', 'Copia la categoría completa y cambia: MSJ_x, CANT_x, BUF_x, prefijo de etiquetas y a dónde salta si está vacía.']
      }, {
        titulo: 'Bloque 3 · Repetir o salir',
        instr: ['REPETIR: mostrar MSJ_REPETIR y leer una tecla.', '\'S\' o \'s\' → VOLVER (JMP INICIO_PROGRAMA). Otra → FIN_PROGRAMA.', 'FIN_PROGRAMA: MSJ_FIN y MOV AX, 4C00h / INT 21h.'],
        sol: REPETIR,
        pistas: ['Idéntico al bloque 3 del examen.', 'CMP AL, \'S\' / JE VOLVER / CMP AL, \'s\' / JE VOLVER / JMP FIN_PROGRAMA', 'VOLVER: JMP INICIO_PROGRAMA']
      }],
      pruebas: [{ in: '0123456789n', nota: 'cinco pares y cinco impares' }, { in: '2468024680n', nota: 'diez pares (dos cifras)' }, { in: 'ab1c2d3e4fs##########x', nota: 'mezcla y repite' }],
      preguntas: [
        { t: 'd', q: '¿Por qué hay que guardar el carácter en DL antes de DIV BL?', a: 'DIV BL deja el <b>cociente en AL</b>: el carácter original se pierde. DL lo conserva para guardarlo en el búfer.' },
        { t: 'd', q: 'Con \'7\' (37h = 55) ¿qué deja DIV BL (BL = 2)?', a: '<b>AL = 27 (1Bh), AH = 1</b>: residuo 1 → impar.' },
        { t: 'a', q: '¿Por qué no hace falta restar 30h para saber si un dígito es par?', a: 'Porque 30h = 48 es par: sumarle 48 a un número no cambia su paridad. El ASCII de un dígito par es par y el de uno impar es impar.' }
      ]
    }
  ];

  /* ---------- Trazas en papel (tipo Hoja de Actividades) ----------
     ini: registros iniciales (16 bits). mem: {'SSSS:OOOO': [bytes]}. ask: casillas.
     ask: [paso, qué, formato, etiqueta]; paso = nº de instrucción ejecutada (1…n).
     qué: registro ('AX', 'CH'…), 'm:SSSS:OOOO' (byte de memoria) o 'f:CF' (bandera).
     formato: h (hex), d (decimal sin signo), s (decimal con signo), o (octal), b (binario), c (ASCII), f (0/1). */
  const TRAZAS = [
    {
      id: 't1', nivel: 1, titulo: 'Partes altas y bajas', fuente: 'Tabla de registros del profe',
      enun: 'Con los registros de la tabla, ejecuta las 5 instrucciones y llena lo que se pide.',
      ini: { AX: 0x1000, BX: 0x0020, CX: 0x0004, DX: 0x0002, SI: 0x0100, DI: 0x0200, BP: 0, SP: 0xFFFE, CS: 0x0700, SS: 0x3000, ES: 0x5000, DS: 0x8000 },
      code: `MOV CX, AX
ADD CH, 25h
MOV DL, CH
INC DX
SUB AX, DX`,
      ask: [[1, 'CH', 'h', 'CH tras MOV CX, AX'], [1, 'CL', 'h', 'CL tras MOV CX, AX'], [2, 'CX', 'h', 'CX tras ADD CH, 25h'], [3, 'DX', 'h', 'DX tras MOV DL, CH'], [4, 'DX', 'h', 'DX tras INC DX'], [5, 'AX', 'h', 'AX final (hex)'], [5, 'AX', 'd', 'AX final (decimal)']],
      pistas: ['MOV CX, AX copia los 16 bits: CH recibe el byte alto (10h) y CL el bajo (00h).', 'ADD CH, 25h solo toca la mitad alta de CX. MOV DL, CH solo cambia la mitad baja de DX (DH sigue en 00h).', '1000h − 0036h: presta de la columna de la izquierda como en decimal, pero en base 16.']
    },
    {
      id: 't2', nivel: 2, titulo: 'Hoja de Actividades · Parte 2 (1.ª mitad)', fuente: 'Hoja de Actividades – Parte 2',
      enun: 'La secuencia de la hoja con valores consistentes (DS = 3000h, ES = 8000h, SS = A000h). Recuerda: dirección física = segmento con un 0 agregado + desplazamiento.',
      ini: { AX: 0x3000, BX: 0, CX: 0, DX: 0, SI: 0, DI: 0, BP: 0, SP: 0xFFF6, CS: 0x0700, SS: 0xA000, ES: 0x8000, DS: 0x3000 },
      code: `MOV CX, AX
ADD CH, 25h
MOV DI, 1
MOV [DI], CH
INC DI
PUSH CX
MOV DX, 1234H
MOV SI, 12o
SUB AX, DX
MOV ES:[SI], AX`,
      ask: [[1, 'CH', 'h', 'CH tras MOV CX, AX'], [1, 'CL', 'h', 'CL tras MOV CX, AX'], [2, 'CH', 'h', 'CH tras ADD CH, 25h'], [4, 'm:3000:0001', 'h', 'Contenido de 30001'], [4, 'm:3000:0001', 'c', 'Símbolo ASCII de ese dato'], [6, 'SP', 'h', 'SP tras PUSH CX'], [6, 'm:A000:FFF5', 'h', 'Byte en A000:FFF5'], [8, 'SI', 'h', 'SI tras MOV SI, 12o'], [8, 'SI', 'd', 'SI en decimal'], [9, 'AX', 'h', 'AX tras SUB AX, DX'], [9, 'AX', 'd', 'AX en decimal'], [10, 'm:8000:000A', 'h', 'Contenido de 8000A'], [10, 'm:8000:000B', 'h', 'Contenido de 8000B']],
      pistas: ['12o es octal: 1×8 + 2 = 10 = 000Ah.', '3000h = 12288 y 1234h = 4660; 12288 − 4660 = 7628. Pásalo a hex dividiendo entre 16. (Ojo: en la hoja resuelta que circula pusieron 1DBC, que está mal.)', 'Little endian: en 8000A va el byte bajo de AX (AL) y en 8000B el alto (AH). PUSH resta 2 a SP y guarda CX: el byte bajo en SP y el alto en SP+1.']
    },
    {
      id: 't3', nivel: 2, titulo: 'NEG y los seis formatos', fuente: 'Hoja de Actividades – MOV BL,26h / NEG BL',
      enun: 'El cuadro de la hoja: hexadecimal, decimal con y sin signo, ASCII, octal y binario, antes y después de NEG.',
      ini: { AX: 0, BX: 0, CX: 0, DX: 0, SI: 0, DI: 0, BP: 0, SP: 0xFFFE, CS: 0x0700, SS: 0x0700, ES: 0x0700, DS: 0x0700 },
      code: `MOV BL, 26h
NEG BL
MOV BX, 26h
NEG BX`,
      ask: [[1, 'BL', 'd', '26h en decimal'], [1, 'BL', 'c', '26h en ASCII'], [1, 'BL', 'o', '26h en octal'], [1, 'BL', 'b', '26h en binario'], [2, 'BL', 'h', 'BL tras NEG (hex)'], [2, 'BL', 'd', 'BL sin signo'], [2, 'BL', 's', 'BL con signo'], [2, 'BL', 'o', 'BL en octal'], [2, 'BL', 'b', 'BL en binario'], [2, 'f:SF', 'f', '¿Bandera de signo (SF)?'], [2, 'f:CF', 'f', '¿Acarreo (CF)?'], [4, 'BX', 'h', 'BX tras NEG BX'], [4, 'BX', 'd', 'BX sin signo'], [4, 'BX', 's', 'BX con signo']],
      pistas: ['26h = 2×16 + 6 = 38. En octal agrupa el binario de 3 en 3 desde la derecha: 00 100 110.', 'NEG: invierte (0010 0110 → 1101 1001) y suma 1 → 1101 1010 = DAh. Con signo: DAh − 256 = −38.', 'En 16 bits: 0026h → FFDAh. Sin signo: FFDAh = 65498; con signo: 65498 − 65536 = −38.']
    },
    {
      id: 't4', nivel: 3, titulo: 'MUL y DIV', fuente: 'Hoja de Actividades – MUL BL / MUL BX',
      enun: 'Dónde queda cada resultado de MUL y DIV (8 y 16 bits).',
      ini: { AX: 0x3516, BX: 0, CX: 0x550A, DX: 0x1234, SI: 0, DI: 0, BP: 0, SP: 0xFFFE, CS: 0x0700, SS: 0x0700, ES: 0x0700, DS: 0x0700 },
      code: `MOV AX, 205H
MOV BL, 26h
MUL BL
MOV BX, 0026h
MUL BX
MOV AX, 0064h
MOV BL, 7
DIV BL`,
      ask: [[1, 'AH', 'h', 'AH tras MOV AX, 205H'], [1, 'AL', 'h', 'AL tras MOV AX, 205H'], [3, 'AX', 'h', 'AX tras MUL BL'], [3, 'AX', 'd', 'AX en decimal'], [3, 'AH', 'h', '¿AH quedó en…?'], [5, 'AX', 'h', 'AX tras MUL BX'], [5, 'DX', 'h', 'DX tras MUL BX'], [8, 'AL', 'h', 'AL tras DIV BL (cociente)'], [8, 'AH', 'h', 'AH tras DIV BL (residuo)']],
      pistas: ['MUL BL multiplica AL (no AX) por BL y deja el resultado completo en AX: 05h × 26h.', '5 × 38 = 190 = 00BEh. MUL BX multiplica AX × BX y deja DX:AX; si el resultado cabe en 16 bits, DX = 0000h.', 'DIV BL divide AX entre BL: 100 ÷ 7 = 14 residuo 2 → AL = 0Eh, AH = 02h. Ojo: DX ya había cambiado con MUL BX.']
    },
    {
      id: 't5', nivel: 3, titulo: 'La pila: PUSH y POP', fuente: 'Hoja de Actividades – PUSH/POP',
      enun: 'Sigue SP y el contenido de la pila. La pila crece hacia abajo (SP disminuye).',
      ini: { AX: 0x3516, BX: 0x00BE, CX: 0x550A, DX: 0, SI: 0, DI: 0, BP: 0, SP: 0xFFF4, CS: 0x0700, SS: 0xA000, ES: 0x8000, DS: 0x3000 },
      code: `PUSH AX
PUSH BX
MOV AX, 205H
POP CX
POP BX`,
      ask: [[1, 'SP', 'h', 'SP tras PUSH AX'], [2, 'SP', 'h', 'SP tras PUSH BX'], [2, 'm:A000:FFF0', 'h', 'Byte en A000:FFF0'], [2, 'm:A000:FFF1', 'h', 'Byte en A000:FFF1'], [4, 'CX', 'h', 'CX tras POP CX'], [5, 'BX', 'h', 'BX tras POP BX'], [5, 'SP', 'h', 'SP final'], [5, 'AX', 'h', 'AX final']],
      pistas: ['PUSH: primero SP = SP − 2, luego guarda el registro en SS:SP (byte bajo primero).', 'POP saca lo último que entró (LIFO): el primer POP recibe lo que tenía BX.', 'Al final SP vuelve a FFF4h. Los datos quedaron intercambiados: CX = antiguo BX y BX = antiguo AX.']
    },
    {
      id: 't6', nivel: 3, titulo: 'Copia invertida CS → DS', fuente: 'Hoja de Actividades – Parte 3',
      enun: 'ARREGLO1 (11h, 22h, 33h, 44h, 55h) está en el segmento de código, en CS:0120h. Se copia hacia DS (3000h) empezando en 3000:000A y retrocediendo.',
      ini: { AX: 0, BX: 0, CX: 0, DX: 0, SI: 0, DI: 0, BP: 0, SP: 0xFFFE, CS: 0x0700, SS: 0x0700, ES: 0x8000, DS: 0x3000 },
      mem: { '0700:0120': [0x11, 0x22, 0x33, 0x44, 0x55] },
      code: `MOV DI, 0120h
MOV SI, 000Ah
MOV BL, CS:[DI]
MOV [SI], BL
INC DI
DEC SI
MOV BL, CS:[DI]
MOV [SI], BL
INC DI
DEC SI
MOV BL, CS:[DI]
MOV [SI], BL
INC DI
DEC SI`,
      ask: [[3, 'BL', 'h', 'BL tras la 1.ª lectura'], [6, 'SI', 'h', 'SI tras la 1.ª vuelta'], [6, 'DI', 'h', 'DI tras la 1.ª vuelta'], [6, 'm:3000:000A', 'h', 'Contenido de 3000A'], [10, 'm:3000:0009', 'h', 'Contenido de 30009'], [14, 'm:3000:0008', 'h', 'Contenido de 30008'], [14, 'SI', 'h', 'SI final'], [14, 'DI', 'h', 'DI final'], [14, 'BL', 'h', 'BL final']],
      pistas: ['CS:[DI] lee del segmento de código: 07000h + 0120h = 07120h, donde está 11h.', '[SI] sin prefijo usa DS: 30000h + 000Ah = 3000Ah.', 'Cada vuelta: DI avanza 1 (siguiente dato) y SI retrocede 1 (se escribe al revés).']
    },
    {
      id: 't7', nivel: 2, titulo: 'Banderas y saltos', fuente: 'Ventana FLAGS de EMU8086',
      enun: 'Qué banderas prende cada operación y qué salto se tomaría.',
      ini: { AX: 0, BX: 0, CX: 0, DX: 0, SI: 0, DI: 0, BP: 0, SP: 0xFFFE, CS: 0x0700, SS: 0x0700, ES: 0x0700, DS: 0x0700 },
      code: `MOV AL, 7Fh
ADD AL, 1
MOV BL, 0FFh
ADD BL, 1
MOV CL, 30h
CMP CL, '9'`,
      ask: [[2, 'AL', 'h', 'AL tras ADD AL, 1'], [2, 'f:SF', 'f', 'SF'], [2, 'f:OF', 'f', 'OF (desbordamiento con signo)'], [2, 'f:CF', 'f', 'CF'], [4, 'BL', 'h', 'BL tras ADD BL, 1'], [4, 'f:ZF', 'f', 'ZF'], [4, 'f:CF', 'f', 'CF'], [6, 'f:CF', 'f', 'CF tras CMP CL, \'9\''], [6, 'f:ZF', 'f', 'ZF tras CMP']],
      pistas: ['7Fh + 1 = 80h: con signo pasó de +127 a −128 (OF = 1); sin signo no se pasó de FFh (CF = 0).', 'FFh + 1 = 100h: no cabe en 8 bits → queda 00h (ZF = 1) y sobra un acarreo (CF = 1).', 'CMP CL, \'9\' calcula 30h − 39h: como 30h < 39h hay préstamo → CF = 1 (JB saltaría). No son iguales → ZF = 0.']
    }
  ];

  /* ---------- Direccionamiento con la tabla del profe ---------- */
  const TABLA_PROFE = { RAX: 0x1000, RBX: 0x0020, RCX: 0x0004, RDX: 0x0002, RSI: 0x0100, RDI: 0x0200, R8: 0x0050, RIP: 0x4000, CS: 0x0700, SS: 0x3000, ES: 0x5000, DS: 0x8000 };
  const DIRS = [
    { ins: 'MOV AX, BX', modo: 'Registro' },
    { ins: 'MOV CH, 3AH', modo: 'Inmediato' },
    { ins: 'MOV [1234H], AX', modo: 'Directo' },
    { ins: 'MOV [BX], CL', modo: 'Indirecto por registro' },
    { ins: 'MOV [BX+SI], DX', modo: 'Base más índice' },
    { ins: 'MOV CL, [BX+4]', modo: 'Relativo a registro' },
    { ins: 'MOV ARRAY[BX+SI], DX', modo: 'Base relativa más índice', nota: 'ARRAY = 1000H' },
    { ins: 'MOV [EBX+2*ESI], AX', modo: 'Índice escalado' },
    { ins: 'MOV AL, ES:[DI]', modo: 'Indirecto por registro', nota: 'con prefijo de segmento' },
    { ins: 'MOV DX, [BP+DI]', modo: 'Base más índice', nota: 'BP = 0010H' },
    { ins: 'MOV [DI+10H], AL', modo: 'Relativo a registro' },
    { ins: 'MOV AL, [BX+DI+2]', modo: 'Base relativa más índice' },
    { ins: 'MOV AX, [SI-4]', modo: 'Relativo a registro' },
    { ins: 'MOV BL, ARRAY[DI]', modo: 'Relativo a registro', nota: 'ARRAY = 0500H' },
    { ins: 'Siguiente instrucción (CS:IP)', modo: 'Código', cs: true }
  ];

  /* ---------- Preguntas directas ---------- */
  const QUIZ = [
    ['Registros', '¿Qué registro usa LOOP como contador?', ['AX', 'BX', 'CX', 'DX'], 2, 'LOOP = CX − 1 y salta si CX ≠ 0.'],
    ['Registros', 'Si AX = 1DCCh, ¿cuánto vale AH?', ['1Dh', 'CCh', 'DCh', '1Ch'], 0, 'AH es el byte alto (los dos primeros dígitos hex).'],
    ['Registros', '¿Qué registro tiene la dirección de la siguiente instrucción (la línea amarilla de EMU8086)?', ['SP', 'IP', 'BP', 'SI'], 1, 'IP (Instruction Pointer), siempre junto con CS.'],
    ['Registros', '¿Cuál NO puede ir entre corchetes en el 8086?', ['BX', 'SI', 'CX', 'BP'], 2, 'Solo BX, BP, SI y DI sirven para direccionar.'],
    ['Registros', 'En la tabla del profe RAX = 0000 0000 0000 1000. ¿Cuánto vale AL?', ['10h', '00h', '1000h', '01h'], 1, 'AX = 1000h → AH = 10h, AL = 00h.'],
    ['Registros', '¿Cuántos bits tiene EAX?', ['8', '16', '32', '64'], 2, 'AX = 16, EAX = 32, RAX = 64.'],
    ['Registros', '¿Qué segmento se usa por defecto con [BP+SI]?', ['DS', 'SS', 'ES', 'CS'], 1, 'Si la dirección usa BP, el segmento por defecto es SS (la pila).'],
    ['Memoria', 'DS = 8000h y SI = 000Ah. ¿Dirección física de [SI]?', ['8000Ah', '800A0h', '0800Ah', '800Ah'], 0, '80000h + 000Ah = 8000Ah.'],
    ['Memoria', 'CS = 0700h, IP = 4000h. ¿Dirección física de la siguiente instrucción?', ['4700h', '0B000h', '47000h', '07400h'], 1, '07000h + 4000h = 0B000h.'],
    ['Memoria', 'AX = 1DCCh y MOV [SI], AX con DS:SI = 3000:000A. ¿Qué byte queda en 3000Ah?', ['1Dh', 'CCh', '1DCCh', '00h'], 1, 'Little endian: el byte bajo (AL = CCh) va a la dirección indicada; 1Dh va a 3000Bh.'],
    ['Memoria', '¿Cuánto resta PUSH a SP?', ['1', '2', '4', 'Nada'], 1, 'La pila del 8086 trabaja con palabras de 16 bits.'],
    ['Memoria', 'En un programa org 100h (.COM), ¿cómo son CS, DS, ES y SS?', ['Todos distintos', 'Todos iguales', 'Solo DS = ES', 'DS = 0'], 1, 'Un .COM vive en un solo segmento de 64 KB (en EMU8086, 0700h).'],
    ['Números', '26h en decimal es…', ['26', '38', '32', '46'], 1, '2 × 16 + 6 = 38.'],
    ['Números', 'NEG BL con BL = 26h deja…', ['D9h', 'DAh', '26h', '00h'], 1, 'Invertir: D9h; sumar 1: DAh.'],
    ['Números', 'FFDAh interpretado con signo (16 bits) es…', ['65498', '−38', '−65498', '38'], 1, '65498 − 65536 = −38.'],
    ['Números', 'MOV SI, 12o carga…', ['12', '000Ah', '0012h', '0Ch'], 1, 'La o final es octal: 1 × 8 + 2 = 10 = 0Ah.'],
    ['Números', 'El carácter \'7\' en ASCII es…', ['07h', '37h', '70h', '55h'], 1, 'Dígitos: 30h a 39h.'],
    ['Instrucciones', '¿Cuál es válida?', ['MOV DS, 3000h', 'MOV [SI], [DI]', 'MOV AX, @DATA', 'MOV CS, AX'], 2, 'A DS se llega por AX; memoria–memoria no existe; CS no se cambia con MOV.'],
    ['Instrucciones', 'MUL BL con AL = 05h y BL = 26h deja…', ['AL = BEh y AH = 00h', 'AX = 0BE0h', 'BL = BEh', 'DX = 00BEh'], 0, '5 × 38 = 190 = 00BEh en AX.'],
    ['Instrucciones', '¿Por qué MOV AH, 0 antes de DIV BL?', ['DIV usa AX completo como dividendo', 'Para limpiar la pantalla', 'Por la función 02h', 'No hace falta'], 0, 'Con AH sucio el dividendo es otro y puede desbordar.'],
    ['Instrucciones', 'Después de DIV BL, el residuo queda en…', ['AL', 'AH', 'BL', 'DX'], 1, 'Cociente en AL, residuo en AH.'],
    ['Instrucciones', 'SHR AL, 1 con AL = 0Eh deja…', ['1Ch', '07h', '0Fh', '06h'], 1, '14 ÷ 2 = 7.'],
    ['Instrucciones', '¿Qué hace CMP AL, \'9\'?', ['Copia \'9\' en AL', 'Resta sin guardar y ajusta banderas', 'Salta si son iguales', 'Guarda la diferencia en AL'], 1, 'CMP = SUB que solo deja las banderas.'],
    ['Saltos', 'Tras CMP AL, \'0\', ¿qué salto va a “es menor” (sin signo)?', ['JA', 'JB', 'JL', 'JE'], 1, 'Below = menor sin signo.'],
    ['Saltos', 'JBE salta cuando…', ['CF = 1 o ZF = 1', 'CF = 0 y ZF = 0', 'ZF = 1', 'SF ≠ OF'], 0, 'Menor (CF) o igual (ZF).'],
    ['Saltos', '¿Por qué el examen hace JE VOLVER y en VOLVER un JMP INICIO_PROGRAMA?', ['Por estilo', 'Los saltos condicionales del 8086 son cortos (±127 bytes)', 'JE no existe', 'Para limpiar la pantalla'], 1, 'JMP no tiene ese límite dentro del segmento.'],
    ['Interrupciones', 'INT 21h con AH = 09h imprime…', ['Un carácter de DL', 'Una cadena en DS:DX terminada en $', 'Un número', 'Lo que hay en AL'], 1, 'Hasta encontrar el 24h ($).'],
    ['Interrupciones', 'INT 21h con AH = 01h…', ['Imprime AL', 'Lee una tecla con eco y la deja en AL', 'Termina', 'Lee una cadena'], 1, 'Con eco: la tecla aparece en pantalla.'],
    ['Interrupciones', 'En el búfer de INT 21h/0Ah, buffer[1] contiene…', ['El máximo', 'La cantidad de caracteres leídos', 'El primer carácter', 'Un $'], 1, '[0] máximo, [1] leídos, [2…] caracteres.'],
    ['Interrupciones', 'MOV AX, 0003h / INT 10h sirve para…', ['Terminar', 'Limpiar la pantalla (modo texto 80×25)', 'Leer una tecla', 'Mover el cursor'], 1, 'AH = 00h (modo de video), AL = 03h.'],
    ['Interrupciones', 'INT 10h con AH = 09h toma el color de…', ['BH', 'BL', 'CL', 'DL'], 1, 'BL = atributo, BH = página, CX = repeticiones, AL = carácter.'],
    ['Interrupciones', '¿Qué función de INT 21h termina el programa?', ['01h', '09h', '4Ch', '0Ah'], 2, 'MOV AH, 4Ch (o MOV AX, 4C00h) / INT 21h.']
  ];

  /* ---------- Preguntas abiertas ---------- */
  const ABIERTAS = [
    { q: 'Explica la diferencia entre MOV DX, OFFSET MSJ, LEA DX, MSJ y MOV DX, MSJ.', a: '<code>OFFSET MSJ</code> es la <b>dirección</b> de MSJ (un número que calcula el ensamblador); <code>LEA DX, MSJ</code> calcula esa misma dirección en tiempo de ejecución: las dos dejan DX apuntando al mensaje. <code>MOV DX, MSJ</code> intenta leer el <b>contenido</b> de la memoria en MSJ (y como MSJ es DB y DX de 16 bits, da error de tamaño).', puntos: ['dirección vs contenido', 'OFFSET y LEA son equivalentes para variables', 'error de tamaño DB/16 bits'] },
    { q: '¿Cómo se calcula una dirección física en el 8086 y por qué se usa segmento:desplazamiento?', a: 'El 8086 tiene registros de 16 bits (máximo 64 KB) pero un bus de direcciones de <b>20 bits</b> (1 MB). Se combina un segmento y un desplazamiento: <b>física = segmento × 10h + desplazamiento</b> (agregarle un 0 al segmento y sumar). Ej.: DS = 3000h, DI = 0001h → 30001h.', puntos: ['registros de 16 bits vs 20 bits de dirección', 'segmento × 10h (un cero a la derecha)', 'ejemplo numérico'] },
    { q: 'Explica little endian con MOV ES:[SI], AX (AX = 1DCCh, ES:SI = 8000:000A).', a: 'Se guardan 2 bytes: el <b>menos significativo (AL = CCh) en la dirección indicada</b>, 8000Ah, y el más significativo (AH = 1Dh) en la siguiente, 8000Bh. En el mapa de memoria se lee “CC 1D”, al revés de como se escribe el número.', puntos: ['byte bajo en la dirección menor', 'dirección física 8000A/8000B', 'se lee al revés en el mapa'] },
    { q: '¿Qué pasa en la pila con PUSH CX y luego POP AX?', a: 'PUSH CX: SP baja 2 y CX se guarda en SS:SP (byte bajo en SP, alto en SP+1). POP AX: se lee la palabra en SS:SP hacia AX y SP sube 2. Resultado: <b>AX = valor que tenía CX</b> y SP queda como al inicio. La pila es LIFO.', puntos: ['SP − 2 / SP + 2', 'SS:SP', 'LIFO', 'AX recibe el valor de CX'] },
    { q: 'Describe cómo imprimir un número de dos cifras guardado en un byte (como el contador del examen).', a: 'AL = número, AH = 0, BL = 10, <b>DIV BL</b> → AL = decenas, AH = unidades. Guardar AH en BH (porque AH se usará para la función). Si AL = 0 saltar las decenas. Si no, DL = AL + 30h, AH = 02h, INT 21h. Luego DL = BH + 30h, AH = 02h, INT 21h.', puntos: ['DIV entre 10', 'guardar el residuo antes de MOV AH, 02h', '+30h a cada cifra', 'omitir el 0 a la izquierda'] },
    { q: '¿Por qué se resta 30h al leer un dígito y se suma 30h al imprimirlo?', a: 'El teclado y la pantalla trabajan con <b>códigos ASCII</b>: el dígito “0” es 30h, “1” es 31h… Para operar con el valor real se resta 30h (“7” = 37h → 07h); para mostrar un valor 0–9 se le suma 30h.', puntos: ['ASCII de los dígitos 30h–39h', 'restar para calcular', 'sumar para mostrar'] },
    { q: '¿Qué es el complemento a 2 y cómo se interpreta DAh con y sin signo?', a: 'Es la forma de representar negativos: invertir los bits y sumar 1 (lo que hace NEG). DAh = 1101 1010. <b>Sin signo</b>: 218. <b>Con signo</b>: el bit 7 es 1, así que es negativo: 218 − 256 = −38 (o complemento a 2 de DAh = 26h = 38 → −38).', puntos: ['invertir y sumar 1', 'bit más significativo = signo', 'DAh = 218 sin signo, −38 con signo'] },
    { q: '¿Qué función realiza el código de la Parte 3 de la hoja (MOV BL, CS:[DI] / MOV [SI], BL / INC DI / DEC SI)?', a: 'Copia los bytes de ARREGLO1, que están en el <b>segmento de código</b> (CS:DI), hacia el <b>segmento de datos</b> (DS:SI), <b>en orden inverso</b>: DI avanza por el origen y SI retrocede por el destino. BL es el puente porque no hay MOV memoria–memoria.', puntos: ['origen CS, destino DS', 'orden inverso', 'BL como intermediario'] },
    { q: 'Diferencia entre un programa org 100h (.COM) y uno .MODEL SMALL (.EXE).', a: '<b>.COM</b>: todo (código, datos y pila) en un solo segmento; CS = DS = ES = SS; empieza en el desplazamiento 100h; no hace falta inicializar DS; termina con RET o 4Ch. <b>.EXE</b>: segmentos separados (.STACK, .DATA, .CODE); al arrancar DS apunta al PSP, por eso <code>MOV AX, @DATA / MOV DS, AX</code>; termina con <code>MOV AX, 4C00h / INT 21h</code> y <code>END START</code>.', puntos: ['un segmento vs varios', 'org 100h', 'inicializar DS con @DATA', 'forma de terminar'] },
    { q: '¿Por qué el ciclo de colores del Lab 8 guarda CX en la pila?', a: 'Porque dentro del ciclo se usa <b>MOV CX, 1</b> para INT 10h/09h (cuántas veces escribir el carácter) y la función 03h también devuelve datos en CX. Sin PUSH CX / POP CX se perdería el contador del LOOP.', puntos: ['LOOP depende de CX', 'INT 10h/09h usa CX', 'PUSH/POP lo preserva'] },
    { q: 'Explica qué banderas cambian con CMP y cómo deciden JB y JA.', a: 'CMP hace destino − fuente sin guardar el resultado y actualiza <b>CF, ZF, SF, OF, PF, AF</b>. Sin signo: si destino &lt; fuente hay préstamo → CF = 1 → <b>JB</b> salta. Si son iguales ZF = 1. <b>JA</b> salta si CF = 0 y ZF = 0 (estrictamente mayor).', puntos: ['CMP = resta sin guardar', 'CF para menor sin signo', 'ZF para igual', 'JA = CF 0 y ZF 0'] },
    { q: '¿Qué diferencia hay entre INT 21h/02h e INT 10h/09h para mostrar un carácter?', a: '<b>21h/02h</b> (DOS): imprime DL como teletipo, avanza el cursor, interpreta 13 y 10, color por defecto. <b>10h/09h</b> (BIOS): escribe AL con el color de BL, CX veces, en la posición del cursor, pero <b>no mueve el cursor</b>.', puntos: ['DOS vs BIOS', 'color en BL', 'no avanza el cursor'] },
    { q: '¿Qué es un búfer y cómo lo usa el examen para guardar cada categoría (MOV BUF_x[BX], AL)?', a: 'Un búfer es un bloque de bytes reservado (<code>DB 20 DUP(0)</code>). El examen usa el <b>contador de la categoría como índice</b>: BX = CANT_x, así que el carácter se escribe en BUF_x + CANT_x (la siguiente casilla libre) y luego INC CANT_x.', puntos: ['DB n DUP(0)', 'índice = contador', 'BX porque puede ir entre corchetes'] },
    { q: '¿Por qué MUL y DIV no aceptan un número directo y qué registros usan de forma implícita?', a: 'En el 8086 MUL/DIV solo tienen un operando (registro o memoria); el otro es implícito. <b>8 bits</b>: MUL → AX = AL × op; DIV → AX ÷ op, cociente en AL y residuo en AH. <b>16 bits</b>: MUL → DX:AX = AX × op; DIV → DX:AX ÷ op, cociente en AX y residuo en DX. Por eso se carga el número en un registro (MOV BL, 10).', puntos: ['un solo operando', 'AL/AX implícitos', 'resultado en AX o DX:AX', 'cociente/residuo'] }
  ];

  const API = { BANCO, TRAZAS, TABLA_PROFE, DIRS, QUIZ, ABIERTAS };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.ARQ = API;
})(typeof window !== 'undefined' ? window : globalThis);
