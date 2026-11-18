package mx.com.traveloaxaca.negocios.repo;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class EquipoRepositorio {

    public record MiembroFila(UUID usuarioId, String correo, String nombre, String rol, String estado,
                              OffsetDateTime creadoEn) {
    }

    public record MembresiaFila(UUID id, UUID negocioId, UUID usuarioId, String rol, String estado) {
    }

    public record InvitacionFila(UUID id, UUID negocioId, String negocioNombre, String invitadoPorNombre,
                                 OffsetDateTime creadoEn) {
    }

    private final JdbcClient jdbc;

    public EquipoRepositorio(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public List<MiembroFila> miembros(UUID negocioId) {
        return jdbc.sql("""
                SELECT m.usuario_id, u.correo::text AS correo, u.nombre, m.rol, m.estado, m.creado_en
                FROM membresia_negocio m JOIN usuario u ON u.id = m.usuario_id
                WHERE m.negocio_id = :n AND m.estado <> 'revocada'
                ORDER BY (m.rol = 'propietario') DESC, m.creado_en""")
                .param("n", negocioId).query(MiembroFila.class).list();
    }

    public Optional<MembresiaFila> deUsuario(UUID negocioId, UUID usuarioId) {
        return jdbc.sql("""
                SELECT id, negocio_id, usuario_id, rol, estado FROM membresia_negocio
                WHERE negocio_id = :n AND usuario_id = :u""")
                .param("n", negocioId).param("u", usuarioId).query(MembresiaFila.class).optional();
    }

    public Optional<MembresiaFila> porId(UUID id) {
        return jdbc.sql("SELECT id, negocio_id, usuario_id, rol, estado FROM membresia_negocio WHERE id = :id")
                .param("id", id).query(MembresiaFila.class).optional();
    }

    public UUID invitar(UUID negocioId, UUID usuarioId, UUID invitadoPor) {
        return jdbc.sql("""
                INSERT INTO membresia_negocio (negocio_id, usuario_id, rol, estado, invitado_por)
                VALUES (:n, :u, 'colaborador', 'invitada', :i) RETURNING id""")
                .param("n", negocioId).param("u", usuarioId).param("i", invitadoPor).query(UUID.class).single();
    }

    /** Vuelve a invitar a alguien cuya membresía había sido revocada o rechazada. */
    public void reinvitar(UUID membresiaId, UUID invitadoPor) {
        jdbc.sql("""
                UPDATE membresia_negocio SET estado = 'invitada', rol = 'colaborador', invitado_por = :i
                WHERE id = :id""").param("i", invitadoPor).param("id", membresiaId).update();
    }

    public void cambiarEstado(UUID membresiaId, String estado) {
        jdbc.sql("UPDATE membresia_negocio SET estado = :e WHERE id = :id")
                .param("e", estado).param("id", membresiaId).update();
    }

    public List<InvitacionFila> invitacionesDe(UUID usuarioId) {
        return jdbc.sql("""
                SELECT m.id, m.negocio_id, n.nombre_comercial AS negocio_nombre, COALESCE(u.nombre, '') AS invitado_por_nombre,
                       m.creado_en
                FROM membresia_negocio m
                JOIN negocio n ON n.id = m.negocio_id AND n.eliminado_en IS NULL
                LEFT JOIN usuario u ON u.id = m.invitado_por
                WHERE m.usuario_id = :u AND m.estado = 'invitada' ORDER BY m.creado_en DESC""")
                .param("u", usuarioId).query(InvitacionFila.class).list();
    }
}
