// Sitio público: arco decorativo, estado de atención y horarios desde la agenda.
import { arcoDecorativo } from './odontograma/dibujo.js';
import { estadoAtencion, resumenHorarios, AGENDA_INICIAL } from './lib/agenda.js';
import { partes } from './lib/dates.js';

document.getElementById('arco').innerHTML = arcoDecorativo();
document.getElementById('anio').textContent = partes().fecha.slice(0, 4);

function mostrar(agenda) {
  const est = estadoAtencion(agenda, agenda.bloqueos || []);
  const el = document.getElementById('estado');
  el.hidden = false;
  document.getElementById('estado-nota').hidden = false;
  el.classList.toggle('abierto', est.abierto);
  document.getElementById('estado-texto').textContent = est.texto;

  const dl = document.getElementById('horarios');
  dl.replaceChildren(...resumenHorarios(agenda).map((r) => {
    const div = document.createElement('div');
    const dt = document.createElement('dt');
    const dd = document.createElement('dd');
    dt.textContent = r.dias;
    dd.textContent = r.rango;
    div.append(dt, dd);
    return div;
  }));
}

mostrar(AGENDA_INICIAL);
try {
  const { api } = await import('./api/index.js');
  mostrar(await api.agenda());
} catch (e) {
  console.warn('No se pudo leer la agenda; se muestran los horarios por defecto.', e);
}
