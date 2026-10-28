# Pendientes y próximas etapas

Registro de lo acordado para después de poner el sitio online. El orden es el sugerido; se puede cambiar.

## Hecho

- [x] Turnos a confirmar: el paciente **pide** un turno (queda "Por confirmar" y el horario queda reservado). Recepción u odontología lo **confirman** o lo **rechazan** desde *Hoy*, la agenda o la ficha. El paciente ve el estado en *Mis turnos*.

## Etapa 1: poner online

- [x] Supabase: proyecto creado y `config.js` completado.
- [x] Esquema cargado en Supabase y URL de autenticación configuradas (local).
- [x] **Gmail como remitente** de los emails del sistema (confirmación de cuenta, recuperación de clave) con contraseña de aplicación. Obligatorio: el email incluido en Supabase solo envía al equipo del proyecto. Límite de Gmail: 500 destinatarios por día.
- [x] Primer admin creado.
- [ ] Cloudflare Pages conectado al repositorio, publicando la carpeta `v2`.
- [ ] Dominio `smilescampana.com.ar`: agregarlo a Cloudflare y delegarlo desde NIC Argentina a los servidores DNS de Cloudflare.
- [ ] Supabase *Site URL* y *Redirect URLs* con el dominio definitivo.

## Etapa 2: integraciones con Google

- [ ] **Aviso por email** al paciente cuando su turno se confirma o se rechaza.
- [ ] **Google Calendar como espejo** de la agenda (solo turnos confirmados), en un solo sentido: sistema → Calendar, al instante, por la API de Google (no por suscripción ICS, que tarda 12 a 24 h en actualizarse). Desde que el sistema arranca, los turnos se dan solo en el sistema.
- [ ] **Copia de seguridad semanal** de la base (y de las fotos) a Google Drive. El plan gratuito de Supabase no hace backups.

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
