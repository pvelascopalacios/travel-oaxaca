package mx.com.traveloaxaca.comun.auditoria;

import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Before;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Al entrar a cualquier método @Transactional de escritura, le dice a PostgreSQL quién es el usuario:
 *   SELECT set_config('app.usuario_id', '<uuid>', true);
 * Los triggers de auditoría de la base (fn_auditar) leen ese valor y lo guardan en la bitácora.
 * Si no hay usuario (trabajos del sistema) no hace nada y la bitácora queda con usuario nulo.
 */
@Aspect
@Component
@Order(Ordered.LOWEST_PRECEDENCE)
public class AuditoriaTransaccionAspect {

    private final JdbcClient jdbc;

    public AuditoriaTransaccionAspect(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @Before("@annotation(org.springframework.transaction.annotation.Transactional)"
            + " || @within(org.springframework.transaction.annotation.Transactional)")
    public void registrarUsuario() {
        if (!TransactionSynchronizationManager.isActualTransactionActive()
                || TransactionSynchronizationManager.isCurrentTransactionReadOnly()) {
            return;
        }
        UsuarioActual.obtener().ifPresent(id ->
                jdbc.sql("SELECT set_config('app.usuario_id', :id, true)")
                        .param("id", id.toString())
                        .query(String.class)
                        .single());
    }
}
