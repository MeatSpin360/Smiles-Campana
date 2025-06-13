document.addEventListener('DOMContentLoaded', function () {
    // --- ELIMINAR LOGIN, ACCESO LIBRE A LA INTRANET ---
    // Elimina el contenedor de login si existe
    const loginContainer = document.getElementById('login-container');
    if (loginContainer) loginContainer.remove();

    // Muestra el contenido principal de la intranet
    const mainContent = document.getElementById('intranet-home');
    if (mainContent) mainContent.style.display = '';

    // Elimina cualquier referencia o validación de login
    let logueado = true;

    // Elimina cualquier evento de submit del login (por si queda en el DOM)
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.onsubmit = function (e) {
            e.preventDefault();
            return false;
        };
    }

    // Elimina validaciones de login en la navegación
    document.querySelectorAll('.navbar-nav li a.smoothScroll').forEach(link => {
        link.addEventListener('click', function (e) {
            // Oculta todas las secciones
            if (mainContent) mainContent.style.display = 'none';
            secciones.forEach(sec => {
                const s = document.getElementById(sec.id);
                if (s) s.style.display = 'none';
            });
            // Muestra la sección correspondiente
            const texto = this.textContent.trim();
            const sec = secciones.find(sec => sec.btn.toLowerCase() === texto.toLowerCase());
            if (sec) {
                const s = document.getElementById(sec.id);
                if (s) s.style.display = '';
                if (sec.id === 'seccion-turnos') {
                    setTimeout(() => {
                        inicializarCalendarioTurnos();
                        if (calendar) calendar.updateSize();
                    }, 100);
                }
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

    // Mostrar cuadro de búsqueda y listado al hacer click en "Buscar paciente"
    if (btnBuscarPaciente && busquedaPaciente) {
        btnBuscarPaciente.addEventListener('click', function () {
            busquedaPaciente.style.display = 'block';
            nuevoPacienteForm.style.display = 'none';
            formNuevoPaciente.reset();
            const edadInput = document.getElementById('edad-nuevo');
            if (edadInput) edadInput.value = '';

            // --- Listado de pacientes de prueba ---
            const pacientes = [
                { id: 1, apellido: "García", nombre: "Ana", dni: "30123456", telefono: "1122334455", email: "ana@correo.com", fechaNac: "1990-05-10" },
                { id: 2, apellido: "Pérez", nombre: "Juan", dni: "28987654", telefono: "1133445566", email: "juan@correo.com", fechaNac: "1985-11-22" },
                { id: 3, apellido: "López", nombre: "María", dni: "31234567", telefono: "1144556677", email: "maria@correo.com", fechaNac: "1992-03-15" },
                { id: 4, apellido: "Fernández", nombre: "Carlos", dni: "32345678", telefono: "1155667788", email: "carlos@correo.com", fechaNac: "1988-07-30" },
                { id: 5, apellido: "Martínez", nombre: "Laura", dni: "33456789", telefono: "1166778899", email: "laura@correo.com", fechaNac: "1995-12-01" },
                { id: 6, apellido: "Gómez", nombre: "Pedro", dni: "34567890", telefono: "1177889900", email: "pedro@correo.com", fechaNac: "1982-09-18" },
                { id: 7, apellido: "Sánchez", nombre: "Lucía", dni: "35678901", telefono: "1188990011", email: "lucia@correo.com", fechaNac: "1998-02-25" },
                { id: 8, apellido: "Romero", nombre: "Diego", dni: "36789012", telefono: "1199001122", email: "diego@correo.com", fechaNac: "1987-06-12" },
                { id: 9, apellido: "Torres", nombre: "Sofía", dni: "37890123", telefono: "1100112233", email: "sofia@correo.com", fechaNac: "1993-11-05" },
                { id: 10, apellido: "Ruiz", nombre: "Martín", dni: "38901234", telefono: "1111223344", email: "martin@correo.com", fechaNac: "1989-04-20" },
                { id: 11, apellido: "Alvarez", nombre: "Valentina", dni: "39012345", telefono: "1122334456", email: "valentina@correo.com", fechaNac: "1996-08-14" },
                { id: 12, apellido: "Moreno", nombre: "Javier", dni: "40123456", telefono: "1133445567", email: "javier@correo.com", fechaNac: "1983-01-09" },
                { id: 13, apellido: "Muñoz", nombre: "Camila", dni: "41234567", telefono: "1144556678", email: "camila@correo.com", fechaNac: "1991-10-23" },
                { id: 14, apellido: "Jiménez", nombre: "Lucas", dni: "42345678", telefono: "1155667789", email: "lucas@correo.com", fechaNac: "1986-05-17" },
                { id: 15, apellido: "Díaz", nombre: "Florencia", dni: "43456789", telefono: "1166778890", email: "florencia@correo.com", fechaNac: "1994-12-29" }
            ];
            let pacientesFiltrados = pacientes.slice();

            function normalizarTexto(texto) {
                return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
            }

            function renderPacientesFiltrados() {
                renderTablaConPaginacion({
                    container: document.getElementById('tabla-pacientes-paginada'),
                    columnas: [
                        { titulo: 'Apellido', align: 'left' },
                        { titulo: 'Nombre', align: 'left' },
                        { titulo: 'DNI' },
                        { titulo: 'Edad' },
                        { titulo: 'Teléfono' },
                        { titulo: 'Email', align: 'left' }
                    ],
                    datos: pacientesFiltrados,
                    filasPorPagina: 10,
                    opcionesFilas: [10, 20, 50, 100],
                    renderFila: (p, idx) => {
                        let edad = '';
                        if (p.fechaNac) {
                            const hoy = new Date();
                            const fn = new Date(p.fechaNac);
                            edad = hoy.getFullYear() - fn.getFullYear();
                            const m = hoy.getMonth() - fn.getMonth();
                            if (m < 0 || (m === 0 && hoy.getDate() < fn.getDate())) {
                                edad--;
                            }
                            edad = isNaN(edad) ? '' : edad;
                        }
                        // Hacemos clickeable la fila
                        return `
                            <td style="text-align:left;cursor:pointer;" class="td-paciente" data-idx="${idx}">${p.apellido}</td>
                            <td style="text-align:left;cursor:pointer;" class="td-paciente" data-idx="${idx}">${p.nombre}</td>
                            <td style="cursor:pointer;" class="td-paciente" data-idx="${idx}">${p.dni}</td>
                            <td style="cursor:pointer;" class="td-paciente" data-idx="${idx}">${edad}</td>
                            <td style="cursor:pointer;" class="td-paciente" data-idx="${idx}">${p.telefono}</td>
                            <td style="text-align:left;cursor:pointer;" class="td-paciente" data-idx="${idx}">${p.email}</td>
                        `;
                    },
                    checkboxes: false
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

            // Renderiza la tabla paginada al abrir la sección
            renderPacientesFiltrados();
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

    // Renderiza la tabla with una fila nueva editable al principio
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
        panel.querySelectorAll('.btn-editar-insumo').forEach((btn) => {
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

    const secciones = [
        { id: 'intranet-home', btn: 'Bienvenido a la Intranet' },
        { id: 'seccion-pacientes', btn: 'Pacientes' },
        { id: 'seccion-turnos', btn: 'Turnos' },
        { id: 'seccion-contabilidad', btn: 'Contabilidad' },
        { id: 'seccion-mantenimiento', btn: 'Mantenimiento' },
        { id: 'seccion-insumos', btn: 'Insumos' }
    ];

    // --- NUEVO CÓDIGO: ACCESO DIRECTO A CARGA DE PACIENTE ---
    if (btnNuevoPaciente && nuevoPacienteForm && busquedaPaciente && formNuevoPaciente) {
        btnNuevoPaciente.addEventListener('click', function () {
            // Oculta el cuadro de búsqueda/listado
            busquedaPaciente.style.display = 'none';
            // Muestra el formulario de nuevo paciente
            nuevoPacienteForm.style.display = 'block';
            // Limpia el formulario
            formNuevoPaciente.reset();
            // Limpia edad calculada si existe
            const edadInput = document.getElementById('edad-nuevo');
            if (edadInput) edadInput.value = '';
        });
    }

    // --- FUNCIONES DE PAGINACIÓN Y CHECKBOXES GENERALES ---
    function renderTablaConPaginacion({
        container,
        columnas,
        datos,
        filasPorPagina = 10,
        opcionesFilas = [10, 20, 50, 100],
        onEditar,
        onEliminar,
        renderFila,
        renderCabeceraExtra = '',
        tablaId = '',
        tablaClass = '',
        checkboxes = false // <--- NUEVO: por defecto no hay checkboxes
    }) {
        let paginaActual = 1;
        let seleccionados = new Set();
        let filasPorPag = filasPorPagina;

        function render() {
            const totalPaginas = Math.ceil(datos.length / filasPorPag) || 1;
            paginaActual = Math.max(1, Math.min(paginaActual, totalPaginas));
            const inicio = (paginaActual - 1) * filasPorPag;
            const datosPagina = datos.slice(inicio, inicio + filasPorPag);

            // Cabecera de acciones (solo si hay checkboxes)
            let accionesHtml = checkboxes ? `
                <div style="display:flex;justify-content:flex-end;align-items:center;margin-bottom:10px;gap:10px;">
                    <button id="btn-editar-fila" class="btn btn-primary" ${seleccionados.size === 1 ? '' : 'disabled'}>Editar</button>
                    <button id="btn-eliminar-filas" class="btn btn-danger" ${seleccionados.size > 0 ? '' : 'disabled'}>Eliminar</button>
                </div>
            ` : '';

            // Paginación con selector de filas alineado a la derecha, debajo de la tabla
            let paginacion = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin:10px 0 0 0;">
        <div></div>
        <div style="flex:1;display:flex;align-items:center;justify-content:center;">
            <div>
                <button class="btn btn-default btn-xs" id="btn-pag-primera" ${paginaActual === 1 ? 'disabled' : ''} title="Primera página">
                    <i class="fa fa-angle-double-left"></i>
                </button>
                <button class="btn btn-default btn-xs" id="btn-pag-prev" ${paginaActual === 1 ? 'disabled' : ''} title="Anterior">
                    <i class="fa fa-angle-left"></i>
                </button>
                <span style="margin:0 15px;">Página ${paginaActual} de ${totalPaginas}</span>
                <button class="btn btn-default btn-xs" id="btn-pag-next" ${paginaActual === totalPaginas ? 'disabled' : ''} title="Siguiente">
                    <i class="fa fa-angle-right"></i>
                </button>
                <button class="btn btn-default btn-xs" id="btn-pag-ultima" ${paginaActual === totalPaginas ? 'disabled' : ''} title="Última página">
                    <i class="fa fa-angle-double-right"></i>
                </button>
            </div>
        </div>
        <div style="display:flex;align-items:center;justify-content:flex-end;min-width:220px;">
            <label style="margin-bottom:0;">
                Filas por página:
                <select id="select-filas-pagina" class="form-control" style="width:auto;display:inline-block;">
                    ${opcionesFilas.map(op => `<option value="${op}" ${op == filasPorPag ? 'selected' : ''}>${op}</option>`).join('')}
                </select>
            </label>
        </div>
    </div>
`;

            // Cabecera de la tabla
            let cabecera = `<tr>`;
            if (checkboxes) {
                cabecera += `<th style="text-align:center;"><input type="checkbox" id="check-todos"></th>`;
            }
            cabecera += columnas.map(col =>
                `<th style="text-align:center;${col.align ? ` text-align:${col.align};` : ''}">${col.titulo}</th>`
            ).join('');
            cabecera += renderCabeceraExtra + `</tr>`;

            // Filas de la tabla
            let filas = datosPagina.map((fila, idx) => {
                const globalIdx = inicio + idx;
                let filaHtml = `<tr data-idx="${globalIdx}">`;
                if (checkboxes) {
                    filaHtml += `<td><input type="checkbox" class="check-fila" data-idx="${globalIdx}" ${seleccionados.has(globalIdx) ? 'checked' : ''}></td>`;
                }
                filaHtml += renderFila(fila, globalIdx);
                filaHtml += `</tr>`;
                return filaHtml;
            }).join('');

            container.innerHTML = `
                ${accionesHtml}
                <div class="table-responsive">
                    <table class="table table-bordered table-striped ${tablaClass}" id="${tablaId}">
                        <thead>${cabecera}</thead>
                        <tbody>${filas}</tbody>
                    </table>
                </div>
                ${paginacion}
            `;

            // Eventos de paginación
            container.querySelector('#btn-pag-primera').onclick = () => { paginaActual = 1; render(); };
            container.querySelector('#btn-pag-prev').onclick = () => { paginaActual--; render(); };
            container.querySelector('#btn-pag-next').onclick = () => { paginaActual++; render(); };
            container.querySelector('#btn-pag-ultima').onclick = () => { paginaActual = totalPaginas; render(); };
            container.querySelector('#select-filas-pagina').onchange = function () {
                filasPorPag = parseInt(this.value, 10);
                paginaActual = 1;
                render();
            };

            if (checkboxes) {
                // Checkbox general
                const checkTodos = container.querySelector('#check-todos');
                checkTodos.checked = datosPagina.length > 0 && datosPagina.every((_, idx) => seleccionados.has(inicio + idx));
                checkTodos.onchange = function () {
                    datosPagina.forEach((_, idx) => {
                        const globalIdx = inicio + idx;
                        if (this.checked) {
                            seleccionados.add(globalIdx);
                        } else {
                            seleccionados.delete(globalIdx);
                        }
                    });
                    render();
                };

                // Checkbox por fila
                container.querySelectorAll('.check-fila').forEach(chk => {
                    chk.onchange = function () {
                        const idx = parseInt(this.getAttribute('data-idx'), 10);
                        if (this.checked) {
                            seleccionados.add(idx);
                        } else {
                            seleccionados.delete(idx);
                        }
                        render();
                    };
                });

                // Botones de acción
                container.querySelector('#btn-editar-fila').onclick = () => {
                    if (seleccionados.size === 1 && typeof onEditar === 'function') {
                        onEditar([...seleccionados][0]);
                    }
                };
                container.querySelector('#btn-eliminar-filas').onclick = () => {
                    if (seleccionados.size > 0 && typeof onEliminar === 'function') {
                        onEliminar([...seleccionados]);
                    }
                };
            }
        }
        render();
    }

    // --- PACIENTES: listado SIN checkboxes ---
    if (btnBuscarPaciente && busquedaPaciente) {
        btnBuscarPaciente.addEventListener('click', function () {
            busquedaPaciente.style.display = 'block';
            nuevoPacienteForm.style.display = 'none';
            formNuevoPaciente.reset();
            const edadInput = document.getElementById('edad-nuevo');
            if (edadInput) edadInput.value = '';

            // Listado de pacientes de prueba
            const pacientes = [
                { id: 1, apellido: "García", nombre: "Ana", dni: "30123456", telefono: "1122334455", email: "ana@correo.com", fechaNac: "1990-05-10" },
                { id: 2, apellido: "Pérez", nombre: "Juan", dni: "28987654", telefono: "1133445566", email: "juan@correo.com", fechaNac: "1985-11-22" },
                { id: 3, apellido: "López", nombre: "María", dni: "31234567", telefono: "1144556677", email: "maria@correo.com", fechaNac: "1992-03-15" },
                { id: 4, apellido: "Fernández", nombre: "Carlos", dni: "32345678", telefono: "1155667788", email: "carlos@correo.com", fechaNac: "1988-07-30" },
                { id: 5, apellido: "Martínez", nombre: "Laura", dni: "33456789", telefono: "1166778899", email: "laura@correo.com", fechaNac: "1995-12-01" },
                { id: 6, apellido: "Gómez", nombre: "Pedro", dni: "34567890", telefono: "1177889900", email: "pedro@correo.com", fechaNac: "1982-09-18" },
                { id: 7, apellido: "Sánchez", nombre: "Lucía", dni: "35678901", telefono: "1188990011", email: "lucia@correo.com", fechaNac: "1998-02-25" },
                { id: 8, apellido: "Romero", nombre: "Diego", dni: "36789012", telefono: "1199001122", email: "diego@correo.com", fechaNac: "1987-06-12" },
                { id: 9, apellido: "Torres", nombre: "Sofía", dni: "37890123", telefono: "1100112233", email: "sofia@correo.com", fechaNac: "1993-11-05" },
                { id: 10, apellido: "Ruiz", nombre: "Martín", dni: "38901234", telefono: "1111223344", email: "martin@correo.com", fechaNac: "1989-04-20" },
                { id: 11, apellido: "Alvarez", nombre: "Valentina", dni: "39012345", telefono: "1122334456", email: "valentina@correo.com", fechaNac: "1996-08-14" },
                { id: 12, apellido: "Moreno", nombre: "Javier", dni: "40123456", telefono: "1133445567", email: "javier@correo.com", fechaNac: "1983-01-09" },
                { id: 13, apellido: "Muñoz", nombre: "Camila", dni: "41234567", telefono: "1144556678", email: "camila@correo.com", fechaNac: "1991-10-23" },
                { id: 14, apellido: "Jiménez", nombre: "Lucas", dni: "42345678", telefono: "1155667789", email: "lucas@correo.com", fechaNac: "1986-05-17" },
                { id: 15, apellido: "Díaz", nombre: "Florencia", dni: "43456789", telefono: "1166778890", email: "florencia@correo.com", fechaNac: "1994-12-29" }
            ];

            renderTablaConPaginacion({
                container: document.getElementById('tabla-pacientes-paginada'), // <--- CORRECTO
                columnas: [
                    { titulo: 'Apellido', align: 'left' },
                    { titulo: 'Nombre', align: 'left' },
                    { titulo: 'DNI' },
                    { titulo: 'Edad' },
                    { titulo: 'Teléfono' },
                    { titulo: 'Email', align: 'left' }
                ],
                datos: pacientes,
                filasPorPagina: 10,
                opcionesFilas: [10, 20, 50, 100],
                renderFila: (p, idx) => {
                    let edad = '';
                    if (p.fechaNac) {
                        const hoy = new Date();
                        const fn = new Date(p.fechaNac);
                        edad = hoy.getFullYear() - fn.getFullYear();
                        const m = hoy.getMonth() - fn.getMonth();
                        if (m < 0 || (m === 0 && hoy.getDate() < fn.getDate())) {
                            edad--;
                        }
                        edad = isNaN(edad) ? '' : edad;
                    }
                    // Hacemos clickeable la fila
                    return `
                        <td style="text-align:left;cursor:pointer;" class="td-paciente" data-idx="${idx}">${p.apellido}</td>
                        <td style="text-align:left;cursor:pointer;" class="td-paciente" data-idx="${idx}">${p.nombre}</td>
                        <td style="cursor:pointer;" class="td-paciente" data-idx="${idx}">${p.dni}</td>
                        <td style="cursor:pointer;" class="td-paciente" data-idx="${idx}">${edad}</td>
                        <td style="cursor:pointer;" class="td-paciente" data-idx="${idx}">${p.telefono}</td>
                        <td style="text-align:left;cursor:pointer;" class="td-paciente" data-idx="${idx}">${p.email}</td>
                    `;
                },
                checkboxes: false
            });

            // Evento para abrir ficha al hacer click en una fila
            setTimeout(() => {
                document.querySelectorAll('.td-paciente').forEach(td => {
                    td.onclick = function () {
                        const idx = parseInt(this.getAttribute('data-idx'), 10);
                        const paciente = pacientes[idx];

                        // Simulación de respuesta del backend para Ana García y Juan Pérez
                        if (paciente.dni === "30123456") {
                            // Ana García
                            mostrarFichaPaciente({
                                id: 1,
                                apellido: "García",
                                nombre: "Ana",
                                dni: "30123456",
                                edad: 34,
                                fechaNac: "1990-05-10",
                                telefono: "1122334455",
                                email: "ana@correo.com",
                                direccion: "Calle Falsa 123",
                                ciudad: "Buenos Aires",
                                provincia: "Buenos Aires",
                                nacionalidad: "Argentina",
                                foto: "https://randomuser.me/api/portraits/women/1.jpg"
                            });
                            return;
                        }
                        if (paciente.dni === "28987654") {
                            // Juan Pérez
                            mostrarFichaPaciente({
                                id: 2,
                                apellido: "Pérez",
                                nombre: "Juan",
                                dni: "28987654",
                                edad: 39,
                                fechaNac: "1985-11-22",
                                telefono: "1133445566",
                                email: "juan@correo.com",
                                direccion: "Av. Siempre Viva 742",
                                ciudad: "Córdoba",
                                provincia: "Córdoba",
                                nacionalidad: "Argentina",
                                foto: "https://randomuser.me/api/portraits/men/2.jpg"
                            });
                            return;
                        }

                        // Para los demás, muestra los datos básicos
                        mostrarFichaPaciente(paciente);
                    };
                });
            }, 200);

            // Ventana emergente de ficha de paciente
            function mostrarFichaPaciente(paciente) {
                // Cierra si ya existe
                let modal = document.getElementById('modal-ficha-paciente');
                if (modal) modal.remove();

                // Estructura de la ficha
                modal = document.createElement('div');
                modal.id = 'modal-ficha-paciente';
                modal.innerHTML = `
                    <div class="ficha-modal-bg"></div>
                    <div class="ficha-modal-content">
                        <button class="ficha-modal-close" title="Cerrar">&times;</button>
                        <div class="ficha-header">
                            <div class="ficha-foto">
                                <img src="${paciente.foto || 'images/user-default.png'}" alt="Foto paciente" />
                            </div>
                            <div class="ficha-datos">
                                <h3>${paciente.apellido}, ${paciente.nombre}</h3>
                                <div class="ficha-datos-personales">
                                    <div><b>DNI:</b> ${paciente.dni || ''}</div>
                                    <div><b>Edad:</b> ${paciente.edad || ''}</div>
                                    <div><b>Fecha Nac.:</b> ${paciente.fechaNac || ''}</div>
                                    <div><b>Teléfono:</b> ${paciente.telefono || ''}</div>
                                    <div><b>Email:</b> ${paciente.email || ''}</div>
                                    <div><b>Dirección:</b> ${paciente.direccion || ''}</div>
                                    <div><b>Ciudad:</b> ${paciente.ciudad || ''}</div>
                                    <div><b>Provincia:</b> ${paciente.provincia || ''}</div>
                                    <div><b>Nacionalidad:</b> ${paciente.nacionalidad || ''}</div>
                                </div>
                            </div>
                        </div>
                        <div class="ficha-tabs">
                            <button class="ficha-tab active" data-tab="odontograma-inicial">Odontograma inicial</button>
                            <button class="ficha-tab" data-tab="historia-clinica">Historia clínica</button>
                            <button class="ficha-tab" data-tab="odontograma-actual">Odontograma actual</button>
                            <button class="ficha-tab" data-tab="archivos">Archivos</button>
                        </div>
                        <div class="ficha-tab-content" id="ficha-tab-odontograma-inicial">
                            <div id="odontograma-inicial-panel">
                                <div class="odontograma-inicial-imagenes">
                                    <!-- Comentarios superiores -->
                                    <div class="fila-comentarios">
                                        ${[18,17,16,15,14,13,12,11,21,22,23,24,25,26,27,28].map(num => `
                                            <input type="text" class="comentario-diente-superior" data-num="${num}" placeholder="Comentario">
                                        `).join('')}
                                    </div>
                                    <!-- Imagen del odontograma en vez de SVGs -->
                                    <div class="odontograma-img-wrapper" style="display:flex;justify-content:center;position:relative;">
                                        <img src="images/odontograma.jpg" alt="Odontograma" class="odontograma-img" style="width:100%;max-width:100%;height:auto;display:block;pointer-events:none;">
                                        <canvas class="odontograma-canvas"></canvas>
                                    </div>
                                    <!-- Comentarios inferiores -->
                                    <div class="fila-comentarios">
                                        ${[48,47,46,45,44,43,42,41,31,32,33,34,35,36,37,38].map(num => `
                                            <input type="text" class="comentario-diente-inferior" data-num="${num}" placeholder="Comentario">
                                        `).join('')}
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="ficha-tab-content" id="ficha-tab-historia-clinica" style="display:none;">
                            <div style="padding:20px;text-align:center;color:#888;">(Historia clínica aquí)</div>
                        </div>
                        <div class="ficha-tab-content" id="ficha-tab-odontograma-actual" style="display:none;">
                            <div style="padding:20px;text-align:center;color:#888;">(Odontograma actual aquí)</div>
                        </div>
                        <div class="ficha-tab-content" id="ficha-tab-archivos" style="display:none;">
                            <div style="padding:20px;text-align:center;color:#888;">(Archivos del paciente aquí)</div>
                        </div>
                    </div>
                `;
                document.body.appendChild(modal);

                // Cerrar modal
                modal.querySelector('.ficha-modal-close').onclick = () => modal.remove();
                modal.querySelector('.ficha-modal-bg').onclick = () => modal.remove();

                // Tabs
                modal.querySelectorAll('.ficha-tab').forEach(tab => {
                    tab.onclick = function () {
                        modal.querySelectorAll('.ficha-tab').forEach(t => t.classList.remove('active'));
                        this.classList.add('active');
                        modal.querySelectorAll('.ficha-tab-content').forEach(c => c.style.display = 'none');
                        modal.querySelector(`#ficha-tab-${this.dataset.tab}`).style.display = '';
                    };
                });

                // Odontograma inicial: menú de hallazgos
                const panel = modal.querySelector('#odontograma-inicial-panel');
                if (panel) {
                    const menu = panel.querySelector('#menu-hallazgos');
                    let dienteActivo = null;
                    let zonaSeleccionada = 'toda';

                    // Mostrar menú de hallazgos al hacer click en un diente
                    panel.querySelectorAll('.svg-diente').forEach(svg => {
                        svg.addEventListener('click', function (e) {
                            e.stopPropagation();
                            dienteActivo = this.closest('.diente');
                            zonaSeleccionada = 'toda';
                            menu.style.display = 'block';
                            menu.style.left = e.clientX + 10 + 'px';
                            menu.style.top = e.clientY + 10 + 'px';
                        });
                    });

                    // Seleccionar hallazgo y colorear
                    menu.querySelectorAll('li').forEach(item => {
                        item.addEventListener('click', function () {
                            if (!dienteActivo) return;
                            const hallazgo = this.dataset.hallazgo;
                            const color = this.dataset.color;
                            const svg = dienteActivo.querySelector('.svg-diente');
                            if (!svg) return;
                            if (hallazgo === "borrar") {
                                svg.querySelectorAll('.diente-zona').forEach(z => z.setAttribute('fill', '#fff'));
                                dienteActivo.removeAttribute('data-hallazgo');
                            } else {
                                // Colorea la zona seleccionada
                                if (zonaSeleccionada === 'toda') {
                                    svg.querySelectorAll('.diente-zona').forEach(z => z.setAttribute('fill', color));
                                } else {
                                    svg.querySelectorAll('.diente-zona').forEach(z => {
                                        if (z.getAttribute('data-zona') === zonaSeleccionada) {
                                            z.setAttribute('fill', color);
                                        }
                                    });
                                }
                                dienteActivo.setAttribute('data-hallazgo', hallazgo);
                            }
                            menu.style.display = 'none';
                        });
                    });

                    // Selección de zona
                    menu.querySelectorAll('.btn-zona').forEach(btn => {
                        btn.addEventListener('click', function (e) {
                            e.stopPropagation();
                            zonaSeleccionada = this.dataset.zona;
                        });
                    });

                    // Ocultar menú al hacer click fuera
                    document.addEventListener('click', function hideMenuHallazgos() {
                        menu.style.display = 'none';
                        document.removeEventListener('click', hideMenuHallazgos);
                    });
                }

                // Después de agregar el modal al DOM, ajusta el tamaño del canvas al de la imagen:
                setTimeout(() => {
                    const wrapper = modal.querySelector('.odontograma-img-wrapper');
                    const img = wrapper.querySelector('.odontograma-img');
                    const canvas = wrapper.querySelector('.odontograma-canvas');
                    if (img && canvas) {
                        // Espera a que la imagen cargue para obtener dimensiones reales
                        img.onload = () => {
                            canvas.width = img.clientWidth;
                            canvas.height = img.clientHeight;
                            canvas.style.width = img.clientWidth + 'px';
                            canvas.style.height = img.clientHeight + 'px';
                        };
                        // Si la imagen ya está cargada
                        if (img.complete) {
                            canvas.width = img.clientWidth;
                            canvas.height = img.clientHeight;
                            canvas.style.width = img.clientWidth + 'px';
                            canvas.style.height = img.clientHeight + 'px';
                        }
                    }
                }, 100);
            }
        });
    }
});
