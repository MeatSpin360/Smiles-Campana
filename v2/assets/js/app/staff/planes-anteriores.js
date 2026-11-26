// Pestaña "Planes" de la ficha → "Planes anteriores": los planes de tratamiento hechos antes del sistema, que se
// suben desde un Word (.docx) o un PDF. El texto pasa a la página (lib/texto-rico.js) y se edita ahí; el archivo
// original no se guarda. Se imprimen con el mismo encabezado que los planes y se pueden mostrar al paciente.
import { h, vaciar } from '../../lib/dom.js';
import { aviso, confirmar, conCarga, mensajeError } from '../../lib/ui.js';
import { fechaCorta } from '../../lib/dates.js';
import { convertirArchivo, contenidoRico, editorRico, textoDe } from '../../lib/texto-rico.js';
import { ICONOS } from '../iconos.js';
import { imprimirDocumento } from './planes.js';

const icono = (n) => h('span.icono-btn', { html: ICONOS[n] });
const TIPOS = '.docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * mostrar(...elementos): reemplaza el contenido de la pestaña (para el editor).
 * volver(): vuelve a la lista de planes.
 * Devuelve { panel() } para dibujar la sección debajo de los planes.
 */
export async function panelPlanesAnteriores({ ctx, p, mostrar, volver }) {
  let planes = await ctx.api.planesAnteriores(p.id).catch(() => []);
  const recargar = async () => { planes = await ctx.api.planesAnteriores(p.id); };
  const imprimir = (x) => imprimirDocumento({
    titulo: x.titulo, html: x.contenido, p,
    subtitulo: `Plan de tratamiento anterior${x.archivo_nombre ? ` (${x.archivo_nombre})` : ''}`,
  });

  const subir = async (archivo, boton) => {
    if (!archivo) return;
    boton.disabled = true;
    boton.classList.add('cargando');
    try {
      const { titulo, html } = await convertirArchivo(archivo);
      editar({ paciente_id: p.id, titulo, contenido: html, archivo_nombre: archivo.name, visible_paciente: false });
    } catch (e) {
      aviso(mensajeError(e), 'error');
    } finally {
      boton.disabled = false;
      boton.classList.remove('cargando');
    }
  };

  function panel() {
    const entrada = h('input', { type: 'file', accept: TIPOS, hidden: true });
    const boton = h('button.btn.btn-secundario', { type: 'button', onclick: () => entrada.click() }, icono('subir'), 'Subir plan anterior');
    entrada.onchange = () => { const f = entrada.files[0]; entrada.value = ''; subir(f, boton); };
    return h('section.panel.panel-planes-anteriores',
      h('div.panel-cabecera',
        h('div', h('h2', 'Planes anteriores'),
          h('p.texto-suave.nota-chica', 'Planes hechos antes de este sistema. Subí el Word (.docx) o el PDF: el texto pasa a la página y se edita acá.')),
        boton, entrada),
      planes.length
        ? h('ul.lista-planes', planes.map((x) => h('li.tarjeta-plan',
          h('div.tarjeta-plan-principal',
            h('div', h('strong', x.titulo), x.visible_paciente ? h('span.etiqueta.etiqueta-visible', 'Visible para el paciente') : null,
              x.editado_en ? h('span.marca-editado', { title: `Editado el ${fechaCorta(x.editado_en)}${x.editado_por_nombre ? ` por ${x.editado_por_nombre}` : ''}` }, 'Editado') : null),
            h('p.texto-suave.nota-chica', [
              `Subido el ${fechaCorta(x.creado_en)}${x.creado_por_nombre ? ` por ${x.creado_por_nombre}` : ''}`,
              x.archivo_nombre ? `desde ${x.archivo_nombre}` : null,
            ].filter(Boolean).join(' · '))),
          h('div.tarjeta-plan-acciones',
            h('button.btn.btn-secundario.btn-chico', { type: 'button', onclick: () => imprimir(x) }, icono('nota'), 'Imprimir'),
            h('button.btn.btn-primario.btn-chico', { type: 'button', onclick: () => editar(x) }, 'Abrir')))))
        : h('p.texto-suave.nota-chica', 'No hay planes anteriores cargados.'));
  }

  function editar(plan) {
    const nuevo = !plan.id;
    let cambios = nuevo;
    const marcar = () => { cambios = true; };
    const salirSinGuardar = (e) => { if (cambios) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', salirSinGuardar);
    window.addEventListener('hashchange', () => window.removeEventListener('beforeunload', salirSinGuardar), { once: true });
    const salir = () => { window.removeEventListener('beforeunload', salirSinGuardar); volver(); };

    const titulo = h('input', { value: plan.titulo, maxlength: 120, oninput: marcar });
    const visible = h('input', { type: 'checkbox', checked: !!plan.visible_paciente, onchange: marcar });
    const editor = editorRico({ html: plan.contenido, etiqueta: 'Contenido del plan', alCambiar: marcar, placeholder: 'Texto del plan de tratamiento' });

    const guardar = h('button.btn.btn-primario', { type: 'button' }, nuevo ? 'Guardar plan' : 'Guardar');
    const volverBtn = h('button.btn.btn-secundario', {
      type: 'button',
      onclick: async () => {
        if (cambios && !(await confirmar(nuevo ? 'El plan no se guardó: se descarta.' : 'Los cambios sin guardar se pierden.', { titulo: 'Descartar cambios', aceptar: 'Descartar', peligro: true }))) return;
        salir();
      },
    }, 'Volver');
    const imprimirBtn = h('button.btn.btn-secundario', {
      type: 'button',
      hidden: nuevo,
      onclick: () => (cambios ? aviso('Guardá los cambios antes de imprimir.', 'error') : imprimir(plan)),
    }, icono('nota'), 'Imprimir');
    const borrar = h('button.btn.btn-fantasma', {
      type: 'button',
      hidden: nuevo,
      onclick: async () => {
        if (!(await confirmar(`Se borra "${plan.titulo}". No se puede deshacer (el Word o PDF original sigue en tu computadora).`, { titulo: 'Borrar plan anterior', aceptar: 'Borrar', peligro: true }))) return;
        await conCarga(borrar, async () => {
          await ctx.api.borrarPlanAnterior(plan.id);
          await recargar();
          cambios = false;
          aviso('Plan anterior borrado.');
          salir();
        });
      },
    }, 'Borrar');
    guardar.onclick = () => conCarga(guardar, async () => {
      if (!titulo.value.trim()) throw new Error('Escribí un título para el plan.');
      if (editor.vacio()) throw new Error('El plan está vacío.');
      const guardado = await ctx.api.guardarPlanAnterior({ ...plan, titulo: titulo.value.trim(), contenido: editor.valor(), visible_paciente: visible.checked });
      cambios = false;
      await recargar();
      aviso(nuevo ? 'Plan anterior guardado.' : 'Plan anterior actualizado.');
      window.removeEventListener('beforeunload', salirSinGuardar);
      editar(planes.find((x) => x.id === guardado.id) || guardado);
    });

    const detalle = nuevo
      ? ` · desde ${plan.archivo_nombre}. Revisá el texto: los logos, colores y tipos de letra no se copian.`
      : ` · subido el ${fechaCorta(plan.creado_en)}${plan.editado_en ? `, editado el ${fechaCorta(plan.editado_en)}${plan.editado_por_nombre ? ` por ${plan.editado_por_nombre}` : ''}` : ''}`;
    mostrar(
      h('div.barra-edicion',
        h('p', h('strong', nuevo ? 'Nuevo plan anterior' : 'Plan anterior'), detalle),
        h('div.barra-edicion-acciones', borrar, volverBtn, imprimirBtn, guardar)),
      h('section.panel',
        h('label.campo', h('span', 'Título'), titulo),
        h('label.check-visible', visible, h('span', h('strong', 'Visible para el paciente'), ' · lo ve en Mi espacio → Mi plan (solo ver).')),
        h('div.campo', h('span', 'Contenido'), editor.el)));
    window.scrollTo(0, 0);
    if (nuevo && !textoDe(plan.contenido)) editor.enfocar();
  }

  return { panel };
}
