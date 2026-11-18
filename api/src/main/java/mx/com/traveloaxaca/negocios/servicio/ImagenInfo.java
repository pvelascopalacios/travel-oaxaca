package mx.com.traveloaxaca.negocios.servicio;

import java.io.ByteArrayInputStream;
import java.util.Iterator;
import java.util.Optional;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;

/** Reconoce una foto por su contenido (no por la extensión) y lee su ancho y alto. */
final class ImagenInfo {

    record Datos(String mime, int ancho, int alto) {
    }

    private ImagenInfo() {
    }

    static Optional<Datos> analizar(byte[] b) {
        try {
            if (b.length > 12 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF) {
                return leerConImageIO(b, "image/jpeg");
            }
            if (b.length > 24 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G') {
                return leerConImageIO(b, "image/png");
            }
            if (b.length > 30 && b[0] == 'R' && b[1] == 'I' && b[2] == 'F' && b[3] == 'F'
                    && b[8] == 'W' && b[9] == 'E' && b[10] == 'B' && b[11] == 'P') {
                return leerWebp(b);
            }
        } catch (Exception e) {
            return Optional.empty();
        }
        return Optional.empty();
    }

    private static Optional<Datos> leerConImageIO(byte[] b, String mime) throws Exception {
        try (ImageInputStream in = ImageIO.createImageInputStream(new ByteArrayInputStream(b))) {
            Iterator<ImageReader> lectores = ImageIO.getImageReaders(in);
            if (!lectores.hasNext()) {
                return Optional.empty();
            }
            ImageReader r = lectores.next();
            try {
                r.setInput(in);
                return valido(mime, r.getWidth(0), r.getHeight(0));
            } finally {
                r.dispose();
            }
        }
    }

    private static Optional<Datos> leerWebp(byte[] b) {
        String tipo = new String(b, 12, 4, java.nio.charset.StandardCharsets.US_ASCII);
        int ancho;
        int alto;
        switch (tipo) {
            case "VP8X" -> {
                ancho = 1 + le24(b, 24);
                alto = 1 + le24(b, 27);
            }
            case "VP8L" -> {
                if ((b[20] & 0xFF) != 0x2F) {
                    return Optional.empty();
                }
                int b1 = b[21] & 0xFF, b2 = b[22] & 0xFF, b3 = b[23] & 0xFF, b4 = b[24] & 0xFF;
                ancho = 1 + (b1 | ((b2 & 0x3F) << 8));
                alto = 1 + ((b2 >> 6) | (b3 << 2) | ((b4 & 0x0F) << 10));
            }
            case "VP8 " -> {
                if ((b[23] & 0xFF) != 0x9D || (b[24] & 0xFF) != 0x01 || (b[25] & 0xFF) != 0x2A) {
                    return Optional.empty();
                }
                ancho = ((b[26] & 0xFF) | ((b[27] & 0xFF) << 8)) & 0x3FFF;
                alto = ((b[28] & 0xFF) | ((b[29] & 0xFF) << 8)) & 0x3FFF;
            }
            default -> {
                return Optional.empty();
            }
        }
        return valido("image/webp", ancho, alto);
    }

    private static int le24(byte[] b, int i) {
        return (b[i] & 0xFF) | ((b[i + 1] & 0xFF) << 8) | ((b[i + 2] & 0xFF) << 16);
    }

    private static Optional<Datos> valido(String mime, int ancho, int alto) {
        if (ancho <= 0 || alto <= 0 || ancho > 20000 || alto > 20000) {
            return Optional.empty();
        }
        return Optional.of(new Datos(mime, ancho, alto));
    }
}
