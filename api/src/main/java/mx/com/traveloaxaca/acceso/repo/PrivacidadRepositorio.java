package mx.com.traveloaxaca.acceso.repo;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class PrivacidadRepositorio {

    public record ConsentimientoFila(String tipo, String versionTexto, boolean aceptado, OffsetDateTime fecha) {
    }

    public record SolicitudFila(UUID id, UUID usuarioId, String correoUsuario, String tipo, String estado,
                                String detalle, OffsetDateTime resueltaEn, OffsetDateTime creadoEn) {
    }

    private static final String SOLICITUD = """
            SELECT s.id, s.usuario_id, u.correo::text AS correo_usuario, s.tipo, s.estado, s.detalle,
                   s.resuelta_en, s.creado_en
            FROM solicitud_privacidad s JOIN usuario u ON u.id = s.usuario_id""";

    private final JdbcClient jdbc;

    public PrivacidadRepositorio(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    // ---------------- consentimientos ----------------

    public void registrarConsentimiento(UUID usuarioId, String tipo, String versionTexto, boolean aceptado) {
        jdbc.sql("INSERT INTO consentimiento (usuario_id, tipo, version_texto, aceptado) VALUES (:u, :t, :v, :a)")
                .param("u", usuarioId).param("t", tipo).param("v", versionTexto).param("a", aceptado).update();
    }

    public List<ConsentimientoFila> consentimientosDe(UUID usuarioId) {
        return jdbc.sql("""
                SELECT tipo, version_texto, aceptado, fecha FROM consentimiento
                WHERE usuario_id = :u ORDER BY fecha DESC""")
                .param("u", usuarioId).query(ConsentimientoFila.class).list();
    }

    // ---------------- solicitudes ----------------

    public boolean hayAbierta(UUID usuarioId, String tipo) {
        return jdbc.sql("""
                SELECT EXISTS (SELECT 1 FROM solicitud_privacidad
                               WHERE usuario_id = :u AND tipo = :t AND estado IN ('recibida','en_proceso'))""")
                .param("u", usuarioId).param("t", tipo).query(Boolean.class).single();
    }

    public UUID crearSolicitud(UUID usuarioId, String tipo, String detalle) {
        return jdbc.sql("INSERT INTO solicitud_privacidad (usuario_id, tipo, detalle) VALUES (:u, :t, :d) RETURNING id")
                .param("u", usuarioId).param("t", tipo).param("d", detalle).query(UUID.class).single();
    }

    public List<SolicitudFila> solicitudesDe(UUID usuarioId) {
        return jdbc.sql(SOLICITUD + " WHERE s.usuario_id = :u ORDER BY s.creado_en DESC")
                .param("u", usuarioId).query(SolicitudFila.class).list();
    }

    public List<SolicitudFila> solicitudes(String estado, int limite, int desplazamiento) {
        Map<String, Object> p = new HashMap<>();
        p.put("limite", limite);
        p.put("desplazamiento", desplazamiento);
        String donde = "";
        if (estado != null && !estado.isBlank()) {
            p.put("estado", estado);
            donde = " WHERE s.estado = :estado";
        }
        return jdbc.sql(SOLICITUD + donde + " ORDER BY s.creado_en DESC LIMIT :limite OFFSET :desplazamiento")
                .params(p).query(SolicitudFila.class).list();
    }

    public long contarSolicitudes(String estado) {
        if (estado != null && !estado.isBlank()) {
            return jdbc.sql("SELECT count(*) FROM solicitud_privacidad WHERE estado = :e")
                    .param("e", estado).query(Long.class).single();
        }
        return jdbc.sql("SELECT count(*) FROM solicitud_privacidad").query(Long.class).single();
    }

    public Optional<SolicitudFila> solicitudPorId(UUID id) {
        return jdbc.sql(SOLICITUD + " WHERE s.id = :id").param("id", id).query(SolicitudFila.class).optional();
    }

    public int cambiarEstadoSolicitud(UUID id, String estado) {
        return jdbc.sql("""
                UPDATE solicitud_privacidad
                SET estado = :e,
                    resuelta_en = CASE WHEN CAST(:e AS text) IN ('resuelta','rechazada') THEN now() ELSE NULL END
                WHERE id = :id AND estado IN ('recibida','en_proceso')""")
                .param("e", estado).param("id", id).update();
    }
}
