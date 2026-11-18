package mx.com.traveloaxaca.comercial.servicio;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.ActivarSuscripcionDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PagoDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PagoEntradaDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PagoEstadoDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PatrocinioDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PlanDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PrecioDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.ResultadoActivacionDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.SuscripcionDto;
import mx.com.traveloaxaca.comercial.repo.PatrocinioRepositorio;
import mx.com.traveloaxaca.comercial.repo.PlanRepositorio;
import mx.com.traveloaxaca.comercial.repo.SuscripcionRepositorio;
import mx.com.traveloaxaca.comercial.repo.SuscripcionRepositorio.CuponAplicado;
import mx.com.traveloaxaca.comercial.repo.SuscripcionRepositorio.Vigente;
import mx.com.traveloaxaca.comun.error.BusinessException;
import mx.com.traveloaxaca.negocios.repo.NegocioRepositorio;
import mx.com.traveloaxaca.negocios.servicio.AccesoNegocio;
import mx.com.traveloaxaca.negocios.servicio.Actor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cobro manual: el equipo de ventas registra aquí lo que el negocio pagó (transferencia, efectivo o enlace de pago).
 * No se guardan datos de tarjeta y no hay pasarela. Todo el alta va en una transacción: suscripción, cupón y pago
 * se guardan juntos o no se guarda nada.
 */
@Service
public class SuscripcionServicio {

    private static final Set<String> FINALES_DESDE_PENDIENTE = Set.of("pagado", "fallido");

    private final PlanRepositorio planes;
    private final SuscripcionRepositorio repo;
    private final PatrocinioRepositorio patrocinios;
    private final NegocioRepositorio negocios;
    private final AccesoNegocio acceso;

    public SuscripcionServicio(PlanRepositorio planes, SuscripcionRepositorio repo, PatrocinioRepositorio patrocinios,
                               NegocioRepositorio negocios, AccesoNegocio acceso) {
        this.planes = planes;
        this.repo = repo;
        this.patrocinios = patrocinios;
        this.negocios = negocios;
        this.acceso = acceso;
    }

    static void ventas(Actor actor) {
        if (!actor.roles().contains("admin") && !actor.roles().contains("ventas")) {
            throw BusinessException.prohibido("Solo ventas y administración pueden registrar cobros.");
        }
    }

    // ---------------- lectura ----------------

    @Transactional(readOnly = true)
    public List<SuscripcionDto> historial(Actor actor, UUID negocioId) {
        acceso.leer(actor, negocioId);
        return repo.deNegocio(negocioId);
    }

    @Transactional(readOnly = true)
    public List<PagoDto> pagos(Actor actor, UUID negocioId) {
        acceso.equipo(actor, negocioId);
        return repo.pagosDeNegocio(negocioId);
    }

    @Transactional(readOnly = true)
    public List<PagoDto> pendientes(Actor actor) {
        ventas(actor);
        return repo.pagosPendientes();
    }

    // ---------------- alta, renovación y cambio ----------------

    @Transactional
    public ResultadoActivacionDto activar(Actor actor, UUID negocioId, ActivarSuscripcionDto dto) {
        ventas(actor);
        negocios.porIdParaActualizar(negocioId).orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese negocio."));
        PlanDto plan = planes.planPorClave(dto.planClave().trim().toLowerCase())
                .filter(PlanDto::activo).orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese plan."));
        if ("gratis".equals(plan.clave())) {
            throw BusinessException.invalida("El plan Gratis no se cobra. Para volver a Gratis, cancela la suscripción.");
        }
        LocalDate hoy = PlanServicio.hoy();
        PrecioDto precio = planes.precioPara(negocioId, plan.id(), dto.periodo(), hoy).orElse(null);
        if (precio == null && dto.monto() == null) {
            throw BusinessException.invalida("No hay un precio vigente para el plan " + plan.nombre() + " (" + dto.periodo()
                    + "). Captúralo en Precios o escribe el monto.");
        }
        BigDecimal base = dto.monto() != null ? dto.monto() : precio.monto();

        BigDecimal monto = base;
        int periodos = 1;
        UUID cuponId = null;
        if (dto.cupon() != null && !dto.cupon().isBlank()) {
            cuponId = planes.canjear(dto.cupon().trim(), "suscripcion", hoy);
            CuponAplicado c = repo.cupon(cuponId).orElseThrow();
            switch (c.tipo()) {
                case "pct" -> monto = base.multiply(BigDecimal.valueOf(100).subtract(c.valor()))
                        .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
                case "monto" -> monto = base.subtract(c.valor()).max(BigDecimal.ZERO);
                case "periodo_gratis" -> {
                    periodos = c.valor().intValue();
                    monto = BigDecimal.ZERO;
                }
                default -> throw new IllegalStateException("Tipo de cupón desconocido: " + c.tipo());
            }
        }
        monto = monto.setScale(2, RoundingMode.HALF_UP);

        boolean gratis = monto.signum() == 0;
        String metodo = dto.metodo();
        if (metodo == null) {
            if (!gratis) {
                throw BusinessException.invalida("Indica cómo pagó el negocio: transferencia, efectivo o enlace_pago.",
                        java.util.Map.of("metodo", "Obligatorio cuando hay un monto a cobrar."));
            }
            metodo = "efectivo";
        }
        boolean pagado = gratis || !Boolean.FALSE.equals(dto.pagado());

        UUID precioId = precio == null ? null : precio.id();
        Vigente vigente = repo.vigente(negocioId).orElse(null);
        UUID suscripcionId;
        if (vigente != null && vigente.planId().equals(plan.id())) {
            // Misma suscripción: se alarga desde donde termina (o desde hoy si ya venció y está en gracia).
            LocalDate desde = vigente.fin().isAfter(hoy) ? vigente.fin() : hoy;
            repo.extender(vigente.id(), sumar(desde, dto.periodo(), periodos), precioId);
            suscripcionId = vigente.id();
        } else {
            if (vigente != null) {
                repo.cancelar(vigente.id(), "cambio_de_plan");
            }
            suscripcionId = repo.crear(negocioId, plan.id(), precioId, hoy, sumar(hoy, dto.periodo(), periodos));
        }
        String referencia = dto.referencia() == null || dto.referencia().isBlank() ? null : dto.referencia().trim();
        UUID pagoId = repo.crearPago(negocioId, "suscripcion", suscripcionId, null, cuponId, monto, metodo, referencia,
                pagado, actor.usuarioId());
        return new ResultadoActivacionDto(repo.porId(suscripcionId).orElseThrow(), repo.pago(pagoId).orElseThrow());
    }

    static LocalDate sumar(LocalDate desde, String periodo, int cantidad) {
        return "anual".equals(periodo) ? desde.plusYears(cantidad) : desde.plusMonths(cantidad);
    }

    /** Cancelar vuelve al negocio al plan Gratis de inmediato. */
    @Transactional
    public SuscripcionDto cancelar(Actor actor, UUID suscripcionId, String motivo) {
        ventas(actor);
        SuscripcionDto s = repo.porId(suscripcionId).orElseThrow(() -> BusinessException.noEncontrado("No encontramos esa suscripción."));
        negocios.porIdParaActualizar(s.negocioId());
        SuscripcionDto fresca = repo.porId(suscripcionId).orElseThrow();
        if (!"activa".equals(fresca.estado()) && !"gracia".equals(fresca.estado())) {
            throw BusinessException.conflicto("Esa suscripción ya no está vigente.");
        }
        repo.cancelar(suscripcionId, motivo.trim());
        return repo.porId(suscripcionId).orElseThrow();
    }

    // ---------------- pagos sueltos y cambios de estado ----------------

    /** Registra un cobro que no es una suscripción: un patrocinio o un concepto distinto. */
    @Transactional
    public PagoDto registrarPago(Actor actor, PagoEntradaDto dto) {
        ventas(actor);
        negocios.porIdParaActualizar(dto.negocioId()).orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese negocio."));
        UUID patrocinioId = null;
        if ("patrocinio".equals(dto.concepto())) {
            if (dto.patrocinioId() == null) {
                throw BusinessException.invalida("Indica a qué patrocinio corresponde el pago.",
                        java.util.Map.of("patrocinioId", "Obligatorio para el concepto patrocinio."));
            }
            PatrocinioDto p = patrocinios.patrocinioBloqueado(dto.patrocinioId())
                    .filter(x -> x.negocioId().equals(dto.negocioId()))
                    .orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese patrocinio en ese negocio."));
            patrocinioId = p.id();
        } else if (dto.patrocinioId() != null) {
            throw BusinessException.invalida("El patrocinio solo se indica cuando el concepto es patrocinio.");
        }
        String referencia = dto.referencia() == null || dto.referencia().isBlank() ? null : dto.referencia().trim();
        UUID id = repo.crearPago(dto.negocioId(), dto.concepto(), null, patrocinioId, null, dto.monto().setScale(2, RoundingMode.HALF_UP),
                dto.metodo(), referencia, !Boolean.FALSE.equals(dto.pagado()), actor.usuarioId());
        if (patrocinioId != null) {
            PatrocinioDto p = patrocinios.patrocinio(patrocinioId).orElseThrow();
            if (p.pagoId() == null) {
                repo.ligarPagoAPatrocinio(patrocinioId, id);
            }
        }
        return repo.pago(id).orElseThrow();
    }

    /** pendiente → pagado o fallido; pagado → reembolsado; fallido → pagado (cuando el negocio al fin paga). */
    @Transactional
    public PagoDto cambiarEstado(Actor actor, UUID pagoId, PagoEstadoDto dto) {
        ventas(actor);
        PagoDto p = repo.pagoBloqueado(pagoId).orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese pago."));
        boolean permitido = switch (p.estado()) {
            case "pendiente" -> FINALES_DESDE_PENDIENTE.contains(dto.estado());
            case "pagado" -> "reembolsado".equals(dto.estado());
            case "fallido" -> "pagado".equals(dto.estado());
            default -> false;
        };
        if (!permitido) {
            throw BusinessException.conflicto("Un pago " + p.estado() + " no puede pasar a " + dto.estado() + ".");
        }
        String ref = dto.referencia() == null || dto.referencia().isBlank() ? null : dto.referencia().trim();
        repo.cambiarEstadoPago(pagoId, dto.estado(), ref);
        return repo.pago(pagoId).orElseThrow();
    }
}
