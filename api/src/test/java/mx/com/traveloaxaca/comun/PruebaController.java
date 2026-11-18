package mx.com.traveloaxaca.comun;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import mx.com.traveloaxaca.comun.api.ApiResponse;
import mx.com.traveloaxaca.comun.api.ApiResponses;
import mx.com.traveloaxaca.comun.error.BusinessException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Rutas que solo existen en las pruebas, para ejercitar el manejo de errores. */
@RestController
@RequestMapping("/api/v1/prueba")
public class PruebaController {

    public record Entrada(@NotBlank(message = "El nombre es obligatorio.") String nombre,
                   @Size(max = 5, message = "Máximo 5 caracteres.") String clave) {
    }

    private final JdbcClient jdbc;

    public PruebaController(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @PostMapping("/validar")
    public ApiResponse<String> validar(@Valid @RequestBody Entrada e) {
        return ApiResponses.ok(e.nombre());
    }

    @GetMapping("/regla")
    public ApiResponse<Void> regla() {
        throw BusinessException.conflicto("Ese negocio ya tiene una suscripción activa.");
    }

    @GetMapping("/trigger")
    public ApiResponse<Void> trigger() {
        // El trigger de configuracion rechaza dias_gracia > 365 con un mensaje en español.
        jdbc.sql("UPDATE configuracion SET valor = '999'::jsonb WHERE clave = 'dias_gracia'").update();
        return ApiResponses.ok(null);
    }

    @GetMapping("/unico")
    public ApiResponse<Void> unico() {
        jdbc.sql("INSERT INTO configuracion (clave, tipo, valor, descripcion) VALUES ('dias_gracia','entero','1','x')").update();
        return ApiResponses.ok(null);
    }

    @GetMapping("/inesperado")
    public ApiResponse<Void> inesperado() {
        throw new IllegalStateException("secreto interno que no debe salir");
    }
}
