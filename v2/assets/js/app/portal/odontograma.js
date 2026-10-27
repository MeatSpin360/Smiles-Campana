import { h } from '../../lib/dom.js';
import { fechaCorta } from '../../lib/dates.js';
import { crearOdontograma } from '../../odontograma/componente.js';
import { encabezado, avisoSinFicha } from '../comunes.js';
import { ICONOS } from '../iconos.js';

export async function miOdontograma(ctx) {
  const [ficha, versiones] = await Promise.all([ctx.api.miFicha(), ctx.api.miOdontograma()]);
  if (!ficha) return h('div', encabezado('Odontograma'), avisoSinFicha());
  if (!versiones.length) {
    return h('div', encabezado('Odontograma'),
      h('div.panel.vacio-turno', h('span.vacio-icono', { html: ICONOS.diente }),
        h('p', 'Tu odontograma aparece acá después de tu primera consulta.')));
  }

  const od = crearOdontograma({ data: versiones[0].datos, editable: false });
  const nota = h('p.texto-suave.version-nota');
  const mostrar = (v) => {
    od.establecer(v.datos);
    nota.textContent = v.nota ? `${v.nota}. Registrado por ${v.creado_por_nombre || 'el consultorio'}.` : `Registrado por ${v.creado_por_nombre || 'el consultorio'}.`;
  };
  const selector = versiones.length > 1 ? h('label.selector-version',
    h('span', 'Ver registro del'),
    h('select', { onchange: (e) => mostrar(versiones[Number(e.target.value)]) },
      versiones.map((v, i) => h('option', { value: i }, `${fechaCorta(v.creado_en)}${i === 0 ? ' (actual)' : ''}${i === versiones.length - 1 ? ' (inicial)' : ''}`)))) : null;
  mostrar(versiones[0]);

  return h('div',
    encabezado('Odontograma', 'El estado de tu boca según la última revisión. En rojo lo que falta hacer y en azul lo ya realizado.'),
    h('div.barra-version', selector, nota),
    od.el);
}
