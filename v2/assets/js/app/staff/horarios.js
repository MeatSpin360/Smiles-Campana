import { h, vaciar } from '../../lib/dom.js';
import { aviso, conCarga } from '../../lib/ui.js';
import { DIAS, hoy, fechaLarga, mayuscula, minutos } from '../../lib/dates.js';
import { encabezado } from '../comunes.js';
import { ICONOS } from '../iconos.js';

const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0];

export async function horarios(ctx) {
  const cfg = await ctx.api.agenda();
  let franjas = cfg.horarios.map((x) => ({ ...x }));

  const duracion = h('select', { name: 'duracion' }, [15, 20, 30, 40, 45, 60].map((m) => h('option', { value: m, selected: m === cfg.duracion }, `${m} minutos`)));
  const diasVisibles = h('input', { type: 'number', min: 1, max: 120, value: cfg.diasVisibles });
  const horasCancel = h('input', { type: 'number', min: 0, max: 168, value: cfg.horasCancelacion ?? 12 });
  const semana = h('div.semana-horarios');
  const err = h('p.error-campo', { hidden: true });

  function pintarSemana() {
    vaciar(semana, ORDEN_DIAS.map((d) => {
      const delDia = franjas.filter((f) => f.dia === d);
      return h('div.dia-horario', { class: delDia.length ? 'atiende' : '' },
        h('strong.dia-nombre', mayuscula(DIAS[d])),
        h('div.dia-franjas',
          delDia.length ? delDia.map((f) => h('div.franja-edit',
            h('input', { type: 'time', value: f.desde, step: 300, 'aria-label': `${DIAS[d]} desde`, onchange: (e) => { f.desde = e.target.value; } }),
            h('span', 'a'),
            h('input', { type: 'time', value: f.hasta, step: 300, 'aria-label': `${DIAS[d]} hasta`, onchange: (e) => { f.hasta = e.target.value; } }),
            h('button.btn-icono', { type: 'button', 'aria-label': 'Quitar franja', onclick: () => { franjas = franjas.filter((x) => x !== f); pintarSemana(); }, html: '<svg viewBox="0 0 24 24" width="18" height="18"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' })))
            : h('span.texto-suave', 'No se atiende'),
          h('button.btn.btn-fantasma.btn-chico', { type: 'button', onclick: () => { franjas.push({ dia: d, desde: '09:00', hasta: '13:00' }); pintarSemana(); } },
            h('span.icono-btn', { html: ICONOS.mas }), 'Agregar franja')));
    }));
  }
  pintarSemana();

  const guardar = h('button.btn.btn-primario', {
    type: 'button',
    onclick: () => {
      err.hidden = true;
      const malas = franjas.filter((f) => !f.desde || !f.hasta || minutos(f.hasta) <= minutos(f.desde));
      if (malas.length) {
        err.textContent = `Revisá ${DIAS[malas[0].dia]}: el horario de fin tiene que ser posterior al de inicio.`;
        err.hidden = false;
        return;
      }
      conCarga(guardar, async () => {
        await ctx.api.guardarAgenda({
          duracion: Number(duracion.value),
          diasVisibles: Number(diasVisibles.value) || 30,
          horasCancelacion: Number(horasCancel.value) || 0,
          horarios: franjas,
        });
        aviso('Horarios guardados. El sitio y los turnos online ya usan los nuevos.');
      });
    },
  }, 'Guardar horarios');

  // Bloqueos
  const fechaBloq = h('input', { type: 'date', min: hoy() });
  const motivoBloq = h('input', { placeholder: 'Feriado, vacaciones, congreso…' });
  const agregarBloq = h('button.btn.btn-secundario', {
    type: 'button',
    onclick: () => {
      if (!fechaBloq.value) return aviso('Elegí una fecha.', 'error');
      return conCarga(agregarBloq, async () => {
        await ctx.api.agregarBloqueo(fechaBloq.value, motivoBloq.value.trim());
        aviso('Día bloqueado.');
        ctx.navegar('/horarios');
      });
    },
  }, 'Bloquear día');

  return h('div',
    encabezado('Horarios', 'Definen los turnos que ven los pacientes y los horarios del sitio.'),
    h('section.panel',
      h('h2', 'Días y horarios de atención'),
      semana,
      h('div.fila-campos.config-turnos',
        h('label.campo', h('span', 'Duración de cada turno'), duracion),
        h('label.campo', h('span', 'Días que se pueden reservar'), diasVisibles, h('small', 'Hacia adelante, desde hoy.')),
        h('label.campo', h('span', 'Cancelación online hasta'), horasCancel, h('small', 'Horas antes del turno.'))),
      err,
      h('div.acciones-form', guardar)),
    h('section.panel',
      h('h2', 'Días sin atención'),
      h('p.texto-suave', 'En estos días no se ofrecen turnos online. Los turnos ya dados no se cancelan solos.'),
      h('div.fila-campos.fila-bloqueo', h('label.campo', h('span', 'Fecha'), fechaBloq), h('label.campo', h('span', 'Motivo'), motivoBloq), h('div.acciones-form', agregarBloq)),
      cfg.bloqueos.length ? h('ul.lista-simple', cfg.bloqueos.map((b) => {
        const quitar = h('button.btn.btn-fantasma.btn-chico', {
          type: 'button',
          onclick: () => conCarga(quitar, async () => { await ctx.api.quitarBloqueo(b.fecha); ctx.navegar('/horarios'); }),
        }, 'Quitar');
        return h('li.fila-turno', h('div', h('strong', mayuscula(fechaLarga(`${b.fecha}T12:00:00-03:00`))), b.motivo ? h('span.texto-suave', b.motivo) : null), quitar);
      })) : h('p.texto-suave', 'No hay días bloqueados.')));
}
