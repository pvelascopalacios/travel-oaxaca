package mx.com.traveloaxaca.negocios.servicio;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import mx.com.traveloaxaca.acceso.repo.UsuarioRepositorio;
import mx.com.traveloaxaca.comun.api.Pagina;
import mx.com.traveloaxaca.comun.error.BusinessException;
import mx.com.traveloaxaca.negocios.almacen.AlmacenMedios;
import mx.com.traveloaxaca.negocios.dto.NegocioDtos.*;
import mx.com.traveloaxaca.negocios.repo.CatalogoRepositorio;
import mx.com.traveloaxaca.negocios.repo.FichaRepositorio;
import mx.com.traveloaxaca.negocios.repo.NegocioRepositorio;
import mx.com.traveloaxaca.negocios.repo.NegocioRepositorio.FiltroAdmin;
import mx.com.traveloaxaca.negocios.servicio.AccesoNegocio.Contexto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Alta, listado y datos básicos del negocio. */
@Service
public class NegocioServicio {

    private static final int MAX_NEGOCIOS_POR_PERSONA = 10;

    private final NegocioRepositorio negocios;
    private final FichaRepositorio ficha;
    private final CatalogoRepositorio catalogo;
    private final UsuarioRepositorio usuarios;
    private final AccesoNegocio acceso;
    private final AtributosCategoria atributos;
    private final RevisionServicio revision;
    private final FichaServicio fichas;
    private final AlmacenMedios almacen;
    private final ObjectMapper json;

    public NegocioServicio(NegocioRepositorio negocios, FichaRepositorio ficha, CatalogoRepositorio catalogo,
                           UsuarioRepositorio usuarios, AccesoNegocio acceso, AtributosCategoria atributos,
                           RevisionServicio revision, FichaServicio fichas, AlmacenMedios almacen, ObjectMapper json) {
        this.negocios = negocios;
        this.ficha = ficha;
        this.catalogo = catalogo;
        this.usuarios = usuarios;
        this.acceso = acceso;
        this.atributos = atributos;
        this.revision = revision;
        this.fichas = fichas;
        this.almacen = almacen;
        this.json = json;
    }

    @Transactional
    public FichaDto crear(UUID usuarioId, NuevoNegocioDto dto) {
        if (negocios.contarComoPropietario(usuarioId) >= MAX_NEGOCIOS_POR_PERSONA) {
            throw BusinessException.demasiadasSolicitudes(
                    "Ya tienes " + MAX_NEGOCIOS_POR_PERSONA + " negocios. Para agregar otro, archiva alguno.");
        }
        if (negocios.claveRaiz(dto.categoriaId()).isEmpty()) {
            throw BusinessException.invalida("La categoría no existe.", Map.of("categoriaId", "Elige una categoría de la lista."));
        }
        UUID destino = negocios.destinoDeMunicipio(dto.municipioId()).orElseThrow(() ->
                BusinessException.invalida("El municipio no existe.", Map.of("municipioId", "Elige un municipio de la lista.")));
        String nombre = dto.nombreComercial().trim();
        String base = SlugUtil.base(nombre);
        String slug = SlugUtil.libre(base, negocios.slugsParecidos(destino, base));
        UUID id = negocios.crear(destino, slug, nombre, dto.categoriaId(), usuarioId);
        negocios.crearMembresiaPropietario(id, usuarioId);
        ficha.crearSucursal(id, null, true, dto.municipioId(), null, null, null, null, null);
        if (!usuarios.tieneRol(usuarioId, "dueno")) {
            usuarios.asignarRol(usuarioId, "dueno");
        }
        return fichas.cargar(id, "propietario");
    }

    @Transactional(readOnly = true)
    public List<NegocioResumenDto> mios(UUID usuarioId) {
        return negocios.deUsuario(usuarioId).stream()
                .map(r -> new NegocioResumenDto(r.id(), r.slug(), r.nombreComercial(), r.estado(), r.categoriaId(),
                        r.categoriaClave(), r.puntajeFicha(), r.rolMiembro(),
                        r.portadaClave() == null ? null : almacen.urlPublica(r.portadaClave()), r.actualizadoEn()))
                .toList();
    }

    @Transactional
    public ResultadoCambio actualizar(Actor actor, UUID negocioId, ActualizarNegocioDto dto) {
        Contexto ctx = acceso.editar(actor, negocioId);
        var n = ctx.negocio();
        boolean publicada = "publicada".equals(n.estado());
        String raizActual = negocios.claveRaiz(n.categoriaId()).orElse("");
        String raizNueva = negocios.claveRaiz(dto.categoriaId()).orElseThrow(() ->
                BusinessException.invalida("La categoría no existe.", Map.of("categoriaId", "Elige una categoría de la lista.")));
        boolean cambiaCategoria = !dto.categoriaId().equals(n.categoriaId());
        if (cambiaCategoria && publicada && !raizActual.equals(raizNueva)) {
            throw BusinessException.conflicto("Una ficha publicada solo puede cambiar a otra categoría del mismo tipo.");
        }
        if (dto.precioDesde() != null && dto.unidadPrecio() == null) {
            throw BusinessException.invalida("Indica a qué se refiere el precio.", Map.of("unidadPrecio", "Elige la unidad del precio."));
        }
        String atributosJson = aJson(atributos.validar(raizNueva, dto.atributos()));
        String nombre = dto.nombreComercial().trim();
        String razon = Validaciones.limpiar(dto.razonSocial());
        boolean cambiaNombre = !nombre.equals(n.nombreComercial());
        boolean pendiente = false;

        if (publicada) {
            negocios.actualizarPrecio(negocioId, razon, dto.rangoPrecio(), dto.precioDesde(), dto.unidadPrecio(), atributosJson);
            if (cambiaNombre) {
                revision.proponer(negocioId, actor.usuarioId(), "nombre_comercial", n.nombreComercial(), nombre);
                pendiente = true;
            }
            if (cambiaCategoria) {
                revision.proponer(negocioId, actor.usuarioId(), "categoria_id", n.categoriaId(), dto.categoriaId());
                pendiente = true;
            }
        } else {
            negocios.actualizarDatos(negocioId, nombre, razon, dto.categoriaId(), dto.rangoPrecio(),
                    dto.precioDesde(), dto.unidadPrecio(), atributosJson);
        }
        return fichas.terminar(ctx, true, pendiente);
    }

    // ---------------- administración ----------------

    @Transactional(readOnly = true)
    public Pagina<NegocioAdminDto> buscar(String texto, String estado, UUID categoriaId, UUID municipioId,
                                          Integer pagina, Integer tamano) {
        int t = tamano == null ? 20 : Math.max(1, Math.min(tamano, 100));
        int p = pagina == null ? 0 : Math.max(0, pagina);
        var f = new FiltroAdmin(texto, estado, categoriaId, municipioId, t, p * t);
        var filas = negocios.buscar(f).stream()
                .map(r -> new NegocioAdminDto(r.id(), r.slug(), r.nombreComercial(), r.estado(), r.categoriaClave(),
                        r.municipioNombre(), r.puntajeFicha(), r.origenAlta(), r.creadoEn(), r.publicadoEn()))
                .toList();
        return new Pagina<>(filas, negocios.contar(f), p, t);
    }

    private String aJson(Object o) {
        try {
            return json.writeValueAsString(o);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }
}
