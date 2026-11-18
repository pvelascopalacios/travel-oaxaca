package mx.com.traveloaxaca.acceso.servicio;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import mx.com.traveloaxaca.acceso.PropiedadesApp;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.TokensDto;
import mx.com.traveloaxaca.acceso.repo.DispositivoRepositorio;
import mx.com.traveloaxaca.acceso.repo.SesionRepositorio;
import mx.com.traveloaxaca.acceso.repo.UsuarioRepositorio;
import mx.com.traveloaxaca.acceso.repo.UsuarioRepositorio.UsuarioFila;
import mx.com.traveloaxaca.acceso.seguridad.JwtServicio;
import mx.com.traveloaxaca.comun.error.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

/** Abre sesiones y rota el token de renovación. El token se guarda solo como huella SHA-256. */
@Service
public class SesionServicio {

    private record Resultado(TokensDto tokens, boolean reutilizado) {
    }

    private static final SecureRandom ALEATORIO = new SecureRandom();

    private final SesionRepositorio sesiones;
    private final UsuarioRepositorio usuarios;
    private final DispositivoRepositorio dispositivos;
    private final JwtServicio jwt;
    private final PropiedadesApp props;
    private final TransactionTemplate tx;

    public SesionServicio(SesionRepositorio sesiones, UsuarioRepositorio usuarios, DispositivoRepositorio dispositivos,
                          JwtServicio jwt, PropiedadesApp props, TransactionTemplate tx) {
        this.sesiones = sesiones;
        this.usuarios = usuarios;
        this.dispositivos = dispositivos;
        this.jwt = jwt;
        this.props = props;
        this.tx = tx;
    }

    @Transactional
    public TokensDto abrir(UUID usuarioId, UUID dispositivoId, List<String> roles) {
        usuarios.tocarUltimoAcceso(usuarioId);
        return emitir(usuarioId, dispositivoId, roles);
    }

    public TokensDto renovar(String tokenRenovacion) {
        String huella = huella(tokenRenovacion);
        Resultado r = tx.execute(st -> {
            var s = sesiones.porHuellaParaActualizar(huella).orElse(null);
            if (s == null) {
                return new Resultado(null, false);
            }
            if (s.revocadaEn() != null) {
                // Un token ya usado reapareció: puede estar robado. Se cierran todas las sesiones del usuario.
                sesiones.revocarTodas(s.usuarioId());
                return new Resultado(null, true);
            }
            if (s.expiraEn().isBefore(OffsetDateTime.now())) {
                sesiones.revocar(s.id());
                return new Resultado(null, false);
            }
            UsuarioFila u = usuarios.porId(s.usuarioId()).orElse(null);
            if (u == null || !"activo".equals(u.estado())) {
                sesiones.revocar(s.id());
                return new Resultado(null, false);
            }
            sesiones.revocar(s.id());
            usuarios.tocarUltimoAcceso(u.id());
            return new Resultado(emitir(u.id(), s.dispositivoId(), usuarios.roles(u.id())), false);
        });
        // La revocación ya quedó confirmada; recién ahora se responde el error.
        if (r == null || r.tokens() == null) {
            throw BusinessException.noAutenticado("Tu sesión venció. Inicia sesión de nuevo.");
        }
        return r.tokens();
    }

    private TokensDto emitir(UUID usuarioId, UUID dispositivoId, List<String> roles) {
        UUID dispositivo = (dispositivoId != null && dispositivos.existe(dispositivoId)) ? dispositivoId : null;
        byte[] bytes = new byte[32];
        ALEATORIO.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        UUID sesionId = sesiones.crear(usuarioId, dispositivo, huella(token), props.seguridad().renovacionDias());
        if (dispositivo != null) {
            dispositivos.vincularUsuario(dispositivo, usuarioId);
        }
        return new TokensDto(jwt.emitirAcceso(usuarioId, roles, sesionId), token, jwt.segundosDeAcceso());
    }

    static String huella(String token) {
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
