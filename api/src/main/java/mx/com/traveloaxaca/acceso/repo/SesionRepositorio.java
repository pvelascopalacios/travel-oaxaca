package mx.com.traveloaxaca.acceso.repo;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class SesionRepositorio {

    public record SesionFila(UUID id, UUID usuarioId, UUID dispositivoId, OffsetDateTime expiraEn,
                             OffsetDateTime revocadaEn) {
    }

    public record SesionActivaFila(UUID id, OffsetDateTime creadoEn, OffsetDateTime expiraEn,
                                   String plataforma, String versionApp) {
    }

    private final JdbcClient jdbc;

    public SesionRepositorio(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public UUID crear(UUID usuarioId, UUID dispositivoId, String huellaToken, int diasVigencia) {
        return jdbc.sql("""
                INSERT INTO sesion (usuario_id, dispositivo_id, hash_token_refresco, expira_en)
                VALUES (:u, :d, :h, now() + (:dias * interval '1 day')) RETURNING id""")
                .param("u", usuarioId).param("d", dispositivoId).param("h", huellaToken).param("dias", diasVigencia)
                .query(UUID.class).single();
    }

    /** Busca por huella del token y bloquea la fila mientras dure la transacción. */
    public Optional<SesionFila> porHuellaParaActualizar(String huellaToken) {
        return jdbc.sql("""
                SELECT id, usuario_id, dispositivo_id, expira_en, revocada_en
                FROM sesion WHERE hash_token_refresco = :h FOR UPDATE""")
                .param("h", huellaToken).query(SesionFila.class).optional();
    }

    public void revocar(UUID sesionId) {
        jdbc.sql("UPDATE sesion SET revocada_en = now() WHERE id = :id AND revocada_en IS NULL")
                .param("id", sesionId).update();
    }

    public int revocarTodas(UUID usuarioId) {
        return jdbc.sql("UPDATE sesion SET revocada_en = now() WHERE usuario_id = :u AND revocada_en IS NULL")
                .param("u", usuarioId).update();
    }

    public int revocarOtras(UUID usuarioId, UUID sesionQueSeConserva) {
        return jdbc.sql("""
                UPDATE sesion SET revocada_en = now()
                WHERE usuario_id = :u AND id <> :s AND revocada_en IS NULL""")
                .param("u", usuarioId).param("s", sesionQueSeConserva).update();
    }

    /** Cierra una sesión solo si pertenece al usuario. Regresa 0 si no existe o no es suya. */
    public int revocarDeUsuario(UUID sesionId, UUID usuarioId) {
        return jdbc.sql("""
                UPDATE sesion SET revocada_en = now()
                WHERE id = :id AND usuario_id = :u AND revocada_en IS NULL""")
                .param("id", sesionId).param("u", usuarioId).update();
    }

    public List<SesionActivaFila> activasDe(UUID usuarioId) {
        return jdbc.sql("""
                SELECT s.id, s.creado_en, s.expira_en, d.plataforma, d.version_app
                FROM sesion s LEFT JOIN dispositivo d ON d.id = s.dispositivo_id
                WHERE s.usuario_id = :u AND s.revocada_en IS NULL AND s.expira_en > now()
                ORDER BY s.creado_en DESC""")
                .param("u", usuarioId).query(SesionActivaFila.class).list();
    }
}
