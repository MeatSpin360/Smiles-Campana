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


    /* 
    --------------------------------------------------------------------------
    |     FUNCIONES PARA PACIENTES (y correcciones de navegación)            |
    --------------------------------------------------------------------------
    */

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

    /* 
    -------------------------------------------
    |     FUNCIONES PARA CONTABILIDAD         |
    -------------------------------------------
    */


    // Mostrar cuadro de libro contable al hacer click
    const btnLibroContable = document.getElementById('btn-libro-contable');
    const libroContableCuadro = document.getElementById('libro-contable-cuadro');
    if (btnLibroContable && libroContableCuadro) {
        btnLibroContable.addEventListener('click', function () {
            renderLibroContable([]);
        });
    }

    // Renderiza el cuadro de últimos movimientos y el formulario de ingreso
    function renderLibroContable(movimientos) {
        // Si no hay datos, crea 10 filas vacías
        if (!movimientos || movimientos.length === 0) {
            movimientos = Array.from({ length: 10 }).map((_, i) => ({
                id: '', // El backend asignará el valor real
                fecha: '',
                descripcion: '',
                ingreso: '',
                gasto: '',
                total: ''
            }));
        }

        libroContableCuadro.style.display = 'block';
        libroContableCuadro.innerHTML = `
            <div class="panel panel-default" style="margin-bottom:30px;">
                <div class="panel-heading"><strong>Ingresar actividad</strong></div>
                <div class="panel-body">
                    <form id="form-nuevo-movimiento" class="form-inline" autocomplete="off">
                        <div class="form-group" style="margin:5px;">
                            <input type="date" class="form-control" name="fecha" placeholder="Fecha" required>
                        </div>
                        <div class="form-group" style="margin:5px;">
                            <input type="text" class="form-control" name="descripcion" placeholder="Descripcion" required>
                        </div>
                        <div class="form-group" style="margin:5px;">
                            <input type="number" class="form-control" name="ingreso" id="nuevo-ingreso" placeholder="Ingreso" min="0" step="0.01">
                        </div>
                        <div class="form-group" style="margin:5px;">
                            <input type="number" class="form-control" name="gasto" id="nuevo-gasto" placeholder="Gasto" min="0" step="0.01">
                        </div>
                        <div class="form-group" style="margin:5px;">
                            <input type="number" class="form-control" name="total" id="nuevo-total" placeholder="Total" min="0" step="0.01" readonly>
                        </div>
                        <button type="submit" class="btn btn-success" style="margin:5px;">Agregar</button>
                    </form>
                </div>
            </div>
            <h3 style="margin-bottom:20px;">Últimos movimientos</h3>
            <div class="table-responsive">
                <table class="table table-bordered table-striped" id="tabla-movimientos">
                    <thead>
                        <tr>
                            <th>N°</th>
                            <th>Fecha</th>
                            <th>Descripcion</th>
                            <th>Ingreso</th>
                            <th>Gasto</th>
                            <th>Total</th>
                            <th>Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${movimientos.map((mov) => `
        <tr data-id="${mov.id}">
            <td>${mov.id}</td>
            <td>${mov.fecha}</td>
            <td title="${mov.descripcion.replace(/"/g, '&quot;')}">${mov.descripcion}</td>
            <td>${mov.ingreso !== '' && mov.ingreso !== undefined && mov.ingreso !== null ? `$${parseFloat(mov.ingreso).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2})}` : ''}</td>
            <td>${mov.gasto !== '' && mov.gasto !== undefined && mov.gasto !== null ? `$${parseFloat(mov.gasto).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2})}` : ''}</td>
            <td>${mov.total !== '' && mov.total !== undefined && mov.total !== null ? `$${parseFloat(mov.total).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2})}` : ''}</td>
            <td>
                <button class="btn-editar-mov btn btn-link" title="Editar"><i class="fa fa-edit"></i></button>
            </td>
        </tr>
    `).join('')}
                    </tbody>
                </table>
            </div>
            <div style="text-align:center; margin:20px 0;">
                <button id="btn-ver-mas-movimientos" class="btn btn-primary">Ver más movimientos</button>
            </div>
            <div id="ver-mas-movimientos-panel"></div>
        `;

        // Calcular total automáticamente in "Ingresar actividad"
        const ingresoInput = document.getElementById('nuevo-ingreso');
        const gastoInput = document.getElementById('nuevo-gasto');
        const totalInput = document.getElementById('nuevo-total');
        function actualizarTotalNuevo() {
            const ingreso = parseFloat(ingresoInput.value) || 0;
            const gasto = parseFloat(gastoInput.value) || 0;
            totalInput.value = (ingreso - gasto).toFixed(2);
        }
        if (ingresoInput && gastoInput && totalInput) {
            ingresoInput.addEventListener('input', actualizarTotalNuevo);
            gastoInput.addEventListener('input', actualizarTotalNuevo);
        }

        // Evento para agregar nuevo movimiento (simulado)
        const formNuevo = document.getElementById('form-nuevo-movimiento');
        if (formNuevo) {
            formNuevo.onsubmit = function (e) {
                e.preventDefault();
                // Aquí deberías enviar los datos al backend
                alert('Movimiento enviado al backend (simulado)');
                // Recargar datos (simulado)
                renderLibroContable(movimientos);
            };
        }

        // Evento para editar filas SOLO en la tabla principal de últimos movimientos
        libroContableCuadro.querySelectorAll('#tabla-movimientos .btn-editar-mov').forEach(btn => {
            btn.onclick = function () {
                const tr = this.closest('tr');
                const id = tr.getAttribute('data-id');
                editarFilaMovimiento(tr, movimientos, id);
            };
        });

        // Evento para "Ver más movimientos"
        const btnVerMas = document.getElementById('btn-ver-mas-movimientos');
        const panelVerMas = document.getElementById('ver-mas-movimientos-panel');
        if (btnVerMas && panelVerMas) {
            btnVerMas.onclick = function () {
                panelVerMas.innerHTML = `
                <div class="panel panel-default" style="margin:20px auto; max-width:500px;">
                    <div class="panel-heading"><strong>Seleccione el rango deseado</strong></div>
                    <div class="panel-body" style="text-align:center;">
                        <form id="form-buscar-movimientos" class="form-inline" autocomplete="off">
                            <div class="form-group" style="margin:5px;">
                                <label for="fecha-desde">Desde:</label>
                                <input type="date" class="form-control" id="fecha-desde" name="desde" required>
                            </div>
                            <div class="form-group" style="margin:5px;">
                                <label for="fecha-hasta">Hasta:</label>
                                <input type="date" class="form-control" id="fecha-hasta" name="hasta" required>
                            </div>
                            <button type="submit" class="btn btn-primary" style="margin:5px;">Buscar</button>
                        </form>
                    </div>
                </div>
                <div id="resultados-movimientos-rango"></div>
            `;
                // Evento buscar movimientos por rango
                const formBuscar = document.getElementById('form-buscar-movimientos');
                if (formBuscar) {
                    formBuscar.onsubmit = function (e) {
                        e.preventDefault();
                        // Simular espera de backend y mostrar 1 fila de ejemplo
                        const resultados = document.getElementById('resultados-movimientos-rango');
                        resultados.innerHTML = `<div style="text-align:center;margin:20px;">Buscando movimientos...</div>`;
                        setTimeout(() => {
                            // Simulación: 1 fila de ejemplo
                            const movimientosRango = [{
                                id: '123',
                                fecha: '2024-06-05',
                                descripcion: 'Movimiento ejemplo',
                                ingreso: '1000',
                                gasto: '200',
                                total: '800'
                            }];
                            resultados.innerHTML = `
                            <h4 style="margin-bottom:15px;">Movimientos encontrados</h4>
                            <div class="table-responsive">
                                <table class="table table-bordered table-striped">
                                    <thead>
                                        <tr>
                                            <th>N°</th>
                                            <th>Fecha</th>
                                            <th>Descripcion</th>
                                            <th>Ingreso</th>
                                            <th>Gasto</th>
                                            <th>Total</th>
                                            <th>Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${movimientosRango.map(mov => `
                                            <tr>
                                                <td>${mov.id}</td>
                                                <td>${mov.fecha}</td>
                                                <td>${mov.descripcion}</td>
                                                <td>${mov.ingreso}</td>
                                                <td>${mov.gasto}</td>
                                                <td>${mov.total}</td>
                                                <td>
                                                    <button class="btn-editar-mov btn btn-link" title="Editar" disabled><i class="fa fa-edit"></i></button>
                                                </td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        `;
                        }, 1200);
                    };
                }
            };
        }
    }

    // Permite editar una fila y muestra botones de guardar/cancelar
    function editarFilaMovimiento(tr, movimientos, id) {
        const tds = tr.querySelectorAll('td');
        const original = Array.from(tds).map(td => td.innerHTML);

        tds[1].innerHTML = `<input type="date" class="form-control" value="${tds[1].textContent.trim()}" style="width:100%; min-width:90px; text-align:center;">`;
        // Textarea ocupa casi toda la celda y centrado vertical/horizontal
        tds[2].innerHTML = `<textarea class="form-control" id="edit-descripcion" style="width:98%; min-height:38px; resize:vertical; display:block; margin:auto; text-align:center;">${tds[2].textContent.trim()}</textarea>`;
        tds[3].innerHTML = `<input type="number" class="form-control" value="${tds[3].textContent.trim()}" style="width:100%; min-width:70px; text-align:center;" id="edit-ingreso">`;
        tds[4].innerHTML = `<input type="number" class="form-control" value="${tds[4].textContent.trim()}" style="width:100%; min-width:70px; text-align:center;" id="edit-gasto">`;
        tds[5].innerHTML = `<input type="number" class="form-control" value="${tds[5].textContent.trim()}" style="width:100%; min-width:70px; text-align:center;" id="edit-total" readonly>`;

        // Autoajustar textarea al escribir
        const textarea = tds[2].querySelector('#edit-descripcion');
        if (textarea) {
            textarea.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = (this.scrollHeight) + 'px';
            });
            textarea.style.height = 'auto';
            textarea.style.height = (textarea.scrollHeight) + 'px';
        }

        // Calcular total automáticamente al editar
        const editIngreso = tds[3].querySelector('#edit-ingreso');
        const editGasto = tds[4].querySelector('#edit-gasto');
        const editTotal = tds[5].querySelector('#edit-total');
        function actualizarTotalEdit() {
            const ingreso = parseFloat(editIngreso.value) || 0;
            const gasto = parseFloat(editGasto.value) || 0;
            editTotal.value = (ingreso - gasto).toFixed(2);
        }
        if (editIngreso && editGasto && editTotal) {
            editIngreso.addEventListener('input', actualizarTotalEdit);
            editGasto.addEventListener('input', actualizarTotalEdit);
            actualizarTotalEdit();
        }

        // Botones guardar/cancelar
        tds[6].innerHTML = `
            <button class="btn-guardar-mov btn btn-success btn-xs" title="Guardar"><i class="fa fa-check"></i></button>
            <button class="btn-cancelar-mov btn btn-danger btn-xs" title="Cancelar"><i class="fa fa-times"></i></button>
        `;

        // Guardar cambios
        tds[6].querySelector('.btn-guardar-mov').onclick = function () {
            tds[6].querySelector('.btn-guardar-mov').disabled = true;
            tds[6].querySelector('.btn-cancelar-mov').disabled = true;
            setTimeout(() => {
                alert('Cambios guardados en el backend (simulado)');
                renderLibroContable(movimientos);
            }, 1000);
        };

        // Cancelar edición
        tds[6].querySelector('.btn-cancelar-mov').onclick = function () {
            tds.forEach((td, i) => td.innerHTML = original[i]);
            const btnEdit = tds[6].querySelector('.btn-editar-mov');
            if (btnEdit) {
                btnEdit.onclick = function () {
                    editarFilaMovimiento(tr, movimientos, id);
                };
            }
        };
    }
});