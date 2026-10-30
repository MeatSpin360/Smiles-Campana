// Implementación de demostración: guarda todo en el navegador (localStorage).
// Replica las reglas de permisos de la base real para que el comportamiento sea el mismo.
import { AGENDA_INICIAL, horariosLibres as calcularLibres, huecosSobreturno, intervalos, filasExtendidas, DURACION_SOBRETURNO } from '../lib/agenda.js';
import { hoy, sumarDias, isoEn, partes } from '../lib/dates.js';
import { prepararFoto } from '../lib/imagenes.js';

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
      turnos.push({ id: id(), paciente_id: p.id, inicio: iso, duracion: agenda.duracion, motivo: motivos[k % motivos.length], estado: 'confirmado', creado_por: 'personal', creado_en: ahora() });
      k++;
    }
  }
  const libreEn = (dia) => dia?.horarios.find((iso) => !turnos.some((t) => Math.abs(new Date(t.inicio) - new Date(iso)) < agenda.duracion * 60000));
  const proximo = libres[1]?.horarios.at(-1);
  if (proximo) turnos.push({ id: id(), paciente_id: pacientes[0].id, inicio: proximo, duracion: agenda.duracion, motivo: 'Control de ortodoncia', estado: 'confirmado', creado_por: 'paciente', creado_en: ahora() });
  turnos.push({ id: id(), paciente_id: pacientes[0].id, inicio: isoEn(sumarDias(hoy(), -40), '16:00'), duracion: 30, motivo: 'Primera consulta', estado: 'atendido', creado_por: 'personal', creado_en: ahora() });
  // Un pedido online esperando confirmación
  const pedido = libreEn(libres[2]);
  if (pedido) turnos.push({ id: id(), paciente_id: pacientes[6].id, inicio: pedido, duracion: agenda.duracion, motivo: 'Consulta', estado: 'pendiente', creado_por: 'paciente', creado_en: ahora() });

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
  // Datos guardados por una versión anterior de la demo
  db.agenda.intervalo ??= db.agenda.duracion;
  db.agenda.margenSobreturno ??= 60;
  db.fotos ??= [];
  db.foto_secciones ??= [];
  db.bloqueos = db.bloqueos.map((b) => ({ id: b.id || id(), hora_desde: null, hora_hasta: null, repetir: false, hasta_fecha: null, ...b }));
  return db;
}
function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(db)); } catch { /* almacenamiento no disponible */ }
}

// Archivos de las fotos de la demo: en IndexedDB del navegador (localStorage no alcanza para imágenes)
const archivos = {
  abrir() {
    this.db ??= new Promise((ok, mal) => {
      const r = indexedDB.open('smiles-demo-fotos', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('archivos');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => mal(r.error);
    });
    return this.db;
  },
  async hacer(modo, fn) {
    const base = await this.abrir();
    return new Promise((ok, mal) => {
      const tx = base.transaction('archivos', modo);
      const r = fn(tx.objectStore('archivos'));
      tx.oncomplete = () => ok(r?.result);
      tx.onerror = () => mal(tx.error);
    });
  },
  guardar(k, blob) { return this.hacer('readwrite', (st) => st.put(blob, k)); },
  leer(k) { return this.hacer('readonly', (st) => st.get(k)); },
  borrar(k) { return this.hacer('readwrite', (st) => st.delete(k)); },
  vaciar() { return this.hacer('readwrite', (st) => st.clear()); },
};
const urlsFotos = new Map();

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
  return { ...t, paciente: p ? { id: p.id, nombre: p.nombre, apellido: p.apellido, dni: p.dni, telefono: p.telefono, email: p.email } : null };
}

/** ¿El rango [inicio, inicio + duracion) pisa otro turno activo? (igual que la regla de exclusión de la base) */
function ocupado(inicio, duracion, excluirId) {
  const a = new Date(inicio).getTime();
  const b = a + duracion * 60000;
  return intervalos(cargar().turnos.filter((x) => x.id !== excluirId && activo(x)))
    .some((o) => new Date(o.inicio).getTime() < b && new Date(o.fin).getTime() > a);
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
    const f = hoy();
    const vigentes = d.bloqueos.filter((b) => b.fecha >= f || (b.repetir && (!b.hasta_fecha || b.hasta_fecha >= f)));
    return espera({ ...d.agenda, bloqueos: vigentes.sort((a, b) => a.fecha.localeCompare(b.fecha) || (a.hora_desde || '').localeCompare(b.hora_desde || '')) });
  },
  async guardarAgenda(agenda) {
    requiere('recepcion', 'admin');
    const d = cargar();
    d.agenda = {
      ...d.agenda,
      duracion: Number(agenda.duracion),
      intervalo: Number(agenda.intervalo || agenda.duracion),
      diasVisibles: Number(agenda.diasVisibles),
      horasCancelacion: Number(agenda.horasCancelacion),
      horarios: agenda.horarios,
    };
    guardar();
    return espera(true);
  },
  async agregarBloqueo(b) {
    requiere('recepcion', 'admin');
    if ((!b.hora_desde) !== (!b.hora_hasta) || (b.hora_desde && b.hora_hasta <= b.hora_desde)) throw new Error('Revisá el horario del bloqueo.');
    const d = cargar();
    d.bloqueos.push({
      id: id(), fecha: b.fecha, hora_desde: b.hora_desde || null, hora_hasta: b.hora_hasta || null,
      repetir: !!b.repetir, hasta_fecha: b.repetir && b.hasta_fecha ? b.hasta_fecha : null, motivo: b.motivo || null,
    });
    guardar();
  },
  async quitarBloqueo(bid) {
    requiere('recepcion', 'admin');
    const d = cargar();
    d.bloqueos = d.bloqueos.filter((b) => b.id !== bid);
    guardar();
  },
  async horariosLibres(desde, dias) {
    const d = cargar();
    return espera(calcularLibres({ agenda: d.agenda, ocupados: intervalos(d.turnos.filter(activo)), bloqueos: d.bloqueos, desde, dias }));
  },
  async horariosSobreturno(desde, dias) {
    requiere(...PERSONAL);
    const d = cargar();
    return espera(huecosSobreturno({ agenda: d.agenda, ocupados: intervalos(d.turnos.filter(activo)), desde, dias }));
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
    // Límite contra abusos: con 4 cancelaciones propias en el día, no puede pedir hasta mañana
    if (d.turnos.filter((t) => t.paciente_id === p.id && t.cancelado_en && partes(t.cancelado_en).fecha === hoy()).length >= 4) {
      throw new Error('Por actividad sospechosa no podés pedir turnos hasta mañana. Si lo necesitás, escribinos por WhatsApp.');
    }
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
    t.cancelado_en = ahora();
    t.cancelado_por = 'paciente';
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
  async eliminarPaciente(pid) {
    requiere('admin');
    const d = cargar();
    const p = d.pacientes.find((x) => x.id === pid);
    if (!p) throw new Error('No encontramos ese paciente.');
    for (const t of ['turnos', 'odontogramas', 'evoluciones']) d[t] = d[t].filter((x) => x.paciente_id !== pid);
    d.antecedentes = d.antecedentes.filter((x) => x.paciente_id !== pid);
    for (const f of d.fotos.filter((x) => x.paciente_id === pid)) {
      archivos.borrar(f.id).catch(() => {});
      archivos.borrar(`${f.id}:mini`).catch(() => {});
    }
    d.fotos = d.fotos.filter((x) => x.paciente_id !== pid);
    d.foto_secciones = d.foto_secciones.filter((x) => x.paciente_id !== pid);
    const cuenta = d.usuarios.find((u) => u.id === p.usuario_id);
    if (cuenta?.rol === 'paciente') d.usuarios = d.usuarios.filter((u) => u !== cuenta);
    d.pacientes = d.pacientes.filter((x) => x !== p);
    guardar();
    return espera();
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
      .sort((a, b) => a.creado_en.localeCompare(b.creado_en))
      .map(conPaciente));
  },
  async crearTurno({ paciente_id, inicio, motivo, sobreturno = false }) {
    requiere(...PERSONAL);
    const d = cargar();
    const duracion = sobreturno ? DURACION_SOBRETURNO : d.agenda.duracion;
    if (ocupado(inicio, duracion)) throw new Error('Ese horario se superpone con otro turno.');
    if (sobreturno && !filasExtendidas(partes(inicio).fecha, d.agenda).some((x) => new Date(x).getTime() === new Date(inicio).getTime())) {
      throw new Error(`El sobreturno tiene que estar dentro del horario de atención, con hasta ${d.agenda.margenSobreturno} minutos antes o después.`);
    }
    const t = { id: id(), paciente_id, inicio, duracion, sobreturno, motivo: motivo || 'Consulta', estado: 'confirmado', creado_por: 'personal', creado_en: ahora() };
    d.turnos.push(t);
    guardar();
    return espera(conPaciente(t));
  },
  async cambiarEstadoTurno(tid, estado, extra = {}) {
    requiere(...PERSONAL);
    const t = cargar().turnos.find((x) => x.id === tid);
    Object.assign(t, extra, { estado });
    guardar();
    return espera(t);
  },
  async ofrecerCambio(tid) {
    requiere(...PERSONAL);
    const t = cargar().turnos.find((x) => x.id === tid);
    t.cambio_ofrecido_en = ahora();
    guardar();
    return espera(t);
  },
  async cambiarHorarioTurno(tid, inicio) {
    requiere(...PERSONAL);
    const t = cargar().turnos.find((x) => x.id === tid);
    if (ocupado(inicio, t.duracion, tid)) throw new Error('Ese horario se superpone con otro turno.');
    t.inicio_pedido ||= t.inicio;
    Object.assign(t, { inicio, estado: 'confirmado' });
    guardar();
    return espera(conPaciente(t));
  },
  /** En la demo, los cambios hechos en otra pestaña del mismo navegador llegan como evento 'storage'. */
  escucharTurnos(alCambiar) {
    const pendientes = () => new Set(cargar().turnos.filter((t) => t.estado === 'pendiente').map((t) => t.id));
    let antes = pendientes();
    const oir = (e) => {
      if (e.key !== CLAVE) return;
      db = null;
      const ahoraP = pendientes();
      const nuevoPedido = [...ahoraP].some((x) => !antes.has(x));
      antes = ahoraP;
      alCambiar({ nuevoPedido });
    };
    window.addEventListener('storage', oir);
    return () => window.removeEventListener('storage', oir);
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
  async corregirOdontograma(oid, datos, nota) {
    const u = requiere(...CLINICO);
    const d = cargar();
    const o = d.odontogramas.find((x) => x.id === oid);
    if (d.odontogramas.some((x) => x.paciente_id === o.paciente_id && x.creado_en > o.creado_en)) throw new Error('Solo se puede corregir el último registro del odontograma.');
    if (o.creado_por !== u.id && u.rol !== 'admin') throw new Error('No tenés permiso para corregir este registro.');
    o.correcciones = [...(o.correcciones || []), { datos: o.datos, nota: o.nota, reemplazado_en: ahora(), por: u.id, por_nombre: nombreUsuario(u) }];
    Object.assign(o, { datos, nota: nota || '', corregido_en: ahora(), corregido_por_nombre: nombreUsuario(u) });
    guardar();
    return espera(o);
  },
  async borrarOdontograma(oid) {
    const u = requiere(...CLINICO);
    const d = cargar();
    const o = d.odontogramas.find((x) => x.id === oid);
    if (d.odontogramas.some((x) => x.paciente_id === o.paciente_id && x.creado_en > o.creado_en)) throw new Error('Solo se puede borrar el último registro del odontograma.');
    if ((o.creado_por !== u.id && u.rol !== 'admin') || Date.now() - new Date(o.creado_en) > 48 * 3600e3) throw new Error('Este registro ya no se puede borrar (pasaron más de 48 h).');
    d.odontogramas = d.odontogramas.filter((x) => x !== o);
    guardar();
    return espera();
  },
  // --- Fotos ---
  async fotosDePaciente(pid) {
    requiere(...CLINICO);
    const d = cargar();
    const orden = (a, b) => a.orden - b.orden || a.creado_en.localeCompare(b.creado_en);
    return espera({
      secciones: d.foto_secciones.filter((x) => x.paciente_id === pid).sort(orden),
      fotos: d.fotos.filter((x) => x.paciente_id === pid).sort(orden),
    });
  },
  async subirFoto(pid, archivo, { seccionId = null, orden = 0 } = {}) {
    const u = requiere(...CLINICO);
    const p = await prepararFoto(archivo);
    const f = { id: id(), paciente_id: pid, seccion_id: seccionId, orden, ancho: p.ancho, alto: p.alto, bytes: p.foto.size, creado_por: u.id, creado_por_nombre: nombreUsuario(u), creado_en: ahora() };
    await archivos.guardar(f.id, p.foto);
    await archivos.guardar(`${f.id}:mini`, p.mini);
    cargar().fotos.push(f);
    guardar();
    return espera(f);
  },
  urlFoto(fid, { mini = false } = {}) {
    requiere(...CLINICO);
    const k = `${fid}${mini ? ':mini' : ''}`;
    if (!urlsFotos.has(k)) {
      urlsFotos.set(k, archivos.leer(k).then((b) => {
        if (!b) throw new Error('No encontramos el archivo de esa foto.');
        return URL.createObjectURL(b);
      }));
    }
    return urlsFotos.get(k);
  },
  async borrarFoto(fid) {
    requiere(...CLINICO);
    const d = cargar();
    d.fotos = d.fotos.filter((x) => x.id !== fid);
    guardar();
    await archivos.borrar(fid);
    await archivos.borrar(`${fid}:mini`);
    return espera();
  },
  async ordenarFotos(cambios) {
    requiere(...CLINICO);
    const d = cargar();
    for (const c of cambios) {
      const f = d.fotos.find((x) => x.id === c.id);
      if (c.seccion_id && d.foto_secciones.find((x) => x.id === c.seccion_id)?.paciente_id !== f.paciente_id) throw new Error('Esa sección es de otro paciente.');
      Object.assign(f, { seccion_id: c.seccion_id, orden: c.orden });
    }
    guardar();
    return espera();
  },
  async crearSeccion(pid, { titulo, orden = 0 }) {
    const u = requiere(...CLINICO);
    if (!titulo?.trim()) throw new Error('Escribí un título para la sección.');
    const s = { id: id(), paciente_id: pid, titulo, orden, creado_por: u.id, creado_por_nombre: nombreUsuario(u), creado_en: ahora() };
    cargar().foto_secciones.push(s);
    guardar();
    return espera(s);
  },
  async actualizarSeccion(sid, cambios) {
    requiere(...CLINICO);
    if ('titulo' in cambios && !cambios.titulo?.trim()) throw new Error('Escribí un título para la sección.');
    const s = cargar().foto_secciones.find((x) => x.id === sid);
    Object.assign(s, { titulo: cambios.titulo ?? s.titulo, orden: cambios.orden ?? s.orden });
    guardar();
    return espera(s);
  },
  async borrarSeccion(sid) {
    requiere(...CLINICO);
    const d = cargar();
    d.foto_secciones = d.foto_secciones.filter((x) => x.id !== sid);
    for (const f of d.fotos) if (f.seccion_id === sid) f.seccion_id = null;
    guardar();
    return espera();
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
    archivos.vaciar().catch(() => {});
    db = null;
  },
};
