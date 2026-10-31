// Textos del registro de acciones: traduce cada acción guardada por la base (supabase/schema.sql,
// registrar_cambio) a una frase legible.
import { fechaCorta, hora } from '../../lib/dates.js';

export const TIPOS = [
  { id: 'turnos', texto: 'Turnos', prefijos: ['turno'] },
  { id: 'pacientes', texto: 'Fichas de pacientes', prefijos: ['paciente'] },
  { id: 'odontograma', texto: 'Odontograma', prefijos: ['odontograma'] },
  { id: 'historia', texto: 'Historia clínica', prefijos: ['antecedentes', 'evolucion'] },
  { id: 'fotos', texto: 'Fotos', prefijos: ['foto', 'fotos'] },
  { id: 'planes', texto: 'Planes de tratamiento', prefijos: ['plan'] },
  { id: 'precios', texto: 'Lista de precios', prefijos: ['precio', 'precios'] },
  { id: 'usuarios', texto: 'Usuarios y cuentas', prefijos: ['usuario'] },
  { id: 'agenda', texto: 'Agenda y horarios', prefijos: ['agenda'] },
  { id: 'sistema', texto: 'Sistema (copias de seguridad)', prefijos: ['sistema'] },
];

export const ROLES = { paciente: 'Paciente', recepcion: 'Recepción', odontologia: 'Odontología', admin: 'Admin', contabilidad: 'Contabilidad' };

const CAMPOS = {
  dni: 'DNI', nombre: 'nombre', apellido: 'apellido', fecha_nac: 'fecha de nacimiento', telefono: 'celular',
  email: 'correo', direccion: 'dirección', notas: 'notas',
  duracion: 'duración de los turnos', intervalo: 'intervalo', margen_sobreturno: 'margen de sobreturnos',
  dias_visibles: 'días visibles', horas_cancelacion: 'horas para cancelar',
};
export const ESTADOS_PLAN = {
  borrador: 'Borrador', propuesto: 'Propuesto', aceptado: 'Aceptado', en_curso: 'En curso', terminado: 'Terminado', descartado: 'Descartado',
};
const fmtPesos = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 2 });
export const pesos = (n) => fmtPesos.format(Number(n) || 0);
const fmtDolares = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD', currencyDisplay: 'code', minimumFractionDigits: 0, maximumFractionDigits: 2 });
/** Monto en pesos o dólares; vacío = "no se realiza" / sin precio */
export const monto = (n, moneda = 'ARS') => (n == null || n === '' ? 'sin precio' : moneda === 'USD' ? fmtDolares.format(Number(n)) : pesos(n));
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

const cuando = (iso) => (iso ? `${fechaCorta(iso)} ${hora(iso)} h` : '');
const lista = (campos = []) => campos.map((c) => CAMPOS[c] || c).join(', ');
const entre = (a) => (a ? `"${a}"` : 'Sin sección');
const horas = (d) => (d.desde ? `de ${d.desde.slice(0, 5)} a ${d.hasta.slice(0, 5)}` : 'todo el día');

/** { texto, extra }: qué se hizo y un detalle corto. */
export function describir({ accion, detalle: d = {} }) {
  const turno = d.antes === 'pendiente' ? 'el pedido' : 'el turno';
  switch (accion) {
    case 'turno.pedido': return { texto: 'Pidió un turno online', extra: [cuando(d.inicio), d.motivo].filter(Boolean).join(' · ') };
    case 'turno.dado': return { texto: d.sobreturno ? 'Dio un sobreturno' : 'Dio un turno', extra: [cuando(d.inicio), d.motivo].filter(Boolean).join(' · ') };
    case 'turno.confirmado': return { texto: d.antes === 'pendiente' ? 'Confirmó el pedido' : 'Confirmó el turno', extra: cuando(d.inicio) };
    case 'turno.cancelado':
      if (d.online) return { texto: `Canceló ${d.antes === 'pendiente' ? 'su pedido' : 'su turno'} online`, extra: cuando(d.inicio) };
      return { texto: `Canceló ${turno}`, extra: [cuando(d.inicio), d.cancelado_por === 'paciente' ? 'a pedido del paciente' : d.cancelado_por === 'consultorio' ? 'por el consultorio' : ''].filter(Boolean).join(' · ') };
    case 'turno.rechazado': return { texto: 'No confirmó el pedido', extra: cuando(d.inicio) };
    case 'turno.atendido': return { texto: 'Marcó el turno como atendido', extra: cuando(d.inicio) };
    case 'turno.ausente': return { texto: 'Marcó al paciente como ausente', extra: cuando(d.inicio) };
    case 'turno.pendiente': return { texto: 'Volvió el turno a "por confirmar"', extra: cuando(d.inicio) };
    case 'turno.cambiado': return { texto: d.estado === 'pendiente' ? 'Cambió el horario del pedido' : 'Cambió el horario del turno', extra: `${cuando(d.de)} → ${cuando(d.a)}` };
    case 'turno.cambio_ofrecido': return { texto: 'Ofreció otro horario', extra: `Pedido para el ${cuando(d.inicio)}` };
    case 'turno.borrado': return { texto: 'Borró un turno', extra: cuando(d.inicio) };

    case 'paciente.creado': return d.desde === 'registro online'
      ? { texto: 'Se registró online (ficha nueva)', extra: `DNI ${d.dni}` }
      : { texto: 'Creó la ficha', extra: `DNI ${d.dni}` };
    case 'paciente.editado': return { texto: 'Editó los datos de la ficha', extra: `Cambió: ${lista(d.campos)}` };
    case 'paciente.cuenta_vinculada': return { texto: 'Vinculó la cuenta de Mi espacio', extra: d.cuenta || '' };
    case 'paciente.cuenta_desvinculada': return { texto: 'Desvinculó la cuenta de Mi espacio', extra: d.cuenta || '' };
    case 'paciente.eliminado': return { texto: 'Eliminó al paciente, con todo lo suyo', extra: `DNI ${d.dni}` };

    case 'antecedentes.actualizados': return { texto: 'Actualizó los antecedentes', extra: '' };
    case 'evolucion.registrada': return { texto: 'Registró una evolución', extra: d.piezas ? `Piezas ${d.piezas}` : '' };
    case 'odontograma.registrado': return { texto: 'Registró el odontograma', extra: d.nota || '' };
    case 'odontograma.corregido': return { texto: 'Corrigió el odontograma', extra: `Registro del ${fechaCorta(d.registro_del)}` };
    case 'odontograma.borrado': return { texto: 'Borró un registro del odontograma', extra: `Registro del ${fechaCorta(d.registro_del)}` };

    case 'fotos.seccion_creada': return { texto: 'Creó una sección de fotos', extra: entre(d.titulo) };
    case 'fotos.seccion_renombrada': return { texto: 'Renombró una sección de fotos', extra: `${entre(d.de)} → ${entre(d.a)}` };
    case 'fotos.seccion_borrada': return { texto: 'Borró una sección de fotos', extra: entre(d.titulo) };
    case 'foto.subida': return { texto: 'Subió una foto', extra: entre(d.seccion), plural: (n) => `Subió ${n} fotos` };
    case 'foto.movida': return { texto: 'Movió una foto', extra: `${entre(d.de)} → ${entre(d.a)}`, plural: (n) => `Movió ${n} fotos` };
    case 'foto.borrada': return { texto: 'Borró una foto', extra: entre(d.seccion), plural: (n) => `Borró ${n} fotos` };

    case 'plan.creado': return { texto: 'Creó un plan de tratamiento', extra: `"${d.titulo}" · ${pesos(d.total)}` };
    case 'plan.editado': return { texto: 'Modificó un plan de tratamiento', extra: `"${d.titulo}"${d.total !== d.total_antes ? ` · ${pesos(d.total_antes)} → ${pesos(d.total)}` : ''}` };
    case 'plan.estado': return { texto: 'Cambió el estado de un plan', extra: `"${d.titulo}": ${ESTADOS_PLAN[d.de] || d.de} → ${ESTADOS_PLAN[d.a] || d.a}` };
    case 'plan.borrado': return { texto: 'Borró un plan (borrador)', extra: `"${d.titulo}"` };

    case 'precio.creado': return { texto: 'Agregó un servicio a la lista de precios', extra: `${d.servicio} · ${monto(d.precio, d.moneda)}` };
    case 'precio.cambiado': return { texto: 'Cambió un precio', extra: `${d.servicio}: ${monto(d.de, d.moneda_antes || d.moneda)} → ${monto(d.a, d.moneda)}` };
    case 'precio.editado': return { texto: d.activo === d.activo_antes ? 'Editó un servicio de la lista de precios' : d.activo ? 'Volvió a habilitar un servicio' : 'Marcó un servicio como "no se realiza"', extra: d.servicio_antes && d.servicio_antes !== d.servicio ? `${d.servicio_antes} → ${d.servicio}` : d.servicio };
    case 'precio.borrado': return { texto: 'Quitó un servicio de la lista de precios', extra: d.servicio };
    case 'precios.aumento': return { texto: 'Aplicó un aumento general de precios', extra: `${d.porcentaje > 0 ? '+' : ''}${d.porcentaje} % a ${d.cantidad} servicios${d.redondeo ? `, redondeado a ${pesos(d.redondeo)}` : ''}` };

    case 'usuario.registrado': return { texto: 'Se creó una cuenta', extra: d.cuenta || '' };
    case 'usuario.rol': return { texto: 'Cambió el rol de una cuenta', extra: `${d.cuenta}: ${ROLES[d.de] || d.de} → ${ROLES[d.a] || d.a}` };
    case 'usuario.cuenta_borrada': return { texto: 'Se borró una cuenta', extra: d.cuenta || '' };

    case 'agenda.configuracion': return { texto: 'Cambió la configuración de la agenda', extra: (d.campos || []).map((c) => `${CAMPOS[c] || c}: ${d.antes?.[c]} → ${d.ahora?.[c]}`).join(' · ') };
    case 'agenda.horarios': return { texto: 'Guardó los horarios de atención', extra: (d.franjas || []).map((f) => `${DIAS[f.dia]} ${f.desde.slice(0, 5)}–${f.hasta.slice(0, 5)}`).join(', ') };
    case 'agenda.bloqueo_agregado': return { texto: 'Bloqueó la agenda', extra: bloqueo(d) };
    case 'agenda.bloqueo_quitado': return { texto: 'Quitó un bloqueo de la agenda', extra: bloqueo(d) };
    case 'agenda.bloqueo_modificado': return { texto: 'Modificó un bloqueo de la agenda', extra: bloqueo(d) };

    case 'sistema.copia': return { texto: 'Copia de seguridad', extra: `${d.pacientes ?? '?'} pacientes, ${d.turnos ?? '?'} turnos, ${d.fotos ?? '?'} fotos` };
    case 'sistema.restauracion': return { texto: 'Restauró una copia de seguridad', extra: d.copia_del ? `Copia del ${cuando(d.copia_del)}` : '' };
    default: return { texto: accion, extra: '' };
  }
}

function bloqueo(d) {
  const dia = fechaCorta(d.fecha);
  const rep = d.repetir ? `cada ${DIAS[new Date(`${d.fecha}T12:00:00`).getDay()]}${d.hasta_fecha ? ` hasta el ${fechaCorta(d.hasta_fecha)}` : ''}` : '';
  return [d.repetir ? `Desde el ${dia}` : dia, horas(d), rep, d.motivo].filter(Boolean).join(' · ');
}
