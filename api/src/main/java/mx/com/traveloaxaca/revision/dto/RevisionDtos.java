package mx.com.traveloaxaca.revision.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;
import java.util.UUID;
import mx.com.traveloaxaca.negocios.dto.NegocioDtos.FichaDto;

public final class RevisionDtos {

    private RevisionDtos() {
    }

    /** Una solicitud pendiente. tipo: ficha_nueva, cambio o foto. url solo viene en las fotos. */
    public record ColaItemDto(String tipo, UUID negocioId, UUID medioId, String nombreComercial, String categoriaClave,
                              String municipioNombre, UUID regionId, String regionNombre, String url,
                              OffsetDateTime enviadaEn, long horasEspera, String urgencia) {
    }

    public record PropietarioDto(UUID usuarioId, String nombre, String correo) {
    }

    /** Todo lo que el revisor necesita para decidir: la ficha, los cambios propuestos (dentro de ficha.revisionVigente) y quién la envió. */
    public record DetalleRevisionDto(String tipo, FichaDto ficha, PropietarioDto propietario, OffsetDateTime enviadaEn) {
    }

    public record RechazoDto(
            @NotBlank(message = "Escribe el motivo del rechazo.")
            @Size(min = 10, max = 1000, message = "El motivo debe tener entre 10 y 1000 caracteres.") String motivo) {
    }

    /** Una revisión ya resuelta. resultado: aprobada, aprobado, rechazada o rechazado. */
    public record HistorialDto(String tipo, UUID negocioId, UUID medioId, String nombreComercial, String resultado,
                               String motivo, String revisorNombre, OffsetDateTime resueltaEn) {
    }
}
