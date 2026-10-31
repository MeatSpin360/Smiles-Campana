// Lista de precios. Todo el personal la ve con un buscador que filtra mientras se escribe;
// contabilidad y admin además la editan, aplican aumentos generales, la exportan a Excel y la imprimen.
import { h, vaciar } from '../../lib/dom.js';
import { aviso, confirmar, conCarga, hoja, mensajeError } from '../../lib/ui.js';
import { fechaCorta, hoy } from '../../lib/dates.js';
import { encabezado } from '../comunes.js';
import { ICONOS } from '../iconos.js';
import { CONSULTORIO } from '../../../../config.js';
import { monto, pesos } from './registro-textos.js';
import { descargarExcel } from '../../lib/excel.js';

export const normalizar = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const icono = (n) => h('span.icono-btn', { html: ICONOS[n] });
const REDONDEOS = [[0, 'Sin redondeo'], [100, 'A $100'], [500, 'A $500'], [1000, 'A $1.000']];

export async function precios(ctx) {
  const editable = ['contabilidad', 'admin'].includes(ctx.rol);
  let lista = await ctx.api.precios();
  const ordenar = () => lista.sort((a, b) => a.servicio.localeCompare(b.servicio, 'es'));
  ordenar();

  const buscar = h('input.buscador-precios', { type: 'search', placeholder: 'Buscar servicio, por ejemplo "lim"', 'aria-label': 'Buscar servicio', autocomplete: 'off' });
  const verInactivos = h('input', { type: 'checkbox', checked: editable });
  const cuenta = h('p.texto-suave.nota-chica.cuenta-precios');
  const tabla = h('div.tabla-precios');

  function dibujar() {
    const q = normalizar(buscar.value);
    const visibles = lista.filter((x) => (verInactivos.checked || x.activo) && (!q || normalizar(`${x.servicio} ${x.nota || ''}`).includes(q)));
    cuenta.textContent = q
      ? `${visibles.length} de ${lista.length} servicios`
      : `${lista.filter((x) => x.activo).length} servicios${lista.some((x) => !x.activo) ? ` · ${lista.filter((x) => !x.activo).length} que no se realizan` : ''}`;
    vaciar(tabla,
      h('div.fila-precio.fila-precio-titulos', { 'aria-hidden': 'true' }, h('span', 'Servicio'), h('span', 'Precio'), h('span', 'Nota')),
      visibles.length ? visibles.map((x) => h(`${editable ? 'button' : 'div'}.fila-precio${x.activo ? '' : '.precio-inactivo'}`,
        editable ? { type: 'button', onclick: () => editar(x), title: 'Editar' } : {},
        h('span.precio-servicio', resaltar(x.servicio, q)),
        h('span.precio-monto', x.activo ? monto(x.precio, x.moneda) : 'No se realiza'),
        h('span.precio-nota', x.nota || '', editable && x.actualizado_en ? h('small', ` Actualizado el ${fechaCorta(x.actualizado_en)}`) : null)))
        : h('p.vacio', 'No hay servicios que coincidan con la búsqueda.'));
  }

  buscar.addEventListener('input', dibujar);
  verInactivos.addEventListener('change', dibujar);

  function editar(x) {
    const nuevo = !x;
    const servicio = h('input', { value: x?.servicio || '', maxlength: 120 });
    const precio = h('input', { type: 'number', min: 0, step: 'any', inputmode: 'decimal', value: x?.precio ?? '' });
    const moneda = h('select', h('option', { value: 'ARS', selected: (x?.moneda || 'ARS') === 'ARS' }, 'Pesos'), h('option', { value: 'USD', selected: x?.moneda === 'USD' }, 'Dólares'));
    const nota = h('input', { value: x?.nota || '', placeholder: 'Por ejemplo: por maxilar', maxlength: 200 });
    const activo = h('input', { type: 'checkbox', checked: x ? x.activo : true });
    const guardar = h('button.btn.btn-primario', { type: 'button' }, nuevo ? 'Agregar' : 'Guardar');
    const quitar = nuevo ? null : h('button.btn.btn-fantasma', { type: 'button' }, 'Quitar de la lista');
    const { cerrar } = hoja({
      titulo: nuevo ? 'Agregar servicio' : 'Editar servicio',
      ancho: 'chico',
      cuerpo: h('div',
        h('label.campo', h('span', 'Servicio'), servicio),
        h('div.fila-campos.fila-precio-editar', h('label.campo', h('span', 'Precio'), precio), h('label.campo', h('span', 'Moneda'), moneda)),
        h('label.campo', h('span', 'Nota (opcional)'), nota),
        h('label.interruptor-texto', activo, h('span', 'Se realiza en el consultorio')),
        x?.actualizado_en ? h('p.texto-suave.nota-chica', `Última modificación: ${fechaCorta(x.actualizado_en)}${x.actualizado_por_nombre ? ` por ${x.actualizado_por_nombre}` : ''}.`) : null),
      pie: [quitar, guardar].filter(Boolean),
    });
    setTimeout(() => (nuevo ? servicio : precio).focus(), 50);
    guardar.onclick = () => conCarga(guardar, async () => {
      if (!servicio.value.trim()) throw new Error('Escribí el nombre del servicio.');
      if (activo.checked && precio.value === '') throw new Error('Completá el precio, o desmarcá "Se realiza en el consultorio".');
      const r = await ctx.api.guardarPrecio({ id: x?.id, servicio: servicio.value, precio: precio.value, moneda: moneda.value, nota: nota.value, activo: activo.checked });
      lista = lista.filter((y) => y.id !== r.id).concat(r);
      ordenar();
      cerrar();
      aviso(nuevo ? 'Servicio agregado.' : 'Precio guardado.');
      dibujar();
    });
    if (quitar) {
      quitar.onclick = async () => {
        cerrar();
        if (!(await confirmar(`Se quita "${x.servicio}" de la lista. Si solo dejó de hacerse, conviene marcarlo como "no se realiza".`, { titulo: 'Quitar servicio', aceptar: 'Quitar', peligro: true }))) return;
        try {
          await ctx.api.borrarPrecio(x.id);
          lista = lista.filter((y) => y.id !== x.id);
          aviso('Servicio quitado.');
          dibujar();
        } catch (e) { aviso(mensajeError(e), 'error'); }
      };
    }
  }

  function aumento() {
    const porcentaje = h('input', { type: 'number', step: '0.5', inputmode: 'decimal', placeholder: 'Por ejemplo: 15' });
    const redondeo = h('select', REDONDEOS.map(([v, t]) => h('option', { value: v, selected: v === 1000 }, t)));
    const vista = h('div.vista-aumento');
    const aplicar = h('button.btn.btn-primario', { type: 'button', disabled: true }, 'Aplicar aumento');
    const afectados = () => lista.filter((x) => x.activo && x.moneda === 'ARS' && x.precio != null);
    const calcular = (p) => {
      const pct = Number(porcentaje.value);
      const v = p * (1 + pct / 100);
      const r = Number(redondeo.value);
      return r > 0 ? Math.round(v / r) * r : Math.round(v * 100) / 100;
    };
    const actualizar = () => {
      const pct = Number(porcentaje.value);
      const valido = porcentaje.value !== '' && Number.isFinite(pct) && pct > -100 && pct <= 500 && pct !== 0;
      aplicar.disabled = !valido;
      vaciar(vista, valido
        ? [h('p', `Se actualizan ${afectados().length} servicios en pesos. Los que están en dólares y los que no se realizan no cambian. Por ejemplo:`),
          h('ul.ejemplos-aumento', afectados().slice(0, 4).map((x) => h('li', h('span', x.servicio), h('span', `${pesos(x.precio)} → ${pesos(calcular(x.precio))}`))))]
        : h('p.texto-suave', 'Escribí el porcentaje de aumento (o negativo para bajar los precios).'));
    };
    porcentaje.addEventListener('input', actualizar);
    redondeo.addEventListener('change', actualizar);
    actualizar();
    const { cerrar } = hoja({
      titulo: 'Aumento general',
      ancho: 'chico',
      cuerpo: h('div', h('div.fila-campos', h('label.campo', h('span', 'Porcentaje'), porcentaje), h('label.campo', h('span', 'Redondear'), redondeo)), vista),
      pie: [aplicar],
    });
    setTimeout(() => porcentaje.focus(), 50);
    aplicar.onclick = () => conCarga(aplicar, async () => {
      const n = await ctx.api.aumentarPrecios(Number(porcentaje.value), Number(redondeo.value));
      lista = await ctx.api.precios();
      ordenar();
      cerrar();
      aviso(`Precios actualizados: ${n} servicios.`);
      dibujar();
    });
  }

  const exportar = () => descargarExcel(`precios-${hoy()}`, 'Precios',
    [{ titulo: 'Servicio', ancho: 46 }, { titulo: 'Precio', ancho: 16, tipo: 'numero' }, { titulo: 'Moneda', ancho: 9 }, { titulo: 'Nota', ancho: 34 }, { titulo: 'Se realiza', ancho: 11 }, { titulo: 'Actualizado', ancho: 13, tipo: 'fecha' }],
    lista.map((x) => [x.servicio, x.precio, x.moneda === 'USD' ? 'USD' : '$', x.nota || '', x.activo ? 'Sí' : 'No', x.actualizado_en ? x.actualizado_en.slice(0, 10) : '']));

  const acciones = editable ? [
    h('button.btn.btn-secundario', { type: 'button', onclick: () => imprimirPrecios(lista.filter((x) => x.activo)) }, icono('nota'), 'Imprimir'),
    h('button.btn.btn-secundario', { type: 'button', onclick: exportar }, icono('subir'), 'Exportar a Excel'),
    h('button.btn.btn-secundario', { type: 'button', onclick: aumento }, '%', ' Aumento general'),
    h('button.btn.btn-primario', { type: 'button', onclick: () => editar(null) }, icono('mas'), 'Agregar servicio'),
  ] : [h('button.btn.btn-secundario', { type: 'button', onclick: () => imprimirPrecios(lista.filter((x) => x.activo)) }, icono('nota'), 'Imprimir')];

  dibujar();
  setTimeout(() => buscar.focus(), 0);
  return h('div.precios',
    encabezado('Lista de precios', editable ? 'Tocá un servicio para cambiar su precio. Cada cambio queda en el registro.' : 'Precios vigentes para responder consultas.', ...acciones),
    h('section.panel',
      h('div.barra-precios', buscar, editable ? h('label.interruptor-texto', verInactivos, h('span', 'Mostrar los que no se realizan')) : null),
      cuenta,
      tabla));
}

// Resalta lo buscado dentro del nombre
function resaltar(texto, q) {
  if (!q) return texto;
  const i = normalizar(texto).indexOf(q);
  if (i < 0) return texto;
  return [texto.slice(0, i), h('mark', texto.slice(i, i + q.length)), texto.slice(i + q.length)];
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function imprimirPrecios(lista) {
  const base = new URL('.', location.href).href;
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><base href="${esc(base)}"><title>Lista de precios</title>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #262140; font-size: 10pt; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #8d8ac6; padding-bottom: 8px; margin-bottom: 10px; }
  header img { height: 48px; } h1 { font-size: 15pt; margin: 0; } header p { margin: 0; color: #5d5875; font-size: 9pt; text-align: right; }
  table { width: 100%; border-collapse: collapse; } td, th { padding: 4px 6px; border-bottom: 1px solid #e8e7f5; text-align: left; vertical-align: top; }
  th { font-size: 8.5pt; color: #5d5875; border-bottom: 1px solid #c6c4dc; } .num { text-align: right; white-space: nowrap; } .nota { color: #5d5875; font-size: 9pt; }
</style></head><body>
<header><img src="assets/img/logo.png" alt=""><div><h1>Lista de precios</h1><p>${esc(CONSULTORIO.nombre)} · ${esc(fechaCorta(new Date().toISOString()))}</p></div></header>
<table><thead><tr><th>Servicio</th><th class="num">Precio</th><th>Nota</th></tr></thead><tbody>
${lista.map((x) => `<tr><td>${esc(x.servicio)}</td><td class="num">${esc(monto(x.precio, x.moneda))}</td><td class="nota">${esc(x.nota || '')}</td></tr>`).join('')}
</tbody></table></body></html>`;
  const marco = h('iframe.marco-impresion', { title: 'Impresión', 'aria-hidden': 'true' });
  document.body.append(marco);
  marco.contentDocument.open();
  marco.contentDocument.write(html);
  marco.contentDocument.close();
  const imprimir = () => { marco.contentWindow.focus(); marco.contentWindow.print(); setTimeout(() => marco.remove(), 60_000); };
  const logo = marco.contentDocument.querySelector('img');
  if (logo.complete) setTimeout(imprimir, 50);
  else { logo.addEventListener('load', imprimir, { once: true }); logo.addEventListener('error', imprimir, { once: true }); }
}
