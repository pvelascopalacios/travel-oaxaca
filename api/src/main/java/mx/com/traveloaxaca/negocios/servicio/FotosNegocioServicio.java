package mx.com.traveloaxaca.negocios.servicio;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import mx.com.traveloaxaca.comercial.servicio.PlanServicio;
import mx.com.traveloaxaca.comun.error.BusinessException;
import mx.com.traveloaxaca.negocios.almacen.AlmacenMedios;
import mx.com.traveloaxaca.negocios.dto.NegocioDtos.*;
import mx.com.traveloaxaca.negocios.repo.FichaRepositorio;
import mx.com.traveloaxaca.negocios.repo.MedioRepositorio;
import mx.com.traveloaxaca.negocios.servicio.AccesoNegocio.Contexto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Fotos ya subidas y confirmadas que se ligan a la ficha. Las nuevas esperan aprobación del equipo. */
@Service
public class FotosNegocioServicio {

    private static final int MAX_FOTOS = 20;

    private final FichaRepositorio ficha;
    private final MedioRepositorio medios;
    private final AlmacenMedios almacen;
    private final AccesoNegocio acceso;
    private final FichaServicio fichas;
    private final PlanServicio planes;

    public FotosNegocioServicio(FichaRepositorio ficha, MedioRepositorio medios, AlmacenMedios almacen,
                                AccesoNegocio acceso, FichaServicio fichas, PlanServicio planes) {
        this.planes = planes;
        this.ficha = ficha;
        this.medios = medios;
        this.almacen = almacen;
        this.acceso = acceso;
        this.fichas = fichas;
    }

    @Transactional
    public ResultadoCambio agregar(Actor actor, UUID negocioId, AgregarMedioDto dto) {
        Contexto ctx = acceso.editar(actor, negocioId);
        var m = medios.porId(dto.medioId())
                .filter(x -> actor.usuarioId().equals(x.subidoPor()))
                .orElseThrow(() -> BusinessException.noEncontrado("No encontramos esa foto."));
        if (m.hash() == null) {
            throw BusinessException.invalida("Esa foto todavía no está confirmada. Confírmala antes de agregarla.");
        }
        if (ficha.medioYaVinculado(negocioId, m.id())) {
            throw BusinessException.conflicto("Esa foto ya está en tu ficha.");
        }
        planes.exigirCupoFotos(negocioId);
        long total = ficha.contarMedios(negocioId);
        if (total >= MAX_FOTOS) {
            throw BusinessException.conflicto("Llegaste al máximo de " + MAX_FOTOS + " fotos.");
        }
        ficha.agregarMedio(negocioId, m.id(), (int) total, total == 0, Validaciones.limpiar(dto.pieTexto()));
        return fichas.terminar(ctx, true, false);
    }

    @Transactional
    public ResultadoCambio quitar(Actor actor, UUID negocioId, UUID medioId) {
        Contexto ctx = acceso.editar(actor, negocioId);
        var vinculada = ficha.medios(negocioId).stream().filter(x -> x.medioId().equals(medioId)).findFirst()
                .orElseThrow(() -> BusinessException.noEncontrado("No encontramos esa foto en tu ficha."));
        ficha.quitarMedio(negocioId, medioId);
        if ("publicada".equals(ctx.negocio().estado()) && ficha.contarFotosAprobadas(negocioId) < ficha.fotosMinimas()) {
            throw BusinessException.conflicto("Tu ficha publicada necesita al menos " + ficha.fotosMinimas()
                    + " fotos aprobadas. Sube otra antes de quitar esta.");
        }
        if (vinculada.esPortada()) {
            ficha.medios(negocioId).stream().findFirst().ifPresent(p -> ficha.ponerPortada(negocioId, p.medioId()));
        }
        medios.marcarEliminado(medioId);
        try {
            almacen.borrar(vinculada.claveAlmacenamiento());
        } catch (RuntimeException ignorado) {
            // El archivo queda huérfano en el almacén; no debe impedir quitar la foto.
        }
        return fichas.terminar(ctx, true, false);
    }

    @Transactional
    public ResultadoCambio ordenar(Actor actor, UUID negocioId, OrdenMediosDto dto) {
        Contexto ctx = acceso.editar(actor, negocioId);
        List<UUID> actuales = ficha.medios(negocioId).stream().map(x -> x.medioId()).toList();
        if (dto.orden().size() != actuales.size() || !new HashSet<>(dto.orden()).equals(new HashSet<>(actuales))) {
            throw BusinessException.invalida("La lista debe incluir todas tus fotos, una sola vez.",
                    Map.of("orden", "Envía todas las fotos de la ficha, sin repetir."));
        }
        if (dto.portadaId() != null && !actuales.contains(dto.portadaId())) {
            throw BusinessException.invalida("La portada debe ser una de tus fotos.", Map.of("portadaId", "Foto no válida."));
        }
        for (int i = 0; i < dto.orden().size(); i++) {
            ficha.ponerOrden(negocioId, dto.orden().get(i), i);
        }
        if (dto.portadaId() != null) {
            ficha.ponerPortada(negocioId, dto.portadaId());
        }
        return fichas.terminar(ctx, true, false);
    }
}
