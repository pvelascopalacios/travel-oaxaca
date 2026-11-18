package mx.com.traveloaxaca.comun.api;

import java.util.List;
import java.util.Map;
import org.slf4j.MDC;

/** Fábricas de respuestas. Los controladores solo usan estas, nunca construyen ApiResponse a mano. */
public final class ApiResponses {

    private ApiResponses() {
    }

    public static <T> ApiResponse<T> ok(T datos) {
        return new ApiResponse<>(true, datos, List.of(), null, solicitudId());
    }

    public static <T> ApiResponse<T> ok(T datos, List<String> mensajes) {
        return new ApiResponse<>(true, datos, mensajes, null, solicitudId());
    }

    public static ApiResponse<Void> error(List<String> mensajes) {
        return new ApiResponse<>(false, null, mensajes, null, solicitudId());
    }

    public static ApiResponse<Void> error(List<String> mensajes, Map<String, String> errores) {
        return new ApiResponse<>(false, null, mensajes,
                (errores == null || errores.isEmpty()) ? null : errores, solicitudId());
    }

    private static String solicitudId() {
        return MDC.get(SOLICITUD_ID_MDC);
    }

    /** Misma clave que usa SolicitudIdFilter para guardar el identificador en el MDC. */
    public static final String SOLICITUD_ID_MDC = "solicitudId";
}
