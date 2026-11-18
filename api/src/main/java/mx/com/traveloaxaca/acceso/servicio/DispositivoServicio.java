package mx.com.traveloaxaca.acceso.servicio;

import java.util.Map;
import java.util.UUID;
import mx.com.traveloaxaca.acceso.PropiedadesApp;
import mx.com.traveloaxaca.acceso.dto.AccesoDtos.DispositivoDto;
import mx.com.traveloaxaca.acceso.repo.DispositivoRepositorio;
import mx.com.traveloaxaca.acceso.repo.UsuarioRepositorio;
import mx.com.traveloaxaca.acceso.seguridad.LimitadorIntentos;
import mx.com.traveloaxaca.comun.error.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DispositivoServicio {

    private final DispositivoRepositorio dispositivos;
    private final UsuarioRepositorio usuarios;
    private final LimitadorIntentos limitador;
    private final PropiedadesApp props;

    public DispositivoServicio(DispositivoRepositorio dispositivos, UsuarioRepositorio usuarios,
                               LimitadorIntentos limitador, PropiedadesApp props) {
        this.dispositivos = dispositivos;
        this.usuarios = usuarios;
        this.limitador = limitador;
        this.props = props;
    }

    @Transactional
    public UUID registrar(DispositivoDto dto, String ip) {
        limitador.consumir("dispositivo|" + ip, props.seguridad().limiteDispositivosHora(), 3600,
                "Demasiadas solicitudes desde tu red. Intenta más tarde.");
        String idioma = (dto.idiomaCodigo() == null || dto.idiomaCodigo().isBlank()) ? null : dto.idiomaCodigo();
        if (idioma != null && !usuarios.idiomaExiste(idioma)) {
            throw BusinessException.invalida("Idioma no disponible.", Map.of("idiomaCodigo", "Idioma no disponible."));
        }
        return dispositivos.registrar(dto.dispositivoId(), dto.plataforma(), dto.versionApp(), idioma,
                dto.tokenNotificacion());
    }
}
