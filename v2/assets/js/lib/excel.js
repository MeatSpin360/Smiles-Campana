// Genera un archivo de Excel (.xlsx) en el navegador, sin bibliotecas externas.
// Alcanza para listas: una hoja, encabezado en negrita, textos, números, montos en pesos y fechas.
// Se abre en Excel 2007 en adelante (incluido Office 2013), LibreOffice y Google Sheets.
//
// columnas: [{ titulo, ancho, tipo: 'texto' | 'numero' | 'pesos' | 'fecha' }]
// filas: arreglos de valores, en el mismo orden (fecha: 'AAAA-MM-DD' o ISO)

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
const letra = (i) => { let s = ''; i++; while (i) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); } return s; };
const ESTILO = { texto: 0, encabezado: 1, numero: 2, pesos: 3, fecha: 4, total: 5, totalPesos: 6 };

/** Días desde el 30/12/1899, como guarda Excel las fechas */
function serialFecha(v) {
  const [a, m, d] = String(v).slice(0, 10).split('-').map(Number);
  return (Date.UTC(a, m - 1, d) - Date.UTC(1899, 11, 30)) / 864e5;
}

function hoja(columnas, filas, totales) {
  const celda = (valor, tipo, ref, estilo) => {
    if (valor == null || valor === '') return '';
    if (tipo === 'numero' || tipo === 'pesos') {
      const n = Number(valor);
      if (Number.isFinite(n)) return `<c r="${ref}" s="${estilo ?? ESTILO[tipo]}"><v>${n}</v></c>`;
    }
    if (tipo === 'fecha' && /^\d{4}-\d{2}-\d{2}/.test(String(valor))) return `<c r="${ref}" s="${ESTILO.fecha}"><v>${serialFecha(valor)}</v></c>`;
    return `<c r="${ref}" t="inlineStr" s="${estilo ?? 0}"><is><t xml:space="preserve">${esc(valor)}</t></is></c>`;
  };
  const filasXml = [];
  filasXml.push(`<row r="1">${columnas.map((c, i) => celda(c.titulo, 'texto', `${letra(i)}1`, ESTILO.encabezado)).join('')}</row>`);
  filas.forEach((f, n) => {
    const r = n + 2;
    filasXml.push(`<row r="${r}">${columnas.map((c, i) => celda(f[i], c.tipo || 'texto', `${letra(i)}${r}`)).join('')}</row>`);
  });
  if (totales) {
    const r = filas.length + 3;
    filasXml.push(`<row r="${r}">${columnas.map((c, i) => celda(totales[i], c.tipo || 'texto', `${letra(i)}${r}`,
      c.tipo === 'pesos' ? ESTILO.totalPesos : ESTILO.total)).join('')}</row>`);
  }
  const anchos = columnas.map((c, i) => `<col min="${i + 1}" max="${i + 1}" width="${c.ancho || 16}" customWidth="1"/>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<cols>${anchos}</cols><sheetData>${filasXml.join('')}</sheetData></worksheet>`;
}

const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;$&quot; #,##0.00"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFE8E7F5"/></patternFill></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="7">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="164" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

function archivos(nombreHoja, xmlHoja) {
  return {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${esc(nombreHoja.slice(0, 31).replace(/[\\/?*[\]:]/g, ' '))}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`,
    'xl/styles.xml': ESTILOS,
    'xl/worksheets/sheet1.xml': xmlHoja,
  };
}

// ---------- ZIP sin compresión ----------
const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = TABLA_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function zip(entradas) {
  const cod = new TextEncoder();
  const partes = [];
  const central = [];
  let offset = 0;
  for (const [nombre, contenido] of Object.entries(entradas)) {
    const n = cod.encode(nombre);
    const datos = cod.encode(contenido);
    const crc = crc32(datos);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
    local.setUint16(8, 0, true); local.setUint32(14, crc, true); local.setUint32(18, datos.length, true);
    local.setUint32(22, datos.length, true); local.setUint16(26, n.length, true);
    partes.push(new Uint8Array(local.buffer), n, datos);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint32(16, crc, true); c.setUint32(20, datos.length, true); c.setUint32(24, datos.length, true);
    c.setUint16(28, n.length, true); c.setUint32(42, offset, true);
    central.push(new Uint8Array(c.buffer), n);
    offset += 30 + n.length + datos.length;
  }
  const tamCentral = central.reduce((s, p) => s + p.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, central.length / 2, true); fin.setUint16(10, central.length / 2, true);
  fin.setUint32(12, tamCentral, true); fin.setUint32(16, offset, true);
  return new Blob([...partes, ...central, new Uint8Array(fin.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/** Arma el .xlsx y lo descarga. totales: fila opcional al pie (en negrita). */
export function descargarExcel(nombreArchivo, nombreHoja, columnas, filas, totales = null) {
  const blob = zip(archivos(nombreHoja, hoja(columnas, filas, totales)));
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo.endsWith('.xlsx') ? nombreArchivo : `${nombreArchivo}.xlsx`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return blob;
}
