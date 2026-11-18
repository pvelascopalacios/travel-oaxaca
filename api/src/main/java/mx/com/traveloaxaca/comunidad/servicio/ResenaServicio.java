package mx.com.traveloaxaca.comunidad.servicio;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import mx.com.traveloaxaca.comun.api.Pagina;
import mx.com.traveloaxaca.comun.error.BusinessException;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.CalificacionDto;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.FotoResenaDto;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.MiResenaDto;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.ResenaDto;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.ResenaEntradaDto;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.ResenasPublicasDto;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.RespuestaResenaDto;
import mx.com.traveloaxaca.comunidad.repo.ReaccionRepositorio;
import mx.com.traveloaxaca.comunidad.repo.ResenaRepositorio;
import mx.com.traveloaxaca.comunidad.repo.ResenaRepositorio.FotoFila;
import mx.com.traveloaxaca.comunidad.repo.ResenaRepositorio.ResenaFila;
import mx.com.traveloaxaca.explorar.servicio.ExplorarServicio;
import mx.com.traveloaxaca.negocios.almacen.AlmacenMedios;
import mx.com.traveloaxaca.negocios.repo.MedioRepositorio;
import mx.com.traveloaxaca.negocios.servicio.AccesoNegocio;
import mx.com.traveloaxaca.negocios.servicio.Actor;
import mx.com.traveloaxaca.negocios.servicio.CatalogoServicio;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Reseñas de los turistas, sus fotos y la respuesta del negocio. */
@Service
public class ResenaServicio {

    private static final Set<String> ORDENES = Set.of("recientes", "mejor", "peor", "utiles");
    private static final int TEXTO_MINIMO = 20;

    private final ResenaRepositorio repo;
    private final CatalogoServicio catalogo;
    private final AlmacenMedios almacen;
    private final FiltroContenido filtro;
    private final ComunidadConfig cfg;
    private final AccesoNegocio acceso;
    private final MedioRepositorio medios;
    private final ReaccionRepositorio reacciones;

    public ResenaServicio(ResenaRepositorio repo, CatalogoServicio catalogo, AlmacenMedios almacen,
                          FiltroContenido filtro, ComunidadConfig cfg, AccesoNegocio acceso, MedioRepositorio medios,
                          ReaccionRepositorio reacciones) {
        this.repo = repo;
        this.catalogo = catalogo;
        this.almacen = almacen;
        this.filtro = filtro;
        this.cfg = cfg;
        this.acceso = acceso;
        this.medios = medios;
        this.reacciones = reacciones;
    }

    static int tamano(Integer t) {
        return t == null ? 20 : Math.max(1, Math.min(t, 50));
    }

    static int pagina(Integer p) {
        return p == null ? 0 : Math.max(0, p);
    }

    // ---------------- lectura pública ----------------

    @Transactional(readOnly = true)
    public ResenasPublicasDto publicas(String slug, String destino, String orden, Integer pagina, Integer tamano,
                                       UUID usuarioId) {
        String o = orden == null || orden.isBlank() ? "recientes" : orden;
        if (!ORDENES.contains(o)) {
            throw BusinessException.invalida("El orden debe ser recientes, mejor, peor o utiles.",
                    Map.of("orden", "Valores: recientes, mejor, peor, utiles."));
        }
        UUID negocioId = repo.negocioPublicadoPorSlug(slug, destinoOBase(destino))
                .orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese negocio."));
        int pag = pagina(pagina);
        int tam = tamano(tamano);
        List<ResenaFila> filas = repo.publicadas(negocioId, o, tam, pag * tam);
        List<ResenaDto> elementos = aDtos(filas, false, usuarioId);
        return new ResenasPublicasDto(new Pagina<>(elementos, repo.contarPublicadas(negocioId), pag, tam),
                calificacion(negocioId));
    }

    /** Promedio y distribución. El promedio solo se muestra desde el mínimo configurado de reseñas. */
    public CalificacionDto calificacion(UUID negocioId) {
        Map<Integer, Integer> dist = new LinkedHashMap<>();
        for (int i = 5; i >= 1; i--) {
            dist.put(i, 0);
        }
        int total = 0;
        long suma = 0;
        for (var d : repo.distribucion(negocioId)) {
            dist.put(d.calificacion(), d.total());
            total += d.total();
            suma += (long) d.calificacion() * d.total();
        }
        BigDecimal promedio = null;
        if (total >= cfg.entero("resenas_min_para_promedio", 3)) {
            promedio = BigDecimal.valueOf(suma).divide(BigDecimal.valueOf(total), 1, java.math.RoundingMode.HALF_UP);
        }
        return new CalificacionDto(promedio, total, dist);
    }

    // ---------------- la reseña propia ----------------

    @Transactional(readOnly = true)
    public ResenaDto mia(UUID usuarioId, UUID negocioId) {
        ResenaFila r = repo.deUsuario(negocioId, usuarioId)
                .orElseThrow(() -> BusinessException.noEncontrado("Todavía no reseñas este negocio."));
        return aDtos(List.of(r), true).get(0);
    }

    /** Todas mis reseñas, con el negocio de cada una. */
    @Transactional(readOnly = true)
    public List<MiResenaDto> mias(UUID usuarioId) {
        return repo.deUsuarioTodas(usuarioId).stream()
                .map(r -> new MiResenaDto(r.id(), r.negocioId(), r.negocioSlug(), r.negocioNombre(), r.calificacion(),
                        r.titulo(), r.texto(), r.fechaVisita(), r.estado(), r.utiles(), r.creadoEn()))
                .toList();
    }

    @Transactional
    public ResenaDto crear(UUID usuarioId, UUID negocioId, ResenaEntradaDto dto) {
        exigirCorreoVerificado(usuarioId);
        String nombre = repo.nombreNegocioPublicado(negocioId)
                .orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese negocio."));
        if (repo.esMiembroActivo(negocioId, usuarioId)) {
            throw BusinessException.prohibido("Quien administra un negocio no puede reseñarlo.");
        }
        if (repo.deUsuario(negocioId, usuarioId).isPresent()) {
            throw BusinessException.conflicto("Ya reseñaste este negocio. Puedes editar tu reseña.");
        }
        String texto = validarTexto(dto);
        validarFecha(dto.fechaVisita());
        String estado = filtro.motivoDeRevision(dto.titulo(), texto).isPresent() ? "pendiente" : "publicada";
        UUID id;
        try {
            id = repo.crear(negocioId, usuarioId, dto.calificacion(), limpiar(dto.titulo()), texto, dto.fechaVisita(),
                    catalogo.idioma(dto.idioma()), estado);
        } catch (DuplicateKeyException e) {
            throw BusinessException.conflicto("Ya reseñaste este negocio. Puedes editar tu reseña.");
        }
        if ("publicada".equals(estado)) {
            repo.avisarNuevaResena(negocioId, nombre);
        }
        return aDtos(List.of(repo.porId(id).orElseThrow()), true).get(0);
    }

    @Transactional
    public ResenaDto editar(UUID usuarioId, UUID resenaId, ResenaEntradaDto dto) {
        ResenaFila r = propia(usuarioId, resenaId);
        if ("rechazada".equals(r.estado()) || "oculta".equals(r.estado())) {
            throw BusinessException.conflicto("El equipo revisó tu reseña y ya no se puede editar.");
        }
        int dias = cfg.entero("resena_editable_dias", 30);
        if (r.creadoEn().isBefore(OffsetDateTime.now().minusDays(dias))) {
            throw BusinessException.conflicto("Tu reseña solo se puede editar durante " + dias + " días.");
        }
        String texto = validarTexto(dto);
        validarFecha(dto.fechaVisita());
        String estado = filtro.motivoDeRevision(dto.titulo(), texto).isPresent() ? "pendiente" : "publicada";
        repo.actualizar(resenaId, dto.calificacion(), limpiar(dto.titulo()), texto, dto.fechaVisita(), estado);
        return aDtos(List.of(repo.porId(resenaId).orElseThrow()), true).get(0);
    }

    @Transactional
    public void borrar(UUID usuarioId, UUID resenaId) {
        propia(usuarioId, resenaId);
        repo.eliminar(resenaId);
    }

    @Transactional
    public ResenaDto agregarFoto(UUID usuarioId, UUID resenaId, UUID medioId) {
        ResenaFila r = propia(usuarioId, resenaId);
        var m = repo.medioSubido(medioId)
                .filter(x -> usuarioId.equals(x.subidoPor()))
                .orElseThrow(() -> BusinessException.noEncontrado("No encontramos esa foto."));
        if (m.hash() == null) {
            throw BusinessException.invalida("Primero confirma la subida de la foto.");
        }
        if (!"imagen".equals(m.tipo()) || m.enUso() || !"pendiente".equals(m.moderacion())) {
            throw BusinessException.invalida("Esa foto no se puede usar en una reseña.");
        }
        int maximo = cfg.entero("fotos_max_resena", 3);
        int actuales = repo.contarFotos(resenaId);
        if (actuales >= maximo) {
            throw BusinessException.invalida("Una reseña admite máximo " + maximo + " fotos.");
        }
        repo.agregarFoto(resenaId, medioId, actuales);
        return aDtos(List.of(repo.porId(r.id()).orElseThrow()), true).get(0);
    }

    @Transactional
    public void quitarFoto(UUID usuarioId, UUID resenaId, UUID medioId) {
        propia(usuarioId, resenaId);
        if (!repo.quitarFoto(resenaId, medioId)) {
            throw BusinessException.noEncontrado("Esa foto no está en tu reseña.");
        }
        medios.marcarEliminado(medioId);
    }

    // ---------------- el equipo del negocio ----------------

    @Transactional(readOnly = true)
    public Pagina<ResenaDto> paraEquipo(Actor actor, UUID negocioId, boolean sinResponder, Integer pagina, Integer tamano) {
        acceso.equipo(actor, negocioId);
        int pag = pagina(pagina);
        int tam = tamano(tamano);
        List<ResenaFila> filas = repo.paraEquipo(negocioId, sinResponder, tam, pag * tam);
        return new Pagina<>(aDtos(filas, false), repo.contarParaEquipo(negocioId, sinResponder), pag, tam);
    }

    @Transactional
    public RespuestaResenaDto responder(Actor actor, UUID negocioId, UUID resenaId, String texto) {
        var ctx = acceso.equipo(actor, negocioId);
        if (ctx.rol() == null) {
            throw BusinessException.prohibido("Solo el equipo del negocio puede responder reseñas.");
        }
        ResenaFila r = repo.porId(resenaId).filter(x -> negocioId.equals(x.negocioId()))
                .orElseThrow(() -> BusinessException.noEncontrado("No encontramos esa reseña."));
        if (!"publicada".equals(r.estado())) {
            throw BusinessException.conflicto("Solo se responden reseñas publicadas.");
        }
        String limpio = texto == null ? "" : texto.trim();
        if (limpio.isEmpty()) {
            throw BusinessException.invalida("Escribe tu respuesta.", Map.of("texto", "Escribe tu respuesta."));
        }
        repo.guardarRespuesta(resenaId, actor.usuarioId(), limpio);
        ResenaFila actualizada = repo.porId(resenaId).orElseThrow();
        return new RespuestaResenaDto(actualizada.respuestaTexto(), actualizada.respuestaCreadoEn(),
                actualizada.respuestaActualizadoEn());
    }

    // ---------------- apoyo ----------------

    private ResenaFila propia(UUID usuarioId, UUID resenaId) {
        return repo.porId(resenaId).filter(r -> usuarioId.equals(r.usuarioId()))
                .orElseThrow(() -> BusinessException.noEncontrado("No encontramos esa reseña."));
    }

    private void exigirCorreoVerificado(UUID usuarioId) {
        if (!repo.correoVerificado(usuarioId)) {
            throw BusinessException.prohibido("Confirma tu correo para dejar reseñas.");
        }
    }

    private static String validarTexto(ResenaEntradaDto dto) {
        String t = dto.texto() == null ? "" : dto.texto().trim();
        if (t.length() < TEXTO_MINIMO) {
            String m = "Cuéntanos un poco más: mínimo " + TEXTO_MINIMO + " caracteres.";
            throw BusinessException.invalida(m, Map.of("texto", m));
        }
        return t;
    }

    private static void validarFecha(LocalDate fecha) {
        if (fecha != null && fecha.isAfter(LocalDate.now().plusDays(1))) {
            String m = "La fecha de visita no puede ser futura.";
            throw BusinessException.invalida(m, Map.of("fechaVisita", m));
        }
    }

    private static String limpiar(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }

    private static String destinoOBase(String destino) {
        return destino == null || destino.isBlank() ? ExplorarServicio.DESTINO_BASE : destino.trim().toLowerCase();
    }

    /** privado = true cuando la ve su autor: muestra el estado y las fotos aún no aprobadas. */
    private List<ResenaDto> aDtos(List<ResenaFila> filas, boolean privado) {
        return aDtos(filas, privado, null);
    }

    /** usuarioId es quien pide (puede ser null): sirve para marcar «mía» y «ya la marqué útil». */
    private List<ResenaDto> aDtos(List<ResenaFila> filas, boolean privado, UUID usuarioId) {
        Set<UUID> utiles = reacciones.reaccionados(usuarioId, "resena", filas.stream().map(ResenaFila::id).toList());
        Map<UUID, List<FotoFila>> fotos = repo.fotos(filas.stream().map(ResenaFila::id).toList(), !privado).stream()
                .collect(Collectors.groupingBy(FotoFila::resenaId));
        List<ResenaDto> r = new ArrayList<>();
        for (ResenaFila f : filas) {
            List<FotoResenaDto> fs = fotos.getOrDefault(f.id(), List.of()).stream()
                    .map(x -> new FotoResenaDto(x.medioId(), almacen.urlPublica(x.claveAlmacenamiento()),
                            privado ? x.moderacion() : null))
                    .toList();
            RespuestaResenaDto resp = f.respuestaTexto() == null ? null
                    : new RespuestaResenaDto(f.respuestaTexto(), f.respuestaCreadoEn(), f.respuestaActualizadoEn());
            r.add(new ResenaDto(f.id(), f.calificacion(), f.titulo(), f.texto(), f.fechaVisita(),
                    Nombres.corto(f.autorNombre()), f.creadoEn(), f.utiles(), privado ? f.estado() : null, fs, resp,
                    privado || (usuarioId != null && usuarioId.equals(f.usuarioId())), utiles.contains(f.id())));
        }
        return r;
    }
}
