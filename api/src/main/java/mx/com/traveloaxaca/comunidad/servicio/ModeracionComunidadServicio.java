package mx.com.traveloaxaca.comunidad.servicio;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import mx.com.traveloaxaca.comun.api.Pagina;
import mx.com.traveloaxaca.comun.error.BusinessException;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.ColaComunidadItemDto;
import mx.com.traveloaxaca.comunidad.repo.ModeracionRepositorio;
import mx.com.traveloaxaca.comunidad.repo.ModeracionRepositorio.ColaFila;
import mx.com.traveloaxaca.comunidad.repo.ModeracionRepositorio.Moderable;
import mx.com.traveloaxaca.comunidad.repo.ResenaRepositorio;
import mx.com.traveloaxaca.negocios.servicio.Actor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Cola y decisiones del equipo sobre lo que escribe la comunidad. */
@Service
public class ModeracionComunidadServicio {

    private static final Set<String> TIPOS = Set.of("resena", "comentario", "foto", "reporte_ficha", "reporte_contenido");

    private final ModeracionRepositorio repo;
    private final ResenaRepositorio resenas;
    private final FiltroContenido filtro;

    public ModeracionComunidadServicio(ModeracionRepositorio repo, ResenaRepositorio resenas, FiltroContenido filtro) {
        this.repo = repo;
        this.resenas = resenas;
        this.filtro = filtro;
    }

    @Transactional(readOnly = true)
    public Pagina<ColaComunidadItemDto> cola(String tipo, UUID negocioId, Integer pagina, Integer tamano) {
        String t = tipo == null || tipo.isBlank() ? null : tipo;
        if (t != null && !TIPOS.contains(t)) {
            throw BusinessException.invalida("El tipo debe ser resena, comentario, foto, reporte_ficha o reporte_contenido.",
                    Map.of("tipo", "Valores: resena, comentario, foto, reporte_ficha, reporte_contenido."));
        }
        int pag = ResenaServicio.pagina(pagina);
        int tam = ResenaServicio.tamano(tamano);
        List<ColaComunidadItemDto> items = repo.cola(t, negocioId, tam, pag * tam).stream().map(this::aDto).toList();
        return new Pagina<>(items, repo.contar(t, negocioId), pag, tam);
    }

    private ColaComunidadItemDto aDto(ColaFila f) {
        String motivo = f.motivoReporte();
        if (motivo == null) {
            if (f.reportes() > 0) {
                motivo = f.reportes() + (f.reportes() == 1 ? " reporte" : " reportes");
            } else if ("pendiente".equals(f.estado()) && f.texto() != null) {
                motivo = filtro.motivoDeRevision(f.texto()).orElse("Pendiente de revisión");
            }
        }
        return new ColaComunidadItemDto(f.tipo(), f.id(), f.estado(), f.resumen(), motivo, f.reportes(), f.negocioId(),
                f.creadoEn());
    }

    // ---------------- reseñas ----------------

    @Transactional
    public void publicarResena(Actor actor, UUID id) {
        Moderable r = repo.resena(id).orElseThrow(() -> BusinessException.noEncontrado("No encontramos esa reseña."));
        if ("publicada".equals(r.estado())) {
            throw BusinessException.conflicto("Esa reseña ya está publicada.");
        }
        boolean eraPendiente = "pendiente".equals(r.estado());
        repo.estadoResena(id, "publicada", actor.usuarioId());
        repo.cerrarReportesDe("resena", id, "descartado", actor.usuarioId());
        if (eraPendiente) {
            resenas.nombreNegocioPublicado(r.negocioId()).ifPresent(n -> resenas.avisarNuevaResena(r.negocioId(), n));
        }
    }

    @Transactional
    public void ocultarResena(Actor actor, UUID id) {
        cambiarResena(actor, id, "oculta");
    }

    @Transactional
    public void rechazarResena(Actor actor, UUID id) {
        cambiarResena(actor, id, "rechazada");
    }

    private void cambiarResena(Actor actor, UUID id, String estado) {
        Moderable r = repo.resena(id).orElseThrow(() -> BusinessException.noEncontrado("No encontramos esa reseña."));
        if (estado.equals(r.estado())) {
            throw BusinessException.conflicto("Esa reseña ya está en ese estado.");
        }
        repo.estadoResena(id, estado, actor.usuarioId());
        repo.cerrarReportesDe("resena", id, "resuelto", actor.usuarioId());
    }

    // ---------------- comentarios ----------------

    @Transactional
    public void publicarComentario(Actor actor, UUID id) {
        Moderable c = repo.comentario(id).orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese comentario."));
        if ("publicado".equals(c.estado())) {
            throw BusinessException.conflicto("Ese comentario ya está publicado.");
        }
        repo.estadoComentario(id, "publicado", actor.usuarioId());
        repo.cerrarReportesDe("comentario", id, "descartado", actor.usuarioId());
    }

    @Transactional
    public void ocultarComentario(Actor actor, UUID id) {
        cambiarComentario(actor, id, "oculto");
    }

    @Transactional
    public void rechazarComentario(Actor actor, UUID id) {
        cambiarComentario(actor, id, "rechazado");
    }

    private void cambiarComentario(Actor actor, UUID id, String estado) {
        Moderable c = repo.comentario(id).orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese comentario."));
        if (estado.equals(c.estado())) {
            throw BusinessException.conflicto("Ese comentario ya está en ese estado.");
        }
        repo.estadoComentario(id, estado, actor.usuarioId());
        repo.cerrarReportesDe("comentario", id, "resuelto", actor.usuarioId());
    }

    // ---------------- fotos de reseñas ----------------

    @Transactional
    public void aprobarFoto(Actor actor, UUID medioId) {
        foto(medioId);
        repo.resolverFoto(medioId, true, actor.usuarioId(), null);
        repo.cerrarReportesDe("foto", medioId, "descartado", actor.usuarioId());
    }

    @Transactional
    public void rechazarFoto(Actor actor, UUID medioId, String motivo) {
        foto(medioId);
        repo.resolverFoto(medioId, false, actor.usuarioId(), motivo.trim());
        repo.cerrarReportesDe("foto", medioId, "resuelto", actor.usuarioId());
    }

    private void foto(UUID medioId) {
        if (!repo.esFotoDeResena(medioId)) {
            throw BusinessException.noEncontrado("No encontramos esa foto de reseña.");
        }
    }

    // ---------------- reportes ----------------

    /** tabla: ficha o contenido. accion: revisar, resolver o descartar. */
    @Transactional
    public void reporte(Actor actor, String tabla, UUID id, String accion) {
        String estado = switch (accion) {
            case "revisar" -> "en_revision";
            case "resolver" -> "resuelto";
            case "descartar" -> "descartado";
            default -> throw BusinessException.noEncontrado("Esa acción no existe.");
        };
        String actual = repo.estadoReporte(tabla, id)
                .orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese reporte."));
        if (!"nuevo".equals(actual) && !"en_revision".equals(actual)) {
            throw BusinessException.conflicto("Ese reporte ya está cerrado.");
        }
        if (actual.equals(estado)) {
            throw BusinessException.conflicto("Ese reporte ya está en revisión.");
        }
        repo.cambiarReporte(tabla, id, estado, actor.usuarioId());
    }
}
