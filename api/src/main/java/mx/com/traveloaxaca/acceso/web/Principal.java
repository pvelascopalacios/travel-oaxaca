package mx.com.traveloaxaca.acceso.web;

import java.util.UUID;
import org.springframework.security.oauth2.jwt.Jwt;

/** Lee del token de acceso quién es la persona y cuál es su sesión. */
final class Principal {

    private Principal() {
    }

    static UUID usuarioId(Jwt jwt) {
        return UUID.fromString(jwt.getSubject());
    }

    static UUID sesionId(Jwt jwt) {
        return UUID.fromString(jwt.getClaimAsString("sid"));
    }
}
