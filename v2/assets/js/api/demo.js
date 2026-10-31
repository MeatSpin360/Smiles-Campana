// Implementación de demostración: guarda todo en el navegador (localStorage).
// Replica las reglas de permisos de la base real para que el comportamiento sea el mismo.
import { AGENDA_INICIAL, horariosLibres as calcularLibres, huecosSobreturno, intervalos, filasExtendidas, DURACION_SOBRETURNO } from '../lib/agenda.js';
import { hoy, sumarDias, isoEn, partes } from '../lib/dates.js';
import { prepararFoto, prepararComprobante } from '../lib/imagenes.js';

const PRECIOS_INICIALES = [{"servicio": "Aparatos removibles", "precio": 400000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Aparatos removibles inferior", "precio": 200000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Apertura de urgencia", "precio": null, "moneda": "ARS", "nota": null, "activo": false}, {"servicio": "Blanqueamiento ambulatorio", "precio": 50000, "moneda": "ARS", "nota": "Por maxilar", "activo": true}, {"servicio": "Blanqueamiento interno", "precio": null, "moneda": "ARS", "nota": null, "activo": false}, {"servicio": "Blanqueamiento láser", "precio": 150000, "moneda": "ARS", "nota": "Ambas arcadas", "activo": true}, {"servicio": "Blanqueamiento láser, 2.ª sesión", "precio": 80000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Botón", "precio": 5000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Bracket metálico", "precio": 8000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Bracket de porcelana", "precio": 10000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Bucodental: evaluación FF. AA. o escolar", "precio": 20000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Cajita porta brackets", "precio": 8000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Caries compleja", "precio": 80000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Caries compuesta", "precio": 70000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Caries con surco inicial", "precio": 60000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Carillas de resina", "precio": 100000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Cepillo (x 2 unidades)", "precio": 6000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Cepillo (unidad)", "precio": 3500, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Cepillo de ortodoncia", "precio": 5000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Compostura simple: rebasado acrílico", "precio": 60000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Consulta", "precio": 30000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Consulta de ortodoncia", "precio": 30000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Consulta de guardia", "precio": 50000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Contención fija", "precio": 100000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Contención final", "precio": 70000, "moneda": "ARS", "nota": "Por maxilar", "activo": true}, {"servicio": "Control de aparato removible", "precio": 35000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Control de contención", "precio": 50000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Control de ortodoncia invisible", "precio": 70000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Control metálico", "precio": 56000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Control de porcelana", "precio": 60000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Control de tratamiento periodontal", "precio": 50000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Corona provisoria", "precio": 50000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Desgaste estético", "precio": 35000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Extracción de resto mucoso", "precio": 60000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Extracción", "precio": 90000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Ferulización periodontal", "precio": 90000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Flúor", "precio": 20000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Gomas intermaxilares (x 100 unidades)", "precio": 8000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Implante", "precio": 700, "moneda": "USD", "nota": null, "activo": true}, {"servicio": "Incrustación de resina", "precio": 180000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Instalación de brackets metálicos", "precio": 200000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Instalación de brackets de porcelana", "precio": 250000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Cepillos interdentales", "precio": 3000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Kit de ortodoncia", "precio": 7000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Levante de mordida", "precio": 10000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Limpieza con brochita", "precio": 5000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Limpieza de sarro", "precio": 75000, "moneda": "ARS", "nota": "Ambos maxilares", "activo": true}, {"servicio": "Ortodoncia invisible", "precio": 1800000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Piercing dental / gema", "precio": 40000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Pieza dentaria retenida mucosa", "precio": null, "moneda": "ARS", "nota": null, "activo": false}, {"servicio": "Placa de bruxismo", "precio": 100000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Placa de levante", "precio": 80000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Prótesis de acrílico completa", "precio": 600000, "moneda": "ARS", "nota": "Ambos maxilares", "activo": true}, {"servicio": "Prótesis de acrílico parcial", "precio": 450000, "moneda": "ARS", "nota": "Ambos maxilares", "activo": true}, {"servicio": "Arañita flex (3 piezas)", "precio": 200000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Prótesis flex parcial", "precio": 200000, "moneda": "ARS", "nota": "Por maxilar. Ambos maxilares: $390.000", "activo": true}, {"servicio": "Raspaje: retiro de cemento de aparatología fija", "precio": 50000, "moneda": "ARS", "nota": "Por maxilar", "activo": true}, {"servicio": "Reparación de puntos de contención fija", "precio": 30000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Sellador de puntos y fisuras", "precio": 35000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Tratamiento de conducto multirradicular", "precio": null, "moneda": "ARS", "nota": null, "activo": false}, {"servicio": "Tratamiento de conducto unirradicular", "precio": null, "moneda": "ARS", "nota": null, "activo": false}, {"servicio": "Tratamiento periodontal", "precio": 55000, "moneda": "ARS", "nota": "Por sesión y por sector", "activo": true}, {"servicio": "Tubo", "precio": 10000, "moneda": "ARS", "nota": null, "activo": true}, {"servicio": "Urgencia de ortodoncia", "precio": null, "moneda": "ARS", "nota": null, "activo": false}];
const CLAVE = 'smiles-demo-v2';
const CLAVE_SESION = 'smiles-demo-sesion';
const PERSONAL = ['recepcion', 'odontologia', 'admin'];
const CLINICO = ['odontologia', 'admin'];
const CONTABLE = ['contabilidad', 'admin'];
const CAJA = ['recepcion', 'admin'];  // cargan y corrigen pagos
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
    { email: 'contabilidad@demo.com', rol: 'contabilidad', nombre: 'Carla', apellido: 'Contable' },
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
  // Última copia de seguridad: el domingo pasado a las 3:00
  const domingo = sumarDias(hoy(), -new Date(`${hoy()}T12:00:00`).getDay());
  const registro = [{ id: 1, creado_en: new Date(isoEn(domingo, '03:00')).toISOString(), usuario_id: null, usuario_nombre: 'Sistema', usuario_rol: null, accion: 'sistema.copia', paciente_id: null, paciente_nombre: null, detalle: { pacientes: pacientes.length, turnos: turnos.length, fotos: 0 } }];
  return { usuarios, pacientes, turnos, agenda, bloqueos: [], odontogramas, evoluciones, antecedentes, registro };
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
  db.planes ??= [];
  db.precios ??= PRECIOS_INICIALES.map((x, i) => ({ id: id(), ...x, orden: i, creado_en: ahora(), actualizado_en: null, actualizado_por_nombre: null }));
  if (!db.usuarios.some((u) => u.rol === 'contabilidad')) db.usuarios.push({ id: id(), clave: 'demo1234', email: 'contabilidad@demo.com', rol: 'contabilidad', nombre: 'Carla', apellido: 'Contable' });
  db.foto_secciones ??= [];
  if (!db.pagos) {
    // Ejemplos: Ana debe una parte de la última consulta y Juan dejó una seña
    const [ana, juan] = db.pacientes;
    const ej = (pac, dias, facturado, pagado, comentario) => ({
      id: id(), paciente_id: pac.id, fecha: sumarDias(hoy(), dias), facturado, paga_justo: facturado === pagado, pagado, comentario,
      comprobante_tipo: null, comprobante_nombre: null, comprobante_bytes: null,
      creado_por: null, creado_por_nombre: 'Romina Acosta', creado_en: ahora(), actualizado_en: null, actualizado_por_nombre: null,
    });
    db.pagos = [ana && ej(ana, -40, 30000, 30000, 'Primera consulta'), ana && ej(ana, -12, 140000, 100000, 'Obturaciones 16 y 21. Resto en el próximo turno'),
      juan && ej(juan, -3, 0, 50000, 'Seña para brackets')].filter(Boolean);
  }
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
    d.planes = d.planes.filter((x) => x.paciente_id !== pid);
    for (const g of d.pagos.filter((x) => x.paciente_id === pid)) archivos.borrar(`comprobante:${g.id}`).catch(() => {});
    d.pagos = d.pagos.filter((x) => x.paciente_id !== pid);
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

// ---------- Registro de acciones (igual que en la base real: lo anota "la base", no cada pantalla) ----------
function anotar(accion, pacienteId = null, detalle = {}, pacienteNombre = null) {
  const d = cargar();
  d.registro ??= [];
  const u = usuarioActual();
  const p = d.pacientes.find((x) => x.id === pacienteId);
  d.registro.push({
    id: (d.registro.at(-1)?.id || 0) + 1,
    creado_en: ahora(),
    usuario_id: u?.id || null,
    usuario_nombre: u ? nombreUsuario(u) || u.email : 'Sistema',
    usuario_rol: u?.rol || null,
    accion,
    paciente_id: pacienteId,
    paciente_nombre: pacienteNombre || (p ? `${p.apellido}, ${p.nombre}` : null),
    detalle,
  });
  guardar();
}

const turnoPorId = (tid) => cargar().turnos.find((t) => t.id === tid);
const tituloSeccion = (sid) => cargar().foto_secciones.find((s) => s.id === sid)?.titulo || null;
const camposCambiados = (antes, despues) => Object.keys(despues).filter((k) => k in antes && (antes[k] ?? '') !== (despues[k] ?? '')).sort();

// Para cada función: qué anotar, con el estado de antes (pre) y el resultado (post)
const ANOTACIONES = {
  registrarse: { post: ([datos]) => anotar('usuario.registrado', null, { cuenta: datos.email }) },
  guardarAgenda: { post: ([a]) => anotar('agenda.horarios', null, { franjas: (a.horarios || []).map((x) => ({ dia: x.dia, desde: x.desde, hasta: x.hasta })) }) },
  agregarBloqueo: { post: ([b]) => anotar('agenda.bloqueo_agregado', null, { fecha: b.fecha, hasta_fecha: b.hasta_fecha || null, desde: b.hora_desde || null, hasta: b.hora_hasta || null, repetir: !!b.repetir, motivo: b.motivo || null }) },
  quitarBloqueo: {
    pre: ([bid]) => ({ ...cargar().bloqueos.find((b) => b.id === bid) }),
    post: (a, r, b) => anotar('agenda.bloqueo_quitado', null, { fecha: b.fecha, hasta_fecha: b.hasta_fecha, desde: b.hora_desde, hasta: b.hora_hasta, repetir: b.repetir, motivo: b.motivo }),
  },
  actualizarMisDatos: {
    pre: () => ({ ...miPaciente() }),
    post: ([datos], r, antes) => { const c = camposCambiados(antes, datos); if (c.length) anotar('paciente.editado', antes.id, { campos: c }); },
  },
  pedirTurno: { post: (a, t) => anotar('turno.pedido', t.paciente_id, { inicio: t.inicio, motivo: t.motivo, sobreturno: false }) },
  cancelarMiTurno: {
    pre: ([tid]) => ({ ...turnoPorId(tid) }),
    post: (a, r, t) => anotar('turno.cancelado', t.paciente_id, { inicio: t.inicio, antes: t.estado, online: true, cancelado_por: 'paciente' }),
  },
  crearPaciente: { post: (a, p) => anotar('paciente.creado', p.id, { dni: p.dni, desde: 'personal' }) },
  eliminarPaciente: {
    pre: ([pid]) => ({ ...cargar().pacientes.find((x) => x.id === pid) }),
    post: (a, r, p) => anotar('paciente.eliminado', p.id, { dni: p.dni }, `${p.apellido}, ${p.nombre}`),
  },
  actualizarPaciente: {
    pre: ([pid]) => ({ ...cargar().pacientes.find((x) => x.id === pid) }),
    post: ([pid, datos], r, antes) => { const c = camposCambiados(antes, datos); if (c.length) anotar('paciente.editado', pid, { campos: c }); },
  },
  guardarAntecedentes: { post: ([pid]) => anotar('antecedentes.actualizados', pid) },
  crearTurno: { post: (a, t) => anotar('turno.dado', t.paciente_id, { inicio: t.inicio, sobreturno: !!t.sobreturno, motivo: t.motivo }) },
  cambiarEstadoTurno: {
    pre: ([tid]) => ({ ...turnoPorId(tid) }),
    post: ([tid, estado, extra = {}], r, t) => { if (estado !== t.estado) anotar(`turno.${estado}`, t.paciente_id, { inicio: t.inicio, antes: t.estado, cancelado_por: extra.cancelado_por || null }); },
  },
  ofrecerCambio: { pre: ([tid]) => ({ ...turnoPorId(tid) }), post: (a, r, t) => { if (!t.cambio_ofrecido_en) anotar('turno.cambio_ofrecido', t.paciente_id, { inicio: t.inicio }); } },
  cambiarHorarioTurno: {
    pre: ([tid]) => ({ ...turnoPorId(tid) }),
    post: ([tid, inicio], r, t) => {
      anotar('turno.cambiado', t.paciente_id, { de: t.inicio, a: inicio, estado: t.estado });
      if (t.estado === 'pendiente') anotar('turno.confirmado', t.paciente_id, { inicio, antes: 'pendiente' });
    },
  },
  guardarOdontograma: { post: ([pid, datos, nota]) => anotar('odontograma.registrado', pid, { nota: nota || '' }) },
  corregirOdontograma: { post: (a, o) => anotar('odontograma.corregido', o.paciente_id, { registro_del: o.creado_en, nota: o.nota }) },
  borrarOdontograma: {
    pre: ([oid]) => ({ ...cargar().odontogramas.find((o) => o.id === oid) }),
    post: (a, r, o) => anotar('odontograma.borrado', o.paciente_id, { registro_del: o.creado_en, nota: o.nota }),
  },
  agregarEvolucion: { post: ([pid, e]) => anotar('evolucion.registrada', pid, { piezas: e?.piezas || '' }) },
  subirFoto: { post: (a, f) => anotar('foto.subida', f.paciente_id, { seccion: tituloSeccion(f.seccion_id) }) },
  borrarFoto: {
    pre: ([fid]) => ({ ...cargar().fotos.find((f) => f.id === fid) }),
    post: (a, r, f) => anotar('foto.borrada', f.paciente_id, { seccion: tituloSeccion(f.seccion_id) }),
  },
  ordenarFotos: {
    pre: ([cambios]) => cambios.map((c) => ({ ...cargar().fotos.find((f) => f.id === c.id) })),
    post: ([cambios], r, antes) => cambios.forEach((c, i) => {
      if ((antes[i].seccion_id || null) !== (c.seccion_id || null)) {
        anotar('foto.movida', antes[i].paciente_id, { de: tituloSeccion(antes[i].seccion_id), a: tituloSeccion(c.seccion_id) });
      }
    }),
  },
  crearSeccion: { post: (a, s) => anotar('fotos.seccion_creada', s.paciente_id, { titulo: s.titulo }) },
  actualizarSeccion: {
    pre: ([sid]) => ({ ...cargar().foto_secciones.find((s) => s.id === sid) }),
    post: ([sid, c], r, s) => { if ('titulo' in c && c.titulo !== s.titulo) anotar('fotos.seccion_renombrada', s.paciente_id, { de: s.titulo, a: c.titulo }); },
  },
  borrarSeccion: {
    pre: ([sid]) => ({ ...cargar().foto_secciones.find((s) => s.id === sid) }),
    post: (a, r, s) => anotar('fotos.seccion_borrada', s.paciente_id, { titulo: s.titulo }),
  },
  vincularCuenta: { post: ([perfilId, pid]) => anotar('paciente.cuenta_vinculada', pid, { cuenta: cargar().usuarios.find((u) => u.id === perfilId)?.email }) },
  cambiarRol: {
    pre: ([perfilId]) => ({ ...cargar().usuarios.find((u) => u.id === perfilId) }),
    post: ([perfilId, rol], r, u) => { if (u.rol !== rol) anotar('usuario.rol', null, { cuenta: u.email, de: u.rol, a: rol }); },
  },
};
const normal = (s) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
Object.assign(api, {
  async precios() {
    requiere(...PERSONAL, 'contabilidad');
    return espera(cargar().precios.map((x) => ({ ...x })).sort((a, b) => a.servicio.localeCompare(b.servicio)));
  },
  async guardarPrecio(p) {
    const u = requiere(...CONTABLE);
    const d = cargar();
    const servicio = (p.servicio || '').trim();
    if (!servicio) throw new Error('Escribí el nombre del servicio.');
    if (d.precios.some((x) => x.id !== p.id && normal(x.servicio) === normal(servicio))) throw new Error('Ya hay un servicio con ese nombre.');
    const datos = { servicio, precio: p.precio === '' || p.precio == null ? null : Number(p.precio), moneda: p.moneda || 'ARS', nota: (p.nota || '').trim() || null, activo: p.activo !== false };
    let x = p.id && d.precios.find((y) => y.id === p.id);
    if (x) Object.assign(x, datos, { actualizado_en: ahora(), actualizado_por_nombre: nombreUsuario(u) });
    else {
      x = { id: id(), ...datos, orden: d.precios.length, creado_en: ahora(), actualizado_en: null, actualizado_por_nombre: null };
      d.precios.push(x);
    }
    guardar();
    return espera({ ...x });
  },
  async borrarPrecio(pid) {
    requiere(...CONTABLE);
    const d = cargar();
    d.precios = d.precios.filter((x) => x.id !== pid);
    guardar();
    return espera();
  },
  async aumentarPrecios(porcentaje, redondeo = 0) {
    requiere(...CONTABLE);
    const pct = Number(porcentaje);
    if (!Number.isFinite(pct) || pct <= -100 || pct > 500) throw new Error('Revisá el porcentaje.');
    let n = 0;
    for (const x of cargar().precios) {
      if (!x.activo || x.moneda !== 'ARS' || x.precio == null) continue;
      const v = x.precio * (1 + pct / 100);
      x.precio = redondeo > 0 ? Math.round(v / redondeo) * redondeo : Math.round(v * 100) / 100;
      n++;
    }
    guardar();
    return espera(n);
  },
  async planes(pid) {
    requiere(...PERSONAL);
    return espera(cargar().planes.filter((x) => x.paciente_id === pid).sort((a, b) => b.creado_en.localeCompare(a.creado_en)).map((x) => ({ ...x })));
  },
  async guardarPlan(plan) {
    const u = requiere(...PERSONAL);
    const d = cargar();
    if (!plan.titulo?.trim()) throw new Error('Escribí un título para el plan.');
    const descuento = Number(plan.descuento) || 0;
    const descuentoMonto = Number(plan.descuento_monto) || 0;
    if (descuento < 0 || descuento > 100) throw new Error('El descuento tiene que estar entre 0 y 100 %.');
    if (descuentoMonto < 0) throw new Error('El descuento no puede ser negativo.');
    const subtotal = (plan.items || []).reduce((s, i) => s + (Number(i.cantidad ?? 1) || 0) * (Number(i.precio) || 0)
      * (1 - Math.min(Math.max(Number(i.descuento) || 0, 0), 100) / 100), 0);
    const campos = {
      titulo: plan.titulo, estado: plan.estado || 'borrador', items: plan.items || [], descuento, descuento_monto: descuentoMonto,
      forma_pago: plan.forma_pago || null, notas: plan.notas || null, validez: plan.validez || null,
      total: Math.max(Math.round((subtotal * (1 - descuento / 100) - descuentoMonto) * 100) / 100, 0),
    };
    let x = plan.id && d.planes.find((y) => y.id === plan.id);
    if (x) Object.assign(x, campos, { actualizado_en: ahora(), actualizado_por_nombre: nombreUsuario(u) });
    else {
      x = { id: id(), paciente_id: plan.paciente_id, ...campos, creado_por: u.id, creado_por_nombre: nombreUsuario(u), creado_en: ahora(), actualizado_en: null, aceptado_en: null };
      d.planes.push(x);
    }
    if (['aceptado', 'en_curso', 'terminado'].includes(x.estado) && !x.aceptado_en) x.aceptado_en = ahora();
    guardar();
    return espera({ ...x });
  },
  async borrarPlan(pid) {
    requiere(...PERSONAL);
    const d = cargar();
    const x = d.planes.find((y) => y.id === pid);
    if (x.estado !== 'borrador') throw new Error('Un plan que ya se propuso no se borra: marcalo como descartado.');
    d.planes = d.planes.filter((y) => y !== x);
    guardar();
    return espera();
  },
  async practicasUsadas() {
    requiere(...PERSONAL);
    const vistas = new Map();
    for (const f of [...cargar().planes].sort((a, b) => b.creado_en.localeCompare(a.creado_en))) {
      for (const i of f.items || []) if (i.practica && !vistas.has(i.practica)) vistas.set(i.practica, i.precio ?? null);
    }
    return espera([...vistas].map(([practica, precio]) => ({ practica, precio })).sort((a, b) => a.practica.localeCompare(b.practica)));
  },
});
const copiaPago = (g) => ({ ...g });
Object.assign(api, {
  async pagos(pid) {
    requiere(...CAJA, 'contabilidad');
    return espera(cargar().pagos.filter((x) => x.paciente_id === pid)
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creado_en.localeCompare(a.creado_en)).map(copiaPago));
  },
  async guardarPago(p) {
    const u = requiere(...CAJA);
    const d = cargar();
    const facturado = Number(p.facturado) || 0;
    const pagado = p.paga_justo ? facturado : Number(p.pagado) || 0;
    if (facturado < 0 || pagado < 0) throw new Error('Los montos no pueden ser negativos.');
    if (!facturado && !pagado) throw new Error('Completá el monto facturado o lo que pagó.');
    const campos = { fecha: p.fecha || hoy(), facturado, paga_justo: !!p.paga_justo, pagado, comentario: (p.comentario || '').trim() || null };
    let x = p.id && d.pagos.find((y) => y.id === p.id);
    if (x) Object.assign(x, campos, { actualizado_en: ahora(), actualizado_por_nombre: nombreUsuario(u) });
    else {
      x = { id: id(), paciente_id: p.paciente_id, ...campos, comprobante_tipo: null, comprobante_nombre: null, comprobante_bytes: null,
        creado_por: u.id, creado_por_nombre: nombreUsuario(u), creado_en: ahora(), actualizado_en: null, actualizado_por_nombre: null };
      d.pagos.push(x);
    }
    guardar();
    return espera(copiaPago(x));
  },
  async borrarPago(gid) {
    requiere('admin');
    const d = cargar();
    if (!d.pagos.some((x) => x.id === gid)) throw new Error('No encontramos ese pago.');
    d.pagos = d.pagos.filter((x) => x.id !== gid);
    guardar();
    await archivos.borrar(`comprobante:${gid}`);
    return espera();
  },
  async subirComprobante(gid, archivo) {
    requiere(...CAJA);
    const f = await prepararComprobante(archivo);
    const x = cargar().pagos.find((y) => y.id === gid);
    if (!x) throw new Error('No encontramos ese pago.');
    await archivos.guardar(`comprobante:${gid}`, f);
    Object.assign(x, { comprobante_tipo: f.type, comprobante_nombre: f.name || 'comprobante', comprobante_bytes: f.size });
    guardar();
    return espera(copiaPago(x));
  },
  async quitarComprobante(gid) {
    requiere(...CAJA);
    const x = cargar().pagos.find((y) => y.id === gid);
    if (!x) throw new Error('No encontramos ese pago.');
    Object.assign(x, { comprobante_tipo: null, comprobante_nombre: null, comprobante_bytes: null });
    guardar();
    await archivos.borrar(`comprobante:${gid}`);
    return espera(copiaPago(x));
  },
  async urlComprobante(gid) {
    requiere(...CAJA, 'contabilidad');
    const b = await archivos.leer(`comprobante:${gid}`);
    if (!b) throw new Error('No encontramos el archivo del comprobante.');
    return URL.createObjectURL(b);
  },
  async saldosPacientes(pid = null) {
    requiere(...PERSONAL);
    const porPaciente = new Map();
    for (const g of cargar().pagos) {
      if (pid && g.paciente_id !== pid) continue;
      const s = porPaciente.get(g.paciente_id) || { paciente_id: g.paciente_id, facturado: 0, pagado: 0 };
      s.facturado += g.facturado;
      s.pagado += g.pagado;
      porPaciente.set(g.paciente_id, s);
    }
    return espera([...porPaciente.values()].map((s) => ({ ...s, saldo: Math.round((s.facturado - s.pagado) * 100) / 100 }))
      .filter((s) => pid || s.saldo !== 0));
  },
  async pagosLista({ desde = null, hasta = null } = {}) {
    requiere(...CAJA, 'contabilidad');
    const d = cargar();
    return espera(d.pagos.filter((g) => (!desde || g.fecha >= desde) && (!hasta || g.fecha <= hasta))
      .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.creado_en.localeCompare(a.creado_en))
      .map((g) => {
        const p = d.pacientes.find((x) => x.id === g.paciente_id);
        return { ...g, paciente: p ? `${p.apellido}, ${p.nombre}` : '', dni: p?.dni || '' };
      }));
  },
});
const pagoPorId = (gid) => ({ ...cargar().pagos.find((x) => x.id === gid) });
Object.assign(ANOTACIONES, {
  guardarPago: {
    pre: ([p]) => (p.id ? pagoPorId(p.id) : null),
    post: ([p], r, antes) => {
      if (!antes) return anotar('pago.cargado', r.paciente_id, { fecha: r.fecha, facturado: r.facturado, pagado: r.pagado, comprobante: false });
      if (antes.fecha !== r.fecha || antes.facturado !== r.facturado || antes.pagado !== r.pagado || (antes.comentario || null) !== (r.comentario || null)) {
        anotar('pago.corregido', r.paciente_id, { fecha: r.fecha, fecha_antes: antes.fecha, facturado: r.facturado, facturado_antes: antes.facturado,
          pagado: r.pagado, pagado_antes: antes.pagado, comentario: (antes.comentario || null) !== (r.comentario || null) });
      }
    },
  },
  subirComprobante: { post: (a, r) => anotar('pago.comprobante', r.paciente_id, { fecha: r.fecha, archivo: r.comprobante_nombre }) },
  quitarComprobante: {
    pre: ([gid]) => pagoPorId(gid),
    post: (a, r, g) => { if (g.comprobante_tipo) anotar('pago.comprobante_quitado', g.paciente_id, { fecha: g.fecha, archivo: g.comprobante_nombre }); },
  },
  borrarPago: {
    pre: ([gid]) => pagoPorId(gid),
    post: (a, r, g) => anotar('pago.borrado', g.paciente_id, { fecha: g.fecha, facturado: g.facturado, pagado: g.pagado }),
  },
});
Object.assign(ANOTACIONES, {
  guardarPrecio: {
    pre: ([p]) => (p.id ? { ...cargar().precios.find((x) => x.id === p.id) } : null),
    post: ([p], r, antes) => {
      if (!antes) return anotar('precio.creado', null, { servicio: r.servicio, precio: r.precio, moneda: r.moneda });
      if (antes.precio !== r.precio || antes.moneda !== r.moneda) anotar('precio.cambiado', null, { servicio: r.servicio, de: antes.precio, a: r.precio, moneda: r.moneda, moneda_antes: antes.moneda });
      if (antes.servicio !== r.servicio || (antes.nota || null) !== (r.nota || null) || antes.activo !== r.activo) anotar('precio.editado', null, { servicio: r.servicio, servicio_antes: antes.servicio, activo: r.activo, activo_antes: antes.activo });
    },
  },
  borrarPrecio: {
    pre: ([pid]) => ({ ...cargar().precios.find((x) => x.id === pid) }),
    post: (a, r, x) => anotar('precio.borrado', null, { servicio: x.servicio, precio: x.precio }),
  },
  aumentarPrecios: { post: ([porcentaje, redondeo = 0], n) => anotar('precios.aumento', null, { porcentaje: Number(porcentaje), redondeo, cantidad: n }) },
  guardarPlan: {
    pre: ([plan]) => (plan.id ? { ...cargar().planes.find((x) => x.id === plan.id) } : null),
    post: ([plan], r, antes) => {
      if (!antes) return anotar('plan.creado', r.paciente_id, { titulo: r.titulo, total: r.total, estado: r.estado });
      if (antes.estado !== r.estado) anotar('plan.estado', r.paciente_id, { titulo: r.titulo, de: antes.estado, a: r.estado });
      const clave = (x) => JSON.stringify([x.items, Number(x.descuento), x.titulo, x.forma_pago || null, x.notas || null, x.validez || null]);
      if (clave(antes) !== clave(r)) anotar('plan.editado', r.paciente_id, { titulo: r.titulo, total: r.total, total_antes: antes.total });
    },
  },
  borrarPlan: {
    pre: ([pid]) => ({ ...cargar().planes.find((x) => x.id === pid) }),
    post: (a, r, x) => anotar('plan.borrado', x.paciente_id, { titulo: x.titulo }),
  },
});
for (const [nombre, { pre, post }] of Object.entries(ANOTACIONES)) {
  const original = api[nombre];
  api[nombre] = async function (...args) {
    const antes = pre ? pre(args) : undefined;
    const r = await original.apply(this, args);
    post(args, r, antes);
    return r;
  };
}

Object.assign(api, {
  async resumenPanel() {
    requiere('admin');
    const d = cargar();
    const lunes = sumarDias(hoy(), -((new Date(`${hoy()}T12:00:00`).getDay() + 6) % 7));
    const enSemana = (t) => t.inicio >= isoEn(lunes, '00:00') && t.inicio < isoEn(sumarDias(lunes, 7), '00:00');
    const personal = {};
    for (const u of d.usuarios) if (u.rol !== 'paciente') personal[u.rol] = (personal[u.rol] || 0) + 1;
    const hace30 = new Date(Date.now() - 30 * 864e5).toISOString();
    return espera({
      turnos_semana: d.turnos.filter((t) => ['confirmado', 'atendido', 'ausente'].includes(t.estado) && enSemana(t)).length,
      pendientes: d.turnos.filter((t) => t.estado === 'pendiente' && t.inicio > ahora()).length,
      pacientes: d.pacientes.length,
      pacientes_nuevos: d.pacientes.filter((p) => p.creado_en > hace30).length,
      con_cuenta: d.pacientes.filter((p) => p.usuario_id).length,
      fotos: d.fotos.length,
      fotos_bytes: d.fotos.reduce((s, f) => s + (f.bytes || 0), 0),
      personal,
      cuentas_sin_vincular: d.usuarios.filter((u) => u.rol === 'paciente' && !d.pacientes.some((p) => p.usuario_id === u.id)).length,
      ultima_copia: [...(d.registro || [])].reverse().find((r) => r.accion === 'sistema.copia')?.creado_en || null,
      acciones_hoy: (d.registro || []).filter((r) => r.creado_en >= isoEn(hoy(), '00:00')).length,
    });
  },
  async registro({ desde, hasta, quien, prefijos, pacienteId, paciente, pagina = 0, porPagina = 50 } = {}) {
    requiere('admin');
    const norm = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    const lista = [...(cargar().registro || [])].reverse().filter((r) => (!desde || r.creado_en >= isoEn(desde, '00:00'))
      && (!hasta || r.creado_en < isoEn(sumarDias(hasta, 1), '00:00'))
      && (!quien || (quien === 'pacientes' ? r.usuario_rol === 'paciente' : quien === 'sistema' ? !r.usuario_id : r.usuario_id === quien))
      && (!prefijos?.length || prefijos.some((x) => r.accion.startsWith(`${x}.`)))
      && (pacienteId ? r.paciente_id === pacienteId : !paciente?.trim() || norm(r.paciente_nombre).includes(norm(paciente.trim()))));
    return espera(lista.slice(pagina * porPagina, (pagina + 1) * porPagina));
  },
});
