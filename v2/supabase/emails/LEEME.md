# Emails de la cuenta

Plantillas para **Supabase → Authentication → Email Templates**. Para cada una: copiar el asunto, abrir el archivo,
copiar todo el contenido y pegarlo en el cuadro *Message body* (reemplazando lo que hay), y guardar.

El logo se toma de la *Site URL* configurada en Supabase: al conectar el dominio, los emails lo usan solos.

| Plantilla en Supabase | Asunto | Archivo |
|---|---|---|
| Confirm sign up | Confirmá tu cuenta en Smiles Campana | `confirmar-cuenta.html` |
| Reset password | Elegí una clave nueva para Smiles Campana | `recuperar-clave.html` |
| Change email address | Confirmá tu nuevo email | `cambiar-email.html` |
| Password changed (notificación de seguridad; hay que activarla) | Tu clave de Smiles Campana se cambió | `aviso-clave-cambiada.html` |

El aviso de clave cambiada es una notificación de seguridad: además de pegar la plantilla, hay que activarla en la misma sección.
