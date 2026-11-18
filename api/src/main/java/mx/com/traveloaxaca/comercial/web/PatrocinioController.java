package mx.com.traveloaxaca.comercial.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.EspacioDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.EspacioEntradaDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PatrocinioDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PatrocinioEntradaDto;
import mx.com.traveloaxaca.comercial.servicio.PatrocinioServicio;
import mx.com.traveloaxaca.comun.api.ApiResponse;
import mx.com.traveloaxaca.comun.api.ApiResponses;
import mx.com.traveloaxaca.negocios.servicio.Actor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Espacios y calendario de patrocinios. Ventas y administración. */
@RestController
@RequestMapping("/api/v1/admin")
@Tag(name = "Patrocinios (admin y ventas)")
public class PatrocinioController {

    private final PatrocinioServicio servicio;

    public PatrocinioController(PatrocinioServicio servicio) {
        this.servicio = servicio;
    }

    @Operation(summary = "Espacios de patrocinio con su cupo")
    @GetMapping("/espacios-patrocinio")
    public ApiResponse<List<EspacioDto>> espacios() {
        return ApiResponses.ok(servicio.espacios());
    }

    @Operation(summary = "Crear un espacio de patrocinio")
    @PostMapping("/espacios-patrocinio")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<EspacioDto> crearEspacio(@Valid @RequestBody EspacioEntradaDto cuerpo) {
        return ApiResponses.ok(servicio.crearEspacio(cuerpo));
    }

    @Operation(summary = "Cambiar el cupo de un espacio o activarlo y desactivarlo")
    @PutMapping("/espacios-patrocinio/{id}")
    public ApiResponse<EspacioDto> actualizarEspacio(@PathVariable UUID id, @Valid @RequestBody EspacioEntradaDto cuerpo) {
        return ApiResponses.ok(servicio.actualizarEspacio(id, cuerpo));
    }

    @Operation(summary = "Calendario de patrocinios (por omisión, los próximos 60 días)")
    @GetMapping("/patrocinios/calendario")
    public ApiResponse<List<PatrocinioDto>> calendario(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta,
            @RequestParam(required = false) UUID espacioId, @RequestParam(required = false) UUID negocioId,
            @RequestParam(defaultValue = "true") boolean soloVigentes) {
        return ApiResponses.ok(servicio.calendario(desde, hasta, espacioId, negocioId, soloVigentes));
    }

    @Operation(summary = "Programar un patrocinio (exige plan Destacado, negocio publicado y cupo)")
    @PostMapping("/patrocinios")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<PatrocinioDto> crear(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody PatrocinioEntradaDto cuerpo) {
        return ApiResponses.ok(servicio.crear(Actor.de(jwt), cuerpo));
    }

    @Operation(summary = "Cancelar un patrocinio programado o activo")
    @PostMapping("/patrocinios/{id}/cancelar")
    public ApiResponse<PatrocinioDto> cancelar(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ApiResponses.ok(servicio.cancelar(Actor.de(jwt), id));
    }
}
