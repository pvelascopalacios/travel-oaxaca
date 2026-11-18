package mx.com.traveloaxaca.acceso.repo;

import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class DispositivoRepositorio {

    private final JdbcClient jdbc;

    public DispositivoRepositorio(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * Registra un dispositivo nuevo o refresca uno conocido. Si el cliente manda un identificador que
     * no existe, se crea uno nuevo: los identificadores los asigna siempre la base de datos.
     */
    public UUID registrar(UUID idConocido, String plataforma, String versionApp, String idioma, String tokenNotificacion) {
        if (idConocido != null) {
            int filas = jdbc.sql("""
                    UPDATE dispositivo SET plataforma = :p, version_app = :v,
                           idioma_codigo = COALESCE(:i, idioma_codigo),
                           token_notificacion = COALESCE(:t, token_notificacion), ultima_vez_en = now()
                    WHERE id = :id""")
                    .param("p", plataforma).param("v", versionApp).param("i", idioma)
                    .param("t", tokenNotificacion).param("id", idConocido).update();
            if (filas > 0) {
                return idConocido;
            }
        }
        return jdbc.sql("""
                INSERT INTO dispositivo (plataforma, version_app, idioma_codigo, token_notificacion)
                VALUES (:p, :v, :i, :t) RETURNING id""")
                .param("p", plataforma).param("v", versionApp).param("i", idioma).param("t", tokenNotificacion)
                .query(UUID.class).single();
    }

    public boolean existe(UUID id) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM dispositivo WHERE id = :id)")
                .param("id", id).query(Boolean.class).single();
    }

    public void vincularUsuario(UUID dispositivoId, UUID usuarioId) {
        jdbc.sql("UPDATE dispositivo SET usuario_id = :u, ultima_vez_en = now() WHERE id = :d")
                .param("u", usuarioId).param("d", dispositivoId).update();
    }
}
