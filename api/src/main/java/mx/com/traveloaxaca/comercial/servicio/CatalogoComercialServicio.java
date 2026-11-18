package mx.com.traveloaxaca.comercial.servicio;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.CuponDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.CuponEntradaDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PlanDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PlanEdicionDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PlanPublicoDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PrecioDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PrecioEntradaDto;
import mx.com.traveloaxaca.comercial.repo.PlanRepositorio;
import mx.com.traveloaxaca.comun.error.BusinessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Lo que administra el equipo: los planes, sus precios (datos capturados, nunca fijos en el código) y los cupones.
 * También lo que ve el público: la lista de planes con sus precios vigentes.
 */
@Service
public class CatalogoComercialServicio {

    private final PlanRepositorio repo;

    public CatalogoComercialServicio(PlanRepositorio repo) {
        this.repo = repo;
    }

    // ---------------- público ----------------

    @Transactional(readOnly = true)
    public List<PlanPublicoDto> planesPublicos() {
        List<PrecioDto> precios = repo.precios(null, true, PlanServicio.hoy());
        return repo.planes(true).stream().map(p -> new PlanPublicoDto(p.clave(), p.nombre(), p.limiteFotos(),
                p.limiteOfertas(), p.veEstadisticas(), p.permitePromociones(), p.permitePatrocinio(),
                precios.stream().filter(x -> x.planId().equals(p.id())).toList())).toList();
    }

    // ---------------- planes ----------------

    @Transactional(readOnly = true)
    public List<PlanDto> planes() {
        return repo.planes(false);
    }

    @Transactional
    public PlanDto actualizarPlan(UUID id, PlanEdicionDto dto) {
        PlanDto actual = repo.plan(id).orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese plan."));
        if ("gratis".equals(actual.clave()) && !dto.activo()) {
            throw BusinessException.conflicto("El plan Gratis no se puede desactivar: es el que rige cuando no hay suscripción.");
        }
        repo.actualizarPlan(id, dto.nombre().trim(), dto.limiteFotos(), dto.limiteOfertas(), dto.veEstadisticas(),
                dto.permitePromociones(), dto.permitePatrocinio(), dto.activo(), dto.orden());
        return repo.plan(id).orElseThrow();
    }

    // ---------------- precios ----------------

    @Transactional(readOnly = true)
    public List<PrecioDto> precios(UUID planId, boolean soloVigentes) {
        return repo.precios(planId, soloVigentes, PlanServicio.hoy());
    }

    @Transactional
    public PrecioDto crearPrecio(PrecioEntradaDto dto) {
        PlanDto plan = repo.plan(dto.planId()).orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese plan."));
        if ("gratis".equals(plan.clave())) {
            throw BusinessException.invalida("El plan Gratis no lleva precio.");
        }
        LocalDate desde = dto.vigenteDesde() != null ? dto.vigenteDesde() : PlanServicio.hoy();
        if (dto.vigenteHasta() != null && dto.vigenteHasta().isBefore(desde)) {
            throw BusinessException.invalida("La fecha final no puede ser anterior a la inicial.",
                    Map.of("vigenteHasta", "Debe ser igual o posterior al inicio."));
        }
        UUID id = repo.crearPrecio(plan.id(), dto.destinoId(), dto.categoriaId(), dto.periodo(), dto.monto(),
                dto.moneda(), desde, dto.vigenteHasta());
        return repo.precio(id).orElseThrow();
    }

    /** Deja de regir un precio sin borrar el historial. Para cambiar un precio: se cierra el anterior y se captura uno nuevo. */
    @Transactional
    public PrecioDto cerrarPrecio(UUID id, LocalDate hasta) {
        PrecioDto p = repo.precio(id).orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese precio."));
        LocalDate fin = hasta != null ? hasta : PlanServicio.hoy();
        if (fin.isBefore(p.vigenteDesde())) {
            fin = p.vigenteDesde();
        }
        repo.cerrarPrecio(id, fin);
        return repo.precio(id).orElseThrow();
    }

    // ---------------- cupones ----------------

    @Transactional(readOnly = true)
    public List<CuponDto> cupones() {
        return repo.cupones();
    }

    @Transactional
    public CuponDto crearCupon(CuponEntradaDto dto) {
        validarCupon(dto.tipo(), dto.valor());
        if (dto.vigenteDesde() != null && dto.vigenteHasta() != null && dto.vigenteHasta().isBefore(dto.vigenteDesde())) {
            throw BusinessException.invalida("La fecha final no puede ser anterior a la inicial.",
                    Map.of("vigenteHasta", "Debe ser igual o posterior al inicio."));
        }
        String codigo = dto.codigo().trim();
        if (repo.codigoDeCuponExiste(codigo)) {
            throw BusinessException.conflicto("Ya existe un cupón con ese código.");
        }
        String desc = dto.descripcion() == null || dto.descripcion().isBlank() ? null : dto.descripcion().trim();
        UUID id = repo.crearCupon(codigo, desc, dto.tipo(), dto.valor(), dto.aplicaA(), dto.maxUsos(),
                dto.vigenteDesde(), dto.vigenteHasta());
        return repo.cupon(id).orElseThrow();
    }

    /** Del cupón solo se cambian la descripción, el máximo de usos y el último día; el resto se queda como se canjeó. */
    @Transactional
    public CuponDto actualizarCupon(UUID id, String descripcion, Integer maxUsos, LocalDate hasta) {
        CuponDto c = repo.cupon(id).orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese cupón."));
        if (maxUsos != null && maxUsos < c.usos()) {
            throw BusinessException.invalida("Ya se usó " + c.usos() + " veces; el máximo no puede ser menor.");
        }
        if (hasta != null && hasta.isBefore(c.vigenteDesde())) {
            throw BusinessException.invalida("La fecha final no puede ser anterior a la inicial.");
        }
        repo.actualizarCupon(id, descripcion == null || descripcion.isBlank() ? null : descripcion.trim(), maxUsos, hasta);
        return repo.cupon(id).orElseThrow();
    }

    private static void validarCupon(String tipo, BigDecimal valor) {
        switch (tipo) {
            case "pct" -> {
                if (valor.compareTo(BigDecimal.valueOf(100)) > 0) {
                    throw BusinessException.invalida("Un descuento en porcentaje no puede pasar de 100.",
                            Map.of("valor", "Máximo 100."));
                }
            }
            case "periodo_gratis" -> {
                if (valor.stripTrailingZeros().scale() > 0) {
                    throw BusinessException.invalida("Los periodos gratis son un número entero.",
                            Map.of("valor", "Usa un entero, por ejemplo 1 o 2."));
                }
            }
            default -> {
            }
        }
    }
}
