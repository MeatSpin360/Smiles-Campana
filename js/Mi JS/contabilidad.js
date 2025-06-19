export function initContabilidad() {
    // Inicializa la sección de contabilidad cuando se muestra la sección correspondiente
    window.inicializarSeccionContabilidad = inicializarSeccionContabilidad;

    function inicializarSeccionContabilidad() {
        const seccion = document.getElementById('panel-contabilidad-dinamico');
        if (!seccion) return;

        seccion.innerHTML = `
            <div id="libro-contable-cuadro"></div>
            <div id="resumenes-contables-cuadro" style="display:none;"></div>
            <div id="comprobantes-contables-cuadro" style="display:none;"></div>
        `;

        renderLibroContable();
        // Puedes agregar aquí la inicialización de otras subsecciones si es necesario
    }

    function renderLibroContable() {
        const panel = document.getElementById('libro-contable-cuadro');
        if (!panel) return;

        // Ejemplo de tabla simple
        panel.innerHTML = `
            <h3>Libro Contable</h3>
            <table class="table table-bordered">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Descripción</th>
                        <th>Ingreso</th>
                        <th>Egreso</th>
                        <th>Saldo</th>
                    </tr>
                </thead>
                <tbody id="tabla-libro-contable-body">
                </tbody>
            </table>
            <button class="btn btn-link" id="btn-agregar-movimiento">Agregar Movimiento</button>
        `;

        renderMovimientosContables();

        const btnAgregar = document.getElementById('btn-agregar-movimiento');
        if (btnAgregar) {
            btnAgregar.onclick = function () {
                agregarMovimientoContable();
            };
        }
    }

    function cargarMovimientosLS() {
        try {
            return JSON.parse(localStorage.getItem('movimientos-contables')) || [];
        } catch {
            return [];
        }
    }

    function guardarMovimientosLS(datos) {
        localStorage.setItem('movimientos-contables', JSON.stringify(datos));
    }

    function renderMovimientosContables() {
        const tbody = document.getElementById('tabla-libro-contable-body');
        if (!tbody) return;
        const movimientos = cargarMovimientosLS();
        let saldo = 0;
        tbody.innerHTML = movimientos.map(mov => {
            saldo += (parseFloat(mov.ingreso || 0) - parseFloat(mov.egreso || 0));
            return `
                <tr>
                    <td>${mov.fecha || ''}</td>
                    <td>${mov.descripcion || ''}</td>
                    <td>${mov.ingreso || ''}</td>
                    <td>${mov.egreso || ''}</td>
                    <td>${saldo.toFixed(2)}</td>
                </tr>
            `;
        }).join('');
    }

    function agregarMovimientoContable() {
        const fecha = prompt('Fecha (YYYY-MM-DD):');
        if (!fecha) return;
        const descripcion = prompt('Descripción:');
        if (!descripcion) return;
        const ingreso = prompt('Ingreso (dejar vacío si es egreso):');
        const egreso = ingreso ? '' : prompt('Egreso (dejar vacío si es ingreso):');
        const movimientos = cargarMovimientosLS();
        movimientos.push({
            fecha,
            descripcion,
            ingreso: ingreso ? parseFloat(ingreso) : '',
            egreso: egreso ? parseFloat(egreso) : ''
        });
        guardarMovimientosLS(movimientos);
        renderMovimientosContables();
    }
}