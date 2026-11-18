package mx.com.traveloaxaca.comercial.repo;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PromocionTextoDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.VerificacionDto;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Promociones de los negocios, su revisión y las verificaciones de identidad. */
@Repository
public class PromocionRepositorio {

    public record PromocionFila(UUID id, UUID negocioId, UUID ofertaId, String tipo, BigDecimal valor, String codigo,
                                LocalDate inicio, LocalDate fin, String condiciones, String estado,
                                String motivoRechazo) {
    }

    public record ColaFila(UUID id, UUID negocioId, UUID ofertaId, String tipo, BigDecimal valor, String codigo,
                           LocalDate inicio, LocalDate fin, String condiciones, String estado, String motivoRechazo,
                           String negocioNombre, OffsetDateTime enviadaEn) {
    }

    public record PublicaFila(UUID id, String tipo, BigDecimal valor, String codigo, LocalDate inicio, LocalDate fin,
                              String titulo, String descripcion, String condiciones, UUID ofertaId) {
    }

    public record Persona(UUID usuarioId, String nombre) {
    }

    private static final String SELECT = """
            SELECT id, negocio_id, oferta_id, tipo, valor, CAST(codigo AS text) AS codigo, inicio, fin, condiciones,
                   estado, motivo_rechazo
            FROM promocion""";

    private final JdbcClient jdbc;

    public PromocionRepositorio(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<PromocionFila> deNegocio(UUID negocioId) {
        return jdbc.sql(SELECT + " WHERE negocio_id = :n AND eliminado_en IS NULL ORDER BY inicio DESC, creado_en DESC")
                .param("n", negocioId).query(PromocionFila.class).list();
    }

    public Optional<PromocionFila> porId(UUID id) {
        return jdbc.sql(SELECT + " WHERE id = :id AND eliminado_en IS NULL").param("id", id)
                .query(PromocionFila.class).optional();
    }

    public Optional<PromocionFila> bloquear(UUID id) {
        return jdbc.sql(SELECT + " WHERE id = :id AND eliminado_en IS NULL FOR UPDATE").param("id", id)
                .query(PromocionFila.class).optional();
    }

    public List<PromocionTextoDto> textos(UUID promocionId) {
        return jdbc.sql("""
                SELECT idioma_codigo AS idioma, titulo, descripcion FROM promocion_traduccion
                WHERE promocion_id = :p ORDER BY idioma_codigo""")
                .param("p", promocionId).query(PromocionTextoDto.class).list();
    }

    public boolean ofertaEsDelNegocio(UUID ofertaId, UUID negocioId) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM oferta WHERE id = :o AND negocio_id = :n AND eliminado_en IS NULL)")
                .param("o", ofertaId).param("n", negocioId).query(Boolean.class).single();
    }

    public boolean idiomaExiste(String codigo) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM idioma WHERE codigo = :c)").param("c", codigo)
                .query(Boolean.class).single();
    }

    public boolean codigoEnUso(UUID negocioId, String codigo, UUID exceptoId) {
        return jdbc.sql("""
                SELECT EXISTS (SELECT 1 FROM promocion WHERE negocio_id = :n AND codigo = CAST(:c AS citext)
                               AND eliminado_en IS NULL AND (CAST(:x AS uuid) IS NULL OR id <> :x))""")
                .param("n", negocioId).param("c", codigo).param("x", exceptoId).query(Boolean.class).single();
    }

    public UUID crear(UUID negocioId, UUID ofertaId, String tipo, BigDecimal valor, String codigo, LocalDate inicio,
                      LocalDate fin, String condiciones) {
        return jdbc.sql("""
                INSERT INTO promocion (negocio_id, oferta_id, tipo, valor, codigo, inicio, fin, condiciones)
                VALUES (:n, :o, :t, :v, CAST(:c AS citext), :i, :f, :cond) RETURNING id""")
                .param("n", negocioId).param("o", ofertaId).param("t", tipo).param("v", valor).param("c", codigo)
                .param("i", inicio).param("f", fin).param("cond", condiciones).query(UUID.class).single();
    }

    public void actualizar(UUID id, UUID ofertaId, String tipo, BigDecimal valor, String codigo, LocalDate inicio,
                           LocalDate fin, String condiciones) {
        jdbc.sql("""
                UPDATE promocion SET oferta_id = :o, tipo = :t, valor = :v, codigo = CAST(:c AS citext), inicio = :i,
                       fin = :f, condiciones = :cond, motivo_rechazo = NULL
                WHERE id = :id""")
                .param("o", ofertaId).param("t", tipo).param("v", valor).param("c", codigo).param("i", inicio)
                .param("f", fin).param("cond", condiciones).param("id", id).update();
    }

    public void reemplazarTextos(UUID promocionId, List<PromocionTextoDto> textos) {
        jdbc.sql("DELETE FROM promocion_traduccion WHERE promocion_id = :p").param("p", promocionId).update();
        for (PromocionTextoDto t : textos) {
            jdbc.sql("""
                    INSERT INTO promocion_traduccion (promocion_id, idioma_codigo, titulo, descripcion)
                    VALUES (:p, :i, :t, :d)""")
                    .param("p", promocionId).param("i", t.idioma()).param("t", t.titulo().trim())
                    .param("d", t.descripcion() == null || t.descripcion().isBlank() ? null : t.descripcion().trim())
                    .update();
        }
    }

    public void cambiarEstado(UUID id, String estado) {
        jdbc.sql("UPDATE promocion SET estado = :e WHERE id = :id").param("e", estado).param("id", id).update();
    }

    public void aprobar(UUID id, UUID revisor) {
        jdbc.sql("""
                UPDATE promocion SET estado = 'activa', revisada_por = :r, revisada_en = now(), motivo_rechazo = NULL
                WHERE id = :id""").param("r", revisor).param("id", id).update();
    }

    /** Un rechazo regresa la promoción a borrador con el motivo, para que el dueño la corrija y la reenvíe. */
    public void rechazar(UUID id, UUID revisor, String motivo) {
        jdbc.sql("""
                UPDATE promocion SET estado = 'borrador', revisada_por = :r, revisada_en = now(), motivo_rechazo = :m
                WHERE id = :id""").param("r", revisor).param("m", motivo).param("id", id).update();
    }

    public void eliminar(UUID id) {
        jdbc.sql("UPDATE promocion SET eliminado_en = now() WHERE id = :id").param("id", id).update();
    }

    public long contarEnCola(UUID negocioId) {
        return jdbc.sql("""
                SELECT count(*) FROM promocion WHERE estado = 'en_revision' AND eliminado_en IS NULL
                  AND (CAST(:n AS uuid) IS NULL OR negocio_id = :n)""")
                .param("n", negocioId).query(Long.class).single();
    }

    public List<ColaFila> cola(UUID negocioId, int limite, int desplazamiento) {
        return jdbc.sql("""
                SELECT p.id, p.negocio_id, p.oferta_id, p.tipo, p.valor, CAST(p.codigo AS text) AS codigo, p.inicio, p.fin,
                       p.condiciones, p.estado, p.motivo_rechazo, n.nombre_comercial AS negocio_nombre,
                       p.actualizado_en AS enviada_en
                FROM promocion p JOIN negocio n ON n.id = p.negocio_id
                WHERE p.estado = 'en_revision' AND p.eliminado_en IS NULL
                  AND (CAST(:n AS uuid) IS NULL OR p.negocio_id = :n)
                ORDER BY p.actualizado_en LIMIT :l OFFSET :o""")
                .param("n", negocioId).param("l", limite).param("o", desplazamiento).query(ColaFila.class).list();
    }

    public Optional<Persona> propietario(UUID negocioId) {
        return jdbc.sql("""
                SELECT u.id AS usuario_id, u.nombre
                FROM membresia_negocio m JOIN usuario u ON u.id = m.usuario_id
                WHERE m.negocio_id = :n AND m.rol = 'propietario' AND m.estado = 'activa'
                ORDER BY m.creado_en LIMIT 1""")
                .param("n", negocioId).query(Persona.class).optional();
    }

    public Optional<String> nombreNegocio(UUID negocioId) {
        return jdbc.sql("SELECT nombre_comercial FROM negocio WHERE id = :n").param("n", negocioId)
                .query(String.class).optional();
    }

    /** Promociones activas y dentro de fechas, con el texto en el idioma pedido (o en español). */
    public List<PublicaFila> vigentes(UUID negocioId, String idioma, LocalDate hoy) {
        return jdbc.sql("""
                SELECT p.id, p.tipo, p.valor, CAST(p.codigo AS text) AS codigo, p.inicio, p.fin,
                       COALESCE(t.titulo, te.titulo) AS titulo, COALESCE(t.descripcion, te.descripcion) AS descripcion,
                       p.condiciones, p.oferta_id
                FROM promocion p
                LEFT JOIN promocion_traduccion t ON t.promocion_id = p.id AND t.idioma_codigo = :i
                JOIN promocion_traduccion te ON te.promocion_id = p.id AND te.idioma_codigo = 'es'
                WHERE p.negocio_id = :n AND p.estado = 'activa' AND p.eliminado_en IS NULL
                  AND CAST(:h AS date) BETWEEN p.inicio AND p.fin
                ORDER BY p.fin, p.inicio""")
                .param("n", negocioId).param("i", idioma).param("h", hoy).query(PublicaFila.class).list();
    }

    // ---------------- verificaciones ----------------

    public UUID registrarVerificacion(UUID negocioId, String metodo, String resultado, String notas,
                                      OffsetDateTime vigenteHasta, UUID evidenciaMedioId, UUID por) {
        return jdbc.sql("""
                INSERT INTO verificacion (negocio_id, metodo, resultado, notas, vigente_hasta, evidencia_medio_id, verificada_por)
                VALUES (:n, :m, :r, :no, :v, :e, :u) RETURNING id""")
                .param("n", negocioId).param("m", metodo).param("r", resultado).param("no", notas)
                .param("v", vigenteHasta).param("e", evidenciaMedioId).param("u", por).query(UUID.class).single();
    }

    public List<VerificacionDto> verificaciones(UUID negocioId) {
        return jdbc.sql("""
                SELECT v.id, v.negocio_id, v.metodo, v.resultado, v.notas, v.fecha, v.vigente_hasta,
                       u.nombre AS verificada_por_nombre
                FROM verificacion v JOIN usuario u ON u.id = v.verificada_por
                WHERE v.negocio_id = :n ORDER BY v.fecha DESC LIMIT 50""")
                .param("n", negocioId).query(VerificacionDto.class).list();
    }

    public Optional<VerificacionDto> verificacion(UUID id) {
        return jdbc.sql("""
                SELECT v.id, v.negocio_id, v.metodo, v.resultado, v.notas, v.fecha, v.vigente_hasta,
                       u.nombre AS verificada_por_nombre
                FROM verificacion v JOIN usuario u ON u.id = v.verificada_por WHERE v.id = :id""")
                .param("id", id).query(VerificacionDto.class).optional();
    }

    public boolean medioExiste(UUID medioId) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM medio WHERE id = :m AND eliminado_en IS NULL)")
                .param("m", medioId).query(Boolean.class).single();
    }
}
