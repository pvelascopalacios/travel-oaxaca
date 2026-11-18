package mx.com.traveloaxaca.negocios.repo;

import java.math.BigDecimal;
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
public class NegocioRepositorio {

    public record NegocioFila(UUID id, UUID destinoId, String slug, String nombreComercial, String razonSocial,
                              UUID categoriaId, String estado, Integer rangoPrecio, BigDecimal precioDesde,
                              String moneda, String unidadPrecio, String atributos, String origenAlta,
                              OffsetDateTime publicadoEn, OffsetDateTime verificadoEn, int puntajeFicha,
                              OffsetDateTime creadoEn, OffsetDateTime actualizadoEn) {
    }

    public record ResumenFila(UUID id, String slug, String nombreComercial, String estado, UUID categoriaId,
                              String categoriaClave, int puntajeFicha, String rolMiembro, String portadaClave,
                              OffsetDateTime actualizadoEn) {
    }

    public record RevisionFila(UUID id, int version, String estado, String motivoRechazo, String cambios,
                               OffsetDateTime enviadaEn) {
    }

    public record AdminFila(UUID id, String slug, String nombreComercial, String estado, String categoriaClave,
                            String municipioNombre, int puntajeFicha, String origenAlta, OffsetDateTime creadoEn,
                            OffsetDateTime publicadoEn) {
    }

    public record FiltroAdmin(String texto, String estado, UUID categoriaId, UUID municipioId, int limite,
                              int desplazamiento) {
    }

    private static final String COLUMNAS = """
            n.id, n.destino_id, n.slug, n.nombre_comercial, n.razon_social, n.categoria_id, n.estado,
            n.rango_precio, n.precio_desde, n.moneda::text AS moneda, n.unidad_precio, n.atributos::text AS atributos,
            n.origen_alta, n.publicado_en, n.verificado_en, n.puntaje_ficha, n.creado_en, n.actualizado_en""";

    private final JdbcClient jdbc;

    public NegocioRepositorio(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    // ---------------- lectura ----------------

    public Optional<NegocioFila> porId(UUID id) {
        return jdbc.sql("SELECT " + COLUMNAS + " FROM negocio n WHERE n.id = :id AND n.eliminado_en IS NULL")
                .param("id", id).query(NegocioFila.class).optional();
    }

    /** Bloquea la fila para serializar cambios de estado concurrentes. */
    public Optional<NegocioFila> porIdParaActualizar(UUID id) {
        return jdbc.sql("SELECT " + COLUMNAS + " FROM negocio n WHERE n.id = :id AND n.eliminado_en IS NULL FOR UPDATE OF n")
                .param("id", id).query(NegocioFila.class).optional();
    }

    public List<ResumenFila> deUsuario(UUID usuarioId) {
        return jdbc.sql("""
                SELECT n.id, n.slug, n.nombre_comercial, n.estado, n.categoria_id, c.clave AS categoria_clave,
                       n.puntaje_ficha, m.rol AS rol_miembro, n.actualizado_en,
                       (SELECT me.clave_almacenamiento FROM negocio_medio nm JOIN medio me ON me.id = nm.medio_id
                         WHERE nm.negocio_id = n.id AND nm.es_portada AND me.eliminado_en IS NULL LIMIT 1) AS portada_clave
                FROM membresia_negocio m
                JOIN negocio n ON n.id = m.negocio_id
                JOIN categoria c ON c.id = n.categoria_id
                WHERE m.usuario_id = :u AND m.estado = 'activa' AND n.eliminado_en IS NULL
                ORDER BY n.actualizado_en DESC""")
                .param("u", usuarioId).query(ResumenFila.class).list();
    }

    public long contarComoPropietario(UUID usuarioId) {
        return jdbc.sql("""
                SELECT count(*) FROM membresia_negocio m JOIN negocio n ON n.id = m.negocio_id
                WHERE m.usuario_id = :u AND m.rol = 'propietario' AND m.estado = 'activa' AND n.eliminado_en IS NULL""")
                .param("u", usuarioId).query(Long.class).single();
    }

    public Optional<String> rolDeMiembro(UUID negocioId, UUID usuarioId) {
        return jdbc.sql("""
                SELECT rol FROM membresia_negocio
                WHERE negocio_id = :n AND usuario_id = :u AND estado = 'activa'""")
                .param("n", negocioId).param("u", usuarioId).query(String.class).optional();
    }

    /** Clave de la categoría raíz (hospedaje, tours, comida) de una categoría activa, o vacío si no existe. */
    public Optional<String> claveRaiz(UUID categoriaId) {
        return jdbc.sql("""
                SELECT COALESCE(p.clave, c.clave) FROM categoria c LEFT JOIN categoria p ON p.id = c.padre_id
                WHERE c.id = :id AND c.activa""")
                .param("id", categoriaId).query(String.class).optional();
    }

    public Optional<String> claveCategoria(UUID categoriaId) {
        return jdbc.sql("SELECT clave FROM categoria WHERE id = :id").param("id", categoriaId)
                .query(String.class).optional();
    }

    public Optional<UUID> destinoDeMunicipio(UUID municipioId) {
        return jdbc.sql("""
                SELECT r.destino_id FROM municipio m JOIN region r ON r.id = m.region_id
                WHERE m.id = :m AND m.activo""")
                .param("m", municipioId).query(UUID.class).optional();
    }

    public List<String> faltantes(UUID negocioId) {
        String s = jdbc.sql("SELECT array_to_string(negocio_faltantes_publicacion(:id), ',')")
                .param("id", negocioId).query(String.class).single();
        return (s == null || s.isEmpty()) ? List.of() : List.of(s.split(","));
    }

    /** Slugs ya usados que empiezan igual, para elegir uno libre. */
    public List<String> slugsParecidos(UUID destinoId, String base) {
        return jdbc.sql("""
                SELECT slug FROM negocio
                WHERE destino_id = :d AND eliminado_en IS NULL AND (slug = :b OR slug LIKE :patron)""")
                .param("d", destinoId).param("b", base).param("patron", base.replace("_", "\\_") + "-%")
                .query(String.class).list();
    }

    // ---------------- escritura ----------------

    public UUID crear(UUID destinoId, String slug, String nombre, UUID categoriaId, UUID creadoPor) {
        return jdbc.sql("""
                INSERT INTO negocio (destino_id, slug, nombre_comercial, categoria_id, creado_por)
                VALUES (:d, :s, :n, :c, :u) RETURNING id""")
                .param("d", destinoId).param("s", slug).param("n", nombre).param("c", categoriaId)
                .param("u", creadoPor).query(UUID.class).single();
    }

    public void actualizarDatos(UUID id, String nombre, String razonSocial, UUID categoriaId, Integer rangoPrecio,
                                BigDecimal precioDesde, String unidadPrecio, String atributosJson) {
        jdbc.sql("""
                UPDATE negocio SET nombre_comercial = :n, razon_social = :r, categoria_id = :c, rango_precio = :rp,
                       precio_desde = :pd, unidad_precio = :up, atributos = CAST(:a AS jsonb)
                WHERE id = :id""")
                .param("n", nombre).param("r", razonSocial).param("c", categoriaId).param("rp", rangoPrecio)
                .param("pd", precioDesde).param("up", unidadPrecio).param("a", atributosJson).param("id", id).update();
    }

    /** Cambia solo los datos que se aplican sin revisión en una ficha publicada. */
    public void actualizarPrecio(UUID id, String razonSocial, Integer rangoPrecio, BigDecimal precioDesde,
                                 String unidadPrecio, String atributosJson) {
        jdbc.sql("""
                UPDATE negocio SET razon_social = :r, rango_precio = :rp, precio_desde = :pd, unidad_precio = :up,
                       atributos = CAST(:a AS jsonb)
                WHERE id = :id""")
                .param("r", razonSocial).param("rp", rangoPrecio).param("pd", precioDesde).param("up", unidadPrecio)
                .param("a", atributosJson).param("id", id).update();
    }

    public void cambiarEstado(UUID id, String estado) {
        jdbc.sql("UPDATE negocio SET estado = :e WHERE id = :id").param("e", estado).param("id", id).update();
    }

    public void archivar(UUID id) {
        jdbc.sql("UPDATE negocio SET estado = 'archivada', eliminado_en = now() WHERE id = :id")
                .param("id", id).update();
    }

    public void guardarPuntaje(UUID id, int puntaje) {
        jdbc.sql("UPDATE negocio SET puntaje_ficha = :p WHERE id = :id AND puntaje_ficha <> :p")
                .param("p", puntaje).param("id", id).update();
    }

    public void crearMembresiaPropietario(UUID negocioId, UUID usuarioId) {
        jdbc.sql("""
                INSERT INTO membresia_negocio (negocio_id, usuario_id, rol, estado)
                VALUES (:n, :u, 'propietario', 'activa')""")
                .param("n", negocioId).param("u", usuarioId).update();
    }

    // ---------------- revisiones ----------------

    public Optional<RevisionFila> revisionPendiente(UUID negocioId) {
        return jdbc.sql("""
                SELECT id, version, estado, motivo_rechazo, cambios::text AS cambios, enviada_en
                FROM revision_ficha WHERE negocio_id = :n AND estado = 'pendiente'""")
                .param("n", negocioId).query(RevisionFila.class).optional();
    }

    public Optional<RevisionFila> ultimaRevision(UUID negocioId) {
        return jdbc.sql("""
                SELECT id, version, estado, motivo_rechazo, cambios::text AS cambios, enviada_en
                FROM revision_ficha WHERE negocio_id = :n ORDER BY version DESC LIMIT 1""")
                .param("n", negocioId).query(RevisionFila.class).optional();
    }

    public UUID crearRevision(UUID negocioId, UUID enviadaPor, String cambiosJson) {
        return jdbc.sql("""
                INSERT INTO revision_ficha (negocio_id, version, enviada_por, cambios)
                VALUES (:n, 0, :u, CAST(:c AS jsonb)) RETURNING id""")
                .param("n", negocioId).param("u", enviadaPor).param("c", cambiosJson).query(UUID.class).single();
    }

    public void mezclarCambios(UUID revisionId, String fragmentoJson) {
        jdbc.sql("UPDATE revision_ficha SET cambios = cambios || CAST(:j AS jsonb) WHERE id = :id")
                .param("j", fragmentoJson).param("id", revisionId).update();
    }

    // ---------------- administración ----------------

    public List<AdminFila> buscar(FiltroAdmin f) {
        Map<String, Object> p = new HashMap<>();
        String donde = condiciones(f, p);
        p.put("limite", f.limite());
        p.put("desplazamiento", f.desplazamiento());
        return jdbc.sql("""
                SELECT n.id, n.slug, n.nombre_comercial, n.estado, c.clave AS categoria_clave,
                       (SELECT mu.nombre FROM sucursal s JOIN municipio mu ON mu.id = s.municipio_id
                         WHERE s.negocio_id = n.id AND s.es_principal AND s.eliminado_en IS NULL LIMIT 1) AS municipio_nombre,
                       n.puntaje_ficha, n.origen_alta, n.creado_en, n.publicado_en
                FROM negocio n JOIN categoria c ON c.id = n.categoria_id """ + " " + donde
                + " ORDER BY n.creado_en DESC LIMIT :limite OFFSET :desplazamiento")
                .params(p).query(AdminFila.class).list();
    }

    public long contar(FiltroAdmin f) {
        Map<String, Object> p = new HashMap<>();
        String donde = condiciones(f, p);
        return jdbc.sql("SELECT count(*) FROM negocio n JOIN categoria c ON c.id = n.categoria_id " + donde)
                .params(p).query(Long.class).single();
    }

    private static String condiciones(FiltroAdmin f, Map<String, Object> p) {
        List<String> c = new ArrayList<>();
        c.add("n.eliminado_en IS NULL");
        if (f.texto() != null && !f.texto().isBlank()) {
            p.put("texto", "%" + CatalogoRepositorio.escapar(f.texto().trim()) + "%");
            c.add("f_unaccent(n.nombre_comercial) ILIKE f_unaccent(:texto)");
        }
        if (f.estado() != null && !f.estado().isBlank()) {
            p.put("estado", f.estado());
            c.add("n.estado = :estado");
        }
        if (f.categoriaId() != null) {
            p.put("categoria", f.categoriaId());
            c.add("(n.categoria_id = :categoria OR c.padre_id = :categoria)");
        }
        if (f.municipioId() != null) {
            p.put("municipio", f.municipioId());
            c.add("EXISTS (SELECT 1 FROM sucursal s WHERE s.negocio_id = n.id AND s.municipio_id = :municipio AND s.eliminado_en IS NULL)");
        }
        return "WHERE " + String.join(" AND ", c);
    }
}