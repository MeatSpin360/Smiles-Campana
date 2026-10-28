/**
 * Smiles Campana: envío de correos de turnos.
 *
 * Corre en Google Apps Script con la cuenta smiles.campana@gmail.com y envía desde Gmail
 * (los correos quedan en "Enviados"). La base de datos lo llama cada vez que un turno se
 * confirma, se cambia de horario, lo agenda el personal o lo cancela el consultorio.
 *
 * Seguridad: solo atiende pedidos que traen la clave secreta guardada en
 * Configuración del proyecto → Propiedades del script → SECRETO.
 *
 * Cómo publicarlo: ver google/LEEME.md.
 */

// ---------- Datos del consultorio ----------
const SITIO = 'https://smiles-campana.emiliobrescasin.workers.dev'; // cambiar al dominio definitivo cuando esté
const CONSULTORIO = {
  nombre: 'Smiles Campana',
  direccion: 'Jean Jaurès 568, Campana',
  mapa: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Jean Jaurès 568, Campana, Buenos Aires'),
  whatsapp: '5493487728866',
  whatsappTexto: '3487-728866',
  instagram: 'https://www.instagram.com/smiles.campana',
  instagramTexto: '@smiles.campana',
};
const ZONA = 'America/Argentina/Buenos_Aires';

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
  if (!datos.email || !TIPOS[datos.tipo]) return respuesta({ ok: false, error: 'datos' });

  const correo = armarCorreo(datos);
  GmailApp.sendEmail(datos.email, correo.asunto, correo.texto, { htmlBody: correo.html, name: CONSULTORIO.nombre });
  return respuesta({ ok: true, tipo: datos.tipo });
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
  ];
  ejemplos.forEach((x) => {
    const c = armarCorreo(Object.assign({ email: yo, nombre: 'Prueba', inicio: en3dias.toISOString(), duracion: 30, motivo: 'Consulta', horas_cancelacion: 12 }, x));
    GmailApp.sendEmail(yo, '[Prueba] ' + c.asunto, c.texto, { htmlBody: c.html, name: CONSULTORIO.nombre });
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
  cancelado: (d) => ({
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
