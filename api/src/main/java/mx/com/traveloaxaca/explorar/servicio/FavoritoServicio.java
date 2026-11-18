package mx.com.traveloaxaca.explorar.servicio;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import mx.com.traveloaxaca.comun.error.BusinessException;
import mx.com.traveloaxaca.explorar.dto.ExplorarDtos.FavoritoDto;
import mx.com.traveloaxaca.explorar.repo.FavoritoRepositorio;
import mx.com.traveloaxaca.medicion.servicio.EventoUsoServicio;
import mx.com.traveloaxaca.negocios.almacen.AlmacenMedios;
import mx.com.traveloaxaca.negocios.servicio.CatalogoServicio;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Lo que el usuario con cuenta guarda para después. */
@Service
public class FavoritoServicio {

    private final FavoritoRepositorio repo;
    private final CatalogoServicio catalogo;
    private final AlmacenMedios almacen;
    private final EventoUsoServicio medicion;

    public FavoritoServicio(FavoritoRepositorio repo, CatalogoServicio catalogo, AlmacenMedios almacen,
                            EventoUsoServicio medicion) {
        this.repo = repo;
        this.catalogo = catalogo;
        this.almacen = almacen;
        this.medicion = medicion;
    }

    @Transactional(readOnly = true)
    public List<FavoritoDto> listar(UUID usuarioId, String idiomaPedido) {
        return repo.listar(usuarioId, catalogo.idioma(idiomaPedido)).stream()
                .map(f -> new FavoritoDto(f.tipo(), f.id(), f.slug(), f.nombre(),
                        f.imagenUrl() == null ? null : almacen.urlPublica(f.imagenUrl()), f.creadoEn()))
                .toList();
    }

    @Transactional
    /** dispositivo es opcional: si viene y es un negocio nuevo en favoritos, cuenta como guardado en la medición. */
    public void agregar(UUID usuarioId, String tipo, UUID id, UUID dispositivo) {
        if (!repo.visible(tipo, id)) {
            throw BusinessException.noEncontrado("Ya no encontramos eso para guardarlo.");
        }
        if (repo.contar(usuarioId) >= FavoritoRepositorio.MAXIMO) {
            throw BusinessException.invalida("Llegaste al máximo de " + FavoritoRepositorio.MAXIMO
                    + " favoritos. Quita alguno para guardar otro.", Map.of("id", "Máximo de favoritos alcanzado."));
        }
        if (repo.agregar(usuarioId, tipo, id) && "negocio".equals(tipo)) {
            medicion.registrarGuardado(dispositivo, id);
        }
    }

    @Transactional
    public void quitar(UUID usuarioId, String tipo, UUID id) {
        if (!List.of("negocio", "lugar", "ruta").contains(tipo)) {
            throw BusinessException.invalida("El tipo debe ser negocio, lugar o ruta.", Map.of("tipo", "Valor no válido."));
        }
        repo.quitar(usuarioId, tipo, id);
    }
}
