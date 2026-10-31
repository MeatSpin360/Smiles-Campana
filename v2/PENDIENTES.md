# Pendientes y próximas etapas

Registro de lo acordado para después de poner el sitio online. El orden es el sugerido; se puede cambiar.

> **Antes de cargar pacientes reales:** quitar *Eliminar paciente* (función `eliminar_paciente` y su botón en
> la ficha). Es solo para la etapa de pruebas: la historia clínica se conserva al menos 10 años (Ley 26.529).

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
- [ ] Revocar la contraseña de aplicación de Gmail que usaba Supabase (ya no hace falta).

## Etapa 2: integraciones con Google

- [ ] **Google Calendar como espejo** de la agenda (solo turnos confirmados), en un solo sentido: sistema → Calendar, al instante, por la API de Google (no por suscripción ICS, que tarda 12 a 24 h en actualizarse). Desde que el sistema arranca, los turnos se dan solo en el sistema.
- [x] **Copia de seguridad semanal** de la base a Google Drive (domingos 3:00, se conservan ~3 meses, aviso por correo si falta una). Restaurar con `supabase/restaurar.sql`. Las fotos (etapa 3) se resuelven aparte.

## Etapa 3: fotos clínicas

- [x] Almacenamiento en **Cloudflare R2** (depósito `smiles-fotos`, 10 GB gratis, sin costo de descarga). Acceso solo a través del Worker (`worker/index.js`), que consulta a la base con la sesión de quien pide: odontología y admin; recepción y pacientes no. Tablas `foto_secciones` y `fotos`; la copia semanal incluye la lista y las secciones.
- [x] Fotos reducidas en el navegador antes de subir (2000 px, unos 300 a 700 KB) y una miniatura de 400 px.
- [ ] Más adelante: **convertir fotos HEIC** (formato de iPhone) en el navegador. Hoy, si una foto no se puede leer, la app pide exportarla como JPG.
- [x] Pestaña **Fotos** en la ficha, junto a *Historia clínica*:
  - modo ver: secciones con título (por ejemplo "Primera consulta 02/11/2026") y miniaturas; vista ampliada pasando de una foto a otra;
  - modo *Editar*: agregar sección (rectángulo con título y fotos), arrastrar fotos desde la PC o buscarlas, moverlas entre secciones, borrar fotos, renombrar o borrar secciones.
- [ ] Más adelante: el paciente ve sus fotos en *Mi espacio* (ver etapa 5).

## Panel de control (admin)

- [x] **Registro de acciones**: la base anota sola quién hizo qué y cuándo (turnos, fichas, odontograma, historia, fotos, usuarios, agenda, copias de seguridad). Guarda qué cambió, no el contenido clínico. Nadie lo puede modificar ni borrar desde la app; queda aunque se elimine el paciente y entra en la copia semanal.
- [x] Ventana **Panel** (solo admin), con pestañas *Resumen y registro*, *Usuarios* y *Horarios* (el admin ya no los tiene en la barra lateral; recepción conserva *Horarios*): resumen (turnos de la semana, pedidos, pacientes, fotos y espacio usado, última copia de seguridad, personal y cuentas sin vincular) y el registro con filtros por fecha, persona, tipo de acción y paciente. Desde la ficha, el ícono de historial abre la actividad de ese paciente.

## Etapa 2b: documentos clínicos

- [x] **Planes de tratamiento** (pestaña *Planes* de la ficha, recepción, odontología y admin): prácticas elegidas de la lista de precios (o escritas a mano) con etapa, piezas, cantidad y precio; descuento por práctica (%) y descuento general (% o monto fijo); forma de pago, notas y validez; estados borrador → propuesto → aceptado → en curso → terminado (o descartado). La base calcula el total y no deja borrar un plan ya propuesto. Impresión o PDF con el formato del consultorio (logo, matrícula MN 40339, datos del paciente, prácticas por etapa y firma de conformidad).
- [x] **Lista de precios** (menú *Precios*): 64 servicios cargados de la planilla de noviembre 2025 (los que no se realizan quedan ocultos). Buscador que filtra mientras se escribe. Recepción y odontología la ven; contabilidad y admin la editan, aplican aumentos generales con redondeo, exportan a Excel e imprimen. Todo queda en el registro.
- [x] Rol **Contabilidad**: solo ve *Precios* (y *Pagos*, etapa A2). No ve agenda, fichas ni historia clínica.
- [ ] **Pagos (A2)**: monto facturado, interruptor "¿Paga justo?" y monto pagado; comentario y comprobante opcional (imagen o PDF, ≤ 1 MB). Saldo por paciente; "(con deuda)" / "(pago adelantado)" en la lista de pacientes con el monto en una ventanita (recepción, odontología y admin). Pestaña *Pagos* en la ficha. En contabilidad, lista completa con filtros por fechas, mes, año y paciente, totales al pie y exportación a Excel. Cargan y corrigen recepción y admin; solo admin borra; contabilidad mira.
- [ ] **Documentos (B)**: plantillas *Contrato de ortodoncia* (tal cual, solo errores de tipeo; datos del paciente, responsable si es menor, cantidad de controles, MN 40339) y *Cuidados post-instalación de brackets*. Pestaña *Documentos* en la ficha: generar, imprimir, marcar firmado y adjuntar la copia firmada. Plantillas editables desde el Panel. Más adelante: revisión legal del contrato.
- ~~Recetas digitales~~: descartado por ahora.
- [ ] A consultar: la Ley 27.706 (historia clínica electrónica) pide firma digital en los registros.

## Etapa 4: app Android para el odontólogo

- [ ] App de uso exclusivo en el celular del odontólogo, con ingreso con su cuenta.
- [ ] Elegir paciente → sacar fotos.
- [ ] Cada foto se guarda **en calidad completa** en el celular, en `smiles-campana/<Apellido Nombre - DNI>/`.
- [ ] Una copia **reducida a menos de 1 MB** se sube a la historia clínica del paciente (R2).
- [ ] Definir cómo se asocian las fotos a la consulta (evolución del día, o elegir una).
- [ ] A considerar: el celular guarda datos de salud (bloqueo de pantalla, copia de respaldo de la carpeta).

## Etapa 5: historia clínica para el paciente

- [ ] En *Mi espacio*, reemplazar "Odontograma" por **"Historia clínica"**. El paciente no ve el odontograma.
- [ ] **Resumen comprensible** de su historia clínica, sin lenguaje técnico, generado con IA.
  - El odontólogo lo revisa y lo aprueba antes de que el paciente lo vea.
  - La generación corre en un servidor (la clave del servicio de IA no puede estar en el navegador).
  - Enviar datos clínicos a un servicio de IA requiere informarlo al paciente en el consentimiento.
- [ ] **Fotos del tratamiento** con comparación **antes y después**.
