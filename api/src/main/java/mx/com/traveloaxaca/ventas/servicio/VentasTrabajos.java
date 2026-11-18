package mx.com.traveloaxaca.ventas.servicio;

import java.time.LocalDate;
import mx.com.traveloaxaca.ventas.repo.ProspectoRepositorio;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Trabajos programados de ventas. */
@Component
public class VentasTrabajos {

    private static final Logger log = LoggerFactory.getLogger(VentasTrabajos.class);

    private final ProspectoRepositorio prospectos;

    public VentasTrabajos(ProspectoRepositorio prospectos) {
        this.prospectos = prospectos;
    }

    /** 8:00 (hora de México): un correo por persona con prospectos de próxima acción vencida. */
    @Scheduled(cron = "0 0 8 * * *", zone = "America/Mexico_City")
    public void avisoDiario() {
        try {
            int n = avisarVencidos(Contactos.hoy());
            log.info("Aviso de prospectos vencidos: {} correos en la cola", n);
        } catch (RuntimeException e) {
            log.error("Falló el aviso de prospectos vencidos", e);
        }
    }

    /** Se puede correr a mano o en pruebas con la fecha que se quiera; no repite el aviso del mismo día. */
    @Transactional
    public int avisarVencidos(LocalDate hoy) {
        return prospectos.avisarVencidos(hoy);
    }
}
