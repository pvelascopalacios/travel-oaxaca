package mx.com.traveloaxaca.comun;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Servicio de pruebas para comprobar que la auditoría recibe al usuario. */
@Service
public class ServicioPrueba {

    private final JdbcClient jdbc;

    public ServicioPrueba(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Transactional
    public void cambiarDescripcion(String marca) {
        jdbc.sql("UPDATE configuracion SET descripcion = :d WHERE clave = 'reservas_activas'")
                .param("d", marca).update();
    }

    @Transactional(readOnly = true)
    public String leer() {
        return jdbc.sql("SELECT descripcion FROM configuracion WHERE clave = 'reservas_activas'")
                .query(String.class).single();
    }
}
