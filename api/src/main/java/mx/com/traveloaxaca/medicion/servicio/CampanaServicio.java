package mx.com.traveloaxaca.medicion.servicio;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import mx.com.traveloaxaca.comun.error.BusinessException;
import mx.com.traveloaxaca.medicion.dto.MedicionDtos.*;
import mx.com.traveloaxaca.medicion.repo.MedicionRepositorio;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Campañas de origen: el código va en el enlace (?o=codigo) para saber qué Reel o publicación trajo al turista. */
@Service
@Transactional
public class CampanaServicio {

    private final MedicionRepositorio repo;

    public CampanaServicio(MedicionRepositorio repo) {
        this.repo = repo;
    }

    @Transactional(readOnly = true)
    public List<OrigenDto> origenes() {
        return repo.origenes();
    }

    @Transactional(readOnly = true)
    public List<CampanaDto> listar() {
        return repo.campanas();
    }

    public CampanaDto crear(CampanaEntradaDto e) {
        validarFechas(e.inicio(), e.fin());
        UUID origen = origen(e.origen());
        if (repo.codigoExiste(e.codigo())) {
            throw BusinessException.conflicto("Ya existe una campaña con el código \"" + e.codigo() + "\".");
        }
        UUID id = repo.crearCampana(origen, e.codigo(), e.nombre().trim(), e.inicio(), e.fin());
        return repo.campana(id).orElseThrow();
    }

    public CampanaDto actualizar(UUID id, CampanaCambioDto e) {
        validarFechas(e.inicio(), e.fin());
        UUID origen = origen(e.origen());
        if (repo.actualizarCampana(id, origen, e.nombre().trim(), e.inicio(), e.fin()) == 0) {
            throw BusinessException.noEncontrado("No encontramos esa campaña.");
        }
        return repo.campana(id).orElseThrow();
    }

    private UUID origen(String clave) {
        return repo.origenId(clave).orElseThrow(() -> BusinessException.invalida("Ese origen no existe.",
                Map.of("origen", "Origen no válido.")));
    }

    private static void validarFechas(java.time.LocalDate inicio, java.time.LocalDate fin) {
        if (inicio != null && fin != null && fin.isBefore(inicio)) {
            throw BusinessException.invalida("La fecha final no puede ser anterior a la inicial.",
                    Map.of("fin", "Debe ser igual o posterior al inicio."));
        }
    }
}
