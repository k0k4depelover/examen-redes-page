/* ===== Catálogo de exámenes =====
   Para agregar un examen:
   1. Copia una carpeta existente (p. ej. redes-1/parcial-2/) a <curso>/<examen>/.
   2. En su <body> cambia data-exam="<curso>/<examen>" y data-store="<clave-única>".
   3. Agrégalo aquí con el mismo id y quita "proximamente".
   Los exámenes con proximamente: true se muestran como tarjeta deshabilitada. */
window.CURSOS = [
  {
    id: 'redes-1',
    nombre: 'Redes de Computadoras I',
    detalle: 'Universidad Mariano Gálvez · 2026',
    examenes: [
      {
        id: 'redes-1/parcial-1',
        titulo: 'Parcial I',
        etiqueta: 'CLASES 1–7',
        descripcion: 'Guía del primer parcial.',
        proximamente: true
      },
      {
        id: 'redes-1/parcial-2',
        titulo: 'Parcial II',
        etiqueta: 'CLASES 8–17',
        descripcion: 'TCP/IP y OSI, encapsulamiento, control de errores, Hamming, códigos convolucionales, Trellis y Viterbi. Incluye repaso resuelto, cuestionario, laboratorio y pizarra.'
      },
      {
        id: 'redes-1/final',
        titulo: 'Examen final',
        etiqueta: 'TODO EL CURSO',
        descripcion: 'Repaso integral del curso.',
        proximamente: true
      }
    ]
  },

    {
    id: 'analisis-2',
    nombre: 'Analisis de Sistemas II',
    detalle: 'Universidad Mariano Gálvez · 2026',
    examenes: [
      {
        id: 'analisis-2/parcial-1',
        titulo: 'Parcial I',
        etiqueta: 'CLASES 1–7',
        descripcion: 'Guía del primer parcial.',
        proximamente: true
      },
      {
        id: 'analisis-2/parcial-2',
        titulo: 'Parcial II',
        etiqueta: 'ERP · MVC · COMPONENTES',
        descripcion: 'ERP Terminus en capas: MVC con DLL, ODBC, el prototipo línea por línea, Seguridad, Navegador, Consultas y Reporteador. Incluye escenarios de examen, cuestionario, juego asociativo, diagramas para dibujar y reto contrarreloj.'
      },
      {
        id: 'analisis-2/final',
        titulo: 'Examen final',
        etiqueta: 'TODO EL CURSO',
        descripcion: 'Repaso integral del curso.',
        proximamente: true
      }
    ]
  }
];
