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
