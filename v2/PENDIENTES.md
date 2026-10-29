# Pendientes y próximas etapas

Registro de lo acordado para después de poner el sitio online. El orden es el sugerido; se puede cambiar.

## Hecho

- [x] Turnos a confirmar: el paciente **pide** un turno (queda "Por confirmar" y el horario queda reservado). Recepción u odontología lo **confirman** o lo **rechazan** desde *Hoy*, la agenda o la ficha. El paciente ve el estado en *Mis turnos*.
- [x] Cada pedido tiene tres acciones: **Confirmar**, **Ofrecer cambio** y **Cancelar**. *Ofrecer cambio* abre el contacto con el paciente (WhatsApp primero si tiene ambos, o correo, con el mensaje ya escrito), marca el pedido como "Cambio ofrecido" y permite elegir el horario acordado: el turno queda confirmado ahí y se guarda el horario que había pedido. En la ficha y en la agenda, los turnos confirmados tienen **Cambiar horario**.
- [x] Aviso al paciente, plan B: si no tiene correo (o mientras los correos no estén activos) y tiene celular, al confirmar o cancelar se ofrece avisarle por WhatsApp con el mensaje ya escrito.
- [x] *Turnos por confirmar* en orden de llegada (los pedidos nuevos se suman abajo) y **actualización automática** (Supabase Realtime) en *Hoy*, la agenda y la pestaña Turnos de la ficha.
- [x] **Correos automáticos** al paciente desde smiles.campana@gmail.com (Google Apps Script, `google/avisos.gs`): turno confirmado, cambio de turno, turno agendado por el personal y turno cancelado por el consultorio. Se disparan desde la base (pg_net); la dirección del script y la clave están en Vault.
- [x] **Turnos de 1 hora que empiezan cada 30 minutos** (configurable en *Horarios*: duración e intervalo). La base impide turnos superpuestos.
- [x] **Bloqueos** de día completo o por rango horario, y **repetidos** cada semana (con o sin fecha de fin). No se ofrecen online ni para turnos comunes; los turnos ya dados que caen en un bloqueo quedan marcados en la agenda para reprogramar.
- [x] **Sobreturnos**: 30 minutos, solo los da el personal, en huecos libres, hasta 1 hora antes o después de cada franja y también en horarios bloqueados. Se ven en dorado en *Hoy*, la agenda y la ficha.
- [x] Límite contra abusos: con 4 cancelaciones propias en el día, el paciente no puede pedir otro turno hasta el día siguiente ("por actividad sospechosa"). Lo controla la base; las cancelaciones hechas por el personal no cuentan.

## Etapa 1: poner online

- [x] Supabase: proyecto creado y `config.js` completado.
- [x] Esquema cargado en Supabase y URL de autenticación configuradas (local).
- [x] **Gmail como remitente** de los emails del sistema (confirmación de cuenta, recuperación de clave) con contraseña de aplicación. Obligatorio: el email incluido en Supabase solo envía al equipo del proyecto. Límite de Gmail: 500 destinatarios por día.
- [x] Primer admin creado.
- [x] Publicado en Cloudflare (Worker con archivos estáticos, configurado en `wrangler.jsonc`): https://smiles-campana.emiliobrescasin.workers.dev. Cada push a GitHub publica solo.
- [x] Dominio **https://smilescampana.com.ar** (y `www`): delegado desde NIC Argentina a Cloudflare y conectado al Worker. La dirección de workers.dev sigue funcionando.
- [x] Supabase *Site URL* y *Redirect URLs* con el dominio definitivo. Script de correos con `SITIO` en el dominio.
- [ ] Opcional: direcciones de correo del dominio (por ejemplo `turnos@smilescampana.com.ar`) que reenvíen a Gmail con Cloudflare *Email Routing* (gratis).

## Etapa 2: integraciones con Google

- [ ] **Google Calendar como espejo** de la agenda (solo turnos confirmados), en un solo sentido: sistema → Calendar, al instante, por la API de Google (no por suscripción ICS, que tarda 12 a 24 h en actualizarse). Desde que el sistema arranca, los turnos se dan solo en el sistema.
- [x] **Copia de seguridad semanal** de la base a Google Drive (domingos 3:00, se conservan ~3 meses, aviso por correo si falta una). Restaurar con `supabase/restaurar.sql`. Las fotos (etapa 3) se resuelven aparte.

## Etapa 3: fotos clínicas

- [ ] Almacenamiento en **Cloudflare R2** (10 GB gratis, sin costo de descarga). Acceso solo a través de una función que verifica la sesión y el rol: el paciente ve las suyas, odontología y admin todas, recepción ninguna.
- [ ] Fotos reprocesadas antes de subir: **máximo 1 MB** cada una. Con 10 GB entran unas 10.000 fotos (~2.500 consultas de 4 fotos).
- [ ] Tabla de fotos asociada al **paciente** y, opcionalmente, a una **evolución** (consulta).
- [ ] Subir fotos desde la PC al registrar una **nueva evolución**.
- [ ] **Adjuntar fotos a evoluciones anteriores** (cuando no se pudo en el momento).
- [ ] En *Historia clínica* (personal), cada evolución muestra sus fotos en miniatura, con vista ampliada.

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
