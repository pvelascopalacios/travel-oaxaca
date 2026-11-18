package mx.com.traveloaxaca.comunidad.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import mx.com.traveloaxaca.comun.api.ApiResponse;
import mx.com.traveloaxaca.comun.api.ApiResponses;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.ListaDetalleDto;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.ListaDto;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.ListaEntradaDto;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.ListaItemEdicionDto;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.ListaItemEntradaDto;
import mx.com.traveloaxaca.comunidad.servicio.ListaServicio;
import mx.com.traveloaxaca.negocios.servicio.Actor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Listas de lugares e itinerarios por día. */
@RestController
@Tag(name = "Listas e itinerarios")
public class ListaController {

    private final ListaServicio servicio;

    public ListaController(ListaServicio servicio) {
        this.servicio = servicio;
    }

    @Operation(summary = "Una lista pública (por su identificador)")
    @GetMapping("/api/v1/publico/listas/{id}")
    public ApiResponse<ListaDetalleDto> publica(@PathVariable UUID id, @RequestParam(required = false) String idioma,
                                                @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acepta) {
        return ApiResponses.ok(servicio.publica(id, idioma != null ? idioma : acepta));
    }

    @Operation(summary = "Mis listas e itinerarios")
    @GetMapping("/api/v1/mi/listas")
    public ApiResponse<List<ListaDto>> mias(@AuthenticationPrincipal Jwt jwt) {
        return ApiResponses.ok(servicio.mias(Actor.de(jwt).usuarioId()));
    }

    @Operation(summary = "Crear una lista o un itinerario")
    @PostMapping("/api/v1/mi/listas")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ListaDto> crear(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody ListaEntradaDto cuerpo) {
        return ApiResponses.ok(servicio.crear(Actor.de(jwt).usuarioId(), cuerpo));
    }

    @Operation(summary = "Una de mis listas con sus elementos")
    @GetMapping("/api/v1/mi/listas/{id}")
    public ApiResponse<ListaDetalleDto> detalle(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                                @RequestParam(required = false) String idioma,
                                                @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acepta) {
        return ApiResponses.ok(servicio.detalle(Actor.de(jwt).usuarioId(), id, idioma != null ? idioma : acepta));
    }

    @Operation(summary = "Cambiar nombre, fechas o si es pública")
    @PutMapping("/api/v1/mi/listas/{id}")
    public ApiResponse<ListaDto> actualizar(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                            @Valid @RequestBody ListaEntradaDto cuerpo) {
        return ApiResponses.ok(servicio.actualizar(Actor.de(jwt).usuarioId(), id, cuerpo));
    }

    @Operation(summary = "Borrar una lista")
    @DeleteMapping("/api/v1/mi/listas/{id}")
    public ApiResponse<Void> borrar(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        servicio.borrar(Actor.de(jwt).usuarioId(), id);
        return ApiResponses.ok(null);
    }

    @Operation(summary = "Agregar un negocio, lugar o ruta a la lista")
    @PostMapping("/api/v1/mi/listas/{id}/elementos")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ListaDetalleDto> agregar(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                                @Valid @RequestBody ListaItemEntradaDto cuerpo,
                                                @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acepta) {
        return ApiResponses.ok(servicio.agregar(Actor.de(jwt).usuarioId(), id, cuerpo, acepta));
    }

    @Operation(summary = "Cambiar día, posición o nota de un elemento")
    @PutMapping("/api/v1/mi/listas/{id}/elementos/{itemId}")
    public ApiResponse<ListaDetalleDto> editarItem(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                                   @PathVariable UUID itemId,
                                                   @Valid @RequestBody ListaItemEdicionDto cuerpo,
                                                   @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acepta) {
        return ApiResponses.ok(servicio.editarItem(Actor.de(jwt).usuarioId(), id, itemId, cuerpo, acepta));
    }

    @Operation(summary = "Quitar un elemento de la lista")
    @DeleteMapping("/api/v1/mi/listas/{id}/elementos/{itemId}")
    public ApiResponse<Void> quitarItem(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                        @PathVariable UUID itemId) {
        servicio.quitarItem(Actor.de(jwt).usuarioId(), id, itemId);
        return ApiResponses.ok(null);
    }
}
