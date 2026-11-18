package mx.com.traveloaxaca.estado;

import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

@Service
public class EstadoService {

    private final JdbcClient jdbc;
    private final String version;

    public EstadoService(JdbcClient jdbc, @Value("${app.version}") String version) {
        this.jdbc = jdbc;
        this.version = version;
    }

    public Map<String, Object> estado() {
        Map<String, Object> api = new LinkedHashMap<>();
        api.put("nombre", "Travel Oaxaca API");
        api.put("version", version);

        Map<String, Object> base = new LinkedHashMap<>();
        base.put("postgis", jdbc.sql("SELECT postgis_version()").query(String.class).single());
        base.put("ultimaMigracion", jdbc.sql(
                "SELECT version FROM flyway_schema_history WHERE success ORDER BY installed_rank DESC LIMIT 1")
                .query(String.class).optional().orElse(null));
        base.put("tablas", jdbc.sql("""
                SELECT count(*) FROM information_schema.tables
                WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
                  AND table_name NOT LIKE 'evento\\_uso\\_%' AND table_name NOT IN ('spatial_ref_sys','flyway_schema_history')
                """).query(Integer.class).single());

        Map<String, Object> resultado = new LinkedHashMap<>();
        resultado.put("api", api);
        resultado.put("base", base);
        return resultado;
    }
}
