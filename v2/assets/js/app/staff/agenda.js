import { h } from '../../lib/dom.js';
import { hoy, hora, fechaLarga, mayuscula, sumarDias, DIAS_CORTOS, diaDeSemana } from '../../lib/dates.js';
import { turnosDelDia } from '../../lib/agenda.js';
import { aviso, conCarga, hoja } from '../../lib/ui.js';
import { encabezado, etiquetaEstado, nombreCompleto, ESTADOS, ACCIONES, esActivo, enlaceWhatsapp } from '../comunes.js';
import { darTurno } from './comun.js';
import { confirmarTurno, cancelarTurno, cambiarTurno } from './acciones-turno.js';
import { ICONOS } from '../iconos.js';

export async function agenda(ctx) {
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(ctx.query.get('fecha') || '') ? ctx.query.get('fecha') : hoy();
  const ir = (f) => ctx.navegar(`/agenda?fecha=${f}`);
  const lunes = sumarDias(fecha, -((diaDeSemana(fecha) + 6) % 7));
  const [config, turnos, semana] = await Promise.all([
    ctx.api.agenda(),
    ctx.api.turnos({ desde: fecha, hasta: fecha }),
    ctx.api.turnos({ desde: lunes, hasta: sumarDias(lunes, 6) }),
  ]);
  const bloqueo = config.bloqueos.find((b) => b.fecha === fecha);
  const ahora = Date.now();

  // Franjas del día según la agenda + turnos fuera de horario
  const franjas = bloqueo ? [] : turnosDelDia(fecha, config);
  const activos = turnos.filter(esActivo);
  const porHora = new Map(activos.map((t) => [new Date(t.inicio).getTime(), t]));
  const todos = [...new Set([...franjas.map((i) => new Date(i).getTime()), ...porHora.keys()])].sort((a, b) => a - b);
  const cancelados = turnos.filter((t) => !esActivo(t));

  const menuTurno = (t) => {
    const opciones = ACCIONES[t.estado] || [];
    const vigente = new Date(t.inicio).getTime() > ahora && ['pendiente', 'confirmado'].includes(t.estado);
    // Las acciones que avisan al paciente cierran este menú y abren su propia ventana
    const despues = (fn) => async () => { cerrar(); if (await fn()) ir(fecha); };
    const { cerrar } = hoja({
      titulo: nombreCompleto(t.paciente),
      ancho: 'chico',
      cuerpo: h('div.menu-turno',
        h('p.texto-suave', `${mayuscula(fechaLarga(t.inicio))}, ${hora(t.inicio)} h. ${t.motivo}.`),
        t.inicio_pedido ? h('p.texto-suave.nota-chica', `Pedido originalmente para el ${fechaLarga(t.inicio_pedido).replace(',', '')} a las ${hora(t.inicio_pedido)} h.`) : null,
        t.estado === 'pendiente' && t.cambio_ofrecido_en ? h('p', h('span.etiqueta.etiqueta-cambio', 'Cambio ofrecido')) : null,
        enlaceWhatsapp(t.paciente?.telefono) ? h('a.btn.btn-secundario.btn-ancho', { href: enlaceWhatsapp(t.paciente.telefono), target: '_blank', rel: 'noopener' }, h('span.icono-btn', { html: ICONOS.whatsapp }), `WhatsApp ${t.paciente.telefono}`) : null,
        h('a.btn.btn-secundario.btn-ancho', { href: `#/pacientes/${t.paciente_id}` }, 'Abrir ficha'),
        vigente ? h('button.btn.btn-secundario.btn-ancho', { type: 'button', onclick: despues(() => cambiarTurno(ctx.api, t, { dias: config.diasVisibles })) },
          t.estado === 'pendiente' ? 'Ofrecer cambio' : 'Cambiar horario') : null,
        h('p.titulo-paso', 'Cambiar estado'),
        h('div.botones-estado', opciones.map(([e, texto]) => {
          const peligro = ['cancelado', 'rechazado'].includes(e);
          const principal = e === 'confirmado' && t.estado === 'pendiente';
          if (principal) return h('button.btn.btn-chico.btn-primario', { type: 'button', onclick: despues(() => confirmarTurno(ctx.api, t)) }, texto);
          if (peligro) return h('button.btn.btn-chico.btn-peligro', { type: 'button', onclick: despues(() => cancelarTurno(ctx.api, t)) }, texto);
          const b = h('button.btn.btn-chico.btn-secundario', {
            type: 'button',
            onclick: () => conCarga(b, async () => {
              await ctx.api.cambiarEstadoTurno(t.id, e);
              aviso(`Turno: ${ESTADOS[e].toLowerCase()}.`);
              cerrar();
              ir(fecha);
            }),
          }, texto);
          return b;
        }))),
    });
  };

  const fila = (ms) => {
    const t = porHora.get(ms);
    const iso = new Date(ms).toISOString();
    const pasado = ms < ahora;
    if (!t) {
      return h('li.franja.libre', { class: pasado ? 'pasado' : '' },
        h('span.hora', hora(iso)),
        pasado ? h('span.texto-suave', 'Libre') : h('button.btn-libre', {
          type: 'button',
          onclick: async () => { if (await darTurno(ctx.api, { inicio: iso })) ir(fecha); },
        }, h('span.icono-btn', { html: ICONOS.mas }), 'Libre: asignar'));
    }
    return h('li.franja.ocupada', { class: pasado ? 'pasado' : '' },
      h('span.hora', hora(t.inicio)),
      h(`button.turno-btn${t.estado === 'pendiente' ? '.turno-pendiente' : ''}`, { type: 'button', onclick: () => menuTurno(t) },
        h('strong', nombreCompleto(t.paciente)),
        h('span', t.motivo, t.creado_por === 'paciente' ? h('span.etiqueta.etiqueta-online', 'Online') : null)),
      etiquetaEstado(t.estado));
  };

  // Cinta de la semana
  const conteo = new Map();
  for (const t of semana) if (esActivo(t)) {
    const f = new Date(t.inicio).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
    conteo.set(f, (conteo.get(f) || 0) + 1);
  }
  const cinta = h('div.semana', Array.from({ length: 7 }, (_, i) => {
    const f = sumarDias(lunes, i);
    const atiende = config.horarios.some((x) => x.dia === diaDeSemana(f)) && !config.bloqueos.some((b) => b.fecha === f);
    return h('a.dia-semana', {
      href: `#/agenda?fecha=${f}`, 'aria-current': f === fecha ? 'date' : null,
      class: `${atiende ? '' : 'sin-atencion'} ${f === hoy() ? 'es-hoy' : ''}`,
    }, h('span', DIAS_CORTOS[diaDeSemana(f)]), h('strong', String(Number(f.slice(8)))),
    h('small', conteo.get(f) ? `${conteo.get(f)}` : ' '));
  }));

  const selectorFecha = h('input.input-fecha', { type: 'date', value: fecha, 'aria-label': 'Ir a fecha', onchange: (e) => e.target.value && ir(e.target.value) });

  return h('div',
    encabezado('Agenda', null,
      h('button.btn.btn-primario', { type: 'button', onclick: async () => { if (await darTurno(ctx.api, { dias: config.diasVisibles })) ir(fecha); } }, h('span.icono-btn', { html: ICONOS.mas }), 'Dar turno')),
    h('div.nav-agenda',
      h('button.btn-icono', { type: 'button', 'aria-label': 'Semana anterior', onclick: () => ir(sumarDias(fecha, -7)), html: ICONOS.izquierda }),
      cinta,
      h('button.btn-icono', { type: 'button', 'aria-label': 'Semana siguiente', onclick: () => ir(sumarDias(fecha, 7)), html: ICONOS.derecha })),
    h('div.cabecera-dia',
      h('h2', mayuscula(fechaLarga(`${fecha}T12:00:00-03:00`))),
      h('div.cabecera-dia-acciones', fecha !== hoy() ? h('a.btn.btn-fantasma.btn-chico', { href: '#/agenda' }, 'Hoy') : null, selectorFecha)),
    h('section.panel.panel-agenda',
      bloqueo ? h('p.nota.nota-aviso', `Día bloqueado${bloqueo.motivo ? `: ${bloqueo.motivo}` : ''}. No se dan turnos online.`) : null,
      todos.length ? h('ul.lista-franjas', todos.map(fila))
        : h('p.texto-suave.vacio', bloqueo ? 'Sin turnos.' : 'No se atiende este día.')),
    cancelados.length ? h('details.cancelados', h('summary', `${cancelados.length} ${cancelados.length === 1 ? 'turno cancelado o rechazado' : 'turnos cancelados o rechazados'}`),
      h('ul.lista-simple', cancelados.map((t) => h('li.fila-turno', h('div', h('strong', `${hora(t.inicio)} ${nombreCompleto(t.paciente)}`), h('span.texto-suave', t.motivo)), etiquetaEstado(t.estado))))) : null);
}
