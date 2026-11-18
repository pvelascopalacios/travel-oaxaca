package mx.com.traveloaxaca.medicion.servicio;

import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import mx.com.traveloaxaca.acceso.seguridad.LimitadorIntentos;
import mx.com.traveloaxaca.comun.error.BusinessException;
import mx.com.traveloaxaca.medicion.dto.MedicionDtos.EventosUsoDto;
import mx.com.traveloaxaca.medicion.dto.MedicionDtos.EventosUsoRespuesta;
import mx.com.traveloaxaca.medicion.dto.MedicionDtos.ItemEventoDto;
import mx.com.traveloaxaca.medicion.repo.MedicionRepositorio;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Recibe lo que hace el turista (sin cuenta, solo con el id de su dispositivo). No guarda la cuenta ni la ubicación.
 * Se omite en silencio lo que no debe contar: negocios no publicados, eventos vencidos y dobles toques.
 */
@Service
public class EventoUsoServicio {

    private static final Logger log = LoggerFactory.getLogger(EventoUsoServicio.class);

    static final int LIMITE_POR_HORA = 600;
    static final Duration ANTIGUEDAD_MAXIMA = Duration.ofHours(24);
    static final Duration ADELANTO_MAXIMO = Duration.ofMinutes(5);

    private final MedicionRepositorio repo;
    private final LimitadorIntentos limitador;

    public EventoUsoServicio(MedicionRepositorio repo, LimitadorIntentos limitador) {
        this.repo = repo;
        this.limitador = limitador;
    }

    static String origen(String pedido) {
        return pedido == null || pedido.isBlank() ? "app" : pedido.trim().toLowerCase();
    }

    @Transactional
    public EventosUsoRespuesta registrar(EventosUsoDto dto) {
        String clave = "eventouso|" + dto.dispositivoId();
        limitador.exigirDisponible(clave, LIMITE_POR_HORA, 3600,
                "Este dispositivo envió demasiados eventos. Intenta de nuevo en un rato.");
        if (!repo.dispositivoExiste(dto.dispositivoId())) {
            throw BusinessException.invalida("Registra primero el dispositivo.",
                    Map.of("dispositivoId", "Dispositivo desconocido."));
        }
        List<ItemEventoDto> items = dto.eventos();
        Set<UUID> publicados = Set.copyOf(repo.negociosPublicados(items.stream().map(ItemEventoDto::negocioId).distinct().toList()));
        List<UUID> pedidas = items.stream().map(ItemEventoDto::sucursalId).filter(s -> s != null).distinct().toList();
        Map<UUID, UUID> duenoDeSucursal = new HashMap<>();
        repo.sucursales(pedidas).forEach(s -> duenoDeSucursal.put(s.id(), s.negocioId()));

        OffsetDateTime ahora = OffsetDateTime.now();
        int registrados = 0;
        for (ItemEventoDto i : items) {
            limitador.registrar(clave);
            if (!publicados.contains(i.negocioId())) {
                continue;
            }
            OffsetDateTime cuando = i.ocurridoEn() == null ? ahora : i.ocurridoEn();
            if (cuando.isBefore(ahora.minus(ANTIGUEDAD_MAXIMA)) || cuando.isAfter(ahora.plus(ADELANTO_MAXIMO))) {
                continue;
            }
            UUID sucursal = i.sucursalId() != null && i.negocioId().equals(duenoDeSucursal.get(i.sucursalId())) ? i.sucursalId() : null;
            if (guardar(i.tipo(), i.negocioId(), dto.dispositivoId(), origen(dto.origen()), dto.campana(), sucursal, cuando)) {
                registrados++;
            }
        }
        return new EventosUsoRespuesta(items.size(), registrados);
    }

    private boolean guardar(String tipo, UUID negocio, UUID dispositivo, String origen, String campana, UUID sucursal,
                            OffsetDateTime cuando) {
        if (!"vista_ficha".equals(tipo) && repo.hayRepetido(dispositivo, negocio, tipo, cuando)) {
            return false;
        }
        return repo.registrar(tipo, negocio, dispositivo, origen, campana, sucursal, cuando);
    }

    /**
     * Lo llama favoritos al guardar un negocio. Va en su propia transacción y nunca falla hacia afuera: guardar un
     * favorito no debe depender de la medición.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void registrarGuardado(UUID dispositivo, UUID negocio) {
        try {
            if (dispositivo == null || !repo.dispositivoExiste(dispositivo)
                    || repo.negociosPublicados(List.of(negocio)).isEmpty()) {
                return;
            }
            guardar("guardado", negocio, dispositivo, "app", null, null, OffsetDateTime.now());
        } catch (Exception e) {
            log.warn("No se pudo registrar el guardado: {}", e.getMessage());
        }
    }

}
