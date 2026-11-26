// Mi espacio → Historia clínica (la ruta sigue siendo /odontograma, como antes).
// Muestra el resumen que redacta la odontóloga, si lo marcó como visible (la base no devuelve otro).
// Si no hay, un cartel "En desarrollo". El paciente no ve el odontograma (política "ver odontogramas", p22).
import { h } from '../../lib/dom.js';
import { fechaCorta } from '../../lib/dates.js';
import { contenidoRico } from '../../lib/texto-rico.js';
import { encabezado, avisoSinFicha } from '../comunes.js';
import { ICONOS } from '../iconos.js';

export async function miOdontograma(ctx) {
  const [ficha, resumen] = await Promise.all([ctx.api.miFicha(), ctx.api.miHistoriaClinica().catch(() => null)]);
  const titulo = 'Historia clínica';
  if (!ficha) return h('div', encabezado(titulo), avisoSinFicha());
  if (resumen?.contenido) {
    return h('div',
      encabezado(titulo, `Resumen de tu tratamiento, redactado por tu odontóloga. Actualizado el ${fechaCorta(resumen.actualizado_en)}.`),
      h('section.panel', contenidoRico(resumen.contenido, 'resumen-hc')),
      h('p.texto-suave.nota-chica', 'Si tenés dudas sobre tu tratamiento, consultalas en tu próxima visita.'));
  }
  return h('div',
    encabezado(titulo),
    h('div.panel.vacio-turno.en-desarrollo',
      h('span.vacio-icono', { html: ICONOS.diente }),
      h('span.etiqueta-desarrollo', 'En desarrollo'),
      h('h2', 'Muy pronto vas a poder ver acá información de tu tratamiento'),
      h('p.texto-suave', 'Estamos preparando esta sección. Mientras tanto, cualquier consulta sobre tu tratamiento hacela en el consultorio.')));
}
