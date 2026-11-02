// Mi espacio → Mi plan: los planes de tratamiento del paciente desde que se le proponen (solo ver).
// La base no devuelve borradores ni descartados. Cada plan se puede imprimir o guardar como PDF,
// igual que el presupuesto que entrega el consultorio.
import { h } from '../../lib/dom.js';
import { fechaCorta, hoy } from '../../lib/dates.js';
import { encabezado, avisoSinFicha } from '../comunes.js';
import { ICONOS } from '../iconos.js';
import { ESTADOS_PLAN, pesos } from '../staff/registro-textos.js';
import { imprimirPlan, subtotalItem, subtotalDe } from '../staff/planes.js';

const AYUDA_ESTADO = {
  propuesto: 'Es la propuesta del consultorio. Si tenés dudas, consultalas en tu próxima visita.',
  aceptado: 'Aceptaste este plan.',
  en_curso: 'El tratamiento está en marcha.',
  terminado: 'Este tratamiento ya terminó.',
};

export async function miPlan(ctx) {
  const [ficha, planes] = await Promise.all([ctx.api.miFicha(), ctx.api.misPlanes()]);
  const titulo = 'Mi plan';
  if (!ficha) return h('div', encabezado(titulo), avisoSinFicha());
  const cabecera = encabezado(titulo, 'Tu plan de tratamiento con sus etapas y su presupuesto. Lo podés imprimir o guardar como PDF.');
  if (!planes.length) {
    return h('div', cabecera, h('div.panel.vacio-turno', h('span.vacio-icono', { html: ICONOS.nota }),
      h('p', 'Todavía no tenés un plan de tratamiento. Cuando el consultorio te proponga uno, lo vas a ver acá.')));
  }
  return h('div.mis-planes', cabecera, planes.map((plan) => tarjetaPlan(plan, ficha)));
}

function tarjetaPlan(plan, ficha) {
  const items = Array.isArray(plan.items) ? plan.items : [];
  const grupos = [];
  for (const i of items) {
    const etapa = i.etapa || '';
    if (!grupos.length || grupos.at(-1).etapa !== etapa) grupos.push({ etapa, items: [] });
    grupos.at(-1).items.push(i);
  }
  const conEtapas = grupos.some((g) => g.etapa);
  const sub = subtotalDe(items);
  const pct = Number(plan.descuento) || 0;
  const fijo = Number(plan.descuento_monto) || 0;
  const vigente = plan.estado === 'propuesto' && plan.validez;
  const vencido = vigente && plan.validez < hoy();

  const fila = (i) => {
    const precio = Number(i.precio) || 0;
    const cant = Number(i.cantidad ?? 1);
    const detalle = [i.piezas ? `Piezas ${i.piezas}` : null,
      precio && cant > 1 ? `${cant} × ${pesos(precio)}` : null,
      Number(i.descuento) > 0 ? `${i.descuento} % de descuento` : null].filter(Boolean).join(' · ');
    return h('li.plan-item',
      h('div', h('span.plan-practica', i.practica || 'Práctica'), detalle ? h('span.texto-suave.nota-chica', detalle) : null),
      h('span.plan-monto', precio ? pesos(subtotalItem(i)) : 'Sin cargo'));
  };

  return h('section.panel.plan-paciente',
    h('div.plan-paciente-cabecera',
      h('div',
        h('h2', plan.titulo || 'Plan de tratamiento'),
        h('p.texto-suave.nota-chica', `Del ${fechaCorta(plan.creado_en)}`,
          vigente ? (vencido ? ` · Los precios estaban congelados hasta el ${fechaCorta(plan.validez)}` : ` · Precios congelados hasta el ${fechaCorta(plan.validez)}`) : '')),
      h(`span.etiqueta.etiqueta-plan-${plan.estado}`, ESTADOS_PLAN[plan.estado] || plan.estado)),
    AYUDA_ESTADO[plan.estado] ? h('p.nota-chica.plan-ayuda', AYUDA_ESTADO[plan.estado]) : null,
    grupos.map((g) => h('div.plan-etapa',
      conEtapas ? h('h3', g.etapa || 'Otras prácticas') : null,
      h('ul.plan-items', g.items.map(fila)))),
    h('dl.plan-totales',
      pct || fijo ? [h('dt', 'Subtotal'), h('dd', pesos(sub))] : null,
      pct ? [h('dt', `Descuento ${pct} %`), h('dd', `− ${pesos(sub * pct / 100)}`)] : null,
      fijo ? [h('dt', 'Descuento'), h('dd', `− ${pesos(fijo)}`)] : null,
      h('dt.plan-total', 'Total'), h('dd.plan-total', pesos(plan.total))),
    plan.forma_pago ? h('div.plan-texto', h('h3', 'Forma de pago'), h('p', plan.forma_pago)) : null,
    plan.notas ? h('div.plan-texto', h('h3', 'Observaciones'), h('p', plan.notas)) : null,
    h('div.plan-paciente-acciones',
      h('button.btn.btn-secundario', { type: 'button', onclick: () => imprimirPlan(plan, ficha) },
        h('span.icono-btn', { html: ICONOS.nota }), 'Imprimir o guardar PDF')));
}
