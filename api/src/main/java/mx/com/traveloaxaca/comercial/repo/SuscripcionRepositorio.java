package mx.com.traveloaxaca.comercial.repo;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PagoDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.SuscripcionDto;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Suscripciones y pagos registrados a mano. */
@Repository
public class SuscripcionRepositorio {

    /** La suscripción vigente tal como está en la tabla (para decidir renovar o cambiar). */
    public record Vigente(UUID id, UUID planId, String estado, LocalDate inicio, LocalDate fin, UUID planPrecioId) {
    }

    public record CuponAplicado(UUID id, String tipo, BigDecimal valor) {
    }

    private static final String SUSCRIPCION_SELECT = """
            SELECT s.id, s.negocio_id, p.clave AS plan_clave, p.nombre AS plan_nombre, s.estado, s.inicio, s.fin,
                   s.gracia_hasta, pp.periodo, pp.monto, s.cancelada_en, s.motivo_cancelacion
            FROM suscripcion s
            JOIN plan p ON p.id = s.plan_id
            LEFT JOIN plan_precio pp ON pp.id = s.plan_precio_id""";

    private static final String PAGO_SELECT = """
            SELECT id, negocio_id, concepto, suscripcion_id, patrocinio_id, monto, CAST(moneda AS text) AS moneda,
                   metodo, referencia_externa, estado, pagado_en, creado_en
            FROM pago""";

    private final JdbcClient jdbc;

    public SuscripcionRepositorio(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<Vigente> vigente(UUID negocioId) {
        return jdbc.sql("""
                SELECT id, plan_id, estado, inicio, fin, plan_precio_id FROM suscripcion
                WHERE negocio_id = :n AND estado IN ('activa','gracia') FOR UPDATE""")
                .param("n", negocioId).query(Vigente.class).optional();
    }

    public Optional<SuscripcionDto> vigenteDto(UUID negocioId) {
        return jdbc.sql(SUSCRIPCION_SELECT + " WHERE s.negocio_id = :n AND s.estado IN ('activa','gracia')")
                .param("n", negocioId).query(SuscripcionDto.class).optional();
    }

    public Optional<SuscripcionDto> porId(UUID id) {
        return jdbc.sql(SUSCRIPCION_SELECT + " WHERE s.id = :id").param("id", id).query(SuscripcionDto.class).optional();
    }

    public List<SuscripcionDto> deNegocio(UUID negocioId) {
        return jdbc.sql(SUSCRIPCION_SELECT + " WHERE s.negocio_id = :n ORDER BY s.fin DESC, s.creado_en DESC")
                .param("n", negocioId).query(SuscripcionDto.class).list();
    }

    public UUID crear(UUID negocioId, UUID planId, UUID precioId, LocalDate inicio, LocalDate fin) {
        return jdbc.sql("""
                INSERT INTO suscripcion (negocio_id, plan_id, plan_precio_id, estado, inicio, fin)
                VALUES (:n, :p, :pp, 'activa', :i, :f) RETURNING id""")
                .param("n", negocioId).param("p", planId).param("pp", precioId).param("i", inicio).param("f", fin)
                .query(UUID.class).single();
    }

    /** Renovación del mismo plan: se alarga el fin y, si estaba en gracia, vuelve a activa. */
    public void extender(UUID id, LocalDate nuevoFin, UUID precioId) {
        jdbc.sql("""
                UPDATE suscripcion SET fin = :f, estado = 'activa', gracia_hasta = NULL, plan_precio_id = :pp
                WHERE id = :id""")
                .param("f", nuevoFin).param("pp", precioId).param("id", id).update();
    }

    public void cancelar(UUID id, String motivo) {
        jdbc.sql("""
                UPDATE suscripcion SET estado = 'cancelada', cancelada_en = now(), motivo_cancelacion = :m
                WHERE id = :id""")
                .param("m", motivo).param("id", id).update();
    }

    public Optional<CuponAplicado> cupon(UUID id) {
        return jdbc.sql("SELECT id, tipo, valor FROM cupon WHERE id = :id").param("id", id)
                .query(CuponAplicado.class).optional();
    }

    // ---------------- pagos ----------------

    public UUID crearPago(UUID negocioId, String concepto, UUID suscripcionId, UUID patrocinioId, UUID cuponId,
                          BigDecimal monto, String metodo, String referencia, boolean pagado, UUID registradoPor) {
        return jdbc.sql("""
                INSERT INTO pago (negocio_id, concepto, suscripcion_id, patrocinio_id, cupon_id, monto, metodo,
                                  referencia_externa, proveedor, estado, pagado_en, registrado_por)
                VALUES (:n, :c, :s, :pa, :cu, :m, :me, :r, CASE WHEN CAST(:r AS text) IS NULL THEN NULL ELSE 'manual' END,
                        CASE WHEN :pg THEN 'pagado' ELSE 'pendiente' END,
                        CASE WHEN :pg THEN now() END, :u)
                RETURNING id""")
                .param("n", negocioId).param("c", concepto).param("s", suscripcionId).param("pa", patrocinioId)
                .param("cu", cuponId).param("m", monto).param("me", metodo).param("r", referencia).param("pg", pagado)
                .param("u", registradoPor).query(UUID.class).single();
    }

    public Optional<PagoDto> pago(UUID id) {
        return jdbc.sql(PAGO_SELECT + " WHERE id = :id").param("id", id).query(PagoDto.class).optional();
    }

    public Optional<PagoDto> pagoBloqueado(UUID id) {
        return jdbc.sql(PAGO_SELECT + " WHERE id = :id FOR UPDATE").param("id", id).query(PagoDto.class).optional();
    }

    public List<PagoDto> pagosDeNegocio(UUID negocioId) {
        return jdbc.sql(PAGO_SELECT + " WHERE negocio_id = :n ORDER BY creado_en DESC LIMIT 200")
                .param("n", negocioId).query(PagoDto.class).list();
    }

    public List<PagoDto> pagosPendientes() {
        return jdbc.sql(PAGO_SELECT + " WHERE estado = 'pendiente' ORDER BY creado_en LIMIT 200")
                .query(PagoDto.class).list();
    }

    public void cambiarEstadoPago(UUID id, String estado, String referencia) {
        jdbc.sql("""
                UPDATE pago SET estado = :e,
                       pagado_en = CASE WHEN CAST(:e AS text) IN ('pagado','reembolsado') THEN COALESCE(pagado_en, now()) ELSE pagado_en END,
                       referencia_externa = COALESCE(CAST(:r AS text), referencia_externa),
                       proveedor = CASE WHEN CAST(:r AS text) IS NOT NULL AND proveedor IS NULL THEN 'manual' ELSE proveedor END
                WHERE id = :id""")
                .param("e", estado).param("r", referencia).param("id", id).update();
    }

    public void ligarPagoAPatrocinio(UUID patrocinioId, UUID pagoId) {
        jdbc.sql("UPDATE patrocinio SET pago_id = :p WHERE id = :id").param("p", pagoId).param("id", patrocinioId).update();
    }
}
