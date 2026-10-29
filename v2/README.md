# Smiles Campana: sitio y sistema del consultorio (versión 2)

Sitio público, espacio personal para pacientes e intranet con roles (recepción, odontología, administración), con odontograma interactivo por caras.

No necesita compilación: son archivos HTML, CSS y JavaScript que se suben tal cual a cualquier hosting estático.

## Qué hay en cada lugar

| Archivo / carpeta | Para qué es |
|---|---|
| `index.html` | Sitio público (tratamientos, consultorio, turnos online, horarios, mapa) |
| `app.html` | Mi espacio (pacientes) e intranet (personal), según quién ingresa |
| `config.js` | Datos de conexión a Supabase y datos del consultorio |
| `supabase/schema.sql` | Base de datos completa con permisos por rol |
| `assets/js/odontograma/` | Odontograma: modelo (`modelo.js`), dibujo SVG (`dibujo.js`) e interacción (`componente.js`) |
| `assets/js/api/` | Acceso a datos: `supabase.js` (real) y `demo.js` (demostración local) |
| `assets/js/app/portal/` | Pantallas del paciente |
| `assets/js/app/staff/` | Pantallas del personal |

## Probarlo en la computadora (modo demostración)

Con `config.js` sin completar, todo funciona en **modo demostración**: los datos se guardan en el navegador y hay botones para entrar como cada rol.

Hace falta abrirlo desde un servidor local (no con doble clic, porque los módulos de JavaScript no cargan desde `file://`). Cualquiera de estas opciones sirve:

- **VS Code**: extensión *Live Server*, clic derecho en `index.html` > *Open with Live Server*.
- **Python** (en esta carpeta): `python -m http.server 8080` y abrir http://localhost:8080
- **Node**: `npx serve .`

Cuentas de demostración (clave `demo1234`): `paciente@demo.com`, `recepcion@demo.com`, `odontologia@demo.com`, `admin@demo.com`.

## Roles y permisos

| | Paciente | Recepción | Odontología | Admin |
|---|:-:|:-:|:-:|:-:|
| Pedir turnos (quedan por confirmar), verlos y cancelarlos | ✓ | | | |
| Ver su odontograma (solo lectura) y editar sus datos de contacto | ✓ | | | |
| Agenda: dar turnos, cambiar estados | | ✓ | ✓ | ✓ |
| Confirmar o rechazar los turnos pedidos online | | ✓ | ✓ | ✓ |
| Fichas de pacientes: alta y datos | | ✓ | ✓ | ✓ |
| Vincular cuentas nuevas con fichas existentes | | ✓ | ✓ | ✓ |
| Odontograma, antecedentes y evoluciones | | | ✓ | ✓ |
| Horarios de atención y días bloqueados | | ✓ | | ✓ |
| Usuarios y roles | | | | ✓ |

Los permisos los aplica la **base de datos** (Row Level Security de Postgres), no solo la pantalla: aunque alguien manipule la página, no puede leer ni escribir lo que su rol no permite. El esquema se probó con 28 casos (paciente, recepción, odontología, admin, cuenta con DNI ajeno y visitante anónimo).

### Cómo se vinculan las cuentas con las fichas

Cuando alguien crea su cuenta con su DNI:

- si no había ficha con ese DNI, se crea y queda vinculada;
- si había ficha con ese DNI **y el mismo email**, se vincula sola;
- si había ficha con ese DNI pero **otro email**, la cuenta queda pendiente y recepción la vincula desde *Pacientes* después de verificar la identidad. Así nadie accede a la historia clínica de otra persona solo con saber su DNI.

### Odontograma

- Numeración FDI, permanentes (11 a 48) y temporarias (51 a 85) opcionales.
- Cinco caras por pieza: vestibular, palatina/lingual, mesial, distal y oclusal/incisal, ubicadas según el cuadrante.
- Rojo = a realizar, azul = realizado. Marcas de pieza completa: extracción indicada / ausente, corona, tratamiento de conducto e implante.
- Cada vez que se guarda queda un **registro nuevo con fecha y autor**; los anteriores no se pisan (el primero es el odontograma inicial).
- En computadora se marca con clic directo sobre las caras. En celular se toca la pieza y se edita ampliada.

## Ponerlo online

### 1. Crear la base de datos en Supabase

1. Crear una cuenta en https://supabase.com y un proyecto nuevo (región São Paulo, la más cercana).
2. Ir a **SQL Editor > New query**, pegar todo el contenido de `supabase/schema.sql` y ejecutar (*Run*).
3. En **Project Settings > API** copiar la *Project URL* y la clave *anon public*, y pegarlas en `config.js`:

   ```js
   export const SUPABASE_URL = 'https://xxxxx.supabase.co';
   export const SUPABASE_ANON_KEY = 'eyJ...';
   ```

   La clave *anon* es pública por diseño (va en el navegador); la seguridad la dan los permisos del esquema. **Nunca** pongas la clave *service_role* en este proyecto.

### 2. Subir el sitio

Cualquier hosting estático sirve. Opciones gratuitas y simples: **Cloudflare Pages** o **Netlify** (se puede arrastrar la carpeta a la página). También GitHub Pages si el repositorio es público.

### 3. Configurar el login

En Supabase, **Authentication > URL Configuration**:

- *Site URL*: `https://smilescampana.com.ar`
- *Redirect URLs*: `https://smilescampana.com.ar/**` y `https://www.smilescampana.com.ar/**` (y, mientras se use, la de workers.dev)
- Para probar en la PC con Live Server, agregar también `http://127.0.0.1:5500/**` y `http://localhost:5500/**`

### 4. Crear el primer administrador

1. Entrar al sitio, ir a *Mi espacio* y crear una cuenta (como si fuera paciente).
2. En Supabase, **SQL Editor**, ejecutar con el email de esa cuenta:

   ```sql
   update perfiles set rol = 'admin' where email = 'tu-email@ejemplo.com';
   ```

3. Desde ahí, el resto del personal se suma desde la intranet: cada persona crea su cuenta y el admin le asigna el rol en *Usuarios*.

### 5. Antes de usarlo con pacientes reales

- **Emails (obligatorio)**: el servidor de email incluido en Supabase solo envía a los miembros del equipo del proyecto, y 2 por hora. Para que los pacientes reciban la confirmación de cuenta y la recuperación de clave hay que configurar un SMTP propio en **Authentication > SMTP Settings** (por ejemplo Gmail con contraseña de aplicación: `smtp.gmail.com`, puerto 587).
- **Pausa por inactividad**: en el plan gratuito, un proyecto sin actividad durante 7 días se pausa hasta reactivarlo desde el panel. Con uso diario no pasa, pero tenerlo en cuenta en vacaciones.
- **Copias de seguridad**: el plan gratuito no incluye backups diarios. Con historias clínicas reales conviene pasar al plan Pro o exportar la base periódicamente.
- **Datos de salud**: la historia clínica está alcanzada por las leyes 26.529 y 25.326. Conviene que la política de privacidad del consultorio lo mencione y registrar la base ante la Agencia de Acceso a la Información Pública.

## Personalizar

- **Textos del sitio**: directamente en `index.html`.
- **Datos de contacto**: `config.js` y `index.html`.
- **Horarios**: desde la intranet (*Horarios*); el sitio los toma de ahí.
- **Colores y tipografía**: variables al principio de `assets/css/base.css`.
- **Fotos**: carpeta `assets/img`. La foto del consultorio es una ilustración; conviene reemplazarla por una foto real (mismo nombre de archivo, `consultorio.jpg`).
