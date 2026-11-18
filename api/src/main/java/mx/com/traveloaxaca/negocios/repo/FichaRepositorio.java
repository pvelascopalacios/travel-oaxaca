package mx.com.traveloaxaca.negocios.repo;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Todo lo que cuelga de la ficha: textos, sucursales, contactos, horarios, servicios, idiomas y fotos. */
@Repository
public class FichaRepositorio {

    public record TraduccionFila(String idiomaCodigo, String descripcionCorta, String descripcion, String politicas) {
    }

    public record SucursalFila(UUID id, String nombre, boolean esPrincipal, UUID municipioId, String municipioNombre,
                               UUID localidadId, String direccionTexto, String referencia, Double latitud,
                               Double longitud) {
    }

    public record HorarioFila(UUID sucursalId, int diaSemana, String abre, String cierra, boolean cerrado) {
    }

    public record ExcepcionFila(UUID sucursalId, LocalDate fecha, String abre, String cierra, boolean cerrado,
                                String nota) {
    }

    public record ContactoFila(UUID id, UUID sucursalId, String tipo, String valor, boolean esPrincipal) {
    }

    public record IdiomaFila(String idiomaCodigo, String nivel) {
    }

    public record MedioFila(UUID medioId, String claveAlmacenamiento, int orden, boolean esPortada, String pieTexto,
                            String moderacion, String motivoRechazo) {
    }

    private final JdbcClient jdbc;

    public FichaRepositorio(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    // ---------------- traducciones ----------------

    public List<TraduccionFila> traducciones(UUID negocioId) {
        return jdbc.sql("""
                SELECT idioma_codigo, descripcion_corta, descripcion, politicas
                FROM negocio_traduccion WHERE negocio_id = :n ORDER BY idioma_codigo""")
                .param("n", negocioId).query(TraduccionFila.class).list();
    }

    public Optional<TraduccionFila> traduccion(UUID negocioId, String idioma) {
        return jdbc.sql("""
                SELECT idioma_codigo, descripcion_corta, descripcion, politicas
                FROM negocio_traduccion WHERE negocio_id = :n AND idioma_codigo = :i""")
                .param("n", negocioId).param("i", idioma).query(TraduccionFila.class).optional();
    }

    public void guardarTraduccion(UUID negocioId, String idioma, String corta, String descripcion, String politicas) {
        jdbc.sql("""
                INSERT INTO negocio_traduccion (negocio_id, idioma_codigo, descripcion_corta, descripcion, politicas)
                VALUES (:n, :i, :c, :d, :p)
                ON CONFLICT (negocio_id, idioma_codigo) DO UPDATE
                SET descripcion_corta = EXCLUDED.descripcion_corta, descripcion = EXCLUDED.descripcion,
                    politicas = EXCLUDED.politicas""")
                .param("n", negocioId).param("i", idioma).param("c", corta).param("d", descripcion)
                .param("p", politicas).update();
    }

    // ---------------- sucursales ----------------

    private static final String SUCURSAL = """
            SELECT s.id, s.nombre, s.es_principal, s.municipio_id, mu.nombre AS municipio_nombre, s.localidad_id,
                   s.direccion_texto, s.referencia, ST_Y(s.ubicacion::geometry) AS latitud,
                   ST_X(s.ubicacion::geometry) AS longitud
            FROM sucursal s JOIN municipio mu ON mu.id = s.municipio_id""";

    public List<SucursalFila> sucursales(UUID negocioId) {
        return jdbc.sql(SUCURSAL + " WHERE s.negocio_id = :n AND s.eliminado_en IS NULL ORDER BY s.es_principal DESC, s.creado_en")
                .param("n", negocioId).query(SucursalFila.class).list();
    }

    public Optional<SucursalFila> sucursal(UUID negocioId, UUID sucursalId) {
        return jdbc.sql(SUCURSAL + " WHERE s.negocio_id = :n AND s.id = :s AND s.eliminado_en IS NULL")
                .param("n", negocioId).param("s", sucursalId).query(SucursalFila.class).optional();
    }

    public long contarSucursales(UUID negocioId) {
        return jdbc.sql("SELECT count(*) FROM sucursal WHERE negocio_id = :n AND eliminado_en IS NULL")
                .param("n", negocioId).query(Long.class).single();
    }

    public boolean localidadEsDeMunicipio(UUID localidadId, UUID municipioId) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM localidad WHERE id = :l AND municipio_id = :m AND activo)")
                .param("l", localidadId).param("m", municipioId).query(Boolean.class).single();
    }

    public boolean municipioActivo(UUID municipioId) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM municipio WHERE id = :m AND activo)")
                .param("m", municipioId).query(Boolean.class).single();
    }

    public UUID crearSucursal(UUID negocioId, String nombre, boolean principal, UUID municipioId, UUID localidadId,
                              String direccion, String referencia, Double lat, Double lng) {
        String punto = SqlGeo.punto(lat, lng);
        var q = jdbc.sql("""
                INSERT INTO sucursal (negocio_id, nombre, es_principal, municipio_id, localidad_id, direccion_texto,
                                      referencia, ubicacion)
                VALUES (:n, :nom, :p, :m, :l, :d, :r, %s) RETURNING id""".formatted(punto))
                .param("n", negocioId).param("nom", nombre).param("p", principal).param("m", municipioId)
                .param("l", localidadId).param("d", direccion).param("r", referencia);
        return SqlGeo.conPunto(q, lat, lng).query(UUID.class).single();
    }

    public void actualizarSucursal(UUID sucursalId, String nombre, UUID municipioId, UUID localidadId,
                                   String direccion, String referencia, Double lat, Double lng) {
        String punto = SqlGeo.punto(lat, lng);
        var q = jdbc.sql("""
                UPDATE sucursal SET nombre = :nom, municipio_id = :m, localidad_id = :l, direccion_texto = :d,
                       referencia = :r, ubicacion = %s WHERE id = :id""".formatted(punto))
                .param("nom", nombre).param("m", municipioId).param("l", localidadId).param("d", direccion)
                .param("r", referencia).param("id", sucursalId);
        SqlGeo.conPunto(q, lat, lng).update();
    }

    /** Actualiza todo menos la ubicación (cuando esa parte espera revisión). */
    public void actualizarSucursalSinUbicacion(UUID sucursalId, String nombre, UUID municipioId, UUID localidadId,
                                               String direccion, String referencia) {
        jdbc.sql("""
                UPDATE sucursal SET nombre = :nom, municipio_id = :m, localidad_id = :l, direccion_texto = :d,
                       referencia = :r WHERE id = :id""")
                .param("nom", nombre).param("m", municipioId).param("l", localidadId).param("d", direccion)
                .param("r", referencia).param("id", sucursalId).update();
    }

    public void quitarPrincipalDeOtras(UUID negocioId, UUID excepto) {
        jdbc.sql("UPDATE sucursal SET es_principal = false WHERE negocio_id = :n AND es_principal AND id <> :s")
                .param("n", negocioId).param("s", excepto).update();
    }

    public void marcarPrincipal(UUID sucursalId) {
        jdbc.sql("UPDATE sucursal SET es_principal = true WHERE id = :s").param("s", sucursalId).update();
    }

    public void eliminarSucursal(UUID sucursalId) {
        jdbc.sql("UPDATE contacto SET sucursal_id = NULL WHERE sucursal_id = :s").param("s", sucursalId).update();
        jdbc.sql("UPDATE sucursal SET eliminado_en = now(), es_principal = false WHERE id = :s")
                .param("s", sucursalId).update();
    }

    // ---------------- horarios ----------------

    public List<HorarioFila> horarios(UUID negocioId) {
        return jdbc.sql("""
                SELECT h.sucursal_id, h.dia_semana, to_char(h.abre, 'HH24:MI') AS abre,
                       to_char(h.cierra, 'HH24:MI') AS cierra, h.cerrado
                FROM horario h JOIN sucursal s ON s.id = h.sucursal_id
                WHERE s.negocio_id = :n AND s.eliminado_en IS NULL ORDER BY h.sucursal_id, h.dia_semana, h.abre""")
                .param("n", negocioId).query(HorarioFila.class).list();
    }

    public void reemplazarHorarios(UUID sucursalId, List<HorarioFila> nuevos) {
        jdbc.sql("DELETE FROM horario WHERE sucursal_id = :s").param("s", sucursalId).update();
        for (HorarioFila h : nuevos) {
            jdbc.sql("""
                    INSERT INTO horario (sucursal_id, dia_semana, abre, cierra, cerrado)
                    VALUES (:s, :d, :a, :c, :x)""")
                    .param("s", sucursalId).param("d", h.diaSemana())
                    .param("a", h.abre() == null ? null : LocalTime.parse(h.abre()))
                    .param("c", h.cierra() == null ? null : LocalTime.parse(h.cierra()))
                    .param("x", h.cerrado()).update();
        }
    }

    public List<ExcepcionFila> excepciones(UUID negocioId) {
        return jdbc.sql("""
                SELECT e.sucursal_id, e.fecha, to_char(e.abre, 'HH24:MI') AS abre, to_char(e.cierra, 'HH24:MI') AS cierra,
                       e.cerrado, e.nota
                FROM horario_excepcion e JOIN sucursal s ON s.id = e.sucursal_id
                WHERE s.negocio_id = :n AND s.eliminado_en IS NULL AND e.fecha >= current_date
                ORDER BY e.sucursal_id, e.fecha""")
                .param("n", negocioId).query(ExcepcionFila.class).list();
    }

    public void reemplazarExcepciones(UUID sucursalId, List<ExcepcionFila> nuevas) {
        jdbc.sql("DELETE FROM horario_excepcion WHERE sucursal_id = :s").param("s", sucursalId).update();
        for (ExcepcionFila e : nuevas) {
            jdbc.sql("""
                    INSERT INTO horario_excepcion (sucursal_id, fecha, abre, cierra, cerrado, nota)
                    VALUES (:s, :f, :a, :c, :x, :n)""")
                    .param("s", sucursalId).param("f", e.fecha())
                    .param("a", e.abre() == null ? null : LocalTime.parse(e.abre()))
                    .param("c", e.cierra() == null ? null : LocalTime.parse(e.cierra()))
                    .param("x", e.cerrado()).param("n", e.nota()).update();
        }
    }

    // ---------------- contactos ----------------

    public List<ContactoFila> contactos(UUID negocioId) {
        return jdbc.sql("""
                SELECT id, sucursal_id, tipo, valor, es_principal FROM contacto
                WHERE negocio_id = :n AND eliminado_en IS NULL ORDER BY tipo, creado_en""")
                .param("n", negocioId).query(ContactoFila.class).list();
    }

    public Optional<ContactoFila> contacto(UUID negocioId, UUID contactoId) {
        return jdbc.sql("""
                SELECT id, sucursal_id, tipo, valor, es_principal FROM contacto
                WHERE negocio_id = :n AND id = :c AND eliminado_en IS NULL""")
                .param("n", negocioId).param("c", contactoId).query(ContactoFila.class).optional();
    }

    public long contarContactos(UUID negocioId) {
        return jdbc.sql("SELECT count(*) FROM contacto WHERE negocio_id = :n AND eliminado_en IS NULL")
                .param("n", negocioId).query(Long.class).single();
    }

    public void quitarPrincipalDeTipo(UUID negocioId, String tipo, UUID excepto) {
        if (excepto == null) {
            jdbc.sql("""
                    UPDATE contacto SET es_principal = false
                    WHERE negocio_id = :n AND tipo = :t AND es_principal AND eliminado_en IS NULL""")
                    .param("n", negocioId).param("t", tipo).update();
        } else {
            jdbc.sql("""
                    UPDATE contacto SET es_principal = false
                    WHERE negocio_id = :n AND tipo = :t AND es_principal AND eliminado_en IS NULL AND id <> :x""")
                    .param("n", negocioId).param("t", tipo).param("x", excepto).update();
        }
    }

    public boolean hayContactoDeTipo(UUID negocioId, String tipo) {
        return jdbc.sql("""
                SELECT EXISTS (SELECT 1 FROM contacto WHERE negocio_id = :n AND tipo = :t AND eliminado_en IS NULL)""")
                .param("n", negocioId).param("t", tipo).query(Boolean.class).single();
    }

    public UUID crearContacto(UUID negocioId, UUID sucursalId, String tipo, String valor, boolean principal) {
        return jdbc.sql("""
                INSERT INTO contacto (negocio_id, sucursal_id, tipo, valor, es_principal)
                VALUES (:n, :s, :t, :v, :p) RETURNING id""")
                .param("n", negocioId).param("s", sucursalId).param("t", tipo).param("v", valor)
                .param("p", principal).query(UUID.class).single();
    }

    public void actualizarContacto(UUID id, UUID sucursalId, String tipo, String valor, boolean principal) {
        jdbc.sql("""
                UPDATE contacto SET sucursal_id = :s, tipo = :t, valor = :v, es_principal = :p, verificado_en = NULL
                WHERE id = :id""")
                .param("s", sucursalId).param("t", tipo).param("v", valor).param("p", principal).param("id", id).update();
    }

    public void eliminarContacto(UUID id) {
        jdbc.sql("UPDATE contacto SET eliminado_en = now(), es_principal = false WHERE id = :id")
                .param("id", id).update();
    }

    // ---------------- servicios e idiomas ----------------

    public List<UUID> servicioIds(UUID negocioId) {
        return jdbc.sql("SELECT servicio_id FROM negocio_servicio WHERE negocio_id = :n ORDER BY servicio_id")
                .param("n", negocioId).query(UUID.class).list();
    }

    public long contarServiciosActivos(List<UUID> ids) {
        if (ids.isEmpty()) {
            return 0;
        }
        return jdbc.sql("SELECT count(*) FROM servicio WHERE activo AND id IN (:ids)")
                .param("ids", ids).query(Long.class).single();
    }

    public void reemplazarServicios(UUID negocioId, List<UUID> ids) {
        jdbc.sql("DELETE FROM negocio_servicio WHERE negocio_id = :n").param("n", negocioId).update();
        for (UUID id : ids) {
            jdbc.sql("INSERT INTO negocio_servicio (negocio_id, servicio_id) VALUES (:n, :s)")
                    .param("n", negocioId).param("s", id).update();
        }
    }

    public List<IdiomaFila> idiomas(UUID negocioId) {
        return jdbc.sql("SELECT idioma_codigo, nivel FROM negocio_idioma WHERE negocio_id = :n ORDER BY idioma_codigo")
                .param("n", negocioId).query(IdiomaFila.class).list();
    }

    public void reemplazarIdiomas(UUID negocioId, List<IdiomaFila> idiomas) {
        jdbc.sql("DELETE FROM negocio_idioma WHERE negocio_id = :n").param("n", negocioId).update();
        for (IdiomaFila i : idiomas) {
            jdbc.sql("INSERT INTO negocio_idioma (negocio_id, idioma_codigo, nivel) VALUES (:n, :i, :v)")
                    .param("n", negocioId).param("i", i.idiomaCodigo()).param("v", i.nivel()).update();
        }
    }

    // ---------------- fotos de la ficha ----------------

    public List<MedioFila> medios(UUID negocioId) {
        return jdbc.sql("""
                SELECT nm.medio_id, m.clave_almacenamiento, nm.orden, nm.es_portada, nm.pie_texto, m.moderacion, m.motivo_rechazo
                FROM negocio_medio nm JOIN medio m ON m.id = nm.medio_id
                WHERE nm.negocio_id = :n AND m.eliminado_en IS NULL ORDER BY nm.orden, nm.creado_en""")
                .param("n", negocioId).query(MedioFila.class).list();
    }

    public long contarMedios(UUID negocioId) {
        return jdbc.sql("""
                SELECT count(*) FROM negocio_medio nm JOIN medio m ON m.id = nm.medio_id
                WHERE nm.negocio_id = :n AND m.eliminado_en IS NULL""")
                .param("n", negocioId).query(Long.class).single();
    }

    public boolean medioYaVinculado(UUID negocioId, UUID medioId) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM negocio_medio WHERE negocio_id = :n AND medio_id = :m)")
                .param("n", negocioId).param("m", medioId).query(Boolean.class).single();
    }

    public void agregarMedio(UUID negocioId, UUID medioId, int orden, boolean portada, String pie) {
        jdbc.sql("""
                INSERT INTO negocio_medio (negocio_id, medio_id, orden, es_portada, pie_texto)
                VALUES (:n, :m, :o, :p, :t)""")
                .param("n", negocioId).param("m", medioId).param("o", orden).param("p", portada).param("t", pie).update();
    }

    public int quitarMedio(UUID negocioId, UUID medioId) {
        return jdbc.sql("DELETE FROM negocio_medio WHERE negocio_id = :n AND medio_id = :m")
                .param("n", negocioId).param("m", medioId).update();
    }

    public void ponerOrden(UUID negocioId, UUID medioId, int orden) {
        jdbc.sql("UPDATE negocio_medio SET orden = :o WHERE negocio_id = :n AND medio_id = :m")
                .param("o", orden).param("n", negocioId).param("m", medioId).update();
    }

    public void ponerPortada(UUID negocioId, UUID medioId) {
        jdbc.sql("UPDATE negocio_medio SET es_portada = false WHERE negocio_id = :n AND es_portada")
                .param("n", negocioId).update();
        if (medioId != null) {
            jdbc.sql("UPDATE negocio_medio SET es_portada = true WHERE negocio_id = :n AND medio_id = :m")
                    .param("n", negocioId).param("m", medioId).update();
        }
    }

    public long contarFotosAprobadas(UUID negocioId) {
        return jdbc.sql("""
                SELECT count(*) FROM negocio_medio nm JOIN medio m ON m.id = nm.medio_id
                WHERE nm.negocio_id = :n AND m.tipo = 'imagen' AND m.moderacion = 'aprobado' AND m.eliminado_en IS NULL""")
                .param("n", negocioId).query(Long.class).single();
    }

    public long contarFotosNoRechazadas(UUID negocioId) {
        return jdbc.sql("""
                SELECT count(*) FROM negocio_medio nm JOIN medio m ON m.id = nm.medio_id
                WHERE nm.negocio_id = :n AND m.tipo = 'imagen' AND m.moderacion <> 'rechazado' AND m.eliminado_en IS NULL""")
                .param("n", negocioId).query(Long.class).single();
    }

    public int fotosMinimas() {
        return jdbc.sql("SELECT fotos_minimas_publicar()").query(Integer.class).single();
    }

    public long contarOfertasPublicables(UUID negocioId) {
        return jdbc.sql("SELECT count(*) FROM oferta WHERE negocio_id = :n AND eliminado_en IS NULL AND estado <> 'archivada'")
                .param("n", negocioId).query(Long.class).single();
    }

    public long contarHorarios(UUID negocioId) {
        return jdbc.sql("""
                SELECT count(*) FROM horario h JOIN sucursal s ON s.id = h.sucursal_id
                WHERE s.negocio_id = :n AND s.eliminado_en IS NULL""")
                .param("n", negocioId).query(Long.class).single();
    }
}
