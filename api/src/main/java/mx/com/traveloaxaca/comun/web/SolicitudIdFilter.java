package mx.com.traveloaxaca.comun.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.UUID;
import mx.com.traveloaxaca.comun.api.ApiResponses;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Asigna un identificador a cada petición (respeta X-Request-Id si el cliente lo manda),
 * lo pone en los registros y lo devuelve en la cabecera de respuesta.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class SolicitudIdFilter extends OncePerRequestFilter {

    public static final String CABECERA = "X-Request-Id";

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        String id = req.getHeader(CABECERA);
        if (id == null || id.isBlank() || id.length() > 64 || !id.matches("[A-Za-z0-9._-]+")) {
            id = UUID.randomUUID().toString();
        }
        MDC.put(ApiResponses.SOLICITUD_ID_MDC, id);
        res.setHeader(CABECERA, id);
        try {
            chain.doFilter(req, res);
        } finally {
            MDC.remove(ApiResponses.SOLICITUD_ID_MDC);
        }
    }
}
