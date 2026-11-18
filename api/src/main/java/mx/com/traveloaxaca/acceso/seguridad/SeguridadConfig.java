package mx.com.traveloaxaca.acceso.seguridad;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.security.SecureRandom;
import java.util.List;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import mx.com.traveloaxaca.acceso.PropiedadesApp;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationConverter;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SeguridadConfig {

    private static final Logger log = LoggerFactory.getLogger(SeguridadConfig.class);

    @Bean
    public SecretKey jwtClave(PropiedadesApp props) {
        String secreto = props.seguridad().jwtSecreto();
        byte[] bytes;
        if (secreto == null || secreto.isBlank()) {
            log.warn("JWT_SECRETO no está definido: se genera una llave temporal. Úsalo solo en desarrollo.");
            bytes = new byte[48];
            new SecureRandom().nextBytes(bytes);
        } else {
            bytes = secreto.getBytes(java.nio.charset.StandardCharsets.UTF_8);
            if (bytes.length < 32) {
                throw new IllegalStateException("JWT_SECRETO debe tener al menos 32 caracteres.");
            }
        }
        return new SecretKeySpec(bytes, "HmacSHA256");
    }

    @Bean
    public JwtEncoder jwtEncoder(SecretKey clave) {
        return new NimbusJwtEncoder(new ImmutableSecret<>(clave));
    }

    /** Decodificador de los tokens que llegan en Authorization: solo acepta los de tipo acceso. */
    @Bean
    public JwtDecoder jwtDecoder(SecretKey clave) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(clave).macAlgorithm(MacAlgorithm.HS256).build();
        OAuth2TokenValidator<Jwt> soloAcceso = jwt -> JwtServicio.TIPO_ACCESO.equals(jwt.getClaimAsString("tipo"))
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Tipo de token no válido", null));
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(JwtValidators.createDefault(), soloAcceso));
        return decoder;
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    public SecurityFilterChain cadenaDeSeguridad(HttpSecurity http, ManejadorSeguridad manejador) throws Exception {
        http
                .csrf(c -> c.disable())
                .cors(Customizer.withDefaults())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(a -> a
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/api/v1/publico/**").permitAll()
                        .requestMatchers(HttpMethod.POST,
                                "/api/v1/auth/registro", "/api/v1/auth/ingreso", "/api/v1/auth/renovar",
                                "/api/v1/auth/verificar-correo", "/api/v1/auth/reenviar-verificacion",
                                "/api/v1/auth/olvide-clave", "/api/v1/auth/restablecer-clave").permitAll()
                        .requestMatchers("/actuator/health", "/actuator/health/**",
                                "/api/docs", "/api/docs/**", "/swagger-ui/**", "/swagger-ui.html").permitAll()
                        // El personal interno entra a algunas rutas de /admin; el resto es solo de admin.
                        .requestMatchers(HttpMethod.GET, "/api/v1/admin/negocios", "/api/v1/admin/negocios/**")
                        .hasAnyRole("ADMIN", "EDITOR", "VENTAS")
                        .requestMatchers(HttpMethod.GET, "/api/v1/admin/metricas").hasAnyRole("ADMIN", "EDITOR", "VENTAS")
                        .requestMatchers("/api/v1/admin/campanas", "/api/v1/admin/campanas/**", "/api/v1/admin/origenes")
                        .hasAnyRole("ADMIN", "EDITOR")
                        .requestMatchers("/api/v1/admin/localidades", "/api/v1/admin/localidades/**")
                        .hasAnyRole("ADMIN", "EDITOR")
                        .requestMatchers("/api/v1/admin/lugares", "/api/v1/admin/lugares/**",
                                "/api/v1/admin/rutas", "/api/v1/admin/rutas/**",
                                "/api/v1/admin/eventos", "/api/v1/admin/eventos/**",
                                "/api/v1/admin/inicio", "/api/v1/admin/inicio/**").hasAnyRole("ADMIN", "EDITOR")
                        .requestMatchers("/api/v1/revision", "/api/v1/revision/**").hasAnyRole("ADMIN", "EDITOR")
                        // Cobro manual y patrocinios: administración y ventas. Planes, precios y cupones siguen siendo de admin.
                        .requestMatchers(HttpMethod.POST, "/api/v1/admin/negocios/*/suscripciones")
                        .hasAnyRole("ADMIN", "VENTAS")
                        .requestMatchers("/api/v1/admin/suscripciones/**", "/api/v1/admin/pagos", "/api/v1/admin/pagos/**",
                                "/api/v1/admin/patrocinios", "/api/v1/admin/patrocinios/**",
                                "/api/v1/admin/espacios-patrocinio", "/api/v1/admin/espacios-patrocinio/**")
                        .hasAnyRole("ADMIN", "VENTAS")
                        .requestMatchers(HttpMethod.POST, "/api/v1/admin/negocios/*/verificaciones")
                        .hasAnyRole("ADMIN", "EDITOR")
                        // Ventas y operación: el embudo es de ventas; importar depende del tipo (lo decide el servicio).
                        .requestMatchers("/api/v1/admin/prospectos", "/api/v1/admin/prospectos/**")
                        .hasAnyRole("ADMIN", "VENTAS")
                        .requestMatchers("/api/v1/admin/importaciones", "/api/v1/admin/importaciones/**")
                        .hasAnyRole("ADMIN", "EDITOR", "VENTAS")
                        .requestMatchers(HttpMethod.GET, "/api/v1/admin/afiliados", "/api/v1/admin/afiliados/**")
                        .hasAnyRole("ADMIN", "EDITOR", "VENTAS")
                        .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
                        .anyRequest().authenticated())
                .oauth2ResourceServer(o -> o
                        .jwt(j -> j.jwtAuthenticationConverter(convertidorDeRoles()))
                        .authenticationEntryPoint(manejador)
                        .accessDeniedHandler(manejador))
                .exceptionHandling(e -> e
                        .authenticationEntryPoint(manejador)
                        .accessDeniedHandler(manejador))
                .addFilterAfter(new UsuarioActualFilter(), BearerTokenAuthenticationFilter.class);
        return http.build();
    }

    /** Convierte el claim `roles` (por ejemplo "admin") en la autoridad ROLE_ADMIN. */
    private JwtAuthenticationConverter convertidorDeRoles() {
        JwtAuthenticationConverter conv = new JwtAuthenticationConverter();
        conv.setJwtGrantedAuthoritiesConverter(jwt -> {
            List<String> roles = jwt.getClaimAsStringList("roles");
            if (roles == null) {
                return List.<GrantedAuthority>of();
            }
            return roles.stream()
                    .<GrantedAuthority>map(r -> new SimpleGrantedAuthority("ROLE_" + r.toUpperCase()))
                    .toList();
        });
        return conv;
    }
}
