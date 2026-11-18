package mx.com.traveloaxaca.negocios.servicio;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import mx.com.traveloaxaca.negocios.dto.NegocioDtos.FaltantesDto;
import mx.com.traveloaxaca.negocios.repo.FichaRepositorio;
import mx.com.traveloaxaca.negocios.repo.NegocioRepositorio;
import org.springframework.stereotype.Component;

/**
 * Qué le falta a una ficha para enviarse a revisión. Es más ligero que lo que exige publicar:
 * basta con fotos subidas y no rechazadas, porque el equipo las aprueba durante la revisión.
 */
@Component
public class FaltantesEnvio {

    private static final Map<String, String> MENSAJES_PUBLICAR = Map.of(
            "sucursal_principal_con_ubicacion", "Marca en el mapa dónde está tu negocio.",
            "contacto_whatsapp_o_telefono", "Agrega un WhatsApp o un teléfono de contacto.",
            "fotos_minimas", "Tu negocio necesita más fotos aprobadas para publicarse.",
            "descripcion_es", "Escribe la descripción corta en español.");

    private final FichaRepositorio ficha;
    private final NegocioRepositorio negocios;

    public FaltantesEnvio(FichaRepositorio ficha, NegocioRepositorio negocios) {
        this.ficha = ficha;
        this.negocios = negocios;
    }

    public FaltantesDto calcular(UUID negocioId, int puntaje) {
        List<String> claves = new ArrayList<>();
        Map<String, String> mensajes = new LinkedHashMap<>();
        var es = ficha.traduccion(negocioId, "es").orElse(null);
        if (es == null || es.descripcionCorta() == null || es.descripcionCorta().isBlank()) {
            agregar(claves, mensajes, "descripcion_corta", "Escribe la descripción corta en español.");
        }
        boolean conUbicacion = ficha.sucursales(negocioId).stream()
                .anyMatch(s -> s.esPrincipal() && s.latitud() != null && s.longitud() != null);
        if (!conUbicacion) {
            agregar(claves, mensajes, "ubicacion", "Marca en el mapa dónde está tu negocio.");
        }
        if (!ficha.hayContactoDeTipo(negocioId, "whatsapp") && !ficha.hayContactoDeTipo(negocioId, "telefono")) {
            agregar(claves, mensajes, "contacto", "Agrega un WhatsApp o un teléfono de contacto.");
        }
        int minimas = ficha.fotosMinimas();
        long fotos = ficha.contarFotosNoRechazadas(negocioId);
        if (fotos < minimas) {
            agregar(claves, mensajes, "fotos", "Sube al menos " + minimas + " fotos de tu negocio (tienes " + fotos + ").");
        }
        return new FaltantesDto(claves, mensajes, puntaje, claves.isEmpty());
    }

    /** Lo que falta para publicar de verdad, con la lista de la base de datos y frases en español. */
    public Map<String, String> paraPublicar(UUID negocioId) {
        Map<String, String> r = new LinkedHashMap<>();
        for (String k : negocios.faltantes(negocioId)) {
            String m = MENSAJES_PUBLICAR.getOrDefault(k, "Falta completar: " + k + ".");
            if ("fotos_minimas".equals(k)) {
                m = "Necesitas al menos " + ficha.fotosMinimas() + " fotos aprobadas para publicar (tienes "
                        + ficha.contarFotosAprobadas(negocioId) + ").";
            }
            r.put(k, m);
        }
        return r;
    }

    private static void agregar(List<String> claves, Map<String, String> mensajes, String clave, String mensaje) {
        claves.add(clave);
        mensajes.put(clave, mensaje);
    }
}
