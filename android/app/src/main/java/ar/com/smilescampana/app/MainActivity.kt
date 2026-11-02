package ar.com.smilescampana.app

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject
import java.io.ByteArrayInputStream

/**
 * La app es la intranet de siempre (el sitio) dentro de una ventana, más lo propio del celular: la cámara, la carpeta de
 * originales y la lista de fotos sin subir. El sitio habla con la app a través de window.SmilesApp (ver Puente.kt).
 * Arranca por workers.dev: fuera del mantenimiento lleva al dominio; durante el mantenimiento, es la entrada del personal.
 */
class MainActivity : AppCompatActivity() {

    companion object {
        const val INICIO = "https://smiles-campana.emiliobrescasin.workers.dev/app.html"
        val SITIOS = setOf("smilescampana.com.ar", "www.smilescampana.com.ar", "smiles-campana.emiliobrescasin.workers.dev")
        const val RUTA_FOTOS = "/__app/foto/"
    }

    lateinit var web: WebView
    @Volatile var sitioActual: String? = null
    private var elegirArchivos: ValueCallback<Array<Uri>>? = null

    private val selector = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        elegirArchivos?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(r.resultCode, r.data))
        elegirArchivos = null
    }

    private val camara = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        val pid = r.data?.getStringExtra(CamaraActivity.PACIENTE) ?: return@registerForActivityResult
        val cantidad = r.data?.getIntExtra(CamaraActivity.CANTIDAD, 0) ?: 0
        web.evaluateJavascript("window.smilesAppFotosListas && window.smilesAppFotosListas(${JSONObject.quote(pid)}, $cantidad)", null)
    }

    fun abrirCamara(pacienteId: String, carpeta: String, titulo: String) {
        camara.launch(Intent(this, CamaraActivity::class.java)
            .putExtra(CamaraActivity.PACIENTE, pacienteId)
            .putExtra(CamaraActivity.CARPETA, carpeta)
            .putExtra(CamaraActivity.TITULO, titulo))
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        web = WebView(this)
        setContentView(web)
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mediaPlaybackRequiresUserGesture = true
        }
        web.addJavascriptInterface(Puente(this), "SmilesApp")

        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url
                if (url.scheme == "https" && url.host in SITIOS) return false
                // WhatsApp, teléfono, correo, mapas y cualquier otro sitio: fuera de la app
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, url))
                } catch (e: Exception) {
                    Toast.makeText(this@MainActivity, "No hay una app para abrir ese enlace.", Toast.LENGTH_SHORT).show()
                }
                return true
            }

            override fun doUpdateVisitedHistory(view: WebView, url: String?, isReload: Boolean) {
                sitioActual = url?.let { Uri.parse(it).host }
            }

            override fun onPageStarted(view: WebView, url: String?, favicon: android.graphics.Bitmap?) {
                sitioActual = url?.let { Uri.parse(it).host }
            }

            // Las fotos sin subir se le muestran al sitio en /__app/foto/<id> (mismo origen: el sitio las puede leer y subir)
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                val url = request.url
                val ruta = url.path ?: return null
                if (!ruta.startsWith(RUTA_FOTOS) || url.host !in SITIOS) return null
                val foto = Pendientes.buscar(this@MainActivity, ruta.removePrefix(RUTA_FOTOS))
                    ?: return respuesta(404, "No encontrada")
                return try {
                    val datos = contentResolver.openInputStream(Uri.parse(foto.uri)) ?: return respuesta(404, "No encontrada")
                    WebResourceResponse("image/jpeg", null, 200, "OK", mapOf("Cache-Control" to "no-store"), datos)
                } catch (e: Exception) {
                    respuesta(404, "No encontrada")
                }
            }
        }

        web.webChromeClient = object : WebChromeClient() {
            // "Buscar fotos" y los adjuntos de pagos y documentos
            override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                elegirArchivos?.onReceiveValue(null)
                elegirArchivos = callback
                return try {
                    selector.launch(params.createIntent())
                    true
                } catch (e: Exception) {
                    elegirArchivos = null
                    false
                }
            }
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (web.canGoBack()) web.goBack() else finish()
            }
        })

        if (savedInstanceState != null) web.restoreState(savedInstanceState) else web.loadUrl(INICIO)
    }

    private fun respuesta(estado: Int, texto: String) =
        WebResourceResponse("text/plain", "utf-8", estado, texto, mapOf("Cache-Control" to "no-store"), ByteArrayInputStream(texto.toByteArray()))

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        web.saveState(outState)
    }
}
