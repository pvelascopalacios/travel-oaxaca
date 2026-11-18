package mx.com.traveloaxaca.ventas.repo;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** SQL de la parte de operación: auditoría, configuración, plantillas de correo y cola de notificaciones. */
@Repository
public class OperacionRepositorio {

    public record AuditoriaFila(long id, String tabla, String registroId, String accion, UUID usuarioId,
                                String usuarioCorreo, String antes, String despues, OffsetDateTime ocurrioEn) {
    }

    public record FiltroAuditoria(String tabla, UUID usuarioId, String accion, String registroId, LocalDate desde,
                                  LocalDate hasta, int limite, int desplazamiento) {
    }

    public record ConfigFila(String clave, String tipo, String valor, BigDecimal minimo, BigDecimal maximo,
                             String descripcion, OffsetDateTime actualizadoEn) {
    }

    public record PlantillaFila(UUID id, String clave, String canal, String idioma, String asunto, String cuerpo,
                                boolean activa, String variables) {
    }

    public record NotificacionFila(UUID id, String plantillaClave, String canal, String destinatario, String estado,
                                   int intentos, String error, OffsetDateTime programadaPara, OffsetDateTime enviadaEn,
                                   OffsetDateTime creadoEn) {
    }

    /** Campos que nunca salen en pantalla aunque algún día se audite una tabla que los tenga. */
    private static final String SENSIBLES = "ARRAY['hash_clave','clave','contrasena','password','token','token_hash','secreto']";

    private static final String SQL_AUDITORIA = """
            SELECT a.id, a.tabla, a.registro_id, a.accion, a.usuario_id, CAST(u.correo AS text) AS usuario_correo,
                   CAST(a.antes - @S@ AS text) AS antes, CAST(a.despues - @S@ AS text) AS despues, a.ocurrio_en
            FROM auditoria a LEFT JOIN usuario u ON u.id = a.usuario_id""".replace("@S@", "CAST(" + SENSIBLES + " AS text[])");

    private static final String SQL_COLA = """
            SELECT n.id, n.plantilla_clave, n.canal, COALESCE(CAST(u.correo AS text), '(negocio)') AS destinatario,
                   n.estado, n.intentos, n.error, n.programada_para, n.enviada_en, n.creado_en
            FROM notificacion n LEFT JOIN usuario u ON u.id = n.usuario_id""";

    private final JdbcClient jdbc;

    public OperacionRepositorio(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    // ---------------- auditoría ----------------

    private static String dondeAuditoria(FiltroAuditoria f, Map<String, Object> p) {
        StringBuilder w = new StringBuilder(" WHERE a.ocurrio_en >= CAST(CAST(:desde AS timestamp) AT TIME ZONE 'America/Mexico_City' AS timestamptz)"
                + " AND a.ocurrio_en < CAST(CAST(:hastaMas AS timestamp) AT TIME ZONE 'America/Mexico_City' AS timestamptz)");
        p.put("desde", f.desde().atStartOfDay());
        p.put("hastaMas", f.hasta().plusDays(1).atStartOfDay());
        if (f.tabla() != null) {
            w.append(" AND a.tabla = :tabla");
            p.put("tabla", f.tabla());
        }
        if (f.usuarioId() != null) {
            w.append(" AND a.usuario_id = :usuario");
            p.put("usuario", f.usuarioId());
        }
        if (f.accion() != null) {
            w.append(" AND a.accion = :accion");
            p.put("accion", f.accion());
        }
        if (f.registroId() != null) {
            w.append(" AND a.registro_id = :registro");
            p.put("registro", f.registroId());
        }
        return w.toString();
    }

    public List<AuditoriaFila> auditoria(FiltroAuditoria f) {
        Map<String, Object> p = new HashMap<>();
        String w = dondeAuditoria(f, p);
        p.put("limite", f.limite());
        p.put("desplazamiento", f.desplazamiento());
        return jdbc.sql(SQL_AUDITORIA + w + " ORDER BY a.ocurrio_en DESC, a.id DESC LIMIT :limite OFFSET :desplazamiento")
                .params(p).query(AuditoriaFila.class).list();
    }

    public long contarAuditoria(FiltroAuditoria f) {
        Map<String, Object> p = new HashMap<>();
        String w = dondeAuditoria(f, p);
        return jdbc.sql("SELECT count(*) FROM auditoria a" + w).params(p).query(Long.class).single();
    }

    // ---------------- configuración ----------------

    public List<ConfigFila> configuracion() {
        return jdbc.sql("""
                SELECT clave, tipo, CAST(valor AS text) AS valor, minimo, maximo, descripcion, actualizado_en
                FROM configuracion ORDER BY clave""").query(ConfigFila.class).list();
    }

    public Optional<ConfigFila> configuracion(String clave) {
        return jdbc.sql("""
                SELECT clave, tipo, CAST(valor AS text) AS valor, minimo, maximo, descripcion, actualizado_en
                FROM configuracion WHERE clave = :c""").param("c", clave).query(ConfigFila.class).optional();
    }

    public void cambiarConfiguracion(String clave, String valorJson, UUID usuarioId) {
        jdbc.sql("UPDATE configuracion SET valor = CAST(:v AS jsonb), actualizado_por = :u WHERE clave = :c")
                .param("v", valorJson).param("u", usuarioId).param("c", clave).update();
    }

    // ---------------- plantillas ----------------

    private static final String SELECT_PLANTILLA = """
            SELECT id, clave, canal, idioma_codigo AS idioma, asunto, cuerpo, activa,
                   array_to_string(variables, ',') AS variables
            FROM notificacion_plantilla""";

    public List<PlantillaFila> plantillas() {
        return jdbc.sql(SELECT_PLANTILLA + "\n ORDER BY clave, canal, idioma_codigo").query(PlantillaFila.class).list();
    }

    public Optional<PlantillaFila> plantilla(UUID id) {
        return jdbc.sql(SELECT_PLANTILLA + "\n WHERE id = :id").param("id", id).query(PlantillaFila.class).optional();
    }

    public void actualizarPlantilla(UUID id, String asunto, String cuerpo, boolean activa) {
        jdbc.sql("UPDATE notificacion_plantilla SET asunto = :a, cuerpo = :c, activa = :v WHERE id = :id")
                .param("a", asunto).param("c", cuerpo).param("v", activa).param("id", id).update();
    }

    // ---------------- cola de notificaciones ----------------

    private static String dondeCola(String estado, String plantilla, Map<String, Object> p) {
        StringBuilder w = new StringBuilder(" WHERE 1 = 1");
        if (estado != null) {
            w.append(" AND n.estado = :estado");
            p.put("estado", estado);
        }
        if (plantilla != null) {
            w.append(" AND n.plantilla_clave = :plantilla");
            p.put("plantilla", plantilla);
        }
        return w.toString();
    }

    public List<NotificacionFila> cola(String estado, String plantilla, int limite, int desplazamiento) {
        Map<String, Object> p = new HashMap<>();
        String w = dondeCola(estado, plantilla, p);
        p.put("limite", limite);
        p.put("desplazamiento", desplazamiento);
        return jdbc.sql(SQL_COLA + w + " ORDER BY n.creado_en DESC LIMIT :limite OFFSET :desplazamiento")
                .params(p).query(NotificacionFila.class).list();
    }

    public long contarCola(String estado, String plantilla) {
        Map<String, Object> p = new HashMap<>();
        String w = dondeCola(estado, plantilla, p);
        return jdbc.sql("SELECT count(*) FROM notificacion n" + w).params(p).query(Long.class).single();
    }

    /** Solo se reintentan las fallidas. Regresa cuántas filas cambiaron (0 si no estaba fallida). */
    public int reintentar(UUID id) {
        return jdbc.sql("""
                UPDATE notificacion SET estado = 'pendiente', intentos = 0, programada_para = now()
                WHERE id = :id AND estado = 'fallida'""").param("id", id).update();
    }

    public boolean notificacionExiste(UUID id) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM notificacion WHERE id = :id)").param("id", id)
                .query(Boolean.class).single();
    }
}
