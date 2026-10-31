import { h, vaciar } from '../../lib/dom.js';
import { aviso, conCarga, hoja } from '../../lib/ui.js';
import { encabezado, nombreCompleto } from '../comunes.js';
import { altaPaciente, lineaPaciente, buscadorPaciente } from './comun.js';
import { ICONOS } from '../iconos.js';
import { cartelSaldo, VEN_SALDO } from './pagos.js';

export async function pacientes(ctx) {
  const [sinVincular, saldos] = await Promise.all([
    ctx.api.cuentasSinVincular(),
    VEN_SALDO.includes(ctx.rol) ? ctx.api.saldosPacientes().catch(() => []) : [],
  ]);
  const saldoDe = new Map(saldos.map((x) => [x.paciente_id, x.saldo]));
  const lista = h('ul.lista-pacientes');
  const input = h('input', { type: 'search', placeholder: 'Buscar por apellido, nombre, DNI o teléfono', 'aria-label': 'Buscar paciente', autocomplete: 'off' });
  const cuenta = h('p.texto-suave.cuenta-resultados');

  let t;
  const buscar = async () => {
    const r = await ctx.api.buscarPacientes(input.value);
    cuenta.textContent = input.value ? `${r.length} ${r.length === 1 ? 'resultado' : 'resultados'}` : '';
    // Toda la fila lleva a la ficha; el cartel de saldo es un botón aparte (no puede ir dentro del enlace)
    vaciar(lista, r.length ? r.map((p) => h('li.item-paciente', { onclick: (e) => { if (!e.target.closest('a, button')) ctx.navegar(`/pacientes/${p.id}`); } },
      h('span.avatar', { 'aria-hidden': 'true' }, (p.apellido || '?')[0]),
      h('div', h('div.nombre-paciente', h('a', { href: `#/pacientes/${p.id}` }, h('strong', nombreCompleto(p))), cartelSaldo(saldoDe.get(p.id) || 0)),
        h('span', lineaPaciente(p))),
      p.usuario_id ? h('span.etiqueta.etiqueta-cuenta', { title: 'Tiene cuenta en Mi espacio' }, 'Con cuenta') : null))
      : h('li.vacio', input.value ? 'No hay pacientes con esa búsqueda.' : 'Todavía no hay pacientes cargados.'));
  };
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(buscar, 180); });
  buscar();

  const vincular = (perfil) => {
    const { cerrar } = hoja({
      titulo: 'Vincular cuenta',
      cuerpo: h('div',
        h('p', `${perfil.nombre || ''} ${perfil.apellido || ''} (${perfil.email}) se registró con DNI ${perfil.dni || 'sin dato'}. Confirmá su identidad y elegí la ficha que le corresponde.`),
        buscadorPaciente({
          api: ctx.api,
          alElegir: async (p) => {
            await conCarga(null, async () => {
              await ctx.api.vincularCuenta(perfil.id, p.id);
              aviso(`Cuenta vinculada a ${nombreCompleto(p)}.`);
              cerrar();
              ctx.navegar('/pacientes');
            });
          },
        })),
    });
  };

  const seccionVincular = sinVincular.length ? h('section.panel.panel-vincular', { id: 'vincular' },
    h('h2', 'Cuentas por vincular'),
    h('p.texto-suave', 'Estas personas crearon su cuenta con un DNI que ya tenía ficha, pero con otro email. Verificá que sean ellas antes de vincular.'),
    h('ul.lista-simple', sinVincular.map((p) => h('li.fila-turno',
      h('div', h('strong', `${p.nombre || ''} ${p.apellido || ''}`.trim() || p.email), h('span.texto-suave', `${p.email}${p.dni ? `, DNI ${p.dni}` : ''}`)),
      h('button.btn.btn-secundario.btn-chico', { type: 'button', onclick: () => vincular(p) }, 'Vincular'))))) : null;

  if (ctx.query.get('vincular')) setTimeout(() => document.getElementById('vincular')?.scrollIntoView({ behavior: 'smooth' }), 50);

  return h('div',
    encabezado('Pacientes', null,
      h('button.btn.btn-primario', { type: 'button', onclick: async () => { const p = await altaPaciente(ctx.api); if (p) ctx.navegar(`/pacientes/${p.id}`); } },
        h('span.icono-btn', { html: ICONOS.mas }), 'Nuevo paciente')),
    seccionVincular,
    h('section.panel',
      h('div.campo-busqueda', h('span.icono-busqueda', { html: ICONOS.buscar }), input),
      cuenta,
      lista));
}
