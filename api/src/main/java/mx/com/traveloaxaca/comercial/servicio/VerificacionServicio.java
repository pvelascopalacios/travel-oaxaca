package mx.com.traveloaxaca.comercial.servicio;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.VerificacionDto;
import mx.com.traveloaxaca.comercial.dto.ComercialDtos.VerificacionEntradaDto;
import mx.com.traveloaxaca.comercial.repo.PromocionRepositorio;
import mx.com.traveloaxaca.comun.error.BusinessException;
import mx.com.traveloaxaca.negocios.repo.NegocioRepositorio;
import mx.com.traveloaxaca.negocios.servicio.AccesoNegocio;
import mx.com.traveloaxaca.negocios.servicio.Actor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Registro de verificaciones: cómo y cuándo se comprobó que el negocio es quien dice ser. */
@Service
public class VerificacionServicio {

    private final PromocionRepositorio repo;
    private final NegocioRepositorio negocios;
    private final AccesoNegocio acceso;

    public VerificacionServicio(PromocionRepositorio repo, NegocioRepositorio negocios, AccesoNegocio acceso) {
        this.repo = repo;
        this.negocios = negocios;
        this.acceso = acceso;
    }

    @Transactional(readOnly = true)
    public List<VerificacionDto> historial(Actor actor, UUID negocioId) {
        acceso.leer(actor, negocioId);
        return repo.verificaciones(negocioId);
    }

    /** Una aprobada marca al negocio como verificado (lo hace un disparador de la base). Una rechazada solo queda en el historial. */
    @Transactional
    public VerificacionDto registrar(Actor actor, UUID negocioId, VerificacionEntradaDto dto) {
        if (!actor.puedeEditarTodo()) {
            throw BusinessException.prohibido("Solo administración y edición registran verificaciones.");
        }
        negocios.porId(negocioId).orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese negocio."));
        if (dto.vigenteHasta() != null && dto.vigenteHasta().isBefore(OffsetDateTime.now())) {
            throw BusinessException.invalida("La vigencia ya pasó.", java.util.Map.of("vigenteHasta", "Elige una fecha futura."));
        }
        if (dto.evidenciaMedioId() != null && !repo.medioExiste(dto.evidenciaMedioId())) {
            throw BusinessException.noEncontrado("No encontramos el archivo de evidencia.");
        }
        String notas = dto.notas() == null || dto.notas().isBlank() ? null : dto.notas().trim();
        UUID id = repo.registrarVerificacion(negocioId, dto.metodo(), dto.resultado(), notas, dto.vigenteHasta(),
                dto.evidenciaMedioId(), actor.usuarioId());
        return repo.verificacion(id).orElseThrow();
    }
}
