// Implementación real sobre Supabase. Los permisos los hace cumplir la base (ver supabase/schema.sql).
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../../../config.js';
import { isoEn, partes, sumarDias } from '../lib/dates.js';
import { prepararFoto } from '../lib/imagenes.js';

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

const COLS_TURNO_PACIENTE = 'id, paciente_id, inicio, duracion, motivo, estado, creado_por, creado_en, inicio_pedido, cambio_ofrecido_en, sobreturno, fin, paciente:pacientes(id, nombre, apellido, dni, telefono, email)';

const turnoDesdeDB = (t) => (t ? { ...t, inicio: new Date(t.inicio).toISOString(), fin: t.fin ? new Date(t.fin).toISOString() : t.fin } : t);

// Superposición con otro turno: la base responde con la regla de exclusión (23P01) o, en versiones viejas, índice único (23505)
const SUPERPUESTO = ['23P01', '23505'];
const mensajeSuperposicion = 'Ese horario se superpone con otro turno.';

const bloqueoDesdeDB = (b) => ({ ...b, hora_desde: b.hora_desde?.slice(0, 5) ?? null, hora_hasta: b.hora_hasta?.slice(0, 5) ?? null });

function agruparPorDia(lista) {
  const porDia = new Map();
  for (const iso of lista) {
    const t = new Date(iso).toISOString();
    const f = partes(t).fecha;
    if (!porDia.has(f)) porDia.set(f, []);
    porDia.get(f).push(t);
  }
  return [...porDia].map(([fecha, horarios]) => ({ fecha, horarios }));
}

async function sesionActual() {
  const { data } = await sb.auth.getSession();
  return data.session;
}

const urlsFotos = new Map();

/** Pedido al Worker del sitio con la sesión actual. Si responde con error, lanza su mensaje. */
async function alWorker(ruta, init = {}) {
  const s = await sesionActual();
  if (!s) throw new Error('Tu sesión terminó. Ingresá de nuevo.');
  const r = await fetch(ruta, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${s.access_token}` } });
  if (!r.ok) {
    const datos = await r.json().catch(() => null);
    throw new Error(datos?.error || 'No se pudo completar la operación con las fotos.');
  }
  return r;
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
      // Bloqueos vigentes: de hoy en adelante, o repetidos que todavía rigen
      sb.from('agenda_bloqueos').select('id, fecha, hora_desde, hora_hasta, repetir, hasta_fecha, motivo')
        .or(`fecha.gte.${partes().fecha},and(repetir.is.true,or(hasta_fecha.is.null,hasta_fecha.gte.${partes().fecha}))`)
        .order('fecha').order('hora_desde', { nullsFirst: true }),
    ]);
    const c = ok(cfg);
    return {
      duracion: c.duracion,
      intervalo: c.intervalo ?? c.duracion,
      margenSobreturno: c.margen_sobreturno ?? 60,
      diasVisibles: c.dias_visibles,
      horasCancelacion: c.horas_cancelacion,
      horarios: ok(horarios).map((h) => ({ dia: h.dia, desde: h.desde.slice(0, 5), hasta: h.hasta.slice(0, 5) })),
      bloqueos: ok(bloqueos).map(bloqueoDesdeDB),
    };
  },
  async guardarAgenda({ duracion, intervalo, diasVisibles, horasCancelacion, horarios }) {
    ok(await sb.from('agenda_config').update({ duracion, intervalo, dias_visibles: diasVisibles, horas_cancelacion: horasCancelacion }).eq('id', 1));
    ok(await sb.from('agenda_horarios').delete().gte('id', 0));
    if (horarios.length) ok(await sb.from('agenda_horarios').insert(horarios.map(({ dia, desde, hasta }) => ({ dia, desde, hasta }))));
    return true;
  },
  /** b: { fecha, hora_desde?, hora_hasta?, repetir?, hasta_fecha?, motivo? } */
  async agregarBloqueo(b) {
    ok(await sb.from('agenda_bloqueos').insert({
      fecha: b.fecha,
      hora_desde: b.hora_desde || null,
      hora_hasta: b.hora_hasta || null,
      repetir: !!b.repetir,
      hasta_fecha: b.repetir && b.hasta_fecha ? b.hasta_fecha : null,
      motivo: b.motivo || null,
    }));
  },
  async quitarBloqueo(id) {
    ok(await sb.from('agenda_bloqueos').delete().eq('id', id));
  },
  async horariosLibres(desde, dias) {
    return agruparPorDia(ok(await sb.rpc('horarios_libres', { desde, dias })));
  },
  /** Solo personal: huecos de 30 min para sobreturnos (incluye la franja extendida y los bloqueos). */
  async horariosSobreturno(desde, dias) {
    return agruparPorDia(ok(await sb.rpc('horarios_sobreturno', { desde, dias })));
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
    // Sin "correcciones": el paciente ve solo cómo quedó cada registro
    return ok(await sb.from('odontogramas').select('id, paciente_id, datos, nota, creado_por_nombre, creado_en, corregido_en')
      .order('creado_en', { ascending: false }));
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
  /** Solo admin, solo en la etapa de pruebas: borra la ficha, todo lo suyo, su cuenta y sus fotos. */
  async eliminarPaciente(id) {
    ok(await sb.rpc('eliminar_paciente', { p_id: id }));
    try {
      await alWorker(`/api/pacientes/${id}/fotos`, { method: 'DELETE' });
    } catch (e) {
      console.warn(e);
      return { aviso: 'Paciente eliminado. Sus fotos no se pudieron borrar del depósito; avisá para limpiarlas.' };
    }
    return {};
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
      .eq('estado', 'pendiente').gte('inicio', new Date().toISOString()).order('creado_en')).map(turnoDesdeDB);
  },
  /** Marca que se le ofreció otro horario al paciente (el pedido sigue reservando su horario). */
  async ofrecerCambio(id) {
    return ok(await sb.from('turnos').update({ cambio_ofrecido_en: new Date().toISOString() }).eq('id', id).select().single());
  },
  /** Mueve un turno vigente a otro horario y lo deja confirmado. Guarda el horario original. */
  async cambiarHorarioTurno(id, inicio) {
    const actual = ok(await sb.from('turnos').select('inicio, inicio_pedido').eq('id', id).single());
    const r = await sb.from('turnos').update({ inicio, estado: 'confirmado', inicio_pedido: actual.inicio_pedido || actual.inicio })
      .eq('id', id).select(COLS_TURNO_PACIENTE).single();
    if (SUPERPUESTO.includes(r.error?.code)) throw new Error(mensajeSuperposicion);
    return turnoDesdeDB(ok(r));
  },
  /** Avisa cada vez que cambia un turno (pedido nuevo, cancelación, confirmación). Devuelve la función para dejar de escuchar. */
  escucharTurnos(alCambiar) {
    const canal = sb.channel('turnos-personal')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turnos' }, (p) => {
        alCambiar({ nuevoPedido: p.eventType === 'INSERT' && p.new?.estado === 'pendiente' });
      })
      .subscribe();
    return () => sb.removeChannel(canal);
  },
  async crearTurno({ paciente_id, inicio, motivo, sobreturno = false }) {
    const { duracion } = ok(await sb.from('agenda_config').select('duracion').eq('id', 1).single());
    const r = await sb.from('turnos').insert({
      paciente_id, inicio, motivo: motivo || 'Consulta', duracion: sobreturno ? 30 : duracion, sobreturno, creado_por: 'personal',
    }).select(COLS_TURNO_PACIENTE).single();
    if (SUPERPUESTO.includes(r.error?.code)) throw new Error(mensajeSuperposicion);
    return turnoDesdeDB(ok(r));
  },
  /** extra: otros campos a guardar junto con el estado (por ejemplo, cancelado_por). */
  async cambiarEstadoTurno(id, estado, extra = {}) {
    return ok(await sb.from('turnos').update({ estado, ...extra }).eq('id', id).select().single());
  },
  async odontogramas(pacienteId) {
    return ok(await sb.from('odontogramas').select('*').eq('paciente_id', pacienteId).order('creado_en', { ascending: false }));
  },
  async guardarOdontograma(pacienteId, datos, nota) {
    return ok(await sb.from('odontogramas').insert({ paciente_id: pacienteId, datos, nota }).select().single());
  },
  /** Corrige el último registro (lo anterior queda guardado en la base). */
  async corregirOdontograma(id, datos, nota) {
    const filas = ok(await sb.from('odontogramas').update({ datos, nota }).eq('id', id).select());
    if (!filas.length) throw new Error('No tenés permiso para corregir este registro.');
    return filas[0];
  },
  /** Borra el último registro, dentro de las 48 h de creado. */
  async borrarOdontograma(id) {
    const filas = ok(await sb.from('odontogramas').delete().eq('id', id).select('id'));
    if (!filas.length) throw new Error('Este registro ya no se puede borrar (pasaron más de 48 h).');
  },
  // --- Lista de precios (la ve todo el personal; la editan contabilidad y admin) ---
  async precios() {
    return ok(await sb.from('precios').select('*').order('servicio'));
  },
  async guardarPrecio(p) {
    const datos = {
      servicio: (p.servicio || '').trim(), precio: p.precio === '' || p.precio == null ? null : Number(p.precio),
      moneda: p.moneda || 'ARS', nota: (p.nota || '').trim() || null, activo: p.activo !== false,
    };
    const r = p.id
      ? await sb.from('precios').update(datos).eq('id', p.id).select().single()
      : await sb.from('precios').insert(datos).select().single();
    if (r.error?.code === '23505') throw new Error('Ya hay un servicio con ese nombre.');
    return ok(r);
  },
  async borrarPrecio(id) {
    ok(await sb.from('precios').delete().eq('id', id));
  },
  /** Suma un porcentaje a todos los precios en pesos que se realizan. Devuelve cuántos cambió. */
  async aumentarPrecios(porcentaje, redondeo = 0) {
    return ok(await sb.rpc('aumentar_precios', { p_porcentaje: porcentaje, p_redondeo: redondeo }));
  },

  // --- Planes de tratamiento (el total lo calcula la base) ---
  async planes(pacienteId) {
    return ok(await sb.from('planes').select('*').eq('paciente_id', pacienteId).order('creado_en', { ascending: false }));
  },
  /** Crea (sin id) o actualiza un plan. */
  async guardarPlan(plan) {
    const datos = {
      titulo: plan.titulo, estado: plan.estado, items: plan.items, descuento: Number(plan.descuento) || 0,
      descuento_monto: Number(plan.descuento_monto) || 0,
      forma_pago: plan.forma_pago || null, notas: plan.notas || null, validez: plan.validez || null,
    };
    if (plan.id) return ok(await sb.from('planes').update(datos).eq('id', plan.id).select().single());
    return ok(await sb.from('planes').insert({ ...datos, paciente_id: plan.paciente_id }).select().single());
  },
  async borrarPlan(id) {
    const filas = ok(await sb.from('planes').delete().eq('id', id).select('id'));
    if (!filas.length) throw new Error('No se pudo borrar el plan.');
  },
  /** Prácticas usadas en planes anteriores, con su último precio (para sugerirlas al escribir). */
  async practicasUsadas() {
    const filas = ok(await sb.from('planes').select('items, creado_en').order('creado_en', { ascending: false }).limit(300));
    const vistas = new Map();
    for (const f of filas) for (const i of f.items || []) if (i.practica && !vistas.has(i.practica)) vistas.set(i.practica, i.precio ?? null);
    return [...vistas].map(([practica, precio]) => ({ practica, precio })).sort((a, b) => a.practica.localeCompare(b.practica));
  },

  // --- Fotos (archivos en Cloudflare R2, a través del Worker: worker/index.js) ---
  async fotosDePaciente(pacienteId) {
    const [secciones, fotos] = await Promise.all([
      sb.from('foto_secciones').select('*').eq('paciente_id', pacienteId).order('orden').order('creado_en'),
      sb.from('fotos').select('*').eq('paciente_id', pacienteId).order('orden').order('creado_en'),
    ]);
    return { secciones: ok(secciones), fotos: ok(fotos) };
  },
  /** Achica la foto en el navegador y la sube. Devuelve la fila creada. */
  async subirFoto(pacienteId, archivo, { seccionId = null, orden = 0 } = {}) {
    const p = await prepararFoto(archivo);
    const form = new FormData();
    form.set('paciente_id', pacienteId);
    if (seccionId) form.set('seccion_id', seccionId);
    form.set('orden', String(orden));
    form.set('ancho', String(p.ancho));
    form.set('alto', String(p.alto));
    form.set('foto', p.foto, 'foto.jpg');
    form.set('mini', p.mini, 'mini.jpg');
    return (await alWorker('/api/fotos', { method: 'POST', body: form })).json();
  },
  /** Dirección local (blob:) para mostrar la foto o su miniatura. */
  urlFoto(id, { mini = false } = {}) {
    const k = `${id}${mini ? ':mini' : ''}`;
    if (!urlsFotos.has(k)) {
      const pedido = alWorker(`/api/fotos/${id}${mini ? '?mini' : ''}`).then((r) => r.blob()).then((b) => URL.createObjectURL(b));
      pedido.catch(() => urlsFotos.delete(k));
      urlsFotos.set(k, pedido);
    }
    return urlsFotos.get(k);
  },
  async borrarFoto(id) {
    await alWorker(`/api/fotos/${id}`, { method: 'DELETE' });
  },
  /** Mueve o reordena fotos: [{ id, seccion_id, orden }]. */
  async ordenarFotos(cambios) {
    const r = await Promise.all(cambios.map(({ id, seccion_id, orden }) => sb.from('fotos').update({ seccion_id, orden }).eq('id', id)));
    r.forEach(ok);
  },
  async crearSeccion(pacienteId, { titulo, orden = 0 }) {
    return ok(await sb.from('foto_secciones').insert({ paciente_id: pacienteId, titulo, orden }).select().single());
  },
  async actualizarSeccion(id, cambios) {
    return ok(await sb.from('foto_secciones').update(cambios).eq('id', id).select().single());
  },
  /** Borra la sección; sus fotos quedan "Sin sección" (para borrarlas, borrarFoto antes). */
  async borrarSeccion(id) {
    ok(await sb.from('foto_secciones').delete().eq('id', id));
  },

  async evoluciones(pacienteId) {
    return ok(await sb.from('evoluciones').select('*').eq('paciente_id', pacienteId).order('creado_en', { ascending: false }));
  },
  async agregarEvolucion(pacienteId, { texto, piezas }) {
    return ok(await sb.from('evoluciones').insert({ paciente_id: pacienteId, texto, piezas }).select().single());
  },
  // --- Panel de control (solo admin) ---
  async resumenPanel() {
    return ok(await sb.rpc('resumen_panel'));
  },
  /**
   * Registro de acciones, del más nuevo al más viejo.
   * desde/hasta: 'AAAA-MM-DD'; quien: id de usuario, 'pacientes' o 'sistema'; prefijos: tipos de acción.
   */
  async registro({ desde, hasta, quien, prefijos, pacienteId, paciente, pagina = 0, porPagina = 50 } = {}) {
    let q = sb.from('registro').select('*').order('id', { ascending: false })
      .range(pagina * porPagina, pagina * porPagina + porPagina - 1);
    if (desde) q = q.gte('creado_en', isoEn(desde, '00:00'));
    if (hasta) q = q.lt('creado_en', isoEn(sumarDias(hasta, 1), '00:00'));
    if (quien === 'pacientes') q = q.eq('usuario_rol', 'paciente');
    else if (quien === 'sistema') q = q.is('usuario_id', null);
    else if (quien) q = q.eq('usuario_id', quien);
    if (prefijos?.length) q = q.or(prefijos.map((x) => `accion.like.${x}.*`).join(','));
    if (pacienteId) q = q.eq('paciente_id', pacienteId);
    else if (paciente?.trim()) q = q.ilike('paciente_nombre', `%${paciente.trim().replace(/[%,()]/g, ' ')}%`);
    return ok(await q);
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
