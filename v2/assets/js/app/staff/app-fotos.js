// Modo "Subir fotos paciente" de la app del celular (pantalla inicial de la app → segundo botón).
// Una pantalla sin menú: elegir paciente → elegir sección (nueva o existente) → cámara → revisar y subir.
// La intranet completa es la otra opción de la app ("Ventana de trabajo"); este modo solo saca y sube fotos.
import { h, vaciar } from '../../lib/dom.js';
import { aviso, cargando, mensajeError } from '../../lib/ui.js';
import { hoy, hora } from '../../lib/dates.js';
import { nombreCompleto, esActivo } from '../comunes.js';
import { ICONOS } from '../iconos.js';
import { buscadorPaciente, puedeVerClinica } from './comun.js';
import { enLaApp, carpetaDe, pendientes, revisar, tituloDeHoy } from './app-celular.js';

const icono = (n) => h('span.icono-btn', { html: ICONOS[n] });
const cantidad = (n) => `${n} ${n === 1 ? 'foto' : 'fotos'}`;

export async function appFotos(ctx) {
  if (!puedeVerClinica(ctx.rol)) {
    return h('div.panel.modo-fotos-aviso',
      h('h2', 'Tu usuario no puede subir fotos'),
      h('p.texto-suave', 'Las fotos de los pacientes las cargan Odontología y Administración. Volvé al inicio de la app y entrá a la ventana de trabajo.'));
  }
  if (!enLaApp()) {
    return h('div.panel.modo-fotos-aviso',
      h('h2', 'Esta pantalla es para la app del celular'),
      h('p.texto-suave', 'Desde la computadora, las fotos se suben en la ficha del paciente, pestaña Fotos.'),
      h('a.btn.btn-secundario', { href: '#/pacientes' }, 'Ir a Pacientes'));
  }
  return ctx.params.id ? elegirSeccion(ctx) : elegirPaciente(ctx);
}

// ---------- 1. Paciente ----------
async function elegirPaciente(ctx) {
  const ir = (p) => ctx.navegar(`/app-fotos/${p.id}`);
  const deHoy = h('div.modo-fotos-hoy', cargando());
  // Los turnos de hoy se cargan aparte: el buscador ya se puede usar
  ctx.api.turnos({ desde: hoy(), hasta: hoy() }).then((turnos) => {
    const vistos = new Set();
    const lista = turnos.filter((t) => esActivo(t) && t.paciente && !vistos.has(t.paciente_id) && vistos.add(t.paciente_id));
    vaciar(deHoy, lista.length
      ? h('ul.modo-fotos-lista', lista.map((t) => h('li', h('button.modo-fotos-fila', { type: 'button', onclick: () => ir(t.paciente) },
        h('span.modo-fotos-hora', hora(t.inicio)),
        h('span.modo-fotos-nombre', h('strong', nombreCompleto(t.paciente)), h('span', t.motivo || 'Turno')),
        conPendientes(t.paciente_id)))))
      : h('p.texto-suave.nota-chica', 'Hoy no hay turnos. Buscá al paciente acá abajo.'));
  }).catch((e) => vaciar(deHoy, h('p.texto-suave.nota-chica', `No se pudieron cargar los turnos de hoy: ${mensajeError(e)}`)));

  return h('div.modo-fotos',
    h('h1.modo-fotos-titulo', 'Elegí el paciente'),
    h('section', h('h2.modo-fotos-sub', 'Con turno hoy'), deHoy),
    h('section', h('h2.modo-fotos-sub', 'Buscar'), buscadorPaciente({ api: ctx.api, alElegir: ir, autofoco: false })));
}

function conPendientes(pid) {
  const n = pendientes(pid).length;
  return n ? h('span.modo-fotos-pendientes', `${n} sin subir`) : null;
}

// ---------- 2. Sección ----------
async function elegirSeccion(ctx) {
  const { api } = ctx;
  const [paciente, { secciones, fotos }] = await Promise.all([api.paciente(ctx.params.id), api.fotosDePaciente(ctx.params.id)]);
  const cuantas = (sid) => fotos.filter((f) => f.seccion_id === sid).length;
  let destino = null; // lo elegido antes de abrir la cámara

  const sacar = (d) => {
    destino = d;
    window.SmilesApp.sacarFotos(paciente.id, carpetaDe(paciente), nombreCompleto(paciente));
  };
  const abrirRevision = (d = null) => revisar({ api, paciente, secciones, destino: d, alTerminar: () => ctx.redibujar() });

  // La app avisa al volver de la cámara: se revisan y suben a la sección elegida
  window.smilesAppFotosListas = (pid, n) => {
    if (pid !== paciente.id) return;
    if (n > 0) abrirRevision(destino);
    else ctx.redibujar();
  };

  // Título para la sección nueva: el de hoy, o con un número si ya existe
  const ocupado = (t) => secciones.some((s) => s.titulo.trim().toLowerCase() === t.trim().toLowerCase());
  let propuesta = tituloDeHoy();
  for (let i = 2; ocupado(propuesta); i++) propuesta = `${tituloDeHoy()} (${i})`;
  const titulo = h('input', { value: propuesta, 'aria-label': 'Título de la sección nueva', maxlength: 80 });
  const nueva = h('button.btn.btn-primario.btn-ancho', {
    type: 'button',
    onclick: () => {
      const t = titulo.value.trim();
      if (!t) {
        aviso('Escribí un título para la sección.', 'error');
        titulo.focus();
        return;
      }
      const igual = secciones.find((s) => s.titulo.trim().toLowerCase() === t.toLowerCase());
      sacar(igual ? { seccionId: igual.id } : { titulo: t });
    },
  }, icono('foto'), 'Sacar fotos');

  const n = pendientes(paciente.id).length;
  return h('div.modo-fotos',
    h('a.modo-fotos-volver', { href: '#/app-fotos' }, icono('izquierda'), 'Cambiar paciente'),
    h('h1.modo-fotos-titulo', nombreCompleto(paciente)),
    n ? h('button.modo-fotos-sin-subir', { type: 'button', onclick: () => abrirRevision() },
      icono('subir'), h('span', h('strong', `${cantidad(n)} sin subir`), h('span', 'Tocá para revisarlas y subirlas'))) : null,
    h('section.panel.modo-fotos-nueva',
      h('h2.modo-fotos-sub', 'Sección nueva'),
      h('label.campo', h('span', 'Título'), titulo),
      nueva),
    secciones.length ? h('section',
      h('h2.modo-fotos-sub', 'O agregar a una sección existente'),
      h('ul.modo-fotos-lista', secciones.map((s) => h('li', h('button.modo-fotos-fila', { type: 'button', onclick: () => sacar({ seccionId: s.id }) },
        h('span.modo-fotos-nombre', h('strong', s.titulo), h('span', cantidad(cuantas(s.id)))),
        h('span.modo-fotos-camara', { html: ICONOS.foto })))))) : null);
}
