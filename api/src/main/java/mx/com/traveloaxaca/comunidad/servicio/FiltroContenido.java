package mx.com.traveloaxaca.comunidad.servicio;

import java.text.Normalizer;
import java.util.Locale;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

/**
 * Filtro automático: un texto con enlaces, correos, teléfonos o palabras de la lista editable
 * no se publica solo; queda pendiente para que lo vea una persona del equipo.
 */
@Component
public class FiltroContenido {

    private static final Pattern ENLACE = Pattern.compile(
            "(?i)(https?://|www\\.|\\b[a-z0-9-]+\\.(com|mx|net|org|info|xyz|me)\\b)");
    private static final Pattern CORREO = Pattern.compile("[\\w.+-]+@[\\w-]+(\\.[\\w-]+)+");
    private static final Pattern TELEFONO = Pattern.compile(
            "(?<!\\d)(?:\\+?\\d{1,3}[\\s.-]?)?\\(?\\d{2,4}\\)?[\\s.-]?\\d{3,4}[\\s.-]?\\d{3,4}(?!\\d)");

    private final ComunidadConfig cfg;

    public FiltroContenido(ComunidadConfig cfg) {
        this.cfg = cfg;
    }

    /** Motivo legible por el que el texto debe revisarse, o vacío si puede publicarse al instante. */
    public Optional<String> motivoDeRevision(String... textos) {
        StringBuilder junto = new StringBuilder();
        for (String t : textos) {
            if (t != null) {
                junto.append(t).append('\n');
            }
        }
        String texto = junto.toString();
        if (ENLACE.matcher(texto).find()) {
            return Optional.of("Incluye un enlace");
        }
        if (CORREO.matcher(texto).find()) {
            return Optional.of("Incluye un correo");
        }
        if (TELEFONO.matcher(texto).find()) {
            return Optional.of("Incluye un teléfono");
        }
        String lista = cfg.texto("palabras_filtradas");
        if (!lista.isBlank()) {
            String normal = normalizar(texto);
            for (String p : lista.split(",")) {
                String palabra = normalizar(p).trim();
                if (!palabra.isEmpty() && Pattern.compile("\\b" + Pattern.quote(palabra) + "\\b").matcher(normal).find()) {
                    return Optional.of("Incluye una palabra de la lista de revisión");
                }
            }
        }
        return Optional.empty();
    }

    static String normalizar(String s) {
        return Normalizer.normalize(s.toLowerCase(Locale.ROOT), Normalizer.Form.NFD).replaceAll("\\p{M}", "");
    }
}
