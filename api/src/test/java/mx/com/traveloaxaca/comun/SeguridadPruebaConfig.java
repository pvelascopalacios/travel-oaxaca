package mx.com.traveloaxaca.comun;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

/** Deja abiertas las rutas /api/v1/prueba, que solo existen en las pruebas. */
@Configuration
class SeguridadPruebaConfig {

    @Bean
    @Order(Ordered.HIGHEST_PRECEDENCE)
    SecurityFilterChain cadenaDePrueba(HttpSecurity http) throws Exception {
        http.securityMatcher("/api/v1/prueba/**")
                .authorizeHttpRequests(a -> a.anyRequest().permitAll())
                .csrf(c -> c.disable())
                .cors(Customizer.withDefaults());
        return http.build();
    }
}
