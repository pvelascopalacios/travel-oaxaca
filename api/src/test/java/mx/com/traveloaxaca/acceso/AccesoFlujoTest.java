package mx.com.traveloaxaca.acceso;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import mx.com.traveloaxaca.acceso.seguridad.JwtServicio;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AccesoFlujoTest {

    private static final String CLAVE = "una-clave-larga-123";

    @Autowired MockMvc mvc;
    @Autowired JdbcClient jdbc;
    @Autowired JwtServicio jwt;

    // ---------------- apoyo ----------------

    private static String correoNuevo() {
        return "t" + UUID.randomUUID().toString().substring(0, 8) + "@ejemplo.mx";
    }

    private ResultActions enviar(String ruta, String json, String token) throws Exception {
        var b = post(ruta).contentType(MediaType.APPLICATION_JSON).content(json);
        if (token != null) {
            b.header("Authorization", "Bearer " + token);
        }
        return mvc.perform(b);
    }

    private ResultActions registrar(String correo, String clave) throws Exception {
        return enviar("/api/v1/auth/registro", json(correo, clave, true), null);
    }

    private static String json(String correo, String clave, boolean acepta) {
        return "{\"correo\":\"" + correo + "\",\"clave\":\"" + clave + "\",\"nombre\":\"Ana Prueba\",\"aceptaTerminos\":"
                + acepta + "}";
    }

    private static String campo(ResultActions r, String ruta) throws Exception {
        return JsonPath.read(r.andReturn().getResponse().getContentAsString(), ruta);
    }

    private String registrarYObtenerAcceso(String correo) throws Exception {
        return campo(registrar(correo, CLAVE).andExpect(status().isCreated()), "$.datos.tokenAcceso");
    }

    private UUID idDe(String correo) {
        return jdbc.sql("SELECT id FROM usuario WHERE correo = CAST(:c AS citext)").param("c", correo)
                .query(UUID.class).single();
    }

    // ---------------- registro e ingreso ----------------

    @Test
    void registroCreaCuentaConSesionRolYConsentimientos() throws Exception {
        String correo = correoNuevo();
        registrar(correo, CLAVE).andExpect(status().isCreated())
                .andExpect(jsonPath("$.ok").value(true))
                .andExpect(jsonPath("$.datos.usuario.correo").value(correo))
                .andExpect(jsonPath("$.datos.usuario.roles[0]").value("turista"))
                .andExpect(jsonPath("$.datos.usuario.correoVerificado").value(false))
                .andExpect(jsonPath("$.datos.tokenRenovacion").exists());
        Long consentimientos = jdbc.sql("SELECT count(*) FROM consentimiento WHERE usuario_id = :u")
                .param("u", idDe(correo)).query(Long.class).single();
        assertThat(consentimientos).isEqualTo(2);
        Long correos = jdbc.sql("""
                SELECT count(*) FROM notificacion WHERE usuario_id = :u AND plantilla_clave = 'verificar_correo'""")
                .param("u", idDe(correo)).query(Long.class).single();
        assertThat(correos).isEqualTo(1);
    }

    @Test
    void registroConCorreoRepetidoEnOtraCapitalizacionDa409() throws Exception {
        String correo = correoNuevo();
        registrar(correo, CLAVE).andExpect(status().isCreated());
        registrar(correo.toUpperCase(), CLAVE).andExpect(status().isConflict());
    }

    @Test
    void registroConClaveCortaDa422() throws Exception {
        registrar(correoNuevo(), "corta").andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.errores.clave").exists());
    }

    @Test
    void registroSinAceptarTerminosDa400() throws Exception {
        enviar("/api/v1/auth/registro", json(correoNuevo(), CLAVE, false), null)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errores.aceptaTerminos").exists());
    }

    @Test
    void ingresoCorrectoEIncorrecto() throws Exception {
        String correo = correoNuevo();
        registrar(correo, CLAVE).andExpect(status().isCreated());
        enviar("/api/v1/auth/ingreso", "{\"correo\":\"" + correo.toUpperCase() + "\",\"clave\":\"" + CLAVE + "\"}", null)
                .andExpect(status().isOk()).andExpect(jsonPath("$.datos.tokenAcceso").exists());
        enviar("/api/v1/auth/ingreso", "{\"correo\":\"" + correo + "\",\"clave\":\"mala-mala-mala\"}", null)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.mensajes[0]").value("Correo o contraseña incorrectos."));
        enviar("/api/v1/auth/ingreso", "{\"correo\":\"" + correoNuevo() + "\",\"clave\":\"mala-mala-mala\"}", null)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.mensajes[0]").value("Correo o contraseña incorrectos."));
    }

    @Test
    void cincoIngresosFallidosBloqueanTemporalmente() throws Exception {
        String correo = correoNuevo();
        registrar(correo, CLAVE).andExpect(status().isCreated());
        String malo = "{\"correo\":\"" + correo + "\",\"clave\":\"mala-mala-mala\"}";
        for (int i = 0; i < 5; i++) {
            enviar("/api/v1/auth/ingreso", malo, null).andExpect(status().isUnauthorized());
        }
        enviar("/api/v1/auth/ingreso", malo, null).andExpect(status().isTooManyRequests());
        enviar("/api/v1/auth/ingreso", "{\"correo\":\"" + correo + "\",\"clave\":\"" + CLAVE + "\"}", null)
                .andExpect(status().isTooManyRequests());
    }

    // ---------------- perfil y token ----------------

    @Test
    void perfilPideSesion() throws Exception {
        mvc.perform(get("/api/v1/mi/perfil")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.ok").value(false));
        String acceso = registrarYObtenerAcceso(correoNuevo());
        mvc.perform(get("/api/v1/mi/perfil").header("Authorization", "Bearer " + acceso))
                .andExpect(status().isOk()).andExpect(jsonPath("$.datos.nombre").value("Ana Prueba"));
        mvc.perform(get("/api/v1/mi/perfil").header("Authorization", "Bearer basura"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void unTokenDeAccionNoSirveComoTokenDeAcceso() throws Exception {
        String correo = correoNuevo();
        registrar(correo, CLAVE).andExpect(status().isCreated());
        String falso = jwt.emitirAccion(JwtServicio.TIPO_VERIFICAR, idDe(correo), Duration.ofHours(1), Map.of());
        mvc.perform(get("/api/v1/mi/perfil").header("Authorization", "Bearer " + falso))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void actualizarPerfilValidaTelefono() throws Exception {
        String acceso = registrarYObtenerAcceso(correoNuevo());
        mvc.perform(put("/api/v1/mi/perfil").header("Authorization", "Bearer " + acceso)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nombre\":\"Ana Nueva\",\"telefonoE164\":\"9541234567\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/v1/mi/perfil").header("Authorization", "Bearer " + acceso)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nombre\":\"Ana Nueva\",\"telefonoE164\":\"+529541234567\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.datos.nombre").value("Ana Nueva"))
                .andExpect(jsonPath("$.datos.telefonoE164").value("+529541234567"));
    }

    // ---------------- renovación ----------------

    @Test
    void renovarRotaElTokenYDetectaReuso() throws Exception {
        var reg = registrar(correoNuevo(), CLAVE).andExpect(status().isCreated());
        String refresco1 = campo(reg, "$.datos.tokenRenovacion");

        var r2 = enviar("/api/v1/auth/renovar", "{\"tokenRenovacion\":\"" + refresco1 + "\"}", null)
                .andExpect(status().isOk());
        String refresco2 = campo(r2, "$.datos.tokenRenovacion");
        assertThat(refresco2).isNotEqualTo(refresco1);

        // Reusar el primero: se rechaza y se cierran todas las sesiones, incluida la del segundo token.
        enviar("/api/v1/auth/renovar", "{\"tokenRenovacion\":\"" + refresco1 + "\"}", null)
                .andExpect(status().isUnauthorized());
        enviar("/api/v1/auth/renovar", "{\"tokenRenovacion\":\"" + refresco2 + "\"}", null)
                .andExpect(status().isUnauthorized());
    }

    @Test
    void salirCierraLaSesion() throws Exception {
        var reg = registrar(correoNuevo(), CLAVE).andExpect(status().isCreated());
        String acceso = campo(reg, "$.datos.tokenAcceso");
        String refresco = campo(reg, "$.datos.tokenRenovacion");
        enviar("/api/v1/auth/salir", "{}", acceso).andExpect(status().isOk());
        enviar("/api/v1/auth/renovar", "{\"tokenRenovacion\":\"" + refresco + "\"}", null)
                .andExpect(status().isUnauthorized());
    }

    @Test
    void sesionesSeListanYSeCierranSoloLasPropias() throws Exception {
        String correo = correoNuevo();
        String acceso = registrarYObtenerAcceso(correo);
        enviar("/api/v1/auth/ingreso", "{\"correo\":\"" + correo + "\",\"clave\":\"" + CLAVE + "\"}", null)
                .andExpect(status().isOk());
        var lista = mvc.perform(get("/api/v1/mi/sesiones").header("Authorization", "Bearer " + acceso))
                .andExpect(status().isOk()).andExpect(jsonPath("$.datos.length()").value(2));
        java.util.List<String> otras = JsonPath.read(lista.andReturn().getResponse().getContentAsString(),
                "$.datos[?(@.actual==false)].id");
        String otra = otras.get(0);
        mvc.perform(delete("/api/v1/mi/sesiones/" + otra).header("Authorization", "Bearer " + acceso))
                .andExpect(status().isOk());
        mvc.perform(delete("/api/v1/mi/sesiones/" + UUID.randomUUID()).header("Authorization", "Bearer " + acceso))
                .andExpect(status().isNotFound());
    }

    // ---------------- correo y contraseña ----------------

    @Test
    void verificarCorreoConElEnlace() throws Exception {
        String correo = correoNuevo();
        registrar(correo, CLAVE).andExpect(status().isCreated());
        UUID id = idDe(correo);
        String token = jwt.emitirAccion(JwtServicio.TIPO_VERIFICAR, id, Duration.ofHours(1), Map.of("correo", correo));
        enviar("/api/v1/auth/verificar-correo", "{\"token\":\"" + token + "\"}", null).andExpect(status().isOk());
        Boolean verificado = jdbc.sql("SELECT correo_verificado_en IS NOT NULL FROM usuario WHERE id = :i")
                .param("i", id).query(Boolean.class).single();
        assertThat(verificado).isTrue();
        enviar("/api/v1/auth/verificar-correo", "{\"token\":\"basura\"}", null)
                .andExpect(status().isUnprocessableEntity());
    }

    @Test
    void olvideClaveRespondeIgualExistaONoLaCuenta() throws Exception {
        String correo = correoNuevo();
        registrar(correo, CLAVE).andExpect(status().isCreated());
        var a = enviar("/api/v1/auth/olvide-clave", "{\"correo\":\"" + correo + "\"}", null).andExpect(status().isOk());
        var b = enviar("/api/v1/auth/olvide-clave", "{\"correo\":\"" + correoNuevo() + "\"}", null)
                .andExpect(status().isOk());
        assertThat(campo(a, "$.mensajes[0]")).isEqualTo(campo(b, "$.mensajes[0]"));
    }

    @Test
    void restablecerClaveFuncionaUnaSolaVez() throws Exception {
        String correo = correoNuevo();
        var reg = registrar(correo, CLAVE).andExpect(status().isCreated());
        String refresco = campo(reg, "$.datos.tokenRenovacion");
        UUID id = idDe(correo);
        String hash = jdbc.sql("SELECT hash_clave FROM usuario WHERE id = :i").param("i", id).query(String.class).single();
        String token = jwt.emitirAccion(JwtServicio.TIPO_RESTABLECER, id, Duration.ofMinutes(30),
                Map.of("h", JwtServicio.huellaClave(hash)));

        enviar("/api/v1/auth/restablecer-clave", "{\"token\":\"" + token + "\",\"clave\":\"otra-clave-larga-456\"}", null)
                .andExpect(status().isOk());
        enviar("/api/v1/auth/restablecer-clave", "{\"token\":\"" + token + "\",\"clave\":\"y-otra-mas-larga-789\"}", null)
                .andExpect(status().isUnprocessableEntity());
        enviar("/api/v1/auth/ingreso", "{\"correo\":\"" + correo + "\",\"clave\":\"otra-clave-larga-456\"}", null)
                .andExpect(status().isOk());
        enviar("/api/v1/auth/renovar", "{\"tokenRenovacion\":\"" + refresco + "\"}", null)
                .andExpect(status().isUnauthorized());
    }

    @Test
    void cambiarClaveExigeLaActual() throws Exception {
        String acceso = registrarYObtenerAcceso(correoNuevo());
        mvc.perform(put("/api/v1/mi/clave").header("Authorization", "Bearer " + acceso)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"claveActual\":\"incorrecta-123\",\"claveNueva\":\"otra-clave-larga-456\"}"))
                .andExpect(status().isUnprocessableEntity()).andExpect(jsonPath("$.errores.claveActual").exists());
        mvc.perform(put("/api/v1/mi/clave").header("Authorization", "Bearer " + acceso)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"claveActual\":\"" + CLAVE + "\",\"claveNueva\":\"otra-clave-larga-456\"}"))
                .andExpect(status().isOk());
    }

    // ---------------- privacidad ----------------

    @Test
    void solicitudDePrivacidadSoloUnaAbiertaPorTipo() throws Exception {
        String acceso = registrarYObtenerAcceso(correoNuevo());
        String cuerpo = "{\"tipo\":\"acceso\",\"detalle\":\"Quiero una copia de mis datos\"}";
        mvc.perform(post("/api/v1/mi/solicitudes-privacidad").header("Authorization", "Bearer " + acceso)
                        .contentType(MediaType.APPLICATION_JSON).content(cuerpo))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.datos.estado").value("recibida"));
        mvc.perform(post("/api/v1/mi/solicitudes-privacidad").header("Authorization", "Bearer " + acceso)
                        .contentType(MediaType.APPLICATION_JSON).content(cuerpo))
                .andExpect(status().isConflict());
    }

    @Test
    void consentimientosSeRegistranYSeListan() throws Exception {
        String acceso = registrarYObtenerAcceso(correoNuevo());
        mvc.perform(post("/api/v1/mi/consentimientos").header("Authorization", "Bearer " + acceso)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"tipo\":\"marketing\",\"aceptado\":true}"))
                .andExpect(status().isCreated());
        mvc.perform(get("/api/v1/mi/consentimientos").header("Authorization", "Bearer " + acceso))
                .andExpect(status().isOk()).andExpect(jsonPath("$.datos.length()").value(3));
    }

    // ---------------- dispositivos ----------------

    @Test
    void dispositivoSeRegistraSinCuentaYIgnoraIdsDesconocidos() throws Exception {
        var r = enviar("/api/v1/publico/dispositivos", "{\"plataforma\":\"android\",\"versionApp\":\"1.0.0\"}", null)
                .andExpect(status().isOk());
        String id = campo(r, "$.datos.dispositivoId");
        enviar("/api/v1/publico/dispositivos", "{\"dispositivoId\":\"" + id + "\",\"plataforma\":\"android\"}", null)
                .andExpect(status().isOk()).andExpect(jsonPath("$.datos.dispositivoId").value(id));
        enviar("/api/v1/publico/dispositivos",
                "{\"dispositivoId\":\"" + UUID.randomUUID() + "\",\"plataforma\":\"ios\"}", null)
                .andExpect(status().isOk());
        enviar("/api/v1/publico/dispositivos", "{\"plataforma\":\"windows\"}", null).andExpect(status().isBadRequest());
    }

    // ---------------- administración ----------------

    private String adminAcceso() throws Exception {
        String correo = correoNuevo();
        registrar(correo, CLAVE).andExpect(status().isCreated());
        jdbc.sql("INSERT INTO usuario_rol (usuario_id, rol_id) SELECT :u, id FROM rol WHERE clave = 'admin'")
                .param("u", idDe(correo)).update();
        // Hay que volver a entrar para que el token lleve el rol nuevo.
        return campo(enviar("/api/v1/auth/ingreso", "{\"correo\":\"" + correo + "\",\"clave\":\"" + CLAVE + "\"}", null)
                .andExpect(status().isOk()), "$.datos.tokenAcceso");
    }

    @Test
    void rutasDeAdminPidenRolAdmin() throws Exception {
        mvc.perform(get("/api/v1/admin/usuarios")).andExpect(status().isUnauthorized());
        String turista = registrarYObtenerAcceso(correoNuevo());
        mvc.perform(get("/api/v1/admin/usuarios").header("Authorization", "Bearer " + turista))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/admin/usuarios").header("Authorization", "Bearer " + adminAcceso()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.datos.elementos").isArray());
    }

    @Test
    void adminSuspendeYRestauraUsuariosPeroNoASiMismo() throws Exception {
        String admin = adminAcceso();
        String correo = correoNuevo();
        var reg = registrar(correo, CLAVE).andExpect(status().isCreated());
        String refresco = campo(reg, "$.datos.tokenRenovacion");
        UUID id = idDe(correo);

        mvc.perform(patch("/api/v1/admin/usuarios/" + id + "/estado").header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"estado\":\"suspendido\"}"))
                .andExpect(status().isOk());
        enviar("/api/v1/auth/ingreso", "{\"correo\":\"" + correo + "\",\"clave\":\"" + CLAVE + "\"}", null)
                .andExpect(status().isForbidden());
        enviar("/api/v1/auth/renovar", "{\"tokenRenovacion\":\"" + refresco + "\"}", null)
                .andExpect(status().isUnauthorized());
        mvc.perform(patch("/api/v1/admin/usuarios/" + id + "/estado").header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"estado\":\"activo\"}"))
                .andExpect(status().isOk());

        String propio = JsonPath.read(mvc.perform(get("/api/v1/mi/perfil").header("Authorization", "Bearer " + admin))
                .andReturn().getResponse().getContentAsString(), "$.datos.id");
        mvc.perform(patch("/api/v1/admin/usuarios/" + propio + "/estado").header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"estado\":\"suspendido\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminAsignaYQuitaRolesGlobalesPeroNoLosDeNegocio() throws Exception {
        String admin = adminAcceso();
        String correo = correoNuevo();
        registrar(correo, CLAVE).andExpect(status().isCreated());
        UUID id = idDe(correo);
        mvc.perform(post("/api/v1/admin/usuarios/" + id + "/roles").header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"rol\":\"editor\"}"))
                .andExpect(status().isCreated());
        mvc.perform(post("/api/v1/admin/usuarios/" + id + "/roles").header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"rol\":\"dueno\"}"))
                .andExpect(status().isUnprocessableEntity());
        mvc.perform(delete("/api/v1/admin/usuarios/" + id + "/roles/editor").header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk());
        mvc.perform(delete("/api/v1/admin/usuarios/" + id + "/roles/editor").header("Authorization", "Bearer " + admin))
                .andExpect(status().isNotFound());
    }

    @Test
    void adminResuelveSolicitudesDePrivacidadUnaSolaVez() throws Exception {
        String admin = adminAcceso();
        String acceso = registrarYObtenerAcceso(correoNuevo());
        var creada = mvc.perform(post("/api/v1/mi/solicitudes-privacidad").header("Authorization", "Bearer " + acceso)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"tipo\":\"rectificacion\"}"))
                .andExpect(status().isCreated());
        String id = JsonPath.read(creada.andReturn().getResponse().getContentAsString(), "$.datos.id");
        mvc.perform(patch("/api/v1/admin/solicitudes-privacidad/" + id).header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"estado\":\"resuelta\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.datos.estado").value("resuelta"))
                .andExpect(jsonPath("$.datos.resueltaEn").exists());
        mvc.perform(patch("/api/v1/admin/solicitudes-privacidad/" + id).header("Authorization", "Bearer " + admin)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"estado\":\"rechazada\"}"))
                .andExpect(status().isConflict());
        mvc.perform(get("/api/v1/admin/solicitudes-privacidad?estado=resuelta")
                        .header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk()).andExpect(jsonPath("$.datos.total").isNumber());
    }
}
