package mx.com.traveloaxaca.acceso.correo;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Modo desarrollo: en lugar de enviar el correo, lo escribe en el registro (ahí se ven los enlaces). */
@Component
@ConditionalOnProperty(name = "app.correo.modo", havingValue = "consola", matchIfMissing = true)
public class CorreoConsola implements EnviadorCorreo {

    private static final Logger log = LoggerFactory.getLogger(CorreoConsola.class);

    @Override
    public void enviar(String para, String asunto, String cuerpo) {
        log.info("\n===== CORREO (modo consola) =====\nPara: {}\nAsunto: {}\n\n{}\n=================================",
                para, asunto, cuerpo);
    }
}
