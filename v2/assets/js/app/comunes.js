// Piezas de interfaz que comparten el espacio del paciente y la intranet.
import { h, vaciar } from '../lib/dom.js';
import { cargando, mensajeError } from '../lib/ui.js';
import { hoy, partes, hora, fechaLarga, DIAS_CORTOS, mayuscula, diaDeSemana } from '../lib/dates.js';
import { ICONOS } from './iconos.js';
import { CONSULTORIO } from '../../../config.js';

export const ESTADOS = {
  pendiente: 'Por confirmar',
  confirmado: 'Confirmado',
  atendido: 'Atendido',
  ausente: 'No vino',
  cancelado: 'Cancelado',
  rechazado: 'No confirmado',
};

/** Un turno activo ocupa su horario (incluye pedidos pendientes). */
export const esActivo = (t) => !['cancelado', 'rechazado'].includes(t.estado);

/** Cambios de estado que puede hacer el personal desde cada estado: [estado nuevo, texto del botón]. */
export const ACCIONES = {
  pendiente: [['rechazado', 'Cancelar pedido'], ['confirmado', 'Confirmar']],
  confirmado: [['atendido', 'Atendido'], ['ausente', 'No vino'], ['cancelado', 'Cancelar turno']],
  atendido: [['ausente', 'No vino'], ['confirmado', 'Volver a confirmado']],
  ausente: [['atendido', 'Atendido'], ['confirmado', 'Volver a confirmado']],
};

export const MOTIVOS = ['Consulta', 'Control de ortodoncia', 'Limpieza', 'Dolor o urgencia', 'Estética', 'Otro'];

export const nombreCompleto = (p) => (p ? `${p.apellido}, ${p.nombre}` : 'Paciente sin datos');

export function encabezado(titulo, bajada, ...acciones) {
  return h('header.encabezado',
    h('div', h('h1', titulo), bajada ? h('p.texto-suave', bajada) : null),
    acciones.length ? h('div.encabezado-acciones', ...acciones) : null);
}

/** Etiqueta dorada de los sobreturnos. */
export const etiquetaSobreturno = (t) => (t?.sobreturno ? h('span.etiqueta.etiqueta-sobreturno', 'Sobreturno') : null);

export const etiquetaEstado = (estado) => h(`span.etiqueta.etiqueta-${estado}`, ESTADOS[estado] || estado);

export function bloqueFecha(iso) {
  const p = partes(iso);
  const [, m, d] = p.fecha.split('-');
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return h('div.bloque-fecha', { 'aria-hidden': 'true' },
    h('span.bf-dia', DIAS_CORTOS[p.dia]), h('strong', String(Number(d))), h('span.bf-mes', meses[Number(m) - 1]));
}

export function linkWhatsapp(texto = 'Escribir por WhatsApp', mensaje = '') {
  return h('a.btn.btn-secundario', { href: `https://wa.me/${CONSULTORIO.whatsapp}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ''}`, target: '_blank', rel: 'noopener' },
    h('span.icono-btn', { html: ICONOS.whatsapp }), texto);
}

/**
 * Enlace de WhatsApp a un celular argentino cargado como venga (con espacios, 0, 15, +54...).
 * Devuelve null si no se puede armar un número de 10 dígitos (por ejemplo, sin característica).
 */
export function enlaceWhatsapp(telefono, mensaje = '') {
  let d = (telefono || '').replace(/\D/g, '').replace(/^00/, '');
  if (d.startsWith('54')) d = d.slice(2).replace(/^9/, '');
  d = d.replace(/^0/, '');
  if (d.length === 12) {
    // Sacar el 15 que va después de la característica (2, 3 o 4 dígitos)
    const largo = [2, 3, 4].find((n) => d.slice(n, n + 2) === '15');
    if (largo) d = d.slice(0, largo) + d.slice(largo + 2);
  }
  if (d.length !== 10) return null;
  return `https://wa.me/549${d}${mensaje ? `?text=${encodeURIComponent(mensaje)}` : ''}`;
}

/** Abre un email nuevo en Gmail (la cuenta del consultorio) con destinatario, asunto y texto. */
export function enlaceCorreo(email, asunto = '', texto = '') {
  if (!email) return null;
  const q = new URLSearchParams({ view: 'cm', fs: '1', to: email, su: asunto, body: texto });
  return `https://mail.google.com/mail/?${q}`;
}

/**
 * Selector de día y horario a partir de la agenda real.
 * alElegir(iso) se llama cuando se toca un horario.
 * sobreturno: muestra los huecos de sobreturno (solo personal) en lugar de los horarios de la agenda.
 * conFecha (solo personal): permite buscar desde cualquier fecha futura, sin el límite de días que tienen los
 * pacientes (por ejemplo, el control del mes que viene de un plan de tratamiento). Muestra `dias` días desde esa fecha.
 */
export function selectorHorario({ api, dias, alElegir, sobreturno = false, conFecha = false }) {
  const contenido = h('div', cargando());
  let datos = [];
  let fechaSel = null;
  let isoSel = null;
  let pedido = 0; // descarta respuestas viejas si se cambia la fecha rápido

  const cintaDias = h('div.cinta-dias', { role: 'tablist', 'aria-label': 'Días con horarios libres' });
  const grilla = h('div.grilla-horarios');
  const tituloDia = h('h3.titulo-dia');

  function pintar() {
    vaciar(cintaDias, datos.map((d) => {
      const [, m, dd] = d.fecha.split('-');
      const sel = d.fecha === fechaSel;
      return h('button.chip-dia', {
        type: 'button', role: 'tab', 'aria-selected': String(sel),
        onclick: () => { fechaSel = d.fecha; isoSel = null; pintar(); },
      }, h('span', DIAS_CORTOS[diaDeSemana(d.fecha)]), h('strong', String(Number(dd))), h('span', `/${Number(m)}`));
    }));
    const dia = datos.find((d) => d.fecha === fechaSel);
    const unidad = sobreturno ? ['hueco para sobreturno', 'huecos para sobreturno'] : ['horario libre', 'horarios libres'];
    tituloDia.textContent = dia ? `${mayuscula(fechaLarga(dia.horarios[0]))}: ${dia.horarios.length} ${unidad[dia.horarios.length === 1 ? 0 : 1]}` : '';
    vaciar(grilla, (dia?.horarios || []).map((iso) => h('button.chip-hora', {
      type: 'button', 'aria-pressed': String(iso === isoSel),
      onclick: () => { isoSel = iso; pintar(); alElegir(iso); },
    }, hora(iso))));
  }

  async function cargar(desde) {
    const este = ++pedido;
    vaciar(contenido, cargando());
    try {
      const r = sobreturno ? await api.horariosSobreturno(desde, dias) : await api.horariosLibres(desde, dias);
      if (este !== pedido) return;
      datos = r;
      isoSel = null;
      if (!datos.length) {
        vaciar(contenido, conFecha
          ? h('p.texto-suave', sobreturno ? 'No hay huecos para sobreturnos en esos días. Probá desde otra fecha.' : 'No hay horarios libres en esos días. Probá desde otra fecha.')
          : sobreturno
            ? h('p.texto-suave', 'No hay huecos para sobreturnos en los próximos días.')
            : h('div.vacio', h('p', 'No quedan horarios libres en los próximos días.'), linkWhatsapp('Consultar por WhatsApp')));
        return;
      }
      fechaSel = datos[0].fecha;
      vaciar(contenido, cintaDias, tituloDia, grilla);
      pintar();
    } catch (e) {
      if (este === pedido) vaciar(contenido, h('p.error-campo', mensajeError(e)));
    }
  }

  if (!conFecha) {
    cargar(hoy());
    return h('div.selector-horario', contenido);
  }

  // Personal: buscar desde cualquier fecha (la agenda no tiene límite hacia adelante para el consultorio)
  const desde = h('input', { type: 'date', min: hoy(), value: hoy(), 'aria-label': 'Buscar horarios desde' });
  const ir = (f) => { desde.value = f; cargar(f); };
  desde.onchange = () => { if (desde.value && desde.value >= hoy()) cargar(desde.value); };
  const atajo = (texto, f) => h('button.chip-atajo', { type: 'button', onclick: () => ir(f) }, texto);
  const enMeses = (n) => {
    const [a, m, d] = hoy().split('-').map(Number);
    const x = new Date(Date.UTC(a, m - 1 + n, 1));
    const ultimo = new Date(Date.UTC(x.getUTCFullYear(), x.getUTCMonth() + 1, 0)).getUTCDate();
    x.setUTCDate(Math.min(d, ultimo));
    return x.toISOString().slice(0, 10);
  };
  cargar(hoy());
  return h('div.selector-horario',
    h('div.buscar-desde',
      h('label.campo', h('span', 'Buscar desde'), desde),
      h('div.atajos-fecha', atajo('Hoy', hoy()), atajo('En 1 mes', enMeses(1)), atajo('En 2 meses', enMeses(2)))),
    contenido);
}

export function avisoSinFicha() {
  return h('div.nota.nota-aviso',
    h('span.nota-icono', { html: ICONOS.alerta }),
    h('div',
      h('strong', 'Tu cuenta todavía no está vinculada a tu ficha'),
      h('p', 'Ya tenemos una ficha con tu DNI. Recepción la va a vincular a tu cuenta; si es urgente, escribinos.'),
      linkWhatsapp('Escribir por WhatsApp', 'Hola, me registré en Mi espacio y necesito vincular mi cuenta.')));
}
