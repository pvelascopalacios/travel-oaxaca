package mx.com.traveloaxaca.medicion.dto;

import jakarta.validation.Valid;
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

/** Medición: eventos que manda la app o la web, y lo que ven los negocios y el equipo interno. */
public final class MedicionDtos {

    private MedicionDtos() {
    }

    // ---------------- entrada de eventos ----------------

    /** guardado lo registra la API sola al guardar un favorito. impresion_destacado y clic_destacado son de los espacios patrocinados. */
    public record ItemEventoDto(
            @NotNull(message = "Indica el tipo de evento.")
            @Pattern(regexp = "^(vista_ficha|toque_whatsapp|llamada|como_llegar|compartido|clic_web|impresion_destacado|clic_destacado)$",
                    message = "Tipo de evento no válido.") String tipo,
            @NotNull(message = "Indica el negocio.") UUID negocioId,
            UUID sucursalId,
            OffsetDateTime ocurridoEn) {
    }

    public record EventosUsoDto(
            @NotNull(message = "Indica el dispositivo.") UUID dispositivoId,
            @Size(max = 40, message = "El origen admite hasta 40 caracteres.") String origen,
            @Pattern(regexp = "^[a-z0-9_-]{2,40}$", message = "El código de campaña no es válido.") String campana,
            @NotEmpty(message = "Envía al menos un evento.")
            @Size(max = 20, message = "Máximo 20 eventos por envío.") List<@Valid ItemEventoDto> eventos) {
    }

    /** recibidos: los que llegaron; registrados: los que se guardaron (se omiten repetidos, vencidos y negocios no publicados). */
    public record EventosUsoRespuesta(int recibidos, int registrados) {
    }

    // ---------------- métricas del negocio ----------------

    public record TotalesDto(int vistas, int contactos, Double tasaContacto) {
    }

    public record PuntoDiaDto(LocalDate dia, int vistas, int contactos) {
    }

    public record ConteoTipoDto(String tipo, int total) {
    }

    public record OrigenMetricaDto(String clave, String nombre, int vistas, int contactos) {
    }

    /**
     * contactos = toques de WhatsApp, llamadas, "cómo llegar" y guardados. limitado = el plan Gratis: solo trae los
     * totales de la última semana (anterior, serie, porTipo y porOrigen vienen vacíos o nulos).
     */
    public record MetricasNegocioDto(int dias, LocalDate desde, LocalDate hasta, TotalesDto actual,
                                     TotalesDto anterior, List<PuntoDiaDto> serie, List<ConteoTipoDto> porTipo,
                                     List<OrigenMetricaDto> porOrigen, boolean limitado) {
    }

    public record ReporteMensualDto(UUID id, int anio, int mes, OffsetDateTime generadoEn, OffsetDateTime enviadoEn,
                                    Map<String, Object> datos) {
    }

    // ---------------- métricas generales ----------------

    public record NegocioRankingDto(UUID negocioId, String slug, String nombre, String categoriaClave, int vistas,
                                    int contactos, Double tasaContacto, LocalDate ultimoContacto,
                                    int diasSinContacto) {
    }

    public record MetricasGeneralesDto(int dias, LocalDate desde, LocalDate hasta, int vistas, int contactos,
                                       Double tasaContacto, int dispositivosActivos,
                                       List<NegocioRankingDto> negocios) {
    }

    // ---------------- campañas ----------------

    public record OrigenDto(String clave, String nombre) {
    }

    public record CampanaEntradaDto(
            @NotBlank(message = "Elige el origen.") String origen,
            @NotBlank(message = "Escribe el código.")
            @Pattern(regexp = "^[a-z0-9_-]{2,40}$", message = "El código usa minúsculas, números, guion y guion bajo (2 a 40).") String codigo,
            @NotBlank(message = "Escribe el nombre.") @Size(max = 120, message = "El nombre admite hasta 120 caracteres.") String nombre,
            LocalDate inicio, LocalDate fin) {
    }

    /** El código no se puede cambiar después: ya está en enlaces publicados. */
    public record CampanaCambioDto(
            @NotBlank(message = "Elige el origen.") String origen,
            @NotBlank(message = "Escribe el nombre.") @Size(max = 120, message = "El nombre admite hasta 120 caracteres.") String nombre,
            LocalDate inicio, LocalDate fin) {
    }

    public record CampanaDto(UUID id, String origenClave, String origenNombre, String codigo, String nombre,
                             LocalDate inicio, LocalDate fin, int vistas, int contactos) {
    }
}
