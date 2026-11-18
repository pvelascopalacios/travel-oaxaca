package mx.com.traveloaxaca.comunidad.repo;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class ListaRepositorio {

    public record ListaFila(UUID id, UUID usuarioId, String nombre, boolean esItinerario, LocalDate fechaInicio,
                            LocalDate fechaFin, boolean publica, int totalElementos, OffsetDateTime creadoEn,
                            String autorNombre) {
    }

    public record ItemFila(UUID itemId, String tipo, UUID id, String slug, String nombre, Integer dia, int orden,
                           String nota, String imagenClave) {
    }

    private static final String SELECT = """
            SELECT l.id, l.usuario_id, l.nombre, l.es_itinerario, l.fecha_inicio, l.fecha_fin, l.publica,
                   CAST((SELECT count(*) FROM lista_item i WHERE i.lista_id = l.id) AS integer) AS total_elementos,
                   l.creado_en, u.nombre AS autor_nombre
            FROM lista l JOIN usuario u ON u.id = l.usuario_id
            """;

    private final JdbcClient jdbc;

    public ListaRepositorio(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<ListaFila> deUsuario(UUID usuarioId) {
        return jdbc.sql(SELECT + " WHERE l.usuario_id = :u AND l.eliminado_en IS NULL ORDER BY l.actualizado_en DESC, l.id")
                .param("u", usuarioId).query(ListaFila.class).list();
    }

    public int contarDeUsuario(UUID usuarioId) {
        return jdbc.sql("SELECT CAST(count(*) AS integer) FROM lista WHERE usuario_id = :u AND eliminado_en IS NULL")
                .param("u", usuarioId).query(Integer.class).single();
    }

    public Optional<ListaFila> porId(UUID id) {
        return jdbc.sql(SELECT + " WHERE l.id = :id AND l.eliminado_en IS NULL")
                .param("id", id).query(ListaFila.class).optional();
    }

    /** Bloquea la lista mientras se agregan elementos, para respetar el máximo aun con peticiones simultáneas. */
    public Optional<UUID> bloquear(UUID id, UUID usuarioId) {
        return jdbc.sql("SELECT id FROM lista WHERE id = :id AND usuario_id = :u AND eliminado_en IS NULL FOR UPDATE")
                .param("id", id).param("u", usuarioId).query(UUID.class).optional();
    }

    public UUID crear(UUID usuarioId, String nombre, boolean esItinerario, LocalDate inicio, LocalDate fin, boolean publica) {
        return jdbc.sql("""
                INSERT INTO lista (usuario_id, nombre, es_itinerario, fecha_inicio, fecha_fin, publica)
                VALUES (:u, :n, :i, :fi, :ff, :p) RETURNING id""")
                .param("u", usuarioId).param("n", nombre).param("i", esItinerario).param("fi", inicio)
                .param("ff", fin).param("p", publica).query(UUID.class).single();
    }

    public void actualizar(UUID id, String nombre, boolean esItinerario, LocalDate inicio, LocalDate fin, boolean publica) {
        jdbc.sql("""
                UPDATE lista SET nombre = :n, es_itinerario = :i, fecha_inicio = :fi, fecha_fin = :ff, publica = :p
                WHERE id = :id""")
                .param("n", nombre).param("i", esItinerario).param("fi", inicio).param("ff", fin)
                .param("p", publica).param("id", id).update();
    }

    public void eliminar(UUID id) {
        jdbc.sql("UPDATE lista SET eliminado_en = now() WHERE id = :id").param("id", id).update();
    }

    public void tocar(UUID id) {
        jdbc.sql("UPDATE lista SET actualizado_en = now() WHERE id = :id").param("id", id).update();
    }

    public int contarItems(UUID listaId) {
        return jdbc.sql("SELECT CAST(count(*) AS integer) FROM lista_item WHERE lista_id = :l")
                .param("l", listaId).query(Integer.class).single();
    }

    public int siguienteOrden(UUID listaId, Integer dia) {
        return jdbc.sql("""
                SELECT COALESCE(max(orden), -1) + 1 FROM lista_item
                WHERE lista_id = :l AND COALESCE(dia, 0) = COALESCE(CAST(:d AS integer), 0)""")
                .param("l", listaId).param("d", dia).query(Integer.class).single();
    }

    public boolean yaEsta(UUID listaId, String tipo, UUID id, Integer dia) {
        String col = switch (tipo) {
            case "negocio" -> "negocio_id";
            case "lugar" -> "lugar_id";
            case "ruta" -> "ruta_id";
            default -> throw new IllegalArgumentException(tipo);
        };
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM lista_item WHERE lista_id = :l AND " + col
                + " = :id AND COALESCE(dia, 0) = COALESCE(CAST(:d AS integer), 0))")
                .param("l", listaId).param("id", id).param("d", dia).query(Boolean.class).single();
    }

    public UUID agregarItem(UUID listaId, String tipo, UUID id, Integer dia, int orden, String nota) {
        String col = switch (tipo) {
            case "negocio" -> "negocio_id";
            case "lugar" -> "lugar_id";
            case "ruta" -> "ruta_id";
            default -> throw new IllegalArgumentException(tipo);
        };
        return jdbc.sql("INSERT INTO lista_item (lista_id, " + col + ", dia, orden, nota) VALUES (:l, :id, :d, :o, :n) RETURNING id")
                .param("l", listaId).param("id", id).param("d", dia).param("o", orden).param("n", nota)
                .query(UUID.class).single();
    }

    public boolean actualizarItem(UUID listaId, UUID itemId, Integer dia, Integer orden, String nota) {
        return jdbc.sql("""
                UPDATE lista_item SET dia = :d, orden = COALESCE(:o, orden), nota = :n
                WHERE id = :i AND lista_id = :l""")
                .param("d", dia).param("o", orden).param("n", nota).param("i", itemId).param("l", listaId).update() > 0;
    }

    public boolean quitarItem(UUID listaId, UUID itemId) {
        return jdbc.sql("DELETE FROM lista_item WHERE id = :i AND lista_id = :l")
                .param("i", itemId).param("l", listaId).update() > 0;
    }

    /** Elementos que siguen publicados, en orden de día y posición. */
    public List<ItemFila> items(UUID listaId, String idioma) {
        return jdbc.sql("""
                SELECT item_id, tipo, id, slug, nombre, dia, orden, nota, imagen_clave FROM (
                  SELECT i.id AS item_id, 'negocio' AS tipo, n.id, n.slug, n.nombre_comercial AS nombre, i.dia, i.orden,
                         i.nota, i.creado_en,
                         (SELECT me.clave_almacenamiento FROM negocio_medio nm JOIN medio me ON me.id = nm.medio_id
                           WHERE nm.negocio_id = n.id AND me.tipo = 'imagen' AND me.moderacion = 'aprobado' AND me.eliminado_en IS NULL
                           ORDER BY nm.es_portada DESC, nm.orden, nm.creado_en LIMIT 1) AS imagen_clave
                  FROM lista_item i JOIN negocio n ON n.id = i.negocio_id AND n.estado = 'publicada' AND n.eliminado_en IS NULL
                  WHERE i.lista_id = :l
                  UNION ALL
                  SELECT i.id, 'lugar', l.id, l.slug, COALESCE(t.nombre, te.nombre), i.dia, i.orden, i.nota, i.creado_en,
                         (SELECT me.clave_almacenamiento FROM lugar_medio lm JOIN medio me ON me.id = lm.medio_id
                           WHERE lm.lugar_id = l.id AND me.tipo = 'imagen' AND me.moderacion = 'aprobado' AND me.eliminado_en IS NULL
                           ORDER BY lm.orden, lm.creado_en LIMIT 1)
                  FROM lista_item i JOIN lugar l ON l.id = i.lugar_id AND l.estado = 'publicado' AND l.eliminado_en IS NULL
                  LEFT JOIN lugar_traduccion t ON t.lugar_id = l.id AND t.idioma_codigo = :i
                  JOIN lugar_traduccion te ON te.lugar_id = l.id AND te.idioma_codigo = 'es'
                  WHERE i.lista_id = :l
                  UNION ALL
                  SELECT i.id, 'ruta', r.id, r.slug, COALESCE(t.nombre, te.nombre), i.dia, i.orden, i.nota, i.creado_en,
                         CAST(NULL AS text)
                  FROM lista_item i JOIN ruta r ON r.id = i.ruta_id AND r.estado = 'publicada' AND r.eliminado_en IS NULL
                  LEFT JOIN ruta_traduccion t ON t.ruta_id = r.id AND t.idioma_codigo = :i
                  JOIN ruta_traduccion te ON te.ruta_id = r.id AND te.idioma_codigo = 'es'
                  WHERE i.lista_id = :l
                ) x ORDER BY COALESCE(dia, 0), orden, creado_en, item_id""")
                .param("l", listaId).param("i", idioma).query(ItemFila.class).list();
    }
}
