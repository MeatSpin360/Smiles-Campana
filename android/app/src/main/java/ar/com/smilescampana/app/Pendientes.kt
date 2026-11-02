package ar.com.smilescampana.app

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Fotos sacadas con la app que todavía no se subieron a la ficha. El archivo (calidad completa) queda en
 * Imágenes/smiles-campana/<Apellido Nombre - DNI>/; acá solo se guarda la lista, en el almacenamiento privado de la app.
 * Al subir una foto (o descartarla) sale de la lista; el original en la carpeta queda (salvo que se descarte).
 */
object Pendientes {
    data class Foto(val id: String, val pacienteId: String, val uri: String, val fecha: Long, val nombre: String)

    private const val ARCHIVO = "pendientes"
    private const val CLAVE = "fotos"

    @Synchronized
    fun todas(c: Context): MutableList<Foto> {
        val texto = c.getSharedPreferences(ARCHIVO, Context.MODE_PRIVATE).getString(CLAVE, "[]") ?: "[]"
        val arr = JSONArray(texto)
        return (0 until arr.length()).map { i ->
            val o = arr.getJSONObject(i)
            Foto(o.getString("id"), o.getString("paciente"), o.getString("uri"), o.getLong("fecha"), o.optString("nombre"))
        }.toMutableList()
    }

    @Synchronized
    private fun guardar(c: Context, lista: List<Foto>) {
        val arr = JSONArray()
        lista.forEach { f ->
            arr.put(JSONObject().put("id", f.id).put("paciente", f.pacienteId).put("uri", f.uri).put("fecha", f.fecha).put("nombre", f.nombre))
        }
        c.getSharedPreferences(ARCHIVO, Context.MODE_PRIVATE).edit().putString(CLAVE, arr.toString()).apply()
    }

    @Synchronized
    fun agregar(c: Context, f: Foto) = guardar(c, todas(c).apply { add(f) })

    @Synchronized
    fun quitar(c: Context, id: String) = guardar(c, todas(c).filter { it.id != id })

    fun buscar(c: Context, id: String): Foto? = todas(c).firstOrNull { it.id == id }

    fun dePaciente(c: Context, pacienteId: String): List<Foto> = todas(c).filter { it.pacienteId == pacienteId }.sortedBy { it.fecha }
}
