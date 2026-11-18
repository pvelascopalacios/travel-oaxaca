package mx.com.traveloaxaca.negocios.servicio;

import java.util.Map;
import java.util.UUID;
import mx.com.traveloaxaca.comun.error.BusinessException;
import mx.com.traveloaxaca.negocios.dto.NegocioDtos.FaltantesDto;
import mx.com.traveloaxaca.negocios.dto.NegocioDtos.FichaDto;
import mx.com.traveloaxaca.negocios.repo.NegocioRepositorio;
import mx.com.traveloaxaca.negocios.servicio.AccesoNegocio.Contexto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Ciclo de vida de la ficha: enviar a revisión, pausar, reanudar y archivar. */
@Service
public class PublicacionServicio {

    private final NegocioRepositorio negocios;
    private final AccesoNegocio acceso;
    private final FaltantesEnvio faltantes;
    private final PuntajeFicha puntaje;
    private final FichaServicio fichas;

    public PublicacionServicio(NegocioRepositorio negocios, AccesoNegocio acceso, FaltantesEnvio faltantes,
                               PuntajeFicha puntaje, FichaServicio fichas) {
        this.negocios = negocios;
        this.acceso = acceso;
        this.faltantes = faltantes;
        this.puntaje = puntaje;
        this.fichas = fichas;
    }

    /** Solo desde borrador. Los cambios a una ficha publicada ya generan su propia revisión pendiente. */
    @Transactional
    public FichaDto enviarARevision(Actor actor, UUID negocioId) {
        Contexto ctx = acceso.editar(actor, negocioId);
        if (!"borrador".equals(ctx.negocio().estado())) {
            throw BusinessException.conflicto("Solo se puede enviar a revisión una ficha en borrador.");
        }
        int p = puntaje.recalcular(negocioId);
        FaltantesDto f = faltantes.calcular(negocioId, p);
        if (!f.puedeEnviar()) {
            throw BusinessException.invalida("Todavía falta completar tu ficha antes de enviarla.", f.mensajes());
        }
        negocios.crearRevision(negocioId, actor.usuarioId(), "{}");
        negocios.cambiarEstado(negocioId, "en_revision");
        return fichas.cargar(negocioId, ctx.rol());
    }

    @Transactional
    public FichaDto pausar(Actor actor, UUID negocioId) {
        Contexto ctx = acceso.propietario(actor, negocioId);
        if (!"publicada".equals(ctx.negocio().estado())) {
            throw BusinessException.conflicto("Solo se puede pausar una ficha publicada.");
        }
        negocios.cambiarEstado(negocioId, "pausada");
        return fichas.cargar(negocioId, ctx.rol());
    }

    @Transactional
    public FichaDto reanudar(Actor actor, UUID negocioId) {
        Contexto ctx = acceso.propietario(actor, negocioId);
        if (!"pausada".equals(ctx.negocio().estado())) {
            throw BusinessException.conflicto("Solo se puede reanudar una ficha pausada.");
        }
        Map<String, String> falta = faltantes.paraPublicar(negocioId);
        if (!falta.isEmpty()) {
            throw BusinessException.invalida("No se puede reanudar todavía.", falta);
        }
        negocios.cambiarEstado(negocioId, "publicada");
        return fichas.cargar(negocioId, ctx.rol());
    }

    @Transactional
    public void archivar(Actor actor, UUID negocioId) {
        Contexto ctx = acceso.propietario(actor, negocioId);
        if ("en_revision".equals(ctx.negocio().estado())) {
            throw BusinessException.conflicto("Tu ficha está en revisión. Podrás archivarla cuando termine.");
        }
        negocios.archivar(negocioId);
    }

}
