package mx.com.traveloaxaca.comunidad.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import mx.com.traveloaxaca.comun.api.Pagina;

/** Datos de entrada y salida de reseñas, comentarios, reacciones, reportes, listas y moderación. */
public final class ComunidadDtos {

    private ComunidadDtos() {
    }

    // ---------------- reseñas ----------------

    public record ResenaEntradaDto(
            @NotNull(message = "Elige una calificación de 1 a 5.") @Min(value = 1, message = "La calificación va de 1 a 5.")
            @Max(value = 5, message = "La calificación va de 1 a 5.") Integer calificacion,
            @Size(max = 80, message = "El título admite hasta 80 caracteres.") String titulo,
            @Size(max = 2000, message = "La reseña admite hasta 2000 caracteres.") String texto,
            LocalDate fechaVisita,
            @Size(max = 8) String idioma) {
    }

    public record FotoResenaDto(UUID medioId, String url, String moderacion) {
    }

    public record RespuestaResenaDto(String texto, OffsetDateTime creadoEn, OffsetDateTime actualizadoEn) {
    }

    /** estado solo tiene valor cuando la ve su autor o el equipo del negocio. */
    public record ResenaDto(UUID id, int calificacion, String titulo, String texto, LocalDate fechaVisita,
                            String autorNombre, OffsetDateTime creadoEn, int utiles, String estado,
                            List<FotoResenaDto> fotos, RespuestaResenaDto respuesta,
                            boolean mia, boolean yoMarqueUtil) {
    }

    /** Una reseña propia con el negocio al que pertenece, para la lista «Mis reseñas». */
    public record MiResenaDto(UUID id, UUID negocioId, String negocioSlug, String negocioNombre, int calificacion,
                              String titulo, String texto, LocalDate fechaVisita, String estado, int utiles,
                              OffsetDateTime creadoEn) {
    }

    public record CalificacionDto(BigDecimal promedio, int total, Map<Integer, Integer> distribucion) {
    }

    public record ResenasPublicasDto(Pagina<ResenaDto> resenas, CalificacionDto calificacion) {
    }

    public record RespuestaEntradaDto(
            @NotBlank(message = "Escribe tu respuesta.") @Size(max = 1000, message = "La respuesta admite hasta 1000 caracteres.")
            String texto) {
    }

    public record FotoEntradaDto(@NotNull(message = "Falta la foto.") UUID medioId) {
    }

    // ---------------- comentarios ----------------

    public record ComentarioEntradaDto(
            @NotBlank(message = "Escribe tu comentario.") @Size(max = 1000, message = "El comentario admite hasta 1000 caracteres.")
            String texto,
            UUID padreId,
            @Size(max = 8) String idioma) {
    }

    public record ComentarioEdicionDto(
            @NotBlank(message = "Escribe tu comentario.") @Size(max = 1000, message = "El comentario admite hasta 1000 caracteres.")
            String texto) {
    }

    /** mio y yoLeDiMeGusta solo valen cuando la petición trae sesión; sin ella van en false. */
    public record ComentarioDto(UUID id, UUID padreId, String autorNombre, String texto, OffsetDateTime creadoEn,
                                int meGusta, String estado, List<ComentarioDto> respuestas,
                                boolean mio, boolean yoLeDiMeGusta) {
    }

    // ---------------- reacciones ----------------

    public record ReaccionDto(String tipo, int total) {
    }

    // ---------------- reportes ----------------

    public record ReporteFichaEntradaDto(
            @NotNull(message = "Falta el negocio.") UUID negocioId,
            @NotBlank(message = "Elige un motivo.") String motivo,
            @Size(max = 500, message = "El detalle admite hasta 500 caracteres.") String detalle) {
    }

    public record ReporteContenidoEntradaDto(
            @NotBlank(message = "Indica qué reportas: resena, comentario o foto.") String tipo,
            @NotNull(message = "Falta el contenido.") UUID id,
            @NotBlank(message = "Elige un motivo.") String motivo,
            @Size(max = 500, message = "El detalle admite hasta 500 caracteres.") String detalle) {
    }

    // ---------------- listas ----------------

    public record ListaEntradaDto(
            @NotBlank(message = "Ponle nombre a tu lista.") @Size(max = 80, message = "El nombre admite hasta 80 caracteres.")
            String nombre,
            Boolean esItinerario,
            LocalDate fechaInicio,
            LocalDate fechaFin,
            Boolean publica) {
    }

    public record ListaDto(UUID id, String nombre, boolean esItinerario, LocalDate fechaInicio, LocalDate fechaFin,
                           boolean publica, int totalElementos, OffsetDateTime creadoEn) {
    }

    @Schema(description = "tipo: negocio, lugar o ruta. dia solo aplica a itinerarios.")
    public record ListaItemEntradaDto(
            @NotBlank(message = "Indica si es negocio, lugar o ruta.") String tipo,
            @NotNull(message = "Falta el elemento.") UUID id,
            @Min(value = 1, message = "El día empieza en 1.") Integer dia,
            Integer orden,
            @Size(max = 300, message = "La nota admite hasta 300 caracteres.") String nota) {
    }

    public record ListaItemEdicionDto(
            @Min(value = 1, message = "El día empieza en 1.") Integer dia,
            Integer orden,
            @Size(max = 300, message = "La nota admite hasta 300 caracteres.") String nota) {
    }

    public record ListaItemDto(UUID itemId, String tipo, UUID id, String slug, String nombre, Integer dia, int orden,
                               String nota, String imagenUrl) {
    }

    public record ListaDetalleDto(UUID id, String nombre, boolean esItinerario, LocalDate fechaInicio,
                                  LocalDate fechaFin, boolean publica, String autorNombre,
                                  List<ListaItemDto> elementos) {
    }

    // ---------------- moderación ----------------

    public record ColaComunidadItemDto(String tipo, UUID id, String estado, String resumen, String motivo,
                                       int reportes, UUID negocioId, OffsetDateTime creadoEn) {
    }

    public record MotivoDto(@NotBlank(message = "Escribe el motivo.") @Size(min = 5, max = 200,
            message = "El motivo debe tener entre 5 y 200 caracteres.") String motivo) {
    }
}
