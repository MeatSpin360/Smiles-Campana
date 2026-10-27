export function initMantenimiento() {
    // Inicializa la sección de mantenimiento cuando se muestra la sección correspondiente
    window.inicializarSeccionMantenimiento = inicializarSeccionMantenimiento;

    function inicializarSeccionMantenimiento() {
        const seccion = document.getElementById('panel-mantenimiento-dinamico');
        if (!seccion) return;

        seccion.innerHTML = `
            <div id="panel-mantenimiento-listado"></div>
            <button class="btn btn-link" id="btn-agregar-mantenimiento">Agregar Tarea</button>
        `;

        renderListadoMantenimiento();

        const btnAgregar = document.getElementById('btn-agregar-mantenimiento');
        if (btnAgregar) {
            btnAgregar.onclick = function () {
                agregarTareaMantenimiento();
            };
        }
    }

    function cargarMantenimientoLS() {
        try {
            return JSON.parse(localStorage.getItem('tareas-mantenimiento')) || [];
        } catch {
            return [];
        }
    }

    function guardarMantenimientoLS(datos) {
        localStorage.setItem('tareas-mantenimiento', JSON.stringify(datos));
    }

    function renderListadoMantenimiento() {
        const panel = document.getElementById('panel-mantenimiento-listado');
        if (!panel) return;
        const tareas = cargarMantenimientoLS();
        panel.innerHTML = `
            <h3>Tareas de Mantenimiento</h3>
            <table class="table table-bordered">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Descripción</th>
                        <th>Estado</th>
                        <th>Acción</th>
                    </tr>
                </thead>
                <tbody>
                    ${tareas.map((tarea, idx) => `
                        <tr>
                            <td>${tarea.fecha || ''}</td>
                            <td>${tarea.descripcion || ''}</td>
                            <td>${tarea.estado || 'Pendiente'}</td>
                            <td>
                                <button class="btn btn-success btn-xs btn-finalizar-mantenimiento" data-idx="${idx}" ${tarea.estado === 'Finalizada' ? 'disabled' : ''}>Finalizar</button>
                                <button class="btn btn-danger btn-xs btn-eliminar-mantenimiento" data-idx="${idx}">Eliminar</button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        // Finalizar tarea
        panel.querySelectorAll('.btn-finalizar-mantenimiento').forEach(btn => {
            btn.onclick = function () {
                const idx = parseInt(this.getAttribute('data-idx'), 10);
                let tareas = cargarMantenimientoLS();
                if (tareas[idx]) {
                    tareas[idx].estado = 'Finalizada';
                    guardarMantenimientoLS(tareas);
                    renderListadoMantenimiento();
                }
            };
        });

        // Eliminar tarea
        panel.querySelectorAll('.btn-eliminar-mantenimiento').forEach(btn => {
            btn.onclick = function () {
                const idx = parseInt(this.getAttribute('data-idx'), 10);
                let tareas = cargarMantenimientoLS();
                if (confirm('¿Está seguro que desea eliminar esta tarea?')) {
                    tareas.splice(idx, 1);
                    guardarMantenimientoLS(tareas);
                    renderListadoMantenimiento();
                }
            };
        });
    }

    function agregarTareaMantenimiento() {
        const fecha = prompt('Fecha (YYYY-MM-DD):');
        if (!fecha) return;
        const descripcion = prompt('Descripción de la tarea:');
        if (!descripcion) return;
        const tareas = cargarMantenimientoLS();
        tareas.push({
            fecha,
            descripcion,
            estado: 'Pendiente'
        });
        guardarMantenimientoLS(tareas);
        renderListadoMantenimiento();
    };
};