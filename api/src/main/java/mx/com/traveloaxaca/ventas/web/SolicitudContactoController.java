package mx.com.traveloaxaca.ventas.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.util.List;
import mx.com.traveloaxaca.comun.api.ApiResponse;
import mx.com.traveloaxaca.comun.api.ApiResponses;
import mx.com.traveloaxaca.ventas.dto.VentasDtos.SolicitudContactoDto;
import mx.com.traveloaxaca.ventas.servicio.ProspectoServicio;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** «Quiero que me contacten»: un dueño de negocio deja sus datos sin crear cuenta y queda como prospecto. */
@RestController
@RequestMapping("/api/v1/publico/prospectos")
@Tag(name = "Solicitud de contacto (público)")
public class SolicitudContactoController {

    private final ProspectoServicio servicio;

    public SolicitudContactoController(ProspectoServicio servicio) {
        this.servicio = servicio;
    }

    @Operation(summary = "Pedir que el equipo contacte a un negocio",
            description = "Crea un prospecto con origen formulario_web. Pide teléfono o correo. Un dato repetido responde igual que un alta, "
                    + "el campo sitioWeb es un señuelo para bots y hay un límite de 3 solicitudes por hora por dirección.")
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<Void> solicitar(@Valid @RequestBody SolicitudContactoDto dto, HttpServletRequest req) {
        servicio.solicitarContacto(dto, req.getRemoteAddr());
        return ApiResponses.ok(null, List.of("Recibimos tu solicitud. Alguien del equipo te contactará pronto."));
    }
}
