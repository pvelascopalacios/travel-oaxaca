package mx.com.traveloaxaca.comunidad.repo;

import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class ReporteRepositorio {

    /** Dónde vive el contenido reportado y quién lo escribió. */
    public record ContenidoReportable(UUID autorId, boolean visible) {
    }

    private final JdbcClient jdbc;

    public ReporteRepositorio(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public boolean dispositivoExiste(UUID id) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM dispositivo WHERE id = :id)").param("id", id)
                .query(Boolean.class).single();
    }

    public boolean negocioPublicado(UUID id) {
        return jdbc.sql("SELECT count(*) FROM negocio WHERE id = :id AND estado = 'publicada' AND eliminado_en IS NULL")
                .param("id", id).query(Integer.class).single() > 0;
    }

    // ---------------- fichas ----------------

    public int recientesFicha(UUID usuarioId, UUID dispositivoId) {
        return jdbc.sql("""
                SELECT CAST(count(*) AS integer) FROM reporte_ficha
                WHERE creado_en > now() - interval '1 hour'
                  AND ((CAST(:u AS uuid) IS NOT NULL AND usuario_id = :u)
                    OR (CAST(:d AS uuid) IS NOT NULL AND dispositivo_id = :d))""")
                .param("u", usuarioId).param("d", dispositivoId).query(Integer.class).single();
    }

    public boolean fichaAbiertaDe(UUID negocioId, String motivo, UUID usuarioId, UUID dispositivoId) {
        return jdbc.sql("""
                SELECT EXISTS (SELECT 1 FROM reporte_ficha
                  WHERE negocio_id = :n AND motivo = :m AND estado IN ('nuevo','en_revision')
                    AND ((CAST(:u AS uuid) IS NOT NULL AND usuario_id = :u)
                      OR (CAST(:d AS uuid) IS NOT NULL AND dispositivo_id = :d)))""")
                .param("n", negocioId).param("m", motivo).param("u", usuarioId).param("d", dispositivoId)
                .query(Boolean.class).single();
    }

    public UUID crearFicha(UUID negocioId, UUID usuarioId, UUID dispositivoId, String motivo, String detalle) {
        return jdbc.sql("""
                INSERT INTO reporte_ficha (negocio_id, usuario_id, dispositivo_id, motivo, detalle)
                VALUES (:n, :u, :d, :m, :t) RETURNING id""")
                .param("n", negocioId).param("u", usuarioId).param("d", dispositivoId).param("m", motivo)
                .param("t", detalle).query(UUID.class).single();
    }

    // ---------------- contenido ----------------

    public Optional<ContenidoReportable> contenido(String tipo, UUID id) {
        String sql = switch (tipo) {
            case "resena" -> "SELECT usuario_id AS autor_id, (estado = 'publicada') AS visible FROM resena "
                    + "WHERE id = :id AND eliminado_en IS NULL";
            case "comentario" -> "SELECT usuario_id AS autor_id, (estado = 'publicado') AS visible FROM comentario "
                    + "WHERE id = :id AND eliminado_en IS NULL";
            case "foto" -> "SELECT r.usuario_id AS autor_id, (me.moderacion = 'aprobado' AND r.estado = 'publicada') AS visible "
                    + "FROM resena_medio rm JOIN medio me ON me.id = rm.medio_id JOIN resena r ON r.id = rm.resena_id "
                    + "WHERE me.id = :id AND me.eliminado_en IS NULL AND r.eliminado_en IS NULL";
            default -> throw new IllegalArgumentException(tipo);
        };
        return jdbc.sql(sql).param("id", id).query(ContenidoReportable.class).optional();
    }

    private static String col(String tipo) {
        return switch (tipo) {
            case "resena" -> "resena_id";
            case "comentario" -> "comentario_id";
            case "foto" -> "medio_id";
            default -> throw new IllegalArgumentException(tipo);
        };
    }

    public int recientesContenido(UUID usuarioId, UUID dispositivoId) {
        return jdbc.sql("""
                SELECT CAST(count(*) AS integer) FROM reporte_contenido
                WHERE creado_en > now() - interval '1 hour'
                  AND ((CAST(:u AS uuid) IS NOT NULL AND usuario_id = :u)
                    OR (CAST(:d AS uuid) IS NOT NULL AND dispositivo_id = :d))""")
                .param("u", usuarioId).param("d", dispositivoId).query(Integer.class).single();
    }

    public boolean contenidoAbiertoDe(String tipo, UUID id, UUID usuarioId, UUID dispositivoId) {
        return jdbc.sql("""
                SELECT EXISTS (SELECT 1 FROM reporte_contenido
                  WHERE %s = :id AND estado IN ('nuevo','en_revision')
                    AND ((CAST(:u AS uuid) IS NOT NULL AND usuario_id = :u)
                      OR (CAST(:d AS uuid) IS NOT NULL AND dispositivo_id = :d)))""".formatted(col(tipo)))
                .param("id", id).param("u", usuarioId).param("d", dispositivoId).query(Boolean.class).single();
    }

    public UUID crearContenido(String tipo, UUID id, UUID usuarioId, UUID dispositivoId, String motivo, String detalle) {
        return jdbc.sql("INSERT INTO reporte_contenido (" + col(tipo) + ", usuario_id, dispositivo_id, motivo, detalle) "
                + "VALUES (:id, :u, :d, :m, :t) RETURNING id")
                .param("id", id).param("u", usuarioId).param("d", dispositivoId).param("m", motivo)
                .param("t", detalle).query(UUID.class).single();
    }

    /** Personas o dispositivos distintos con un reporte abierto sobre ese contenido. */
    public int reportantesAbiertos(String tipo, UUID id) {
        return jdbc.sql("""
                SELECT CAST(count(DISTINCT COALESCE(CAST(usuario_id AS text), CAST(dispositivo_id AS text))) AS integer)
                FROM reporte_contenido WHERE %s = :id AND estado IN ('nuevo','en_revision')""".formatted(col(tipo)))
                .param("id", id).query(Integer.class).single();
    }

    /** Oculta lo reportado hasta que lo revise el equipo. Devuelve true si estaba visible. */
    public boolean ocultarPorReportes(String tipo, UUID id) {
        String sql = switch (tipo) {
            case "resena" -> "UPDATE resena SET estado = 'oculta', auto_moderada = true, moderada_por = NULL "
                    + "WHERE id = :id AND estado = 'publicada'";
            case "comentario" -> "UPDATE comentario SET estado = 'oculto', auto_moderado = true, moderado_por = NULL "
                    + "WHERE id = :id AND estado = 'publicado'";
            case "foto" -> "UPDATE medio SET moderacion = 'pendiente', revisado_por = NULL, revisado_en = NULL, "
                    + "motivo_rechazo = NULL WHERE id = :id AND moderacion = 'aprobado'";
            default -> throw new IllegalArgumentException(tipo);
        };
        return jdbc.sql(sql).param("id", id).update() > 0;
    }
}
