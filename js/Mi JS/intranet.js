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

    // let logueado = false;

    // --- LOGIN SUBMIT ---
    // loginForm.addEventListener('submit', function (e) {
    //     e.preventDefault();
    //     const dni = document.getElementById('dni').value.trim();
    //     const password = document.getElementById('password').value;

    //     // Usuario hardcodeado
    //     if (dni === '34479253' && password === 'Feoypeste12') {
    //         loginContainer.style.display = 'none';
    //         if (mainContent) mainContent.style.display = '';
    //         logueado = true;
    //     } else {
    //         loginError.style.display = 'block';
    //     }
    // });

    // OMITIR LOGIN PROVISORIAMENTE
    if (loginContainer) loginContainer.style.display = 'none';
    if (mainContent) mainContent.style.display = '';
    let logueado = true;

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
                // Si es la sección Turnos, inicializa el calendario
                if (sec.id === 'seccion-turnos') {
                    setTimeout(() => {
                        inicializarCalendarioTurnos();
                        if (calendar) calendar.updateSize();
                    }, 100);
                }
                // Si es la sección Insumos, inicializa los botones y paneles
                if (sec.id === 'seccion-insumos') {
                    setTimeout(() => {
                        inicializarSeccionInsumos();
                    }, 100);
                }
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
    // libroContableCuadro ya está declarado arriba, no volver a declararlo aquí
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
            <td>${mov.ingreso !== '' && mov.ingreso !== undefined && mov.ingreso !== null ? `$${parseFloat(mov.ingreso).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}</td>
            <td>${mov.gasto !== '' && mov.gasto !== undefined && mov.gasto !== null ? `$${parseFloat(mov.gasto).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}</td>
            <td>${mov.total !== '' && mov.total !== undefined && mov.total !== null ? `$${parseFloat(mov.total).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}</td>
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
                                                <tr data-id="${mov.id}">
                                                    <td>${mov.id}</td>
                                                    <td>${mov.fecha}</td>
                                                    <td title="${mov.descripcion.replace(/"/g, '&quot;')}">${mov.descripcion}</td>
                                                    <td>${mov.ingreso !== '' && mov.ingreso !== undefined && mov.ingreso !== null ? `$${parseFloat(mov.ingreso).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}</td>
                                                    <td>${mov.gasto !== '' && mov.gasto !== undefined && mov.gasto !== null ? `$${parseFloat(mov.gasto).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}</td>
                                                    <td>${mov.total !== '' && mov.total !== undefined && mov.total !== null ? `$${parseFloat(mov.total).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : ''}</td>
                                                    <td>
                                                        <button class="btn-editar-mov btn btn-link" title="Editar"><i class="fa fa-edit"></i></button>
                                                    </td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>
                                </div>
                            `;

                            // Habilita edición en la tabla de resultados también
                            resultados.querySelectorAll('.btn-editar-mov').forEach(btn => {
                                btn.onclick = function () {
                                    const tr = this.closest('tr');
                                    const id = tr.getAttribute('data-id');
                                    editarFilaMovimiento(tr, movimientosRango, id);
                                };
                            });
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
            textarea.addEventListener('input', function () {
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

        // Botones guardar/cancelar/eliminar
        tds[6].innerHTML = `
            <button class="btn-guardar-mov btn btn-success btn-xs" title="Guardar"><i class="fa fa-check"></i></button>
            <button class="btn-cancelar-mov btn btn-danger btn-xs" title="Cancelar"><i class="fa fa-times"></i></button>
            <button class="btn-eliminar-mov btn btn-warning btn-xs" title="Eliminar"><i class="fa fa-trash"></i></button>
        `;

        // Guardar cambios
        tds[6].querySelector('.btn-guardar-mov').onclick = function () {
            tds[6].querySelector('.btn-guardar-mov').disabled = true;
            tds[6].querySelector('.btn-cancelar-mov').disabled = true;
            tds[6].querySelector('.btn-eliminar-mov').disabled = true;
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

        // Eliminar actividad
        tds[6].querySelector('.btn-eliminar-mov').onclick = function () {
            if (confirm('¿Está seguro que desea eliminar esta actividad? Esta acción no se puede deshacer.')) {
                tds[6].querySelector('.btn-guardar-mov').disabled = true;
                tds[6].querySelector('.btn-cancelar-mov').disabled = true;
                tds[6].querySelector('.btn-eliminar-mov').disabled = true;
                // Aquí deberías enviar la solicitud de eliminación al backend
                setTimeout(() => {
                    alert('Actividad eliminada en el backend (simulado)');
                    // Recargar el listado actualizado desde el backend
                    renderLibroContable(movimientos);
                }, 1000);
            }
        };
    }

    // --- CONTABILIDAD: NAVEGACIÓN ENTRE SUBSECCIONES ---
    const contabilidadSecciones = {
        'btn-libro-contable': 'libro-contable-cuadro',
        'btn-resumenes': 'resumenes-contables-cuadro',
        'btn-comprobantes': 'comprobantes-contables-cuadro'
    };

    Object.keys(contabilidadSecciones).forEach(btnId => {
        const btn = document.getElementById(btnId);
        if (btn) {
            btn.addEventListener('click', function () {
                // Oculta todos los cuadros de contabilidad
                Object.values(contabilidadSecciones).forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.style.display = 'none';
                });
                // Muestra solo el cuadro correspondiente
                const cuadro = document.getElementById(contabilidadSecciones[btnId]);
                if (cuadro) {
                    cuadro.style.display = 'block';
                    // Renderiza contenido si corresponde
                    if (btnId === 'btn-libro-contable') {
                        renderLibroContable([]);
                    }
                    if (btnId === 'btn-resumenes') {
                        cuadro.innerHTML = `
                            <div class="panel panel-default" style="max-width:500px;margin:30px auto;">
                                <div class="panel-heading"><strong>Resumen Contable</strong></div>
                                <div class="panel-body" style="text-align:center;">
                                    <button id="btn-resumen-mensual" class="btn btn-primary" style="margin:10px 0;width:90%;">Resúmenes mensuales</button>
                                    <button id="btn-resumen-anual" class="btn btn-primary" style="margin:10px 0;width:90%;">Resúmenes anuales</button>
                                    <div id="contenedor-resumen-mensual" style="margin-top:20px;"></div>
                                </div>
                            </div>
                        `;

                        // Evento para mostrar lista de resúmenes mensuales
                        setTimeout(() => { // Espera a que el DOM esté listo
                            const btnMensual = document.getElementById('btn-resumen-mensual');
                            if (btnMensual) {
                                btnMensual.onclick = function () {
                                    mostrarListaResumenesMensuales();
                                };
                            }
                            const btnAnual = document.getElementById('btn-resumen-anual');
                            if (btnAnual) {
                                btnAnual.onclick = function () {
                                    // Limpia el contenedor antes de mostrar los anuales
                                    const contenedor = document.getElementById('contenedor-resumen-mensual');
                                    if (contenedor) contenedor.innerHTML = '';
                                    mostrarListaResumenesAnuales();
                                };
                            }
                        }, 100);
                    }
                    if (btnId === 'btn-comprobantes') {
                        cuadro.innerHTML = `<div class="panel panel-default" style="margin:30px auto;max-width:500px;"><div class="panel-heading"><strong>Comprobantes</strong></div><div class="panel-body" style="text-align:center;">(Contenido de comprobantes)</div></div>`;
                    }
                }
            });
        }
    });

    // --- FUNCIONES DE RESUMENES MENSUALES ---
    function mostrarListaResumenesMensuales() {
        const contenedor = document.getElementById('contenedor-resumen-mensual');
        if (!contenedor) return;

        // Generar lista de meses desde Abril-2025 hasta el mes anterior al actual
        const meses = [];
        const inicio = new Date(2025, 3, 1); // Abril es mes 3 (0-index)
        const hoy = new Date();
        let actual = new Date(inicio);

        while (
            actual.getFullYear() < hoy.getFullYear() ||
            (actual.getFullYear() === hoy.getFullYear() && actual.getMonth() < hoy.getMonth())
        ) {
            meses.push({
                nombre: obtenerNombreMes(actual.getMonth()) + '-' + actual.getFullYear(),
                inicio: new Date(actual.getFullYear(), actual.getMonth(), 1),
                fin: new Date(actual.getFullYear(), actual.getMonth() + 1, 0)
            });
            actual.setMonth(actual.getMonth() + 1);
        }

        contenedor.innerHTML = `
            <div style="margin-bottom:15px;"><strong>Seleccione un periodo:</strong></div>
            <div style="max-width:350px;margin:0 auto;">
                <select id="select-resumen-mensual" class="form-control">
                    <option value="">-- Seleccione un mes --</option>
                    ${meses.map(mes => `
                        <option value="${mes.nombre}" data-inicio="${mes.inicio.toISOString().slice(0, 10)}" data-fin="${mes.fin.toISOString().slice(0, 10)}">
                            ${mes.nombre}
                        </option>
                    `).join('')}
                </select>
            </div>
            <div id="panel-resumen-mensual-detalle" style="margin-top:30px;"></div>
        `;

        // Evento para el select
        const select = document.getElementById('select-resumen-mensual');
        if (select) {
            select.onchange = function () {
                const selected = select.options[select.selectedIndex];
                const periodo = selected.value;
                const desde = selected.getAttribute('data-inicio');
                const hasta = selected.getAttribute('data-fin');
                if (periodo && desde && hasta) {
                    obtenerResumenMensual(periodo, desde, hasta);
                } else {
                    document.getElementById('panel-resumen-mensual-detalle').innerHTML = '';
                }
            };
        }
    }

    function obtenerNombreMes(mesIdx) {
        const nombres = [
            'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
            'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
        ];
        return nombres[mesIdx];
    }

    // Simulación de consulta al backend y render de resumen mensual
    function obtenerResumenMensual(periodo, desde, hasta) {
        const panel = document.getElementById('panel-resumen-mensual-detalle');
        if (!panel) return;
        panel.innerHTML = `<div style="text-align:center;margin:30px;"><i class="fa fa-spinner fa-spin"></i> Consultando movimientos...</div>`;

        // Simula consulta al backend
        setTimeout(() => {
            // Simulación de movimientos recibidos del backend
            const movimientos = [
                { fecha: '2025-04-02', descripcion: 'Cobro paciente', ingreso: 12000, gasto: 0 },
                { fecha: '2025-04-05', descripcion: 'Compra insumos', ingreso: 0, gasto: 3500 },
                { fecha: '2025-04-10', descripcion: 'Cobro obra social', ingreso: 8000, gasto: 0 },
                { fecha: '2025-04-15', descripcion: 'Pago alquiler', ingreso: 0, gasto: 5000 },
                { fecha: '2025-04-20', descripcion: 'Cobro paciente', ingreso: 9000, gasto: 0 }
            ];
            // Calcula totales
            const ingresoTotal = movimientos.reduce((s, m) => s + (parseFloat(m.ingreso) || 0), 0);
            const gastoTotal = movimientos.reduce((s, m) => s + (parseFloat(m.gasto) || 0), 0);
            const neto = ingresoTotal - gastoTotal;

            panel.innerHTML = `
                <div class="panel panel-default" style="max-width:600px;margin:0 auto;">
                    <div class="panel-heading"><strong>Resumen mensual: ${periodo}</strong></div>
                    <div class="panel-body">
                        <table class="table table-bordered">
                            <thead>
                                <tr>
                                    <th>Periodo</th>
                                    <th>Ingreso total</th>
                                    <th>Gasto total</th>
                                    <th>Neto mensual</th>
                                    <th>Imprimir detalle</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>${periodo}</td>
                                    <td>$${ingresoTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                                    <td>$${gastoTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                                    <td>$${neto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                                    <td style="text-align:center;">
                                        <button id="btn-imprimir-detalle" class="btn btn-link" title="Imprimir">
                                            <i class="fa fa-print"></i>
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            `;

            // Evento imprimir detalle
            setTimeout(() => {
                const btnImprimir = document.getElementById('btn-imprimir-detalle');
                if (btnImprimir) {
                    btnImprimir.onclick = function () {
                        imprimirDetalleMensual(periodo, movimientos, ingresoTotal, gastoTotal, neto);
                    };
                }
            }, 100);
        }, 1000);
    }

    // Genera plantilla de impresión para el detalle mensual
    function imprimirDetalleMensual(periodo, movimientos, ingresoTotal, gastoTotal, neto) {
        // Crea ventana nueva para imprimir
        const win = window.open('', '', 'width=900,height=700');
        let html = `
            <html>
            <head>
                <title>Detalle facturación periodo ${periodo}</title>
                <link rel="stylesheet" href="css/bootstrap.min.css">
                <style>
                    body { font-family: Arial, sans-serif; margin: 30px; }
                    h2 { text-align: center; margin-bottom: 30px; }
                    table { width: 100%; margin-bottom: 30px; border-collapse: collapse; border:1px solid #888; }
                    th, td { text-align: center; border:1px solid #888; }
                    .resumen-final td { font-weight: bold; }
                </style>
            </head>
            <body>
                <h2>Detalle facturación periodo ${periodo}</h2>
                <table class="table table-bordered">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Descripción</th>
                            <th>Ingreso</th>
                            <th>Gasto</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${movimientos.map(m => `
                            <tr>
                                <td>${m.fecha}</td>
                                <td>${m.descripcion}</td>
                                <td>${m.ingreso ? '$' + parseFloat(m.ingreso).toLocaleString('es-AR', { minimumFractionDigits: 2 }) : ''}</td>
                                <td>${m.gasto ? '$' + parseFloat(m.gasto).toLocaleString('es-AR', { minimumFractionDigits: 2 }) : ''}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <table class="table table-bordered resumen-final">
                    <tr>
                        <td style="text-align:left;">Ingreso total</td>
                        <td style="text-align:right;">$${ingresoTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                        <td style="text-align:left;">Gasto total</td>
                        <td style="text-align:right;">$${gastoTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                        <td style="text-align:left;">Neto mensual</td>
                        <td style="text-align:right;">$${neto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    </tr>
                </table>
            </body>
            </html>
        `;
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 500);
    }

    // --- FUNCIONES DE RESUMENES ANUALES ---
    function mostrarListaResumenesAnuales() {
        const contenedor = document.getElementById('contenedor-resumen-mensual');
        if (!contenedor) return;
        contenedor.innerHTML = ''; // Limpia cualquier contenido previo

        // Generar lista de años desde 2025 hasta el actual
        const anioInicio = 2025;
        const hoy = new Date();
        const anioActual = hoy.getFullYear();
        const anios = [];
        for (let anio = anioInicio; anio <= anioActual; anio++) {
            let inicio = `${anio}-01-01`;
            let fin;
            if (anio === anioActual) {
                // Si es el año actual, hasta hoy
                fin = hoy.toISOString().slice(0, 10);
            } else {
                // Si es año pasado, hasta 31/12
                fin = `${anio}-12-31`;
            }
            anios.push({ nombre: anio.toString(), inicio, fin });
        }

        contenedor.innerHTML = `
            <div style="margin-bottom:15px;"><strong>Seleccione un año:</strong></div>
            <div style="max-width:350px;margin:0 auto;">
                <select id="select-resumen-anual" class="form-control">
                    <option value="">-- Seleccione un año --</option>
                    ${anios.map(anio => `
                        <option value="${anio.nombre}" data-inicio="${anio.inicio}" data-fin="${anio.fin}">
                            ${anio.nombre}
                        </option>
                    `).join('')}
                </select>
            </div>
            <div id="panel-resumen-anual-detalle" style="margin-top:30px;"></div>
        `;

        // Evento para el select
        const select = document.getElementById('select-resumen-anual');
        if (select) {
            select.onchange = function () {
                const selected = select.options[select.selectedIndex];
                const periodo = selected.value;
                const desde = selected.getAttribute('data-inicio');
                const hasta = selected.getAttribute('data-fin');
                if (periodo && desde && hasta) {
                    obtenerResumenAnual(periodo, desde, hasta);
                } else {
                    document.getElementById('panel-resumen-anual-detalle').innerHTML = '';
                }
            };
        }
    }

    // Simulación de consulta al backend y render de resumen anual
    function obtenerResumenAnual(anio, desde, hasta) {
        const panel = document.getElementById('panel-resumen-anual-detalle');
        if (!panel) return;
        panel.innerHTML = `<div style="text-align:center;margin:30px;"><i class="fa fa-spinner fa-spin"></i> Consultando movimientos...</div>`;

        // Simula consulta al backend
        setTimeout(() => {
            // Simulación: resumen mensual para cada mes del año seleccionado
            const hoy = new Date();
            const meses = [];
            for (let m = 0; m < 12; m++) {
                const mesInicio = new Date(anio, m, 1);
                const mesFin = new Date(anio, m + 1, 0);
                // Si el mes es futuro, no lo agregues
                if (
                    mesInicio > hoy ||
                    (anio == hoy.getFullYear() && m > hoy.getMonth())
                ) break;

                // Simulación de totales mensuales
                const ingreso = Math.floor(Math.random() * 20000 + 5000);
                const gasto = Math.floor(Math.random() * 10000 + 2000);
                meses.push({
                    nombre: obtenerNombreMes(m) + '-' + anio,
                    ingreso,
                    gasto,
                    neto: ingreso - gasto
                });
            }

            const ingresoTotal = meses.reduce((s, m) => s + m.ingreso, 0);
            const gastoTotal = meses.reduce((s, m) => s + m.gasto, 0);
            const neto = ingresoTotal - gastoTotal;

            panel.innerHTML = `
                <div class="panel panel-default" style="max-width:700px;margin:0 auto;">
                    <div class="panel-heading"><strong>Resumen anual: ${anio}</strong></div>
                    <div class="panel-body">
                        <table class="table table-bordered">
                            <thead>
                                <tr>
                                    <th>Periodo</th>
                                    <th>Ingreso total</th>
                                    <th>Gasto total</th>
                                    <th>Neto anual</th>
                                    <th>Imprimir detalle</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>${anio}</td>
                                    <td>$${ingresoTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                                    <td>$${gastoTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                                    <td>$${neto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                                    <td style="text-align:center;">
                                        <button id="btn-imprimir-detalle-anual" class="btn btn-link" title="Imprimir">
                                            <i class="fa fa-print"></i>
                                        </button>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                        <div style="margin-top:30px;">
                            <strong>Detalle mensual:</strong>
                            <table class="table table-bordered">
                                <thead>
                                    <tr>
                                        <th>Mes</th>
                                        <th>Ingreso</th>
                                        <th>Gasto</th>
                                        <th>Neto</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${meses.map(m => `
                                        <tr>
                                            <td>${m.nombre}</td>
                                            <td>$${m.ingreso.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                                            <td>$${m.gasto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                                            <td>$${m.neto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;

            // Evento imprimir detalle anual
            setTimeout(() => {
                const btnImprimir = document.getElementById('btn-imprimir-detalle-anual');
                if (btnImprimir) {
                    btnImprimir.onclick = function () {
                        imprimirDetalleAnual(anio, meses, ingresoTotal, gastoTotal, neto);
                    };
                }
            }, 100);
        }, 1000);
    }

    // Imprime resumen anual mostrando solo los totales mensuales
    function imprimirDetalleAnual(anio, meses, ingresoTotal, gastoTotal, neto) {
        const win = window.open('', '', 'width=900,height=700');
        let html = `
            <html>
            <head>
                <title>Detalle facturación anual ${anio}</title>
                <link rel="stylesheet" href="css/bootstrap.min.css">
                <style>
                    body { font-family: Arial, sans-serif; margin: 30px; }
                    h2 { text-align: center; margin-bottom: 30px; }
                    table { width: 100%; margin-bottom: 30px; border-collapse: collapse; border:1px solid #888; }
                    th, td { text-align: center; border:1px solid #888; }
                    .resumen-final td { font-weight: bold; }
                </style>
            </head>
            <body>
                <h2>Detalle facturación anual ${anio}</h2>
                <table class="table table-bordered">
                    <thead>
                        <tr>
                            <th>Mes</th>
                            <th>Ingreso</th>
                            <th>Gasto</th>
                            <th>Neto</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${meses.map(m => `
                            <tr>
                                <td>${m.nombre}</td>
                                <td>$${m.ingreso.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                                <td>$${m.gasto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                                <td>$${m.neto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <table class="table table-bordered resumen-final">
                    <tr>
                        <td style="text-align:left;">Ingreso total</td>
                        <td style="text-align:right;">$${ingresoTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                        <td style="text-align:left;">Gasto total</td>
                        <td style="text-align:right;">$${gastoTotal.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    </tr>
                    <tr>
                        <td style="text-align:left;">Neto anual</td>
                        <td style="text-align:right;">$${neto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    </tr>
                </table>
            </body>
            </html>
        `;
        win.document.write(html);
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 500);
    }

    // --- NUEVO CÓDIGO: AGENDA Y TURNOS ---
    const btnVerAgenda = document.getElementById('btn-ver-agenda');
    const btnEditarTurnos = document.getElementById('btn-editar-turnos');
    const agendaTurnosCuadro = document.getElementById('agenda-turnos-cuadro');
    const editarTurnosCuadro = document.getElementById('editar-turnos-cuadro');

    if (btnVerAgenda && btnEditarTurnos && agendaTurnosCuadro && editarTurnosCuadro) {
        btnVerAgenda.onclick = function () {
            agendaTurnosCuadro.style.display = 'block';
            editarTurnosCuadro.style.display = 'none';
            agendaTurnosCuadro.innerHTML = '<div class="panel panel-default"><div class="panel-heading"><strong>Agenda de turnos</strong></div><div class="panel-body">Aquí se mostrará la agenda.</div></div>';
        };
        btnEditarTurnos.onclick = function () {
            editarTurnosCuadro.style.display = 'block';
            agendaTurnosCuadro.style.display = 'none';
            editarTurnosCuadro.innerHTML = '<div class="panel panel-default"><div class="panel-heading"><strong>Editar turnos</strong></div><div class="panel-body">Aquí se podrá editar los turnos.</div></div>';
        };
    }

    // --- CÓDIGO DEL CALENDARIO DE TURNOS CON LOCALSTORAGE Y CITAS PERIÓDICAS ---
    let calendar; // Principal
    let calendarPeriodico; // Nuevo calendario para citas periódicas

    function inicializarCalendarioTurnos() {
        const calendarioDiv = document.getElementById('calendario-turnos');
        const btnCitaPeriodica = document.getElementById('btn-cita-periodica');
        const contenedorPeriodico = document.getElementById('contenedor-cita-periodica');

        // Si el botón no existe, lo agregamos
        if (!btnCitaPeriodica) {
            const btn = document.createElement('button');
            btn.id = 'btn-cita-periodica';
            btn.className = 'btn btn-primary';
            btn.innerText = 'Generar cita periódica';
            calendarioDiv.parentNode.insertBefore(btn, calendarioDiv);
        }

        // Si el contenedor no existe, lo agregamos
        if (!contenedorPeriodico) {
            const div = document.createElement('div');
            div.id = 'contenedor-cita-periodica';
            div.style.display = 'none';
            calendarioDiv.parentNode.appendChild(div);
        }

        // Funciones para manejar turnos en localStorage
        function cargarTurnosLS() {
            try {
                return JSON.parse(localStorage.getItem('turnos-smiles')) || [];
            } catch {
                return [];
            }
        }
        function guardarTurnosLS(turnos) {
            localStorage.setItem('turnos-smiles', JSON.stringify(turnos));
        }

        // Inicializa el calendario principal
        let turnos = cargarTurnosLS();

        if (!calendar) {
            calendar = new FullCalendar.Calendar(calendarioDiv, {
                initialView: 'dayGridMonth',
                locale: 'es',
                headerToolbar: {
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth,timeGridWeek,timeGridDay'
                },
                buttonText: {
                    today: 'Hoy',
                    month: 'Mes',
                    week: 'Semana',
                    day: 'Día',
                    list: 'Agenda'
                },
                selectable: true,
                editable: true,
                events: turnos,
                slotMinTime: "08:00:00",
                slotMaxTime: "18:00:00",
                slotDuration: "01:00:00",
                allDaySlot: false,
                height: "auto",
                slotLabelFormat: {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                },
                dateClick: function (info) {
                    const isTimeGrid = calendar.view.type === 'timeGridWeek' || calendar.view.type === 'timeGridDay';
                    const paciente = prompt('Nombre del paciente para el turno:');
                    if (paciente) {
                        const nuevoTurno = {
                            id: Date.now().toString(),
                            title: paciente,
                            start: info.dateStr,
                            allDay: !isTimeGrid
                        };
                        calendar.addEvent(nuevoTurno);
                        turnos.push(nuevoTurno);
                        guardarTurnosLS(turnos);
                    }
                },
                eventClick: function (info) {
                    if (confirm('¿Eliminar este turno?')) {
                        info.event.remove();
                        turnos = turnos.filter(ev => ev.id !== info.event.id);
                        guardarTurnosLS(turnos);
                    }
                },
                eventDrop: function (info) {
                    const idx = turnos.findIndex(ev => ev.id === info.event.id);
                    if (idx !== -1) {
                        turnos[idx].start = info.event.startStr;
                        if (info.event.end) turnos[idx].end = info.event.endStr;
                        turnos[idx].allDay = info.event.allDay;
                        guardarTurnosLS(turnos);
                    }
                },
                eventResize: function (info) {
                    const idx = turnos.findIndex(ev => ev.id === info.event.id);
                    if (idx !== -1) {
                        turnos[idx].start = info.event.startStr;
                        if (info.event.end) turnos[idx].end = info.event.endStr;
                        turnos[idx].allDay = info.event.allDay;
                        guardarTurnosLS(turnos);
                    }
                }
            });
            calendar.render();
        } else {
            calendar.render();
            calendar.updateSize();
        }

        // Evento para mostrar el calendario de citas periódicas
        document.getElementById('btn-cita-periodica').onclick = function () {
            calendarioDiv.style.display = 'none';
            document.getElementById('btn-cita-periodica').style.display = 'none';
            document.getElementById('contenedor-cita-periodica').style.display = 'block';

            // Renderizar calendario semanal para citas periódicas
            renderizarCalendarioPeriodico();
        };

        function renderizarCalendarioPeriodico() {
            const contenedor = document.getElementById('contenedor-cita-periodica');
            contenedor.innerHTML = `
                <button id="btn-volver-calendario" class="btn btn-secondary" style="margin-bottom:15px;">Volver al calendario</button>
                <div id="calendario-periodico"></div>
                <div id="opciones-periodicas" style="margin-top:20px; display:none;">
                    <div><strong>Repetir:</strong></div>
                    <label><input type="radio" name="repeticion" value="semanal" checked> Semanalmente</label>
                    <label style="margin-left:15px;"><input type="radio" name="repeticion" value="2semanas"> Cada 2 semanas</label>
                    <label style="margin-left:15px;"><input type="radio" name="repeticion" value="mensual"> Mensualmente</label>
                    <div style="margin-top:10px;">
                        <label>Hasta: <input type="date" id="fecha-hasta-periodica" required></label>
                    </div>
                    <button id="btn-registrar-periodica" class="btn btn-success" style="margin-top:15px;">Registrar cita periódica</button>
                </div>
            `;

            // Botón volver
            document.getElementById('btn-volver-calendario').onclick = function () {
                contenedor.style.display = 'none';
                calendarioDiv.style.display = '';
                document.getElementById('btn-cita-periodica').style.display = '';
            };

            // Inicializar calendario semanal
            const calendarioPeriodicoDiv = document.getElementById('calendario-periodico');
            let turnosSemana = cargarTurnosLS().filter(ev => {
                const fecha = new Date(ev.start);
                return fecha.getDay() >= 1 && fecha.getDay() <= 5; // Lunes a viernes
            });

            if (calendarPeriodico) {
                calendarPeriodico.destroy();
            }

            calendarPeriodico = new FullCalendar.Calendar(calendarioPeriodicoDiv, {
                initialView: 'timeGridWeek',
                locale: 'es',
                headerToolbar: false,
                slotMinTime: "08:00:00",
                slotMaxTime: "18:00:00",
                slotDuration: "01:00:00",
                allDaySlot: false,
                height: "auto",
                selectable: true,
                editable: false,
                weekends: false,
                events: turnosSemana,
                slotLabelFormat: {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                },
                dateClick: function (info) {
                    // Mostrar opciones de repetición debajo
                    const opciones = document.getElementById('opciones-periodicas');
                    opciones.style.display = 'block';
                    opciones.setAttribute('data-fecha', info.dateStr);
                }
            });
            calendarPeriodico.render();

            // Registrar cita periódica
            document.getElementById('btn-registrar-periodica').onclick = function () {
                const opciones = document.getElementById('opciones-periodicas');
                const fechaElegida = opciones.getAttribute('data-fecha');
                const repeticion = document.querySelector('input[name="repeticion"]:checked').value;
                const fechaHasta = document.getElementById('fecha-hasta-periodica').value;
                if (!fechaElegida || !fechaHasta) {
                    alert('Debe seleccionar un horario y una fecha de finalización.');
                    return;
                }
                const paciente = prompt('Nombre del paciente para la cita periódica:');
                if (!paciente) return;

                // Generar las fechas de repetición
                let eventos = [];
                let fechaActual = new Date(fechaElegida);
                const fin = new Date(fechaHasta);
                let incremento = 7; // días
                if (repeticion === '2semanas') incremento = 14;
                if (repeticion === 'mensual') incremento = 30;

                while (fechaActual <= fin) {
                    eventos.push({
                        id: Date.now().toString() + Math.random(),
                        title: paciente,
                        start: fechaActual.toISOString(),
                        allDay: false
                    });
                    if (repeticion === 'mensual') {
                        // Avanza un mes exacto
                        const mes = fechaActual.getMonth();
                        fechaActual.setMonth(mes + 1);
                    } else {
                        fechaActual.setDate(fechaActual.getDate() + incremento);
                    }
                }

                // Guardar en localStorage y actualizar ambos calendarios
                let turnos = cargarTurnosLS();
                turnos = turnos.concat(eventos);
                guardarTurnosLS(turnos);

                alert('Cita periódica registrada.');
                // Volver al calendario principal
                document.getElementById('btn-volver-calendario').click();
                inicializarCalendarioTurnos();
            };
        }
    }

    // --- INSUMOS: PANEL ÚNICO, SIN PAGINACIÓN, LISTADO COMPLETO CON SCROLL ---
    // --- INSUMOS: PANEL ÚNICO, SIN PAGINACIÓN, LISTADO COMPLETO CON SCROLL ---

    function inicializarSeccionInsumos() {
        const seccion = document.getElementById('panel-insumos-dinamico');
        if (!seccion) return;

        seccion.innerHTML = `
            <div id="panel-busqueda-insumos"></div>
            <div id="panel-listado-insumos"></div>
        `;

        renderBusquedaInsumos();
        renderListadoInsumos();
    }

    // Panel de búsqueda único
    function renderBusquedaInsumos() {
        const panel = document.getElementById('panel-busqueda-insumos');
        panel.innerHTML = `
            <form id="form-busqueda-insumos" class="form-inline" style="margin-bottom:15px;">
                <input type="text" id="input-buscar-insumo" class="form-control" placeholder="Buscar insumo..." style="width:220px;max-width:90%;">
                <button type="submit" class="btn btn-primary" style="margin-left:10px;">Buscar</button>
            </form>
            <div style="margin-bottom:10px;">Buscar por:</div>
            <label><input type="radio" name="filtro-insumo" value="nombre" checked> Nombre</label>
            <label style="margin-left:15px;"><input type="radio" name="filtro-insumo" value="cantidad"> Cantidad</label>
        `;

        // Validación del input según filtro
        const input = document.getElementById('input-buscar-insumo');
        const radios = panel.querySelectorAll('input[name="filtro-insumo"]');
        radios.forEach(radio => {
            radio.onchange = function () {
                if (this.value === 'cantidad') {
                    input.value = '';
                    input.type = 'number';
                    input.min = 0;
                    input.pattern = '\\d+';
                    input.placeholder = 'Buscar cantidad...';
                } else {
                    input.value = '';
                    input.type = 'text';
                    input.removeAttribute('min');
                    input.removeAttribute('pattern');
                    input.placeholder = 'Buscar insumo...';
                }
            };
        });

        // Evento de búsqueda
        document.getElementById('form-busqueda-insumos').onsubmit = function (e) {
            e.preventDefault();
            renderListadoInsumos(input.value, panel.querySelector('input[name="filtro-insumo"]:checked').value);
        };
    }

    // Simulación de datos en localStorage (solo una lista)
    function cargarInsumosLS() {
        try {
            return JSON.parse(localStorage.getItem('insumos-unico')) || [];
        } catch {
            return [];
        }
    }
    function guardarInsumosLS(datos) {
        localStorage.setItem('insumos-unico', JSON.stringify(datos));
    }

    // Renderiza el listado de insumos (máx 30, con scroll)
    function renderListadoInsumos(filtro = '', modo = 'nombre') {
        const panel = document.getElementById('panel-listado-insumos');
        let insumos = cargarInsumosLS();

        // Filtro
        if (filtro) {
            if (modo === 'nombre') {
                insumos = insumos.filter(i => i.descripcion && i.descripcion.toLowerCase().includes(filtro.toLowerCase()));
            } else {
                insumos = insumos.filter(i => String(i.cantidad) === String(filtro));
            }
        }

        // Solo mostrar hasta 30, pero permitir scroll si hay más
        const maxMostrar = 30;
        const insumosMostrar = insumos.slice(0, maxMostrar);

        panel.innerHTML = `
            <div class="table-responsive" style="max-height:600px;overflow-y:auto;">
                <table class="table table-bordered table-striped" id="tabla-insumos-unico">
                    <thead>
                        <tr>
                            <th style="width:20%;">Fecha de ingreso</th>
                            <th style="width:40%;">Descripción</th>
                            <th style="width:20%;">Fecha Vencimiento</th>
                            <th style="width:10%;">Cantidad</th>
                            <th style="width:10%;">Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${insumosMostrar.map((insumo, idx) => `
                            <tr data-idx="${idx}">
                                <td>${insumo.fechaIngreso || ''}</td>
                                <td style="text-align:left;">${insumo.descripcion || ''}</td>
                                <td>${insumo.fechaVencimiento || ''}</td>
                                <td>${insumo.cantidad != null ? insumo.cantidad : ''}</td>
                                <td>
                                    <button class="btn-editar-insumo btn btn-link" title="Editar"><i class="fa fa-edit"></i></button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div style="text-align:center;margin:20px 0;">
                <button class="btn btn-link" id="btn-agregar-insumo" title="Agregar insumo" style="font-size:2em;">
                    <i class="fa fa-plus-circle"></i>
                </button>
            </div>
            <div style="text-align:center;margin-bottom:20px;">
                <span style="color:#888;">Mostrando ${insumosMostrar.length} de ${insumos.length} insumos</span>
            </div>
        `;

        // Agregar insumo
        const btnAgregar = panel.querySelector('#btn-agregar-insumo');
        if (btnAgregar) {
            btnAgregar.onclick = function () {
                // Si ya hay una fila nueva sin guardar, no agregues otra
                if (panel.querySelector('input, textarea')) return;
                renderListadoInsumosConFilaNueva(filtro, modo, true);
            };
        }

        // Editar insumo
        panel.querySelectorAll('.btn-editar-insumo').forEach(btn => {
            btn.onclick = function () {
                const tr = this.closest('tr');
                if (panel.querySelector('input, textarea')) return;
                const idx = parseInt(tr.getAttribute('data-idx'), 10);
                let datos = cargarInsumosLS();
                editarFilaInsumo(tr, datos, false, filtro, modo, idx);
            };
        });
    }

    // Renderiza la tabla con una fila nueva editable al principio
    function renderListadoInsumosConFilaNueva(filtro, modo, agregarNueva) {
        const panel = document.getElementById('panel-listado-insumos');
        let insumos = cargarInsumosLS();

        // Filtro
        if (filtro) {
            if (modo === 'nombre') {
                insumos = insumos.filter(i => i.descripcion && i.descripcion.toLowerCase().includes(filtro.toLowerCase()));
            } else {
                insumos = insumos.filter(i => String(i.cantidad) === String(filtro));
            }
        }

        // Solo mostrar hasta 30, pero permitir scroll si hay más
        const maxMostrar = 30;
        let insumosMostrar = insumos.slice(0, maxMostrar);

        if (agregarNueva) {
            insumosMostrar.unshift({ fechaIngreso: '', descripcion: '', fechaVencimiento: '', cantidad: '', _nuevo: true });
        }

        panel.innerHTML = `
            <div class="table-responsive" style="max-height:600px;overflow-y:auto;">
                <table class="table table-bordered table-striped" id="tabla-insumos-unico">
                    <thead>
                        <tr>
                            <th style="width:20%;">Fecha de ingreso</th>
                            <th style="width:40%;">Descripción</th>
                            <th style="width:20%;">Fecha Vencimiento</th>
                            <th style="width:10%;">Cantidad</th>
                            <th style="width:10%;">Acción</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${insumosMostrar.map((insumo, idx) => `
                            <tr data-idx="${idx}">
                                <td>${insumo.fechaIngreso || ''}</td>
                                <td style="text-align:left;">${insumo.descripcion || ''}</td>
                                <td>${insumo.fechaVencimiento || ''}</td>
                                <td>${insumo.cantidad != null ? insumo.cantidad : ''}</td>
                                <td>
                                    <button class="btn-editar-insumo btn btn-link" title="Editar"><i class="fa fa-edit"></i></button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div style="text-align:center;margin:20px 0;">
                <button class="btn btn-link" id="btn-agregar-insumo" title="Agregar insumo" style="font-size:2em;">
                    <i class="fa fa-plus-circle"></i>
                </button>
            </div>
            <div style="text-align:center;margin-bottom:20px;">
                <span style="color:#888;">Mostrando ${insumosMostrar.length} de ${insumos.length} insumos</span>
            </div>
        `;

        // Después de renderizar, si hay una fila nueva, ponla en modo edición
        if (agregarNueva) {
            const nuevaFila = panel.querySelector('tbody tr');
            if (nuevaFila) {
                editarFilaInsumo(nuevaFila, cargarInsumosLS(), true, filtro, modo, 0);
            }
        }

        // Agregar insumo
        const btnAgregar = panel.querySelector('#btn-agregar-insumo');
        if (btnAgregar) {
            btnAgregar.onclick = function () {
                if (panel.querySelector('input, textarea')) return;
                renderListadoInsumosConFilaNueva(filtro, modo, true);
            };
        }

        // Editar insumo
        panel.querySelectorAll('.btn-editar-insumo').forEach(btn => {
            btn.onclick = function () {
                const tr = this.closest('tr');
                if (panel.querySelector('input, textarea')) return;
                const idx = parseInt(tr.getAttribute('data-idx'), 10);
                let datos = cargarInsumosLS();
                editarFilaInsumo(tr, datos, false, filtro, modo, idx);
            };
        });
    }

    // Editar/agregar fila de insumo
    function editarFilaInsumo(tr, insumos, esNuevo, filtro, modo, idx) {
        const tds = tr.querySelectorAll('td');
        const original = Array.from(tds).map(td => td.innerHTML);

        tds[0].innerHTML = `<input type="date" class="form-control" value="${tds[0].textContent.trim()}" style="width:100%;min-width:90px;text-align:center;">`;
        tds[1].innerHTML = `<input type="text" class="form-control" value="${tds[1].textContent.trim()}" style="width:100%;min-width:120px;text-align:center;" required>`;
        tds[2].innerHTML = `<input type="date" class="form-control" value="${tds[2].textContent.trim()}" style="width:100%;min-width:90px;text-align:center;">`;
        tds[3].innerHTML = `<input type="number" class="form-control" value="${tds[3].textContent.trim()}" min="0" style="width:100%;min-width:70px;text-align:center;" required>`;
        tds[4].innerHTML = `
            <button class="btn-guardar-insumo btn btn-success btn-xs" title="Guardar"><i class="fa fa-check"></i></button>
            <button class="btn-cancelar-insumo btn btn-danger btn-xs" title="Cancelar"><i class="fa fa-times"></i></button>
            <button class="btn-eliminar-insumo btn btn-warning btn-xs" title="Eliminar"><i class="fa fa-trash"></i></button>
        `;

        // Guardar
        tds[4].querySelector('.btn-guardar-insumo').onclick = function () {
            const fechaIngreso = tds[0].querySelector('input').value;
            const descripcion = tds[1].querySelector('input').value.trim();
            const fechaVencimiento = tds[2].querySelector('input').value;
            const cantidad = tds[3].querySelector('input').value.trim();

            if (!descripcion || cantidad === '') {
                alert('Debe completar Descripción y Cantidad.');
                return;
            }
            if (!/^\d+$/.test(cantidad)) {
                alert('Cantidad debe ser un número entero positivo o 0.');
                return;
            }

            let datos = cargarInsumosLS();
            if (esNuevo) {
                datos.unshift({ fechaIngreso, descripcion, fechaVencimiento, cantidad: parseInt(cantidad, 10) });
            } else {
                datos[idx] = { fechaIngreso, descripcion, fechaVencimiento, cantidad: parseInt(cantidad, 10) };
            }
            guardarInsumosLS(datos);
            renderListadoInsumos(filtro, modo);
        };

        // Cancelar
        tds[4].querySelector('.btn-cancelar-insumo').onclick = function () {
            renderListadoInsumos(filtro, modo);
        };

        // Eliminar
        tds[4].querySelector('.btn-eliminar-insumo').onclick = function () {
            if (confirm('¿Está seguro que desea eliminar este insumo? Esta acción no se puede deshacer.')) {
                let datos = cargarInsumosLS();
                datos.splice(idx, 1);
                guardarInsumosLS(datos);
                renderListadoInsumos(filtro, modo);
            }
        };
    }
});
