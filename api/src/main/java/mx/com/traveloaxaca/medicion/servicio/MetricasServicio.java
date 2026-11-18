package mx.com.traveloaxaca.medicion.servicio;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import mx.com.traveloaxaca.comercial.servicio.PlanServicio;
import mx.com.traveloaxaca.comun.error.BusinessException;
import mx.com.traveloaxaca.comunidad.servicio.ComunidadConfig;
import mx.com.traveloaxaca.medicion.dto.MedicionDtos.*;
import mx.com.traveloaxaca.medicion.repo.MedicionRepositorio;
import mx.com.traveloaxaca.medicion.repo.MedicionRepositorio.TipoPeriodoFila;
import mx.com.traveloaxaca.negocios.servicio.AccesoNegocio;
import mx.com.traveloaxaca.negocios.servicio.AccesoNegocio.Contexto;
import mx.com.traveloaxaca.negocios.servicio.Actor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Lo que ve el equipo del negocio (y el personal interno): sus cifras y sus reportes mensuales. */
@Service
@Transactional(readOnly = true)
public class MetricasServicio {

    static final Set<Integer> PERIODOS = Set.of(7, 30, 90);
    /** Los tipos que cuentan como contacto: los mismos de tipos_contacto() en la base. */
    static final Set<String> CONTACTOS = Set.of("toque_whatsapp", "llamada", "como_llegar", "guardado");

    private final MedicionRepositorio repo;
    private final AccesoNegocio acceso;
    private final ObjectMapper json;
    private final PlanServicio planes;
    private final ComunidadConfig cfg;

    public MetricasServicio(MedicionRepositorio repo, AccesoNegocio acceso, ObjectMapper json, PlanServicio planes,
                            ComunidadConfig cfg) {
        this.repo = repo;
        this.acceso = acceso;
        this.json = json;
        this.planes = planes;
        this.cfg = cfg;
    }

    /**
     * El plan Gratis ve solo los totales de la última semana. Quien entra como personal interno sin ser del equipo
     * del negocio (rol null) ve todo, para poder dar soporte.
     */
    private boolean limitado(Contexto ctx) {
        return ctx.rol() != null && !planes.veEstadisticas(ctx.id());
    }

    static int exigirPeriodo(Integer dias) {
        int d = dias == null ? 30 : dias;
        if (!PERIODOS.contains(d)) {
            throw BusinessException.invalida("El periodo debe ser de 7, 30 o 90 días.", Map.of("dias", "Valores: 7, 30, 90."));
        }
        return d;
    }

    static Double tasa(int vistas, int contactos) {
        return vistas == 0 ? null : Math.round(contactos * 1000.0 / vistas) / 10.0;
    }

    public MetricasNegocioDto negocio(Actor actor, UUID negocioId, Integer diasPedidos) {
        int dias = exigirPeriodo(diasPedidos);
        Contexto ctx = acceso.equipo(actor, negocioId);
        boolean limitado = limitado(ctx);
        if (limitado) {
            int permitido = cfg.entero("estadisticas_gratis_dias", 7);
            if (diasPedidos != null && dias != permitido) {
                throw BusinessException.prohibido("Tu plan Gratis muestra los últimos " + permitido
                        + " días. Sube a Pro para ver 30 y 90 días, el detalle por día y de dónde llegan tus visitas.");
            }
            dias = permitido;
        }
        ZoneId zona = ZoneId.of(repo.zonaHoraria(negocioId).orElse("America/Mexico_City"));
        LocalDate hasta = LocalDate.now(zona);
        LocalDate desde = hasta.minusDays(dias - 1L);
        LocalDate prevDesde = desde.minusDays(dias);

        Map<String, Integer> actual = new HashMap<>();
        Map<String, Integer> anterior = new HashMap<>();
        for (TipoPeriodoFila f : repo.totalesPorTipo(negocioId, prevDesde, desde, hasta)) {
            (f.esActual() ? actual : anterior).merge(f.tipo(), f.total(), Integer::sum);
        }
        if (limitado) {
            return new MetricasNegocioDto(dias, desde, hasta, totales(actual), null, List.of(), List.of(), List.of(), true);
        }
        Map<LocalDate, PuntoDiaDto> porDia = new HashMap<>();
        repo.serie(negocioId, desde, hasta).forEach(p -> porDia.put(p.dia(), p));
        List<PuntoDiaDto> serie = new ArrayList<>();
        for (LocalDate d = desde; !d.isAfter(hasta); d = d.plusDays(1)) {
            serie.add(porDia.getOrDefault(d, new PuntoDiaDto(d, 0, 0)));
        }
        List<ConteoTipoDto> porTipo = actual.entrySet().stream()
                .map(e -> new ConteoTipoDto(e.getKey(), e.getValue()))
                .sorted((a, b) -> b.total() != a.total() ? Integer.compare(b.total(), a.total()) : a.tipo().compareTo(b.tipo()))
                .toList();
        return new MetricasNegocioDto(dias, desde, hasta, totales(actual), totales(anterior), serie, porTipo,
                repo.porOrigen(negocioId, desde, hasta), false);
    }

    private static TotalesDto totales(Map<String, Integer> porTipo) {
        int vistas = porTipo.getOrDefault("vista_ficha", 0);
        int contactos = porTipo.entrySet().stream().filter(e -> CONTACTOS.contains(e.getKey()))
                .mapToInt(Map.Entry::getValue).sum();
        return new TotalesDto(vistas, contactos, tasa(vistas, contactos));
    }

    // ---------------- reportes mensuales ----------------

    private void exigirReportes(Contexto ctx) {
        if (limitado(ctx)) {
            throw BusinessException.prohibido("Los reportes mensuales son parte de los planes Pro y Destacado.");
        }
    }

    public List<ReporteMensualDto> reportes(Actor actor, UUID negocioId) {
        exigirReportes(acceso.equipo(actor, negocioId));
        return repo.reportes(negocioId).stream().map(this::aDto).toList();
    }

    public ReporteMensualDto reporte(Actor actor, UUID negocioId, int anio, int mes) {
        exigirReportes(acceso.equipo(actor, negocioId));
        return repo.reporte(negocioId, anio, mes).map(this::aDto)
                .orElseThrow(() -> BusinessException.noEncontrado("Todavía no hay reporte de ese mes."));
    }

    private ReporteMensualDto aDto(MedicionRepositorio.ReporteFila r) {
        try {
            Map<String, Object> datos = json.readValue(r.datos(), new TypeReference<Map<String, Object>>() {
            });
            return new ReporteMensualDto(r.id(), r.anio(), r.mes(), r.generadoEn(), r.enviadoEn(), datos);
        } catch (Exception e) {
            throw new IllegalStateException("El reporte " + r.id() + " no tiene un JSON válido", e);
        }
    }
}
