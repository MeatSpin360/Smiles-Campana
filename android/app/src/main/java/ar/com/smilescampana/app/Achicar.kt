package ar.com.smilescampana.app

import android.content.ContentResolver
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.media.ExifInterface
import android.net.Uri
import java.io.ByteArrayOutputStream
import java.io.IOException
import kotlin.math.max
import kotlin.math.min

/**
 * Achica una foto de la cámara para subirla (lo mismo que hace el sitio en la computadora, pero mucho más rápido
 * que dentro del navegador del celular). Respeta la orientación guardada en la foto y suma el giro elegido.
 */
object Achicar {
    class Resultado(val jpeg: ByteArray, val ancho: Int, val alto: Int)

    fun jpeg(cr: ContentResolver, uri: Uri, lado: Int, giro: Int, calidad: Int): Resultado {
        val medidas = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        (cr.openInputStream(uri) ?: throw IOException("Sin foto")).use { BitmapFactory.decodeStream(it, null, medidas) }
        if (medidas.outWidth <= 0 || medidas.outHeight <= 0) throw IOException("No es una imagen")

        // Se lee ya reducida (de a mitades) sin bajar del tamaño pedido: usa mucha menos memoria
        val mayor = max(medidas.outWidth, medidas.outHeight)
        var muestra = 1
        while (mayor / (muestra * 2) >= lado) muestra *= 2
        val leida = (cr.openInputStream(uri) ?: throw IOException("Sin foto")).use {
            BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = muestra })
        } ?: throw IOException("No se pudo leer la foto")

        val orientacion = try {
            (cr.openInputStream(uri) ?: throw IOException("Sin foto")).use {
                ExifInterface(it).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
            }
        } catch (e: Exception) { ExifInterface.ORIENTATION_NORMAL }
        val giroFoto = when (orientacion) {
            ExifInterface.ORIENTATION_ROTATE_90 -> 90
            ExifInterface.ORIENTATION_ROTATE_180 -> 180
            ExifInterface.ORIENTATION_ROTATE_270 -> 270
            else -> 0
        }

        val escala = min(1f, lado.toFloat() / max(leida.width, leida.height))
        val m = Matrix().apply {
            postScale(escala, escala)
            postRotate(((giroFoto + giro) % 360).toFloat())
        }
        val final = Bitmap.createBitmap(leida, 0, 0, leida.width, leida.height, m, true)
        if (final !== leida) leida.recycle()
        val salida = ByteArrayOutputStream()
        final.compress(Bitmap.CompressFormat.JPEG, calidad, salida)
        val r = Resultado(salida.toByteArray(), final.width, final.height)
        final.recycle()
        return r
    }
}
