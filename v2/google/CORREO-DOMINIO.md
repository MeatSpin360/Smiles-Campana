# Correos con el dominio smilescampana.com.ar

Dos direcciones, las dos llegan a la casilla de siempre (**smiles.campana@gmail.com**):

| Dirección | Para qué |
|---|---|
| `turnos@smilescampana.com.ar` | Remitente de los correos automáticos (cuenta y turnos). Si un paciente responde, llega a Gmail. |
| `consultas@smilescampana.com.ar` | Contacto general: la que se muestra en el sitio. |

- **Recibir**: Cloudflare *Email Routing* reenvía las dos direcciones a Gmail (gratis).
- **Enviar**: **Resend** (servicio de envío, plan gratuito) firma los correos con el dominio para que lleguen a la
  bandeja de entrada y no a spam. Lo usan Supabase (correos de la cuenta) y Gmail "Enviar como" (correos de turnos;
  así siguen quedando en *Enviados*).

Trabajar con la sesión de **smiles.campana@gmail.com** (en una ventana de incógnito si hay varias cuentas abiertas).
La clave de Resend se carga solo en Supabase y en Gmail: no la compartas.

## 1. Recibir: Cloudflare Email Routing (10 min)

1. Cloudflare → dominio **smilescampana.com.ar** → **Email** → **Email Routing** → *Get started* / *Enable*.
   Aceptar que agregue los registros (MX y TXT) que propone.
2. **Destination addresses** → agregar `smiles.campana@gmail.com` → llega un correo de Cloudflare a Gmail:
   abrirlo y verificar.
3. **Routing rules** → *Custom addresses* → *Create address*:
   - `turnos` → *Send to an email* → `smiles.campana@gmail.com` → *Save*.
   - `consultas` → lo mismo.
4. Prueba: desde otra cuenta, mandar un correo a `consultas@smilescampana.com.ar`; tiene que llegar a Gmail.

## 2. Enviar: Resend (15 min)

1. Entrar a <https://resend.com> y crear la cuenta con `smiles.campana@gmail.com`. En la página de precios
   confirmar los límites del plan gratuito (alcanza de sobra para el consultorio).
2. **Domains** → **Add domain** → `smilescampana.com.ar` (región: la más cercana que ofrezca, por ejemplo São Paulo).
3. Resend muestra unos registros DNS (DKIM y los del subdominio de envío). Si ofrece **conectar con Cloudflare**
   (*Auto configure*), usarlo; si no, cargarlos a mano en Cloudflare → *DNS* → *Records* → *Add record*, copiando
   tipo, nombre y valor tal cual. Volver a Resend → **Verify**: el dominio tiene que quedar *Verified*
   (puede tardar unos minutos).
4. En Cloudflare → *DNS* → *Add record*: tipo **TXT**, nombre `_dmarc`, valor `v=DMARC1; p=none;`
   (política de dominio recomendada; si Resend ya la pidió en el paso 3, no repetir).
5. Resend → **API Keys** → **Create API key**: nombre `smiles`, permiso **Sending access**, dominio
   `smilescampana.com.ar`. Copiar la clave (empieza con `re_`; se muestra una sola vez) y guardarla en un lugar
   seguro. Es la "contraseña" de los pasos 3 y 4.

## 3. Correos de la cuenta: Supabase (2 min)

Supabase → **Authentication** → **Emails** → **SMTP Settings** (donde hoy está Gmail):

| Campo | Valor |
|---|---|
| Sender email | `turnos@smilescampana.com.ar` |
| Sender name | `Smiles Campana` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | la clave de Resend (`re_…`) |

Guardar. Después de probar (paso 6), la contraseña de aplicación de Gmail que se usaba acá ya no hace falta:
se puede revocar en la cuenta de Google → *Seguridad* → *Contraseñas de aplicaciones*.

## 4. Correos de turnos: Gmail "Enviar como" (5 min)

En Gmail de `smiles.campana@gmail.com` → ⚙️ → **Ver toda la configuración** → **Cuentas e importación** →
**Enviar como** → *Añadir otra dirección de correo electrónico*:

1. Nombre `Smiles Campana`, dirección `turnos@smilescampana.com.ar` (dejar marcado "Tratar como alias") → *Siguiente*.
2. Servidor SMTP `smtp.resend.com`, puerto `465`, usuario `resend`, contraseña la clave de Resend,
   **Conexión segura con SSL** → *Añadir cuenta*.
3. Gmail manda un código a `turnos@…`, que llega a la misma casilla gracias al paso 1: abrir el correo y confirmar.
4. Opcional: repetir con `consultas@smilescampana.com.ar` para poder responder a mano desde esa dirección, y en
   *Al responder a un mensaje* elegir **Responder desde la misma dirección a la que se envió el mensaje**.

## 5. Script de correos

Pegar el `avisos.gs` actualizado en el proyecto del script → guardar → **Implementar** → *Gestionar
implementaciones* → ✏️ → **Nueva versión**. El script usa `turnos@` automáticamente cuando la dirección está en
"Enviar como"; si no está, sigue enviando desde la cuenta de Gmail.

## 6. Prueba

1. En el script, ejecutar `probar`: llegan 5 correos "[Prueba]" **de** `turnos@smilescampana.com.ar`.
2. Abrir uno → ⋮ → **Mostrar original**: SPF, DKIM y DMARC tienen que decir **PASS**.
3. En el sitio, "Olvidé mi clave" con una cuenta de prueba: el correo tiene que llegar de `turnos@…`.
4. Confirmar un turno de prueba y revisar que llegue a la bandeja de entrada (no a spam).
