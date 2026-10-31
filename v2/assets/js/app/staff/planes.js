// Pestaña "Planes" de la ficha: planes de tratamiento con prácticas, piezas, cantidades y precios,
// agrupables por etapa. Se imprimen (o se guardan como PDF desde la ventana de impresión) con el logo,
// los datos del paciente y lugar para la firma de conformidad.
import { h, vaciar } from '../../lib/dom.js';
import { aviso, confirmar, conCarga, mensajeError } from '../../lib/ui.js';
import { fechaCorta, hoy, sumarDias, edad } from '../../lib/dates.js';
import { ICONOS } from '../iconos.js';
import { CONSULTORIO } from '../../../../config.js';
import { ESTADOS_PLAN, pesos, monto } from './registro-textos.js';

const ESTADOS = Object.entries(ESTADOS_PLAN).map(([id, texto]) => ({ id, texto }));
const DESCRIPCION_ESTADO = {
  borrador: 'Todavía en preparación; se puede borrar.',
  propuesto: 'Se le presentó al paciente.',
  aceptado: 'El paciente lo aceptó.',
  en_curso: 'El tratamiento está en marcha.',
  terminado: 'El tratamiento terminó.',
  descartado: 'No se va a realizar; queda en el historial.',
};
const icono = (n) => h('span.icono-btn', { html: ICONOS[n] });
const numero = (v) => (v === '' || v == null ? null : Number(String(v).replace(',', '.')));
const subtotalItem = (i) => (numero(i.cantidad) ?? 1) * (numero(i.precio) || 0) * (1 - Math.min(Math.max(numero(i.descuento) || 0, 0), 100) / 100);
const subtotalDe = (items) => items.reduce((s, i) => s + subtotalItem(i), 0);
/** Total como lo calcula la base: prácticas con su descuento, después % general y monto fijo */
const totalDe = (plan) => Math.max(Math.round((subtotalDe(plan.items) * (1 - (Number(plan.descuento) || 0) / 100) - (Number(plan.descuento_monto) || 0)) * 100) / 100, 0);

export async function vistaPlanes(ctx, p) {
  const raiz = h('div.planes');
  let planes = await ctx.api.planes(p.id);
  let salirSinGuardar = null;

  const lista = () => {
    window.removeEventListener('beforeunload', salirSinGuardar);
    const nuevo = h('button.btn.btn-primario', { type: 'button', onclick: () => editar(null) }, icono('mas'), 'Nuevo plan');
    const cabecera = h('div.panel-cabecera', h('div', h('h2', 'Planes de tratamiento'),
      h('p.texto-suave.nota-chica', 'Presupuestos y etapas del tratamiento. Se imprimen o se guardan como PDF.')), nuevo);
    if (!planes.length) {
      vaciar(raiz, h('section.panel', cabecera, h('div.vacio-turno', h('span.vacio-icono', { html: ICONOS.nota }),
        h('p', 'Todavía no hay planes de tratamiento para este paciente.'))));
      return;
    }
    vaciar(raiz, h('section.panel', cabecera,
      h('ul.lista-planes', planes.map((x) => h('li.tarjeta-plan',
        h('div.tarjeta-plan-principal',
          h('div', h('strong', x.titulo), h(`span.etiqueta.etiqueta-plan-${x.estado}`, ESTADOS_PLAN[x.estado])),
          h('p.texto-suave.nota-chica', [
            `Creado el ${fechaCorta(x.creado_en)}${x.creado_por_nombre ? ` por ${x.creado_por_nombre}` : ''}`,
            x.aceptado_en ? `aceptado el ${fechaCorta(x.aceptado_en)}` : null,
            x.validez && ['borrador', 'propuesto'].includes(x.estado) ? `válido hasta el ${fechaCorta(x.validez)}` : null,
            `${x.items.length} ${x.items.length === 1 ? 'práctica' : 'prácticas'}`,
          ].filter(Boolean).join(' · '))),
        h('strong.tarjeta-plan-total', pesos(x.total)),
        h('div.tarjeta-plan-acciones',
          h('button.btn.btn-secundario.btn-chico', { type: 'button', onclick: () => imprimirPlan(x, p) }, icono('nota'), 'Imprimir'),
          h('button.btn.btn-primario.btn-chico', { type: 'button', onclick: () => editar(x) }, 'Abrir')))))));
  };

  async function editar(plan) {
    // Sugerencias: la lista de precios (con su precio actual) y las prácticas escritas en otros planes
    const [listaPrecios, usadas] = await Promise.all([ctx.api.precios().catch(() => []), ctx.api.practicasUsadas().catch(() => [])]);
    const sugeridas = new Map();
    for (const x of listaPrecios) if (x.activo) sugeridas.set(x.servicio, { precio: x.precio, moneda: x.moneda, nota: x.nota });
    for (const x of usadas) if (!sugeridas.has(x.practica)) sugeridas.set(x.practica, { precio: x.precio, moneda: 'ARS', usada: true });
    const datalist = h('datalist', { id: 'practicas-sugeridas' }, [...sugeridas].map(([practica, x]) => h('option', {
      value: practica, label: x.usada ? 'Usada en otro plan' : `${monto(x.precio, x.moneda)}${x.nota ? ` · ${x.nota}` : ''}`,
    })));
    const borrador = plan
      ? { ...plan, items: plan.items.map((i) => ({ ...i })) }
      : { paciente_id: p.id, titulo: 'Plan de tratamiento', estado: 'borrador', items: [{ etapa: '', practica: '', piezas: '', cantidad: 1, precio: '', descuento: '' }], descuento: 0, descuento_monto: 0, forma_pago: '', notas: '', validez: sumarDias(hoy(), 30) };
    let cambios = false;
    const marcar = () => { cambios = true; };
    salirSinGuardar = (e) => { if (cambios) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', salirSinGuardar);
    const quitarAviso = salirSinGuardar;
    window.addEventListener('hashchange', () => window.removeEventListener('beforeunload', quitarAviso), { once: true });

    const titulo = h('input', { value: borrador.titulo, maxlength: 120, oninput: (e) => { borrador.titulo = e.target.value; marcar(); } });
    const estado = h('select', { onchange: (e) => { borrador.estado = e.target.value; ayudaEstado.textContent = DESCRIPCION_ESTADO[borrador.estado]; marcar(); } },
      ESTADOS.map((x) => h('option', { value: x.id, selected: x.id === borrador.estado }, x.texto)));
    const ayudaEstado = h('small', DESCRIPCION_ESTADO[borrador.estado]);
    const validez = h('input', { type: 'date', value: borrador.validez || '', onchange: (e) => { borrador.validez = e.target.value || null; marcar(); } });
    // Descuento general: en porcentaje o como monto fijo en pesos
    let tipoDescuento = Number(borrador.descuento_monto) > 0 ? 'monto' : 'porcentaje';
    const descuento = h('input', {
      type: 'number', min: 0, step: 'any', inputmode: 'decimal',
      value: (tipoDescuento === 'monto' ? borrador.descuento_monto : borrador.descuento) || '',
      placeholder: '0',
      oninput: () => { aplicarDescuento(); marcar(); totales(); },
    });
    const unidadDescuento = h('select', { 'aria-label': 'Tipo de descuento', onchange: (e) => { tipoDescuento = e.target.value; aplicarDescuento(); marcar(); totales(); } },
      h('option', { value: 'porcentaje', selected: tipoDescuento === 'porcentaje' }, '%'),
      h('option', { value: 'monto', selected: tipoDescuento === 'monto' }, '$'));
    function aplicarDescuento() {
      const v = Math.max(numero(descuento.value) || 0, 0);
      borrador.descuento = tipoDescuento === 'porcentaje' ? Math.min(v, 100) : 0;
      borrador.descuento_monto = tipoDescuento === 'monto' ? v : 0;
    }
    const formaPago = h('textarea', { rows: 2, placeholder: 'Por ejemplo: 30 % al comenzar y el resto en 10 cuotas mensuales. Efectivo o transferencia.', oninput: (e) => { borrador.forma_pago = e.target.value; marcar(); } }, borrador.forma_pago || '');
    const notas = h('textarea', { rows: 3, placeholder: 'Indicaciones, duración estimada, qué incluye y qué no.', oninput: (e) => { borrador.notas = e.target.value; marcar(); } }, borrador.notas || '');

    const filas = h('div.items-plan');
    const resumen = h('div.totales-plan');
    function totales() {
      const sub = subtotalDe(borrador.items);
      const pct = Number(borrador.descuento) || 0;
      const fijo = Number(borrador.descuento_monto) || 0;
      vaciar(resumen,
        pct || fijo ? [h('span', 'Subtotal'), h('span', pesos(sub))] : null,
        pct ? [h('span', `Descuento ${pct} %`), h('span', `− ${pesos(sub * pct / 100)}`)] : null,
        fijo ? [h('span', 'Descuento'), h('span', `− ${pesos(fijo)}`)] : null,
        h('strong', 'Total'), h('strong.total-plan', pesos(totalDe(borrador))));
    }
    function dibujarFilas() {
      vaciar(filas,
        h('div.item-plan.item-plan-titulos', { 'aria-hidden': 'true' }, ['Etapa', 'Práctica', 'Piezas', 'Cant.', 'Precio unitario', 'Desc. %', 'Subtotal', ''].map((t) => h('span', t))),
        borrador.items.map((it, i) => {
          const sub = h('span.item-subtotal');
          const actualizarSub = () => { sub.textContent = pesos(subtotalItem(it)); };
          const campo = (clave, attrs, etiqueta) => h('label.campo-item', h('span', etiqueta), h('input', {
            ...attrs,
            value: it[clave] ?? '',
            oninput: (e) => {
              it[clave] = e.target.value;
              marcar();
              actualizarSub();
              totales();
            },
          }));
          const practica = campo('practica', { list: 'practicas-sugeridas', placeholder: 'Práctica', 'aria-label': 'Práctica' }, 'Práctica');
          // Al elegir un servicio de la lista se completa su precio actual (se puede cambiar a mano)
          practica.querySelector('input').addEventListener('change', (e) => {
            const s = sugeridas.get(e.target.value);
            if (!s || s.precio == null) return;
            if (s.moneda === 'USD') {
              aviso(`${e.target.value} está en dólares (${monto(s.precio, 'USD')}): cargá el precio en pesos.`);
              return;
            }
            if (s.usada && it.precio !== '' && it.precio != null) return;
            it.precio = s.precio;
            fila.querySelector('input[name=precio]').value = s.precio;
            actualizarSub();
            totales();
          });
          const fila = h('div.item-plan',
            campo('etapa', { placeholder: 'Opcional', 'aria-label': 'Etapa' }, 'Etapa'),
            practica,
            campo('piezas', { placeholder: 'Ej.: 16, 21', 'aria-label': 'Piezas' }, 'Piezas'),
            campo('cantidad', { type: 'number', min: 0, step: 1, inputmode: 'numeric', 'aria-label': 'Cantidad' }, 'Cant.'),
            campo('precio', { name: 'precio', type: 'number', min: 0, step: 'any', inputmode: 'decimal', placeholder: '0', 'aria-label': 'Precio unitario' }, 'Precio unitario'),
            campo('descuento', { type: 'number', min: 0, max: 100, step: 'any', inputmode: 'decimal', placeholder: '0', 'aria-label': 'Descuento de la práctica (%)' }, 'Desc. %'),
            h('div.campo-item.item-subtotal-celda', h('span', 'Subtotal'), sub),
            h('button.btn-icono.btn-icono-peligro', {
              type: 'button', title: 'Quitar práctica', 'aria-label': 'Quitar práctica', html: ICONOS.basura,
              onclick: () => { borrador.items.splice(i, 1); marcar(); dibujarFilas(); totales(); },
            }));
          actualizarSub();
          return fila;
        }));
    }
    const agregar = h('button.btn.btn-secundario.btn-chico', {
      type: 'button',
      onclick: () => {
        const anterior = borrador.items.at(-1);
        borrador.items.push({ etapa: anterior?.etapa || '', practica: '', piezas: '', cantidad: 1, precio: '', descuento: '' });
        marcar();
        dibujarFilas();
        filas.querySelectorAll('.item-plan:not(.item-plan-titulos)').item(borrador.items.length - 1)?.querySelector('input[aria-label="Práctica"]')?.focus();
      },
    }, icono('mas'), 'Agregar práctica');

    const guardar = h('button.btn.btn-primario', { type: 'button' }, 'Guardar');
    const volver = h('button.btn.btn-secundario', {
      type: 'button',
      onclick: async () => {
        if (cambios && !(await confirmar('Los cambios sin guardar se pierden.', { titulo: 'Descartar cambios', aceptar: 'Descartar', peligro: true }))) return;
        lista();
      },
    }, 'Volver');
    const imprimir = h('button.btn.btn-secundario', {
      type: 'button',
      hidden: !plan,
      onclick: () => (cambios ? aviso('Guardá los cambios antes de imprimir.', 'error') : imprimirPlan(borrador, p)),
    }, icono('nota'), 'Imprimir');
    const borrar = h('button.btn.btn-fantasma', {
      type: 'button',
      hidden: !plan || plan.estado !== 'borrador',
      onclick: async () => {
        if (!(await confirmar(`Se borra el borrador "${plan.titulo}".`, { titulo: 'Borrar borrador', aceptar: 'Borrar', peligro: true }))) return;
        await conCarga(borrar, async () => {
          await ctx.api.borrarPlan(plan.id);
          planes = await ctx.api.planes(p.id);
          cambios = false;
          aviso('Borrador borrado.');
          lista();
        });
      },
    }, 'Borrar');
    guardar.onclick = () => conCarga(guardar, async () => {
      if (!borrador.titulo.trim()) throw new Error('Escribí un título para el plan.');
      const items = borrador.items
        .filter((i) => (i.practica || '').trim())
        .map((i) => ({
          etapa: (i.etapa || '').trim() || null,
          practica: i.practica.trim(),
          piezas: (i.piezas || '').trim() || null,
          cantidad: numero(i.cantidad) ?? 1,
          precio: numero(i.precio) || 0,
          ...(numero(i.descuento) ? { descuento: Math.min(Math.max(numero(i.descuento), 0), 100) } : {}),
        }));
      if (!items.length) throw new Error('Agregá al menos una práctica.');
      const guardado = await ctx.api.guardarPlan({ ...borrador, titulo: borrador.titulo.trim(), items });
      cambios = false;
      planes = await ctx.api.planes(p.id);
      aviso(plan ? 'Plan actualizado.' : 'Plan creado.');
      editar(planes.find((x) => x.id === guardado.id) || guardado);
    });

    dibujarFilas();
    totales();
    vaciar(raiz,
      datalist,
      h('div.barra-edicion',
        h('p', h('strong', plan ? 'Plan de tratamiento' : 'Nuevo plan'), plan ? ` · creado el ${fechaCorta(plan.creado_en)}${plan.actualizado_en ? `, modificado el ${fechaCorta(plan.actualizado_en)}` : ''}` : ''),
        h('div.barra-edicion-acciones', borrar, volver, imprimir, guardar)),
      h('section.panel',
        h('div.fila-campos.campos-plan',
          h('label.campo.campo-ancho', h('span', 'Título'), titulo),
          h('label.campo', h('span', 'Estado'), estado, ayudaEstado),
          h('label.campo', h('span', 'Válido hasta'), validez))),
      h('section.panel',
        h('div.panel-cabecera', h('h2', 'Prácticas'), agregar),
        h('p.texto-suave.nota-chica', 'Al escribir, se sugieren los servicios de la lista de precios y se completa su precio (se puede cambiar a mano). Las prácticas con la misma etapa se agrupan al imprimir; sin precio, figuran sin cargo (por ejemplo, una derivación).'),
        filas,
        h('div.pie-items-plan',
          h('div.campo.campo-descuento', h('span', 'Descuento general'), h('div.descuento-general', descuento, unidadDescuento)),
          resumen)),
      h('section.panel',
        h('label.campo', h('span', 'Forma de pago'), formaPago),
        h('label.campo', h('span', 'Notas'), notas)));
    window.scrollTo(0, 0);
  }

  lista();
  return raiz;
}

// ---------- Impresión ----------
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Arma el documento del plan y abre la ventana de impresión (desde ahí también se guarda como PDF). */
export function imprimirPlan(plan, p) {
  const base = new URL('.', location.href).href;
  const grupos = [];
  for (const i of plan.items) {
    const etapa = i.etapa || '';
    if (!grupos.length || grupos.at(-1).etapa !== etapa) grupos.push({ etapa, items: [] });
    grupos.at(-1).items.push(i);
  }
  const sub = subtotalDe(plan.items);
  const pct = Number(plan.descuento) || 0;
  const fijo = Number(plan.descuento_monto) || 0;
  const conEtapas = grupos.some((g) => g.etapa);
  const conDescuento = plan.items.some((i) => Number(i.descuento) > 0);
  const columnas = conDescuento ? 6 : 5;
  const precioTexto = (i) => {
    const pr = Number(i.precio) || 0;
    if (!pr) return '—';
    return `${pesos(pr)}${Number(i.cantidad ?? 1) > 1 ? ' c/u' : ''}`;
  };
  const filas = grupos.map((g) => `
      ${conEtapas ? `<tr class="etapa"><td colspan="${columnas}">${esc(g.etapa || 'Otras prácticas')}</td></tr>` : ''}
      ${g.items.map((i) => `<tr>
        <td>${esc(i.practica)}</td><td>${esc(i.piezas || '')}</td><td class="num">${esc(i.cantidad ?? 1)}</td>
        <td class="num">${precioTexto(i)}</td>${conDescuento ? `<td class="num">${Number(i.descuento) > 0 ? `${esc(i.descuento)} %` : ''}</td>` : ''}
        <td class="num">${Number(i.precio) ? pesos(subtotalItem(i)) : 'Sin cargo'}</td></tr>`).join('')}`).join('');
  const anios = p.fecha_nac ? edad(p.fecha_nac) : null;
  const fecha = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><base href="${esc(base)}">
<title>${esc(`${plan.titulo} - ${p.apellido}, ${p.nombre}`)}</title>
<style>
  @page { size: A4; margin: 16mm 16mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #262140; font-size: 10.5pt; line-height: 1.45; margin: 0; }
  header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; border-bottom: 2px solid #8d8ac6; padding-bottom: 10px; }
  header img { height: 58px; }
  .consultorio { text-align: right; font-size: 9pt; color: #5d5875; }
  .consultorio strong { color: #262140; font-size: 10.5pt; }
  h1 { font-size: 16pt; margin: 18px 0 0; letter-spacing: 0.02em; }
  .validez-titulo { margin: 2px 0 2px; font-weight: 600; color: #4b4796; font-size: 9.5pt; text-transform: uppercase; letter-spacing: 0.04em; }
  .sub { color: #5d5875; margin: 0 0 14px; font-size: 9.5pt; }
  .paciente { display: grid; grid-template-columns: repeat(3, auto); gap: 4px 24px; justify-content: start; background: #f0eff9; border-radius: 6px; padding: 8px 12px; margin-bottom: 8px; }
  .paciente span { color: #5d5875; font-size: 8.5pt; display: block; }
  h2 { font-size: 11.5pt; margin: 14px 0 6px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 8.5pt; color: #5d5875; border-bottom: 1px solid #c6c4dc; padding: 5px 6px; font-weight: 600; }
  td { padding: 6px; border-bottom: 1px solid #e8e7f5; vertical-align: top; }
  .num { text-align: right; white-space: nowrap; }
  tr.etapa td { font-weight: 700; background: #f5f5fa; border-bottom: 1px solid #c6c4dc; padding-top: 8px; text-transform: uppercase; font-size: 9.5pt; letter-spacing: 0.03em; }
  .totales { margin: 10px 0 0 auto; width: 280px; display: grid; grid-template-columns: 1fr auto; gap: 3px 16px; }
  .totales .total { font-size: 13pt; font-weight: 700; border-top: 1px solid #262140; padding-top: 4px; }
  h3 { font-size: 10.5pt; margin: 16px 0 4px; }
  .texto { white-space: pre-wrap; margin: 0; }
  .firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 56px; page-break-inside: avoid; }
  .firmas div { border-top: 1px solid #262140; padding-top: 4px; font-size: 9pt; text-align: center; }
  .conformidad { margin-top: 26px; font-size: 9pt; page-break-inside: avoid; }
  footer { margin-top: 28px; font-size: 8pt; color: #8a86a0; text-align: center; }
</style></head><body>
<header>
  <img src="assets/img/logo.png" alt="${esc(CONSULTORIO.nombre)}">
  <div class="consultorio"><strong>${esc(CONSULTORIO.profesional)}</strong><br>${esc(CONSULTORIO.especialidad || '')}${CONSULTORIO.matricula ? ` · ${esc(CONSULTORIO.matricula)}` : ''}<br>
  ${esc(CONSULTORIO.direccion)}<br>Tel. ${esc(CONSULTORIO.telefono)} · ${esc(CONSULTORIO.email)}</div>
</header>
<h1>PLAN DE TRATAMIENTO — PRESUPUESTO</h1>
${plan.validez ? `<p class="validez-titulo">Válido hasta el ${esc(fechaCorta(plan.validez))} para congelar precios</p>` : ''}
<p class="sub">${esc(fecha)} · Fichado, historia clínica, diagnóstico y plan de tratamiento</p>
<div class="paciente">
  <div><span>Paciente</span>${esc(`${p.apellido}, ${p.nombre}`)}</div>
  <div><span>DNI</span>${esc(p.dni)}</div>
  <div><span>${anios != null ? 'Edad' : 'Teléfono'}</span>${esc(anios != null ? `${anios} años` : p.telefono || '')}</div>
</div>
${plan.titulo && plan.titulo !== 'Plan de tratamiento' ? `<h2>${esc(plan.titulo)}</h2>` : ''}
<table>
  <thead><tr><th>Práctica</th><th>Piezas</th><th class="num">Cant.</th><th class="num">Precio</th>${conDescuento ? '<th class="num">Desc.</th>' : ''}<th class="num">Subtotal</th></tr></thead>
  <tbody>${filas}</tbody>
</table>
<div class="totales">
  ${pct || fijo ? `<span>Subtotal</span><span class="num">${pesos(sub)}</span>` : ''}
  ${pct ? `<span>Descuento ${esc(pct)} %</span><span class="num">− ${pesos(sub * pct / 100)}</span>` : ''}
  ${fijo ? `<span>Descuento</span><span class="num">− ${pesos(fijo)}</span>` : ''}
  <span class="total">Total</span><span class="total num">${pesos(plan.total ?? totalDe(plan))}</span>
</div>
${plan.forma_pago ? `<h3>Forma de pago</h3><p class="texto">${esc(plan.forma_pago)}</p>` : ''}
${plan.notas ? `<h3>Observaciones</h3><p class="texto">${esc(plan.notas)}</p>` : ''}
<p class="conformidad">Declaro haber recibido la explicación del plan de tratamiento propuesto, sus etapas y su costo, y doy mi conformidad.</p>
<div class="firmas"><div>Firma y aclaración del paciente (o responsable)</div><div>${esc(CONSULTORIO.profesional)}</div></div>
<footer>${esc(CONSULTORIO.nombre)} · ${esc(CONSULTORIO.direccion)} · ${esc(CONSULTORIO.telefono)}</footer>
</body></html>`;

  const marco = h('iframe.marco-impresion', { title: 'Impresión del plan', 'aria-hidden': 'true' });
  document.body.append(marco);
  const doc = marco.contentDocument;
  doc.open();
  doc.write(html);
  doc.close();
  const imprimir = () => {
    try {
      marco.contentWindow.focus();
      marco.contentWindow.print();
    } catch (e) {
      aviso(mensajeError(e), 'error');
    }
    setTimeout(() => marco.remove(), 60_000);
  };
  const logo = doc.querySelector('img');
  if (logo.complete) setTimeout(imprimir, 50);
  else {
    logo.addEventListener('load', imprimir, { once: true });
    logo.addEventListener('error', imprimir, { once: true });
  }
}
