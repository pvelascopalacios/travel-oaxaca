package mx.com.traveloaxaca.medicion.servicio;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import mx.com.traveloaxaca.medicion.repo.MedicionRepositorio;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Trabajos automáticos de la medición. Cada uno atrapa sus errores para no detener a los demás; todos se pueden
 * repetir sin dañar nada.
 */
@Component
public class MedicionTrabajos {

    private static final Logger log = LoggerFactory.getLogger(MedicionTrabajos.class);
    private static final String ZONA = "America/Mexico_City";

    private final MedicionRepositorio repo;

    public MedicionTrabajos(MedicionRepositorio repo) {
        this.repo = repo;
    }

    /** Cada madrugada: resumen de ayer y de antier (por si el de ayer se calculó antes de que llegaran eventos tardíos). */
    @Scheduled(cron = "0 15 2 * * *", zone = ZONA)
    public void resumenDiario() {
        LocalDate hoy = LocalDate.now(java.time.ZoneId.of(ZONA));
        for (int atras = 1; atras <= 2; atras++) {
            try {
                repo.calcularResumenDiario(hoy.minusDays(atras));
            } catch (Exception e) {
                log.error("No se pudo calcular el resumen del día {}: {}", hoy.minusDays(atras), e.getMessage());
            }
        }
    }

    /** El día 1 de cada mes: reporte del mes anterior para cada negocio publicado que aún no lo tenga. */
    @Scheduled(cron = "0 0 3 1 * *", zone = ZONA)
    public void reportesMensuales() {
        generarReportes(LocalDate.now(java.time.ZoneId.of(ZONA)).minusMonths(1));
    }

    /** Separado para poder probarlo: genera el reporte del mes de la fecha dada. Devuelve cuántos generó. */
    public int generarReportes(LocalDate delMes) {
        int anio = delMes.getYear();
        int mes = delMes.getMonthValue();
        List<UUID> pendientes = repo.negociosSinReporte(anio, mes);
        int generados = 0;
        for (UUID negocio : pendientes) {
            try {
                repo.generarReporte(negocio, anio, mes);
                generados++;
            } catch (Exception e) {
                log.error("No se pudo generar el reporte {}-{} del negocio {}: {}", anio, mes, negocio, e.getMessage());
            }
        }
        return generados;
    }

    /** Cada lunes: deja listas las particiones de los próximos meses y avisa si algo cayó en la de respaldo. */
    @Scheduled(cron = "0 0 4 * * MON", zone = ZONA)
    public void mantenimiento() {
        try {
            repo.asegurarParticiones(3);
            long filas = repo.filasEnParticionDeRespaldo();
            if (filas > 0) {
                log.warn("evento_uso_default tiene {} filas: falta crear una partición mensual", filas);
            }
        } catch (Exception e) {
            log.error("No se pudo hacer el mantenimiento de particiones: {}", e.getMessage());
        }
    }
}
