package mx.com.traveloaxaca.medicion.servicio;

import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import mx.com.traveloaxaca.medicion.dto.MedicionDtos.MetricasGeneralesDto;
import mx.com.traveloaxaca.medicion.dto.MedicionDtos.NegocioRankingDto;
import mx.com.traveloaxaca.medicion.repo.MedicionRepositorio;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Panel interno: totales y ranking de negocios, con filtros por región y categoría. */
@Service
@Transactional(readOnly = true)
public class MetricasGeneralesServicio {

    static final ZoneId MEXICO = ZoneId.of("America/Mexico_City");

    private final MedicionRepositorio repo;

    public MetricasGeneralesServicio(MedicionRepositorio repo) {
        this.repo = repo;
    }

    public MetricasGeneralesDto resumen(Integer diasPedidos, UUID regionId, UUID categoriaId, Integer limite) {
        int dias = MetricasServicio.exigirPeriodo(diasPedidos);
        int tope = limite == null ? 20 : Math.max(1, Math.min(100, limite));
        LocalDate hoy = LocalDate.now(MEXICO);
        LocalDate desde = hoy.minusDays(dias - 1L);
        var t = repo.totales(desde, hoy, regionId, categoriaId);
        List<NegocioRankingDto> negocios = repo.ranking(desde, hoy, regionId, categoriaId, tope).stream()
                .map(r -> new NegocioRankingDto(r.negocioId(), r.slug(), r.nombre(), r.categoriaClave(), r.vistas(),
                        r.contactos(), MetricasServicio.tasa(r.vistas(), r.contactos()), r.ultimoContacto(),
                        r.ultimoContacto() == null ? dias : (int) java.time.temporal.ChronoUnit.DAYS.between(r.ultimoContacto(), hoy)))
                .toList();
        return new MetricasGeneralesDto(dias, desde, hoy, t.vistas(), t.contactos(), MetricasServicio.tasa(t.vistas(), t.contactos()),
                repo.dispositivosActivos(desde, hoy, regionId, categoriaId), negocios);
    }
}
