package mx.com.traveloaxaca.comun.auditoria;

import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * Usuario que está ejecutando la operación actual (por hilo).
 * El filtro de autenticación (paso 2) lo establece al validar el token y lo limpia al terminar.
 * Los trabajos programados lo dejan vacío: la bitácora registra usuario nulo (= el sistema).
 */
public final class UsuarioActual {

    private static final ThreadLocal<UUID> ACTUAL = new ThreadLocal<>();

    private UsuarioActual() {
    }

    public static Optional<UUID> obtener() {
        return Optional.ofNullable(ACTUAL.get());
    }

    public static void establecer(UUID usuarioId) {
        ACTUAL.set(usuarioId);
    }

    public static void limpiar() {
        ACTUAL.remove();
    }

    /** Ejecuta el bloque como el usuario indicado y restaura el estado anterior al terminar. */
    public static <T> T ejecutarComo(UUID usuarioId, Supplier<T> bloque) {
        UUID anterior = ACTUAL.get();
        ACTUAL.set(usuarioId);
        try {
            return bloque.get();
        } finally {
            if (anterior == null) {
                ACTUAL.remove();
            } else {
                ACTUAL.set(anterior);
            }
        }
    }

    public static void ejecutarComo(UUID usuarioId, Runnable bloque) {
        ejecutarComo(usuarioId, () -> {
            bloque.run();
            return null;
        });
    }
}
