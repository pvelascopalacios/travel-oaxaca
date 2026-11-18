package mx.com.traveloaxaca.acceso.seguridad;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.crypto.SecretKey;
import mx.com.traveloaxaca.acceso.PropiedadesApp;
import mx.com.traveloaxaca.comun.error.BusinessException;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;

/**
 * Emite y lee los tokens firmados. Hay dos clases:
 *  - de acceso (15 minutos): los que manda la app en cada petición, con los roles dentro;
 *  - de acción (verificar correo, restablecer clave): enlaces de un solo uso que llegan por correo.
 */
@Component
public class JwtServicio {

    public static final String TIPO_ACCESO = "acceso";
    public static final String TIPO_VERIFICAR = "verificar_correo";
    public static final String TIPO_RESTABLECER = "restablecer_clave";
    private static final String EMISOR = "travel-oaxaca";

    private final JwtEncoder encoder;
    private final NimbusJwtDecoder decodificador;
    private final PropiedadesApp props;

    public JwtServicio(JwtEncoder encoder, SecretKey clave, PropiedadesApp props) {
        this.encoder = encoder;
        this.props = props;
        this.decodificador = NimbusJwtDecoder.withSecretKey(clave).macAlgorithm(MacAlgorithm.HS256).build();
    }

    public String emitirAcceso(UUID usuarioId, List<String> roles, UUID sesionId) {
        Instant ahora = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(EMISOR)
                .issuedAt(ahora)
                .expiresAt(ahora.plus(Duration.ofMinutes(props.seguridad().accesoMinutos())))
                .subject(usuarioId.toString())
                .claim("tipo", TIPO_ACCESO)
                .claim("roles", roles)
                .claim("sid", sesionId.toString())
                .build();
        return codificar(claims);
    }

    public long segundosDeAcceso() {
        return Duration.ofMinutes(props.seguridad().accesoMinutos()).toSeconds();
    }

    public String emitirAccion(String tipo, UUID usuarioId, Duration vigencia, Map<String, Object> extra) {
        Instant ahora = Instant.now();
        JwtClaimsSet.Builder b = JwtClaimsSet.builder()
                .issuer(EMISOR)
                .issuedAt(ahora)
                .expiresAt(ahora.plus(vigencia))
                .subject(usuarioId.toString())
                .id(UUID.randomUUID().toString())
                .claim("tipo", tipo);
        extra.forEach(b::claim);
        return codificar(b.build());
    }

    /** Valida firma, vigencia y tipo de un token de acción. */
    public Jwt leerAccion(String token, String tipoEsperado) {
        try {
            Jwt jwt = decodificador.decode(token);
            if (!tipoEsperado.equals(jwt.getClaimAsString("tipo"))) {
                throw BusinessException.invalida("El enlace no es válido o ya venció.");
            }
            return jwt;
        } catch (JwtException e) {
            throw BusinessException.invalida("El enlace no es válido o ya venció.");
        }
    }

    /**
     * Huella corta de la contraseña guardada. Va dentro del token de restablecer: en cuanto la
     * contraseña cambia, la huella cambia y el enlace deja de servir (un solo uso).
     */
    public static String huellaClave(String hashClave) {
        try {
            byte[] h = MessageDigest.getInstance("SHA-256")
                    .digest((hashClave == null ? "" : hashClave).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(h).substring(0, 16);
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private String codificar(JwtClaimsSet claims) {
        return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
                .getTokenValue();
    }
}
