package mx.com.traveloaxaca.comercial.servicio;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import mx.com.traveloaxaca.acceso.correo.NotificacionServicio;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PromocionColaDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PromocionDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PromocionEntradaDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PromocionTextoDto;
import mx.com.traveloaxaca.comercial.repo.PromocionRepositorio;
import mx.com.traveloaxaca.comercial.repo.PromocionRepositorio.ColaFila;
import mx.com.traveloaxaca.comercial.repo.PromocionRepositorio.PromocionFila;
import mx.com.traveloaxaca.comun.api.Pagina;
import mx.com.traveloaxaca.comun.error.BusinessException;
import mx.com.traveloaxaca.negocios.servicio.AccesoNegocio;
import mx.com.traveloaxaca.negocios.servicio.AccesoNegocio.Contexto;
import mx.com.traveloaxaca.negocios.servicio.Actor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Promociones de los negocios. Nacen como borrador, el dueño las manda a revisión y solo se muestran cuando un
 * administrador o editor las aprueba. Si se rechazan, regresan a borrador con el motivo.
 */
@Service
public class PromocionServicio {

    private static final int MAX_DIAS = 366;
    private static final int MAX_TAMANO = 100;

    private final PromocionRepositorio repo;
    private final PlanServicio planes;
    private final AccesoNegocio acceso;
    private final NotificacionServicio correos;

    public PromocionServicio(PromocionRepositorio repo, PlanServicio planes, AccesoNegocio acceso,
                             NotificacionServicio correos) {
        this.repo = repo;
        this.planes = planes;
        this.acceso = acceso;
        this.correos = correos;
    }

    // ---------------- del negocio ----------------

    @Transactional(readOnly = true)
    public List<PromocionDto> deNegocio(Actor actor, UUID negocioId) {
        acceso.equipo(actor, negocioId);
        return repo.deNegocio(negocioId).stream().map(this::aDto).toList();
    }

    @Transactional(readOnly = true)
    public PromocionDto una(Actor actor, UUID negocioId, UUID id) {
        acceso.equipo(actor, negocioId);
        return aDto(propia(negocioId, id));
    }

    @Transactional
    public PromocionDto crear(Actor actor, UUID negocioId, PromocionEntradaDto dto) {
        Contexto ctx = escribir(actor, negocioId);
        planes.exigirPromociones(ctx.id());
        validar(ctx.id(), dto, null);
        UUID id = repo.crear(ctx.id(), dto.ofertaId(), dto.tipo(), valor(dto), codigo(dto), dto.inicio(), dto.fin(),
                limpio(dto.condiciones()));
        repo.reemplazarTextos(id, dto.textos());
        return aDto(repo.porId(id).orElseThrow());
    }

    @Transactional
    public PromocionDto actualizar(Actor actor, UUID negocioId, UUID id, PromocionEntradaDto dto) {
        Contexto ctx = escribir(actor, negocioId);
        PromocionFila p = repo.bloquear(id).filter(x -> x.negocioId().equals(negocioId))
                .orElseThrow(() -> BusinessException.noEncontrado("No encontramos esa promoción."));
        if (!"borrador".equals(p.estado())) {
            throw BusinessException.conflicto("Solo se puede editar una promoción en borrador. "
                    + "Elimínala y crea otra si ya está en revisión o activa.");
        }
        planes.exigirPromociones(ctx.id());
        validar(ctx.id(), dto, id);
        repo.actualizar(id, dto.ofertaId(), dto.tipo(), valor(dto), codigo(dto), dto.inicio(), dto.fin(), limpio(dto.condiciones()));
        repo.reemplazarTextos(id, dto.textos());
        return aDto(repo.porId(id).orElseThrow());
    }

    @Transactional
    public PromocionDto enviarARevision(Actor actor, UUID negocioId, UUID id) {
        Contexto ctx = escribir(actor, negocioId);
        PromocionFila p = repo.bloquear(id).filter(x -> x.negocioId().equals(negocioId))
                .orElseThrow(() -> BusinessException.noEncontrado("No encontramos esa promoción."));
        if (!"borrador".equals(p.estado())) {
            throw BusinessException.conflicto("Esa promoción ya fue enviada.");
        }
        if (!"publicada".equals(ctx.negocio().estado())) {
            throw BusinessException.conflicto("Tu ficha tiene que estar publicada para mostrar promociones.");
        }
        planes.exigirPromociones(ctx.id());
        if (p.fin().isBefore(PlanServicio.hoy())) {
            throw BusinessException.invalida("Esa promoción ya terminó. Cambia las fechas antes de enviarla.");
        }
        if (repo.textos(id).stream().noneMatch(t -> "es".equals(t.idioma()))) {
            throw BusinessException.invalida("Escribe el título en español antes de enviarla.");
        }
        repo.cambiarEstado(id, "en_revision");
        return aDto(repo.porId(id).orElseThrow());
    }

    @Transactional
    public void eliminar(Actor actor, UUID negocioId, UUID id) {
        escribir(actor, negocioId);
        repo.bloquear(id).filter(x -> x.negocioId().equals(negocioId))
                .orElseThrow(() -> BusinessException.noEncontrado("No encontramos esa promoción."));
        repo.eliminar(id);
    }

    // ---------------- revisión (admin y editor) ----------------

    @Transactional(readOnly = true)
    public Pagina<PromocionColaDto> cola(Actor actor, UUID negocioId, int pagina, int tamano) {
        revisor(actor);
        int t = Math.max(1, Math.min(tamano, MAX_TAMANO));
        int pag = Math.max(0, pagina);
        long total = repo.contarEnCola(negocioId);
        List<PromocionColaDto> filas = repo.cola(negocioId, t, pag * t).stream().map(this::aCola).toList();
        return new Pagina<>(filas, total, pag, t);
    }

    @Transactional
    public PromocionDto aprobar(Actor actor, UUID id) {
        revisor(actor);
        PromocionFila p = enRevision(id);
        if (p.fin().isBefore(PlanServicio.hoy())) {
            throw BusinessException.conflicto("Esa promoción ya terminó; pídele al negocio que cambie las fechas.");
        }
        repo.aprobar(id, actor.usuarioId());
        String titulo = tituloEs(id);
        avisar(p.negocioId(), "promocion_aprobada", titulo, null);
        return aDto(repo.porId(id).orElseThrow());
    }

    @Transactional
    public PromocionDto rechazar(Actor actor, UUID id, String motivo) {
        revisor(actor);
        PromocionFila p = enRevision(id);
        String limpio = motivo.trim();
        repo.rechazar(id, actor.usuarioId(), limpio);
        avisar(p.negocioId(), "promocion_rechazada", tituloEs(id), limpio);
        return aDto(repo.porId(id).orElseThrow());
    }

    // ---------------- apoyo ----------------

    private PromocionFila enRevision(UUID id) {
        PromocionFila p = repo.bloquear(id).orElseThrow(() -> BusinessException.noEncontrado("No encontramos esa promoción."));
        if (!"en_revision".equals(p.estado())) {
            throw BusinessException.conflicto("Esa promoción ya fue revisada.");
        }
        return p;
    }

    private PromocionFila propia(UUID negocioId, UUID id) {
        return repo.porId(id).filter(x -> x.negocioId().equals(negocioId))
                .orElseThrow(() -> BusinessException.noEncontrado("No encontramos esa promoción."));
    }

    /** Escribir: miembros del negocio y personal de edición. Ventas solo lee. */
    private Contexto escribir(Actor actor, UUID negocioId) {
        Contexto ctx = acceso.equipo(actor, negocioId);
        if (ctx.rol() == null && !actor.puedeEditarTodo()) {
            throw BusinessException.prohibido("No tienes permiso para editar las promociones de este negocio.");
        }
        return ctx;
    }

    private static void revisor(Actor actor) {
        if (!actor.puedeEditarTodo()) {
            throw BusinessException.prohibido("Solo administración y edición revisan promociones.");
        }
    }

    private void validar(UUID negocioId, PromocionEntradaDto dto, UUID propiaId) {
        LocalDate hoy = PlanServicio.hoy();
        if (dto.fin().isBefore(dto.inicio())) {
            throw BusinessException.invalida("La fecha final no puede ser anterior a la inicial.",
                    Map.of("fin", "Debe ser igual o posterior al inicio."));
        }
        if (dto.fin().isBefore(hoy)) {
            throw BusinessException.invalida("Esa promoción ya terminó.", Map.of("fin", "Elige fechas de hoy en adelante."));
        }
        if (ChronoUnit.DAYS.between(dto.inicio(), dto.fin()) > MAX_DIAS) {
            throw BusinessException.invalida("Una promoción dura máximo un año.", Map.of("fin", "Acorta el periodo."));
        }
        switch (dto.tipo()) {
            case "descuento_pct" -> {
                if (dto.valor() == null || dto.valor().compareTo(BigDecimal.ONE) < 0 || dto.valor().compareTo(BigDecimal.valueOf(100)) > 0) {
                    throw BusinessException.invalida("El descuento en porcentaje va de 1 a 100.", Map.of("valor", "Entre 1 y 100."));
                }
            }
            case "descuento_monto" -> {
                if (dto.valor() == null || dto.valor().signum() <= 0) {
                    throw BusinessException.invalida("Indica de cuánto es el descuento.", Map.of("valor", "Debe ser mayor que cero."));
                }
            }
            default -> {
                if (dto.valor() != null) {
                    throw BusinessException.invalida("Este tipo de promoción no lleva valor.", Map.of("valor", "Déjalo vacío."));
                }
            }
        }
        if (dto.ofertaId() != null && !repo.ofertaEsDelNegocio(dto.ofertaId(), negocioId)) {
            throw BusinessException.noEncontrado("No encontramos esa opción en tu ficha.");
        }
        String codigo = codigo(dto);
        if (codigo != null && repo.codigoEnUso(negocioId, codigo, propiaId)) {
            throw BusinessException.conflicto("Ya usaste ese código en otra promoción.");
        }
        Set<String> vistos = new HashSet<>();
        boolean conEs = false;
        for (PromocionTextoDto t : dto.textos()) {
            if (!vistos.add(t.idioma())) {
                throw BusinessException.invalida("El idioma " + t.idioma() + " está repetido.");
            }
            if (!repo.idiomaExiste(t.idioma())) {
                throw BusinessException.invalida("No manejamos el idioma " + t.idioma() + ".");
            }
            conEs |= "es".equals(t.idioma());
        }
        if (!conEs) {
            throw BusinessException.invalida("Escribe el título en español.", Map.of("textos", "Falta el texto en español."));
        }
    }

    private static BigDecimal valor(PromocionEntradaDto dto) {
        return dto.valor();
    }

    private static String codigo(PromocionEntradaDto dto) {
        return dto.codigo() == null || dto.codigo().isBlank() ? null : dto.codigo().trim();
    }

    private static String limpio(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private String tituloEs(UUID id) {
        return repo.textos(id).stream().filter(t -> "es".equals(t.idioma())).map(PromocionTextoDto::titulo)
                .findFirst().orElse("tu promoción");
    }

    private void avisar(UUID negocioId, String plantilla, String promocion, String motivo) {
        repo.propietario(negocioId).ifPresent(d -> {
            Map<String, String> datos = new LinkedHashMap<>();
            datos.put("nombre", d.nombre());
            datos.put("negocio", repo.nombreNegocio(negocioId).orElse(""));
            datos.put("promocion", promocion);
            if (motivo != null) {
                datos.put("motivo", motivo);
            }
            correos.encolarCorreo(d.usuarioId(), plantilla, datos);
        });
    }

    private PromocionDto aDto(PromocionFila p) {
        return new PromocionDto(p.id(), p.negocioId(), p.ofertaId(), p.tipo(), p.valor(), p.codigo(), p.inicio(), p.fin(),
                p.condiciones(), p.estado(), p.motivoRechazo(), repo.textos(p.id()));
    }

    private PromocionColaDto aCola(ColaFila c) {
        PromocionDto dto = new PromocionDto(c.id(), c.negocioId(), c.ofertaId(), c.tipo(), c.valor(), c.codigo(), c.inicio(),
                c.fin(), c.condiciones(), c.estado(), c.motivoRechazo(), repo.textos(c.id()));
        return new PromocionColaDto(dto, c.negocioNombre(), c.enviadaEn());
    }
}
