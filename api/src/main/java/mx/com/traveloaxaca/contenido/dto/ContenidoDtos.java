package mx.com.traveloaxaca.contenido.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Alta y edición de lugares, rutas y eventos por el equipo editorial. Los textos van por idioma; el español es
 * obligatorio. Quien captura es responsable de que los datos de Oaxaca sean verídicos: la API no inventa contenido.
 */
public final class ContenidoDtos {

    private ContenidoDtos() {
    }

    // ---------------- lugares ----------------

    public record TextoLugarDto(
            @NotBlank(message = "Escribe el nombre.") @Size(max = 200, message = "El nombre admite hasta 200 caracteres.") String nombre,
            @Size(max = 500, message = "El resumen admite hasta 500 caracteres.") String resumen,
            @Size(max = 8000, message = "La historia admite hasta 8000 caracteres.") String historia,
            @Size(max = 4000, message = "Las recomendaciones admiten hasta 4000 caracteres.") String recomendaciones,
            @Size(max = 300, message = "La mejor época admite hasta 300 caracteres.") String mejorEpoca,
            @Size(max = 2000, message = "Cómo llegar admite hasta 2000 caracteres.") String comoLlegar) {
    }

    public record LugarEntradaDto(
            @NotNull(message = "Elige el tipo de lugar.")
            @Pattern(regexp = "^(arqueologico|natural|cultural|playa|mercado|templo|otro|bosque|mirador|cascada|presa)$", message = "Tipo de lugar no válido.") String tipo,
            UUID municipioId, UUID padreId, Double latitud, Double longitud, boolean destacado,
            @NotNull(message = "Indica el estado.")
            @Pattern(regexp = "^(borrador|publicado|archivado)$", message = "El estado debe ser borrador, publicado o archivado.") String estado,
            Map<String, Object> datos,
            @NotEmpty(message = "Escribe al menos el texto en español.") Map<String, @Valid TextoLugarDto> traducciones) {
    }

    public record LugarAdminDto(UUID id, String slug, String tipo, UUID municipioId, UUID padreId, Double latitud,
                                Double longitud, boolean destacado, String estado, Map<String, Object> datos,
                                Map<String, TextoLugarDto> traducciones, List<UUID> medioIds,
                                OffsetDateTime actualizadoEn) {
    }

    public record MediosEntradaDto(@NotNull(message = "Envía la lista de fotos.") @Size(max = 20, message = "Máximo 20 fotos.") List<UUID> medioIds) {
    }

    // ---------------- rutas ----------------

    public record TextoRutaDto(
            @NotBlank(message = "Escribe el nombre.") @Size(max = 200, message = "El nombre admite hasta 200 caracteres.") String nombre,
            @Size(max = 6000, message = "La descripción admite hasta 6000 caracteres.") String descripcion) {
    }

    /** Exactamente uno: lugarId, negocioId o el par latitud/longitud. */
    public record ParadaEntradaDto(UUID lugarId, UUID negocioId, Double latitud, Double longitud,
                                   @DecimalMin(value = "0", message = "Los minutos no pueden ser negativos.") Integer minutosEstimados) {
    }

    public record RutaEntradaDto(
            @NotNull(message = "Indica la duración.") @DecimalMin(value = "0.1", message = "La duración debe ser mayor a cero.") BigDecimal duracionHoras,
            @DecimalMin(value = "0", message = "La distancia no puede ser negativa.") BigDecimal distanciaKm,
            @NotNull(message = "Elige la dificultad.")
            @Pattern(regexp = "^(facil|moderada|dificil)$", message = "La dificultad debe ser facil, moderada o dificil.") String dificultad,
            @NotNull(message = "Elige el transporte.")
            @Pattern(regexp = "^(a_pie|auto|bicicleta|transporte_publico|mixto)$", message = "Transporte no válido.") String transporte,
            boolean esPremium,
            @NotNull(message = "Indica el estado.")
            @Pattern(regexp = "^(borrador|publicada|archivada)$", message = "El estado debe ser borrador, publicada o archivada.") String estado,
            @NotEmpty(message = "Escribe al menos el texto en español.") Map<String, @Valid TextoRutaDto> traducciones,
            @Size(max = 40, message = "Máximo 40 paradas.") List<@Valid ParadaEntradaDto> paradas) {
    }

    public record RutaAdminDto(UUID id, String slug, BigDecimal duracionHoras, BigDecimal distanciaKm,
                               String dificultad, String transporte, boolean esPremium, String estado,
                               Map<String, TextoRutaDto> traducciones, List<ParadaEntradaDto> paradas,
                               OffsetDateTime actualizadoEn) {
    }

    // ---------------- eventos ----------------

    public record TextoEventoDto(
            @NotBlank(message = "Escribe el nombre.") @Size(max = 200, message = "El nombre admite hasta 200 caracteres.") String nombre,
            @Size(max = 6000, message = "La descripción admite hasta 6000 caracteres.") String descripcion) {
    }

    public record EventoEntradaDto(
            @NotNull(message = "Indica cuándo empieza.") LocalDate fechaInicio,
            @NotNull(message = "Indica cuándo termina.") LocalDate fechaFin,
            UUID municipioId, UUID temporadaId, Double latitud, Double longitud,
            @NotNull(message = "Indica el estado.")
            @Pattern(regexp = "^(borrador|publicado|cancelado|archivado)$", message = "Estado no válido.") String estado,
            Map<String, Object> datos,
            @NotEmpty(message = "Escribe al menos el texto en español.") Map<String, @Valid TextoEventoDto> traducciones,
            @Size(max = 50, message = "Máximo 50 negocios.") List<UUID> negocioIds) {
    }

    public record EventoAdminDto(UUID id, String slug, LocalDate fechaInicio, LocalDate fechaFin, UUID municipioId,
                                 UUID temporadaId, Double latitud, Double longitud, String estado,
                                 Map<String, Object> datos, Map<String, TextoEventoDto> traducciones, List<UUID> negocioIds,
                                 OffsetDateTime actualizadoEn) {
    }

    // ---------------- listado común ----------------

    public record ContenidoResumenDto(UUID id, String slug, String nombre, String estado, OffsetDateTime actualizadoEn) {
    }
}
