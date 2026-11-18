package mx.com.traveloaxaca.contenido.servicio;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import mx.com.traveloaxaca.comun.error.BusinessException;
import org.springframework.stereotype.Component;

/**
 * Datos propios de lugares y eventos (columna `datos`). Solo se aceptan las claves aprobadas, igual que
 * los datos de cada tipo de negocio, para que el catálogo no se llene de campos sin estructura.
 */
@Component
public class DatosEditorial {

    private static final Pattern HORA = Pattern.compile("^([01][0-9]|2[0-3]):[0-5][0-9]$");
    private static final Set<String> ENTRADA = Set.of("gratis", "con_costo");
    private static final Set<String> DIFICULTAD = Set.of("baja", "media", "alta");

    public Map<String, Object> lugar(Map<String, Object> entrada) {
        Map<String, Object> limpio = new LinkedHashMap<>();
        Map<String, String> errores = new LinkedHashMap<>();
        if (entrada != null) {
            entrada.forEach((k, v) -> {
                if (v == null) {
                    return;
                }
                String error = switch (k) {
                    case "entrada" -> (v instanceof String s && ENTRADA.contains(s)) ? null : "Elige gratis o con_costo.";
                    case "costoNacional", "costoExtranjero" -> costo(v);
                    case "diasAbierto" -> dias(v);
                    case "horarioTexto" -> texto(v, 200);
                    case "accesible" -> (v instanceof Boolean) ? null : "Indica sí o no.";
                    case "dificultad" -> (v instanceof String s && DIFICULTAD.contains(s)) ? null : "Elige baja, media o alta.";
                    default -> "Dato no permitido para lugares.";
                };
                if (error == null) {
                    limpio.put(k, v);
                } else {
                    errores.put("datos." + k, error);
                }
            });
        }
        if (errores.isEmpty() && "gratis".equals(limpio.get("entrada"))
                && (limpio.containsKey("costoNacional") || limpio.containsKey("costoExtranjero"))) {
            errores.put("datos.entrada", "Si la entrada es gratis no lleva costo.");
        }
        return resultado(limpio, errores, "Revisa los datos del lugar.");
    }

    public Map<String, Object> evento(Map<String, Object> entrada) {
        Map<String, Object> limpio = new LinkedHashMap<>();
        Map<String, String> errores = new LinkedHashMap<>();
        if (entrada != null) {
            entrada.forEach((k, v) -> {
                if (v == null) {
                    return;
                }
                String error = switch (k) {
                    case "gratis" -> (v instanceof Boolean) ? null : "Indica sí o no.";
                    case "costoTexto" -> texto(v, 80);
                    case "horaInicio", "horaFin" -> (v instanceof String s && HORA.matcher(s).matches())
                            ? null : "Usa el formato HH:mm, por ejemplo 18:00.";
                    case "sede" -> texto(v, 120);
                    default -> "Dato no permitido para eventos.";
                };
                if (error == null) {
                    limpio.put(k, v);
                } else {
                    errores.put("datos." + k, error);
                }
            });
        }
        if (errores.isEmpty() && Boolean.TRUE.equals(limpio.get("gratis")) && limpio.containsKey("costoTexto")) {
            errores.put("datos.costoTexto", "Si el evento es gratis no lleva costo.");
        }
        return resultado(limpio, errores, "Revisa los datos del evento.");
    }

    private static Map<String, Object> resultado(Map<String, Object> limpio, Map<String, String> errores, String mensaje) {
        if (!errores.isEmpty()) {
            throw BusinessException.invalida(mensaje, errores);
        }
        return limpio;
    }

    private static String texto(Object v, int max) {
        return (v instanceof String s && !s.isBlank() && s.length() <= max) ? null : "Texto de hasta " + max + " caracteres.";
    }

    private static String costo(Object v) {
        if (v instanceof Number n) {
            BigDecimal d = new BigDecimal(n.toString());
            return (d.signum() >= 0 && d.compareTo(new BigDecimal("100000")) <= 0) ? null : "Debe estar entre 0 y 100000.";
        }
        return "Escribe un número.";
    }

    private static String dias(Object v) {
        if (!(v instanceof List<?> l) || l.isEmpty() || l.size() > 7) {
            return "Envía de 1 a 7 días (0 = domingo a 6 = sábado).";
        }
        for (Object o : l) {
            if (!(o instanceof Integer d) || d < 0 || d > 6) {
                return "Cada día va de 0 (domingo) a 6 (sábado).";
            }
        }
        return l.stream().distinct().count() == l.size() ? null : "No repitas días.";
    }
}
