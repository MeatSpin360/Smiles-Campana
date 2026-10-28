// Piezas reutilizables de la intranet.
import { h, vaciar, datosFormulario } from '../../lib/dom.js';
import { hoja, conCarga, aviso } from '../../lib/ui.js';
import { hoy, edad, fechaLarga, hora, mayuscula } from '../../lib/dates.js';
import { nombreCompleto, MOTIVOS, bloqueFecha, selectorHorario } from '../comunes.js';
import { ICONOS } from '../iconos.js';

export const puedeVerClinica = (rol) => rol === 'odontologia' || rol === 'admin';

/** Buscador de pacientes con resultados en vivo. */
export function buscadorPaciente({ api, alElegir, autofoco = true }) {
  const input = h('input', { type: 'search', placeholder: 'Apellido, nombre o DNI', 'aria-label': 'Buscar paciente', autocomplete: 'off' });
  const lista = h('ul.resultados');
  let t;
  const buscar = async () => {
    const r = await api.buscarPacientes(input.value);
    vaciar(lista, r.length ? r.slice(0, 8).map((p) => h('li', h('button.resultado', { type: 'button', onclick: () => alElegir(p) },
      h('strong', nombreCompleto(p)), h('span', `DNI ${p.dni}`)))) : h('li.texto-suave.sin-resultados', 'No hay pacientes con esa búsqueda.'));
  };
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(buscar, 180); });
  buscar();
  if (autofoco) setTimeout(() => input.focus(), 60);
  return h('div.buscador', h('div.campo-busqueda', h('span.icono-busqueda', { html: ICONOS.buscar }), input), lista);
}

/** Formulario de datos del paciente (alta o edición). */
export function formularioPaciente(p = {}) {
  return h('div.form-paciente',
    h('div.fila-campos',
      h('label.campo', h('span', 'Nombre'), h('input', { name: 'nombre', value: p.nombre || '', required: true })),
      h('label.campo', h('span', 'Apellido'), h('input', { name: 'apellido', value: p.apellido || '', required: true }))),
    h('div.fila-campos',
      h('label.campo', h('span', 'DNI'), h('input', { name: 'dni', value: p.dni || '', inputmode: 'numeric', required: true })),
      h('label.campo', h('span', 'Fecha de nacimiento'), h('input', { name: 'fecha_nac', type: 'date', value: p.fecha_nac || '', max: hoy() }))),
    h('div.fila-campos',
      h('label.campo', h('span', 'Celular'), h('input', { name: 'telefono', type: 'tel', value: p.telefono || '' })),
      h('label.campo', h('span', 'Email'), h('input', { name: 'email', type: 'email', value: p.email || '' }))),
    h('label.campo', h('span', 'Dirección'), h('input', { name: 'direccion', value: p.direccion || '' })),
    h('label.campo', h('span', 'Notas administrativas'), h('textarea', { name: 'notas', rows: 3, placeholder: 'Por ejemplo: prefiere turnos a la tarde.' }, p.notas || '')));
}

export function validarPaciente(d) {
  d.dni = (d.dni || '').replace(/\D/g, '');
  if (!d.nombre || !d.apellido) return 'Completá nombre y apellido.';
  if (!/^\d{6,9}$/.test(d.dni)) return 'Revisá el DNI: solo números, sin puntos.';
  return null;
}

/** Hoja para dar de alta un paciente. Resuelve con el paciente creado. */
export function altaPaciente(api) {
  return new Promise((resolve) => {
    let creado = null;
    const err = h('p.error-campo', { hidden: true });
    const form = h('form', { novalidate: true }, formularioPaciente(), err);
    const boton = h('button.btn.btn-primario', { type: 'button' }, 'Crear ficha');
    const { cerrar } = hoja({ titulo: 'Nuevo paciente', cuerpo: form, pie: [boton], alCerrar: () => resolve(creado) });
    const guardar = () => {
      const d = datosFormulario(form);
      const problema = validarPaciente(d);
      if (problema) {
        err.textContent = problema;
        err.hidden = false;
        return;
      }
      conCarga(boton, async () => {
        creado = await api.crearPaciente(d);
        aviso('Ficha creada.');
        cerrar();
      });
    };
    boton.onclick = guardar;
    form.addEventListener('submit', (e) => { e.preventDefault(); guardar(); });
  });
}

/**
 * Hoja para dar un turno. Si se pasa paciente, solo elige horario; si se pasa inicio, solo elige paciente.
 * sobreturno: turno de 30 min que se puede dar en huecos, en la franja extendida o en un bloqueo.
 * Resuelve con el turno creado o null.
 */
export function darTurno(api, { paciente = null, inicio = null, dias = 30, sobreturno = false } = {}) {
  return new Promise((resolve) => {
    let creado = null;
    let pac = paciente;
    let iso = inicio;
    let esSobreturno = sobreturno;
    let motivo = esSobreturno ? 'Urgencia' : MOTIVOS[0];
    const cuerpo = h('div.dar-turno');
    const boton = h('button.btn.btn-primario', { type: 'button', disabled: true });
    const titulo = () => (esSobreturno ? 'Dar sobreturno' : 'Dar turno');
    const { dialog, cerrar } = hoja({ titulo: titulo(), cuerpo, pie: [boton], ancho: 'ancho', alCerrar: () => resolve(creado) });

    const actualizar = () => {
      boton.disabled = !(pac && iso);
      boton.textContent = titulo();
      dialog.querySelector('.hoja-cabecera h2').textContent = titulo();
      dialog.classList.toggle('hoja-sobreturno', esSobreturno);
    };
    const resumen = () => h('div.resumen-seleccion',
      pac ? h('div.sel-item', h('span.texto-suave', 'Paciente'), h('strong', nombreCompleto(pac)),
        paciente ? null : h('button.btn.btn-fantasma.btn-chico', { type: 'button', onclick: () => { pac = null; pintar(); } }, 'Cambiar')) : null,
      iso ? h('div.sel-item', h('span.texto-suave', esSobreturno ? 'Sobreturno (30 min)' : 'Horario'), h('strong', `${mayuscula(fechaLarga(iso))}, ${hora(iso)} h`),
        inicio ? null : h('button.btn.btn-fantasma.btn-chico', { type: 'button', onclick: () => { iso = null; pintar(); } }, 'Cambiar')) : null);

    // Elegir entre turno común y sobreturno (solo si el horario no vino dado)
    const tipo = inicio ? null : h('label.check-sobreturno',
      h('input', { type: 'checkbox', checked: esSobreturno, onchange: (e) => { esSobreturno = e.target.checked; iso = null; pintar(); } }),
      h('span', h('strong', 'Sobreturno'), ' · 30 minutos, en un hueco o hasta 1 hora antes o después del horario. Puede ir en un horario bloqueado.'));

    const selectMotivo = () => h('label.campo', h('span', 'Motivo'),
      h('select', { onchange: (e) => { motivo = e.target.value; } },
        (esSobreturno ? ['Urgencia', ...MOTIVOS] : MOTIVOS).map((m) => h('option', { selected: m === motivo }, m))));

    function pintar() {
      const partes = [resumen()];
      if (!pac) partes.push(h('h3.titulo-paso', 'Paciente'), buscadorPaciente({ api, alElegir: (p) => { pac = p; pintar(); } }));
      else if (!iso) {
        partes.push(tipo, h('h3.titulo-paso', esSobreturno ? 'Hueco para el sobreturno' : 'Horario'),
          selectorHorario({ api, dias, sobreturno: esSobreturno, alElegir: (x) => { iso = x; pintar(); } }));
      }
      if (pac && iso) partes.push(selectMotivo());
      vaciar(cuerpo, partes);
      actualizar();
    }
    boton.onclick = () => conCarga(boton, async () => {
      creado = await api.crearTurno({ paciente_id: pac.id, inicio: iso, motivo, sobreturno: esSobreturno });
      aviso(esSobreturno ? 'Sobreturno asignado.' : 'Turno asignado.');
      cerrar();
    });
    pintar();
  });
}

export function lineaPaciente(p) {
  const e = edad(p.fecha_nac);
  return [`DNI ${p.dni}`, e != null ? `${e} años` : null, p.telefono].filter(Boolean).join(', ');
}

export { bloqueFecha };
