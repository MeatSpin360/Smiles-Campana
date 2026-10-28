// Acciones del personal sobre un turno vigente: confirmar, ofrecer cambio o cambiar horario, y cancelar.
// Se usan igual desde Hoy, la Agenda y la ficha del paciente.
//
// Avisos al paciente:
//   1. Si tiene correo (y los correos están activos), el aviso sale solo desde la base.
//   2. Si no, pero tiene celular, se ofrece avisarle por WhatsApp con el mensaje ya escrito.
//   3. Sin datos de contacto, no se avisa.
import { h, vaciar } from '../../lib/dom.js';
import { hoja, aviso, confirmar, mensajeError } from '../../lib/ui.js';
import { fechaLarga, hora } from '../../lib/dates.js';
import { nombreCompleto, selectorHorario, enlaceWhatsapp, enlaceCorreo } from '../comunes.js';
import { ICONOS } from '../iconos.js';
import { CONSULTORIO, AVISOS } from '../../../../config.js';

const cuando = (iso) => `${fechaLarga(iso).replace(',', '')} a las ${hora(iso)} h`;
const direccion = CONSULTORIO.direccion.split(',')[0];

const MENSAJE = {
  confirmado: (n, t) => `Hola ${n}, te confirmamos tu turno en Smiles Campana para el ${cuando(t.inicio)}. Te esperamos en ${direccion}.`,
  rechazado: (n, t) => `Hola ${n}, te escribimos de Smiles Campana: no pudimos confirmar el turno que pediste para el ${cuando(t.inicio)}. Si querés, coordinamos otro horario por acá.`,
  cancelado: (n, t) => `Hola ${n}, te escribimos de Smiles Campana: tuvimos que cancelar tu turno del ${cuando(t.inicio)}. Si querés, coordinamos otro horario por acá.`,
  ofrecerPedido: (n, t) => `Hola ${n}, te escribimos de Smiles Campana por el turno que pediste para el ${cuando(t.inicio)}. Ese horario no lo tenemos disponible: ¿te sirve otro día u horario?`,
  ofrecerTurno: (n, t) => `Hola ${n}, te escribimos de Smiles Campana por tu turno del ${cuando(t.inicio)}. Necesitamos cambiarlo: ¿te sirve otro día u horario?`,
};

/** ¿Al paciente le llega el aviso por correo automáticamente? */
export const avisaPorCorreo = (paciente) => AVISOS.correo && !!paciente?.email;

/** Plan B: sin correo pero con celular, ofrecer el aviso por WhatsApp. Resuelve al cerrar. */
function ofrecerWhatsapp(paciente, texto, titulo) {
  const wa = enlaceWhatsapp(paciente?.telefono, texto);
  if (avisaPorCorreo(paciente) || !wa) return Promise.resolve();
  return new Promise((resolve) => {
    const enviar = h('a.btn.btn-primario', { href: wa, target: '_blank', rel: 'noopener' },
      h('span.icono-btn', { html: ICONOS.whatsapp }), 'Avisar por WhatsApp');
    const no = h('button.btn.btn-secundario', { type: 'button' }, 'No avisar');
    const motivo = paciente.email ? '' : `${paciente.nombre} no tiene correo cargado. `;
    const { cerrar } = hoja({
      titulo,
      ancho: 'chico',
      alCerrar: resolve,
      cuerpo: [h('p', `${motivo}¿Le avisás por WhatsApp? El mensaje ya está escrito; lo podés editar antes de enviarlo.`),
        h('blockquote.mensaje-previo', texto)],
      pie: [no, enviar],
    });
    no.onclick = cerrar;
    enviar.addEventListener('click', () => setTimeout(cerrar, 300));
  });
}

/** Confirma un pedido pendiente. */
export async function confirmarTurno(api, t) {
  await api.cambiarEstadoTurno(t.id, 'confirmado');
  aviso(avisaPorCorreo(t.paciente) ? 'Turno confirmado. Le enviamos un correo.' : 'Turno confirmado.');
  await ofrecerWhatsapp(t.paciente, MENSAJE.confirmado(t.paciente?.nombre, t), 'Turno confirmado');
  return true;
}

/** Cancela un pedido (queda "No confirmado") o un turno confirmado. Pide confirmación. */
export async function cancelarTurno(api, t) {
  const pedido = t.estado === 'pendiente';
  const titulo = pedido ? 'Cancelar pedido' : 'Cancelar turno';
  const aviso_ = avisaPorCorreo(t.paciente) ? ' Le avisamos por correo.' : '';
  const ok = await confirmar(`${nombreCompleto(t.paciente)}, ${cuando(t.inicio)}. El horario queda libre.${aviso_}`,
    { titulo, aceptar: titulo, peligro: true });
  if (!ok) return false;
  try {
    await api.cambiarEstadoTurno(t.id, pedido ? 'rechazado' : 'cancelado');
  } catch (e) {
    aviso(mensajeError(e), 'error');
    return false;
  }
  aviso(pedido ? 'Pedido cancelado. El horario quedó libre.' : 'Turno cancelado. El horario quedó libre.');
  await ofrecerWhatsapp(t.paciente, MENSAJE[pedido ? 'rechazado' : 'cancelado'](t.paciente?.nombre, t), titulo);
  return true;
}

/**
 * Ofrecer cambio (pedido pendiente) o cambiar horario (turno confirmado), en dos pasos:
 * 1. contactar al paciente (WhatsApp primero si tiene ambos); en un pedido, queda marcado "Cambio ofrecido";
 * 2. elegir el horario acordado: el turno pasa a ese horario y queda confirmado.
 * Resuelve true si algo cambió (para recargar la vista).
 */
export function cambiarTurno(api, t, { dias = 30 } = {}) {
  return new Promise((resolve) => {
    const pedido = t.estado === 'pendiente';
    const p = t.paciente || {};
    let huboCambios = false;
    const texto = MENSAJE[pedido ? 'ofrecerPedido' : 'ofrecerTurno'](p.nombre, t);
    const wa = enlaceWhatsapp(p.telefono, texto);
    const mail = enlaceCorreo(p.email, 'Tu turno en Smiles Campana', `${texto}\n\n`);

    const estadoOferta = h('p.oferta-hecha', { hidden: !t.cambio_ofrecido_en },
      h('span.icono-btn', { html: ICONOS.check }), 'Cambio ofrecido: el pedido sigue reservando su horario mientras coordinan.');
    const marcarOfrecido = () => {
      if (!pedido || t.cambio_ofrecido_en) return;
      t.cambio_ofrecido_en = new Date().toISOString();
      estadoOferta.hidden = false;
      huboCambios = true;
      api.ofrecerCambio(t.id).catch((e) => aviso(mensajeError(e), 'error'));
    };
    const contacto = (href, icono, etiqueta, principal) => h(`a.btn${principal ? '.btn-primario' : '.btn-secundario'}`,
      { href, target: '_blank', rel: 'noopener', onclick: marcarOfrecido }, h('span.icono-btn', { html: ICONOS[icono] }), etiqueta);

    const paso1 = h('section.paso-cambio',
      h('h3.titulo-paso', h('span.numero-paso', '1'), 'Coordiná el nuevo horario con el paciente'),
      wa || mail
        ? h('div.contacto-cambio',
          wa ? contacto(wa, 'whatsapp', 'Escribir por WhatsApp', true) : null,
          mail ? contacto(mail, 'correo', 'Escribir un correo', !wa) : null)
        : h('p.texto-suave', 'No tiene celular ni correo cargados. Coordinalo por otro medio.'),
      estadoOferta);

    const horario = h('div');
    const paso2 = h('section.paso-cambio',
      h('h3.titulo-paso', h('span.numero-paso', '2'), 'Elegí el horario acordado'),
      h('p.texto-suave.nota-chica', avisaPorCorreo(p)
        ? 'El turno queda confirmado en el horario nuevo y le enviamos un correo con el cambio.'
        : 'El turno queda confirmado en el horario nuevo.'),
      horario);

    const { cerrar } = hoja({
      titulo: pedido ? 'Ofrecer cambio' : 'Cambiar horario',
      ancho: 'ancho',
      alCerrar: () => resolve(huboCambios),
      cuerpo: [
        h('div.resumen-cambio',
          h('strong', nombreCompleto(p)),
          h('span.texto-suave', `${pedido ? 'Pidió' : 'Turno actual'}: ${cuando(t.inicio)}. ${t.motivo || ''}`)),
        paso1, paso2],
    });

    vaciar(horario, selectorHorario({
      api,
      dias,
      sobreturno: !!t.sobreturno, // un sobreturno se mueve a otro hueco de sobreturno
      alElegir: async (iso) => {
        const ok = await confirmar(`${nombreCompleto(p)}: de ${cuando(t.inicio)} a ${cuando(iso)}. Queda confirmado.`,
          { titulo: 'Confirmar cambio', aceptar: 'Confirmar cambio' });
        if (!ok) return;
        try {
          await api.cambiarHorarioTurno(t.id, iso);
        } catch (e) {
          aviso(mensajeError(e), 'error');
          return;
        }
        huboCambios = true;
        aviso(avisaPorCorreo(p) ? 'Turno cambiado y confirmado. Le enviamos un correo.' : 'Turno cambiado y confirmado.');
        cerrar();
      },
    }));
  });
}
