package mx.com.traveloaxaca.comunidad.repo;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class ComentarioRepositorio {

    public record ComentarioFila(UUID id, UUID padreId, UUID usuarioId, String autorNombre, String texto,
                                 OffsetDateTime creadoEn, int meGusta, String estado, UUID objetivoId) {
    }

    private static final String SELECT = """
            SELECT c.id, c.padre_id, c.usuario_id, u.nombre AS autor_nombre, c.texto, c.creado_en,
                   CAST((SELECT count(*) FROM reaccion x WHERE x.comentario_id = c.id AND x.tipo = 'me_gusta') AS integer) AS me_gusta,
                   c.estado, COALESCE(c.lugar_id, c.ruta_id, c.articulo_id, c.evento_id) AS objetivo_id
            FROM comentario c JOIN usuario u ON u.id = c.usuario_id
            """;

    private final JdbcClient jdbc;

    public ComentarioRepositorio(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** tipo: lugar, ruta, evento o articulo. Devuelve el nombre de la columna. */
    public static String columna(String tipo) {
        return switch (tipo) {
            case "lugar" -> "lugar_id";
            case "ruta" -> "ruta_id";
            case "evento" -> "evento_id";
            case "articulo" -> "articulo_id";
            default -> throw new IllegalArgumentException(tipo);
        };
    }

    public Optional<UUID> objetivoPublicoPorSlug(String tipo, String slug, String destino) {
        String sql = switch (tipo) {
            case "lugar" -> "SELECT x.id FROM lugar x JOIN destino d ON d.id = x.destino_id AND d.codigo = :d "
                    + "WHERE x.slug = :s AND x.estado = 'publicado' AND x.eliminado_en IS NULL";
            case "ruta" -> "SELECT x.id FROM ruta x JOIN destino d ON d.id = x.destino_id AND d.codigo = :d "
                    + "WHERE x.slug = :s AND x.estado = 'publicada' AND x.eliminado_en IS NULL";
            case "evento" -> "SELECT x.id FROM evento x JOIN destino d ON d.id = x.destino_id AND d.codigo = :d "
                    + "WHERE x.slug = :s AND x.estado = 'publicado' AND x.eliminado_en IS NULL";
            case "articulo" -> "SELECT x.id FROM articulo x WHERE x.slug = :s AND x.estado = 'publicado' "
                    + "AND x.eliminado_en IS NULL AND CAST(:d AS text) IS NOT NULL";
            default -> throw new IllegalArgumentException(tipo);
        };
        return jdbc.sql(sql).param("s", slug).param("d", destino).query(UUID.class).optional();
    }

    public boolean objetivoPublicado(String tipo, UUID id) {
        String sql = switch (tipo) {
            case "lugar" -> "SELECT count(*) FROM lugar WHERE id = :id AND estado = 'publicado' AND eliminado_en IS NULL";
            case "ruta" -> "SELECT count(*) FROM ruta WHERE id = :id AND estado = 'publicada' AND eliminado_en IS NULL";
            case "evento" -> "SELECT count(*) FROM evento WHERE id = :id AND estado = 'publicado' AND eliminado_en IS NULL";
            case "articulo" -> "SELECT count(*) FROM articulo WHERE id = :id AND estado = 'publicado' AND eliminado_en IS NULL";
            default -> throw new IllegalArgumentException(tipo);
        };
        return jdbc.sql(sql).param("id", id).query(Integer.class).single() > 0;
    }

    public List<ComentarioFila> principales(String tipo, UUID objetivoId, int limite, int desplazamiento) {
        return jdbc.sql(SELECT + " WHERE c." + columna(tipo) + " = :o AND c.padre_id IS NULL AND c.estado = 'publicado'"
                + " AND c.eliminado_en IS NULL ORDER BY c.creado_en DESC, c.id LIMIT :l OFFSET :of")
                .param("o", objetivoId).param("l", limite).param("of", desplazamiento)
                .query(ComentarioFila.class).list();
    }

    public long contarPrincipales(String tipo, UUID objetivoId) {
        return jdbc.sql("SELECT count(*) FROM comentario_visible WHERE " + columna(tipo) + " = :o AND padre_id IS NULL")
                .param("o", objetivoId).query(Long.class).single();
    }

    public List<ComentarioFila> respuestasDe(List<UUID> padres) {
        if (padres.isEmpty()) {
            return List.of();
        }
        return jdbc.sql(SELECT + " WHERE c.padre_id IN (:p) AND c.estado = 'publicado' AND c.eliminado_en IS NULL"
                + " ORDER BY c.creado_en, c.id").param("p", padres).query(ComentarioFila.class).list();
    }

    public Optional<ComentarioFila> porId(UUID id) {
        return jdbc.sql(SELECT + " WHERE c.id = :id AND c.eliminado_en IS NULL")
                .param("id", id).query(ComentarioFila.class).optional();
    }

    public UUID crear(UUID usuarioId, String tipo, UUID objetivoId, UUID padreId, String texto, String idioma,
                      String estado) {
        return jdbc.sql("INSERT INTO comentario (usuario_id, " + columna(tipo) + ", padre_id, texto, idioma_codigo, "
                + "estado, auto_moderado) VALUES (:u, :o, :p, :t, :i, :e, :e = 'publicado') RETURNING id")
                .param("u", usuarioId).param("o", objetivoId).param("p", padreId).param("t", texto)
                .param("i", idioma).param("e", estado).query(UUID.class).single();
    }

    public void actualizarTexto(UUID id, String texto, String estado) {
        jdbc.sql("""
                UPDATE comentario SET texto = :t, estado = :e, auto_moderado = (:e = 'publicado'), moderado_por = NULL
                WHERE id = :id""").param("t", texto).param("e", estado).param("id", id).update();
    }

    public void eliminar(UUID id) {
        jdbc.sql("UPDATE comentario SET eliminado_en = now() WHERE id = :id").param("id", id).update();
    }

    public int recientesDe(UUID usuarioId) {
        return jdbc.sql("""
                SELECT CAST(count(*) AS integer) FROM comentario
                WHERE usuario_id = :u AND creado_en > now() - interval '1 hour'""")
                .param("u", usuarioId).query(Integer.class).single();
    }
}
