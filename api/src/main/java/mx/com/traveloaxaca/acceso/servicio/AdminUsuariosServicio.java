package mx.com.traveloaxaca.acceso.servicio;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.SolicitudAdminDto;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.UsuarioAdminDto;
import mx.com.traveloaxaca.acceso.repo.PrivacidadRepositorio;
import mx.com.traveloaxaca.acceso.repo.PrivacidadRepositorio.SolicitudFila;
import mx.com.traveloaxaca.acceso.repo.SesionRepositorio;
import mx.com.traveloaxaca.acceso.repo.UsuarioRepositorio;
import mx.com.traveloaxaca.acceso.repo.UsuarioRepositorio.FiltroAdmin;
import mx.com.traveloaxaca.acceso.repo.UsuarioRepositorio.UsuarioFila;
import mx.com.traveloaxaca.comun.api.Pagina;
import mx.com.traveloaxaca.comun.error.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Administración de usuarios, roles globales y solicitudes de privacidad (rutas /admin). */
@Service
public class AdminUsuariosServicio {

    /** Roles que se dan a nivel de plataforma. dueno y colaborador se ligan a un negocio (paso 3). */
    private static final Set<String> ROLES_GLOBALES = Set.of("admin", "editor", "ventas");

    private final UsuarioRepositorio usuarios;
    private final SesionRepositorio sesiones;
    private final PrivacidadRepositorio privacidad;

    public AdminUsuariosServicio(UsuarioRepositorio usuarios, SesionRepositorio sesiones,
                                 PrivacidadRepositorio privacidad) {
        this.usuarios = usuarios;
        this.sesiones = sesiones;
        this.privacidad = privacidad;
    }

    public Pagina<UsuarioAdminDto> listar(String texto, String estado, String rol, int pagina, int tamano) {
        int p = Math.max(pagina, 0);
        int t = tamano < 1 ? 20 : Math.min(tamano, 100);
        FiltroAdmin f = new FiltroAdmin(texto, estado, rol, t, p * t);
        List<UsuarioFila> filas = usuarios.buscar(f);
        Map<UUID, List<String>> roles = usuarios.rolesDe(filas.stream().map(UsuarioFila::id).toList());
        List<UsuarioAdminDto> items = filas.stream().map(u -> new UsuarioAdminDto(u.id(), u.correo(), u.nombre(),
                u.estado(), u.idiomaCodigo(), u.correoVerificadoEn() != null, u.ultimoAccesoEn(), u.creadoEn(),
                roles.getOrDefault(u.id(), List.of()))).toList();
        return new Pagina<>(items, usuarios.contar(f), p, t);
    }

    @Transactional
    public void cambiarEstado(UUID adminId, UUID usuarioId, String estado) {
        if (adminId.equals(usuarioId)) {
            throw BusinessException.prohibido("No puedes cambiar el estado de tu propia cuenta.");
        }
        existe(usuarioId);
        if ("suspendido".equals(estado) && usuarios.tieneRol(usuarioId, "admin")
                && usuarios.contarAdministradoresActivos() <= 1) {
            throw BusinessException.conflicto("No puedes suspender al último administrador.");
        }
        usuarios.cambiarEstado(usuarioId, estado);
        if ("suspendido".equals(estado)) {
            sesiones.revocarTodas(usuarioId);
        }
    }

    @Transactional
    public void asignarRol(UUID usuarioId, String rol) {
        existe(usuarioId);
        validarRolGlobal(rol);
        if (usuarios.tieneRol(usuarioId, rol)) {
            return;
        }
        usuarios.asignarRol(usuarioId, rol);
    }

    @Transactional
    public void quitarRol(UUID adminId, UUID usuarioId, String rol) {
        existe(usuarioId);
        validarRolGlobal(rol);
        if ("admin".equals(rol)) {
            if (adminId.equals(usuarioId)) {
                throw BusinessException.prohibido("No puedes quitarte a ti mismo el rol de administrador.");
            }
            if (usuarios.contarAdministradoresActivos() <= 1) {
                throw BusinessException.conflicto("No puedes quitar al último administrador.");
            }
        }
        if (usuarios.quitarRol(usuarioId, rol) == 0) {
            throw BusinessException.noEncontrado("Esa persona no tiene ese rol.");
        }
    }

    // ---------------- solicitudes de privacidad ----------------

    public Pagina<SolicitudAdminDto> solicitudes(String estado, int pagina, int tamano) {
        int p = Math.max(pagina, 0);
        int t = tamano < 1 ? 20 : Math.min(tamano, 100);
        List<SolicitudAdminDto> items = privacidad.solicitudes(estado, t, p * t).stream()
                .map(AdminUsuariosServicio::aDto).toList();
        return new Pagina<>(items, privacidad.contarSolicitudes(estado), p, t);
    }

    @Transactional
    public SolicitudAdminDto cambiarEstadoSolicitud(UUID id, String estado) {
        privacidad.solicitudPorId(id).orElseThrow(() -> BusinessException.noEncontrado("No encontramos esa solicitud."));
        if (privacidad.cambiarEstadoSolicitud(id, estado) == 0) {
            throw BusinessException.conflicto("Esa solicitud ya está cerrada.");
        }
        return aDto(privacidad.solicitudPorId(id).orElseThrow());
    }

    // ---------------- apoyo ----------------

    private void existe(UUID usuarioId) {
        usuarios.porId(usuarioId).orElseThrow(() -> BusinessException.noEncontrado("No encontramos a esa persona."));
    }

    private void validarRolGlobal(String rol) {
        if (!usuarios.rolExiste(rol)) {
            throw BusinessException.invalida("El rol no existe.");
        }
        if (!ROLES_GLOBALES.contains(rol)) {
            throw BusinessException.invalida("Ese rol no se asigna aquí: " + rol
                    + ". Los roles de negocio se dan desde el negocio.");
        }
    }

    private static SolicitudAdminDto aDto(SolicitudFila s) {
        return new SolicitudAdminDto(s.id(), s.usuarioId(), s.correoUsuario(), s.tipo(), s.estado(), s.detalle(),
                s.resueltaEn(), s.creadoEn());
    }
}
