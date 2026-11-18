package mx.com.traveloaxaca.negocios.servicio;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import mx.com.traveloaxaca.negocios.repo.NegocioRepositorio;
import org.springframework.stereotype.Component;

/**
 * Cambios a una ficha publicada que esperan revisión. Se guardan por campo, como
 * {"nombre_comercial": {"antes": "...", "despues": "..."}}, dentro de la revisión pendiente.
 * El paso 4 (revisión) los aplica al aprobar.
 */
@Component
public class RevisionServicio {

    private final NegocioRepositorio negocios;
    private final ObjectMapper json;

    public RevisionServicio(NegocioRepositorio negocios, ObjectMapper json) {
        this.negocios = negocios;
        this.json = json;
    }

    public void proponer(UUID negocioId, UUID usuarioId, String campo, Object antes, Object despues) {
        Map<String, Object> par = new LinkedHashMap<>();
        par.put("antes", antes);
        par.put("despues", despues);
        String fragmento = aJson(Map.of(campo, par));
        var pendiente = negocios.revisionPendiente(negocioId);
        if (pendiente.isPresent()) {
            negocios.mezclarCambios(pendiente.get().id(), fragmento);
        } else {
            negocios.crearRevision(negocioId, usuarioId, fragmento);
        }
    }

    String aJson(Object o) {
        try {
            return json.writeValueAsString(o);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }
}
