package mx.com.traveloaxaca.negocios.almacen;

import java.time.Duration;
import java.util.Map;
import java.util.Optional;

/** Lugar donde viven las fotos. La API nunca recibe el archivo: da una URL firmada y lo verifica después. */
public interface AlmacenMedios {

    record UrlSubida(String url, Map<String, String> encabezados) {
    }

    record Objeto(long bytes, String mime) {
    }

    /** URL temporal para subir (PUT) exactamente un archivo con ese tipo y tamaño. */
    UrlSubida urlDeSubida(String clave, String mime, long bytes, Duration vigencia);

    /** Datos del archivo ya subido, o vacío si no existe. */
    Optional<Objeto> inspeccionar(String clave);

    /** Primeros bytes del archivo, para comprobar el tipo real. */
    byte[] leerInicio(String clave, int cuantos);

    /** URL con que se muestra la foto. */
    String urlPublica(String clave);

    void borrar(String clave);
}
