package mx.com.traveloaxaca.revision.repo;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class RevisionRepositorio {

    public record ColaFila(String tipo, UUID negocioId, UUID medioId, String nombreComercial, String categoriaClave,
                           String municipioNombre, UUID regionId, String regionNombre, String claveAlmacenamiento,
                           OffsetDateTime enviadaEn, long horasEspera) {
    }

    public record FiltroCola(String tipo, UUID regionId, UUID categoriaId, int limite, int desplazamiento) {
    }

    public record PersonaFila(UUID usuarioId, String nombre, String correo) {
    }

    public record MedioPendiente(UUID id, String moderacion, UUID subidoPor, String hash) {
    }

    public record HistorialFila(String tipo, UUID negocioId, UUID medioId, String nombreComercial, String resultado,
                                String motivo, String revisorNombre, OffsetDateTime resueltaEn) {
    }

    private static final String BASE = """
            WITH base AS (
              SELECT CASE WHEN n.estado = 'en_revision' THEN 'ficha_nueva' ELSE 'cambio' END AS tipo,
                     n.id AS negocio_id, CAST(NULL AS uuid) AS medio_id, n.nombre_comercial, c.clave AS categoria_clave,
                     c.id AS categoria_id, c.padre_id, CAST(NULL AS text) AS clave_almacenamiento, r.enviada_en
              FROM revision_ficha r
              JOIN negocio n ON n.id = r.negocio_id
              JOIN categoria c ON c.id = n.categoria_id
              WHERE r.estado = 'pendiente' AND n.eliminado_en IS NULL
              UNION ALL
              SELECT 'foto', n.id, m.id, n.nombre_comercial, c.clave, c.id, c.padre_id, m.clave_almacenamiento, m.creado_en
              FROM medio m
              JOIN negocio_medio nm ON nm.medio_id = m.id
              JOIN negocio n ON n.id = nm.negocio_id
              JOIN categoria c ON c.id = n.categoria_id
              WHERE m.moderacion = 'pendiente' AND m.hash IS NOT NULL AND m.eliminado_en IS NULL
                AND n.eliminado_en IS NULL
            )
            SELECT b.tipo, b.negocio_id, b.medio_id, b.nombre_comercial, b.categoria_clave, b.clave_almacenamiento,
                   b.enviada_en, CAST(EXTRACT(EPOCH FROM (now() - b.enviada_en)) / 3600 AS bigint) AS horas_espera,
                   mu.nombre AS municipio_nombre, rg.id AS region_id, rg.nombre AS region_nombre
            FROM base b
            LEFT JOIN LATERAL (SELECT s.municipio_id FROM sucursal s
                               WHERE s.negocio_id = b.negocio_id AND s.es_principal AND s.eliminado_en IS NULL
                               LIMIT 1) sp ON true
            LEFT JOIN municipio mu ON mu.id = sp.municipio_id
            LEFT JOIN region rg ON rg.id = mu.region_id
            """;

    private final JdbcClient jdbc;

    public RevisionRepositorio(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    // ---------------- cola ----------------

    public List<ColaFila> cola(FiltroCola f) {
        Map<String, Object> p = new HashMap<>();
        String donde = condiciones(f, p);
        p.put("limite", f.limite());
        p.put("desplazamiento", f.desplazamiento());
        return jdbc.sql(BASE + donde + " ORDER BY b.enviada_en ASC, b.negocio_id LIMIT :limite OFFSET :desplazamiento")
                .params(p).query(ColaFila.class).list();
    }

    public long contarCola(FiltroCola f) {
        Map<String, Object> p = new HashMap<>();
        String donde = condiciones(f, p);
        return jdbc.sql("SELECT count(*) FROM (" + BASE + donde + ") t").params(p).query(Long.class).single();
    }

    private static String condiciones(FiltroCola f, Map<String, Object> p) {
        List<String> c = new ArrayList<>();
        if (f.tipo() != null) {
            p.put("tipo", f.tipo());
            c.add("b.tipo = :tipo");
        }
        if (f.regionId() != null) {
            p.put("region", f.regionId());
            c.add("rg.id = :region");
        }
        if (f.categoriaId() != null) {
            p.put("categoria", f.categoriaId());
            c.add("(b.categoria_id = :categoria OR b.padre_id = :categoria)");
        }
        return c.isEmpty() ? "" : "WHERE " + String.join(" AND ", c);
    }

    // ---------------- negocios ----------------

    public Optional<PersonaFila> propietario(UUID negocioId) {
        return jdbc.sql("""
                SELECT u.id AS usuario_id, u.nombre, u.correo::text AS correo
                FROM membresia_negocio m JOIN usuario u ON u.id = m.usuario_id
                WHERE m.negocio_id = :n AND m.rol = 'propietario' AND m.estado = 'activa'
                ORDER BY m.creado_en LIMIT 1""")
                .param("n", negocioId).query(PersonaFila.class).optional();
    }

    public Optional<PersonaFila> persona(UUID usuarioId) {
        return jdbc.sql("SELECT id AS usuario_id, nombre, correo::text AS correo FROM usuario WHERE id = :u")
                .param("u", usuarioId).query(PersonaFila.class).optional();
    }

    public void resolverRevision(UUID revisionId, boolean aprobada, UUID revisor, String motivo) {
        jdbc.sql("""
                UPDATE revision_ficha SET estado = :e, revisada_por = :r, motivo_rechazo = :m, resuelta_en = now()
                WHERE id = :id AND estado = 'pendiente'""")
                .param("e", aprobada ? "aprobada" : "rechazada").param("r", revisor).param("m", motivo)
                .param("id", revisionId).update();
    }

    public void cambiarNombre(UUID negocioId, String nombre) {
        jdbc.sql("UPDATE negocio SET nombre_comercial = :n WHERE id = :id").param("n", nombre).param("id", negocioId).update();
    }

    public void cambiarCategoria(UUID negocioId, UUID categoriaId) {
        jdbc.sql("UPDATE negocio SET categoria_id = :c WHERE id = :id").param("c", categoriaId).param("id", negocioId).update();
    }

    public int cambiarUbicacionPrincipal(UUID negocioId, double lat, double lng) {
        return jdbc.sql("""
                UPDATE sucursal SET ubicacion = CAST(ST_SetSRID(ST_MakePoint(:lng, :lat), 4326) AS geography)
                WHERE negocio_id = :n AND es_principal AND eliminado_en IS NULL""")
                .param("lng", lng).param("lat", lat).param("n", negocioId).update();
    }

    // ---------------- fotos ----------------

    public Optional<MedioPendiente> medioParaRevisar(UUID medioId) {
        return jdbc.sql("""
                SELECT id, moderacion, subido_por, hash FROM medio
                WHERE id = :id AND eliminado_en IS NULL FOR UPDATE""")
                .param("id", medioId).query(MedioPendiente.class).optional();
    }

    /** Negocios (vivos) que usan esa foto. */
    public List<UUID> negociosDeMedio(UUID medioId) {
        return jdbc.sql("""
                SELECT nm.negocio_id FROM negocio_medio nm JOIN negocio n ON n.id = nm.negocio_id
                WHERE nm.medio_id = :m AND n.eliminado_en IS NULL""")
                .param("m", medioId).query(UUID.class).list();
    }

    public String nombreNegocio(UUID negocioId) {
        return jdbc.sql("SELECT nombre_comercial FROM negocio WHERE id = :id").param("id", negocioId)
                .query(String.class).single();
    }

    public void resolverMedio(UUID medioId, boolean aprobado, UUID revisor, String motivo) {
        jdbc.sql("""
                UPDATE medio SET moderacion = :e, revisado_por = :r, revisado_en = now(), motivo_rechazo = :m
                WHERE id = :id""")
                .param("e", aprobado ? "aprobado" : "rechazado").param("r", revisor).param("m", motivo)
                .param("id", medioId).update();
    }

    // ---------------- historial ----------------

    private static final String HISTORIAL = """
            SELECT * FROM (
              SELECT CASE WHEN r.cambios = CAST('{}' AS jsonb) THEN 'ficha_nueva' ELSE 'cambio' END AS tipo,
                     n.id AS negocio_id, CAST(NULL AS uuid) AS medio_id, n.nombre_comercial,
                     r.estado AS resultado, r.motivo_rechazo AS motivo, u.nombre AS revisor_nombre, r.resuelta_en AS resuelta_en
              FROM revision_ficha r JOIN negocio n ON n.id = r.negocio_id LEFT JOIN usuario u ON u.id = r.revisada_por
              WHERE r.estado <> 'pendiente'
              UNION ALL
              SELECT 'foto', n.id, m.id, n.nombre_comercial, m.moderacion, m.motivo_rechazo, u.nombre, m.revisado_en
              FROM medio m
              JOIN negocio_medio nm ON nm.medio_id = m.id
              JOIN negocio n ON n.id = nm.negocio_id
              LEFT JOIN usuario u ON u.id = m.revisado_por
              WHERE m.revisado_en IS NOT NULL
            ) h
            """;

    public List<HistorialFila> historial(int limite, int desplazamiento) {
        return jdbc.sql(HISTORIAL + " ORDER BY h.resuelta_en DESC LIMIT :l OFFSET :d")
                .param("l", limite).param("d", desplazamiento).query(HistorialFila.class).list();
    }

    public long contarHistorial() {
        return jdbc.sql("SELECT count(*) FROM (" + HISTORIAL + ") t").query(Long.class).single();
    }
}
