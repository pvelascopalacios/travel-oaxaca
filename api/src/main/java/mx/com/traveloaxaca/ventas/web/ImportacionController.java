package mx.com.traveloaxaca.ventas.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.UUID;
import mx.com.traveloaxaca.comun.api.ApiResponse;
import mx.com.traveloaxaca.comun.api.ApiResponses;
import mx.com.traveloaxaca.comun.api.Pagina;
import mx.com.traveloaxaca.negocios.servicio.Actor;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.AplicarImportacionDto;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.ImportacionDto;
import mx.com.traveloaxaca.ventas.servicio.ImportacionServicio;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Importaciones por CSV. Prospectos: ventas y admin. Negocios, lugares y eventos: editor y admin. */
@RestController
@RequestMapping("/api/v1/admin/importaciones")
@Tag(name = "Importaciones (CSV)")
public class ImportacionController {

    private static final MediaType CSV = new MediaType("text", "csv", java.nio.charset.StandardCharsets.UTF_8);

    private final ImportacionServicio servicio;

    public ImportacionController(ImportacionServicio servicio) {
        this.servicio = servicio;
    }

    @Operation(summary = "Historial de importaciones de los tipos que puedes manejar")
    @GetMapping
    public ApiResponse<Pagina<ImportacionDto>> listar(@AuthenticationPrincipal Jwt jwt,
                                                      @RequestParam(defaultValue = "0") int pagina,
                                                      @RequestParam(defaultValue = "20") int tamano) {
        return ApiResponses.ok(servicio.listar(Actor.de(jwt), pagina, tamano));
    }

    @Operation(summary = "Plantilla CSV con los encabezados y una fila de ejemplo")
    @GetMapping("/plantilla/{tipo}")
    public ResponseEntity<byte[]> plantilla(@AuthenticationPrincipal Jwt jwt, @PathVariable String tipo) {
        return csv(servicio.plantillaCsv(Actor.de(jwt), tipo), "plantilla-" + tipo + ".csv");
    }

    @Operation(summary = "Subir un CSV: se valida completo y no se guarda nada todavía")
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ImportacionDto> subir(@AuthenticationPrincipal Jwt jwt, @RequestParam String tipo,
                                             @RequestParam("archivo") MultipartFile archivo) {
        return ApiResponses.ok(servicio.subir(Actor.de(jwt), tipo, archivo));
    }

    @Operation(summary = "Detalle de una importación con sus errores por fila")
    @GetMapping("/{id}")
    public ApiResponse<ImportacionDto> detalle(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ApiResponses.ok(servicio.detalle(Actor.de(jwt), id));
    }

    @Operation(summary = "Errores de la importación en CSV (abre bien en Excel)")
    @GetMapping("/{id}/errores.csv")
    public ResponseEntity<byte[]> errores(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return csv(servicio.erroresCsv(Actor.de(jwt), id), "errores-importacion.csv");
    }

    @Operation(summary = "Aplicar la importación. Si hay filas con error, pide confirmar soloCorrectas")
    @PostMapping("/{id}/aplicar")
    public ApiResponse<ImportacionDto> aplicar(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id,
                                               @RequestBody(required = false) AplicarImportacionDto cuerpo) {
        boolean soloCorrectas = cuerpo != null && Boolean.TRUE.equals(cuerpo.soloCorrectas());
        return ApiResponses.ok(servicio.aplicar(Actor.de(jwt), id, soloCorrectas));
    }

    @Operation(summary = "Cancelar una importación que no se ha aplicado")
    @PostMapping("/{id}/cancelar")
    public ApiResponse<ImportacionDto> cancelar(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
        return ApiResponses.ok(servicio.cancelar(Actor.de(jwt), id));
    }

    private static ResponseEntity<byte[]> csv(byte[] cuerpo, String nombre) {
        return ResponseEntity.ok()
                .contentType(CSV)
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(nombre).build().toString())
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(cuerpo);
    }
}
