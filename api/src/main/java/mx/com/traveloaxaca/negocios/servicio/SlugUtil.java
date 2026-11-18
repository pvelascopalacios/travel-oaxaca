package mx.com.traveloaxaca.negocios.servicio;

import java.text.Normalizer;
import java.util.Collection;
import java.util.Locale;

public final class SlugUtil {

    private SlugUtil() {
    }

    /** "Posada El Sol Ñandú" -> "posada-el-sol-nandu". */
    public static String base(String nombre) {
        String s = Normalizer.normalize(nombre == null ? "" : nombre, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
        if (s.length() > 60) {
            s = s.substring(0, 60).replaceAll("-+$", "");
        }
        return s.isEmpty() ? "negocio" : s;
    }

    /** Elige base, base-2, base-3... el primero que no esté usado. */
    public static String libre(String base, Collection<String> usados) {
        if (!usados.contains(base)) {
            return base;
        }
        int n = 2;
        while (usados.contains(base + "-" + n)) {
            n++;
        }
        return base + "-" + n;
    }
}
