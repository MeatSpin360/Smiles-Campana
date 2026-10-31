import { h } from '../../lib/dom.js';
import { aviso, conCarga, confirmar } from '../../lib/ui.js';
import { encabezado } from '../comunes.js';

const ROLES = [
  { id: 'paciente', texto: 'Paciente', desc: 'Solo su espacio personal' },
  { id: 'recepcion', texto: 'Recepción', desc: 'Agenda, pacientes y horarios. No ve la historia clínica' },
  { id: 'odontologia', texto: 'Odontología', desc: 'Agenda, pacientes, odontograma e historia clínica' },
  { id: 'contabilidad', texto: 'Contabilidad', desc: 'Lista de precios y pagos. No ve la agenda, las fichas ni la historia clínica' },
  { id: 'admin', texto: 'Administración', desc: 'Todo, incluida esta sección' },
];

export async function usuarios(ctx) {
  const lista = await ctx.api.usuarios();
  const personal = lista.filter((u) => u.rol !== 'paciente');
  const pacientes = lista.filter((u) => u.rol === 'paciente');

  const fila = (u) => {
    const propio = u.id === ctx.perfil.id;
    const select = h('select', { 'aria-label': `Rol de ${u.email}`, disabled: propio }, ROLES.map((r) => h('option', { value: r.id, selected: r.id === u.rol }, r.texto)));
    select.addEventListener('change', async () => {
      const r = ROLES.find((x) => x.id === select.value);
      const ok = await confirmar(`${u.email} pasa a tener el rol ${r.texto}: ${r.desc.toLowerCase()}.`, { titulo: 'Cambiar rol', aceptar: 'Cambiar rol' });
      if (!ok) {
        select.value = u.rol;
        return;
      }
      await conCarga(null, async () => {
        await ctx.api.cambiarRol(u.id, select.value);
        aviso('Rol actualizado.');
        ctx.navegar('/usuarios');
      });
    });
    return h('li.fila-usuario',
      h('div', h('strong', `${u.nombre || ''} ${u.apellido || ''}`.trim() || u.email), h('span.texto-suave', u.email), propio ? h('span.texto-suave', ' (vos)') : null),
      select);
  };

  return h('div',
    encabezado('Usuarios', 'Quién puede entrar a la intranet y qué puede ver.'),
    h('section.panel',
      h('h2', 'Personal'),
      h('ul.lista-simple', personal.map(fila))),
    h('section.panel',
      h('h2', 'Sumar a alguien del personal'),
      h('ol.pasos-texto',
        h('li', 'La persona crea su cuenta desde la página, en Mi espacio, como si fuera paciente.'),
        h('li', 'La buscás abajo en Cuentas de pacientes y le cambiás el rol.'),
        h('li', 'La próxima vez que ingrese, ve la intranet según su rol.')),
      h('dl.roles-desc', ROLES.slice(1).map((r) => h('div', h('dt', r.texto), h('dd', r.desc))))),
    h('details.panel.panel-plegable',
      h('summary', h('h2', `Cuentas de pacientes (${pacientes.length})`)),
      h('ul.lista-simple', pacientes.map(fila))));
}
