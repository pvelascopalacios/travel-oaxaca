package mx.com.traveloaxaca.negocios.servicio;

import java.util.Map;
import java.util.UUID;
import mx.com.traveloaxaca.comun.error.BusinessException;
import mx.com.traveloaxaca.negocios.dto.NegocioDtos.*;
import mx.com.traveloaxaca.negocios.repo.FichaRepositorio;
import mx.com.traveloaxaca.negocios.servicio.AccesoNegocio.Contexto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ContactoServicio {

    private static final int MAX_CONTACTOS = 30;

    private final FichaRepositorio ficha;
    private final AccesoNegocio acceso;
    private final FichaServicio fichas;

    public ContactoServicio(FichaRepositorio ficha, AccesoNegocio acceso, FichaServicio fichas) {
        this.ficha = ficha;
        this.acceso = acceso;
        this.fichas = fichas;
    }

    @Transactional
    public ResultadoCambio crear(Actor actor, UUID negocioId, ContactoEntradaDto dto) {
        Contexto ctx = acceso.editar(actor, negocioId);
        String valor = dto.valor().trim();
        Validaciones.contacto(dto.tipo(), valor);
        sucursalValida(negocioId, dto.sucursalId());
        if (ficha.contarContactos(negocioId) >= MAX_CONTACTOS) {
            throw BusinessException.conflicto("Llegaste al máximo de " + MAX_CONTACTOS + " contactos.");
        }
        boolean principal = Boolean.TRUE.equals(dto.esPrincipal()) || !ficha.hayContactoDeTipo(negocioId, dto.tipo());
        if (principal) {
            ficha.quitarPrincipalDeTipo(negocioId, dto.tipo(), null);
        }
        ficha.crearContacto(negocioId, dto.sucursalId(), dto.tipo(), valor, principal);
        return fichas.terminar(ctx, true, false);
    }

    @Transactional
    public ResultadoCambio actualizar(Actor actor, UUID negocioId, UUID contactoId, ContactoEntradaDto dto) {
        Contexto ctx = acceso.editar(actor, negocioId);
        var actual = ficha.contacto(negocioId, contactoId)
                .orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese contacto."));
        String valor = dto.valor().trim();
        Validaciones.contacto(dto.tipo(), valor);
        sucursalValida(negocioId, dto.sucursalId());
        boolean principal = Boolean.TRUE.equals(dto.esPrincipal());
        if (principal) {
            ficha.quitarPrincipalDeTipo(negocioId, dto.tipo(), contactoId);
        }
        ficha.actualizarContacto(contactoId, dto.sucursalId(), dto.tipo(), valor, principal);
        exigirContactoSiPublicada(ctx, negocioId);
        return fichas.terminar(ctx, true, false);
    }

    @Transactional
    public ResultadoCambio eliminar(Actor actor, UUID negocioId, UUID contactoId) {
        Contexto ctx = acceso.editar(actor, negocioId);
        ficha.contacto(negocioId, contactoId)
                .orElseThrow(() -> BusinessException.noEncontrado("No encontramos ese contacto."));
        ficha.eliminarContacto(contactoId);
        exigirContactoSiPublicada(ctx, negocioId);
        return fichas.terminar(ctx, true, false);
    }

    /** Una ficha publicada no puede quedarse sin WhatsApp ni teléfono. Al lanzar, la transacción se deshace. */
    private void exigirContactoSiPublicada(Contexto ctx, UUID negocioId) {
        if ("publicada".equals(ctx.negocio().estado())
                && !ficha.hayContactoDeTipo(negocioId, "whatsapp") && !ficha.hayContactoDeTipo(negocioId, "telefono")) {
            throw BusinessException.conflicto("Tu ficha publicada necesita al menos un WhatsApp o un teléfono de contacto.");
        }
    }

    private void sucursalValida(UUID negocioId, UUID sucursalId) {
        if (sucursalId != null && ficha.sucursal(negocioId, sucursalId).isEmpty()) {
            throw BusinessException.invalida("Esa sucursal no es de tu negocio.", Map.of("sucursalId", "Sucursal no válida."));
        }
    }
}
