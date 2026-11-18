package mx.com.traveloaxaca.acceso.correo;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/** Pone correos en la cola (tabla notificacion). Quien los manda es NotificacionWorker. */
@Service
public class NotificacionServicio {

    private final JdbcClient jdbc;
    private final ObjectMapper json;

    public NotificacionServicio(JdbcClient jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    /** Debe llamarse dentro de la transacción que origina el correo, para que viva o muera con ella. */
    public void encolarCorreo(UUID usuarioId, String plantilla, Map<String, String> datos) {
        String datosJson;
        try {
            datosJson = json.writeValueAsString(datos);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
        jdbc.sql("""
                INSERT INTO notificacion (usuario_id, plantilla_clave, canal, datos)
                VALUES (:u, :p, 'correo', CAST(:d AS jsonb))""")
                .param("u", usuarioId).param("p", plantilla).param("d", datosJson).update();
    }
}
