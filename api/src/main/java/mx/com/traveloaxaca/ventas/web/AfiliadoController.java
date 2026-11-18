package mx.com.traveloaxaca.ventas.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import mx.com.traveloaxaca.comun.api.ApiResponse;
import mx.com.traveloaxaca.comun.api.ApiResponses;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.AfiliadoDto;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.AfiliadoEntradaDto;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.ClicDiaDto;
import mx.com.traveloaxaca.ventas.servicio.AfiliadoServicio;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Enlaces de afiliado: administración (ver: admin, editor y ventas; cambiar: admin) y redirección pública. */
@RestController
@RequestMapping("/api/v1")
@Tag(name = "Enlaces de afiliado")
public class AfiliadoController {

    private final AfiliadoServicio servicio;

    public AfiliadoController(AfiliadoServicio servicio) {
        this.servicio = servicio;
    }

    @Operation(summary = "Enlaces con sus clics de los últimos 30 días")
    @GetMapping("/admin/afiliados")
    public ApiResponse<List<AfiliadoDto>> listar() {
        return ApiResponses.ok(servicio.listar());
    }

    @Operation(summary = "Clics por día de un enlace (por omisión, los últimos 30 días)")
    @GetMapping("/admin/afiliados/{id}/clics")
    public ApiResponse<List<ClicDiaDto>> clics(@PathVariable UUID id,
                                               @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate desde,
                                               @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate hasta) {
        return ApiResponses.ok(servicio.clics(id, desde, hasta));
    }

    @Operation(summary = "Crear un enlace de afiliado")
    @PostMapping("/admin/afiliados")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<AfiliadoDto> crear(@Valid @RequestBody AfiliadoEntradaDto cuerpo) {
        return ApiResponses.ok(servicio.crear(cuerpo));
    }

    @Operation(summary = "Editar o pausar un enlace")
    @PutMapping("/admin/afiliados/{id}")
    public ApiResponse<AfiliadoDto> actualizar(@PathVariable UUID id, @Valid @RequestBody AfiliadoEntradaDto cuerpo) {
        return ApiResponses.ok(servicio.actualizar(id, cuerpo));
    }

    @Operation(summary = "Cuenta el clic y redirige (302) al sitio del socio. Pausado o inexistente: 404")
    @GetMapping("/publico/r/{codigo}")
    public ResponseEntity<Void> redirigir(@PathVariable String codigo,
                                          @RequestParam(name = "d", required = false) String dispositivo,
                                          @RequestParam(name = "o", required = false) String origen) {
        String destino = servicio.redirigir(codigo, uuidONulo(dispositivo), origen);
        return ResponseEntity.status(HttpStatus.FOUND)
                .header(HttpHeaders.LOCATION, destino)
                .cacheControl(CacheControl.noStore())
                .build();
    }

    private static UUID uuidONulo(String s) {
        try {
            return s == null ? null : UUID.fromString(s);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
