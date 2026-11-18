package mx.com.traveloaxaca.acceso.seguridad;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import mx.com.traveloaxaca.comun.auditoria.UsuarioActual;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Pasa el usuario autenticado a UsuarioActual para que la auditoría de la base de datos sepa quién
 * hizo cada cambio. No es un @Component a propósito: se agrega solo dentro de la cadena de seguridad.
 */
public class UsuarioActualFilter extends OncePerRequestFilter {

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth instanceof JwtAuthenticationToken token) {
            try {
                UsuarioActual.establecer(UUID.fromString(token.getName()));
            } catch (IllegalArgumentException e) {
                // sujeto que no es un uuid: no se registra usuario
            }
        }
        try {
            chain.doFilter(req, res);
        } finally {
            UsuarioActual.limpiar();
        }
    }
}
