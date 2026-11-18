package mx.com.traveloaxaca.ventas.servicio;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import mx.com.traveloaxaca.acceso.seguridad.LimitadorIntentos;
import mx.com.traveloaxaca.comun.api.Pagina;
import mx.com.traveloaxaca.comun.error.BusinessException;
import mx.com.traveloaxaca.negocios.servicio.Actor;
import mx.com.traveloaxaca.negocios.servicio.SlugUtil;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.CambioEstadoDto;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.ConversionDto;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.ConvertirDto;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.InteraccionEntradaDto;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.PersonaEquipoDto;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.ProspectoDetalleDto;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.ProspectoEntradaDto;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.ProspectoResumenDto;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.ResumenVentasDto;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.SolicitudContactoDto;
import mx.com.traveloaxaca.ventas.repo.ProspectoRepositorio;
import mx.com.traveloaxaca.ventas.repo.ProspectoRepositorio.Fila;
import mx.com.traveloaxaca.ventas.repo.ProspectoRepositorio.Filtro;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Embudo de prospectos: alta, seguimiento, cambios de estado y conversión a negocio. */
@Service
public class ProspectoServicio {

    static final Set<String> ESTADOS = Set.of("nuevo", "contactado", "interesado", "en_alta", "convertido", "descartado");
    static final Set<String> ORIGENES = Set.of("facebook", "visita", "referido", "formulario_web", "evento", "otro");
    static final Set<String> TIPOS_INTERACCION = Set.of("llamada", "visita", "whatsapp", "correo", "demo", "nota");
    private static final int TAMANO_MAXIMO = 100;

    private static final int SOLICITUDES_POR_HORA = 3;

    private final ProspectoRepositorio repo;
    private final LimitadorIntentos limitador;

    public ProspectoServicio(ProspectoRepositorio repo, LimitadorIntentos limitador) {
        this.repo = repo;
        this.limitador = limitador;
    }

    // ---------------- lectura ----------------

    @Transactional(readOnly = true)
    public Pagina<ProspectoResumenDto> listar(String estado, UUID asignadoA, boolean sinAsignar, UUID municipioId,
                                              UUID categoriaId, String origen, boolean vencidas, String texto,
                                              int pagina, int tamano) {
        if (estado != null && !ESTADOS.contains(estado)) {
            throw BusinessException.invalida("El estado no es válido.", Map.of("estado", "Elige un estado de la lista."));
        }
        if (origen != null && !ORIGENES.contains(origen)) {
            throw BusinessException.invalida("El origen no es válido.", Map.of("origen", "Elige un origen de la lista."));
        }
        int t = Math.min(Math.max(tamano, 1), TAMANO_MAXIMO);
        int p = Math.max(pagina, 0);
        LocalDate hoy = Contactos.hoy();
        Filtro f = new Filtro(estado, asignadoA, sinAsignar, municipioId, categoriaId, origen, vencidas, texto, hoy, t, p * t);
        List<ProspectoResumenDto> filas = repo.buscar(f).stream().map(r -> resumen(r, hoy)).toList();
        return new Pagina<>(filas, repo.contar(f), p, t);
    }

    @Transactional(readOnly = true)
    public ProspectoDetalleDto detalle(UUID id) {
        Fila f = cargar(id);
        return new ProspectoDetalleDto(resumen(f, Contactos.hoy()), f.motivoDescarte(), f.notas(), f.creadoEn(),
                repo.interacciones(id));
    }

    @Transactional(readOnly = true)
    public ResumenVentasDto resumen() {
        LocalDate hoy = Contactos.hoy();
        return new ResumenVentasDto(repo.conteoPorEstado(), repo.vencidas(hoy), repo.sinAsignar(),
                repo.convertidosDesde(hoy.withDayOfMonth(1)));
    }

    @Transactional(readOnly = true)
    public List<PersonaEquipoDto> equipo() {
        return repo.equipo();
    }

    // ---------------- altas y cambios ----------------

    @Transactional
    public ProspectoDetalleDto crear(Actor actor, ProspectoEntradaDto dto) {
        Datos d = validar(dto, null);
        UUID id = repo.crear(d.nombre, d.categoriaId, d.municipioId, d.contacto, d.telefono, d.correo, d.origen,
                d.asignadoA, d.proxima, d.notas);
        return detalle(id);
    }

    /**
     * Alta pública desde «Quiero que me contacten». Sin cuenta, así que: el señuelo se ignora sin avisar, hay un
     * límite por dirección y un teléfono o correo repetido responde igual que un alta (no se revela quién ya está).
     */
    @Transactional
    public void solicitarContacto(SolicitudContactoDto dto, String ip) {
        if (Contactos.vacioANulo(dto.sitioWeb()) != null) {
            return;
        }
        limitador.consumir("solicitud-contacto:" + ip, SOLICITUDES_POR_HORA, 3600,
                "Recibimos muchas solicitudes. Intenta más tarde.");
        if (Contactos.vacioANulo(dto.telefono()) == null && Contactos.vacioANulo(dto.correo()) == null) {
            throw BusinessException.invalida("Deja un teléfono o un correo para poder contactarte.",
                    Map.of("telefono", "Deja un teléfono o un correo para poder contactarte.",
                            "correo", "Deja un teléfono o un correo para poder contactarte."));
        }
        Datos d;
        try {
            d = validar(new ProspectoEntradaDto(dto.nombreNegocio(), dto.categoriaId(), dto.municipioId(),
                    dto.contactoNombre(), dto.telefono(), dto.correo(), "formulario_web", null, null, dto.mensaje()), null);
        } catch (BusinessException e) {
            if (e.getEstado() == HttpStatus.CONFLICT) {
                return;
            }
            throw e;
        }
        repo.crear(d.nombre, d.categoriaId, d.municipioId, d.contacto, d.telefono, d.correo, d.origen, null, null, d.notas);
    }

    @Transactional
    public ProspectoDetalleDto actualizar(UUID id, ProspectoEntradaDto dto) {
        Fila actual = cargar(id);
        Datos d = validar(dto, id);
        repo.actualizar(id, d.nombre, d.categoriaId, d.municipioId, d.contacto, d.telefono, d.correo,
                "convertido".equals(actual.estado()) ? actual.origen() : d.origen, d.asignadoA, d.proxima, d.notas);
        return detalle(id);
    }

    @Transactional
    public void eliminar(UUID id) {
        Fila f = cargar(id);
        if ("convertido".equals(f.estado())) {
            throw BusinessException.conflicto("Este prospecto ya es un negocio y no se puede eliminar.");
        }
        repo.eliminar(id);
    }

    @Transactional
    public ProspectoDetalleDto cambiarEstado(UUID id, CambioEstadoDto dto) {
        Fila f = repo.bloquear(id).orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese prospecto."));
        String nuevo = dto.estado();
        if (!ESTADOS.contains(nuevo)) {
            throw BusinessException.invalida("El estado no es válido.", Map.of("estado", "Elige un estado de la lista."));
        }
        if ("convertido".equals(f.estado())) {
            throw BusinessException.conflicto("Este prospecto ya es un negocio y su estado no cambia.");
        }
        if ("convertido".equals(nuevo)) {
            throw BusinessException.invalida("Para convertirlo en negocio usa la acción Convertir.",
                    Map.of("estado", "Usa la acción Convertir a negocio."));
        }
        String motivo = Contactos.vacioANulo(dto.motivo());
        if ("descartado".equals(nuevo) && motivo == null) {
            throw BusinessException.invalida("Cuéntanos por qué se descarta.", Map.of("motivo", "El motivo es obligatorio."));
        }
        repo.cambiarEstado(id, nuevo, "descartado".equals(nuevo) ? motivo : null);
        return detalle(id);
    }

    @Transactional
    public ProspectoDetalleDto registrarInteraccion(Actor actor, UUID id, InteraccionEntradaDto dto) {
        Fila f = repo.bloquear(id).orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese prospecto."));
        if (!TIPOS_INTERACCION.contains(dto.tipo())) {
            throw BusinessException.invalida("El tipo de contacto no es válido.", Map.of("tipo", "Elige un tipo de la lista."));
        }
        if (dto.proximaAccionEn() != null && dto.proximaAccionEn().isBefore(Contactos.hoy())) {
            throw BusinessException.invalida("La próxima acción no puede estar en el pasado.",
                    Map.of("proximaAccionEn", "Elige hoy o una fecha futura."));
        }
        repo.registrarInteraccion(id, actor.usuarioId(), dto.tipo(), Contactos.vacioANulo(dto.resultado()),
                Contactos.vacioANulo(dto.notas()), dto.ocurrioEn(), dto.proximaAccionEn());
        if (dto.proximaAccionEn() != null) {
            repo.fijarProximaAccion(id, dto.proximaAccionEn());
        }
        // Un primer contacto real saca al prospecto de "nuevo". Una nota no cuenta como contacto.
        if ("nuevo".equals(f.estado()) && !"nota".equals(dto.tipo())) {
            repo.cambiarEstado(id, "contactado", null);
        }
        return detalle(id);
    }

    @Transactional
    public ConversionDto convertir(Actor actor, UUID id, ConvertirDto dto) {
        Fila f = repo.bloquear(id).orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese prospecto."));
        if ("convertido".equals(f.estado())) {
            throw BusinessException.conflicto("Este prospecto ya se convirtió en negocio.");
        }
        if ("descartado".equals(f.estado())) {
            throw BusinessException.conflicto("Reabre el prospecto antes de convertirlo.");
        }
        UUID categoria = dto != null && dto.categoriaId() != null ? dto.categoriaId() : f.categoriaId();
        UUID municipio = dto != null && dto.municipioId() != null ? dto.municipioId() : f.municipioId();
        Map<String, String> faltan = new LinkedHashMap<>();
        if (categoria == null || !repo.categoriaExiste(categoria)) {
            faltan.put("categoriaId", "Elige la categoría del negocio.");
        }
        UUID destino = municipio == null ? null : repo.destinoDeMunicipio(municipio).orElse(null);
        if (destino == null) {
            faltan.put("municipioId", "Elige el municipio del negocio.");
        }
        if (!faltan.isEmpty()) {
            throw BusinessException.invalida("Faltan datos para crear el negocio.", faltan);
        }
        String base = SlugUtil.base(f.nombreNegocio());
        String slug = SlugUtil.libre(base, repo.slugsParecidos(destino, base));
        UUID negocio = repo.crearNegocio(destino, slug, f.nombreNegocio(), categoria, actor.usuarioId(), "asistida");
        repo.crearSucursalPrincipal(negocio, municipio);
        if (f.telefono() != null) {
            repo.crearContacto(negocio, "telefono", f.telefono());
        }
        if (f.correo() != null) {
            repo.crearContacto(negocio, "correo", f.correo());
        }
        repo.enlazarNegocio(id, negocio);
        repo.registrarInteraccion(id, actor.usuarioId(), "nota", "Convertido a negocio", null, null, null);
        return new ConversionDto(negocio, slug);
    }

    // ---------------- apoyo ----------------

    private Fila cargar(UUID id) {
        return repo.porId(id).orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese prospecto."));
    }

    private static ProspectoResumenDto resumen(Fila f, LocalDate hoy) {
        boolean abierto = !"convertido".equals(f.estado()) && !"descartado".equals(f.estado());
        boolean vencida = abierto && f.proximaAccionEn() != null && f.proximaAccionEn().isBefore(hoy);
        return new ProspectoResumenDto(f.id(), f.nombreNegocio(), f.categoriaId(), f.categoriaClave(), f.municipioId(),
                f.municipioNombre(), f.contactoNombre(), f.telefono(), f.correo(), f.origen(), f.estado(),
                f.asignadoA(), f.asignadoNombre(), f.negocioId(), f.proximaAccionEn(), vencida, f.actualizadoEn());
    }

    private record Datos(String nombre, UUID categoriaId, UUID municipioId, String contacto, String telefono,
                         String correo, String origen, UUID asignadoA, LocalDate proxima, String notas) {
    }

    private Datos validar(ProspectoEntradaDto dto, UUID excluir) {
        Map<String, String> errores = new LinkedHashMap<>();
        String nombre = dto.nombreNegocio().trim();
        if (nombre.isEmpty()) {
            errores.put("nombreNegocio", "Escribe el nombre del negocio.");
        }
        if (dto.categoriaId() != null && !repo.categoriaExiste(dto.categoriaId())) {
            errores.put("categoriaId", "La categoría no existe.");
        }
        if (dto.municipioId() != null && !repo.municipioExiste(dto.municipioId())) {
            errores.put("municipioId", "El municipio no existe.");
        }
        String telefono = null;
        if (Contactos.vacioANulo(dto.telefono()) != null) {
            telefono = Contactos.telefono(dto.telefono());
            if (telefono == null) {
                errores.put("telefono", "Escribe un teléfono válido, por ejemplo +529515550123 o 9515550123.");
            }
        }
        String correo = Contactos.vacioANulo(dto.correo());
        if (correo != null && !Contactos.correoValido(correo)) {
            errores.put("correo", "Escribe un correo válido.");
        }
        String origen = dto.origen() == null || dto.origen().isBlank() ? "otro" : dto.origen();
        if (!ORIGENES.contains(origen)) {
            errores.put("origen", "Elige un origen de la lista.");
        }
        if (dto.asignadoA() != null && !repo.esDelEquipo(dto.asignadoA())) {
            errores.put("asignadoA", "Solo se puede asignar a personas de ventas o administración.");
        }
        if (!errores.isEmpty()) {
            throw BusinessException.invalida("Revisa los datos del prospecto.", errores);
        }
        repo.duplicado(telefono, correo, excluir).ifPresent(quien -> {
            throw BusinessException.conflicto(quien + " ya usa ese teléfono o correo.");
        });
        return new Datos(nombre, dto.categoriaId(), dto.municipioId(), Contactos.vacioANulo(dto.contactoNombre()),
                telefono, correo, origen, dto.asignadoA(), dto.proximaAccionEn(), Contactos.vacioANulo(dto.notas()));
    }
}
