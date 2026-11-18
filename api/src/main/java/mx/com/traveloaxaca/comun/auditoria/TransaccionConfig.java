package mx.com.traveloaxaca.comun.auditoria;

import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.transaction.annotation.EnableTransactionManagement;

/**
 * Fija el orden de la transacción para que sea la capa EXTERNA y el aspecto de auditoría
 * (AuditoriaTransaccionAspect) corra DENTRO de ella: así set_config(..., true) vive lo que dura
 * la transacción y los triggers de la base leen el usuario correcto.
 */
@Configuration
@EnableTransactionManagement(proxyTargetClass = true, order = Ordered.LOWEST_PRECEDENCE - 100)
public class TransaccionConfig {
}
