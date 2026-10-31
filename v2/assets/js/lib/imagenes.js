// Prepara una foto para subir: la achica en el navegador y arma su miniatura, siempre en JPEG.
// Respeta la orientación con la que se sacó (la de la cámara del celular).

export const LADO_FOTO = 2000;
export const LADO_MINI = 400;

const FORMATO_NO_LEIDO = 'Este formato no se puede leer en este navegador. Exportala como JPG y volvé a subirla.';

/** Devuelve { foto, mini, ancho, alto } con foto y mini como Blob JPEG. */
export async function prepararFoto(archivo) {
  if (!archivo?.type?.startsWith('image/') && !/\.(jpe?g|png|webp|heic|heif)$/i.test(archivo?.name || '')) {
    throw new Error(`"${archivo?.name || 'El archivo'}" no es una imagen.`);
  }
  let imagen;
  try {
    imagen = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(`"${archivo.name}": ${FORMATO_NO_LEIDO}`);
  }
  try {
    const foto = await reducir(imagen, LADO_FOTO, 0.85);
    const mini = await reducir(imagen, LADO_MINI, 0.8);
    return { foto: foto.blob, mini: mini.blob, ancho: foto.ancho, alto: foto.alto };
  } finally {
    imagen.close?.();
  }
}

async function reducir(imagen, lado, calidad) {
  const escala = Math.min(1, lado / Math.max(imagen.width, imagen.height));
  const ancho = Math.max(1, Math.round(imagen.width * escala));
  const alto = Math.max(1, Math.round(imagen.height * escala));
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext('2d');
  ctx.fillStyle = '#fff'; // las PNG con transparencia quedan sobre blanco
  ctx.fillRect(0, 0, ancho, alto);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(imagen, 0, 0, ancho, alto);
  const blob = await new Promise((ok, mal) => lienzo.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo preparar la foto.'))), 'image/jpeg', calidad));
  return { blob, ancho, alto };
}

// ---------- Comprobantes de pago ----------
export const MAX_COMPROBANTE = 1024 * 1024;
const TIPOS_DIRECTOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

/**
 * Deja el comprobante listo para subir (hasta 1 MB). Una imagen de más de 1 MB, o en un formato que no
 * sea JPG/PNG/WEBP, se achica y pasa a JPG; si ya pesa menos de 1 MB se sube tal cual. Un PDF no se
 * puede achicar en el navegador: si pasa de 1 MB hay que pedir uno más liviano.
 */
export async function prepararComprobante(archivo) {
  const nombre = archivo?.name || 'comprobante';
  const esPdf = archivo?.type === 'application/pdf' || /\.pdf$/i.test(nombre);
  if (esPdf) {
    if (archivo.size > MAX_COMPROBANTE) throw new Error(`"${nombre}" pesa ${mb(archivo.size)}. El PDF tiene que pesar menos de 1 MB: escanealo en menor calidad o sacale una foto.`);
    return archivo.type === 'application/pdf' ? archivo : new File([archivo], nombre, { type: 'application/pdf' });
  }
  if (!archivo?.type?.startsWith('image/') && !/\.(jpe?g|png|webp|heic|heif)$/i.test(nombre)) {
    throw new Error(`"${nombre}" no es una imagen ni un PDF.`);
  }
  if (archivo.size <= MAX_COMPROBANTE && TIPOS_DIRECTOS.includes(archivo.type)) return archivo;
  let imagen;
  try {
    imagen = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
  } catch {
    throw new Error(`"${nombre}": ${FORMATO_NO_LEIDO}`);
  }
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
