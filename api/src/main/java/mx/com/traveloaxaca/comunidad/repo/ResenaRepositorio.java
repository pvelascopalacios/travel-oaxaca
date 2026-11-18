package mx.com.traveloaxaca.comunidad.repo;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class ResenaRepositorio {

    public record ResenaFila(UUID id, UUID negocioId, UUID usuarioId, int calificacion, String titulo, String texto,
                             LocalDate fechaVisita, String autorNombre, OffsetDateTime creadoEn, int utiles,
                             String estado, String respuestaTexto, OffsetDateTime respuestaCreadoEn,
                             OffsetDateTime respuestaActualizadoEn) {
    }

    public record MiResenaFila(UUID id, UUID negocioId, String negocioSlug, String negocioNombre, int calificacion,
                               String titulo, String texto, LocalDate fechaVisita, String estado, int utiles,
                               OffsetDateTime creadoEn) {
    }

    public record FotoFila(UUID resenaId, UUID medioId, String claveAlmacenamiento, String moderacion) {
    }

    public record DistribucionFila(int calificacion, int total) {
    }

    private static final String SELECT = """
            SELECT r.id, r.negocio_id, r.usuario_id, r.calificacion, r.titulo, r.texto, r.fecha_visita,
                   u.nombre AS autor_nombre, r.creado_en,
                   CAST((SELECT count(*) FROM reaccion x WHERE x.resena_id = r.id AND x.tipo = 'util') AS integer) AS utiles,
                   r.estado, rr.texto AS respuesta_texto, rr.creado_en AS respuesta_creado_en,
                   rr.actualizado_en AS respuesta_actualizado_en
            FROM resena r
            JOIN usuario u ON u.id = r.usuario_id
            LEFT JOIN respuesta_resena rr ON rr.resena_id = r.id
            """;

    private final JdbcClient jdbc;

    public ResenaRepositorio(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    // ---------------- negocio ----------------

    /** Id del negocio publicado con ese slug en el destino, si existe. */
    public Optional<UUID> negocioPublicadoPorSlug(String slug, String destino) {
        return jdbc.sql("""
                SELECT n.id FROM negocio n JOIN destino d ON d.id = n.destino_id AND d.codigo = :d
                WHERE n.slug = :s AND n.estado = 'publicada' AND n.eliminado_en IS NULL""")
                .param("s", slug).param("d", destino).query(UUID.class).optional();
    }

    public Optional<String> nombreNegocioPublicado(UUID negocioId) {
        return jdbc.sql("""
                SELECT nombre_comercial FROM negocio WHERE id = :id AND estado = 'publicada' AND eliminado_en IS NULL""")
                .param("id", negocioId).query(String.class).optional();
    }

    public boolean esMiembroActivo(UUID negocioId, UUID usuarioId) {
        return jdbc.sql("""
                SELECT EXISTS (SELECT 1 FROM membresia_negocio WHERE negocio_id = :n AND usuario_id = :u AND estado = 'activa')""")
                .param("n", negocioId).param("u", usuarioId).query(Boolean.class).single();
    }

    public boolean correoVerificado(UUID usuarioId) {
        return jdbc.sql("SELECT correo_verificado_en IS NOT NULL FROM usuario WHERE id = :u")
                .param("u", usuarioId).query(Boolean.class).optional().orElse(false);
    }

    // ---------------- lectura ----------------

    public List<ResenaFila> publicadas(UUID negocioId, String orden, int limite, int desplazamiento) {
        String order = switch (orden) {
            case "mejor" -> " ORDER BY r.calificacion DESC, r.creado_en DESC, r.id";
            case "peor" -> " ORDER BY r.calificacion ASC, r.creado_en DESC, r.id";
            case "utiles" -> " ORDER BY utiles DESC, r.creado_en DESC, r.id";
            default -> " ORDER BY r.creado_en DESC, r.id";
        };
        return jdbc.sql(SELECT + " WHERE r.negocio_id = :n AND r.estado = 'publicada' AND r.eliminado_en IS NULL" + order
                + " LIMIT :l OFFSET :o")
                .param("n", negocioId).param("l", limite).param("o", desplazamiento)
                .query(ResenaFila.class).list();
    }

    public long contarPublicadas(UUID negocioId) {
        return jdbc.sql("SELECT count(*) FROM resena_visible WHERE negocio_id = :n")
                .param("n", negocioId).query(Long.class).single();
    }

    public List<DistribucionFila> distribucion(UUID negocioId) {
        return jdbc.sql("""
                SELECT CAST(calificacion AS integer) AS calificacion, CAST(count(*) AS integer) AS total
                FROM resena_visible WHERE negocio_id = :n GROUP BY calificacion""")
                .param("n", negocioId).query(DistribucionFila.class).list();
    }

    public Optional<ResenaFila> porId(UUID id) {
        return jdbc.sql(SELECT + " WHERE r.id = :id AND r.eliminado_en IS NULL")
                .param("id", id).query(ResenaFila.class).optional();
    }

    public Optional<ResenaFila> deUsuario(UUID negocioId, UUID usuarioId) {
        return jdbc.sql(SELECT + " WHERE r.negocio_id = :n AND r.usuario_id = :u AND r.eliminado_en IS NULL")
                .param("n", negocioId).param("u", usuarioId).query(ResenaFila.class).optional();
    }

    /** Todas las reseñas de una persona (de la más reciente a la más antigua) con el negocio al que pertenecen. */
    public List<MiResenaFila> deUsuarioTodas(UUID usuarioId) {
        return jdbc.sql("""
                SELECT r.id, r.negocio_id, n.slug AS negocio_slug, n.nombre_comercial AS negocio_nombre, r.calificacion,
                       r.titulo, r.texto, r.fecha_visita, r.estado,
                       CAST((SELECT count(*) FROM reaccion x WHERE x.resena_id = r.id AND x.tipo = 'util') AS integer) AS utiles,
                       r.creado_en
                FROM resena r JOIN negocio n ON n.id = r.negocio_id
                WHERE r.usuario_id = :u AND r.eliminado_en IS NULL AND n.eliminado_en IS NULL
                ORDER BY r.creado_en DESC, r.id""")
                .param("u", usuarioId).query(MiResenaFila.class).list();
    }

    /** Fotos de varias reseñas. soloAprobadas = true para el público. */
    public List<FotoFila> fotos(List<UUID> resenaIds, boolean soloAprobadas) {
        if (resenaIds.isEmpty()) {
            return List.of();
        }
        return jdbc.sql("""
                SELECT rm.resena_id, me.id AS medio_id, me.clave_almacenamiento, me.moderacion
                FROM resena_medio rm JOIN medio me ON me.id = rm.medio_id
                WHERE rm.resena_id IN (:ids) AND me.eliminado_en IS NULL
                  AND (:aprobadas = false OR me.moderacion = 'aprobado')
                ORDER BY rm.resena_id, rm.orden, rm.creado_en""")
                .param("ids", resenaIds).param("aprobadas", soloAprobadas).query(FotoFila.class).list();
    }

    /** Todas las reseñas publicadas de un negocio, para su equipo (incluye las que aún no tienen respuesta). */
    public List<ResenaFila> paraEquipo(UUID negocioId, boolean soloSinResponder, int limite, int desplazamiento) {
        return jdbc.sql(SELECT + """
                 WHERE r.negocio_id = :n AND r.estado = 'publicada' AND r.eliminado_en IS NULL
                   AND (:sin = false OR rr.id IS NULL)
                 ORDER BY r.creado_en DESC, r.id LIMIT :l OFFSET :o""")
                .param("n", negocioId).param("sin", soloSinResponder).param("l", limite).param("o", desplazamiento)
                .query(ResenaFila.class).list();
    }

    public long contarParaEquipo(UUID negocioId, boolean soloSinResponder) {
        return jdbc.sql("""
                SELECT count(*) FROM resena r LEFT JOIN respuesta_resena rr ON rr.resena_id = r.id
                WHERE r.negocio_id = :n AND r.estado = 'publicada' AND r.eliminado_en IS NULL
                  AND (:sin = false OR rr.id IS NULL)""")
                .param("n", negocioId).param("sin", soloSinResponder).query(Long.class).single();
    }

    // ---------------- escritura ----------------

    public UUID crear(UUID negocioId, UUID usuarioId, int calificacion, String titulo, String texto,
                      LocalDate fechaVisita, String idioma, String estado) {
        return jdbc.sql("""
                INSERT INTO resena (negocio_id, usuario_id, calificacion, titulo, texto, fecha_visita, idioma_codigo,
                                    estado, auto_moderada)
                VALUES (:n, :u, :c, :t, :x, :f, :i, :e, :e = 'publicada')
                RETURNING id""")
                .param("n", negocioId).param("u", usuarioId).param("c", calificacion).param("t", titulo)
                .param("x", texto).param("f", fechaVisita).param("i", idioma).param("e", estado)
                .query(UUID.class).single();
    }

    public void actualizar(UUID id, int calificacion, String titulo, String texto, LocalDate fechaVisita,
                           String estado) {
        jdbc.sql("""
                UPDATE resena SET calificacion = :c, titulo = :t, texto = :x, fecha_visita = :f, estado = :e,
                                  auto_moderada = (:e = 'publicada'), moderada_por = NULL
                WHERE id = :id""")
                .param("c", calificacion).param("t", titulo).param("x", texto).param("f", fechaVisita)
                .param("e", estado).param("id", id).update();
    }

    public void eliminar(UUID id) {
        jdbc.sql("UPDATE resena SET eliminado_en = now() WHERE id = :id").param("id", id).update();
    }

    public int contarFotos(UUID resenaId) {
        return jdbc.sql("""
                SELECT CAST(count(*) AS integer) FROM resena_medio rm JOIN medio me ON me.id = rm.medio_id
                WHERE rm.resena_id = :r AND me.eliminado_en IS NULL""")
                .param("r", resenaId).query(Integer.class).single();
    }

    public record MedioSubido(UUID id, String tipo, String hash, UUID subidoPor, String moderacion, boolean enUso) {
    }

    public Optional<MedioSubido> medioSubido(UUID medioId) {
        return jdbc.sql("""
                SELECT me.id, me.tipo, me.hash, me.subido_por, me.moderacion,
                       (EXISTS (SELECT 1 FROM resena_medio WHERE medio_id = me.id)
                        OR EXISTS (SELECT 1 FROM negocio_medio WHERE medio_id = me.id)) AS en_uso
                FROM medio me WHERE me.id = :id AND me.eliminado_en IS NULL""")
                .param("id", medioId).query(MedioSubido.class).optional();
    }

    public void agregarFoto(UUID resenaId, UUID medioId, int orden) {
        jdbc.sql("INSERT INTO resena_medio (resena_id, medio_id, orden) VALUES (:r, :m, :o)")
                .param("r", resenaId).param("m", medioId).param("o", orden).update();
    }

    public boolean quitarFoto(UUID resenaId, UUID medioId) {
        return jdbc.sql("DELETE FROM resena_medio WHERE resena_id = :r AND medio_id = :m")
                .param("r", resenaId).param("m", medioId).update() > 0;
    }

    // ---------------- respuesta del negocio ----------------

    public void guardarRespuesta(UUID resenaId, UUID usuarioId, String texto) {
        int n = jdbc.sql("UPDATE respuesta_resena SET texto = :t, actualizado_en = now() WHERE resena_id = :r")
                .param("t", texto).param("r", resenaId).update();
        if (n == 0) {
            jdbc.sql("INSERT INTO respuesta_resena (resena_id, usuario_id, texto) VALUES (:r, :u, :t)")
                    .param("r", resenaId).param("u", usuarioId).param("t", texto).update();
        }
    }

    // ---------------- avisos al equipo ----------------

    /** Aviso interno para el equipo del negocio (aparece en su portal). */
    public void avisarNuevaResena(UUID negocioId, String nombreNegocio) {
        jdbc.sql("""
                INSERT INTO notificacion (negocio_id, plantilla_clave, canal, datos)
                VALUES (:n, 'resena_nueva', 'interna', jsonb_build_object('negocio', CAST(:nombre AS text)))""")
                .param("n", negocioId).param("nombre", nombreNegocio).update();
    }
}
