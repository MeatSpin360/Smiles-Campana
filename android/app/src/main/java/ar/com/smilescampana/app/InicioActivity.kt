package ar.com.smilescampana.app

import android.content.Intent
import android.os.Bundle
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

/**
 * Pantalla inicial: "Subir fotos paciente" (modo simple, solo fotos) o "Ventana de trabajo" (la intranet completa).
 * Es propia de la app, así que aparece al instante; el sitio se carga recién al elegir. Desde cualquiera de los dos
 * modos, "atrás" vuelve acá. La sesión es la misma en los dos.
 */
class InicioActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_inicio)
        findViewById<android.view.View>(R.id.opcionFotos).setOnClickListener { abrir(MainActivity.MODO_FOTOS) }
        findViewById<android.view.View>(R.id.opcionTrabajo).setOnClickListener { abrir(MainActivity.MODO_TRABAJO) }
        val version = try {
            packageManager.getPackageInfo(packageName, 0).versionName ?: ""
        } catch (e: Exception) { "" }
        findViewById<TextView>(R.id.version).text = "Smiles Campana · versión $version"
    }

    private fun abrir(modo: String) {
        startActivity(Intent(this, MainActivity::class.java).putExtra(MainActivity.MODO, modo))
    }
}
