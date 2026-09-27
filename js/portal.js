/* ===== Portal: lista de cursos y exámenes ===== */
(function () {
  const cursos = window.CURSOS || [];
  const lista = document.getElementById('cursos'), buscar = document.getElementById('buscar');
  const get = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // Enlaces antiguos (/#c14) venían de cuando la guía de Redes I · Parcial II era la raíz.
  if (/^#(c\d+|inicio|formulario|repaso|repaso-resuelto|quiz|ej-resueltos|ej-propuestos|lab)$/.test(location.hash)) {
    location.replace('redes-1/parcial-2/index.html' + location.hash);
    return;
  }

  function tarjeta(ex) {
    const cab = `<span class="tag">${esc(ex.etiqueta || '')}</span><h3>${esc(ex.titulo)}</h3><p>${esc(ex.descripcion || '')}</p>`;
    if (ex.proximamente) return `<div class="card tile exam soon" aria-disabled="true">${cab}<div class="foot">Próximamente</div></div>`;
    const p = get('progreso:' + ex.id);
    const pct = p && p.total ? Math.round(100 * p.done / p.total) : 0;
    const txt = p && p.total ? `${p.done} de ${p.total} repasados` : 'Sin empezar';
    return `<a class="card tile exam" href="${esc(ex.id)}/index.html">${cab}
      <div class="foot"><span>${txt}</span><span class="bar" role="progressbar" aria-label="Progreso" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></span><span class="go">Abrir →</span></div></a>`;
  }

  function render(q) {
    q = (q || '').trim().toLowerCase();
    const html = cursos.map(c => {
      const exs = c.examenes.filter(ex => !q || [c.nombre, ex.titulo, ex.etiqueta, ex.descripcion].join(' ').toLowerCase().includes(q));
      if (!exs.length) return '';
      return `<section class="course" id="${esc(c.id)}"><div class="course-head"><h2>${esc(c.nombre)}</h2><span class="muted">${esc(c.detalle || '')}</span></div>
        <div class="grid g3">${exs.map(tarjeta).join('')}</div></section>`;
    }).join('');
    lista.innerHTML = html || `<p class="empty">No hay exámenes que coincidan con “${esc(q)}”.</p>`;
  }

  buscar.addEventListener('input', () => render(buscar.value));
  // Al volver con el botón Atrás, refrescar el progreso.
  addEventListener('pageshow', () => render(buscar.value));
  render();
})();
