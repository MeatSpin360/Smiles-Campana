# App Android "Smiles" (para odontología)

La app es la intranet de siempre dentro de una ventana, más lo propio del celular:

- **Sacar fotos** (en la pestaña *Fotos* de la ficha): abre la cámara; se pueden sacar todas las que se quiera.
  Cada foto se guarda **en calidad completa** en el celular, en `Imágenes/smiles-campana/<Apellido Nombre - DNI>/`
  (o "- sin DNI"), sin necesidad de internet.
- **Fotos sin subir (N)**: se revisan (ver grande, descartar, girar), se elige la sección (por defecto la consulta del
  día, que se crea sola) y se suben a la ficha, achicadas como cualquier otra foto. El original queda en el celular.
- Todo lo demás (ingreso, pacientes, turnos…) es el sitio: cuando el sitio cambia, la app ya está actualizada.

Arranca por `smiles-campana.emiliobrescasin.workers.dev` (fuera del mantenimiento lleva al dominio).
Requiere Android 10 o más nuevo.

## Cómo se arma

GitHub la arma sola cada vez que cambia algo en `android/` (archivo `.github/workflows/app-android.yml`):

1. En el repositorio, pestaña **Actions** → la ejecución más reciente de **"App Android"** (tilde verde).
2. Abajo, en **Artifacts**, bajar `smiles-app-N` (es un .zip con la `.apk` adentro).

## Instalar en el celular

1. Pasar la `.apk` al celular (por cable, Drive o mandándola por WhatsApp a uno mismo) y tocarla.
2. Android pide permiso para "instalar apps desconocidas" desde esa app (Archivos, Drive…): permitirlo solo para esto.
3. La primera vez que se usa la cámara, la app pide permiso: aceptar.

**Importante:** el celular tiene datos de salud (las fotos). Tiene que tener bloqueo de pantalla. El respaldo de la
carpeta `smiles-campana` lo hace el consultorio a un disco externo.

## Llave de firma (para que las actualizaciones se instalen encima)

Sin llave, cada versión que arma GitHub viene firmada con una llave de prueba distinta: para instalar una versión
nueva hay que **desinstalar la anterior** (las fotos de la carpeta no se borran, pero sí la lista de "sin subir").
Con la llave del consultorio, cada versión se instala encima. Se hace una sola vez, en el Ubuntu de WSL:

```bash
keytool -genkeypair -v -keystore smiles.jks -alias smiles -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 smiles.jks > smiles.jks.txt
```

(pide una clave: inventá una larga y **guardala**; los datos de nombre y organización pueden ir vacíos).

En GitHub → el repositorio → **Settings → Secrets and variables → Actions → New repository secret**, cargar:

| Nombre | Valor |
|---|---|
| `FIRMA_BASE64` | todo el contenido de `smiles.jks.txt` |
| `FIRMA_CLAVE` | la clave que inventaste |
| `FIRMA_ALIAS` | `smiles` |

Guardá `smiles.jks` y su clave en un lugar seguro (si se pierde, hay que desinstalar y empezar con una llave nueva).
**No** la subas al repositorio.
