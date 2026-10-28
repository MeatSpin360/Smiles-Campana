// Implementación real sobre Supabase. Los permisos los hace cumplir la base (ver supabase/schema.sql).
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../../config.js';
import { isoEn, partes } from '../lib/dates.js';

// Los enlaces de los emails (confirmar cuenta, recuperar clave) vuelven con la sesión en la URL.
// Se detecta antes de crear el cliente, que limpia la URL al leerla.
const vieneDeRecuperacion = /type=recovery/.test(location.hash);
const volverA = `${location.origin}${location.pathname}`;

// Flujo 'implicit': el enlace funciona aunque el email se abra en otro dispositivo.
const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, flowType: 'implicit', detectSessionInUrl: true },
});

export const modoDemo = false;

function ok({ data, error }) {
  if (error) throw new Error(error.message);
  return data;
}

const COLS_TURNO_PACIENTE = 'id, paciente_id, inicio, duracion, motivo, estado, creado_por, creado_en, paciente:pacientes(id, nombre, apellido, dni, telefono, email)';

const turnoDesdeDB = (t) => (t ? { ...t, inicio: new Date(t.inicio).toISOString() } : t);

async function sesionActual() {
  const { data } = await sb.auth.getSession();
  return data.session;
}

export const api = {
  // --- Sesión ---
  esRecuperacion: () => vieneDeRecuperacion,
  async sesion() {
    const s = await sesionActual();
    if (!s) return null;
    const perfil = ok(await sb.from('perfiles').select('id, email, rol, nombre, apellido, dni').eq('id', s.user.id).maybeSingle());
    return { usuario: { id: s.user.id, email: s.user.email }, perfil };
  },
  async ingresar(email, clave) {
    ok(await sb.auth.signInWithPassword({ email: email.trim(), password: clave }));
    return (await api.sesion())?.perfil;
  },
  async salir() {
    await sb.auth.signOut();
  },
  async recuperarClave(email) {
    ok(await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: volverA }));
    return true;
  },
  async nuevaClave(clave) {
    ok(await sb.auth.updateUser({ password: clave }));
  },
  async registrarse({ email, clave, dni, nombre, apellido, telefono, fecha_nac }) {
    const data = ok(await sb.auth.signUp({
      email: email.trim(),
      password: clave,
      options: {
        data: { dni, nombre, apellido, telefono, fecha_nac },
        emailRedirectTo: volverA,
      },
    }));
    return { requiereConfirmacion: !data.session };
  },

  // --- Agenda ---
  async agenda() {
    const [cfg, horarios, bloqueos] = await Promise.all([
      sb.from('agenda_config').select('*').eq('id', 1).single(),
      sb.from('agenda_horarios').select('dia, desde, hasta').order('dia').order('desde'),
      sb.from('agenda_bloqueos').select('fecha, motivo').gte('fecha', partes().fecha).order('fecha'),
    ]);
    const c = ok(cfg);
    return {
      duracion: c.duracion,
      diasVisibles: c.dias_visibles,
      horasCancelacion: c.horas_cancelacion,
      horarios: ok(horarios).map((h) => ({ dia: h.dia, desde: h.desde.slice(0, 5), hasta: h.hasta.slice(0, 5) })),
      bloqueos: ok(bloqueos),
    };
  },
  async guardarAgenda({ duracion, diasVisibles, horasCancelacion, horarios }) {
    ok(await sb.from('agenda_config').update({ duracion, dias_visibles: diasVisibles, horas_cancelacion: horasCancelacion }).eq('id', 1));
    ok(await sb.from('agenda_horarios').delete().gte('id', 0));
    if (horarios.length) ok(await sb.from('agenda_horarios').insert(horarios.map(({ dia, desde, hasta }) => ({ dia, desde, hasta }))));
    return true;
  },
  async agregarBloqueo(fecha, motivo) {
    ok(await sb.from('agenda_bloqueos').upsert({ fecha, motivo }));
  },
  async quitarBloqueo(fecha) {
    ok(await sb.from('agenda_bloqueos').delete().eq('fecha', fecha));
  },
  async horariosLibres(desde, dias) {
    const lista = ok(await sb.rpc('horarios_libres', { desde, dias }));
    const porDia = new Map();
    for (const iso of lista) {
      const t = new Date(iso).toISOString();
      const f = partes(t).fecha;
      if (!porDia.has(f)) porDia.set(f, []);
      porDia.get(f).push(t);
    }
    return [...porDia].map(([fecha, horarios]) => ({ fecha, horarios }));
  },

  // --- Paciente (su propia cuenta) ---
  async miFicha() {
    const s = await sesionActual();
    return ok(await sb.from('pacientes').select('*').eq('usuario_id', s.user.id).maybeSingle());
  },
  async actualizarMisDatos({ telefono, email, direccion }) {
    return ok(await sb.rpc('actualizar_mis_datos', { p_telefono: telefono, p_email: email, p_direccion: direccion }));
  },
  async misTurnos() {
    return ok(await sb.from('turnos').select('*').order('inicio')).map(turnoDesdeDB);
  },
  async pedirTurno(inicio, motivo) {
    return turnoDesdeDB(ok(await sb.rpc('pedir_turno', { p_inicio: inicio, p_motivo: motivo })));
  },
  async cancelarMiTurno(id) {
    return ok(await sb.rpc('cancelar_mi_turno', { p_id: id }));
  },
  async miOdontograma() {
    return ok(await sb.from('odontogramas').select('*').order('creado_en', { ascending: false }));
  },

  // --- Personal ---
  async buscarPacientes(texto = '') {
    let q = sb.from('pacientes').select('*').order('apellido').limit(100);
    const t = texto.trim().replace(/[%,()]/g, ' ');
    if (t) q = q.or(`apellido.ilike.%${t}%,nombre.ilike.%${t}%,dni.ilike.%${t}%,telefono.ilike.%${t}%`);
    return ok(await q);
  },
  async paciente(id) {
    return ok(await sb.from('pacientes').select('*').eq('id', id).single());
  },
  async crearPaciente(datos) {
    return ok(await sb.from('pacientes').insert(limpiar(datos)).select().single());
  },
  async actualizarPaciente(id, datos) {
    return ok(await sb.from('pacientes').update(limpiar(datos)).eq('id', id).select().single());
  },
  async antecedentes(id) {
    return ok(await sb.from('antecedentes').select('*').eq('paciente_id', id).maybeSingle()) || { paciente_id: id, texto: '' };
  },
  async guardarAntecedentes(id, texto) {
    const s = await sesionActual();
    ok(await sb.from('antecedentes').upsert({ paciente_id: id, texto, actualizado_en: new Date().toISOString(), actualizado_por: s.user.id }));
  },
  async turnos({ desde, hasta }) {
    return ok(await sb.from('turnos').select(COLS_TURNO_PACIENTE)
      .gte('inicio', isoEn(desde, '00:00')).lte('inicio', isoEn(hasta, '23:59')).order('inicio')).map(turnoDesdeDB);
  },
  async turnosDePaciente(id) {
    return ok(await sb.from('turnos').select('*').eq('paciente_id', id).order('inicio', { ascending: false })).map(turnoDesdeDB);
  },
  async turnosPendientes() {
    return ok(await sb.from('turnos').select(COLS_TURNO_PACIENTE)
      .eq('estado', 'pendiente').gte('inicio', new Date().toISOString()).order('inicio')).map(turnoDesdeDB);
  },
  async crearTurno({ paciente_id, inicio, motivo }) {
    const { duracion } = ok(await sb.from('agenda_config').select('duracion').eq('id', 1).single());
    const r = await sb.from('turnos').insert({ paciente_id, inicio, motivo: motivo || 'Consulta', duracion, creado_por: 'personal' }).select(COLS_TURNO_PACIENTE).single();
    if (r.error?.code === '23505') throw new Error('Ya hay un turno en ese horario.');
    return turnoDesdeDB(ok(r));
  },
  async cambiarEstadoTurno(id, estado) {
    return ok(await sb.from('turnos').update({ estado }).eq('id', id).select().single());
  },
  async odontogramas(pacienteId) {
    return ok(await sb.from('odontogramas').select('*').eq('paciente_id', pacienteId).order('creado_en', { ascending: false }));
  },
  async guardarOdontograma(pacienteId, datos, nota) {
    return ok(await sb.from('odontogramas').insert({ paciente_id: pacienteId, datos, nota }).select().single());
  },
  async evoluciones(pacienteId) {
    return ok(await sb.from('evoluciones').select('*').eq('paciente_id', pacienteId).order('creado_en', { ascending: false }));
  },
  async agregarEvolucion(pacienteId, { texto, piezas }) {
    return ok(await sb.from('evoluciones').insert({ paciente_id: pacienteId, texto, piezas }).select().single());
  },
  async cuentasSinVincular() {
    return ok(await sb.rpc('cuentas_sin_vincular'));
  },
  async vincularCuenta(perfilId, pacienteId) {
    const r = await sb.from('pacientes').update({ usuario_id: perfilId }).eq('id', pacienteId).is('usuario_id', null).select();
    if (!ok(r).length) throw new Error('Esa ficha ya tiene una cuenta vinculada.');
  },
  async usuarios() {
    return ok(await sb.from('perfiles').select('id, email, rol, nombre, apellido, dni').order('rol'));
  },
  async cambiarRol(perfilId, rol) {
    const r = await sb.from('perfiles').update({ rol }).eq('id', perfilId).select();
    if (!ok(r).length) throw new Error('No se pudo cambiar el rol.');
  },
};

// Convierte "" en null para que fechas y campos opcionales se guarden bien
function limpiar(datos) {
  return Object.fromEntries(Object.entries(datos).map(([k, v]) => [k, v === '' ? null : v]));
}
