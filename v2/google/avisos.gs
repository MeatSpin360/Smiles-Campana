/**
 * Smiles Campana: correos de turnos y copias de seguridad.
 *
 * Corre en Google Apps Script con la cuenta smiles.campana@gmail.com.
 * - Correos: envía desde Gmail (quedan en "Enviados"). La base lo llama cada vez que un turno se
 *   confirma, se cambia de horario, lo agenda el personal o lo cancela el consultorio.
 * - Copias de seguridad: una vez por semana la base le manda una copia de sus tablas y el script la
 *   guarda en la carpeta de Drive "Smiles Campana – Respaldos" (borra las de más de 3 meses).
 *   Los lunes, 'controlarRespaldo' avisa por correo si falta la copia de la semana.
 * - Calendario: los turnos confirmados (y después atendidos o ausentes) se copian al calendario principal de la
 *   cuenta. La base avisa cada cambio y una vez por día manda la lista completa para corregir diferencias.
 *   Requiere el servicio avanzado "Google Calendar API" (Servicios → +). Va en una sola dirección: lo que se
 *   cambie en Google Calendar no vuelve a la app y el repaso diario lo deja como en la app.
 *
 * Seguridad: solo atiende pedidos que traen la clave secreta guardada en
 * Configuración del proyecto → Propiedades del script → SECRETO.
 *
 * Cómo publicarlo: ver google/LEEME.md.
 */

// ---------- Datos del consultorio ----------
const SITIO = 'https://smilescampana.com.ar'; // dirección del sitio: la usan el logo y los botones de los correos
const CONSULTORIO = {
  nombre: 'Smiles Campana',
  direccion: 'Jean Jaures 568, Campana',
  mapa: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Jean Jaures 568, Campana, Buenos Aires'),
  whatsapp: '5493487728866',
  whatsappTexto: '3487-728866',
  instagram: 'https://www.instagram.com/smiles.campana',
  instagramTexto: '@smiles.campana',
};
const ZONA = 'America/Argentina/Buenos_Aires';

// Remitente de los correos de turnos. Tiene que estar agregado en Gmail como "Enviar como"
// (ver google/CORREO-DOMINIO.md). Si todavía no lo está, se envía desde la cuenta de Gmail.
const REMITENTE = 'turnos@smilescampana.com.ar';

function opcionesEnvio(html) {
  const op = { htmlBody: html, name: CONSULTORIO.nombre };
  if (GmailApp.getAliases().indexOf(REMITENTE) >= 0) op.from = REMITENTE;
  return op;
}

// ---------- Colores y tipografía (los mismos de los correos de la cuenta) ----------
const C = {
  tinta: '#262140', tinta2: '#5d5875', tinta3: '#8a86a0',
  lavandaOsc: '#4b4796', lavandaClaro: '#e8e7f5', esmalte: '#f5f5fa', oro: '#e6b422',
};
const FUENTE = "'Bricolage Grotesque', 'Segoe UI', Helvetica, Arial, sans-serif";

// ---------- Punto de entrada ----------
function doPost(e) {
  let datos;
  try {
    datos = JSON.parse(e.postData.contents);
  } catch (err) {
    return respuesta({ ok: false, error: 'json' });
  }
  const secreto = PropertiesService.getScriptProperties().getProperty('SECRETO');
  if (!secreto || datos.secreto !== secreto) return respuesta({ ok: false, error: 'clave' });
  if (datos.tipo === 'respaldo') return respuesta(guardarRespaldo(datos.respaldo));
  if (datos.tipo === 'calendario') return respuesta(conCuidado(() => turnoEnCalendario(datos.turno)));
  if (datos.tipo === 'calendario_completo') return respuesta(conCuidado(() => sincronizarCalendario(datos)));
  if (!datos.email || !TIPOS[datos.tipo]) return respuesta({ ok: false, error: 'datos' });

  const correo = armarCorreo(datos);
  const op = opcionesEnvio(correo.html);
  GmailApp.sendEmail(datos.email, correo.asunto, correo.texto, op);
  return respuesta({ ok: true, tipo: datos.tipo, desde: op.from || 'gmail' });
}

function respuesta(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Para probar desde el editor: envía los 4 correos de ejemplo a la cuenta del consultorio. */
function probar() {
  const yo = Session.getActiveUser().getEmail();
  const en3dias = new Date(Date.now() + 3 * 864e5);
  en3dias.setUTCHours(19, 30, 0, 0); // 16:30 en Argentina
  const antes = new Date(en3dias.getTime() - 864e5);
  const ejemplos = [
    { tipo: 'confirmado' },
    { tipo: 'cambio', inicio_anterior: antes.toISOString() },
    { tipo: 'agendado' },
    { tipo: 'cancelado', era_pedido: true },
    { tipo: 'cancelado', a_pedido: true },
  ];
  ejemplos.forEach((x) => {
    const c = armarCorreo(Object.assign({ email: yo, nombre: 'Prueba', inicio: en3dias.toISOString(), duracion: 30, motivo: 'Consulta', horas_cancelacion: 12 }, x));
    GmailApp.sendEmail(yo, '[Prueba] ' + c.asunto, c.texto, opcionesEnvio(c.html));
  });
}

// ---------- Fechas en castellano ----------
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function partes(iso) {
  const d = new Date(iso);
  const [dia, num, mes, hora] = Utilities.formatDate(d, ZONA, 'u|d|M|HH:mm').split('|');
  return { dia: DIAS[Number(dia) % 7], num: Number(num), mes: MESES[Number(mes) - 1], hora };
}
const fechaLarga = (iso) => { const p = partes(iso); return `${p.dia} ${p.num} de ${p.mes}`; };
const cuando = (iso) => `${fechaLarga(iso)} a las ${partes(iso).hora} h`;
const mayuscula = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Enlace para agregar el turno a Google Calendar. */
function enlaceCalendario(d) {
  const ini = new Date(d.inicio);
  const fin = new Date(ini.getTime() + (d.duracion || 30) * 60000);
  const f = (x) => Utilities.formatDate(x, 'UTC', "yyyyMMdd'T'HHmmss'Z'");
  const q = {
    action: 'TEMPLATE',
    text: `Turno en ${CONSULTORIO.nombre}`,
    dates: `${f(ini)}/${f(fin)}`,
    location: CONSULTORIO.direccion,
    details: `${d.motivo || 'Consulta'}. Si no podés venir, avisanos.`,
  };
  // Las fechas van sin codificar: Google Calendar espera la barra tal cual
  return 'https://calendar.google.com/calendar/render?' + Object.keys(q).map((k) => `${k}=${k === 'dates' ? q[k] : encodeURIComponent(q[k])}`).join('&');
}

// ---------- Los cuatro correos ----------
const TIPOS = {
  confirmado: (d) => ({
    asunto: 'Tu turno está confirmado',
    previo: `Te esperamos el ${cuando(d.inicio)}.`,
    titulo: 'Tu turno está confirmado',
    intro: 'Confirmamos el turno que pediste. Te esperamos.',
    detalle: bloqueTurno(d),
    acciones: botonesTurno(d),
    nota: notaCancelacion(d),
  }),
  cambio: (d) => ({
    asunto: 'Cambio de turno',
    previo: `Tu turno pasó al ${cuando(d.inicio)} y queda confirmado.`,
    titulo: 'Cambiamos tu turno',
    intro: `Tu turno solicitado para el <span style="text-decoration:line-through;color:${C.tinta3};">${cuando(d.inicio_anterior)}</span> se cambió al <strong style="color:${C.tinta};font-weight:600;">${cuando(d.inicio)}</strong> y queda confirmado con este correo.`,
    detalle: bloqueTurno(d),
    acciones: botonesTurno(d),
    nota: notaCancelacion(d),
  }),
  agendado: (d) => ({
    asunto: 'Tu turno quedó agendado',
    previo: `Te esperamos el ${cuando(d.inicio)}.`,
    titulo: 'Tu turno quedó agendado',
    intro: 'Te dimos un turno en el consultorio. Estos son los datos:',
    detalle: bloqueTurno(d),
    acciones: botonesTurno(d),
    nota: notaCancelacion(d),
  }),
  cancelado: (d) => (d.a_pedido ? {
    // Lo pidió el paciente (por WhatsApp o teléfono) y lo canceló el personal
    asunto: 'Cancelamos tu turno',
    previo: `Cancelamos tu turno del ${cuando(d.inicio)}, como nos pediste.`,
    titulo: 'Cancelamos tu turno',
    intro: `Como nos pediste, cancelamos tu turno del <strong style="color:${C.tinta};font-weight:600;">${cuando(d.inicio)}</strong>.`,
    detalle: '',
    acciones: boton(`${SITIO}/app.html#/pedir-turno`, 'Pedir otro turno', true)
      + boton(`https://wa.me/${CONSULTORIO.whatsapp}?text=${encodeURIComponent('Hola, quiero coordinar un nuevo turno.')}`, 'Escribir por WhatsApp', false),
    nota: 'Cuando quieras, elegí otro horario desde Mi espacio o escribinos y lo coordinamos.',
  } : {
    asunto: d.era_pedido ? 'No pudimos confirmar tu turno' : 'Tu turno fue cancelado',
    previo: `Sobre tu turno del ${cuando(d.inicio)}.`,
    titulo: d.era_pedido ? 'No pudimos confirmar tu turno' : 'Tuvimos que cancelar tu turno',
    intro: d.era_pedido
      ? `No pudimos confirmar el turno que pediste para el <strong style="color:${C.tinta};font-weight:600;">${cuando(d.inicio)}</strong>. Disculpá las molestias.`
      : `Tuvimos que cancelar tu turno del <strong style="color:${C.tinta};font-weight:600;">${cuando(d.inicio)}</strong>. Disculpá las molestias.`,
    detalle: '',
    acciones: boton(`${SITIO}/app.html#/pedir-turno`, 'Pedir otro turno', true)
      + boton(`https://wa.me/${CONSULTORIO.whatsapp}?text=${encodeURIComponent('Hola, quiero coordinar un nuevo turno.')}`, 'Escribir por WhatsApp', false),
    nota: 'Elegí otro horario desde Mi espacio o escribinos y lo coordinamos.',
  }),
};

function notaCancelacion(d) {
  const horas = d.horas_cancelacion || 12;
  return `Si no podés venir, cancelalo desde Mi espacio hasta ${horas} h antes, o avisanos por WhatsApp al ${CONSULTORIO.whatsappTexto}.`;
}

function bloqueTurno(d) {
  const p = partes(d.inicio);
  const fila = (etiqueta, valor) => `<tr>
      <td style="padding:6px 16px 6px 0;font-family:${FUENTE};font-size:13px;color:${C.tinta3};white-space:nowrap;vertical-align:top;">${etiqueta}</td>
      <td style="padding:6px 0;font-family:${FUENTE};font-size:15px;color:${C.tinta};font-weight:600;">${valor}</td>
    </tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;background:${C.esmalte};border-radius:14px;">
  <tr><td style="padding:18px 20px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
      ${fila('Día', mayuscula(fechaLarga(d.inicio)))}
      ${fila('Hora', `${p.hora} h`)}
      ${fila('Dónde', `<a href="${CONSULTORIO.mapa}" style="color:${C.lavandaOsc};text-decoration:none;">${CONSULTORIO.direccion}</a>`)}
      ${d.motivo ? fila('Motivo', d.motivo) : ''}
    </table>
  </td></tr>
</table>`;
}

function botonesTurno(d) {
  return boton(enlaceCalendario(d), 'Agregar a mi calendario', true) + boton(`${SITIO}/app.html`, 'Ver mis turnos', false);
}

function boton(url, texto, relleno) {
  const fondo = relleno ? C.lavandaOsc : '#ffffff';
  const color = relleno ? '#ffffff' : C.lavandaOsc;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display:inline-table;margin:24px 8px 0 0;">
  <tr><td align="center" bgcolor="${fondo}" style="border-radius:999px;border:1.5px solid ${C.lavandaOsc};">
    <a href="${url}" target="_blank" style="display:inline-block;padding:14px 26px;font-family:${FUENTE};font-size:15px;font-weight:600;line-height:1;color:${color};text-decoration:none;border-radius:999px;">${texto}</a>
  </td></tr>
</table>`;
}

function armarCorreo(d) {
  const x = TIPOS[d.tipo](d);
  const saludo = d.nombre ? `Hola, ${d.nombre}:` : 'Hola:';
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${x.titulo}</title>
<style>
  @media (max-width: 600px) { .tarjeta { padding: 32px 24px !important; border-radius: 14px !important; } .titulo { font-size: 24px !important; } }
</style>
</head>
<body style="margin:0;padding:0;background:${C.esmalte};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.esmalte};">${x.previo}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.esmalte}" style="background:${C.esmalte};">
  <tr><td align="center" style="padding:36px 16px 40px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
      <tr><td align="center" style="padding:0 0 24px;">
        <a href="${SITIO}" target="_blank"><img src="${SITIO}/assets/img/logo.png" width="112" alt="${CONSULTORIO.nombre}" style="display:block;width:112px;max-width:112px;height:auto;border:0;"></a>
      </td></tr>
      <tr><td class="tarjeta" bgcolor="#ffffff" style="background:#ffffff;border:1px solid ${C.lavandaClaro};border-radius:18px;padding:44px 44px 40px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="width:44px;height:3px;background:${C.oro};border-radius:2px;font-size:0;line-height:0;">&nbsp;</td></tr></table>
        <h1 class="titulo" style="margin:22px 0 14px;font-family:${FUENTE};font-size:28px;font-weight:600;line-height:1.2;letter-spacing:-0.01em;color:${C.tinta};">${x.titulo}</h1>
        <div style="font-family:${FUENTE};font-size:16px;line-height:1.6;color:${C.tinta2};">
          <p style="margin:0 0 14px;">${saludo}</p>
          <p style="margin:0;">${x.intro}</p>
        </div>
        ${x.detalle}
        <div>${x.acciones}</div>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:32px;"><tr><td style="border-top:1px solid ${C.lavandaClaro};font-size:0;line-height:0;">&nbsp;</td></tr></table>
        <p style="margin:18px 0 0;font-family:${FUENTE};font-size:13px;line-height:1.55;color:${C.tinta3};">${x.nota}</p>
      </td></tr>
      <tr><td align="center" style="padding:28px 12px 0;font-family:${FUENTE};font-size:13px;line-height:1.7;color:${C.tinta3};">
        <strong style="color:${C.tinta2};font-weight:600;">${CONSULTORIO.nombre}</strong><br>
        Odontología, ortodoncia y estética dental<br>
        ${CONSULTORIO.direccion}<br>
        <a href="https://wa.me/${CONSULTORIO.whatsapp}" style="color:${C.lavandaOsc};text-decoration:none;">WhatsApp ${CONSULTORIO.whatsappTexto}</a>
        &nbsp;&nbsp;
        <a href="${CONSULTORIO.instagram}" style="color:${C.lavandaOsc};text-decoration:none;">${CONSULTORIO.instagramTexto}</a>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
  // Versión en texto plano para lectores que no muestran HTML
  const texto = [
    saludo, '',
    x.intro.replace(/<[^>]+>/g, ''), '',
    d.tipo === 'cancelado' ? '' : `Día: ${mayuscula(fechaLarga(d.inicio))}\nHora: ${partes(d.inicio).hora} h\nDónde: ${CONSULTORIO.direccion}`,
    '', x.nota, '', `${CONSULTORIO.nombre} · WhatsApp ${CONSULTORIO.whatsappTexto}`,
  ].join('\n');
  return { asunto: x.asunto, html, texto };
}

// ---------- Copias de seguridad ----------
const CARPETA_RESPALDOS = 'Smiles Campana – Respaldos';
const DIAS_CONSERVAR = 92; // unos 3 meses: quedan ~13 copias semanales

function carpetaRespaldos() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('CARPETA_RESPALDOS_ID');
  if (id) {
    try {
      const f = DriveApp.getFolderById(id);
      if (!f.isTrashed()) return f;
    } catch (err) { /* la carpeta se borró: se crea de nuevo */ }
  }
  const existentes = DriveApp.getFoldersByName(CARPETA_RESPALDOS);
  const carpeta = existentes.hasNext() ? existentes.next() : DriveApp.createFolder(CARPETA_RESPALDOS);
  props.setProperty('CARPETA_RESPALDOS_ID', carpeta.getId());
  return carpeta;
}

/** Guarda la copia que manda la base y borra las de más de 3 meses. */
function guardarRespaldo(respaldo) {
  if (!respaldo || !respaldo.tablas) return { ok: false, error: 'respaldo vacío' };
  const carpeta = carpetaRespaldos();
  const fecha = Utilities.formatDate(new Date(), ZONA, 'yyyy-MM-dd_HHmm');
  const contenido = JSON.stringify(respaldo, null, 1);
  const archivo = carpeta.createFile(`respaldo-${fecha}.json`, contenido, MimeType.PLAIN_TEXT);
  archivo.setDescription('Copia de seguridad de la base de Smiles Campana. Contiene datos clínicos: no compartir.');

  // Limpieza: a la papelera las copias de más de DIAS_CONSERVAR días (nunca la recién creada)
  const limite = Date.now() - DIAS_CONSERVAR * 864e5;
  let borradas = 0;
  const archivos = carpeta.getFiles();
  while (archivos.hasNext()) {
    const a = archivos.next();
    if (a.getId() !== archivo.getId() && /^respaldo-/.test(a.getName()) && a.getDateCreated().getTime() < limite) {
      a.setTrashed(true);
      borradas++;
    }
  }
  const filas = Object.keys(respaldo.tablas).reduce((n, k) => n + (respaldo.tablas[k] || []).length, 0);
  return { ok: true, tipo: 'respaldo', archivo: archivo.getName(), bytes: contenido.length, filas, borradas };
}

/** Control de los lunes: si no hay una copia de los últimos 8 días, avisa por correo. */
function controlarRespaldo() {
  const carpeta = carpetaRespaldos();
  let ultima = 0;
  const archivos = carpeta.getFiles();
  while (archivos.hasNext()) {
    const a = archivos.next();
    if (/^respaldo-/.test(a.getName())) ultima = Math.max(ultima, a.getDateCreated().getTime());
  }
  if (Date.now() - ultima < 8 * 864e5) return;
  const yo = Session.getEffectiveUser().getEmail();
  const cuando = ultima ? Utilities.formatDate(new Date(ultima), ZONA, 'dd/MM/yyyy') : 'nunca';
  GmailApp.sendEmail(yo, 'Atención: falta la copia de seguridad semanal',
    `No se encontró una copia de seguridad de la base en los últimos 8 días (la última es del ${cuando}).\n\n`
    + `Revisá en Supabase que el proyecto esté activo (el plan gratuito se pausa tras 7 días sin uso) y la tarea "respaldo-semanal". `
    + `Carpeta: ${carpeta.getUrl()}`, { name: CONSULTORIO.nombre });
}

/** Ejecutar una sola vez desde el editor: programa el control de los lunes a las 9. */
function instalarControlRespaldo() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === 'controlarRespaldo')
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('controlarRespaldo').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(9).inTimezone(ZONA).create();
  carpetaRespaldos(); // crea la carpeta y pide el permiso de Drive ahora
}

// ---------- Turnos en Google Calendar ----------
// Cada evento usa como identificador el código del turno (sin guiones): así se encuentra siempre el mismo evento
// y nunca se duplica. Además lleva la marca privada smiles=turno: el repaso diario solo toca eventos con esa
// marca, nunca los que se cargaron a mano en el calendario.
const CALENDARIO = 'primary';
const MARCA = 'turno';
const ESTADOS_EN_CALENDARIO = ['confirmado', 'atendido', 'ausente'];
const COLOR_ESTADO = { atendido: '10', ausente: '8' }; // verde y gris; los confirmados, con el color del calendario

function conCuidado(fn) {
  try {
    return fn();
  } catch (err) {
    console.error(err);
    return { ok: false, error: String(err && err.message || err) };
  }
}

function idEvento(turnoId) {
  return String(turnoId).replace(/-/g, '').toLowerCase();
}

/** El evento tal como tiene que quedar: título, horario, enlace a la ficha. Sin teléfono ni datos clínicos. */
function eventoDeTurno(t) {
  const titulo = (t.sobreturno ? 'Sobreturno · ' : '') + t.titulo + (t.estado === 'ausente' ? ' (ausente)' : '');
  const ev = {
    summary: titulo,
    description: `Turno de la agenda de ${CONSULTORIO.nombre}.\nFicha: ${SITIO}/app.html#/pacientes/${t.paciente_id}\n\n`
      + 'Se actualiza solo desde la app: los cambios hechos acá no se guardan en la app y se corrigen cada noche.',
    start: { dateTime: new Date(t.inicio).toISOString(), timeZone: ZONA },
    end: { dateTime: new Date(t.fin).toISOString(), timeZone: ZONA },
    status: 'confirmed',
    transparency: 'opaque',
    reminders: { useDefault: false, overrides: [] }, // sin notificaciones por cada turno
    extendedProperties: { private: { smiles: MARCA } },
  };
  if (COLOR_ESTADO[t.estado]) ev.colorId = COLOR_ESTADO[t.estado];
  return ev;
}

const noEncontrado = (err) => /not ?found|404|410|deleted/i.test(String(err && err.message || err));

/** Crea o actualiza el evento del turno (también lo recupera si alguien lo borró a mano). */
function guardarEvento(t) {
  const id = idEvento(t.id);
  const recurso = eventoDeTurno(t);
  try {
    Calendar.Events.update(recurso, CALENDARIO, id);
    return 'actualizado';
  } catch (err) {
    if (!noEncontrado(err)) throw err;
  }
  recurso.id = id;
  Calendar.Events.insert(recurso, CALENDARIO);
  return 'creado';
}

/** Para un turno que no está en el calendario: lo crea (si su código ya se usó en un evento borrado, lo recupera). */
function crearEvento(t) {
  const recurso = eventoDeTurno(t);
  recurso.id = idEvento(t.id);
  try {
    Calendar.Events.insert(recurso, CALENDARIO);
    return 'creado';
  } catch (err) {
    if (!/already exists|duplicate|409/i.test(String(err && err.message || err))) throw err;
  }
  return guardarEvento(t);
}

function borrarEvento(turnoId) {
  try {
    Calendar.Events.remove(CALENDARIO, idEvento(turnoId));
    return 'borrado';
  } catch (err) {
    if (noEncontrado(err)) return 'no estaba';
    throw err;
  }
}

/** Un cambio de un turno: si se muestra, crea o actualiza el evento; si no, lo borra. */
function turnoEnCalendario(t) {
  if (!t || !t.id) return { ok: false, error: 'datos' };
  const mostrar = t.mostrar && ESTADOS_EN_CALENDARIO.indexOf(t.estado) >= 0;
  return { ok: true, tipo: 'calendario', resultado: mostrar ? guardarEvento(t) : borrarEvento(t.id) };
}

/** ¿El evento del calendario es distinto de cómo tiene que quedar? */
function eventoDistinto(ev, nuevo) {
  const hora = (x) => (x && x.dateTime ? new Date(x.dateTime).getTime() : null);
  return ev.summary !== nuevo.summary || (ev.description || '') !== nuevo.description
    || hora(ev.start) !== hora(nuevo.start) || hora(ev.end) !== hora(nuevo.end)
    || (ev.colorId || '') !== (nuevo.colorId || '') || ev.status === 'cancelled';
}

/**
 * Repaso completo: deja en el calendario exactamente los turnos de la lista entre "desde" y "hasta".
 * Crea los que faltan, corrige los que cambiaron (también si alguien los movió a mano) y borra los eventos de
 * turnos que ya no corresponden. Solo toca eventos con la marca de la app.
 */
function sincronizarCalendario(datos) {
  if (!datos || !Array.isArray(datos.turnos) || !datos.desde || !datos.hasta) return { ok: false, error: 'datos' };
  const quiero = {};
  datos.turnos.forEach((t) => { if (ESTADOS_EN_CALENDARIO.indexOf(t.estado) >= 0) quiero[idEvento(t.id)] = t; });

  const hay = {};
  let pagina;
  do {
    const r = Calendar.Events.list(CALENDARIO, {
      timeMin: new Date(datos.desde).toISOString(),
      timeMax: new Date(datos.hasta).toISOString(),
      privateExtendedProperty: 'smiles=' + MARCA,
      singleEvents: true,
      showDeleted: false,
      maxResults: 2500,
      pageToken: pagina,
    });
    (r.items || []).forEach((ev) => { hay[ev.id] = ev; });
    pagina = r.nextPageToken;
  } while (pagina);

  let creados = 0;
  let corregidos = 0;
  let borrados = 0;
  Object.keys(quiero).forEach((id) => {
    const t = quiero[id];
    if (!hay[id]) {
      crearEvento(t);
      creados++;
    } else if (eventoDistinto(hay[id], eventoDeTurno(t))) {
      guardarEvento(t);
      corregidos++;
    }
  });
  Object.keys(hay).forEach((id) => {
    if (!quiero[id]) {
      borrarEvento(id);
      borrados++;
    }
  });
  return { ok: true, tipo: 'calendario_completo', turnos: Object.keys(quiero).length, creados, corregidos, borrados };
}

/**
 * Para probar desde el editor (pide el permiso del calendario): crea un evento de prueba dentro de una hora,
 * lo mueve y lo borra. Mirá el resultado en "Registro de ejecución".
 */
function probarCalendario() {
  const inicio = new Date(Date.now() + 3600e3);
  inicio.setMinutes(0, 0, 0);
  const t = {
    id: '00000000-0000-4000-8000-' + String(Date.now()).slice(-12),
    mostrar: true, estado: 'confirmado', titulo: 'Prueba, Smiles · Control', sobreturno: false,
    inicio: inicio.toISOString(), fin: new Date(inicio.getTime() + 30 * 60e3).toISOString(), paciente_id: 'prueba',
  };
  console.log('Crear:', JSON.stringify(turnoEnCalendario(t)));
  t.inicio = new Date(inicio.getTime() + 3600e3).toISOString();
  t.fin = new Date(inicio.getTime() + 5400e3).toISOString();
  console.log('Mover:', JSON.stringify(turnoEnCalendario(t)));
  t.mostrar = false;
  console.log('Borrar:', JSON.stringify(turnoEnCalendario(t)));
  console.log('Listo. Si no hubo errores, el calendario está conectado.');
}
