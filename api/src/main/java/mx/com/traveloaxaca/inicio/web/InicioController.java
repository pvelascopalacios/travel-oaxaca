package mx.com.traveloaxaca.inicio.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.time.Duration;
import java.util.UUID;
import mx.com.traveloaxaca.comun.api.ApiResponse;
import mx.com.traveloaxaca.comun.api.ApiResponses;
import mx.com.traveloaxaca.inicio.dto.InicioDtos.*;
import mx.com.traveloaxaca.inicio.servicio.InicioServicio;
import mx.com.traveloaxaca.negocios.servicio.Actor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Contenido editorial de la pantalla de inicio: lo lee cualquiera; lo edita administrador o editor. */
@RestController
@RequestMapping("/api/v1")
@Tag(name = "Inicio editorial")
public class InicioController {

    private final InicioServicio servicio;

    public InicioController(InicioServicio servicio) {
        this.servicio = servicio;
    }

    @Operation(summary = "Destacados, pueblos, historias y Reels publicados y vigentes hoy, con foto",
            description = "Lo que no tiene foto aprobada o no está vigente no sale. Los textos vienen en el idioma pedido, con respaldo en español.")
    @GetMapping("/publico/inicio")
    public ResponseEntity<ApiResponse<InicioPublicoDto>> inicio(@RequestParam(required = false) String destino,
                                                               @RequestParam(required = false) String idioma,
                                                               @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false) String acepta) {
        return ResponseEntity.ok().cacheControl(CacheControl.maxAge(Duration.ofMinutes(2)).cachePublic())
                .header(HttpHeaders.VARY, HttpHeaders.ACCEPT_LANGUAGE)
                .body(ApiResponses.ok(servicio.inicio(destino, idioma != null ? idioma : acepta)));
    }

    @Operation(summary = "Listar los bloques editoriales (todos los estados)")
    @GetMapping("/admin/inicio")
    public ApiResponse<?> listar(@RequestParam(required = false) String tipo, @RequestParam(required = false) String estado,
                                 @RequestParam(required = false) Integer pagina, @RequestParam(required = false) Integer tamano) {
        return ApiResponses.ok(servicio.listar(tipo, estado, pagina, tamano));
    }

    @Operation(summary = "Ver un bloque para editarlo")
    @GetMapping("/admin/inicio/{id}")
    public ApiResponse<BloqueAdminDto> ver(@PathVariable UUID id) {
        return ApiResponses.ok(servicio.ver(id));
    }

    @Operation(summary = "Crear un bloque. Para publicar necesita foto, texto en español y lo propio de su tipo")
    @PostMapping("/admin/inicio")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<BloqueAdminDto> crear(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody BloqueEntradaDto cuerpo) {
        return ApiResponses.ok(servicio.crear(Actor.de(jwt), cuerpo));
    }

    @Operation(summary = "Guardar los cambios de un bloque (reemplaza textos y estado; el tipo no cambia)")
    @PutMapping("/admin/inicio/{id}")
    public ApiResponse<BloqueAdminDto> actualizar(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                                  @Valid @RequestBody BloqueEntradaDto cuerpo) {
        return ApiResponses.ok(servicio.actualizar(Actor.de(jwt), id, cuerpo));
    }

    @Operation(summary = "Archivar un bloque")
    @DeleteMapping("/admin/inicio/{id}")
    public ApiResponse<Void> archivar(@PathVariable UUID id) {
        servicio.archivar(id);
        return ApiResponses.ok(null);
    }
}
