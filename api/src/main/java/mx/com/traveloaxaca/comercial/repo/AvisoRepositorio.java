package mx.com.traveloaxaca.comercial.repo;

import java.time.LocalDate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/**
 * Avisos automáticos por correo. Cada consulta inserta solo lo que todavía no se avisó (la marca va en los datos de
 * la notificación), así que repetir el trabajo no manda dos veces lo mismo.
 */
@Repository
public class AvisoRepositorio {

    /** El propietario activo del negocio: a él le llegan los avisos. */
    private static final String PROPIETARIO = """
            JOIN LATERAL (SELECT u.id AS usuario_id, u.nombre
                          FROM membresia_negocio m JOIN usuario u ON u.id = m.usuario_id
                          WHERE m.negocio_id = %s AND m.rol = 'propietario' AND m.estado = 'activa'
                          ORDER BY m.creado_en LIMIT 1) own ON true""";

    private final JdbcClient jdbc;

    public AvisoRepositorio(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Suscripciones activas a las que les quedan entre minDias y maxDias; hito identifica el aviso (15, 3...). */
    public int suscripcionPorVencer(LocalDate hoy, int minDias, int maxDias, int hito) {
        return jdbc.sql("""
                INSERT INTO notificacion (usuario_id, negocio_id, plantilla_clave, canal, datos)
                SELECT own.usuario_id, s.negocio_id, 'suscripcion_por_vencer', 'correo',
                       jsonb_build_object('nombre', own.nombre, 'plan', p.nombre, 'negocio', n.nombre_comercial,
                                          'fecha', to_char(s.fin, 'DD/MM/YYYY'), 'suscripcion_id', CAST(s.id AS text),
                                          'hito', CAST(:hito AS text))
                FROM suscripcion s
                JOIN plan p ON p.id = s.plan_id
                JOIN negocio n ON n.id = s.negocio_id
                """ + PROPIETARIO.formatted("s.negocio_id") + """

                WHERE s.estado = 'activa' AND (s.fin - CAST(:hoy AS date)) BETWEEN :min AND :max
                  AND NOT EXISTS (SELECT 1 FROM notificacion x
                                  WHERE x.negocio_id = s.negocio_id AND x.plantilla_clave = 'suscripcion_por_vencer'
                                    AND x.datos ->> 'suscripcion_id' = CAST(s.id AS text)
                                    AND x.datos ->> 'hito' = CAST(:hito AS text))""")
                .param("hoy", hoy).param("min", minDias).param("max", maxDias).param("hito", hito).update();
    }

    public int suscripcionEnGracia() {
        return jdbc.sql("""
                INSERT INTO notificacion (usuario_id, negocio_id, plantilla_clave, canal, datos)
                SELECT own.usuario_id, s.negocio_id, 'suscripcion_en_gracia', 'correo',
                       jsonb_build_object('nombre', own.nombre, 'negocio', n.nombre_comercial,
                                          'fecha', to_char(s.gracia_hasta, 'DD/MM/YYYY'),
                                          'suscripcion_id', CAST(s.id AS text))
                FROM suscripcion s
                JOIN negocio n ON n.id = s.negocio_id
                """ + PROPIETARIO.formatted("s.negocio_id") + """

                WHERE s.estado = 'gracia'
                  AND NOT EXISTS (SELECT 1 FROM notificacion x
                                  WHERE x.negocio_id = s.negocio_id AND x.plantilla_clave = 'suscripcion_en_gracia'
                                    AND x.datos ->> 'suscripcion_id' = CAST(s.id AS text))""").update();
    }

    public int patrocinioPorTerminar(LocalDate hoy, int dias) {
        return jdbc.sql("""
                INSERT INTO notificacion (usuario_id, negocio_id, plantilla_clave, canal, datos)
                SELECT own.usuario_id, p.negocio_id, 'patrocinio_por_terminar', 'correo',
                       jsonb_build_object('nombre', own.nombre, 'negocio', n.nombre_comercial,
                                          'fecha', to_char(p.fin, 'DD/MM/YYYY'), 'patrocinio_id', CAST(p.id AS text))
                FROM patrocinio p
                JOIN negocio n ON n.id = p.negocio_id
                """ + PROPIETARIO.formatted("p.negocio_id") + """

                WHERE p.estado = 'activo' AND (p.fin - CAST(:hoy AS date)) BETWEEN 0 AND :dias
                  AND NOT EXISTS (SELECT 1 FROM notificacion x
                                  WHERE x.negocio_id = p.negocio_id AND x.plantilla_clave = 'patrocinio_por_terminar'
                                    AND x.datos ->> 'patrocinio_id' = CAST(p.id AS text))""")
                .param("hoy", hoy).param("dias", dias).update();
    }

    /**
     * Avisa que ya hay reporte mensual, solo a negocios con plan que lo incluye, y marca el reporte como enviado
     * (esa marca se puede poner una sola vez). Devuelve cuántos avisos puso en la cola.
     */
    public int reportesMensuales() {
        int avisos = jdbc.sql("""
                INSERT INTO notificacion (usuario_id, negocio_id, plantilla_clave, canal, datos)
                SELECT own.usuario_id, r.negocio_id, 'reporte_mensual', 'correo',
                       jsonb_build_object('nombre', own.nombre, 'negocio', n.nombre_comercial,
                                          'mes', (ARRAY['enero','febrero','marzo','abril','mayo','junio','julio','agosto',
                                                        'septiembre','octubre','noviembre','diciembre'])[r.mes] || ' de ' || r.anio,
                                          'reporte_id', CAST(r.id AS text))
                FROM reporte_mensual r
                JOIN negocio n ON n.id = r.negocio_id AND n.estado = 'publicada' AND n.eliminado_en IS NULL
                """ + PROPIETARIO.formatted("r.negocio_id") + """

                WHERE r.enviado_en IS NULL AND (SELECT ve_estadisticas FROM plan_vigente(r.negocio_id))""").update();
        jdbc.sql("""
                UPDATE reporte_mensual r SET enviado_en = now()
                WHERE r.enviado_en IS NULL
                  AND EXISTS (SELECT 1 FROM notificacion x
                              WHERE x.negocio_id = r.negocio_id AND x.plantilla_clave = 'reporte_mensual'
                                AND x.datos ->> 'reporte_id' = CAST(r.id AS text))""").update();
        return avisos;
    }

    public int config(String clave, int defecto) {
        return jdbc.sql("SELECT config_entero(CAST(:c AS text), CAST(:d AS integer))")
                .param("c", clave).param("d", defecto).query(Integer.class).single();
    }

    public String procesarVencimientos(LocalDate hoy, int diasGracia) {
        return jdbc.sql("SELECT CAST(procesar_vencimientos(CAST(:h AS date), CAST(:g AS integer)) AS text)")
                .param("h", hoy).param("g", diasGracia).query(String.class).single();
    }
}
