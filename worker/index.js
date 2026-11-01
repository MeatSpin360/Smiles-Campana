// Worker del sitio: sirve los archivos de v2 y atiende /api/... para las fotos clínicas y los comprobantes de pago.
// También muestra la página de mantenimiento en smilescampana.com.ar cuando el admin la activa (ver más abajo).
// Fuera del mantenimiento, workers.dev lleva al dominio.
//
// Las fotos están en un depósito privado de Cloudflare R2 (FOTOS):
//   pacientes/<paciente_id>/<foto_id>.jpg        foto (hasta 2000 px)
//   pacientes/<paciente_id>/<foto_id>-mini.jpg   miniatura (400 px)
// Y los comprobantes de pago, en una carpeta aparte del mismo depósito:
//   comprobantes/<paciente_id>/<pago_id>         imagen o PDF de hasta 1 MB
//   documentos/<paciente_id>/<documento_id>      copia firmada: imagen o PDF de hasta 3 MB
//
// El Worker no decide permisos: le pregunta a la base (Supabase) con la sesión de quien hace el pedido.
// Si la base no le deja ver, crear o borrar la fila de la foto, el Worker tampoco toca el archivo.
// Así las reglas quedan en un solo lugar (supabase/schema.sql) y acá no hay claves secretas.
//
//   POST   /api/fotos                    subir (formulario: paciente_id, seccion_id, orden, ancho, alto, foto, mini)
//   GET    /api/fotos/<id>               ver la foto (?mini para la miniatura)
//   DELETE /api/fotos/<id>               borrar
//   DELETE /api/pacientes/<id>/fotos     borrar los archivos de un paciente ya eliminado (solo admin)
//   PUT    /api/pagos/<id>/comprobante   adjuntar o reemplazar (cuerpo: el archivo; encabezado X-Nombre)
//   GET    /api/pagos/<id>/comprobante   ver
//   DELETE /api/pagos/<id>/comprobante   quitar
//   DELETE /api/pagos/<id>                borrar el pago con su comprobante (solo admin)
//   PUT/GET/DELETE /api/documentos/<id>/archivo   copia firmada de un documento (hasta 3 MB)
//   DELETE /api/documentos/<id>            borrar el documento con su copia firmada

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_FOTO = 4 * 1024 * 1024;
const MAX_MINI = 400 * 1024;
const MAX_COMPROBANTE = 1024 * 1024;
const MAX_DOCUMENTO = 3 * 1024 * 1024;
const TIPOS_ADJUNTO = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const clave = (pacienteId, fotoId, mini = false) => `pacientes/${pacienteId}/${fotoId}${mini ? '-mini' : ''}.jpg`;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const esApi = url.pathname.startsWith('/api/');
    // Ventana de mantenimiento: solo en el dominio. En workers.dev el personal sigue trabajando.
    if (DOMINIOS.has(url.hostname) && !LIBRES.test(url.pathname) && (await enMantenimiento(env))) {
      return esApi ? error(503, 'El sitio está en mantenimiento. Probá en un rato.') : paginaMantenimiento(env, url);
    }
    // workers.dev es la entrada del personal durante el mantenimiento. El resto del tiempo lleva al dominio
    // (así hay una sola dirección pública). /api no se redirige, para no cortar algo a mitad de camino.
    if (url.hostname.endsWith('.workers.dev') && !esApi && !(await enMantenimiento(env))) {
      return new Response(null, {
        status: 302,
        headers: { Location: `https://${DOMINIO_PRINCIPAL}${url.pathname}${url.search}`, 'Cache-Control': 'no-store' },
      });
    }
    if (!esApi) {
      // Si falla la entrega de una página, se muestra el aviso en lugar de un error
      try {
        const r = await env.ASSETS.fetch(req);
        if (r.status < 500) return r;
        console.error('Archivos: respuesta', r.status, url.pathname);
      } catch (e) {
        console.error(e);
      }
      return paginaMantenimiento(env, url);
    }
    try {
      return await api(req, env, url);
    } catch (e) {
      console.error(e);
      return error(500, 'Hubo un problema. Probá de nuevo.');
    }
  },
};

// ---------- Ventana de mantenimiento ----------
// El admin la activa desde el Panel de control (tabla "sitio" en la base). El Worker consulta el estado cada
// 30 segundos como mucho. Si la base no responde, sigue con el último estado conocido: una falla de la base
// nunca activa el aviso por sí sola (empieza en "no").
const DOMINIO_PRINCIPAL = 'smilescampana.com.ar';
const DOMINIOS = new Set([DOMINIO_PRINCIPAL, `www.${DOMINIO_PRINCIPAL}`]);
const LIBRES = /^\/(assets\/img\/|mantenimiento(\.html)?$|favicon\.ico$|robots\.txt$)/; // lo que usa la página del aviso
const CADA = 30_000;
let estadoSitio = { activo: false, hasta: 0, pendiente: null };

async function enMantenimiento(env) {
  if (Date.now() < estadoSitio.hasta) return estadoSitio.activo;
  estadoSitio.pendiente ??= (async () => {
    try {
      const r = await fetch(`${env.SUPABASE_URL}/rest/v1/sitio?id=eq.1&select=mantenimiento`, {
        headers: { apikey: env.SUPABASE_KEY }, signal: AbortSignal.timeout(3000),
      });
      if (!r.ok) throw new Error(`estado del sitio: ${r.status}`);
      const [fila] = await r.json();
      estadoSitio.activo = fila?.mantenimiento === true;
      estadoSitio.hasta = Date.now() + CADA;
    } catch (e) {
      console.error(e);
      estadoSitio.hasta = Date.now() + 10_000; // reintenta en 10 s, con el último estado conocido
    } finally {
      estadoSitio.pendiente = null;
    }
  })();
  await estadoSitio.pendiente;
  return estadoSitio.activo;
}

// Respaldo por si no se puede leer mantenimiento.html
const AVISO_MINIMO = `<!doctype html><html lang="es-AR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>Smiles Campana</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;color:#262140;background:#f6f5fb;text-align:center;padding:24px">
<main style="max-width:30rem"><img src="/assets/img/logo.png" alt="Smiles Campana" style="height:72px"><h1 style="font-size:1.3rem">La página se encuentra momentáneamente fuera de servicio.</h1>
<p>Disculpá las molestias, estamos trabajando para ofrecerte la mejor calidad.</p><p><strong>Equipo de Smiles Campana</strong></p></main></body></html>`;

async function paginaMantenimiento(env, url) {
  let cuerpo = AVISO_MINIMO;
  try {
    const r = await env.ASSETS.fetch(new Request(new URL('/mantenimiento', url)));
    if (r.ok) cuerpo = await r.text();
  } catch (e) {
    console.error(e);
  }
  return new Response(cuerpo, {
    status: 503,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '300' },
  });
}

async function api(req, env, url) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return error(401, 'Tu sesión terminó. Ingresá de nuevo.');
  const db = (ruta, init = {}) => consultar(env, token, ruta, init);
  const partes = url.pathname.split('/').filter(Boolean); // ['api', 'fotos', id]

  if (partes[1] === 'fotos' && partes.length === 2 && req.method === 'POST') return subir(req, env, db);
  if (partes[1] === 'fotos' && partes.length === 3 && UUID.test(partes[2])) {
    if (req.method === 'GET') return ver(env, db, partes[2], url.searchParams.has('mini'));
    if (req.method === 'DELETE') return borrar(env, db, partes[2]);
  }
  if (partes[1] === 'pacientes' && partes[3] === 'fotos' && partes.length === 4 && UUID.test(partes[2]) && req.method === 'DELETE') {
    return borrarDePaciente(env, db, partes[2]);
  }
  const a = ADJUNTOS[partes[1]];
  if (a && UUID.test(partes[2] || '')) {
    if (partes.length === 4 && partes[3] === a.ruta) {
      if (req.method === 'PUT') return adjuntar(req, env, db, partes[1], a, partes[2]);
      if (req.method === 'GET') return verAdjunto(env, db, partes[1], a, partes[2]);
      if (req.method === 'DELETE') return quitarAdjunto(env, db, partes[1], a, partes[2]);
    }
    if (partes.length === 3 && req.method === 'DELETE') return borrarConAdjunto(env, db, partes[1], a, partes[2]);
  }
  return error(404, 'No encontrado.');
}

async function subir(req, env, db) {
  const form = await req.formData();
  const foto = form.get('foto');
  const mini = form.get('mini');
  const pacienteId = form.get('paciente_id');
  const seccionId = form.get('seccion_id') || null;
  if (!UUID.test(pacienteId || '') || (seccionId && !UUID.test(seccionId))) return error(400, 'Faltan datos de la foto.');
  if (!esJpeg(foto, MAX_FOTO) || !esJpeg(mini, MAX_MINI)) return error(400, 'La foto no tiene el formato esperado.');

  const fila = {
    paciente_id: pacienteId,
    seccion_id: seccionId,
    orden: entero(form.get('orden')) ?? 0,
    ancho: entero(form.get('ancho')),
    alto: entero(form.get('alto')),
    bytes: foto.size,
  };
  const r = await db('fotos', { method: 'POST', body: JSON.stringify(fila) });
  if (!r.ok) return error(r.status === 401 ? 401 : 403, r.mensaje || 'No tenés permiso para subir fotos.');
  const creada = r.datos[0];

  try {
    await env.FOTOS.put(clave(pacienteId, creada.id), foto.stream(), { httpMetadata: { contentType: 'image/jpeg' } });
    await env.FOTOS.put(clave(pacienteId, creada.id, true), mini.stream(), { httpMetadata: { contentType: 'image/jpeg' } });
  } catch (e) {
    // Sin archivo no tiene sentido la fila: se deshace
    console.error(e);
    await db(`fotos?id=eq.${creada.id}`, { method: 'DELETE' });
    await env.FOTOS.delete([clave(pacienteId, creada.id), clave(pacienteId, creada.id, true)]);
    return error(502, 'No se pudo guardar la foto. Probá de nuevo.');
  }
  return responder(201, creada);
}

async function ver(env, db, id, mini) {
  const r = await db(`fotos?id=eq.${id}&select=id,paciente_id`, { method: 'GET' });
  if (!r.ok) return error(r.status === 401 ? 401 : 403, 'No tenés permiso para ver esta foto.');
  if (!r.datos.length) return error(404, 'No encontramos esa foto.');
  const obj = await env.FOTOS.get(clave(r.datos[0].paciente_id, id, mini));
  if (!obj) return error(404, 'No encontramos el archivo de esa foto.');
  return new Response(obj.body, {
    headers: {
      'Content-Type': 'image/jpeg',
      // El archivo de una foto nunca cambia (cada foto nueva tiene su propio id): el navegador lo guarda
      // solo para esta persona ("private")
      'Cache-Control': 'private, max-age=31536000, immutable',
      ETag: obj.httpEtag,
    },
  });
}

async function borrar(env, db, id) {
  const r = await db(`fotos?id=eq.${id}`, { method: 'DELETE' });
  if (!r.ok) return error(r.status === 401 ? 401 : 403, 'No tenés permiso para borrar fotos.');
  if (!r.datos.length) return error(404, 'No encontramos esa foto o no tenés permiso para borrarla.');
  const p = r.datos[0].paciente_id;
  await env.FOTOS.delete([clave(p, id), clave(p, id, true)]);
  return responder(200, { borrada: id });
}

// Etapa de pruebas: después de eliminar un paciente, el admin borra sus archivos.
async function borrarDePaciente(env, db, pacienteId) {
  const rol = await db('rpc/mi_rol', { method: 'POST', body: '{}' });
  if (!rol.ok || rol.datos !== 'admin') return error(403, 'Solo un admin puede hacer esto.');
  const sigue = await db(`pacientes?id=eq.${pacienteId}&select=id`, { method: 'GET' });
  if (!sigue.ok) return error(403, 'No tenés permiso.');
  if (sigue.datos.length) return error(409, 'El paciente todavía existe.');
  let borradas = 0;
  for (const carpeta of ['pacientes', 'comprobantes', 'documentos']) {
    let cursor;
    do {
      const lista = await env.FOTOS.list({ prefix: `${carpeta}/${pacienteId}/`, cursor });
      const claves = lista.objects.map((o) => o.key);
      if (claves.length) await env.FOTOS.delete(claves);
      borradas += claves.length;
      cursor = lista.truncated ? lista.cursor : undefined;
    } while (cursor);
  }
  return responder(200, { borradas });
}

// ---------- Archivos adjuntos: comprobantes de pago y copias firmadas de documentos ----------
// Ver: quien puede ver la fila. Adjuntar y quitar: quien puede modificarla. La base lo decide: el Worker
// primero cambia la fila y solo si puede toca el archivo.
const ADJUNTOS = {
  pagos: {
    ruta: 'comprobante', carpeta: 'comprobantes', max: MAX_COMPROBANTE, cosa: 'el comprobante', limite: '1 MB',
    tipo: 'comprobante_tipo', nombre: 'comprobante_nombre', bytes: 'comprobante_bytes', fila: 'ese pago',
  },
  documentos: {
    ruta: 'archivo', carpeta: 'documentos', max: MAX_DOCUMENTO, cosa: 'la copia firmada', limite: '3 MB',
    tipo: 'archivo_tipo', nombre: 'archivo_nombre', bytes: 'archivo_bytes', fila: 'ese documento',
  },
};
const claveAdjunto = (a, pacienteId, id) => `${a.carpeta}/${pacienteId}/${id}`;

async function adjuntar(req, env, db, tabla, a, id) {
  const tipo = (req.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  if (!TIPOS_ADJUNTO.includes(tipo)) return error(400, 'El archivo tiene que ser una imagen (JPG, PNG o WEBP) o un PDF.');
  const largo = Number(req.headers.get('Content-Length') || 0);
  if (largo > a.max) return error(413, `El archivo supera ${a.limite}.`);
  const datos = await req.arrayBuffer();
  if (!datos.byteLength) return error(400, 'El archivo está vacío.');
  if (datos.byteLength > a.max) return error(413, `El archivo supera ${a.limite}.`);
  let nombre = '';
  try { nombre = decodeURIComponent(req.headers.get('X-Nombre') || ''); } catch { nombre = ''; }
  nombre = nombre.replace(/[\u0000-\u001f\\/]/g, '').slice(0, 120) || 'archivo';

  const antes = await db(`${tabla}?id=eq.${id}&select=paciente_id,${a.tipo},${a.nombre},${a.bytes}`, { method: 'GET' });
  if (!antes.ok) return error(antes.status === 401 ? 401 : 403, `No tenés permiso para ver ${a.fila}.`);
  if (!antes.datos.length) return error(404, `No encontramos ${a.fila}.`);
  const r = await db(`${tabla}?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ [a.tipo]: tipo, [a.nombre]: nombre, [a.bytes]: datos.byteLength }),
  });
  if (!r.ok) return error(r.status === 401 ? 401 : 403, r.mensaje || `No tenés permiso para adjuntar ${a.cosa}.`);
  if (!r.datos.length) return error(403, `No tenés permiso para adjuntar ${a.cosa}.`);
  const fila = r.datos[0];
  try {
    await env.FOTOS.put(claveAdjunto(a, fila.paciente_id, id), datos, { httpMetadata: { contentType: tipo } });
  } catch (e) {
    // Sin archivo, la fila vuelve a como estaba
    console.error(e);
    const v = antes.datos[0];
    await db(`${tabla}?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ [a.tipo]: v[a.tipo], [a.nombre]: v[a.nombre], [a.bytes]: v[a.bytes] }) });
    return error(502, `No se pudo guardar ${a.cosa}. Probá de nuevo.`);
  }
  return responder(200, fila);
}

async function verAdjunto(env, db, tabla, a, id) {
  const r = await db(`${tabla}?id=eq.${id}&select=paciente_id,${a.tipo},${a.nombre}`, { method: 'GET' });
  if (!r.ok) return error(r.status === 401 ? 401 : 403, `No tenés permiso para ver ${a.cosa}.`);
  if (!r.datos.length || !r.datos[0][a.tipo]) return error(404, `${a.fila[0].toUpperCase()}${a.fila.slice(1)} no tiene archivo adjunto.`);
  const fila = r.datos[0];
  const obj = await env.FOTOS.get(claveAdjunto(a, fila.paciente_id, id));
  if (!obj) return error(404, 'No encontramos el archivo.');
  return new Response(obj.body, {
    headers: {
      'Content-Type': fila[a.tipo],
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(fila[a.nombre] || 'archivo')}`,
      // Se puede reemplazar: el navegador lo guarda solo para esta persona y pregunta si cambió
      'Cache-Control': 'private, no-cache',
      ETag: obj.httpEtag,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function quitarAdjunto(env, db, tabla, a, id) {
  const r = await db(`${tabla}?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ [a.tipo]: null }) });
  if (!r.ok) return error(r.status === 401 ? 401 : 403, r.mensaje || `No tenés permiso para quitar ${a.cosa}.`);
  if (!r.datos.length) return error(404, `No encontramos ${a.fila} o no tenés permiso para cambiarlo.`);
  await env.FOTOS.delete(claveAdjunto(a, r.datos[0].paciente_id, id));
  return responder(200, r.datos[0]);
}

/** Borra la fila (la base decide si se puede) y su archivo. */
async function borrarConAdjunto(env, db, tabla, a, id) {
  const r = await db(`${tabla}?id=eq.${id}`, { method: 'DELETE' });
  if (!r.ok) return error(r.status === 401 ? 401 : 403, r.mensaje || 'No tenés permiso para borrarlo.');
  if (!r.datos.length) return error(404, `No encontramos ${a.fila} o no tenés permiso para borrarlo.`);
  await env.FOTOS.delete(claveAdjunto(a, r.datos[0].paciente_id, id));
  return responder(200, { borrado: id });
}

/** Consulta a la base (PostgREST) como la persona que hizo el pedido: aplican sus permisos. */
async function consultar(env, token, ruta, { method, body }) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${ruta}`, {
    method,
    body,
    headers: {
      apikey: env.SUPABASE_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Prefer: 'return=representation',
    },
  });
  const texto = await res.text();
  let datos = null;
  try { datos = texto ? JSON.parse(texto) : null; } catch { datos = null; }
  if (!res.ok) {
    // Mensajes propios de la base (por ejemplo "Esa sección es de otro paciente.") se muestran tal cual
    const propio = datos?.code === 'P0001' ? datos.message : null;
    return { ok: false, status: res.status, mensaje: propio };
  }
  return { ok: true, status: res.status, datos };
}

const esJpeg = (f, max) => f && typeof f === 'object' && typeof f.stream === 'function' && f.type === 'image/jpeg' && f.size > 0 && f.size <= max;
const entero = (v) => (v == null || v === '' || !/^\d+$/.test(String(v)) ? null : Number(v));

const responder = (status, datos) => new Response(JSON.stringify(datos), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
});
const error = (status, mensaje) => responder(status, { error: mensaje });
