// Worker del sitio: sirve los archivos de v2 y atiende /api/... para las fotos clínicas y los comprobantes de pago.
//
// Las fotos están en un depósito privado de Cloudflare R2 (FOTOS):
//   pacientes/<paciente_id>/<foto_id>.jpg        foto (hasta 2000 px)
//   pacientes/<paciente_id>/<foto_id>-mini.jpg   miniatura (400 px)
// Y los comprobantes de pago, en una carpeta aparte del mismo depósito:
//   comprobantes/<paciente_id>/<pago_id>         imagen o PDF de hasta 1 MB
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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_FOTO = 4 * 1024 * 1024;
const MAX_MINI = 400 * 1024;
const MAX_COMPROBANTE = 1024 * 1024;
const TIPOS_COMPROBANTE = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

const clave = (pacienteId, fotoId, mini = false) => `pacientes/${pacienteId}/${fotoId}${mini ? '-mini' : ''}.jpg`;
const claveComprobante = (pacienteId, pagoId) => `comprobantes/${pacienteId}/${pagoId}`;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    try {
      return await api(req, env, url);
    } catch (e) {
      console.error(e);
      return error(500, 'Hubo un problema. Probá de nuevo.');
    }
  },
};

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
  if (partes[1] === 'pagos' && UUID.test(partes[2] || '')) {
    if (partes.length === 4 && partes[3] === 'comprobante') {
      if (req.method === 'PUT') return adjuntarComprobante(req, env, db, partes[2]);
      if (req.method === 'GET') return verComprobante(env, db, partes[2]);
      if (req.method === 'DELETE') return quitarComprobante(env, db, partes[2]);
    }
    if (partes.length === 3 && req.method === 'DELETE') return borrarPago(env, db, partes[2]);
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
  for (const carpeta of ['pacientes', 'comprobantes']) {
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

// ---------- Comprobantes de pago ----------
// Ver: quien puede ver el pago (recepción, admin, contabilidad). Adjuntar y quitar: quien puede corregirlo
// (recepción, admin). La base lo decide: el Worker primero cambia la fila y solo si puede toca el archivo.

async function adjuntarComprobante(req, env, db, id) {
  const tipo = (req.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  if (!TIPOS_COMPROBANTE.includes(tipo)) return error(400, 'El comprobante tiene que ser una imagen (JPG, PNG o WEBP) o un PDF.');
  const largo = Number(req.headers.get('Content-Length') || 0);
  if (largo > MAX_COMPROBANTE) return error(413, 'El comprobante supera 1 MB.');
  const datos = await req.arrayBuffer();
  if (!datos.byteLength) return error(400, 'El archivo está vacío.');
  if (datos.byteLength > MAX_COMPROBANTE) return error(413, 'El comprobante supera 1 MB.');
  let nombre = '';
  try { nombre = decodeURIComponent(req.headers.get('X-Nombre') || ''); } catch { nombre = ''; }
  nombre = nombre.replace(/[\u0000-\u001f\\/]/g, '').slice(0, 120) || 'comprobante';

  const antes = await db(`pagos?id=eq.${id}&select=paciente_id,comprobante_tipo,comprobante_nombre,comprobante_bytes`, { method: 'GET' });
  if (!antes.ok) return error(antes.status === 401 ? 401 : 403, 'No tenés permiso para ver este pago.');
  if (!antes.datos.length) return error(404, 'No encontramos ese pago.');
  const r = await db(`pagos?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ comprobante_tipo: tipo, comprobante_nombre: nombre, comprobante_bytes: datos.byteLength }),
  });
  if (!r.ok) return error(r.status === 401 ? 401 : 403, r.mensaje || 'No tenés permiso para adjuntar comprobantes.');
  if (!r.datos.length) return error(403, 'No tenés permiso para adjuntar comprobantes.');
  const pago = r.datos[0];
  try {
    await env.FOTOS.put(claveComprobante(pago.paciente_id, id), datos, { httpMetadata: { contentType: tipo } });
  } catch (e) {
    // Sin archivo, la fila vuelve a como estaba
    console.error(e);
    const { comprobante_tipo, comprobante_nombre, comprobante_bytes } = antes.datos[0];
    await db(`pagos?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ comprobante_tipo, comprobante_nombre, comprobante_bytes }) });
    return error(502, 'No se pudo guardar el comprobante. Probá de nuevo.');
  }
  return responder(200, pago);
}

async function verComprobante(env, db, id) {
  const r = await db(`pagos?id=eq.${id}&select=paciente_id,comprobante_tipo,comprobante_nombre`, { method: 'GET' });
  if (!r.ok) return error(r.status === 401 ? 401 : 403, 'No tenés permiso para ver este comprobante.');
  if (!r.datos.length || !r.datos[0].comprobante_tipo) return error(404, 'Ese pago no tiene comprobante.');
  const { paciente_id: pacienteId, comprobante_tipo: tipo, comprobante_nombre: nombre } = r.datos[0];
  const obj = await env.FOTOS.get(claveComprobante(pacienteId, id));
  if (!obj) return error(404, 'No encontramos el archivo del comprobante.');
  return new Response(obj.body, {
    headers: {
      'Content-Type': tipo,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(nombre || 'comprobante')}`,
      // Se puede reemplazar: el navegador lo guarda solo para esta persona y pregunta si cambió
      'Cache-Control': 'private, no-cache',
      ETag: obj.httpEtag,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function quitarComprobante(env, db, id) {
  const r = await db(`pagos?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ comprobante_tipo: null }) });
  if (!r.ok) return error(r.status === 401 ? 401 : 403, r.mensaje || 'No tenés permiso para quitar comprobantes.');
  if (!r.datos.length) return error(404, 'No encontramos ese pago o no tenés permiso para cambiarlo.');
  await env.FOTOS.delete(claveComprobante(r.datos[0].paciente_id, id));
  return responder(200, r.datos[0]);
}

async function borrarPago(env, db, id) {
  const r = await db(`pagos?id=eq.${id}`, { method: 'DELETE' });
  if (!r.ok) return error(r.status === 401 ? 401 : 403, 'No tenés permiso para borrar pagos.');
  if (!r.datos.length) return error(404, 'No encontramos ese pago o no tenés permiso para borrarlo.');
  await env.FOTOS.delete(claveComprobante(r.datos[0].paciente_id, id));
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
