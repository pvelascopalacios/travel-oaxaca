package mx.com.traveloaxaca.contenido.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.UUID;
import mx.com.traveloaxaca.comun.api.ApiResponse;
import mx.com.traveloaxaca.comun.api.ApiResponses;
import mx.com.traveloaxaca.contenido.dto.ContenidoDtos.*;
import mx.com.traveloaxaca.contenido.repo.ContenidoRepositorio.Tipo;
import mx.com.traveloaxaca.contenido.servicio.ContenidoServicio;
import mx.com.traveloaxaca.negocios.servicio.Actor;
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

/** Alta y edición de lugares, rutas y eventos. Administrador y editor. */
@RestController
@RequestMapping("/api/v1/admin")
@Tag(name = "Contenido editorial")
public class ContenidoController {

    private final ContenidoServicio servicio;

    public ContenidoController(ContenidoServicio servicio) {
        this.servicio = servicio;
    }

    // ---------------- lugares ----------------

    @Operation(summary = "Listar lugares (todos los estados)")
    @GetMapping("/lugares")
    public ApiResponse<?> lugares(@RequestParam(required = false) String estado, @RequestParam(required = false) String q,
                                  @RequestParam(required = false) Integer pagina, @RequestParam(required = false) Integer tamano) {
        return ApiResponses.ok(servicio.listar(Tipo.LUGAR, estado, q, pagina, tamano));
    }

    @Operation(summary = "Ver un lugar para editarlo")
    @GetMapping("/lugares/{id}")
    public ApiResponse<LugarAdminDto> lugar(@PathVariable UUID id) {
        return ApiResponses.ok(servicio.lugar(id));
    }

    @Operation(summary = "Crear un lugar. El texto en español es obligatorio")
    @PostMapping("/lugares")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<LugarAdminDto> crearLugar(@Valid @RequestBody LugarEntradaDto cuerpo) {
        return ApiResponses.ok(servicio.crearLugar(cuerpo));
    }

    @Operation(summary = "Guardar los cambios de un lugar (reemplaza textos y estado)")
    @PutMapping("/lugares/{id}")
    public ApiResponse<LugarAdminDto> actualizarLugar(@PathVariable UUID id, @Valid @RequestBody LugarEntradaDto cuerpo) {
        return ApiResponses.ok(servicio.actualizarLugar(id, cuerpo));
    }

    @Operation(summary = "Definir las fotos del lugar (ya subidas y confirmadas), en orden")
    @PutMapping("/lugares/{id}/fotos")
    public ApiResponse<LugarAdminDto> fotosLugar(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                                 @Valid @RequestBody MediosEntradaDto cuerpo) {
        return ApiResponses.ok(servicio.ponerFotosLugar(Actor.de(jwt), id, cuerpo.medioIds()));
    }

    @Operation(summary = "Archivar un lugar")
    @DeleteMapping("/lugares/{id}")
    public ApiResponse<Void> archivarLugar(@PathVariable UUID id) {
        servicio.archivar(Tipo.LUGAR, id);
        return ApiResponses.ok(null);
    }

    // ---------------- rutas ----------------

    @Operation(summary = "Listar rutas (todos los estados)")
    @GetMapping("/rutas")
    public ApiResponse<?> rutas(@RequestParam(required = false) String estado, @RequestParam(required = false) String q,
                                @RequestParam(required = false) Integer pagina, @RequestParam(required = false) Integer tamano) {
        return ApiResponses.ok(servicio.listar(Tipo.RUTA, estado, q, pagina, tamano));
    }

    @Operation(summary = "Ver una ruta para editarla")
    @GetMapping("/rutas/{id}")
    public ApiResponse<RutaAdminDto> ruta(@PathVariable UUID id) {
        return ApiResponses.ok(servicio.ruta(id));
    }

    @Operation(summary = "Crear una ruta. Las paradas van en orden")
    @PostMapping("/rutas")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<RutaAdminDto> crearRuta(@Valid @RequestBody RutaEntradaDto cuerpo) {
        return ApiResponses.ok(servicio.crearRuta(cuerpo));
    }

    @Operation(summary = "Guardar los cambios de una ruta (reemplaza textos y paradas)")
    @PutMapping("/rutas/{id}")
    public ApiResponse<RutaAdminDto> actualizarRuta(@PathVariable UUID id, @Valid @RequestBody RutaEntradaDto cuerpo) {
        return ApiResponses.ok(servicio.actualizarRuta(id, cuerpo));
    }

    @Operation(summary = "Archivar una ruta")
    @DeleteMapping("/rutas/{id}")
    public ApiResponse<Void> archivarRuta(@PathVariable UUID id) {
        servicio.archivar(Tipo.RUTA, id);
        return ApiResponses.ok(null);
    }

    // ---------------- eventos ----------------

    @Operation(summary = "Listar eventos (todos los estados)")
    @GetMapping("/eventos")
    public ApiResponse<?> eventos(@RequestParam(required = false) String estado, @RequestParam(required = false) String q,
                                  @RequestParam(required = false) Integer pagina, @RequestParam(required = false) Integer tamano) {
        return ApiResponses.ok(servicio.listar(Tipo.EVENTO, estado, q, pagina, tamano));
    }

    @Operation(summary = "Ver un evento para editarlo")
    @GetMapping("/eventos/{id}")
    public ApiResponse<EventoAdminDto> evento(@PathVariable UUID id) {
        return ApiResponses.ok(servicio.evento(id));
    }

    @Operation(summary = "Crear un evento")
    @PostMapping("/eventos")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<EventoAdminDto> crearEvento(@Valid @RequestBody EventoEntradaDto cuerpo) {
        return ApiResponses.ok(servicio.crearEvento(cuerpo));
    }

    @Operation(summary = "Guardar los cambios de un evento")
    @PutMapping("/eventos/{id}")
    public ApiResponse<EventoAdminDto> actualizarEvento(@PathVariable UUID id, @Valid @RequestBody EventoEntradaDto cuerpo) {
        return ApiResponses.ok(servicio.actualizarEvento(id, cuerpo));
    }

    @Operation(summary = "Archivar un evento")
    @DeleteMapping("/eventos/{id}")
    public ApiResponse<Void> archivarEvento(@PathVariable UUID id) {
        servicio.archivar(Tipo.EVENTO, id);
        return ApiResponses.ok(null);
    }
}
