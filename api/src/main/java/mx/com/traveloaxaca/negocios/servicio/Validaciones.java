package mx.com.traveloaxaca.negocios.servicio;

import java.util.Map;
import java.util.regex.Pattern;
import mx.com.traveloaxaca.comun.error.BusinessException;

/** Reglas de formato que se repiten en varias rutas. */
public final class Validaciones {

    private Validaciones() {
    }

    private static final Pattern TELEFONO = Pattern.compile("^\\+[1-9][0-9]{7,14}$");
    private static final Pattern CORREO = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final Pattern URL = Pattern.compile("^https?://\\S+$");

    // Caja amplia alrededor de Oaxaca: sirve para atrapar coordenadas puestas al revés o de otro estado.
    private static final double LAT_MIN = 15.4, LAT_MAX = 18.9, LNG_MIN = -98.8, LNG_MAX = -93.7;

    public static void ubicacion(Double lat, Double lng) {
        if ((lat == null) != (lng == null)) {
            throw BusinessException.invalida("Envía latitud y longitud juntas.",
                    Map.of("latitud", "Envía latitud y longitud juntas."));
        }
        if (lat != null && (lat < LAT_MIN || lat > LAT_MAX || lng < LNG_MIN || lng > LNG_MAX)) {
            String m = "Esas coordenadas no están en Oaxaca. Revisa que la latitud y la longitud no estén al revés.";
            throw BusinessException.invalida(m, Map.of("latitud", m));
        }
    }

    static void contacto(String tipo, String valor) {
        String error = null;
        switch (tipo) {
            case "whatsapp", "telefono" -> {
                if (!TELEFONO.matcher(valor).matches()) {
                    error = "Escribe el número con lada internacional, por ejemplo +529541234567.";
                }
            }
            case "correo" -> {
                if (!CORREO.matcher(valor).matches()) {
                    error = "Escribe un correo válido.";
                }
            }
            default -> {
                if (!URL.matcher(valor).matches()) {
                    error = "Escribe la dirección completa, empezando con https://";
                }
            }
        }
        if (error != null) {
            throw BusinessException.invalida(error, Map.of("valor", error));
        }
    }

    public static String limpiar(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }
}
