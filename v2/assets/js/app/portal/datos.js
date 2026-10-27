import { h, datosFormulario } from '../../lib/dom.js';
import { aviso, conCarga } from '../../lib/ui.js';
import { fechaCorta } from '../../lib/dates.js';
import { encabezado, avisoSinFicha } from '../comunes.js';

export async function misDatos(ctx) {
  const ficha = await ctx.api.miFicha();
  if (!ficha) return h('div', encabezado('Mis datos'), avisoSinFicha());

  const boton = h('button.btn.btn-primario', { type: 'submit' }, 'Guardar cambios');
  const form = h('form.panel', { novalidate: true },
    h('dl.datos-fijos',
      h('div', h('dt', 'Nombre'), h('dd', `${ficha.nombre} ${ficha.apellido}`)),
      h('div', h('dt', 'DNI'), h('dd', ficha.dni)),
      ficha.fecha_nac ? h('div', h('dt', 'Nacimiento'), h('dd', fechaCorta(ficha.fecha_nac))) : null),
    h('p.texto-suave.nota-chica', 'Para corregir nombre, DNI o fecha de nacimiento, avisanos en el consultorio.'),
    h('label.campo', h('span', 'Celular'), h('input', { name: 'telefono', type: 'tel', value: ficha.telefono || '', autocomplete: 'tel' })),
    h('label.campo', h('span', 'Email de contacto'), h('input', { name: 'email', type: 'email', value: ficha.email || '', autocomplete: 'email' })),
    h('label.campo', h('span', 'Dirección'), h('input', { name: 'direccion', value: ficha.direccion || '', autocomplete: 'street-address' })),
    h('div.acciones-form', boton));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = datosFormulario(form);
    conCarga(boton, async () => {
      await ctx.api.actualizarMisDatos(d);
      aviso('Datos guardados.');
    });
  });

  return h('div', encabezado('Mis datos', `Cuenta: ${ctx.sesion.usuario.email}`), form);
}
