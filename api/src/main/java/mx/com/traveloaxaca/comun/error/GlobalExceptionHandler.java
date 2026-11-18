package mx.com.traveloaxaca.comun.error;

import jakarta.validation.ConstraintViolationException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import mx.com.traveloaxaca.comun.api.ApiResponse;
import mx.com.traveloaxaca.comun.api.ApiResponses;
import org.postgresql.util.PSQLException;
import org.postgresql.util.ServerErrorMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * Convierte cualquier error en el formato ApiResponse.
 * Los errores que la base de datos levanta con mensajes en español (triggers y funciones)
 * se devuelven tal cual al usuario; los técnicos se traducen a un mensaje genérico.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<ApiResponse<Void>> negocio(BusinessException e) {
        return responder(e.getEstado(), e.getMensajes(), e.getErrores());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Void>> validacion(MethodArgumentNotValidException e) {
        Map<String, String> errores = new LinkedHashMap<>();
        for (FieldError fe : e.getBindingResult().getFieldErrors()) {
            errores.putIfAbsent(fe.getField(), fe.getDefaultMessage());
        }
        return responder(HttpStatus.BAD_REQUEST, List.of("Revisa los campos marcados."), errores);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ApiResponse<Void>> parametros(ConstraintViolationException e) {
        Map<String, String> errores = new LinkedHashMap<>();
        e.getConstraintViolations().forEach(v -> {
            String ruta = v.getPropertyPath().toString();
            errores.putIfAbsent(ruta.substring(ruta.lastIndexOf('.') + 1), v.getMessage());
        });
        return responder(HttpStatus.BAD_REQUEST, List.of("Revisa los datos enviados."), errores);
    }

    @ExceptionHandler({HttpMessageNotReadableException.class, MissingServletRequestParameterException.class,
            MethodArgumentTypeMismatchException.class})
    public ResponseEntity<ApiResponse<Void>> peticionMalFormada(Exception e) {
        return responder(HttpStatus.BAD_REQUEST, List.of("La petición no tiene el formato esperado."), null);
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ApiResponse<Void>> metodo(HttpRequestMethodNotSupportedException e) {
        return responder(HttpStatus.METHOD_NOT_ALLOWED, List.of("Esa operación no está disponible en esta ruta."), null);
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    public ResponseEntity<ApiResponse<Void>> tipoContenido(HttpMediaTypeNotSupportedException e) {
        return responder(HttpStatus.UNSUPPORTED_MEDIA_TYPE, List.of("El tipo de contenido enviado no es válido."), null);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiResponse<Void>> noEncontrado(NoResourceFoundException e) {
        return responder(HttpStatus.NOT_FOUND, List.of("No encontramos lo que buscas."), null);
    }

    @ExceptionHandler(DataAccessException.class)
    public ResponseEntity<ApiResponse<Void>> baseDeDatos(DataAccessException e) {
        PSQLException pg = buscarPostgres(e);
        if (pg == null || pg.getSQLState() == null) {
            return inesperado(e);
        }
        ServerErrorMessage srv = pg.getServerErrorMessage();
        String mensajeServidor = srv != null && srv.getMessage() != null ? srv.getMessage() : "";
        switch (pg.getSQLState()) {
            case "P0001": // RAISE EXCEPTION sin código: reglas de negocio escritas en la base
            case "23514": // check_violation: de un trigger trae texto en español; de un CHECK es técnico
                if (esMensajeTecnico(mensajeServidor)) {
                    log.warn("CHECK de la base incumplido: {}", mensajeServidor);
                    return responder(HttpStatus.UNPROCESSABLE_ENTITY,
                            List.of("Los datos no cumplen las reglas del sistema."), null);
                }
                return responder(HttpStatus.UNPROCESSABLE_ENTITY, List.of(mensajeServidor), null);
            case "23502": { // not_null_violation
                String columna = srv != null ? srv.getColumn() : null;
                Map<String, String> errores = columna == null ? null : Map.of(columna, "Este dato es obligatorio.");
                return responder(HttpStatus.BAD_REQUEST, List.of("Falta información obligatoria."), errores);
            }
            case "23505": // unique_violation
                return responder(HttpStatus.CONFLICT, List.of("Ya existe un registro con esos datos."), null);
            case "23503": // foreign_key_violation
                return responder(HttpStatus.CONFLICT,
                        List.of("El dato está relacionado con otros registros o hace referencia a algo que no existe."), null);
            case "23P01": // exclusion_violation
                return responder(HttpStatus.CONFLICT,
                        List.of("Las fechas o el espacio se empalman con otro registro existente."), null);
            case "22P02": // invalid_text_representation
            case "22007": // invalid_datetime_format
            case "22003": // numeric_value_out_of_range
                return responder(HttpStatus.BAD_REQUEST, List.of("Uno de los datos enviados no es válido."), null);
            case "42501": // insufficient_privilege (también lo usa la bitácora inmutable)
                return responder(HttpStatus.FORBIDDEN,
                        List.of(mensajeServidor.isBlank() ? "No tienes permiso para esta operación." : mensajeServidor), null);
            default:
                return inesperado(e);
        }
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Void>> cualquiera(Exception e) {
        return inesperado(e);
    }

    // ------------------------------------------------------------------

    private static boolean esMensajeTecnico(String mensaje) {
        String m = mensaje.toLowerCase();
        return m.startsWith("new row for relation") || m.startsWith("check constraint")
                || m.contains("violates check constraint") || m.isBlank();
    }

    private static PSQLException buscarPostgres(Throwable e) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof PSQLException p) {
                return p;
            }
            if (t.getCause() == t) {
                break;
            }
        }
        return null;
    }

    private ResponseEntity<ApiResponse<Void>> inesperado(Exception e) {
        log.error("Error inesperado", e);
        return responder(HttpStatus.INTERNAL_SERVER_ERROR,
                List.of("Ocurrió un error inesperado. Intenta de nuevo; si continúa, avísanos con el identificador de la solicitud."),
                null);
    }

    private static ResponseEntity<ApiResponse<Void>> responder(HttpStatus estado, List<String> mensajes,
                                                                Map<String, String> errores) {
        return ResponseEntity.status(estado).body(ApiResponses.error(mensajes, errores));
    }
}
