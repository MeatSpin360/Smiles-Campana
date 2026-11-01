// Panel de control (solo admin): resumen del consultorio, estado de las copias de seguridad y el registro
// de acciones (quién hizo qué y cuándo). El registro lo arma la base sola; acá solo se consulta.
import { h, vaciar } from '../../lib/dom.js';
import { cargando, mensajeError, confirmar, aviso } from '../../lib/ui.js';
import { fechaCorta, fechaLarga, hora, hoy, sumarDias, mayuscula } from '../../lib/dates.js';
import { encabezado } from '../comunes.js';
import { ICONOS } from '../iconos.js';
import { TIPOS, ROLES, describir } from './registro-textos.js';

const POR_PAGINA = 50;
const CAPACIDAD_FOTOS = 10 * 1024 ** 3; // plan gratuito de Cloudflare R2
const DIAS_COPIA = 8; // la copia es semanal: más de 8 días sin copia es una alerta

const DOMINIO = 'smilescampana.com.ar';
const ENTRADA_PERSONAL = 'https://smiles-campana.emiliobrescasin.workers.dev/app.html';

const megas = (b) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1)} GB` : b >= 1024 ** 2 ? `${Math.round(b / 1024 ** 2)} MB` : `${Math.round(b / 1024)} KB`);

const SECCIONES = [
  { id: '', texto: 'Resumen y registro' },
  { id: 'usuarios', texto: 'Usuarios', vista: () => import('./usuarios.js').then((m) => m.usuarios) },
  { id: 'horarios', texto: 'Horarios', vista: () => import('./horarios.js').then((m) => m.horarios) },
  { id: 'plantillas', texto: 'Plantillas', vista: () => import('./documentos.js').then((m) => m.plantillasPanel) },
];

export async function panel(ctx) {
  const seccion = SECCIONES.find((x) => x.id === (ctx.params.seccion || '')) || SECCIONES[0];
  const pestanas = h('nav.pestanas', { 'aria-label': 'Secciones del panel' }, SECCIONES.map((x) => h('a.pestana', {
    href: `#/panel${x.id ? `/${x.id}` : ''}`, 'aria-current': x === seccion ? 'page' : null,
  }, x.texto)));
  const cabecera = encabezado('Panel de control', 'Resumen del consultorio, registro de acciones, usuarios, horarios y plantillas de documentos.');
  if (seccion.vista) {
    // Las pantallas de Usuarios y Horarios, adentro del panel: al guardar vuelven a esta pestaña
    const vista = await seccion.vista();
    const propio = { ...ctx, navegar: (r) => ctx.navegar(r === `/${seccion.id}` ? `/panel/${seccion.id}` : r) };
    return h('div.panel-control', cabecera, pestanas, h('div.panel-subvista', await vista(propio)));
  }
  return resumenYRegistro(ctx, cabecera, pestanas);
}

async function resumenYRegistro(ctx, cabecera, pestanas) {
  const pacienteId = ctx.query.get('paciente') || null;
  const [resumen, usuarios, paciente] = await Promise.all([
    ctx.api.resumenPanel(),
    ctx.api.usuarios(),
    pacienteId ? ctx.api.paciente(pacienteId).catch(() => null) : null,
  ]);

  // ---------- Resumen ----------
  const dias = resumen.ultima_copia ? (Date.now() - new Date(resumen.ultima_copia).getTime()) / 864e5 : Infinity;
  const copiaOk = dias <= DIAS_COPIA;
  const personal = Object.entries(resumen.personal || {}).map(([r, n]) => `${n} ${ROLES[r] || r}`).join(' · ');
  const tarjeta = (titulo, cifra, detalle, { icono, alerta = false, enlace } = {}) => h(`${enlace ? 'a' : 'div'}.tarjeta-panel${alerta ? '.tarjeta-alerta' : ''}`,
    enlace ? { href: enlace } : {},
    h('span.tarjeta-panel-titulo', icono ? h('span.icono-btn', { html: ICONOS[icono] }) : null, titulo),
    h('strong.tarjeta-panel-cifra', cifra),
    detalle ? h('span.tarjeta-panel-detalle', detalle) : null);

  const tarjetas = h('section.tarjetas-panel', { 'aria-label': 'Resumen' },
    tarjeta('Turnos esta semana', String(resumen.turnos_semana), resumen.pendientes ? `${resumen.pendientes} ${resumen.pendientes === 1 ? 'pedido' : 'pedidos'} por confirmar` : 'Sin pedidos por confirmar',
      { icono: 'calendario', enlace: '#/agenda' }),
    tarjeta('Pacientes', String(resumen.pacientes), `${resumen.pacientes_nuevos} nuevos en 30 días · ${resumen.con_cuenta} con cuenta en Mi espacio`,
      { icono: 'personas', enlace: '#/pacientes' }),
    tarjeta('Fotos clínicas', String(resumen.fotos), `${megas(resumen.fotos_bytes)} de 10 GB usados${resumen.fotos_bytes >= CAPACIDAD_FOTOS / 100 ? ` (${Math.round((resumen.fotos_bytes / CAPACIDAD_FOTOS) * 100)} %)` : ''}`,
      { icono: 'foto' }),
    tarjeta('Copia de seguridad', resumen.ultima_copia ? mayuscula(fechaCorta(resumen.ultima_copia)) : 'Sin copias',
      resumen.ultima_copia
        ? (copiaOk ? `${hora(resumen.ultima_copia)} h · todo en orden` : `Hace ${Math.floor(dias)} días: revisá la copia semanal`)
        : 'Todavía no se hizo ninguna copia',
      { icono: 'historial', alerta: !copiaOk }),
    tarjeta('Personal', String(Object.values(resumen.personal || {}).reduce((a, b) => a + b, 0)), [personal, resumen.cuentas_sin_vincular
      ? `${resumen.cuentas_sin_vincular} ${resumen.cuentas_sin_vincular === 1 ? 'cuenta' : 'cuentas'} de paciente sin vincular` : 'Todas las cuentas vinculadas'].filter(Boolean).join(' · '),
    { icono: 'llave', alerta: resumen.cuentas_sin_vincular > 0, enlace: '#/panel/usuarios' }));

  // ---------- Registro ----------
  const desde = h('input', { type: 'date', value: pacienteId ? '' : sumarDias(hoy(), -6), 'aria-label': 'Desde' });
  const hasta = h('input', { type: 'date', value: pacienteId ? '' : hoy(), 'aria-label': 'Hasta' });
  const quien = h('select', { 'aria-label': 'Quién' },
    h('option', { value: '' }, 'Todos'),
    h('optgroup', { label: 'Personal' }, usuarios.filter((u) => u.rol !== 'paciente')
      .map((u) => h('option', { value: u.id }, `${`${u.nombre || ''} ${u.apellido || ''}`.trim() || u.email} (${ROLES[u.rol]})`))),
    h('option', { value: 'pacientes' }, 'Pacientes (desde Mi espacio)'),
    h('option', { value: 'sistema' }, 'Sistema'));
  const tipo = h('select', { 'aria-label': 'Tipo de acción' }, h('option', { value: '' }, 'Todas las acciones'), TIPOS.map((t) => h('option', { value: t.id }, t.texto)));
  const buscarPaciente = h('input', { type: 'search', placeholder: 'Apellido o nombre', 'aria-label': 'Paciente', hidden: !!pacienteId });
  const filtroPaciente = pacienteId ? h('span.chip-filtro',
    `Paciente: ${paciente ? `${paciente.apellido}, ${paciente.nombre}` : 'eliminado'}`,
    h('a.btn-icono', { href: '#/panel', 'aria-label': 'Quitar el filtro de paciente', title: 'Ver todos', html: ICONOS.cerrar })) : null;

  const lista = h('div.registro-lista', cargando());
  const mas = h('button.btn.btn-secundario', { type: 'button', hidden: true }, 'Ver más');
  let pagina = 0;
  let filas = [];

  const filtros = () => ({
    desde: desde.value || null,
    hasta: hasta.value || null,
    quien: quien.value || null,
    prefijos: TIPOS.find((t) => t.id === tipo.value)?.prefijos,
    pacienteId,
    paciente: buscarPaciente.value,
    porPagina: POR_PAGINA,
  });
  let consulta = 0; // si cambian los filtros mientras carga, solo vale la última consulta
  const cargar = async (desdeCero = true) => {
    const esta = ++consulta;
    if (desdeCero) {
      pagina = 0;
      filas = [];
      vaciar(lista, cargando());
    }
    try {
      const nuevas = await ctx.api.registro({ ...filtros(), pagina });
      if (esta !== consulta) return;
      filas = filas.concat(nuevas);
      mas.hidden = nuevas.length < POR_PAGINA;
      vaciar(lista, filas.length ? dibujarFilas(filas) : h('p.vacio', 'No hay acciones registradas con estos filtros.'));
    } catch (e) {
      if (esta === consulta) vaciar(lista, h('p.error-campo', mensajeError(e)));
    }
  };
  mas.onclick = async () => {
    mas.disabled = true;
    pagina++;
    await cargar(false);
    mas.disabled = false;
  };
  let espera;
  for (const el of [desde, hasta, quien, tipo]) el.addEventListener('change', () => cargar());
  buscarPaciente.addEventListener('input', () => {
    clearTimeout(espera);
    espera = setTimeout(() => cargar(), 350);
  });

  cargar();
  return h('div.panel-control',
    cabecera,
    pestanas,
    tarjetas,
    panelMantenimiento(ctx),
    h('section.panel.panel-registro',
      h('div.panel-cabecera', h('div', h('h2', 'Registro de acciones'),
        h('p.texto-suave.nota-chica', `Quién hizo qué y cuándo. ${resumen.acciones_hoy} ${resumen.acciones_hoy === 1 ? 'acción' : 'acciones'} hoy. No se puede modificar ni borrar.`))),
      h('div.filtros-registro',
        h('label.campo', h('span', 'Desde'), desde),
        h('label.campo', h('span', 'Hasta'), hasta),
        h('label.campo', h('span', 'Quién'), quien),
        h('label.campo', h('span', 'Qué'), tipo),
        pacienteId ? h('div.campo', h('span', 'Paciente'), filtroPaciente) : h('label.campo', h('span', 'Paciente'), buscarPaciente)),
      lista,
      h('div.registro-mas', mas)));
}

// Agrupa acciones seguidas iguales (por ejemplo, 8 fotos subidas juntas) y las separa por día
function dibujarFilas(filas) {
  const grupos = [];
  for (const r of filas) {
    const g = grupos.at(-1);
    const juntas = g && g.r.accion === r.accion && g.r.usuario_id === r.usuario_id && g.r.paciente_id === r.paciente_id
      && describir(r).plural && Math.abs(new Date(g.ultima) - new Date(r.creado_en)) < 10 * 60e3;
    if (juntas) {
      g.n++;
      g.ultima = r.creado_en;
    } else {
      grupos.push({ r, n: 1, ultima: r.creado_en });
    }
  }
  const porDia = new Map();
  for (const g of grupos) {
    const dia = fechaLarga(g.r.creado_en);
    if (!porDia.has(dia)) porDia.set(dia, []);
    porDia.get(dia).push(g);
  }
  return [...porDia].map(([dia, gs]) => h('section.registro-dia',
    h('h3.registro-dia-titulo', mayuscula(dia)),
    h('ol.registro-filas', gs.map(fila))));
}

function fila({ r, n }) {
  const { texto, extra, plural } = describir(r);
  const pacienteVivo = r.paciente_id && r.accion !== 'paciente.eliminado';
  return h('li.registro-fila',
    h('span.registro-hora', hora(r.creado_en)),
    h('div.registro-cuerpo',
      h('p.registro-texto', h('strong', n > 1 && plural ? plural(n) : texto),
        r.paciente_nombre ? [' · ', pacienteVivo ? h('a', { href: `#/pacientes/${r.paciente_id}` }, r.paciente_nombre) : h('span', r.paciente_nombre)] : null),
      extra && n === 1 ? h('p.registro-extra', extra) : null),
    h('span.registro-quien', r.usuario_nombre || 'Sistema',
      r.usuario_rol ? h('span.etiqueta.etiqueta-rol', ROLES[r.usuario_rol] || r.usuario_rol) : null));
}


// ---------- Ventana de mantenimiento ----------
// Activa: smilescampana.com.ar (y www) muestran a todos el aviso de fuera de servicio, también en el ingreso.
// El personal sigue entrando por workers.dev. El cambio se ve en el dominio en menos de 30 segundos.
function panelMantenimiento(ctx) {
  const s = ctx.sitio || { mantenimiento: false };
  const activo = s.mantenimiento === true;
  const enDominio = location.hostname.replace(/^www\./, '') === DOMINIO;
  const desde = s.actualizado_en ? `${fechaCorta(s.actualizado_en)}, ${hora(s.actualizado_en)} h${s.actualizado_por_nombre ? ` (${s.actualizado_por_nombre})` : ''}` : '';
  const boton = h(`button.btn${activo ? '.btn-primario' : '.btn-secundario'}`, { type: 'button' }, activo ? 'Desactivar mantenimiento' : 'Activar mantenimiento');
  boton.onclick = async () => {
    const texto = activo
      ? [h('span', `${DOMINIO} vuelve a funcionar normalmente para todos (puede tardar hasta 30 segundos).`)]
      : [h('span', `${DOMINIO} va a mostrar a todos el aviso de fuera de servicio, también en la pantalla de ingreso. Los pacientes no van a poder entrar a Mi espacio. `),
        h('span', 'El personal sigue trabajando desde '), h('strong', ENTRADA_PERSONAL.replace('https://', '').replace('/app.html', '')), h('span', '.'),
        enDominio ? h('span', ' Estás usando el dominio: después de activarla te llevamos a esa dirección para seguir trabajando.') : null];
    if (!(await confirmar(texto, { titulo: activo ? 'Desactivar mantenimiento' : 'Activar mantenimiento', aceptar: activo ? 'Desactivar' : 'Activar', peligro: !activo }))) return;
    boton.disabled = true;
    try {
      await ctx.api.cambiarMantenimiento(!activo);
      await ctx.recargarSitio();
      aviso(activo ? 'Mantenimiento desactivado. El sitio vuelve a estar disponible.' : 'Mantenimiento activado.');
      if (!activo && enDominio) { location.href = `${ENTRADA_PERSONAL}#/panel`; return; }
      ctx.redibujar();
    } catch (e) {
      aviso(mensajeError(e), 'error');
      boton.disabled = false;
    }
  };
  return h(`section.panel.panel-mantenimiento${activo ? '.activo' : ''}`, { 'aria-label': 'Ventana de mantenimiento' },
    h('div',
      h('span.estado-mantenimiento', activo ? 'Activa' : 'Desactivada'),
      h('h2', 'Ventana de mantenimiento'),
      h('p.texto-suave.nota-chica', activo
        ? [`${DOMINIO} muestra el aviso de fuera de servicio${desde ? ` desde el ${desde}` : ''}. El personal trabaja desde `, h('a', { href: ENTRADA_PERSONAL }, 'workers.dev'), '.']
        : `Al activarla, ${DOMINIO} muestra a todos un aviso de fuera de servicio. Sirve para trabajos en el sitio o en la base.`)),
    boton);
}
