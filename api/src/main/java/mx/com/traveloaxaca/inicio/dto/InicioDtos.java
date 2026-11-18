package mx.com.traveloaxaca.inicio.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Contenido editorial de la pantalla de inicio. Destacado: etiqueta, título, texto, botón y ruta. Pueblo: título (nombre),
 * texto (región), comunidades y saludo. Historia: título (la frase), persona, lugar y negocio. Reel: título, texto y enlace.
 */
public final class InicioDtos {

    private InicioDtos() {
    }

    public record TextoBloqueDto(
            @Size(max = 60, message = "La etiqueta admite hasta 60 caracteres.") String etiqueta,
            @NotBlank(message = "Escribe el título.") @Size(max = 160, message = "El título admite hasta 160 caracteres.") String titulo,
            @Size(max = 400, message = "El texto admite hasta 400 caracteres.") String texto,
            @Size(max = 40, message = "El botón admite hasta 40 caracteres.") String boton) {
    }

    public record BloqueEntradaDto(
            @NotNull(message = "Elige el tipo.")
            @Pattern(regexp = "^(destacado|pueblo|historia|reel)$", message = "El tipo debe ser destacado, pueblo, historia o reel.") String tipo,
            @Min(value = 0, message = "El orden va de 0 a 999.") @Max(value = 999, message = "El orden va de 0 a 999.") Integer orden,
            @NotNull(message = "Indica el estado.")
            @Pattern(regexp = "^(borrador|publicado|archivado)$", message = "El estado debe ser borrador, publicado o archivado.") String estado,
            LocalDate publicarDesde, LocalDate publicarHasta, UUID medioId,
            @Size(max = 120, message = "El crédito admite hasta 120 caracteres.") String credito,
            @Size(max = 200, message = "La ruta admite hasta 200 caracteres.") String ruta,
            @Size(max = 300, message = "El enlace admite hasta 300 caracteres.") String enlace,
            @Min(value = 0, message = "Las comunidades no pueden ser negativas.") Integer comunidades,
            @Size(max = 120, message = "El saludo admite hasta 120 caracteres.") String saludo,
            @Size(max = 8, message = "Idioma no válido.") String saludoIdioma,
            @Size(max = 200, message = "Quién verificó admite hasta 200 caracteres.") String saludoVerificadoPor,
            @Size(max = 120, message = "La persona admite hasta 120 caracteres.") String persona,
            @Size(max = 120, message = "El lugar admite hasta 120 caracteres.") String lugar,
            UUID negocioId, boolean permisoConfirmado,
            @NotEmpty(message = "Escribe al menos el texto en español.") Map<String, @Valid TextoBloqueDto> traducciones) {
    }

    public record BloqueAdminDto(UUID id, String tipo, int orden, String estado, LocalDate publicarDesde,
                                 LocalDate publicarHasta, UUID medioId, String fotoUrl, String credito, String ruta,
                                 String enlace, Integer comunidades, String saludo, String saludoIdioma,
                                 String saludoVerificadoPor, String persona, String lugar, UUID negocioId,
                                 boolean permisoConfirmado, Map<String, TextoBloqueDto> traducciones,
                                 OffsetDateTime actualizadoEn) {
    }

    public record BloqueResumenDto(UUID id, String tipo, int orden, String estado, String titulo,
                                   LocalDate publicarDesde, LocalDate publicarHasta) {
    }

    /** Lo que recibe la web: solo los campos que corresponden al tipo vienen con valor. Sin foto aprobada no sale. */
    public record BloquePublicoDto(UUID id, String etiqueta, String titulo, String texto, String boton, String fotoUrl,
                                   String credito, String ruta, String enlace, Integer comunidades, String saludo,
                                   String saludoIdioma, String persona, String lugar, String negocioSlug) {
    }

    public record InicioPublicoDto(List<BloquePublicoDto> destacados, List<BloquePublicoDto> pueblos,
                                   List<BloquePublicoDto> historias, List<BloquePublicoDto> reels) {
    }
}
