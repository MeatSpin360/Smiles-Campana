// Mi espacio → Mis fotos: las fotos del tratamiento que el consultorio eligió mostrarle al paciente (solo ver).
// La base solo devuelve esas (las marcadas como visibles) y el Worker solo entrega esos archivos.
import { h } from '../../lib/dom.js';
import { encabezado, avisoSinFicha } from '../comunes.js';
import { ICONOS } from '../iconos.js';
import { abrirVisor } from '../staff/fotos.js';

const porOrden = (a, b) => a.orden - b.orden || a.creado_en.localeCompare(b.creado_en);
const cantidad = (n) => `${n} ${n === 1 ? 'foto' : 'fotos'}`;

export async function misFotos(ctx) {
  const [ficha, { secciones, fotos }] = await Promise.all([ctx.api.miFicha(), ctx.api.misFotos()]);
  const titulo = 'Mis fotos';
  if (!ficha) return h('div', encabezado(titulo), avisoSinFicha());
  const cabecera = encabezado(titulo, 'Fotos de tu tratamiento que el consultorio compartió con vos. Tocá una para verla grande.');
  if (!fotos.length) {
    return h('div', cabecera, h('div.panel.vacio-turno', h('span.vacio-icono', { html: ICONOS.foto }),
      h('p', 'Todavía no hay fotos para mostrarte. Cuando el consultorio comparta fotos de tu tratamiento, las vas a ver acá.')));
  }

  const grupos = secciones.slice().sort(porOrden)
    .map((s) => ({ titulo: s.titulo, fotos: fotos.filter((f) => f.seccion_id === s.id).sort(porOrden) }))
    .filter((g) => g.fotos.length);
  const sueltas = fotos.filter((f) => !secciones.some((s) => s.id === f.seccion_id)).sort(porOrden);
  if (sueltas.length) grupos.push({ titulo: grupos.length ? 'Otras fotos' : 'Fotos', fotos: sueltas });
  const enOrden = grupos.flatMap((g) => g.fotos.map((f) => ({ foto: f, titulo: g.titulo })));

  // Las miniaturas se piden recién cuando están por verse
  const observador = new IntersectionObserver((entradas) => {
    for (const e of entradas) {
      if (!e.isIntersecting) continue;
      observador.unobserve(e.target);
      ctx.api.urlFoto(e.target.dataset.id, { mini: true })
        .then((url) => { e.target.src = url; })
        .catch(() => e.target.closest('.foto-mini')?.classList.add('foto-error'));
    }
  }, { rootMargin: '300px' });
  window.addEventListener('hashchange', () => observador.disconnect(), { once: true });
  const mini = (f) => {
    const img = h('img', { alt: '', 'data-id': f.id, width: 400, height: Math.round(400 * (f.alto || 3) / (f.ancho || 4)) });
    observador.observe(img);
    return img;
  };

  return h('div.fotos.mis-fotos', cabecera,
    grupos.map((g) => h('section.panel.seccion-fotos',
      h('div.seccion-fotos-titulo', h('h2', g.titulo), h('span.texto-suave.nota-chica', cantidad(g.fotos.length))),
      h('div.grilla-fotos', g.fotos.map((f) => {
        const i = enOrden.findIndex((x) => x.foto === f);
        return h('button.foto-mini', { type: 'button', 'aria-label': `Ver foto ${i + 1} de ${enOrden.length}`, onclick: () => abrirVisor(ctx.api, enOrden, i) }, mini(f));
      })))));
}
