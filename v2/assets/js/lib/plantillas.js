// Plantillas de documentos: un formato de texto simple, campos que se completan solos y la impresión.
//
// Formato (una línea por renglón; los párrafos se separan con una línea en blanco):
//   # Título              ## Subtítulo
//   1. Cláusula numerada  (todas con "1."; se numeran solas)
//   - Viñeta              (con dos espacios adelante queda dentro de la cláusula anterior)
//   **negrita**           ____ (tres o más guiones bajos) línea para completar a mano
//   {{campo}}             se completa al generar el documento; vacío, queda una línea para completar a mano
import { CONSULTORIO } from '../../../config.js';

/** Campos que se completan solos (con los datos del paciente y del consultorio). */
export const CAMPOS_AUTO = [
  { id: 'paciente', texto: 'Nombre del paciente' },
  { id: 'dni', texto: 'DNI del paciente' },
  { id: 'domicilio', texto: 'Domicilio del paciente' },
  { id: 'responsable', texto: 'Responsable (si es menor)' },
  { id: 'responsable_dni', texto: 'DNI del responsable' },
  { id: 'fecha', texto: 'Fecha' },
  { id: 'profesional', texto: 'Profesional' },
  { id: 'matricula', texto: 'Matrícula' },
  { id: 'consultorio', texto: 'Domicilio del consultorio' },
];
const AUTO = new Set(CAMPOS_AUTO.map((c) => c.id));
const PATRON = /\{\{\s*([a-z0-9_áéíóúñ]+)\s*\}\}/gi;

const fmtFecha = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' });
export const fechaDocumento = (d = new Date()) => fmtFecha.format(d);

/** Nombre legible de un campo propio de la plantilla: "controles_mensuales" → "Controles mensuales". */
export const etiquetaCampo = (id) => CAMPOS_AUTO.find((c) => c.id === id)?.texto
  || (id.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase()));

/** Campos de la plantilla que no se completan solos (hay que pedirlos al generar). */
export function camposPropios(contenido) {
  const vistos = [];
  for (const [, id] of String(contenido || '').matchAll(PATRON)) {
    const k = id.toLowerCase();
    if (!AUTO.has(k) && !vistos.includes(k)) vistos.push(k);
  }
  return vistos;
}

/** Valores automáticos para un paciente. */
export function valoresAuto(p, fecha = new Date()) {
  return {
    paciente: [p.nombre, p.apellido].filter(Boolean).join(' '),
    dni: p.dni || '',
    domicilio: p.direccion || '',
    responsable: p.responsable_nombre || '',
    responsable_dni: p.responsable_dni || '',
    fecha: fechaDocumento(fecha),
    profesional: CONSULTORIO.profesional || '',
    matricula: CONSULTORIO.matricula || '',
    consultorio: CONSULTORIO.direccion || '',
  };
}

/** Reemplaza los campos. Los vacíos quedan como una línea para completar a mano. */
export function rellenar(contenido, valores) {
  return String(contenido || '').replace(PATRON, (_, id) => {
    const v = String(valores[id.toLowerCase()] ?? '').trim().replace(/\s+/g, ' ');
    return v || '____________________';
  });
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function enLinea(texto) {
  return esc(texto)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/_{3,}/g, (m) => `<span class="linea" style="min-width:${Math.min(m.length * 0.45, 14)}em"></span>`)
    // Un campo sin completar todavía (en la vista previa de la plantilla)
    .replace(/\{\{\s*([a-z0-9_áéíóúñ]+)\s*\}\}/gi, (_, id) => `<span class="campo-plantilla">${esc(etiquetaCampo(id.toLowerCase()))}</span>`);
}

/** Convierte el texto de una plantilla (o de un documento ya completado) a HTML. */
export function aHtml(texto) {
  const lineas = String(texto || '').replace(/\r/g, '').split('\n');
  const out = [];
  let parrafo = [];
  let lista = null; // { items: [{ texto, sub: [] }] } numerada
  let vinetas = null;
  // Un párrafo donde todos los renglones terminan en una línea (firma, aclaración, DNI...) va más espaciado
  const cerrarParrafo = () => {
    if (!parrafo.length) return;
    const renglones = parrafo.every((l) => /_{3,}\s*$/.test(l));
    out.push(`<p${renglones ? ' class="renglones"' : ''}>${parrafo.map(enLinea).join('<br>')}</p>`);
    parrafo = [];
  };
  const cerrarVinetas = () => { if (vinetas) { out.push(`<ul>${vinetas.map((v) => `<li>${enLinea(v)}</li>`).join('')}</ul>`); vinetas = null; } };
  const cerrarLista = () => {
    if (lista) {
      out.push(`<ol>${lista.map((i) => `<li>${enLinea(i.texto)}${i.sub.length ? `<ul>${i.sub.map((v) => `<li>${enLinea(v)}</li>`).join('')}</ul>` : ''}</li>`).join('')}</ol>`);
      lista = null;
    }
  };
  const cerrarTodo = () => { cerrarParrafo(); cerrarVinetas(); cerrarLista(); };
  for (const cruda of lineas) {
    const l = cruda.trimEnd();
    let m;
    if (!l.trim()) { cerrarParrafo(); cerrarVinetas(); continue; }
    if ((m = l.match(/^(#{1,2})\s+(.*)$/))) { cerrarTodo(); out.push(`<h${m[1].length}>${enLinea(m[2])}</h${m[1].length}>`); continue; }
    if ((m = l.match(/^\d+[.)]\s+(.*)$/))) { cerrarParrafo(); cerrarVinetas(); (lista ??= []).push({ texto: m[1], sub: [] }); continue; }
    if ((m = l.match(/^(\s+)[-•]\s+(.*)$/)) && lista) { lista.at(-1).sub.push(m[2]); continue; }
    if ((m = l.match(/^\s*[-•]\s+(.*)$/))) { cerrarParrafo(); cerrarLista(); (vinetas ??= []).push(m[1]); continue; }
    cerrarVinetas(); cerrarLista();
    parrafo.push(l.trim());
  }
  cerrarTodo();
  return out.join('\n');
}

/** Estilos del documento (vista previa en pantalla e impresión). */
export const ESTILOS_DOCUMENTO = `
  .doc { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #262140; font-size: 10.5pt; line-height: 1.5; }
  .doc h1 { font-size: 15pt; text-align: center; margin: 14px 0 14px; letter-spacing: 0.02em; }
  .doc h2 { font-size: 12pt; margin: 14px 0 6px; }
  .doc p { margin: 0 0 10px; text-align: justify; }
  .doc ol { margin: 0 0 12px; padding-left: 1.6em; }
  .doc ol > li { margin-bottom: 6px; text-align: justify; padding-left: 0.2em; }
  .doc ul { margin: 4px 0 8px; padding-left: 1.4em; }
  .doc .linea { display: inline-block; border-bottom: 1px solid #262140; height: 1em; vertical-align: baseline; }
  .doc .campo-plantilla { background: #e8e7f5; color: #4b4796; border-radius: 4px; padding: 0 4px; font-size: 0.9em; }
  .doc p.renglones { text-align: left; margin-top: 22px; line-height: 2.4; }
`;

/** Imprime (o guarda como PDF) un documento ya completado, con el encabezado del consultorio. */
export function imprimirDocumento({ titulo, contenido, paciente }) {
  const base = new URL('.', location.href).href;
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><base href="${esc(base)}">
<title>${esc(`${titulo}${paciente ? ` - ${paciente}` : ''}`)}</title>
<style>
  @page { size: A4; margin: 16mm 18mm 18mm; }
  body { margin: 0; }
  header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #8d8ac6; padding-bottom: 10px;
    font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
  header img { height: 54px; }
  .consultorio { text-align: right; font-size: 9pt; color: #5d5875; line-height: 1.4; }
  .consultorio strong { color: #262140; font-size: 10.5pt; }
  .doc p:last-child { margin-bottom: 0; }
  ${ESTILOS_DOCUMENTO}
</style></head><body>
<header>
  <img src="assets/img/logo.png" alt="${esc(CONSULTORIO.nombre)}">
  <div class="consultorio"><strong>${esc(CONSULTORIO.profesional)}</strong><br>${esc(CONSULTORIO.especialidad || '')}${CONSULTORIO.matricula ? ` · ${esc(CONSULTORIO.matricula)}` : ''}<br>
  ${esc(CONSULTORIO.direccion)}<br>Tel. ${esc(CONSULTORIO.telefono)} · ${esc(CONSULTORIO.email)}</div>
</header>
<div class="doc">${aHtml(contenido)}</div>
</body></html>`;
  const marco = document.createElement('iframe');
  marco.className = 'marco-impresion';
  marco.title = 'Impresión del documento';
  marco.setAttribute('aria-hidden', 'true');
  document.body.append(marco);
  marco.contentDocument.open();
  marco.contentDocument.write(html);
  marco.contentDocument.close();
  const imprimir = () => { marco.contentWindow.focus(); marco.contentWindow.print(); setTimeout(() => marco.remove(), 60_000); };
  const logo = marco.contentDocument.querySelector('img');
  if (logo.complete) setTimeout(imprimir, 50);
  else { logo.addEventListener('load', imprimir, { once: true }); logo.addEventListener('error', imprimir, { once: true }); }
}
