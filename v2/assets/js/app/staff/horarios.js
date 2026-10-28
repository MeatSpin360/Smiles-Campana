import { h, vaciar } from '../../lib/dom.js';
import { aviso, conCarga, confirmar } from '../../lib/ui.js';
import { DIAS, hoy, mayuscula, minutos, diaDeSemana } from '../../lib/dates.js';
import { describirBloqueo } from '../../lib/agenda.js';
import { encabezado } from '../comunes.js';
import { ICONOS } from '../iconos.js';

const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0];

export async function horarios(ctx) {
  const cfg = await ctx.api.agenda();
  let franjas = cfg.horarios.map((x) => ({ ...x }));

  const opciones = (lista, valor, texto) => lista.map((m) => h('option', { value: m, selected: m === valor }, texto(m)));
  const duracion = h('select', { name: 'duracion' }, opciones([15, 20, 30, 40, 45, 60, 90], cfg.duracion, (m) => `${m} minutos`));
  const intervalo = h('select', { name: 'intervalo' }, opciones([15, 20, 30, 60], cfg.intervalo ?? cfg.duracion, (m) => `${m} minutos`));
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
          intervalo: Number(intervalo.value),
          diasVisibles: Number(diasVisibles.value) || 30,
          horasCancelacion: Number(horasCancel.value) || 0,
          horarios: franjas,
        });
        aviso('Horarios guardados. El sitio y los turnos online ya usan los nuevos.');
      });
    },
  }, 'Guardar horarios');

  // ---------- Bloqueos ----------
  const fechaBloq = h('input', { type: 'date', min: hoy(), required: true });
  const todoElDia = h('input', { type: 'checkbox', checked: true });
  const horaDesde = h('input', { type: 'time', step: 300, value: '15:00', disabled: true });
  const horaHasta = h('input', { type: 'time', step: 300, value: '18:00', disabled: true });
  const repetir = h('input', { type: 'checkbox' });
  const hastaFecha = h('input', { type: 'date', disabled: true });
  const motivoBloq = h('input', { placeholder: 'Feriado, congreso, facultad…' });
  const textoRepetir = h('span', 'Repetir todas las semanas');
  const errBloq = h('p.error-campo', { hidden: true });

  const actualizarForm = () => {
    horaDesde.disabled = horaHasta.disabled = todoElDia.checked;
    hastaFecha.disabled = !repetir.checked;
    hastaFecha.min = fechaBloq.value || hoy();
    textoRepetir.textContent = fechaBloq.value ? `Repetir todos los ${DIAS[diaDeSemana(fechaBloq.value)]}${DIAS[diaDeSemana(fechaBloq.value)].endsWith('s') ? '' : 's'}` : 'Repetir todas las semanas';
  };
  [todoElDia, repetir, fechaBloq].forEach((x) => x.addEventListener('change', actualizarForm));

  const agregarBloq = h('button.btn.btn-secundario', {
    type: 'button',
    onclick: () => {
      errBloq.hidden = true;
      const falla = (m) => { errBloq.textContent = m; errBloq.hidden = false; };
      if (!fechaBloq.value) return falla('Elegí una fecha.');
      if (!todoElDia.checked && (!horaDesde.value || !horaHasta.value || minutos(horaHasta.value) <= minutos(horaDesde.value))) {
        return falla('El horario de fin del bloqueo tiene que ser posterior al de inicio.');
      }
      if (repetir.checked && hastaFecha.value && hastaFecha.value < fechaBloq.value) return falla('La fecha de fin de la repetición tiene que ser posterior al inicio.');
      return conCarga(agregarBloq, async () => {
        await ctx.api.agregarBloqueo({
          fecha: fechaBloq.value,
          hora_desde: todoElDia.checked ? null : horaDesde.value,
          hora_hasta: todoElDia.checked ? null : horaHasta.value,
          repetir: repetir.checked,
          hasta_fecha: repetir.checked ? hastaFecha.value || null : null,
          motivo: motivoBloq.value.trim(),
        });
        aviso('Bloqueo agregado. Esos horarios ya no se ofrecen online.');
        ctx.navegar('/horarios');
      });
    },
  }, 'Agregar bloqueo');

  const formBloqueo = h('div.form-bloqueo',
    h('div.fila-campos',
      h('label.campo', h('span', 'Fecha'), fechaBloq),
      h('label.campo', h('span', 'Motivo'), motivoBloq)),
    h('div.fila-bloqueo-horas',
      h('label.check-linea', todoElDia, h('span', 'Todo el día')),
      h('div.rango-horas', h('span', 'De'), horaDesde, h('span', 'a'), horaHasta)),
    h('div.fila-bloqueo-horas',
      h('label.check-linea', repetir, textoRepetir),
      h('div.rango-horas', h('span', 'Hasta'), hastaFecha, h('small.texto-suave', 'Vacío: sin fin'))),
    errBloq,
    h('div.acciones-form', agregarBloq));

  const listaBloqueos = cfg.bloqueos.length ? h('ul.lista-simple', cfg.bloqueos.map((b) => {
    const quitar = h('button.btn.btn-fantasma.btn-chico', {
      type: 'button',
      onclick: async () => {
        if (!(await confirmar(`${describirBloqueo(b)}. Esos horarios vuelven a ofrecerse online.`, { titulo: 'Quitar bloqueo', aceptar: 'Quitar' }))) return;
        await conCarga(quitar, async () => { await ctx.api.quitarBloqueo(b.id); ctx.navegar('/horarios'); });
      },
    }, 'Quitar');
    return h('li.fila-turno',
      h('div', h('strong', describirBloqueo(b)), b.motivo ? h('span.texto-suave', b.motivo) : null,
        b.repetir ? h('span.etiqueta.etiqueta-repite', 'Se repite') : null),
      quitar);
  })) : h('p.texto-suave', 'No hay bloqueos cargados.');

  return h('div',
    encabezado('Horarios', 'Definen los turnos que ven los pacientes y los horarios del sitio.'),
    h('section.panel',
      h('h2', 'Días y horarios de atención'),
      semana,
      h('div.fila-campos.config-turnos',
        h('label.campo', h('span', 'Duración de cada turno'), duracion, h('small', 'Los sobreturnos duran 30 minutos.')),
        h('label.campo', h('span', 'Ofrecer un inicio cada'), intervalo, h('small', 'Por ejemplo, turnos de 60 min que empiezan cada 30.')),
        h('label.campo', h('span', 'Días que se pueden reservar'), diasVisibles, h('small', 'Hacia adelante, desde hoy.')),
        h('label.campo', h('span', 'Cancelación online hasta'), horasCancel, h('small', 'Horas antes del turno.'))),
      h('p.texto-suave.nota-chica', `Sobreturnos: 30 minutos, solo los da el personal, hasta ${cfg.margenSobreturno ?? 60} minutos antes o después de cada franja y también en horarios bloqueados.`),
      err,
      h('div.acciones-form', guardar)),
    h('section.panel',
      h('h2', 'Días y horarios sin atención'),
      h('p.texto-suave', 'En estos horarios no se ofrecen turnos online ni turnos comunes; solo se pueden dar sobreturnos. Los turnos ya dados no se cancelan solos: la agenda los marca para reprogramar.'),
      formBloqueo,
      h('h3.titulo-paso', 'Bloqueos cargados'),
      listaBloqueos));
}
