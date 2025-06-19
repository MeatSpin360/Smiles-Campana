export function initTurnos() {
    // Inicializa la sección de turnos cuando se muestra la sección correspondiente
    window.inicializarSeccionTurnos = inicializarSeccionTurnos;

    function inicializarSeccionTurnos() {
        const seccion = document.getElementById('panel-turnos-dinamico');
        if (!seccion) return;

        seccion.innerHTML = `
            <div id="calendario-turnos"></div>
        `;

        renderCalendarioTurnos();
    }

    function renderCalendarioTurnos() {
        const calendarioDiv = document.getElementById('calendario-turnos');
        if (!calendarioDiv) return;

        // Si ya hay un calendario, no volver a inicializar
        if (calendarioDiv.dataset.inicializado) return;

        // Usando FullCalendar (debe estar incluido en tu HTML)
        const calendar = new window.FullCalendar.Calendar(calendarioDiv, {
            initialView: 'dayGridMonth',
            locale: 'es',
            headerToolbar: {
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay'
            },
            events: cargarTurnosLS(),
            dateClick: function(info) {
                // Ejemplo: agregar un turno rápido
                const nombre = prompt('Nombre del paciente para el turno:');
                if (nombre) {
                    const nuevoTurno = {
                        title: nombre,
                        start: info.dateStr
                    };
                    const turnos = cargarTurnosLS();
                    turnos.push(nuevoTurno);
                    guardarTurnosLS(turnos);
                    calendar.addEvent(nuevoTurno);
                }
            }
        });
        calendar.render();
        calendarioDiv.dataset.inicializado = "1";
    }

    // Simulación de datos en localStorage
    function cargarTurnosLS() {
        try {
            return JSON.parse(localStorage.getItem('turnos')) || [];
        } catch {
            return [];
        }
    }
    function guardarTurnosLS(datos) {
        localStorage.setItem('turnos', JSON.stringify(datos));
    }
}