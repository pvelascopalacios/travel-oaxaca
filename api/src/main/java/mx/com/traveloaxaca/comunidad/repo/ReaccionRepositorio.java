package mx.com.traveloaxaca.comunidad.repo;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class ReaccionRepositorio {

    private final JdbcClient jdbc;

    public ReaccionRepositorio(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** "util" para reseñas, "me_gusta" para todo lo demás. */
    public static String tipoDe(String objetivo) {
        return "resena".equals(objetivo) ? "util" : "me_gusta";
    }

    public static String columna(String objetivo) {
        return switch (objetivo) {
            case "negocio" -> "negocio_id";
            case "lugar" -> "lugar_id";
            case "resena" -> "resena_id";
            case "comentario" -> "comentario_id";
            case "articulo" -> "articulo_id";
            default -> throw new IllegalArgumentException(objetivo);
        };
    }

    public boolean visible(String objetivo, UUID id) {
        String sql = switch (objetivo) {
            case "negocio" -> "SELECT count(*) FROM negocio WHERE id = :id AND estado = 'publicada' AND eliminado_en IS NULL";
            case "lugar" -> "SELECT count(*) FROM lugar WHERE id = :id AND estado = 'publicado' AND eliminado_en IS NULL";
            case "resena" -> "SELECT count(*) FROM resena_visible WHERE id = :id";
            case "comentario" -> "SELECT count(*) FROM comentario_visible WHERE id = :id";
            case "articulo" -> "SELECT count(*) FROM articulo WHERE id = :id AND estado = 'publicado' AND eliminado_en IS NULL";
            default -> throw new IllegalArgumentException(objetivo);
        };
        return jdbc.sql(sql).param("id", id).query(Integer.class).single() > 0;
    }

    public void agregar(UUID usuarioId, String objetivo, UUID id) {
        jdbc.sql("INSERT INTO reaccion (usuario_id, tipo, " + columna(objetivo) + ") VALUES (:u, :t, :id) ON CONFLICT DO NOTHING")
                .param("u", usuarioId).param("t", tipoDe(objetivo)).param("id", id).update();
    }

    public void quitar(UUID usuarioId, String objetivo, UUID id) {
        jdbc.sql("DELETE FROM reaccion WHERE usuario_id = :u AND tipo = :t AND " + columna(objetivo) + " = :id")
                .param("u", usuarioId).param("t", tipoDe(objetivo)).param("id", id).update();
    }

    /** De los ids dados, los que esta persona ya reaccionó (me gusta o útil, según el objetivo). */
    public Set<UUID> reaccionados(UUID usuarioId, String objetivo, List<UUID> ids) {
        if (usuarioId == null || ids.isEmpty()) {
            return Set.of();
        }
        String col = columna(objetivo);
        return new HashSet<>(jdbc.sql("SELECT " + col + " FROM reaccion WHERE usuario_id = :u AND tipo = :t AND "
                        + col + " IN (:ids)")
                .param("u", usuarioId).param("t", tipoDe(objetivo)).param("ids", ids).query(UUID.class).list());
    }

    public int total(String objetivo, UUID id) {
        return jdbc.sql("SELECT CAST(count(*) AS integer) FROM reaccion WHERE tipo = :t AND " + columna(objetivo) + " = :id")
                .param("t", tipoDe(objetivo)).param("id", id).query(Integer.class).single();
    }
}
