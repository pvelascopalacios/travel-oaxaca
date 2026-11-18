package mx.com.traveloaxaca.negocios.servicio;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import mx.com.traveloaxaca.comun.error.BusinessException;
import org.springframework.stereotype.Component;

/**
 * Datos propios de cada tipo de negocio (columna `atributos`). Solo se aceptan las claves aprobadas;
 * cualquier otra se rechaza para que el catálogo no se llene de datos sin estructura.
 */
@Component
public class AtributosCategoria {

    private static final Pattern HORA = Pattern.compile("^([01][0-9]|2[0-3]):[0-5][0-9]$");
    private static final Set<String> MESA = Set.of("comer_aqui", "llevar");
    private static final Set<String> DIFICULTAD = Set.of("baja", "media", "alta");
    private static final Set<String> MUSICA = Set.of("en_vivo", "dj", "ambiente");
    private static final Set<String> ENVIOS = Set.of("nacional", "internacional");
    private static final Pattern HTTPS = Pattern.compile("^https://[^\\s]{4,500}$");

    /** raiz = hospedaje, tours, comida, vida_nocturna o compras. Regresa el mapa limpio listo para guardar. */
    public Map<String, Object> validar(String raiz, Map<String, Object> entrada) {
        Map<String, Object> limpio = new LinkedHashMap<>();
        if (entrada == null || entrada.isEmpty()) {
            return limpio;
        }
        Map<String, String> errores = new LinkedHashMap<>();
        for (Map.Entry<String, Object> e : entrada.entrySet()) {
            String k = e.getKey();
            Object v = e.getValue();
            if (v == null) {
                continue;
            }
            String error = switch (raiz) {
                case "hospedaje" -> hospedaje(k, v);
                case "comida" -> comida(k, v);
                case "tours" -> tours(k, v);
                case "vida_nocturna" -> vidaNocturna(k, v);
                case "compras" -> compras(k, v);
                default -> "Esta categoría no lleva datos adicionales.";
            };
            if (error == null) {
                limpio.put(k, v);
            } else {
                errores.put("atributos." + k, error);
            }
        }
        if (!errores.isEmpty()) {
            throw BusinessException.invalida("Revisa los datos propios de tu tipo de negocio.", errores);
        }
        return limpio;
    }

    private String hospedaje(String k, Object v) {
        return switch (k) {
            case "horaEntrada", "horaSalida" -> hora(v);
            case "numeroHabitaciones" -> entero(v, 1, 1000);
            case "aceptaNinos" -> (v instanceof Boolean) ? null : "Indica sí o no.";
            case "politicaCancelacion" -> texto(v, 500);
            default -> "Dato no permitido para hospedaje.";
        };
    }

    private String comida(String k, Object v) {
        return switch (k) {
            case "tipoCocina" -> lista(v, 10, 40, null);
            case "serviciosDeMesa" -> lista(v, 2, 20, MESA);
            case "rangoPlatillo" -> texto(v, 40);
            case "menuUrl" -> https(v);
            case "platillosTipicos" -> lista(v, 6, 60, null);
            default -> "Dato no permitido para comida.";
        };
    }

    private String vidaNocturna(String k, Object v) {
        return switch (k) {
            case "edadMinima" -> (v instanceof Integer n && (n == 18 || n == 21)) ? null : "Elige 18 o 21.";
            case "cover" -> texto(v, 60);
            case "musica" -> lista(v, 3, 20, MUSICA);
            default -> "Dato no permitido para bares y vida nocturna.";
        };
    }

    private String compras(String k, Object v) {
        return switch (k) {
            case "enviosAlcance" -> (v instanceof String s && ENVIOS.contains(s)) ? null : "Elige nacional o internacional.";
            default -> "Dato no permitido para artesanías y compras.";
        };
    }

    private String tours(String k, Object v) {
        return switch (k) {
            case "duracionHoras" -> numero(v, 0.5, 240);
            case "dificultad" -> (v instanceof String s && DIFICULTAD.contains(s)) ? null : "Elige baja, media o alta.";
            case "puntoEncuentro" -> texto(v, 200);
            case "minimoPersonas" -> entero(v, 1, 500);
            case "idiomasGuia" -> lista(v, 6, 10, null);
            default -> "Dato no permitido para tours.";
        };
    }

    private static String https(Object v) {
        return (v instanceof String s && HTTPS.matcher(s).matches()) ? null : "Escribe un enlace que empiece con https://.";
    }

    private static String hora(Object v) {
        return (v instanceof String s && HORA.matcher(s).matches()) ? null : "Usa el formato HH:mm, por ejemplo 15:00.";
    }

    private static String texto(Object v, int max) {
        return (v instanceof String s && s.length() <= max) ? null : "Texto de hasta " + max + " caracteres.";
    }

    private static String entero(Object v, int min, int max) {
        if (v instanceof Integer || v instanceof Long || v instanceof Short) {
            long n = ((Number) v).longValue();
            return (n >= min && n <= max) ? null : "Debe estar entre " + min + " y " + max + ".";
        }
        return "Escribe un número entero.";
    }

    private static String numero(Object v, double min, double max) {
        if (v instanceof Number n) {
            double d = n instanceof BigDecimal b ? b.doubleValue() : n.doubleValue();
            return (d >= min && d <= max) ? null : "Debe estar entre " + min + " y " + max + ".";
        }
        return "Escribe un número.";
    }

    private static String lista(Object v, int maxItems, int maxLargo, Set<String> permitidos) {
        if (!(v instanceof List<?> l) || l.size() > maxItems) {
            return "Envía una lista de hasta " + maxItems + " elementos.";
        }
        for (Object o : l) {
            if (!(o instanceof String s) || s.isBlank() || s.length() > maxLargo
                    || (permitidos != null && !permitidos.contains(s))) {
                return permitidos == null ? "Cada elemento es un texto corto." : "Valores permitidos: " + permitidos + ".";
            }
        }
        return null;
    }
}
