package mx.com.traveloaxaca.negocios.servicio;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.oauth2.jwt.Jwt;

/** Quién hace la petición: su id y los roles globales que trae el token. */
public record Actor(UUID usuarioId, Set<String> roles) {

    public static Actor de(Jwt jwt) {
        List<String> r = jwt.getClaimAsStringList("roles");
        return new Actor(UUID.fromString(jwt.getSubject()), r == null ? Set.of() : Set.copyOf(r));
    }

    /** admin y editor pueden editar cualquier ficha (soporte). */
    public boolean puedeEditarTodo() {
        return roles.contains("admin") || roles.contains("editor");
    }

    /** ventas solo lee. */
    public boolean puedeLeerTodo() {
        return puedeEditarTodo() || roles.contains("ventas");
    }
}
