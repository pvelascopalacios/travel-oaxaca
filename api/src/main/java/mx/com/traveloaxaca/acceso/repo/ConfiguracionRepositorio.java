package mx.com.traveloaxaca.acceso.repo;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class ConfiguracionRepositorio {

    private final JdbcClient jdbc;

    public ConfiguracionRepositorio(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Lee una clave de tipo texto de la tabla configuracion; si no existe, regresa el valor por omisión. */
    public String texto(String clave, String porOmision) {
        return jdbc.sql("SELECT valor #>> '{}' FROM configuracion WHERE clave = :c AND tipo = 'texto'")
                .param("c", clave).query(String.class).optional().orElse(porOmision);
    }
}
