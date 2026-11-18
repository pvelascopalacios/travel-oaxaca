package mx.com.traveloaxaca.comercial.repo;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.CuponDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PlanDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PrecioDto;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Planes, precios y cupones. */
@Repository
public class PlanRepositorio {

    private static final String PLAN_COLUMNAS = """
            id, clave, nombre, limite_fotos, limite_ofertas, ve_estadisticas, permite_promociones,
            permite_patrocinio, activo, orden""";

    private static final String PRECIO_SELECT = """
            SELECT pp.id, pp.plan_id, p.clave AS plan_clave, pp.destino_id, pp.categoria_id, pp.periodo, pp.monto,
                   CAST(pp.moneda AS text) AS moneda, pp.vigente_desde, pp.vigente_hasta
            FROM plan_precio pp JOIN plan p ON p.id = pp.plan_id""";

    private static final String CUPON_SELECT = """
            SELECT id, CAST(codigo AS text) AS codigo, descripcion, tipo, valor, aplica_a, max_usos, usos,
                   vigente_desde, vigente_hasta
            FROM cupon""";

    private final JdbcClient jdbc;

    public PlanRepositorio(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    // ---------------- planes ----------------

    public List<PlanDto> planes(boolean soloActivos) {
        return jdbc.sql("SELECT " + PLAN_COLUMNAS + " FROM plan WHERE (:a = false OR activo) ORDER BY orden, clave")
                .param("a", soloActivos).query(PlanDto.class).list();
    }

    public Optional<PlanDto> plan(UUID id) {
        return jdbc.sql("SELECT " + PLAN_COLUMNAS + " FROM plan WHERE id = :id").param("id", id)
                .query(PlanDto.class).optional();
    }

    public Optional<PlanDto> planPorClave(String clave) {
        return jdbc.sql("SELECT " + PLAN_COLUMNAS + " FROM plan WHERE clave = :c").param("c", clave)
                .query(PlanDto.class).optional();
    }

    /** El plan que rige hoy para el negocio (sin suscripción vigente, es el gratuito). */
    public Optional<PlanDto> planDe(UUID negocioId) {
        return jdbc.sql("""
                SELECT p.id, p.clave, p.nombre, p.limite_fotos, p.limite_ofertas, p.ve_estadisticas,
                       p.permite_promociones, p.permite_patrocinio, p.activo, p.orden
                FROM plan_vigente(:n) p WHERE p.id IS NOT NULL""")
                .param("n", negocioId).query(PlanDto.class).optional();
    }

    public void actualizarPlan(UUID id, String nombre, int fotos, int ofertas, boolean estadisticas,
                               boolean promociones, boolean patrocinio, boolean activo, Integer orden) {
        jdbc.sql("""
                UPDATE plan SET nombre = :n, limite_fotos = :f, limite_ofertas = :o, ve_estadisticas = :e,
                       permite_promociones = :pr, permite_patrocinio = :pa, activo = :a, orden = COALESCE(:ord, orden)
                WHERE id = :id""")
                .param("n", nombre).param("f", fotos).param("o", ofertas).param("e", estadisticas)
                .param("pr", promociones).param("pa", patrocinio).param("a", activo).param("ord", orden)
                .param("id", id).update();
    }

    public int fotosEnUso(UUID negocioId) {
        return jdbc.sql("""
                SELECT CAST(count(*) AS integer) FROM negocio_medio nm JOIN medio m ON m.id = nm.medio_id
                WHERE nm.negocio_id = :n AND m.tipo = 'imagen' AND m.eliminado_en IS NULL""")
                .param("n", negocioId).query(Integer.class).single();
    }

    /** Misma regla que el disparador: las archivadas y las eliminadas no cuentan. */
    public int ofertasEnUso(UUID negocioId) {
        return jdbc.sql("""
                SELECT CAST(count(*) AS integer) FROM oferta
                WHERE negocio_id = :n AND eliminado_en IS NULL AND estado <> 'archivada'""")
                .param("n", negocioId).query(Integer.class).single();
    }

    /** Interruptores de la tabla configuracion (verdadero solo si existe y vale true). */
    public boolean interruptor(String clave) {
        return jdbc.sql("""
                SELECT COALESCE((SELECT (valor #>> '{}') = 'true' FROM configuracion WHERE clave = :c), false)""")
                .param("c", clave).query(Boolean.class).single();
    }

    // ---------------- precios ----------------

    public List<PrecioDto> precios(UUID planId, boolean soloVigentes, LocalDate hoy) {
        return jdbc.sql(PRECIO_SELECT + "\n" + """
                 WHERE (CAST(:p AS uuid) IS NULL OR pp.plan_id = :p)
                   AND (:v = false OR (pp.vigente_desde <= :h AND (pp.vigente_hasta IS NULL OR pp.vigente_hasta >= :h)))
                 ORDER BY p.orden, pp.periodo, pp.vigente_desde DESC""")
                .param("p", planId).param("v", soloVigentes).param("h", hoy).query(PrecioDto.class).list();
    }

    public Optional<PrecioDto> precio(UUID id) {
        return jdbc.sql(PRECIO_SELECT + " WHERE pp.id = :id").param("id", id).query(PrecioDto.class).optional();
    }

    /**
     * El precio que le toca a este negocio: el más específico entre los vigentes. Pesa más la categoría
     * (la propia o su categoría madre) que el destino.
     */
    public Optional<PrecioDto> precioPara(UUID negocioId, UUID planId, String periodo, LocalDate hoy) {
        return jdbc.sql(PRECIO_SELECT + "\n" + """
                 JOIN negocio n ON n.id = :n
                 LEFT JOIN categoria c ON c.id = n.categoria_id
                 WHERE pp.plan_id = :p AND pp.periodo = :per
                   AND pp.vigente_desde <= :h AND (pp.vigente_hasta IS NULL OR pp.vigente_hasta >= :h)
                   AND (pp.destino_id IS NULL OR pp.destino_id = n.destino_id)
                   AND (pp.categoria_id IS NULL OR pp.categoria_id = n.categoria_id OR pp.categoria_id = c.padre_id)
                 ORDER BY ((pp.categoria_id IS NOT NULL)::int * 2 + (pp.destino_id IS NOT NULL)::int) DESC,
                          pp.vigente_desde DESC
                 LIMIT 1""")
                .param("n", negocioId).param("p", planId).param("per", periodo).param("h", hoy)
                .query(PrecioDto.class).optional();
    }

    public UUID crearPrecio(UUID planId, UUID destinoId, UUID categoriaId, String periodo, BigDecimal monto,
                            String moneda, LocalDate desde, LocalDate hasta) {
        return jdbc.sql("""
                INSERT INTO plan_precio (plan_id, destino_id, categoria_id, periodo, monto, moneda, vigente_desde, vigente_hasta)
                VALUES (:p, :d, :c, :per, :m, COALESCE(CAST(:mon AS text), 'MXN'), COALESCE(:desde, CURRENT_DATE), :hasta)
                RETURNING id""")
                .param("p", planId).param("d", destinoId).param("c", categoriaId).param("per", periodo)
                .param("m", monto).param("mon", moneda).param("desde", desde).param("hasta", hasta)
                .query(UUID.class).single();
    }

    /** Cierra un precio: deja de regir desde la fecha dada (sin borrar el historial). */
    public void cerrarPrecio(UUID id, LocalDate hasta) {
        jdbc.sql("UPDATE plan_precio SET vigente_hasta = :h WHERE id = :id").param("h", hasta).param("id", id).update();
    }

    // ---------------- cupones ----------------

    public List<CuponDto> cupones() {
        return jdbc.sql(CUPON_SELECT + " ORDER BY creado_en DESC").query(CuponDto.class).list();
    }

    public Optional<CuponDto> cupon(UUID id) {
        return jdbc.sql(CUPON_SELECT + " WHERE id = :id").param("id", id).query(CuponDto.class).optional();
    }

    public boolean codigoDeCuponExiste(String codigo) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM cupon WHERE codigo = CAST(:c AS citext))")
                .param("c", codigo).query(Boolean.class).single();
    }

    public UUID crearCupon(String codigo, String descripcion, String tipo, BigDecimal valor, String aplicaA,
                           Integer maxUsos, LocalDate desde, LocalDate hasta) {
        return jdbc.sql("""
                INSERT INTO cupon (codigo, descripcion, tipo, valor, aplica_a, max_usos, vigente_desde, vigente_hasta)
                VALUES (CAST(:c AS citext), :d, :t, :v, :a, :m, COALESCE(:desde, CURRENT_DATE), :hasta)
                RETURNING id""")
                .param("c", codigo).param("d", descripcion).param("t", tipo).param("v", valor).param("a", aplicaA)
                .param("m", maxUsos).param("desde", desde).param("hasta", hasta).query(UUID.class).single();
    }

    public void actualizarCupon(UUID id, String descripcion, Integer maxUsos, LocalDate hasta) {
        jdbc.sql("UPDATE cupon SET descripcion = :d, max_usos = :m, vigente_hasta = :h WHERE id = :id")
                .param("d", descripcion).param("m", maxUsos).param("h", hasta).param("id", id).update();
    }

    /** Valida y consume un uso. Los errores llegan en español desde la función de la base. */
    public UUID canjear(String codigo, String aplicaA, LocalDate hoy) {
        return jdbc.sql("SELECT canjear_cupon(CAST(:c AS text), CAST(:a AS text), CAST(:h AS date))")
                .param("c", codigo).param("a", aplicaA).param("h", hoy).query(UUID.class).single();
    }
}
