package mx.com.traveloaxaca.explorar.servicio;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import mx.com.traveloaxaca.comun.api.Pagina;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.PromocionPublicaDto;
import mx.com.traveloaxaca.comercial.repo.PatrocinioRepositorio;
import mx.com.traveloaxaca.comercial.repo.PromocionRepositorio;
import mx.com.traveloaxaca.comercial.servicio.PlanServicio;
import mx.com.traveloaxaca.comun.error.BusinessException;
import mx.com.traveloaxaca.explorar.dto.ExplorarDtos.*;
import mx.com.traveloaxaca.explorar.repo.ExplorarRepositorio;
import mx.com.traveloaxaca.explorar.repo.ExplorarRepositorio.*;
import mx.com.traveloaxaca.negocios.almacen.AlmacenMedios;
import mx.com.traveloaxaca.negocios.servicio.CatalogoServicio;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Lo que el turista puede buscar y leer. Nada de lo que no esté publicado sale de aquí. */
@Service
@Transactional(readOnly = true)
public class ExplorarServicio {

    public static final String DESTINO_BASE = "oaxaca";
    static final double RADIO_BASE_KM = 25;
    static final double RADIO_MAX_KM = 100;
    static final int TAMANO_MAX = 50;
    static final int PUNTOS_MAX = 500;
    private static final Set<String> ORDENES = Set.of("relevancia", "distancia", "precio", "nombre", "calificacion");
    private static final ZoneId MEXICO = ZoneId.of("America/Mexico_City");
    /** dia_semana va de 0 (domingo) a 6 (sábado), como en la base. */
    private static final String[] DIAS_SCHEMA = {"Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"};

    private final ExplorarRepositorio repo;
    private final CatalogoServicio catalogo;
    private final AlmacenMedios almacen;
    private final ObjectMapper json;
    private final BusquedaLogServicio busquedaLog;
    private final PromocionRepositorio promociones;
    private final PatrocinioRepositorio patrocinios;

    public ExplorarServicio(ExplorarRepositorio repo, CatalogoServicio catalogo, AlmacenMedios almacen,
                            ObjectMapper json, BusquedaLogServicio busquedaLog, PromocionRepositorio promociones,
                            PatrocinioRepositorio patrocinios) {
        this.promociones = promociones;
        this.patrocinios = patrocinios;
        this.repo = repo;
        this.catalogo = catalogo;
        this.almacen = almacen;
        this.json = json;
        this.busquedaLog = busquedaLog;
    }

    // ---------------- parámetros comunes ----------------

    public record Punto(Double lat, Double lng, Double radioM) {
    }

    /** La ubicación del turista puede estar en cualquier parte (viene de otro estado), solo se valida que sea real. */
    static Punto punto(Double lat, Double lng, Double radioKm, boolean cerca) {
        if ((lat == null) != (lng == null)) {
            throw BusinessException.invalida("Envía latitud y longitud juntas.", Map.of("lat", "Envía lat y lng juntas."));
        }
        if (lat == null) {
            return new Punto(null, null, null);
        }
        if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            throw BusinessException.invalida("La ubicación no es válida.", Map.of("lat", "Revisa lat y lng."));
        }
        Double radio = null;
        if (radioKm != null) {
            if (radioKm <= 0 || radioKm > RADIO_MAX_KM) {
                throw BusinessException.invalida("El radio va de 1 a 100 km.", Map.of("radioKm", "Entre 1 y 100."));
            }
            radio = radioKm * 1000;
        } else if (cerca) {
            radio = RADIO_BASE_KM * 1000;
        }
        return new Punto(lat, lng, radio);
    }

    static String texto(String q) {
        if (q == null || q.isBlank()) {
            return null;
        }
        String t = q.trim().replaceAll("\\s+", " ");
        return t.length() > 100 ? t.substring(0, 100) : t;
    }

    static int tamano(Integer t) {
        return t == null ? 20 : Math.max(1, Math.min(TAMANO_MAX, t));
    }

    static int pagina(Integer p) {
        return p == null ? 0 : Math.max(0, p);
    }

    private String url(String clave) {
        return clave == null ? null : almacen.urlPublica(clave);
    }

    private static Integer metros(Double d) {
        return d == null ? null : (int) Math.round(d);
    }

    // ---------------- negocios ----------------

    public record BusquedaNegocios(String q, UUID categoriaId, UUID regionId, UUID municipioId, Integer precioMax,
                                   List<UUID> servicioIds, List<String> idiomasHablados, boolean abiertoAhora,
                                   Double lat, Double lng, Double radioKm, boolean cerca, String orden, Integer pagina,
                                   Integer tamano, List<UUID> categoriaIds) {
    }

    public Pagina<NegocioTarjetaDto> buscarNegocios(BusquedaNegocios b, String idiomaPedido, String dispositivo) {
        String idioma = catalogo.idioma(idiomaPedido);
        Punto p = punto(b.lat(), b.lng(), b.radioKm(), b.cerca());
        String orden = b.orden() == null ? "relevancia" : b.orden();
        if (!ORDENES.contains(orden)) {
            throw BusinessException.invalida("El orden debe ser relevancia, distancia, precio, nombre o calificacion.",
                    Map.of("orden", "Valores: relevancia, distancia, precio, nombre, calificacion."));
        }
        if (orden.equals("distancia") && p.lat() == null) {
            throw BusinessException.invalida("Para ordenar por distancia envía tu ubicación.",
                    Map.of("orden", "Falta lat y lng."));
        }
        if (b.precioMax() != null && (b.precioMax() < 1 || b.precioMax() > 4)) {
            throw BusinessException.invalida("El precio va de 1 a 4.", Map.of("precioMax", "Entre 1 y 4."));
        }
        int tam = tamano(b.tamano());
        int pag = pagina(b.pagina());
        List<String> idiomasHablados = b.idiomasHablados() == null ? null
                : b.idiomasHablados().stream().map(String::trim).filter(s -> !s.isEmpty() && s.length() <= 8).toList();
        FiltroNegocios f = new FiltroNegocios(texto(b.q()), b.categoriaId(), b.regionId(), b.municipioId(), b.precioMax(),
                b.servicioIds(), idiomasHablados, b.abiertoAhora(), null, p.lat(), p.lng(), p.radioM(), orden, tam,
                pag * tam, b.categoriaIds());
        long total = repo.contarNegocios(f, idioma);
        List<NegocioTarjetaDto> filas = tarjetas(repo.negocios(f, idioma), idioma);

        Map<String, Object> filtros = new LinkedHashMap<>();
        put(filtros, "categoriaId", b.categoriaId());
        put(filtros, "regionId", b.regionId());
        put(filtros, "municipioId", b.municipioId());
        put(filtros, "precioMax", b.precioMax());
        put(filtros, "servicios", b.servicioIds() == null || b.servicioIds().isEmpty() ? null : b.servicioIds());
        put(filtros, "idiomas", idiomasHablados == null || idiomasHablados.isEmpty() ? null : idiomasHablados);
        put(filtros, "abiertoAhora", b.abiertoAhora() ? true : null);
        put(filtros, "radioKm", p.radioM() == null ? null : p.radioM() / 1000);
        put(filtros, "orden", orden);
        if (pag == 0) {
            busquedaLog.registrar(dispositivo, f.q(), filtros, total, p.lat(), p.lng());
        }
        return new Pagina<>(filas, total, pag, tam);
    }

    private static void put(Map<String, Object> m, String k, Object v) {
        if (v != null) {
            m.put(k, v);
        }
    }

    /** Para favoritos: las tarjetas de estos negocios, si siguen publicados. */
    public List<NegocioTarjetaDto> tarjetasNegocios(List<UUID> ids, String idiomaPedido) {
        if (ids.isEmpty()) {
            return List.of();
        }
        String idioma = catalogo.idioma(idiomaPedido);
        FiltroNegocios f = new FiltroNegocios(null, null, null, null, null, null, null, false, ids, null, null, null,
                "nombre", ids.size(), 0, null);
        return tarjetas(repo.negocios(f, idioma), idioma);
    }

    private NegocioTarjetaDto tarjeta(TarjetaFila t, List<ServicioPublicoDto> servicios) {
        return new NegocioTarjetaDto(t.id(), t.slug(), t.nombre(), t.categoriaClave(), t.categoriaNombre(),
                t.descripcionCorta(), t.municipioNombre(), t.regionNombre(), t.rangoPrecio(), t.precioDesde(),
                t.unidadPrecio(), t.moneda(), t.latitud(), t.longitud(), metros(t.distanciaM()), t.abiertoAhora(),
                url(t.portadaClave()), t.verificado(), t.calificacionPromedio(), t.totalResenas(), servicios);
    }

    /** Arma las tarjetas de una página con sus etiquetas de servicios, pidiéndolas todas juntas. */
    private List<NegocioTarjetaDto> tarjetas(List<TarjetaFila> filas, String idioma) {
        Map<UUID, List<ServicioPublicoDto>> porNegocio = new HashMap<>();
        for (var s : repo.serviciosDeTarjetas(filas.stream().map(TarjetaFila::id).toList(), idioma)) {
            porNegocio.computeIfAbsent(s.negocioId(), k -> new ArrayList<>())
                    .add(new ServicioPublicoDto(s.clave(), s.nombre(), s.icono()));
        }
        return filas.stream().map(t -> tarjeta(t, porNegocio.getOrDefault(t.id(), List.of()))).toList();
    }

    /** Las regiones con sus conteos, para la sección "Las ocho regiones" de la web. */
    public List<RegionConteoDto> regiones(String destino) {
        return repo.regiones(destinoOBase(destino), LocalDate.now(MEXICO)).stream()
                .map(r -> new RegionConteoDto(r.id(), r.slug(), r.nombre(), r.totalNegocios(), r.totalLugares(),
                        r.totalEventos(), url(r.portadaClave()))).toList();
    }

    public List<PuntoMapaDto> puntosMapa(Double norte, Double sur, Double este, Double oeste, UUID categoriaId) {
        if (norte == null || sur == null || este == null || oeste == null) {
            throw BusinessException.invalida("Indica norte, sur, este y oeste.", Map.of("norte", "Faltan límites del mapa."));
        }
        if (norte <= sur || este <= oeste || norte > 90 || sur < -90 || este > 180 || oeste < -180) {
            throw BusinessException.invalida("Los límites del mapa no son válidos.", Map.of("norte", "Revisa los límites."));
        }
        return repo.puntosMapa(norte, sur, este, oeste, categoriaId, PUNTOS_MAX);
    }

    public NegocioPublicoDto negocio(String slug, String destino, String idiomaPedido) {
        String idioma = catalogo.idioma(idiomaPedido);
        NegocioBaseFila n = repo.negocioPorSlug(slug, destinoOBase(destino), idioma)
                .orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese negocio."));
        TextosFila tx = repo.textosNegocio(n.id(), idioma);
        List<HorarioFila> horarios = repo.horarios(n.id());
        List<ExcepcionFila> excepciones = repo.excepciones(n.id(), n.zonaHoraria());
        List<SucursalPublicaDto> sucursales = repo.sucursales(n.id(), n.zonaHoraria()).stream()
                .map(s -> new SucursalPublicaDto(s.id(), s.nombre(), s.esPrincipal(), s.municipioNombre(),
                        s.regionNombre(), s.direccionTexto(), s.referencia(), s.latitud(), s.longitud(), s.abiertoAhora(),
                        horarios.stream().filter(h -> h.sucursalId().equals(s.id()))
                                .map(h -> new HorarioPublicoDto(h.diaSemana(), h.abre(), h.cierra(), h.cerrado())).toList(),
                        excepciones.stream().filter(e -> e.sucursalId().equals(s.id()))
                                .map(e -> new ExcepcionPublicaDto(e.fecha(), e.abre(), e.cierra(), e.cerrado(), e.nota())).toList()))
                .toList();
        List<ContactoPublicoDto> contactos = repo.contactos(n.id());
        List<FotoPublicaDto> fotos = repo.fotosNegocio(n.id()).stream()
                .map(f -> new FotoPublicaDto(url(f.claveAlmacenamiento()), f.pieTexto(), f.esPortada())).toList();
        List<String> idiomas = repo.idiomasConTexto(n.id());
        SucursalPublicaDto principal = sucursales.stream().filter(SucursalPublicaDto::esPrincipal).findFirst().orElse(null);
        Map<String, Object> atrs = atributos(n.atributos());

        var calificacion = repo.calificacionNegocio(n.id());
        Map<String, Object> ld = new LinkedHashMap<>();
        ld.put("@context", "https://schema.org");
        ld.put("@type", tipoSchema(n.raizClave()));
        ld.put("name", n.nombre());
        if (calificacion.promedio() != null) {
            ld.put("aggregateRating", Map.of("@type", "AggregateRating", "ratingValue", calificacion.promedio(),
                    "reviewCount", calificacion.total()));
        }
        if (tx.descripcionCorta() != null) {
            ld.put("description", tx.descripcionCorta());
        }
        if (!fotos.isEmpty()) {
            ld.put("image", fotos.stream().map(FotoPublicaDto::url).toList());
        }
        contactos.stream().filter(c -> c.tipo().equals("telefono") || c.tipo().equals("whatsapp")).findFirst()
                .ifPresent(c -> ld.put("telephone", c.valor()));
        if (n.rangoPrecio() != null) {
            ld.put("priceRange", "$".repeat(Math.max(1, Math.min(4, n.rangoPrecio()))));
        }
        if (atrs.get("tipoCocina") instanceof List<?> cocinas && !cocinas.isEmpty()) {
            ld.put("servesCuisine", cocinas);
        }
        if (atrs.get("menuUrl") instanceof String menu) {
            ld.put("menu", menu);
        }
        if (principal != null) {
            Map<String, Object> dir = new LinkedHashMap<>();
            dir.put("@type", "PostalAddress");
            dir.put("addressLocality", principal.municipioNombre());
            dir.put("addressRegion", "Oaxaca");
            dir.put("addressCountry", "MX");
            if (principal.direccion() != null) {
                dir.put("streetAddress", principal.direccion());
            }
            ld.put("address", dir);
            List<Map<String, Object>> horas = new ArrayList<>();
            for (HorarioPublicoDto h : principal.horarios()) {
                if (!h.cerrado() && h.abre() != null && h.cierra() != null) {
                    horas.add(Map.of("@type", "OpeningHoursSpecification", "dayOfWeek", DIAS_SCHEMA[h.diaSemana()],
                            "opens", h.abre(), "closes", h.cierra()));
                }
            }
            if (!horas.isEmpty()) {
                ld.put("openingHoursSpecification", horas);
            }
            if (principal.latitud() != null) {
                ld.put("geo", Map.of("@type", "GeoCoordinates", "latitude", principal.latitud(),
                        "longitude", principal.longitud()));
            }
        }
        SeoDto seo = new SeoDto(n.nombre() + (principal == null ? "" : " en " + principal.municipioNombre()) + ", Oaxaca",
                tx.descripcionCorta(), "/negocios/" + n.slug(), idiomas, ld);
        List<OfertaPublicaDto> ofertas = repo.ofertasPublicas(n.id(), idioma).stream()
                .map(o -> new OfertaPublicaDto(o.id(), o.tipo(), o.nombre(), o.descripcion(), o.incluye(), o.noIncluye(),
                        o.precioDesde(), o.unidadPrecio(), o.moneda(), o.duracionMin(), o.capacidad(), o.seccion(),
                        o.etiquetas() == null || o.etiquetas().isBlank() ? List.of() : List.of(o.etiquetas().split(","))))
                .toList();
        PosicionDto posicion = repo.posicion(n.id())
                .map(ps -> new PosicionDto(ps.posicion(), ps.total(), ps.municipioNombre())).orElse(null);
        return new NegocioPublicoDto(n.id(), n.slug(), n.nombre(), n.categoriaClave(), n.categoriaNombre(),
                n.rangoPrecio(), n.precioDesde(), n.unidadPrecio(), n.moneda(), tx.descripcionCorta(),
                tx.descripcion(), tx.politicas(), atrs, n.verificado(), sucursales, contactos,
                repo.servicios(n.id(), idioma), repo.idiomasHablados(n.id()), fotos, n.actualizadoEn(), seo,
                calificacion.promedio(), calificacion.total(), promocionesVigentes(n.id(), idioma),
                patrocinios.patrocinadoHoy(n.id(), PlanServicio.hoy()), n.raizClave(), ofertas, posicion);
    }

    /** Solo las aprobadas y dentro de fechas; el texto sale en el idioma pedido o, si falta, en español. */
    private List<PromocionPublicaDto> promocionesVigentes(UUID negocioId, String idioma) {
        return promociones.vigentes(negocioId, idioma, PlanServicio.hoy()).stream()
                .map(p -> new PromocionPublicaDto(p.id(), p.tipo(), p.valor(), p.codigo(), p.inicio(), p.fin(),
                        p.titulo(), p.descripcion(), p.condiciones(), p.ofertaId())).toList();
    }

    private static String tipoSchema(String raiz) {
        return switch (raiz == null ? "" : raiz) {
            case "hospedaje" -> "LodgingBusiness";
            case "comida" -> "Restaurant";
            case "tours" -> "TouristAttraction";
            case "vida_nocturna" -> "BarOrPub";
            case "compras" -> "Store";
            default -> "LocalBusiness";
        };
    }

    private Map<String, Object> atributos(String texto) {
        if (texto == null || texto.isBlank()) {
            return Map.of();
        }
        try {
            return json.readValue(texto, new TypeReference<Map<String, Object>>() {
            });
        } catch (Exception e) {
            return Map.of();
        }
    }

    private static String destinoOBase(String destino) {
        return destino == null || destino.isBlank() ? DESTINO_BASE : destino.trim().toLowerCase();
    }

    // ---------------- lugares ----------------

    public record BusquedaLugares(String q, String tipo, UUID regionId, UUID municipioId, Boolean destacado,
                                  UUID padreId, Double lat, Double lng, Double radioKm, boolean cerca, Integer pagina,
                                  Integer tamano, String entrada) {
    }

    private static final Set<String> TIPOS_LUGAR = Set.of("arqueologico", "natural", "cultural", "playa", "mercado",
            "templo", "otro");

    public Pagina<LugarTarjetaDto> buscarLugares(BusquedaLugares b, String idiomaPedido) {
        String idioma = catalogo.idioma(idiomaPedido);
        if (b.tipo() != null && !TIPOS_LUGAR.contains(b.tipo())) {
            throw BusinessException.invalida("Tipo de lugar no válido.", Map.of("tipo", "Valores: " + String.join(", ", TIPOS_LUGAR)));
        }
        if (b.entrada() != null && !Set.of("gratis", "con_costo").contains(b.entrada())) {
            throw BusinessException.invalida("La entrada debe ser gratis o con_costo.", Map.of("entrada", "Valores: gratis, con_costo."));
        }
        Punto p = punto(b.lat(), b.lng(), b.radioKm(), b.cerca());
        int tam = tamano(b.tamano());
        int pag = pagina(b.pagina());
        FiltroLugares f = new FiltroLugares(texto(b.q()), b.tipo(), b.regionId(), b.municipioId(), b.destacado(),
                b.padreId(), p.lat(), p.lng(), p.radioM(), tam, pag * tam, b.entrada());
        return new Pagina<>(repo.lugares(f, idioma).stream().map(this::tarjetaLugar).toList(),
                repo.contarLugares(f, idioma), pag, tam);
    }

    private LugarTarjetaDto tarjetaLugar(LugarTarjetaFila l) {
        return new LugarTarjetaDto(l.id(), l.slug(), l.nombre(), l.tipo(), l.resumen(), l.municipioNombre(),
                l.regionNombre(), l.latitud(), l.longitud(), metros(l.distanciaM()), l.destacado(), url(l.portadaClave()),
                atributos(l.datos()));
    }

    public LugarPublicoDto lugar(String slug, String destino, String idiomaPedido) {
        String idioma = catalogo.idioma(idiomaPedido);
        LugarBaseFila l = repo.lugarPorSlug(slug, destinoOBase(destino), idioma)
                .orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese lugar."));
        List<FotoPublicaDto> fotos = repo.fotosLugar(l.id()).stream()
                .map(f -> new FotoPublicaDto(url(f.claveAlmacenamiento()), null, f.esPortada())).toList();
        List<LugarTarjetaDto> atractivos = repo.lugares(
                new FiltroLugares(null, null, null, null, null, l.id(), null, null, null, 20, 0, null), idioma)
                .stream().map(this::tarjetaLugar).toList();
        List<NegocioTarjetaDto> cercanos = List.of();
        if (l.latitud() != null) {
            FiltroNegocios f = new FiltroNegocios(null, null, null, null, null, null, null, false, null, l.latitud(),
                    l.longitud(), 10_000d, "distancia", 10, 0, null);
            cercanos = tarjetas(repo.negocios(f, idioma), idioma);
        }
        Map<String, Object> ld = new LinkedHashMap<>();
        ld.put("@context", "https://schema.org");
        ld.put("@type", "TouristAttraction");
        ld.put("name", l.nombre());
        if (l.resumen() != null) {
            ld.put("description", l.resumen());
        }
        if (!fotos.isEmpty()) {
            ld.put("image", fotos.stream().map(FotoPublicaDto::url).toList());
        }
        if (l.latitud() != null) {
            ld.put("geo", Map.of("@type", "GeoCoordinates", "latitude", l.latitud(), "longitude", l.longitud()));
        }
        ld.put("address", Map.of("@type", "PostalAddress", "addressRegion", "Oaxaca", "addressCountry", "MX"));
        Map<String, Object> datos = atributos(l.datos());
        if ("gratis".equals(datos.get("entrada"))) {
            ld.put("isAccessibleForFree", true);
        } else if ("con_costo".equals(datos.get("entrada"))) {
            ld.put("isAccessibleForFree", false);
        }
        SeoDto seo = new SeoDto(l.nombre() + ", Oaxaca", l.resumen(), "/lugares/" + l.slug(),
                repo.idiomasLugar(l.id()), ld);
        return new LugarPublicoDto(l.id(), l.slug(), l.nombre(), l.tipo(), l.resumen(), l.historia(), l.recomendaciones(),
                l.municipioNombre(), l.regionNombre(), l.latitud(), l.longitud(), l.destacado(), fotos, atractivos,
                cercanos, l.actualizadoEn(), seo, l.mejorEpoca(), l.comoLlegar(), datos);
    }

    // ---------------- rutas ----------------

    private static final Set<String> DIFICULTADES = Set.of("facil", "moderada", "dificil");

    public Pagina<RutaTarjetaDto> buscarRutas(String q, String dificultad, String transporte, Integer pagina,
                                              Integer tamano, String idiomaPedido) {
        String idioma = catalogo.idioma(idiomaPedido);
        if (dificultad != null && !DIFICULTADES.contains(dificultad)) {
            throw BusinessException.invalida("La dificultad debe ser facil, moderada o dificil.",
                    Map.of("dificultad", "Valores: facil, moderada, dificil."));
        }
        int tam = tamano(tamano);
        int pag = pagina(pagina);
        FiltroRutas f = new FiltroRutas(texto(q), dificultad, transporte == null || transporte.isBlank() ? null : transporte.trim(),
                tam, pag * tam);
        List<RutaTarjetaDto> filas = repo.rutas(f, idioma).stream()
                .map(r -> new RutaTarjetaDto(r.id(), r.slug(), r.nombre(), r.descripcion(), r.duracionHoras(),
                        r.distanciaKm(), r.dificultad(), r.transporte(), r.esPremium())).toList();
        return new Pagina<>(filas, repo.contarRutas(f, idioma), pag, tam);
    }

    public RutaPublicaDto ruta(String slug, String destino, String idiomaPedido) {
        String idioma = catalogo.idioma(idiomaPedido);
        RutaFila r = repo.rutaPorSlug(slug, destinoOBase(destino), idioma)
                .orElseThrow(() -> BusinessException.noEncontrado("No encontramos esa ruta."));
        List<ParadaDto> paradas = repo.paradas(r.id(), idioma);
        Map<String, Object> ld = new LinkedHashMap<>();
        ld.put("@context", "https://schema.org");
        ld.put("@type", "TouristTrip");
        ld.put("name", r.nombre());
        if (r.descripcion() != null) {
            ld.put("description", r.descripcion());
        }
        List<Map<String, Object>> items = new ArrayList<>();
        for (ParadaDto p : paradas) {
            Map<String, Object> it = new LinkedHashMap<>();
            it.put("@type", "TouristAttraction");
            it.put("name", p.nombre() == null ? "Punto " + p.orden() : p.nombre());
            if (p.latitud() != null) {
                it.put("geo", Map.of("@type", "GeoCoordinates", "latitude", p.latitud(), "longitude", p.longitud()));
            }
            items.add(it);
        }
        if (!items.isEmpty()) {
            ld.put("itinerary", items);
        }
        SeoDto seo = new SeoDto(r.nombre() + ", ruta en Oaxaca", r.descripcion(), "/rutas/" + r.slug(),
                repo.idiomasRuta(r.id()), ld);
        return new RutaPublicaDto(r.id(), r.slug(), r.nombre(), r.descripcion(), r.duracionHoras(), r.distanciaKm(),
                r.dificultad(), r.transporte(), r.esPremium(), paradas, r.actualizadoEn(), seo);
    }

    // ---------------- eventos ----------------

    public Pagina<EventoTarjetaDto> buscarEventos(String q, LocalDate desde, LocalDate hasta, UUID regionId,
                                                  UUID municipioId, Integer pagina, Integer tamano, String idiomaPedido,
                                                  Boolean gratis) {
        String idioma = catalogo.idioma(idiomaPedido);
        LocalDate d = desde != null ? desde : LocalDate.now(MEXICO);
        if (hasta != null && hasta.isBefore(d)) {
            throw BusinessException.invalida("La fecha final no puede ser anterior a la inicial.",
                    Map.of("hasta", "Debe ser igual o posterior a desde."));
        }
        int tam = tamano(tamano);
        int pag = pagina(pagina);
        FiltroEventos f = new FiltroEventos(texto(q), d, hasta, regionId, municipioId, tam, pag * tam, gratis);
        return new Pagina<>(repo.eventos(f, idioma).stream().map(this::tarjetaEvento).toList(),
                repo.contarEventos(f, idioma), pag, tam);
    }

    private EventoTarjetaDto tarjetaEvento(EventoFila e) {
        return new EventoTarjetaDto(e.id(), e.slug(), e.nombre(), e.descripcion(), e.fechaInicio(), e.fechaFin(),
                e.municipioNombre(), e.regionNombre(), e.latitud(), e.longitud(), e.temporadaNombre(),
                atributos(e.datos()));
    }

    public EventoPublicoDto evento(String slug, String destino, String idiomaPedido) {
        String idioma = catalogo.idioma(idiomaPedido);
        EventoFila e = repo.eventoPorSlug(slug, destinoOBase(destino), idioma)
                .orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese evento."));
        List<UUID> ids = repo.negociosDeEvento(e.id());
        List<NegocioTarjetaDto> negocios = tarjetasNegocios(ids, idioma);
        Map<String, Object> ld = new LinkedHashMap<>();
        ld.put("@context", "https://schema.org");
        ld.put("@type", "Event");
        ld.put("name", e.nombre());
        if (e.descripcion() != null) {
            ld.put("description", e.descripcion());
        }
        Map<String, Object> datos = atributos(e.datos());
        Object horaInicio = datos.get("horaInicio");
        Object horaFin = datos.get("horaFin");
        ld.put("startDate", e.fechaInicio() + (horaInicio == null ? "" : "T" + horaInicio + ":00"));
        ld.put("endDate", e.fechaFin() + (horaFin == null ? "" : "T" + horaFin + ":00"));
        if (Boolean.TRUE.equals(datos.get("gratis"))) {
            ld.put("isAccessibleForFree", true);
        }
        Map<String, Object> lugar = new LinkedHashMap<>();
        lugar.put("@type", "Place");
        Object sede = datos.get("sede");
        lugar.put("name", sede != null ? sede : e.municipioNombre() == null ? "Oaxaca" : e.municipioNombre());
        lugar.put("address", Map.of("@type", "PostalAddress", "addressRegion", "Oaxaca", "addressCountry", "MX"));
        ld.put("location", lugar);
        SeoDto seo = new SeoDto(e.nombre() + ", Oaxaca", e.descripcion(), "/eventos/" + e.slug(),
                repo.idiomasEvento(e.id()), ld);
        return new EventoPublicoDto(e.id(), e.slug(), e.nombre(), e.descripcion(), e.fechaInicio(), e.fechaFin(),
                e.municipioNombre(), e.regionNombre(), e.latitud(), e.longitud(), e.temporadaNombre(), negocios,
                e.actualizadoEn(), seo, datos);
    }

    // ---------------- conteos y búsqueda general ----------------

    /** Los números de los chips: cuántos negocios por categoría, lugares por tipo y eventos que aún no terminan. */
    public FacetasDto facetas(String q, UUID regionId, UUID municipioId, String idiomaPedido) {
        String idioma = catalogo.idioma(idiomaPedido);
        String t = texto(q);
        FiltroNegocios fn = new FiltroNegocios(t, null, regionId, municipioId, null, null, null, false, null, null, null,
                null, "nombre", 1, 0, null);
        FiltroLugares fl = new FiltroLugares(t, null, regionId, municipioId, null, null, null, null, null, 1, 0, null);
        FiltroEventos fe = new FiltroEventos(t, LocalDate.now(MEXICO), null, regionId, municipioId, 1, 0, null);
        return new FacetasDto(
                repo.facetasNegocios(fn, idioma).stream()
                        .map(f -> new FacetaDto(f.categoriaId(), f.clave(), f.nombre(), f.padreClave(), f.total())).toList(),
                repo.facetasLugares(fl, idioma).stream().map(f -> new FacetaLugarDto(f.tipo(), f.total())).toList(),
                repo.contarEventos(fe, idioma));
    }

    /**
     * Lo primero de negocios, lugares y eventos para el buscador de la web. No se registra en el historial de
     * búsquedas: llega mientras la persona escribe y solo cuenta la búsqueda que ella envía.
     */
    public BusquedaGlobalDto buscarGlobal(String q, String idiomaPedido, Integer tamano) {
        String t = texto(q);
        if (t == null || t.length() < 2) {
            throw BusinessException.invalida("Escribe al menos 2 letras para buscar.", Map.of("q", "Mínimo 2 letras."));
        }
        String idioma = catalogo.idioma(idiomaPedido);
        int tam = tamano == null ? 5 : Math.min(tamano(tamano), 10);
        FiltroNegocios fn = new FiltroNegocios(t, null, null, null, null, null, null, false, null, null, null, null,
                "relevancia", tam, 0, null);
        FiltroLugares fl = new FiltroLugares(t, null, null, null, null, null, null, null, null, tam, 0, null);
        FiltroEventos fe = new FiltroEventos(t, LocalDate.now(MEXICO), null, null, null, tam, 0, null);
        return new BusquedaGlobalDto(t,
                new Pagina<>(tarjetas(repo.negocios(fn, idioma), idioma), repo.contarNegocios(fn, idioma), 0, tam),
                new Pagina<>(repo.lugares(fl, idioma).stream().map(this::tarjetaLugar).toList(), repo.contarLugares(fl, idioma), 0, tam),
                new Pagina<>(repo.eventos(fe, idioma).stream().map(this::tarjetaEvento).toList(), repo.contarEventos(fe, idioma), 0, tam));
    }

    // ---------------- mapa del sitio ----------------

    public SitemapDto sitemap(String destino) {
        String d = destinoOBase(destino);
        return new SitemapDto(d, items(repo.sitemapNegocios(d)), items(repo.sitemapLugares(d)),
                items(repo.sitemapRutas(d)), items(repo.sitemapEventos(d, LocalDate.now(MEXICO))));
    }

    private static List<SitemapItemDto> items(List<SitemapFila> filas) {
        return filas.stream().map(s -> new SitemapItemDto(s.slug(), s.actualizadoEn(),
                s.idiomas() == null || s.idiomas().isBlank() ? List.of() : List.of(s.idiomas().split(",")))).toList();
    }
}
