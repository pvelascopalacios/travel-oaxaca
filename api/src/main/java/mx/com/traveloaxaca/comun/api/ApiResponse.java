package mx.com.traveloaxaca.comun.api;

import java.util.List;
import java.util.Map;

/**
 * Formato único de respuesta de toda la API.
 *
 * @param ok          true si la operación se realizó
 * @param datos       contenido de la respuesta (nulo en errores)
 * @param mensajes    textos listos para mostrar al usuario, en español
 * @param errores     detalle por campo para formularios (campo -> mensaje)
 * @param solicitudId identificador de la petición, útil para rastrear un problema en los registros
 */
public record ApiResponse<T>(
        boolean ok,
        T datos,
        List<String> mensajes,
        Map<String, String> errores,
        String solicitudId) {
}
