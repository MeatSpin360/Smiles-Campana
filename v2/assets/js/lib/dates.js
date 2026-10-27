// Fechas y horas siempre en hora de Argentina (UTC-3, sin horario de verano),
// sin depender de la zona horaria del dispositivo.
const TZ = 'America/Argentina/Buenos_Aires';
const OFFSET = '-03:00';

export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
export const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

const partsFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false, weekday: 'short',
});
const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Partes locales (Argentina) de un instante. */
export function partes(d = new Date()) {
  const date = d instanceof Date ? d : new Date(d);
  const p = Object.fromEntries(partsFmt.formatToParts(date).map((x) => [x.type, x.value]));
  const hour = p.hour === '24' ? '00' : p.hour;
  return {
    fecha: `${p.year}-${p.month}-${p.day}`,
    hora: `${hour}:${p.minute}`,
    dia: WD[p.weekday],
  };
}

export const hoy = () => partes().fecha;

/** ISO con offset argentino para una fecha (YYYY-MM-DD) y hora (HH:MM). */
export const isoEn = (fecha, hora) => `${fecha}T${hora}:00${OFFSET}`;

export function sumarDias(fecha, n) {
  const d = new Date(`${fecha}T12:00:00${OFFSET}`);
  d.setUTCDate(d.getUTCDate() + n);
  return partes(d).fecha;
}

export function diaDeSemana(fecha) {
  return partes(new Date(`${fecha}T12:00:00${OFFSET}`)).dia;
}

export const minutos = (hhmm) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
export const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

const fmtLargo = new Intl.DateTimeFormat('es-AR', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' });
const fmtCorto = new Intl.DateTimeFormat('es-AR', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtHora = new Intl.DateTimeFormat('es-AR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });

export const fechaLarga = (iso) => fmtLargo.format(new Date(iso));
export const fechaCorta = (iso) => fmtCorto.format(new Date(iso.length === 10 ? `${iso}T12:00:00${OFFSET}` : iso));
export const hora = (iso) => fmtHora.format(new Date(iso));

export function edad(fechaNac) {
  if (!fechaNac) return null;
  const [y, m, d] = fechaNac.split('-').map(Number);
  const h = partes();
  const [hy, hm, hd] = h.fecha.split('-').map(Number);
  let e = hy - y;
  if (hm < m || (hm === m && hd < d)) e -= 1;
  return e;
}

export const mayuscula = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
