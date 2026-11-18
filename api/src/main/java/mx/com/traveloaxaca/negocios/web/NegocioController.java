package mx.com.traveloaxaca.negocios.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import mx.com.traveloaxaca.comun.api.ApiResponse;
import mx.com.traveloaxaca.comun.api.ApiResponses;
import mx.com.traveloaxaca.comun.api.Pagina;
import mx.com.traveloaxaca.negocios.dto.NegocioDtos.*;
import mx.com.traveloaxaca.negocios.servicio.Actor;
import mx.com.traveloaxaca.negocios.servicio.EquipoServicio;
import mx.com.traveloaxaca.negocios.servicio.FichaServicio;
import mx.com.traveloaxaca.negocios.servicio.MedioServicio;
import mx.com.traveloaxaca.negocios.servicio.NegocioServicio;
import mx.com.traveloaxaca.negocios.servicio.PublicacionServicio;
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

/** Mis negocios, fotos, equipo, ciclo de vida y la vista del equipo interno. */
@RestController
@RequestMapping("/api/v1")
@Tag(name = "Negocios")
public class NegocioController {

    private final NegocioServicio negocios;
    private final FichaServicio fichas;
    private final PublicacionServicio publicacion;
    private final MedioServicio medios;
    private final EquipoServicio equipo;

    public NegocioController(NegocioServicio negocios, FichaServicio fichas, PublicacionServicio publicacion,
                             MedioServicio medios, EquipoServicio equipo) {
        this.negocios = negocios;
        this.fichas = fichas;
        this.publicacion = publicacion;
        this.medios = medios;
        this.equipo = equipo;
    }

    // ---------- fotos (subida en dos pasos) ----------

    @Operation(summary = "Pedir una URL firmada para subir una foto")
    @PostMapping("/mi/medios/subida")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<SubidaRespuesta> subida(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody SubidaDto dto) {
        return ApiResponses.ok(medios.solicitarSubida(Actor.de(jwt).usuarioId(), dto));
    }

    @Operation(summary = "Confirmar que la foto ya se subió; la API la revisa")
    @PostMapping("/mi/medios/{id}/confirmar")
    public ApiResponse<MedioDto> confirmar(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ApiResponses.ok(medios.confirmar(Actor.de(jwt).usuarioId(), id));
    }

    // ---------- mis negocios ----------

    @Operation(summary = "Mis negocios")
    @GetMapping("/mi/negocios")
    public ApiResponse<List<NegocioResumenDto>> mios(@AuthenticationPrincipal Jwt jwt) {
        return ApiResponses.ok(negocios.mios(Actor.de(jwt).usuarioId()));
    }

    @Operation(summary = "Crear un negocio (queda en borrador)")
    @PostMapping("/mi/negocios")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<FichaDto> crear(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody NuevoNegocioDto dto) {
        return ApiResponses.ok(negocios.crear(Actor.de(jwt).usuarioId(), dto), List.of("Negocio creado. Completa tu ficha para enviarla a revisión."));
    }

    // ---------- ficha ----------

    @Operation(summary = "Ver la ficha completa")
    @GetMapping("/negocios/{id}")
    public ApiResponse<FichaDto> ver(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ApiResponses.ok(fichas.ver(Actor.de(jwt), id));
    }

    @Operation(summary = "Cambiar los datos básicos")
    @PutMapping("/negocios/{id}")
    public ApiResponse<ResultadoCambio> actualizar(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                                   @Valid @RequestBody ActualizarNegocioDto dto) {
        return ApiResponses.ok(negocios.actualizar(Actor.de(jwt), id, dto));
    }

    @Operation(summary = "Qué le falta a la ficha para enviarse a revisión")
    @GetMapping("/negocios/{id}/faltantes")
    public ApiResponse<FaltantesDto> faltantes(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ApiResponses.ok(fichas.faltantes(Actor.de(jwt), id));
    }

    // ---------- ciclo de vida ----------

    @Operation(summary = "Enviar la ficha a revisión")
    @PostMapping("/negocios/{id}/enviar-revision")
    public ApiResponse<FichaDto> enviar(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ApiResponses.ok(publicacion.enviarARevision(Actor.de(jwt), id), List.of("Tu ficha se envió a revisión."));
    }

    @Operation(summary = "Pausar una ficha publicada (solo propietario)")
    @PostMapping("/negocios/{id}/pausar")
    public ApiResponse<FichaDto> pausar(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ApiResponses.ok(publicacion.pausar(Actor.de(jwt), id), List.of("Tu ficha quedó pausada."));
    }

    @Operation(summary = "Reanudar una ficha pausada (solo propietario)")
    @PostMapping("/negocios/{id}/reanudar")
    public ApiResponse<FichaDto> reanudar(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ApiResponses.ok(publicacion.reanudar(Actor.de(jwt), id), List.of("Tu ficha volvió a publicarse."));
    }

    @Operation(summary = "Archivar el negocio (solo propietario)")
    @PostMapping("/negocios/{id}/archivar")
    public ApiResponse<Void> archivar(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        publicacion.archivar(Actor.de(jwt), id);
        return ApiResponses.ok(null, List.of("Negocio archivado."));
    }

    // ---------- equipo ----------

    @Operation(summary = "Equipo del negocio")
    @GetMapping("/negocios/{id}/miembros")
    public ApiResponse<List<MiembroDto>> miembros(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ApiResponses.ok(equipo.miembros(Actor.de(jwt), id));
    }

    @Operation(summary = "Invitar a una persona con cuenta verificada (solo propietario)")
    @PostMapping("/negocios/{id}/invitaciones")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<List<MiembroDto>> invitar(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                                 @Valid @RequestBody InvitarDto dto) {
        return ApiResponses.ok(equipo.invitar(Actor.de(jwt), id, dto), List.of("Invitación enviada."));
    }

    @Operation(summary = "Quitar a un colaborador o cancelar su invitación (solo propietario)")
    @DeleteMapping("/negocios/{id}/miembros/{usuarioId}")
    public ApiResponse<List<MiembroDto>> revocar(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                                 @PathVariable UUID usuarioId) {
        return ApiResponses.ok(equipo.revocar(Actor.de(jwt), id, usuarioId), List.of("Listo."));
    }

    @Operation(summary = "Invitaciones que recibí")
    @GetMapping("/mi/invitaciones")
    public ApiResponse<List<InvitacionDto>> misInvitaciones(@AuthenticationPrincipal Jwt jwt) {
        return ApiResponses.ok(equipo.misInvitaciones(Actor.de(jwt).usuarioId()));
    }

    @Operation(summary = "Aceptar o rechazar una invitación")
    @PostMapping("/mi/invitaciones/{id}/responder")
    public ApiResponse<Void> responder(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                       @Valid @RequestBody ResponderInvitacionDto dto) {
        equipo.responder(Actor.de(jwt).usuarioId(), id, dto);
        return ApiResponses.ok(null, List.of(Boolean.TRUE.equals(dto.acepta()) ? "Ya eres parte del equipo." : "Invitación rechazada."));
    }

    // ---------- equipo interno ----------

    @Operation(summary = "Lista de negocios para el equipo interno")
    @GetMapping("/admin/negocios")
    public ApiResponse<Pagina<NegocioAdminDto>> buscar(@RequestParam(required = false) String q,
                                                       @RequestParam(required = false) String estado,
                                                       @RequestParam(required = false) UUID categoriaId,
                                                       @RequestParam(required = false) UUID municipioId,
                                                       @RequestParam(required = false) Integer pagina,
                                                       @RequestParam(required = false) Integer tamano) {
        return ApiResponses.ok(negocios.buscar(q, estado, categoriaId, municipioId, pagina, tamano));
    }

    @Operation(summary = "Ficha de cualquier negocio para el equipo interno")
    @GetMapping("/admin/negocios/{id}")
    public ApiResponse<FichaDto> verAdmin(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ApiResponses.ok(fichas.ver(Actor.de(jwt), id));
    }
}
