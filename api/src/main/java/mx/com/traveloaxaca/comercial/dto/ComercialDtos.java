package mx.com.traveloaxaca.comercial.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import mx.com.traveloaxaca.explorar.dto.ExplorarDtos.NegocioTarjetaDto;

/** Lo que entra y sale de la parte comercial: planes, cobros, patrocinios y promociones. */
public final class ComercialDtos {

    private ComercialDtos() {
    }

    // ---------------- planes y precios ----------------

    public record PlanDto(UUID id, String clave, String nombre, int limiteFotos, int limiteOfertas,
                          boolean veEstadisticas, boolean permitePromociones, boolean permitePatrocinio,
                          boolean activo, int orden) {
    }

    public record PlanEdicionDto(
            @NotBlank(message = "Escribe el nombre del plan.") @Size(max = 60, message = "Máximo 60 caracteres.") String nombre,
            @NotNull(message = "Indica el límite de fotos.") @DecimalMin(value = "1", message = "Al menos 1 foto.") Integer limiteFotos,
            @NotNull(message = "Indica el límite de ofertas.") @DecimalMin(value = "0", message = "No puede ser negativo.") Integer limiteOfertas,
            boolean veEstadisticas, boolean permitePromociones, boolean permitePatrocinio, boolean activo,
            Integer orden) {
    }

    public record PrecioDto(UUID id, UUID planId, String planClave, UUID destinoId, UUID categoriaId, String periodo,
                            BigDecimal monto, String moneda, LocalDate vigenteDesde, LocalDate vigenteHasta) {
    }

    public record PrecioEntradaDto(
            @NotNull(message = "Elige el plan.") UUID planId,
            UUID destinoId, UUID categoriaId,
            @NotBlank(message = "Elige el periodo.") @Pattern(regexp = "^(mensual|anual)$", message = "Valores: mensual o anual.") String periodo,
            @NotNull(message = "Escribe el monto.") @DecimalMin(value = "0", message = "El monto no puede ser negativo.") BigDecimal monto,
            @Pattern(regexp = "^[A-Z]{3}$", message = "Tres letras, por ejemplo MXN.") String moneda,
            LocalDate vigenteDesde, LocalDate vigenteHasta) {
    }

    public record PlanPublicoDto(String clave, String nombre, int limiteFotos, int limiteOfertas,
                                 boolean veEstadisticas, boolean permitePromociones, boolean permitePatrocinio,
                                 List<PrecioDto> precios) {
    }

    public record CuponDto(UUID id, String codigo, String descripcion, String tipo, BigDecimal valor, String aplicaA,
                           Integer maxUsos, int usos, LocalDate vigenteDesde, LocalDate vigenteHasta) {
    }

    public record CuponEntradaDto(
            @NotBlank(message = "Escribe el código.") @Pattern(regexp = "^[A-Za-z0-9_-]{3,30}$", message = "Letras, números, guion y guion bajo (3 a 30).") String codigo,
            @Size(max = 200, message = "Máximo 200 caracteres.") String descripcion,
            @NotBlank(message = "Elige el tipo.") @Pattern(regexp = "^(pct|monto|periodo_gratis)$", message = "Valores: pct, monto, periodo_gratis.") String tipo,
            @NotNull(message = "Escribe el valor.") @DecimalMin(value = "0.01", message = "Debe ser mayor que cero.") BigDecimal valor,
            @NotBlank(message = "Indica a qué aplica.") @Pattern(regexp = "^(suscripcion|patrocinio)$", message = "Valores: suscripcion, patrocinio.") String aplicaA,
            @DecimalMin(value = "1", message = "Al menos 1 uso.") Integer maxUsos,
            LocalDate vigenteDesde, LocalDate vigenteHasta) {
    }

    public record CuponEdicionDto(
            @Size(max = 200, message = "Máximo 200 caracteres.") String descripcion,
            @DecimalMin(value = "1", message = "Al menos 1 uso.") Integer maxUsos,
            LocalDate vigenteHasta) {
    }

    // ---------------- suscripciones ----------------

    public record SuscripcionDto(UUID id, UUID negocioId, String planClave, String planNombre, String estado,
                                 LocalDate inicio, LocalDate fin, LocalDate graciaHasta, String periodo,
                                 BigDecimal monto, OffsetDateTime canceladaEn, String motivoCancelacion) {
    }

    public record UsoPlanDto(int fotos, int limiteFotos, int ofertas, int limiteOfertas) {
    }

    /** Lo que ve el dueño en "Mi plan". */
    public record PlanNegocioDto(PlanDto plan, SuscripcionDto suscripcion, UsoPlanDto uso, boolean enGracia,
                                 Integer diasRestantes, boolean gratuito) {
    }

    public record ActivarSuscripcionDto(
            @NotBlank(message = "Elige el plan.") String planClave,
            @NotBlank(message = "Elige el periodo.") @Pattern(regexp = "^(mensual|anual)$", message = "Valores: mensual o anual.") String periodo,
            @Size(max = 30, message = "Máximo 30 caracteres.") String cupon,
            @DecimalMin(value = "0", message = "El monto no puede ser negativo.") BigDecimal monto,
            Boolean pagado,
            @Pattern(regexp = "^(transferencia|efectivo|enlace_pago)$", message = "Valores: transferencia, efectivo, enlace_pago.") String metodo,
            @Size(max = 100, message = "Máximo 100 caracteres.") String referencia) {
    }

    public record CancelarSuscripcionDto(
            @NotBlank(message = "Escribe el motivo.") @Size(max = 300, message = "Máximo 300 caracteres.") String motivo) {
    }

    public record ResultadoActivacionDto(SuscripcionDto suscripcion, PagoDto pago) {
    }

    // ---------------- pagos ----------------

    public record PagoDto(UUID id, UUID negocioId, String concepto, UUID suscripcionId, UUID patrocinioId,
                          BigDecimal monto, String moneda, String metodo, String referenciaExterna, String estado,
                          OffsetDateTime pagadoEn, OffsetDateTime creadoEn) {
    }

    public record PagoEntradaDto(
            @NotNull(message = "Elige el negocio.") UUID negocioId,
            @NotBlank(message = "Elige el concepto.") @Pattern(regexp = "^(patrocinio|otro)$", message = "Valores: patrocinio, otro.") String concepto,
            UUID patrocinioId,
            @NotNull(message = "Escribe el monto.") @DecimalMin(value = "0", message = "El monto no puede ser negativo.") BigDecimal monto,
            @NotBlank(message = "Elige el método.") @Pattern(regexp = "^(transferencia|efectivo|enlace_pago)$", message = "Valores: transferencia, efectivo, enlace_pago.") String metodo,
            @Size(max = 100, message = "Máximo 100 caracteres.") String referencia,
            Boolean pagado) {
    }

    public record PagoEstadoDto(
            @NotBlank(message = "Elige el estado.") @Pattern(regexp = "^(pagado|fallido|reembolsado)$", message = "Valores: pagado, fallido, reembolsado.") String estado,
            @Size(max = 100, message = "Máximo 100 caracteres.") String referencia) {
    }

    // ---------------- patrocinios ----------------

    public record EspacioDto(UUID id, UUID destinoId, String clave, UUID categoriaId, UUID regionId,
                             int maxSimultaneos, boolean activo) {
    }

    public record EspacioEntradaDto(
            UUID destinoId,
            @Pattern(regexp = "^(destacado_explorar|destacado_categoria|banner_mapa|resultado_busqueda)$", message = "Clave de espacio no válida.") String clave,
            UUID categoriaId, UUID regionId,
            @NotNull(message = "Indica cuántos caben a la vez.") @DecimalMin(value = "1", message = "Al menos 1.") Integer maxSimultaneos,
            Boolean activo) {
    }

    public record PatrocinioDto(UUID id, UUID espacioId, String espacioClave, UUID negocioId, String negocioNombre,
                                LocalDate inicio, LocalDate fin, String estado, BigDecimal precio, String moneda,
                                UUID pagoId) {
    }

    public record PagoPatrocinioDto(
            @NotBlank(message = "Elige el método.") @Pattern(regexp = "^(transferencia|efectivo|enlace_pago)$", message = "Valores: transferencia, efectivo, enlace_pago.") String metodo,
            @Size(max = 100, message = "Máximo 100 caracteres.") String referencia,
            Boolean pagado) {
    }

    public record PatrocinioEntradaDto(
            @NotNull(message = "Elige el espacio.") UUID espacioId,
            @NotNull(message = "Elige el negocio.") UUID negocioId,
            @NotNull(message = "Indica cuándo empieza.") LocalDate inicio,
            @NotNull(message = "Indica cuándo termina.") LocalDate fin,
            @NotNull(message = "Escribe el precio.") @DecimalMin(value = "0", message = "El precio no puede ser negativo.") BigDecimal precio,
            @Size(max = 30, message = "Máximo 30 caracteres.") String cupon,
            @Valid PagoPatrocinioDto pago) {
    }

    /** Un destacado listo para mostrarse: siempre lleva la marca de patrocinado. */
    public record DestacadoDto(NegocioTarjetaDto negocio, boolean patrocinado, String espacio) {
    }

    public record ConfigAppDto(boolean anunciosTercerosActivos, boolean reservasActivas) {
    }

    // ---------------- promociones ----------------

    public record PromocionTextoDto(
            @NotBlank(message = "Indica el idioma.") @Pattern(regexp = "^[a-z]{2}$", message = "Idioma de dos letras.") String idioma,
            @NotBlank(message = "Escribe el título.") @Size(max = 100, message = "Máximo 100 caracteres.") String titulo,
            @Size(max = 500, message = "Máximo 500 caracteres.") String descripcion) {
    }

    public record PromocionEntradaDto(
            UUID ofertaId,
            @NotBlank(message = "Elige el tipo.") @Pattern(regexp = "^(descuento_pct|descuento_monto|dos_por_uno|regalo)$", message = "Tipo de promoción no válido.") String tipo,
            @DecimalMin(value = "0.01", message = "Debe ser mayor que cero.") BigDecimal valor,
            @Pattern(regexp = "^[A-Za-z0-9_-]{3,30}$", message = "Letras, números, guion y guion bajo (3 a 30).") String codigo,
            @NotNull(message = "Indica cuándo empieza.") LocalDate inicio,
            @NotNull(message = "Indica cuándo termina.") LocalDate fin,
            @Size(max = 500, message = "Máximo 500 caracteres.") String condiciones,
            @NotNull(message = "Escribe al menos el título en español.") @Size(min = 1, max = 10, message = "Entre 1 y 10 idiomas.") List<@Valid PromocionTextoDto> textos) {
    }

    public record PromocionDto(UUID id, UUID negocioId, UUID ofertaId, String tipo, BigDecimal valor, String codigo,
                               LocalDate inicio, LocalDate fin, String condiciones, String estado,
                               String motivoRechazo, List<PromocionTextoDto> textos) {
    }

    public record PromocionColaDto(PromocionDto promocion, String negocioNombre, OffsetDateTime enviadaEn) {
    }

    public record RechazoDto(
            @NotBlank(message = "Escribe el motivo.") @Size(max = 300, message = "Máximo 300 caracteres.") String motivo) {
    }

    public record PromocionPublicaDto(UUID id, String tipo, BigDecimal valor, String codigo, LocalDate inicio,
                                      LocalDate fin, String titulo, String descripcion, String condiciones,
                                      UUID ofertaId) {
    }

    // ---------------- verificaciones ----------------

    public record VerificacionEntradaDto(
            @NotBlank(message = "Elige el método.") @Pattern(regexp = "^(whatsapp|llamada|visita|documento)$", message = "Valores: whatsapp, llamada, visita, documento.") String metodo,
            @NotBlank(message = "Elige el resultado.") @Pattern(regexp = "^(aprobada|rechazada)$", message = "Valores: aprobada, rechazada.") String resultado,
            @Size(max = 500, message = "Máximo 500 caracteres.") String notas,
            OffsetDateTime vigenteHasta, UUID evidenciaMedioId) {
    }

    public record VerificacionDto(UUID id, UUID negocioId, String metodo, String resultado, String notas,
                                  OffsetDateTime fecha, OffsetDateTime vigenteHasta, String verificadaPorNombre) {
    }
}
