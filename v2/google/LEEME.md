# Correos automáticos y copias de seguridad

`avisos.gs` es un script de Google Apps Script que envía los correos de turnos desde la cuenta
**smiles.campana@gmail.com**, con remitente **turnos@smilescampana.com.ar** (quedan en *Enviados*; ver
`CORREO-DOMINIO.md`). Los correos de la cuenta (confirmación, clave) no pasan por acá: los envía Supabase desde
**cuentas@smilescampana.com.ar**. La base de datos llama al script sola cuando:

| Qué pasa | Correo |
|---|---|
| Se confirma un pedido | Tu turno está confirmado |
| Se confirma en otro horario (Ofrecer cambio / Cambiar horario) | Cambio de turno |
| El personal da un turno (Dar turno) | Tu turno quedó agendado |
| El personal cancela porque lo pidió el paciente | Cancelamos tu turno |
| El consultorio cancela un pedido o un turno | No pudimos confirmar tu turno / Tu turno fue cancelado |

No se envía nada cuando el paciente cancela su propio turno, ni a pacientes sin correo en la ficha.
Límite de Gmail gratuito: unos 100 correos por día.

## 1. Publicar el script (una sola vez, unos 10 minutos)

Con la sesión de **smiles.campana@gmail.com** abierta:

1. Entrar a <https://script.google.com> → **Nuevo proyecto**. Arriba, cambiar el nombre a *Smiles Campana – avisos*.
2. Borrar todo lo que hay en `Código.gs`, pegar el contenido completo de `avisos.gs` y guardar (ícono de disquete).
3. **Clave secreta:** en el menú de la izquierda, ⚙️ *Configuración del proyecto* → al final, *Propiedades del script* →
   *Agregar propiedad del script*:
   - Propiedad: `SECRETO`
   - Valor: una clave larga inventada, de 30 o más letras y números (por ejemplo, la que sugiere el generador de
     contraseñas del navegador). **Guardala**: se usa de nuevo en el paso 2. No la compartas con nadie.
   - *Guardar propiedades del script*.
4. **Prueba y permisos:** volver al editor (`< >`), elegir la función `probar` en la lista de arriba y tocar **Ejecutar**.
   - Google pide permisos: *Revisar permisos* → elegir la cuenta → aparece "Google no verificó esta app" (es normal,
     la app es tuya) → *Configuración avanzada* → *Ir a Smiles Campana – avisos* → **Permitir**.
   - Tienen que llegar 4 correos "[Prueba]" a la casilla del consultorio. Revisá cómo se ven.
5. **Publicar:** botón azul **Implementar** → *Nueva implementación* → ⚙️ *Seleccionar tipo* → **Aplicación web**:
   - Descripción: `avisos`
   - Ejecutar como: **Yo** (smiles.campana@gmail.com)
   - Quién tiene acceso: **Cualquier usuario**
   - **Implementar** → copiar la **URL de la aplicación web** (termina en `/exec`).

"Cualquier usuario" es necesario para que la base pueda llamarlo; sin la clave secreta el script no envía nada.

## 2. Cargar la URL y la clave en Supabase

Supabase → *SQL Editor* → nueva consulta. Pegar, reemplazar los dos textos en mayúsculas y ejecutar (**Run**):

```sql
select vault.create_secret('PEGAR_LA_URL_QUE_TERMINA_EN_/exec', 'avisos_url');
select vault.create_secret('PEGAR_LA_CLAVE_SECRETA', 'avisos_secreto');
```

Después, borrar esa consulta del editor (no hace falta que quede guardada). Los valores quedan cifrados en Vault.

Para cambiarlos más adelante:

```sql
select vault.update_secret((select id from vault.secrets where name = 'avisos_url'), 'NUEVA_URL');
```

## Cambios futuros en el script

Editar el código → guardar → **Implementar** → *Gestionar implementaciones* → ✏️ → Versión: **Nueva versión** →
*Implementar*. La URL no cambia, así que no hay que tocar Supabase.

`SITIO`, al principio de `avisos.gs`, es la dirección del sitio (`https://smilescampana.com.ar`): la usan el logo y los botones.

## Si un correo no llega

En Supabase → SQL Editor:

```sql
select created, status_code, content from net._http_response order by created desc limit 10;
```

Las respuestas se guardan unas horas. Un envío correcto responde `200` con `{"ok":true,...}`;
`{"ok":false,"error":"clave"}` indica que la clave de Vault no coincide con la propiedad SECRETO del script.
En el script: *Ejecuciones* (menú de la izquierda) muestra cada envío y cualquier error.

## Copias de seguridad semanales

Todos los domingos a las 3:00 la base arma una copia de sus tablas (pacientes, antecedentes, turnos,
odontogramas, evoluciones, perfiles y agenda) y se la manda a este mismo script, que la guarda en Drive en la
carpeta **Smiles Campana – Respaldos** como `respaldo-AAAA-MM-DD_HHMM.json`. Se conservan unos 3 meses
(las más viejas van a la papelera de Drive). Los lunes a las 9 el script revisa que haya una copia de la
última semana y, si falta, manda un correo de aviso a la casilla del consultorio.

La copia **no** incluye las claves de las cuentas: si alguna vez hay que reconstruir todo, cada paciente crea
su cuenta de nuevo con su correo y DNI y queda vinculado solo a su ficha, con todo su historial.

Los archivos tienen datos clínicos: la carpeta es privada; no la compartas. Conviene que la cuenta de Google
del consultorio tenga activada la verificación en dos pasos.

### Instalar (una sola vez)

1. En el proyecto del script, reemplazar todo el código por el `avisos.gs` actualizado y guardar.
2. Elegir la función `instalarControlRespaldo` → **Ejecutar**. Google pide un permiso nuevo para usar
   **Drive**: aceptarlo igual que antes (*Configuración avanzada* → *Ir a…* → marcar todo → *Permitir*).
   Se crea la carpeta en Drive y queda programado el control de los lunes.
3. **Implementar** → *Gestionar implementaciones* → ✏️ → Versión: **Nueva versión** → *Implementar*.
   La dirección no cambia.

### Restaurar

Usar `supabase/restaurar.sql` en el SQL Editor de Supabase: pegar el contenido del archivo de respaldo donde
dice `PEGAR_ACA` y ejecutar. Agrega lo que falta sin pisar lo que existe (sirve para recuperar algo borrado
por error o para reconstruir en un proyecto nuevo) y no envía correos mientras restaura.

### Hacer una copia en cualquier momento

En Supabase → SQL Editor: `select enviar_respaldo();` (en uno o dos minutos aparece el archivo en Drive).


## Turnos en Google Calendar

Los turnos **confirmados** aparecen solos en el **calendario principal** de smiles.campana@gmail.com, y se
actualizan cuando se cambia el horario, se marcan como atendidos (verde) o ausentes (gris) o se cancelan
(el evento se borra). Los pedidos por confirmar no aparecen hasta que se confirman.

- Cada evento dice **apellido, nombre · motivo** y trae un enlace a la ficha en la intranet. No lleva teléfono
  ni datos clínicos, no tiene invitados (no se le avisa nada al paciente) y no tiene recordatorios.
- Va en **una sola dirección**: lo que se cambie en Google Calendar no vuelve a la app. Todos los días a las 3:23
  la base manda la lista de turnos de los próximos 60 días y el script deja el calendario igual que la app
  (crea lo que falta, corrige lo que se movió a mano y borra lo que sobra). Solo toca los eventos de turnos:
  los que cargues a mano en el calendario no se tocan.

### Activar (una sola vez, unos 10 minutos)

Con la sesión de **smiles.campana@gmail.com** abierta, en el proyecto del script (<https://script.google.com>):

1. Reemplazar todo el código por el `avisos.gs` actualizado y **guardar**.
2. **Servicio de Calendar:** en el menú de la izquierda, junto a *Servicios*, tocar **+** → elegir
   **Google Calendar API** → dejar el identificador como está (`Calendar`) → **Agregar**.
3. **Prueba y permiso:** elegir la función `probarCalendario` en la lista de arriba → **Ejecutar**. Google pide un
   permiso nuevo para el **Calendario**: aceptarlo igual que antes (*Configuración avanzada* → *Ir a…* →
   *Permitir*). En el *Registro de ejecución* tiene que decir "Crear… Mover… Borrar…" y al final
   **"Listo. Si no hubo errores, el calendario está conectado."**
4. **Implementar** → *Gestionar implementaciones* → ✏️ → Versión: **Nueva versión** → *Implementar*.
   La dirección no cambia.
5. Avisar para activar la parte de la base (migración p20, aplicada el 02/11/2026).

**Desde el 04/11/2026 (carga de pacientes reales, migración p23):** los eventos ya no dicen "PRUEBA · …" y el repaso
diario está programado (`calendario-diario`, 3:23). Los turnos se dan solo en el sistema.

### Verlo en otro teléfono o cuenta

En Google Calendar (web) con la cuenta del consultorio: ⚙️ *Configuración* → en *Configuración de mis
calendarios*, el calendario principal → *Compartir con determinadas personas* → agregar la cuenta personal →
permiso **"Ver todos los detalles de los eventos"**. Así se ve en el celular sin poder modificarlo.
Ojo: se comparte todo el calendario principal de la cuenta, no solo los turnos.

### Si algo no aparece

- Esperar al repaso de la madrugada, o forzarlo en Supabase → SQL Editor: `select sincronizar_calendario();`.
- Revisar las respuestas: `select created, status_code, content from net._http_response order by created desc limit 10;`
  (`{"ok":true,"tipo":"calendario_completo",...}` indica cuántos eventos creó, corrigió y borró).
- En el script: *Ejecuciones* muestra cada llamada y cualquier error (por ejemplo, si falta el servicio
  *Google Calendar API* del paso 2).
