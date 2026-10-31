// Documentos del paciente (contrato, indicaciones...) generados desde plantillas, y el editor de plantillas
// del Panel. El texto de cada documento queda guardado tal como se imprimió.
import { h, vaciar } from '../../lib/dom.js';
import { aviso, confirmar, conCarga, hoja, mensajeError } from '../../lib/ui.js';
import { fechaCorta, hoy } from '../../lib/dates.js';
import { prepararComprobante, MAX_DOCUMENTO } from '../../lib/imagenes.js';
import { CAMPOS_AUTO, ESTILOS_DOCUMENTO, aHtml, camposPropios, etiquetaCampo, fechaDocumento, imprimirDocumento, rellenar, valoresAuto } from '../../lib/plantillas.js';
import { encabezado } from '../comunes.js';
import { ICONOS } from '../iconos.js';

const icono = (n) => h('span.icono-btn', { html: ICONOS[n] });
// La vista previa usa los mismos estilos que la impresión
if (!document.getElementById('estilos-documento')) document.head.append(h('style#estilos-documento', ESTILOS_DOCUMENTO));
const nombreDe = (p) => `${p.apellido}, ${p.nombre}`;
const usados = (contenido) => new Set([...String(contenido).matchAll(/\{\{\s*([a-z0-9_áéíóúñ]+)\s*\}\}/gi)].map((m) => m[1].toLowerCase()));
// Datos del paciente que se pueden corregir al generar (y guardar en la ficha)
const DE_LA_FICHA = { domicilio: 'direccion', responsable: 'responsable_nombre', responsable_dni: 'responsable_dni' };

async function abrirArchivo(api, doc, boton) {
  const ventana = window.open('', '_blank'); // antes de esperar, para que el navegador no la bloquee
  await conCarga(boton, async () => {
    try {
      const url = await api.urlCopiaFirmada(doc.id);
      if (ventana) ventana.location.href = url;
      else location.assign(url);
    } catch (e) {
      ventana?.close();
      throw e;
    }
  });
}

// ---------- Generar un documento ----------
function generar(ctx, p, plantillas, anteriores) {
  return new Promise((resolve) => {
    let creado = false;
    const activas = plantillas.filter((t) => t.activa);
    const elegir = h('select', { 'aria-label': 'Plantilla' }, activas.map((t) => h('option', { value: t.id }, t.nombre)));
    const campos = h('div.campos-documento');
    const vista = h('div.doc.vista-documento');
    const guardarFicha = h('input', { type: 'checkbox', checked: true });
    const avisoFicha = h('label.interruptor-texto.guardar-en-ficha', { hidden: true }, guardarFicha, h('span', 'Guardar también estos datos en la ficha del paciente'));
    let entradas = {};

    const plantilla = () => activas.find((t) => t.id === elegir.value);
    const valores = () => {
      const v = { ...valoresAuto(p) };
      for (const [k, input] of Object.entries(entradas)) {
        v[k] = k === 'fecha' ? (input.value ? fechaDocumento(new Date(`${input.value}T12:00:00`)) : '') : input.value.trim();
        if (k.endsWith('dni')) v[k] = v[k].replace(/\D/g, '');
      }
      return v;
    };
    const actualizar = () => {
      const t = plantilla();
      vista.innerHTML = t ? aHtml(rellenar(t.contenido, valores())) : '';
      avisoFicha.hidden = !Object.entries(DE_LA_FICHA).some(([k, c]) => entradas[k] && entradas[k].value.trim() !== (p[c] || ''));
    };
    const dibujarCampos = () => {
      const t = plantilla();
      entradas = {};
      if (!t) { vaciar(campos, h('p.vacio', 'No hay plantillas activas. El admin las agrega desde Panel → Plantillas.')); return; }
      const enUso = usados(t.contenido);
      const auto = valoresAuto(p);
      // Lo que viene de la ficha se puede corregir; lo propio de la plantilla se sugiere del documento anterior
      const previo = anteriores.find((d) => d.plantilla_id === t.id)?.datos || {};
      const filas = [];
      for (const c of CAMPOS_AUTO) {
        if (!enUso.has(c.id) || ['profesional', 'matricula', 'consultorio'].includes(c.id)) continue;
        const input = c.id === 'fecha'
          ? h('input', { type: 'date', value: hoy() })
          : h('input', { value: auto[c.id] || '', inputmode: c.id.endsWith('dni') ? 'numeric' : null, autocomplete: 'off' });
        entradas[c.id] = input;
        filas.push(h('label.campo', h('span', c.texto), input));
      }
      for (const id of camposPropios(t.contenido)) {
        const input = h('input', { value: previo[id] || '', autocomplete: 'off' });
        entradas[id] = input;
        filas.push(h('label.campo', h('span', etiquetaCampo(id)), input));
      }
      vaciar(campos, filas.length ? h('div.fila-campos', filas) : h('p.texto-suave.nota-chica', 'Esta plantilla no tiene datos para completar.'),
        h('p.texto-suave.nota-chica', 'Lo que quede vacío se imprime como una línea para completar a mano.'));
      for (const i of Object.values(entradas)) i.addEventListener('input', actualizar);
      actualizar();
    };
    elegir.addEventListener('change', dibujarCampos);

    const guardar = h('button.btn.btn-primario', { type: 'button', disabled: !activas.length }, icono('nota'), 'Guardar e imprimir');
    const { cerrar } = hoja({
      titulo: 'Nuevo documento',
      ancho: 'ancho',
      cuerpo: h('div.generar-documento',
        h('div.generar-datos', h('label.campo', h('span', 'Plantilla'), elegir), campos, avisoFicha),
        h('div.generar-vista', h('span.texto-suave.nota-chica', 'Vista previa'), vista)),
      pie: [guardar],
      alCerrar: () => resolve(creado),
    });
    dibujarCampos();

    guardar.onclick = () => conCarga(guardar, async () => {
      const t = plantilla();
      const v = valores();
      const datos = Object.fromEntries(Object.keys(entradas).map((k) => [k, k === 'fecha' ? entradas.fecha.value : v[k]]));
      if (datos.responsable_dni) datos.responsable_dni = datos.responsable_dni.replace(/\D/g, '');
      if (datos.responsable_dni && !/^\d{6,9}$/.test(datos.responsable_dni)) throw new Error('Revisá el DNI del responsable: solo números, sin puntos.');
      const contenido = rellenar(t.contenido, v);
      const doc = await ctx.api.crearDocumento({ paciente_id: p.id, plantilla_id: t.id, titulo: t.nombre, contenido, datos });
      creado = true;
      if (!avisoFicha.hidden && guardarFicha.checked) {
        const cambios = {};
        for (const [k, c] of Object.entries(DE_LA_FICHA)) if (k in datos && (datos[k] || '') !== (p[c] || '')) cambios[c] = datos[k];
        if (Object.keys(cambios).length) {
          try { await ctx.api.actualizarPaciente(p.id, cambios); } catch (e) { aviso(`El documento se guardó, pero la ficha no: ${mensajeError(e)}`, 'error'); }
        }
      }
      cerrar();
      imprimirDocumento({ titulo: doc.titulo, contenido: doc.contenido, paciente: nombreDe(p) });
      aviso('Documento guardado.');
    });
  });
}

// ---------- Pestaña "Documentos" de la ficha ----------
export async function vistaDocumentos(ctx, p) {
  const [documentos, plantillas] = await Promise.all([ctx.api.documentos(p.id), ctx.api.plantillas()]);
  const recargar = () => ctx.navegar(`/pacientes/${p.id}/documentos`);
  const admin = ctx.rol === 'admin';

  const nuevo = h('button.btn.btn-primario', {
    type: 'button',
    onclick: async () => { if (await generar(ctx, p, plantillas, documentos)) recargar(); },
  }, icono('mas'), 'Nuevo documento');

  const fila = (d) => {
    const elegir = h('input', { type: 'file', accept: 'image/*,application/pdf,.pdf', hidden: true });
    const accion = (texto, fn, clase = 'btn-secundario', icon = null) => {
      const b = h(`button.btn.btn-chico.${clase}`, { type: 'button' }, icon ? icono(icon) : null, texto);
      b.onclick = () => fn(b);
      return b;
    };
    elegir.addEventListener('change', async () => {
      const f = elegir.files[0];
      if (!f) return;
      const b = adjuntar;
      await conCarga(b, async () => {
        await prepararComprobante(f, { maxPdf: MAX_DOCUMENTO }); // avisa antes de subir si no sirve
        await ctx.api.subirCopiaFirmada(d.id, f);
        aviso('Copia firmada guardada.');
        recargar();
      });
      elegir.value = '';
    });
    const adjuntar = accion(d.archivo_tipo ? 'Reemplazar copia' : 'Adjuntar copia firmada', () => elegir.click(), d.archivo_tipo ? 'btn-fantasma' : 'btn-secundario', 'subir');
    const acciones = [
      accion('Imprimir', () => imprimirDocumento({ titulo: d.titulo, contenido: d.contenido, paciente: nombreDe(p) }), 'btn-secundario', 'nota'),
      d.archivo_tipo ? accion('Ver copia firmada', (b) => abrirArchivo(ctx.api, d, b), 'btn-secundario') : null,
      adjuntar,
      !d.firmado ? accion('Marcar firmado', (b) => conCarga(b, async () => { await ctx.api.marcarFirmado(d.id, true); aviso('Marcado como firmado.'); recargar(); })) : null,
      d.firmado && !d.archivo_tipo ? accion('Quitar firma', (b) => conCarga(b, async () => { await ctx.api.marcarFirmado(d.id, false); recargar(); }), 'btn-fantasma') : null,
      d.archivo_tipo ? accion('Quitar copia', async (b) => {
        if (!(await confirmar('Se borra el archivo de la copia firmada. El documento sigue marcado como firmado.', { titulo: 'Quitar copia firmada', aceptar: 'Quitar', peligro: true }))) return;
        await conCarga(b, async () => { await ctx.api.quitarCopiaFirmada(d.id); recargar(); });
      }, 'btn-fantasma') : null,
      !d.firmado || admin ? accion('Borrar', async (b) => {
        if (!(await confirmar(`Se borra "${d.titulo}" del ${fechaCorta(d.creado_en)}${d.archivo_tipo ? ' con su copia firmada' : ''}. Queda anotado en el registro.`, { titulo: 'Borrar documento', aceptar: 'Borrar', peligro: true }))) return;
        await conCarga(b, async () => { await ctx.api.borrarDocumento(d.id); aviso('Documento borrado.'); recargar(); });
      }, 'btn-fantasma', 'basura') : null,
    ];
    return h('li.fila-documento',
      h('div.documento-datos',
        h('strong', d.titulo),
        h('span.texto-suave.nota-chica', `Generado el ${fechaCorta(d.creado_en)}${d.creado_por_nombre ? ` por ${d.creado_por_nombre}` : ''}`),
        d.firmado
          ? h('span.etiqueta.etiqueta-firmado', `Firmado${d.firmado_en ? ` el ${fechaCorta(d.firmado_en)}` : ''}${d.archivo_tipo ? ' · copia guardada' : ''}`)
          : h('span.etiqueta.etiqueta-pendiente', 'Pendiente de firma')),
      h('div.documento-acciones', acciones, elegir));
  };

  return h('div.vista-documentos',
    h('section.panel',
      h('div.cabecera-seccion', h('h2', 'Documentos'), nuevo),
      h('p.texto-suave.nota-chica', 'Contratos e indicaciones con los datos del paciente. Después de firmado, adjuntá una foto o escaneo (PDF de hasta 3 MB).'),
      documentos.length ? h('ul.lista-documentos', documentos.map(fila)) : h('p.vacio', 'Todavía no hay documentos.')));
}

// ---------- Panel → Plantillas (admin) ----------
export async function plantillasPanel(ctx) {
  let lista = await ctx.api.plantillas();
  const contenedor = h('div.plantillas-panel');

  const dibujarLista = () => vaciar(contenedor,
    encabezado('Plantillas de documentos', 'Los textos que se completan con los datos del paciente. Los cambios valen para los documentos nuevos; los ya generados no cambian.',
      h('button.btn.btn-primario', { type: 'button', onclick: () => editar(null) }, icono('mas'), 'Nueva plantilla')),
    h('section.panel', lista.length ? h('ul.lista-plantillas', lista.map((t) => h('li',
      h('button.fila-plantilla', { type: 'button', onclick: () => editar(t) },
        h('strong', t.nombre),
        h('span.texto-suave.nota-chica', t.actualizado_en ? `Modificada el ${fechaCorta(t.actualizado_en)}${t.actualizado_por_nombre ? ` por ${t.actualizado_por_nombre}` : ''}` : 'Texto inicial'),
        t.activa ? null : h('span.etiqueta', 'Desactivada'))))) : h('p.vacio', 'No hay plantillas.')));

  function editar(t) {
    const nombre = h('input', { value: t?.nombre || '', maxlength: 120, 'aria-label': 'Nombre' });
    const activa = h('input', { type: 'checkbox', checked: t ? t.activa : true });
    const texto = h('textarea.texto-plantilla', { spellcheck: true, 'aria-label': 'Texto de la plantilla' });
    texto.value = t?.contenido || '# TÍTULO\n\nTexto del documento. Usá los botones para agregar datos del paciente.\n\n1. Primera cláusula.\n1. Segunda cláusula.\n';
    const vista = h('div.doc.vista-documento');
    const ejemplo = { nombre: 'Ana', apellido: 'García', dni: '30123456', direccion: 'Calle 123, Campana', responsable_nombre: '', responsable_dni: '' };
    const conEjemplo = h('input', { type: 'checkbox' });
    const actualizar = () => {
      vista.innerHTML = aHtml(conEjemplo.checked ? rellenar(texto.value, Object.fromEntries(camposPropios(texto.value).map((c) => [c, '…']).concat(Object.entries(valoresAuto(ejemplo))))) : texto.value);
    };
    texto.addEventListener('input', actualizar);
    conEjemplo.addEventListener('change', actualizar);
    const insertar = (s) => {
      const a = texto.selectionStart ?? texto.value.length;
      const b = texto.selectionEnd ?? a;
      texto.setRangeText(s, a, b, 'end');
      texto.focus();
      actualizar();
    };
    const propio = h('input', { placeholder: 'Por ejemplo: controles mensuales', 'aria-label': 'Nombre del dato a completar', maxlength: 40 });
    const agregarPropio = () => {
      const id = propio.value.trim().toLowerCase().normalize('NFC').replace(/[^a-z0-9áéíóúñ]+/g, '_').replace(/^_|_$/g, '');
      if (!id) return;
      insertar(`{{${id}}}`);
      propio.value = '';
    };
    propio.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); agregarPropio(); } });

    const guardar = h('button.btn.btn-primario', { type: 'button' }, 'Guardar plantilla');
    const volver = h('button.btn.btn-secundario', { type: 'button', onclick: dibujarLista }, 'Volver');
    const borrar = t ? h('button.btn.btn-fantasma.btn-peligro-texto', { type: 'button' }, icono('basura'), 'Borrar') : null;
    guardar.onclick = () => conCarga(guardar, async () => {
      if (!nombre.value.trim()) throw new Error('Escribí el nombre de la plantilla.');
      if (!texto.value.trim()) throw new Error('La plantilla no tiene texto.');
      const r = await ctx.api.guardarPlantilla({ id: t?.id, nombre: nombre.value, contenido: texto.value, activa: activa.checked, orden: lista.length });
      lista = lista.filter((x) => x.id !== r.id).concat(r).sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre));
      aviso('Plantilla guardada.');
      dibujarLista();
    });
    if (borrar) {
      borrar.onclick = async () => {
        if (!(await confirmar(`Se borra la plantilla "${t.nombre}". Los documentos ya generados con ella no cambian. Si solo dejó de usarse, conviene desactivarla.`, { titulo: 'Borrar plantilla', aceptar: 'Borrar', peligro: true }))) return;
        await conCarga(borrar, async () => {
          await ctx.api.borrarPlantilla(t.id);
          lista = lista.filter((x) => x.id !== t.id);
          aviso('Plantilla borrada.');
          dibujarLista();
        });
      };
    }

    vaciar(contenedor,
      encabezado(t ? 'Editar plantilla' : 'Nueva plantilla', null, volver),
      h('section.panel.editor-plantilla',
        h('div.editor-plantilla-texto',
          h('div.fila-campos', h('label.campo', h('span', 'Nombre'), nombre)),
          h('label.interruptor-texto', activa, h('span', 'Activa (aparece al generar documentos)')),
          h('div.campo',
            h('span', 'Agregar un dato del paciente o del consultorio'),
            h('div.botones-campos', CAMPOS_AUTO.map((c) => h('button.btn.btn-chico.btn-secundario', { type: 'button', onclick: () => insertar(`{{${c.id}}}`) }, c.texto)))),
          h('div.campo',
            h('span', 'O un dato que se completa al generar'),
            h('div.agregar-campo', propio, h('button.btn.btn-chico.btn-secundario', { type: 'button', onclick: agregarPropio }, 'Agregar'))),
          h('label.campo', h('span', 'Texto'), texto),
          h('details.ayuda-formato',
            h('summary', 'Cómo dar formato'),
            h('ul',
              h('li', h('code', '# '), 'al principio de un renglón: título'),
              h('li', h('code', '1. '), 'cláusula numerada (todas con "1.": se numeran solas)'),
              h('li', h('code', '- '), 'viñeta (con dos espacios adelante, queda dentro de la cláusula anterior)'),
              h('li', h('code', '**texto**'), ' negrita · ', h('code', '____'), ' línea para completar a mano'),
              h('li', 'Una línea en blanco separa los párrafos.'))),
          t?.actualizado_en ? h('p.texto-suave.nota-chica', `Última modificación: ${fechaCorta(t.actualizado_en)}${t.actualizado_por_nombre ? ` por ${t.actualizado_por_nombre}` : ''}.`) : null,
          h('div.acciones-form', borrar, guardar)),
        h('div.editor-plantilla-vista',
          h('div.cabecera-vista', h('span.texto-suave.nota-chica', 'Vista previa'), h('label.interruptor-texto', conEjemplo, h('span', 'Con datos de ejemplo'))),
          vista)));
    actualizar();
    setTimeout(() => (t ? texto : nombre).focus(), 30);
  }

  dibujarLista();
  return contenedor;
}
