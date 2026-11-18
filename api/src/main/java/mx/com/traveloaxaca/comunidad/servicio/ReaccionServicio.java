package mx.com.traveloaxaca.comunidad.servicio;

import java.util.Set;
import java.util.UUID;
import mx.com.traveloaxaca.comun.error.BusinessException;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.ReaccionDto;
import mx.com.traveloaxaca.comunidad.repo.ReaccionRepositorio;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Me gusta (negocios, lugares, artículos, comentarios) y "útil" (reseñas). Idempotente. */
@Service
public class ReaccionServicio {

    private static final Set<String> OBJETIVOS = Set.of("negocio", "lugar", "resena", "comentario", "articulo");

    private final ReaccionRepositorio repo;

    public ReaccionServicio(ReaccionRepositorio repo) {
        this.repo = repo;
    }

    @Transactional
    public ReaccionDto poner(UUID usuarioId, String objetivo, UUID id) {
        validar(objetivo);
        if (!repo.visible(objetivo, id)) {
            throw BusinessException.noEncontrado("No encontramos eso.");
        }
        repo.agregar(usuarioId, objetivo, id);
        return new ReaccionDto(ReaccionRepositorio.tipoDe(objetivo), repo.total(objetivo, id));
    }

    @Transactional
    public ReaccionDto quitar(UUID usuarioId, String objetivo, UUID id) {
        validar(objetivo);
        repo.quitar(usuarioId, objetivo, id);
        return new ReaccionDto(ReaccionRepositorio.tipoDe(objetivo), repo.total(objetivo, id));
    }

    private static void validar(String objetivo) {
        if (!OBJETIVOS.contains(objetivo)) {
            throw BusinessException.invalida("Puedes reaccionar a: negocio, lugar, resena, comentario o articulo.");
        }
    }
}
