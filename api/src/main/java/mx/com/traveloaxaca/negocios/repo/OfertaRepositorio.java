package mx.com.traveloaxaca.negocios.repo;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class OfertaRepositorio {

    public record OfertaFila(UUID id, String tipo, String estado, BigDecimal precioDesde, String unidadPrecio,
                             Integer duracionMin, Integer capacidad, int orden, String seccion, String etiquetas) {
    }

    public record TraduccionFila(UUID ofertaId, String idiomaCodigo, String nombre, String descripcion,
                                 String incluye, String noIncluye) {
    }

    private final JdbcClient jdbc;

    public OfertaRepositorio(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<OfertaFila> listar(UUID negocioId) {
        return jdbc.sql("""
                SELECT id, tipo, estado, precio_desde, unidad_precio, duracion_min, capacidad, orden, seccion,
                       array_to_string(etiquetas, ',') AS etiquetas
                FROM oferta WHERE negocio_id = :n AND eliminado_en IS NULL ORDER BY orden, creado_en""")
                .param("n", negocioId).query(OfertaFila.class).list();
    }

    public Optional<OfertaFila> porId(UUID negocioId, UUID ofertaId) {
        return jdbc.sql("""
                SELECT id, tipo, estado, precio_desde, unidad_precio, duracion_min, capacidad, orden, seccion,
                       array_to_string(etiquetas, ',') AS etiquetas
                FROM oferta WHERE negocio_id = :n AND id = :o AND eliminado_en IS NULL""")
                .param("n", negocioId).param("o", ofertaId).query(OfertaFila.class).optional();
    }

    public List<TraduccionFila> traducciones(UUID negocioId) {
        return jdbc.sql("""
                SELECT t.oferta_id, t.idioma_codigo, t.nombre, t.descripcion, t.incluye, t.no_incluye
                FROM oferta_traduccion t JOIN oferta o ON o.id = t.oferta_id
                WHERE o.negocio_id = :n AND o.eliminado_en IS NULL ORDER BY t.oferta_id, t.idioma_codigo""")
                .param("n", negocioId).query(TraduccionFila.class).list();
    }

    public long contar(UUID negocioId) {
        return jdbc.sql("SELECT count(*) FROM oferta WHERE negocio_id = :n AND eliminado_en IS NULL")
                .param("n", negocioId).query(Long.class).single();
    }

    public UUID crear(UUID negocioId, String tipo, BigDecimal precio, String unidad, Integer duracion,
                      Integer capacidad, int orden, String seccion, String etiquetas) {
        return jdbc.sql("""
                INSERT INTO oferta (negocio_id, tipo, precio_desde, unidad_precio, duracion_min, capacidad, orden,
                                    seccion, etiquetas)
                VALUES (:n, :t, :p, :u, :d, :c, :o, :s, COALESCE(string_to_array(NULLIF(:e, ''), ','), '{}'::text[]))
                RETURNING id""")
                .param("n", negocioId).param("t", tipo).param("p", precio).param("u", unidad).param("d", duracion)
                .param("c", capacidad).param("o", orden).param("s", seccion).param("e", etiquetas)
                .query(UUID.class).single();
    }

    public void actualizar(UUID id, String tipo, BigDecimal precio, String unidad, Integer duracion,
                           Integer capacidad, int orden, String seccion, String etiquetas) {
        jdbc.sql("""
                UPDATE oferta SET tipo = :t, precio_desde = :p, unidad_precio = :u, duracion_min = :d,
                       capacidad = :c, orden = :o, seccion = :s,
                       etiquetas = COALESCE(string_to_array(NULLIF(:e, ''), ','), '{}'::text[])
                WHERE id = :id""")
                .param("t", tipo).param("p", precio).param("u", unidad).param("d", duracion).param("c", capacidad)
                .param("o", orden).param("s", seccion).param("e", etiquetas).param("id", id).update();
    }

    public void cambiarEstado(UUID id, String estado) {
        jdbc.sql("UPDATE oferta SET estado = :e WHERE id = :id").param("e", estado).param("id", id).update();
    }

    public void eliminar(UUID id) {
        jdbc.sql("UPDATE oferta SET eliminado_en = now() WHERE id = :id").param("id", id).update();
    }

    public void reemplazarTraducciones(UUID ofertaId, List<TraduccionFila> filas) {
        jdbc.sql("DELETE FROM oferta_traduccion WHERE oferta_id = :o").param("o", ofertaId).update();
        for (TraduccionFila t : filas) {
            jdbc.sql("""
                    INSERT INTO oferta_traduccion (oferta_id, idioma_codigo, nombre, descripcion, incluye, no_incluye)
                    VALUES (:o, :i, :n, :d, :inc, :no)""")
                    .param("o", ofertaId).param("i", t.idiomaCodigo()).param("n", t.nombre())
                    .param("d", t.descripcion()).param("inc", t.incluye()).param("no", t.noIncluye()).update();
        }
    }
}
