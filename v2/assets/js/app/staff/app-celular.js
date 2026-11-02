// Fotos desde la app Android del consultorio (android/ en el repositorio).
// Dentro de la app existe window.SmilesApp: la cámara guarda cada foto en calidad completa en el celular
// (Imágenes/smiles-campana/<Apellido Nombre - DNI>/) y la deja en una lista de "sin subir". Acá se revisan
// (descartar, girar, elegir sección) y se suben a la ficha, achicadas como cualquier otra foto.
// Las fotos sin subir se leen de /__app/foto/<id>: esa dirección la atiende la app, no el servidor.
import { h, vaciar } from '../../lib/dom.js';
import { aviso, confirmar, hoja, mensajeError } from '../../lib/ui.js';
import { fechaCorta } from '../../lib/dates.js';
import { ICONOS } from '../iconos.js';

const app = () => (typeof window.SmilesApp?.sacarFotos === 'function' ? window.SmilesApp : null);
export const enLaApp = () => Boolean(app());

const icono = (n) => h('span.icono-btn', { html: ICONOS[n] });
const cantidad = (n) => `${n} ${n === 1 ? 'foto' : 'fotos'}`;

/** Carpeta del paciente en el celular: "Apellido Nombre - DNI" (o "- sin DNI"). */
export const carpetaDe = (p) => `${p.apellido} ${p.nombre} - ${p.dni || 'sin DNI'}`.replace(/[\\/:*?"<>|]/g, ' ').replace(/\s+/g, ' ').trim();

function pendientes(pacienteId) {
  try {
    return JSON.parse(app()?.pendientes(pacienteId) || '[]');
  } catch {
    return [];
  }
}

/**
 * Botones de la pestaña Fotos cuando se usa la app: "Sacar fotos" y "Fotos sin subir (N)".
 * alSubir(): se llama cuando se subieron fotos (para volver a dibujar la pestaña).
 */
export function barraApp({ api, paciente, secciones, alSubir }) {
  if (!app()) return null;
  const sinSubir = h('button.btn.btn-secundario', { type: 'button' });
  const actualizar = () => {
    const n = pendientes(paciente.id).length;
    sinSubir.hidden = n === 0;
    vaciar(sinSubir, icono('subir'), `Fotos sin subir (${n})`);
  };
  sinSubir.onclick = () => revisar({ api, paciente, secciones: secciones(), alTerminar: () => { actualizar(); alSubir(); } });
  const sacar = h('button.btn.btn-primario', {
    type: 'button',
    onclick: () => app().sacarFotos(paciente.id, carpetaDe(paciente), `${paciente.apellido}, ${paciente.nombre}`),
  }, icono('foto'), 'Sacar fotos');

  // La app avisa al volver de la cámara
  window.smilesAppFotosListas = (pid, n) => {
    if (pid !== paciente.id) return;
    actualizar();
    if (n > 0) aviso(`${cantidad(n)} guardadas en el celular. Revisalas y subilas cuando quieras.`);
  };
  actualizar();
  return h('div.barra-app-fotos',
    h('p.texto-suave.nota-chica', 'Las fotos se guardan en calidad completa en el celular, en la carpeta de este paciente. Después las revisás y las subís a la ficha.'),
    h('div.barra-app-acciones', sacar, sinSubir));
}

/** Revisión de las fotos sin subir: descartar, girar, elegir sección y subir. */
function revisar({ api, paciente, secciones, alTerminar }) {
  let lista = pendientes(paciente.id).map((f) => ({ ...f, elegida: true, giro: 0 }));
  if (!lista.length) {
    aviso('No hay fotos sin subir de este paciente.');
    return;
  }
  const hoyTitulo = `Consulta ${fechaCorta(new Date().toISOString())}`;
  const deHoy = secciones.find((s) => s.titulo === hoyTitulo);
  const seccion = h('select', { 'aria-label': 'Sección' },
    deHoy ? null : h('option', { value: '__nueva' }, `${hoyTitulo} (nueva)`),
    secciones.map((s) => h('option', { value: s.id, selected: s === deHoy }, s.titulo)));
  const grilla = h('div.grilla-fotos.grilla-revision');
  const subir = h('button.btn.btn-primario', { type: 'button' });
  const progreso = h('p.texto-suave.nota-chica', { hidden: true });
  let subiendo = false;

  const dibujar = () => {
    const elegidas = lista.filter((f) => f.elegida).length;
    vaciar(subir, icono('subir'), elegidas ? `Subir ${cantidad(elegidas)}` : 'Elegí al menos una');
    subir.disabled = !elegidas || subiendo;
    vaciar(grilla, lista.map((f) => {
      const img = h('img', { src: f.url, alt: '', style: `transform: rotate(${f.giro}deg)` });
      return h(`div.foto-mini.foto-revision${f.elegida ? '.elegida' : ''}`,
        h('button.foto-revision-ver', { type: 'button', 'aria-label': 'Ver grande', onclick: () => verGrande(f) }, img),
        h('label.foto-revision-elegir', { title: 'Subir esta foto' },
          h('input', { type: 'checkbox', checked: f.elegida, disabled: subiendo, onchange: (e) => { f.elegida = e.target.checked; dibujar(); } })),
        h('div.foto-acciones',
          h('button.btn-icono', { type: 'button', title: 'Girar', 'aria-label': 'Girar', disabled: subiendo, html: ICONOS.girar, onclick: () => { f.giro = (f.giro + 90) % 360; dibujar(); } }),
          h('button.btn-icono.btn-icono-peligro', { type: 'button', title: 'Descartar', 'aria-label': 'Descartar', disabled: subiendo, html: ICONOS.basura, onclick: () => descartar(f) })));
    }));
  };

  const verGrande = (f) => hoja({
    titulo: fechaCorta(new Date(f.fecha).toISOString()),
    ancho: 'ancho',
    cuerpo: h('div.revision-grande', h('img', { src: f.url, alt: '', style: `transform: rotate(${f.giro}deg)` })),
  });

  const descartar = async (f) => {
    if (!(await confirmar('La foto se borra del celular y no se sube.', { titulo: 'Descartar foto', aceptar: 'Descartar', peligro: true }))) return;
    if (!app().descartar(f.id)) aviso('La foto salió de la lista, pero no se pudo borrar del celular: borrala desde la galería si hace falta.', 'error');
    lista = lista.filter((x) => x !== f);
    if (!lista.length) cerrar();
    else dibujar();
  };

  subir.onclick = async () => {
    const elegidas = lista.filter((f) => f.elegida);
    subiendo = true;
    progreso.hidden = false;
    dibujar();
    let seccionId = seccion.value;
    let bien = 0;
    try {
      if (seccionId === '__nueva') {
        const orden = secciones.length ? Math.min(...secciones.map((s) => s.orden)) - 1 : 0;
        const nueva = await api.crearSeccion(paciente.id, { titulo: hoyTitulo, orden });
        secciones.push(nueva);
        seccionId = nueva.id;
      }
      let orden = 100000; // al final de la sección (las de la misma tanda quedan en el orden en que se sacaron)
      for (const f of elegidas) {
        progreso.textContent = `Subiendo ${bien + 1} de ${elegidas.length}…`;
        const blob = await (await fetch(f.url, { cache: 'no-store' })).blob();
        const archivo = new File([blob], f.nombre || 'foto.jpg', { type: 'image/jpeg' });
        await api.subirFoto(paciente.id, archivo, { seccionId, orden: orden++, giro: f.giro });
        app().marcarSubida(f.id);
        lista = lista.filter((x) => x !== f);
        bien++;
      }
      aviso(`${cantidad(bien)} subidas a la ficha.`);
      cerrar();
    } catch (e) {
      aviso(`${bien ? `Se subieron ${cantidad(bien)}. ` : ''}${mensajeError(e)}`, 'error');
      subiendo = false;
      progreso.hidden = true;
      if (lista.length) dibujar();
      else cerrar();
    }
  };

  const { cerrar } = hoja({
    titulo: `Fotos sin subir · ${paciente.apellido}, ${paciente.nombre}`,
    ancho: 'ancho',
    cuerpo: h('div.revision-app',
      h('p.texto-suave.nota-chica', 'Tocá una foto para verla grande. Destildá las que no quieras subir, girá las que hagan falta y descartá las que salieron mal. Los originales quedan en el celular.'),
      grilla,
      h('label.campo', h('span', 'Sección'), seccion)),
    pie: [progreso, subir],
    alCerrar: () => alTerminar(),
  });
  dibujar();
}
