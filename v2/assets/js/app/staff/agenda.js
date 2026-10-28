import { h } from '../../lib/dom.js';
import { hoy, hora, fechaLarga, mayuscula, sumarDias, DIAS_CORTOS, diaDeSemana, partes, minutos } from '../../lib/dates.js';
import { turnosDelDia, filasExtendidas, bloqueosDelDia, bloqueoEn, dentroDeFranja, intervalos } from '../../lib/agenda.js';
import { aviso, conCarga, hoja } from '../../lib/ui.js';
import { encabezado, etiquetaEstado, etiquetaSobreturno, nombreCompleto, ESTADOS, ACCIONES, esActivo, enlaceWhatsapp } from '../comunes.js';
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
  const ahora = Date.now();
  const bloqueosHoy = bloqueosDelDia(fecha, config.bloqueos);
  const diaBloqueado = bloqueosHoy.find((b) => !b.hora_desde);
  const minDe = (iso) => minutos(partes(iso).hora);

  // Filas de 30 min: la franja de atención extendida (para sobreturnos) + los turnos que caigan fuera
  const activos = turnos.filter(esActivo);
  const ocupados = intervalos(activos);
  const porHora = new Map(activos.map((t) => [new Date(t.inicio).getTime(), t]));
  const inicios = new Set(turnosDelDia(fecha, config).map((i) => new Date(i).getTime()));
  const todos = [...new Set([...filasExtendidas(fecha, config).map((i) => new Date(i).getTime()), ...porHora.keys()])].sort((a, b) => a - b);
  const cancelados = turnos.filter((t) => !esActivo(t));
  const pisa = (ini, fin) => ocupados.some((o) => new Date(o.inicio).getTime() < fin && new Date(o.fin).getTime() > ini);
  // Turno que sigue ocupando esta fila (empezó antes)
  const continua = (ms) => activos.find((t, i) => new Date(t.inicio).getTime() < ms && new Date(ocupados[i].fin).getTime() > ms);

  const menuTurno = (t) => {
    const opciones = ACCIONES[t.estado] || [];
    const vigente = new Date(t.inicio).getTime() > ahora && ['pendiente', 'confirmado'].includes(t.estado);
    // Las acciones que avisan al paciente cierran este menú y abren su propia ventana
    const despues = (fn) => async () => { cerrar(); if (await fn()) ir(fecha); };
    const { cerrar } = hoja({
      titulo: nombreCompleto(t.paciente),
      ancho: 'chico',
      cuerpo: h('div.menu-turno',
        h('p.texto-suave', `${mayuscula(fechaLarga(t.inicio))}, ${hora(t.inicio)} h. ${t.motivo}.`, ' ', etiquetaSobreturno(t)),
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
    const m = minDe(iso);

    if (t) {
      const fin = ocupados[activos.indexOf(t)].fin;
      // Turno común que quedó en un horario bloqueado: marcar para reprogramar
      const enBloqueo = !t.sobreturno && !pasado && bloqueoEn(fecha, m, minDe(fin), config.bloqueos);
      return h('li.franja.ocupada', { class: `${pasado ? 'pasado' : ''} ${t.sobreturno ? 'es-sobreturno' : ''}` },
        h('span.hora', hora(t.inicio), h('small', hora(fin))),
        h(`button.turno-btn${t.estado === 'pendiente' ? '.turno-pendiente' : ''}${t.sobreturno ? '.turno-sobreturno' : ''}`, { type: 'button', onclick: () => menuTurno(t) },
          h('strong', nombreCompleto(t.paciente)),
          h('span', t.motivo,
            etiquetaSobreturno(t),
            t.creado_por === 'paciente' ? h('span.etiqueta.etiqueta-online', 'Online') : null,
            enBloqueo ? h('span.etiqueta.etiqueta-bloqueo', 'En horario bloqueado: reprogramar') : null)),
        etiquetaEstado(t.estado));
    }

    const sigue = continua(ms);
    if (sigue) {
      return h('li.franja.continua', { class: pasado ? 'pasado' : '' },
        h('span.hora', hora(iso)), h('span.texto-suave', `Ocupado · ${nombreCompleto(sigue.paciente)}`));
    }

    // Hueco libre de 30 min
    const dentro = dentroDeFranja(fecha, config, m, m + 30);
    const bloq = bloqueoEn(fecha, m, m + 30, config.bloqueos);
    const entraTurno = inicios.has(ms) && !pisa(ms, ms + config.duracion * 60000) && !bloqueoEn(fecha, m, m + config.duracion, config.bloqueos);
    const estado = bloq ? `Bloqueado${bloq.motivo ? `: ${bloq.motivo}` : ''}` : dentro ? 'Libre' : 'Fuera de horario';
    const clase = bloq ? 'bloqueada' : dentro ? 'libre' : 'extendida';
    const acciones = pasado ? null : h('div.acciones-franja',
      entraTurno ? h('button.btn-libre', {
        type: 'button',
        onclick: async () => { if (await darTurno(ctx.api, { inicio: iso })) ir(fecha); },
      }, h('span.icono-btn', { html: ICONOS.mas }), 'Asignar') : null,
      h('button.btn-sobreturno', {
        type: 'button',
        title: 'Sobreturno de 30 minutos',
        onclick: async () => { if (await darTurno(ctx.api, { inicio: iso, sobreturno: true })) ir(fecha); },
      }, h('span.icono-btn', { html: ICONOS.mas }), 'Sobreturno'));
    return h(`li.franja.${clase}`, { class: pasado ? 'pasado' : '' },
      h('span.hora', hora(iso)), h('span.estado-franja', estado), acciones);
  };

  // Cinta de la semana
  const conteo = new Map();
  for (const t of semana) if (esActivo(t)) {
    const f = new Date(t.inicio).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
    conteo.set(f, (conteo.get(f) || 0) + 1);
  }
  const cinta = h('div.semana', Array.from({ length: 7 }, (_, i) => {
    const f = sumarDias(lunes, i);
    const atiende = config.horarios.some((x) => x.dia === diaDeSemana(f)) && !bloqueosDelDia(f, config.bloqueos).some((b) => !b.hora_desde);
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
      diaBloqueado ? h('p.nota.nota-aviso', `Día bloqueado${diaBloqueado.motivo ? `: ${diaBloqueado.motivo}` : ''}. Solo se pueden dar sobreturnos.`) : null,
      !diaBloqueado && bloqueosHoy.length ? h('p.nota.nota-aviso', `Horario bloqueado: ${bloqueosHoy.map((b) => `${b.hora_desde} a ${b.hora_hasta} h${b.motivo ? ` (${b.motivo})` : ''}`).join(', ')}. Solo se pueden dar sobreturnos ahí.`) : null,
      todos.length ? h('ul.lista-franjas', todos.map(fila))
        : h('p.texto-suave.vacio', 'No se atiende este día.')),
    cancelados.length ? h('details.cancelados', h('summary', `${cancelados.length} ${cancelados.length === 1 ? 'turno cancelado o rechazado' : 'turnos cancelados o rechazados'}`),
      h('ul.lista-simple', cancelados.map((t) => h('li.fila-turno', h('div', h('strong', `${hora(t.inicio)} ${nombreCompleto(t.paciente)}`), h('span.texto-suave', t.motivo)), etiquetaEstado(t.estado))))) : null);
}
