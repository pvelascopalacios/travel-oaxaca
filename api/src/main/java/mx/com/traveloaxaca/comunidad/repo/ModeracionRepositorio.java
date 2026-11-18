package mx.com.traveloaxaca.comunidad.repo;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Cola y acciones del equipo (admin y editor) sobre reseñas, comentarios, fotos y reportes. */
@Repository
public class ModeracionRepositorio {

    public record ColaFila(String tipo, UUID id, String estado, String resumen, String texto, String motivoReporte,
                           int reportes, UUID negocioId, OffsetDateTime creadoEn) {
    }

    private static final String COLA = """
            WITH cola AS (
              SELECT 'resena' AS tipo, r.id, r.estado, left(COALESCE(r.titulo || ': ', '') || COALESCE(r.texto, ''), 140) AS resumen,
                     COALESCE(r.titulo, '') || ' ' || COALESCE(r.texto, '') AS texto, CAST(NULL AS text) AS motivo_reporte,
                     CAST((SELECT count(DISTINCT COALESCE(CAST(x.usuario_id AS text), CAST(x.dispositivo_id AS text)))
                           FROM reporte_contenido x WHERE x.resena_id = r.id AND x.estado IN ('nuevo','en_revision')) AS integer) AS reportes,
                     r.negocio_id, r.creado_en
              FROM resena r WHERE r.eliminado_en IS NULL AND (r.estado = 'pendiente' OR (r.estado = 'oculta' AND r.auto_moderada))
              UNION ALL
              SELECT 'comentario', c.id, c.estado, left(c.texto, 140), c.texto, CAST(NULL AS text),
                     CAST((SELECT count(DISTINCT COALESCE(CAST(x.usuario_id AS text), CAST(x.dispositivo_id AS text)))
                           FROM reporte_contenido x WHERE x.comentario_id = c.id AND x.estado IN ('nuevo','en_revision')) AS integer),
                     CAST(NULL AS uuid), c.creado_en
              FROM comentario c WHERE c.eliminado_en IS NULL AND (c.estado = 'pendiente' OR (c.estado = 'oculto' AND c.auto_moderado))
              UNION ALL
              SELECT 'foto', me.id, me.moderacion, 'Foto de reseña', CAST(NULL AS text), CAST(NULL AS text),
                     CAST((SELECT count(DISTINCT COALESCE(CAST(x.usuario_id AS text), CAST(x.dispositivo_id AS text)))
                           FROM reporte_contenido x WHERE x.medio_id = me.id AND x.estado IN ('nuevo','en_revision')) AS integer),
                     r.negocio_id, me.creado_en
              FROM medio me JOIN resena_medio rm ON rm.medio_id = me.id JOIN resena r ON r.id = rm.resena_id
              WHERE me.eliminado_en IS NULL AND me.moderacion = 'pendiente' AND me.hash IS NOT NULL AND r.eliminado_en IS NULL
              UNION ALL
              SELECT 'reporte_ficha', f.id, f.estado, n.nombre_comercial || ' · ' || f.motivo || COALESCE(': ' || f.detalle, ''),
                     CAST(NULL AS text), f.motivo, 1, f.negocio_id, f.creado_en
              FROM reporte_ficha f JOIN negocio n ON n.id = f.negocio_id WHERE f.estado IN ('nuevo','en_revision')
              UNION ALL
              SELECT 'reporte_contenido', k.id, k.estado,
                     CASE WHEN k.resena_id IS NOT NULL THEN 'Reseña' WHEN k.comentario_id IS NOT NULL THEN 'Comentario' ELSE 'Foto' END
                       || ' · ' || k.motivo || COALESCE(': ' || k.detalle, ''),
                     CAST(NULL AS text), k.motivo, 1,
                     (SELECT r.negocio_id FROM resena r WHERE r.id = k.resena_id), k.creado_en
              FROM reporte_contenido k WHERE k.estado IN ('nuevo','en_revision')
            )
            """;

    private final JdbcClient jdbc;

    public ModeracionRepositorio(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<ColaFila> cola(String tipo, UUID negocioId, int limite, int desplazamiento) {
        return jdbc.sql(COLA + """
                SELECT * FROM cola WHERE (CAST(:t AS text) IS NULL OR tipo = :t)
                  AND (CAST(:n AS uuid) IS NULL OR negocio_id = :n)
                ORDER BY creado_en, id LIMIT :l OFFSET :o""")
                .param("t", tipo).param("n", negocioId).param("l", limite).param("o", desplazamiento).query(ColaFila.class).list();
    }

    public long contar(String tipo, UUID negocioId) {
        return jdbc.sql(COLA + "SELECT count(*) FROM cola WHERE (CAST(:t AS text) IS NULL OR tipo = :t)"
                + " AND (CAST(:n AS uuid) IS NULL OR negocio_id = :n)")
                .param("t", tipo).param("n", negocioId).query(Long.class).single();
    }

    // ---------------- reseñas y comentarios ----------------

    public record Moderable(UUID id, String estado, UUID negocioId, UUID autorId) {
    }

    public java.util.Optional<Moderable> resena(UUID id) {
        return jdbc.sql("SELECT id, estado, negocio_id, usuario_id AS autor_id FROM resena WHERE id = :id AND eliminado_en IS NULL FOR UPDATE")
                .param("id", id).query(Moderable.class).optional();
    }

    public java.util.Optional<Moderable> comentario(UUID id) {
        return jdbc.sql("SELECT id, estado, CAST(NULL AS uuid) AS negocio_id, usuario_id AS autor_id FROM comentario WHERE id = :id AND eliminado_en IS NULL FOR UPDATE")
                .param("id", id).query(Moderable.class).optional();
    }

    public void estadoResena(UUID id, String estado, UUID revisor) {
        jdbc.sql("UPDATE resena SET estado = :e, moderada_por = :r, auto_moderada = false WHERE id = :id")
                .param("e", estado).param("r", revisor).param("id", id).update();
    }

    public void estadoComentario(UUID id, String estado, UUID revisor) {
        jdbc.sql("UPDATE comentario SET estado = :e, moderado_por = :r, auto_moderado = false WHERE id = :id")
                .param("e", estado).param("r", revisor).param("id", id).update();
    }

    // ---------------- fotos ----------------

    public boolean esFotoDeResena(UUID medioId) {
        return jdbc.sql("""
                SELECT EXISTS (SELECT 1 FROM resena_medio rm JOIN medio me ON me.id = rm.medio_id
                               WHERE me.id = :m AND me.eliminado_en IS NULL)""")
                .param("m", medioId).query(Boolean.class).single();
    }

    public void resolverFoto(UUID medioId, boolean aprobada, UUID revisor, String motivo) {
        jdbc.sql("""
                UPDATE medio SET moderacion = :e, revisado_por = :r, revisado_en = now(), motivo_rechazo = :m
                WHERE id = :id""")
                .param("e", aprobada ? "aprobado" : "rechazado").param("r", revisor).param("m", motivo)
                .param("id", medioId).update();
    }

    public String estadoFoto(UUID medioId) {
        return jdbc.sql("SELECT moderacion FROM medio WHERE id = :id").param("id", medioId).query(String.class).single();
    }

    // ---------------- reportes ----------------

    /** Cierra los reportes abiertos sobre un contenido. tipo: resena, comentario o foto. */
    public int cerrarReportesDe(String tipo, UUID id, String estado, UUID revisor) {
        String col = switch (tipo) {
            case "resena" -> "resena_id";
            case "comentario" -> "comentario_id";
            case "foto" -> "medio_id";
            default -> throw new IllegalArgumentException(tipo);
        };
        return jdbc.sql("UPDATE reporte_contenido SET estado = :e, resuelto_por = :r, resuelto_en = now() WHERE " + col
                + " = :id AND estado IN ('nuevo','en_revision')")
                .param("e", estado).param("r", revisor).param("id", id).update();
    }

    public java.util.Optional<String> estadoReporte(String tabla, UUID id) {
        return jdbc.sql("SELECT estado FROM " + tabla(tabla) + " WHERE id = :id FOR UPDATE")
                .param("id", id).query(String.class).optional();
    }

    public void cambiarReporte(String tabla, UUID id, String estado, UUID revisor) {
        boolean cierra = !"en_revision".equals(estado);
        jdbc.sql("UPDATE " + tabla(tabla) + " SET estado = :e, resuelto_por = :r, resuelto_en = "
                + (cierra ? "now()" : "NULL") + " WHERE id = :id")
                .param("e", estado).param("r", cierra ? revisor : null).param("id", id).update();
    }

    private static String tabla(String tabla) {
        return switch (tabla) {
            case "ficha" -> "reporte_ficha";
            case "contenido" -> "reporte_contenido";
            default -> throw new IllegalArgumentException(tabla);
        };
    }

    // ---------------- avisos ----------------

    public String nombreNegocio(UUID negocioId) {
        return jdbc.sql("SELECT nombre_comercial FROM negocio WHERE id = :id").param("id", negocioId)
                .query(String.class).single();
    }
}
