export function initInsumos() {
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

    // Inicializa la sección de insumos cuando se muestra la sección correspondiente
    window.inicializarSeccionInsumos = inicializarSeccionInsumos;
}