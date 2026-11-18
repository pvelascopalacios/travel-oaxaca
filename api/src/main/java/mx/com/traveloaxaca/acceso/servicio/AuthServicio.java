package mx.com.traveloaxaca.acceso.servicio;

import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import mx.com.traveloaxaca.acceso.PropiedadesApp;
import mx.com.traveloaxaca.acceso.correo.NotificacionServicio;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.IngresoDto;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.RegistroDto;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.RespuestaSesion;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.TokensDto;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.UsuarioDto;
import mx.com.traveloaxaca.acceso.repo.ConfiguracionRepositorio;
import mx.com.traveloaxaca.acceso.repo.PrivacidadRepositorio;
import mx.com.traveloaxaca.acceso.repo.SesionRepositorio;
import mx.com.traveloaxaca.acceso.repo.UsuarioRepositorio;
import mx.com.traveloaxaca.acceso.repo.UsuarioRepositorio.UsuarioFila;
import mx.com.traveloaxaca.acceso.seguridad.JwtServicio;
import mx.com.traveloaxaca.acceso.seguridad.LimitadorIntentos;
import mx.com.traveloaxaca.comun.error.BusinessException;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthServicio {

    private static final String ROL_INICIAL = "turista";

    private final UsuarioRepositorio usuarios;
    private final SesionRepositorio sesiones;
    private final PrivacidadRepositorio privacidad;
    private final ConfiguracionRepositorio configuracion;
    private final SesionServicio sesionServicio;
    private final NotificacionServicio notificaciones;
    private final JwtServicio jwt;
    private final PasswordEncoder encoder;
    private final PoliticaClave politica;
    private final LimitadorIntentos limitador;
    private final PropiedadesApp props;
    private volatile String claveFalsa;

    public AuthServicio(UsuarioRepositorio usuarios, SesionRepositorio sesiones, PrivacidadRepositorio privacidad,
                        ConfiguracionRepositorio configuracion, SesionServicio sesionServicio,
                        NotificacionServicio notificaciones, JwtServicio jwt, PasswordEncoder encoder,
                        PoliticaClave politica, LimitadorIntentos limitador, PropiedadesApp props) {
        this.usuarios = usuarios;
        this.sesiones = sesiones;
        this.privacidad = privacidad;
        this.configuracion = configuracion;
        this.sesionServicio = sesionServicio;
        this.notificaciones = notificaciones;
        this.jwt = jwt;
        this.encoder = encoder;
        this.politica = politica;
        this.limitador = limitador;
        this.props = props;
    }

    @Transactional
    public RespuestaSesion registrar(RegistroDto dto, String ip) {
        limitador.consumir("registro|" + ip, props.seguridad().limiteRegistrosHora(), 3600,
                "Se hicieron demasiados registros desde tu red. Intenta más tarde.");
        String correo = normalizar(dto.correo());
        politica.validar(dto.clave(), correo, "clave");
        String idioma = (dto.idiomaCodigo() == null || dto.idiomaCodigo().isBlank()) ? "es" : dto.idiomaCodigo();
        if (!usuarios.idiomaExiste(idioma)) {
            throw BusinessException.invalida("Idioma no disponible.", Map.of("idiomaCodigo", "Idioma no disponible."));
        }
        if (usuarios.porCorreo(correo).isPresent()) {
            throw BusinessException.conflicto("Ya existe una cuenta con ese correo.");
        }
        UUID id;
        try {
            id = usuarios.crear(correo, encoder.encode(dto.clave()), dto.nombre().trim(), idioma);
        } catch (DuplicateKeyException e) {
            throw BusinessException.conflicto("Ya existe una cuenta con ese correo.");
        }
        usuarios.asignarRol(id, ROL_INICIAL);
        privacidad.registrarConsentimiento(id, "terminos", configuracion.texto("version_terminos", "1"), true);
        privacidad.registrarConsentimiento(id, "privacidad", configuracion.texto("version_privacidad", "1"), true);
        encolarVerificacion(id, correo, dto.nombre().trim());
        TokensDto t = sesionServicio.abrir(id, dto.dispositivoId(), List.of(ROL_INICIAL));
        return respuesta(t, new UsuarioDto(id, correo, dto.nombre().trim(), idioma, false, List.of(ROL_INICIAL)));
    }

    public RespuestaSesion ingresar(IngresoDto dto, String ip) {
        String correo = normalizar(dto.correo());
        String llave = "ingreso|" + correo + "|" + ip;
        limitador.exigirDisponible(llave, props.seguridad().limiteIngresosFallidos(),
                props.seguridad().ventanaIngresosMinutos() * 60L,
                "Demasiados intentos. Espera unos minutos e intenta de nuevo.");
        UsuarioFila u = usuarios.porCorreo(correo).orElse(null);
        // Siempre se compara contra un hash, exista o no el correo, para que el tiempo no delate cuentas.
        String hash = (u != null && u.hashClave() != null) ? u.hashClave() : claveFalsa();
        boolean coincide = encoder.matches(dto.clave(), hash);
        if (u == null || u.hashClave() == null || !coincide) {
            limitador.registrar(llave);
            throw BusinessException.noAutenticado("Correo o contraseña incorrectos.");
        }
        if (!"activo".equals(u.estado())) {
            throw BusinessException.prohibido("Tu cuenta está suspendida. Contacta a soporte.");
        }
        limitador.limpiar(llave);
        List<String> roles = usuarios.roles(u.id());
        TokensDto t = sesionServicio.abrir(u.id(), dto.dispositivoId(), roles);
        return respuesta(t, usuarioDto(u, roles));
    }

    public TokensDto renovar(String tokenRenovacion) {
        return sesionServicio.renovar(tokenRenovacion);
    }

    @Transactional
    public void salir(UUID sesionId) {
        sesiones.revocar(sesionId);
    }

    @Transactional
    public void salirDeTodo(UUID usuarioId) {
        sesiones.revocarTodas(usuarioId);
    }

    @Transactional
    public void verificarCorreo(String token) {
        Jwt j = jwt.leerAccion(token, JwtServicio.TIPO_VERIFICAR);
        UsuarioFila u = usuarios.porId(UUID.fromString(j.getSubject()))
                .orElseThrow(() -> BusinessException.invalida("El enlace no es válido o ya venció."));
        String correoToken = j.getClaimAsString("correo");
        if (correoToken == null || !correoToken.equalsIgnoreCase(u.correo())) {
            throw BusinessException.invalida("El enlace no es válido o ya venció.");
        }
        if (u.correoVerificadoEn() != null) {
            return;
        }
        usuarios.marcarCorreoVerificado(u.id());
        notificaciones.encolarCorreo(u.id(), "bienvenida", Map.of("nombre", u.nombre()));
    }

    /** Responde siempre lo mismo, exista o no la cuenta. */
    @Transactional
    public void reenviarVerificacion(String correoCrudo) {
        String correo = normalizar(correoCrudo);
        limitarRecuperacion(correo);
        usuarios.porCorreo(correo)
                .filter(u -> u.correoVerificadoEn() == null && "activo".equals(u.estado()))
                .ifPresent(u -> encolarVerificacion(u.id(), u.correo(), u.nombre()));
    }

    @Transactional
    public void olvideClave(String correoCrudo) {
        String correo = normalizar(correoCrudo);
        limitarRecuperacion(correo);
        usuarios.porCorreo(correo)
                .filter(u -> "activo".equals(u.estado()) && u.hashClave() != null)
                .ifPresent(u -> {
                    String token = jwt.emitirAccion(JwtServicio.TIPO_RESTABLECER, u.id(),
                            Duration.ofMinutes(props.seguridad().recuperacionMinutos()),
                            Map.of("h", JwtServicio.huellaClave(u.hashClave())));
                    notificaciones.encolarCorreo(u.id(), "restablecer_clave", Map.of(
                            "nombre", u.nombre(),
                            "enlace", props.urls().portal() + "/restablecer-clave?token=" + token));
                });
    }

    @Transactional
    public void restablecerClave(String token, String claveNueva) {
        Jwt j = jwt.leerAccion(token, JwtServicio.TIPO_RESTABLECER);
        UsuarioFila u = usuarios.porId(UUID.fromString(j.getSubject()))
                .orElseThrow(() -> BusinessException.invalida("El enlace no es válido o ya venció."));
        if (!"activo".equals(u.estado()) || u.hashClave() == null
                || !JwtServicio.huellaClave(u.hashClave()).equals(j.getClaimAsString("h"))) {
            throw BusinessException.invalida("El enlace no es válido o ya venció.");
        }
        politica.validar(claveNueva, u.correo(), "clave");
        usuarios.cambiarClave(u.id(), encoder.encode(claveNueva));
        sesiones.revocarTodas(u.id());
    }

    // ---------------- apoyo ----------------

    private void limitarRecuperacion(String correo) {
        limitador.consumir("recuperacion|" + correo, props.seguridad().limiteRecuperacionesHora(), 3600,
                "Ya pediste varios correos. Intenta de nuevo en una hora.");
    }

    private void encolarVerificacion(UUID usuarioId, String correo, String nombre) {
        String token = jwt.emitirAccion(JwtServicio.TIPO_VERIFICAR, usuarioId,
                Duration.ofHours(props.seguridad().verificacionHoras()), Map.of("correo", correo));
        notificaciones.encolarCorreo(usuarioId, "verificar_correo", Map.of(
                "nombre", nombre,
                "enlace", props.urls().portal() + "/verificar-correo?token=" + token));
    }

    private String claveFalsa() {
        String c = claveFalsa;
        if (c == null) {
            c = encoder.encode(UUID.randomUUID().toString());
            claveFalsa = c;
        }
        return c;
    }

    static String normalizar(String correo) {
        return correo == null ? "" : correo.trim().toLowerCase();
    }

    static UsuarioDto usuarioDto(UsuarioFila u, List<String> roles) {
        return new UsuarioDto(u.id(), u.correo(), u.nombre(), u.idiomaCodigo(), u.correoVerificadoEn() != null, roles);
    }

    private static RespuestaSesion respuesta(TokensDto t, UsuarioDto u) {
        return new RespuestaSesion(t.tokenAcceso(), t.tokenRenovacion(), t.expiraEnSegundos(), u);
    }
}
