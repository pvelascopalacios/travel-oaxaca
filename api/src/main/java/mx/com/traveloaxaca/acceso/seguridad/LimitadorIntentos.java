package mx.com.traveloaxaca.acceso.seguridad;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.Map;
import mx.com.traveloaxaca.comun.error.BusinessException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Límite de intentos en memoria (ventana deslizante). Suficiente con un solo servidor;
 * si algún día hay varios, este componente se cambia por uno compartido (por ejemplo Redis).
 */
@Component
public class LimitadorIntentos {

    private static final long VIDA_MAXIMA_MS = 2 * 3600_000L;

    private final Map<String, Deque<Long>> eventos = new HashMap<>();

    /** Falla con 429 si ya hay `maximo` eventos dentro de la ventana. No registra nada. */
    public synchronized void exigirDisponible(String clave, int maximo, long ventanaSegundos, String mensaje) {
        if (contar(clave, ventanaSegundos) >= maximo) {
            throw BusinessException.demasiadasSolicitudes(mensaje);
        }
    }

    /** Anota un evento (por ejemplo un intento fallido). */
    public synchronized void registrar(String clave) {
        eventos.computeIfAbsent(clave, k -> new ArrayDeque<>()).addLast(System.currentTimeMillis());
    }

    /** Verifica el límite y, si hay lugar, anota el evento. */
    public synchronized void consumir(String clave, int maximo, long ventanaSegundos, String mensaje) {
        exigirDisponible(clave, maximo, ventanaSegundos, mensaje);
        registrar(clave);
    }

    public synchronized void limpiar(String clave) {
        eventos.remove(clave);
    }

    private int contar(String clave, long ventanaSegundos) {
        Deque<Long> d = eventos.get(clave);
        if (d == null) {
            return 0;
        }
        long desde = System.currentTimeMillis() - ventanaSegundos * 1000;
        while (!d.isEmpty() && d.peekFirst() < desde) {
            d.pollFirst();
        }
        if (d.isEmpty()) {
            eventos.remove(clave);
            return 0;
        }
        return d.size();
    }

    @Scheduled(fixedDelay = 600_000)
    synchronized void limpiarViejos() {
        long limite = System.currentTimeMillis() - VIDA_MAXIMA_MS;
        eventos.values().removeIf(d -> d.isEmpty() || d.peekLast() < limite);
    }
}
