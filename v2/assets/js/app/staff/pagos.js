// Pagos: lo que se le factura a cada paciente y lo que paga. Saldo = facturado - pagado.
//  - Pestaña "Pagos" de la ficha (recepción y admin): saldo, lista, cargar y corregir; borrar solo admin.
//  - Cartel "(con deuda)" / "(pago adelantado)" junto al nombre (recepción, odontología y admin).
//  - Lista completa para contabilidad y admin (menú "Pagos"), con filtros, totales, Excel e impresión.
import { h, vaciar } from '../../lib/dom.js';
import { aviso, confirmar, conCarga, hoja, mensajeError } from '../../lib/ui.js';
import { fechaCorta, hoy, sumarDias } from '../../lib/dates.js';
import { prepararComprobante } from '../../lib/imagenes.js';
import { descargarExcel } from '../../lib/excel.js';
import { encabezado } from '../comunes.js';
import { ICONOS } from '../iconos.js';
import { CONSULTORIO } from '../../../../config.js';
import { pesos } from './registro-textos.js';
import { normalizar } from './precios.js';

const CAJA = ['recepcion', 'admin'];
export const VEN_SALDO = ['recepcion', 'odontologia', 'admin'];
const icono = (n) => h('span.icono-btn', { html: ICONOS[n] });
const redondo = (n) => Math.round(n * 100) / 100;

// ---------- Campo de monto en pesos: se ve "$ 56.000,50" mientras se escribe ----------
const fmtEntero = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });

/** Formatea lo escrito: solo dígitos y una coma decimal (hasta 2 decimales); los puntos se ignoran. */
export function formatearPesos(texto) {
  const t = String(texto ?? '').replace(/[^\d,]/g, '');
  const i = t.indexOf(',');
  let entero = (i >= 0 ? t.slice(0, i) : t).replace(/^0+(?=\d)/, '').slice(0, 13);
  const decimales = i >= 0 ? t.slice(i + 1).replace(/,/g, '').slice(0, 2) : null;
  if (!entero && decimales == null) return '';
  if (!entero) entero = '0';
  return `$ ${fmtEntero.format(Number(entero))}${decimales != null ? `,${decimales}` : ''}`;
}
export const leerPesos = (texto) => {
  const t = String(texto ?? '').replace(/[^\d,]/g, '').replace(',', '.');
  const n = Number(t);
  return t && Number.isFinite(n) ? n : 0;
};
const aTexto = (n) => (n ? formatearPesos(String(redondo(Number(n))).replace('.', ',')) : '');

export function campoPesos({ valor = 0, ...attrs } = {}) {
  const input = h('input.campo-pesos', { type: 'text', inputmode: 'decimal', autocomplete: 'off', placeholder: '$ 0', ...attrs });
  input.value = aTexto(valor);
  input.addEventListener('input', () => {
    // Conserva la posición del cursor contando los dígitos que había antes
    const pos = input.selectionStart ?? input.value.length;
    const antes = input.value.slice(0, pos).replace(/[^\d,]/g, '').length;
    input.value = formatearPesos(input.value);
    let p = input.value.startsWith('$ ') ? 2 : 0;
    for (let n = 0; p < input.value.length && n < antes; p++) if (/[\d,]/.test(input.value[p])) n++;
    try { input.setSelectionRange(p, p); } catch { /* algunos navegadores no lo permiten */ }
  });
  input.valor = () => leerPesos(input.value);
  return input;
}

// ---------- Saldo ----------
/** Texto del saldo: positivo debe, negativo a favor. */
export const textoSaldo = (saldo) => (saldo > 0 ? `Debe ${pesos(saldo)}` : saldo < 0 ? `A favor ${pesos(-saldo)}` : 'Al día');

let globoAbierto = null;
function cerrarGlobo() {
  globoAbierto?.remove();
  globoAbierto = null;
}
document.addEventListener('click', (e) => { if (globoAbierto && !e.target.closest('.cartel-saldo, .globo-saldo')) cerrarGlobo(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarGlobo(); });
window.addEventListener('hashchange', cerrarGlobo);
window.addEventListener('scroll', cerrarGlobo, { passive: true });

/** Cartel rojo "(con deuda)" o verde "(pago adelantado)"; al tocarlo muestra solo el monto. */
export function cartelSaldo(saldo) {
  if (!saldo) return null;
  const deuda = saldo > 0;
  const boton = h(`button.cartel-saldo.${deuda ? 'cartel-deuda' : 'cartel-favor'}`, {
    type: 'button',
    'aria-label': deuda ? 'Con deuda: ver el monto' : 'Pago adelantado: ver el monto',
  }, deuda ? '(con deuda)' : '(pago adelantado)');
  boton.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const yaEra = globoAbierto?.boton === boton;
    cerrarGlobo();
    if (yaEra) return;
    const globo = h(`div.globo-saldo.${deuda ? 'globo-deuda' : 'globo-favor'}`, { role: 'status' },
      h('span', deuda ? 'Adeuda' : 'A favor'), h('strong', pesos(Math.abs(saldo))));
    globo.boton = boton;
    document.body.append(globo);
    const r = boton.getBoundingClientRect();
    const ancho = globo.offsetWidth;
    globo.style.left = `${Math.max(8, Math.min(window.innerWidth - ancho - 8, r.left + r.width / 2 - ancho / 2)) + window.scrollX}px`;
    globo.style.top = `${r.bottom + 8 + window.scrollY}px`;
    globoAbierto = globo;
  });
  return boton;
}

// ---------- Comprobantes ----------
async function abrirComprobante(api, pago, boton) {
  // La ventana se abre antes de esperar el archivo para que el navegador no la bloquee
  const ventana = window.open('', '_blank');
  await conCarga(boton, async () => {
    try {
      const url = await api.urlComprobante(pago.id);
      if (ventana) ventana.location.href = url;
      else location.assign(url);
    } catch (e) {
      ventana?.close();
      throw e;
    }
  });
}
const kb = (n) => (n >= 1024 * 1024 ? `${(n / 1024 / 1024).toLocaleString('es-AR', { maximumFractionDigits: 1 })} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

// ---------- Cargar o corregir un pago ----------
/** Abre el formulario. Devuelve true si se guardó o borró algo. */
export function editorPago(ctx, { paciente, pago = null }) {
  return new Promise((resolve) => {
    let cambio = false;
    const nuevo = !pago;
    const fecha = h('input', { type: 'date', value: pago?.fecha || hoy(), max: sumarDias(hoy(), 1), required: true });
    const facturado = campoPesos({ valor: pago?.facturado, 'aria-label': 'Monto facturado' });
    const pagado = campoPesos({ valor: pago && !pago.paga_justo ? pago.pagado : 0, 'aria-label': 'Monto que paga' });
    const justoSi = h('input', { type: 'radio', name: 'paga-justo', value: 'si', checked: pago ? pago.paga_justo : true });
    const justoNo = h('input', { type: 'radio', name: 'paga-justo', value: 'no', checked: pago ? !pago.paga_justo : false });
    const campoPagado = h('label.campo', h('span', 'Monto que paga'), pagado);
    const diferencia = h('p.diferencia-pago', { 'aria-live': 'polite' });
    const comentario = h('textarea', { rows: 2, maxlength: 500, placeholder: 'Por ejemplo: control de brackets, paga el resto el próximo turno' });
    comentario.value = pago?.comentario || '';

    // Comprobante: el actual (ver o quitar) y uno nuevo para adjuntar o reemplazar
    let archivo = null;
    let quitar = false;
    const elegir = h('input', { type: 'file', accept: 'image/*,application/pdf,.pdf', hidden: true });
    const zonaComprobante = h('div.zona-comprobante');
    const dibujarComprobante = () => {
      const actual = pago?.comprobante_tipo && !quitar && !archivo;
      vaciar(zonaComprobante,
        archivo ? h('div.comprobante-elegido', icono('nota'), h('span', archivo.name, h('small', ` · ${kb(archivo.size)}${archivo.size > 1024 * 1024 && !/pdf/i.test(archivo.type) ? ', se achica al guardar' : ''}`)),
          h('button.btn.btn-fantasma.btn-chico', { type: 'button', onclick: () => { archivo = null; elegir.value = ''; dibujarComprobante(); } }, 'Quitar'))
          : actual ? h('div.comprobante-elegido', icono('nota'), h('span', pago.comprobante_nombre || 'Comprobante', h('small', ` · ${kb(pago.comprobante_bytes || 0)}`)),
            h('button.btn.btn-fantasma.btn-chico', { type: 'button', onclick: (e) => abrirComprobante(ctx.api, pago, e.currentTarget) }, 'Ver'),
            h('button.btn.btn-fantasma.btn-chico', { type: 'button', onclick: () => { quitar = true; dibujarComprobante(); } }, 'Quitar'))
            : null,
        h('button.btn.btn-secundario.btn-chico', { type: 'button', onclick: () => elegir.click() }, icono('subir'),
          archivo || (pago?.comprobante_tipo && !quitar) ? 'Reemplazar' : 'Adjuntar comprobante'),
        quitar && !archivo ? h('p.texto-suave.nota-chica', 'El comprobante se quita al guardar.') : null);
    };
    elegir.addEventListener('change', async () => {
      const f = elegir.files[0];
      if (!f) return;
      try {
        if ((f.type === 'application/pdf' || /\.pdf$/i.test(f.name)) && f.size > 1024 * 1024) await prepararComprobante(f); // da el mensaje
        if (!f.type.startsWith('image/') && f.type !== 'application/pdf' && !/\.(pdf|jpe?g|png|webp|heic|heif)$/i.test(f.name)) throw new Error(`"${f.name}" no es una imagen ni un PDF.`);
        archivo = f;
        quitar = false;
      } catch (e) {
        aviso(mensajeError(e), 'error');
        elegir.value = '';
      }
      dibujarComprobante();
    });
    dibujarComprobante();

    const actualizar = () => {
      const justo = justoSi.checked;
      campoPagado.hidden = justo;
      const f = facturado.valor();
      const p = justo ? f : pagado.valor();
      const d = redondo(f - p);
      diferencia.className = `diferencia-pago${d > 0 ? ' debe' : d < 0 ? ' a-favor' : ''}`;
      diferencia.textContent = justo || (!f && !p) ? '' : d > 0 ? `Queda debiendo ${pesos(d)}` : d < 0 ? `Deja a favor ${pesos(-d)}` : 'Paga justo.';
    };
    [facturado, pagado].forEach((x) => x.addEventListener('input', actualizar));
    [justoSi, justoNo].forEach((x) => x.addEventListener('change', () => { actualizar(); if (justoNo.checked) pagado.focus(); }));
    actualizar();

    const guardar = h('button.btn.btn-primario', { type: 'button' }, nuevo ? 'Guardar pago' : 'Guardar cambios');
    const borrar = !nuevo && ctx.rol === 'admin' ? h('button.btn.btn-fantasma.btn-peligro-texto', { type: 'button' }, icono('basura'), 'Borrar') : null;
    const { cerrar } = hoja({
      titulo: nuevo ? 'Cargar pago' : 'Corregir pago',
      ancho: 'chico',
      cuerpo: h('div.editor-pago',
        h('p.texto-suave.nota-chica', `${paciente.apellido}, ${paciente.nombre}`),
        h('label.campo', h('span', 'Fecha'), fecha),
        h('label.campo', h('span', 'Monto facturado'), facturado),
        h('fieldset.paga-justo', h('legend', '¿Paga justo?'),
          h('div.segmentado', h('label', justoSi, h('span', 'Sí')), h('label', justoNo, h('span', 'No')))),
        campoPagado,
        diferencia,
        h('label.campo', h('span', 'Comentario (opcional)'), comentario),
        h('div.campo', h('span', 'Comprobante (opcional): imagen o PDF de hasta 1 MB'), zonaComprobante, elegir),
        pago?.actualizado_en ? h('p.texto-suave.nota-chica', `Corregido el ${fechaCorta(pago.actualizado_en)}${pago.actualizado_por_nombre ? ` por ${pago.actualizado_por_nombre}` : ''}.`) : null),
      pie: [borrar, guardar].filter(Boolean),
      alCerrar: () => resolve(cambio),
    });
    setTimeout(() => facturado.focus(), 50);

    guardar.onclick = () => conCarga(guardar, async () => {
      const f = facturado.valor();
      const justo = justoSi.checked;
      const p = justo ? f : pagado.valor();
      if (!fecha.value) throw new Error('Completá la fecha.');
      if (!f && !p) throw new Error('Completá el monto facturado o lo que pagó.');
      if (justo && !f) throw new Error('Completá el monto facturado, o elegí "No" en "¿Paga justo?" si es una seña o un pago adelantado.');
      // Si el comprobante no sirve, mejor saberlo antes de guardar
      const listo = archivo ? await prepararComprobante(archivo) : null;
      const r = await ctx.api.guardarPago({ id: pago?.id, paciente_id: paciente.id, fecha: fecha.value, facturado: f, paga_justo: justo, pagado: p, comentario: comentario.value });
      cambio = true;
      try {
        if (listo) await ctx.api.subirComprobante(r.id, listo);
        else if (quitar && pago?.comprobante_tipo) await ctx.api.quitarComprobante(r.id);
      } catch (e) {
        cerrar();
        aviso(`El pago se guardó, pero el comprobante no: ${mensajeError(e)}`, 'error');
        return;
      }
      cerrar();
      aviso(nuevo ? 'Pago guardado.' : 'Pago corregido.');
    });
    if (borrar) {
      borrar.onclick = async () => {
        const ok = await confirmar(`Se borra el pago del ${fechaCorta(pago.fecha)} (facturado ${pesos(pago.facturado)}, pagó ${pesos(pago.pagado)})${pago.comprobante_tipo ? ' con su comprobante' : ''}. Queda anotado en el registro.`, { titulo: 'Borrar pago', aceptar: 'Borrar', peligro: true });
        if (!ok) return;
        await conCarga(borrar, async () => {
          await ctx.api.borrarPago(pago.id);
          cambio = true;
          cerrar();
          aviso('Pago borrado.');
        });
      };
    }
  });
}

// ---------- Pestaña "Pagos" de la ficha ----------
export async function vistaPagos(ctx, p) {
  const pagos = await ctx.api.pagos(p.id);
  const caja = CAJA.includes(ctx.rol);
  const recargar = () => ctx.navegar(`/pacientes/${p.id}/pagos`);
  const facturado = redondo(pagos.reduce((s, x) => s + Number(x.facturado), 0));
  const pagado = redondo(pagos.reduce((s, x) => s + Number(x.pagado), 0));
  const saldo = redondo(facturado - pagado);

  const cargar = caja ? h('button.btn.btn-primario', {
    type: 'button',
    onclick: async () => { if (await editorPago(ctx, { paciente: p })) recargar(); },
  }, icono('mas'), 'Cargar pago') : null;

  const fila = (x) => {
    const dif = redondo(Number(x.facturado) - Number(x.pagado));
    return h('li.fila-pago',
      h('div.pago-fecha', h('strong', fechaCorta(x.fecha)),
        x.comentario ? h('span.pago-comentario', x.comentario) : null,
        h('span.texto-suave.nota-chica', `Cargó ${x.creado_por_nombre || '—'}${x.actualizado_en ? ` · corregido el ${fechaCorta(x.actualizado_en)}` : ''}`)),
      h('div.pago-montos',
        h('span', h('small', 'Facturado'), pesos(x.facturado)),
        h('span', h('small', 'Pagó'), pesos(x.pagado)),
        dif ? h(`span.etiqueta.${dif > 0 ? 'etiqueta-debe' : 'etiqueta-favor'}`, dif > 0 ? `Quedó debiendo ${pesos(dif)}` : `Dejó a favor ${pesos(-dif)}`) : null),
      h('div.pago-acciones',
        x.comprobante_tipo ? h('button.btn.btn-fantasma.btn-chico', { type: 'button', title: x.comprobante_nombre || 'Comprobante', onclick: (e) => abrirComprobante(ctx.api, x, e.currentTarget) }, icono('nota'), 'Comprobante') : null,
        caja ? h('button.btn.btn-secundario.btn-chico', { type: 'button', onclick: async () => { if (await editorPago(ctx, { paciente: p, pago: x })) recargar(); } }, 'Corregir') : null));
  };

  return h('div.vista-pagos',
    h('section.panel.resumen-pagos',
      h('div.cifras-pagos',
        h('div', h('span', 'Facturado'), h('strong', pesos(facturado))),
        h('div', h('span', 'Pagado'), h('strong', pesos(pagado))),
        h(`div.cifra-saldo${saldo > 0 ? '.debe' : saldo < 0 ? '.a-favor' : ''}`, h('span', 'Saldo'), h('strong', textoSaldo(saldo)))),
      cargar),
    h('section.panel',
      h('h2', 'Pagos'),
      pagos.length ? h('ul.lista-pagos', pagos.map(fila)) : h('p.vacio', 'Todavía no hay pagos cargados.')));
}

// ---------- Lista completa (contabilidad y admin) ----------
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const finDeMes = (aaaamm) => {
  const [a, m] = aaaamm.split('-').map(Number);
  const siguiente = m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, '0')}-01`;
  return sumarDias(siguiente, -1);
};

export async function pagosContabilidad(ctx) {
  const mesActual = hoy().slice(0, 7);
  const anioActual = Number(hoy().slice(0, 4));
  const modo = h('select', { 'aria-label': 'Período' },
    h('option', { value: 'mes' }, 'Por mes'), h('option', { value: 'anio' }, 'Por año'),
    h('option', { value: 'rango' }, 'Entre fechas'), h('option', { value: 'todo' }, 'Todos'));
  const mes = h('input', { type: 'month', value: mesActual, max: mesActual, 'aria-label': 'Mes' });
  const anio = h('select', { 'aria-label': 'Año' }, Array.from({ length: anioActual - 2024 }, (_, i) => anioActual - i).map((a) => h('option', { value: a }, a)));
  const desde = h('input', { type: 'date', value: `${mesActual}-01`, 'aria-label': 'Desde' });
  const hasta = h('input', { type: 'date', value: hoy(), 'aria-label': 'Hasta' });
  const campoMes = h('label.campo', h('span', 'Mes'), mes);
  const campoAnio = h('label.campo', h('span', 'Año'), anio);
  const campoRango = h('div.fila-campos', h('label.campo', h('span', 'Desde'), desde), h('label.campo', h('span', 'Hasta'), hasta));
  const paciente = h('input', { type: 'search', placeholder: 'Paciente: apellido, nombre o DNI', 'aria-label': 'Filtrar por paciente', autocomplete: 'off' });
  const cuenta = h('p.texto-suave.nota-chica');
  const tabla = h('div.tabla-pagos');
  let lista = [];
  let consulta = 0;

  const periodo = () => {
    switch (modo.value) {
      case 'mes': return { desde: `${mes.value || mesActual}-01`, hasta: finDeMes(mes.value || mesActual), nombre: `${MESES[Number((mes.value || mesActual).slice(5)) - 1]} ${(mes.value || mesActual).slice(0, 4)}` };
      case 'anio': return { desde: `${anio.value}-01-01`, hasta: `${anio.value}-12-31`, nombre: `año ${anio.value}` };
      case 'rango': return { desde: desde.value || null, hasta: hasta.value || null, nombre: `${desde.value ? fechaCorta(desde.value) : 'el inicio'} al ${hasta.value ? fechaCorta(hasta.value) : 'hoy'}` };
      default: return { desde: null, hasta: null, nombre: 'todos los pagos' };
    }
  };
  const visibles = () => {
    const q = normalizar(paciente.value);
    return q ? lista.filter((x) => normalizar(`${x.paciente} ${x.dni}`).includes(q)) : lista;
  };
  const totales = (filas) => {
    const f = redondo(filas.reduce((s, x) => s + x.facturado, 0));
    const p = redondo(filas.reduce((s, x) => s + x.pagado, 0));
    return { facturado: f, pagado: p, diferencia: redondo(f - p) };
  };

  function dibujar() {
    const filas = visibles();
    const t = totales(filas);
    cuenta.textContent = `${filas.length} ${filas.length === 1 ? 'pago' : 'pagos'} · ${periodo().nombre}${paciente.value.trim() ? ' · filtrado por paciente' : ''}`;
    vaciar(tabla,
      h('div.fila-pago-cont.fila-pago-titulos', { 'aria-hidden': 'true' },
        h('span', 'Fecha'), h('span', 'Paciente'), h('span.num', 'Facturado'), h('span.num', 'Pagado'), h('span.num', 'Diferencia'), h('span', 'Comentario'), h('span')),
      filas.length ? filas.map((x) => {
        const d = redondo(x.facturado - x.pagado);
        return h('div.fila-pago-cont',
          h('span.pc-fecha', fechaCorta(x.fecha)),
          h('span.pc-paciente', h('strong', x.paciente), h('small', `DNI ${x.dni}`)),
          h('span.num', h('small', 'Facturado '), pesos(x.facturado)),
          h('span.num', h('small', 'Pagado '), pesos(x.pagado)),
          h(`span.num${d > 0 ? '.debe' : d < 0 ? '.a-favor' : ''}`, h('small', 'Diferencia '), d ? (d > 0 ? `+${pesos(d)}` : `−${pesos(-d)}`) : '—'),
          h('span.pc-comentario', x.comentario || ''),
          h('span.pc-acciones', x.comprobante_tipo
            ? h('button.btn.btn-fantasma.btn-chico', { type: 'button', title: x.comprobante_nombre || 'Comprobante', onclick: (e) => abrirComprobante(ctx.api, x, e.currentTarget) }, icono('nota'), 'Ver')
            : null));
      }) : h('p.vacio', lista.length ? 'Ningún pago coincide con el paciente buscado.' : 'No hay pagos en este período.'),
      filas.length ? h('div.fila-pago-cont.fila-pago-total',
        h('span', 'Total'), h('span'),
        h('span.num', h('small', 'Facturado '), pesos(t.facturado)),
        h('span.num', h('small', 'Pagado '), pesos(t.pagado)),
        h(`span.num${t.diferencia > 0 ? '.debe' : t.diferencia < 0 ? '.a-favor' : ''}`, h('small', 'Diferencia '), t.diferencia ? (t.diferencia > 0 ? `+${pesos(t.diferencia)}` : `−${pesos(-t.diferencia)}`) : '—'),
        h('span'), h('span')) : null);
  }

  async function cargar() {
    campoMes.hidden = modo.value !== 'mes';
    campoAnio.hidden = modo.value !== 'anio';
    campoRango.hidden = modo.value !== 'rango';
    const n = ++consulta;
    const { desde: d, hasta: hs } = periodo();
    try {
      const r = await ctx.api.pagosLista({ desde: d, hasta: hs });
      if (n !== consulta) return; // llegó tarde: ya se pidió otro período
      lista = r;
      dibujar();
    } catch (e) {
      if (n === consulta) vaciar(tabla, h('p.error-campo', mensajeError(e)));
    }
  }
  [modo, mes, anio, desde, hasta].forEach((x) => x.addEventListener('change', cargar));
  paciente.addEventListener('input', dibujar);

  const exportar = () => {
    const filas = visibles();
    const t = totales(filas);
    const { nombre, desde: d, hasta: hs } = periodo();
    descargarExcel(`pagos-${d || 'inicio'}-a-${hs || hoy()}`, 'Pagos',
      [{ titulo: 'Fecha', ancho: 12, tipo: 'fecha' }, { titulo: 'Paciente', ancho: 30 }, { titulo: 'DNI', ancho: 12 },
        { titulo: 'Facturado', ancho: 15, tipo: 'pesos' }, { titulo: 'Pagado', ancho: 15, tipo: 'pesos' },
        { titulo: 'Diferencia (+ debe, − a favor)', ancho: 18, tipo: 'pesos' }, { titulo: 'Comentario', ancho: 40 },
        { titulo: 'Comprobante', ancho: 13 }, { titulo: 'Cargó', ancho: 20 }],
      filas.map((x) => [x.fecha, x.paciente, x.dni, x.facturado, x.pagado, redondo(x.facturado - x.pagado), x.comentario || '', x.comprobante_tipo ? 'Sí' : 'No', x.creado_por_nombre || '']),
      [`Total (${nombre}${paciente.value.trim() ? `, "${paciente.value.trim()}"` : ''})`, '', '', t.facturado, t.pagado, t.diferencia, '', '', '']);
  };

  await cargar();
  return h('div.pagos-contabilidad',
    encabezado('Pagos', 'Lo facturado y lo pagado por los pacientes. Filtrá por período o por paciente; los totales y la exportación toman lo que se ve.',
      h('button.btn.btn-secundario', { type: 'button', onclick: () => imprimirPagos(visibles(), totales(visibles()), periodo().nombre, paciente.value.trim()) }, icono('nota'), 'Imprimir'),
      h('button.btn.btn-primario', { type: 'button', onclick: exportar }, icono('subir'), 'Exportar a Excel')),
    h('section.panel',
      h('div.filtros-pagos', h('label.campo', h('span', 'Período'), modo), campoMes, campoAnio, campoRango,
        h('label.campo.campo-paciente', h('span', 'Paciente'), paciente)),
      cuenta,
      tabla));
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function imprimirPagos(filas, t, periodo, filtro) {
  const base = new URL('.', location.href).href;
  const dif = (d) => (d ? (d > 0 ? `+${pesos(d)}` : `−${pesos(-d)}`) : '—');
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><base href="${esc(base)}"><title>Pagos</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #262140; font-size: 9.5pt; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #8d8ac6; padding-bottom: 8px; margin-bottom: 10px; }
  header img { height: 44px; } h1 { font-size: 14pt; margin: 0; } header p { margin: 0; color: #5d5875; font-size: 9pt; text-align: right; }
  table { width: 100%; border-collapse: collapse; } td, th { padding: 4px 6px; border-bottom: 1px solid #e8e7f5; text-align: left; vertical-align: top; }
  th { font-size: 8.5pt; color: #5d5875; border-bottom: 1px solid #c6c4dc; } .num { text-align: right; white-space: nowrap; }
  tfoot td { font-weight: 700; border-top: 2px solid #c6c4dc; border-bottom: 0; } .sutil { color: #5d5875; }
</style></head><body>
<header><img src="assets/img/logo.png" alt=""><div><h1>Pagos · ${esc(periodo)}</h1><p>${esc(CONSULTORIO.nombre)} · impreso el ${esc(fechaCorta(new Date().toISOString()))}${filtro ? ` · paciente: "${esc(filtro)}"` : ''}</p></div></header>
<table><thead><tr><th>Fecha</th><th>Paciente</th><th>DNI</th><th class="num">Facturado</th><th class="num">Pagado</th><th class="num">Diferencia</th><th>Comentario</th></tr></thead><tbody>
${filas.map((x) => `<tr><td>${esc(fechaCorta(x.fecha))}</td><td>${esc(x.paciente)}</td><td class="sutil">${esc(x.dni)}</td><td class="num">${esc(pesos(x.facturado))}</td><td class="num">${esc(pesos(x.pagado))}</td><td class="num">${esc(dif(redondo(x.facturado - x.pagado)))}</td><td>${esc(x.comentario || '')}</td></tr>`).join('')}
</tbody><tfoot><tr><td colspan="3">Total · ${filas.length} ${filas.length === 1 ? 'pago' : 'pagos'}</td><td class="num">${esc(pesos(t.facturado))}</td><td class="num">${esc(pesos(t.pagado))}</td><td class="num">${esc(dif(t.diferencia))}</td><td></td></tr></tfoot></table>
</body></html>`;
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
