package mx.com.traveloaxaca.comunidad.servicio;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import mx.com.traveloaxaca.comun.error.BusinessException;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.ListaDetalleDto;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.ListaDto;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.ListaEntradaDto;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.ListaItemDto;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.ListaItemEdicionDto;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.ListaItemEntradaDto;
import mx.com.traveloaxaca.comunidad.repo.ListaRepositorio;
import mx.com.traveloaxaca.comunidad.repo.ListaRepositorio.ListaFila;
import mx.com.traveloaxaca.explorar.repo.FavoritoRepositorio;
import mx.com.traveloaxaca.negocios.almacen.AlmacenMedios;
import mx.com.traveloaxaca.negocios.servicio.CatalogoServicio;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Listas de lugares y itinerarios por día. Privadas por defecto; públicas se leen con su identificador. */
@Service
public class ListaServicio {

    private static final Set<String> TIPOS = Set.of("negocio", "lugar", "ruta");

    private final ListaRepositorio repo;
    private final FavoritoRepositorio publicados;
    private final CatalogoServicio catalogo;
    private final AlmacenMedios almacen;
    private final ComunidadConfig cfg;

    public ListaServicio(ListaRepositorio repo, FavoritoRepositorio publicados, CatalogoServicio catalogo,
                         AlmacenMedios almacen, ComunidadConfig cfg) {
        this.repo = repo;
        this.publicados = publicados;
        this.catalogo = catalogo;
        this.almacen = almacen;
        this.cfg = cfg;
    }

    @Transactional(readOnly = true)
    public List<ListaDto> mias(UUID usuarioId) {
        return repo.deUsuario(usuarioId).stream().map(ListaServicio::aDto).toList();
    }

    @Transactional(readOnly = true)
    public ListaDetalleDto detalle(UUID usuarioId, UUID listaId, String idioma) {
        ListaFila l = repo.porId(listaId).filter(x -> usuarioId.equals(x.usuarioId()))
                .orElseThrow(() -> BusinessException.noEncontrado("No encontramos esa lista."));
        return aDetalle(l, idioma);
    }

    @Transactional(readOnly = true)
    public ListaDetalleDto publica(UUID listaId, String idioma) {
        ListaFila l = repo.porId(listaId).filter(ListaFila::publica)
                .orElseThrow(() -> BusinessException.noEncontrado("No encontramos esa lista."));
        return aDetalle(l, idioma);
    }

    @Transactional
    public ListaDto crear(UUID usuarioId, ListaEntradaDto dto) {
        if (repo.contarDeUsuario(usuarioId) >= cfg.entero("listas_max_por_usuario", 20)) {
            throw BusinessException.invalida("Llegaste al máximo de listas. Borra alguna para crear otra.");
        }
        boolean itinerario = Boolean.TRUE.equals(dto.esItinerario());
        validar(dto, itinerario);
        UUID id = repo.crear(usuarioId, dto.nombre().trim(), itinerario, dto.fechaInicio(), dto.fechaFin(),
                Boolean.TRUE.equals(dto.publica()));
        return aDto(repo.porId(id).orElseThrow());
    }

    @Transactional
    public ListaDto actualizar(UUID usuarioId, UUID listaId, ListaEntradaDto dto) {
        repo.bloquear(listaId, usuarioId).orElseThrow(() -> BusinessException.noEncontrado("No encontramos esa lista."));
        boolean itinerario = Boolean.TRUE.equals(dto.esItinerario());
        validar(dto, itinerario);
        repo.actualizar(listaId, dto.nombre().trim(), itinerario, dto.fechaInicio(), dto.fechaFin(),
                Boolean.TRUE.equals(dto.publica()));
        return aDto(repo.porId(listaId).orElseThrow());
    }

    @Transactional
    public void borrar(UUID usuarioId, UUID listaId) {
        repo.bloquear(listaId, usuarioId).orElseThrow(() -> BusinessException.noEncontrado("No encontramos esa lista."));
        repo.eliminar(listaId);
    }

    @Transactional
    public ListaDetalleDto agregar(UUID usuarioId, UUID listaId, ListaItemEntradaDto dto, String idioma) {
        repo.bloquear(listaId, usuarioId).orElseThrow(() -> BusinessException.noEncontrado("No encontramos esa lista."));
        ListaFila lista = repo.porId(listaId).orElseThrow();
        if (!TIPOS.contains(dto.tipo())) {
            throw BusinessException.invalida("El tipo debe ser negocio, lugar o ruta.",
                    Map.of("tipo", "Valores: negocio, lugar, ruta."));
        }
        if (dto.dia() != null && !lista.esItinerario()) {
            throw BusinessException.invalida("Solo los itinerarios llevan día.", Map.of("dia", "Solo los itinerarios llevan día."));
        }
        if (!publicados.visible(dto.tipo(), dto.id())) {
            throw BusinessException.noEncontrado("No encontramos ese elemento.");
        }
        if (repo.contarItems(listaId) >= cfg.entero("items_max_por_lista", 50)) {
            throw BusinessException.invalida("La lista llegó al máximo de elementos.");
        }
        if (repo.yaEsta(listaId, dto.tipo(), dto.id(), dto.dia())) {
            throw BusinessException.conflicto("Ese elemento ya está en la lista.");
        }
        int orden = dto.orden() != null ? Math.max(0, dto.orden()) : repo.siguienteOrden(listaId, dto.dia());
        repo.agregarItem(listaId, dto.tipo(), dto.id(), dto.dia(), orden, limpiar(dto.nota()));
        repo.tocar(listaId);
        return aDetalle(repo.porId(listaId).orElseThrow(), idioma);
    }

    @Transactional
    public ListaDetalleDto editarItem(UUID usuarioId, UUID listaId, UUID itemId, ListaItemEdicionDto dto, String idioma) {
        repo.bloquear(listaId, usuarioId).orElseThrow(() -> BusinessException.noEncontrado("No encontramos esa lista."));
        ListaFila lista = repo.porId(listaId).orElseThrow();
        if (dto.dia() != null && !lista.esItinerario()) {
            throw BusinessException.invalida("Solo los itinerarios llevan día.", Map.of("dia", "Solo los itinerarios llevan día."));
        }
        if (!repo.actualizarItem(listaId, itemId, dto.dia(), dto.orden() == null ? null : Math.max(0, dto.orden()),
                limpiar(dto.nota()))) {
            throw BusinessException.noEncontrado("No encontramos ese elemento en tu lista.");
        }
        repo.tocar(listaId);
        return aDetalle(repo.porId(listaId).orElseThrow(), idioma);
    }

    @Transactional
    public void quitarItem(UUID usuarioId, UUID listaId, UUID itemId) {
        repo.bloquear(listaId, usuarioId).orElseThrow(() -> BusinessException.noEncontrado("No encontramos esa lista."));
        if (!repo.quitarItem(listaId, itemId)) {
            throw BusinessException.noEncontrado("No encontramos ese elemento en tu lista.");
        }
        repo.tocar(listaId);
    }

    // ---------------- apoyo ----------------

    private static void validar(ListaEntradaDto dto, boolean itinerario) {
        if (dto.nombre() == null || dto.nombre().isBlank()) {
            throw BusinessException.invalida("Ponle nombre a tu lista.", Map.of("nombre", "Ponle nombre a tu lista."));
        }
        LocalDate ini = dto.fechaInicio();
        LocalDate fin = dto.fechaFin();
        if (!itinerario && (ini != null || fin != null)) {
            throw BusinessException.invalida("Solo los itinerarios llevan fechas.",
                    Map.of("fechaInicio", "Solo los itinerarios llevan fechas."));
        }
        if (ini != null && fin != null && fin.isBefore(ini)) {
            throw BusinessException.invalida("La fecha final no puede ser anterior a la inicial.",
                    Map.of("fechaFin", "La fecha final no puede ser anterior a la inicial."));
        }
    }

    private ListaDetalleDto aDetalle(ListaFila l, String idioma) {
        String i = catalogo.idioma(idioma);
        List<ListaItemDto> items = repo.items(l.id(), i).stream()
                .map(x -> new ListaItemDto(x.itemId(), x.tipo(), x.id(), x.slug(), x.nombre(), x.dia(), x.orden(),
                        x.nota(), x.imagenClave() == null ? null : almacen.urlPublica(x.imagenClave())))
                .toList();
        return new ListaDetalleDto(l.id(), l.nombre(), l.esItinerario(), l.fechaInicio(), l.fechaFin(), l.publica(),
                Nombres.corto(l.autorNombre()), items);
    }

    private static ListaDto aDto(ListaFila l) {
        return new ListaDto(l.id(), l.nombre(), l.esItinerario(), l.fechaInicio(), l.fechaFin(), l.publica(),
                l.totalElementos(), l.creadoEn());
    }

    private static String limpiar(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
