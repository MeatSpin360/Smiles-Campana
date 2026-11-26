// Texto con formato simple (párrafos, títulos, negrita, cursiva, subrayado, listas y tablas) para los planes de
// tratamiento anteriores y el resumen de historia clínica:
// - limpiarHtml(): deja solo esas etiquetas (sin atributos, salvo colspan/rowspan). Se usa al guardar y al mostrar:
//   lo que viene de un Word, de un PDF, del portapapeles o de la base nunca se muestra sin pasar por acá.
// - editorRico(): editor con barra de herramientas.
// - contenidoRico(): muestra un contenido ya guardado.
// - convertirArchivo(): pasa un Word (.docx, lector propio) o un PDF (pdf.js, en assets/vendor) a ese formato.
import { h } from './dom.js';

const PERMITIDAS = new Set(['P', 'BR', 'STRONG', 'EM', 'U', 'H2', 'H3', 'H4', 'UL', 'OL', 'LI', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'BLOCKQUOTE']);
const EQUIVALENTES = { B: 'STRONG', I: 'EM', H1: 'H2', H5: 'H4', H6: 'H4', DIV: 'P', TFOOT: 'TBODY' };
const DESCARTAR = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'HEAD', 'TITLE', 'META', 'LINK', 'NOSCRIPT', 'IMG', 'VIDEO', 'AUDIO', 'CANVAS', 'INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'FORM']);
const BLOQUES = new Set(['P', 'H2', 'H3', 'H4', 'UL', 'OL', 'TABLE', 'BLOCKQUOTE']);

/** Devuelve el HTML reducido a las etiquetas permitidas (sin atributos ni estilos). */
export function limpiarHtml(html) {
  const doc = new DOMParser().parseFromString(`<body>${html || ''}</body>`, 'text/html'); // no ejecuta nada
  const destino = document.implementation.createHTMLDocument('');
  const copiar = (origen, padre) => {
    for (const n of origen.childNodes) {
      if (n.nodeType === Node.TEXT_NODE) {
        padre.append(destino.createTextNode(n.nodeValue));
        continue;
      }
      if (n.nodeType !== Node.ELEMENT_NODE) continue;
      const tag = EQUIVALENTES[n.tagName] || n.tagName;
      if (DESCARTAR.has(tag)) continue;
      if (!PERMITIDAS.has(tag)) {
        copiar(n, padre); // etiqueta no permitida (span, font, a…): queda solo su contenido
        continue;
      }
      const el = destino.createElement(tag);
      if (tag === 'TD' || tag === 'TH') {
        for (const a of ['colspan', 'rowspan']) {
          const v = Number(n.getAttribute(a));
          if (Number.isInteger(v) && v > 1 && v < 50) el.setAttribute(a, String(v));
        }
      }
      copiar(n, el);
      padre.append(el);
    }
  };
  const caja = destino.createElement('div');
  copiar(doc.body, caja);
  // Texto suelto o en línea al nivel principal: dentro de párrafos
  const final = destino.createElement('div');
  let parrafo = null;
  for (const n of [...caja.childNodes]) {
    if (n.nodeType === Node.ELEMENT_NODE && (BLOQUES.has(n.tagName) || n.tagName === 'LI')) {
      parrafo = null;
      if (n.tagName === 'LI') {
        const ul = destino.createElement('ul');
        ul.append(n);
        final.append(ul);
      } else final.append(n);
    } else {
      if (n.nodeType === Node.TEXT_NODE && !n.nodeValue.trim() && !parrafo) continue;
      if (!parrafo) final.append((parrafo = destino.createElement('p')));
      parrafo.append(n);
    }
  }
  // Párrafos vacíos y espacios de más
  for (const p of final.querySelectorAll('p, h2, h3, h4, li')) {
    if (!p.textContent.trim() && !p.querySelector('br')) p.remove();
  }
  return final.innerHTML.replace(/(<br>\s*){3,}/g, '<br><br>').trim();
}

/** Texto plano del contenido (para saber si está vacío o para buscar). */
export function textoDe(html) {
  const d = new DOMParser().parseFromString(`<body>${limpiarHtml(html)}</body>`, 'text/html');
  return d.body.textContent.replace(/\s+/g, ' ').trim();
}

/** Muestra un contenido guardado (siempre limpio). */
export function contenidoRico(html, clase = '') {
  const el = h(`div.texto-rico${clase ? `.${clase}` : ''}`);
  el.innerHTML = limpiarHtml(html);
  return el;
}

const BOTONES = [
  { cmd: 'formatBlock', arg: 'h3', texto: 'Título', titulo: 'Título' },
  { cmd: 'formatBlock', arg: 'p', texto: 'Texto', titulo: 'Texto normal' },
  { cmd: 'bold', texto: 'N', titulo: 'Negrita (Ctrl + B)', clase: 'er-negrita' },
  { cmd: 'italic', texto: 'C', titulo: 'Cursiva (Ctrl + I)', clase: 'er-cursiva' },
  { cmd: 'underline', texto: 'S', titulo: 'Subrayado (Ctrl + U)', clase: 'er-subrayado' },
  { cmd: 'insertUnorderedList', texto: '• Lista', titulo: 'Lista con viñetas' },
  { cmd: 'insertOrderedList', texto: '1. Lista', titulo: 'Lista numerada' },
];

/**
 * Editor de texto con formato. Devuelve { el, valor(), vacio(), enfocar() }.
 * alCambiar(): se llama con cada cambio (para avisar si se sale sin guardar).
 */
export function editorRico({ html = '', placeholder = '', alCambiar = () => {}, etiqueta = 'Texto' } = {}) {
  const area = h('div.editor-rico-area', {
    contenteditable: 'true', role: 'textbox', 'aria-multiline': 'true', 'aria-label': etiqueta,
    'data-placeholder': placeholder, spellcheck: 'true',
  });
  area.innerHTML = limpiarHtml(html);
  const usar = (b) => {
    area.focus();
    document.execCommand('defaultParagraphSeparator', false, 'p');
    document.execCommand(b.cmd, false, b.arg ? `<${b.arg}>` : null);
    alCambiar();
  };
  const barra = h('div.editor-rico-barra', { role: 'toolbar', 'aria-label': 'Formato' },
    BOTONES.map((b) => h(`button.editor-rico-btn${b.clase ? `.${b.clase}` : ''}`, {
      type: 'button', title: b.titulo, 'aria-label': b.titulo,
      onmousedown: (e) => e.preventDefault(), // no saca el foco del texto
      onclick: () => usar(b),
    }, b.texto)));
  area.addEventListener('focus', () => document.execCommand('defaultParagraphSeparator', false, 'p'));
  area.addEventListener('input', () => alCambiar());
  // Lo que se pega pasa por la limpieza (sin estilos, colores ni imágenes de Word o de páginas web)
  area.addEventListener('paste', (e) => {
    const d = e.clipboardData;
    if (!d) return;
    e.preventDefault();
    const html = d.getData('text/html');
    const limpio = html
      ? limpiarHtml(html)
      : (d.getData('text/plain') || '').split(/\r?\n/).map((l) => escapar(l)).join('<br>');
    document.execCommand('insertHTML', false, limpio);
    alCambiar();
  });
  return {
    el: h('div.editor-rico', barra, area),
    valor: () => limpiarHtml(area.innerHTML),
    vacio: () => !textoDe(area.innerHTML),
    enfocar: () => area.focus(),
    poner: (nuevo) => { area.innerHTML = limpiarHtml(nuevo); },
  };
}

const escapar = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- Word y PDF ----------

/** Tipo de archivo soportado: 'word', 'pdf', 'doc' (Word viejo, no soportado) o null. */
export function tipoArchivo(archivo) {
  const n = (archivo?.name || '').toLowerCase();
  if (n.endsWith('.docx') || archivo?.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') return 'word';
  if (n.endsWith('.pdf') || archivo?.type === 'application/pdf') return 'pdf';
  if (n.endsWith('.doc') || archivo?.type === 'application/msword') return 'doc';
  return null;
}

/** Convierte un Word (.docx) o un PDF a { titulo, html }. */
export async function convertirArchivo(archivo) {
  const tipo = tipoArchivo(archivo);
  if (tipo === 'doc') throw new Error('Es un Word viejo (.doc). Abrilo en Word y guardalo como .docx ("Documento de Word"), o como PDF.');
  if (!tipo) throw new Error(`"${archivo?.name || 'El archivo'}" no es un Word (.docx) ni un PDF.`);
  if (archivo.size > 30 * 1024 * 1024) throw new Error('El archivo pesa más de 30 MB.');
  const datos = new Uint8Array(await archivo.arrayBuffer());
  const html = tipo === 'word' ? await wordAHtml(datos) : await pdfAHtml(datos);
  const limpio = limpiarHtml(html);
  if (!textoDe(limpio)) {
    throw new Error(tipo === 'pdf'
      ? 'El PDF no tiene texto para copiar (probablemente es una imagen o un escaneo). Cargá el plan a mano.'
      : 'El Word no tiene texto para copiar.');
  }
  return { titulo: archivo.name.replace(/\.(docx|pdf)$/i, '').replace(/[_]+/g, ' ').trim() || 'Plan anterior', html: limpio };
}

// --- Word (.docx): es un ZIP con XML adentro. Se lee el texto, títulos, negrita/cursiva/subrayado, listas y tablas.

async function leerZip(datos) {
  const v = new DataView(datos.buffer, datos.byteOffset, datos.byteLength);
  let fin = -1;
  for (let i = datos.length - 22; i >= Math.max(0, datos.length - 65_557); i--) {
    if (v.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  }
  if (fin < 0) throw new Error('El archivo no es un Word válido (.docx).');
  const cantidad = v.getUint16(fin + 10, true);
  let p = v.getUint32(fin + 16, true);
  const archivos = new Map();
  const dec = new TextDecoder();
  for (let k = 0; k < cantidad; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const metodo = v.getUint16(p + 10, true);
    const comprimido = v.getUint32(p + 20, true);
    const largoNombre = v.getUint16(p + 28, true);
    const largoExtra = v.getUint16(p + 30, true);
    const largoComentario = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const nombre = dec.decode(datos.subarray(p + 46, p + 46 + largoNombre));
    archivos.set(nombre, { metodo, comprimido, local });
    p += 46 + largoNombre + largoExtra + largoComentario;
  }
  return async (nombre) => {
    const a = archivos.get(nombre);
    if (!a) return null;
    const ini = a.local + 30 + v.getUint16(a.local + 26, true) + v.getUint16(a.local + 28, true);
    const bytes = datos.subarray(ini, ini + a.comprimido);
    if (a.metodo === 0) return dec.decode(bytes);
    if (a.metodo !== 8) throw new Error('El Word usa una compresión que no se puede leer.');
    const flujo = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(flujo).text();
  };
}

const xml = (texto) => (texto ? new DOMParser().parseFromString(texto, 'application/xml') : null);
const hijos = (el, nombre) => [...(el?.children || [])].filter((c) => c.localName === nombre);
const hijo = (el, nombre) => hijos(el, nombre)[0] || null;
const atributo = (el, nombre) => (el ? el.getAttribute(`w:${nombre}`) ?? el.getAttributeNS?.('*', nombre) ?? null : null);
const activo = (el) => !!el && !['false', '0', 'none'].includes(atributo(el, 'val'));

async function wordAHtml(datos) {
  const leer = await leerZip(datos);
  const doc = xml(await leer('word/document.xml'));
  if (!doc) throw new Error('El archivo no es un Word válido (.docx).');
  // Estilos de título ("Heading 1", "Título 1", "Title") y listas numeradas o con viñetas
  const estilos = new Map();
  for (const s of xml(await leer('word/styles.xml'))?.getElementsByTagNameNS('*', 'style') || []) {
    const nombre = (atributo(hijo(s, 'name'), 'val') || '').toLowerCase();
    const m = nombre.match(/(?:heading|t[ií]tulo)\s*(\d)/);
    const nivel = m ? Number(m[1]) : (nombre === 'title' || nombre === 'título' ? 1 : nombre === 'subtitle' || nombre === 'subtítulo' ? 2 : 0);
    if (nivel) estilos.set(atributo(s, 'styleId'), nivel);
  }
  const numeracion = xml(await leer('word/numbering.xml'));
  const abstractos = new Map();
  for (const a of numeracion?.getElementsByTagNameNS('*', 'abstractNum') || []) {
    const lvl = hijo(a, 'lvl');
    abstractos.set(atributo(a, 'abstractNumId'), atributo(hijo(lvl, 'numFmt'), 'val') === 'bullet' ? 'ul' : 'ol');
  }
  const listas = new Map();
  for (const n of numeracion?.getElementsByTagNameNS('*', 'num') || []) {
    listas.set(atributo(n, 'numId'), abstractos.get(atributo(hijo(n, 'abstractNumId'), 'val')) || 'ul');
  }

  // Letra grande (14 pt o más en todo el párrafo): se toma como título aunque no use el estilo "Título"
  const letraGrande = (p) => {
    const runs = [...p.getElementsByTagNameNS('*', 'r')].filter((r) => r.textContent.trim());
    return runs.length > 0 && runs.every((r) => Number(atributo(hijo(hijo(r, 'rPr'), 'sz'), 'val')) >= 28);
  };
  const textoRuns = (el) => {
    let out = '';
    for (const c of el.children) {
      if (c.localName === 'r') {
        const pr = hijo(c, 'rPr');
        let t = '';
        for (const x of c.children) {
          if (x.localName === 't') t += escapar(x.textContent);
          else if (x.localName === 'tab') t += ' ';
          else if (x.localName === 'br' || x.localName === 'cr') t += '<br>';
          else if (x.localName === 'noBreakHyphen') t += '-';
        }
        if (!t) continue;
        if (activo(hijo(pr, 'u'))) t = `<u>${t}</u>`;
        if (activo(hijo(pr, 'i'))) t = `<em>${t}</em>`;
        if (activo(hijo(pr, 'b'))) t = `<strong>${t}</strong>`;
        out += t;
      } else if (['hyperlink', 'ins', 'smartTag', 'sdt', 'sdtContent', 'fldSimple', 'customXml'].includes(c.localName)) {
        out += textoRuns(c);
      }
    }
    return out;
  };

  const partes = [];
  let lista = null; // { tipo, items: [] }
  const cerrarLista = () => {
    if (lista) partes.push(`<${lista.tipo}>${lista.items.map((i) => `<li>${i}</li>`).join('')}</${lista.tipo}>`);
    lista = null;
  };
  const parrafo = (p) => {
    const pr = hijo(p, 'pPr');
    const contenido = textoRuns(p);
    const numId = atributo(hijo(hijo(pr, 'numPr'), 'numId'), 'val');
    if (numId && numId !== '0' && contenido.replace(/<br>/g, '').trim()) {
      const tipo = listas.get(numId) || 'ul';
      if (lista && lista.tipo !== tipo) cerrarLista();
      lista ??= { tipo, items: [] };
      lista.items.push(contenido);
      return;
    }
    cerrarLista();
    if (!contenido.replace(/<br>/g, '').trim()) return;
    const nivel = estilos.get(atributo(hijo(pr, 'pStyle'), 'val')) || (letraGrande(p) ? 2 : 0);
    const tag = nivel ? `h${Math.min(nivel + 1, 4)}` : 'p';
    partes.push(`<${tag}>${contenido}</${tag}>`);
  };
  const tabla = (t) => {
    cerrarLista();
    const filas = hijos(t, 'tr').map((tr) => `<tr>${hijos(tr, 'tc').map((tc) => {
      const span = Number(atributo(hijo(hijo(tc, 'tcPr'), 'gridSpan'), 'val')) || 1;
      const celda = hijos(tc, 'p').map(textoRuns).filter((x) => x.trim()).join('<br>');
      return `<td${span > 1 ? ` colspan="${span}"` : ''}>${celda}</td>`;
    }).join('')}</tr>`).join('');
    if (filas) partes.push(`<table><tbody>${filas}</tbody></table>`);
  };
  const recorrer = (el) => {
    for (const c of el.children) {
      if (c.localName === 'p') parrafo(c);
      else if (c.localName === 'tbl') tabla(c);
      else if (['sdt', 'sdtContent', 'customXml'].includes(c.localName)) recorrer(c);
    }
  };
  recorrer(doc.getElementsByTagNameNS('*', 'body')[0] || doc.documentElement);
  cerrarLista();
  return partes.join('');
}

// --- PDF: se usa pdf.js (assets/vendor/pdf.min.mjs y pdf.worker.min.mjs). Solo el texto: líneas y párrafos.

const PDFJS = 'assets/vendor/pdf.min.mjs';
const PDFJS_WORKER = 'assets/vendor/pdf.worker.min.mjs';
let pdfjs = null;

async function cargarPdfjs() {
  pdfjs ??= import(new URL(PDFJS, document.baseURI).href).then((m) => {
    m.GlobalWorkerOptions.workerSrc = new URL(PDFJS_WORKER, document.baseURI).href;
    return m;
  }).catch((e) => {
    pdfjs = null;
    throw new Error(`No se pudo cargar el lector de PDF (${e.message}).`);
  });
  return pdfjs;
}

async function pdfAHtml(datos) {
  const lib = await cargarPdfjs();
  let pdf;
  try {
    pdf = await lib.getDocument({ data: datos, isEvalSupported: false }).promise;
  } catch (e) {
    throw new Error(e?.name === 'PasswordException' ? 'El PDF tiene contraseña: quitásela y probá de nuevo.' : 'No se pudo leer el PDF.');
  }
  const partes = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const pagina = await pdf.getPage(n);
    const { items } = await pagina.getTextContent();
    // Líneas: los textos con la misma altura (y) van juntos; un salto grande entre líneas separa párrafos
    const lineas = [];
    for (const it of items) {
      if (!('str' in it)) continue;
      const y = Math.round(it.transform[5]);
      const alto = Math.abs(it.transform[3]) || it.height || 10;
      let linea = lineas.at(-1);
      if (!linea || Math.abs(linea.y - y) > alto * 0.5) {
        linea = { y, alto, texto: '' };
        lineas.push(linea);
      }
      linea.texto += (linea.texto && !linea.texto.endsWith(' ') && it.str && !it.str.startsWith(' ') && it.transform[4] > (linea.finX ?? 0) + alto * 0.15 ? ' ' : '') + it.str;
      linea.finX = it.transform[4] + (it.width || 0);
      if (it.hasEOL) linea.cerrada = true;
    }
    // Una línea larga que sigue en la próxima es el mismo renglón cortado por el ancho de la hoja: se une con un
    // espacio. Una línea corta (un ítem, una fecha, un dato) termina ahí.
    const largoMax = Math.max(1, ...lineas.map((l) => l.texto.trim().length));
    let actual = [];
    const cerrar = () => {
      const t = actual.map((l) => l.texto.trim()).filter(Boolean);
      if (t.length) {
        partes.push(`<p>${t.map((x, i) => escapar(x) + (i < t.length - 1 ? (x.length > largoMax * 0.75 && !/[.:;]$/.test(x) ? ' ' : '<br>') : '')).join('')}</p>`);
      }
      actual = [];
    };
    lineas.forEach((l, i) => {
      const ant = lineas[i - 1];
      if (ant && Math.abs(ant.y - l.y) > Math.max(ant.alto, l.alto) * 1.8) cerrar();
      actual.push(l);
    });
    cerrar();
  }
  return partes.join('');
}
