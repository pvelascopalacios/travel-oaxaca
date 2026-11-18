package mx.com.traveloaxaca.negocios.servicio;

import java.util.UUID;
import mx.com.traveloaxaca.comun.error.BusinessException;
import mx.com.traveloaxaca.negocios.repo.NegocioRepositorio;
import mx.com.traveloaxaca.negocios.repo.NegocioRepositorio.NegocioFila;
import org.springframework.stereotype.Service;

/** Decide quién puede tocar qué negocio. Un negocio ajeno responde 404 para no revelar que existe. */
@Service
public class AccesoNegocio {

    /** rol es null cuando la persona entra por ser del equipo interno y no es miembro. */
    public record Contexto(NegocioFila negocio, String rol, Actor actor) {
        public boolean esPropietario() {
            return "propietario".equals(rol);
        }

        public UUID id() {
            return negocio.id();
        }
    }

    private static final String NO_EXISTE = "No encontramos ese negocio.";

    private final NegocioRepositorio negocios;

    public AccesoNegocio(NegocioRepositorio negocios) {
        this.negocios = negocios;
    }

    /** Lectura: equipo del negocio o interno (admin, editor, ventas). */
    public Contexto leer(Actor actor, UUID negocioId) {
        NegocioFila n = negocios.porId(negocioId).orElseThrow(() -> BusinessException.noEncontrado(NO_EXISTE));
        String rol = negocios.rolDeMiembro(negocioId, actor.usuarioId()).orElse(null);
        if (rol == null && !actor.puedeLeerTodo()) {
            throw BusinessException.noEncontrado(NO_EXISTE);
        }
        return new Contexto(n, rol, actor);
    }

    /** Edición: bloquea la fila, exige miembro o admin/editor y un estado que permita editar. */
    public Contexto editar(Actor actor, UUID negocioId) {
        NegocioFila n = negocios.porIdParaActualizar(negocioId).orElseThrow(() -> BusinessException.noEncontrado(NO_EXISTE));
        String rol = negocios.rolDeMiembro(negocioId, actor.usuarioId()).orElse(null);
        if (rol == null) {
            if (!actor.puedeLeerTodo()) {
                throw BusinessException.noEncontrado(NO_EXISTE);
            }
            if (!actor.puedeEditarTodo()) {
                throw BusinessException.prohibido("No tienes permiso para editar esta ficha.");
            }
        }
        if ("en_revision".equals(n.estado())) {
            throw BusinessException.conflicto("Tu ficha está en revisión. Podrás editarla cuando termine.");
        }
        return new Contexto(n, rol, actor);
    }

    /** Acciones del dueño: pausar, reanudar, archivar, invitar y revocar. */
    public Contexto propietario(Actor actor, UUID negocioId) {
        NegocioFila n = negocios.porIdParaActualizar(negocioId).orElseThrow(() -> BusinessException.noEncontrado(NO_EXISTE));
        String rol = negocios.rolDeMiembro(negocioId, actor.usuarioId()).orElse(null);
        if (rol == null) {
            throw BusinessException.noEncontrado(NO_EXISTE);
        }
        if (!"propietario".equals(rol)) {
            throw BusinessException.prohibido("Solo el propietario puede hacer esto.");
        }
        return new Contexto(n, rol, actor);
    }

    /** Miembro del equipo (propietario o colaborador), sin permitir al personal interno. */
    public Contexto equipo(Actor actor, UUID negocioId) {
        NegocioFila n = negocios.porId(negocioId).orElseThrow(() -> BusinessException.noEncontrado(NO_EXISTE));
        String rol = negocios.rolDeMiembro(negocioId, actor.usuarioId()).orElse(null);
        if (rol == null && !actor.puedeLeerTodo()) {
            throw BusinessException.noEncontrado(NO_EXISTE);
        }
        return new Contexto(n, rol, actor);
    }
}
