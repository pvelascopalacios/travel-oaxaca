package mx.com.traveloaxaca.negocios.repo;

import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class MedioRepositorio {

    /** `hash` solo se llena al confirmar la subida: sirve para saber si el archivo ya fue verificado. */
    public record MedioFila(UUID id, String tipo, String claveAlmacenamiento, String mime, Long bytes, Integer ancho,
                            Integer alto, String hash, UUID subidoPor, String moderacion) {
    }

    private final JdbcClient jdbc;

    public MedioRepositorio(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void crear(UUID id, String clave, String mime, long bytes, UUID subidoPor) {
        jdbc.sql("""
                INSERT INTO medio (id, tipo, clave_almacenamiento, mime, bytes, subido_por)
                VALUES (:id, 'imagen', :c, :m, :b, :u)""")
                .param("id", id).param("c", clave).param("m", mime).param("b", bytes).param("u", subidoPor).update();
    }

    public Optional<MedioFila> porId(UUID id) {
        return jdbc.sql("""
                SELECT id, tipo, clave_almacenamiento, mime, bytes, ancho, alto, hash, subido_por, moderacion
                FROM medio WHERE id = :id AND eliminado_en IS NULL""")
                .param("id", id).query(MedioFila.class).optional();
    }

    public void confirmar(UUID id, String mime, long bytes, int ancho, int alto, String hash) {
        jdbc.sql("UPDATE medio SET mime = :m, bytes = :b, ancho = :a, alto = :l, hash = :h WHERE id = :id")
                .param("m", mime).param("b", bytes).param("a", ancho).param("l", alto).param("h", hash)
                .param("id", id).update();
    }

    public void marcarEliminado(UUID id) {
        jdbc.sql("UPDATE medio SET eliminado_en = now() WHERE id = :id").param("id", id).update();
    }
}
