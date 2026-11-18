package mx.com.traveloaxaca.ventas.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import mx.com.traveloaxaca.comun.api.ApiResponse;
import mx.com.traveloaxaca.comun.api.ApiResponses;
import mx.com.traveloaxaca.comun.api.Pagina;
import mx.com.traveloaxaca.negocios.servicio.Actor;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.AuditoriaDto;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.ConfigCambioDto;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.ConfigDto;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.NotificacionDto;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.PlantillaDto;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.PlantillaEdicionDto;
import mx.com.traveloaxaca.ventas.servicio.OperacionServicio;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Auditoría, configuración, plantillas de correo y cola de notificaciones. Solo administración. */
@RestController
@RequestMapping("/api/v1/admin")
@Tag(name = "Operación (admin)")
public class OperacionController {

    private final OperacionServicio servicio;

    public OperacionController(OperacionServicio servicio) {
        this.servicio = servicio;
    }

    @Operation(summary = "Bitácora de cambios (solo lectura). Rango máximo de 90 días; por omisión, los últimos 30")
    @GetMapping("/auditoria")
    public ApiResponse<Pagina<AuditoriaDto>> auditoria(
            @RequestParam(required = false) String tabla,
            @RequestParam(required = false) UUID usuarioId,
            @RequestParam(required = false) String accion,
            @RequestParam(required = false) String registroId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta,
            @RequestParam(defaultValue = "0") int pagina,
            @RequestParam(defaultValue = "50") int tamano) {
        return ApiResponses.ok(servicio.auditoria(tabla, usuarioId, accion, registroId, desde, hasta, pagina, tamano));
    }

    @Operation(summary = "Claves de configuración con su valor, tipo y límites")
    @GetMapping("/configuracion")
    public ApiResponse<List<ConfigDto>> configuracion() {
        return ApiResponses.ok(servicio.configuracion());
    }

    @Operation(summary = "Cambiar una clave de configuración (se respeta su tipo y sus límites)")
    @PutMapping("/configuracion/{clave}")
    public ApiResponse<ConfigDto> cambiar(@AuthenticationPrincipal Jwt jwt, @PathVariable String clave,
                                          @Valid @RequestBody ConfigCambioDto cuerpo) {
        return ApiResponses.ok(servicio.cambiarConfiguracion(Actor.de(jwt), clave, cuerpo.valor()));
    }

    @Operation(summary = "Plantillas de notificación con las variables que admite cada una")
    @GetMapping("/plantillas")
    public ApiResponse<List<PlantillaDto>> plantillas() {
        return ApiResponses.ok(servicio.plantillas());
    }

    @Operation(summary = "Editar asunto, mensaje y si está activa. Solo se aceptan sus variables")
    @PutMapping("/plantillas/{id}")
    public ApiResponse<PlantillaDto> editar(@PathVariable UUID id, @Valid @RequestBody PlantillaEdicionDto cuerpo) {
        return ApiResponses.ok(servicio.editarPlantilla(id, cuerpo));
    }

    @Operation(summary = "Mandarme un correo de prueba con valores de ejemplo")
    @PostMapping("/plantillas/{id}/prueba")
    public ApiResponse<Void> probar(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        servicio.probarPlantilla(Actor.de(jwt), id);
        return ApiResponses.ok(null, List.of("Te mandamos un correo de prueba en unos segundos."));
    }

    @Operation(summary = "Cola de notificaciones")
    @GetMapping("/notificaciones")
    public ApiResponse<Pagina<NotificacionDto>> cola(@RequestParam(required = false) String estado,
                                                     @RequestParam(required = false) String plantilla,
                                                     @RequestParam(defaultValue = "0") int pagina,
                                                     @RequestParam(defaultValue = "50") int tamano) {
        return ApiResponses.ok(servicio.cola(estado, plantilla, pagina, tamano));
    }

    @Operation(summary = "Volver a intentar una notificación fallida")
    @PostMapping("/notificaciones/{id}/reintentar")
    public ApiResponse<Void> reintentar(@PathVariable UUID id) {
        servicio.reintentar(id);
        return ApiResponses.ok(null, List.of("La notificación volvió a la cola."));
    }
}
