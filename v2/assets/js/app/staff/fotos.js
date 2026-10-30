// Pestaña "Fotos" de la ficha: fotos clínicas agrupadas en secciones.
//
// Modo ver: secciones con su título y miniaturas; al tocar una foto se abre grande (visor).
// Modo editar: agregar, renombrar, ordenar y borrar secciones; subir fotos arrastrándolas desde la PC
// o con "Buscar fotos"; mover fotos entre secciones (arrastrando o con el botón Mover) y borrarlas.
// Cada cambio se guarda en el momento.
import { h, vaciar } from '../../lib/dom.js';
import { aviso, confirmar, hoja, mensajeError } from '../../lib/ui.js';
import { fechaCorta } from '../../lib/dates.js';
import { ICONOS } from '../iconos.js';

const SUBIDAS_A_LA_VEZ = 2;
const TIPO_FOTO = 'application/x-smiles-foto';
const porOrden = (a, b) => a.orden - b.orden || a.creado_en.localeCompare(b.creado_en);
const icono = (nombre) => h('span.icono-btn', { html: ICONOS[nombre] });
const cantidad = (n) => `${n} ${n === 1 ? 'foto' : 'fotos'}`;

export async function vistaFotos(ctx, p) {
  const { api } = ctx;
  const datos = await api.fotosDePaciente(p.id);
  let { secciones, fotos } = datos;
  let editando = false;
  const pendientes = []; // fotos subiéndose: { clave, seccion_id, nombre }
  const raiz = h('div.fotos');

  // Las miniaturas se piden recién cuando están por verse
  const observador = new IntersectionObserver((entradas) => {
    for (const e of entradas) {
      if (!e.isIntersecting) continue;
      observador.unobserve(e.target);
      api.urlFoto(e.target.dataset.id, { mini: true })
        .then((url) => { e.target.src = url; })
        .catch(() => e.target.closest('.foto-mini')?.classList.add('foto-error'));
    }
  }, { rootMargin: '300px' });

  const avisarSalida = (e) => { if (pendientes.length) { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('beforeunload', avisarSalida);
  window.addEventListener('hashchange', () => {
    observador.disconnect();
    window.removeEventListener('beforeunload', avisarSalida);
  }, { once: true });

  const fotosDe = (sid) => fotos.filter((f) => (f.seccion_id || null) === sid).sort(porOrden);
  const grupos = () => {
    secciones.sort(porOrden);
    const lista = secciones.map((s) => ({ seccion: s, fotos: fotosDe(s.id) }));
    const sueltas = fotosDe(null);
    if (sueltas.length || (editando && pendientes.some((x) => !x.seccion_id))) lista.push({ seccion: null, fotos: sueltas });
    return lista;
  };
  const recargar = async () => {
    ({ secciones, fotos } = await api.fotosDePaciente(p.id));
    dibujar();
  };
  const falla = (e) => {
    aviso(mensajeError(e), 'error');
    recargar().catch(() => {});
  };

  // ---------- Dibujo ----------
  function dibujar() {
    vaciar(raiz, editando ? modoEditar() : modoVer());
  }

  function imagenMini(f) {
    const img = h('img', { alt: '', 'data-id': f.id, draggable: false, width: 400, height: Math.round(400 * (f.alto || 3) / (f.ancho || 4)) });
    observador.observe(img);
    return img;
  }

  function modoVer() {
    const total = fotos.length;
    const editar = h('button.btn.btn-primario', { type: 'button', onclick: () => { editando = true; dibujar(); } },
      icono('foto'), total || secciones.length ? 'Editar' : 'Agregar fotos');
    const cabecera = h('div.panel-cabecera.fotos-cabecera',
      h('div', h('h2', 'Fotos'), h('p.texto-suave.nota-chica', total ? `${cantidad(total)} en ${secciones.length} ${secciones.length === 1 ? 'sección' : 'secciones'}` : 'Fotos clínicas del paciente, agrupadas por consulta.')),
      editar);
    if (!total && !secciones.length) {
      editar.onclick = async () => {
        editando = true;
        await agregarSeccion();
      };
      return h('section.panel', cabecera,
        h('div.vacio-turno', h('span.vacio-icono', { html: ICONOS.foto }), h('p', 'Todavía no hay fotos de este paciente.')));
    }
    const visibles = grupos();
    const enOrden = visibles.flatMap((g) => g.fotos.map((f) => ({ foto: f, titulo: g.seccion?.titulo || 'Sin sección' })));
    return h('div',
      h('section.panel.panel-fotos-cabecera', cabecera),
      visibles.map((g) => h('section.panel.seccion-fotos',
        h('div.seccion-fotos-titulo', h('h3', g.seccion?.titulo || 'Sin sección'), h('span.texto-suave.nota-chica', g.fotos.length ? cantidad(g.fotos.length) : 'Sin fotos')),
        g.fotos.length
          ? h('div.grilla-fotos', g.fotos.map((f) => h('button.foto-mini', {
            type: 'button',
            'aria-label': `Ver foto ${enOrden.findIndex((x) => x.foto === f) + 1} de ${enOrden.length}`,
            onclick: () => abrirVisor(api, enOrden, enOrden.findIndex((x) => x.foto === f)),
          }, imagenMini(f))))
          : null)));
  }

  function modoEditar() {
    const listo = h('button.btn.btn-primario', {
      type: 'button',
      disabled: pendientes.length > 0,
      onclick: () => { editando = false; dibujar(); },
    }, pendientes.length ? 'Subiendo…' : 'Listo');
    const agregar = h('button.btn.btn-secundario', { type: 'button', onclick: () => agregarSeccion() }, icono('mas'), 'Agregar sección');
    const lista = grupos();
    return h('div.fotos-editando',
      h('div.barra-edicion.barra-fotos',
        h('p', h('strong', 'Editando fotos.'), ' Arrastrá fotos desde la PC a una sección o usá ', h('em', 'Buscar fotos'), '. Los cambios se guardan solos.'),
        h('div.barra-edicion-acciones', agregar, listo)),
      lista.length ? lista.map((g, i) => seccionEditable(g, i, lista)) : h('div.panel.vacio-turno',
        h('span.vacio-icono', { html: ICONOS.foto }), h('p', 'Agregá una sección para empezar a subir fotos.')));
  }

  function seccionEditable({ seccion, fotos: propias }, indice, lista) {
    const sid = seccion?.id || null;
    let cabecera;
    if (seccion) {
      const titulo = h('input.titulo-seccion', { value: seccion.titulo, 'aria-label': 'Título de la sección', maxlength: 120 });
      titulo.addEventListener('keydown', (e) => { if (e.key === 'Enter') titulo.blur(); });
      titulo.addEventListener('change', async () => {
        const nuevo = titulo.value.trim();
        if (!nuevo) {
          titulo.value = seccion.titulo;
          aviso('La sección necesita un título.', 'error');
          return;
        }
        try {
          await api.actualizarSeccion(seccion.id, { titulo: nuevo });
          seccion.titulo = nuevo;
        } catch (e) { falla(e); }
      });
      const conSeccion = lista.filter((g) => g.seccion);
      const pos = conSeccion.findIndex((g) => g.seccion === seccion);
      cabecera = h('div.seccion-fotos-editar-cabecera',
        titulo,
        h('div.seccion-fotos-acciones',
          h('button.btn-icono', { type: 'button', title: 'Subir la sección', 'aria-label': 'Subir la sección', disabled: pos === 0, html: ICONOS.arriba, onclick: () => moverSeccion(seccion, -1) }),
          h('button.btn-icono', { type: 'button', title: 'Bajar la sección', 'aria-label': 'Bajar la sección', disabled: pos === conSeccion.length - 1, html: ICONOS.abajo, onclick: () => moverSeccion(seccion, 1) }),
          h('button.btn-icono.btn-icono-peligro', { type: 'button', title: 'Borrar la sección', 'aria-label': 'Borrar la sección', html: ICONOS.basura, onclick: () => borrarSeccion(seccion) })));
      titulo.dataset.seccion = seccion.id;
    } else {
      cabecera = h('div.seccion-fotos-editar-cabecera', h('h3', 'Sin sección'), h('span.texto-suave.nota-chica', 'Fotos de secciones borradas. Movelas a una sección.'));
    }

    const buscar = h('input', { type: 'file', accept: 'image/*,.heic,.heif', multiple: true, hidden: true });
    buscar.addEventListener('change', () => { subir([...buscar.files], sid); buscar.value = ''; });
    const zona = h('div.grilla-fotos.zona-fotos',
      propias.map((f) => miniaturaEditable(f)),
      pendientes.filter((x) => (x.seccion_id || null) === sid).map((x) => h('div.foto-mini.foto-subiendo', { title: x.nombre },
        h('span.girador', { 'aria-hidden': 'true' }), h('span.nota-chica', 'Subiendo…'))),
      h('label.foto-agregar', icono('subir'), h('span', propias.length ? 'Buscar fotos' : 'Arrastrá fotos acá o tocá para buscarlas'), buscar));
    prepararZona(zona, sid);
    return h('section.panel.seccion-fotos.seccion-fotos-editando', { 'data-indice': indice }, cabecera, zona);
  }

  function miniaturaEditable(f) {
    const tarjeta = h('div.foto-mini.foto-editable', { draggable: true, 'data-id': f.id },
      imagenMini(f),
      h('div.foto-acciones',
        h('button.btn-icono', { type: 'button', title: 'Mover a otra sección', 'aria-label': 'Mover a otra sección', html: ICONOS.mover, onclick: () => elegirDestino(f) }),
        h('button.btn-icono.btn-icono-peligro', { type: 'button', title: 'Borrar foto', 'aria-label': 'Borrar foto', html: ICONOS.basura, onclick: () => borrarFoto(f) })));
    tarjeta.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData(TIPO_FOTO, f.id);
      e.dataTransfer.effectAllowed = 'move';
      tarjeta.classList.add('arrastrando');
    });
    tarjeta.addEventListener('dragend', () => tarjeta.classList.remove('arrastrando'));
    return tarjeta;
  }

  // Soltar fotos de la PC (subir) o miniaturas (mover) sobre una sección
  function prepararZona(zona, sid) {
    let dentro = 0;
    const acepta = (e) => [...e.dataTransfer.types].some((t) => t === 'Files' || t === TIPO_FOTO);
    const posicion = (e) => {
      const tarjetas = [...zona.querySelectorAll('.foto-editable:not(.arrastrando)')];
      const i = tarjetas.findIndex((t) => {
        const r = t.getBoundingClientRect();
        return e.clientY < r.top || (e.clientY <= r.bottom && e.clientX < r.left + r.width / 2);
      });
      return i === -1 ? tarjetas.length : i;
    };
    zona.addEventListener('dragenter', (e) => { if (acepta(e)) { dentro++; zona.classList.add('soltar-aqui'); } });
    zona.addEventListener('dragleave', () => { if (--dentro <= 0) { dentro = 0; zona.classList.remove('soltar-aqui'); } });
    zona.addEventListener('dragover', (e) => {
      if (!acepta(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = [...e.dataTransfer.types].includes(TIPO_FOTO) ? 'move' : 'copy';
    });
    zona.addEventListener('drop', (e) => {
      if (!acepta(e)) return;
      e.preventDefault();
      dentro = 0;
      zona.classList.remove('soltar-aqui');
      const fid = e.dataTransfer.getData(TIPO_FOTO);
      if (fid) moverFoto(fid, sid, posicion(e));
      else if (e.dataTransfer.files.length) subir([...e.dataTransfer.files], sid);
    });
  }

  // ---------- Acciones ----------
  async function agregarSeccion() {
    try {
      const orden = secciones.length ? Math.min(...secciones.map((s) => s.orden)) - 1 : 0;
      const nueva = await api.crearSeccion(p.id, { titulo: `Consulta ${fechaCorta(new Date().toISOString())}`, orden });
      secciones.push(nueva);
      dibujar();
      const campo = raiz.querySelector(`input[data-seccion="${nueva.id}"]`);
      campo?.focus();
      campo?.select();
    } catch (e) { falla(e); }
  }

  async function moverSeccion(seccion, paso) {
    secciones.sort(porOrden);
    secciones.forEach((s, i) => { s.ordenAnterior = s.orden; s.orden = i; });
    const i = secciones.indexOf(seccion);
    const otra = secciones[i + paso];
    if (!otra) return;
    [seccion.orden, otra.orden] = [otra.orden, seccion.orden];
    const cambiadas = secciones.filter((s) => s.orden !== s.ordenAnterior);
    secciones.forEach((s) => delete s.ordenAnterior);
    dibujar();
    try {
      await Promise.all(cambiadas.map((s) => api.actualizarSeccion(s.id, { orden: s.orden })));
    } catch (e) { falla(e); }
  }

  async function borrarSeccion(seccion) {
    const propias = fotosDe(seccion.id);
    if (!propias.length) {
      if (!(await confirmar(`Se borra la sección "${seccion.titulo}".`, { titulo: 'Borrar sección', aceptar: 'Borrar', peligro: true }))) return;
      try {
        await api.borrarSeccion(seccion.id);
        secciones = secciones.filter((s) => s !== seccion);
        dibujar();
      } catch (e) { falla(e); }
      return;
    }
    const volver = h('button.btn.btn-secundario', { type: 'button' }, 'Volver');
    const dejar = h('button.btn.btn-secundario', { type: 'button' }, 'Dejar las fotos');
    const todo = h('button.btn.btn-peligro', { type: 'button' }, `Borrar con las ${cantidad(propias.length)}`);
    const { cerrar } = hoja({
      titulo: 'Borrar sección',
      ancho: 'chico',
      cuerpo: h('div',
        h('p', `La sección "${seccion.titulo}" tiene ${cantidad(propias.length)}.`),
        h('p.texto-suave', 'Podés borrarlas junto con la sección, o dejarlas en "Sin sección" para moverlas a otra. Las fotos borradas no se pueden recuperar.')),
      pie: [volver, dejar, todo],
    });
    volver.onclick = cerrar;
    const ejecutar = async (conFotos, boton) => {
      boton.disabled = true;
      try {
        if (conFotos) {
          for (const f of propias) await api.borrarFoto(f.id);
          fotos = fotos.filter((f) => !propias.includes(f));
        } else {
          for (const f of propias) f.seccion_id = null;
        }
        await api.borrarSeccion(seccion.id);
        secciones = secciones.filter((s) => s !== seccion);
        cerrar();
        aviso(conFotos ? 'Sección y fotos borradas.' : 'Sección borrada. Sus fotos quedaron en "Sin sección".');
        dibujar();
      } catch (e) {
        cerrar();
        falla(e);
      }
    };
    dejar.onclick = () => ejecutar(false, dejar);
    todo.onclick = () => ejecutar(true, todo);
  }

  async function moverFoto(fid, sid, posicion = null) {
    const f = fotos.find((x) => x.id === fid);
    if (!f) return;
    const origen = f.seccion_id || null;
    const destino = fotosDe(sid).filter((x) => x !== f);
    destino.splice(posicion ?? destino.length, 0, f);
    f.seccion_id = sid;
    const cambios = new Set([f]);
    const numerar = (lista) => lista.forEach((x, i) => { if (x.orden !== i) { x.orden = i; cambios.add(x); } });
    numerar(destino);
    if (origen !== sid) numerar(fotosDe(origen));
    dibujar();
    try {
      await api.ordenarFotos([...cambios].map((x) => ({ id: x.id, seccion_id: x.seccion_id || null, orden: x.orden })));
    } catch (e) { falla(e); }
  }

  function elegirDestino(f) {
    const actual = f.seccion_id || null;
    const opciones = [...secciones.sort(porOrden).map((s) => ({ id: s.id, titulo: s.titulo })), { id: null, titulo: 'Sin sección' }]
      .filter((o) => o.id !== actual && (o.id || actual));
    if (!opciones.length) {
      aviso('Agregá otra sección para poder mover la foto.');
      return;
    }
    const { cerrar } = hoja({
      titulo: 'Mover foto a…',
      ancho: 'chico',
      cuerpo: h('div.lista-destinos', opciones.map((o) => h('button.btn.btn-secundario.destino', {
        type: 'button',
        onclick: () => { cerrar(); moverFoto(f.id, o.id); },
      }, o.titulo))),
    });
  }

  async function borrarFoto(f) {
    if (!(await confirmar('La foto se borra definitivamente.', { titulo: 'Borrar foto', aceptar: 'Borrar', peligro: true }))) return;
    try {
      await api.borrarFoto(f.id);
      fotos = fotos.filter((x) => x !== f);
      dibujar();
    } catch (e) { falla(e); }
  }

  async function subir(archivos, sid) {
    const imagenes = archivos.filter((a) => a.type.startsWith('image/') || /\.(heic|heif)$/i.test(a.name));
    if (imagenes.length < archivos.length) aviso('Algunos archivos no son imágenes y no se subieron.', 'error');
    if (!imagenes.length) return;
    let orden = Math.max(-1, ...fotosDe(sid).map((f) => f.orden)) + 1;
    const cola = imagenes.map((archivo) => ({ archivo, orden: orden++, pendiente: { clave: Math.random(), seccion_id: sid, nombre: archivo.name } }));
    pendientes.push(...cola.map((x) => x.pendiente));
    dibujar();
    let errores = 0;
    const trabajar = async () => {
      for (let x = cola.shift(); x; x = cola.shift()) {
        try {
          const nueva = await api.subirFoto(p.id, x.archivo, { seccionId: sid, orden: x.orden });
          fotos.push(nueva);
        } catch (e) {
          errores++;
          aviso(mensajeError(e), 'error');
        }
        pendientes.splice(pendientes.indexOf(x.pendiente), 1);
        if (editando) dibujar();
      }
    };
    await Promise.all(Array.from({ length: SUBIDAS_A_LA_VEZ }, trabajar));
    const bien = imagenes.length - errores;
    if (bien) aviso(bien === 1 ? 'Foto subida.' : `${bien} fotos subidas.`);
  }

  dibujar();
  return raiz;
}

// ---------- Visor: la foto grande, con anterior y siguiente ----------
function abrirVisor(api, lista, inicio) {
  let i = inicio;
  const img = h('img.visor-imagen', { alt: '' });
  const pie = h('p.visor-pie');
  const anterior = h('button.visor-flecha.visor-anterior', { type: 'button', 'aria-label': 'Foto anterior', html: ICONOS.izquierda });
  const siguiente = h('button.visor-flecha.visor-siguiente', { type: 'button', 'aria-label': 'Foto siguiente', html: ICONOS.derecha });
  const cerrarBtn = h('button.visor-cerrar', { type: 'button', 'aria-label': 'Cerrar', html: ICONOS.cerrar });
  const visor = h('dialog.visor', { 'aria-label': 'Foto' }, h('div.visor-marco', img), anterior, siguiente, cerrarBtn, pie);
  document.body.append(visor);

  const mostrar = async () => {
    const { foto, titulo } = lista[i];
    pie.textContent = `${titulo} · ${i + 1} de ${lista.length}`;
    anterior.hidden = i === 0;
    siguiente.hidden = i === lista.length - 1;
    const pedida = i;
    // Primero la miniatura (ya está en memoria), después la foto completa
    api.urlFoto(foto.id, { mini: true }).then((u) => { if (pedida === i && !img.dataset.completa) img.src = u; }).catch(() => {});
    delete img.dataset.completa;
    try {
      const url = await api.urlFoto(foto.id);
      if (pedida === i) { img.src = url; img.dataset.completa = '1'; }
    } catch (e) {
      if (pedida === i) aviso(mensajeError(e), 'error');
    }
    const prox = lista[i + 1];
    if (prox) api.urlFoto(prox.foto.id).catch(() => {});
  };
  const ir = (paso) => {
    const j = i + paso;
    if (j < 0 || j >= lista.length) return;
    i = j;
    mostrar();
  };
  anterior.onclick = () => ir(-1);
  siguiente.onclick = () => ir(1);
  cerrarBtn.onclick = () => visor.close();
  visor.addEventListener('click', (e) => { if (e.target === visor || e.target.classList.contains('visor-marco')) visor.close(); });
  const teclas = (e) => {
    if (e.key === 'ArrowLeft') ir(-1);
    if (e.key === 'ArrowRight') ir(1);
  };
  document.addEventListener('keydown', teclas);
  let x0 = null;
  visor.addEventListener('pointerdown', (e) => { x0 = e.clientX; });
  visor.addEventListener('pointerup', (e) => {
    if (x0 !== null && Math.abs(e.clientX - x0) > 50) ir(e.clientX < x0 ? 1 : -1);
    x0 = null;
  });
  visor.addEventListener('close', () => {
    document.removeEventListener('keydown', teclas);
    visor.remove();
  });
  mostrar();
  visor.showModal();
  cerrarBtn.focus();
}
