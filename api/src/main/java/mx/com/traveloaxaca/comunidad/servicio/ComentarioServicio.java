package mx.com.traveloaxaca.comunidad.servicio;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import mx.com.traveloaxaca.comun.api.Pagina;
import mx.com.traveloaxaca.comun.error.BusinessException;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.ComentarioDto;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.ComentarioEntradaDto;
import mx.com.traveloaxaca.comunidad.repo.ComentarioRepositorio;
import mx.com.traveloaxaca.comunidad.repo.ComentarioRepositorio.ComentarioFila;
import mx.com.traveloaxaca.comunidad.repo.ReaccionRepositorio;
import mx.com.traveloaxaca.comunidad.repo.ResenaRepositorio;
import mx.com.traveloaxaca.explorar.servicio.ExplorarServicio;
import mx.com.traveloaxaca.negocios.servicio.CatalogoServicio;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Comentarios sobre lugares, rutas, eventos y artículos, con un solo nivel de respuestas. */
@Service
public class ComentarioServicio {

    public static final Set<String> TIPOS = Set.of("lugar", "ruta", "evento", "articulo");

    private final ComentarioRepositorio repo;
    private final ResenaRepositorio resenas;
    private final CatalogoServicio catalogo;
    private final FiltroContenido filtro;
    private final ComunidadConfig cfg;
    private final ReaccionRepositorio reacciones;

    public ComentarioServicio(ComentarioRepositorio repo, ResenaRepositorio resenas, CatalogoServicio catalogo,
                              FiltroContenido filtro, ComunidadConfig cfg, ReaccionRepositorio reacciones) {
        this.repo = repo;
        this.resenas = resenas;
        this.catalogo = catalogo;
        this.filtro = filtro;
        this.cfg = cfg;
        this.reacciones = reacciones;
    }

    /** De la ruta ("lugares") al tipo interno ("lugar"). */
    public static String tipoDeRuta(String segmento) {
        String tipo = switch (segmento) {
            case "lugares" -> "lugar";
            case "rutas" -> "ruta";
            case "eventos" -> "evento";
            case "articulos" -> "articulo";
            default -> null;
        };
        if (tipo == null) {
            throw BusinessException.noEncontrado("No encontramos esa sección.");
        }
        return tipo;
    }

    @Transactional(readOnly = true)
    public Pagina<ComentarioDto> publicos(String tipo, String slug, String destino, Integer pagina, Integer tamano,
                                          UUID usuarioId) {
        UUID objetivo = repo.objetivoPublicoPorSlug(tipo, slug, destino == null || destino.isBlank()
                        ? ExplorarServicio.DESTINO_BASE : destino.trim().toLowerCase())
                .orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese contenido."));
        int pag = ResenaServicio.pagina(pagina);
        int tam = ResenaServicio.tamano(tamano);
        List<ComentarioFila> principales = repo.principales(tipo, objetivo, tam, pag * tam);
        Map<UUID, List<ComentarioFila>> respuestas = repo.respuestasDe(principales.stream().map(ComentarioFila::id).toList())
                .stream().collect(Collectors.groupingBy(ComentarioFila::padreId));
        List<UUID> todos = new ArrayList<>(principales.stream().map(ComentarioFila::id).toList());
        respuestas.values().forEach(l -> l.forEach(h -> todos.add(h.id())));
        Set<UUID> likes = reacciones.reaccionados(usuarioId, "comentario", todos);
        List<ComentarioDto> elementos = new ArrayList<>();
        for (ComentarioFila c : principales) {
            List<ComentarioDto> hijos = respuestas.getOrDefault(c.id(), List.of()).stream()
                    .map(h -> aDto(h, List.of(), usuarioId, likes)).toList();
            elementos.add(aDto(c, hijos, usuarioId, likes));
        }
        return new Pagina<>(elementos, repo.contarPrincipales(tipo, objetivo), pag, tam);
    }

    @Transactional
    public ComentarioDto crear(UUID usuarioId, String tipo, UUID objetivoId, ComentarioEntradaDto dto) {
        if (!resenas.correoVerificado(usuarioId)) {
            throw BusinessException.prohibido("Confirma tu correo para comentar.");
        }
        if (!repo.objetivoPublicado(tipo, objetivoId)) {
            throw BusinessException.noEncontrado("No encontramos ese contenido.");
        }
        if (repo.recientesDe(usuarioId) >= cfg.entero("comentarios_max_por_hora", 10)) {
            throw BusinessException.demasiadasSolicitudes("Estás comentando muy seguido. Intenta de nuevo en un rato.");
        }
        String texto = dto.texto() == null ? "" : dto.texto().trim();
        if (texto.isEmpty()) {
            throw BusinessException.invalida("Escribe tu comentario.", Map.of("texto", "Escribe tu comentario."));
        }
        if (dto.padreId() != null) {
            ComentarioFila padre = repo.porId(dto.padreId())
                    .filter(p -> "publicado".equals(p.estado()))
                    .orElseThrow(() -> BusinessException.invalida("El comentario al que respondes ya no está disponible.",
                            Map.of("padreId", "El comentario al que respondes ya no está disponible.")));
            if (padre.padreId() != null) {
                throw BusinessException.invalida("Solo se puede responder al comentario principal.",
                        Map.of("padreId", "Solo se puede responder al comentario principal."));
            }
            if (!objetivoId.equals(padre.objetivoId())) {
                throw BusinessException.invalida("La respuesta debe ser sobre el mismo contenido.",
                        Map.of("padreId", "La respuesta debe ser sobre el mismo contenido."));
            }
        }
        String estado = filtro.motivoDeRevision(texto).isPresent() ? "pendiente" : "publicado";
        UUID id = repo.crear(usuarioId, tipo, objetivoId, dto.padreId(), texto, catalogo.idioma(dto.idioma()), estado);
        return aDto(repo.porId(id).orElseThrow(), List.of(), usuarioId, Set.of());
    }

    @Transactional
    public ComentarioDto editar(UUID usuarioId, UUID comentarioId, String texto) {
        ComentarioFila c = propio(usuarioId, comentarioId);
        if (!"publicado".equals(c.estado()) && !"pendiente".equals(c.estado())) {
            throw BusinessException.conflicto("El equipo revisó tu comentario y ya no se puede editar.");
        }
        int minutos = cfg.entero("comentario_editable_minutos", 15);
        if (c.creadoEn().isBefore(OffsetDateTime.now().minusMinutes(minutos))) {
            throw BusinessException.conflicto("Tu comentario solo se puede editar durante " + minutos + " minutos.");
        }
        String limpio = texto == null ? "" : texto.trim();
        if (limpio.isEmpty()) {
            throw BusinessException.invalida("Escribe tu comentario.", Map.of("texto", "Escribe tu comentario."));
        }
        String estado = filtro.motivoDeRevision(limpio).isPresent() ? "pendiente" : "publicado";
        repo.actualizarTexto(comentarioId, limpio, estado);
        return aDto(repo.porId(comentarioId).orElseThrow(), List.of(), usuarioId, Set.of());
    }

    @Transactional
    public void borrar(UUID usuarioId, UUID comentarioId) {
        propio(usuarioId, comentarioId);
        repo.eliminar(comentarioId);
    }

    private ComentarioFila propio(UUID usuarioId, UUID comentarioId) {
        return repo.porId(comentarioId).filter(c -> usuarioId.equals(c.usuarioId()))
                .orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese comentario."));
    }

    private static ComentarioDto aDto(ComentarioFila c, List<ComentarioDto> respuestas, UUID usuarioId, Set<UUID> likes) {
        return new ComentarioDto(c.id(), c.padreId(), Nombres.corto(c.autorNombre()), c.texto(), c.creadoEn(),
                c.meGusta(), c.estado(), respuestas, usuarioId != null && usuarioId.equals(c.usuarioId()),
                likes.contains(c.id()));
    }
}
