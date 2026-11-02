package ar.com.smilescampana.app

import android.Manifest
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.provider.MediaStore
import android.util.Size
import android.view.OrientationEventListener
import android.view.Surface
import android.view.View
import android.widget.Button
import android.widget.ImageButton
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID
import java.util.concurrent.Executors

/**
 * Cámara para sacar varias fotos seguidas de un paciente. Cada foto se guarda en calidad completa en
 * Imágenes/smiles-campana/<carpeta>/ y queda en la lista de "sin subir". "Listo" vuelve a la ficha.
 */
class CamaraActivity : AppCompatActivity() {

    companion object {
        const val PACIENTE = "paciente_id"
        const val CARPETA = "carpeta"
        const val TITULO = "titulo"
        const val CANTIDAD = "cantidad"

        /** Nombre de carpeta válido: sin / \ : * ? " < > | y sin espacios de más. */
        fun limpiarCarpeta(t: String): String =
            t.replace(Regex("[\\\\/:*?\"<>|]"), " ").replace(Regex("\\s+"), " ").trim().ifBlank { "Paciente" }.take(80)
    }

    private lateinit var pacienteId: String
    private lateinit var carpeta: String
    private var captura: ImageCapture? = null
    private var cantidad = 0
    private val trabajos = Executors.newSingleThreadExecutor()
    private lateinit var orientacion: OrientationEventListener

    private val permiso = registerForActivityResult(ActivityResultContracts.RequestPermission()) { ok ->
        if (ok) iniciar() else {
            Toast.makeText(this, "Sin permiso para usar la cámara.", Toast.LENGTH_LONG).show()
            terminar()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_camara)
        pacienteId = intent.getStringExtra(PACIENTE) ?: run { finish(); return }
        carpeta = limpiarCarpeta(intent.getStringExtra(CARPETA) ?: "")
        findViewById<TextView>(R.id.paciente).text = intent.getStringExtra(TITULO) ?: carpeta
        findViewById<ImageButton>(R.id.disparar).setOnClickListener { disparar() }
        findViewById<Button>(R.id.listo).setOnClickListener { terminar() }
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() = terminar()
        })

        // La pantalla queda vertical; si el celular se gira, la foto se guarda con la orientación correcta
        orientacion = object : OrientationEventListener(this) {
            override fun onOrientationChanged(grados: Int) {
                if (grados == OrientationEventListener.ORIENTATION_UNKNOWN) return
                captura?.targetRotation = when (grados) {
                    in 45 until 135 -> Surface.ROTATION_270
                    in 135 until 225 -> Surface.ROTATION_180
                    in 225 until 315 -> Surface.ROTATION_90
                    else -> Surface.ROTATION_0
                }
            }
        }

        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) iniciar()
        else permiso.launch(Manifest.permission.CAMERA)
    }

    override fun onStart() {
        super.onStart()
        orientacion.enable()
    }

    override fun onStop() {
        super.onStop()
        orientacion.disable()
    }

    private fun iniciar() {
        val proveedorFuturo = ProcessCameraProvider.getInstance(this)
        proveedorFuturo.addListener({
            val proveedor = proveedorFuturo.get()
            val vista = Preview.Builder().build().also {
                it.setSurfaceProvider(findViewById<PreviewView>(R.id.vista).surfaceProvider)
            }
            captura = ImageCapture.Builder()
                .setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY)
                .build()
            try {
                proveedor.unbindAll()
                proveedor.bindToLifecycle(this, CameraSelector.DEFAULT_BACK_CAMERA, vista, captura)
            } catch (e: Exception) {
                Toast.makeText(this, "No se pudo abrir la cámara.", Toast.LENGTH_LONG).show()
                terminar()
            }
        }, ContextCompat.getMainExecutor(this))
    }

    private fun disparar() {
        val c = captura ?: return
        val boton = findViewById<ImageButton>(R.id.disparar)
        boton.isEnabled = false
        val ahora = Date()
        val nombre = "$carpeta - ${SimpleDateFormat("yyyy-MM-dd HH.mm.ss", Locale.US).format(ahora)}-${cantidad + 1}.jpg"
        val datos = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, nombre)
            put(MediaStore.MediaColumns.MIME_TYPE, "image/jpeg")
            put(MediaStore.MediaColumns.RELATIVE_PATH, "Pictures/smiles-campana/$carpeta")
        }
        val opciones = ImageCapture.OutputFileOptions.Builder(contentResolver, MediaStore.Images.Media.EXTERNAL_CONTENT_URI, datos).build()
        destello()
        c.takePicture(opciones, ContextCompat.getMainExecutor(this), object : ImageCapture.OnImageSavedCallback {
            override fun onImageSaved(r: ImageCapture.OutputFileResults) {
                boton.isEnabled = true
                val uri = r.savedUri ?: return
                Pendientes.agregar(this@CamaraActivity, Pendientes.Foto(UUID.randomUUID().toString(), pacienteId, uri.toString(), ahora.time, nombre))
                cantidad++
                findViewById<TextView>(R.id.contador).apply { visibility = View.VISIBLE; text = cantidad.toString() }
                miniatura(uri)
            }

            override fun onError(e: ImageCaptureException) {
                boton.isEnabled = true
                Toast.makeText(this@CamaraActivity, "No se pudo guardar la foto: ${e.message}", Toast.LENGTH_LONG).show()
            }
        })
    }

    private fun destello() {
        findViewById<View>(R.id.destello).apply {
            alpha = 0.7f
            animate().alpha(0f).setDuration(180).start()
        }
    }

    private fun miniatura(uri: Uri) {
        trabajos.execute {
            val bmp = try { contentResolver.loadThumbnail(uri, Size(200, 200), null) } catch (e: Exception) { null }
            runOnUiThread { bmp?.let { findViewById<ImageView>(R.id.ultima).setImageBitmap(it) } }
        }
    }

    private fun terminar() {
        setResult(RESULT_OK, Intent().putExtra(PACIENTE, pacienteId).putExtra(CANTIDAD, cantidad))
        finish()
    }

    override fun onDestroy() {
        super.onDestroy()
        trabajos.shutdown()
    }
}
