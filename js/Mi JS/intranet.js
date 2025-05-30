document.addEventListener('DOMContentLoaded', function () {
    // --- LOGIN ---
    const loginContainer = document.getElementById('login-container');
    const mainContent = document.getElementById('intranet-home');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');

    // IDs de las secciones principales
    const secciones = [
        { id: 'seccion-pacientes', btn: 'Pacientes' },
        { id: 'seccion-turnos', btn: 'Turnos' },
        { id: 'seccion-contabilidad', btn: 'Contabilidad' },
        { id: 'seccion-mantenimiento', btn: 'Mantenimiento' },
        { id: 'seccion-insumos', btn: 'Insumos' }
    ];

    // Oculta el contenido principal y secciones al cargar
    if (mainContent) mainContent.style.display = 'none';
    secciones.forEach(sec => {
        const s = document.getElementById(sec.id);
        if (s) s.style.display = 'none';
    });

    let logueado = false;

    // --- LOGIN SUBMIT ---
    loginForm.addEventListener('submit', function (e) {
        e.preventDefault();
        const dni = document.getElementById('dni').value.trim();
        const password = document.getElementById('password').value;

        // Usuario hardcodeado
        if (dni === '34479253' && password === 'Feoypeste12') {
            loginContainer.style.display = 'none';
            if (mainContent) mainContent.style.display = '';
            logueado = true;
        } else {
            loginError.style.display = 'block';
        }
    });

    // --- NAVEGACIÓN ENTRE SECCIONES ---
    document.querySelectorAll('.navbar-nav li a.smoothScroll').forEach(link => {
        link.addEventListener('click', function (e) {
            const texto = this.textContent.trim();
            // Solo permite mostrar secciones si está logueado
            if (!logueado) {
                e.preventDefault();
                return;
            }
            // Oculta todas las secciones
            if (mainContent) mainContent.style.display = 'none';
            secciones.forEach(sec => {
                const s = document.getElementById(sec.id);
                if (s) s.style.display = 'none';
            });
            // Muestra la sección correspondiente
            const sec = secciones.find(sec => sec.btn.toLowerCase() === texto.toLowerCase());
            if (sec) {
                const s = document.getElementById(sec.id);
                if (s) s.style.display = '';
            }
            // Oculta y limpia el formulario de alta y búsqueda de paciente
            const nuevoPacienteForm = document.getElementById('nuevo-paciente-form');
            const formNuevoPaciente = document.getElementById('form-nuevo-paciente');
            const busquedaPaciente = document.getElementById('busqueda-paciente');
            if (nuevoPacienteForm && formNuevoPaciente) {
                nuevoPacienteForm.style.display = 'none';
                formNuevoPaciente.reset();
                const edadInput = document.getElementById('edad-nuevo');
                if (edadInput) edadInput.value = '';
            }
            if (busquedaPaciente) {
                busquedaPaciente.style.display = 'none';
            }
            e.preventDefault();
        });
    });

    // --- PACIENTES: BOTONES Y FORMULARIO ---
    const btnBuscarPaciente = document.getElementById('btn-buscar-paciente');
    const busquedaPaciente = document.getElementById('busqueda-paciente');
    const btnNuevoPaciente = document.getElementById('btn-nuevo-paciente');
    const nuevoPacienteForm = document.getElementById('nuevo-paciente-form');
    const formNuevoPaciente = document.getElementById('form-nuevo-paciente');

    // Guardar el HTML original del formulario para restaurarlo luego
    if (formNuevoPaciente) {
        window.formNuevoPacienteHTML = formNuevoPaciente.outerHTML;
    }

    // Mostrar cuadro de búsqueda al hacer click en "Buscar paciente"
    if (btnBuscarPaciente && busquedaPaciente && nuevoPacienteForm && formNuevoPaciente) {
        btnBuscarPaciente.addEventListener('click', function () {
            busquedaPaciente.style.display = 'block';
            nuevoPacienteForm.style.display = 'none';
            formNuevoPaciente.reset();
            // Limpiar edad calculada
            const edadInput = document.getElementById('edad-nuevo');
            if (edadInput) edadInput.value = '';
        });
    }

    // Mostrar formulario de nuevo paciente al hacer click en "Nuevo paciente"
    if (btnNuevoPaciente && nuevoPacienteForm && busquedaPaciente && formNuevoPaciente) {
        btnNuevoPaciente.addEventListener('click', function () {
            nuevoPacienteForm.style.display = 'block';
            busquedaPaciente.style.display = 'none';
            formNuevoPaciente.reset();
            // Limpiar edad calculada
            const edadInput = document.getElementById('edad-nuevo');
            if (edadInput) edadInput.value = '';
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
            }, 2000); // Simula respuesta en 2 segundos

            e.preventDefault();
        });
    }

    // Inicializar validaciones y eventos del formulario al cargar la página
    inicializarFormNuevoPaciente();
});