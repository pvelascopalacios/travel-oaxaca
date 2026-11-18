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
import mx.com.traveloaxaca.negocios.servicio.CatalogoServicio;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Alta y cambio de catálogos. Categorías, servicios y municipios: solo admin. Localidades: admin y editor. */
@RestController
@RequestMapping("/api/v1/admin")
@Tag(name = "Catálogos (administración)")
public class CatalogoAdminController {

    private final CatalogoServicio servicio;

    public CatalogoAdminController(CatalogoServicio servicio) {
        this.servicio = servicio;
    }

    @Operation(summary = "Crear categoría")
    @PostMapping("/categorias")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Map<String, UUID>> crearCategoria(@Valid @RequestBody CategoriaAdminDto dto) {
        return ApiResponses.ok(servicio.crearCategoria(dto), List.of("Categoría creada."));
    }

    @Operation(summary = "Actualizar categoría")
    @PutMapping("/categorias/{id}")
    public ApiResponse<Void> actualizarCategoria(@PathVariable UUID id, @Valid @RequestBody CategoriaAdminDto dto) {
        servicio.actualizarCategoria(id, dto);
        return ApiResponses.ok(null, List.of("Categoría actualizada."));
    }

    @Operation(summary = "Crear servicio")
    @PostMapping("/servicios")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Map<String, UUID>> crearServicio(@Valid @RequestBody ServicioAdminDto dto) {
        return ApiResponses.ok(servicio.crearServicio(dto), List.of("Servicio creado."));
    }

    @Operation(summary = "Actualizar servicio")
    @PutMapping("/servicios/{id}")
    public ApiResponse<Void> actualizarServicio(@PathVariable UUID id, @Valid @RequestBody ServicioAdminDto dto) {
        servicio.actualizarServicio(id, dto);
        return ApiResponses.ok(null, List.of("Servicio actualizado."));
    }

    @Operation(summary = "Crear municipio")
    @PostMapping("/municipios")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Map<String, UUID>> crearMunicipio(@Valid @RequestBody MunicipioAdminDto dto) {
        return ApiResponses.ok(servicio.crearMunicipio(dto), List.of("Municipio creado."));
    }

    @Operation(summary = "Actualizar municipio")
    @PutMapping("/municipios/{id}")
    public ApiResponse<Void> actualizarMunicipio(@PathVariable UUID id, @Valid @RequestBody MunicipioAdminDto dto) {
        servicio.actualizarMunicipio(id, dto);
        return ApiResponses.ok(null, List.of("Municipio actualizado."));
    }

    @Operation(summary = "Crear localidad")
    @PostMapping("/localidades")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Map<String, UUID>> crearLocalidad(@Valid @RequestBody LocalidadAdminDto dto) {
        return ApiResponses.ok(servicio.crearLocalidad(dto), List.of("Localidad creada."));
    }

    @Operation(summary = "Actualizar localidad")
    @PutMapping("/localidades/{id}")
    public ApiResponse<Void> actualizarLocalidad(@PathVariable UUID id, @Valid @RequestBody LocalidadAdminDto dto) {
        servicio.actualizarLocalidad(id, dto);
        return ApiResponses.ok(null, List.of("Localidad actualizada."));
    }
}
