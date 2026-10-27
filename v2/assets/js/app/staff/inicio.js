import { h } from '../../lib/dom.js';
import { hoy, hora, fechaLarga, mayuscula, sumarDias, partes, DIAS_CORTOS } from '../../lib/dates.js';
import { aviso, conCarga } from '../../lib/ui.js';
import { encabezado, etiquetaEstado, nombreCompleto } from '../comunes.js';
import { darTurno, altaPaciente } from './comun.js';
import { ICONOS } from '../iconos.js';

export async function inicio(ctx) {
  const f = hoy();
  const [turnosHoy, proximos, sinVincular, agenda] = await Promise.all([
    ctx.api.turnos({ desde: f, hasta: f }),
    ctx.api.turnos({ desde: sumarDias(f, 1), hasta: sumarDias(f, 7) }),
    ctx.api.cuentasSinVincular(),
    ctx.api.agenda(),
  ]);
  const activosHoy = turnosHoy.filter((t) => t.estado !== 'cancelado');
  const proximosActivos = proximos.filter((t) => t.estado === 'confirmado');
  const ahora = Date.now();

  const filaTurno = (t) => {
    const pasado = new Date(t.inicio).getTime() < ahora;
    const acciones = t.estado === 'confirmado' && pasado ? h('div.acciones-turno',
      ...[['atendido', 'Atendido'], ['ausente', 'No vino']].map(([estado, texto]) => {
        const b = h('button.btn.btn-secundario.btn-chico', {
          type: 'button',
          onclick: () => conCarga(b, async () => {
            await ctx.api.cambiarEstadoTurno(t.id, estado);
            aviso(`Marcado como ${texto.toLowerCase()}.`);
            ctx.navegar('/');
          }),
        }, texto);
        return b;
      })) : etiquetaEstado(t.estado);
    return h('li.fila-agenda', { class: pasado ? 'pasado' : '' },
      h('span.hora', hora(t.inicio)),
      h('a.fa-paciente', { href: `#/pacientes/${t.paciente_id}` }, h('strong', nombreCompleto(t.paciente)), h('span', t.motivo)),
      acciones);
  };

  const nuevoTurno = h('button.btn.btn-primario', {
    type: 'button',
    onclick: async () => { if (await darTurno(ctx.api, { dias: agenda.diasVisibles })) ctx.navegar('/'); },
  }, h('span.icono-btn', { html: ICONOS.mas }), 'Dar turno');
  const nuevoPaciente = h('button.btn.btn-secundario', {
    type: 'button',
    onclick: async () => { const p = await altaPaciente(ctx.api); if (p) ctx.navegar(`/pacientes/${p.id}`); },
  }, 'Nuevo paciente');

  const resumen = activosHoy.length
    ? `${activosHoy.length} ${activosHoy.length === 1 ? 'turno' : 'turnos'} hoy`
    : 'Sin turnos para hoy';

  return h('div',
    encabezado(mayuscula(fechaLarga(`${f}T12:00:00-03:00`)), resumen, nuevoPaciente, nuevoTurno),
    sinVincular.length ? h('a.nota.nota-aviso.nota-enlace', { href: '#/pacientes?vincular=1' },
      h('span.nota-icono', { html: ICONOS.enlace }),
      h('div', h('strong', `${sinVincular.length} ${sinVincular.length === 1 ? 'cuenta nueva espera' : 'cuentas nuevas esperan'} vinculación`),
        h('p', 'Se registraron con un DNI que ya tenía ficha. Revisalas en Pacientes.'))) : null,
    h('div.columnas-inicio',
      h('section.panel',
        h('h2', 'Hoy'),
        turnosHoy.length ? h('ul.lista-agenda', turnosHoy.map(filaTurno)) : h('p.texto-suave', 'No hay turnos para hoy.'),
        h('a.btn.btn-fantasma.btn-chico', { href: '#/agenda' }, 'Abrir agenda')),
      h('section.panel',
        h('h2', 'Próximos 7 días'),
        proximosActivos.length ? h('ul.lista-agenda', proximosActivos.slice(0, 12).map((t) => h('li.fila-agenda',
          h('span.hora', h('small', `${DIAS_CORTOS[partes(t.inicio).dia]} ${Number(partes(t.inicio).fecha.slice(8))}`), hora(t.inicio)),
          h('a.fa-paciente', { href: `#/pacientes/${t.paciente_id}` }, h('strong', nombreCompleto(t.paciente)), h('span', t.motivo)),
          t.creado_por === 'paciente' ? h('span.etiqueta.etiqueta-online', 'Online') : null))) : h('p.texto-suave', 'No hay turnos en los próximos días.'))));
}
