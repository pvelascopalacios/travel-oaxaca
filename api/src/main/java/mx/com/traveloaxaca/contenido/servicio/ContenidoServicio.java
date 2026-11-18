package mx.com.traveloaxaca.contenido.servicio;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import mx.com.traveloaxaca.comun.api.Pagina;
import mx.com.traveloaxaca.comun.error.BusinessException;
import mx.com.traveloaxaca.contenido.dto.ContenidoDtos.*;
import mx.com.traveloaxaca.contenido.repo.ContenidoRepositorio;
import mx.com.traveloaxaca.contenido.repo.ContenidoRepositorio.Tipo;
import mx.com.traveloaxaca.negocios.repo.CatalogoRepositorio;
import mx.com.traveloaxaca.negocios.servicio.Actor;
import mx.com.traveloaxaca.negocios.servicio.SlugUtil;
import mx.com.traveloaxaca.negocios.servicio.Validaciones;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Alta y edición de lugares, rutas y eventos. Siempre se guarda primero como borrador y, con todo el contenido ya
 * puesto, se pasa al estado pedido: así la base exige el español antes de publicar y el error llega como mensaje claro.
 */
@Service
@Transactional
public class ContenidoServicio {

    private final ContenidoRepositorio repo;
    private final CatalogoRepositorio catalogo;
    private final DatosEditorial datos;
    private final ObjectMapper json;

    public ContenidoServicio(ContenidoRepositorio repo, CatalogoRepositorio catalogo, DatosEditorial datos,
                             ObjectMapper json) {
        this.repo = repo;
        this.catalogo = catalogo;
        this.datos = datos;
        this.json = json;
    }

    private String aJson(Map<String, Object> mapa) {
        try {
            return json.writeValueAsString(mapa);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException(ex);
        }
    }

    private Map<String, Object> deJson(String texto) {
        if (texto == null || texto.isBlank()) {
            return Map.of();
        }
        try {
            return json.readValue(texto, new TypeReference<Map<String, Object>>() {
            });
        } catch (JsonProcessingException ex) {
            return Map.of();
        }
    }

    // ---------------- reglas comunes ----------------

    private void exigirTextos(Map<String, ?> textos) {
        if (textos == null || !textos.containsKey("es")) {
            throw BusinessException.invalida("El texto en español es obligatorio.",
                    Map.of("traducciones", "Falta el texto en español (es)."));
        }
        for (String idioma : textos.keySet()) {
            if (!catalogo.idiomaExiste(idioma)) {
                throw BusinessException.invalida("El idioma \"" + idioma + "\" no existe o no está activo.",
                        Map.of("traducciones", "Idioma no válido: " + idioma));
            }
        }
    }

    private UUID destino() {
        return repo.destinoPorDefecto().orElseThrow(() -> BusinessException.invalida("No hay un destino activo."));
    }

    private String slug(Tipo t, UUID destino, String nombre) {
        String base = SlugUtil.base(nombre);
        return SlugUtil.libre(base, repo.slugsUsados(t, destino, base));
    }

    private void exigirExiste(String tabla, UUID id, String campo, String mensaje) {
        if (id != null && !repo.existe(tabla, id)) {
            throw BusinessException.invalida(mensaje, Map.of(campo, mensaje));
        }
    }

    private static void exigirActivo(boolean activo, String mensaje) {
        if (!activo) {
            throw BusinessException.noEncontrado(mensaje);
        }
    }

    public Pagina<ContenidoResumenDto> listar(Tipo tipo, String estado, String q, Integer pagina, Integer tamano) {
        int tam = tamano == null ? 20 : Math.max(1, Math.min(100, tamano));
        int pag = pagina == null ? 0 : Math.max(0, pagina);
        String texto = q == null || q.isBlank() ? null : q.trim();
        return new Pagina<>(repo.listar(tipo, estado == null || estado.isBlank() ? null : estado, texto, tam, pag * tam),
                repo.contar(tipo, estado == null || estado.isBlank() ? null : estado, texto), pag, tam);
    }

    public void archivar(Tipo tipo, UUID id) {
        exigirActivo(repo.estaActivo(tipo, id), "No encontramos ese contenido.");
        repo.archivar(tipo, id, switch (tipo) {
            case LUGAR, EVENTO -> "archivado";
            case RUTA -> "archivada";
        });
    }

    // ---------------- lugares ----------------

    public LugarAdminDto crearLugar(LugarEntradaDto e) {
        validarLugar(null, e);
        UUID id = UUID.randomUUID();
        UUID destino = destino();
        repo.insertarLugar(id, destino, slug(Tipo.LUGAR, destino, e.traducciones().get("es").nombre()), e.tipo(),
                e.municipioId(), e.padreId(), e.latitud(), e.longitud(), e.destacado(),
                aJson(datos.lugar(e.datos())));
        repo.reemplazarTextosLugar(id, e.traducciones());
        if (!"borrador".equals(e.estado())) {
            repo.cambiarEstado(Tipo.LUGAR, id, e.estado());
        }
        return lugar(id);
    }

    public LugarAdminDto actualizarLugar(UUID id, LugarEntradaDto e) {
        var actual = repo.lugar(id).orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese lugar."));
        validarLugar(id, e);
        repo.actualizarLugar(id, e.tipo(), e.municipioId(), e.padreId(), e.latitud(), e.longitud(), e.destacado(),
                aJson(datos.lugar(e.datos())));
        repo.reemplazarTextosLugar(id, e.traducciones());
        if (!actual.estado().equals(e.estado())) {
            repo.cambiarEstado(Tipo.LUGAR, id, e.estado());
        }
        return lugar(id);
    }

    @Transactional(readOnly = true)
    public LugarAdminDto lugar(UUID id) {
        var l = repo.lugar(id).orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese lugar."));
        return new LugarAdminDto(l.id(), l.slug(), l.tipo(), l.municipioId(), l.padreId(), l.latitud(), l.longitud(),
                l.destacado(), l.estado(), deJson(l.datos()), repo.textosLugar(id), repo.medioIdsLugar(id),
                l.actualizadoEn());
    }

    /** Define las fotos del lugar, en orden. Las que pone el equipo editorial quedan aprobadas. */
    public LugarAdminDto ponerFotosLugar(Actor actor, UUID id, List<UUID> medioIds) {
        exigirActivo(repo.lugar(id).isPresent(), "No encontramos ese lugar.");
        List<UUID> unicos = medioIds.stream().distinct().toList();
        if (repo.contarMediosValidos(unicos) != unicos.size()) {
            throw BusinessException.invalida("Alguna foto no existe o todavía no se confirma su subida.",
                    Map.of("medioIds", "Sube y confirma cada foto antes de agregarla."));
        }
        repo.reemplazarMediosLugar(id, unicos, actor.usuarioId());
        return lugar(id);
    }

    private void validarLugar(UUID idActual, LugarEntradaDto e) {
        exigirTextos(e.traducciones());
        Validaciones.ubicacion(e.latitud(), e.longitud());
        exigirExiste("municipio", e.municipioId(), "municipioId", "Ese municipio no existe.");
        if (e.padreId() != null) {
            if (e.padreId().equals(idActual)) {
                throw BusinessException.invalida("Un lugar no puede ser su propio padre.", Map.of("padreId", "Elige otro lugar."));
            }
            var padre = repo.lugar(e.padreId()).orElseThrow(() -> BusinessException.invalida(
                    "El lugar padre no existe.", Map.of("padreId", "Ese lugar no existe.")));
            if (padre.padreId() != null) {
                throw BusinessException.invalida("El lugar padre ya es parte de otro lugar. Solo se permite un nivel.",
                        Map.of("padreId", "Elige un lugar que no tenga padre."));
            }
        }
        if ("publicado".equals(e.estado()) && (e.latitud() == null || e.municipioId() == null)) {
            throw BusinessException.invalida("Para publicar un lugar indica su municipio y su ubicación en el mapa.",
                    Map.of("estado", "Faltan municipio y ubicación."));
        }
    }

    // ---------------- rutas ----------------

    public RutaAdminDto crearRuta(RutaEntradaDto e) {
        validarRuta(e);
        UUID id = UUID.randomUUID();
        UUID destino = destino();
        repo.insertarRuta(id, destino, slug(Tipo.RUTA, destino, e.traducciones().get("es").nombre()), e.duracionHoras(),
                e.distanciaKm(), e.dificultad(), e.transporte(), e.esPremium());
        repo.reemplazarTextosRuta(id, e.traducciones());
        repo.reemplazarParadas(id, paradas(e));
        if (!"borrador".equals(e.estado())) {
            repo.cambiarEstado(Tipo.RUTA, id, e.estado());
        }
        return ruta(id);
    }

    public RutaAdminDto actualizarRuta(UUID id, RutaEntradaDto e) {
        var actual = repo.ruta(id).orElseThrow(() -> BusinessException.noEncontrado("No encontramos esa ruta."));
        validarRuta(e);
        repo.actualizarRuta(id, e.duracionHoras(), e.distanciaKm(), e.dificultad(), e.transporte(), e.esPremium());
        repo.reemplazarTextosRuta(id, e.traducciones());
        repo.reemplazarParadas(id, paradas(e));
        if (!actual.estado().equals(e.estado())) {
            repo.cambiarEstado(Tipo.RUTA, id, e.estado());
        }
        return ruta(id);
    }

    @Transactional(readOnly = true)
    public RutaAdminDto ruta(UUID id) {
        var r = repo.ruta(id).orElseThrow(() -> BusinessException.noEncontrado("No encontramos esa ruta."));
        return new RutaAdminDto(r.id(), r.slug(), r.duracionHoras(), r.distanciaKm(), r.dificultad(), r.transporte(),
                r.esPremium(), r.estado(), repo.textosRuta(id), repo.paradas(id), r.actualizadoEn());
    }

    private static List<ParadaEntradaDto> paradas(RutaEntradaDto e) {
        return e.paradas() == null ? List.of() : e.paradas();
    }

    private void validarRuta(RutaEntradaDto e) {
        exigirTextos(e.traducciones());
        int n = 0;
        for (ParadaEntradaDto p : paradas(e)) {
            n++;
            String campo = "paradas[" + n + "]";
            boolean punto = p.latitud() != null || p.longitud() != null;
            int opciones = (p.lugarId() != null ? 1 : 0) + (p.negocioId() != null ? 1 : 0) + (punto ? 1 : 0);
            if (opciones != 1) {
                throw BusinessException.invalida("La parada " + n + " debe ser un lugar, un negocio o un punto del mapa (solo uno).",
                        Map.of(campo, "Elige solo uno."));
            }
            if (punto) {
                Validaciones.ubicacion(p.latitud(), p.longitud());
            }
            exigirExiste("lugar", p.lugarId(), campo, "El lugar de la parada " + n + " no existe.");
            exigirExiste("negocio", p.negocioId(), campo, "El negocio de la parada " + n + " no existe.");
        }
        if ("publicada".equals(e.estado()) && n < 2) {
            throw BusinessException.invalida("Para publicar una ruta agrega al menos 2 paradas.",
                    Map.of("paradas", "Agrega al menos 2 paradas."));
        }
    }

    // ---------------- eventos ----------------

    public EventoAdminDto crearEvento(EventoEntradaDto e) {
        validarEvento(e);
        UUID id = UUID.randomUUID();
        UUID destino = destino();
        repo.insertarEvento(id, destino, slug(Tipo.EVENTO, destino, e.traducciones().get("es").nombre()), e.fechaInicio(),
                e.fechaFin(), e.municipioId(), e.temporadaId(), e.latitud(), e.longitud(),
                aJson(datos.evento(e.datos())));
        repo.reemplazarTextosEvento(id, e.traducciones());
        repo.reemplazarNegociosEvento(id, ids(e));
        if (!"borrador".equals(e.estado())) {
            repo.cambiarEstado(Tipo.EVENTO, id, e.estado());
        }
        return evento(id);
    }

    public EventoAdminDto actualizarEvento(UUID id, EventoEntradaDto e) {
        var actual = repo.evento(id).orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese evento."));
        validarEvento(e);
        repo.actualizarEvento(id, e.fechaInicio(), e.fechaFin(), e.municipioId(), e.temporadaId(), e.latitud(), e.longitud(),
                aJson(datos.evento(e.datos())));
        repo.reemplazarTextosEvento(id, e.traducciones());
        repo.reemplazarNegociosEvento(id, ids(e));
        if (!actual.estado().equals(e.estado())) {
            repo.cambiarEstado(Tipo.EVENTO, id, e.estado());
        }
        return evento(id);
    }

    @Transactional(readOnly = true)
    public EventoAdminDto evento(UUID id) {
        var v = repo.evento(id).orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese evento."));
        return new EventoAdminDto(v.id(), v.slug(), v.fechaInicio(), v.fechaFin(), v.municipioId(), v.temporadaId(),
                v.latitud(), v.longitud(), v.estado(), deJson(v.datos()), repo.textosEvento(id),
                repo.negocioIdsEvento(id), v.actualizadoEn());
    }

    private static List<UUID> ids(EventoEntradaDto e) {
        return e.negocioIds() == null ? List.of() : e.negocioIds().stream().distinct().toList();
    }

    private void validarEvento(EventoEntradaDto e) {
        exigirTextos(e.traducciones());
        if (e.fechaFin().isBefore(e.fechaInicio())) {
            throw BusinessException.invalida("La fecha final no puede ser anterior a la inicial.",
                    Map.of("fechaFin", "Debe ser igual o posterior al inicio."));
        }
        Validaciones.ubicacion(e.latitud(), e.longitud());
        exigirExiste("municipio", e.municipioId(), "municipioId", "Ese municipio no existe.");
        exigirExiste("temporada", e.temporadaId(), "temporadaId", "Esa temporada no existe.");
        List<UUID> negocios = ids(e);
        if (repo.contarNegocios(negocios) != negocios.size()) {
            throw BusinessException.invalida("Alguno de los negocios del evento no existe.",
                    Map.of("negocioIds", "Revisa los negocios."));
        }
    }
}
