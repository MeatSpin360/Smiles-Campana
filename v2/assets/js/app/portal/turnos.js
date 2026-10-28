import { h } from '../../lib/dom.js';
import { aviso, confirmar, conCarga, hoja } from '../../lib/ui.js';
import { fechaLarga, hora, mayuscula, partes, hoy } from '../../lib/dates.js';
import { encabezado, etiquetaEstado, bloqueFecha, selectorHorario, avisoSinFicha, MOTIVOS, linkWhatsapp } from '../comunes.js';
import { ICONOS } from '../iconos.js';
import { AVISOS } from '../../../../config.js';

const esFuturo = (t) => new Date(t.inicio).getTime() > Date.now();
/** Turno pedido o confirmado que todavía no pasó. */
const vigente = (t) => ['pendiente', 'confirmado'].includes(t.estado) && esFuturo(t);

export async function misTurnos(ctx) {
  const [ficha, turnos, agenda] = await Promise.all([ctx.api.miFicha(), ctx.api.misTurnos(), ctx.api.agenda()]);
  const proximos = turnos.filter(vigente);
  // Pedidos que el consultorio no confirmó, y turnos que el consultorio canceló (los que cancela el paciente tienen cancelado_en)
  const rechazados = turnos.filter((t) => esFuturo(t) && (t.estado === 'rechazado' || (t.estado === 'cancelado' && !t.cancelado_en)));
  const anteriores = turnos.filter((t) => !proximos.includes(t) && !rechazados.includes(t)).reverse();
  const saludo = `Hola, ${ctx.perfil.nombre || ficha?.nombre || ''}`.trim();

  if (!ficha) return h('div', encabezado(saludo), avisoSinFicha());

  const tarjetaProximo = (t) => {
    const pendiente = t.estado === 'pendiente';
    const textoCancelar = pendiente ? 'Cancelar pedido' : 'Cancelar turno';
    const cancelar = h('button.btn.btn-secundario', {
      type: 'button',
      onclick: async () => {
        const detalle = `${mayuscula(fechaLarga(t.inicio))} a las ${hora(t.inicio)} h.`;
        const ok = await confirmar(pendiente ? `${detalle} Retirás el pedido antes de que lo confirmemos.` : `${detalle} El horario queda libre para otra persona.`,
          { titulo: textoCancelar, aceptar: textoCancelar, peligro: true });
        if (!ok) return;
        await conCarga(cancelar, async () => {
          await ctx.api.cancelarMiTurno(t.id);
          aviso(pendiente ? 'Pedido cancelado.' : 'Turno cancelado.');
          ctx.navegar('/');
        });
      },
    }, textoCancelar);
    return h(`article.turno-destacado${pendiente ? '.turno-pendiente' : ''}`,
      h('div.td-fecha', bloqueFecha(t.inicio)),
      h('div.td-info',
        h('p.td-etiqueta', pendiente ? 'Turno pedido, falta que lo confirmemos' : 'Tu próximo turno'),
        h('h2', `${mayuscula(fechaLarga(t.inicio))}, ${hora(t.inicio)} h`),
        h('p.texto-suave', t.motivo),
        h('div.td-acciones', cancelar)),
      t.inicio_pedido && !pendiente ? h('p.td-pie', `Cambiamos el horario que habías pedido (${fechaLarga(t.inicio_pedido).replace(',', '')} a las ${hora(t.inicio_pedido)} h).`) : null,
      h('p.td-pie', pendiente
        ? avisoPendiente(t)
        : `Podés cancelarlo online hasta ${agenda.horasCancelacion} h antes. Después, avisanos por WhatsApp.`));
  };

  // Cómo se va a enterar el paciente de que su pedido se confirmó
  function avisoPendiente(t) {
    if (t.cambio_ofrecido_en) return 'Ese horario no está disponible. Te vamos a contactar para coordinar otro.';
    if (AVISOS.correo && ficha.email) return 'Recibirás un correo cuando el turno esté confirmado.';
    if (ficha.telefono) return 'Te vamos a avisar por WhatsApp cuando el turno esté confirmado.';
    return 'Cuando el consultorio lo confirme, lo vas a ver acá.';
  }

  const avisosRechazo = rechazados.map((t) => h('div.nota.nota-aviso',
    h('span.nota-icono', { html: ICONOS.alerta }),
    h('div',
      h('strong', t.estado === 'rechazado'
        ? `No pudimos confirmar tu turno del ${fechaLarga(t.inicio)} a las ${hora(t.inicio)} h`
        : `Tuvimos que cancelar tu turno del ${fechaLarga(t.inicio)} a las ${hora(t.inicio)} h`),
      h('p', 'Elegí otro horario o escribinos y lo coordinamos.'),
      h('div.td-acciones',
        proximos.length ? null : h('a.btn.btn-primario', { href: '#/pedir-turno' }, 'Elegir otro horario'),
        linkWhatsapp('Escribir por WhatsApp')))));

  return h('div',
    encabezado(saludo, proximos.length ? null : 'No tenés turnos pedidos.',
      proximos.length ? null : h('a.btn.btn-primario', { href: '#/pedir-turno' }, h('span.icono-btn', { html: ICONOS.mas }), 'Pedir turno')),
    avisosRechazo,
    proximos.length ? proximos.map(tarjetaProximo) : (rechazados.length ? null : h('div.panel.vacio-turno',
      h('span.vacio-icono', { html: ICONOS.calendario }),
      h('p', 'Elegí día y horario entre los turnos libres de la agenda.'),
      h('a.btn.btn-primario', { href: '#/pedir-turno' }, 'Ver horarios libres'))),
    anteriores.length ? h('section.seccion-app',
      h('h2', 'Historial'),
      h('ul.lista-simple', anteriores.map((t) => h('li.fila-turno',
        h('div', h('strong', `${mayuscula(fechaLarga(t.inicio))}, ${hora(t.inicio)} h`), h('span.texto-suave', t.motivo)),
        etiquetaEstado(t.estado))))) : null);
}

export async function pedirTurno(ctx) {
  const [ficha, turnos, agenda] = await Promise.all([ctx.api.miFicha(), ctx.api.misTurnos(), ctx.api.agenda()]);
  if (!ficha) return h('div', encabezado('Pedir turno'), avisoSinFicha());

  const actual = turnos.find(vigente);
  if (actual) {
    const estado = actual.estado === 'pendiente' ? 'pediste' : 'tenés';
    return h('div', encabezado('Pedir turno'),
      h('div.nota', h('span.nota-icono', { html: ICONOS.calendario }),
        h('div', h('strong', `Ya ${estado} un turno el ${fechaLarga(actual.inicio)} a las ${hora(actual.inicio)} h`),
          h('p', 'Si querés otro horario, cancelá ese primero desde Mis turnos.'),
          h('a.btn.btn-secundario', { href: '#/' }, 'Ir a mis turnos'))));
  }

  // Mismo límite que aplica la base: 4 cancelaciones propias en el día
  const canceladosHoy = turnos.filter((t) => t.cancelado_en && partes(t.cancelado_en).fecha === hoy()).length;
  if (canceladosHoy >= 4) {
    return h('div', encabezado('Pedir turno'),
      h('div.nota.nota-aviso', h('span.nota-icono', { html: ICONOS.alerta }),
        h('div', h('strong', 'Por actividad sospechosa no podés pedir turnos hasta mañana'),
          h('p', 'Hoy pediste y cancelaste varios turnos seguidos. Si necesitás un turno, escribinos.'),
          linkWhatsapp('Escribir por WhatsApp'))));
  }

  let motivo = MOTIVOS[0];
  const motivos = h('div.chips-motivo', { role: 'radiogroup', 'aria-label': 'Motivo' }, MOTIVOS.map((m) => h('button.chip', {
    type: 'button', role: 'radio', 'aria-checked': String(m === motivo),
    onclick: (e) => {
      motivo = m;
      motivos.querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-checked', String(b === e.currentTarget)));
    },
  }, m)));

  const confirmarPedido = (iso) => {
    const boton = h('button.btn.btn-primario', { type: 'button' }, 'Pedir este turno');
    const volver = h('button.btn.btn-secundario', { type: 'button' }, 'Elegir otro');
    const { cerrar } = hoja({
      titulo: 'Revisá tu pedido',
      ancho: 'chico',
      cuerpo: [
        h('div.resumen-turno',
          bloqueFecha(iso),
          h('div', h('strong', `${mayuscula(fechaLarga(iso))}`), h('p', `${hora(iso)} h, ${agenda.duracion} minutos`), h('p.texto-suave', motivo))),
        h('p.texto-suave.nota-chica.nota-pedido', 'El horario queda reservado para vos mientras el consultorio confirma el turno.'),
      ],
      pie: [volver, boton],
    });
    volver.onclick = cerrar;
    boton.onclick = () => conCarga(boton, async () => {
      await ctx.api.pedirTurno(iso, motivo);
      cerrar();
      aviso('Pedido enviado. Lo vas a ver confirmado en Mis turnos.');
      ctx.navegar('/');
    });
  };

  return h('div',
    encabezado('Pedir turno', `Elegí día y horario; el consultorio confirma cada pedido. Los turnos duran ${agenda.duracion} minutos.`),
    h('section.panel',
      h('h2.titulo-paso', '¿Para qué es el turno?'),
      motivos,
      h('h2.titulo-paso', 'Elegí día y horario'),
      selectorHorario({ api: ctx.api, dias: agenda.diasVisibles, alElegir: confirmarPedido })),
    h('p.texto-suave.nota-pie', '¿No encontrás un horario que te sirva? ', linkWhatsapp('Consultanos')));
}
