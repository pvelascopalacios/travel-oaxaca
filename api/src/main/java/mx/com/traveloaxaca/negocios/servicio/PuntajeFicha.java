package mx.com.traveloaxaca.negocios.servicio;

import java.util.UUID;
import mx.com.traveloaxaca.negocios.repo.FichaRepositorio;
import mx.com.traveloaxaca.negocios.repo.NegocioRepositorio;
import org.springframework.stereotype.Component;

/**
 * Completitud de la ficha, de 0 a 100: descripción corta 15, descripción larga 15, fotos aprobadas hasta 30
 * (5 por foto), contacto 10, horarios 10, servicios 5, idiomas 5 y ofertas 10.
 */
@Component
public class PuntajeFicha {

    private final FichaRepositorio ficha;
    private final NegocioRepositorio negocios;

    public PuntajeFicha(FichaRepositorio ficha, NegocioRepositorio negocios) {
        this.ficha = ficha;
        this.negocios = negocios;
    }

    public int recalcular(UUID negocioId) {
        int p = 0;
        var es = ficha.traduccion(negocioId, "es").orElse(null);
        if (es != null) {
            if (es.descripcionCorta() != null && !es.descripcionCorta().isBlank()) {
                p += 15;
            }
            if (es.descripcion() != null && !es.descripcion().isBlank()) {
                p += 15;
            }
        }
        p += (int) Math.min(6, ficha.contarFotosAprobadas(negocioId)) * 5;
        if (ficha.contarContactos(negocioId) > 0) {
            p += 10;
        }
        if (ficha.contarHorarios(negocioId) > 0) {
            p += 10;
        }
        if (!ficha.servicioIds(negocioId).isEmpty()) {
            p += 5;
        }
        if (!ficha.idiomas(negocioId).isEmpty()) {
            p += 5;
        }
        if (ficha.contarOfertasPublicables(negocioId) > 0) {
            p += 10;
        }
        negocios.guardarPuntaje(negocioId, p);
        return p;
    }
}
