package ar.com.smilescampana.app

import android.net.Uri
import android.webkit.JavascriptInterface
import org.json.JSONArray
import org.json.JSONObject

/**
 * Lo que el sitio puede pedirle a la app (window.SmilesApp). Solo responde si la página es del consultorio.
 * Los métodos corren fuera del hilo de la pantalla: lo visual pasa por runOnUiThread.
 */
class Puente(private val act: MainActivity) {

    private fun permitido() = act.sitioActual in MainActivity.SITIOS

    @JavascriptInterface
    fun version(): String = try {
        act.packageManager.getPackageInfo(act.packageName, 0).versionName ?: ""
    } catch (e: Exception) { "" }

    /** Abre la cámara para un paciente. Al volver, la app llama a window.smilesAppFotosListas(pacienteId, cantidad). */
    @JavascriptInterface
    fun sacarFotos(pacienteId: String, carpeta: String, titulo: String) {
        if (!permitido() || pacienteId.isBlank()) return
        act.runOnUiThread { act.abrirCamara(pacienteId, CamaraActivity.limpiarCarpeta(carpeta), titulo) }
    }

    /** Fotos sin subir de un paciente: [{ id, fecha, nombre, url }] (url: /__app/foto/<id>, del mismo sitio). */
    @JavascriptInterface
    fun pendientes(pacienteId: String): String {
        if (!permitido()) return "[]"
        val arr = JSONArray()
        Pendientes.dePaciente(act, pacienteId).forEach { f ->
            arr.put(JSONObject().put("id", f.id).put("fecha", f.fecha).put("nombre", f.nombre).put("url", MainActivity.RUTA_FOTOS + f.id))
        }
        return arr.toString()
    }

    /** Cuántas fotos sin subir hay por paciente: { pacienteId: cantidad }. */
    @JavascriptInterface
    fun resumenPendientes(): String {
        if (!permitido()) return "{}"
        val o = JSONObject()
        Pendientes.todas(act).groupBy { it.pacienteId }.forEach { (pid, fotos) -> o.put(pid, fotos.size) }
        return o.toString()
    }

    /** Ya se subió a la ficha: sale de la lista (el original queda en la carpeta del celular). */
    @JavascriptInterface
    fun marcarSubida(id: String) {
        if (!permitido()) return
        Pendientes.quitar(act, id)
    }

    /** Foto descartada: se borra del celular y sale de la lista. Devuelve false si el archivo no se pudo borrar. */
    @JavascriptInterface
    fun descartar(id: String): Boolean {
        if (!permitido()) return false
        val foto = Pendientes.buscar(act, id) ?: return true
        val borrada = try {
            act.contentResolver.delete(Uri.parse(foto.uri), null, null) > 0
        } catch (e: Exception) { false }
        Pendientes.quitar(act, id)
        return borrada
    }
}
