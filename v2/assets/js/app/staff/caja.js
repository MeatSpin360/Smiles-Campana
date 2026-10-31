// Caja: pagos y lista de precios en una sola sección, con pestañas (como el Panel de control).
//  - Pagos: recepción, admin y contabilidad (recepción y admin cargan desde la ficha del paciente).
//  - Precios: todo el personal la ve; contabilidad y admin la editan.
import { h } from '../../lib/dom.js';
import { encabezado } from '../comunes.js';

const SECCIONES = [
  { id: 'pagos', texto: 'Pagos', roles: ['recepcion', 'admin', 'contabilidad'], vista: () => import('./pagos.js').then((m) => m.pagosContabilidad) },
  { id: 'precios', texto: 'Precios', roles: ['recepcion', 'odontologia', 'admin', 'contabilidad'], vista: () => import('./precios.js').then((m) => m.precios) },
];

export async function caja(ctx) {
  const visibles = SECCIONES.filter((x) => x.roles.includes(ctx.rol));
  const seccion = visibles.find((x) => x.id === ctx.params.seccion) || visibles[0];
  const pestanas = visibles.length > 1 ? h('nav.pestanas', { 'aria-label': 'Secciones de caja' }, visibles.map((x) => h('a.pestana', {
    href: `#/caja/${x.id}`, 'aria-current': x === seccion ? 'page' : null,
  }, x.texto))) : null;
  const vista = await seccion.vista();
  const propio = { ...ctx, navegar: (r) => ctx.navegar(r === `/${seccion.id}` ? `/caja/${seccion.id}` : r) };
  return h('div.panel-control.caja',
    encabezado('Caja', visibles.length > 1 ? 'Pagos de los pacientes y lista de precios.' : null),
    pestanas,
    h('div.panel-subvista', await vista(propio)));
}
