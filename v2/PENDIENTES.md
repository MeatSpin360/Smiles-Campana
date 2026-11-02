# Pendientes y próximas etapas

Registro de lo acordado para después de poner el sitio online. El orden es el sugerido; se puede cambiar.

> **Antes de cargar pacientes reales:** quitar *Eliminar paciente* (función `eliminar_paciente` y su botón en
> la ficha). Es solo para la etapa de pruebas: la historia clínica se conserva al menos 10 años (Ley 26.529).

## Arranque con pacientes reales (objetivo: antes del 14/11/2026, próximos turnos reales)

- [x] Extracción del calendario actual (`C:\Claudio\migracion-smiles\pacientes-calendario.xlsx`, fuera del repositorio: datos reales). 72 pacientes probables, 40 con DNI. Casi todos tienen un solo evento que se fue moviendo; la historia está en la descripción.
- Criterios de la revisión con la odontóloga:
  - "guardia" en el título = **urgencia** (probablemente brackets despegados), no es apellido.
  - Duplicados: a veces se atendió a un familiar en el mismo turno y quedó en el mismo evento ("mamá Valentino", "papá de Meza").
  - "Señor que trabaja enfrente": probablemente después se registró con su nombre.
  - Sin DNI: puede estar en otro evento o anotado en papel.
- [x] **Fichas sin DNI** ("Falta el DNI"): se pueden crear sin DNI y quedan marcadas en la lista y la ficha. Si el paciente se registra en Mi espacio con el email de esa ficha, se vincula sola y toma su DNI; si coincide solo el nombre, no se crea otra ficha: queda en "Cuentas por vincular" y, al vincularla, la ficha toma el DNI de la cuenta.
- [ ] **El listado lo filtra Emilio** con la odontóloga (hay datos en papel): deja solo los pacientes reales y exactos. Recién después se importa.
- Importación (la hago yo, con resumen previo y OK; no hace falta una pantalla porque es una sola vez):
  - Notas del calendario → **evolución** en la historia clínica ("Historia previa, importada del calendario"). A definir: una sola evolución o una por consulta.
  - Turnos futuros → turnos **confirmados**.
  - Limpieza de los datos de prueba, con copia de seguridad antes (deja personal, precios, plantillas y horarios).
- [ ] Al arrancar: exportar el calendario de nuevo y volver a correr la extracción; cargar pacientes y turnos futuros; borrar los datos de prueba.
- [ ] Al arrancar: quitar el prefijo "PRUEBA · " de los eventos (`turno_para_calendario`), programar el repaso diario del calendario (ver `supabase/schema.sql`) y resolver los eventos cargados a mano para que no se dupliquen.
- [ ] Al arrancar: quitar "Eliminar paciente" (solo para la etapa de pruebas).

## Hecho

- [x] Turnos a confirmar: el paciente **pide** un turno (queda "Por confirmar" y el horario queda reservado). Recepción u odontología lo **confirman** o lo **rechazan** desde *Hoy*, la agenda o la ficha. El paciente ve el estado en *Mis turnos*.
- [x] Cada pedido tiene tres acciones: **Confirmar**, **Ofrecer cambio** y **Cancelar**. *Ofrecer cambio* abre el contacto con el paciente (WhatsApp primero si tiene ambos, o correo, con el mensaje ya escrito), marca el pedido como "Cambio ofrecido" y permite elegir el horario acordado: el turno queda confirmado ahí y se guarda el horario que había pedido. En la ficha y en la agenda, los turnos confirmados tienen **Cambiar horario**.
- [x] Aviso al paciente, plan B: si no tiene correo (o mientras los correos no estén activos) y tiene celular, al confirmar o cancelar se ofrece avisarle por WhatsApp con el mensaje ya escrito.
- [x] *Turnos por confirmar* en orden de llegada (los pedidos nuevos se suman abajo) y **actualización automática** (Supabase Realtime) en *Hoy*, la agenda y la pestaña Turnos de la ficha.
- [x] **Correos automáticos** al paciente desde smiles.campana@gmail.com (Google Apps Script, `google/avisos.gs`): turno confirmado, cambio de turno, turno agendado por el personal y turno cancelado por el consultorio. Se disparan desde la base (pg_net); la dirección del script y la clave están en Vault.
- [x] **Turnos de 1 hora que empiezan cada 30 minutos** (configurable en *Horarios*: duración e intervalo). La base impide turnos superpuestos.
- [x] **Bloqueos** de día completo o por rango horario, y **repetidos** cada semana (con o sin fecha de fin). No se ofrecen online ni para turnos comunes; los turnos ya dados que caen en un bloqueo quedan marcados en la agenda para reprogramar.
- [x] **Sobreturnos**: 30 minutos, solo los da el personal, en huecos libres, hasta 1 hora antes o después de cada franja y también en horarios bloqueados. Se ven en dorado en *Hoy*, la agenda y la ficha.
- [x] Al cancelar, el personal indica **quién pide la cancelación**: si fue el paciente (por WhatsApp o teléfono), le llega "Cancelamos tu turno, como nos pediste" y no suma a su límite diario; si fue el consultorio, el aviso con disculpas.
- [x] **Odontograma**: el último registro se puede **corregir** (quien lo creó o un admin); queda marcado "Corregido el …" y lo que tenía antes se guarda en la base. **Borrarlo** solo dentro de las 48 h de creado.
- [x] **Eliminar paciente** (solo admin, solo etapa de pruebas): borra la ficha con todo lo suyo y su cuenta de Mi espacio; se confirma escribiendo el DNI.
- [x] Límite contra abusos: con 4 cancelaciones propias en el día, el paciente no puede pedir otro turno hasta el día siguiente ("por actividad sospechosa"). Lo controla la base; las cancelaciones hechas por el personal no cuentan.

## Etapa 1: poner online

- [x] Supabase: proyecto creado y `config.js` completado.
- [x] Esquema cargado en Supabase y URL de autenticación configuradas (local).
- [x] **Gmail como remitente** de los emails del sistema (confirmación de cuenta, recuperación de clave) con contraseña de aplicación. Obligatorio: el email incluido en Supabase solo envía al equipo del proyecto. Límite de Gmail: 500 destinatarios por día.
- [x] Primer admin creado.
- [x] Publicado en Cloudflare (Worker con archivos estáticos, configurado en `wrangler.jsonc`): https://smiles-campana.emiliobrescasin.workers.dev. Cada push a GitHub publica solo.
- [x] Dominio **https://smilescampana.com.ar** (y `www`): delegado desde NIC Argentina a Cloudflare y conectado al Worker. La dirección de workers.dev sigue funcionando.
- [x] Supabase *Site URL* y *Redirect URLs* con el dominio definitivo. Script de correos con `SITIO` en el dominio.
- [x] Correos del dominio: `cuentas@` (correos de la cuenta, desde Supabase), `turnos@` (avisos de turnos, desde el script) y `consultas@` (contacto del sitio). Reciben con Cloudflare *Email Routing* y envían con Resend (Supabase SMTP y Gmail "Enviar como"). Guía: `google/CORREO-DOMINIO.md`.
- [x] Revocada la contraseña de aplicación de Gmail que usaba Supabase (02/11/2026).
- [x] Claves con **letras y números, 8 o más** (la app lo pide y lo explica; en Supabase: *Authentication → Sign In / Providers → Email → Password requirements: Letters and digits*, mínimo 8).
- La protección contra contraseñas filtradas de Supabase es solo del plan Pro: el aviso queda en el plan gratuito.

## Etapa 2: integraciones con Google

- [x] **Google Calendar como espejo** de la agenda: los turnos confirmados (y después atendidos o ausentes) van al calendario principal de smiles.campana@gmail.com, al instante, por el script de Google (`google/avisos.gs`, servicio Google Calendar API). Una sola dirección: app → Calendar. Repaso diario a las 3:23 (próximos 60 días) que corrige diferencias y solo toca eventos de la app. Evento: apellido, nombre · motivo, con enlace a la ficha; sin teléfono, invitados ni recordatorios. Guía: `google/LEEME.md`. Desde que el sistema arranca, los turnos se dan solo en el sistema. **Mientras los datos sean de prueba, los eventos dicen "PRUEBA · …"; al arrancar en serio, quitar ese prefijo (función `turno_para_calendario`) y resolver los eventos que hoy están cargados a mano para que no queden duplicados.**
- [x] **Copia de seguridad semanal** de la base a Google Drive (domingos 3:00, se conservan ~3 meses, aviso por correo si falta una). Restaurar con `supabase/restaurar.sql`. Las fotos (etapa 3) se resuelven aparte.

## Etapa 3: fotos clínicas

- [x] Almacenamiento en **Cloudflare R2** (depósito `smiles-fotos`, 10 GB gratis, sin costo de descarga). Acceso solo a través del Worker (`worker/index.js`), que consulta a la base con la sesión de quien pide: odontología y admin; recepción y pacientes no. Tablas `foto_secciones` y `fotos`; la copia semanal incluye la lista y las secciones.
- [x] Fotos reducidas en el navegador antes de subir (2000 px, unos 300 a 700 KB) y una miniatura de 400 px.
- [x] **Fotos HEIC/HEIF** (iPhone, algunos Samsung): Safari las lee directo; en Chrome/Edge se convierten en el navegador con `assets/vendor/heic-to.js` (heic-to 1.5.2, licencia LGPL, sin modificar), que se descarga solo la primera vez que hace falta. Vale para fotos clínicas, comprobantes y copias firmadas.
- [x] Pestaña **Fotos** en la ficha, junto a *Historia clínica*:
  - modo ver: secciones con título (por ejemplo "Primera consulta 02/11/2026") y miniaturas; vista ampliada pasando de una foto a otra;
  - modo *Editar*: agregar sección (rectángulo con título y fotos), arrastrar fotos desde la PC o buscarlas, moverlas entre secciones, borrar fotos, renombrar o borrar secciones.
- [x] El paciente ve en *Mi espacio → Mis fotos* las fotos que odontología marca como visibles (foto por foto con el ojo, o "Mostrar todas" por sección; las nuevas empiezan ocultas). Queda en el registro.

## Panel de control (admin)

- [x] **Registro de acciones**: la base anota sola quién hizo qué y cuándo (turnos, fichas, odontograma, historia, fotos, usuarios, agenda, copias de seguridad). Guarda qué cambió, no el contenido clínico. Nadie lo puede modificar ni borrar desde la app; queda aunque se elimine el paciente y entra en la copia semanal.
- [x] Ventana **Panel** (solo admin), con pestañas *Resumen y registro*, *Usuarios* y *Horarios* (el admin ya no los tiene en la barra lateral; recepción conserva *Horarios*): resumen (turnos de la semana, pedidos, pacientes, fotos y espacio usado, última copia de seguridad, personal y cuentas sin vincular) y el registro con filtros por fecha, persona, tipo de acción y paciente. Desde la ficha, el ícono de historial abre la actividad de ese paciente.

## Etapa 2b: documentos clínicos

- [x] **Planes de tratamiento** (pestaña *Planes* de la ficha, recepción, odontología y admin): prácticas elegidas de la lista de precios (o escritas a mano) con etapa, piezas, cantidad y precio; descuento por práctica (%) y descuento general (% o monto fijo); forma de pago, notas y validez; estados borrador → propuesto → aceptado → en curso → terminado (o descartado). La base calcula el total y no deja borrar un plan ya propuesto. Impresión o PDF con el formato del consultorio (logo, matrícula MN 40339, datos del paciente, prácticas por etapa y firma de conformidad).
- [x] **Lista de precios** (menú *Caja* → *Precios*): 64 servicios cargados de la planilla de noviembre 2025 (los que no se realizan quedan ocultos). Buscador que filtra mientras se escribe. Recepción y odontología la ven; contabilidad y admin la editan, aplican aumentos generales con redondeo, exportan a Excel e imprimen. Todo queda en el registro.
- [x] Rol **Contabilidad**: solo ve *Precios* (y *Pagos*, etapa A2). No ve agenda, fichas ni historia clínica.
- [x] **Pagos** (pestaña *Pagos* de la ficha y menú *Caja* → *Pagos*):
  - Recepción y admin cargan: fecha, monto facturado (con formato $ mientras se escribe), "¿Paga justo?" y, si no, lo que paga; comentario y comprobante opcional (imagen o PDF; las imágenes de más de 1 MB se achican, los PDF de más de 1 MB se rechazan). Archivos en R2 (`comprobantes/<paciente>/<pago>`), a través del Worker.
  - Saldo = facturado − pagado. En la lista de pacientes y en la ficha: "(con deuda)" en rojo o "(pago adelantado)" en verde; al tocarlo, solo el monto (recepción, odontología y admin).
  - Corregir: recepción y admin, siempre (queda en el registro de cuánto a cuánto). Borrar: solo admin. Odontología no ve los pagos, solo el cartel.
  - Recepción, contabilidad y admin (Caja → Pagos): lista completa con filtros por mes, año, entre fechas o todos, y por paciente; totales al pie; Excel e impresión de lo filtrado.
- [x] **Documentos** (pestaña *Documentos* de la ficha: recepción, odontología y admin):
  - Plantillas *Contrato de ortodoncia* (texto original, solo errores de tipeo) y *Cuidados post-instalación de brackets*. Se completan con nombre, DNI, domicilio, responsable (si es menor), fecha y matrícula; lo que falte (por ejemplo, la cantidad de controles) se pide al generar. Lo vacío se imprime como línea para completar a mano.
  - Vista previa, impresión o PDF con el encabezado del consultorio. El texto queda guardado tal como se imprimió.
  - Marcar como firmado y adjuntar la copia firmada (foto o PDF de hasta 3 MB) en R2 (`documentos/<paciente>/<documento>`). Uno firmado solo lo borra el admin.
  - Ficha del paciente: *Responsable, si es menor de edad* (nombre y DNI), que también se puede completar al generar el contrato.
  - **Panel → Plantillas** (admin): editar los textos con vista previa, botones para insertar datos y datos propios de cada plantilla. Los documentos ya generados no cambian.
  - Más adelante: revisión legal del contrato (cláusulas de interés y de imagen) y de la firma digital (Ley 27.706).
- ~~Recetas digitales~~: descartado por ahora.
- [ ] A consultar: la Ley 27.706 (historia clínica electrónica) pide firma digital en los registros.

## Ventana de mantenimiento

- [x] Página `mantenimiento.html` con el logo: "La página se encuentra momentáneamente fuera de servicio. Disculpá las molestias, estamos trabajando para ofrecerte la mejor calidad. Equipo de Smiles Campana." Responde 503 (Google no la guarda) y se recarga sola cada 2 minutos.
- [x] **Interruptor en el Panel** (admin, *Resumen y registro*). Activado: smilescampana.com.ar y www muestran la página a todos, incluida la pantalla de ingreso. El personal entra por **smiles-campana.emiliobrescasin.workers.dev**, que sigue funcionando con una banda "Mantenimiento activo"; un paciente que ingrese ahí ve el aviso. El Worker consulta la tabla `sitio` y guarda la respuesta 30 s; si la base no responde, sigue con el último estado (una falla nunca lo activa sola). Queda en el registro quién la activó y desactivó. El Worker ahora pasa por todas las rutas (`run_worker_first: true`).
- [x] **Automática, por visitante** (nunca global): al abrir Mi espacio, si la base no responde en 2 intentos de 10 s y hay internet, se muestra el aviso con "Reintentar"; sin internet, "No hay conexión" (se recarga sola al volver). Si el código de la app no carga, el aviso aparece enseguida (o a los 25 s como máximo). Si el Worker falla al servir una página, muestra el aviso en lugar de un error.
- [x] workers.dev lleva al dominio (redirección temporal, con la misma ruta) **salvo durante el mantenimiento**, cuando es la entrada del personal. `/api` no se redirige. La sesión es por dirección: al pasar de una a otra hay que volver a ingresar.

## Etapa 4: app Android para el odontólogo

- [ ] App de uso exclusivo en el celular del odontólogo, con ingreso con su cuenta.
- [ ] Elegir paciente → sacar fotos.
- [ ] Cada foto se guarda **en calidad completa** en el celular, en `smiles-campana/<Apellido Nombre - DNI>/`.
- [ ] Una copia **reducida a menos de 1 MB** se sube a la historia clínica del paciente (R2).
- [ ] Definir cómo se asocian las fotos a la consulta (evolución del día, o elegir una).
- [ ] A considerar: el celular guarda datos de salud (bloqueo de pantalla, copia de respaldo de la carpeta).

## Etapa 5: historia clínica para el paciente (EN PAUSA)

- [x] **Por ahora el paciente no ve su historia clínica:** en *Mi espacio → Odontograma* aparece un cartel "En desarrollo", y la base tampoco le devuelve el odontograma (política "ver odontogramas", migración p22).
- [ ] En *Mi espacio*, reemplazar "Odontograma" por **"Historia clínica"**. El paciente no ve el odontograma.
- [ ] **Resumen comprensible** de su historia clínica, sin lenguaje técnico, generado con IA.
  - El odontólogo lo revisa y lo aprueba antes de que el paciente lo vea.
  - La generación corre en un servidor (la clave del servicio de IA no puede estar en el navegador).
  - Enviar datos clínicos a un servicio de IA requiere informarlo al paciente en el consentimiento.
- [x] **Fotos del tratamiento** en *Mis fotos* (las que marca odontología).
- [x] **Mi plan**: el paciente ve sus planes de tratamiento desde que se le proponen (no borradores ni descartados), con etapas, precios, descuentos, total, forma de pago y observaciones, y lo puede imprimir o guardar en PDF. Solo ver.
- ~~Comparación antes y después de fotos~~: descartado (alcanza con *Mis fotos*).
