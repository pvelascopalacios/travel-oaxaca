package mx.com.traveloaxaca.acceso.servicio;

import java.nio.charset.StandardCharsets;
import java.util.Map;
import mx.com.traveloaxaca.acceso.PropiedadesApp;
import mx.com.traveloaxaca.comun.error.BusinessException;
import org.springframework.stereotype.Component;

/** Reglas de contraseña: mínimo 10 caracteres, máximo 72 bytes (límite de BCrypt) y distinta del correo. */
@Component
public class PoliticaClave {

    private final int minimo;

    public PoliticaClave(PropiedadesApp props) {
        this.minimo = props.seguridad().claveLongitudMinima();
    }

    public void validar(String clave, String correo, String campo) {
        String error = null;
        if (clave == null || clave.codePointCount(0, clave.length()) < minimo) {
            error = "La contraseña debe tener al menos " + minimo + " caracteres.";
        } else if (clave.getBytes(StandardCharsets.UTF_8).length > 72) {
            error = "La contraseña es demasiado larga (máximo 72 bytes).";
        } else if (correo != null && clave.equalsIgnoreCase(correo)) {
            error = "La contraseña no puede ser igual a tu correo.";
        }
        if (error != null) {
            throw BusinessException.invalida(error, Map.of(campo, error));
        }
    }
}
