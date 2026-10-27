// Modelo del odontograma: numeración FDI, caras y descripción de hallazgos.
//
// Estructura de datos guardada:
// {
//   temporales: false,                       // si se muestran las piezas temporarias
//   piezas: {
//     "16": { caras: { O: "r", D: "r" },     // r = a realizar (rojo), b = realizado (azul)
//             marcas: { corona: "b" } }       // marcas de pieza completa
//   }
// }

export const PERMANENTES = {
  supIzq: [18, 17, 16, 15, 14, 13, 12, 11], // cuadrante 1 (derecha del paciente)
  supDer: [21, 22, 23, 24, 25, 26, 27, 28], // cuadrante 2
  infIzq: [48, 47, 46, 45, 44, 43, 42, 41], // cuadrante 4
  infDer: [31, 32, 33, 34, 35, 36, 37, 38], // cuadrante 3
};
export const TEMPORARIAS = {
  supIzq: [55, 54, 53, 52, 51],
  supDer: [61, 62, 63, 64, 65],
  infIzq: [85, 84, 83, 82, 81],
  infDer: [71, 72, 73, 74, 75],
};

export const CARAS = ['V', 'L', 'M', 'D', 'O'];

export const COLORES = {
  r: { nombre: 'A realizar', css: 'var(--od-rojo)' },
  b: { nombre: 'Realizado', css: 'var(--od-azul)' },
};

export const MARCAS = {
  extraccion: { r: 'Extracción indicada', b: 'Pieza ausente' },
  corona: { r: 'Corona a realizar', b: 'Corona realizada' },
  conducto: { r: 'Tratamiento de conducto a realizar', b: 'Tratamiento de conducto realizado' },
  implante: { r: 'Implante a realizar', b: 'Implante realizado' },
};

export const ESTADO_CARA = { r: 'Caries o lesión a tratar', b: 'Restauración realizada' };

const cuadrante = (n) => Math.floor(n / 10);
export const esSuperior = (n) => [1, 2, 5, 6].includes(cuadrante(n));
/** Cuadrantes que se dibujan a la izquierda de la línea media (derecha del paciente). */
export const esLadoIzquierdo = (n) => [1, 4, 5, 8].includes(cuadrante(n));
const esAnterior = (n) => n % 10 <= 3;

/** Qué cara corresponde a cada posición del cuadrado dibujado. */
export function caraEnPosicion(n, pos) {
  if (pos === 'centro') return 'O';
  if (pos === 'arriba') return esSuperior(n) ? 'V' : 'L';
  if (pos === 'abajo') return esSuperior(n) ? 'L' : 'V';
  const izq = esLadoIzquierdo(n);
  if (pos === 'izquierda') return izq ? 'D' : 'M';
  return izq ? 'M' : 'D';
}

export function nombreCara(n, cara) {
  switch (cara) {
    case 'V': return 'vestibular';
    case 'L': return esSuperior(n) ? 'palatina' : 'lingual';
    case 'M': return 'mesial';
    case 'D': return 'distal';
    case 'O': return esAnterior(n) ? 'incisal' : 'oclusal';
    default: return cara;
  }
}

export const vacio = () => ({ temporales: false, piezas: {} });

export function clonar(data) {
  return JSON.parse(JSON.stringify(data || vacio()));
}

function limpiarPieza(data, n) {
  const p = data.piezas[n];
  if (p && !Object.keys(p.caras || {}).length && !Object.keys(p.marcas || {}).length) delete data.piezas[n];
}

function pieza(data, n) {
  data.piezas[n] ??= { caras: {}, marcas: {} };
  data.piezas[n].caras ??= {};
  data.piezas[n].marcas ??= {};
  return data.piezas[n];
}

/** Aplica una herramienta. Volver a aplicar lo mismo lo quita. Devuelve true si cambió algo. */
export function aplicar(data, n, herramienta, color, cara) {
  if (herramienta === 'borrar') {
    if (!data.piezas[n]) return false;
    delete data.piezas[n];
    return true;
  }
  const p = pieza(data, n);
  if (herramienta === 'superficie') {
    if (!cara) return false;
    if (p.caras[cara] === color) delete p.caras[cara];
    else p.caras[cara] = color;
  } else if (MARCAS[herramienta]) {
    if (p.marcas[herramienta] === color) delete p.marcas[herramienta];
    else p.marcas[herramienta] = color;
  } else {
    return false;
  }
  limpiarPieza(data, n);
  return true;
}

/** Lista legible de hallazgos ordenada por pieza. */
export function hallazgos(data) {
  const out = [];
  const orden = (n) => [1, 2, 3, 4, 5, 6, 7, 8].indexOf(cuadrante(n)) * 100 + (n % 10);
  for (const n of Object.keys(data?.piezas || {}).map(Number).sort((a, b) => orden(a) - orden(b))) {
    const p = data.piezas[n];
    const detalles = [];
    for (const [m, c] of Object.entries(p.marcas || {})) detalles.push({ texto: MARCAS[m][c], color: c });
    for (const c of ['r', 'b']) {
      const caras = CARAS.filter((k) => p.caras?.[k] === c).map((k) => nombreCara(n, k));
      if (caras.length) detalles.push({ texto: `${ESTADO_CARA[c]}: ${caras.join(', ')}`, color: c });
    }
    if (detalles.length) out.push({ pieza: n, detalles });
  }
  return out;
}

export function contar(data) {
  let r = 0;
  let b = 0;
  for (const p of Object.values(data?.piezas || {})) {
    for (const v of [...Object.values(p.caras || {}), ...Object.values(p.marcas || {})]) {
      if (v === 'r') r++;
      else b++;
    }
  }
  return { pendientes: r, realizados: b };
}
