package mx.com.traveloaxaca.explorar.servicio;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.text.Normalizer;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Registra qué se busca, sin identificar a nadie: no guarda la ubicación exacta (solo un geohash de 5 caracteres) y el
 * dispositivo es opcional. Si falla, la búsqueda del turista sigue funcionando.
 */
@Service
public class BusquedaLogServicio {

    private static final Logger log = LoggerFactory.getLogger(BusquedaLogServicio.class);

    private final JdbcClient jdbc;
    private final ObjectMapper json;

    public BusquedaLogServicio(JdbcClient jdbc, ObjectMapper json) {
        this.jdbc = jdbc;
        this.json = json;
    }

    public static String normalizar(String texto) {
        if (texto == null) {
            return null;
        }
        String s = Normalizer.normalize(texto, Normalizer.Form.NFD).replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT).trim().replaceAll("\\s+", " ");
        if (s.isEmpty()) {
            return null;
        }
        return s.length() > 100 ? s.substring(0, 100) : s;
    }

    /**
     * Va en su propia transacción de escritura: la búsqueda que lo llama es de solo lectura y un fallo aquí no debe
     * afectarla. filtros: sin lat/lng; no se guardan aunque lleguen.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void registrar(String dispositivoHeader, String texto, Map<String, Object> filtros, long total,
                          Double lat, Double lng) {
        try {
            UUID dispositivo = dispositivoValido(dispositivoHeader);
            String zona = (lat != null && lng != null) ? Geohash.codificar(lat, lng, 5) : null;
            jdbc.sql("""
                    INSERT INTO busqueda_log (dispositivo_id, texto_normalizado, filtros, total_resultados, zona_aprox)
                    VALUES (:d, :t, CAST(:f AS jsonb), :n, :z)""")
                    .param("d", dispositivo).param("t", normalizar(texto))
                    .param("f", json.writeValueAsString(filtros == null ? Map.of() : filtros))
                    .param("n", (int) Math.min(total, Integer.MAX_VALUE)).param("z", zona).update();
        } catch (Exception e) {
            log.warn("No se pudo registrar la búsqueda: {}", e.getMessage());
        }
    }

    private UUID dispositivoValido(String valor) {
        if (valor == null || valor.isBlank()) {
            return null;
        }
        try {
            UUID id = UUID.fromString(valor.trim());
            int n = jdbc.sql("SELECT count(*) FROM dispositivo WHERE id = :id").param("id", id).query(Integer.class).single();
            return n > 0 ? id : null;
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    /** Cada madrugada borra lo que pasa de 12 meses. */
    @Scheduled(cron = "0 30 3 * * *", zone = "America/Mexico_City")
    public void purgar() {
        try {
            jdbc.sql("SELECT purgar_busqueda_log(12)").query(Long.class).optional();
        } catch (Exception e) {
            log.warn("No se pudo purgar busqueda_log: {}", e.getMessage());
        }
    }
}
