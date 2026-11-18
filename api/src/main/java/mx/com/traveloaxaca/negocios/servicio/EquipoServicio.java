package mx.com.traveloaxaca.negocios.servicio;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import mx.com.traveloaxaca.acceso.correo.NotificacionServicio;
import mx.com.traveloaxaca.acceso.PropiedadesApp;
import mx.com.traveloaxaca.acceso.repo.UsuarioRepositorio;
import mx.com.traveloaxaca.acceso.seguridad.LimitadorIntentos;
import mx.com.traveloaxaca.comun.error.BusinessException;
import mx.com.traveloaxaca.negocios.dto.NegocioDtos.*;
import mx.com.traveloaxaca.negocios.repo.EquipoRepositorio;
import mx.com.traveloaxaca.negocios.servicio.AccesoNegocio.Contexto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Equipo del negocio: el propietario invita colaboradores que ya tienen cuenta con correo verificado. */
@Service
public class EquipoServicio {

    private static final int INVITACIONES_POR_DIA = 5;

    private final EquipoRepositorio equipo;
    private final UsuarioRepositorio usuarios;
    private final AccesoNegocio acceso;
    private final NotificacionServicio notificaciones;
    private final LimitadorIntentos limitador;
    private final PropiedadesApp props;

    public EquipoServicio(EquipoRepositorio equipo, UsuarioRepositorio usuarios, AccesoNegocio acceso,
                          NotificacionServicio notificaciones, LimitadorIntentos limitador, PropiedadesApp props) {
        this.equipo = equipo;
        this.usuarios = usuarios;
        this.acceso = acceso;
        this.notificaciones = notificaciones;
        this.limitador = limitador;
        this.props = props;
    }

    @Transactional(readOnly = true)
    public List<MiembroDto> miembros(Actor actor, UUID negocioId) {
        acceso.equipo(actor, negocioId);
        return equipo.miembros(negocioId).stream()
                .map(m -> new MiembroDto(m.usuarioId(), m.correo(), m.nombre(), m.rol(), m.estado(), m.creadoEn()))
                .toList();
    }

    @Transactional
    public List<MiembroDto> invitar(Actor actor, UUID negocioId, InvitarDto dto) {
        Contexto ctx = acceso.propietario(actor, negocioId);
        limitador.exigirDisponible("invitar|" + negocioId, INVITACIONES_POR_DIA, 86400,
                "Ya enviaste " + INVITACIONES_POR_DIA + " invitaciones hoy. Intenta mañana.");
        var invitado = usuarios.porCorreo(dto.correo().trim())
                .filter(u -> u.correoVerificadoEn() != null && "activo".equals(u.estado()))
                .orElseThrow(() -> BusinessException.invalida(
                        "No encontramos una cuenta con ese correo. Pídele que se registre y verifique su correo, y vuelve a invitarla.",
                        Map.of("correo", "No hay una cuenta verificada con ese correo.")));
        if (invitado.id().equals(actor.usuarioId())) {
            throw BusinessException.conflicto("Ese correo es el tuyo.");
        }
        var previa = equipo.deUsuario(negocioId, invitado.id()).orElse(null);
        if (previa != null && !"revocada".equals(previa.estado())) {
            throw BusinessException.conflicto("activa".equals(previa.estado())
                    ? "Esa persona ya es parte del equipo."
                    : "Esa persona ya tiene una invitación pendiente.");
        }
        if (previa == null) {
            equipo.invitar(negocioId, invitado.id(), actor.usuarioId());
        } else {
            equipo.reinvitar(previa.id(), actor.usuarioId());
        }
        limitador.registrar("invitar|" + negocioId);
        String invitador = usuarios.porId(actor.usuarioId()).map(u -> u.nombre()).orElse("Alguien");
        notificaciones.encolarCorreo(invitado.id(), "invitacion_equipo", Map.of(
                "nombre", invitado.nombre() == null ? "" : invitado.nombre(),
                "invitador", invitador,
                "negocio", ctx.negocio().nombreComercial(),
                "enlace", props.urls().portal() + "/invitaciones"));
        return miembros(actor, negocioId);
    }

    @Transactional
    public List<MiembroDto> revocar(Actor actor, UUID negocioId, UUID usuarioId) {
        acceso.propietario(actor, negocioId);
        var m = equipo.deUsuario(negocioId, usuarioId)
                .filter(x -> !"revocada".equals(x.estado()))
                .orElseThrow(() -> BusinessException.noEncontrado("No encontramos a esa persona en tu equipo."));
        if ("propietario".equals(m.rol())) {
            throw BusinessException.conflicto("No se puede quitar al propietario.");
        }
        equipo.cambiarEstado(m.id(), "revocada");
        return miembros(actor, negocioId);
    }

    @Transactional(readOnly = true)
    public List<InvitacionDto> misInvitaciones(UUID usuarioId) {
        return equipo.invitacionesDe(usuarioId).stream()
                .map(i -> new InvitacionDto(i.id(), i.negocioId(), i.negocioNombre(), i.invitadoPorNombre(), i.creadoEn()))
                .toList();
    }

    @Transactional
    public void responder(UUID usuarioId, UUID membresiaId, ResponderInvitacionDto dto) {
        var m = equipo.porId(membresiaId)
                .filter(x -> x.usuarioId().equals(usuarioId))
                .orElseThrow(() -> BusinessException.noEncontrado("No encontramos esa invitación."));
        if (!"invitada".equals(m.estado())) {
            throw BusinessException.conflicto("Esa invitación ya no está vigente.");
        }
        equipo.cambiarEstado(m.id(), Boolean.TRUE.equals(dto.acepta()) ? "activa" : "revocada");
    }
}
