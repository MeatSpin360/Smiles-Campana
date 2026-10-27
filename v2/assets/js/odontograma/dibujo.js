// Dibujo SVG del odontograma, generado por código (sin imágenes).
import { PERMANENTES, TEMPORARIAS, COLORES, caraEnPosicion, esSuperior, nombreCara } from './modelo.js';

const S = 40; // lado del cuadrado de cada pieza
const IN = 16; // lado de la cara central
const PASO = 48; // separación entre piezas
const MEDIA = 28; // espacio a cada lado de la línea media
const PAD = 10;
const ALTO_NUM = 16;
const ALTO_RAIZ = 20;
const ALTO_PIEZA = ALTO_NUM + ALTO_RAIZ + S;
const ENTRE_FILAS = 14;
const MORDIDA = 30;

const c1 = (S - IN) / 2;
const c2 = c1 + IN;
const POLIGONOS = {
  arriba: `0,0 ${S},0 ${c2},${c1} ${c1},${c1}`,
  abajo: `0,${S} ${S},${S} ${c2},${c2} ${c1},${c2}`,
  izquierda: `0,0 ${c1},${c1} ${c1},${c2} 0,${S}`,
  derecha: `${S},0 ${S},${S} ${c2},${c2} ${c2},${c1}`,
};

const color = (c) => COLORES[c]?.css;

/** Cuadrado de 5 caras de una pieza, en coordenadas locales (0..S). */
export function cuadrado(n, pieza, { size = S, interactivo = true } = {}) {
  const k = size / S;
  const caras = pieza?.caras || {};
  const parts = [];
  for (const [pos, pts] of Object.entries(POLIGONOS)) {
    const cara = caraEnPosicion(n, pos);
    const fill = color(caras[cara]);
    parts.push(`<polygon class="cara${fill ? ' marcada' : ''}" data-cara="${cara}" points="${pts}"${fill ? ` style="fill:${fill}"` : ''}>${interactivo ? `<title>Pieza ${n}, cara ${nombreCara(n, cara)}</title>` : ''}</polygon>`);
  }
  const fill = color(caras.O);
  parts.push(`<rect class="cara${fill ? ' marcada' : ''}" data-cara="O" x="${c1}" y="${c1}" width="${IN}" height="${IN}"${fill ? ` style="fill:${fill}"` : ''}>${interactivo ? `<title>Pieza ${n}, cara ${nombreCara(n, 'O')}</title>` : ''}</rect>`);
  return `<g transform="scale(${k})">${parts.join('')}</g>`;
}

/** Marcas de pieza completa sobre el cuadrado y la zona de raíz. raizArriba indica hacia dónde va la raíz. */
function marcas(pieza, raizArriba) {
  const m = pieza?.marcas || {};
  const out = [];
  const ry1 = raizArriba ? -ALTO_RAIZ + 2 : S + 2;
  const ry2 = raizArriba ? -2 : S + ALTO_RAIZ - 2;
  if (m.conducto) {
    out.push(`<line class="marca" x1="${S / 2}" x2="${S / 2}" y1="${ry1}" y2="${ry2}" style="stroke:${color(m.conducto)}" stroke-width="4" stroke-linecap="round"/>`);
  }
  if (m.implante) {
    const col = color(m.implante);
    out.push(`<g class="marca" style="stroke:${col}" stroke-width="2.5" stroke-linecap="round">
      <line x1="${S / 2}" x2="${S / 2}" y1="${ry1}" y2="${ry2}"/>
      ${[0.25, 0.5, 0.75].map((f) => { const y = ry1 + (ry2 - ry1) * f; return `<line x1="${S / 2 - 6}" x2="${S / 2 + 6}" y1="${y}" y2="${y}"/>`; }).join('')}
    </g>`);
  }
  if (m.corona) {
    out.push(`<circle class="marca" cx="${S / 2}" cy="${S / 2}" r="${S * 0.62}" fill="none" style="stroke:${color(m.corona)}" stroke-width="3"/>`);
  }
  if (m.extraccion) {
    out.push(`<g class="marca" style="stroke:${color(m.extraccion)}" stroke-width="4" stroke-linecap="round"><line x1="3" y1="3" x2="${S - 3}" y2="${S - 3}"/><line x1="${S - 3}" y1="3" x2="3" y2="${S - 3}"/></g>`);
  }
  return out.join('');
}

function grupoPieza(n, pieza, x, y, seleccion) {
  const sup = esSuperior(n);
  const yNum = sup ? 11 : S + ALTO_RAIZ + 13;
  const ySq = sup ? ALTO_NUM + ALTO_RAIZ : 0;
  const yRaiz = sup ? ALTO_NUM : S;
  const sel = seleccion === n;
  return `<g class="pieza${sel ? ' seleccionada' : ''}${pieza ? ' con-datos' : ''}" data-pieza="${n}" transform="translate(${x},${y})" tabindex="0" role="button" aria-label="Pieza ${n}">
    <rect class="zona" x="-4" y="0" width="${S + 8}" height="${ALTO_PIEZA}" />
    <rect class="raiz" x="${S / 2 - 7}" y="${yRaiz + 3}" width="14" height="${ALTO_RAIZ - 6}" rx="7"/>
    <text class="numero" x="${S / 2}" y="${yNum}">${n}</text>
    <g transform="translate(0,${ySq})">
      ${sel ? `<rect class="marco-sel" x="-4" y="-4" width="${S + 8}" height="${S + 8}" rx="6"/>` : ''}
      ${cuadrado(n, pieza)}
      ${marcas(pieza, sup)}
    </g>
  </g>`;
}

/** SVG completo. Devuelve { markup, ancho, alto }. */
export function odontogramaSVG(data, { seleccion = null } = {}) {
  const temporales = !!data?.temporales;
  const piezas = data?.piezas || {};
  const mitad = 8 * PASO;
  const ancho = PAD * 2 + mitad * 2 + MEDIA * 2;
  const xIzq = (i) => PAD + i * PASO + (PASO - S) / 2;
  const xDer = (i) => PAD + mitad + MEDIA * 2 + i * PASO + (PASO - S) / 2;

  const filas = [];
  let y = PAD;
  const fila = (izq, der, offsetIzq) => {
    const g = [];
    izq.forEach((n, i) => g.push(grupoPieza(n, piezas[n], xIzq(i + offsetIzq), y, seleccion)));
    der.forEach((n, i) => g.push(grupoPieza(n, piezas[n], xDer(i), y, seleccion)));
    filas.push(g.join(''));
    y += ALTO_PIEZA + ENTRE_FILAS;
  };
  fila(PERMANENTES.supIzq, PERMANENTES.supDer, 0);
  if (temporales) fila(TEMPORARIAS.supIzq, TEMPORARIAS.supDer, 3);
  const yMordida = y - ENTRE_FILAS + MORDIDA / 2;
  y += MORDIDA - ENTRE_FILAS;
  if (temporales) fila(TEMPORARIAS.infIzq, TEMPORARIAS.infDer, 3);
  fila(PERMANENTES.infIzq, PERMANENTES.infDer, 0);
  const alto = y - ENTRE_FILAS + PAD;
  const xMedia = PAD + mitad + MEDIA;

  const markup = `<svg class="odontograma-svg" viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}" xmlns="http://www.w3.org/2000/svg">
    <line class="linea-media" x1="${xMedia}" x2="${xMedia}" y1="${PAD}" y2="${alto - PAD}"/>
    <line class="linea-mordida" x1="${PAD}" x2="${ancho - PAD}" y1="${yMordida}" y2="${yMordida}"/>
    <text class="rotulo-lado" x="${PAD + 2}" y="${yMordida - 5}">Derecha del paciente</text>
    <text class="rotulo-lado" x="${ancho - PAD - 2}" y="${yMordida - 5}" text-anchor="end">Izquierda del paciente</text>
    ${filas.join('')}
  </svg>`;
  return { markup, ancho, alto };
}

/** Pieza ampliada para el editor táctil, con nombres de cara. */
export function piezaGrandeSVG(n, pieza) {
  const size = 200;
  const lab = (pos, x, y, anchor = 'middle') => `<text class="rotulo-cara" x="${x}" y="${y}" text-anchor="${anchor}">${nombreCara(n, caraEnPosicion(n, pos))}</text>`;
  return `<svg class="pieza-grande" viewBox="-70 -40 ${size + 140} ${size + 80}" xmlns="http://www.w3.org/2000/svg">
    ${lab('arriba', size / 2, -14)}
    ${lab('abajo', size / 2, size + 28)}
    ${lab('izquierda', -10, size / 2 + 5, 'end')}
    ${lab('derecha', size + 10, size / 2 + 5, 'start')}
    <g class="pieza" data-pieza="${n}">
      ${cuadrado(n, pieza, { size })}
    </g>
  </svg>`;
}

/**
 * Arco dental decorativo para el inicio del sitio: piezas de 5 caras repartidas
 * a distancias iguales sobre la curva del maxilar. Algunas caras se colorean en secuencia.
 */
export function arcoDecorativo() {
  const piezas = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
  const W = 520;
  const H = 330;
  const cx = W / 2;
  const A = 222;
  const B = 250;
  const top = 34;
  const T = 1.32;
  const curva = (t) => ({ x: cx + A * Math.sin(t), y: top + B * (1 - Math.cos(t)) });
  // Muestreo fino para repartir por longitud de arco
  const N = 600;
  const pts = [];
  let largo = 0;
  for (let i = 0; i <= N; i++) {
    const t = -T + (2 * T * i) / N;
    const p = curva(t);
    if (i) largo += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
    pts.push({ ...p, t, l: largo });
  }
  const enLargo = (l) => pts.find((p) => p.l >= l) || pts[N];
  const tamano = (n) => [27, 28, 30, 32, 34, 37, 39, 39][8 - (n % 10)];

  const pintadas = { 16: ['O', 'D'], 14: ['O'], 11: ['M'], 21: ['V'], 24: ['O'], 26: ['M', 'O'] };
  let orden = 0;
  const out = [];
  piezas.forEach((n, i) => {
    const p = enLargo(((i + 0.5) / piezas.length) * largo);
    const ang = (Math.atan2(B * Math.sin(p.t), A * Math.cos(p.t)) * 180) / Math.PI;
    const size = tamano(n);
    const caras = {};
    const anims = [];
    for (const c of pintadas[n] || []) {
      caras[c] = 'b';
      anims.push({ c, d: orden++ });
    }
    let sq = cuadrado(n, { caras }, { size, interactivo: false });
    for (const a of anims) {
      sq = sq.replace(`class="cara marcada" data-cara="${a.c}"`, `class="cara marcada" style="--d:${a.d}" data-cara="${a.c}"`);
    }
    sq = sq.replace(/ style="fill:[^"]+"/g, '');
    out.push(`<g transform="translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) rotate(${ang.toFixed(1)}) translate(${-size / 2},${-size / 2})">${sq}</g>`);
  });

  // Trazo dorado paralelo, del lado interno del arco (como el anillo del logo)
  const guia = pts.filter((_, i) => i % 6 === 0).map((p) => {
    const dx = A * Math.cos(p.t);
    const dy = B * Math.sin(p.t);
    const len = Math.hypot(dx, dy);
    const off = 42;
    return `${(p.x - (dy / len) * off).toFixed(1)},${(p.y + (dx / len) * off).toFixed(1)}`;
  });
  return `<svg class="arco" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <polyline class="arco-guia" points="${guia.join(' ')}" />
    ${out.join('')}
  </svg>`;
}
