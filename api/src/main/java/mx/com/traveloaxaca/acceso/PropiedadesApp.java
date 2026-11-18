package mx.com.traveloaxaca.acceso;

import org.springframework.boot.context.properties.ConfigurationProperties;

/** Parámetros de la aplicación (sección `app` de application.yml). */
@ConfigurationProperties(prefix = "app")
public record PropiedadesApp(Seguridad seguridad, Urls urls, Correo correo, AdminInicial adminInicial,
                             Almacenamiento almacenamiento) {

    public record Seguridad(String jwtSecreto, int accesoMinutos, int renovacionDias, int verificacionHoras,
                            int recuperacionMinutos, int claveLongitudMinima, int limiteIngresosFallidos,
                            int ventanaIngresosMinutos, int limiteRegistrosHora, int limiteRecuperacionesHora,
                            int limiteDispositivosHora) {
    }

    public record Urls(String portal) {
    }

    public record Correo(String modo, String remitente, boolean worker) {
    }

    public record AdminInicial(String correo, String clave) {
    }

    public record Almacenamiento(String modo, String bucket, String region, String endpoint, String endpointPublico,
                                 String accesoLlave, String accesoSecreto, boolean rutaEstilo, String urlPublica,
                                 int subidaVigenciaMinutos, long imagenMaxBytes, int limiteSubidasHora) {
    }
}
