package mx.com.traveloaxaca.negocios.servicio;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import mx.com.traveloaxaca.comun.error.BusinessException;
import mx.com.traveloaxaca.negocios.dto.NegocioDtos.*;
import mx.com.traveloaxaca.negocios.repo.FichaRepositorio;
import mx.com.traveloaxaca.negocios.repo.FichaRepositorio.ExcepcionFila;
import mx.com.traveloaxaca.negocios.repo.FichaRepositorio.HorarioFila;
import mx.com.traveloaxaca.negocios.repo.FichaRepositorio.SucursalFila;
import mx.com.traveloaxaca.negocios.servicio.AccesoNegocio.Contexto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Sucursales con su ubicación, horarios y fechas especiales. */
@Service
public class SucursalServicio {

    private static final int MAX_SUCURSALES = 20;
    private static final int MAX_TRAMOS_POR_DIA = 3;

    private final FichaRepositorio ficha;
    private final AccesoNegocio acceso;
    private final FichaServicio fichas;
    private final RevisionServicio revision;

    public SucursalServicio(FichaRepositorio ficha, AccesoNegocio acceso, FichaServicio fichas,
                            RevisionServicio revision) {
        this.ficha = ficha;
        this.acceso = acceso;
        this.fichas = fichas;
        this.revision = revision;
    }

    @Transactional
    public ResultadoCambio crear(Actor actor, UUID negocioId, SucursalEntradaDto dto) {
        Contexto ctx = acceso.editar(actor, negocioId);
        validarLugar(dto);
        if (ficha.contarSucursales(negocioId) >= MAX_SUCURSALES) {
            throw BusinessException.conflicto("Llegaste al máximo de " + MAX_SUCURSALES + " sucursales.");
        }
        boolean publicada = "publicada".equals(ctx.negocio().estado());
        boolean primera = ficha.contarSucursales(negocioId) == 0;
        boolean principal = primera || Boolean.TRUE.equals(dto.esPrincipal());
        if (principal && !primera) {
            if (publicada) {
                throw cambioDePrincipal();
            }
            ficha.quitarPrincipalDeOtras(negocioId, UUID.randomUUID());
        }
        ficha.crearSucursal(negocioId, Validaciones.limpiar(dto.nombre()), principal, dto.municipioId(),
                dto.localidadId(), Validaciones.limpiar(dto.direccionTexto()), Validaciones.limpiar(dto.referencia()),
                dto.latitud(), dto.longitud());
        return fichas.terminar(ctx, true, false);
    }

    @Transactional
    public ResultadoCambio actualizar(Actor actor, UUID negocioId, UUID sucursalId, SucursalEntradaDto dto) {
        Contexto ctx = acceso.editar(actor, negocioId);
        SucursalFila actual = existente(negocioId, sucursalId);
        validarLugar(dto);
        boolean publicada = "publicada".equals(ctx.negocio().estado());
        boolean pendiente = false;

        if (Boolean.TRUE.equals(dto.esPrincipal()) && !actual.esPrincipal()) {
            if (publicada) {
                throw cambioDePrincipal();
            }
            ficha.quitarPrincipalDeOtras(negocioId, sucursalId);
            ficha.marcarPrincipal(sucursalId);
        } else if (Boolean.FALSE.equals(dto.esPrincipal()) && actual.esPrincipal()) {
            throw BusinessException.invalida("Elige primero otra sucursal como principal.",
                    Map.of("esPrincipal", "Marca otra sucursal como principal en lugar de quitar esta."));
        }

        boolean ubicacionCambia = !igual(actual.latitud(), dto.latitud()) || !igual(actual.longitud(), dto.longitud());
        if (actual.esPrincipal() && publicada && ubicacionCambia) {
            if (dto.latitud() == null) {
                throw BusinessException.invalida("La ubicación de tu ficha publicada no se puede quitar.",
                        Map.of("latitud", "Marca la nueva ubicación en el mapa."));
            }
            ficha.actualizarSucursalSinUbicacion(sucursalId, Validaciones.limpiar(dto.nombre()), dto.municipioId(),
                    dto.localidadId(), Validaciones.limpiar(dto.direccionTexto()), Validaciones.limpiar(dto.referencia()));
            Map<String, Object> antes = new LinkedHashMap<>();
            antes.put("latitud", actual.latitud());
            antes.put("longitud", actual.longitud());
            Map<String, Object> despues = new LinkedHashMap<>();
            despues.put("latitud", dto.latitud());
            despues.put("longitud", dto.longitud());
            revision.proponer(negocioId, actor.usuarioId(), "sucursal_principal_ubicacion", antes, despues);
            pendiente = true;
        } else {
            ficha.actualizarSucursal(sucursalId, Validaciones.limpiar(dto.nombre()), dto.municipioId(),
                    dto.localidadId(), Validaciones.limpiar(dto.direccionTexto()), Validaciones.limpiar(dto.referencia()),
                    dto.latitud(), dto.longitud());
        }
        return fichas.terminar(ctx, true, pendiente);
    }

    @Transactional
    public ResultadoCambio eliminar(Actor actor, UUID negocioId, UUID sucursalId) {
        Contexto ctx = acceso.editar(actor, negocioId);
        SucursalFila s = existente(negocioId, sucursalId);
        if (s.esPrincipal()) {
            throw BusinessException.conflicto("La sucursal principal no se puede eliminar. Marca otra como principal primero.");
        }
        ficha.eliminarSucursal(sucursalId);
        return fichas.terminar(ctx, true, false);
    }

    // ---------------- horarios ----------------

    @Transactional
    public ResultadoCambio guardarHorarios(Actor actor, UUID negocioId, UUID sucursalId, HorariosDto dto) {
        Contexto ctx = acceso.editar(actor, negocioId);
        existente(negocioId, sucursalId);
        List<HorarioFila> filas = new ArrayList<>();
        Map<Integer, Integer> porDia = new LinkedHashMap<>();
        for (HorarioEntradaDto h : dto.horarios()) {
            boolean cerrado = Boolean.TRUE.equals(h.cerrado());
            if (cerrado) {
                filas.add(new HorarioFila(sucursalId, h.diaSemana(), null, null, true));
            } else {
                if (h.abre() == null || h.cierra() == null) {
                    throw BusinessException.invalida("Indica a qué hora abre y a qué hora cierra, o marca el día como cerrado.",
                            Map.of("horarios", "Falta la hora de apertura o de cierre."));
                }
                filas.add(new HorarioFila(sucursalId, h.diaSemana(), h.abre(), h.cierra(), false));
            }
            if (porDia.merge(h.diaSemana(), 1, Integer::sum) > MAX_TRAMOS_POR_DIA) {
                throw BusinessException.invalida("Máximo " + MAX_TRAMOS_POR_DIA + " horarios por día.",
                        Map.of("horarios", "Demasiados horarios en el mismo día."));
            }
        }
        ficha.reemplazarHorarios(sucursalId, filas);
        return fichas.terminar(ctx, true, false);
    }

    @Transactional
    public ResultadoCambio guardarExcepciones(Actor actor, UUID negocioId, UUID sucursalId, ExcepcionesDto dto) {
        Contexto ctx = acceso.editar(actor, negocioId);
        existente(negocioId, sucursalId);
        Map<LocalDate, ExcepcionFila> porFecha = new LinkedHashMap<>();
        for (ExcepcionEntradaDto e : dto.excepciones()) {
            if (e.fecha().isBefore(LocalDate.now())) {
                throw BusinessException.invalida("Las fechas especiales deben ser de hoy en adelante.",
                        Map.of("excepciones", "Hay una fecha que ya pasó."));
            }
            boolean cerrado = Boolean.TRUE.equals(e.cerrado());
            if (!cerrado && (e.abre() == null || e.cierra() == null)) {
                throw BusinessException.invalida("Indica el horario de cada fecha especial, o márcala como cerrada.",
                        Map.of("excepciones", "Falta la hora de apertura o de cierre."));
            }
            porFecha.put(e.fecha(), new ExcepcionFila(sucursalId, e.fecha(), cerrado ? null : e.abre(),
                    cerrado ? null : e.cierra(), cerrado, Validaciones.limpiar(e.nota())));
        }
        ficha.reemplazarExcepciones(sucursalId, new ArrayList<>(porFecha.values()));
        return fichas.terminar(ctx, true, false);
    }

    // ---------------- apoyo ----------------

    private SucursalFila existente(UUID negocioId, UUID sucursalId) {
        return ficha.sucursal(negocioId, sucursalId)
                .orElseThrow(() -> BusinessException.noEncontrado("No encontramos esa sucursal."));
    }

    private void validarLugar(SucursalEntradaDto dto) {
        Validaciones.ubicacion(dto.latitud(), dto.longitud());
        if (!ficha.municipioActivo(dto.municipioId())) {
            throw BusinessException.invalida("El municipio no existe.", Map.of("municipioId", "Elige un municipio de la lista."));
        }
        if (dto.localidadId() != null && !ficha.localidadEsDeMunicipio(dto.localidadId(), dto.municipioId())) {
            throw BusinessException.invalida("Esa localidad no pertenece al municipio elegido.",
                    Map.of("localidadId", "Elige una localidad del municipio."));
        }
    }

    private static BusinessException cambioDePrincipal() {
        return BusinessException.conflicto(
                "No se puede cambiar cuál es la sucursal principal de una ficha publicada. Edita la ubicación de la actual.");
    }

    private static boolean igual(Double a, Double b) {
        if (a == null || b == null) {
            return Objects.equals(a, b);
        }
        return Math.abs(a - b) < 1e-6;
    }
}
