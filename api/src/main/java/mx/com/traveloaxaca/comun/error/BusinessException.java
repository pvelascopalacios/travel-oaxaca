package mx.com.traveloaxaca.comun.error;

import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;

/** Error de regla de negocio. El mensaje se muestra tal cual al usuario, por eso va en español. */
public class BusinessException extends RuntimeException {

    private final HttpStatus estado;
    private final List<String> mensajes;
    private final Map<String, String> errores;

    public BusinessException(HttpStatus estado, List<String> mensajes, Map<String, String> errores) {
        super(String.join(" ", mensajes));
        this.estado = estado;
        this.mensajes = mensajes;
        this.errores = errores;
    }

    public static BusinessException invalida(String mensaje) {
        return new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, List.of(mensaje), null);
    }

    public static BusinessException invalida(String mensaje, Map<String, String> errores) {
        return new BusinessException(HttpStatus.UNPROCESSABLE_ENTITY, List.of(mensaje), errores);
    }

    public static BusinessException noEncontrado(String mensaje) {
        return new BusinessException(HttpStatus.NOT_FOUND, List.of(mensaje), null);
    }

    public static BusinessException conflicto(String mensaje) {
        return new BusinessException(HttpStatus.CONFLICT, List.of(mensaje), null);
    }

    public static BusinessException prohibido(String mensaje) {
        return new BusinessException(HttpStatus.FORBIDDEN, List.of(mensaje), null);
    }

    public static BusinessException noAutenticado(String mensaje) {
        return new BusinessException(HttpStatus.UNAUTHORIZED, List.of(mensaje), null);
    }

    public static BusinessException demasiadasSolicitudes(String mensaje) {
        return new BusinessException(HttpStatus.TOO_MANY_REQUESTS, List.of(mensaje), null);
    }

    public HttpStatus getEstado() {
        return estado;
    }

    public List<String> getMensajes() {
        return mensajes;
    }

    public Map<String, String> getErrores() {
        return errores;
    }
}
