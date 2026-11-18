package mx.com.traveloaxaca.acceso.servicio;

import mx.com.traveloaxaca.acceso.PropiedadesApp;
import mx.com.traveloaxaca.acceso.repo.UsuarioRepositorio;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Crea el primer administrador al arrancar, solo si todavía no hay ninguno y se definieron
 * ADMIN_CORREO y ADMIN_CLAVE. Después de entrar, conviene quitar esas variables.
 */
@Component
public class AdminInicial implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminInicial.class);

    private final PropiedadesApp props;
    private final UsuarioRepositorio usuarios;
    private final PasswordEncoder encoder;
    private final PoliticaClave politica;
    private final TransactionTemplate tx;

    public AdminInicial(PropiedadesApp props, UsuarioRepositorio usuarios, PasswordEncoder encoder,
                        PoliticaClave politica, TransactionTemplate tx) {
        this.props = props;
        this.usuarios = usuarios;
        this.encoder = encoder;
        this.politica = politica;
        this.tx = tx;
    }

    @Override
    public void run(ApplicationArguments args) {
        String correo = props.adminInicial().correo();
        String clave = props.adminInicial().clave();
        if (correo == null || correo.isBlank() || clave == null || clave.isBlank()) {
            return;
        }
        try {
            String c = correo.trim().toLowerCase();
            politica.validar(clave, c, "clave");
            tx.executeWithoutResult(st -> {
                if (usuarios.contarAdministradoresActivos() > 0) {
                    return;
                }
                var existente = usuarios.porCorreo(c);
                var id = existente.map(UsuarioRepositorio.UsuarioFila::id)
                        .orElseGet(() -> usuarios.crear(c, encoder.encode(clave), "Administrador", "es"));
                usuarios.marcarCorreoVerificado(id);
                if (!usuarios.tieneRol(id, "turista")) {
                    usuarios.asignarRol(id, "turista");
                }
                usuarios.asignarRol(id, "admin");
                log.info("Se creó el administrador inicial {}", c);
            });
        } catch (RuntimeException e) {
            log.error("No se pudo crear el administrador inicial: {}", e.getMessage());
        }
    }
}
