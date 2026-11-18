package mx.com.traveloaxaca.comercial.servicio;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.DestacadoDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.EspacioDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.EspacioEntradaDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PatrocinioDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PatrocinioEntradaDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PlanDto;
import mx.com.traveloaxaca.comercial.repo.PatrocinioRepositorio;
import mx.com.traveloaxaca.comercial.repo.PlanRepositorio;
import mx.com.traveloaxaca.comercial.repo.SuscripcionRepositorio;
import mx.com.traveloaxaca.comercial.repo.SuscripcionRepositorio.CuponAplicado;
import mx.com.traveloaxaca.comun.error.BusinessException;
import mx.com.traveloaxaca.explorar.dto.ExplorarDtos.NegocioTarjetaDto;
import mx.com.traveloaxaca.explorar.servicio.ExplorarServicio;
import mx.com.traveloaxaca.negocios.repo.NegocioRepositorio;
import mx.com.traveloaxaca.negocios.repo.NegocioRepositorio.NegocioFila;
import mx.com.traveloaxaca.negocios.servicio.Actor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Patrocinios: el equipo los programa en espacios con cupo. Lo patrocinado siempre se muestra con la etiqueta
 * "Patrocinado", se rota cada hora para que sea justo y no cambia la calificación del negocio.
 */
@Service
public class PatrocinioServicio {

    static final Map<String, String> CLAVE_POR_ESPACIO = Map.of(
            "explorar", "destacado_explorar",
            "categoria", "destacado_categoria",
            "mapa", "banner_mapa",
            "busqueda", "resultado_busqueda");

    private static final int LIMITE_DEFECTO = 5;
    private static final int LIMITE_MAXIMO = 12;
    private static final int MAX_DIAS_CALENDARIO = 366;

    private final PatrocinioRepositorio repo;
    private final PlanRepositorio planes;
    private final SuscripcionRepositorio suscripciones;
    private final PlanServicio planServicio;
    private final NegocioRepositorio negocios;
    private final ExplorarServicio explorar;

    public PatrocinioServicio(PatrocinioRepositorio repo, PlanRepositorio planes, SuscripcionRepositorio suscripciones,
                              PlanServicio planServicio, NegocioRepositorio negocios, ExplorarServicio explorar) {
        this.repo = repo;
        this.planes = planes;
        this.suscripciones = suscripciones;
        this.planServicio = planServicio;
        this.negocios = negocios;
        this.explorar = explorar;
    }

    // ---------------- espacios ----------------

    @Transactional(readOnly = true)
    public List<EspacioDto> espacios() {
        return repo.espacios();
    }

    @Transactional
    public EspacioDto crearEspacio(EspacioEntradaDto dto) {
        if (dto.destinoId() == null || dto.clave() == null) {
            throw BusinessException.invalida("Indica el destino y el tipo de espacio.",
                    Map.of("clave", "Obligatorio al crear un espacio."));
        }
        if (!repo.destinoExiste(dto.destinoId())) {
            throw BusinessException.noEncontrado("No encontramos ese destino.");
        }
        if ("destacado_categoria".equals(dto.clave()) && dto.categoriaId() == null) {
            throw BusinessException.invalida("Un espacio de categoría necesita la categoría.",
                    Map.of("categoriaId", "Obligatorio para destacado_categoria."));
        }
        UUID id = repo.crearEspacio(dto.destinoId(), dto.clave(), dto.categoriaId(), dto.regionId(),
                dto.maxSimultaneos(), !Boolean.FALSE.equals(dto.activo()));
        return repo.espacio(id).orElseThrow();
    }

    @Transactional
    public EspacioDto actualizarEspacio(UUID id, EspacioEntradaDto dto) {
        EspacioDto e = repo.espacio(id).orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese espacio."));
        int ocupado = repo.picoDeOcupacion(id, PlanServicio.hoy(), PlanServicio.hoy().plusYears(2));
        if (dto.maxSimultaneos() < ocupado) {
            throw BusinessException.conflicto("Ya hay " + ocupado + " patrocinios programados al mismo tiempo en este espacio; "
                    + "el cupo no puede ser menor.");
        }
        repo.actualizarEspacio(id, dto.maxSimultaneos(), dto.activo() == null ? e.activo() : dto.activo());
        return repo.espacio(id).orElseThrow();
    }

    // ---------------- patrocinios ----------------

    @Transactional(readOnly = true)
    public List<PatrocinioDto> calendario(LocalDate desde, LocalDate hasta, UUID espacioId, UUID negocioId, boolean soloVigentes) {
        LocalDate d = desde != null ? desde : PlanServicio.hoy();
        LocalDate h = hasta != null ? hasta : d.plusDays(60);
        if (h.isBefore(d)) {
            throw BusinessException.invalida("La fecha final no puede ser anterior a la inicial.");
        }
        if (java.time.temporal.ChronoUnit.DAYS.between(d, h) > MAX_DIAS_CALENDARIO) {
            throw BusinessException.invalida("Pide un rango de máximo un año.");
        }
        return repo.calendario(d, h, espacioId, negocioId, soloVigentes);
    }

    @Transactional
    public PatrocinioDto crear(Actor actor, PatrocinioEntradaDto dto) {
        SuscripcionServicio.ventas(actor);
        LocalDate hoy = PlanServicio.hoy();
        if (dto.fin().isBefore(dto.inicio())) {
            throw BusinessException.invalida("La fecha final no puede ser anterior a la inicial.",
                    Map.of("fin", "Debe ser igual o posterior al inicio."));
        }
        if (dto.fin().isBefore(hoy)) {
            throw BusinessException.invalida("Ese periodo ya terminó.", Map.of("fin", "Elige fechas de hoy en adelante."));
        }
        EspacioDto espacio = repo.espacio(dto.espacioId()).orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese espacio."));
        NegocioFila negocio = negocios.porIdParaActualizar(dto.negocioId())
                .orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese negocio."));
        if (!espacio.activo()) {
            throw BusinessException.conflicto("Ese espacio de patrocinio no está activo.");
        }
        if (!"publicada".equals(negocio.estado())) {
            throw BusinessException.conflicto("Solo un negocio publicado puede patrocinarse.");
        }
        PlanDto plan = planServicio.planDe(negocio.id());
        if (!plan.permitePatrocinio()) {
            throw BusinessException.conflicto("El plan " + plan.nombre() + " del negocio no incluye patrocinio. Necesita el plan Destacado.");
        }
        int pico = repo.picoDeOcupacion(espacio.id(), dto.inicio(), dto.fin());
        if (pico >= espacio.maxSimultaneos()) {
            throw BusinessException.conflicto("No hay cupo en ese espacio entre el " + dto.inicio() + " y el " + dto.fin()
                    + " (máximo " + espacio.maxSimultaneos() + " a la vez).");
        }

        BigDecimal precio = dto.precio();
        UUID cuponId = null;
        if (dto.cupon() != null && !dto.cupon().isBlank()) {
            cuponId = planes.canjear(dto.cupon().trim(), "patrocinio", hoy);
            CuponAplicado c = suscripciones.cupon(cuponId).orElseThrow();
            precio = switch (c.tipo()) {
                case "pct" -> precio.multiply(BigDecimal.valueOf(100).subtract(c.valor()))
                        .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
                case "monto" -> precio.subtract(c.valor()).max(BigDecimal.ZERO);
                default -> BigDecimal.ZERO;
            };
        }
        precio = precio.setScale(2, RoundingMode.HALF_UP);

        String estado = dto.inicio().isAfter(hoy) ? "programado" : "activo";
        UUID id = repo.crear(espacio.id(), negocio.id(), dto.inicio(), dto.fin(), precio, estado, actor.usuarioId());
        if (dto.pago() != null) {
            String ref = dto.pago().referencia() == null || dto.pago().referencia().isBlank() ? null : dto.pago().referencia().trim();
            UUID pagoId = suscripciones.crearPago(negocio.id(), "patrocinio", null, id, cuponId, precio,
                    dto.pago().metodo(), ref, !Boolean.FALSE.equals(dto.pago().pagado()), actor.usuarioId());
            suscripciones.ligarPagoAPatrocinio(id, pagoId);
        }
        return repo.patrocinio(id).orElseThrow();
    }

    @Transactional
    public PatrocinioDto cancelar(Actor actor, UUID id) {
        SuscripcionServicio.ventas(actor);
        PatrocinioDto p = repo.patrocinioBloqueado(id).orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese patrocinio."));
        if (!"programado".equals(p.estado()) && !"activo".equals(p.estado())) {
            throw BusinessException.conflicto("Ese patrocinio ya terminó o está cancelado.");
        }
        repo.cambiarEstado(id, "cancelado");
        return repo.patrocinio(id).orElseThrow();
    }

    // ---------------- público ----------------

    /** Los negocios patrocinados hoy en un espacio de la app, listos para mostrar con la etiqueta "Patrocinado". */
    @Transactional(readOnly = true)
    public List<DestacadoDto> destacados(String espacio, String destino, UUID categoriaId, UUID regionId,
                                         Integer limite, String idioma) {
        String clave = espacio == null ? null : CLAVE_POR_ESPACIO.get(espacio.trim().toLowerCase());
        if (clave == null) {
            throw BusinessException.invalida("El espacio debe ser explorar, categoria, mapa o busqueda.",
                    Map.of("espacio", "Valores: explorar, categoria, mapa, busqueda."));
        }
        int lim = limite == null ? LIMITE_DEFECTO : Math.max(1, Math.min(limite, LIMITE_MAXIMO));
        String codigo = destino == null || destino.isBlank() ? ExplorarServicio.DESTINO_BASE : destino.trim().toLowerCase();
        LocalDateTime ahora = LocalDateTime.now(PlanServicio.ZONA);
        // Cambia cada hora: así el orden es parejo a lo largo del día y estable dentro de la hora.
        String semilla = ahora.toLocalDate() + "-" + ahora.getHour();
        List<UUID> ids = repo.destacados(clave, codigo, categoriaId, regionId, lim, semilla, ahora.toLocalDate());
        if (ids.isEmpty()) {
            return List.of();
        }
        Map<UUID, NegocioTarjetaDto> porId = new HashMap<>();
        explorar.tarjetasNegocios(ids, idioma).forEach(t -> porId.put(t.id(), t));
        List<DestacadoDto> salida = new ArrayList<>();
        for (UUID id : ids) {
            NegocioTarjetaDto t = porId.get(id);
            if (t != null) {
                salida.add(new DestacadoDto(t, true, espacio.trim().toLowerCase()));
            }
        }
        return salida;
    }
}
