package mx.com.traveloaxaca.explorar.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import mx.com.traveloaxaca.comun.api.ApiResponse;
import mx.com.traveloaxaca.comun.api.ApiResponses;
import mx.com.traveloaxaca.explorar.dto.ExplorarDtos.FavoritoEntradaDto;
import mx.com.traveloaxaca.explorar.servicio.FavoritoServicio;
import mx.com.traveloaxaca.negocios.servicio.Actor;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Favoritos del usuario con cuenta. */
@RestController
@RequestMapping("/api/v1/mi/favoritos")
@Tag(name = "Favoritos")
public class FavoritoController {

    private final FavoritoServicio servicio;

    public FavoritoController(FavoritoServicio servicio) {
        this.servicio = servicio;
    }

    @Operation(summary = "Mis favoritos (negocios, lugares y rutas que siguen publicados)")
    @GetMapping
    public ApiResponse<?> listar(@AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) String idioma,
                                 @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acepta) {
        return ApiResponses.ok(servicio.listar(Actor.de(jwt).usuarioId(), idioma != null ? idioma : acepta));
    }

    @Operation(summary = "Guardar un favorito (si ya estaba, no pasa nada)")
    @PutMapping
    public ApiResponse<Void> agregar(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody FavoritoEntradaDto cuerpo,
                                    @RequestHeader(value = "X-Dispositivo-Id", required = false) String dispositivo) {
        servicio.agregar(Actor.de(jwt).usuarioId(), cuerpo.tipo(), cuerpo.id(), uuidONulo(dispositivo));
        return ApiResponses.ok(null);
    }

    @Operation(summary = "Quitar un favorito")
    @DeleteMapping("/{tipo}/{id}")
    public ApiResponse<Void> quitar(@AuthenticationPrincipal Jwt jwt, @PathVariable String tipo, @PathVariable UUID id) {
        servicio.quitar(Actor.de(jwt).usuarioId(), tipo, id);
        return ApiResponses.ok(null);
    }

    private static UUID uuidONulo(String valor) {
        try {
            return valor == null || valor.isBlank() ? null : UUID.fromString(valor.trim());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
