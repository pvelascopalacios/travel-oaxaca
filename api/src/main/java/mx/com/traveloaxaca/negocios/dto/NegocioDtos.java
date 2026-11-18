package mx.com.traveloaxaca.negocios.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Cuerpos de petición y respuesta de catálogos, fotos y negocios. Mensajes de validación en español. */
public final class NegocioDtos {

    private NegocioDtos() {
    }

    private static final String HORA = "^([01][0-9]|2[0-3]):[0-5][0-9]$";
    private static final String CLAVE = "^[a-z0-9_]+$";

    // =============== catálogos (salida) ===============

    public record IdiomaDto(String codigo, String nombre, boolean esIndigena) {
    }

    public record DestinoDto(UUID id, String codigo, String nombre) {
    }

    public record RegionDto(UUID id, String slug, String nombre) {
    }

    public record MunicipioDto(UUID id, UUID regionId, String claveInegi, String nombre, Double latitud,
                               Double longitud) {
    }

    public record LocalidadDto(UUID id, UUID municipioId, String nombre, Double latitud, Double longitud) {
    }

    public record CategoriaDto(UUID id, UUID padreId, String clave, String nombre, String icono, int orden,
                               List<CategoriaDto> hijas) {
    }

    public record ServicioDto(UUID id, String clave, String grupo, String icono, String nombre) {
    }

    // =============== catálogos (admin, entrada) ===============

    public record CategoriaAdminDto(
            UUID padreId,
            @NotBlank(message = "Escribe la clave.") @Pattern(regexp = CLAVE, message = "La clave solo lleva minúsculas, números y guion bajo.") String clave,
            @Size(max = 60, message = "Icono demasiado largo.") String icono,
            Integer orden,
            Boolean activa,
            @NotNull(message = "Escribe al menos el nombre en español.") Map<String, String> nombres) {
    }

    public record ServicioAdminDto(
            @NotBlank(message = "Escribe la clave.") @Pattern(regexp = CLAVE, message = "La clave solo lleva minúsculas, números y guion bajo.") String clave,
            @NotBlank(message = "Indica el grupo.") @Pattern(regexp = "^(hospedaje|comida|tour|general)$", message = "Grupo no válido.") String grupo,
            @Size(max = 60, message = "Icono demasiado largo.") String icono,
            Boolean activo,
            @NotNull(message = "Escribe al menos el nombre en español.") Map<String, String> nombres) {
    }

    public record MunicipioAdminDto(
            @NotNull(message = "Indica la región.") UUID regionId,
            @Pattern(regexp = "^[0-9]{5}$", message = "La clave INEGI tiene 5 dígitos, por ejemplo 20067.") String claveInegi,
            @NotBlank(message = "Escribe el nombre.") @Size(max = 120, message = "Nombre demasiado largo.") String nombre,
            @DecimalMin(value = "-90", message = "Latitud no válida.") @DecimalMax(value = "90", message = "Latitud no válida.") Double latitud,
            @DecimalMin(value = "-180", message = "Longitud no válida.") @DecimalMax(value = "180", message = "Longitud no válida.") Double longitud,
            Boolean activo) {
    }

    public record LocalidadAdminDto(
            @NotNull(message = "Indica el municipio.") UUID municipioId,
            @NotBlank(message = "Escribe el nombre.") @Size(max = 120, message = "Nombre demasiado largo.") String nombre,
            @DecimalMin(value = "-90", message = "Latitud no válida.") @DecimalMax(value = "90", message = "Latitud no válida.") Double latitud,
            @DecimalMin(value = "-180", message = "Longitud no válida.") @DecimalMax(value = "180", message = "Longitud no válida.") Double longitud,
            Boolean activo) {
    }

    // =============== fotos ===============

    public record SubidaDto(
            @NotBlank(message = "Indica el tipo de archivo.") @Pattern(regexp = "^image/(jpeg|png|webp)$", message = "Solo se aceptan fotos JPEG, PNG o WebP.") String mime,
            @NotNull(message = "Indica el tamaño del archivo.") @Min(value = 1, message = "El archivo está vacío.") Long bytes) {
    }

    public record SubidaRespuesta(UUID medioId, String urlSubida, String metodo, Map<String, String> encabezados,
                                  long expiraEnSegundos) {
    }

    public record MedioDto(UUID id, String url, Integer ancho, Integer alto, String moderacion) {
    }

    // =============== negocio (entrada) ===============

    public record NuevoNegocioDto(
            @NotBlank(message = "Escribe el nombre del negocio.") @Size(max = 150, message = "El nombre es demasiado largo.") String nombreComercial,
            @NotNull(message = "Elige una categoría.") UUID categoriaId,
            @NotNull(message = "Elige el municipio.") UUID municipioId) {
    }

    public record ActualizarNegocioDto(
            @NotBlank(message = "Escribe el nombre del negocio.") @Size(max = 150, message = "El nombre es demasiado largo.") String nombreComercial,
            @Size(max = 200, message = "La razón social es demasiado larga.") String razonSocial,
            @NotNull(message = "Elige una categoría.") UUID categoriaId,
            @Min(value = 1, message = "El rango de precio va de 1 a 4.") @Max(value = 4, message = "El rango de precio va de 1 a 4.") Integer rangoPrecio,
            @DecimalMin(value = "0", message = "El precio no puede ser negativo.") @Max(value = 99999999, message = "Precio demasiado alto.") BigDecimal precioDesde,
            @Pattern(regexp = "^(por_noche|por_persona|por_grupo)$", message = "Unidad de precio no válida.") String unidadPrecio,
            Map<String, Object> atributos) {
    }

    public record TraduccionDto(
            @Size(max = 160, message = "La descripción corta admite hasta 160 caracteres.") String descripcionCorta,
            @Size(max = 8000, message = "La descripción es demasiado larga.") String descripcion,
            @Size(max = 4000, message = "Las políticas son demasiado largas.") String politicas) {
    }

    public record SucursalEntradaDto(
            @Size(max = 120, message = "Nombre demasiado largo.") String nombre,
            Boolean esPrincipal,
            @NotNull(message = "Elige el municipio.") UUID municipioId,
            UUID localidadId,
            @Size(max = 300, message = "Dirección demasiado larga.") String direccionTexto,
            @Size(max = 300, message = "Referencia demasiado larga.") String referencia,
            @DecimalMin(value = "-90", message = "Latitud no válida.") @DecimalMax(value = "90", message = "Latitud no válida.") Double latitud,
            @DecimalMin(value = "-180", message = "Longitud no válida.") @DecimalMax(value = "180", message = "Longitud no válida.") Double longitud) {
    }

    public record ContactoEntradaDto(
            @NotBlank(message = "Indica el tipo de contacto.") @Pattern(regexp = "^(whatsapp|telefono|correo|web|facebook|instagram|tiktok|reservas_url)$", message = "Tipo de contacto no válido.") String tipo,
            @NotBlank(message = "Escribe el dato de contacto.") @Size(max = 300, message = "Dato demasiado largo.") String valor,
            UUID sucursalId,
            Boolean esPrincipal) {
    }

    public record HorarioEntradaDto(
            @NotNull(message = "Indica el día.") @Min(value = 0, message = "El día va de 0 (domingo) a 6.") @Max(value = 6, message = "El día va de 0 (domingo) a 6.") Integer diaSemana,
            @Pattern(regexp = HORA, message = "Usa el formato HH:mm, por ejemplo 08:30.") String abre,
            @Pattern(regexp = HORA, message = "Usa el formato HH:mm, por ejemplo 21:00.") String cierra,
            Boolean cerrado) {
    }

    public record HorariosDto(@NotNull(message = "Envía la lista de horarios.") @Size(max = 50, message = "Demasiados horarios.") List<@Valid HorarioEntradaDto> horarios) {
    }

    public record ExcepcionEntradaDto(
            @NotNull(message = "Indica la fecha.") java.time.LocalDate fecha,
            @Pattern(regexp = HORA, message = "Usa el formato HH:mm.") String abre,
            @Pattern(regexp = HORA, message = "Usa el formato HH:mm.") String cierra,
            Boolean cerrado,
            @Size(max = 200, message = "Nota demasiado larga.") String nota) {
    }

    public record ExcepcionesDto(@NotNull(message = "Envía la lista de fechas.") @Size(max = 100, message = "Demasiadas fechas.") List<@Valid ExcepcionEntradaDto> excepciones) {
    }

    public record ServiciosEntradaDto(@NotNull(message = "Envía la lista de servicios.") @Size(max = 60, message = "Demasiados servicios.") List<UUID> servicioIds) {
    }

    public record IdiomaNivelDto(
            @NotBlank(message = "Indica el idioma.") String idiomaCodigo,
            @Pattern(regexp = "^(basico|fluido)$", message = "Nivel no válido.") String nivel) {
    }

    public record IdiomasEntradaDto(@NotNull(message = "Envía la lista de idiomas.") @Size(max = 10, message = "Demasiados idiomas.") List<@Valid IdiomaNivelDto> idiomas) {
    }

    public record AgregarMedioDto(
            @NotNull(message = "Indica la foto.") UUID medioId,
            @Size(max = 200, message = "Pie de foto demasiado largo.") String pieTexto) {
    }

    public record OrdenMediosDto(
            @NotNull(message = "Envía el orden de las fotos.") List<UUID> orden,
            UUID portadaId) {
    }

    public record OfertaTraduccionDto(
            @NotBlank(message = "Escribe el nombre.") @Size(max = 150, message = "Nombre demasiado largo.") String nombre,
            @Size(max = 4000, message = "Descripción demasiado larga.") String descripcion,
            @Size(max = 2000, message = "Texto demasiado largo.") String incluye,
            @Size(max = 2000, message = "Texto demasiado largo.") String noIncluye) {
    }

    public record OfertaEntradaDto(
            @NotBlank(message = "Indica el tipo.") @Pattern(regexp = "^(habitacion|tour|platillo|producto|experiencia)$", message = "Tipo de oferta no válido.") String tipo,
            @DecimalMin(value = "0", message = "El precio no puede ser negativo.") @Max(value = 99999999, message = "Precio demasiado alto.") BigDecimal precioDesde,
            @Pattern(regexp = "^(por_noche|por_persona|por_grupo|por_pieza)$", message = "Unidad de precio no válida.") String unidadPrecio,
            @Min(value = 1, message = "La duración debe ser positiva.") Integer duracionMin,
            @Min(value = 1, message = "La capacidad debe ser positiva.") Integer capacidad,
            Integer orden,
            @Pattern(regexp = "^(entradas|platos_fuertes|bebidas|postres|otros)$", message = "Sección del menú no válida.") String seccion,
            @Size(max = 3, message = "Máximo 3 marcas.") List<String> etiquetas,
            @NotNull(message = "Escribe el nombre en español.") Map<String, @Valid OfertaTraduccionDto> traducciones) {
    }

    public record EstadoOfertaDto(
            @NotBlank(message = "Indica el estado.") @Pattern(regexp = "^(borrador|publicada|pausada|archivada)$", message = "Estado no válido.") String estado) {
    }

    public record InvitarDto(@NotBlank(message = "Escribe el correo.") @Pattern(regexp = "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", message = "Escribe un correo válido.") String correo) {
    }

    public record ResponderInvitacionDto(@NotNull(message = "Indica si aceptas.") Boolean acepta) {
    }

    // =============== negocio (salida) ===============

    public record NegocioResumenDto(UUID id, String slug, String nombreComercial, String estado, UUID categoriaId,
                                    String categoriaClave, int puntajeFicha, String rolMiembro, String portadaUrl,
                                    OffsetDateTime actualizadoEn) {
    }

    public record SucursalDto(UUID id, String nombre, boolean esPrincipal, UUID municipioId, String municipioNombre,
                              UUID localidadId, String direccionTexto, String referencia, Double latitud,
                              Double longitud, List<HorarioDto> horarios, List<ExcepcionDto> excepciones) {
    }

    public record HorarioDto(int diaSemana, String abre, String cierra, boolean cerrado) {
    }

    public record ExcepcionDto(java.time.LocalDate fecha, String abre, String cierra, boolean cerrado, String nota) {
    }

    public record ContactoDto(UUID id, UUID sucursalId, String tipo, String valor, boolean esPrincipal) {
    }

    public record MedioFichaDto(UUID medioId, String url, int orden, boolean esPortada, String pieTexto,
                                String moderacion, String motivoRechazo) {
    }

    public record OfertaDto(UUID id, String tipo, String estado, BigDecimal precioDesde, String unidadPrecio,
                            Integer duracionMin, Integer capacidad, int orden, String seccion, List<String> etiquetas,
                            Map<String, OfertaTraduccionDto> traducciones) {
    }

    public record RevisionDto(UUID id, int version, String estado, String motivoRechazo,
                              Map<String, Object> cambios, OffsetDateTime enviadaEn) {
    }

    public record FaltantesDto(List<String> faltantes, Map<String, String> mensajes, int puntajeFicha,
                               boolean puedeEnviar) {
    }

    public record FichaDto(UUID id, String slug, String estado, String nombreComercial, String razonSocial,
                           UUID categoriaId, String categoriaClave, Integer rangoPrecio, BigDecimal precioDesde,
                           String unidadPrecio, String moneda, Map<String, Object> atributos, int puntajeFicha,
                           OffsetDateTime publicadoEn, OffsetDateTime verificadoEn, String rolMiembro,
                           Map<String, TraduccionDto> traducciones, List<SucursalDto> sucursales,
                           List<ContactoDto> contactos, List<UUID> servicioIds, List<IdiomaNivelDto> idiomas,
                           List<MedioFichaDto> medios, List<OfertaDto> ofertas, List<String> faltantes,
                           RevisionDto revisionVigente) {
    }

    public record MiembroDto(UUID usuarioId, String correo, String nombre, String rol, String estado,
                             OffsetDateTime creadoEn) {
    }

    public record InvitacionDto(UUID id, UUID negocioId, String negocioNombre, String invitadoPorNombre,
                                OffsetDateTime creadoEn) {
    }

    public record NegocioAdminDto(UUID id, String slug, String nombreComercial, String estado, String categoriaClave,
                                  String municipioNombre, int puntajeFicha, String origenAlta,
                                  OffsetDateTime creadoEn, OffsetDateTime publicadoEn) {
    }

    /** Resultado de un cambio sobre una ficha publicada: lo que se aplicó y lo que quedó esperando revisión. */
    public record ResultadoCambio(boolean aplicado, boolean pendienteDeRevision, FichaDto ficha) {
    }
}
