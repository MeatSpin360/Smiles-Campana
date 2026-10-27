// Componente interactivo del odontograma.
import { h, vaciar } from '../lib/dom.js';
import { hoja } from '../lib/ui.js';
import { aplicar, clonar, hallazgos, contar, MARCAS, COLORES, nombreCara, CARAS, ESTADO_CARA } from './modelo.js';
import { odontogramaSVG, piezaGrandeSVG } from './dibujo.js';

const HERRAMIENTAS = [
  { id: 'superficie', nombre: 'Caras', ayuda: 'Tocá una cara de la pieza' },
  { id: 'extraccion', nombre: 'Extracción / ausente' },
  { id: 'corona', nombre: 'Corona' },
  { id: 'conducto', nombre: 'Conducto' },
  { id: 'implante', nombre: 'Implante' },
  { id: 'borrar', nombre: 'Limpiar pieza' },
];

const ICONOS = {
  superficie: '<svg viewBox="0 0 24 24"><path d="M3 3h18v18H3zM3 3l6 6m12-6-6 6M3 21l6-6m12 6-6-6M9 9h6v6H9z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
  extraccion: '<svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5 5 19" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  corona: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  conducto: '<svg viewBox="0 0 24 24"><path d="M12 3v18" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
  implante: '<svg viewBox="0 0 24 24"><path d="M12 3v18M8 7h8M8 12h8M8 17h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  borrar: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
};

const esAngosto = () => window.matchMedia('(max-width: 760px)').matches;

/**
 * crearOdontograma({ data, editable, onChange })
 * Devuelve { el, obtener(), establecer(data) }.
 */
export function crearOdontograma({ data, editable = false, onChange } = {}) {
  let estado = clonar(data);
  let herramienta = 'superficie';
  let color = 'r';
  let seleccion = null;

  const lienzo = h('div.od-lienzo');
  const scroller = h('div.od-scroll', { tabindex: '-1' }, lienzo);
  const listaHallazgos = h('div.od-hallazgos');
  const resumen = h('p.od-resumen');

  const toggleTemp = h('input', { type: 'checkbox', checked: !!estado.temporales, disabled: !editable && !estado.temporales });
  toggleTemp.addEventListener('change', () => {
    estado.temporales = toggleTemp.checked;
    cambio();
  });

  const barra = editable ? crearBarra() : null;

  const el = h('div.odontograma', { class: editable ? 'editable' : 'lectura' },
    barra,
    h('div.od-marco',
      h('div.od-encabezado',
        resumen,
        h('label.interruptor', toggleTemp, h('span', 'Piezas temporarias'))),
      scroller,
      editable ? h('p.od-pista', esAngosto() ? 'Tocá una pieza para editarla. Deslizá hacia los costados para ver todo el maxilar.' : 'Elegí una herramienta y un color, y hacé clic sobre las piezas. Volvé a hacer clic para quitar una marca.') : null),
    h('div.od-detalle',
      h('h3', 'Hallazgos'),
      listaHallazgos,
      leyenda()));

  function crearBarra() {
    const grupoColor = h('div.od-colores', { role: 'radiogroup', 'aria-label': 'Color' },
      ...Object.entries(COLORES).map(([k, v]) => h(`button.od-color.od-color-${k}`, {
        type: 'button', role: 'radio', 'aria-checked': String(k === color), dataset: { color: k },
        onclick: () => { color = k; actualizarBarra(); },
      }, h('span.muestra'), v.nombre)));
    const grupoHerr = h('div.od-herramientas', { role: 'radiogroup', 'aria-label': 'Herramienta' },
      ...HERRAMIENTAS.map((t) => h('button.od-herr', {
        type: 'button', role: 'radio', 'aria-checked': String(t.id === herramienta), dataset: { herr: t.id }, title: t.nombre,
        onclick: () => { herramienta = t.id; actualizarBarra(); },
      }, h('span.icono', { html: ICONOS[t.id] }), h('span.texto', t.nombre))));
    return h('div.od-barra', grupoColor, grupoHerr);
  }

  function actualizarBarra() {
    if (!barra) return;
    barra.querySelectorAll('[data-color]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.color === color)));
    barra.querySelectorAll('[data-herr]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.herr === herramienta)));
    el.dataset.color = color;
  }

  function render() {
    const { markup } = odontogramaSVG(estado, { seleccion });
    lienzo.innerHTML = markup;
    const { pendientes, realizados } = contar(estado);
    resumen.textContent = pendientes + realizados === 0
      ? 'Sin hallazgos registrados'
      : `${pendientes} ${pendientes === 1 ? 'pendiente' : 'pendientes'} y ${realizados} ${realizados === 1 ? 'realizado' : 'realizados'}`;
    const items = hallazgos(estado);
    vaciar(listaHallazgos, items.length
      ? h('ul', ...items.map((it) => h('li', h('button.od-hallazgo-pieza', { type: 'button', onclick: () => abrirPieza(it.pieza) }, String(it.pieza)),
        h('div', ...it.detalles.map((d) => h(`p.od-det.od-det-${d.color}`, d.texto))))))
      : h('p.texto-suave', editable ? 'Todavía no marcaste nada.' : 'No hay hallazgos registrados.'));
    actualizarBarra();
  }

  function cambio() {
    render();
    onChange?.(clonar(estado));
  }

  lienzo.addEventListener('click', (e) => {
    const g = e.target.closest('[data-pieza]');
    if (!g) return;
    const n = Number(g.dataset.pieza);
    const cara = e.target.closest('[data-cara]')?.dataset.cara;
    if (!editable || esAngosto()) {
      abrirPieza(n);
      return;
    }
    if (herramienta === 'superficie' && !cara) {
      abrirPieza(n);
      return;
    }
    if (aplicar(estado, n, herramienta, color, cara)) cambio();
  });
  lienzo.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset?.pieza) {
      e.preventDefault();
      abrirPieza(Number(e.target.dataset.pieza));
    }
  });

  function abrirPieza(n) {
    seleccion = n;
    render();
    const vista = h('div.pieza-editor');
    const detalle = h('div.pieza-editor-detalle');
    let colorLocal = color;

    const pintar = () => {
      const p = estado.piezas[n];
      vista.innerHTML = piezaGrandeSVG(n, p);
      const lineas = [];
      for (const [m, c] of Object.entries(p?.marcas || {})) lineas.push(h(`p.od-det.od-det-${c}`, MARCAS[m][c]));
      for (const k of CARAS) if (p?.caras?.[k]) lineas.push(h(`p.od-det.od-det-${p.caras[k]}`, `${ESTADO_CARA[p.caras[k]]}: ${nombreCara(n, k)}`));
      vaciar(detalle, lineas.length ? lineas : h('p.texto-suave', 'Sin hallazgos en esta pieza.'));
      if (editable) {
        controles.querySelectorAll('[data-marca]').forEach((b) => {
          const v = p?.marcas?.[b.dataset.marca];
          b.setAttribute('aria-pressed', String(v === colorLocal));
        });
        controles.querySelectorAll('[data-color]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.color === colorLocal)));
      }
    };

    const controles = editable ? h('div.pieza-editor-controles',
      h('div.od-colores', { role: 'radiogroup', 'aria-label': 'Color' },
        ...Object.entries(COLORES).map(([k, v]) => h(`button.od-color.od-color-${k}`, {
          type: 'button', role: 'radio', dataset: { color: k }, onclick: () => { colorLocal = k; color = k; actualizarBarra(); pintar(); },
        }, h('span.muestra'), v.nombre))),
      h('p.texto-suave', 'Tocá las caras para marcarlas. Para la pieza completa:'),
      h('div.pieza-editor-marcas',
        ...Object.keys(MARCAS).map((m) => h('button.od-herr', {
          type: 'button', dataset: { marca: m }, 'aria-pressed': 'false',
          onclick: () => { aplicar(estado, n, m, colorLocal); cambio(); pintar(); },
        }, h('span.icono', { html: ICONOS[m] }), h('span.texto', HERRAMIENTAS.find((t) => t.id === m).nombre))),
        h('button.od-herr', { type: 'button', onclick: () => { aplicar(estado, n, 'borrar'); cambio(); pintar(); } }, h('span.icono', { html: ICONOS.borrar }), h('span.texto', 'Limpiar pieza')))) : null;

    vista.addEventListener('click', (e) => {
      if (!editable) return;
      const cara = e.target.closest('[data-cara]')?.dataset.cara;
      if (cara) {
        aplicar(estado, n, 'superficie', colorLocal, cara);
        cambio();
        pintar();
      }
    });

    hoja({
      titulo: `Pieza ${n}`,
      cuerpo: [vista, detalle, controles],
      alCerrar: () => { seleccion = null; render(); },
    });
    pintar();
  }

  render();

  return {
    el,
    obtener: () => clonar(estado),
    establecer(d) {
      estado = clonar(d);
      toggleTemp.checked = !!estado.temporales;
      render();
    },
  };
}

function leyenda() {
  return h('details.od-leyenda',
    h('summary', 'Referencias'),
    h('ul',
      h('li', h('span.ley.ley-r'), 'Rojo: tratamiento a realizar'),
      h('li', h('span.ley.ley-b'), 'Azul: tratamiento realizado'),
      h('li', h('span.ley-icono', { html: ICONOS.extraccion }), 'Cruz roja: extracción indicada. Azul: pieza ausente'),
      h('li', h('span.ley-icono', { html: ICONOS.corona }), 'Círculo: corona'),
      h('li', h('span.ley-icono', { html: ICONOS.conducto }), 'Línea en la raíz: tratamiento de conducto'),
      h('li', h('span.ley-icono', { html: ICONOS.implante }), 'Raíz con líneas: implante')));
}
