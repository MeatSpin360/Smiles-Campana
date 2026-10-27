import { DIAS, partes, isoEn, sumarDias, diaDeSemana, minutos, hhmm } from './dates.js';

export const AGENDA_INICIAL = {
  duracion: 30, // minutos por turno
  diasVisibles: 30, // cuántos días hacia adelante pueden reservar los pacientes
  horasCancelacion: 12, // anticipación mínima para cancelar online
  horarios: [
    { dia: 2, desde: '15:00', hasta: '21:00' },
    { dia: 4, desde: '15:00', hasta: '21:00' },
    { dia: 6, desde: '10:00', hasta: '14:00' },
  ],
};

/** Inicios de turno (ISO) de un día según la agenda. */
export function turnosDelDia(fecha, agenda) {
  const dia = diaDeSemana(fecha);
  const out = [];
  for (const h of agenda.horarios.filter((x) => x.dia === dia)) {
    for (let m = minutos(h.desde); m + agenda.duracion <= minutos(h.hasta); m += agenda.duracion) {
      out.push(isoEn(fecha, hhmm(m)));
    }
  }
  return out.sort();
}

/**
 * Horarios libres agrupados por día.
 * ocupados: lista de ISO de turnos no cancelados. bloqueos: lista de fechas YYYY-MM-DD.
 */
export function horariosLibres({ agenda, ocupados = [], bloqueos = [], desde, dias, ahora = new Date() }) {
  const tomados = new Set(ocupados.map((i) => new Date(i).getTime()));
  const bloq = new Set(bloqueos);
  const limite = ahora.getTime() + 60 * 60 * 1000; // al menos 1 h de anticipación
  const res = [];
  for (let i = 0; i < dias; i++) {
    const fecha = sumarDias(desde, i);
    if (bloq.has(fecha)) continue;
    const libres = turnosDelDia(fecha, agenda).filter((iso) => {
      const t = new Date(iso).getTime();
      return t > limite && !tomados.has(t);
    });
    if (libres.length) res.push({ fecha, horarios: libres });
  }
  return res;
}

/** Texto de estado para el sitio público: "Abierto ahora, hasta las 21:00", etc. */
export function estadoAtencion(agenda, bloqueos = [], ahora = new Date()) {
  const p = partes(ahora);
  const bloq = new Set(bloqueos);
  const ahoraMin = minutos(p.hora);
  const hoyH = bloq.has(p.fecha) ? [] : agenda.horarios.filter((h) => h.dia === p.dia).sort((a, b) => minutos(a.desde) - minutos(b.desde));
  for (const h of hoyH) {
    if (ahoraMin >= minutos(h.desde) && ahoraMin < minutos(h.hasta)) {
      return { abierto: true, texto: `Atendiendo ahora, hasta las ${h.hasta} h` };
    }
    if (ahoraMin < minutos(h.desde)) {
      return { abierto: false, texto: `Hoy atendemos de ${h.desde} a ${h.hasta} h` };
    }
  }
  for (let i = 1; i <= 14; i++) {
    const f = sumarDias(p.fecha, i);
    if (bloq.has(f)) continue;
    const d = diaDeSemana(f);
    const h = agenda.horarios.filter((x) => x.dia === d).sort((a, b) => minutos(a.desde) - minutos(b.desde))[0];
    if (h) {
      const cuando = i === 1 ? 'mañana' : `el ${DIAS[d]}`;
      return { abierto: false, texto: `Próxima atención: ${cuando} a las ${h.desde} h` };
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
