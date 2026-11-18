package mx.com.traveloaxaca.negocios.servicio;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import mx.com.traveloaxaca.comercial.servicio.PlanServicio;
import mx.com.traveloaxaca.comun.error.BusinessException;
import mx.com.traveloaxaca.negocios.dto.NegocioDtos.*;
import mx.com.traveloaxaca.negocios.repo.CatalogoRepositorio;
import mx.com.traveloaxaca.negocios.repo.NegocioRepositorio;
import mx.com.traveloaxaca.negocios.repo.OfertaRepositorio;
import mx.com.traveloaxaca.negocios.repo.OfertaRepositorio.TraduccionFila;
import mx.com.traveloaxaca.negocios.servicio.AccesoNegocio.Contexto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Habitaciones, tours, platillos y productos de un negocio. Se aplican sin revisión. */
@Service
public class OfertaServicio {

    private static final int MAX_OFERTAS = 100;
    /** Qué raíces de categoría admiten cada tipo de opción. */
    private static final Map<String, Set<String>> RAICES_POR_TIPO = Map.of(
            "habitacion", Set.of("hospedaje"),
            "tour", Set.of("tours"),
            "experiencia", Set.of("tours"),
            "platillo", Set.of("comida", "vida_nocturna"),
            "producto", Set.of("compras"));

    private final OfertaRepositorio ofertas;
    private final NegocioRepositorio negocios;
    private final CatalogoRepositorio catalogo;
    private final AccesoNegocio acceso;
    private final FichaServicio fichas;
    private final PlanServicio planes;

    public OfertaServicio(OfertaRepositorio ofertas, NegocioRepositorio negocios, CatalogoRepositorio catalogo,
                          AccesoNegocio acceso, FichaServicio fichas, PlanServicio planes) {
        this.planes = planes;
        this.ofertas = ofertas;
        this.negocios = negocios;
        this.catalogo = catalogo;
        this.acceso = acceso;
        this.fichas = fichas;
    }

    @Transactional(readOnly = true)
    public List<OfertaDto> listar(Actor actor, UUID negocioId) {
        acceso.leer(actor, negocioId);
        return fichas.ofertas(negocioId);
    }

    @Transactional
    public OfertaDto crear(Actor actor, UUID negocioId, OfertaEntradaDto dto) {
        Contexto ctx = acceso.editar(actor, negocioId);
        validar(ctx, dto);
        planes.exigirCupoOfertas(negocioId);
        if (ofertas.contar(negocioId) >= MAX_OFERTAS) {
            throw BusinessException.conflicto("Llegaste al máximo de " + MAX_OFERTAS + " opciones.");
        }
        UUID id = ofertas.crear(negocioId, dto.tipo(), dto.precioDesde(), dto.unidadPrecio(), dto.duracionMin(),
                dto.capacidad(), dto.orden() == null ? 0 : dto.orden(), dto.seccion(), etiquetas(dto));
        ofertas.reemplazarTraducciones(id, traducciones(dto));
        fichas.terminar(ctx, true, false);
        return uno(negocioId, id);
    }

    @Transactional
    public OfertaDto actualizar(Actor actor, UUID negocioId, UUID ofertaId, OfertaEntradaDto dto) {
        Contexto ctx = acceso.editar(actor, negocioId);
        existente(negocioId, ofertaId);
        validar(ctx, dto);
        ofertas.actualizar(ofertaId, dto.tipo(), dto.precioDesde(), dto.unidadPrecio(), dto.duracionMin(),
                dto.capacidad(), dto.orden() == null ? 0 : dto.orden(), dto.seccion(), etiquetas(dto));
        ofertas.reemplazarTraducciones(ofertaId, traducciones(dto));
        fichas.terminar(ctx, true, false);
        return uno(negocioId, ofertaId);
    }

    @Transactional
    public OfertaDto cambiarEstado(Actor actor, UUID negocioId, UUID ofertaId, EstadoOfertaDto dto) {
        Contexto ctx = acceso.editar(actor, negocioId);
        existente(negocioId, ofertaId);
        ofertas.cambiarEstado(ofertaId, dto.estado());
        fichas.terminar(ctx, true, false);
        return uno(negocioId, ofertaId);
    }

    @Transactional
    public void eliminar(Actor actor, UUID negocioId, UUID ofertaId) {
        Contexto ctx = acceso.editar(actor, negocioId);
        existente(negocioId, ofertaId);
        ofertas.eliminar(ofertaId);
        fichas.terminar(ctx, true, false);
    }

    // ---------------- apoyo ----------------

    private void existente(UUID negocioId, UUID ofertaId) {
        ofertas.porId(negocioId, ofertaId).orElseThrow(() -> BusinessException.noEncontrado("No encontramos esa opción."));
    }

    private OfertaDto uno(UUID negocioId, UUID id) {
        return fichas.ofertas(negocioId).stream().filter(o -> o.id().equals(id)).findFirst().orElseThrow();
    }

    private void validar(Contexto ctx, OfertaEntradaDto dto) {
        String raiz = negocios.claveRaiz(ctx.negocio().categoriaId()).orElse("");
        if (!RAICES_POR_TIPO.getOrDefault(dto.tipo(), Set.of()).contains(raiz)) {
            String m = "Un negocio de tipo «" + raiz + "» no puede tener opciones de tipo «" + dto.tipo() + "».";
            throw BusinessException.invalida(m, Map.of("tipo", m));
        }
        boolean esPlatillo = dto.tipo().equals("platillo");
        if (!esPlatillo && dto.seccion() != null) {
            throw BusinessException.invalida("La sección del menú es solo para platillos.", Map.of("seccion", "Solo aplica a platillos."));
        }
        if (!esPlatillo && dto.etiquetas() != null && !dto.etiquetas().isEmpty()) {
            throw BusinessException.invalida("Las marcas son solo para platillos.", Map.of("etiquetas", "Solo aplican a platillos."));
        }
        if (dto.etiquetas() != null) {
            if (dto.etiquetas().stream().distinct().count() > 3
                    || !dto.etiquetas().stream().allMatch(e -> Set.of("vegetariano", "picante", "sin_gluten").contains(e))) {
                throw BusinessException.invalida("Marcas no válidas.", Map.of("etiquetas", "Usa vegetariano, picante o sin_gluten."));
            }
        }
        OfertaTraduccionDto es = dto.traducciones().get("es");
        if (es == null || es.nombre() == null || es.nombre().isBlank()) {
            throw BusinessException.invalida("Escribe el nombre en español.", Map.of("traducciones.es.nombre", "El nombre en español es obligatorio."));
        }
        for (String idioma : dto.traducciones().keySet()) {
            if (!catalogo.idiomaExiste(idioma)) {
                throw BusinessException.invalida("Idioma no válido: " + idioma + ".", Map.of("traducciones." + idioma, "Idioma no válido."));
            }
        }
    }

    /** Sin repetidas y en el orden en que llegaron, separadas por coma para guardarlas como arreglo. */
    private static String etiquetas(OfertaEntradaDto dto) {
        return dto.etiquetas() == null ? "" : String.join(",", dto.etiquetas().stream().distinct().toList());
    }

    private static List<TraduccionFila> traducciones(OfertaEntradaDto dto) {
        List<TraduccionFila> filas = new ArrayList<>();
        dto.traducciones().forEach((idioma, t) -> {
            if (t != null && t.nombre() != null && !t.nombre().isBlank()) {
                filas.add(new TraduccionFila(null, idioma, t.nombre().trim(), Validaciones.limpiar(t.descripcion()),
                        Validaciones.limpiar(t.incluye()), Validaciones.limpiar(t.noIncluye())));
            }
        });
        return filas;
    }
}
