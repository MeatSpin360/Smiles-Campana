# Correos automáticos de turnos

`avisos.gs` es un script de Google Apps Script que envía los correos de turnos desde la cuenta
**smiles.campana@gmail.com** (quedan en *Enviados*). La base de datos lo llama sola cuando:

| Qué pasa | Correo |
|---|---|
| Se confirma un pedido | Tu turno está confirmado |
| Se confirma en otro horario (Ofrecer cambio / Cambiar horario) | Cambio de turno |
| El personal da un turno (Dar turno) | Tu turno quedó agendado |
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

Al pasar al dominio definitivo, cambiar `SITIO` al principio de `avisos.gs` (el logo y los botones lo usan).

## Si un correo no llega

En Supabase → SQL Editor:

```sql
select created, status_code, content from net._http_response order by created desc limit 10;
```

Las respuestas se guardan unas horas. Un envío correcto responde `200` con `{"ok":true,...}`;
`{"ok":false,"error":"clave"}` indica que la clave de Vault no coincide con la propiedad SECRETO del script.
En el script: *Ejecuciones* (menú de la izquierda) muestra cada envío y cualquier error.
