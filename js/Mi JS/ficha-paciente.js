export function mostrarFichaPaciente(paciente) {
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

    // Después de agregar el modal al DOM, ajusta el tamaño del canvas al de la imagen:
    setTimeout(() => {
        const wrapper = modal.querySelector('.odontograma-img-wrapper');
        const img = wrapper.querySelector('.odontograma-img');
        const canvas = wrapper.querySelector('.odontograma-canvas');
        if (img && canvas) {
            img.onload = () => {
                canvas.width = img.clientWidth;
                canvas.height = img.clientHeight;
                canvas.style.width = img.clientWidth + 'px';
                canvas.style.height = img.clientHeight + 'px';
            };
            if (img.complete) {
                canvas.width = img.clientWidth;
                canvas.height = img.clientHeight;
                canvas.style.width = img.clientWidth + 'px';
                canvas.style.height = img.clientHeight + 'px';
            }
        }
    }, 100);
}