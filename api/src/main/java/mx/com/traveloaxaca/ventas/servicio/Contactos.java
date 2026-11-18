package mx.com.traveloaxaca.ventas.servicio;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.regex.Pattern;

/** Limpieza de teléfonos y correos que escribe una persona (o viene en un archivo). */
public final class Contactos {

    public static final ZoneId ZONA = ZoneId.of("America/Mexico_City");
    private static final Pattern E164 = Pattern.compile("^\\+[1-9][0-9]{7,14}$");
    private static final Pattern CORREO = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");

    private Contactos() {
    }

    public static LocalDate hoy() {
        return LocalDate.now(ZONA);
    }

    /**
     * Acepta +529515550123, 951 555 0123 o (951) 555-0123 y lo regresa en formato E.164.
     * Un número de 10 dígitos se toma como mexicano. Regresa null si no se puede interpretar.
     */
    public static String telefono(String crudo) {
        if (crudo == null) {
            return null;
        }
        String s = crudo.trim().replaceAll("[\\s().-]", "");
        if (s.matches("^[0-9]{10}$")) {
            s = "+52" + s;
        }
        return E164.matcher(s).matches() ? s : null;
    }

    public static boolean correoValido(String correo) {
        return correo != null && correo.length() <= 160 && CORREO.matcher(correo).matches();
    }

    public static String vacioANulo(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
