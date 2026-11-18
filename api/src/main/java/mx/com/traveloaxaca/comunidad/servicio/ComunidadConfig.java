package mx.com.traveloaxaca.comunidad.servicio;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** Lee los valores editables de la tabla configuracion (con valor por omisión si la clave no existe). */
@Component
public class ComunidadConfig {

    private final JdbcClient jdbc;

    public ComunidadConfig(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public int entero(String clave, int defecto) {
        return jdbc.sql("SELECT config_entero(CAST(:c AS text), CAST(:d AS integer))")
                .param("c", clave).param("d", defecto).query(Integer.class).single();
    }

    public String texto(String clave) {
        return jdbc.sql("""
                SELECT COALESCE((SELECT valor #>> '{}' FROM configuracion WHERE clave = :c AND tipo = 'texto'), '')""")
                .param("c", clave).query(String.class).single();
    }
}
