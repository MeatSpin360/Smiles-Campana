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
  pendiente: [['rechazado', 'Rechazar'], ['confirmado', 'Confirmar']],
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
 */
export function selectorHorario({ api, dias, alElegir }) {
  const el = h('div.selector-horario', cargando());
  let datos = [];
  let fechaSel = null;
  let isoSel = null;

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
    tituloDia.textContent = dia ? `${mayuscula(fechaLarga(dia.horarios[0]))}: ${dia.horarios.length} ${dia.horarios.length === 1 ? 'horario libre' : 'horarios libres'}` : '';
    vaciar(grilla, (dia?.horarios || []).map((iso) => h('button.chip-hora', {
      type: 'button', 'aria-pressed': String(iso === isoSel),
      onclick: () => { isoSel = iso; pintar(); alElegir(iso); },
    }, hora(iso))));
  }

  (async () => {
    try {
      datos = await api.horariosLibres(hoy(), dias);
      if (!datos.length) {
        vaciar(el, h('div.vacio', h('p', 'No quedan horarios libres en los próximos días.'), linkWhatsapp('Consultar por WhatsApp')));
        return;
      }
      fechaSel = datos[0].fecha;
      vaciar(el, cintaDias, tituloDia, grilla);
      pintar();
    } catch (e) {
      vaciar(el, h('p.error-campo', mensajeError(e)));
    }
  })();

  return el;
}

export function avisoSinFicha() {
  return h('div.nota.nota-aviso',
    h('span.nota-icono', { html: ICONOS.alerta }),
    h('div',
      h('strong', 'Tu cuenta todavía no está vinculada a tu ficha'),
      h('p', 'Ya tenemos una ficha con tu DNI. Recepción la va a vincular a tu cuenta; si es urgente, escribinos.'),
      linkWhatsapp('Escribir por WhatsApp', 'Hola, me registré en Mi espacio y necesito vincular mi cuenta.')));
}
