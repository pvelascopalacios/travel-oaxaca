package mx.com.traveloaxaca.ventas.servicio;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import mx.com.traveloaxaca.acceso.correo.NotificacionServicio;
import mx.com.traveloaxaca.comun.api.Pagina;
import mx.com.traveloaxaca.comun.error.BusinessException;
import mx.com.traveloaxaca.negocios.servicio.Actor;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.AuditoriaDto;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.ConfigDto;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.NotificacionDto;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.PlantillaDto;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.PlantillaEdicionDto;
import mx.com.traveloaxaca.ventas.repo.OperacionRepositorio;
import mx.com.traveloaxaca.ventas.repo.OperacionRepositorio.ConfigFila;
import mx.com.traveloaxaca.ventas.repo.OperacionRepositorio.FiltroAuditoria;
import mx.com.traveloaxaca.ventas.repo.OperacionRepositorio.PlantillaFila;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Operación del sistema: consulta de auditoría, configuración, plantillas de correo y cola de notificaciones. */
@Service
public class OperacionServicio {

    static final int DIAS_MAXIMOS_AUDITORIA = 90;
    private static final Set<String> ACCIONES = Set.of("insert", "update", "delete");
    private static final Pattern VARIABLE = Pattern.compile("\\{\\{([^{}]*)\\}\\}");
    private static final Set<String> ESTADOS_COLA = Set.of("pendiente", "enviada", "fallida", "leida", "cancelada");

    private final OperacionRepositorio repo;
    private final NotificacionServicio notificaciones;
    private final ObjectMapper json;

    public OperacionServicio(OperacionRepositorio repo, NotificacionServicio notificaciones, ObjectMapper json) {
        this.repo = repo;
        this.notificaciones = notificaciones;
        this.json = json;
    }

    // ---------------- auditoría ----------------

    @Transactional(readOnly = true)
    public Pagina<AuditoriaDto> auditoria(String tabla, UUID usuarioId, String accion, String registroId,
                                          LocalDate desde, LocalDate hasta, int pagina, int tamano) {
        LocalDate fin = hasta == null ? Contactos.hoy() : hasta;
        LocalDate inicio = desde == null ? fin.minusDays(30) : desde;
        if (inicio.isAfter(fin)) {
            throw BusinessException.invalida("La fecha inicial no puede ser posterior a la final.",
                    Map.of("desde", "Elige una fecha anterior o igual a la final."));
        }
        if (inicio.plusDays(DIAS_MAXIMOS_AUDITORIA).isBefore(fin)) {
            throw BusinessException.invalida("Consulta máximo " + DIAS_MAXIMOS_AUDITORIA + " días a la vez.",
                    Map.of("desde", "El rango es de " + DIAS_MAXIMOS_AUDITORIA + " días como máximo."));
        }
        String acc = accion == null || accion.isBlank() ? null : accion.toLowerCase();
        if (acc != null && !ACCIONES.contains(acc)) {
            throw BusinessException.invalida("La acción no es válida.", Map.of("accion", "Usa insert, update o delete."));
        }
        int t = Math.min(Math.max(tamano, 1), 100);
        int p = Math.max(pagina, 0);
        FiltroAuditoria f = new FiltroAuditoria(Contactos.vacioANulo(tabla), usuarioId, acc,
                Contactos.vacioANulo(registroId), inicio, fin, t, p * t);
        List<AuditoriaDto> filas = repo.auditoria(f).stream().map(a -> new AuditoriaDto(a.id(), a.tabla(),
                a.registroId(), a.accion(), a.usuarioId(), a.usuarioCorreo(), leer(a.antes()), leer(a.despues()),
                a.ocurrioEn())).toList();
        return new Pagina<>(filas, repo.contarAuditoria(f), p, t);
    }

    // ---------------- configuración ----------------

    @Transactional(readOnly = true)
    public List<ConfigDto> configuracion() {
        return repo.configuracion().stream().map(this::dto).toList();
    }

    @Transactional
    public ConfigDto cambiarConfiguracion(Actor actor, String clave, JsonNode valor) {
        ConfigFila c = repo.configuracion(clave)
                .orElseThrow(() -> BusinessException.noEncontrado("No encontramos esa clave de configuración."));
        switch (c.tipo()) {
            case "entero" -> {
                if (valor == null || !valor.isIntegralNumber()) {
                    throw error("Escribe un número entero.");
                }
                BigDecimal n = valor.decimalValue();
                if (c.minimo() != null && n.compareTo(c.minimo()) < 0) {
                    throw error("No puede ser menor que " + c.minimo().stripTrailingZeros().toPlainString() + ".");
                }
                if (c.maximo() != null && n.compareTo(c.maximo()) > 0) {
                    throw error("No puede ser mayor que " + c.maximo().stripTrailingZeros().toPlainString() + ".");
                }
            }
            case "booleano" -> {
                if (valor == null || !valor.isBoolean()) {
                    throw error("Usa verdadero o falso.");
                }
            }
            case "texto" -> {
                if (valor == null || !valor.isTextual()) {
                    throw error("Escribe un texto.");
                }
            }
            default -> {
                if (valor == null || !(valor.isObject() || valor.isArray())) {
                    throw error("Escribe un objeto o una lista en formato JSON.");
                }
            }
        }
        repo.cambiarConfiguracion(clave, valor.toString(), actor.usuarioId());
        return dto(repo.configuracion(clave).orElseThrow());
    }

    private static BusinessException error(String mensaje) {
        return BusinessException.invalida(mensaje, Map.of("valor", mensaje));
    }

    private ConfigDto dto(ConfigFila c) {
        return new ConfigDto(c.clave(), c.tipo(), leer(c.valor()), c.minimo(), c.maximo(), c.descripcion(), c.actualizadoEn());
    }

    // ---------------- plantillas ----------------

    @Transactional(readOnly = true)
    public List<PlantillaDto> plantillas() {
        return repo.plantillas().stream().map(OperacionServicio::dto).toList();
    }

    @Transactional
    public PlantillaDto editarPlantilla(UUID id, PlantillaEdicionDto dto) {
        PlantillaFila p = repo.plantilla(id).orElseThrow(() -> BusinessException.noEncontrado("No encontramos esa plantilla."));
        String asunto = Contactos.vacioANulo(dto.asunto());
        if ("correo".equals(p.canal()) && asunto == null) {
            throw BusinessException.invalida("Los correos necesitan asunto.", Map.of("asunto", "Escribe el asunto."));
        }
        Set<String> permitidas = variables(p);
        Set<String> usadas = new LinkedHashSet<>();
        for (String texto : new String[] {asunto == null ? "" : asunto, dto.cuerpo()}) {
            Matcher m = VARIABLE.matcher(texto);
            while (m.find()) {
                usadas.add(m.group(1));
            }
        }
        List<String> raras = usadas.stream().filter(v -> !permitidas.contains(v)).toList();
        if (!raras.isEmpty()) {
            throw BusinessException.invalida("Hay variables que esta plantilla no admite: "
                            + String.join(", ", raras.stream().map(v -> "{{" + v + "}}").toList())
                            + ". Permitidas: " + String.join(", ", permitidas.stream().map(v -> "{{" + v + "}}").toList()) + ".",
                    Map.of("cuerpo", "Usa solo las variables permitidas, sin espacios dentro de las llaves."));
        }
        repo.actualizarPlantilla(id, asunto, dto.cuerpo().trim(), dto.activa() == null ? p.activa() : dto.activa());
        return dto(repo.plantilla(id).orElseThrow());
    }

    /** Pone en la cola un correo de prueba para quien lo pide, con valores de ejemplo. */
    @Transactional
    public void probarPlantilla(Actor actor, UUID id) {
        PlantillaFila p = repo.plantilla(id).orElseThrow(() -> BusinessException.noEncontrado("No encontramos esa plantilla."));
        if (!"correo".equals(p.canal()) || !p.activa()) {
            throw BusinessException.conflicto("Solo se pueden probar plantillas de correo activas.");
        }
        Map<String, String> ejemplo = new LinkedHashMap<>();
        for (String v : variables(p)) {
            ejemplo.put(v, "(" + v + ")");
        }
        notificaciones.encolarCorreo(actor.usuarioId(), p.clave(), ejemplo);
    }

    private static Set<String> variables(PlantillaFila p) {
        return p.variables() == null || p.variables().isBlank() ? Set.of()
                : new LinkedHashSet<>(Arrays.asList(p.variables().split(",")));
    }

    private static PlantillaDto dto(PlantillaFila p) {
        return new PlantillaDto(p.id(), p.clave(), p.canal(), p.idioma(), p.asunto(), p.cuerpo(), p.activa(),
                List.copyOf(variables(p)));
    }

    // ---------------- cola ----------------

    @Transactional(readOnly = true)
    public Pagina<NotificacionDto> cola(String estado, String plantilla, int pagina, int tamano) {
        String e = Contactos.vacioANulo(estado);
        if (e != null && !ESTADOS_COLA.contains(e)) {
            throw BusinessException.invalida("El estado no es válido.", Map.of("estado", "Elige un estado de la lista."));
        }
        int t = Math.min(Math.max(tamano, 1), 100);
        int p = Math.max(pagina, 0);
        String pl = Contactos.vacioANulo(plantilla);
        List<NotificacionDto> filas = repo.cola(e, pl, t, p * t).stream().map(n -> new NotificacionDto(n.id(),
                n.plantillaClave(), n.canal(), n.destinatario(), n.estado(), n.intentos(), n.error(),
                n.programadaPara(), n.enviadaEn(), n.creadoEn())).toList();
        return new Pagina<>(filas, repo.contarCola(e, pl), p, t);
    }

    @Transactional
    public void reintentar(UUID id) {
        if (!repo.notificacionExiste(id)) {
            throw BusinessException.noEncontrado("No encontramos esa notificación.");
        }
        if (repo.reintentar(id) == 0) {
            throw BusinessException.conflicto("Solo se reintentan las notificaciones fallidas.");
        }
    }

    private JsonNode leer(String texto) {
        try {
            return texto == null ? null : json.readTree(texto);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException(e);
        }
    }
}
