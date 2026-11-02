// Prepara una foto para subir: la achica en el navegador y arma su miniatura, siempre en JPEG.
// Respeta la orientación con la que se sacó (la de la cámara del celular).
// Las fotos HEIC/HEIF (iPhone, algunos Samsung) se leen directo en Safari; en los navegadores que no las
// leen (Chrome, Edge) se convierten con un conversor que se carga solo cuando hace falta (assets/vendor).
import { aviso } from './ui.js';

export const LADO_FOTO = 2000;
export const LADO_MINI = 400;

const FORMATO_NO_LEIDO = 'Este formato no se puede leer en este navegador. Exportala como JPG y volvé a subirla.';
const HEIC_NO_LEIDA = 'No pudimos convertir esta foto HEIC. Exportala como JPG (o abrila en el celular y compartila) y volvé a subirla.';
const CONVERSOR_HEIC = new URL('../../vendor/heic-to.js', import.meta.url).href;

/** Lee una imagen (respetando la orientación). Si es HEIC y el navegador no la entiende, la convierte. */
export async function leerImagen(archivo) {
  try {
    return await createImageBitmap(archivo, { imageOrientation: 'from-image' });
  } catch {
    if (!(await esHeic(archivo))) throw new Error(`"${archivo.name}": ${FORMATO_NO_LEIDO}`);
  }
  let jpg;
  try {
    jpg = await convertirHeic(archivo);
  } catch (e) {
    console.error(e);
    throw new Error(`"${archivo.name}": ${HEIC_NO_LEIDA}`);
  }
  try {
    return await createImageBitmap(jpg, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(`"${archivo.name}": ${HEIC_NO_LEIDA}`);
  }
}

/** HEIC/HEIF por tipo, por extensión o por su contenido (a veces llegan sin tipo o con otro nombre). */
export async function esHeic(archivo) {
  if (/^image\/hei[cf]/i.test(archivo?.type || '') || /\.(heic|heif)$/i.test(archivo?.name || '')) return true;
  try {
    const cabecera = new Uint8Array(await archivo.slice(0, 12).arrayBuffer());
    const texto = String.fromCharCode(...cabecera.slice(4, 12));
    return /^ftyp(heic|heix|hevc|hevx|heim|heis|mif1|msf1)$/.test(texto);
  } catch {
    return false;
  }
}

// Una conversión por archivo (si se prepara dos veces, por ejemplo para avisar antes de subir, no se repite)
const convertidas = new WeakMap();
let conversor = null;
let avisado = 0;

// El archivo (heic-to, versión "iife") deja la función de conversión en window.HeicTo
const funcionHeic = () => (typeof window.HeicTo === 'function' ? window.HeicTo : window.HeicTo?.heicTo);

function cargarConversor() {
  conversor ??= new Promise((ok, mal) => {
    if (funcionHeic()) return ok(funcionHeic());
    const s = document.createElement('script');
    s.src = CONVERSOR_HEIC;
    s.onload = () => (funcionHeic() ? ok(funcionHeic()) : mal(new Error('El conversor de HEIC no se inicializó.')));
    s.onerror = () => mal(new Error('No se pudo cargar el conversor de HEIC.'));
    document.head.append(s);
  }).catch((e) => {
    conversor = null; // se puede reintentar
    throw e;
  });
  return conversor;
}

function convertirHeic(archivo) {
  if (!convertidas.has(archivo)) {
    if (Date.now() - avisado > 10_000) {
      avisado = Date.now();
      aviso('Convirtiendo fotos HEIC (de iPhone). Puede tardar unos segundos por foto.');
    }
    const promesa = cargarConversor().then((heicTo) => heicTo({ blob: archivo, type: 'image/jpeg', quality: 0.92 }));
    promesa.catch(() => convertidas.delete(archivo));
    convertidas.set(archivo, promesa);
  }
  return convertidas.get(archivo);
}

/** Devuelve { foto, mini, ancho, alto } con foto y mini como Blob JPEG. giro: 0, 90, 180 o 270 (sentido horario). */
export async function prepararFoto(archivo, { giro = 0 } = {}) {
  if (!archivo?.type?.startsWith('image/') && !/\.(jpe?g|png|webp|heic|heif)$/i.test(archivo?.name || '') && !(await esHeic(archivo))) {
    throw new Error(`"${archivo?.name || 'El archivo'}" no es una imagen.`);
  }
  const imagen = await leerImagen(archivo);
  try {
    const foto = await reducir(imagen, LADO_FOTO, 0.85, giro);
    const mini = await reducir(imagen, LADO_MINI, 0.8, giro);
    return { foto: foto.blob, mini: mini.blob, ancho: foto.ancho, alto: foto.alto };
  } finally {
    imagen.close?.();
  }
}

async function reducir(imagen, lado, calidad, giro = 0) {
  const escala = Math.min(1, lado / Math.max(imagen.width, imagen.height));
  const w = Math.max(1, Math.round(imagen.width * escala));
  const hh = Math.max(1, Math.round(imagen.height * escala));
  const g = ((Math.round(giro / 90) * 90) % 360 + 360) % 360;
  const [ancho, alto] = g === 90 || g === 270 ? [hh, w] : [w, hh];
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext('2d');
  ctx.fillStyle = '#fff'; // las PNG con transparencia quedan sobre blanco
  ctx.fillRect(0, 0, ancho, alto);
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(ancho / 2, alto / 2);
  ctx.rotate((g * Math.PI) / 180);
  ctx.drawImage(imagen, -w / 2, -hh / 2, w, hh);
  const blob = await new Promise((ok, mal) => lienzo.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo preparar la foto.'))), 'image/jpeg', calidad));
  return { blob, ancho, alto };
}

// ---------- Comprobantes de pago ----------
export const MAX_COMPROBANTE = 1024 * 1024;
export const MAX_DOCUMENTO = 3 * 1024 * 1024; // copias firmadas: un PDF de varias hojas
const TIPOS_DIRECTOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

/**
 * Deja el comprobante listo para subir (hasta 1 MB). Una imagen de más de 1 MB, o en un formato que no
 * sea JPG/PNG/WEBP, se achica y pasa a JPG; si ya pesa menos de 1 MB se sube tal cual. Un PDF no se
 * puede achicar en el navegador: si pasa de 1 MB hay que pedir uno más liviano.
 */
export async function prepararComprobante(archivo, { maxPdf = MAX_COMPROBANTE } = {}) {
  const nombre = archivo?.name || 'comprobante';
  const esPdf = archivo?.type === 'application/pdf' || /\.pdf$/i.test(nombre);
  if (esPdf) {
    if (archivo.size > maxPdf) throw new Error(`"${nombre}" pesa ${mb(archivo.size)}. El PDF tiene que pesar menos de ${mb(maxPdf)}: escanealo en menor calidad o sacale una foto.`);
    return archivo.type === 'application/pdf' ? archivo : new File([archivo], nombre, { type: 'application/pdf' });
  }
  if (!archivo?.type?.startsWith('image/') && !/\.(jpe?g|png|webp|heic|heif)$/i.test(nombre) && !(await esHeic(archivo))) {
    throw new Error(`"${nombre}" no es una imagen ni un PDF.`);
  }
  if (archivo.size <= MAX_COMPROBANTE && TIPOS_DIRECTOS.includes(archivo.type)) return archivo;
  const imagen = await leerImagen(archivo);
  try {
    // De a poco: primero baja la calidad y después el tamaño, hasta quedar por debajo de 1 MB
    for (const lado of [2400, 2000, 1600, 1280, 1000]) {
      for (const calidad of [0.85, 0.75, 0.65]) {
        const { blob } = await reducir(imagen, lado, calidad);
        if (blob.size <= MAX_COMPROBANTE) return new File([blob], nombre.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
      }
    }
    throw new Error(`No pudimos achicar "${nombre}" por debajo de 1 MB.`);
  } finally {
    imagen.close?.();
  }
}

const mb = (n) => `${(n / 1024 / 1024).toLocaleString('es-AR', { maximumFractionDigits: 1 })} MB`;
