package mx.com.traveloaxaca.medicion.web;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import mx.com.traveloaxaca.comun.api.ApiResponse;
import mx.com.traveloaxaca.comun.api.ApiResponses;
import mx.com.traveloaxaca.medicion.dto.MedicionDtos.EventosUsoDto;
import mx.com.traveloaxaca.medicion.dto.MedicionDtos.EventosUsoRespuesta;
import mx.com.traveloaxaca.medicion.servicio.EventoUsoServicio;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/publico/eventos-uso")
@Tag(name = "Medición")
public class EventoUsoController {

    private final EventoUsoServicio servicio;

    public EventoUsoController(EventoUsoServicio servicio) {
        this.servicio = servicio;
    }

    @Operation(summary = "Registrar lo que hizo el turista (sin cuenta)",
            description = "De 1 a 20 eventos por envío, con el id del dispositivo. Tipos: vista_ficha, toque_whatsapp, llamada, "
                    + "como_llegar, compartido y clic_web. El guardado se registra solo al guardar un favorito. "
                    + "Se omiten negocios no publicados, eventos de más de 24 horas y dobles toques (30 segundos).")
    @PostMapping
    @ResponseStatus(HttpStatus.ACCEPTED)
    public ApiResponse<EventosUsoRespuesta> registrar(@Valid @RequestBody EventosUsoDto cuerpo) {
        return ApiResponses.ok(servicio.registrar(cuerpo));
    }
}
