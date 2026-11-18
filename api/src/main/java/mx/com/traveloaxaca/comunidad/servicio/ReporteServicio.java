package mx.com.traveloaxaca.comunidad.servicio;

import java.util.Set;
import java.util.UUID;
import mx.com.traveloaxaca.comun.error.BusinessException;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.ReporteContenidoEntradaDto;
import mx.com.traveloaxaca.comunidad.dto.ComunidadDtos.ReporteFichaEntradaDto;
import mx.com.traveloaxaca.comunidad.repo.ReporteRepositorio;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reportes de fichas y de contenido. Se aceptan con cuenta o solo con el identificador del dispositivo.
 * Un contenido con suficientes reportes abiertos de personas distintas se oculta solo hasta que lo revise el equipo.
 */
@Service
public class ReporteServicio {

    private static final Set<String> MOTIVOS_FICHA = Set.of("cerrado", "datos_incorrectos", "ofensivo", "duplicado", "otro");
    private static final Set<String> MOTIVOS_CONTENIDO = Set.of("ofensivo", "spam", "falso", "derechos", "otro");
    private static final Set<String> TIPOS = Set.of("resena", "comentario", "foto");

    private final ReporteRepositorio repo;
    private final ComunidadConfig cfg;

    public ReporteServicio(ReporteRepositorio repo, ComunidadConfig cfg) {
        this.repo = repo;
        this.cfg = cfg;
    }

    /** Devuelve true si se registró y false si esa misma persona ya tenía el mismo reporte abierto. */
    @Transactional
    public boolean reportarFicha(UUID usuarioId, UUID dispositivoId, ReporteFichaEntradaDto dto) {
        UUID dispositivo = identidad(usuarioId, dispositivoId);
        if (!MOTIVOS_FICHA.contains(dto.motivo())) {
            throw BusinessException.invalida("El motivo debe ser cerrado, datos_incorrectos, ofensivo, duplicado u otro.",
                    java.util.Map.of("motivo", "Valores: cerrado, datos_incorrectos, ofensivo, duplicado, otro."));
        }
        if (!repo.negocioPublicado(dto.negocioId())) {
            throw BusinessException.noEncontrado("No encontramos ese negocio.");
        }
        limite(repo.recientesFicha(usuarioId, dispositivo));
        if (repo.fichaAbiertaDe(dto.negocioId(), dto.motivo(), usuarioId, dispositivo)) {
            return false;
        }
        repo.crearFicha(dto.negocioId(), usuarioId, dispositivo, dto.motivo(), limpiar(dto.detalle()));
        return true;
    }

    @Transactional
    public boolean reportarContenido(UUID usuarioId, UUID dispositivoId, ReporteContenidoEntradaDto dto) {
        UUID dispositivo = identidad(usuarioId, dispositivoId);
        if (!TIPOS.contains(dto.tipo())) {
            throw BusinessException.invalida("El tipo debe ser resena, comentario o foto.",
                    java.util.Map.of("tipo", "Valores: resena, comentario, foto."));
        }
        if (!MOTIVOS_CONTENIDO.contains(dto.motivo())) {
            throw BusinessException.invalida("El motivo debe ser ofensivo, spam, falso, derechos u otro.",
                    java.util.Map.of("motivo", "Valores: ofensivo, spam, falso, derechos, otro."));
        }
        var contenido = repo.contenido(dto.tipo(), dto.id()).filter(c -> c.visible())
                .orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese contenido."));
        if (usuarioId != null && usuarioId.equals(contenido.autorId())) {
            throw BusinessException.invalida("No puedes reportar tu propio contenido.");
        }
        limite(repo.recientesContenido(usuarioId, dispositivo));
        if (repo.contenidoAbiertoDe(dto.tipo(), dto.id(), usuarioId, dispositivo)) {
            return false;
        }
        repo.crearContenido(dto.tipo(), dto.id(), usuarioId, dispositivo, dto.motivo(), limpiar(dto.detalle()));
        if (repo.reportantesAbiertos(dto.tipo(), dto.id()) >= cfg.entero("reportes_para_ocultar", 3)) {
            repo.ocultarPorReportes(dto.tipo(), dto.id());
        }
        return true;
    }

    /** Exige cuenta o un dispositivo conocido. Con cuenta, el dispositivo se ignora. */
    private UUID identidad(UUID usuarioId, UUID dispositivoId) {
        if (usuarioId != null) {
            return null;
        }
        if (dispositivoId == null || !repo.dispositivoExiste(dispositivoId)) {
            throw BusinessException.invalida("Para reportar necesitamos tu cuenta o el identificador del dispositivo (X-Dispositivo-Id).");
        }
        return dispositivoId;
    }

    private void limite(int recientes) {
        if (recientes >= cfg.entero("reportes_max_por_hora", 10)) {
            throw BusinessException.demasiadasSolicitudes("Enviaste muchos reportes. Intenta de nuevo en un rato.");
        }
    }

    private static String limpiar(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
