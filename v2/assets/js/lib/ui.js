import { h } from './dom.js';

let zonaAvisos;
/** Aviso breve en la parte inferior. tipo: 'ok' | 'error' */
export function aviso(texto, tipo = 'ok') {
  zonaAvisos ??= document.body.appendChild(h('div.avisos', { role: 'status', 'aria-live': 'polite' }));
  const el = h(`div.aviso.aviso-${tipo}`, texto);
  zonaAvisos.append(el);
  setTimeout(() => el.classList.add('saliendo'), 3200);
  setTimeout(() => el.remove(), 3600);
}

/**
 * Panel modal. En celulares aparece como hoja desde abajo.
 * Devuelve { dialog, cerrar }. cuerpo y pie pueden ser nodos o arrays.
 */
export function hoja({ titulo, cuerpo, pie, ancho = 'normal', alCerrar }) {
  const cerrarBtn = h('button.btn-icono', { type: 'button', 'aria-label': 'Cerrar', html: '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' });
  const dialog = h(`dialog.hoja.hoja-${ancho}`,
    h('div.hoja-cabecera', h('h2', titulo), cerrarBtn),
    h('div.hoja-cuerpo', cuerpo),
    pie ? h('div.hoja-pie', pie) : null);
  document.body.append(dialog);
  const cerrar = () => {
    dialog.close();
  };
  cerrarBtn.addEventListener('click', cerrar);
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) cerrar();
  });
  dialog.addEventListener('close', () => {
    dialog.remove();
    alCerrar?.();
  });
  dialog.showModal();
  return { dialog, cerrar };
}

export function confirmar(texto, { titulo = '¿Confirmás?', aceptar = 'Confirmar', peligro = false } = {}) {
  return new Promise((resolve) => {
    let ok = false;
    const btnNo = h('button.btn.btn-secundario', { type: 'button' }, 'Volver');
    const btnSi = h(`button.btn${peligro ? '.btn-peligro' : '.btn-primario'}`, { type: 'button' }, aceptar);
    const { cerrar } = hoja({ titulo, cuerpo: h('p', texto), pie: [btnNo, btnSi], ancho: 'chico', alCerrar: () => resolve(ok) });
    btnNo.onclick = cerrar;
    btnSi.onclick = () => {
      ok = true;
      cerrar();
    };
  });
}

/** Ejecuta una acción async deshabilitando el botón y mostrando errores. */
export async function conCarga(boton, fn) {
  const texto = boton?.textContent;
  if (boton) {
    boton.disabled = true;
    boton.classList.add('cargando');
  }
  try {
    return await fn();
  } catch (e) {
    console.error(e);
    aviso(mensajeError(e), 'error');
    return undefined;
  } finally {
    if (boton) {
      boton.disabled = false;
      boton.classList.remove('cargando');
      boton.textContent = texto;
    }
  }
}

export function mensajeError(e) {
  const m = e?.message || String(e);
  if (/Invalid login credentials/i.test(m)) return 'El email o la clave no son correctos.';
  if (/Email not confirmed/i.test(m)) return 'Todavía no confirmaste tu email. Revisá tu casilla.';
  if (/already registered|already been registered/i.test(m)) return 'Ya existe una cuenta con ese email.';
  if (/Password should be/i.test(m)) return 'La clave debe tener al menos 8 caracteres.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'No hay conexión con el servidor. Probá de nuevo en un momento.';
  return m;
}

export function vacio(texto, accion) {
  return h('div.vacio', h('p', texto), accion);
}

export function cargando() {
  return h('div.cargando-bloque', { 'aria-busy': 'true' }, h('span.spinner'), 'Cargando…');
}
