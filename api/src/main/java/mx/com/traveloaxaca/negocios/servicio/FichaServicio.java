package mx.com.traveloaxaca.negocios.servicio;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.Validator;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import mx.com.traveloaxaca.comun.error.BusinessException;
import mx.com.traveloaxaca.negocios.almacen.AlmacenMedios;
import mx.com.traveloaxaca.negocios.dto.NegocioDtos.*;
import mx.com.traveloaxaca.negocios.repo.CatalogoRepositorio;
import mx.com.traveloaxaca.negocios.repo.FichaRepositorio;
import mx.com.traveloaxaca.negocios.repo.FichaRepositorio.IdiomaFila;
import mx.com.traveloaxaca.negocios.repo.NegocioRepositorio;
import mx.com.traveloaxaca.negocios.repo.OfertaRepositorio;
import mx.com.traveloaxaca.negocios.servicio.AccesoNegocio.Contexto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Arma la ficha completa y guarda sus textos, servicios e idiomas. */
@Service
public class FichaServicio {

    private final NegocioRepositorio negocios;
    private final FichaRepositorio ficha;
    private final OfertaRepositorio ofertas;
    private final CatalogoRepositorio catalogo;
    private final AccesoNegocio acceso;
    private final AlmacenMedios almacen;
    private final PuntajeFicha puntaje;
    private final RevisionServicio revision;
    private final FaltantesEnvio faltantesEnvio;
    private final ObjectMapper json;
    private final Validator validador;

    public FichaServicio(NegocioRepositorio negocios, FichaRepositorio ficha, OfertaRepositorio ofertas,
                         CatalogoRepositorio catalogo, AccesoNegocio acceso, AlmacenMedios almacen,
                         PuntajeFicha puntaje, RevisionServicio revision, FaltantesEnvio faltantesEnvio,
                         ObjectMapper json, Validator validador) {
        this.negocios = negocios;
        this.ficha = ficha;
        this.ofertas = ofertas;
        this.catalogo = catalogo;
        this.acceso = acceso;
        this.almacen = almacen;
        this.puntaje = puntaje;
        this.revision = revision;
        this.faltantesEnvio = faltantesEnvio;
        this.json = json;
        this.validador = validador;
    }

    // ---------------- lectura ----------------

    @Transactional(readOnly = true)
    public FichaDto ver(Actor actor, UUID negocioId) {
        Contexto ctx = acceso.leer(actor, negocioId);
        return cargar(ctx.id(), ctx.rol());
    }

    @Transactional(readOnly = true)
    public FaltantesDto faltantes(Actor actor, UUID negocioId) {
        Contexto ctx = acceso.leer(actor, negocioId);
        return faltantesEnvio.calcular(ctx.id(), ctx.negocio().puntajeFicha());
    }

    /** Lee de nuevo todo desde la base, así la respuesta siempre refleja lo que quedó guardado. */
    public FichaDto cargar(UUID negocioId, String rol) {
        var n = negocios.porId(negocioId).orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese negocio."));
        String claveCat = negocios.claveCategoria(n.categoriaId()).orElse(null);
        Map<String, TraduccionDto> traducciones = new LinkedHashMap<>();
        ficha.traducciones(negocioId).forEach(t -> traducciones.put(t.idiomaCodigo(),
                new TraduccionDto(t.descripcionCorta(), t.descripcion(), t.politicas())));

        Map<UUID, List<HorarioDto>> horarios = new HashMap<>();
        ficha.horarios(negocioId).forEach(h -> horarios.computeIfAbsent(h.sucursalId(), k -> new ArrayList<>())
                .add(new HorarioDto(h.diaSemana(), h.abre(), h.cierra(), h.cerrado())));
        Map<UUID, List<ExcepcionDto>> excepciones = new HashMap<>();
        ficha.excepciones(negocioId).forEach(e -> excepciones.computeIfAbsent(e.sucursalId(), k -> new ArrayList<>())
                .add(new ExcepcionDto(e.fecha(), e.abre(), e.cierra(), e.cerrado(), e.nota())));
        List<SucursalDto> sucursales = ficha.sucursales(negocioId).stream()
                .map(s -> new SucursalDto(s.id(), s.nombre(), s.esPrincipal(), s.municipioId(), s.municipioNombre(),
                        s.localidadId(), s.direccionTexto(), s.referencia(), s.latitud(), s.longitud(),
                        horarios.getOrDefault(s.id(), List.of()), excepciones.getOrDefault(s.id(), List.of())))
                .toList();
        List<ContactoDto> contactos = ficha.contactos(negocioId).stream()
                .map(c -> new ContactoDto(c.id(), c.sucursalId(), c.tipo(), c.valor(), c.esPrincipal())).toList();
        List<IdiomaNivelDto> idiomas = ficha.idiomas(negocioId).stream()
                .map(i -> new IdiomaNivelDto(i.idiomaCodigo(), i.nivel())).toList();
        List<MedioFichaDto> medios = ficha.medios(negocioId).stream()
                .map(m -> new MedioFichaDto(m.medioId(), almacen.urlPublica(m.claveAlmacenamiento()), m.orden(),
                        m.esPortada(), m.pieTexto(), m.moderacion(), m.motivoRechazo())).toList();

        RevisionDto rev = negocios.ultimaRevision(negocioId).filter(r -> !"aprobada".equals(r.estado()))
                .map(r -> new RevisionDto(r.id(), r.version(), r.estado(), r.motivoRechazo(), mapa(r.cambios()), r.enviadaEn()))
                .orElse(null);

        return new FichaDto(n.id(), n.slug(), n.estado(), n.nombreComercial(), n.razonSocial(), n.categoriaId(),
                claveCat, n.rangoPrecio(), n.precioDesde(), n.unidadPrecio(), n.moneda(), mapa(n.atributos()),
                n.puntajeFicha(), n.publicadoEn(), n.verificadoEn(), rol, traducciones, sucursales, contactos,
                ficha.servicioIds(negocioId), idiomas, medios, ofertas(negocioId),
                faltantesEnvio.calcular(negocioId, n.puntajeFicha()).faltantes(), rev);
    }

    public List<OfertaDto> ofertas(UUID negocioId) {
        Map<UUID, Map<String, OfertaTraduccionDto>> trad = new HashMap<>();
        ofertas.traducciones(negocioId).forEach(t -> trad.computeIfAbsent(t.ofertaId(), k -> new LinkedHashMap<>())
                .put(t.idiomaCodigo(), new OfertaTraduccionDto(t.nombre(), t.descripcion(), t.incluye(), t.noIncluye())));
        return ofertas.listar(negocioId).stream()
                .map(o -> new OfertaDto(o.id(), o.tipo(), o.estado(), o.precioDesde(), o.unidadPrecio(),
                        o.duracionMin(), o.capacidad(), o.orden(), o.seccion(), etiquetasDe(o.etiquetas()),
                        trad.getOrDefault(o.id(), Map.of())))
                .toList();
    }

    /** Las marcas se guardan como arreglo y llegan de la consulta separadas por coma. */
    public static List<String> etiquetasDe(String texto) {
        return texto == null || texto.isBlank() ? List.of() : List.of(texto.split(","));
    }

    /** Cierra una operación de edición: recalcula el puntaje y devuelve la ficha como quedó. */
    public ResultadoCambio terminar(Contexto ctx, boolean aplicado, boolean pendiente) {
        puntaje.recalcular(ctx.id());
        return new ResultadoCambio(aplicado, pendiente, cargar(ctx.id(), ctx.rol()));
    }

    // ---------------- textos ----------------

    @Transactional
    public ResultadoCambio guardarTraducciones(Actor actor, UUID negocioId, Map<String, TraduccionDto> entrada) {
        Contexto ctx = acceso.editar(actor, negocioId);
        if (entrada == null || entrada.isEmpty()) {
            throw BusinessException.invalida("Envía al menos un idioma.");
        }
        boolean publicada = "publicada".equals(ctx.negocio().estado());
        boolean aplicado = false;
        boolean pendiente = false;
        for (Map.Entry<String, TraduccionDto> e : entrada.entrySet()) {
            String idioma = e.getKey();
            if (!catalogo.idiomaExiste(idioma)) {
                throw BusinessException.invalida("Idioma no válido: " + idioma + ".",
                        Map.of("traducciones." + idioma, "Idioma no válido."));
            }
            TraduccionDto t = e.getValue();
            if (t == null) {
                throw BusinessException.invalida("Falta el contenido del idioma " + idioma + ".");
            }
            Map<String, String> errores = new LinkedHashMap<>();
            validador.validate(t).forEach(v -> errores.put("traducciones." + idioma + "." + v.getPropertyPath(), v.getMessage()));
            if (!errores.isEmpty()) {
                throw BusinessException.invalida("Revisa los textos de tu ficha.", errores);
            }
            String corta = Validaciones.limpiar(t.descripcionCorta());
            String larga = Validaciones.limpiar(t.descripcion());
            String politicas = Validaciones.limpiar(t.politicas());
            if (publicada && "es".equals(idioma) && corta == null) {
                throw BusinessException.invalida("Tu ficha publicada necesita la descripción corta en español.",
                        Map.of("traducciones.es.descripcionCorta", "La descripción corta en español es obligatoria."));
            }
            var antes = ficha.traduccion(negocioId, idioma).orElse(null);
            Map<String, String> a = antes == null ? new LinkedHashMap<>() : textos(antes.descripcionCorta(), antes.descripcion(), antes.politicas());
            Map<String, String> d = textos(corta, larga, politicas);
            if (publicada) {
                if (!Objects.equals(vacioANull(a), d)) {
                    revision.proponer(negocioId, actor.usuarioId(), "traduccion." + idioma, a, d);
                    pendiente = true;
                }
            } else {
                ficha.guardarTraduccion(negocioId, idioma, corta, larga, politicas);
                aplicado = true;
            }
        }
        return terminar(ctx, aplicado, pendiente);
    }

    private static Map<String, String> textos(String corta, String larga, String politicas) {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("descripcionCorta", corta);
        m.put("descripcion", larga);
        m.put("politicas", politicas);
        return m;
    }

    private static Map<String, String> vacioANull(Map<String, String> m) {
        return m.isEmpty() ? textos(null, null, null) : m;
    }

    // ---------------- servicios e idiomas ----------------

    @Transactional
    public ResultadoCambio guardarServicios(Actor actor, UUID negocioId, ServiciosEntradaDto dto) {
        Contexto ctx = acceso.editar(actor, negocioId);
        List<UUID> ids = dto.servicioIds().stream().distinct().toList();
        if (ficha.contarServiciosActivos(ids) != ids.size()) {
            throw BusinessException.invalida("Alguno de los servicios no existe o ya no está disponible.",
                    Map.of("servicioIds", "Alguno de los servicios no es válido."));
        }
        ficha.reemplazarServicios(negocioId, ids);
        return terminar(ctx, true, false);
    }

    @Transactional
    public ResultadoCambio guardarIdiomas(Actor actor, UUID negocioId, IdiomasEntradaDto dto) {
        Contexto ctx = acceso.editar(actor, negocioId);
        Map<String, IdiomaFila> unicos = new LinkedHashMap<>();
        for (IdiomaNivelDto i : dto.idiomas()) {
            if (!catalogo.idiomaExiste(i.idiomaCodigo())) {
                throw BusinessException.invalida("Idioma no válido: " + i.idiomaCodigo() + ".",
                        Map.of("idiomas", "Idioma no válido: " + i.idiomaCodigo() + "."));
            }
            unicos.put(i.idiomaCodigo(), new IdiomaFila(i.idiomaCodigo(), i.nivel() == null ? "basico" : i.nivel()));
        }
        ficha.reemplazarIdiomas(negocioId, new ArrayList<>(unicos.values()));
        return terminar(ctx, true, false);
    }

    // ---------------- apoyo ----------------

    Map<String, Object> mapa(String jsonTexto) {
        if (jsonTexto == null || jsonTexto.isBlank()) {
            return new LinkedHashMap<>();
        }
        try {
            return json.readValue(jsonTexto, new TypeReference<LinkedHashMap<String, Object>>() {
            });
        } catch (Exception e) {
            return new LinkedHashMap<>();
        }
    }
}
