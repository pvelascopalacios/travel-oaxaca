package mx.com.traveloaxaca.ventas.servicio;

import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Lector de CSV hecho a la medida: comillas, saltos de línea dentro de un campo, BOM, y coma, punto y coma o tabulador
 * como separador (Excel en español guarda con punto y coma). Si el archivo no es UTF-8 se lee como Windows-1252.
 */
public final class CsvLector {

    public record Fila(int numero, List<String> celdas) {
    }

    public record Resultado(List<String> encabezados, List<Fila> filas) {
    }

    private CsvLector() {
    }

    public static String decodificar(byte[] bytes) {
        try {
            return StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString();
        } catch (CharacterCodingException e) {
            return new String(bytes, java.nio.charset.Charset.forName("windows-1252"));
        }
    }

    /** "Teléfono contacto" -> "telefono_contacto". */
    public static String normalizarEncabezado(String h) {
        return Normalizer.normalize(h == null ? "" : h, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .trim().toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "_").replaceAll("^_+|_+$", "");
    }

    public static Resultado leer(String texto) {
        String t = texto.startsWith("﻿") ? texto.substring(1) : texto;
        char sep = separador(t);
        List<List<String>> registros = registros(t, sep);
        if (registros.isEmpty()) {
            return new Resultado(List.of(), List.of());
        }
        List<String> encabezados = registros.get(0).stream().map(CsvLector::normalizarEncabezado).toList();
        List<Fila> filas = new ArrayList<>();
        for (int i = 1; i < registros.size(); i++) {
            List<String> celdas = registros.get(i);
            if (celdas.stream().allMatch(c -> c.isBlank())) {
                continue;
            }
            filas.add(new Fila(i + 1, celdas));
        }
        return new Resultado(encabezados, filas);
    }

    /** Elige el separador que más aparece en el encabezado, fuera de comillas. */
    private static char separador(String t) {
        int comas = 0;
        int puntoYComa = 0;
        int tabs = 0;
        boolean entre = false;
        for (int i = 0; i < t.length(); i++) {
            char c = t.charAt(i);
            if (c == '"') {
                entre = !entre;
            } else if (!entre) {
                if (c == '\n' || c == '\r') {
                    break;
                }
                if (c == ',') {
                    comas++;
                } else if (c == ';') {
                    puntoYComa++;
                } else if (c == '\t') {
                    tabs++;
                }
            }
        }
        if (puntoYComa > comas && puntoYComa >= tabs) {
            return ';';
        }
        if (tabs > comas) {
            return '\t';
        }
        return ',';
    }

    private static List<List<String>> registros(String t, char sep) {
        List<List<String>> todos = new ArrayList<>();
        List<String> actual = new ArrayList<>();
        StringBuilder campo = new StringBuilder();
        boolean entre = false;
        int n = t.length();
        for (int i = 0; i < n; i++) {
            char c = t.charAt(i);
            if (entre) {
                if (c == '"') {
                    if (i + 1 < n && t.charAt(i + 1) == '"') {
                        campo.append('"');
                        i++;
                    } else {
                        entre = false;
                    }
                } else {
                    campo.append(c);
                }
            } else if (c == '"') {
                entre = true;
            } else if (c == sep) {
                actual.add(campo.toString());
                campo.setLength(0);
            } else if (c == '\n' || c == '\r') {
                if (c == '\r' && i + 1 < n && t.charAt(i + 1) == '\n') {
                    i++;
                }
                actual.add(campo.toString());
                campo.setLength(0);
                todos.add(actual);
                actual = new ArrayList<>();
            } else {
                campo.append(c);
            }
        }
        if (campo.length() > 0 || !actual.isEmpty()) {
            actual.add(campo.toString());
            todos.add(actual);
        }
        return todos;
    }

    /** Escapa un valor para escribirlo en un CSV. También neutraliza fórmulas (=, +, -, @) para que Excel no las ejecute. */
    public static String escribir(String v) {
        if (v == null) {
            return "";
        }
        String s = v;
        if (!s.isEmpty() && "=+-@".indexOf(s.charAt(0)) >= 0 && !s.matches("^[+-]?[0-9][0-9.,]*$")) {
            s = "'" + s;
        }
        if (s.contains(",") || s.contains("\"") || s.contains("\n") || s.contains("\r") || s.contains(";")) {
            return "\"" + s.replace("\"", "\"\"") + "\"";
        }
        return s;
    }
}
