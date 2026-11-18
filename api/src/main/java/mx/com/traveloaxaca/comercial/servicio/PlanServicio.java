package mx.com.traveloaxaca.comercial.servicio;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PlanDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PlanNegocioDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.SuscripcionDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.UsoPlanDto;
import mx.com.traveloaxaca.comercial.repo.PlanRepositorio;
import mx.com.traveloaxaca.comercial.repo.SuscripcionRepositorio;
import mx.com.traveloaxaca.comun.error.BusinessException;
import mx.com.traveloaxaca.negocios.servicio.AccesoNegocio;
import mx.com.traveloaxaca.negocios.servicio.Actor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * El plan que rige a cada negocio y lo que permite. Las comprobaciones se hacen aquí, con mensajes claros,
 * antes de que los disparadores de la base tengan que rechazar algo (siguen ahí como respaldo).
 */
@Service
public class PlanServicio {

    public static final ZoneId ZONA = ZoneId.of("America/Mexico_City");

    private final PlanRepositorio planes;
    private final SuscripcionRepositorio suscripciones;
    private final AccesoNegocio acceso;

    public PlanServicio(PlanRepositorio planes, SuscripcionRepositorio suscripciones, AccesoNegocio acceso) {
        this.planes = planes;
        this.suscripciones = suscripciones;
        this.acceso = acceso;
    }

    public static LocalDate hoy() {
        return LocalDate.now(ZONA);
    }

    /** El plan vigente (el gratuito si no hay suscripción). */
    public PlanDto planDe(UUID negocioId) {
        return planes.planDe(negocioId).orElseGet(() -> planes.planPorClave("gratis")
                .orElseThrow(() -> new IllegalStateException("Falta el plan 'gratis' en la base de datos")));
    }

    public void exigirCupoFotos(UUID negocioId) {
        PlanDto plan = planDe(negocioId);
        int uso = planes.fotosEnUso(negocioId);
        if (uso >= plan.limiteFotos()) {
            throw BusinessException.conflicto("Tu plan " + plan.nombre() + " admite " + plan.limiteFotos()
                    + (plan.limiteFotos() == 1 ? " foto." : " fotos.") + " Quita una o sube de plan.");
        }
    }

    public void exigirCupoOfertas(UUID negocioId) {
        PlanDto plan = planDe(negocioId);
        int uso = planes.ofertasEnUso(negocioId);
        if (uso >= plan.limiteOfertas()) {
            if (plan.limiteOfertas() == 0) {
                throw BusinessException.conflicto("Tu plan " + plan.nombre() + " no incluye ofertas. Sube de plan para agregarlas.");
            }
            throw BusinessException.conflicto("Tu plan " + plan.nombre() + " admite " + plan.limiteOfertas()
                    + (plan.limiteOfertas() == 1 ? " oferta." : " ofertas.") + " Archiva una o sube de plan.");
        }
    }

    public void exigirPromociones(UUID negocioId) {
        PlanDto plan = planDe(negocioId);
        if (!plan.permitePromociones()) {
            throw BusinessException.prohibido("Tu plan " + plan.nombre() + " no incluye promociones. Sube de plan para crearlas.");
        }
    }

    /** Pro y Destacado ven todas las cifras; Gratis solo los totales de la última semana. */
    public boolean veEstadisticas(UUID negocioId) {
        return planDe(negocioId).veEstadisticas();
    }

    /** "Mi plan": qué plan tiene, hasta cuándo, y cuánto lleva usado. */
    @Transactional(readOnly = true)
    public PlanNegocioDto miPlan(Actor actor, UUID negocioId) {
        acceso.equipo(actor, negocioId);
        PlanDto plan = planDe(negocioId);
        SuscripcionDto s = suscripciones.vigenteDto(negocioId).orElse(null);
        UsoPlanDto uso = new UsoPlanDto(planes.fotosEnUso(negocioId), plan.limiteFotos(),
                planes.ofertasEnUso(negocioId), plan.limiteOfertas());
        boolean gracia = s != null && "gracia".equals(s.estado());
        Integer dias = null;
        if (s != null) {
            LocalDate limite = gracia && s.graciaHasta() != null ? s.graciaHasta() : s.fin();
            dias = (int) ChronoUnit.DAYS.between(hoy(), limite);
        }
        return new PlanNegocioDto(plan, s, uso, gracia, dias, s == null);
    }
}
