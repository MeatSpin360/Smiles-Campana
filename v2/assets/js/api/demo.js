// Implementación de demostración: guarda todo en el navegador (localStorage).
// Replica las reglas de permisos de la base real para que el comportamiento sea el mismo.
import { AGENDA_INICIAL, horariosLibres as calcularLibres } from '../lib/agenda.js';
import { hoy, sumarDias, isoEn } from '../lib/dates.js';

const CLAVE = 'smiles-demo-v2';
const CLAVE_SESION = 'smiles-demo-sesion';
const PERSONAL = ['recepcion', 'odontologia', 'admin'];
const CLINICO = ['odontologia', 'admin'];
const activo = (t) => !['cancelado', 'rechazado'].includes(t.estado);

const id = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
const ahora = () => new Date().toISOString();
const espera = (v) => new Promise((r) => setTimeout(() => r(v), 120));

function semilla() {
  const pacientes = [
    ['30123456', 'Ana', 'García', '1990-05-10', '3489444101', 'paciente@demo.com'],
    ['28987654', 'Juan', 'Pérez', '1985-11-22', '3489444102', 'juan@correo.com'],
    ['31234567', 'María', 'López', '1992-03-15', '3489444103', 'maria@correo.com'],
    ['32345678', 'Carlos', 'Fernández', '1988-07-30', '3489444104', ''],
    ['33456789', 'Laura', 'Martínez', '1995-12-01', '3489444105', 'laura@correo.com'],
    ['45678123', 'Tomás', 'Gómez', '2015-09-18', '3489444106', ''],
    ['35678901', 'Lucía', 'Sánchez', '1998-02-25', '3489444107', 'lucia@correo.com'],
    ['36789012', 'Diego', 'Romero', '1987-06-12', '3489444108', ''],
  ].map(([dni, nombre, apellido, fecha_nac, telefono, email]) => ({
    id: id(), dni, nombre, apellido, fecha_nac, telefono, email, direccion: '', notas: '', usuario_id: null, creado_en: ahora(),
  }));

  const usuarios = [
    { email: 'paciente@demo.com', rol: 'paciente', nombre: 'Ana', apellido: 'García', dni: '30123456' },
    { email: 'recepcion@demo.com', rol: 'recepcion', nombre: 'Romina', apellido: 'Acosta' },
    { email: 'odontologia@demo.com', rol: 'odontologia', nombre: 'Florencia', apellido: "D'Ambrosio" },
    { email: 'admin@demo.com', rol: 'admin', nombre: 'Administración', apellido: '' },
  ].map((u) => ({ id: id(), clave: 'demo1234', ...u }));
  pacientes[0].usuario_id = usuarios[0].id;

  // Turnos de ejemplo en los próximos días hábiles
  const turnos = [];
  const agenda = structuredClone(AGENDA_INICIAL);
  const libres = calcularLibres({ agenda, desde: hoy(), dias: 14, ahora: new Date(Date.now() - 864e5) });
  const motivos = ['Control de ortodoncia', 'Limpieza', 'Consulta', 'Arreglo de caries', 'Control', 'Blanqueamiento'];
  let k = 0;
  for (const d of libres.slice(0, 4)) {
    for (const iso of d.horarios.filter((_, i) => i % 2 === 0).slice(0, 4)) {
      const p = pacientes[(k % (pacientes.length - 1)) + 1];
      turnos.push({ id: id(), paciente_id: p.id, inicio: iso, duracion: 30, motivo: motivos[k % motivos.length], estado: 'confirmado', creado_por: 'personal', creado_en: ahora() });
      k++;
    }
  }
  const proximo = libres[1]?.horarios.at(-1);
  if (proximo) turnos.push({ id: id(), paciente_id: pacientes[0].id, inicio: proximo, duracion: 30, motivo: 'Control de ortodoncia', estado: 'confirmado', creado_por: 'paciente', creado_en: ahora() });
  turnos.push({ id: id(), paciente_id: pacientes[0].id, inicio: isoEn(sumarDias(hoy(), -40), '16:00'), duracion: 30, motivo: 'Primera consulta', estado: 'atendido', creado_por: 'personal', creado_en: ahora() });
  // Un pedido online esperando confirmación
  const pedido = libres[2]?.horarios.find((iso) => !turnos.some((t) => t.inicio === iso));
  if (pedido) turnos.push({ id: id(), paciente_id: pacientes[6].id, inicio: pedido, duracion: 30, motivo: 'Consulta', estado: 'pendiente', creado_por: 'paciente', creado_en: ahora() });

  const inicial = { temporales: false, piezas: { 16: { caras: { O: 'r', D: 'r' }, marcas: {} }, 26: { caras: { O: 'b' }, marcas: {} }, 36: { caras: {}, marcas: { conducto: 'r', corona: 'r' } }, 48: { caras: {}, marcas: { extraccion: 'r' } }, 18: { caras: {}, marcas: { extraccion: 'b' } }, 21: { caras: { M: 'r' }, marcas: {} } } };
  const actual = structuredClone(inicial);
  actual.piezas[16].caras = { O: 'b', D: 'b' };
  actual.piezas[21].caras = { M: 'b' };
  const dra = usuarios[2];
  const odontogramas = [
    { id: id(), paciente_id: pacientes[0].id, datos: inicial, nota: 'Odontograma inicial', creado_por: dra.id, creado_por_nombre: 'Florencia D\'Ambrosio', creado_en: isoEn(sumarDias(hoy(), -40), '16:20') },
    { id: id(), paciente_id: pacientes[0].id, datos: actual, nota: 'Obturaciones en 16 y 21', creado_por: dra.id, creado_por_nombre: 'Florencia D\'Ambrosio', creado_en: isoEn(sumarDias(hoy(), -12), '17:05') },
  ];
  const evoluciones = [
    { id: id(), paciente_id: pacientes[0].id, texto: 'Primera consulta. Se toman radiografías. Se indica extracción de 48 y tratamiento de conducto en 36.', piezas: '36, 48', creado_por_nombre: 'Florencia D\'Ambrosio', creado_en: isoEn(sumarDias(hoy(), -40), '16:25') },
    { id: id(), paciente_id: pacientes[0].id, texto: 'Obturación con resina en 16 (O, D) y 21 (M). Sin complicaciones.', piezas: '16, 21', creado_por_nombre: 'Florencia D\'Ambrosio', creado_en: isoEn(sumarDias(hoy(), -12), '17:10') },
  ];
  const antecedentes = [{ paciente_id: pacientes[0].id, texto: 'Alergia a la penicilina. No toma medicación habitual.', actualizado_en: ahora() }];
  return { usuarios, pacientes, turnos, agenda, bloqueos: [], odontogramas, evoluciones, antecedentes };
}

let db;
function cargar() {
  if (db) return db;
  try {
    db = JSON.parse(localStorage.getItem(CLAVE));
  } catch { db = null; }
  if (!db) {
    db = semilla();
    guardar();
  }
  return db;
}
function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(db)); } catch { /* almacenamiento no disponible */ }
}

function usuarioActual() {
  let uid = null;
  try { uid = localStorage.getItem(CLAVE_SESION); } catch { /* */ }
  return cargar().usuarios.find((u) => u.id === uid) || null;
}

function requiere(...roles) {
  const u = usuarioActual();
  if (!u) throw new Error('Tu sesión terminó. Ingresá de nuevo.');
  if (roles.length && !roles.includes(u.rol)) throw new Error('No tenés permiso para hacer esto.');
  return u;
}

const perfilPublico = (u) => ({ id: u.id, email: u.email, rol: u.rol, nombre: u.nombre, apellido: u.apellido, dni: u.dni || null });
const nombreUsuario = (u) => `${u.nombre} ${u.apellido}`.trim();

function miPaciente() {
  const u = requiere('paciente');
  return cargar().pacientes.find((p) => p.usuario_id === u.id) || null;
}

function conPaciente(t) {
  const p = cargar().pacientes.find((x) => x.id === t.paciente_id);
  return { ...t, paciente: p ? { id: p.id, nombre: p.nombre, apellido: p.apellido, dni: p.dni, telefono: p.telefono } : null };
}

function ocupado(inicio, excluirId) {
  const t = new Date(inicio).getTime();
  return cargar().turnos.some((x) => x.id !== excluirId && activo(x) && new Date(x.inicio).getTime() === t);
}

export const modoDemo = true;

export const api = {
  // --- Sesión ---
  async sesion() {
    const u = usuarioActual();
    return espera(u ? { usuario: { id: u.id, email: u.email }, perfil: perfilPublico(u) } : null);
  },
  async ingresar(email, clave) {
    const u = cargar().usuarios.find((x) => x.email.toLowerCase() === email.toLowerCase().trim());
    if (!u || u.clave !== clave) throw new Error('Invalid login credentials');
    localStorage.setItem(CLAVE_SESION, u.id);
    return espera(perfilPublico(u));
  },
  async salir() {
    localStorage.removeItem(CLAVE_SESION);
  },
  async recuperarClave() {
    return espera(true);
  },
  async registrarse({ email, clave, dni, nombre, apellido, telefono, fecha_nac }) {
    const d = cargar();
    if (d.usuarios.some((u) => u.email.toLowerCase() === email.toLowerCase())) throw new Error('User already registered');
    if (clave.length < 8) throw new Error('Password should be at least 8 characters');
    const u = { id: id(), email, clave, rol: 'paciente', nombre, apellido, dni };
    d.usuarios.push(u);
    // Misma regla que la base real: si ya hay una ficha con ese DNI, recepción la vincula.
    const existente = d.pacientes.find((p) => p.dni === dni);
    if (!existente) {
      d.pacientes.push({ id: id(), dni, nombre, apellido, fecha_nac, telefono, email, direccion: '', notas: '', usuario_id: u.id, creado_en: ahora() });
    } else if (!existente.usuario_id && existente.email && existente.email.toLowerCase() === email.toLowerCase()) {
      existente.usuario_id = u.id;
    }
    guardar();
    localStorage.setItem(CLAVE_SESION, u.id);
    return espera({ requiereConfirmacion: false });
  },

  // --- Agenda ---
  async agenda() {
    const d = cargar();
    return espera({ ...d.agenda, bloqueos: [...d.bloqueos].sort((a, b) => a.fecha.localeCompare(b.fecha)) });
  },
  async guardarAgenda(agenda) {
    requiere('recepcion', 'admin');
    const d = cargar();
    d.agenda = { duracion: Number(agenda.duracion), diasVisibles: Number(agenda.diasVisibles), horasCancelacion: Number(agenda.horasCancelacion), horarios: agenda.horarios };
    guardar();
    return espera(true);
  },
  async agregarBloqueo(fecha, motivo) {
    requiere('recepcion', 'admin');
    const d = cargar();
    if (!d.bloqueos.some((b) => b.fecha === fecha)) d.bloqueos.push({ fecha, motivo });
    guardar();
  },
  async quitarBloqueo(fecha) {
    requiere('recepcion', 'admin');
    const d = cargar();
    d.bloqueos = d.bloqueos.filter((b) => b.fecha !== fecha);
    guardar();
  },
  async horariosLibres(desde, dias) {
    const d = cargar();
    return espera(calcularLibres({
      agenda: d.agenda,
      ocupados: d.turnos.filter(activo).map((t) => t.inicio),
      bloqueos: d.bloqueos.map((b) => b.fecha),
      desde,
      dias,
    }));
  },

  // --- Paciente (su propia cuenta) ---
  async miFicha() {
    return espera(miPaciente());
  },
  async actualizarMisDatos({ telefono, email, direccion }) {
    const p = miPaciente();
    if (!p) throw new Error('Tu cuenta todavía no está vinculada a una ficha.');
    Object.assign(p, { telefono, email, direccion });
    guardar();
    return espera(p);
  },
  async misTurnos() {
    const p = miPaciente();
    if (!p) return [];
    return espera(cargar().turnos.filter((t) => t.paciente_id === p.id).sort((a, b) => a.inicio.localeCompare(b.inicio)));
  },
  async pedirTurno(inicio, motivo) {
    const p = miPaciente();
    if (!p) throw new Error('Tu cuenta todavía no está vinculada a una ficha. Llamanos y lo resolvemos.');
    const d = cargar();
    if (d.turnos.some((t) => t.paciente_id === p.id && ['pendiente', 'confirmado'].includes(t.estado) && new Date(t.inicio) > new Date())) {
      throw new Error('Ya pediste un turno. Cancelalo si querés elegir otro horario.');
    }
    const libres = await api.horariosLibres(hoy(), d.agenda.diasVisibles);
    if (!libres.some((x) => x.horarios.includes(inicio))) throw new Error('Ese horario ya no está disponible. Elegí otro.');
    const t = { id: id(), paciente_id: p.id, inicio, duracion: d.agenda.duracion, motivo: motivo || 'Consulta', estado: 'pendiente', creado_por: 'paciente', creado_en: ahora() };
    d.turnos.push(t);
    guardar();
    return espera(t);
  },
  async cancelarMiTurno(turnoId) {
    const p = miPaciente();
    const horasMinimas = cargar().agenda.horasCancelacion ?? 12;
    const t = cargar().turnos.find((x) => x.id === turnoId && x.paciente_id === p?.id);
    if (!t) throw new Error('No encontramos ese turno.');
    if (!['pendiente', 'confirmado'].includes(t.estado)) throw new Error('Ese turno ya no se puede cancelar.');
    // Un pedido sin confirmar se puede retirar en cualquier momento
    if (t.estado === 'confirmado' && new Date(t.inicio).getTime() - Date.now() < horasMinimas * 3600e3) {
      throw new Error(`Los turnos se pueden cancelar online hasta ${horasMinimas} h antes. Escribinos por WhatsApp.`);
    }
    t.estado = 'cancelado';
    guardar();
    return espera(t);
  },
  async miOdontograma() {
    const p = miPaciente();
    if (!p) return [];
    return espera(cargar().odontogramas.filter((o) => o.paciente_id === p.id).sort((a, b) => b.creado_en.localeCompare(a.creado_en)));
  },

  // --- Personal ---
  async buscarPacientes(texto = '') {
    requiere(...PERSONAL);
    const norm = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const q = norm(texto);
    return espera(cargar().pacientes
      .filter((p) => !q || norm(`${p.apellido} ${p.nombre} ${p.dni} ${p.telefono}`).includes(q))
      .sort((a, b) => a.apellido.localeCompare(b.apellido))
      .slice(0, 100));
  },
  async paciente(pid) {
    requiere(...PERSONAL);
    const p = cargar().pacientes.find((x) => x.id === pid);
    if (!p) throw new Error('No encontramos esa ficha.');
    return espera({ ...p });
  },
  async crearPaciente(datos) {
    requiere(...PERSONAL);
    const d = cargar();
    if (d.pacientes.some((p) => p.dni === datos.dni)) throw new Error('Ya existe un paciente con ese DNI.');
    const p = { id: id(), direccion: '', notas: '', email: '', telefono: '', fecha_nac: null, ...datos, usuario_id: null, creado_en: ahora() };
    d.pacientes.push(p);
    guardar();
    return espera(p);
  },
  async actualizarPaciente(pid, datos) {
    requiere(...PERSONAL);
    const d = cargar();
    const p = d.pacientes.find((x) => x.id === pid);
    if (datos.dni && d.pacientes.some((x) => x.dni === datos.dni && x.id !== pid)) throw new Error('Ya existe otro paciente con ese DNI.');
    Object.assign(p, datos);
    guardar();
    return espera(p);
  },
  async antecedentes(pid) {
    requiere(...CLINICO);
    return espera(cargar().antecedentes.find((a) => a.paciente_id === pid) || { paciente_id: pid, texto: '' });
  },
  async guardarAntecedentes(pid, texto) {
    requiere(...CLINICO);
    const d = cargar();
    const a = d.antecedentes.find((x) => x.paciente_id === pid);
    if (a) Object.assign(a, { texto, actualizado_en: ahora() });
    else d.antecedentes.push({ paciente_id: pid, texto, actualizado_en: ahora() });
    guardar();
  },
  async turnos({ desde, hasta }) {
    requiere(...PERSONAL);
    const a = new Date(isoEn(desde, '00:00')).getTime();
    const b = new Date(isoEn(hasta, '23:59')).getTime();
    return espera(cargar().turnos
      .filter((t) => { const x = new Date(t.inicio).getTime(); return x >= a && x <= b; })
      .sort((x, y) => x.inicio.localeCompare(y.inicio))
      .map(conPaciente));
  },
  async turnosDePaciente(pid) {
    requiere(...PERSONAL);
    return espera(cargar().turnos.filter((t) => t.paciente_id === pid).sort((a, b) => b.inicio.localeCompare(a.inicio)));
  },
  async turnosPendientes() {
    requiere(...PERSONAL);
    const ya = Date.now();
    return espera(cargar().turnos
      .filter((t) => t.estado === 'pendiente' && new Date(t.inicio).getTime() > ya)
      .sort((a, b) => a.inicio.localeCompare(b.inicio))
      .map(conPaciente));
  },
  async crearTurno({ paciente_id, inicio, motivo }) {
    requiere(...PERSONAL);
    if (ocupado(inicio)) throw new Error('Ya hay un turno en ese horario.');
    const d = cargar();
    const t = { id: id(), paciente_id, inicio, duracion: d.agenda.duracion, motivo: motivo || 'Consulta', estado: 'confirmado', creado_por: 'personal', creado_en: ahora() };
    d.turnos.push(t);
    guardar();
    return espera(conPaciente(t));
  },
  async cambiarEstadoTurno(tid, estado) {
    requiere(...PERSONAL);
    const t = cargar().turnos.find((x) => x.id === tid);
    t.estado = estado;
    guardar();
    return espera(t);
  },
  async odontogramas(pid) {
    requiere(...CLINICO);
    return espera(cargar().odontogramas.filter((o) => o.paciente_id === pid).sort((a, b) => b.creado_en.localeCompare(a.creado_en)));
  },
  async guardarOdontograma(pid, datos, nota) {
    const u = requiere(...CLINICO);
    const o = { id: id(), paciente_id: pid, datos, nota: nota || '', creado_por: u.id, creado_por_nombre: nombreUsuario(u), creado_en: ahora() };
    cargar().odontogramas.push(o);
    guardar();
    return espera(o);
  },
  async evoluciones(pid) {
    requiere(...CLINICO);
    return espera(cargar().evoluciones.filter((e) => e.paciente_id === pid).sort((a, b) => b.creado_en.localeCompare(a.creado_en)));
  },
  async agregarEvolucion(pid, { texto, piezas }) {
    const u = requiere(...CLINICO);
    const e = { id: id(), paciente_id: pid, texto, piezas: piezas || '', creado_por: u.id, creado_por_nombre: nombreUsuario(u), creado_en: ahora() };
    cargar().evoluciones.push(e);
    guardar();
    return espera(e);
  },
  async cuentasSinVincular() {
    requiere(...PERSONAL);
    const d = cargar();
    const vinculados = new Set(d.pacientes.map((p) => p.usuario_id).filter(Boolean));
    return espera(d.usuarios.filter((u) => u.rol === 'paciente' && !vinculados.has(u.id)).map(perfilPublico));
  },
  async vincularCuenta(perfilId, pacienteId) {
    requiere(...PERSONAL);
    const d = cargar();
    const p = d.pacientes.find((x) => x.id === pacienteId);
    if (p.usuario_id) throw new Error('Esa ficha ya tiene una cuenta vinculada.');
    p.usuario_id = perfilId;
    guardar();
  },
  async usuarios() {
    requiere('admin');
    return espera(cargar().usuarios.map(perfilPublico).sort((a, b) => a.rol.localeCompare(b.rol)));
  },
  async cambiarRol(perfilId, rol) {
    const yo = requiere('admin');
    if (perfilId === yo.id) throw new Error('No podés cambiar tu propio rol.');
    cargar().usuarios.find((u) => u.id === perfilId).rol = rol;
    guardar();
  },

  // Solo demo
  reiniciarDemo() {
    localStorage.removeItem(CLAVE);
    localStorage.removeItem(CLAVE_SESION);
    db = null;
  },
};
