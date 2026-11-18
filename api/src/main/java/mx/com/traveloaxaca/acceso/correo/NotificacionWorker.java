package mx.com.traveloaxaca.acceso.correo;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Cada 10 segundos toma los correos pendientes, les llena la plantilla y los manda.
 * Si falla, reintenta a los 5 minutos; al quinto intento queda como 'fallida'.
 * SKIP LOCKED permite que corran varias copias de la API sin mandar el mismo correo dos veces.
 */
@Component
@ConditionalOnProperty(name = "app.correo.worker", havingValue = "true", matchIfMissing = true)
public class NotificacionWorker {

    private static final Logger log = LoggerFactory.getLogger(NotificacionWorker.class);
    private static final int MAX_INTENTOS = 5;

    record Pendiente(UUID id, String plantillaClave, String datos, int intentos, String correo, String nombre,
                     String idiomaCodigo) {
    }

    record Plantilla(String asunto, String cuerpo) {
    }

    private final JdbcClient jdbc;
    private final TransactionTemplate tx;
    private final EnviadorCorreo enviador;
    private final ObjectMapper json;

    public NotificacionWorker(JdbcClient jdbc, TransactionTemplate tx, EnviadorCorreo enviador, ObjectMapper json) {
        this.jdbc = jdbc;
        this.tx = tx;
        this.enviador = enviador;
        this.json = json;
    }

    @Scheduled(fixedDelay = 10_000, initialDelay = 15_000)
    public void procesar() {
        try {
            tx.executeWithoutResult(st -> {
                List<Pendiente> lote = jdbc.sql("""
                        SELECT n.id, n.plantilla_clave, n.datos::text AS datos, n.intentos,
                               u.correo::text AS correo, u.nombre, u.idioma_codigo
                        FROM notificacion n JOIN usuario u ON u.id = n.usuario_id
                        WHERE n.estado = 'pendiente' AND n.canal = 'correo' AND n.programada_para <= now()
                        ORDER BY n.programada_para LIMIT 10
                        FOR UPDATE OF n SKIP LOCKED""").query(Pendiente.class).list();
                for (Pendiente p : lote) {
                    enviarUno(p);
                }
            });
        } catch (RuntimeException e) {
            log.error("Falló el ciclo de envío de correos", e);
        }
    }

    private void enviarUno(Pendiente p) {
        try {
            Plantilla pl = plantilla(p.plantillaClave(), p.idiomaCodigo());
            Map<String, String> datos = json.readValue(p.datos(), new TypeReference<Map<String, String>>() {
            });
            String asunto = llenar(pl.asunto(), datos);
            String cuerpo = llenar(pl.cuerpo(), datos);
            enviador.enviar(p.correo(), asunto, cuerpo);
            jdbc.sql("""
                    UPDATE notificacion SET estado = 'enviada', enviada_en = now(), intentos = intentos + 1, error = NULL
                    WHERE id = :id""").param("id", p.id()).update();
        } catch (Exception e) {
            int intento = p.intentos() + 1;
            boolean definitivo = intento >= MAX_INTENTOS;
            log.warn("No se pudo enviar la notificación {} (intento {}): {}", p.id(), intento, e.toString());
            String msg = String.valueOf(e.getMessage());
            jdbc.sql("""
                    UPDATE notificacion SET intentos = :i, error = :e,
                           estado = CASE WHEN :def THEN 'fallida' ELSE 'pendiente' END,
                           programada_para = now() + interval '5 minutes'
                    WHERE id = :id""")
                    .param("i", intento).param("e", msg.substring(0, Math.min(msg.length(), 500)))
                    .param("def", definitivo).param("id", p.id()).update();
        }
    }

    private Plantilla plantilla(String clave, String idioma) {
        return jdbc.sql("""
                SELECT asunto, cuerpo FROM notificacion_plantilla
                WHERE clave = :c AND canal = 'correo' AND activa AND idioma_codigo IN (:i, 'es')
                ORDER BY (idioma_codigo = :i) DESC LIMIT 1""")
                .param("c", clave).param("i", idioma).query(Plantilla.class).optional()
                .orElseThrow(() -> new IllegalStateException("No existe la plantilla de correo " + clave));
    }

    static String llenar(String texto, Map<String, String> datos) {
        String r = texto;
        for (Map.Entry<String, String> e : datos.entrySet()) {
            r = r.replace("{{" + e.getKey() + "}}", e.getValue() == null ? "" : e.getValue());
        }
        return r;
    }
}
