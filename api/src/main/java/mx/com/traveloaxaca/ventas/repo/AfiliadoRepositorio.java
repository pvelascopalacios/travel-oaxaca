package mx.com.traveloaxaca.ventas.repo;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.ClicDiaDto;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** SQL de los enlaces de afiliado y sus clics. */
@Repository
public class AfiliadoRepositorio {

    public record Fila(UUID id, String codigo, String destinoUrl, String socio, BigDecimal comisionPct, String estado,
                       UUID negocioId, long clics30d, OffsetDateTime creadoEn) {
    }

    public record Destino(UUID id, String destinoUrl, UUID negocioId) {
    }

    private static final String SELECT = """
            SELECT a.id, CAST(a.codigo AS text) AS codigo, a.destino_url, a.socio, a.comision_pct, a.estado,
                   a.negocio_id, (SELECT count(*) FROM clic_afiliado c WHERE c.enlace_id = a.id AND c.dia >= :desde)
                   AS clics30d, a.creado_en
            FROM enlace_afiliado a""";

    private final JdbcClient jdbc;

    public AfiliadoRepositorio(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<Fila> listar(LocalDate desde) {
        return jdbc.sql(SELECT + "\n ORDER BY a.creado_en DESC").param("desde", desde).query(Fila.class).list();
    }

    public Optional<Fila> porId(UUID id, LocalDate desde) {
        return jdbc.sql(SELECT + "\n WHERE a.id = :id").param("desde", desde).param("id", id).query(Fila.class).optional();
    }

    public boolean codigoExiste(String codigo, UUID excluir) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM enlace_afiliado WHERE codigo = CAST(:c AS citext) AND id <> CAST(:x AS uuid))")
                .param("c", codigo).param("x", excluir == null ? new UUID(0, 0) : excluir).query(Boolean.class).single();
    }

    public boolean negocioExiste(UUID id) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM negocio WHERE id = :id AND eliminado_en IS NULL)").param("id", id)
                .query(Boolean.class).single();
    }

    public UUID crear(String codigo, String url, String socio, BigDecimal comision, String estado, UUID negocioId) {
        return jdbc.sql("""
                INSERT INTO enlace_afiliado (codigo, destino_url, socio, comision_pct, estado, negocio_id)
                VALUES (CAST(:c AS citext), :u, :s, :p, :e, :n) RETURNING id""")
                .param("c", codigo).param("u", url).param("s", socio).param("p", comision).param("e", estado)
                .param("n", negocioId).query(UUID.class).single();
    }

    public void actualizar(UUID id, String codigo, String url, String socio, BigDecimal comision, String estado,
                           UUID negocioId) {
        jdbc.sql("""
                UPDATE enlace_afiliado SET codigo = CAST(:c AS citext), destino_url = :u, socio = :s,
                       comision_pct = :p, estado = :e, negocio_id = :n WHERE id = :id""")
                .param("c", codigo).param("u", url).param("s", socio).param("p", comision).param("e", estado)
                .param("n", negocioId).param("id", id).update();
    }

    public Optional<Destino> activoPorCodigo(String codigo) {
        return jdbc.sql("""
                SELECT id, destino_url, negocio_id FROM enlace_afiliado
                WHERE codigo = CAST(:c AS citext) AND estado = 'activo'""")
                .param("c", codigo).query(Destino.class).optional();
    }

    public boolean dispositivoExiste(UUID id) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM dispositivo WHERE id = :id)").param("id", id)
                .query(Boolean.class).single();
    }

    public void registrarClic(UUID enlaceId, UUID dispositivoId, String origen) {
        jdbc.sql("INSERT INTO clic_afiliado (enlace_id, dispositivo_id, origen) VALUES (:e, :d, :o)")
                .param("e", enlaceId).param("d", dispositivoId).param("o", origen).update();
    }

    public List<ClicDiaDto> clicsPorDia(UUID enlaceId, LocalDate desde, LocalDate hasta) {
        return jdbc.sql("""
                SELECT dia, count(*) AS clics FROM clic_afiliado
                WHERE enlace_id = :e AND dia BETWEEN :d AND :h GROUP BY dia ORDER BY dia""")
                .param("e", enlaceId).param("d", desde).param("h", hasta).query(ClicDiaDto.class).list();
    }
}
