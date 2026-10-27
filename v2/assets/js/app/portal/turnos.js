import { h } from '../../lib/dom.js';
import { aviso, confirmar, conCarga, hoja } from '../../lib/ui.js';
import { fechaLarga, hora, mayuscula } from '../../lib/dates.js';
import { encabezado, etiquetaEstado, bloqueFecha, selectorHorario, avisoSinFicha, MOTIVOS, linkWhatsapp } from '../comunes.js';
import { ICONOS } from '../iconos.js';

export async function misTurnos(ctx) {
  const [ficha, turnos, agenda] = await Promise.all([ctx.api.miFicha(), ctx.api.misTurnos(), ctx.api.agenda()]);
  const ahora = Date.now();
  const proximos = turnos.filter((t) => t.estado === 'confirmado' && new Date(t.inicio).getTime() > ahora);
  const anteriores = turnos.filter((t) => !proximos.includes(t)).reverse();
  const saludo = `Hola, ${ctx.perfil.nombre || ficha?.nombre || ''}`.trim();

  if (!ficha) return h('div', encabezado(saludo), avisoSinFicha());

  const tarjetaProximo = (t) => {
    const cancelar = h('button.btn.btn-secundario', {
      type: 'button',
      onclick: async () => {
        const ok = await confirmar(`${mayuscula(fechaLarga(t.inicio))} a las ${hora(t.inicio)} h. El horario queda libre para otra persona.`, { titulo: 'Cancelar turno', aceptar: 'Cancelar turno', peligro: true });
        if (!ok) return;
        await conCarga(cancelar, async () => {
          await ctx.api.cancelarMiTurno(t.id);
          aviso('Turno cancelado.');
          ctx.navegar('/');
        });
      },
    }, 'Cancelar turno');
    return h('article.turno-destacado',
      h('div.td-fecha', bloqueFecha(t.inicio)),
      h('div.td-info',
        h('p.td-etiqueta', 'Tu próximo turno'),
        h('h2', `${mayuscula(fechaLarga(t.inicio))}, ${hora(t.inicio)} h`),
        h('p.texto-suave', t.motivo),
        h('div.td-acciones', cancelar)),
      h('p.td-pie', `Podés cancelarlo online hasta ${agenda.horasCancelacion} h antes. Después, avisanos por WhatsApp.`));
  };

  return h('div',
    encabezado(saludo, proximos.length ? null : 'No tenés turnos reservados.',
      proximos.length ? null : h('a.btn.btn-primario', { href: '#/pedir-turno' }, h('span.icono-btn', { html: ICONOS.mas }), 'Pedir turno')),
    proximos.length ? proximos.map(tarjetaProximo) : h('div.panel.vacio-turno',
      h('span.vacio-icono', { html: ICONOS.calendario }),
      h('p', 'Elegí día y horario entre los turnos libres de la agenda.'),
      h('a.btn.btn-primario', { href: '#/pedir-turno' }, 'Ver horarios libres')),
    anteriores.length ? h('section.seccion-app',
      h('h2', 'Historial'),
      h('ul.lista-simple', anteriores.map((t) => h('li.fila-turno',
        h('div', h('strong', `${mayuscula(fechaLarga(t.inicio))}, ${hora(t.inicio)} h`), h('span.texto-suave', t.motivo)),
        etiquetaEstado(t.estado))))) : null);
}

export async function pedirTurno(ctx) {
  const [ficha, turnos, agenda] = await Promise.all([ctx.api.miFicha(), ctx.api.misTurnos(), ctx.api.agenda()]);
  if (!ficha) return h('div', encabezado('Pedir turno'), avisoSinFicha());

  const pendiente = turnos.find((t) => t.estado === 'confirmado' && new Date(t.inicio) > new Date());
  if (pendiente) {
    return h('div', encabezado('Pedir turno'),
      h('div.nota', h('span.nota-icono', { html: ICONOS.calendario }),
        h('div', h('strong', `Ya tenés un turno el ${fechaLarga(pendiente.inicio)} a las ${hora(pendiente.inicio)} h`),
          h('p', 'Si querés otro horario, cancelá ese primero desde Mis turnos.'),
          h('a.btn.btn-secundario', { href: '#/' }, 'Ir a mis turnos'))));
  }

  let motivo = MOTIVOS[0];
  const motivos = h('div.chips-motivo', { role: 'radiogroup', 'aria-label': 'Motivo' }, MOTIVOS.map((m) => h('button.chip', {
    type: 'button', role: 'radio', 'aria-checked': String(m === motivo),
    onclick: (e) => {
      motivo = m;
      motivos.querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-checked', String(b === e.currentTarget)));
    },
  }, m)));

  const confirmarTurno = (iso) => {
    const boton = h('button.btn.btn-primario', { type: 'button' }, 'Reservar turno');
    const volver = h('button.btn.btn-secundario', { type: 'button' }, 'Elegir otro');
    const { cerrar } = hoja({
      titulo: 'Confirmá tu turno',
      ancho: 'chico',
      cuerpo: h('div.resumen-turno',
        bloqueFecha(iso),
        h('div', h('strong', `${mayuscula(fechaLarga(iso))}`), h('p', `${hora(iso)} h, ${agenda.duracion} minutos`), h('p.texto-suave', motivo))),
      pie: [volver, boton],
    });
    volver.onclick = cerrar;
    boton.onclick = () => conCarga(boton, async () => {
      await ctx.api.pedirTurno(iso, motivo);
      cerrar();
      aviso('Turno reservado.');
      ctx.navegar('/');
    });
  };

  return h('div',
    encabezado('Pedir turno', `Los turnos duran ${agenda.duracion} minutos. Ves los próximos ${agenda.diasVisibles} días.`),
    h('section.panel',
      h('h2.titulo-paso', '¿Para qué es el turno?'),
      motivos,
      h('h2.titulo-paso', 'Elegí día y horario'),
      selectorHorario({ api: ctx.api, dias: agenda.diasVisibles, alElegir: confirmarTurno })),
    h('p.texto-suave.nota-pie', '¿No encontrás un horario que te sirva? ', linkWhatsapp('Consultanos')));
}
