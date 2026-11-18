package mx.com.traveloaxaca.explorar.repo;

import java.util.List;
import java.util.UUID;
import mx.com.traveloaxaca.explorar.dto.ExplorarDtos.FavoritoDto;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class FavoritoRepositorio {

    public static final int MAXIMO = 500;

    private final JdbcClient jdbc;

    public FavoritoRepositorio(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Solo lo que sigue publicado; lo que se despublicó no estorba en la lista (el favorito se conserva). */
    public List<FavoritoDto> listar(UUID usuarioId, String idioma) {
        return jdbc.sql("""
                SELECT tipo, id, slug, nombre, imagen_clave AS imagen_url, creado_en FROM (
                  SELECT 'negocio' AS tipo, n.id, n.slug, n.nombre_comercial AS nombre, f.creado_en,
                         (SELECT me.clave_almacenamiento FROM negocio_medio nm JOIN medio me ON me.id = nm.medio_id
                           WHERE nm.negocio_id = n.id AND me.tipo = 'imagen' AND me.moderacion = 'aprobado' AND me.eliminado_en IS NULL
                           ORDER BY nm.es_portada DESC, nm.orden, nm.creado_en LIMIT 1) AS imagen_clave
                  FROM favorito f JOIN negocio n ON n.id = f.negocio_id AND n.estado = 'publicada' AND n.eliminado_en IS NULL
                  WHERE f.usuario_id = :u
                  UNION ALL
                  SELECT 'lugar', l.id, l.slug, COALESCE(t.nombre, te.nombre), f.creado_en,
                         (SELECT me.clave_almacenamiento FROM lugar_medio lm JOIN medio me ON me.id = lm.medio_id
                           WHERE lm.lugar_id = l.id AND me.tipo = 'imagen' AND me.moderacion = 'aprobado' AND me.eliminado_en IS NULL
                           ORDER BY lm.orden, lm.creado_en LIMIT 1)
                  FROM favorito f JOIN lugar l ON l.id = f.lugar_id AND l.estado = 'publicado' AND l.eliminado_en IS NULL
                  LEFT JOIN lugar_traduccion t ON t.lugar_id = l.id AND t.idioma_codigo = :i
                  JOIN lugar_traduccion te ON te.lugar_id = l.id AND te.idioma_codigo = 'es'
                  WHERE f.usuario_id = :u
                  UNION ALL
                  SELECT 'ruta', r.id, r.slug, COALESCE(t.nombre, te.nombre), f.creado_en, CAST(NULL AS text)
                  FROM favorito f JOIN ruta r ON r.id = f.ruta_id AND r.estado = 'publicada' AND r.eliminado_en IS NULL
                  LEFT JOIN ruta_traduccion t ON t.ruta_id = r.id AND t.idioma_codigo = :i
                  JOIN ruta_traduccion te ON te.ruta_id = r.id AND te.idioma_codigo = 'es'
                  WHERE f.usuario_id = :u
                ) x ORDER BY creado_en DESC, id""")
                .param("u", usuarioId).param("i", idioma).query(FavoritoDto.class).list();
    }

    public int contar(UUID usuarioId) {
        return jdbc.sql("SELECT count(*) FROM favorito WHERE usuario_id = :u").param("u", usuarioId)
                .query(Integer.class).single();
    }

    /** Verdadero si el elemento existe y está publicado. */
    public boolean visible(String tipo, UUID id) {
        String sql = switch (tipo) {
            case "negocio" -> "SELECT count(*) FROM negocio WHERE id = :id AND estado = 'publicada' AND eliminado_en IS NULL";
            case "lugar" -> "SELECT count(*) FROM lugar WHERE id = :id AND estado = 'publicado' AND eliminado_en IS NULL";
            case "ruta" -> "SELECT count(*) FROM ruta WHERE id = :id AND estado = 'publicada' AND eliminado_en IS NULL";
            default -> throw new IllegalArgumentException(tipo);
        };
        return jdbc.sql(sql).param("id", id).query(Integer.class).single() > 0;
    }

    /** Idempotente: si ya estaba guardado no hace nada y devuelve false. */
    public boolean agregar(UUID usuarioId, String tipo, UUID id) {
        String col = columna(tipo);
        return jdbc.sql("INSERT INTO favorito (usuario_id, " + col + ") VALUES (:u, :id) ON CONFLICT DO NOTHING")
                .param("u", usuarioId).param("id", id).update() > 0;
    }

    public void quitar(UUID usuarioId, String tipo, UUID id) {
        String col = columna(tipo);
        jdbc.sql("DELETE FROM favorito WHERE usuario_id = :u AND " + col + " = :id")
                .param("u", usuarioId).param("id", id).update();
    }

    private static String columna(String tipo) {
        return switch (tipo) {
            case "negocio" -> "negocio_id";
            case "lugar" -> "lugar_id";
            case "ruta" -> "ruta_id";
            default -> throw new IllegalArgumentException(tipo);
        };
    }
}
