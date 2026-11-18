package mx.com.traveloaxaca.ventas.repo;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.InteraccionDto;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.PersonaEquipoDto;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** SQL del embudo de prospectos y de su historial de contactos. */
@Repository
public class ProspectoRepositorio {

    public record Fila(UUID id, String nombreNegocio, UUID categoriaId, String categoriaClave, UUID municipioId,
                       String municipioNombre, String contactoNombre, String telefono, String correo, String origen,
                       String estado, UUID asignadoA, String asignadoNombre, UUID negocioId, LocalDate proximaAccionEn,
                       String motivoDescarte, String notas, OffsetDateTime creadoEn, OffsetDateTime actualizadoEn) {
    }

    public record Filtro(String estado, UUID asignadoA, boolean soloSinAsignar, UUID municipioId, UUID categoriaId,
                         String origen, boolean soloVencidas, String texto, LocalDate hoy, int limite,
                         int desplazamiento) {
    }

    private static final String SELECT = """
            SELECT p.id, p.nombre_negocio, p.categoria_id, c.clave AS categoria_clave, p.municipio_id,
                   m.nombre AS municipio_nombre, p.contacto_nombre, p.telefono, CAST(p.correo AS text) AS correo,
                   p.origen, p.estado, p.asignado_a, u.nombre AS asignado_nombre, p.negocio_id, p.proxima_accion_en,
                   p.motivo_descarte, p.notas, p.creado_en, p.actualizado_en
            FROM prospecto p
            LEFT JOIN categoria c ON c.id = p.categoria_id
            LEFT JOIN municipio m ON m.id = p.municipio_id
            LEFT JOIN usuario u ON u.id = p.asignado_a""";

    private final JdbcClient jdbc;

    public ProspectoRepositorio(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    // ---------------- lectura ----------------

    private static String donde(Filtro f, Map<String, Object> p) {
        StringBuilder w = new StringBuilder(" WHERE p.eliminado_en IS NULL");
        if (f.estado() != null) {
            w.append(" AND p.estado = :estado");
            p.put("estado", f.estado());
        }
        if (f.asignadoA() != null) {
            w.append(" AND p.asignado_a = :asignado");
            p.put("asignado", f.asignadoA());
        }
        if (f.soloSinAsignar()) {
            w.append(" AND p.asignado_a IS NULL");
        }
        if (f.municipioId() != null) {
            w.append(" AND p.municipio_id = :municipio");
            p.put("municipio", f.municipioId());
        }
        if (f.categoriaId() != null) {
            w.append(" AND p.categoria_id = :categoria");
            p.put("categoria", f.categoriaId());
        }
        if (f.origen() != null) {
            w.append(" AND p.origen = :origen");
            p.put("origen", f.origen());
        }
        if (f.soloVencidas()) {
            w.append(" AND p.proxima_accion_en < :hoy AND p.estado NOT IN ('convertido','descartado')");
            p.put("hoy", f.hoy());
        }
        if (f.texto() != null && !f.texto().isBlank()) {
            w.append("\n").append("""
                     AND (f_unaccent(lower(p.nombre_negocio)) LIKE '%' || f_unaccent(lower(:texto)) || '%'
                          OR p.telefono LIKE '%' || :texto || '%'
                          OR lower(CAST(p.correo AS text)) LIKE '%' || lower(:texto) || '%'
                          OR f_unaccent(lower(COALESCE(p.contacto_nombre, ''))) LIKE '%' || f_unaccent(lower(:texto)) || '%')""");
            p.put("texto", f.texto().trim().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_"));
        }
        return w.toString();
    }

    public List<Fila> buscar(Filtro f) {
        Map<String, Object> p = new HashMap<>();
        String w = donde(f, p);
        p.put("limite", f.limite());
        p.put("desplazamiento", f.desplazamiento());
        return jdbc.sql(SELECT + w + "\n" + """
                 ORDER BY (p.proxima_accion_en IS NULL), p.proxima_accion_en, p.creado_en DESC
                 LIMIT :limite OFFSET :desplazamiento""").params(p).query(Fila.class).list();
    }

    public long contar(Filtro f) {
        Map<String, Object> p = new HashMap<>();
        String w = donde(f, p);
        return jdbc.sql("SELECT count(*) FROM prospecto p" + w).params(p).query(Long.class).single();
    }

    public Optional<Fila> porId(UUID id) {
        return jdbc.sql(SELECT + " WHERE p.id = :id AND p.eliminado_en IS NULL").param("id", id)
                .query(Fila.class).optional();
    }

    /** Bloquea el renglón del prospecto mientras dura la transacción. */
    public Optional<Fila> bloquear(UUID id) {
        jdbc.sql("SELECT id FROM prospecto WHERE id = :id AND eliminado_en IS NULL FOR UPDATE").param("id", id)
                .query(UUID.class).optional();
        return porId(id);
    }

    public Map<String, Long> conteoPorEstado() {
        Map<String, Long> r = new LinkedHashMap<>();
        for (String e : List.of("nuevo", "contactado", "interesado", "en_alta", "convertido", "descartado")) {
            r.put(e, 0L);
        }
        jdbc.sql("SELECT estado, count(*) AS n FROM prospecto WHERE eliminado_en IS NULL GROUP BY estado")
                .query((rs, i) -> Map.entry(rs.getString("estado"), rs.getLong("n")))
                .list().forEach(e -> r.put(e.getKey(), e.getValue()));
        return r;
    }

    public long vencidas(LocalDate hoy) {
        return jdbc.sql("""
                SELECT count(*) FROM prospecto WHERE eliminado_en IS NULL AND proxima_accion_en < :hoy
                  AND estado NOT IN ('convertido','descartado')""").param("hoy", hoy).query(Long.class).single();
    }

    public long sinAsignar() {
        return jdbc.sql("""
                SELECT count(*) FROM prospecto WHERE eliminado_en IS NULL AND asignado_a IS NULL
                  AND estado NOT IN ('convertido','descartado')""").query(Long.class).single();
    }

    public long convertidosDesde(LocalDate desde) {
        return jdbc.sql("""
                SELECT count(*) FROM prospecto WHERE eliminado_en IS NULL AND estado = 'convertido'
                  AND (actualizado_en AT TIME ZONE 'America/Mexico_City')::date >= :desde""")
                .param("desde", desde).query(Long.class).single();
    }

    public List<InteraccionDto> interacciones(UUID prospectoId) {
        return jdbc.sql("""
                SELECT i.id, i.tipo, i.resultado, i.notas, i.ocurrio_en, i.proxima_accion_en, i.usuario_id,
                       u.nombre AS usuario_nombre
                FROM interaccion_comercial i LEFT JOIN usuario u ON u.id = i.usuario_id
                WHERE i.prospecto_id = :p ORDER BY i.ocurrio_en DESC, i.creado_en DESC""")
                .param("p", prospectoId).query(InteraccionDto.class).list();
    }

    // ---------------- validaciones de referencias ----------------

    public boolean categoriaExiste(UUID id) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM categoria WHERE id = :id AND activa)").param("id", id)
                .query(Boolean.class).single();
    }

    public boolean municipioExiste(UUID id) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM municipio WHERE id = :id AND activo)").param("id", id)
                .query(Boolean.class).single();
    }

    /** Personas que pueden llevar prospectos: rol ventas o admin, con cuenta activa. */
    public boolean esDelEquipo(UUID usuarioId) {
        return jdbc.sql("""
                SELECT EXISTS (SELECT 1 FROM usuario_rol ur JOIN rol r ON r.id = ur.rol_id
                               JOIN usuario u ON u.id = ur.usuario_id
                               WHERE ur.usuario_id = :u AND r.clave IN ('ventas','admin') AND u.estado = 'activo')""")
                .param("u", usuarioId).query(Boolean.class).single();
    }

    public List<PersonaEquipoDto> equipo() {
        return jdbc.sql("""
                SELECT DISTINCT u.id, u.nombre FROM usuario u
                JOIN usuario_rol ur ON ur.usuario_id = u.id JOIN rol r ON r.id = ur.rol_id
                WHERE r.clave IN ('ventas','admin') AND u.estado = 'activo' ORDER BY u.nombre""")
                .query(PersonaEquipoDto.class).list();
    }

    /** Nombre del prospecto o negocio que ya usa ese teléfono o correo, si lo hay. */
    public Optional<String> duplicado(String telefono, String correo, UUID excluirProspecto) {
        Optional<String> pro = jdbc.sql("""
                SELECT nombre_negocio FROM prospecto
                WHERE eliminado_en IS NULL AND id <> CAST(:x AS uuid)
                  AND ((CAST(:t AS text) IS NOT NULL AND telefono = CAST(:t AS text))
                    OR (CAST(:c AS text) IS NOT NULL AND lower(CAST(correo AS text)) = lower(CAST(:c AS text))))
                LIMIT 1""")
                .param("x", excluirProspecto == null ? new UUID(0, 0) : excluirProspecto)
                .param("t", telefono).param("c", correo).query(String.class).optional();
        if (pro.isPresent()) {
            return pro.map(n -> "El prospecto «" + n + "»");
        }
        return jdbc.sql("""
                SELECT n.nombre_comercial FROM contacto c JOIN negocio n ON n.id = c.negocio_id
                WHERE c.eliminado_en IS NULL AND n.eliminado_en IS NULL
                  AND ((CAST(:t AS text) IS NOT NULL AND c.valor = CAST(:t AS text))
                    OR (CAST(:c AS text) IS NOT NULL AND lower(c.valor) = lower(CAST(:c AS text))))
                LIMIT 1""")
                .param("t", telefono).param("c", correo).query(String.class).optional()
                .map(n -> "El negocio «" + n + "»");
    }

    // ---------------- escritura ----------------

    public UUID crear(String nombre, UUID categoriaId, UUID municipioId, String contacto, String telefono,
                      String correo, String origen, UUID asignadoA, LocalDate proxima, String notas) {
        return jdbc.sql("""
                INSERT INTO prospecto (nombre_negocio, categoria_id, municipio_id, contacto_nombre, telefono, correo,
                                       origen, asignado_a, proxima_accion_en, notas)
                VALUES (:n, :c, :m, :cn, CAST(:t AS text), CAST(:co AS citext), :o, :a, :p, :no) RETURNING id""")
                .param("n", nombre).param("c", categoriaId).param("m", municipioId).param("cn", contacto)
                .param("t", telefono).param("co", correo).param("o", origen).param("a", asignadoA)
                .param("p", proxima).param("no", notas).query(UUID.class).single();
    }

    public void actualizar(UUID id, String nombre, UUID categoriaId, UUID municipioId, String contacto,
                           String telefono, String correo, String origen, UUID asignadoA, LocalDate proxima,
                           String notas) {
        jdbc.sql("""
                UPDATE prospecto SET nombre_negocio = :n, categoria_id = :c, municipio_id = :m, contacto_nombre = :cn,
                       telefono = CAST(:t AS text), correo = CAST(:co AS citext), origen = :o, asignado_a = :a,
                       proxima_accion_en = :p, notas = :no
                WHERE id = :id""")
                .param("n", nombre).param("c", categoriaId).param("m", municipioId).param("cn", contacto)
                .param("t", telefono).param("co", correo).param("o", origen).param("a", asignadoA)
                .param("p", proxima).param("no", notas).param("id", id).update();
    }

    public void cambiarEstado(UUID id, String estado, String motivo) {
        jdbc.sql("UPDATE prospecto SET estado = :e, motivo_descarte = :m WHERE id = :id")
                .param("e", estado).param("m", motivo).param("id", id).update();
    }

    public void fijarProximaAccion(UUID id, LocalDate fecha) {
        jdbc.sql("UPDATE prospecto SET proxima_accion_en = :f WHERE id = :id").param("f", fecha).param("id", id).update();
    }

    public void eliminar(UUID id) {
        jdbc.sql("UPDATE prospecto SET eliminado_en = now() WHERE id = :id").param("id", id).update();
    }

    public void registrarInteraccion(UUID prospectoId, UUID usuarioId, String tipo, String resultado, String notas,
                                     OffsetDateTime ocurrio, LocalDate proxima) {
        jdbc.sql("""
                INSERT INTO interaccion_comercial (prospecto_id, usuario_id, tipo, resultado, notas, ocurrio_en,
                                                   proxima_accion_en)
                VALUES (:p, :u, :t, :r, :n, COALESCE(CAST(:o AS timestamptz), now()), :pr)""")
                .param("p", prospectoId).param("u", usuarioId).param("t", tipo).param("r", resultado)
                .param("n", notas).param("o", ocurrio).param("pr", proxima).update();
    }

    // ---------------- conversión a negocio ----------------

    public Optional<UUID> destinoDeMunicipio(UUID municipioId) {
        return jdbc.sql("""
                SELECT r.destino_id FROM municipio m JOIN region r ON r.id = m.region_id
                WHERE m.id = :m AND m.activo""").param("m", municipioId).query(UUID.class).optional();
    }

    public List<String> slugsParecidos(UUID destinoId, String base) {
        return jdbc.sql("""
                SELECT slug FROM negocio
                WHERE destino_id = :d AND eliminado_en IS NULL AND (slug = :b OR slug LIKE :patron)""")
                .param("d", destinoId).param("b", base).param("patron", base.replace("_", "\\_") + "-%")
                .query(String.class).list();
    }

    public UUID crearNegocio(UUID destinoId, String slug, String nombre, UUID categoriaId, UUID creadoPor,
                             String origenAlta) {
        return jdbc.sql("""
                INSERT INTO negocio (destino_id, slug, nombre_comercial, categoria_id, origen_alta, creado_por)
                VALUES (:d, :s, :n, :c, :o, :u) RETURNING id""")
                .param("d", destinoId).param("s", slug).param("n", nombre).param("c", categoriaId)
                .param("o", origenAlta).param("u", creadoPor).query(UUID.class).single();
    }

    public void crearSucursalPrincipal(UUID negocioId, UUID municipioId) {
        jdbc.sql("INSERT INTO sucursal (negocio_id, es_principal, municipio_id) VALUES (:n, true, :m)")
                .param("n", negocioId).param("m", municipioId).update();
    }

    public void crearContacto(UUID negocioId, String tipo, String valor) {
        jdbc.sql("INSERT INTO contacto (negocio_id, tipo, valor, es_principal) VALUES (:n, :t, :v, true)")
                .param("n", negocioId).param("t", tipo).param("v", valor).update();
    }

    public void enlazarNegocio(UUID prospectoId, UUID negocioId) {
        jdbc.sql("UPDATE prospecto SET estado = 'convertido', negocio_id = :n, motivo_descarte = NULL, categoria_id = COALESCE(categoria_id, (SELECT categoria_id FROM negocio WHERE id = :n)), municipio_id = COALESCE(municipio_id, (SELECT municipio_id FROM sucursal WHERE negocio_id = :n AND es_principal LIMIT 1)) WHERE id = :p")
                .param("n", negocioId).param("p", prospectoId).update();
    }

    // ---------------- aviso diario ----------------

    /** Un correo por persona con prospectos vencidos; una vez por día. Regresa cuántos puso en la cola. */
    public int avisarVencidos(LocalDate hoy) {
        return jdbc.sql("""
                INSERT INTO notificacion (usuario_id, plantilla_clave, canal, datos)
                SELECT u.id, 'prospectos_vencidos', 'correo',
                       jsonb_build_object('nombre', u.nombre, 'cantidad', CAST(v.n AS text), 'fecha', CAST(:hoy AS text))
                FROM (SELECT asignado_a, count(*) AS n FROM prospecto
                      WHERE eliminado_en IS NULL AND asignado_a IS NOT NULL AND proxima_accion_en < :hoy
                        AND estado NOT IN ('convertido','descartado')
                      GROUP BY asignado_a) v
                JOIN usuario u ON u.id = v.asignado_a AND u.estado = 'activo'
                WHERE NOT EXISTS (SELECT 1 FROM notificacion x WHERE x.usuario_id = u.id
                                  AND x.plantilla_clave = 'prospectos_vencidos' AND x.datos ->> 'fecha' = CAST(:hoy AS text))""")
                .param("hoy", hoy).update();
    }
}
