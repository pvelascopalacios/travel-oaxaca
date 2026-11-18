package mx.com.traveloaxaca.comercial.servicio;

import java.time.LocalDate;
import mx.com.traveloaxaca.comercial.repo.AvisoRepositorio;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Trabajos automáticos de lo comercial: vencer suscripciones (con sus días de gracia), activar y cerrar patrocinios,
 * vencer promociones y avisar por correo. Todos se pueden repetir sin mandar dos veces el mismo aviso.
 */
@Component
public class ComercialTrabajos {

    private static final Logger log = LoggerFactory.getLogger(ComercialTrabajos.class);

    /** Qué hizo una corrida; sirve para las pruebas y para el registro. */
    public record Resultado(String vencimientos, int avisosVencimiento, int avisosGracia, int avisosPatrocinio) {
    }

    private final AvisoRepositorio repo;

    public ComercialTrabajos(AvisoRepositorio repo) {
        this.repo = repo;
    }

    /** Todas las madrugadas, después de que cambia el día en México. */
    @Scheduled(cron = "0 30 1 * * *", zone = "America/Mexico_City")
    @Transactional
    public void diario() {
        try {
            procesar(PlanServicio.hoy());
        } catch (Exception e) {
            log.error("No se pudo procesar lo comercial del día: {}", e.getMessage(), e);
        }
    }

    /** El día 1 de cada mes, ya con los reportes generados (a las 3:00), avisa que están listos. */
    @Scheduled(cron = "0 30 3 1 * *", zone = "America/Mexico_City")
    @Transactional
    public void avisarReportes() {
        try {
            avisarReportesMensuales();
        } catch (Exception e) {
            log.error("No se pudieron avisar los reportes mensuales: {}", e.getMessage(), e);
        }
    }

    /** Separado de la programación para poder probarlo con una fecha dada. */
    @Transactional
    public Resultado procesar(LocalDate hoy) {
        int gracia = repo.config("dias_gracia", 30);
        String vencimientos = repo.procesarVencimientos(hoy, gracia);
        int primero = repo.config("aviso_vencimiento_dias_1", 15);
        int segundo = repo.config("aviso_vencimiento_dias_2", 3);
        // El primer aviso cubre (segundo, primero]; el segundo cubre [0, segundo]. Una corrida que se salte un día no pierde avisos.
        int v = repo.suscripcionPorVencer(hoy, segundo + 1, primero, primero)
                + repo.suscripcionPorVencer(hoy, 0, segundo, segundo);
        int g = repo.suscripcionEnGracia();
        int p = repo.patrocinioPorTerminar(hoy, repo.config("aviso_patrocinio_dias", 5));
        log.info("Proceso comercial {}: {} | avisos de vencimiento {}, de gracia {}, de patrocinio {}", hoy, vencimientos, v, g, p);
        return new Resultado(vencimientos, v, g, p);
    }

    @Transactional
    public int avisarReportesMensuales() {
        return repo.reportesMensuales();
    }
}
