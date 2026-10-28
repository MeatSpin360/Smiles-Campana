import { h, datosFormulario, vaciar } from '../lib/dom.js';
import { aviso, conCarga, mensajeError } from '../lib/ui.js';
import { modoDemo } from '../api/index.js';
import { hoy } from '../lib/dates.js';

const MENSAJES_VOLVER = {
  '/pedir-turno': 'Ingresá o creá tu cuenta para pedir un turno.',
};

function tarjeta(titulo, bajada, ...hijos) {
  return h('section.tarjeta-auth', h('h1', titulo), bajada ? h('p.texto-suave', bajada) : null, ...hijos);
}

function errorForm() {
  return h('p.error-campo', { role: 'alert', hidden: true });
}
function mostrarError(el, e) {
  el.textContent = typeof e === 'string' ? e : mensajeError(e);
  el.hidden = false;
}

export function ingresar(ctx) {
  const volver = ctx.query.get('volver') || '/';
  const err = errorForm();
  const boton = h('button.btn.btn-primario.btn-ancho', { type: 'submit' }, 'Ingresar');
  const form = h('form', { novalidate: true },
    h('label.campo', h('span', 'Email'), h('input', { name: 'email', type: 'email', autocomplete: 'email', required: true, inputmode: 'email' })),
    h('label.campo', h('span', 'Clave'), h('input', { name: 'clave', type: 'password', autocomplete: 'current-password', required: true })),
    err,
    boton,
    h('p.enlace-auth', h('a', { href: '#/recuperar' }, 'Olvidé mi clave')));

  const entrar = async (email, clave) => {
    err.hidden = true;
    await conCarga(boton, async () => {
      try {
        await ctx.api.ingresar(email, clave);
        await ctx.recargarSesion();
        ctx.navegar(volver, { reemplazar: true });
      } catch (e) {
        mostrarError(err, e);
      }
    });
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = datosFormulario(form);
    if (!d.email || !d.clave) return mostrarError(err, 'Completá tu email y tu clave.');
    entrar(d.email, d.clave);
  });

  const demo = modoDemo ? h('div.demo-accesos',
    h('p', 'Probá cada tipo de cuenta:'),
    h('div.demo-botones', ...[
      ['paciente@demo.com', 'Paciente'],
      ['recepcion@demo.com', 'Recepción'],
      ['odontologia@demo.com', 'Odontología'],
      ['admin@demo.com', 'Administración'],
    ].map(([email, texto]) => h('button.btn.btn-secundario.btn-chico', { type: 'button', onclick: () => entrar(email, 'demo1234') }, texto)))) : null;

  return h('div.auth',
    tarjeta('Ingresá a tu espacio', MENSAJES_VOLVER[volver] || null, form,
      h('div.separador-auth', h('span', '¿Primera vez?')),
      h('a.btn.btn-secundario.btn-ancho', { href: `#/registro${volver !== '/' ? `?volver=${encodeURIComponent(volver)}` : ''}` }, 'Crear mi cuenta de paciente')),
    demo);
}

export function registro(ctx) {
  const volver = ctx.query.get('volver') || '/';
  const err = errorForm();
  const boton = h('button.btn.btn-primario.btn-ancho', { type: 'submit' }, 'Crear cuenta');
  const form = h('form', { novalidate: true },
    h('div.fila-campos',
      h('label.campo', h('span', 'Nombre'), h('input', { name: 'nombre', autocomplete: 'given-name', required: true })),
      h('label.campo', h('span', 'Apellido'), h('input', { name: 'apellido', autocomplete: 'family-name', required: true }))),
    h('div.fila-campos',
      h('label.campo', h('span', 'DNI'), h('input', { name: 'dni', inputmode: 'numeric', autocomplete: 'off', required: true, pattern: '[0-9]{7,8}' }), h('small', 'Sin puntos.')),
      h('label.campo', h('span', 'Fecha de nacimiento'), h('input', { name: 'fecha_nac', type: 'date', max: hoy(), required: true }))),
    h('label.campo', h('span', 'Celular'), h('input', { name: 'telefono', type: 'tel', autocomplete: 'tel', inputmode: 'tel', required: true }), h('small', 'Con característica, por ejemplo 3489 444444.')),
    h('label.campo', h('span', 'Email'), h('input', { name: 'email', type: 'email', autocomplete: 'email', inputmode: 'email', required: true })),
    h('div.fila-campos',
      h('label.campo', h('span', 'Clave'), h('input', { name: 'clave', type: 'password', autocomplete: 'new-password', required: true, minlength: 8 }), h('small', 'Al menos 8 caracteres.')),
      h('label.campo', h('span', 'Repetir clave'), h('input', { name: 'clave2', type: 'password', autocomplete: 'new-password', required: true }))),
    h('label.check-legal', h('input', { type: 'checkbox', name: 'acepto', required: true }),
      h('span', 'Acepto que Smiles Campana guarde mis datos para gestionar mis turnos y mi historia clínica, según la Ley 25.326 de protección de datos personales.')),
    err,
    boton);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true;
    const d = datosFormulario(form);
    d.dni = (d.dni || '').replace(/\D/g, '');
    if (!d.nombre || !d.apellido || !d.dni || !d.fecha_nac || !d.telefono || !d.email || !d.clave) return mostrarError(err, 'Completá todos los campos.');
    if (!/^\d{7,8}$/.test(d.dni)) return mostrarError(err, 'El DNI debe tener 7 u 8 números.');
    if (d.clave.length < 8) return mostrarError(err, 'La clave debe tener al menos 8 caracteres.');
    if (d.clave !== d.clave2) return mostrarError(err, 'Las dos claves no coinciden.');
    if (!d.acepto) return mostrarError(err, 'Para crear la cuenta tenés que aceptar el uso de tus datos.');
    await conCarga(boton, async () => {
      try {
        const r = await ctx.api.registrarse(d);
        if (r.requiereConfirmacion) {
          vaciar(form.parentElement, h('h1', 'Revisá tu email'),
            h('p', `Te enviamos un enlace a ${d.email}. Abrilo para confirmar tu cuenta y después ingresá.`),
            h('a.btn.btn-secundario', { href: '#/ingresar' }, 'Ir a ingresar'));
          return;
        }
        await ctx.recargarSesion();
        aviso('Tu cuenta está lista.');
        ctx.navegar(volver, { reemplazar: true });
      } catch (ex) {
        mostrarError(err, ex);
      }
    });
  });

  return h('div.auth', tarjeta('Creá tu cuenta', 'Si ya sos paciente del consultorio, usá el mismo DNI y te vinculamos a tu ficha.', form,
    h('p.enlace-auth', '¿Ya tenés cuenta? ', h('a', { href: `#/ingresar${volver !== '/' ? `?volver=${encodeURIComponent(volver)}` : ''}` }, 'Ingresá'))));
}

export function recuperar(ctx) {
  const err = errorForm();
  const boton = h('button.btn.btn-primario.btn-ancho', { type: 'submit' }, 'Enviar enlace');
  const form = h('form', { novalidate: true },
    h('label.campo', h('span', 'Email'), h('input', { name: 'email', type: 'email', autocomplete: 'email', required: true })),
    err, boton,
    h('p.enlace-auth', h('a', { href: '#/ingresar' }, 'Volver a ingresar')));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const { email } = datosFormulario(form);
    if (!email) return mostrarError(err, 'Escribí el email de tu cuenta.');
    await conCarga(boton, async () => {
      try {
        await ctx.api.recuperarClave(email);
        vaciar(form, h('p', `Si hay una cuenta con ${email}, te llega un enlace para elegir una clave nueva.`), h('a.btn.btn-secundario', { href: '#/ingresar' }, 'Volver a ingresar'));
      } catch (ex) {
        mostrarError(err, ex);
      }
    });
  });
  return h('div.auth', tarjeta('Recuperar clave', 'Te mandamos un enlace para que elijas una clave nueva.', form));
}

export function nuevaClave(ctx) {
  const err = errorForm();
  const boton = h('button.btn.btn-primario.btn-ancho', { type: 'submit' }, 'Guardar clave');
  const form = h('form', { novalidate: true },
    h('label.campo', h('span', 'Clave nueva'), h('input', { name: 'clave', type: 'password', autocomplete: 'new-password', minlength: 8 }), h('small', 'Al menos 8 caracteres.')),
    h('label.campo', h('span', 'Repetir clave'), h('input', { name: 'clave2', type: 'password', autocomplete: 'new-password' })),
    err, boton);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = datosFormulario(form);
    if ((d.clave || '').length < 8) return mostrarError(err, 'La clave debe tener al menos 8 caracteres.');
    if (d.clave !== d.clave2) return mostrarError(err, 'Las dos claves no coinciden.');
    await conCarga(boton, async () => {
      try {
        await ctx.api.nuevaClave?.(d.clave);
        aviso('Guardamos tu clave nueva.');
        ctx.navegar('/', { reemplazar: true });
      } catch (ex) {
        mostrarError(err, ex);
      }
    });
  });
  return h('div.auth', tarjeta('Elegí una clave nueva', null, form));
}
