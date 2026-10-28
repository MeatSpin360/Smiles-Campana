import { h, vaciar, datosFormulario } from '../../lib/dom.js';
import { aviso, conCarga, confirmar, hoja, cargando, mensajeError } from '../../lib/ui.js';
import { fechaLarga, fechaCorta, hora, mayuscula } from '../../lib/dates.js';
import { crearOdontograma } from '../../odontograma/componente.js';
import { hallazgos } from '../../odontograma/modelo.js';
import { etiquetaEstado, nombreCompleto, ESTADOS } from '../comunes.js';
import { formularioPaciente, validarPaciente, darTurno, lineaPaciente, puedeVerClinica } from './comun.js';
import { ICONOS } from '../iconos.js';

const PESTANAS = [
  { id: 'datos', texto: 'Datos' },
  { id: 'turnos', texto: 'Turnos' },
  { id: 'odontograma', texto: 'Odontograma', clinica: true },
  { id: 'historia', texto: 'Historia clínica', clinica: true },
];

export async function ficha(ctx) {
  const { id } = ctx.params;
  const p = await ctx.api.paciente(id);
  const clinico = puedeVerClinica(ctx.rol);
  const visibles = PESTANAS.filter((t) => !t.clinica || clinico);
  const pestana = visibles.some((t) => t.id === ctx.params.pestana) ? ctx.params.pestana : (clinico ? 'odontograma' : 'datos');

  const contenido = h('div.ficha-contenido', cargando());
  const tel = (p.telefono || '').replace(/\D/g, '');

  const cabecera = h('header.ficha-cabecera',
    h('a.volver', { href: '#/pacientes' }, h('span.icono-btn', { html: ICONOS.izquierda }), 'Pacientes'),
    h('div.ficha-titulo',
      h('span.avatar.avatar-grande', { 'aria-hidden': 'true' }, (p.apellido || '?')[0]),
      h('div', h('h1', `${p.nombre} ${p.apellido}`), h('p.texto-suave', lineaPaciente(p))),
      h('div.ficha-contacto',
        tel ? h('a.btn-icono', { href: `https://wa.me/549${tel.replace(/^0/, '')}`, target: '_blank', rel: 'noopener', 'aria-label': 'WhatsApp', html: ICONOS.whatsapp }) : null,
        tel ? h('a.btn-icono', { href: `tel:${tel}`, 'aria-label': 'Llamar', html: ICONOS.telefono }) : null)),
    h('nav.pestanas', { 'aria-label': 'Secciones de la ficha' }, visibles.map((t) => h('a.pestana', {
      href: `#/pacientes/${id}/${t.id}`, 'aria-current': t.id === pestana ? 'page' : null,
    }, t.texto))));

  const vistas = { datos: vistaDatos, turnos: vistaTurnos, odontograma: vistaOdontograma, historia: vistaHistoria };
  vistas[pestana](ctx, p).then((n) => vaciar(contenido, n)).catch((e) => vaciar(contenido, h('p.error-campo', mensajeError(e))));

  return h('div.ficha', cabecera, contenido);
}

async function vistaDatos(ctx, p) {
  const err = h('p.error-campo', { hidden: true });
  const form = h('form.panel', { novalidate: true }, formularioPaciente(p), err);
  const boton = h('button.btn.btn-primario', { type: 'submit' }, 'Guardar cambios');
  form.append(h('div.acciones-form',
    h('span.texto-suave.nota-chica', p.usuario_id ? 'Tiene cuenta en Mi espacio.' : 'Todavía no creó su cuenta en Mi espacio.'),
    boton));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = datosFormulario(form);
    const problema = validarPaciente(d);
    if (problema) {
      err.textContent = problema;
      err.hidden = false;
      return;
    }
    err.hidden = true;
    conCarga(boton, async () => {
      await ctx.api.actualizarPaciente(p.id, d);
      aviso('Datos guardados.');
    });
  });
  return form;
}

async function vistaTurnos(ctx, p) {
  const [turnos, agenda] = await Promise.all([ctx.api.turnosDePaciente(p.id), ctx.api.agenda()]);
  const ahora = Date.now();
  const recargar = () => ctx.navegar(`/pacientes/${p.id}/turnos`);
  const boton = h('button.btn.btn-primario', {
    type: 'button',
    onclick: async () => { if (await darTurno(ctx.api, { paciente: p, dias: agenda.diasVisibles })) recargar(); },
  }, h('span.icono-btn', { html: ICONOS.mas }), 'Dar turno');

  const fila = (t) => {
    const futuro = new Date(t.inicio).getTime() > ahora;
    const pendiente = t.estado === 'pendiente';
    const cancelar = futuro && (pendiente || t.estado === 'confirmado') ? h('button.btn.btn-fantasma.btn-chico', {
      type: 'button',
      onclick: async (e) => {
        const titulo = pendiente ? 'Rechazar pedido' : 'Cancelar turno';
        if (!(await confirmar('El horario queda libre.', { titulo, aceptar: titulo, peligro: true }))) return;
        await conCarga(e.target, async () => {
          await ctx.api.cambiarEstadoTurno(t.id, pendiente ? 'rechazado' : 'cancelado');
          aviso(pendiente ? 'Pedido rechazado.' : 'Turno cancelado.');
          recargar();
        });
      },
    }, pendiente ? 'Rechazar' : 'Cancelar') : null;
    const confirmarBtn = futuro && pendiente ? h('button.btn.btn-primario.btn-chico', {
      type: 'button',
      onclick: (e) => conCarga(e.target, async () => {
        await ctx.api.cambiarEstadoTurno(t.id, 'confirmado');
        aviso('Turno confirmado.');
        recargar();
      }),
    }, 'Confirmar') : null;
    return h('li.fila-turno',
      h('div', h('strong', `${mayuscula(fechaLarga(t.inicio))}, ${hora(t.inicio)} h`), h('span.texto-suave', t.motivo)),
      h('div.fila-turno-der', cancelar, confirmarBtn, etiquetaEstado(t.estado)));
  };
  const cuenta = (e) => turnos.filter((t) => t.estado === e).length;
  return h('section.panel',
    h('div.panel-cabecera', h('h2', 'Turnos'), boton),
    turnos.length ? h('p.texto-suave', `${cuenta('atendido')} ${ESTADOS.atendido.toLowerCase()}s, ${cuenta('ausente')} sin asistencia, ${cuenta('cancelado')} cancelados.`) : null,
    turnos.length ? h('ul.lista-simple', turnos.map(fila)) : h('p.texto-suave', 'No tiene turnos registrados.'));
}

async function vistaOdontograma(ctx, p) {
  let versiones = await ctx.api.odontogramas(p.id);
  const contenedor = h('div');
  let salirSinGuardar = null;

  const modoLectura = (indice = 0) => {
    window.removeEventListener('beforeunload', salirSinGuardar);
    const v = versiones[indice];
    const editar = h('button.btn.btn-primario', { type: 'button', onclick: () => modoEdicion(versiones[0]?.datos) },
      versiones.length ? 'Registrar cambios' : 'Cargar odontograma inicial');
    if (!v) {
      vaciar(contenedor, h('div.panel.vacio-turno', h('span.vacio-icono', { html: ICONOS.diente }),
        h('p', 'Todavía no hay odontograma para este paciente.'), editar));
      return;
    }
    const od = crearOdontograma({ data: v.datos, editable: false });
    const selector = h('select', { 'aria-label': 'Versión', onchange: (e) => modoLectura(Number(e.target.value)) },
      versiones.map((x, i) => h('option', { value: i, selected: i === indice },
        `${fechaCorta(x.creado_en)}${i === 0 ? ' (actual)' : ''}${i === versiones.length - 1 && versiones.length > 1 ? ' (inicial)' : ''}`)));
    vaciar(contenedor,
      h('div.barra-version',
        h('label.selector-version', h('span.icono-btn', { html: ICONOS.historial }), h('span', 'Registro del'), selector),
        h('p.texto-suave.version-nota', [v.nota, v.creado_por_nombre ? `Por ${v.creado_por_nombre}` : null].filter(Boolean).join('. ')),
        indice === 0 ? editar : h('button.btn.btn-secundario', { type: 'button', onclick: () => modoLectura(0) }, 'Ver actual')),
      od.el);
  };

  const modoEdicion = (base) => {
    let cambios = false;
    const od = crearOdontograma({ data: base, editable: true, onChange: () => { cambios = true; } });
    salirSinGuardar = (e) => { if (cambios) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', salirSinGuardar);
    const quitar = salirSinGuardar;
    window.addEventListener('hashchange', () => window.removeEventListener('beforeunload', quitar), { once: true });
    const cancelar = h('button.btn.btn-secundario', {
      type: 'button',
      onclick: async () => {
        if (cambios && !(await confirmar('Los cambios sin guardar se pierden.', { titulo: 'Descartar cambios', aceptar: 'Descartar', peligro: true }))) return;
        modoLectura(0);
      },
    }, 'Descartar');
    const guardar = h('button.btn.btn-primario', {
      type: 'button',
      onclick: () => {
        const datos = od.obtener();
        const nota = h('input', { name: 'nota', placeholder: versiones.length ? 'Por ejemplo: obturación en 16' : 'Odontograma inicial', value: versiones.length ? '' : 'Odontograma inicial' });
        const ok = h('button.btn.btn-primario', { type: 'button' }, 'Guardar registro');
        const resumen = hallazgos(datos);
        const { cerrar } = hoja({
          titulo: 'Guardar odontograma',
          ancho: 'chico',
          cuerpo: h('div',
            h('p.texto-suave', 'Se guarda como un registro nuevo con fecha de hoy. Los anteriores quedan en el historial.'),
            h('label.campo', h('span', 'Nota (opcional)'), nota),
            h('p.texto-suave.nota-chica', `${resumen.length} ${resumen.length === 1 ? 'pieza con hallazgos' : 'piezas con hallazgos'}.`)),
          pie: [ok],
        });
        ok.onclick = () => conCarga(ok, async () => {
          await ctx.api.guardarOdontograma(p.id, datos, nota.value.trim());
          cambios = false;
          versiones = await ctx.api.odontogramas(p.id);
          cerrar();
          aviso('Odontograma guardado.');
          modoLectura(0);
        });
      },
    }, 'Guardar');
    vaciar(contenedor,
      h('div.barra-edicion', h('p', h('strong', 'Editando'), versiones.length ? ' a partir del registro actual' : ' odontograma inicial'), h('div.barra-edicion-acciones', cancelar, guardar)),
      od.el);
  };

  modoLectura(0);
  return contenedor;
}

async function vistaHistoria(ctx, p) {
  const [ant, evoluciones] = await Promise.all([ctx.api.antecedentes(p.id), ctx.api.evoluciones(p.id)]);
  const recargar = () => ctx.navegar(`/pacientes/${p.id}/historia`);

  const textoAnt = h('textarea', { name: 'antecedentes', rows: 4, placeholder: 'Alergias, medicación, enfermedades, embarazo, cirugías…' }, ant.texto || '');
  const guardarAnt = h('button.btn.btn-secundario.btn-chico', {
    type: 'button',
    onclick: () => conCarga(guardarAnt, async () => {
      await ctx.api.guardarAntecedentes(p.id, textoAnt.value.trim());
      aviso('Antecedentes guardados.');
    }),
  }, 'Guardar antecedentes');

  const texto = h('textarea', { rows: 4, placeholder: 'Qué se hizo en la consulta, indicaciones, próximos pasos.' });
  const piezas = h('input', { placeholder: 'Por ejemplo: 16, 21' });
  const agregar = h('button.btn.btn-primario', {
    type: 'button',
    onclick: () => {
      if (!texto.value.trim()) return aviso('Escribí el detalle de la evolución.', 'error');
      return conCarga(agregar, async () => {
        await ctx.api.agregarEvolucion(p.id, { texto: texto.value.trim(), piezas: piezas.value.trim() });
        aviso('Evolución registrada.');
        recargar();
      });
    },
  }, 'Registrar evolución');

  return h('div.historia',
    h('section.panel.panel-antecedentes',
      h('div.panel-cabecera', h('h2', 'Antecedentes'), ant.actualizado_en ? h('span.texto-suave.nota-chica', `Actualizado el ${fechaCorta(ant.actualizado_en)}`) : null),
      textoAnt,
      h('div.acciones-form', guardarAnt)),
    h('section.panel',
      h('h2', 'Nueva evolución'),
      h('label.campo', h('span', 'Detalle'), texto),
      h('div.fila-campos.fila-evolucion', h('label.campo', h('span', 'Piezas (opcional)'), piezas), h('div.acciones-form', agregar))),
    h('section.seccion-app',
      h('h2', 'Evoluciones'),
      evoluciones.length ? h('ol.linea-tiempo', evoluciones.map((e) => h('li',
        h('div.lt-fecha', h('strong', fechaCorta(e.creado_en)), h('span', hora(e.creado_en))),
        h('div.lt-cuerpo', h('p', e.texto), h('p.texto-suave.nota-chica', [e.piezas ? `Piezas ${e.piezas}` : null, e.creado_por_nombre].filter(Boolean).join('. ')))))) : h('p.texto-suave', 'Sin evoluciones registradas.')));
}
