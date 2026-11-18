package mx.com.traveloaxaca.negocios.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import mx.com.traveloaxaca.comun.api.ApiResponse;
import mx.com.traveloaxaca.comun.api.ApiResponses;
import mx.com.traveloaxaca.negocios.dto.NegocioDtos.*;
import mx.com.traveloaxaca.negocios.servicio.Actor;
import mx.com.traveloaxaca.negocios.servicio.ContactoServicio;
import mx.com.traveloaxaca.negocios.servicio.FichaServicio;
import mx.com.traveloaxaca.negocios.servicio.FotosNegocioServicio;
import mx.com.traveloaxaca.negocios.servicio.OfertaServicio;
import mx.com.traveloaxaca.negocios.servicio.SucursalServicio;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Partes de la ficha: textos, sucursales, contactos, servicios, idiomas, fotos y ofertas. */
@RestController
@RequestMapping("/api/v1/negocios/{id}")
@Tag(name = "Ficha del negocio")
public class FichaController {

    private final FichaServicio fichas;
    private final SucursalServicio sucursales;
    private final ContactoServicio contactos;
    private final FotosNegocioServicio fotos;
    private final OfertaServicio ofertas;

    public FichaController(FichaServicio fichas, SucursalServicio sucursales, ContactoServicio contactos,
                           FotosNegocioServicio fotos, OfertaServicio ofertas) {
        this.fichas = fichas;
        this.sucursales = sucursales;
        this.contactos = contactos;
        this.fotos = fotos;
        this.ofertas = ofertas;
    }

    @Operation(summary = "Guardar descripciones por idioma")
    @PutMapping("/traducciones")
    public ApiResponse<ResultadoCambio> traducciones(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                                     @RequestBody Map<String, TraduccionDto> cuerpo) {
        return ApiResponses.ok(fichas.guardarTraducciones(Actor.de(jwt), id, cuerpo));
    }

    @Operation(summary = "Guardar los servicios que ofrece")
    @PutMapping("/servicios")
    public ApiResponse<ResultadoCambio> servicios(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                                  @Valid @RequestBody ServiciosEntradaDto dto) {
        return ApiResponses.ok(fichas.guardarServicios(Actor.de(jwt), id, dto));
    }

    @Operation(summary = "Guardar los idiomas que atiende")
    @PutMapping("/idiomas")
    public ApiResponse<ResultadoCambio> idiomas(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                                @Valid @RequestBody IdiomasEntradaDto dto) {
        return ApiResponses.ok(fichas.guardarIdiomas(Actor.de(jwt), id, dto));
    }

    // ---------- sucursales ----------

    @Operation(summary = "Agregar sucursal")
    @PostMapping("/sucursales")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ResultadoCambio> crearSucursal(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                                      @Valid @RequestBody SucursalEntradaDto dto) {
        return ApiResponses.ok(sucursales.crear(Actor.de(jwt), id, dto));
    }

    @Operation(summary = "Cambiar sucursal (la ubicación de la principal de una ficha publicada espera revisión)")
    @PutMapping("/sucursales/{sucursalId}")
    public ApiResponse<ResultadoCambio> actualizarSucursal(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                                           @PathVariable UUID sucursalId,
                                                           @Valid @RequestBody SucursalEntradaDto dto) {
        return ApiResponses.ok(sucursales.actualizar(Actor.de(jwt), id, sucursalId, dto));
    }

    @Operation(summary = "Eliminar sucursal (no la principal)")
    @DeleteMapping("/sucursales/{sucursalId}")
    public ApiResponse<ResultadoCambio> eliminarSucursal(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                                         @PathVariable UUID sucursalId) {
        return ApiResponses.ok(sucursales.eliminar(Actor.de(jwt), id, sucursalId));
    }

    @Operation(summary = "Reemplazar los horarios de una sucursal")
    @PutMapping("/sucursales/{sucursalId}/horarios")
    public ApiResponse<ResultadoCambio> horarios(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                                 @PathVariable UUID sucursalId, @Valid @RequestBody HorariosDto dto) {
        return ApiResponses.ok(sucursales.guardarHorarios(Actor.de(jwt), id, sucursalId, dto));
    }

    @Operation(summary = "Reemplazar las fechas especiales de una sucursal")
    @PutMapping("/sucursales/{sucursalId}/excepciones")
    public ApiResponse<ResultadoCambio> excepciones(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                                    @PathVariable UUID sucursalId, @Valid @RequestBody ExcepcionesDto dto) {
        return ApiResponses.ok(sucursales.guardarExcepciones(Actor.de(jwt), id, sucursalId, dto));
    }

    // ---------- contactos ----------

    @Operation(summary = "Agregar contacto")
    @PostMapping("/contactos")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ResultadoCambio> crearContacto(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                                      @Valid @RequestBody ContactoEntradaDto dto) {
        return ApiResponses.ok(contactos.crear(Actor.de(jwt), id, dto));
    }

    @Operation(summary = "Cambiar contacto")
    @PutMapping("/contactos/{contactoId}")
    public ApiResponse<ResultadoCambio> actualizarContacto(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                                           @PathVariable UUID contactoId,
                                                           @Valid @RequestBody ContactoEntradaDto dto) {
        return ApiResponses.ok(contactos.actualizar(Actor.de(jwt), id, contactoId, dto));
    }

    @Operation(summary = "Eliminar contacto")
    @DeleteMapping("/contactos/{contactoId}")
    public ApiResponse<ResultadoCambio> eliminarContacto(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                                         @PathVariable UUID contactoId) {
        return ApiResponses.ok(contactos.eliminar(Actor.de(jwt), id, contactoId));
    }

    // ---------- fotos ----------

    @Operation(summary = "Agregar a la ficha una foto ya confirmada")
    @PostMapping("/medios")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ResultadoCambio> agregarFoto(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                                    @Valid @RequestBody AgregarMedioDto dto) {
        return ApiResponses.ok(fotos.agregar(Actor.de(jwt), id, dto));
    }

    @Operation(summary = "Quitar una foto de la ficha")
    @DeleteMapping("/medios/{medioId}")
    public ApiResponse<ResultadoCambio> quitarFoto(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                                   @PathVariable UUID medioId) {
        return ApiResponses.ok(fotos.quitar(Actor.de(jwt), id, medioId));
    }

    @Operation(summary = "Ordenar las fotos y elegir la portada")
    @PutMapping("/medios/orden")
    public ApiResponse<ResultadoCambio> ordenarFotos(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                                     @Valid @RequestBody OrdenMediosDto dto) {
        return ApiResponses.ok(fotos.ordenar(Actor.de(jwt), id, dto));
    }

    // ---------- ofertas ----------

    @Operation(summary = "Habitaciones, tours, platillos o productos")
    @GetMapping("/ofertas")
    public ApiResponse<List<OfertaDto>> ofertas(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ApiResponses.ok(ofertas.listar(Actor.de(jwt), id));
    }

    @Operation(summary = "Agregar oferta")
    @PostMapping("/ofertas")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<OfertaDto> crearOferta(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                              @Valid @RequestBody OfertaEntradaDto dto) {
        return ApiResponses.ok(ofertas.crear(Actor.de(jwt), id, dto));
    }

    @Operation(summary = "Cambiar oferta")
    @PutMapping("/ofertas/{ofertaId}")
    public ApiResponse<OfertaDto> actualizarOferta(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                                   @PathVariable UUID ofertaId, @Valid @RequestBody OfertaEntradaDto dto) {
        return ApiResponses.ok(ofertas.actualizar(Actor.de(jwt), id, ofertaId, dto));
    }

    @Operation(summary = "Cambiar el estado de una oferta")
    @PutMapping("/ofertas/{ofertaId}/estado")
    public ApiResponse<OfertaDto> estadoOferta(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                               @PathVariable UUID ofertaId, @Valid @RequestBody EstadoOfertaDto dto) {
        return ApiResponses.ok(ofertas.cambiarEstado(Actor.de(jwt), id, ofertaId, dto));
    }

    @Operation(summary = "Eliminar oferta")
    @DeleteMapping("/ofertas/{ofertaId}")
    public ApiResponse<Void> eliminarOferta(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                            @PathVariable UUID ofertaId) {
        ofertas.eliminar(Actor.de(jwt), id, ofertaId);
        return ApiResponses.ok(null, List.of("Opción eliminada."));
    }
}
