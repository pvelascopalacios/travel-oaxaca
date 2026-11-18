package mx.com.traveloaxaca.negocios.almacen;

import java.net.URI;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import mx.com.traveloaxaca.acceso.PropiedadesApp;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.ResponseTransformer;
import software.amazon.awssdk.http.urlconnection.UrlConnectionHttpClient;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectRequest;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

/** S3 de AWS o MinIO (o cualquier servicio compatible) con el SDK oficial. */
@Component
@ConditionalOnProperty(name = "app.almacenamiento.modo", havingValue = "s3", matchIfMissing = true)
public class AlmacenS3 implements AlmacenMedios {

    private final PropiedadesApp.Almacenamiento cfg;
    private final S3Client cliente;
    private final S3Presigner firmador;

    public AlmacenS3(PropiedadesApp props) {
        this.cfg = props.almacenamiento();
        Region region = Region.of(cfg.region());
        AwsCredentialsProvider credenciales = vacio(cfg.accesoLlave())
                ? DefaultCredentialsProvider.create()
                : StaticCredentialsProvider.create(AwsBasicCredentials.create(cfg.accesoLlave(), cfg.accesoSecreto()));
        S3Configuration s3cfg = S3Configuration.builder().pathStyleAccessEnabled(cfg.rutaEstilo()).build();

        var cb = S3Client.builder().region(region).credentialsProvider(credenciales)
                .httpClient(UrlConnectionHttpClient.create()).serviceConfiguration(s3cfg);
        if (!vacio(cfg.endpoint())) {
            cb.endpointOverride(URI.create(cfg.endpoint()));
        }
        this.cliente = cb.build();

        // La URL firmada la abre el navegador, así que usa la dirección pública, no la interna de Docker.
        String publico = vacio(cfg.endpointPublico()) ? cfg.endpoint() : cfg.endpointPublico();
        var pb = S3Presigner.builder().region(region).credentialsProvider(credenciales).serviceConfiguration(s3cfg);
        if (!vacio(publico)) {
            pb.endpointOverride(URI.create(publico));
        }
        this.firmador = pb.build();
    }

    @Override
    public UrlSubida urlDeSubida(String clave, String mime, long bytes, Duration vigencia) {
        PutObjectRequest put = PutObjectRequest.builder().bucket(cfg.bucket()).key(clave)
                .contentType(mime).contentLength(bytes).build();
        var firmada = firmador.presignPutObject(PutObjectPresignRequest.builder()
                .signatureDuration(vigencia).putObjectRequest(put).build());
        return new UrlSubida(firmada.url().toString(), Map.of("Content-Type", mime));
    }

    @Override
    public Optional<Objeto> inspeccionar(String clave) {
        try {
            var r = cliente.headObject(HeadObjectRequest.builder().bucket(cfg.bucket()).key(clave).build());
            return Optional.of(new Objeto(r.contentLength(), r.contentType()));
        } catch (NoSuchKeyException e) {
            return Optional.empty();
        } catch (S3Exception e) {
            if (e.statusCode() == 404) {
                return Optional.empty();
            }
            throw e;
        }
    }

    @Override
    public byte[] leerInicio(String clave, int cuantos) {
        return cliente.getObject(GetObjectRequest.builder().bucket(cfg.bucket()).key(clave)
                .range("bytes=0-" + (cuantos - 1)).build(), ResponseTransformer.toBytes()).asByteArray();
    }

    @Override
    public String urlPublica(String clave) {
        String base = cfg.urlPublica();
        return (base.endsWith("/") ? base : base + "/") + clave;
    }

    @Override
    public void borrar(String clave) {
        cliente.deleteObject(DeleteObjectRequest.builder().bucket(cfg.bucket()).key(clave).build());
    }

    private static boolean vacio(String s) {
        return s == null || s.isBlank();
    }
}
