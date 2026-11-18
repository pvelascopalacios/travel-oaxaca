package mx.com.traveloaxaca.negocios.repo;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import mx.com.traveloaxaca.negocios.dto.NegocioDtos.CategoriaDto;
import mx.com.traveloaxaca.negocios.dto.NegocioDtos.DestinoDto;
import mx.com.traveloaxaca.negocios.dto.NegocioDtos.IdiomaDto;
import mx.com.traveloaxaca.negocios.dto.NegocioDtos.LocalidadDto;
import mx.com.traveloaxaca.negocios.dto.NegocioDtos.MunicipioDto;
import mx.com.traveloaxaca.negocios.dto.NegocioDtos.RegionDto;
import mx.com.traveloaxaca.negocios.dto.NegocioDtos.ServicioDto;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class CatalogoRepositorio {

    public record CategoriaFila(UUID id, UUID padreId, String clave, String icono, int orden, String nombre,
                                boolean activa) {
    }

    private final JdbcClient jdbc;

    public CatalogoRepositorio(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    // ---------------- lectura ----------------

    public List<IdiomaDto> idiomas() {
        return jdbc.sql("SELECT codigo, nombre, es_indigena FROM idioma WHERE activo ORDER BY nombre")
                .query(IdiomaDto.class).list();
    }

    public List<DestinoDto> destinos() {
        return jdbc.sql("SELECT id, codigo, nombre FROM destino WHERE activo ORDER BY nombre")
                .query(DestinoDto.class).list();
    }

    public List<RegionDto> regiones(String destinoCodigo) {
        if (destinoCodigo != null && !destinoCodigo.isBlank()) {
            return jdbc.sql("""
                    SELECT r.id, r.slug, r.nombre FROM region r JOIN destino d ON d.id = r.destino_id
                    WHERE r.activo AND d.codigo = :d ORDER BY r.nombre""")
                    .param("d", destinoCodigo).query(RegionDto.class).list();
        }
        return jdbc.sql("SELECT id, slug, nombre FROM region WHERE activo ORDER BY nombre")
                .query(RegionDto.class).list();
    }

    public List<MunicipioDto> municipios(UUID regionId, String texto, int limite) {
        StringBuilder sql = new StringBuilder("""
                SELECT id, region_id, clave_inegi, nombre, ST_Y(ubicacion::geometry) AS latitud,
                       ST_X(ubicacion::geometry) AS longitud
                FROM municipio WHERE activo""");
        Map<String, Object> p = new HashMap<>();
        if (regionId != null) {
            sql.append(" AND region_id = :r");
            p.put("r", regionId);
        }
        if (texto != null && !texto.isBlank()) {
            sql.append(" AND f_unaccent(nombre) ILIKE f_unaccent(:t)");
            p.put("t", "%" + escapar(texto.trim()) + "%");
        }
        sql.append(" ORDER BY nombre LIMIT :lim");
        p.put("lim", limite);
        return jdbc.sql(sql.toString()).params(p).query(MunicipioDto.class).list();
    }

    public List<LocalidadDto> localidades(UUID municipioId) {
        return jdbc.sql("""
                SELECT id, municipio_id, nombre, ST_Y(ubicacion::geometry) AS latitud,
                       ST_X(ubicacion::geometry) AS longitud
                FROM localidad WHERE activo AND municipio_id = :m ORDER BY nombre""")
                .param("m", municipioId).query(LocalidadDto.class).list();
    }

    public List<CategoriaDto> arbolCategorias(String idioma) {
        List<CategoriaFila> filas = jdbc.sql("""
                SELECT c.id, c.padre_id, c.clave, c.icono, c.orden, c.activa,
                       COALESCE(t.nombre, te.nombre, c.clave) AS nombre
                FROM categoria c
                LEFT JOIN categoria_traduccion t ON t.categoria_id = c.id AND t.idioma_codigo = :i
                LEFT JOIN categoria_traduccion te ON te.categoria_id = c.id AND te.idioma_codigo = 'es'
                WHERE c.activa ORDER BY c.orden, nombre""")
                .param("i", idioma).query(CategoriaFila.class).list();
        Map<UUID, List<CategoriaDto>> hijasPorPadre = new LinkedHashMap<>();
        for (CategoriaFila f : filas) {
            if (f.padreId() != null) {
                hijasPorPadre.computeIfAbsent(f.padreId(), k -> new ArrayList<>())
                        .add(new CategoriaDto(f.id(), f.padreId(), f.clave(), f.nombre(), f.icono(), f.orden(), List.of()));
            }
        }
        List<CategoriaDto> raices = new ArrayList<>();
        for (CategoriaFila f : filas) {
            if (f.padreId() == null) {
                raices.add(new CategoriaDto(f.id(), null, f.clave(), f.nombre(), f.icono(), f.orden(),
                        hijasPorPadre.getOrDefault(f.id(), List.of())));
            }
        }
        return raices;
    }

    public List<ServicioDto> servicios(String idioma, String grupo) {
        StringBuilder sql = new StringBuilder("""
                SELECT s.id, s.clave, s.grupo, s.icono, COALESCE(t.nombre, te.nombre, s.clave) AS nombre
                FROM servicio s
                LEFT JOIN servicio_traduccion t ON t.servicio_id = s.id AND t.idioma_codigo = :i
                LEFT JOIN servicio_traduccion te ON te.servicio_id = s.id AND te.idioma_codigo = 'es'
                WHERE s.activo""");
        Map<String, Object> p = new HashMap<>();
        p.put("i", idioma);
        if (grupo != null && !grupo.isBlank()) {
            sql.append(" AND s.grupo = :g");
            p.put("g", grupo);
        }
        sql.append(" ORDER BY s.grupo, nombre");
        return jdbc.sql(sql.toString()).params(p).query(ServicioDto.class).list();
    }

    // ---------------- apoyo a otras reglas ----------------

    public boolean idiomaExiste(String codigo) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM idioma WHERE codigo = :c AND activo)")
                .param("c", codigo).query(Boolean.class).single();
    }

    public Optional<UUID> destinoPorDefecto() {
        return jdbc.sql("SELECT id FROM destino WHERE activo ORDER BY creado_en LIMIT 1")
                .query(UUID.class).optional();
    }

    // ---------------- categorías (admin) ----------------

    public Optional<UUID> categoriaPorId(UUID id) {
        return jdbc.sql("SELECT id FROM categoria WHERE id = :id").param("id", id).query(UUID.class).optional();
    }

    public UUID crearCategoria(UUID padreId, String clave, String icono, int orden, boolean activa) {
        return jdbc.sql("""
                INSERT INTO categoria (padre_id, clave, icono, orden, activa)
                VALUES (:p, :c, :i, :o, :a) RETURNING id""")
                .param("p", padreId).param("c", clave).param("i", icono).param("o", orden).param("a", activa)
                .query(UUID.class).single();
    }

    public int actualizarCategoria(UUID id, String icono, int orden, boolean activa) {
        return jdbc.sql("UPDATE categoria SET icono = :i, orden = :o, activa = :a WHERE id = :id")
                .param("i", icono).param("o", orden).param("a", activa).param("id", id).update();
    }

    public void guardarNombreCategoria(UUID id, String idioma, String nombre) {
        jdbc.sql("""
                INSERT INTO categoria_traduccion (categoria_id, idioma_codigo, nombre) VALUES (:c, :i, :n)
                ON CONFLICT (categoria_id, idioma_codigo) DO UPDATE SET nombre = EXCLUDED.nombre""")
                .param("c", id).param("i", idioma).param("n", nombre).update();
    }

    // ---------------- servicios (admin) ----------------

    public Optional<UUID> servicioPorId(UUID id) {
        return jdbc.sql("SELECT id FROM servicio WHERE id = :id").param("id", id).query(UUID.class).optional();
    }

    public UUID crearServicio(String clave, String grupo, String icono, boolean activo) {
        return jdbc.sql("INSERT INTO servicio (clave, grupo, icono, activo) VALUES (:c, :g, :i, :a) RETURNING id")
                .param("c", clave).param("g", grupo).param("i", icono).param("a", activo).query(UUID.class).single();
    }

    public int actualizarServicio(UUID id, String grupo, String icono, boolean activo) {
        return jdbc.sql("UPDATE servicio SET grupo = :g, icono = :i, activo = :a WHERE id = :id")
                .param("g", grupo).param("i", icono).param("a", activo).param("id", id).update();
    }

    public void guardarNombreServicio(UUID id, String idioma, String nombre) {
        jdbc.sql("""
                INSERT INTO servicio_traduccion (servicio_id, idioma_codigo, nombre) VALUES (:s, :i, :n)
                ON CONFLICT (servicio_id, idioma_codigo) DO UPDATE SET nombre = EXCLUDED.nombre""")
                .param("s", id).param("i", idioma).param("n", nombre).update();
    }

    // ---------------- municipios y localidades (admin) ----------------

    public boolean regionExiste(UUID id) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM region WHERE id = :id)").param("id", id)
                .query(Boolean.class).single();
    }

    public boolean municipioExiste(UUID id) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM municipio WHERE id = :id)").param("id", id)
                .query(Boolean.class).single();
    }

    public UUID crearMunicipio(UUID regionId, String claveInegi, String nombre, Double lat, Double lng, boolean activo) {
        String punto = SqlGeo.punto(lat, lng);
        var q = jdbc.sql("""
                INSERT INTO municipio (region_id, clave_inegi, nombre, ubicacion, activo)
                VALUES (:r, :c, :n, %s, :a) RETURNING id""".formatted(punto))
                .param("r", regionId).param("c", claveInegi).param("n", nombre).param("a", activo);
        return SqlGeo.conPunto(q, lat, lng).query(UUID.class).single();
    }

    public int actualizarMunicipio(UUID id, UUID regionId, String claveInegi, String nombre, Double lat, Double lng,
                                   boolean activo) {
        String punto = SqlGeo.punto(lat, lng);
        var q = jdbc.sql("""
                UPDATE municipio SET region_id = :r, clave_inegi = :c, nombre = :n, ubicacion = %s, activo = :a
                WHERE id = :id""".formatted(punto))
                .param("r", regionId).param("c", claveInegi).param("n", nombre).param("a", activo).param("id", id);
        return SqlGeo.conPunto(q, lat, lng).update();
    }

    public UUID crearLocalidad(UUID municipioId, String nombre, Double lat, Double lng, boolean activo) {
        String punto = SqlGeo.punto(lat, lng);
        var q = jdbc.sql("""
                INSERT INTO localidad (municipio_id, nombre, ubicacion, activo)
                VALUES (:m, :n, %s, :a) RETURNING id""".formatted(punto))
                .param("m", municipioId).param("n", nombre).param("a", activo);
        return SqlGeo.conPunto(q, lat, lng).query(UUID.class).single();
    }

    public int actualizarLocalidad(UUID id, UUID municipioId, String nombre, Double lat, Double lng, boolean activo) {
        String punto = SqlGeo.punto(lat, lng);
        var q = jdbc.sql("""
                UPDATE localidad SET municipio_id = :m, nombre = :n, ubicacion = %s, activo = :a
                WHERE id = :id""".formatted(punto))
                .param("m", municipioId).param("n", nombre).param("a", activo).param("id", id);
        return SqlGeo.conPunto(q, lat, lng).update();
    }

    public static String escapar(String t) {
        return t.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
