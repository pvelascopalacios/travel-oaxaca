package mx.com.traveloaxaca.ventas.servicio;

import java.net.URI;
import java.net.URISyntaxException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import mx.com.traveloaxaca.comun.error.BusinessException;
import mx.com.traveloaxaca.medicion.repo.MedicionRepositorio;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.AfiliadoDto;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.AfiliadoEntradaDto;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.ClicDiaDto;
import mx.com.traveloaxaca.ventas.repo.AfiliadoRepositorio;
import mx.com.traveloaxaca.ventas.repo.AfiliadoRepositorio.Fila;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Enlaces de afiliado: administración, y la redirección pública que cuenta el clic. */
@Service
public class AfiliadoServicio {

    private static final Set<String> ESTADOS = Set.of("activo", "pausado");
    private static final int MAX_DIAS_CLICS = 366;

    private final AfiliadoRepositorio repo;
    private final MedicionRepositorio medicion;

    public AfiliadoServicio(AfiliadoRepositorio repo, MedicionRepositorio medicion) {
        this.repo = repo;
        this.medicion = medicion;
    }

    @Transactional(readOnly = true)
    public List<AfiliadoDto> listar() {
        return repo.listar(Contactos.hoy().minusDays(29)).stream().map(AfiliadoServicio::dto).toList();
    }

    @Transactional
    public AfiliadoDto crear(AfiliadoEntradaDto dto) {
        Datos d = validar(dto, null);
        UUID id = repo.crear(d.codigo, d.url, d.socio, dto.comisionPct(), d.estado, dto.negocioId());
        return dto(repo.porId(id, Contactos.hoy().minusDays(29)).orElseThrow());
    }

    @Transactional
    public AfiliadoDto actualizar(UUID id, AfiliadoEntradaDto dto) {
        repo.porId(id, Contactos.hoy()).orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese enlace."));
        Datos d = validar(dto, id);
        repo.actualizar(id, d.codigo, d.url, d.socio, dto.comisionPct(), d.estado, dto.negocioId());
        return dto(repo.porId(id, Contactos.hoy().minusDays(29)).orElseThrow());
    }

    @Transactional(readOnly = true)
    public List<ClicDiaDto> clics(UUID id, LocalDate desde, LocalDate hasta) {
        repo.porId(id, Contactos.hoy()).orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese enlace."));
        LocalDate fin = hasta == null ? Contactos.hoy() : hasta;
        LocalDate inicio = desde == null ? fin.minusDays(29) : desde;
        if (inicio.isAfter(fin) || inicio.plusDays(MAX_DIAS_CLICS).isBefore(fin)) {
            throw BusinessException.invalida("El rango de fechas no es válido.",
                    Map.of("desde", "Elige un rango de máximo un año."));
        }
        return repo.clicsPorDia(id, inicio, fin);
    }

    /** Cuenta el clic y regresa la dirección a la que hay que mandar a la persona. */
    @Transactional
    public String redirigir(String codigo, UUID dispositivoId, String origen) {
        var enlace = repo.activoPorCodigo(codigo.toLowerCase(Locale.ROOT))
                .orElseThrow(() -> BusinessException.noEncontrado("Este enlace ya no está disponible."));
        UUID dispositivo = dispositivoId != null && repo.dispositivoExiste(dispositivoId) ? dispositivoId : null;
        String o = origen == null || origen.isBlank() ? null : origen.trim().toLowerCase(Locale.ROOT);
        if (o != null && o.length() > 40) {
            o = o.substring(0, 40);
        }
        repo.registrarClic(enlace.id(), dispositivo, o);
        // Si el enlace pertenece a un negocio y sabemos de qué dispositivo viene, también cuenta en sus métricas.
        if (enlace.negocioId() != null && dispositivo != null) {
            medicion.registrar("clic_afiliado", enlace.negocioId(), dispositivo, o == null ? "app" : o, null, null,
                    OffsetDateTime.now());
        }
        return enlace.destinoUrl();
    }

    // ---------------- apoyo ----------------

    private record Datos(String codigo, String url, String socio, String estado) {
    }

    private Datos validar(AfiliadoEntradaDto dto, UUID excluir) {
        Map<String, String> errores = new LinkedHashMap<>();
        String codigo = dto.codigo().trim().toLowerCase(Locale.ROOT);
        if (repo.codigoExiste(codigo, excluir)) {
            errores.put("codigo", "Ese código ya está en uso.");
        }
        String url = dto.destinoUrl().trim();
        String problemaUrl = problemaDeUrl(url);
        if (problemaUrl != null) {
            errores.put("destinoUrl", problemaUrl);
        }
        String estado = dto.estado() == null || dto.estado().isBlank() ? "activo" : dto.estado();
        if (!ESTADOS.contains(estado)) {
            errores.put("estado", "Usa activo o pausado.");
        }
        if (dto.negocioId() != null && !repo.negocioExiste(dto.negocioId())) {
            errores.put("negocioId", "El negocio no existe.");
        }
        String socio = dto.socio().trim();
        if (socio.isEmpty()) {
            errores.put("socio", "Escribe el nombre del socio.");
        }
        if (!errores.isEmpty()) {
            throw BusinessException.invalida("Revisa los datos del enlace.", errores);
        }
        return new Datos(codigo, url, socio, estado);
    }

    /** Solo https hacia un sitio con nombre de dominio: nada de direcciones internas ni de IP. */
    static String problemaDeUrl(String url) {
        try {
            URI u = new URI(url);
            String host = u.getHost();
            if (!"https".equalsIgnoreCase(u.getScheme())) {
                return "La dirección debe empezar con https://";
            }
            if (u.getUserInfo() != null) {
                return "La dirección no puede llevar usuario ni contraseña.";
            }
            if (host == null || !host.contains(".") || host.endsWith(".")) {
                return "Escribe una dirección con nombre de sitio, por ejemplo https://socio.com/oferta.";
            }
            String h = host.toLowerCase(Locale.ROOT);
            if (h.matches("^[0-9.]+$") || h.contains(":") || h.endsWith(".local") || h.endsWith(".internal")
                    || h.equals("localhost")) {
                return "No se permiten direcciones internas ni numéricas.";
            }
            return null;
        } catch (URISyntaxException e) {
            return "La dirección no es válida.";
        }
    }

    private static AfiliadoDto dto(Fila f) {
        return new AfiliadoDto(f.id(), f.codigo(), f.destinoUrl(), f.socio(), f.comisionPct(), f.estado(),
                f.negocioId(), f.clics30d(), f.creadoEn());
    }
}
