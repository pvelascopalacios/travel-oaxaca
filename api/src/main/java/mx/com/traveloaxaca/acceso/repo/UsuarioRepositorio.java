package mx.com.traveloaxaca.acceso.repo;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class UsuarioRepositorio {

    public record UsuarioFila(UUID id, String correo, String hashClave, String nombre, String telefonoE164,
                              String idiomaCodigo, String estado, OffsetDateTime correoVerificadoEn,
                              OffsetDateTime ultimoAccesoEn, OffsetDateTime creadoEn) {
    }

    public record FiltroAdmin(String texto, String estado, String rol, int limite, int desplazamiento) {
    }

    private static final String COLUMNAS = """
            id, correo::text AS correo, hash_clave, nombre, telefono_e164, idioma_codigo, estado,
            correo_verificado_en, ultimo_acceso_en, creado_en""";

    private final JdbcClient jdbc;

    public UsuarioRepositorio(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<UsuarioFila> porCorreo(String correo) {
        // El CAST a citext hace la comparación sin distinguir mayúsculas.
        return jdbc.sql("SELECT " + COLUMNAS + " FROM usuario WHERE correo = CAST(:c AS citext) AND eliminado_en IS NULL")
                .param("c", correo).query(UsuarioFila.class).optional();
    }

    public Optional<UsuarioFila> porId(UUID id) {
        return jdbc.sql("SELECT " + COLUMNAS + " FROM usuario WHERE id = :id AND eliminado_en IS NULL")
                .param("id", id).query(UsuarioFila.class).optional();
    }

    public UUID crear(String correo, String hashClave, String nombre, String idioma) {
        return jdbc.sql("""
                INSERT INTO usuario (correo, hash_clave, nombre, idioma_codigo)
                VALUES (:correo, :hash, :nombre, :idioma) RETURNING id""")
                .param("correo", correo).param("hash", hashClave).param("nombre", nombre).param("idioma", idioma)
                .query(UUID.class).single();
    }

    public boolean idiomaExiste(String codigo) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM idioma WHERE codigo = :c)")
                .param("c", codigo).query(Boolean.class).single();
    }

    public List<String> roles(UUID usuarioId) {
        return jdbc.sql("""
                SELECT DISTINCT r.clave FROM usuario_rol ur JOIN rol r ON r.id = ur.rol_id
                WHERE ur.usuario_id = :u ORDER BY r.clave""")
                .param("u", usuarioId).query(String.class).list();
    }

    public Map<UUID, List<String>> rolesDe(List<UUID> usuarios) {
        if (usuarios.isEmpty()) {
            return Map.of();
        }
        Map<UUID, List<String>> resultado = new HashMap<>();
        jdbc.sql("""
                SELECT DISTINCT ur.usuario_id AS usuario, r.clave AS clave
                FROM usuario_rol ur JOIN rol r ON r.id = ur.rol_id
                WHERE ur.usuario_id IN (:ids) ORDER BY r.clave""")
                .param("ids", usuarios)
                .query((rs, n) -> Map.entry(rs.getObject("usuario", UUID.class), rs.getString("clave")))
                .list()
                .forEach(e -> resultado.computeIfAbsent(e.getKey(), k -> new ArrayList<>()).add(e.getValue()));
        return resultado;
    }

    /** Da un rol global (sin destino). Regresa 0 si el rol no existe y 1 si lo agregó. */
    public int asignarRol(UUID usuarioId, String claveRol) {
        return jdbc.sql("INSERT INTO usuario_rol (usuario_id, rol_id) SELECT CAST(:u AS uuid), id FROM rol WHERE clave = :r")
                .param("u", usuarioId).param("r", claveRol).update();
    }

    public boolean tieneRol(UUID usuarioId, String claveRol) {
        return jdbc.sql("""
                SELECT EXISTS (SELECT 1 FROM usuario_rol ur JOIN rol r ON r.id = ur.rol_id
                               WHERE ur.usuario_id = :u AND r.clave = :r AND ur.destino_id IS NULL)""")
                .param("u", usuarioId).param("r", claveRol).query(Boolean.class).single();
    }

    public boolean rolExiste(String claveRol) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM rol WHERE clave = :r)")
                .param("r", claveRol).query(Boolean.class).single();
    }

    public int quitarRol(UUID usuarioId, String claveRol) {
        return jdbc.sql("""
                DELETE FROM usuario_rol ur USING rol r
                WHERE ur.rol_id = r.id AND ur.usuario_id = :u AND r.clave = :r AND ur.destino_id IS NULL""")
                .param("u", usuarioId).param("r", claveRol).update();
    }

    public long contarAdministradoresActivos() {
        return jdbc.sql("""
                SELECT count(DISTINCT ur.usuario_id)
                FROM usuario_rol ur JOIN rol r ON r.id = ur.rol_id JOIN usuario u ON u.id = ur.usuario_id
                WHERE r.clave = 'admin' AND u.estado = 'activo' AND u.eliminado_en IS NULL""")
                .query(Long.class).single();
    }

    public void tocarUltimoAcceso(UUID id) {
        jdbc.sql("UPDATE usuario SET ultimo_acceso_en = now() WHERE id = :id").param("id", id).update();
    }

    public void marcarCorreoVerificado(UUID id) {
        jdbc.sql("UPDATE usuario SET correo_verificado_en = COALESCE(correo_verificado_en, now()) WHERE id = :id")
                .param("id", id).update();
    }

    public void cambiarClave(UUID id, String hashClave) {
        jdbc.sql("UPDATE usuario SET hash_clave = :h WHERE id = :id").param("h", hashClave).param("id", id).update();
    }

    public int actualizarPerfil(UUID id, String nombre, String telefono, String idioma) {
        return jdbc.sql("""
                UPDATE usuario SET nombre = :n, telefono_e164 = :t, idioma_codigo = :i
                WHERE id = :id AND eliminado_en IS NULL""")
                .param("n", nombre).param("t", telefono).param("i", idioma).param("id", id).update();
    }

    public int cambiarEstado(UUID id, String estado) {
        return jdbc.sql("UPDATE usuario SET estado = :e WHERE id = :id AND eliminado_en IS NULL")
                .param("e", estado).param("id", id).update();
    }

    // ---------------- administración ----------------

    public List<UsuarioFila> buscar(FiltroAdmin f) {
        Map<String, Object> p = new HashMap<>();
        String donde = condiciones(f, p);
        p.put("limite", f.limite());
        p.put("desplazamiento", f.desplazamiento());
        return jdbc.sql("SELECT " + COLUMNAS + " FROM usuario u " + donde
                        + " ORDER BY u.creado_en DESC LIMIT :limite OFFSET :desplazamiento")
                .params(p).query(UsuarioFila.class).list();
    }

    public long contar(FiltroAdmin f) {
        Map<String, Object> p = new HashMap<>();
        String donde = condiciones(f, p);
        return jdbc.sql("SELECT count(*) FROM usuario u " + donde).params(p).query(Long.class).single();
    }

    private static String condiciones(FiltroAdmin f, Map<String, Object> p) {
        List<String> c = new ArrayList<>();
        c.add("u.eliminado_en IS NULL");
        if (f.texto() != null && !f.texto().isBlank()) {
            p.put("texto", "%" + f.texto().trim().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%");
            c.add("(u.correo::text ILIKE :texto OR f_unaccent(u.nombre) ILIKE f_unaccent(:texto))");
        }
        if (f.estado() != null && !f.estado().isBlank()) {
            p.put("estado", f.estado());
            c.add("u.estado = :estado");
        }
        if (f.rol() != null && !f.rol().isBlank()) {
            p.put("rol", f.rol());
            c.add("EXISTS (SELECT 1 FROM usuario_rol ur JOIN rol r ON r.id = ur.rol_id WHERE ur.usuario_id = u.id AND r.clave = :rol)");
        }
        return "WHERE " + c.stream().collect(Collectors.joining(" AND "));
    }
}
