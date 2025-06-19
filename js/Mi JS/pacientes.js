import { mostrarFichaPaciente } from './ficha-paciente.js';

export function initPacientes() {
    const btnBuscarPaciente = document.getElementById('btn-buscar-paciente');
    const busquedaPaciente = document.getElementById('busqueda-paciente');
    const btnNuevoPaciente = document.getElementById('btn-nuevo-paciente');
    const nuevoPacienteForm = document.getElementById('nuevo-paciente-form');
    const formNuevoPaciente = document.getElementById('form-nuevo-paciente');

    // Guardar el HTML original del formulario para restaurarlo luego
    if (formNuevoPaciente) {
        window.formNuevoPacienteHTML = formNuevoPaciente.outerHTML;
    }

    // Mostrar cuadro de búsqueda y listado al hacer click en "Buscar paciente"
    if (btnBuscarPaciente && busquedaPaciente) {
        btnBuscarPaciente.addEventListener('click', function () {
            busquedaPaciente.style.display = 'block';
            if (nuevoPacienteForm) nuevoPacienteForm.style.display = 'none';
            if (formNuevoPaciente) formNuevoPaciente.reset();
            const edadInput = document.getElementById('edad-nuevo');
            if (edadInput) edadInput.value = '';

            // --- Listado de pacientes de prueba ---
            const pacientes = [
                { id: 1, apellido: "García", nombre: "Ana", dni: "30123456", telefono: "1122334455", email: "ana@correo.com", fechaNac: "1990-05-10" },
                { id: 2, apellido: "Pérez", nombre: "Juan", dni: "28987654", telefono: "1133445566", email: "juan@correo.com", fechaNac: "1985-11-22" },
                // ...otros pacientes...
            ];
            let pacientesFiltrados = pacientes.slice();

            function normalizarTexto(texto) {
                return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            }

            function renderPacientesFiltrados() {
                // Aquí deberías usar tu función de paginación si la tienes
                const tabla = document.getElementById('tabla-pacientes-paginada');
                tabla.innerHTML = pacientesFiltrados.map((p, idx) => `
                    <tr>
                        <td class="td-paciente" data-idx="${idx}">${p.apellido}</td>
                        <td class="td-paciente" data-idx="${idx}">${p.nombre}</td>
                        <td class="td-paciente" data-idx="${idx}">${p.dni}</td>
                        <td class="td-paciente" data-idx="${idx}">${p.fechaNac}</td>
                        <td class="td-paciente" data-idx="${idx}">${p.telefono}</td>
                        <td class="td-paciente" data-idx="${idx}">${p.email}</td>
                    </tr>
                `).join('');
                // Evento para abrir ficha
                tabla.querySelectorAll('.td-paciente').forEach(td => {
                    td.onclick = function () {
                        const idx = parseInt(this.getAttribute('data-idx'), 10);
                        mostrarFichaPaciente(pacientesFiltrados[idx]);
                    };
                });
            }

            // Evento de búsqueda
            const formBusquedaPacientes = document.getElementById('form-busqueda-pacientes');
            if (formBusquedaPacientes) {
                formBusquedaPacientes.onsubmit = function (e) {
                    e.preventDefault();
                    const valor = document.getElementById('input-buscar-paciente').value.trim();
                    if (valor.length < 3) {
                        alert('Ingrese al menos 3 caracteres para buscar.');
                        return;
                    }
                    const valorNorm = normalizarTexto(valor);
                    pacientesFiltrados = pacientes.filter(p =>
                        normalizarTexto(
                            `${p.apellido} ${p.nombre} ${p.dni} ${p.telefono} ${p.email}`
                        ).includes(valorNorm)
                    );
                    renderPacientesFiltrados();
                };
                document.getElementById('btn-mostrar-todo').onclick = function () {
                    document.getElementById('input-buscar-paciente').value = '';
                    pacientesFiltrados = pacientes.slice();
                    renderPacientesFiltrados();
                };
            }

            renderPacientesFiltrados();
        });
    }

    // Mostrar formulario de nuevo paciente al hacer click en "Nuevo paciente"
    if (btnNuevoPaciente && nuevoPacienteForm) {
        btnNuevoPaciente.addEventListener('click', function () {
            nuevoPacienteForm.style.display = 'block';
            if (busquedaPaciente) busquedaPaciente.style.display = 'none';
            if (formNuevoPaciente && window.formNuevoPacienteHTML) {
                formNuevoPaciente.outerHTML = window.formNuevoPacienteHTML;
            }
            inicializarFormNuevoPaciente();
        });
    }

    // --- FORMULARIO NUEVO PACIENTE: RESTRICCIONES, VALIDACIONES Y ENVÍO ---
    function inicializarFormNuevoPaciente() {
        const formNuevoPacienteRestaurado = document.getElementById('form-nuevo-paciente');
        if (!formNuevoPacienteRestaurado) return;

        // Restricción: DNI solo números, hasta 9 dígitos
        const dniNuevo = document.getElementById('dni-nuevo');
        if (dniNuevo) {
            dniNuevo.setAttribute('maxlength', '9');
            dniNuevo.setAttribute('minlength', '8');
            dniNuevo.addEventListener('input', function () {
                this.value = this.value.replace(/\D/g, '').slice(0, 9);
            });
        }

        // Calcular edad automáticamente
        const fechaNacInput = document.getElementById('fecha-nac-nuevo');
        const edadInput = document.getElementById('edad-nuevo');
        if (fechaNacInput && edadInput) {
            fechaNacInput.addEventListener('change', function () {
                const hoy = new Date();
                const fechaNac = new Date(this.value);
                let edad = hoy.getFullYear() - fechaNac.getFullYear();
                const m = hoy.getMonth() - fechaNac.getMonth();
                if (m < 0 || (m === 0 && hoy.getDate() < fechaNac.getDate())) {
                    edad--;
                }
                edadInput.value = isNaN(edad) ? '' : edad;
            });
        }

        // Validación y envío único
        formNuevoPacienteRestaurado.addEventListener('submit', function (e) {
            const apellidoNuevo = document.getElementById('apellido-nuevo');
            const nombreNuevo = document.getElementById('nombre-nuevo');
            const dniVal = dniNuevo ? dniNuevo.value.trim() : '';
            const apeVal = apellidoNuevo ? apellidoNuevo.value.trim() : '';
            const nomVal = nombreNuevo ? nombreNuevo.value.trim() : '';

            // Validar que al menos uno de los tres campos tenga valor
            if (!dniVal && !apeVal && !nomVal) {
                alert('Debe ingresar al menos DNI, Apellido/s o Nombre/s.');
                if (dniNuevo) dniNuevo.focus();
                e.preventDefault();
                return false;
            }

            // Si DNI tiene valor, debe ser numérico y tener entre 8 y 9 caracteres
            if (dniVal && !/^\d{8,9}$/.test(dniVal)) {
                alert('Si ingresa DNI, debe contener solo números y tener entre 8 y 9 dígitos.');
                dniNuevo.focus();
                e.preventDefault();
                return false;
            }

            // Deshabilitar el botón para evitar doble envío
            const btnAlta = document.getElementById('btn-alta-paciente');
            if (btnAlta) btnAlta.disabled = true;

            // Simulación de envío al backend
            let timeoutId;
            let responded = false;

            timeoutId = setTimeout(() => {
                if (!responded) {
                    responded = true;
                    alert("error de comunicacion, intentar mas tarde");
                    if (btnAlta) btnAlta.disabled = false;
                }
            }, 10000);

            // Simulación de respuesta del backend
            const respuestaSimulada = "ok"; // Cambia a "existe" o "error" para probar

            setTimeout(() => {
                if (responded) return;
                responded = true;
                clearTimeout(timeoutId);

                const nuevoPacienteForm = document.getElementById('nuevo-paciente-form');
                if (respuestaSimulada === "ok") {
                    // Respuesta 1: Perfil creado
                    nuevoPacienteForm.innerHTML = `
                        <div class="alert alert-success" style="margin-top:30px;">
                            Perfil de paciente creado exitosamente.
                        </div>
                        <div style="text-align:center; margin-top:20px;">
                            <button class="btn btn-primary" id="btn-nuevo-paciente-nuevo">Cargar un nuevo paciente</button>
                        </div>
                    `;
                    // Botón para volver a cargar un nuevo paciente (sin recargar toda la página)
                    const btnNuevo = document.getElementById('btn-nuevo-paciente-nuevo');
                    if (btnNuevo) {
                        btnNuevo.addEventListener('click', function () {
                            if (window.formNuevoPacienteHTML) {
                                nuevoPacienteForm.innerHTML = window.formNuevoPacienteHTML;
                                inicializarFormNuevoPaciente();
                            }
                        });
                    }
                } else if (respuestaSimulada === "existe") {
                    // Respuesta 2: Usuario existente
                    alert("Ya existe un paciente con estos datos");
                    if (btnAlta) btnAlta.disabled = false;
                } else {
                    // Respuesta 3: error genérico
                    alert("error de comunicacion, intentar mas tarde");
                    if (btnAlta) btnAlta.disabled = false;
                }
            }, 2000);

            e.preventDefault();
        });
    }

    inicializarFormNuevoPaciente();
}