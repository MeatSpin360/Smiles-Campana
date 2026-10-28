// Aplicación: ingreso, espacio del paciente e intranet del personal.
import { api, modoDemo } from '../api/index.js';
import { h, vaciar } from '../lib/dom.js';
import { aviso, cargando, mensajeError, confirmar } from '../lib/ui.js';
import { ICONOS } from './iconos.js';

const ROLES = {
  paciente: 'Paciente',
  recepcion: 'Recepción',
  odontologia: 'Odontología',
  admin: 'Administración',
};

// Rutas: patrón, roles permitidos (null = sin sesión), módulo y vista
const RUTAS = [
  { p: '/ingresar', publica: true, vista: () => import('./auth.js').then((m) => m.ingresar) },
  { p: '/registro', publica: true, vista: () => import('./auth.js').then((m) => m.registro) },
  { p: '/recuperar', publica: true, vista: () => import('./auth.js').then((m) => m.recuperar) },
  { p: '/nueva-clave', vista: () => import('./auth.js').then((m) => m.nuevaClave), roles: ['paciente', 'recepcion', 'odontologia', 'admin'] },

  { p: '/', roles: ['paciente'], vista: () => import('./portal/turnos.js').then((m) => m.misTurnos) },
  { p: '/pedir-turno', roles: ['paciente'], vista: () => import('./portal/turnos.js').then((m) => m.pedirTurno) },
  { p: '/odontograma', roles: ['paciente'], vista: () => import('./portal/odontograma.js').then((m) => m.miOdontograma) },
  { p: '/mis-datos', roles: ['paciente'], vista: () => import('./portal/datos.js').then((m) => m.misDatos) },

  { p: '/', roles: ['recepcion', 'odontologia', 'admin'], vista: () => import('./staff/inicio.js').then((m) => m.inicio) },
  { p: '/agenda', roles: ['recepcion', 'odontologia', 'admin'], vista: () => import('./staff/agenda.js').then((m) => m.agenda) },
  { p: '/pacientes', roles: ['recepcion', 'odontologia', 'admin'], vista: () => import('./staff/pacientes.js').then((m) => m.pacientes) },
  { p: '/pacientes/:id', roles: ['recepcion', 'odontologia', 'admin'], vista: () => import('./staff/ficha.js').then((m) => m.ficha) },
  { p: '/pacientes/:id/:pestana', roles: ['recepcion', 'odontologia', 'admin'], vista: () => import('./staff/ficha.js').then((m) => m.ficha) },
  { p: '/horarios', roles: ['recepcion', 'admin'], vista: () => import('./staff/horarios.js').then((m) => m.horarios) },
  { p: '/usuarios', roles: ['admin'], vista: () => import('./staff/usuarios.js').then((m) => m.usuarios) },
];

const MENU = {
  paciente: [
    { ruta: '/', texto: 'Mis turnos', icono: 'calendario' },
    { ruta: '/odontograma', texto: 'Odontograma', icono: 'diente' },
    { ruta: '/mis-datos', texto: 'Mis datos', icono: 'persona' },
  ],
  personal: [
    { ruta: '/', texto: 'Hoy', icono: 'casa' },
    { ruta: '/agenda', texto: 'Agenda', icono: 'calendario' },
    { ruta: '/pacientes', texto: 'Pacientes', icono: 'personas' },
    { ruta: '/horarios', texto: 'Horarios', icono: 'reloj', roles: ['recepcion', 'admin'] },
    { ruta: '/usuarios', texto: 'Usuarios', icono: 'llave', roles: ['admin'] },
  ],
};

const raiz = document.getElementById('app');
let sesion = null;

function coincide(patron, ruta) {
  const a = patron.split('/').filter(Boolean);
  const b = ruta.split('/').filter(Boolean);
  if (a.length !== b.length) return null;
  const params = {};
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(':')) params[a[i].slice(1)] = decodeURIComponent(b[i]);
    else if (a[i] !== b[i]) return null;
  }
  return params;
}

export function navegar(ruta, { reemplazar = false } = {}) {
  const hash = `#${ruta}`;
  if (location.hash === hash) cargarRuta();
  else if (reemplazar) location.replace(hash);
  else location.hash = hash;
}

function rutaActual() {
  const [ruta, query = ''] = (location.hash.slice(1) || '/').split('?');
  return { ruta: ruta || '/', query: new URLSearchParams(query) };
}

let vistaActual = null; // { encontrada, ctx, contenido, ruta } para refrescar en silencio

async function cargarRuta() {
  const { ruta, query } = rutaActual();
  const rol = sesion?.perfil?.rol;

  let encontrada = null;
  let params = {};
  for (const r of RUTAS) {
    const m = coincide(r.p, ruta);
    if (!m) continue;
    if (r.publica || r.roles?.includes(rol)) {
      encontrada = r;
      params = m;
      break;
    }
    encontrada ??= { ...r, sinPermiso: true };
  }

  if (!encontrada) return navegar('/', { reemplazar: true });
  if (encontrada.publica && sesion && ruta !== '/registro') return navegar('/', { reemplazar: true });
  if (encontrada.sinPermiso) {
    if (!sesion) {
      return navegar(`/ingresar?volver=${encodeURIComponent(ruta)}`, { reemplazar: true });
    }
    return navegar('/', { reemplazar: true });
  }

  const ctx = { api, sesion, perfil: sesion?.perfil, params, query, navegar, recargarSesion, rol };
  const contenido = h('div.vista');
  vistaActual = { encontrada, ctx, contenido, ruta };
  if (encontrada.publica || !sesion) {
    vaciar(raiz, marcoPublico(contenido));
  } else {
    vaciar(raiz, marco(contenido, ruta));
  }
  contenido.append(cargando());
  try {
    const vista = await encontrada.vista();
    const nodo = await vista(ctx);
    vaciar(contenido, nodo);
  } catch (e) {
    console.error(e);
    vaciar(contenido, h('div.panel.error-carga', h('h2', 'No se pudo cargar esta sección'), h('p', mensajeError(e)), h('button.btn.btn-secundario', { onclick: cargarRuta }, 'Reintentar')));
  }
  window.scrollTo(0, 0);
}

// ---------- Actualización automática para el personal ----------
// Cuando cambia un turno en la base (pedido nuevo, cancelación, confirmación), las pantallas
// que muestran turnos se vuelven a dibujar solas, sin mover el scroll.
// En la ficha, solo la pestaña Turnos (en el odontograma se perderían cambios sin guardar).
const RUTAS_CON_TURNOS = [/^\/$/, /^\/agenda$/, /^\/pacientes\/[^/]+\/turnos$/];
let dejarDeEscuchar = null;
let refrescoPendiente = null;

async function refrescarEnSilencio() {
  const v = vistaActual;
  if (!v || !RUTAS_CON_TURNOS.some((r) => r.test(v.ruta))) return;
  // Si hay una ventana abierta (dar turno, confirmar...), esperar a que se cierre
  if (document.querySelector('dialog[open]')) {
    refrescoPendiente = setTimeout(refrescarEnSilencio, 800);
    return;
  }
  try {
    const nodo = await (await v.encontrada.vista())(v.ctx);
    if (vistaActual !== v || document.querySelector('dialog[open]')) return;
    const y = window.scrollY;
    vaciar(v.contenido, nodo);
    window.scrollTo(0, y);
  } catch (e) {
    console.warn('No se pudo actualizar la vista', e);
  }
}

function escucharCambios() {
  dejarDeEscuchar?.();
  dejarDeEscuchar = null;
  const rol = sesion?.perfil?.rol;
  if (!rol || rol === 'paciente' || !api.escucharTurnos) return;
  dejarDeEscuchar = api.escucharTurnos(({ nuevoPedido }) => {
    if (nuevoPedido) aviso('Llegó un pedido de turno nuevo.');
    clearTimeout(refrescoPendiente);
    refrescoPendiente = setTimeout(refrescarEnSilencio, 400);
  });
}

async function recargarSesion() {
  sesion = await api.sesion();
  if (sesion && !sesion.perfil) {
    aviso('Tu cuenta no tiene un perfil asignado. Contactá al consultorio.', 'error');
    await api.salir();
    sesion = null;
  }
  escucharCambios();
  return sesion;
}

async function salir() {
  if (!(await confirmar('Vas a cerrar la sesión en este dispositivo.', { titulo: 'Cerrar sesión', aceptar: 'Cerrar sesión' }))) return;
  await api.salir();
  sesion = null;
  escucharCambios();
  navegar('/ingresar');
}

function bandaDemo() {
  if (!modoDemo) return null;
  return h('div.banda-demo',
    h('p', h('strong', 'Demostración: '), 'los datos quedan solo en este navegador.'),
    h('button.btn-link', {
      type: 'button',
      onclick: async () => {
        if (await confirmar('Se borran los cambios y vuelven los datos de ejemplo.', { titulo: 'Reiniciar demostración', aceptar: 'Reiniciar' })) {
          api.reiniciarDemo();
          sesion = null;
          navegar('/ingresar');
        }
      },
    }, 'Reiniciar'));
}

function marcoPublico(contenido) {
  return h('div.marco-publico',
    bandaDemo(),
    h('header.barra-publica', h('a.marca-app', { href: 'index.html' }, h('img', { src: 'assets/img/logo.png', alt: 'Smiles Campana' })),
      h('a.btn.btn-fantasma.btn-chico', { href: 'index.html' }, 'Volver al sitio')),
    h('main.principal-publico', contenido));
}

function marco(contenido, ruta) {
  const { perfil } = sesion;
  const esPaciente = perfil.rol === 'paciente';
  const items = (esPaciente ? MENU.paciente : MENU.personal).filter((i) => !i.roles || i.roles.includes(perfil.rol));
  const activo = (r) => (r === '/' ? ruta === '/' || ruta === '/pedir-turno' && esPaciente : ruta === r || ruta.startsWith(`${r}/`));
  const enlace = (i, clase) => h(`a.${clase}`, { href: `#${i.ruta}`, 'aria-current': activo(i.ruta) ? 'page' : null },
    h('span.icono', { html: ICONOS[i.icono] }), h('span', i.texto));
  const nombre = [perfil.nombre, perfil.apellido].filter(Boolean).join(' ') || perfil.email;

  const usuario = h('div.usuario',
    h('span.avatar', { 'aria-hidden': 'true' }, (perfil.nombre || perfil.email || '?')[0].toUpperCase()),
    h('div.usuario-texto', h('strong', nombre), h('span', ROLES[perfil.rol])),
    h('button.btn-icono', { type: 'button', title: 'Cerrar sesión', 'aria-label': 'Cerrar sesión', onclick: salir, html: ICONOS.salir }));

  return h(`div.marco.marco-${esPaciente ? 'paciente' : 'personal'}`,
    bandaDemo(),
    h('div.marco-cuerpo',
      h('aside.lateral',
        h('a.marca-app', { href: '#/' }, h('img', { src: 'assets/img/logo.png', alt: 'Smiles Campana' })),
        h('nav.menu', { 'aria-label': 'Secciones' }, items.map((i) => enlace(i, 'menu-item'))),
        usuario),
      h('header.barra-movil',
        h('a.marca-app', { href: '#/' }, h('img', { src: 'assets/img/logo.png', alt: 'Smiles Campana' })),
        h('span.barra-rol', ROLES[perfil.rol]),
        h('button.btn-icono', { type: 'button', 'aria-label': 'Cerrar sesión', onclick: salir, html: ICONOS.salir })),
      h('main.principal', contenido),
      h('nav.menu-inferior', { 'aria-label': 'Secciones' }, items.map((i) => enlace(i, 'menu-inf-item')))));
}

// Si se llega desde un enlace de email vencido, Supabase deja el error en la URL
const errorEnlace = new URLSearchParams(location.hash.slice(1)).get('error_description');
await recargarSesion();
window.addEventListener('hashchange', cargarRuta);
if (errorEnlace) {
  aviso('El enlace del email venció o ya se usó. Pedí uno nuevo.', 'error');
  history.replaceState(null, '', location.pathname);
}
if (sesion && api.esRecuperacion?.()) navegar('/nueva-clave', { reemplazar: true });
else cargarRuta();
