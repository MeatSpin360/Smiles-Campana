// Mi espacio → Odontograma. EN DESARROLLO: por ahora el paciente no ve su historia clínica (etapa 5 en pausa,
// ver PENDIENTES.md). La base tampoco se la devuelve (supabase/schema.sql, política "ver odontogramas").
// Para volver a mostrarla, recuperar la versión anterior de este archivo y la política.
import { h } from '../../lib/dom.js';
import { encabezado, avisoSinFicha } from '../comunes.js';
import { ICONOS } from '../iconos.js';

export async function miOdontograma(ctx) {
  const ficha = await ctx.api.miFicha();
  if (!ficha) return h('div', encabezado('Odontograma'), avisoSinFicha());
  return h('div',
    encabezado('Odontograma'),
    h('div.panel.vacio-turno.en-desarrollo',
      h('span.vacio-icono', { html: ICONOS.diente }),
      h('span.etiqueta-desarrollo', 'En desarrollo'),
      h('h2', 'Muy pronto vas a poder ver acá información de tu tratamiento'),
      h('p.texto-suave', 'Estamos preparando esta sección. Mientras tanto, cualquier consulta sobre tu tratamiento hacela en el consultorio.')));
}
