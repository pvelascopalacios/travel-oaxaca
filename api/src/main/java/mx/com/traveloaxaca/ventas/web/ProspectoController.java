package mx.com.traveloaxaca.ventas.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import mx.com.traveloaxaca.comun.api.ApiResponse;
import mx.com.traveloaxaca.comun.api.ApiResponses;
import mx.com.traveloaxaca.comun.api.Pagina;
import mx.com.traveloaxaca.negocios.servicio.Actor;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.CambioEstadoDto;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.ConversionDto;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.ConvertirDto;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.InteraccionEntradaDto;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.PersonaEquipoDto;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.ProspectoDetalleDto;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.ProspectoEntradaDto;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.ProspectoResumenDto;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.ResumenVentasDto;
import mx.com.traveloaxaca.ventas.servicio.ProspectoServicio;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Embudo de ventas. Roles: ventas y admin. */
@RestController
@RequestMapping("/api/v1/admin/prospectos")
@Tag(name = "Prospectos (ventas)")
public class ProspectoController {

    private final ProspectoServicio servicio;

    public ProspectoController(ProspectoServicio servicio) {
        this.servicio = servicio;
    }

    @Operation(summary = "Lista de prospectos con filtros, las acciones más urgentes primero")
    @GetMapping
    public ApiResponse<Pagina<ProspectoResumenDto>> listar(
            @RequestParam(required = false) String estado,
            @RequestParam(required = false) UUID asignadoA,
            @RequestParam(defaultValue = "false") boolean sinAsignar,
            @RequestParam(required = false) UUID municipioId,
            @RequestParam(required = false) UUID categoriaId,
            @RequestParam(required = false) String origen,
            @RequestParam(defaultValue = "false") boolean vencidas,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") int pagina,
            @RequestParam(defaultValue = "50") int tamano) {
        return ApiResponses.ok(servicio.listar(estado, asignadoA, sinAsignar, municipioId, categoriaId, origen,
                vencidas, q, pagina, tamano));
    }

    @Operation(summary = "Totales del embudo: por estado, vencidas, sin asignar y conversiones del mes")
    @GetMapping("/resumen")
    public ApiResponse<ResumenVentasDto> resumen() {
        return ApiResponses.ok(servicio.resumen());
    }

    @Operation(summary = "Personas a quienes se puede asignar un prospecto")
    @GetMapping("/equipo")
    public ApiResponse<List<PersonaEquipoDto>> equipo() {
        return ApiResponses.ok(servicio.equipo());
    }

    @Operation(summary = "Ficha del prospecto con su historial de contactos")
    @GetMapping("/{id}")
    public ApiResponse<ProspectoDetalleDto> detalle(@PathVariable UUID id) {
        return ApiResponses.ok(servicio.detalle(id));
    }

    @Operation(summary = "Dar de alta un prospecto")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ProspectoDetalleDto> crear(@AuthenticationPrincipal Jwt jwt,
                                                  @Valid @RequestBody ProspectoEntradaDto cuerpo) {
        return ApiResponses.ok(servicio.crear(Actor.de(jwt), cuerpo));
    }

    @Operation(summary = "Editar los datos del prospecto")
    @PutMapping("/{id}")
    public ApiResponse<ProspectoDetalleDto> actualizar(@PathVariable UUID id,
                                                       @Valid @RequestBody ProspectoEntradaDto cuerpo) {
        return ApiResponses.ok(servicio.actualizar(id, cuerpo));
    }

    @Operation(summary = "Eliminar un prospecto (no aplica a los ya convertidos)")
    @DeleteMapping("/{id}")
    public ApiResponse<Void> eliminar(@PathVariable UUID id) {
        servicio.eliminar(id);
        return ApiResponses.ok(null);
    }

    @Operation(summary = "Cambiar el estado. Descartar pide el motivo; convertir tiene su propia acción")
    @PostMapping("/{id}/estado")
    public ApiResponse<ProspectoDetalleDto> estado(@PathVariable UUID id, @Valid @RequestBody CambioEstadoDto cuerpo) {
        return ApiResponses.ok(servicio.cambiarEstado(id, cuerpo));
    }

    @Operation(summary = "Registrar un contacto (llamada, visita, WhatsApp, correo, demo o nota)")
    @PostMapping("/{id}/interacciones")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ProspectoDetalleDto> interaccion(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                                        @Valid @RequestBody InteraccionEntradaDto cuerpo) {
        return ApiResponses.ok(servicio.registrarInteraccion(Actor.de(jwt), id, cuerpo));
    }

    @Operation(summary = "Convertir en negocio (borrador, alta asistida) con los datos del prospecto")
    @PostMapping("/{id}/convertir")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ConversionDto> convertir(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                                @RequestBody(required = false) ConvertirDto cuerpo) {
        return ApiResponses.ok(servicio.convertir(Actor.de(jwt), id, cuerpo));
    }
}
