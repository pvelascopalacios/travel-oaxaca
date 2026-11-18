package mx.com.traveloaxaca.revision.servicio;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import mx.com.traveloaxaca.acceso.correo.NotificacionServicio;
import mx.com.traveloaxaca.comun.api.Pagina;
import mx.com.traveloaxaca.comun.error.BusinessException;
import mx.com.traveloaxaca.negocios.almacen.AlmacenMedios;
import mx.com.traveloaxaca.negocios.repo.FichaRepositorio;
import mx.com.traveloaxaca.negocios.repo.NegocioRepositorio;
import mx.com.traveloaxaca.negocios.repo.NegocioRepositorio.NegocioFila;
import mx.com.traveloaxaca.negocios.repo.NegocioRepositorio.RevisionFila;
import mx.com.traveloaxaca.negocios.servicio.Actor;
import mx.com.traveloaxaca.negocios.servicio.FaltantesEnvio;
import mx.com.traveloaxaca.negocios.servicio.FichaServicio;
import mx.com.traveloaxaca.negocios.servicio.PuntajeFicha;
import mx.com.traveloaxaca.revision.dto.RevisionDtos.ColaItemDto;
import mx.com.traveloaxaca.revision.dto.RevisionDtos.DetalleRevisionDto;
import mx.com.traveloaxaca.revision.dto.RevisionDtos.HistorialDto;
import mx.com.traveloaxaca.revision.dto.RevisionDtos.PropietarioDto;
import mx.com.traveloaxaca.revision.repo.RevisionRepositorio;
import mx.com.traveloaxaca.revision.repo.RevisionRepositorio.FiltroCola;
import mx.com.traveloaxaca.revision.repo.RevisionRepositorio.MedioPendiente;
import mx.com.traveloaxaca.revision.repo.RevisionRepositorio.PersonaFila;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cola de revisión: fichas nuevas, cambios a fichas publicadas y fotos. Solo admin y editor
 * (lo exige la configuración de seguridad; aquí se vuelve a comprobar por si se llama desde otro lado).
 */
@Service
public class RevisionColaServicio {

    private static final Set<String> TIPOS = Set.of("ficha_nueva", "cambio", "foto");
    private static final long HORAS_ATENCION = 48;
    private static final long HORAS_URGENTE = 120;
    private static final int MAX_TAMANO = 100;

    private final RevisionRepositorio repo;
    private final NegocioRepositorio negocios;
    private final FichaRepositorio ficha;
    private final FichaServicio fichas;
    private final FaltantesEnvio faltantes;
    private final PuntajeFicha puntaje;
    private final NotificacionServicio correos;
    private final AlmacenMedios almacen;
    private final ObjectMapper json;

    public RevisionColaServicio(RevisionRepositorio repo, NegocioRepositorio negocios, FichaRepositorio ficha,
                                FichaServicio fichas, FaltantesEnvio faltantes, PuntajeFicha puntaje,
                                NotificacionServicio correos, AlmacenMedios almacen, ObjectMapper json) {
        this.repo = repo;
        this.negocios = negocios;
        this.ficha = ficha;
        this.fichas = fichas;
        this.faltantes = faltantes;
        this.puntaje = puntaje;
        this.correos = correos;
        this.almacen = almacen;
        this.json = json;
    }

    // ---------------- lectura ----------------

    @Transactional(readOnly = true)
    public Pagina<ColaItemDto> cola(Actor actor, String tipo, UUID regionId, UUID categoriaId, int pagina, int tamano) {
        revisor(actor);
        if (tipo != null && !tipo.isBlank() && !TIPOS.contains(tipo)) {
            throw BusinessException.invalida("El tipo debe ser ficha_nueva, cambio o foto.");
        }
        int t = Math.max(1, Math.min(tamano, MAX_TAMANO));
        int p = Math.max(0, pagina);
        var f = new FiltroCola(tipo == null || tipo.isBlank() ? null : tipo, regionId, categoriaId, t, p * t);
        List<ColaItemDto> items = repo.cola(f).stream()
                .map(c -> new ColaItemDto(c.tipo(), c.negocioId(), c.medioId(), c.nombreComercial(), c.categoriaClave(),
                        c.municipioNombre(), c.regionId(), c.regionNombre(),
                        c.claveAlmacenamiento() == null ? null : almacen.urlPublica(c.claveAlmacenamiento()),
                        c.enviadaEn(), c.horasEspera(), urgencia(c.horasEspera())))
                .toList();
        return new Pagina<>(items, repo.contarCola(f), p, t);
    }

    static String urgencia(long horas) {
        return horas > HORAS_URGENTE ? "urgente" : horas > HORAS_ATENCION ? "atencion" : "normal";
    }

    @Transactional(readOnly = true)
    public DetalleRevisionDto detalle(Actor actor, UUID negocioId) {
        revisor(actor);
        NegocioFila n = negocios.porId(negocioId).orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese negocio."));
        RevisionFila r = negocios.revisionPendiente(negocioId).orElse(null);
        String tipo = r == null ? "foto" : "en_revision".equals(n.estado()) ? "ficha_nueva" : "cambio";
        PropietarioDto dueno = repo.propietario(negocioId)
                .map(p -> new PropietarioDto(p.usuarioId(), p.nombre(), p.correo())).orElse(null);
        return new DetalleRevisionDto(tipo, fichas.cargar(negocioId, null), dueno, r == null ? null : r.enviadaEn());
    }

    @Transactional(readOnly = true)
    public Pagina<HistorialDto> historial(Actor actor, int pagina, int tamano) {
        revisor(actor);
        int t = Math.max(1, Math.min(tamano, MAX_TAMANO));
        int p = Math.max(0, pagina);
        List<HistorialDto> items = repo.historial(t, p * t).stream()
                .map(h -> new HistorialDto(h.tipo(), h.negocioId(), h.medioId(), h.nombreComercial(), h.resultado(),
                        h.motivo(), h.revisorNombre(), h.resueltaEn())).toList();
        return new Pagina<>(items, repo.contarHistorial(), p, t);
    }

    // ---------------- fichas ----------------

    @Transactional
    public void aprobar(Actor actor, UUID negocioId) {
        revisor(actor);
        NegocioFila n = negocios.porIdParaActualizar(negocioId)
                .orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese negocio."));
        RevisionFila r = pendiente(negocioId);
        boolean nueva = "en_revision".equals(n.estado());
        if (nueva) {
            Map<String, String> falta = faltantes.paraPublicar(negocioId);
            if (!falta.isEmpty()) {
                throw BusinessException.invalida("La ficha todavía no cumple lo necesario para publicarse. "
                        + "Aprueba primero sus fotos o recházala con un motivo.", falta);
            }
            negocios.cambiarEstado(negocioId, "publicada");
        } else {
            aplicarCambios(negocioId, mapa(r.cambios()));
        }
        repo.resolverRevision(r.id(), true, actor.usuarioId(), null);
        puntaje.recalcular(negocioId);
        avisarDueno(negocioId, n.nombreComercial(), nueva ? "ficha_publicada" : "cambios_aprobados", null);
    }

    @Transactional
    public void rechazar(Actor actor, UUID negocioId, String motivo) {
        revisor(actor);
        String m = motivo == null ? "" : motivo.trim();
        if (m.length() < 10) {
            throw BusinessException.invalida("El motivo debe tener al menos 10 caracteres.",
                    Map.of("motivo", "Escribe el motivo del rechazo."));
        }
        NegocioFila n = negocios.porIdParaActualizar(negocioId)
                .orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese negocio."));
        RevisionFila r = pendiente(negocioId);
        boolean nueva = "en_revision".equals(n.estado());
        if (nueva) {
            negocios.cambiarEstado(negocioId, "borrador");
        }
        repo.resolverRevision(r.id(), false, actor.usuarioId(), m);
        avisarDueno(negocioId, n.nombreComercial(), nueva ? "ficha_rechazada" : "cambios_rechazados", m);
    }

    private RevisionFila pendiente(UUID negocioId) {
        return negocios.revisionPendiente(negocioId)
                .orElseThrow(() -> BusinessException.conflicto("Esta solicitud ya fue resuelta o no existe."));
    }

    /** Aplica por campo lo que el dueño propuso. Un campo desconocido detiene todo: mejor fallar que aprobar a medias. */
    private void aplicarCambios(UUID negocioId, Map<String, Object> cambios) {
        for (Map.Entry<String, Object> e : cambios.entrySet()) {
            String campo = e.getKey();
            Map<String, Object> par = mapa(e.getValue());
            if (par == null || !par.containsKey("despues")) {
                throw BusinessException.conflicto("El cambio «" + campo + "» está incompleto. Recházalo con un motivo.");
            }
            Object valor = par.get("despues");
            Map<String, Object> despues = mapa(valor);
            if ("nombre_comercial".equals(campo)) {
                repo.cambiarNombre(negocioId, texto(valor, campo));
            } else if ("categoria_id".equals(campo)) {
                UUID cat;
                try {
                    cat = UUID.fromString(texto(valor, campo));
                } catch (IllegalArgumentException ex) {
                    throw BusinessException.conflicto("La categoría propuesta no es válida. Rechaza el cambio con un motivo.");
                }
                if (negocios.claveRaiz(cat).isEmpty()) {
                    throw BusinessException.conflicto("La categoría propuesta ya no está disponible. Rechaza el cambio con un motivo.");
                }
                repo.cambiarCategoria(negocioId, cat);
            } else if (campo.startsWith("traduccion.")) {
                String idioma = campo.substring("traduccion.".length());
                if (despues == null) {
                    throw BusinessException.conflicto("El cambio de textos está incompleto. Recházalo con un motivo.");
                }
                ficha.guardarTraduccion(negocioId, idioma, cadena(despues.get("descripcionCorta")),
                        cadena(despues.get("descripcion")), cadena(despues.get("politicas")));
            } else if ("sucursal_principal_ubicacion".equals(campo)) {
                if (despues == null || !(despues.get("latitud") instanceof Number lat)
                        || !(despues.get("longitud") instanceof Number lng)) {
                    throw BusinessException.conflicto("La ubicación propuesta está incompleta. Recházala con un motivo.");
                }
                if (repo.cambiarUbicacionPrincipal(negocioId, lat.doubleValue(), lng.doubleValue()) == 0) {
                    throw BusinessException.conflicto("El negocio ya no tiene sucursal principal. Recházalo con un motivo.");
                }
            } else {
                throw BusinessException.conflicto("El cambio «" + campo + "» no se puede aplicar automáticamente.");
            }
        }
    }

    // ---------------- fotos ----------------

    @Transactional
    public void aprobarFoto(Actor actor, UUID medioId) {
        revisor(actor);
        MedioPendiente m = fotoPendiente(medioId);
        repo.resolverMedio(medioId, true, actor.usuarioId(), null);
        repo.negociosDeMedio(m.id()).forEach(puntaje::recalcular);
    }

    @Transactional
    public void rechazarFoto(Actor actor, UUID medioId, String motivo) {
        revisor(actor);
        String mot = motivo == null ? "" : motivo.trim();
        if (mot.length() < 10) {
            throw BusinessException.invalida("El motivo debe tener al menos 10 caracteres.",
                    Map.of("motivo", "Escribe el motivo del rechazo."));
        }
        MedioPendiente m = fotoPendiente(medioId);
        repo.resolverMedio(medioId, false, actor.usuarioId(), mot);
        List<UUID> ids = repo.negociosDeMedio(m.id());
        ids.forEach(puntaje::recalcular);
        if (!ids.isEmpty()) {
            avisarDueno(ids.get(0), repo.nombreNegocio(ids.get(0)), "foto_rechazada", mot);
        }
    }

    private MedioPendiente fotoPendiente(UUID medioId) {
        MedioPendiente m = repo.medioParaRevisar(medioId)
                .orElseThrow(() -> BusinessException.noEncontrado("No encontramos esa foto."));
        if (m.hash() == null) {
            throw BusinessException.conflicto("La foto todavía no terminó de subirse.");
        }
        if (!"pendiente".equals(m.moderacion())) {
            throw BusinessException.conflicto("Esta foto ya fue revisada.");
        }
        if (repo.negociosDeMedio(medioId).isEmpty()) {
            throw BusinessException.noEncontrado("Esa foto no pertenece a ningún negocio.");
        }
        return m;
    }

    // ---------------- apoyo ----------------

    private void avisarDueno(UUID negocioId, String negocio, String plantilla, String motivo) {
        PersonaFila dueno = repo.propietario(negocioId).orElse(null);
        if (dueno == null) {
            return;
        }
        Map<String, String> datos = new LinkedHashMap<>();
        datos.put("nombre", dueno.nombre());
        datos.put("negocio", negocio);
        if (motivo != null) {
            datos.put("motivo", motivo);
        }
        correos.encolarCorreo(dueno.usuarioId(), plantilla, datos);
    }

    private static void revisor(Actor actor) {
        if (!actor.puedeEditarTodo()) {
            throw BusinessException.prohibido("No tienes permiso para revisar.");
        }
    }

    private static String texto(Object o, String campo) {
        if (!(o instanceof String s) || s.isBlank()) {
            throw BusinessException.conflicto("El cambio «" + campo + "» está incompleto. Recházalo con un motivo.");
        }
        return s.trim();
    }

    private static String cadena(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    private Map<String, Object> mapa(String jsonTexto) {
        try {
            return json.readValue(jsonTexto, new TypeReference<Map<String, Object>>() {
            });
        } catch (Exception e) {
            throw new IllegalStateException("Los cambios de la revisión no son un JSON válido.", e);
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> mapa(Object o) {
        return o instanceof Map<?, ?> m ? (Map<String, Object>) m : null;
    }
}
