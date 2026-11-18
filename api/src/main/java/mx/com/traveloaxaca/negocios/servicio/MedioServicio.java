package mx.com.traveloaxaca.negocios.servicio;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Year;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;
import mx.com.traveloaxaca.acceso.PropiedadesApp;
import mx.com.traveloaxaca.acceso.seguridad.LimitadorIntentos;
import mx.com.traveloaxaca.comun.error.BusinessException;
import mx.com.traveloaxaca.negocios.almacen.AlmacenMedios;
import mx.com.traveloaxaca.negocios.dto.NegocioDtos.MedioDto;
import mx.com.traveloaxaca.negocios.dto.NegocioDtos.SubidaDto;
import mx.com.traveloaxaca.negocios.dto.NegocioDtos.SubidaRespuesta;
import mx.com.traveloaxaca.negocios.repo.MedioRepositorio;
import mx.com.traveloaxaca.negocios.repo.MedioRepositorio.MedioFila;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Subida de fotos en dos pasos: pedir URL firmada, subir directo al almacén, confirmar. */
@Service
public class MedioServicio {

    private static final Map<String, String> EXTENSION = Map.of("image/jpeg", "jpg", "image/png", "png", "image/webp", "webp");

    private final MedioRepositorio medios;
    private final AlmacenMedios almacen;
    private final LimitadorIntentos limitador;
    private final PropiedadesApp.Almacenamiento cfg;

    public MedioServicio(MedioRepositorio medios, AlmacenMedios almacen, LimitadorIntentos limitador,
                         PropiedadesApp props) {
        this.medios = medios;
        this.almacen = almacen;
        this.limitador = limitador;
        this.cfg = props.almacenamiento();
    }

    @Transactional
    public SubidaRespuesta solicitarSubida(UUID usuarioId, SubidaDto dto) {
        limitador.consumir("subida|" + usuarioId, cfg.limiteSubidasHora(), 3600,
                "Pediste demasiadas subidas de fotos. Intenta de nuevo en un rato.");
        if (dto.bytes() > cfg.imagenMaxBytes()) {
            String m = "La foto pesa demasiado. El máximo es " + (cfg.imagenMaxBytes() / 1_048_576) + " MB.";
            throw BusinessException.invalida(m, Map.of("bytes", m));
        }
        UUID id = UUID.randomUUID();
        String clave = "medios/" + Year.now().getValue() + "/" + id + "." + EXTENSION.get(dto.mime());
        medios.crear(id, clave, dto.mime(), dto.bytes(), usuarioId);
        var url = almacen.urlDeSubida(clave, dto.mime(), dto.bytes(), Duration.ofMinutes(cfg.subidaVigenciaMinutos()));
        return new SubidaRespuesta(id, url.url(), "PUT", url.encabezados(), Duration.ofMinutes(cfg.subidaVigenciaMinutos()).toSeconds());
    }

    @Transactional
    public MedioDto confirmar(UUID usuarioId, UUID medioId) {
        MedioFila m = medios.porId(medioId)
                .filter(x -> usuarioId.equals(x.subidoPor()))
                .orElseThrow(() -> BusinessException.noEncontrado("No encontramos esa foto."));
        if (m.hash() != null) {
            return aDto(m);
        }
        var objeto = almacen.inspeccionar(m.claveAlmacenamiento())
                .orElseThrow(() -> BusinessException.invalida(
                        "Todavía no recibimos la foto. Súbela con la URL firmada y confirma de nuevo."));
        if (objeto.bytes() != m.bytes() || objeto.bytes() > cfg.imagenMaxBytes()) {
            rechazar(m);
            throw BusinessException.invalida("El archivo subido no coincide con lo que anunciaste. Vuelve a subirlo.");
        }
        byte[] contenido = almacen.leerInicio(m.claveAlmacenamiento(), (int) objeto.bytes());
        var datos = ImagenInfo.analizar(contenido).orElse(null);
        if (datos == null || !datos.mime().equals(m.mime())) {
            rechazar(m);
            throw BusinessException.invalida("El archivo no es una foto JPEG, PNG o WebP válida.");
        }
        medios.confirmar(m.id(), datos.mime(), objeto.bytes(), datos.ancho(), datos.alto(), sha256(contenido));
        return aDto(medios.porId(m.id()).orElseThrow());
    }

    private void rechazar(MedioFila m) {
        try {
            almacen.borrar(m.claveAlmacenamiento());
        } catch (RuntimeException ignorado) {
            // Si no se pudo borrar, el registro queda marcado como eliminado de todos modos.
        }
        medios.marcarEliminado(m.id());
    }

    MedioDto aDto(MedioFila m) {
        return new MedioDto(m.id(), almacen.urlPublica(m.claveAlmacenamiento()), m.ancho(), m.alto(), m.moderacion());
    }

    private static String sha256(byte[] b) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(b));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
