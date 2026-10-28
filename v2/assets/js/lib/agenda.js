import { DIAS, partes, isoEn, sumarDias, diaDeSemana, minutos, hhmm, fechaLarga, mayuscula } from './dates.js';

// Las mismas reglas que la base (supabase/schema.sql: bloqueado, horarios_libres, horarios_sobreturno).
// Las usan el modo demo, la agenda del personal y el sitio público.

export const AGENDA_INICIAL = {
  duracion: 60, // minutos de cada turno
  intervalo: 30, // cada cuántos minutos se ofrece un inicio
  margenSobreturno: 60, // extensión de cada franja, solo para sobreturnos del personal
  diasVisibles: 30, // cuántos días hacia adelante pueden reservar los pacientes
  horasCancelacion: 12, // anticipación mínima para cancelar online
  horarios: [
    { dia: 2, desde: '15:00', hasta: '21:00' },
    { dia: 4, desde: '15:00', hasta: '21:00' },
    { dia: 6, desde: '10:00', hasta: '14:00' },
  ],
};

export const DURACION_SOBRETURNO = 30;
const ANTICIPACION_MIN = 60 * 60 * 1000; // los pacientes piden con al menos 1 h de anticipación

const franjasDe = (agenda, fecha) => agenda.horarios
  .filter((h) => h.dia === diaDeSemana(fecha))
  .sort((a, b) => minutos(a.desde) - minutos(b.desde));

// ---------- Bloqueos ----------

/** ¿El bloqueo rige ese día? (un día puntual, o el mismo día de la semana si se repite) */
export function aplicaBloqueo(b, fecha) {
  if (!b.repetir) return b.fecha === fecha;
  return fecha >= b.fecha && (!b.hasta_fecha || fecha <= b.hasta_fecha) && diaDeSemana(fecha) === diaDeSemana(b.fecha);
}

export const bloqueosDelDia = (fecha, bloqueos = []) => bloqueos.filter((b) => aplicaBloqueo(b, fecha));

/** Bloqueo que tapa el rango [desde, hasta) en minutos de ese día, o null. */
export function bloqueoEn(fecha, desdeMin, hastaMin, bloqueos = []) {
  return bloqueosDelDia(fecha, bloqueos).find((b) => !b.hora_desde
    || (desdeMin < minutos(b.hora_hasta) && hastaMin > minutos(b.hora_desde))) || null;
}

/** "Martes 10 de noviembre, de 15:00 a 18:00" / "Todos los martes desde el 10/11, todo el día, sin fin" */
export function describirBloqueo(b) {
  const f = `${b.fecha}T12:00:00-03:00`;
  const horas = b.hora_desde ? `de ${b.hora_desde} a ${b.hora_hasta} h` : 'todo el día';
  if (!b.repetir) return `${mayuscula(fechaLarga(f))}, ${horas}`;
  const corta = (x) => { const [, m, d] = x.split('-'); return `${Number(d)}/${Number(m)}`; };
  const hasta = b.hasta_fecha ? `hasta el ${corta(b.hasta_fecha)}` : 'sin fin';
  return `Todos los ${DIAS[diaDeSemana(b.fecha)]}${DIAS[diaDeSemana(b.fecha)].endsWith('s') ? '' : 's'} desde el ${corta(b.fecha)}, ${horas}, ${hasta}`;
}

// ---------- Turnos ----------

/** Inicios ofrecidos en un día: cada 'intervalo' minutos, con el turno completo dentro de la franja. */
export function turnosDelDia(fecha, agenda) {
  const out = new Set();
  const paso = agenda.intervalo || agenda.duracion;
  for (const h of franjasDe(agenda, fecha)) {
    for (let m = minutos(h.desde); m + agenda.duracion <= minutos(h.hasta); m += paso) out.add(isoEn(fecha, hhmm(m)));
  }
  return [...out].sort();
}

const seSuperpone = (ocupados, ini, fin) => ocupados.some((o) => new Date(o.inicio).getTime() < fin && new Date(o.fin).getTime() > ini);
/** Turnos activos como intervalos { inicio, fin } (ISO). */
export const intervalos = (turnos) => turnos.map((t) => ({
  inicio: t.inicio,
  fin: t.fin || new Date(new Date(t.inicio).getTime() + (t.duracion || 30) * 60000).toISOString(),
}));

/**
 * Horarios libres para pedir turno, agrupados por día.
 * ocupados: [{inicio, fin}] de turnos activos. bloqueos: filas de agenda_bloqueos.
 */
export function horariosLibres({ agenda, ocupados = [], bloqueos = [], desde, dias, ahora = new Date() }) {
  const limite = ahora.getTime() + ANTICIPACION_MIN;
  const res = [];
  for (let i = 0; i < dias; i++) {
    const fecha = sumarDias(desde, i);
    const libres = turnosDelDia(fecha, agenda).filter((iso) => {
      const ini = new Date(iso).getTime();
      const fin = ini + agenda.duracion * 60000;
      const m = minutos(partes(iso).hora);
      return ini > limite && !seSuperpone(ocupados, ini, fin) && !bloqueoEn(fecha, m, m + agenda.duracion, bloqueos);
    });
    if (libres.length) res.push({ fecha, horarios: libres });
  }
  return res;
}

/** Filas de 30 min de la franja extendida de un día (para la agenda y los sobreturnos). */
export function filasExtendidas(fecha, agenda) {
  const margen = agenda.margenSobreturno ?? 60;
  const out = new Set();
  for (const h of franjasDe(agenda, fecha)) {
    for (let m = minutos(h.desde) - margen; m + DURACION_SOBRETURNO <= minutos(h.hasta) + margen; m += DURACION_SOBRETURNO) {
      if (m >= 0) out.add(isoEn(fecha, hhmm(m)));
    }
  }
  return [...out].sort();
}

/** ¿El inicio (minutos) cae dentro de una franja de atención (sin la extensión)? */
export function dentroDeFranja(fecha, agenda, desdeMin, hastaMin) {
  return franjasDe(agenda, fecha).some((h) => desdeMin >= minutos(h.desde) && hastaMin <= minutos(h.hasta));
}

/** Huecos para sobreturnos (solo personal): 30 min en la franja extendida, sin pisar otro turno. Pueden caer en un bloqueo. */
export function huecosSobreturno({ agenda, ocupados = [], desde, dias, ahora = new Date() }) {
  const res = [];
  for (let i = 0; i < dias; i++) {
    const fecha = sumarDias(desde, i);
    const libres = filasExtendidas(fecha, agenda).filter((iso) => {
      const ini = new Date(iso).getTime();
      return ini > ahora.getTime() && !seSuperpone(ocupados, ini, ini + DURACION_SOBRETURNO * 60000);
    });
    if (libres.length) res.push({ fecha, horarios: libres });
  }
  return res;
}

// ---------- Sitio público ----------

/** Franjas de un día descontando los bloqueos (en minutos). */
function franjasEfectivas(fecha, agenda, bloqueos) {
  let tramos = franjasDe(agenda, fecha).map((h) => [minutos(h.desde), minutos(h.hasta)]);
  for (const b of bloqueosDelDia(fecha, bloqueos)) {
    if (!b.hora_desde) return [];
    const [bd, bh] = [minutos(b.hora_desde), minutos(b.hora_hasta)];
    tramos = tramos.flatMap(([d, h]) => [[d, Math.min(h, bd)], [Math.max(d, bh), h]]).filter(([d, h]) => h > d);
  }
  return tramos.sort((a, b) => a[0] - b[0]);
}

/** Texto de estado para el sitio público: "Atendiendo ahora, hasta las 21:00 h", etc. */
export function estadoAtencion(agenda, bloqueos = [], ahora = new Date()) {
  const p = partes(ahora);
  const ahoraMin = minutos(p.hora);
  for (const [d, h] of franjasEfectivas(p.fecha, agenda, bloqueos)) {
    if (ahoraMin >= d && ahoraMin < h) return { abierto: true, texto: `Atendiendo ahora, hasta las ${hhmm(h)} h` };
    if (ahoraMin < d) return { abierto: false, texto: `Hoy atendemos de ${hhmm(d)} a ${hhmm(h)} h` };
  }
  for (let i = 1; i <= 14; i++) {
    const f = sumarDias(p.fecha, i);
    const primera = franjasEfectivas(f, agenda, bloqueos)[0];
    if (primera) {
      const cuando = i === 1 ? 'mañana' : `el ${DIAS[diaDeSemana(f)]}`;
      return { abierto: false, texto: `Próximo horario de atención: ${cuando} a las ${hhmm(primera[0])} h` };
    }
  }
  return { abierto: false, texto: 'Consultá disponibilidad por WhatsApp' };
}

/** Agrupa horarios por días con el mismo rango para mostrarlos: "Martes y jueves". */
export function resumenHorarios(agenda) {
  const grupos = new Map();
  for (const h of [...agenda.horarios].sort((a, b) => ((a.dia + 6) % 7) - ((b.dia + 6) % 7))) {
    const k = `${h.desde}-${h.hasta}`;
    if (!grupos.has(k)) grupos.set(k, { desde: h.desde, hasta: h.hasta, dias: [] });
    grupos.get(k).dias.push(h.dia);
  }
  return [...grupos.values()].map((g) => {
    const nombres = [...new Set(g.dias)].map((d) => DIAS[d]);
    const dias = nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}` : nombres[0];
    return { dias: dias[0].toUpperCase() + dias.slice(1), rango: `${g.desde} a ${g.hasta} h` };
  });
}
