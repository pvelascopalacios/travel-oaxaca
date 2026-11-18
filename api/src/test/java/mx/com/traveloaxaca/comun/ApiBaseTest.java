package mx.com.traveloaxaca.comun;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;
import mx.com.traveloaxaca.comun.auditoria.UsuarioActual;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ApiBaseTest {

    @Autowired MockMvc mvc;
    @Autowired JdbcClient jdbc;
    @Autowired ServicioPrueba servicio;

    @Test
    void estadoMuestraBaseYMigraciones() throws Exception {
        mvc.perform(get("/api/v1/publico/estado"))
                .andExpect(status().isOk())
                .andExpect(header().exists("X-Request-Id"))
                .andExpect(jsonPath("$.ok").value(true))
                .andExpect(jsonPath("$.datos.base.ultimaMigracion").value("9"))
                .andExpect(jsonPath("$.datos.base.tablas").value(78))
                .andExpect(jsonPath("$.solicitudId").exists());
    }

    @Test
    void respetaElIdentificadorDeSolicitud() throws Exception {
        mvc.perform(get("/api/v1/publico/estado").header("X-Request-Id", "abc-123"))
                .andExpect(header().string("X-Request-Id", "abc-123"))
                .andExpect(jsonPath("$.solicitudId").value("abc-123"));
    }

    @Test
    void rutaInexistenteDa404EnElFormatoComun() throws Exception {
        mvc.perform(get("/api/v1/publico/no-existe"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.ok").value(false))
                .andExpect(jsonPath("$.mensajes[0]").value("No encontramos lo que buscas."));
    }

    @Test
    void validacionDevuelveErroresPorCampo() throws Exception {
        mvc.perform(post("/api/v1/prueba/validar").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nombre\":\"\",\"clave\":\"demasiado\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.ok").value(false))
                .andExpect(jsonPath("$.errores.nombre").value("El nombre es obligatorio."))
                .andExpect(jsonPath("$.errores.clave").value("Máximo 5 caracteres."));
    }

    @Test
    void jsonMalFormadoDa400() throws Exception {
        mvc.perform(post("/api/v1/prueba/validar").contentType(MediaType.APPLICATION_JSON).content("{no es json"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.mensajes[0]").value("La petición no tiene el formato esperado."));
    }

    @Test
    void reglaDeNegocioUsaSuEstadoYMensaje() throws Exception {
        mvc.perform(get("/api/v1/prueba/regla"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.mensajes[0]").value("Ese negocio ya tiene una suscripción activa."));
    }

    @Test
    void mensajeDeTriggerDeLaBaseLlegaAlUsuario() throws Exception {
        mvc.perform(get("/api/v1/prueba/trigger"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.mensajes[0]").value("La clave dias_gracia no puede ser mayor que 365"));
    }

    @Test
    void duplicadoDa409() throws Exception {
        mvc.perform(get("/api/v1/prueba/unico"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.mensajes[0]").value("Ya existe un registro con esos datos."));
    }

    @Test
    void errorInesperadoNoFiltraDetallesInternos() throws Exception {
        mvc.perform(get("/api/v1/prueba/inesperado"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.ok").value(false))
                .andExpect(jsonPath("$.mensajes[0]").value(org.hamcrest.Matchers.not(
                        org.hamcrest.Matchers.containsString("secreto"))));
    }

    @Test
    void laAuditoriaRegistraAlUsuarioActual() {
        UUID usuario = UUID.randomUUID();
        String marca = "marca-" + usuario;
        UsuarioActual.ejecutarComo(usuario, () -> servicio.cambiarDescripcion(marca));

        UUID registrado = jdbc.sql("""
                SELECT usuario_id FROM auditoria
                WHERE tabla = 'configuracion' AND registro_id = 'reservas_activas'
                  AND despues->>'descripcion' = :m
                """).param("m", marca).query(UUID.class).single();
        assertThat(registrado).isEqualTo(usuario);
    }

    @Test
    void sinUsuarioLaBitacoraQuedaConUsuarioNulo() {
        String marca = "sistema-" + UUID.randomUUID();
        servicio.cambiarDescripcion(marca);

        Long filas = jdbc.sql("""
                SELECT count(*) FROM auditoria
                WHERE tabla = 'configuracion' AND despues->>'descripcion' = :m AND usuario_id IS NULL
                """).param("m", marca).query(Long.class).single();
        assertThat(filas).isEqualTo(1);
    }

    @Test
    void elUsuarioNoSeFiltraEntreOperaciones() {
        UsuarioActual.ejecutarComo(UUID.randomUUID(), () -> servicio.cambiarDescripcion("a-" + UUID.randomUUID()));
        assertThat(UsuarioActual.obtener()).isEmpty();
    }

    @Test
    void lecturasDeSoloLecturaNoTocanLaBitacora() {
        Long antes = jdbc.sql("SELECT count(*) FROM auditoria").query(Long.class).single();
        UsuarioActual.ejecutarComo(UUID.randomUUID(), () -> servicio.leer());
        Long despues = jdbc.sql("SELECT count(*) FROM auditoria").query(Long.class).single();
        assertThat(despues).isEqualTo(antes);
    }
}
