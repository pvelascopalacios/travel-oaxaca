package mx.com.traveloaxaca.negocios.servicio;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import mx.com.traveloaxaca.comun.error.BusinessException;
import mx.com.traveloaxaca.negocios.dto.NegocioDtos.*;
import mx.com.traveloaxaca.negocios.repo.CatalogoRepositorio;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Catálogos públicos (con idioma y respaldo en español) y su administración. */
@Service
public class CatalogoServicio {

    private final CatalogoRepositorio repo;

    public CatalogoServicio(CatalogoRepositorio repo) {
        this.repo = repo;
    }

    // ---------------- lectura pública ----------------

    /** Idioma pedido si existe y está activo; si no, español. */
    public String idioma(String pedido) {
        if (pedido == null || pedido.isBlank()) {
            return "es";
        }
        String c = pedido.trim().toLowerCase();
        int corte = c.indexOf('-');
        if (corte > 0) {
            c = c.substring(0, corte);
        }
        return (c.length() <= 8 && repo.idiomaExiste(c)) ? c : "es";
    }

    public List<IdiomaDto> idiomas() {
        return repo.idiomas();
    }

    public List<DestinoDto> destinos() {
        return repo.destinos();
    }

    public List<RegionDto> regiones(String destino) {
        return repo.regiones(destino);
    }

    public List<MunicipioDto> municipios(UUID regionId, String texto, Integer limite) {
        int lim = limite == null ? 50 : Math.max(1, Math.min(limite, 300));
        return repo.municipios(regionId, texto, lim);
    }

    public List<LocalidadDto> localidades(UUID municipioId) {
        return repo.localidades(municipioId);
    }

    public List<CategoriaDto> categorias(String idioma) {
        return repo.arbolCategorias(idioma);
    }

    public List<ServicioDto> servicios(String idioma, String grupo) {
        return repo.servicios(idioma, grupo);
    }

    // ---------------- administración ----------------

    @Transactional
    public Map<String, UUID> crearCategoria(CategoriaAdminDto dto) {
        Map<String, String> nombres = nombresValidos(dto.nombres());
        if (dto.padreId() != null && repo.categoriaPorId(dto.padreId()).isEmpty()) {
            throw BusinessException.invalida("La categoría padre no existe.", Map.of("padreId", "La categoría padre no existe."));
        }
        UUID id = repo.crearCategoria(dto.padreId(), dto.clave(), dto.icono(), dto.orden() == null ? 0 : dto.orden(),
                dto.activa() == null || dto.activa());
        nombres.forEach((i, n) -> repo.guardarNombreCategoria(id, i, n));
        return Map.of("id", id);
    }

    @Transactional
    public void actualizarCategoria(UUID id, CategoriaAdminDto dto) {
        Map<String, String> nombres = nombresValidos(dto.nombres());
        if (repo.actualizarCategoria(id, dto.icono(), dto.orden() == null ? 0 : dto.orden(),
                dto.activa() == null || dto.activa()) == 0) {
            throw BusinessException.noEncontrado("No encontramos esa categoría.");
        }
        nombres.forEach((i, n) -> repo.guardarNombreCategoria(id, i, n));
    }

    @Transactional
    public Map<String, UUID> crearServicio(ServicioAdminDto dto) {
        Map<String, String> nombres = nombresValidos(dto.nombres());
        UUID id = repo.crearServicio(dto.clave(), dto.grupo(), dto.icono(), dto.activo() == null || dto.activo());
        nombres.forEach((i, n) -> repo.guardarNombreServicio(id, i, n));
        return Map.of("id", id);
    }

    @Transactional
    public void actualizarServicio(UUID id, ServicioAdminDto dto) {
        Map<String, String> nombres = nombresValidos(dto.nombres());
        if (repo.actualizarServicio(id, dto.grupo(), dto.icono(), dto.activo() == null || dto.activo()) == 0) {
            throw BusinessException.noEncontrado("No encontramos ese servicio.");
        }
        nombres.forEach((i, n) -> repo.guardarNombreServicio(id, i, n));
    }

    @Transactional
    public Map<String, UUID> crearMunicipio(MunicipioAdminDto dto) {
        regionValida(dto.regionId());
        Validaciones.ubicacion(dto.latitud(), dto.longitud());
        return Map.of("id", repo.crearMunicipio(dto.regionId(), dto.claveInegi(), dto.nombre().trim(), dto.latitud(),
                dto.longitud(), dto.activo() == null || dto.activo()));
    }

    @Transactional
    public void actualizarMunicipio(UUID id, MunicipioAdminDto dto) {
        regionValida(dto.regionId());
        Validaciones.ubicacion(dto.latitud(), dto.longitud());
        if (repo.actualizarMunicipio(id, dto.regionId(), dto.claveInegi(), dto.nombre().trim(), dto.latitud(),
                dto.longitud(), dto.activo() == null || dto.activo()) == 0) {
            throw BusinessException.noEncontrado("No encontramos ese municipio.");
        }
    }

    @Transactional
    public Map<String, UUID> crearLocalidad(LocalidadAdminDto dto) {
        municipioValido(dto.municipioId());
        Validaciones.ubicacion(dto.latitud(), dto.longitud());
        return Map.of("id", repo.crearLocalidad(dto.municipioId(), dto.nombre().trim(), dto.latitud(), dto.longitud(),
                dto.activo() == null || dto.activo()));
    }

    @Transactional
    public void actualizarLocalidad(UUID id, LocalidadAdminDto dto) {
        municipioValido(dto.municipioId());
        Validaciones.ubicacion(dto.latitud(), dto.longitud());
        if (repo.actualizarLocalidad(id, dto.municipioId(), dto.nombre().trim(), dto.latitud(), dto.longitud(),
                dto.activo() == null || dto.activo()) == 0) {
            throw BusinessException.noEncontrado("No encontramos esa localidad.");
        }
    }

    private void regionValida(UUID id) {
        if (!repo.regionExiste(id)) {
            throw BusinessException.invalida("La región no existe.", Map.of("regionId", "La región no existe."));
        }
    }

    private void municipioValido(UUID id) {
        if (!repo.municipioExiste(id)) {
            throw BusinessException.invalida("El municipio no existe.", Map.of("municipioId", "El municipio no existe."));
        }
    }

    /** El español es obligatorio; los demás idiomas deben existir. */
    private Map<String, String> nombresValidos(Map<String, String> entrada) {
        Map<String, String> limpio = new LinkedHashMap<>();
        for (Map.Entry<String, String> e : entrada.entrySet()) {
            String n = Validaciones.limpiar(e.getValue());
            if (n == null) {
                continue;
            }
            if (n.length() > 100) {
                throw BusinessException.invalida("Un nombre es demasiado largo.", Map.of("nombres." + e.getKey(), "Máximo 100 caracteres."));
            }
            if (!repo.idiomaExiste(e.getKey())) {
                throw BusinessException.invalida("Idioma no válido: " + e.getKey() + ".",
                        Map.of("nombres." + e.getKey(), "Idioma no válido."));
            }
            limpio.put(e.getKey(), n);
        }
        if (!limpio.containsKey("es")) {
            throw BusinessException.invalida("Escribe al menos el nombre en español.",
                    Map.of("nombres.es", "El nombre en español es obligatorio."));
        }
        return limpio;
    }
}
