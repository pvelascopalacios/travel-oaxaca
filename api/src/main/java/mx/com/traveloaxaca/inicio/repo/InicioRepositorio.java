package mx.com.traveloaxaca.inicio.repo;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import mx.com.traveloaxaca.inicio.dto.InicioDtos.BloqueEntradaDto;
import mx.com.traveloaxaca.inicio.dto.InicioDtos.TextoBloqueDto;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class InicioRepositorio {

    public record BloqueFila(UUID id, String tipo, int orden, String estado, LocalDate publicarDesde,
                             LocalDate publicarHasta, UUID medioId, String fotoClave, String credito, String ruta,
                             String enlace, Integer comunidades, String saludo, String saludoIdioma,
                             String saludoVerificadoPor, String persona, String lugarTexto, UUID negocioId,
                             boolean permisoConfirmado, OffsetDateTime actualizadoEn) {
    }

    public record ResumenFila(UUID id, String tipo, int orden, String estado, String titulo, LocalDate publicarDesde,
                              LocalDate publicarHasta) {
    }

    public record TextoFila(String idiomaCodigo, String etiqueta, String titulo, String texto, String boton) {
    }

    public record PublicaFila(UUID id, String tipo, String etiqueta, String titulo, String texto, String boton,
                              String fotoClave, String credito, String ruta, String enlace, Integer comunidades,
                              String saludo, String saludoIdioma, String persona, String lugarTexto,
                              String negocioSlug) {
    }

    private final JdbcClient jdbc;

    public InicioRepositorio(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<UUID> destinoPorDefecto() {
        return jdbc.sql("SELECT id FROM destino WHERE activo ORDER BY creado_en LIMIT 1").query(UUID.class).optional();
    }

    public boolean medioValido(UUID id) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM medio WHERE id = :id AND tipo = 'imagen' AND hash IS NOT NULL AND eliminado_en IS NULL)")
                .param("id", id).query(Boolean.class).single();
    }

    public boolean negocioExiste(UUID id) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM negocio WHERE id = :id AND eliminado_en IS NULL)")
                .param("id", id).query(Boolean.class).single();
    }

    public boolean idiomaIndigena(String codigo) {
        return jdbc.sql("SELECT COALESCE((SELECT es_indigena FROM idioma WHERE codigo = :c), false)")
                .param("c", codigo).query(Boolean.class).single();
    }

    public void aprobarMedio(UUID medioId, UUID revisor) {
        jdbc.sql("UPDATE medio SET moderacion = 'aprobado', revisado_por = :r, revisado_en = now() WHERE id = :m AND moderacion <> 'aprobado'")
                .param("r", revisor).param("m", medioId).update();
    }

    // ---------------- escritura ----------------

    public void insertar(UUID id, UUID destino, String tipo) {
        jdbc.sql("INSERT INTO inicio_bloque (id, destino_id, tipo) VALUES (:id, :d, :t)")
                .param("id", id).param("d", destino).param("t", tipo).update();
    }

    public void cambiarEstado(UUID id, String estado) {
        jdbc.sql("UPDATE inicio_bloque SET estado = :e WHERE id = :id").param("e", estado).param("id", id).update();
    }

    public void guardar(UUID id, BloqueEntradaDto e) {
        Map<String, Object> p = new HashMap<>();
        p.put("id", id);
        p.put("orden", e.orden() == null ? 0 : e.orden());
        p.put("desde", e.publicarDesde());
        p.put("hasta", e.publicarHasta());
        p.put("medio", e.medioId());
        p.put("credito", e.credito());
        p.put("ruta", e.ruta());
        p.put("enlace", e.enlace());
        p.put("comunidades", e.comunidades());
        p.put("saludo", e.saludo());
        p.put("saludoIdioma", e.saludoIdioma());
        p.put("verificadoPor", e.saludoVerificadoPor());
        p.put("persona", e.persona());
        p.put("lugar", e.lugar());
        p.put("negocio", e.negocioId());
        p.put("permiso", e.permisoConfirmado());
        jdbc.sql("""
                UPDATE inicio_bloque SET orden = :orden, publicar_desde = :desde, publicar_hasta = :hasta,
                       medio_id = :medio, credito = :credito, ruta = :ruta, enlace = :enlace,
                       comunidades = :comunidades, saludo = :saludo, saludo_idioma = :saludoIdioma,
                       saludo_verificado_por = :verificadoPor, persona = :persona, lugar_texto = :lugar,
                       negocio_id = :negocio, permiso_confirmado = :permiso
                WHERE id = :id AND eliminado_en IS NULL""").params(p).update();
    }

    public void reemplazarTextos(UUID id, Map<String, TextoBloqueDto> textos) {
        jdbc.sql("DELETE FROM inicio_bloque_traduccion WHERE bloque_id = :id").param("id", id).update();
        textos.forEach((idioma, t) -> jdbc.sql("""
                INSERT INTO inicio_bloque_traduccion (bloque_id, idioma_codigo, etiqueta, titulo, texto, boton)
                VALUES (:id, :i, :e, :t, :x, :b)""")
                .param("id", id).param("i", idioma).param("e", t.etiqueta()).param("t", t.titulo())
                .param("x", t.texto()).param("b", t.boton()).update());
    }

    public void archivar(UUID id) {
        jdbc.sql("UPDATE inicio_bloque SET estado = 'archivado', eliminado_en = now() WHERE id = :id AND eliminado_en IS NULL")
                .param("id", id).update();
    }

    // ---------------- lectura (panel) ----------------

    public boolean estaActivo(UUID id) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM inicio_bloque WHERE id = :id AND eliminado_en IS NULL)")
                .param("id", id).query(Boolean.class).single();
    }

    public Optional<BloqueFila> fila(UUID id) {
        return jdbc.sql("""
                SELECT b.id, b.tipo, b.orden, b.estado, b.publicar_desde, b.publicar_hasta, b.medio_id,
                       me.clave_almacenamiento AS foto_clave, b.credito, b.ruta, b.enlace, b.comunidades, b.saludo,
                       b.saludo_idioma, b.saludo_verificado_por, b.persona, b.lugar_texto, b.negocio_id,
                       b.permiso_confirmado, b.actualizado_en
                FROM inicio_bloque b LEFT JOIN medio me ON me.id = b.medio_id AND me.eliminado_en IS NULL
                WHERE b.id = :id AND b.eliminado_en IS NULL""").param("id", id).query(BloqueFila.class).optional();
    }

    public List<TextoFila> textos(UUID id) {
        return jdbc.sql("SELECT idioma_codigo, etiqueta, titulo, texto, boton FROM inicio_bloque_traduccion WHERE bloque_id = :id ORDER BY idioma_codigo")
                .param("id", id).query(TextoFila.class).list();
    }

    private static final String RESUMEN = """
            SELECT b.id, b.tipo, b.orden, b.estado, COALESCE(te.titulo, '(sin título)') AS titulo,
                   b.publicar_desde, b.publicar_hasta
            FROM inicio_bloque b
            LEFT JOIN inicio_bloque_traduccion te ON te.bloque_id = b.id AND te.idioma_codigo = 'es'
            WHERE b.eliminado_en IS NULL AND (CAST(:tipo AS text) IS NULL OR b.tipo = :tipo)
              AND (CAST(:estado AS text) IS NULL OR b.estado = :estado)""";

    public List<ResumenFila> listar(String tipo, String estado, int limite, int desplazamiento) {
        return jdbc.sql(RESUMEN + " ORDER BY b.tipo, b.orden, b.creado_en, b.id LIMIT :limite OFFSET :desp")
                .param("tipo", tipo).param("estado", estado).param("limite", limite).param("desp", desplazamiento)
                .query(ResumenFila.class).list();
    }

    public long contar(String tipo, String estado) {
        return jdbc.sql("SELECT count(*) FROM (" + RESUMEN + ") x").param("tipo", tipo).param("estado", estado)
                .query(Long.class).single();
    }

    // ---------------- lectura (pública) ----------------

    /** Solo lo publicado, vigente hoy, con texto en español y con foto aprobada. */
    public List<PublicaFila> publicas(String destino, String idioma, LocalDate hoy) {
        return jdbc.sql("""
                SELECT b.id, b.tipo, COALESCE(t.etiqueta, te.etiqueta) AS etiqueta, COALESCE(t.titulo, te.titulo) AS titulo,
                       COALESCE(t.texto, te.texto) AS texto, COALESCE(t.boton, te.boton) AS boton,
                       me.clave_almacenamiento AS foto_clave, b.credito, b.ruta, b.enlace, b.comunidades, b.saludo,
                       b.saludo_idioma, b.persona, b.lugar_texto, n.slug AS negocio_slug
                FROM inicio_bloque b
                JOIN destino d ON d.id = b.destino_id AND d.codigo = :destino
                JOIN inicio_bloque_traduccion te ON te.bloque_id = b.id AND te.idioma_codigo = 'es'
                LEFT JOIN inicio_bloque_traduccion t ON t.bloque_id = b.id AND t.idioma_codigo = :idioma
                JOIN medio me ON me.id = b.medio_id AND me.tipo = 'imagen' AND me.moderacion = 'aprobado' AND me.eliminado_en IS NULL
                LEFT JOIN negocio n ON n.id = b.negocio_id AND n.estado = 'publicada' AND n.eliminado_en IS NULL
                WHERE b.estado = 'publicado' AND b.eliminado_en IS NULL
                  AND (b.publicar_desde IS NULL OR b.publicar_desde <= :hoy)
                  AND (b.publicar_hasta IS NULL OR b.publicar_hasta >= :hoy)
                ORDER BY b.tipo, b.orden, b.creado_en, b.id""")
                .param("destino", destino).param("idioma", idioma).param("hoy", hoy)
                .query(PublicaFila.class).list();
    }
}
