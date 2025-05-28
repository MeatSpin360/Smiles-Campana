document.addEventListener('DOMContentLoaded', function () {
    const loginContainer = document.getElementById('login-container');
    const mainContent = document.getElementById('intranet-home');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');

    // IDs de las secciones
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

    // Manejo de clicks en el menú
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
            e.preventDefault();
        });
    });

    // Mostrar cuadro de búsqueda al hacer click en "Buscar paciente"
    const btnBuscarPaciente = document.getElementById('btn-buscar-paciente');
    const busquedaPaciente = document.getElementById('busqueda-paciente');
    if (btnBuscarPaciente && busquedaPaciente) {
        btnBuscarPaciente.addEventListener('click', function () {
            busquedaPaciente.style.display = 'block';
            document.getElementById('input-buscar-paciente').focus();
        });
    }
});