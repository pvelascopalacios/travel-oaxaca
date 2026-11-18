package mx.com.traveloaxaca.ventas.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Datos que entran y salen en ventas y operación: embudo, importaciones, auditoría, configuración y afiliados. */
public final class VentasDtos {

    private VentasDtos() {
    }

    // ---------------- embudo ----------------

    public record ProspectoEntradaDto(
            @NotBlank(message = "Escribe el nombre del negocio.") @Size(max = 160, message = "Máximo 160 caracteres.") String nombreNegocio,
            UUID categoriaId,
            UUID municipioId,
            @Size(max = 120, message = "Máximo 120 caracteres.") String contactoNombre,
            @Size(max = 30, message = "Máximo 30 caracteres.") String telefono,
            @Size(max = 160, message = "Máximo 160 caracteres.") String correo,
            String origen,
            UUID asignadoA,
            LocalDate proximaAccionEn,
            @Size(max = 2000, message = "Máximo 2000 caracteres.") String notas) {
    }

    /** Lo que escribe quien pide que lo contacten desde la web. sitioWeb es un señuelo: las personas lo dejan vacío. */
    public record SolicitudContactoDto(
            @NotBlank(message = "Escribe el nombre del negocio.") @Size(max = 160, message = "Máximo 160 caracteres.") String nombreNegocio,
            @Size(max = 120, message = "Máximo 120 caracteres.") String contactoNombre,
            UUID categoriaId,
            UUID municipioId,
            @Size(max = 30, message = "Máximo 30 caracteres.") String telefono,
            @Size(max = 160, message = "Máximo 160 caracteres.") String correo,
            @Size(max = 500, message = "Máximo 500 caracteres.") String mensaje,
            @Size(max = 200, message = "Máximo 200 caracteres.") String sitioWeb) {
    }

    public record ProspectoResumenDto(UUID id, String nombreNegocio, UUID categoriaId, String categoriaClave,
                                      UUID municipioId, String municipioNombre, String contactoNombre,
                                      String telefono, String correo, String origen, String estado, UUID asignadoA,
                                      String asignadoNombre, UUID negocioId, LocalDate proximaAccionEn,
                                      boolean vencida, OffsetDateTime actualizadoEn) {
    }

    public record InteraccionDto(UUID id, String tipo, String resultado, String notas, OffsetDateTime ocurrioEn,
                                 LocalDate proximaAccionEn, UUID usuarioId, String usuarioNombre) {
    }

    public record ProspectoDetalleDto(ProspectoResumenDto prospecto, String motivoDescarte, String notas,
                                      OffsetDateTime creadoEn, List<InteraccionDto> interacciones) {
    }

    public record CambioEstadoDto(@NotBlank(message = "Elige el estado.") String estado,
                                  @Size(max = 500, message = "Máximo 500 caracteres.") String motivo) {
    }

    public record InteraccionEntradaDto(
            @NotBlank(message = "Elige el tipo de contacto.") String tipo,
            @Size(max = 300, message = "Máximo 300 caracteres.") String resultado,
            @Size(max = 2000, message = "Máximo 2000 caracteres.") String notas,
            OffsetDateTime ocurrioEn,
            LocalDate proximaAccionEn) {
    }

    public record ConvertirDto(UUID categoriaId, UUID municipioId) {
    }

    public record ConversionDto(UUID negocioId, String slug) {
    }

    public record ResumenVentasDto(Map<String, Long> porEstado, long vencidas, long sinAsignar, long convertidosMes) {
    }

    public record PersonaEquipoDto(UUID id, String nombre) {
    }

    // ---------------- importaciones ----------------

    public record ErrorFilaDto(int fila, String campo, String valor, String problema) {
    }

    public record ImportacionDto(UUID id, String tipo, String archivo, String estado, int totalFilas, int filasOk,
                                 int filasError, OffsetDateTime creadoEn, OffsetDateTime finalizadaEn,
                                 List<ErrorFilaDto> errores) {
    }

    public record AplicarImportacionDto(Boolean soloCorrectas) {
    }

    // ---------------- auditoría ----------------

    public record AuditoriaDto(long id, String tabla, String registroId, String accion, UUID usuarioId,
                               String usuarioCorreo, JsonNode antes, JsonNode despues, OffsetDateTime ocurrioEn) {
    }

    // ---------------- configuración, plantillas y cola ----------------

    public record ConfigDto(String clave, String tipo, JsonNode valor, BigDecimal minimo, BigDecimal maximo,
                            String descripcion, OffsetDateTime actualizadoEn) {
    }

    public record ConfigCambioDto(@NotNull(message = "Escribe el valor.") JsonNode valor) {
    }

    public record PlantillaDto(UUID id, String clave, String canal, String idioma, String asunto, String cuerpo,
                               boolean activa, List<String> variables) {
    }

    public record PlantillaEdicionDto(@Size(max = 200, message = "Máximo 200 caracteres.") String asunto,
                                      @NotBlank(message = "Escribe el mensaje.") @Size(max = 5000, message = "Máximo 5000 caracteres.") String cuerpo,
                                      Boolean activa) {
    }

    public record NotificacionDto(UUID id, String plantillaClave, String canal, String destinatario, String estado,
                                  int intentos, String error, OffsetDateTime programadaPara,
                                  OffsetDateTime enviadaEn, OffsetDateTime creadoEn) {
    }

    // ---------------- afiliados ----------------

    public record AfiliadoEntradaDto(
            @NotBlank(message = "Escribe el código.")
            @Pattern(regexp = "^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$", message = "Usa de 3 a 40 letras minúsculas, números o guiones.") String codigo,
            @NotBlank(message = "Escribe la dirección de destino.") @Size(max = 2000, message = "Máximo 2000 caracteres.") String destinoUrl,
            @NotBlank(message = "Escribe el nombre del socio.") @Size(max = 160, message = "Máximo 160 caracteres.") String socio,
            @DecimalMin(value = "0", message = "No puede ser negativa.") @DecimalMax(value = "100", message = "Máximo 100.") BigDecimal comisionPct,
            UUID negocioId,
            String estado) {
    }

    public record AfiliadoDto(UUID id, String codigo, String destinoUrl, String socio, BigDecimal comisionPct,
                              String estado, UUID negocioId, long clics30d, OffsetDateTime creadoEn) {
    }

    public record ClicDiaDto(LocalDate dia, long clics) {
    }
}
